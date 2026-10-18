// The shared, tested family of pinball mechanisms. Tables compose these; they never
// implement their own collision code. Every mechanism that scores debounces its contacts.

import type { Ball } from '../physics/ball.ts';
import { Flipper, type FlipperSpec } from '../physics/flipper.ts';
import { shapeDistance } from '../physics/world.ts';
import {
  BALL_R, MATERIALS, type Collider, type ColliderOwner, type ContactInfo, type Layer, type MaterialName, type SegShape,
} from '../physics/types.ts';
import type { TableRuntime } from './runtime.ts';

export type LampState = 'off' | 'on' | 'flash' | 'pulse';

export type WallStyle = 'rail' | 'wood' | 'glass' | 'rubber' | 'invisible' | 'guide';

export abstract class Mechanism implements ColliderOwner {
  abstract readonly kind: string;
  readonly id: string;
  readonly rt: TableRuntime;
  group?: string;
  label?: string;
  /** Optional icon key a table's art can draw on the mechanism. */
  icon?: string;
  colliders: Collider[] = [];
  lamp: LampState = 'off';
  /** Lamp colour override (CSS colour). */
  lampColor?: string;
  /** Seconds left on the hit flash animation. */
  hitFlash = 0;
  layer: Layer = 0;
  /** Debounce: last scoring time per ball. */
  protected lastFire = new Map<number, number>();
  onContact?(c: Collider, ball: Ball, info: ContactInfo): void;
  onSensorEnter?(c: Collider, ball: Ball): void;
  onSensorExit?(c: Collider, ball: Ball): void;

  constructor(rt: TableRuntime, id: string) {
    this.rt = rt;
    this.id = id;
  }

  update(dt: number): void {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  reset(): void {}

  /** True if this ball has not fired this mechanism within `cooldown` seconds. */
  protected ready(ball: Ball, cooldown: number): boolean {
    const t = this.rt.time;
    const last = this.lastFire.get(ball.id);
    if (last !== undefined && t - last < cooldown) return false;
    this.lastFire.set(ball.id, t);
    return true;
  }

  protected collider(c: Omit<Collider, 'id' | 'enabled' | 'sensor' | 'layer'> & Partial<Pick<Collider, 'enabled' | 'sensor' | 'layer'>>): Collider {
    const col = this.rt.world.addCollider({ layer: this.layer, owner: this, ...c });
    this.colliders.push(col);
    return col;
  }
}

// ------------------------------------------------------------------ walls

export class Wall extends Mechanism {
  kind = 'wall' as const;
  points: [number, number][];
  style: WallStyle;
  r: number;
  closed: boolean;
  material: MaterialName;
  constructor(rt: TableRuntime, id: string, points: [number, number][], opts: { r?: number; material?: MaterialName; layer?: Layer; style?: WallStyle; closed?: boolean } = {}) {
    super(rt, id);
    this.points = points;
    this.r = opts.r ?? 3;
    this.layer = opts.layer ?? 0;
    this.style = opts.style ?? 'rail';
    this.closed = !!opts.closed;
    this.material = opts.material ?? (this.style === 'rubber' ? 'rubber' : 'rail');
    const pts = this.closed ? [...points, points[0]] : points;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      this.collider({ shape: { kind: 'seg', x1, y1, x2, y2, r: this.r }, material: MATERIALS[this.material] });
    }
  }

  onContact(_c: Collider, ball: Ball, info: ContactInfo) {
    if (info.impact > 900 && this.ready(ball, 0.15)) {
      this.rt.emit({ type: 'wall', id: this.id, ball, value: info.impact, x: ball.x, y: ball.y });
    }
  }
}

export class Post extends Mechanism {
  kind = 'post' as const;
  x: number;
  y: number;
  r: number;
  constructor(rt: TableRuntime, id: string, x: number, y: number, r = 7, layer: Layer = 0) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.r = r;
    this.layer = layer;
    this.collider({ shape: { kind: 'circle', x, y, r }, material: MATERIALS.post });
  }
  onContact(_c: Collider, ball: Ball, info: ContactInfo) {
    if (info.impact > 400 && this.ready(ball, 0.12)) {
      this.hitFlash = 0.15;
      this.rt.emit({ type: 'wall', id: this.id, ball, value: info.impact, x: this.x, y: this.y });
    }
  }
}

// ------------------------------------------------------------------ scoring toys

export class Bumper extends Mechanism {
  kind = 'bumper' as const;
  x: number;
  y: number;
  r: number;
  kick: number;
  /** Visual ring compression 0..1 */
  squash = 0;
  constructor(rt: TableRuntime, id: string, x: number, y: number, opts: { r?: number; kick?: number; group?: string; label?: string; icon?: string } = {}) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.r = opts.r ?? 24;
    this.kick = opts.kick ?? 1050;
    this.group = opts.group;
    this.label = opts.label;
    this.icon = opts.icon;
    this.collider({ shape: { kind: 'circle', x, y, r: this.r }, material: MATERIALS.rubber });
  }
  onContact(_c: Collider, ball: Ball, info: ContactInfo) {
    // Fire on every fresh contact; the cooldown stops a resting ball from farming points.
    if (!this.ready(ball, 0.09)) return;
    const vn = ball.vx * info.nx + ball.vy * info.ny;
    const boost = Math.max(0, this.kick - vn);
    ball.vx += info.nx * boost;
    ball.vy += info.ny * boost;
    this.hitFlash = 0.18;
    this.squash = 1;
    this.rt.emit({ type: 'bumper', id: this.id, group: this.group, ball, x: this.x, y: this.y });
  }
  update(dt: number) {
    super.update(dt);
    this.squash = Math.max(0, this.squash - dt * 8);
  }
}

export class Slingshot extends Mechanism {
  kind = 'sling' as const;
  /** Triangle vertices; the kicking face is a -> c. */
  a: [number, number];
  b: [number, number];
  c: [number, number];
  kick: number;
  face: Collider;
  squash = 0;
  constructor(rt: TableRuntime, id: string, a: [number, number], b: [number, number], c: [number, number], opts: { kick?: number } = {}) {
    super(rt, id);
    this.a = a;
    this.b = b;
    this.c = c;
    this.kick = opts.kick ?? 900;
    this.face = this.collider({ shape: { kind: 'seg', x1: a[0], y1: a[1], x2: c[0], y2: c[1], r: 4 }, material: MATERIALS.rubber, tag: 'face' });
    this.collider({ shape: { kind: 'seg', x1: a[0], y1: a[1], x2: b[0], y2: b[1], r: 4 }, material: MATERIALS.rubber, tag: 'side' });
    this.collider({ shape: { kind: 'seg', x1: b[0], y1: b[1], x2: c[0], y2: c[1], r: 4 }, material: MATERIALS.rubber, tag: 'side' });
  }
  onContact(c: Collider, ball: Ball, info: ContactInfo) {
    if (c.tag !== 'face' || info.impact < 140) return;
    // Only the middle of the face carries the kicker switch.
    const s = c.shape as SegShape;
    const t = ((ball.x - s.x1) * (s.x2 - s.x1) + (ball.y - s.y1) * (s.y2 - s.y1)) / ((s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2);
    if (t < 0.12 || t > 0.88) return;
    if (!this.ready(ball, 0.12)) return;
    const vn = ball.vx * info.nx + ball.vy * info.ny;
    const boost = Math.max(0, this.kick - vn);
    ball.vx += info.nx * boost;
    ball.vy += info.ny * boost;
    this.hitFlash = 0.15;
    this.squash = 1;
    this.rt.emit({ type: 'sling', id: this.id, ball, x: ball.x, y: ball.y });
  }
  update(dt: number) {
    super.update(dt);
    this.squash = Math.max(0, this.squash - dt * 9);
  }
}

export class Rollover extends Mechanism {
  kind = 'rollover' as const;
  x: number;
  y: number;
  r: number;
  role: 'lane' | 'inlane' | 'outlane' | 'star';
  constructor(rt: TableRuntime, id: string, x: number, y: number, opts: { r?: number; group?: string; label?: string; icon?: string; role?: Rollover['role']; layer?: Layer } = {}) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.r = opts.r ?? 13;
    this.group = opts.group;
    this.label = opts.label;
    this.icon = opts.icon;
    this.role = opts.role ?? 'lane';
    this.layer = opts.layer ?? 0;
    this.collider({ shape: { kind: 'circle', x, y, r: this.r }, sensor: true, material: MATERIALS.rail });
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    if (!this.ready(ball, 0.3)) return;
    this.hitFlash = 0.35;
    const type = this.role === 'inlane' ? 'inlane' : this.role === 'outlane' ? 'outlane' : 'rollover';
    this.rt.emit({ type, id: this.id, group: this.group, ball, x: this.x, y: this.y });
  }
}

export class Target extends Mechanism {
  kind = 'target' as const;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  wobble = 0;
  constructor(rt: TableRuntime, id: string, x1: number, y1: number, x2: number, y2: number, opts: { group?: string; label?: string; icon?: string; layer?: Layer } = {}) {
    super(rt, id);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.group = opts.group;
    this.label = opts.label;
    this.icon = opts.icon;
    this.layer = opts.layer ?? 0;
    this.collider({ shape: { kind: 'seg', x1, y1, x2, y2, r: 4 }, material: MATERIALS.target });
  }
  onContact(_c: Collider, ball: Ball, info: ContactInfo) {
    if (info.impact < 90 || !this.ready(ball, 0.2)) return;
    this.hitFlash = 0.3;
    this.wobble = 1;
    this.rt.emit({ type: 'target', id: this.id, group: this.group, ball, x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2 });
  }
  update(dt: number) {
    super.update(dt);
    this.wobble = Math.max(0, this.wobble - dt * 5);
  }
}

export class DropTarget extends Mechanism {
  kind = 'drop' as const;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  down = false;
  bank?: DropBank;
  col: Collider;
  /** 0 = fully up, 1 = fully down (animation). */
  sink = 0;
  constructor(rt: TableRuntime, id: string, x1: number, y1: number, x2: number, y2: number, opts: { group?: string; label?: string; icon?: string } = {}) {
    super(rt, id);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.group = opts.group;
    this.label = opts.label;
    this.icon = opts.icon;
    this.col = this.collider({ shape: { kind: 'seg', x1, y1, x2, y2, r: 5 }, material: MATERIALS.target, dynamic: true });
  }
  onContact(_c: Collider, ball: Ball, info: ContactInfo) {
    if (this.down || info.impact < 120) return;
    this.down = true;
    this.col.enabled = false;
    this.hitFlash = 0.3;
    this.rt.emit({ type: 'drop', id: this.id, group: this.group, ball, x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2 });
    this.bank?.check(ball);
  }
  /** Raise only when no ball overlaps the target; returns false if it must wait. */
  tryRaise(): boolean {
    const s = this.col.shape;
    for (const b of this.rt.world.balls) {
      if (b.state === 'drained') continue;
      if (shapeDistance(s, b.x, b.y) < b.r + 4) return false;
    }
    this.down = false;
    this.col.enabled = true;
    return true;
  }
  update(dt: number) {
    super.update(dt);
    this.sink += ((this.down ? 1 : 0) - this.sink) * Math.min(1, dt * 14);
  }
}

export class DropBank extends Mechanism {
  kind = 'dropBank' as const;
  targets: DropTarget[] = [];
  resetDelay = 1.6;
  private resetAt = -1;
  autoReset = true;
  constructor(rt: TableRuntime, id: string, opts: { group?: string } = {}) {
    super(rt, id);
    this.group = opts.group;
  }
  check(ball: Ball) {
    if (this.targets.every((t) => t.down)) {
      const cx = this.targets.reduce((s, t) => s + (t.x1 + t.x2) / 2, 0) / this.targets.length;
      const cy = this.targets.reduce((s, t) => s + (t.y1 + t.y2) / 2, 0) / this.targets.length;
      this.rt.emit({ type: 'dropBank', id: this.id, group: this.group, ball, x: cx, y: cy });
      if (this.autoReset) this.resetAt = this.rt.time + this.resetDelay;
    }
  }
  resetBank() {
    this.resetAt = this.rt.time;
  }
  update(dt: number) {
    super.update(dt);
    if (this.resetAt >= 0 && this.rt.time >= this.resetAt) {
      let all = true;
      for (const t of this.targets) if (t.down && !t.tryRaise()) all = false;
      this.resetAt = all ? -1 : this.rt.time + 0.2;
    }
  }
  reset() {
    this.resetBank();
  }
}

export class Spinner extends Mechanism {
  kind = 'spinner' as const;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angle = 0;
  rate = 0;
  constructor(rt: TableRuntime, id: string, x1: number, y1: number, x2: number, y2: number, opts: { group?: string; label?: string; layer?: Layer } = {}) {
    super(rt, id);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.group = opts.group;
    this.label = opts.label;
    this.layer = opts.layer ?? 0;
    this.collider({ shape: { kind: 'seg', x1, y1, x2, y2, r: 6 }, sensor: true, material: MATERIALS.rail });
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    if (!this.ready(ball, 0.25)) return;
    const spins = Math.max(1, Math.min(24, Math.round(Math.hypot(ball.vx, ball.vy) / 140)));
    this.rate = spins * 6;
    this.rt.emit({ type: 'spinner', id: this.id, group: this.group, ball, value: spins, x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2 });
  }
  update(dt: number) {
    super.update(dt);
    this.angle += this.rate * dt;
    this.rate *= Math.max(0, 1 - dt * 1.4);
  }
}

/** Direction-aware switch used to detect completed orbits, loops and lanes. */
export class ShotSwitch extends Mechanism {
  kind = 'shotSwitch' as const;
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  constructor(rt: TableRuntime, id: string, x: number, y: number, dirDeg: number, opts: { r?: number; group?: string; layer?: Layer } = {}) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.r = opts.r ?? 16;
    this.dx = Math.cos((dirDeg * Math.PI) / 180);
    this.dy = Math.sin((dirDeg * Math.PI) / 180);
    this.group = opts.group;
    this.layer = opts.layer ?? 0;
    this.collider({ shape: { kind: 'circle', x, y, r: this.r }, sensor: true, material: MATERIALS.rail });
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    if (ball.vx * this.dx + ball.vy * this.dy <= 0) return;
    if (!this.ready(ball, 0.5)) return;
    this.hitFlash = 0.4;
    this.rt.emit({ type: 'shot', id: this.id, group: this.group, ball, x: this.x, y: this.y });
  }
}

// ------------------------------------------------------------------ ball holders

export type SaucerRole = 'pocket' | 'scoop' | 'lock';

export class Saucer extends Mechanism {
  kind = 'saucer' as const;
  x: number;
  y: number;
  r: number;
  role: SaucerRole;
  ejectDx: number;
  ejectDy: number;
  ejectSpeed: number;
  captureMaxSpeed: number;
  held: Ball[] = [];
  /** When >= 0, eject at this sim time. Rules may set holdIndefinitely. */
  ejectAt = -1;
  holdIndefinitely = false;
  /** Ball ids that just left; ignored until they clear the sensor. */
  private ignoring = new Set<number>();
  /** When false the saucer lets balls roll over without capturing. */
  enabled = true;
  autoEjectDelay = 0.9;
  kickAnim = 0;
  constructor(rt: TableRuntime, id: string, x: number, y: number, opts: { r?: number; role?: SaucerRole; ejectDeg: number; ejectSpeed?: number; captureMaxSpeed?: number; group?: string; label?: string; icon?: string }) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.r = opts.r ?? 15;
    this.role = opts.role ?? 'scoop';
    this.ejectDx = Math.cos((opts.ejectDeg * Math.PI) / 180);
    this.ejectDy = Math.sin((opts.ejectDeg * Math.PI) / 180);
    this.ejectSpeed = opts.ejectSpeed ?? 1250;
    this.captureMaxSpeed = opts.captureMaxSpeed ?? 1700;
    this.group = opts.group;
    this.label = opts.label;
    this.icon = opts.icon;
    this.collider({ shape: { kind: 'circle', x, y, r: 11 }, sensor: true, material: MATERIALS.rail });
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    if (this.ignoring.has(ball.id) || !this.enabled) return;
    if (Math.hypot(ball.vx, ball.vy) > this.captureMaxSpeed) return;
    this.capture(ball);
  }
  onSensorExit(_c: Collider, ball: Ball) {
    this.ignoring.delete(ball.id);
  }
  capture(ball: Ball) {
    ball.state = 'held';
    ball.vx = 0;
    ball.vy = 0;
    ball.x = this.x;
    ball.y = this.y;
    this.held.push(ball);
    this.hitFlash = 0.5;
    if (!this.holdIndefinitely && this.ejectAt < 0) this.ejectAt = this.rt.time + this.autoEjectDelay;
    this.rt.emit({ type: 'saucer', id: this.id, group: this.group, ball, x: this.x, y: this.y });
  }
  /** Schedule ejection of all held balls after `delay` seconds. */
  eject(delay = 0) {
    this.holdIndefinitely = false;
    this.ejectAt = this.rt.time + delay;
  }
  /** Keep the balls until eject() is called. */
  hold() {
    this.holdIndefinitely = true;
    this.ejectAt = -1;
  }
  update(dt: number) {
    super.update(dt);
    this.kickAnim = Math.max(0, this.kickAnim - dt * 4);
    if (this.held.length && !this.holdIndefinitely && this.ejectAt >= 0 && this.rt.time >= this.ejectAt) {
      const ball = this.held.shift()!;
      ball.state = 'live';
      ball.x = this.x + this.ejectDx * 2;
      ball.y = this.y + this.ejectDy * 2;
      // A little variation so ejections never repeat exactly.
      const jitter = 1 + (((this.rt.time * 977) % 1) - 0.5) * 0.04;
      ball.vx = this.ejectDx * this.ejectSpeed * jitter;
      ball.vy = this.ejectDy * this.ejectSpeed * jitter;
      ball.anchorTime = this.rt.time;
      ball.anchorX = ball.x;
      ball.anchorY = ball.y;
      this.ignoring.add(ball.id);
      this.kickAnim = 1;
      this.ejectAt = this.held.length ? this.rt.time + 0.6 : -1;
    }
  }
  reset() {
    this.ejectAt = -1;
    this.holdIndefinitely = false;
  }
}

export class Kickback extends Mechanism {
  kind = 'kickback' as const;
  x: number;
  y: number;
  speed: number;
  constructor(rt: TableRuntime, id: string, x: number, y: number, opts: { speed?: number } = {}) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.speed = opts.speed ?? 2700;
    this.collider({ shape: { kind: 'circle', x, y, r: 14 }, sensor: true, material: MATERIALS.rail });
  }
  get armed() {
    return this.lamp !== 'off';
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    if (ball.vy < 0 || !this.ready(ball, 0.6)) return;
    if (this.armed) {
      ball.vx = 0;
      ball.vy = -this.speed;
      this.lamp = 'off';
      this.hitFlash = 0.6;
      this.rt.emit({ type: 'kickback', id: this.id, ball, x: this.x, y: this.y });
    }
  }
}

export class Portal extends Mechanism {
  kind = 'portal' as const;
  x: number;
  y: number;
  exitX: number;
  exitY: number;
  exitDx: number;
  exitDy: number;
  exitSpeed: number;
  transit: { ball: Ball; at: number }[] = [];
  transitTime = 0.7;
  enabled = true;
  constructor(rt: TableRuntime, id: string, x: number, y: number, exit: { x: number; y: number; deg: number; speed?: number }, opts: { group?: string; label?: string } = {}) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.exitX = exit.x;
    this.exitY = exit.y;
    this.exitDx = Math.cos((exit.deg * Math.PI) / 180);
    this.exitDy = Math.sin((exit.deg * Math.PI) / 180);
    this.exitSpeed = exit.speed ?? 900;
    this.group = opts.group;
    this.label = opts.label;
    this.collider({ shape: { kind: 'circle', x, y, r: 12 }, sensor: true, material: MATERIALS.rail });
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    if (!this.enabled || ball.state !== 'live') return;
    ball.state = 'transit';
    this.transit.push({ ball, at: this.rt.time + this.transitTime });
    this.hitFlash = this.transitTime;
    this.rt.emit({ type: 'portal', id: this.id, group: this.group, ball, x: this.x, y: this.y });
  }
  update(dt: number) {
    super.update(dt);
    for (let i = this.transit.length - 1; i >= 0; i--) {
      const t = this.transit[i];
      if (this.rt.time < t.at) continue;
      // Exit only when the exit is clear of other balls.
      if (this.rt.world.balls.some((b) => b !== t.ball && b.state === 'live' && Math.hypot(b.x - this.exitX, b.y - this.exitY) < BALL_R * 2.5)) continue;
      this.transit.splice(i, 1);
      const b = t.ball;
      b.resetTracking(this.rt.time);
      b.x = this.exitX;
      b.y = this.exitY;
      b.layer = 0;
      b.rampId = null;
      b.vx = this.exitDx * this.exitSpeed;
      b.vy = this.exitDy * this.exitSpeed;
      b.state = 'live';
      b.saveUntil = Math.max(b.saveUntil, this.rt.time + 2.5);
    }
  }
}

// ------------------------------------------------------------------ guides

/** One-way gate: balls pass travelling along `passDeg`, and bounce off the other side. */
export class Gate extends Mechanism {
  kind = 'gate' as const;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  swing = 0;
  constructor(rt: TableRuntime, id: string, x1: number, y1: number, x2: number, y2: number, passDeg: number, opts: { layer?: Layer } = {}) {
    super(rt, id);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.layer = opts.layer ?? 0;
    const px = Math.cos((passDeg * Math.PI) / 180);
    const py = Math.sin((passDeg * Math.PI) / 180);
    // Blocking side is the side the ball ends up on after passing.
    this.collider({ shape: { kind: 'seg', x1, y1, x2, y2, r: 2 }, material: MATERIALS.metal, oneWay: { nx: px, ny: py } });
    this.collider({ shape: { kind: 'seg', x1, y1, x2, y2, r: BALL_R + 2 }, sensor: true, material: MATERIALS.metal, tag: 'flap' });
  }
  onSensorEnter(c: Collider, _ball: Ball) {
    if (c.tag === 'flap') this.swing = 1;
  }
  update(dt: number) {
    super.update(dt);
    this.swing = Math.max(0, this.swing - dt * 2.5);
  }
}

/** A guide that toggles between two angles, switching only when no ball is in its sweep. */
export class Diverter extends Mechanism {
  kind = 'diverter' as const;
  px: number;
  py: number;
  length: number;
  angles: [number, number];
  position: 0 | 1 = 0;
  pending: 0 | 1 | null = null;
  angle: number;
  col: Collider;
  constructor(rt: TableRuntime, id: string, px: number, py: number, length: number, degA: number, degB: number, opts: { layer?: Layer } = {}) {
    super(rt, id);
    this.px = px;
    this.py = py;
    this.length = length;
    this.angles = [(degA * Math.PI) / 180, (degB * Math.PI) / 180];
    this.angle = this.angles[0];
    this.layer = opts.layer ?? 0;
    this.col = this.collider({ shape: this.shape(), material: MATERIALS.metal, dynamic: true });
  }
  private shape(): SegShape {
    return { kind: 'seg', x1: this.px, y1: this.py, x2: this.px + Math.cos(this.angle) * this.length, y2: this.py + Math.sin(this.angle) * this.length, r: 3 };
  }
  set(position: 0 | 1) {
    if (position === this.position && this.pending === null) return;
    this.pending = position;
  }
  update(dt: number) {
    super.update(dt);
    if (this.pending === null) return;
    const sweepR = this.length + BALL_R + 6;
    // Plain loop: this runs every step while a switch is pending, so no closure per frame.
    let blocked = false;
    for (const b of this.rt.world.balls) {
      if (b.state !== 'drained' && b.layer === this.layer && Math.hypot(b.x - this.px, b.y - this.py) < sweepR) {
        blocked = true;
        break;
      }
    }
    if (blocked) return;
    this.position = this.pending;
    this.pending = null;
    this.angle = this.angles[this.position];
    this.col.shape = this.shape();
  }
}

/**
 * Raised ramp: an entry switch on the playfield lifts the ball to layer 1 when it travels
 * into the mouth; rails on layer 1 guide it; the exit switch drops it back to layer 0.
 */
export class Ramp extends Mechanism {
  kind = 'ramp' as const;
  path: [number, number][];
  width: number;
  entryDx: number;
  entryDy: number;
  completeCount = 0;
  /** Peak height above the playfield (table units) for rendering. */
  peak: number;
  /** Cumulative arc length at each path point. */
  private lengths: number[] = [];
  totalLength = 0;
  constructor(rt: TableRuntime, id: string, opts: { path: [number, number][]; width?: number; group?: string; label?: string; icon?: string; endCap?: boolean; peak?: number }) {
    super(rt, id);
    // Smooth the centerline so rails redirect the ball gradually (no corners to stall on).
    this.path = smoothPath(opts.path, 6);
    this.width = opts.width ?? 34;
    this.peak = opts.peak ?? 70;
    this.group = opts.group;
    this.label = opts.label;
    this.icon = opts.icon;
    let acc = 0;
    this.lengths = this.path.map((p, i) => {
      if (i > 0) acc += Math.hypot(p[0] - this.path[i - 1][0], p[1] - this.path[i - 1][1]);
      return acc;
    });
    this.totalLength = acc;
    const [p0, p1] = this.path;
    const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    this.entryDx = (p1[0] - p0[0]) / l;
    this.entryDy = (p1[1] - p0[1]) / l;
    // Rails on layer 1: offset the centerline both sides.
    const left = offsetPath(this.path, this.width / 2);
    const right = offsetPath(this.path, -this.width / 2);
    for (const side of [left, right]) {
      for (let i = 0; i + 1 < side.length; i++) {
        this.rt.world.addCollider({ owner: this, layer: 1, shape: { kind: 'seg', x1: side[i][0], y1: side[i][1], x2: side[i + 1][0], y2: side[i + 1][1], r: 3 }, material: MATERIALS.metal });
      }
    }
    // Entry switch (layer 0) sits just INSIDE the mouth, so a ball is only lifted once it is
    // between the rails; a return switch on layer 1 at the mouth handles roll-backs.
    const inset = this.width / 2;
    this.collider({ shape: { kind: 'circle', x: p0[0] + this.entryDx * inset, y: p0[1] + this.entryDy * inset, r: this.width / 2 - 4 }, sensor: true, material: MATERIALS.rail, tag: 'entry', layer: 0 });
    this.collider({ shape: { kind: 'circle', x: p0[0] - this.entryDx * 6, y: p0[1] - this.entryDy * 6, r: this.width / 2 - 2 }, sensor: true, material: MATERIALS.rail, tag: 'back', layer: 1 });
    const end = this.path[this.path.length - 1];
    this.collider({ shape: { kind: 'circle', x: end[0], y: end[1], r: this.width / 2 }, sensor: true, material: MATERIALS.rail, tag: 'exit', layer: 1 });
  }
  /** Height (table units) at arc-length fraction s: climbs, holds, then descends to the exit. */
  heightAt(s: number): number {
    const sm = (a: number, b: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    return this.peak * sm(0, 0.3, s) * (1 - sm(0.72, 1, s));
  }

  /** Distance from (x, y) to the ramp centerline. */
  distanceTo(x: number, y: number): number {
    let best = Infinity;
    for (let i = 0; i + 1 < this.path.length; i++) {
      const a = this.path[i];
      const b = this.path[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy || 1;
      let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)));
    }
    return best;
  }

  /** Arc-length fraction of the closest point on the path to (x, y). */
  project(x: number, y: number): number {
    let best = Infinity;
    let bestS = 0;
    for (let i = 0; i + 1 < this.path.length; i++) {
      const a = this.path[i];
      const b = this.path[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy || 1;
      let t = ((x - a[0]) * dx + (y - a[1]) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
      if (d < best) {
        best = d;
        bestS = (this.lengths[i] + Math.sqrt(l2) * t) / (this.totalLength || 1);
      }
    }
    return bestS;
  }

  onSensorEnter(c: Collider, ball: Ball) {
    if (c.tag === 'entry') {
      if (ball.vx * this.entryDx + ball.vy * this.entryDy > 60 && ball.layer === 0) {
        ball.rampId = this.id;
        ball.layer = 1;
        ball.touching.clear();
        this.rt.emit({ type: 'rampEnter', id: this.id, group: this.group, ball, x: ball.x, y: ball.y });
      }
    } else if (c.tag === 'back') {
      if (ball.vx * this.entryDx + ball.vy * this.entryDy < 0 && ball.layer === 1) {
        ball.layer = 0;
        ball.rampId = null;
        ball.touching.clear();
      }
    } else if (c.tag === 'exit') {
      if (ball.layer === 1) {
        ball.layer = 0;
        ball.rampId = null;
        ball.touching.clear();
        this.completeCount++;
        this.hitFlash = 0.6;
        this.rt.emit({ type: 'ramp', id: this.id, group: this.group, ball, x: ball.x, y: ball.y });
      }
    }
  }
}

/** Catmull-Rom smoothing through the given points (endpoints kept). */
export function smoothPath(points: [number, number][], perSpan = 6): [number, number][] {
  if (points.length < 3) return points;
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < perSpan; s++) {
      const t = s / perSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function offsetPath(path: [number, number][], d: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    // normal = rotate tangent by +90 deg (y down => this points to the tangent's right)
    let nx = -ty;
    let ny = tx;
    // miter correction at joints
    let scale = 1;
    if (i > 0 && i < path.length - 1) {
      const ax = p[0] - a[0];
      const ay = p[1] - a[1];
      const al = Math.hypot(ax, ay) || 1;
      const n1x = -ay / al;
      const n1y = ax / al;
      const cos = n1x * nx + n1y * ny;
      scale = 1 / Math.max(0.5, cos);
    }
    nx *= d * scale;
    ny *= d * scale;
    out.push([p[0] + nx, p[1] + ny]);
  }
  return out;
}

// ------------------------------------------------------------------ plunger + drain

export class Plunger extends Mechanism {
  kind = 'plunger' as const;
  x: number;
  /** Tip y at rest. */
  y: number;
  travel = 40;
  pull = 0;
  pulling = false;
  /** Rebound animation 0..1. */
  fire = 0;
  minSpeed = 1150;
  maxSpeed = 3150;
  tip: Collider;
  laneHalf: number;
  constructor(rt: TableRuntime, id: string, x: number, y: number, laneHalf = 19) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.laneHalf = laneHalf;
    this.tip = this.collider({ shape: { kind: 'seg', x1: x - laneHalf + 3, y1: y, x2: x + laneHalf - 3, y2: y, r: 3 }, material: MATERIALS.wood, dynamic: true });
  }
  get tipY() {
    return this.y + this.pull * this.travel;
  }
  update(dt: number) {
    super.update(dt);
    if (this.pulling) this.pull = Math.min(1, this.pull + dt * 1.05);
    this.fire = Math.max(0, this.fire - dt * 5);
    const s = this.tip.shape as SegShape;
    s.y1 = s.y2 = this.tipY;
  }
  /** Ball resting on the plunger tip, if any. */
  ballOnTip(): Ball | undefined {
    return this.rt.world.balls.find((b) => this.onTip(b));
  }
  private onTip(b: Ball) {
    return (b.state === 'shooter' || b.state === 'live') && Math.abs(b.x - this.x) < this.laneHalf && b.y > this.tipY - b.r - 22 && b.y < this.tipY + 2;
  }
  /** Every ball the rod will carry when it snaps back: on the tip, or anywhere in its sweep. */
  private ballsInSweep(): Ball[] {
    const top = this.y - 3;
    return this.rt.world.balls.filter((b) => (b.state === 'shooter' || b.state === 'live') && Math.abs(b.x - this.x) < this.laneHalf && b.y > top - b.r - 22 && b.y < this.tipY + b.r + 4);
  }
  release(): Ball | undefined {
    const strength = this.pull;
    this.pulling = false;
    this.fire = 1;
    // Launch while the tip (and the ball riding it) is still drawn back.
    const b = this.launch(strength);
    this.pull = 0;
    return b;
  }
  launch(strength: number): Ball | undefined {
    const b = this.ballOnTip();
    if (!b || strength < 0.04) return undefined;
    const sp = this.minSpeed + (this.maxSpeed - this.minSpeed) * Math.pow(Math.min(1, strength), 1.1);
    b.vy = -sp;
    b.vx = 0;
    // The rod snaps back to rest as it fires, carrying the ball with it. In multiball a second
    // ball can be resting beside or below the first; the rod must carry it too rather than
    // snap up through it and leave it trapped under the tip.
    b.y = Math.min(b.y, this.y - b.r - 3);
    for (const other of this.ballsInSweep()) {
      if (other === b) continue;
      other.y = Math.min(other.y, this.y - other.r - 3);
      other.vy = Math.min(other.vy, -sp * 0.6);
      other.vx = 0;
      other.saveUntil = Math.max(other.saveUntil, b.saveUntil);
    }
    this.rt.emit({ type: 'launch', id: this.id, ball: b, value: strength, x: b.x, y: b.y });
    return b;
  }
}

export class Drain extends Mechanism {
  kind = 'drain' as const;
  y: number;
  constructor(rt: TableRuntime, id: string, y: number, x0: number, x1: number) {
    super(rt, id);
    this.y = y;
    for (const layer of [0, 1] as Layer[]) {
      this.collider({ shape: { kind: 'seg', x1: x0, y1: y, x2: x1, y2: y, r: 8 }, sensor: true, material: MATERIALS.rail, layer });
    }
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    if (ball.state !== 'live') return;
    this.rt.emit({ type: 'drain', id: this.id, ball, x: ball.x, y: ball.y });
  }
}

/** A decorative lamp/arrow insert that previews shots. No collider. */
export class Insert extends Mechanism {
  kind = 'insert' as const;
  x: number;
  y: number;
  angle: number;
  shape: 'arrow' | 'circle' | 'star' | 'label';
  size: number;
  constructor(rt: TableRuntime, id: string, x: number, y: number, opts: { deg?: number; shape?: Insert['shape']; size?: number; label?: string; group?: string; color?: string } = {}) {
    super(rt, id);
    this.x = x;
    this.y = y;
    this.angle = ((opts.deg ?? -90) * Math.PI) / 180;
    this.shape = opts.shape ?? 'arrow';
    this.size = opts.size ?? 16;
    this.label = opts.label;
    this.group = opts.group;
    this.lampColor = opts.color;
  }
}

export class FlipperMech extends Mechanism {
  kind = 'flipper' as const;
  flipper: Flipper;
  constructor(rt: TableRuntime, spec: FlipperSpec) {
    super(rt, spec.id);
    this.flipper = new Flipper(spec);
    this.layer = this.flipper.layer;
    rt.world.addFlipper(this.flipper);
    rt.flippers.push(this.flipper);
  }
}
