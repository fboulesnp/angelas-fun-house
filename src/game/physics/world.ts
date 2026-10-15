// Deterministic fixed-step pinball world: balls, static/dynamic colliders, flippers, sensors.
// Collision uses closest-point capsule tests at 960 Hz; with MAX_SPEED 3900 a ball moves at most
// ~4 units per substep (a third of its radius), so it cannot tunnel through walls or flippers.

import { Ball } from './ball.ts';
import { Flipper, FLIPPER_TUNING } from './flipper.ts';
import {
  BALL_R, MAX_SPEED, STEP, SUBSTEPS, TABLE_H, TABLE_W,
  type Collider, type ContactInfo, type Layer, type Material, type Shape,
} from './types.ts';

const CELL = 48;

export interface ContactEvent extends ContactInfo {
  isNew: boolean;
}

export class World {
  colliders: Collider[] = [];
  flippers: Flipper[] = [];
  balls: Ball[] = [];
  time = 0;
  gravity = 1750;
  /** Linear rolling resistance per second. */
  damping = 0.05;
  /** Extra downhill pull on ramps (layer 1) to mimic the incline. */
  rampGravityScale = 1.25;
  private nextId = 1;
  private cols = Math.ceil((TABLE_W + 200) / CELL);
  private rows = Math.ceil((TABLE_H + 200) / CELL);
  private grid: Collider[][] = [];
  private dynamics: Collider[] = [];
  private stamp: number[] = [];
  private stampValue = 0;
  private built = false;

  addCollider(c: Omit<Collider, 'id' | 'enabled' | 'sensor' | 'layer'> & Partial<Pick<Collider, 'enabled' | 'sensor' | 'layer'>>): Collider {
    const col: Collider = { enabled: true, sensor: false, layer: 0, ...c, id: this.nextId++ };
    this.colliders.push(col);
    if (this.built) this.index(col);
    return col;
  }

  addFlipper(f: Flipper) {
    this.flippers.push(f);
  }

  addBall(x: number, y: number): Ball {
    const b = new Ball(x, y);
    b.anchorTime = this.time;
    this.balls.push(b);
    return b;
  }

  removeBall(b: Ball) {
    const i = this.balls.indexOf(b);
    if (i >= 0) this.balls.splice(i, 1);
  }

  /** Build the static broad-phase grid. Call once after the table is built. */
  finalize() {
    this.grid = Array.from({ length: this.cols * this.rows }, () => []);
    this.dynamics = [];
    for (const c of this.colliders) this.index(c);
    this.built = true;
  }

  private index(c: Collider) {
    if (c.dynamic) {
      this.dynamics.push(c);
      return;
    }
    const [x0, y0, x1, y1] = aabb(c.shape, BALL_R + 2);
    const cx0 = this.cellX(x0);
    const cx1 = this.cellX(x1);
    const cy0 = this.cellY(y0);
    const cy1 = this.cellY(y1);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) this.grid[cy * this.cols + cx].push(c);
    }
  }

  private cellX(x: number) {
    return Math.max(0, Math.min(this.cols - 1, Math.floor((x + 100) / CELL)));
  }

  private cellY(y: number) {
    return Math.max(0, Math.min(this.rows - 1, Math.floor((y + 100) / CELL)));
  }

  /** Advance one fixed STEP. */
  step() {
    const h = STEP / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) this.substep(h);
  }

  private substep(h: number) {
    this.time += h;
    for (const f of this.flippers) f.step(h);
    const balls = this.balls;
    for (const b of balls) {
      if (b.state === 'held' || b.state === 'transit' || b.state === 'drained') continue;
      const g = this.gravity * (b.layer === 1 ? this.rampGravityScale : 1);
      b.vy += g * h;
      const damp = 1 - this.damping * h;
      b.vx *= damp;
      b.vy *= damp;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx *= MAX_SPEED / sp;
        b.vy *= MAX_SPEED / sp;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.spin += (sp * h) / b.r;
      b.cradled = false;
      // swap touching sets
      const prev = b.touching;
      b.touching = b.touchingNow;
      b.touchingNow = prev;
      b.touchingNow.clear();
      this.collideFlippers(b);
      this.collideColliders(b);
    }
    // ball-ball
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.state !== 'live' && a.state !== 'shooter') continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j];
        if ((c.state !== 'live' && c.state !== 'shooter') || c.layer !== a.layer) continue;
        collideBalls(a, c);
      }
    }
  }

  private collideFlippers(b: Ball) {
    for (const f of this.flippers) {
      if (f.layer !== b.layer) continue;
      const ws = f.widthScale;
      const dx = f.tx - f.px;
      const dy = f.ty - f.py;
      const len2 = dx * dx + dy * dy;
      let t = ((b.x - f.px) * dx + (b.y - f.py) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = f.px + dx * t;
      const qy = f.py + dy * t;
      const rr = (f.r0 + (f.r1 - f.r0) * t) * ws;
      let nx = b.x - qx;
      let ny = b.y - qy;
      const d = Math.hypot(nx, ny);
      const minD = b.r + rr;
      if (d >= minD) continue;
      if (d < 1e-6) {
        nx = -dy;
        ny = dx;
        const l = Math.hypot(nx, ny);
        nx /= l;
        ny /= l;
        if (ny > 0) {
          nx = -nx;
          ny = -ny;
        }
      } else {
        nx /= d;
        ny /= d;
      }
      const cx = qx + nx * rr;
      const cy = qy + ny * rr;
      const [svx, svy] = f.pointVelocity(cx, cy);
      resolve(b, nx, ny, minD - d, FLIPPER_MAT, svx, svy);
      if (f.isRaisedAndHeld && ny < -0.3) b.cradled = true;
    }
  }

  private collideColliders(b: Ball) {
    this.stampValue++;
    const cellIdx = this.cellY(b.y) * this.cols + this.cellX(b.x);
    const list = this.grid[cellIdx];
    if (list) for (const c of list) this.testCollider(b, c);
    for (const c of this.dynamics) this.testCollider(b, c);
  }

  private testCollider(b: Ball, c: Collider) {
    if (this.stamp[c.id] === this.stampValue) return;
    this.stamp[c.id] = this.stampValue;
    if (!c.enabled || c.layer !== b.layer) {
      if (c.sensor && b.sensors.has(c.id)) {
        b.sensors.delete(c.id);
        c.owner?.onSensorExit?.(c, b);
      }
      return;
    }
    const s = c.shape;
    let qx: number;
    let qy: number;
    if (s.kind === 'circle') {
      qx = s.x;
      qy = s.y;
    } else {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((b.x - s.x1) * dx + (b.y - s.y1) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      qx = s.x1 + dx * t;
      qy = s.y1 + dy * t;
    }
    let nx = b.x - qx;
    let ny = b.y - qy;
    const d = Math.hypot(nx, ny);
    if (c.sensor) {
      const inside = d < s.r;
      const was = b.sensors.has(c.id);
      if (inside && !was) {
        b.sensors.add(c.id);
        c.owner?.onSensorEnter?.(c, b);
      } else if (!inside && was) {
        b.sensors.delete(c.id);
        c.owner?.onSensorExit?.(c, b);
      }
      return;
    }
    const minD = b.r + s.r;
    if (d >= minD) {
      if (c.oneWay) b.passing.delete(c.id);
      return;
    }
    if (c.oneWay) {
      const side = (b.x - qx) * c.oneWay.nx + (b.y - qy) * c.oneWay.ny;
      if (b.passing.has(c.id)) return;
      if (side < 0) {
        // Approaching from the pass-through side: let it through until clear.
        b.passing.add(c.id);
        return;
      }
    }
    if (d < 1e-6) {
      if (s.kind === 'seg') {
        nx = -(s.y2 - s.y1);
        ny = s.x2 - s.x1;
      } else {
        nx = 0;
        ny = -1;
      }
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
    } else {
      nx /= d;
      ny /= d;
    }
    const impact = resolve(b, nx, ny, minD - d, c.material, 0, 0);
    const isNew = !b.touching.has(c.id);
    b.touchingNow.add(c.id);
    if (c.owner?.onContact) {
      const info: ContactEvent = { nx, ny, impact, isNew };
      if (isNew) b.lastContactStart.set(c.id, this.time);
      c.owner.onContact(c, b, info);
    }
  }

  /** True when a ball rests in a legitimate cradle or is otherwise expected to be still. */
  isCradled(b: Ball): boolean {
    return b.cradled;
  }
}

const FLIPPER_MAT: Material = {
  restitution: FLIPPER_TUNING.restitution,
  friction: FLIPPER_TUNING.friction,
  restSpeed: 70,
};

/** Push the ball out along n and bounce its velocity relative to a surface moving at (svx, svy). */
export function resolve(b: Ball, nx: number, ny: number, pen: number, m: Material, svx: number, svy: number): number {
  b.x += nx * (pen + 0.01);
  b.y += ny * (pen + 0.01);
  let rvx = b.vx - svx;
  let rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const e = -vn < m.restSpeed ? 0 : m.restitution;
  rvx -= (1 + e) * vn * nx;
  rvy -= (1 + e) * vn * ny;
  // Coulomb-style tangential friction proportional to the normal impulse.
  const vn2 = rvx * nx + rvy * ny;
  const tvx = rvx - vn2 * nx;
  const tvy = rvy - vn2 * ny;
  const tl = Math.hypot(tvx, tvy);
  if (tl > 1e-6) {
    const jt = Math.min(tl, m.friction * (1 + e) * -vn);
    rvx -= (tvx / tl) * jt;
    rvy -= (tvy / tl) * jt;
  }
  b.vx = rvx + svx;
  b.vy = rvy + svy;
  return -vn;
}

function collideBalls(a: Ball, c: Ball) {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const d = Math.hypot(dx, dy);
  const minD = a.r + c.r;
  if (d >= minD || d < 1e-6) return;
  const nx = dx / d;
  const ny = dy / d;
  const pen = (minD - d) / 2;
  a.x -= nx * pen;
  a.y -= ny * pen;
  c.x += nx * pen;
  c.y += ny * pen;
  const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
  if (rv >= 0) return;
  const j = (-(1 + 0.9) * rv) / 2;
  a.vx -= j * nx;
  a.vy -= j * ny;
  c.vx += j * nx;
  c.vy += j * ny;
}

export function aabb(s: Shape, pad = 0): [number, number, number, number] {
  if (s.kind === 'circle') return [s.x - s.r - pad, s.y - s.r - pad, s.x + s.r + pad, s.y + s.r + pad];
  return [
    Math.min(s.x1, s.x2) - s.r - pad,
    Math.min(s.y1, s.y2) - s.r - pad,
    Math.max(s.x1, s.x2) + s.r + pad,
    Math.max(s.y1, s.y2) + s.r + pad,
  ];
}

/** Distance from a point to a shape's core (segment or circle center), minus its radius. */
export function shapeDistance(s: Shape, x: number, y: number): number {
  if (s.kind === 'circle') return Math.hypot(x - s.x, y - s.y) - s.r;
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((x - s.x1) * dx + (y - s.y1) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(x - (s.x1 + dx * t), y - (s.y1 + dy * t)) - s.r;
}

export type { Layer };
