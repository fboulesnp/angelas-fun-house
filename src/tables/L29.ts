// Lesson 29 — Engineering Solutions for Protecting Ecosystems — "Future Garden Grand Finale"
// The mansion opens onto a lakeside garden town of the future at sunrise, and the player gets to
// engineer it. Signature: the Selective Net, a row of fish drop targets (small, BIG, small, BIG,
// small) strung along the lake shore. The old fine mesh catches every fish; the revised wide mesh
// lets the small snail-eating fish slip through (they wobble and stay up), so only the big fish
// drop, the larger-hole net idea from the lesson's Lake Malawi story.
// Around it: the Town Hall's Problem Board (the six ways people disrupt ecosystems), the Design
// Fork (a lane whose blade switches between the Design Studio, the Wonder Pocket, and the MODEL
// route into the Forecast Portal as the missions advance), CRITERIA and LIMITS gateposts, the
// Prototype Test Ramp that lifts the ball into the lake, the Shade Grove and Carp Canal orbits,
// and the Snail Shallows bumpers.

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Diverter, DropTarget, Mechanism, type Target } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { Ball } from '../game/physics/ball.ts';
import type { Collider, ContactInfo } from '../game/physics/types.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { TAU, drift, glowDot, mix, neonPath, neonText, rgba, rng, stage, vgrad } from '../game/render/art.ts';

type Pt = [number, number];
type V3 = [number, number, number];

const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const LILAC = '#B9A2FF';
const PEACH = '#FFB38A';
const WATER = '#2a8fb0';
const WATER_HI = '#8fe6f2';
const LEAF = '#7fd18b';
const FERN = '#3f8f5c';
const CANOPY = '#2f6e4a';
const CHERRY = '#e2564e';
const SOLAR = '#2b4c86';
const SOLAR_HI = '#8fb4ff';
const SAND = '#d9c08a';
const POLLEN = '#f3ffb0';

// ---------------------------------------------------------------- the Selective Net

/** One fish in the net. With the revised wide mesh, small fish slip through (wobble, never drop). */
class FishTarget extends DropTarget {
  small = false;
  net?: SelectiveNet;
  wobble = 0;
  onContact(c: Collider, ball: Ball, info: ContactInfo) {
    if (this.small && this.net?.wide) {
      if (info.impact < 90 || !this.ready(ball, 0.25)) return;
      this.hitFlash = 0.3;
      this.wobble = 1;
      this.rt.emit({ type: 'target', id: this.id, group: 'spared', ball, x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2 });
      return;
    }
    const was = this.down;
    super.onContact(c, ball, info);
    if (!was && this.down) this.net?.check(ball);
  }
  update(dt: number) {
    super.update(dt);
    this.wobble = Math.max(0, this.wobble - dt * 5);
  }
}

/**
 * The Selective Net: a row of fish targets. The old fine mesh catches every fish; the revised
 * wide mesh lets the small snail-eating fish slip through, so only the big fish drop. When every
 * catchable fish is down it reports a full haul (a `dropBank` event) and resets. Targets only
 * rise when no ball overlaps them.
 */
class SelectiveNet extends Mechanism {
  kind = 'selectiveNet' as const;
  fish: FishTarget[] = [];
  wide = false;
  private resetAt = -1;
  constructor(rt: TableRuntime, id: string) {
    super(rt, id);
    this.group = 'net';
  }
  setWide(v: boolean) {
    if (v === this.wide) return;
    this.wide = v;
    // Small fish caught by the old net swim back as soon as the mesh is widened.
    if (v && this.resetAt < 0) this.resetAt = this.rt.time + 0.4;
  }
  check(ball: Ball) {
    const catchable = this.fish.filter((f) => !(f.small && this.wide));
    if (catchable.every((f) => f.down)) {
      const cx = this.fish.reduce((s, f) => s + (f.x1 + f.x2) / 2, 0) / this.fish.length;
      const cy = this.fish.reduce((s, f) => s + (f.y1 + f.y2) / 2, 0) / this.fish.length;
      this.hitFlash = 1;
      this.rt.emit({ type: 'dropBank', id: this.id, group: this.group, ball, x: cx, y: cy });
      this.resetAt = this.rt.time + 1.6;
    }
  }
  update(dt: number) {
    super.update(dt);
    if (this.resetAt >= 0 && this.rt.time >= this.resetAt) {
      let all = true;
      for (const f of this.fish) if (f.down && !f.tryRaise()) all = false;
      this.resetAt = all ? -1 : this.rt.time + 0.2;
    }
  }
  reset() {
    this.resetAt = this.rt.time;
  }
}

const NET_START: Pt = [286, 424];
const NET_DEG = -6;
const NET_KINDS = ['small', 'big', 'small', 'big', 'small'] as const;
const NET_SIZE = 22;
const NET_GAP = 6;
const NET_LEN = NET_KINDS.length * NET_SIZE + (NET_KINDS.length - 1) * NET_GAP;
const NET_DX = Math.cos((NET_DEG * Math.PI) / 180);
const NET_DY = Math.sin((NET_DEG * Math.PI) / 180);
/** Centre of fish i (0-based) along the net line. */
const fishAt = (i: number, off = 0): Pt => {
  const s = i * (NET_SIZE + NET_GAP) + NET_SIZE / 2;
  return [NET_START[0] + NET_DX * s + NET_DY * off, NET_START[1] + NET_DY * s - NET_DX * off];
};

function selectiveNet(b: TableBuilder) {
  const rt = b.rt;
  const net = rt.add(new SelectiveNet(rt, 'net'));
  NET_KINDS.forEach((k, i) => {
    const s = i * (NET_SIZE + NET_GAP);
    const x1 = NET_START[0] + NET_DX * s;
    const y1 = NET_START[1] + NET_DY * s;
    const f = rt.add(new FishTarget(rt, `fish_${i + 1}`, x1, y1, x1 + NET_DX * NET_SIZE, y1 + NET_DY * NET_SIZE, {
      group: k === 'big' ? 'bigfish' : 'smallfish', label: k === 'big' ? 'BIG' : 'small',
    }));
    f.small = k === 'small';
    f.net = net;
    net.fish.push(f);
  });
  // Backstop behind the net (the net's top rope), sloping down to the left so nothing rests on it.
  const nx = NET_DY;
  const ny = -NET_DX;
  const off = 11;
  b.wall([[NET_START[0] + nx * off - 3, NET_START[1] + ny * off], [NET_START[0] + NET_DX * NET_LEN + nx * off + 3, NET_START[1] + NET_DY * NET_LEN + ny * off]], { id: 'net_backstop', r: 3 });
}

// ---------------------------------------------------------------- the Design Fork

/** Blade positions: 0 = flush with the left wall (STUDIO route, straight up), 1 = across the lane (MODEL route, right into the Forecast Portal). */
const STUDIO_ROUTE = 0;
const MODEL_ROUTE = 1;
/** The fork lane, its alcove and the Studio cup: the blade never moves while a ball is in here. */
const FORK_BOX = { x0: 206, x1: 300, y0: 456, y1: 664 };

/**
 * Route keeper for the fork blade. 'studio' and 'model' pin a route; 'alternate' flips the route
 * after every design that runs the fork, so both routes get used. It moves the blade only while
 * the whole fork is empty, so a ball can never be trapped above a closing blade.
 */
class ForkKeeper extends Mechanism {
  kind = 'forkKeeper' as const;
  mode: 'studio' | 'model' | 'alternate' = 'studio';
  route: 0 | 1 = STUDIO_ROUTE;
  private div: Diverter;
  constructor(rt: TableRuntime, id: string, div: Diverter) {
    super(rt, id);
    this.div = div;
  }
  passed(route: 0 | 1) {
    if (this.mode === 'alternate') this.route = route === MODEL_ROUTE ? STUDIO_ROUTE : MODEL_ROUTE;
  }
  private forkBusy() {
    for (const b of this.rt.world.balls) {
      if (b.state === 'drained' || b.layer !== 0) continue;
      if (b.x > FORK_BOX.x0 && b.x < FORK_BOX.x1 && b.y > FORK_BOX.y0 && b.y < FORK_BOX.y1) return true;
    }
    return false;
  }
  update(dt: number) {
    super.update(dt);
    for (const e of this.rt.events) {
      if (e.type === 'portal' && e.id === 'forecast') this.passed(MODEL_ROUTE);
      else if (e.type === 'saucer' && e.id === 'studio') this.passed(STUDIO_ROUTE);
    }
    if (this.mode === 'model') this.route = MODEL_ROUTE;
    else if (this.mode === 'studio') this.route = STUDIO_ROUTE;
    const want = this.route;
    if (this.div.position === want && this.div.pending === null) return;
    if (this.div.pending === want) return;
    if (this.forkBusy()) return;
    this.div.set(want);
  }
}

// ---------------------------------------------------------------- the Problem Board

const PROBLEMS = ['OVERFISHING', 'POLLUTION', 'NEW DISEASE', 'HABITAT', 'INVASIVE', 'CLIMATE'];
/** Six signs on the face of the Town Hall island, which leans on the Carp Canal wall. */
const BOARD = { cx: 330, cy: 660, r: 170, from: 300, to: 345 };
const boardAt = (deg: number, r = BOARD.r): Pt => [BOARD.cx + Math.cos((deg * Math.PI) / 180) * r, BOARD.cy + Math.sin((deg * Math.PI) / 180) * r];

/**
 * The survey: a hit on a sign names that problem; a hit on a sign that is already named passes
 * the survey to its nearest unnamed neighbour, so every hit on the Town Hall makes progress. It
 * re-emits the hit as a quiet `gate` event in group 'survey' (no extra score or sound). Named
 * signs are read from their lamps, so the survey keeps no state of its own.
 */
class ProblemSurvey extends Mechanism {
  kind = 'problemSurvey' as const;
  constructor(rt: TableRuntime, id: string) {
    super(rt, id);
    this.group = 'survey';
  }
  update(dt: number) {
    super.update(dt);
    const n = this.rt.events.length;
    for (let i = 0; i < n; i++) {
      const e = this.rt.events[i];
      if (e.type !== 'target' || e.group !== 'problems') continue;
      const k = Number(e.id.slice(5));
      const named = (j: number) => this.rt.get<Target>(`sign_${j}`).lamp === 'on';
      let pick = k;
      if (named(k)) {
        for (let d = 1; d < PROBLEMS.length && pick === k; d++) {
          for (const j of [k - d, k + d]) {
            if (j >= 1 && j <= PROBLEMS.length && !named(j)) {
              pick = j;
              break;
            }
          }
        }
      }
      const sign = this.rt.get<Target>(`sign_${pick}`);
      if (pick !== k) sign.hitFlash = 0.5;
      this.rt.emit({ type: 'gate', id: sign.id, group: 'survey', ball: e.ball, x: (sign.x1 + sign.x2) / 2, y: (sign.y1 + sign.y2) / 2 });
    }
  }
}

function problemBoard(b: TableBuilder) {
  b.rt.add(new ProblemSurvey(b.rt, 'survey'));
  const n = PROBLEMS.length;
  const step = (BOARD.to - BOARD.from) / n;
  PROBLEMS.forEach((label, i) => {
    const a = boardAt(BOARD.from + step * i + 0.6);
    const c = boardAt(BOARD.from + step * (i + 1) - 0.6);
    b.target(`sign_${i + 1}`, a, c, { group: 'problems', label });
  });
  const face = b.arcPoints(BOARD.cx, BOARD.cy, BOARD.r + 4, BOARD.from, BOARD.to, 12);
  const top = face[0];
  b.wall([[498, 440], [top[0] - 4, top[1] - 4], ...face, [498, 618]], { id: 'town_hall', r: 3 });
}

// ---------------------------------------------------------------- geometry

const RAMP_PATH: Pt[] = [[186, 640], [160, 566], [136, 486], [118, 404], [108, 322], [118, 248], [152, 196], [206, 170], [266, 162]];
const STUDIO: Pt = [242, 498];
const PORTAL: Pt = [283, 578];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Shade Grove orbit (left) ---
  b.wall([[74, 640], [74, 372]], { id: 'grove_inner', r: 3 });
  b.post(74, 368, 5);
  b.post(74, 642, 4);
  b.shotSwitch('grove_sw', 49, 470, -90);
  // A one-way gate rather than a wall, so the kickback can fire up through it.
  b.gate('grove_gate', [FRAME.left, 646], [54, 694], -90);

  // --- Carp Canal orbit (right) with the electric barrier spinner ---
  b.wall([[498, 640], [498, 372]], { id: 'canal_inner', r: 3 });
  b.post(498, 368, 5);
  b.post(498, 642, 4);
  b.shotSwitch('canal_sw', 523, 470, -90);
  b.spinner('carp_barrier', [503, 560], [543, 560], { label: 'BARRIER' });
  // The canal's exit deflector runs on down its own line to (487,744): orbit exits leave it on the
  // same path as before, but it also catches the rebound off a standing small fish (when a BIG
  // fish beside it is down), which otherwise ran straight into the right outlane.
  b.wall([[FRAME.laneSep, 646], [487, 744]], { id: 'canal_deflect', r: 3 });

  // --- Problem Board on the Town Hall island (left flipper, late flips) ---
  problemBoard(b);

  // --- Design Fork: a lane up the left flipper's straight line to the Design Studio ---
  b.post(216, 652, 5);
  b.wall([[216, 652], [216, 488]], { id: 'fork_left', r: 3 });
  b.wall([[268, 652], [268, 606]], { id: 'fork_right_low', r: 3 });
  b.wall([[268, 606], [286, 602], [296, 588], [296, 568], [286, 554], [268, 550]], { id: 'model_alcove', r: 3 });
  b.wall([[268, 550], [268, 488]], { id: 'fork_right_high', r: 3 });
  b.wall([[216, 488], [242, 466], [268, 488]], { id: 'studio_hood', r: 4 });
  b.saucer('studio', STUDIO[0], STUDIO[1], { role: 'pocket', ejectDeg: 90, ejectSpeed: 700, captureMaxSpeed: 2600, label: 'STUDIO', icon: 'blueprint' });
  // position 0 = flush along the left wall (STUDIO route), 1 = across the lane (MODEL route)
  const blade = b.diverter('fork_blade', [216, 578], 56, -90, -28);
  b.rt.add(new ForkKeeper(b.rt, 'fork_keeper', blade));
  b.shotSwitch('fork_sw', 242, 630, -90);
  b.portal('forecast', PORTAL, { x: 83, y: 770, deg: 90, speed: 240 }, { label: 'FORECAST PORTAL' });
  // The fork's right gatepost is the LIMITS (constraints) target.
  b.target('constraints', [270, 656], [298, 702], { group: 'define', label: 'LIMITS' });

  // --- Prototype Test Ramp: from the left, up past the grove, over the top into the lake ---
  b.wall([[170, 648], [162, 700]], { id: 'ramp_flare', r: 3 });
  // The ramp's right gatepost is the CRITERIA target.
  b.target('criteria', [204, 642], [220, 684], { group: 'define', label: 'CRITERIA' });
  b.ramp('test_ramp', { path: RAMP_PATH, width: 34, peak: 90, label: 'TEST RAMP' });

  // --- Snail Shallows (pop bumpers) in the lake ---
  b.bumper('snail_1', 238, 270, { group: 'snails', r: 24, icon: 'snail' });
  b.bumper('snail_2', 330, 196, { group: 'snails', r: 24, icon: 'snail' });
  b.bumper('snail_3', 380, 300, { group: 'snails', r: 24, icon: 'snail' });

  // --- The Selective Net, strung along the lake shore ---
  selectiveNet(b);

  // --- Inserts ---
  b.insert('ins_grove', 49, 612, { deg: -90, label: 'GROVE' });
  b.insert('ins_canal', 523, 612, { deg: -90, label: 'CANAL' });
  b.insert('ins_ramp', 150, 716, { deg: -105 });
  b.insert('ins_fork', 242, 694, { deg: -90 });
  b.insert('ins_studio', 242, 548, { shape: 'circle', size: 10, color: MINT });
  b.insert('ins_net', 340, 486, { deg: -90 });
  b.insert('ins_snails', 300, 256, { shape: 'star', size: 11 });
  b.insert('ins_board', 404, 612, { deg: -55 });
}

// ---------------------------------------------------------------- printed playfield helpers

function smoothPath(ctx: CanvasRenderingContext2D, pts: Pt[], closed = false) {
  ctx.beginPath();
  const n = pts.length;
  if (closed) {
    const m0: Pt = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number, angle = 0, glow = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8,16,28,0.75)';
  ctx.lineWidth = Math.max(2, size * 0.28);
  ctx.globalAlpha = Math.min(1, alpha + 0.15);
  ctx.strokeText(text, 0, 0);
  if (glow > 0.01) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * glow;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function fishShape(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string, alpha: number, girth = 0.2) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, len * 0.5, len * girth, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-len * 0.42, 0);
  ctx.lineTo(-len * 0.74, -len * girth * 0.95);
  ctx.lineTo(-len * 0.74, len * girth * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(8,18,30,0.85)';
  ctx.beginPath();
  ctx.arc(len * 0.27, -len * 0.04, Math.max(0.8, len * 0.045), 0, TAU);
  ctx.fill();
  ctx.restore();
}

function snailShape(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = mix(color, '#2a1a10', 0.35);
  ctx.beginPath();
  ctx.ellipse(s * 0.15, s * 0.55, s * 0.95, s * 0.26, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.62, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,14,0.7)';
  ctx.lineWidth = Math.max(0.8, s * 0.12);
  ctx.beginPath();
  for (let i = 0; i <= 26; i++) {
    const a = (i / 26) * TAU * 1.7;
    const r = s * 0.55 * (1 - i / 30);
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.restore();
}

/** A lumpy canopy blob (shade trees, shrubs) seen from above. */
function canopy(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, color: string, alpha: number) {
  if (alpha <= 0.01) return;
  const R = rng(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  const k = 14;
  for (let i = 0; i <= k; i++) {
    const a = (i / k) * TAU;
    const rr = r * (0.82 + 0.26 * R());
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function coffeeShrub(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, alpha: number, ripe: number) {
  canopy(ctx, x, y, s, seed, FERN, alpha);
  const R = rng(seed + 7);
  for (let i = 0; i < 5; i++) {
    const a = R() * TAU;
    const d = s * 0.55 * R();
    ctx.fillStyle = rgba(CHERRY, alpha * (0.45 + 0.55 * ripe));
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(1, s * 0.16), 0, TAU);
    ctx.fill();
  }
}

/** A solar roof seen from above: a tilted grid of panels that glows as the town powers up. */
function solarRoof(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(30,24,40,0.55)';
  ctx.fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  const cols = Math.max(2, Math.round(w / 10));
  const rows = Math.max(2, Math.round(h / 8));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      ctx.fillStyle = mix(SOLAR, SOLAR_HI, 0.15 + 0.55 * lit * ((i + j) % 2 ? 0.8 : 1));
      ctx.globalAlpha = 0.55 + 0.4 * lit;
      ctx.fillRect(-w / 2 + (i * w) / cols + 0.8, -h / 2 + (j * h) / rows + 0.8, w / cols - 1.6, h / rows - 1.6);
    }
  }
  ctx.restore();
}

/** Diamond net mesh between two parallel lines (top rope and the fish line). */
function netMesh(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, depth: number, hole: number, color: string, alpha: number) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  ctx.save();
  ctx.translate(a[0], a[1]);
  ctx.rotate(ang);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, -depth, len, depth);
  ctx.clip();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -depth; x <= len + depth; x += hole) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + depth, -depth);
    ctx.moveTo(x, -depth);
    ctx.lineTo(x + depth, 0);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = rgba(IVORY, alpha * 1.2);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -depth);
  ctx.lineTo(len, -depth);
  ctx.stroke();
  for (let x = 6; x < len; x += 22) {
    ctx.fillStyle = rgba(CORAL, Math.min(1, alpha * 2));
    ctx.beginPath();
    ctx.arc(x, -depth, 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, -size * 0.65);
  ctx.lineTo(-size * 0.25, 0);
  ctx.lineTo(-size * 0.6, size * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// The lake: under the arch, inside the two orbit walls, down to the shore along the net.
function lakePath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(78, 384);
  ctx.lineTo(78, 300);
  ctx.arc(286, 300, 208, Math.PI, TAU);
  ctx.lineTo(494, 436);
  ctx.quadraticCurveTo(462, 446, 432, 414);
  const [ax, ay] = fishAt(4, 12);
  const [bx, by] = fishAt(0, 12);
  ctx.lineTo(ax + 12, ay);
  ctx.lineTo(bx - 12, by);
  ctx.quadraticCurveTo(262, 440, 236, 452);
  ctx.quadraticCurveTo(180, 432, 130, 410);
  ctx.closePath();
}

const SNAIL_SPOTS: Pt[] = [[206, 240], [270, 300], [214, 298], [262, 236], [302, 172], [360, 176], [352, 222], [300, 214], [350, 290], [410, 272], [404, 330], [356, 326], [226, 330], [190, 270]];
const SMALL_FISH: [number, number, number][] = [[160, 330, -0.4], [190, 360, 0.2], [440, 360, 3.4], [420, 240, 2.9], [280, 360, -0.1], [250, 120, 0.3], [400, 150, 3.1], [150, 260, 0.9], [460, 300, 3.3], [320, 120, 0.1]];
const BIG_FISH: [number, number, number][] = [[176, 196, 0.5], [440, 200, 2.7], [300, 350, 3.0]];

function paintGarden(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);
  const wake = stage(level, 0, 3.6);

  // Base: lake blue above, plaza slate in the middle, garden green toward the flippers.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [
    [0, mix('#0f2b40', '#1a4a66', wake)],
    [0.42, mix('#10283a', '#18405a', wake)],
    [0.66, mix('#0e2430', '#163c36', wake)],
    [1, mix('#0a1620', '#10261e', wake)],
  ]);
  ctx.fillRect(0, 0, 600, 1150);

  // Promenade ring around the lake (the orbit path) and the two orbit lanes.
  ctx.save();
  ctx.beginPath();
  ctx.arc(310, 300, 286, Math.PI, TAU);
  ctx.closePath();
  ctx.rect(24, 299, 50, 362);
  ctx.rect(498, 299, 50, 362);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, 0, 660, [[0, rgba(mix('#3a4a5a', '#c8b28a', 0.25 + 0.3 * wake), 0.38)], [1, rgba(mix('#3a4a5a', '#c8b28a', 0.25 + 0.3 * wake), 0.12)]]);
  ctx.fillRect(0, 0, 600, 662);
  ctx.strokeStyle = 'rgba(255,247,231,0.06)';
  ctx.lineWidth = 1;
  for (let r = 214; r < 290; r += 11) {
    ctx.beginPath();
    ctx.arc(298, 300, r, Math.PI, TAU);
    ctx.stroke();
  }
  // lamp posts along the promenade, lit as the town wakes
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    glowDot(ctx, 310 + Math.cos(a) * 268, 300 + Math.sin(a) * 268, 7, GOLD, 0.1 + 0.55 * stage(level, 0.3 + i * 0.12, 1.3 + i * 0.12));
  }
  ctx.restore();

  // --- Shade Grove: coffee growing under tall shade trees (left orbit and the field below the ramp)
  const grove = 0.45 + 0.35 * wake + 0.2 * s3;
  for (let i = 0; i < 6; i++) canopy(ctx, 49 + (i % 2 ? 6 : -6), 330 + i * 52, 24, 40 + i, CANOPY, 0.55 * grove);
  const shade: [number, number, number][] = [[122, 448, 42], [178, 520, 36], [110, 590, 40], [176, 612, 26]];
  shade.forEach(([x, y, r], i) => canopy(ctx, x, y, r, 60 + i, mix(CANOPY, '#3f8a5a', s3), 0.5 * grove));
  const shrubs: Pt[] = [[100, 470], [140, 500], [118, 530], [160, 560], [96, 560], [140, 610], [190, 470], [106, 630]];
  shrubs.forEach(([x, y], i) => coffeeShrub(ctx, x, y, 9, 80 + i, 0.55 + 0.3 * grove, s3));
  label(ctx, 'SHADE GROVE', 49, 470, 12, mix('#9ad8a6', LEAF, wake), 0.55 + 0.4 * wake, -Math.PI / 2);
  label(ctx, 'coffee under trees', 116, 668, 8, LEAF, 0.35 + 0.4 * s3);

  // --- Carp Canal: water in the right orbit, invasive carp held back by the barrier
  ctx.fillStyle = vgrad(ctx, 300, 660, [[0, rgba(WATER, 0.25 + 0.25 * wake)], [1, rgba('#1a5a74', 0.45 + 0.2 * wake)]]);
  ctx.fillRect(500, 300, 46, 360);
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = rgba(WATER_HI, 0.08 + 0.12 * wake);
    ctx.beginPath();
    ctx.moveTo(504, 320 + i * 42);
    ctx.quadraticCurveTo(523, 312 + i * 42, 542, 320 + i * 42);
    ctx.stroke();
  }
  fishShape(ctx, 523, 612, 26, -Math.PI / 2, '#8a7a5a', 0.55, 0.22);
  fishShape(ctx, 516, 640, 20, -Math.PI / 2 + 0.2, '#8a7a5a', 0.45, 0.22);
  const zap = 0.35 + 0.5 * s1 + 0.15 * s4;
  neonPath(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) ctx.lineTo(503 + i * 5, 560 + (i % 2 ? -4 : 4));
  }, MINT, zap, 2);
  label(ctx, 'CARP CANAL', 523, 420, 12, WATER_HI, 0.55 + 0.4 * wake, Math.PI / 2);
  label(ctx, 'BARRIER', 523, 584, 8, MINT, 0.5 + 0.5 * zap);

  // --- The lake
  ctx.save();
  lakePath(ctx);
  const lg = ctx.createRadialGradient(286, 250, 20, 286, 280, 260);
  lg.addColorStop(0, mix('#1b5a78', '#3aa6c4', wake));
  lg.addColorStop(1, mix('#0f3248', '#1d6a88', wake));
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.clip();
  // gentle ripples
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const y = 110 + i * 20;
    ctx.strokeStyle = rgba(WATER_HI, 0.06 + 0.1 * wake);
    ctx.beginPath();
    for (let x = 80; x <= 500; x += 10) ctx.lineTo(x, y + Math.sin(x / 26 + i * 1.3) * 3);
    ctx.stroke();
  }
  // Snail Shallows: sandy patches around the bumpers.
  for (const [x, y] of [[238, 270], [330, 196], [380, 300]] as Pt[]) {
    const g = ctx.createRadialGradient(x, y, 10, x, y, 64);
    g.addColorStop(0, rgba(SAND, 0.32 + 0.18 * wake));
    g.addColorStop(1, rgba(SAND, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 70, y - 70, 140, 140);
  }
  // The ripple chain in pictures: snails multiply while snail-eaters are scarce (level 2), then
  // the small fish return once the wider net spares them (level 3).
  const snails = Math.round(4 + 10 * s2 - 7 * s3);
  for (let i = 0; i < Math.min(SNAIL_SPOTS.length, snails); i++) snailShape(ctx, SNAIL_SPOTS[i][0], SNAIL_SPOTS[i][1], 6, '#e3c48c', 0.75);
  const smallFish = Math.round(3 + 7 * s3);
  for (let i = 0; i < smallFish; i++) {
    const [x, y, a] = SMALL_FISH[i];
    fishShape(ctx, x, y, 14, a, mix('#9fe8c4', MINT, s3), 0.55 + 0.35 * s3);
  }
  for (const [x, y, a] of BIG_FISH) fishShape(ctx, x, y, 30, a, mix('#c9a24a', GOLD, wake), 0.5 + 0.3 * wake, 0.24);
  // lily pads along the edge
  const rp = rng(17);
  for (let i = 0; i < 9; i++) {
    const x = 96 + rp() * 400;
    const y = 120 + rp() * 60 + (i % 3) * 90;
    ctx.fillStyle = rgba(LEAF, 0.18 + 0.25 * s3);
    ctx.beginPath();
    ctx.arc(x, y, 6 + rp() * 4, 0.3, TAU - 0.3);
    ctx.lineTo(x, y);
    ctx.fill();
  }
  ctx.restore();
  // shoreline
  ctx.save();
  lakePath(ctx);
  ctx.strokeStyle = rgba(SAND, 0.35 + 0.3 * wake);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // --- The Selective Net hanging in the water behind the fish targets
  const ropeA = fishAt(0, 11);
  const ropeB = fishAt(4, 11);
  const ra: Pt = [ropeA[0] - 14, ropeA[1] + 1.5];
  const rb: Pt = [ropeB[0] + 14, ropeB[1] - 1.5];
  netMesh(ctx, ra, rb, 22, 6 + 8 * s3, mix(IVORY, GOLD, s3), 0.22 + 0.25 * wake);
  label(ctx, 'SELECTIVE NET', 352, 362, 11, mix(IVORY, GOLD, s3), 0.6 + 0.4 * wake, NET_DEG * Math.PI / 180, s3);
  if (s3 > 0.01) label(ctx, 'wider mesh: small fish slip through', 352, 376, 7.5, MINT, 0.8 * s3, NET_DEG * Math.PI / 180);
  // Fish icons on the shore under each target: small, BIG, small, BIG, small.
  NET_KINDS.forEach((k, i) => {
    const [x, y] = fishAt(i, -22);
    const big = k === 'big';
    fishShape(ctx, x, y, big ? 22 : 12, Math.PI, big ? GOLD : MINT, 0.55 + 0.35 * wake, big ? 0.25 : 0.2);
    if (!big && s3 > 0.01) arrow(ctx, x, y - 34, -Math.PI / 2, 5, MINT, 0.8 * s3);
  });

  // --- Town square below the net: a round plaza, the Forecast Portal and the Design Fork
  ctx.save();
  ctx.fillStyle = rgba(mix('#34465a', '#5a6e84', wake), 0.45);
  ctx.beginPath();
  ctx.arc(350, 560, 74, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(IVORY, 0.08 + 0.1 * wake);
  for (let r = 18; r <= 72; r += 18) {
    ctx.beginPath();
    ctx.arc(350, 560, r, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(350 + Math.cos(a) * 18, 560 + Math.sin(a) * 18);
    ctx.lineTo(350 + Math.cos(a) * 72, 560 + Math.sin(a) * 72);
    ctx.stroke();
  }
  ctx.restore();
  // A fountain at the plaza's heart (clean water), lit as the town powers up.
  glowDot(ctx, 350, 560, 16, WATER_HI, 0.25 + 0.5 * s3);
  ctx.strokeStyle = rgba(WATER_HI, 0.35 + 0.4 * s3);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(350, 560, 9, 0, TAU);
  ctx.stroke();

  // Design Fork lane: a design track with route markings.
  ctx.fillStyle = rgba('#0a1622', 0.45);
  ctx.fillRect(219, 488, 46, 164);
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.35 * s1);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(242, 650);
  ctx.lineTo(242, 520);
  ctx.stroke();
  ctx.setLineDash([]);
  label(ctx, 'DESIGN FORK', 242, 742, 11, GOLD, 0.6 + 0.4 * wake, 0, s1);
  label(ctx, 'criteria · limits', 242, 756, 7.5, CORAL, 0.45 + 0.45 * s1);
  // The Studio cup: a blueprint grid behind the Wonder Pocket.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(219, 488);
  ctx.lineTo(242, 469);
  ctx.lineTo(265, 488);
  ctx.lineTo(265, 530);
  ctx.lineTo(219, 530);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = rgba('#1d4f8a', 0.55 + 0.25 * wake);
  ctx.fillRect(210, 460, 64, 80);
  ctx.strokeStyle = rgba('#bfe0ff', 0.25 + 0.2 * wake);
  ctx.lineWidth = 0.8;
  for (let x = 214; x < 270; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 460);
    ctx.lineTo(x, 540);
    ctx.stroke();
  }
  for (let y = 464; y < 540; y += 6) {
    ctx.beginPath();
    ctx.moveTo(210, y);
    ctx.lineTo(274, y);
    ctx.stroke();
  }
  ctx.restore();
  // MODEL route: the alcove and the Forecast Portal rings.
  for (let i = 0; i < 3; i++) {
    neonPath(ctx, () => {
      ctx.beginPath();
      ctx.arc(PORTAL[0], PORTAL[1], 8 + i * 6, 0, TAU);
    }, i % 2 ? CORAL : MINT, 0.25 + 0.6 * stage(level, 0.5 + i * 0.7, 1.5 + i * 0.7), 1.5);
  }
  label(ctx, 'MODEL', 284, 541, 8, MINT, 0.55 + 0.4 * wake);
  label(ctx, 'FORECAST', 318, 606, 8, CORAL, 0.5 + 0.45 * wake, -0.5);
  arrow(ctx, 256, 568, 0, 5, MINT, 0.35 + 0.4 * wake);
  label(ctx, 'STUDIO', 242, 616, 8, GOLD, 0.45 + 0.45 * wake);
  arrow(ctx, 242, 600, -Math.PI / 2, 5, GOLD, 0.4 + 0.4 * wake);

  // --- Town Hall island: a solar-roofed hall with the Problem Board on its face
  ctx.save();
  ctx.beginPath();
  const face = Array.from({ length: 13 }, (_, i) => boardAt(BOARD.from + ((BOARD.to - BOARD.from) * i) / 12, BOARD.r + 6));
  ctx.moveTo(498, 440);
  ctx.lineTo(face[0][0] - 4, face[0][1] - 4);
  for (const p of face) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(498, 618);
  ctx.closePath();
  ctx.fillStyle = rgba(mix('#4a3a52', '#7a5a6a', wake), 0.8);
  ctx.fill();
  ctx.clip();
  solarRoof(ctx, 468, 520, 46, 56, -0.65, s3);
  ctx.restore();
  label(ctx, 'TOWN HALL', 470, 470, 9, IVORY, 0.65 + 0.35 * wake, -0.65);
  label(ctx, 'PROBLEM BOARD', 452, 640, 9, CORAL, 0.55 + 0.45 * s1, 0.92, s1);
  label(ctx, 'name all six', 440, 652, 7, IVORY, 0.4 + 0.4 * s1, 0.92);

  // --- Test Ramp: track marks under the plastic and its name at the mouth
  ctx.save();
  ctx.strokeStyle = rgba(MINT, 0.12 + 0.2 * wake);
  ctx.setLineDash([3, 7]);
  ctx.lineWidth = 2;
  smoothPath(ctx, RAMP_PATH.slice(0, 4));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  label(ctx, 'TEST RAMP', 130, 750, 10, MINT, 0.6 + 0.4 * wake, -0.3, stage(level, 2, 3));
  label(ctx, 'prototype lift', 128, 764, 7, IVORY, 0.35 + 0.35 * wake, -0.3);

  // --- Lower garden: lawn, garden walks, allotments and eco homes (calm mid-tones where the ball runs)
  const rl = rng(53);
  ctx.lineCap = 'round';
  for (let i = 0; i < 520; i++) {
    const x = 26 + rl() * 520;
    const y = 640 + rl() * 470;
    ctx.strokeStyle = rgba(rl() < 0.5 ? '#3f8f5c' : '#6fae6a', 0.05 + 0.1 * wake);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rl() - 0.5) * 3, y - 4 - rl() * 4);
    ctx.stroke();
  }
  const walk = (pts: Pt[], w: number) => {
    ctx.strokeStyle = rgba(SAND, 0.05 + 0.07 * wake);
    ctx.lineWidth = w;
    smoothPath(ctx, pts);
    ctx.stroke();
    ctx.strokeStyle = rgba(IVORY, 0.05 + 0.05 * wake);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 9]);
    smoothPath(ctx, pts);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  walk([[286, 1110], [286, 990], [286, 880], [300, 780], [336, 700], [350, 636]], 26);
  walk([[286, 880], [230, 800], [190, 740], [176, 690]], 16);
  walk([[300, 780], [380, 730], [420, 690]], 16);
  // Allotment beds that sprout as the missions succeed.
  const beds: [number, number, number, number][] = [[140, 788, 56, 20], [376, 788, 56, 20], [196, 756, 42, 16], [334, 756, 42, 16], [36, 708, 30, 50], [510, 718, 30, 44]];
  beds.forEach(([x, y, w, h], i) => {
    ctx.fillStyle = rgba('#3a2a1c', 0.4);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba('#8a6a46', 0.35);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    const cols = w > h ? 5 : 2;
    const rows = w > h ? 1 : 4;
    for (let k = 0; k < cols; k++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillStyle = rgba([LEAF, '#a9d870', '#e8a0c0'][(i + k + j) % 3], 0.14 + 0.5 * stage(level, 0.5 + i * 0.35, 2.5 + i * 0.2));
        ctx.beginPath();
        ctx.arc(x + ((k + 0.5) * w) / cols, y + ((j + 0.5) * h) / rows, 3.1, 0, TAU);
        ctx.fill();
      }
    }
  });
  // Eco homes with solar roofs beside the walks.
  solarRoof(ctx, 286, 822, 50, 20, 0, s3);
  solarRoof(ctx, 176, 766, 30, 18, -0.35, s3);
  solarRoof(ctx, 396, 766, 30, 18, 0.35, s3);
  // Path lanterns along the garden walk.
  for (let i = 0; i < 6; i++) {
    const y = 1060 - i * 50;
    glowDot(ctx, 262 + (i % 2) * 48, y, 8, GOLD, 0.1 + 0.5 * stage(level, 0.5 + i * 0.3, 1.5 + i * 0.3));
  }
  // Wildflower meadows along the outer lanes, blooming by level.
  const rm = rng(61);
  for (let i = 0; i < 46; i++) {
    const left = i % 2 === 0;
    const x = left ? 30 + rm() * 70 : 470 + rm() * 70;
    const y = 700 + rm() * 120;
    glowDot(ctx, x, y, 3.2, [CORAL, GOLD, LILAC, IVORY][i % 4], 0.12 + 0.6 * stage(level, 1 + (i % 5) * 0.4, 2.5 + (i % 5) * 0.3));
  }
  // The Forecast Portal's sea-level forecast: a rising line inside a band that widens with time.
  const fc = 0.25 + 0.55 * stage(level, 1.5, 3) + 0.2 * s4;
  ctx.save();
  ctx.translate(318, 640);
  ctx.strokeStyle = rgba(IVORY, 0.35 * fc + 0.1);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 46);
  ctx.lineTo(78, 46);
  ctx.stroke();
  ctx.fillStyle = rgba(CORAL, 0.25 * fc);
  ctx.beginPath();
  ctx.moveTo(4, 40);
  ctx.quadraticCurveTo(40, 36, 76, 8);
  ctx.lineTo(76, 30);
  ctx.quadraticCurveTo(40, 40, 4, 42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(CORAL, 0.6 * fc + 0.1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, 41);
  ctx.quadraticCurveTo(40, 38, 76, 19);
  ctx.stroke();
  ctx.restore();
  label(ctx, 'model forecast: a range', 357, 698, 6.5, CORAL, 0.35 + 0.5 * fc);

  // --- The engineering design cycle on the apron: it lights step by step with the missions.
  const steps: [string, number][] = [['DEFINE', s1], ['MODEL', s2], ['TEST', s3], ['REVISE', s3], ['MONITOR', s4]];
  steps.forEach(([t, lit], i) => {
    const x = 150 + i * 70;
    label(ctx, t, x, 1084, 9, lit > 0.05 ? GOLD : IVORY, 0.3 + 0.7 * lit, 0, lit);
    if (i < steps.length - 1) arrow(ctx, x + 35, 1084, 0, 3.5, IVORY, 0.25 + 0.4 * lit);
  });
  label(ctx, 'define · model · test · revise · keep monitoring', 286, 1100, 6.5, IVORY, 0.35 + 0.35 * wake);

  // --- The ripple chain the missions uncover, written over the far lake.
  if (s2 > 0.01) label(ctx, 'fewer snail-eaters › more snails › more bilharzia', 380, 112, 7.5, PEACH, 0.85 * s2, 0.12);
  if (s3 > 0.01) label(ctx, 'wider mesh › snail-eaters spared', 392, 126, 7.5, MINT, 0.85 * s3, 0.12);

  // --- Marquee under the arch
  neonText(ctx, 'FUTURE GARDEN', 304, 48, 22, GOLD, stage(level, 1.4, 2.4));

  // --- Wonderlight: a rainbow over the lake and a garden in bloom.
  if (s4 > 0.01) {
    const cols = [CORAL, GOLD, LEAF, MINT, LILAC];
    cols.forEach((c, i) => {
      ctx.strokeStyle = rgba(c, 0.35 * s4);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(286, 430, 200 - i * 7, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    });
    const rf = rng(29);
    for (let i = 0; i < 40; i++) glowDot(ctx, 40 + rf() * 500, 680 + rf() * 300, 5, [CORAL, GOLD, LILAC, MINT][i % 4], 0.5 * s4);
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
  }
}

// ---------------------------------------------------------------- 3D attraction set

const GROUND = -0.42;

interface Item {
  x: number;
  y: number;
  z: number;
  s: number;
  ry?: number;
  sy?: number;
}

/** An instanced patch of identical props that can grow from nothing to full size. */
function grower(kit: SetKit, geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[], shadow = true) {
  const T = kit.THREE;
  const mesh = new T.InstancedMesh(geo, mat, items.length);
  mesh.castShadow = shadow;
  const dummy = new T.Object3D();
  let last = -1;
  const grow = (k: number) => {
    const q = Math.round(k * 60) / 60;
    if (q === last) return;
    last = q;
    mesh.visible = q > 0.01;
    items.forEach((it, i) => {
      const s = Math.max(0.001, it.s * q);
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(0, it.ry ?? 0, 0);
      dummy.scale.set(s, s * (it.sy ?? 1), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  grow(1);
  kit.add(mesh);
  return { mesh, grow };
}

function scatterItems(seed: number, n: number, x0: number, x1: number, z0: number, z1: number, y: number, s0: number, s1: number, sy = 1): Item[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: x0 + r() * (x1 - x0), y, z: z0 + r() * (z1 - z0), s: s0 + r() * (s1 - s0), ry: r() * TAU, sy }));
}

function matte(kit: SetKit, color: string, opts: { emissive?: string; flat?: boolean; rough?: number; metal?: number } = {}) {
  return kit.track(new kit.THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0, flatShading: opts.flat ?? false, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissive ? 0.05 : 0 }));
}

function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void, repeat?: number) {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

/** Lawn with clover speckles and stepping-stone paths (tinted from dusk-grey to green by level). */
function lawnTexture(kit: SetKit) {
  return canvasTex(kit, 256, 256, (ctx) => {
    ctx.fillStyle = '#c8d0c4';
    ctx.fillRect(0, 0, 256, 256);
    const r = rng(41);
    for (let i = 0; i < 1400; i++) {
      const v = 150 + Math.floor(r() * 100);
      ctx.fillStyle = `rgb(${v - 20},${v},${v - 30})`;
      ctx.fillRect(r() * 256, r() * 256, 1.5 + r() * 2.5, 1.5 + r() * 2.5);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(40 + i * 36, 128 + Math.sin(i) * 30, 12, 8, i, 0, TAU);
      ctx.fill();
    }
  }, 16);
}

/** The Design Studio's glowing blueprint: a net design with two mesh sizes and a test log. */
function blueprintTexture(kit: SetKit) {
  return canvasTex(kit, 256, 160, (ctx) => {
    ctx.fillStyle = '#123a6e';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = 'rgba(191,224,255,0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 256; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 160);
      ctx.stroke();
    }
    for (let y = 0; y < 160; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e8f4ff';
    ctx.lineWidth = 2;
    for (const [x0, hole] of [[20, 10], [140, 22]] as [number, number][]) {
      ctx.strokeRect(x0, 30, 96, 70);
      ctx.beginPath();
      for (let x = x0; x <= x0 + 96; x += hole) {
        ctx.moveTo(x, 30);
        ctx.lineTo(x, 100);
      }
      for (let y = 30; y <= 100; y += hole) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + 96, y);
      }
      ctx.stroke();
    }
    ctx.font = '700 15px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = '#e8f4ff';
    ctx.fillText('v1 fine', 34, 124);
    ctx.fillText('v2 wide', 156, 124);
    ctx.fillText('test · compare · revise', 40, 150);
  });
}

/** A fishing net panel (alpha mesh) for the boat's boom. */
function netTexture(kit: SetKit) {
  return canvasTex(kit, 128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = -128; i < 256; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
  });
}

/** The Town Hall's six problem plaques. */
function plaqueTexture(kit: SetKit) {
  return canvasTex(kit, 512, 192, (ctx) => {
    ctx.fillStyle = '#1a1230';
    ctx.fillRect(0, 0, 512, 192);
    const cols = [CORAL, PEACH, GOLD, LEAF, MINT, LILAC];
    PROBLEMS.forEach((p, i) => {
      const x = 10 + (i % 3) * 167;
      const y = 12 + Math.floor(i / 3) * 90;
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.roundRect(x, y, 157, 78, 14);
      ctx.fill();
      ctx.fillStyle = '#1a1030';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 22;
      ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      while (ctx.measureText(p).width > 143 && size > 12) {
        size -= 1;
        ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      }
      ctx.fillText(p, x + 78, y + 40);
    });
  });
}

/** Painted horizon behind the head: a future skyline at sunrise that brightens with the level. */
function paintHorizon(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const dawn = stage(level, 0.5, 4);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mix('#0c1a34', '#1c3c6a', dawn));
  sky.addColorStop(0.55, mix('#1c2a4a', '#6a6a9a', dawn));
  sky.addColorStop(1, mix('#2a2a44', '#ffb38a', dawn * 0.85));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const r = rng(8);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,247,231,${(0.2 + r() * 0.6) * (1 - dawn)})`;
    ctx.fillRect(r() * w, r() * h * 0.45, 1.5, 1.5);
  }
  const sunY = h * (0.86 - 0.22 * dawn);
  const sg = ctx.createRadialGradient(w * 0.62, sunY, 4, w * 0.62, sunY, h * 0.55);
  sg.addColorStop(0, `rgba(255,214,140,${0.25 + 0.6 * dawn})`);
  sg.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `rgba(255,230,170,${0.3 + 0.6 * dawn})`;
  ctx.beginPath();
  ctx.arc(w * 0.62, sunY, h * 0.06, 0, TAU);
  ctx.fill();
  // far hills and a lake strip
  for (let k = 0; k < 2; k++) {
    ctx.fillStyle = mix(['#1c2440', '#16203a'][k], ['#3a5a5a', '#2c4a44'][k], dawn);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.66 + k * 0.08) + Math.sin(x / (70 + k * 40) + k) * h * 0.04);
    ctx.lineTo(w, h);
    ctx.fill();
  }
  ctx.fillStyle = mix('#1a2a44', '#5ab0c8', dawn * 0.8);
  ctx.fillRect(0, h * 0.84, w, h * 0.04);
  // future skyline: greenhouse domes, a garden tower and wind turbines
  const ink = mix('#121a2e', '#2a3a4a', dawn);
  ctx.fillStyle = ink;
  for (const [x, rr] of [[0.18, 0.05], [0.28, 0.035], [0.8, 0.045]] as [number, number][]) {
    ctx.beginPath();
    ctx.arc(w * x, h * 0.8, h * rr * 2, Math.PI, TAU);
    ctx.fill();
  }
  ctx.fillRect(w * 0.44, h * 0.5, w * 0.035, h * 0.32);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(127,209,139,${0.3 + 0.5 * dawn})`;
    ctx.beginPath();
    ctx.arc(w * 0.457, h * (0.53 + i * 0.07), w * 0.025, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  for (const x of [0.08, 0.36, 0.7, 0.92]) {
    ctx.beginPath();
    ctx.moveTo(w * x, h * 0.82);
    ctx.lineTo(w * x, h * 0.58);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + x * 10;
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.58);
      ctx.lineTo(w * x + Math.cos(a) * h * 0.09, h * 0.58 + Math.sin(a) * h * 0.09);
      ctx.stroke();
    }
  }
  // windows waking up
  const rw = rng(12);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,199,91,${(0.1 + 0.8 * stage(level, rw() * 3, rw() * 3 + 1)) * 0.8})`;
    ctx.fillRect(w * (0.05 + rw() * 0.9), h * (0.74 + rw() * 0.08), 3, 2);
  }
}

/** A triangular-prism roof along X with its ridge on top, base at y = -r/2 (r = circumradius). */
function prismRoof(T: SetKit['THREE'], r: number, len: number) {
  const g = new T.CylinderGeometry(r, r, len, 3, 1);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

const futureSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  kit.sky('#12304e', '#04070e');
  const lawnMat = kit.track(new T.MeshStandardMaterial({ color: '#4a5a58', map: lawnTexture(kit), roughness: 0.95 }));
  const lawn = new T.Mesh(new T.CircleGeometry(30, 64).rotateX(-Math.PI / 2), lawnMat);
  lawn.position.y = GROUND;
  lawn.receiveShadow = true;
  kit.add(lawn);
  const lawnDusk = new T.Color('#4a5a58');
  const lawnGreen = new T.Color('#557f52');
  const horizon = kit.backdrop(paintHorizon, { width: 30, height: 11, z: -15 });

  // ---------------- LEFT BACK: the Shade Grove (coffee growing under tall shade trees) ----------------
  const treeSpots: Item[] = [
    { x: -5.2, y: GROUND, z: -4.7, s: 1.15 },
    { x: -6.9, y: GROUND, z: -3.7, s: 1.3 },
    { x: -7.9, y: GROUND, z: -5.4, s: 1.0 },
    { x: -5.3, y: GROUND, z: -2.6, s: 0.92 },
  ];
  const trunkGeo = new T.CylinderGeometry(0.06, 0.1, 1.6, 7);
  trunkGeo.translate(0, 0.8, 0);
  const crownGeo = new T.SphereGeometry(0.62, 14, 10);
  crownGeo.scale(1, 0.42, 1);
  crownGeo.translate(0, 1.72, 0);
  const crown2Geo = new T.SphereGeometry(0.42, 12, 8);
  crown2Geo.scale(1, 0.5, 1);
  crown2Geo.translate(0.1, 1.98, 0.05);
  const trunks = grower(kit, trunkGeo, matte(kit, '#5a3a26'), treeSpots);
  const crownMat = matte(kit, '#2f6a46', { flat: true, emissive: LEAF });
  const crowns = grower(kit, crownGeo, crownMat, treeSpots);
  const crowns2 = grower(kit, crown2Geo, crownMat, treeSpots);
  const shrubItems = scatterItems(5, kit.n(16), -8.3, -4.6, -5.6, -2.1, GROUND + 0.16, 0.14, 0.22, 0.85);
  const shrubs = grower(kit, new T.IcosahedronGeometry(1, 1), matte(kit, FERN, { flat: true }), shrubItems);
  const rC = rng(6);
  const cherryItems: Item[] = [];
  for (const it of shrubItems) {
    for (let k = 0; k < 3; k++) {
      const a = rC() * TAU;
      cherryItems.push({ x: it.x + Math.cos(a) * it.s * 0.85, y: it.y + (rC() - 0.2) * it.s * 0.7, z: it.z + Math.sin(a) * it.s * 0.85, s: 0.035 });
    }
  }
  const cherryMat = kit.track(new T.MeshStandardMaterial({ color: CHERRY, emissive: CHERRY, emissiveIntensity: 0.1, roughness: 0.4 }));
  const cherries = grower(kit, new T.SphereGeometry(1, 8, 6), cherryMat, cherryItems, false);
  const groveSign = kit.neonSign('SHADE GROVE', [-4.55, 1.55, -3.6], { height: 0.32, color: LEAF, rotY: 0.5 });
  groveSign.rotation.x = -0.55;
  kit.pole([-4.55, 0, -3.6], 1.36);

  // ---------------- LEFT FRONT: the Design Studio (a glass dome over a glowing blueprint) ----------------
  const D = { x: -6.15, z: 0.35 };
  const base = new T.Mesh(new T.CylinderGeometry(1.05, 1.12, 0.16, 32), matte(kit, '#d9d2c4'));
  base.position.set(D.x, GROUND + 0.08, D.z);
  base.receiveShadow = true;
  kit.add(base);
  const dome = new T.Mesh(new T.SphereGeometry(0.98, 28, 14, 0, TAU, 0, Math.PI / 2), kit.mats.clearPlastic('#bff5ea', 0.22));
  dome.position.set(D.x, GROUND + 0.16, D.z);
  kit.add(dome);
  const ribs = new T.Mesh(new T.SphereGeometry(0.99, 10, 5, 0, TAU, 0, Math.PI / 2), kit.track(new T.MeshStandardMaterial({ color: '#e8f4f0', wireframe: true, transparent: true, opacity: 0.35 })));
  ribs.position.copy(dome.position);
  kit.add(ribs);
  const table = new T.Mesh(new T.BoxGeometry(0.9, 0.36, 0.56), matte(kit, '#6a5a4a'));
  table.position.set(D.x, GROUND + 0.34, D.z);
  table.castShadow = true;
  kit.add(table);
  const bpMat = kit.track(new T.MeshStandardMaterial({ color: '#0a1830', emissive: '#ffffff', emissiveMap: blueprintTexture(kit), emissiveIntensity: 0.15, roughness: 0.6 }));
  const blueprint = new T.Mesh(new T.PlaneGeometry(0.84, 0.52), bpMat);
  blueprint.rotation.x = -Math.PI / 2 + 0.35;
  blueprint.position.set(D.x, GROUND + 0.56, D.z + 0.04);
  kit.add(blueprint);
  // On a post just behind the dome rather than floating over it.
  const studioSign = kit.neonSign('DESIGN STUDIO', [D.x + 0.1, 1.38, D.z - 1.2], { height: 0.3, color: GOLD, rotY: 0.45 });
  studioSign.rotation.x = -0.55;
  kit.pole([D.x + 0.1, 0, D.z - 1.2], 1.22);
  // A prototype on the bench: a tiny net frame that spins slowly.
  const proto = new T.Mesh(new T.TorusGeometry(0.13, 0.012, 6, 24), kit.mats.brass());
  proto.position.set(D.x + 0.28, GROUND + 0.72, D.z - 0.1);
  kit.add(proto);

  // ---------------- LEFT FRONT: the Prototype Test Track ----------------
  const trackPts: V3[] = [[-4.4, 0.05, 1.6], [-4.15, 0.55, 2.3], [-4.55, 0.95, 3.0], [-5.25, 0.75, 3.15], [-5.5, 0.25, 2.55], [-5.0, 0.05, 2.0]];
  const track = kit.neonTube(trackPts, MINT, { radius: 0.035, closed: true });
  const trackCurve = new T.CatmullRomCurve3(trackPts.map((p) => new T.Vector3(p[0], p[1], p[2])), true);
  const postGeo = new T.CylinderGeometry(0.02, 0.02, 1, 6);
  postGeo.translate(0, 0.5, 0);
  const postItems: Item[] = trackPts.map((p) => ({ x: p[0], y: GROUND, z: p[2], s: 1, sy: Math.max(0.05, p[1] - GROUND) }));
  grower(kit, postGeo, kit.mats.chrome(), postItems.map((it) => ({ ...it, s: 1 })));
  const testBall = kit.orb([-4.4, 0.05, 1.6], 0.07, IVORY);
  const trackSign = kit.panel('PROTOTYPE TEST', [-5.3, 0.2, 3.75], { w: 1.05, h: 0.24, bg: '#bff5ea', fg: '#10302c', rotY: 0.25 });
  trackSign.rotation.x = -0.5;

  // ---------------- LEFT REAR CORNER: the Reef Nursery tank (baby corals on a steel frame) ----------------
  const R0 = { x: -6.3, z: 2.6 };
  const tank = new T.Mesh(new T.BoxGeometry(1.1, 0.62, 0.62), kit.mats.clearPlastic('#d8f4ff', 0.18));
  tank.position.set(R0.x, GROUND + 0.62, R0.z);
  kit.add(tank);
  const seaMat = kit.track(new T.MeshStandardMaterial({ color: '#1b6a9a', emissive: '#2a8fb0', emissiveIntensity: 0.1, transparent: true, opacity: 0.55, roughness: 0.1 }));
  const sea = new T.Mesh(new T.BoxGeometry(1.06, 0.48, 0.58), seaMat);
  sea.position.set(R0.x, GROUND + 0.56, R0.z);
  kit.add(sea);
  const stand = new T.Mesh(new T.BoxGeometry(1.16, 0.31, 0.66), matte(kit, '#2a3440'));
  stand.position.set(R0.x, GROUND + 0.155, R0.z);
  kit.add(stand);
  const cage = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(0.7, 0.26, 0.34)), kit.track(new T.LineBasicMaterial({ color: '#c9d4dc' })));
  cage.position.set(R0.x, GROUND + 0.48, R0.z);
  kit.add(cage);
  const corals = [CORAL, PEACH, LILAC, GOLD].map((c, i) => kit.crystal([R0.x - 0.27 + i * 0.18, GROUND + 0.66, R0.z + (i % 2 ? 0.06 : -0.06)], 0.06 + (i % 2) * 0.02, c, 30 + i));
  const reefSign = kit.panel('REEF NURSERY', [R0.x + 0.1, 0.36, R0.z + 0.62], { w: 0.95, h: 0.22, bg: '#ffd0c4', fg: '#3a1a14', rotY: 0.2 });
  reefSign.rotation.x = -0.45;

  // ---------------- RIGHT BACK: the Future Lake, a fishing boat with the selective net ----------------
  const L = { x: 6.2, z: -3.25 };
  // The water is a square sheet; a raised sandy beach ring trims it to a round lake.
  kit.water([L.x, GROUND + 0.1, L.z], 3.3, 3.3, '#2b86a8');
  const beach = new T.Mesh(new T.RingGeometry(1.56, 2.2, 48).rotateX(-Math.PI / 2), matte(kit, SAND));
  beach.position.set(L.x, GROUND + 0.2, L.z);
  beach.receiveShadow = true;
  kit.add(beach);
  const rim = new T.Mesh(new T.CylinderGeometry(2.2, 2.24, 0.62, 48, 1, true), matte(kit, '#a89878'));
  rim.position.set(L.x, GROUND - 0.1, L.z);
  kit.add(rim);
  // Reeds around the shore and a little pier out to the boat.
  const reedGeo = new T.CylinderGeometry(0.008, 0.012, 0.34, 4);
  reedGeo.translate(0, 0.17, 0);
  const rr = rng(23);
  const reedItems: Item[] = Array.from({ length: kit.n(22) }, () => {
    const a = Math.PI * 0.15 + rr() * Math.PI * 1.5;
    const d = 1.5 + rr() * 0.12;
    return { x: L.x + Math.cos(a) * d, y: GROUND + 0.18, z: L.z + Math.sin(a) * d, s: 0.8 + rr() * 0.6 };
  });
  const reeds = grower(kit, reedGeo, matte(kit, '#8fbf5a'), reedItems, false);
  const pier = new T.Mesh(new T.BoxGeometry(0.2, 0.05, 1.0), kit.mats.wood());
  pier.position.set(L.x - 1.35, GROUND + 0.24, L.z + 0.55);
  pier.rotation.y = -0.9;
  kit.add(pier);
  const boat = new T.Group();
  const hullGeo = new T.CylinderGeometry(0.22, 0.22, 1.0, 16, 1, false, 0, Math.PI);
  hullGeo.rotateZ(Math.PI / 2);
  hullGeo.rotateX(Math.PI / 2);
  const hull = new T.Mesh(hullGeo, kit.mats.plastic('#f2efe6'));
  hull.scale.set(1, 0.7, 1);
  const stripe = new T.Mesh(new T.BoxGeometry(1.0, 0.04, 0.02), kit.mats.plastic(CORAL));
  stripe.position.set(0, -0.02, 0.22);
  const cabin = new T.Mesh(new T.BoxGeometry(0.32, 0.24, 0.28), kit.mats.plastic('#2f6e7a'));
  cabin.position.set(-0.18, 0.13, 0);
  const mast = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.9, 6), kit.mats.chrome());
  mast.position.set(0.18, 0.45, 0);
  const boom = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.8, 6), kit.mats.chrome());
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0.18, 0.75, 0.38);
  const netMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', alphaMap: netTexture(kit), transparent: true, side: T.DoubleSide, emissive: GOLD, emissiveIntensity: 0.05, depthWrite: false }));
  const netPanel = new T.Mesh(new T.PlaneGeometry(0.7, 0.62), netMat);
  netPanel.position.set(0.18, 0.42, 0.74);
  boat.add(hull, stripe, cabin, mast, boom, netPanel);
  boat.position.set(L.x - 0.35, GROUND + 0.16, L.z - 0.1);
  boat.rotation.y = 0.35;
  boat.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  kit.add(boat);
  // Fish: big gold fish and small mint snail-eaters leaping near the net.
  const fishGeo = new T.CapsuleGeometry(0.05, 0.14, 3, 8);
  fishGeo.rotateZ(Math.PI / 2);
  const fishBigMat = kit.track(new T.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.15, roughness: 0.4 }));
  const fishSmallMat = kit.track(new T.MeshStandardMaterial({ color: MINT, emissive: MINT, emissiveIntensity: 0.15, roughness: 0.4 }));
  const nBig = kit.n(4);
  const nSmall = kit.n(7);
  const fishBig = new T.InstancedMesh(fishGeo, fishBigMat, nBig);
  const fishSmall = new T.InstancedMesh(fishGeo, fishSmallMat, nSmall);
  fishBig.frustumCulled = false;
  fishSmall.frustumCulled = false;
  kit.add(fishBig);
  kit.add(fishSmall);
  const fishDummy = new T.Object3D();
  let fishLit = 0;
  let smallFree = 0;
  const leap = (mesh: THREE.InstancedMesh, n: number, t: number, big: boolean) => {
    for (let i = 0; i < n; i++) {
      const ph = kit.reducedMotion ? 0.5 : (t * (big ? 0.32 : 0.45) + i * 0.37) % 1;
      const a = i * 2.3 + (big ? 0 : 1.1);
      const rad = big ? 0.7 + (i % 2) * 0.45 : 0.45 + (i % 3) * 0.33;
      const hop = Math.sin(ph * Math.PI) * (big ? 0.45 : 0.6) * (big ? 1 : 0.4 + 0.6 * smallFree);
      const s = Math.max(0.001, fishLit * (big ? 1.4 : 0.85));
      fishDummy.position.set(L.x + Math.cos(a) * rad, GROUND + 0.08 + hop, L.z + Math.sin(a) * rad * 0.85);
      fishDummy.rotation.set(0, -a, (0.5 - ph) * 2.2);
      fishDummy.scale.set(s, s, s);
      fishDummy.updateMatrix();
      mesh.setMatrixAt(i, fishDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  const padItems = scatterItems(14, kit.n(12), L.x - 1.3, L.x + 1.3, L.z - 1.3, L.z + 1.3, GROUND + 0.135, 0.07, 0.12, 0.08).filter((it) => Math.hypot(it.x - L.x, it.z - L.z) < 1.35 && Math.hypot(it.x - L.x + 0.35, it.z - L.z + 0.1) > 0.55);
  const pads = grower(kit, new T.CylinderGeometry(1, 1, 0.3, 14), matte(kit, '#4f9a5a'), padItems, false);
  const netSign = kit.neonSign('SELECTIVE NET', [4.55, 1.5, -2.25], { height: 0.32, color: GOLD, rotY: -0.5 });
  netSign.rotation.x = -0.55;
  kit.pole([4.55, 0, -2.25], 1.32);

  // ---------------- RIGHT FRONT: the Town Hall (solar roof, six problem plaques) ----------------
  const H = { x: 5.85, z: 1.0 };
  const hall = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(1.7, 0.85, 1.0), matte(kit, '#e6dccb'));
  body.position.y = 0.425;
  const roofGeo = prismRoof(T, 0.62, 1.85);
  const roof = new T.Mesh(roofGeo, matte(kit, '#7a5a6a'));
  roof.scale.set(1, 0.55, 0.9);
  roof.position.y = 1.02;
  const panelMat = kit.track(new T.MeshStandardMaterial({ color: '#1a2a4a', emissive: SOLAR_HI, emissiveIntensity: 0.04, roughness: 0.25, metalness: 0.5 }));
  const panels = new T.InstancedMesh(new T.BoxGeometry(0.36, 0.02, 0.26), panelMat, 8);
  {
    let k = 0;
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        fishDummy.position.set(-0.66 + i * 0.44, 1.11, side * 0.25);
        fishDummy.rotation.set(side * 0.8, 0, 0);
        fishDummy.scale.set(1, 1, 1);
        fishDummy.updateMatrix();
        panels.setMatrixAt(k++, fishDummy.matrix);
      }
    }
    panels.instanceMatrix.needsUpdate = true;
  }
  const plaqueTex = plaqueTexture(kit);
  const plaqueMat = kit.track(new T.MeshStandardMaterial({ map: plaqueTex, emissive: '#ffffff', emissiveMap: plaqueTex, emissiveIntensity: 0.08, roughness: 0.5 }));
  const plaque = new T.Mesh(new T.PlaneGeometry(1.4, 0.52), plaqueMat);
  plaque.position.set(0, 0.5, 0.505);
  const winMat = kit.track(new T.MeshStandardMaterial({ color: '#141a28', emissive: GOLD, emissiveIntensity: 0.05 }));
  const door = new T.Mesh(new T.PlaneGeometry(0.26, 0.36), winMat);
  door.position.set(0, 0.14, 0.506);
  door.scale.set(1, 0.5, 1);
  hall.add(body, roof, panels, plaque, door);
  hall.position.set(H.x, GROUND, H.z);
  hall.rotation.y = -0.3;
  hall.scale.setScalar(0.88);
  hall.traverse((o) => {
    (o as THREE.Mesh).castShadow = true;
    (o as THREE.Mesh).receiveShadow = true;
  });
  kit.add(hall);
  // A rooftop sign just above the ridge (the ridge sits about 0.8 above the ground plane).
  const hallSign = kit.neonSign('TOWN HALL', [H.x - 0.1, 1.06, H.z - 0.12], { height: 0.28, color: CORAL, rotY: -0.3 });
  hallSign.rotation.x = -0.55;

  // ---------------- RIGHT FRONT: the Carp Canal and its electric barrier ----------------
  const canalMat = kit.track(new T.MeshStandardMaterial({ color: '#2a7fa0', emissive: WATER, emissiveIntensity: 0.15, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.88 }));
  const canal = new T.Mesh(new T.PlaneGeometry(0.7, 3.2).rotateX(-Math.PI / 2), canalMat);
  canal.rotation.y = 0.25;
  canal.position.set(4.75, GROUND + 0.02, 3.35);
  kit.add(canal);
  const bankMat = matte(kit, '#9a9282');
  for (const dx of [-0.42, 0.42]) {
    const bank = new T.Mesh(new T.BoxGeometry(0.1, 0.12, 3.2), bankMat);
    bank.rotation.y = 0.25;
    bank.position.set(4.75 + dx * Math.cos(0.25), GROUND + 0.06, 3.35 - dx * Math.sin(0.25));
    kit.add(bank);
  }
  const pylonGeo = new T.BoxGeometry(0.1, 0.62, 0.1);
  for (const dx of [-0.48, 0.48]) {
    const p = new T.Mesh(pylonGeo, kit.mats.paintedMetal('#c9d4dc'));
    p.position.set(4.62 + dx, GROUND + 0.31, 3.0 + dx * -0.25);
    p.castShadow = true;
    kit.add(p);
  }
  const zapPts: V3[] = Array.from({ length: 9 }, (_, i) => [4.14 + i * 0.12, GROUND + 0.5 + (i % 2 ? -0.06 : 0.06), 3.12 - i * 0.03] as V3);
  const zap = kit.neonTube(zapPts, MINT, { radius: 0.018 });
  const bubbles = kit.motes({ x0: 4.3, x1: 5.1, y0: GROUND + 0.02, y1: GROUND + 0.7, z0: 2.9, z1: 3.3 }, 24, '#bff5ff', { speed: 0.25, size: 0.06 });
  const carpGeo = new T.CapsuleGeometry(0.07, 0.22, 3, 8);
  carpGeo.rotateX(Math.PI / 2);
  const carp = new T.Mesh(carpGeo, matte(kit, '#8a7a5a'));
  carp.position.set(4.95, GROUND + 0.05, 4.1);
  kit.add(carp);
  const canalSign = kit.panel('CARP BARRIER', [5.75, 0.35, 3.95], { w: 1.0, h: 0.22, bg: '#bff5ea', fg: '#10302c', rotY: -0.35 });
  canalSign.rotation.x = -0.5;

  // ---------------- eco homes with solar roofs, and raised garden beds ----------------
  const homeSpots: Item[] = [
    { x: 6.95, y: GROUND, z: 3.05, s: 1, ry: -0.6 },
    { x: 7.25, y: GROUND, z: 1.85, s: 0.9, ry: -0.9 },
    { x: -7.55, y: GROUND, z: -0.85, s: 0.95, ry: 0.9 },
    { x: -7.6, y: GROUND, z: 4.05, s: 0.9, ry: 0.5 },
  ];
  const homeBodyGeo = new T.BoxGeometry(0.62, 0.42, 0.5);
  homeBodyGeo.translate(0, 0.21, 0);
  const homeRoofGeo = prismRoof(T, 0.34, 0.7);
  homeRoofGeo.scale(1, 0.75, 0.86);
  homeRoofGeo.translate(0, 0.42 + 0.5 * 0.34 * 0.75, 0);
  const homeSolarGeo = new T.BoxGeometry(0.5, 0.015, 0.2);
  homeSolarGeo.rotateX(0.85);
  homeSolarGeo.translate(0, 0.42 + 0.17, 0.12);
  grower(kit, homeBodyGeo, matte(kit, '#efe6d6'), homeSpots);
  grower(kit, homeRoofGeo, matte(kit, '#5f8a5a', { flat: true }), homeSpots);
  const homeSolarMat = kit.track(new T.MeshStandardMaterial({ color: '#1a2a4a', emissive: SOLAR_HI, emissiveIntensity: 0.04, roughness: 0.25, metalness: 0.5 }));
  grower(kit, homeSolarGeo, homeSolarMat, homeSpots, false);
  const homeWinMat = kit.track(new T.MeshStandardMaterial({ color: '#141a28', emissive: GOLD, emissiveIntensity: 0.05 }));
  const homeWinGeo = new T.PlaneGeometry(0.16, 0.12);
  homeWinGeo.translate(0, 0.24, 0.252);
  grower(kit, homeWinGeo, homeWinMat, homeSpots, false);
  const bedSpots: Item[] = [
    { x: -4.75, y: GROUND, z: 4.55, s: 1, ry: 0.2 },
    { x: -5.75, y: GROUND, z: 4.75, s: 1, ry: 0.2 },
    { x: -6.75, y: GROUND, z: 4.95, s: 1, ry: 0.2 },
    { x: 6.35, y: GROUND, z: 4.7, s: 1, ry: -0.25 },
    { x: 7.35, y: GROUND, z: 4.45, s: 1, ry: -0.25 },
  ];
  const bedGeo = new T.BoxGeometry(0.8, 0.16, 0.42);
  bedGeo.translate(0, 0.08, 0);
  grower(kit, bedGeo, kit.mats.wood(), bedSpots);
  const sproutGeo = new T.ConeGeometry(0.05, 0.18, 6);
  sproutGeo.translate(0, 0.09, 0);
  const sproutItems: Item[] = [];
  for (const b of bedSpots) {
    for (let k = 0; k < 6; k++) {
      const u = -0.3 + (k % 3) * 0.3;
      const v = k < 3 ? -0.09 : 0.09;
      sproutItems.push({ x: b.x + u * Math.cos(b.ry ?? 0) + v * Math.sin(b.ry ?? 0), y: GROUND + 0.16, z: b.z - u * Math.sin(b.ry ?? 0) + v * Math.cos(b.ry ?? 0), s: 1 });
    }
  }
  const sprouts = grower(kit, sproutGeo, matte(kit, LEAF, { flat: true }), sproutItems, false);

  // ---------------- CORNERS: wind turbines ----------------
  const turbines: THREE.Group[] = [];
  const bladeGeo = new T.BoxGeometry(0.06, 0.78, 0.02);
  bladeGeo.translate(0, 0.39, 0);
  for (const [x, z, ry] of [[-7.35, -1.95, 0.45], [7.05, -0.35, -0.45]] as [number, number, number][]) {
    const tower = new T.Mesh(new T.CylinderGeometry(0.04, 0.075, 2.1, 10), kit.mats.paintedMetal('#e8eef2'));
    tower.position.set(x, GROUND + 1.05, z);
    tower.castShadow = true;
    kit.add(tower);
    const rotor = new T.Group();
    const hub = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), kit.mats.paintedMetal('#e8eef2'));
    const blades = new T.InstancedMesh(bladeGeo, kit.mats.paintedMetal('#f4f6f8'), 3);
    for (let k = 0; k < 3; k++) {
      fishDummy.position.set(0, 0, 0.02);
      fishDummy.rotation.set(0, 0, (k / 3) * TAU);
      fishDummy.scale.set(1, 1, 1);
      fishDummy.updateMatrix();
      blades.setMatrixAt(k, fishDummy.matrix);
    }
    blades.instanceMatrix.needsUpdate = true;
    rotor.add(hub, blades);
    rotor.position.set(x, GROUND + 2.12, z + 0.06);
    rotor.rotation.y = ry;
    kit.add(rotor);
    turbines.push(rotor);
  }
  const tipMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: CORAL, emissiveIntensity: 0.1 }));
  turbines.forEach((r) => {
    const m = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), tipMat);
    m.position.copy(r.position);
    m.position.y += 0.1;
    kit.add(m);
  });

  // ---------------- HEAD: marquee (seen on the fly-in) ----------------
  const marquee = kit.neonSign('FUTURE GARDEN', [0, 1.45, -7.3], { height: 0.7, color: GOLD });
  marquee.rotation.x = -0.75;

  // ---------------- the Wonderlight: rainbow, flowers, lights, fireworks ----------------
  const rainbowCols = [CORAL, GOLD, LEAF, MINT, LILAC];
  const rainbow = rainbowCols.map((c, i) => {
    const rr = 2.3 - i * 0.09;
    const pts: V3[] = Array.from({ length: 13 }, (_, k) => {
      const a = Math.PI * (k / 12);
      return [L.x - Math.cos(a) * rr, GROUND + 0.1 + Math.sin(a) * rr * 1.05, L.z - 1.0 - i * 0.02] as V3;
    });
    return kit.neonTube(pts, c, { radius: 0.03 });
  });
  const flowerCols = [CORAL, GOLD, LILAC];
  const flowerMats = flowerCols.map((c) => kit.track(new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.6 })));
  const flowerGeo = new T.SphereGeometry(0.05, 8, 6);
  const flowers = flowerCols.map((_c, i) => grower(kit, flowerGeo, flowerMats[i], [
    ...scatterItems(90 + i, kit.n(8), -8.4, -4.4, 1.2, 4.9, GROUND + 0.05, 0.8, 1.4),
    ...scatterItems(95 + i, kit.n(8), 4.3, 8.2, 1.6, 4.9, GROUND + 0.05, 0.8, 1.4),
  ], false));
  kit.pole([-4.3, 0, 4.4], 2.0);
  kit.pole([-8.6, 0, 0.9], 2.6);
  kit.pole([4.3, 0, 4.4], 2.0);
  kit.pole([8.6, 0, 0.9], 2.6);
  const lightsL = kit.stringLights([-4.3, 1.9, 4.4], [-8.6, 2.5, 0.9], 0.3, kit.n(12), [GOLD, CORAL, MINT]);
  const lightsR = kit.stringLights([4.3, 1.9, 4.4], [8.6, 2.5, 0.9], 0.3, kit.n(12), [GOLD, MINT, CORAL]);
  const pollen = kit.motes({ x0: -9.5, x1: 9.5, y0: -0.2, y1: 2.8, z0: -6, z1: 5.5 }, 110, POLLEN, { speed: 0.05, size: 0.1 });
  const fwL = kit.fireworks({ x0: -8.2, x1: -5.6, y0: 2.8, y1: 4.0, z: -3.2 }, [GOLD, CORAL, MINT, LILAC]);
  const fwR = kit.fireworks({ x0: 5.6, x1: 8.2, y0: 2.8, y1: 4.0, z: -3.2 }, [GOLD, CORAL, MINT, LILAC]);
  kit.pole([-4.25, 0, -0.9], 1.2);
  kit.pole([4.25, 0, -0.4], 1.2);
  const lanterns = [kit.lantern([-4.25, 1.36, -0.9], GOLD, 0.13), kit.lantern([4.25, 1.36, -0.4], MINT, 0.13)];
  const spotL = kit.spot([-5, 6.5, 4], [-6.0, 0, -0.6], GOLD, 26, 0.55);
  const spotR = kit.spot([5, 6.5, 4], [6.2, 0, -1.0], '#a8eaf2', 26, 0.55);
  const studioGlow = kit.point([D.x, GROUND + 0.9, D.z], MINT, 2, 4);

  // ---------------- motion ----------------
  let spin = 0.2;
  let celebrating = 0;
  const tp = new T.Vector3();
  kit.animate((t, dt) => {
    for (let i = 0; i < turbines.length; i++) turbines[i].rotation.z += dt * spin * (i ? -1 : 1);
    proto.rotation.y += dt * 0.8;
    boat.position.y = GROUND + 0.16 + Math.sin(t * 1.3) * 0.02;
    boat.rotation.z = Math.sin(t * 0.9) * 0.03;
    trackCurve.getPointAt((t * 0.18) % 1, tp);
    testBall.position.set(tp.x, tp.y + 0.07, tp.z);
    carp.position.z = 4.1 + Math.sin(t * 0.7) * 0.12;
  });

  let lastLevel = -1;
  return {
    update(t, dt, level, energy) {
      const s1 = kit.stage(level, 0.1, 1);
      const s2 = kit.stage(level, 1.1, 2);
      const s3 = kit.stage(level, 2.1, 3);
      const s4 = kit.stage(level, 3.3, 4);
      const wake = kit.stage(level, 0, 3.6);
      if (Math.abs(level - lastLevel) > 0.004) {
        lastLevel = level;
        horizon.repaint(level);
        lawnMat.color.lerpColors(lawnDusk, lawnGreen, wake);
        trunks.grow(0.7 + 0.3 * wake);
        crowns.grow(0.75 + 0.25 * wake);
        crowns2.grow(kit.stage(level, 0.4, 2.6));
        shrubs.grow(0.6 + 0.4 * wake);
        cherries.grow(kit.stage(level, 1.6, 3));
        pads.grow(kit.stage(level, 1, 2.5));
        reeds.grow(0.4 + 0.6 * kit.stage(level, 0.6, 2.2));
        sprouts.grow(0.25 + 0.75 * kit.stage(level, 0.8, 3));
        for (const f of flowers) f.grow(s4);
        for (const r of rainbow) r.visible = s4 > 0.02;
        fishLit = 0.35 + 0.65 * s2;
        smallFree = s3;
        if (kit.reducedMotion) {
          leap(fishBig, nBig, 0, true);
          leap(fishSmall, nSmall, 0, false);
        }
      }
      spin = kit.reducedMotion ? 0 : 0.25 + 2.2 * kit.stage(level, 2, 3.2) + 0.8 * s4;
      if (!kit.reducedMotion) {
        leap(fishBig, nBig, t, true);
        leap(fishSmall, nSmall, t, false);
      }
      groveSign.setLit(0.15 + 0.85 * kit.stage(level, 0, 1.4));
      studioSign.setLit(0.3 + 0.7 * s1);
      netSign.setLit(0.15 + 0.85 * s2);
      hallSign.setLit(0.2 + 0.8 * s1);
      plaqueMat.emissiveIntensity = 0.08 + 0.7 * s1;
      winMat.emissiveIntensity = 0.05 + 1.4 * kit.stage(level, 0.6, 2.6);
      panelMat.emissiveIntensity = 0.04 + 0.9 * s3;
      homeSolarMat.emissiveIntensity = 0.04 + 0.9 * s3;
      homeWinMat.emissiveIntensity = 0.05 + 1.2 * kit.stage(level, 1, 3);
      bpMat.emissiveIntensity = 0.15 + 0.45 * s1 + 0.25 * s3 + 0.15 * energy;
      netMat.emissiveIntensity = 0.05 + 0.9 * s3;
      crownMat.emissiveIntensity = 0.02 + 0.05 * s3 + 0.07 * s4;
      cherryMat.emissiveIntensity = 0.1 + 0.6 * s3;
      track.setLit(0.15 + 0.85 * kit.stage(level, 2, 3) + 0.2 * energy);
      testBall.setLit(0.3 + 0.7 * kit.stage(level, 2, 3));
      for (let i = 0; i < corals.length; i++) corals[i].setLit(0.1 + 0.9 * kit.stage(level, 0.5 + i * 0.8, 1.5 + i * 0.8));
      seaMat.emissiveIntensity = 0.1 + 0.4 * wake;
      zap.setLit(0.3 + 0.7 * s1 + (kit.reducedMotion ? 0 : 0.15 * Math.sin(t * 9)));
      bubbles.setLit(0.2 + 0.6 * s1);
      canalMat.emissiveIntensity = 0.15 + 0.3 * wake;
      fishBigMat.emissiveIntensity = 0.15 + 0.6 * s2;
      fishSmallMat.emissiveIntensity = 0.15 + 0.9 * s3;
      tipMat.emissiveIntensity = 0.1 + 1.6 * kit.stage(level, 0.5, 1.5);
      marquee.setLit(0.15 + 0.85 * kit.stage(level, 1.2, 2.4));
      for (let i = 0; i < rainbow.length; i++) rainbow[i].setLit(s4 * 0.42 + celebrating * 0.25);
      for (let i = 0; i < flowerMats.length; i++) flowerMats[i].emissiveIntensity = 0.25 + 0.6 * s4 + 1.5 * celebrating;
      lightsL.setLit(0.1 + 0.9 * kit.stage(level, 1.5, 2.6));
      lightsR.setLit(0.1 + 0.9 * kit.stage(level, 1.5, 2.6));
      pollen.setLit(0.05 + 0.6 * kit.stage(level, 1, 3.8) + 0.2 * energy);
      const fw = Math.max(kit.stage(level, 3.6, 4) * 0.8, celebrating);
      fwL.setLit(fw);
      fwR.setLit(fw);
      if (spotL) spotL.intensity = 18 + 8 * wake + 5 * s4;
      if (spotR) spotR.intensity = 18 + 8 * wake + 5 * s4;
      if (studioGlow) studioGlow.intensity = 0.5 + 1.5 * s1 + 2 * celebrating;
      for (let i = 0; i < lanterns.length; i++) lanterns[i].setLit(0.15 + 0.6 * kit.stage(level, 0.8, 2.5) + 0.25 * s4);
      celebrating = Math.max(0, celebrating - dt * 0.5);
    },
    celebrate(p) {
      celebrating = Math.sin(p * Math.PI);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const futureRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  // A miniature future garden: a lake with a net boat, a studio dome, a turbine and shade trees.
  const lakeMat = kit.track(new T.MeshStandardMaterial({ color: '#1f6a8a', emissive: WATER, emissiveIntensity: 0.1, roughness: 0.1, metalness: 0.2 }));
  const lakeDisc = new T.Mesh(new T.CircleGeometry(0.42, 28), lakeMat);
  lakeDisc.rotation.x = -Math.PI / 2;
  lakeDisc.position.set(0.42, 0.03, 0.2);
  const hull = new T.Mesh(new T.BoxGeometry(0.22, 0.06, 0.1), kit.track(new T.MeshStandardMaterial({ color: '#f2efe6' })));
  hull.position.set(0.36, 0.07, 0.18);
  const netMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', alphaMap: netTexture(kit), transparent: true, side: T.DoubleSide, emissive: GOLD, emissiveIntensity: 0.05, depthWrite: false }));
  const net = new T.Mesh(new T.PlaneGeometry(0.2, 0.14), netMat);
  net.position.set(0.5, 0.1, 0.26);
  const domeMat = kit.track(new T.MeshPhysicalMaterial({ color: '#bff5ea', transparent: true, opacity: 0.3, roughness: 0.05, emissive: MINT, emissiveIntensity: 0.05 }));
  const dome = new T.Mesh(new T.SphereGeometry(0.26, 18, 10, 0, TAU, 0, Math.PI / 2), domeMat);
  dome.position.set(-0.55, 0.02, -0.25);
  const bpMat = kit.track(new T.MeshStandardMaterial({ color: '#0a1830', emissive: '#ffffff', emissiveMap: blueprintTexture(kit), emissiveIntensity: 0.1 }));
  const bp = new T.Mesh(new T.PlaneGeometry(0.24, 0.15), bpMat);
  bp.rotation.x = -Math.PI / 2 + 0.3;
  bp.position.set(-0.55, 0.12, -0.24);
  const towerMat = kit.track(new T.MeshStandardMaterial({ color: '#e8eef2', roughness: 0.4 }));
  const tower = new T.Mesh(new T.CylinderGeometry(0.012, 0.022, 0.9, 8), towerMat);
  tower.position.set(0.75, 0.45, -0.55);
  const rotor = new T.InstancedMesh(new T.BoxGeometry(0.025, 0.26, 0.01).translate(0, 0.13, 0), towerMat, 3);
  {
    const d = new T.Object3D();
    for (let k = 0; k < 3; k++) {
      d.rotation.set(0, 0, (k / 3) * TAU);
      d.updateMatrix();
      rotor.setMatrixAt(k, d.matrix);
    }
    rotor.instanceMatrix.needsUpdate = true;
  }
  rotor.position.set(0.75, 0.9, -0.52);
  const trunks = new T.InstancedMesh(new T.CylinderGeometry(0.015, 0.025, 0.5, 6).translate(0, 0.25, 0), kit.track(new T.MeshStandardMaterial({ color: '#5a3a26' })), 3);
  const crownMat = kit.track(new T.MeshStandardMaterial({ color: CANOPY, roughness: 0.85, flatShading: true, emissive: LEAF, emissiveIntensity: 0.05 }));
  const crowns = new T.InstancedMesh(new T.SphereGeometry(0.17, 10, 6).scale(1, 0.45, 1).translate(0, 0.52, 0), crownMat, 3);
  const shrubMat = kit.track(new T.MeshStandardMaterial({ color: FERN, flatShading: true }));
  const shrubs = new T.InstancedMesh(new T.IcosahedronGeometry(0.05, 1), shrubMat, 6);
  const cherryMat = kit.track(new T.MeshStandardMaterial({ color: CHERRY, emissive: CHERRY, emissiveIntensity: 0.05 }));
  const cherries = new T.InstancedMesh(new T.SphereGeometry(0.014, 6, 4), cherryMat, 10);
  {
    const d = new T.Object3D();
    const spots: Pt[] = [[-0.85, 0.35], [-0.5, 0.55], [-0.2, 0.3]];
    spots.forEach(([x, z], i) => {
      d.position.set(x, 0, z);
      d.updateMatrix();
      trunks.setMatrixAt(i, d.matrix);
      crowns.setMatrixAt(i, d.matrix);
    });
    const r = rng(4);
    for (let i = 0; i < 6; i++) {
      d.position.set(-0.95 + r() * 0.85, 0.05, 0.2 + r() * 0.5);
      d.updateMatrix();
      shrubs.setMatrixAt(i, d.matrix);
    }
    for (let i = 0; i < 10; i++) {
      d.position.set(-0.95 + r() * 0.85, 0.08, 0.2 + r() * 0.5);
      d.updateMatrix();
      cherries.setMatrixAt(i, d.matrix);
    }
    for (const m of [trunks, crowns, shrubs, cherries]) m.instanceMatrix.needsUpdate = true;
  }
  const fishMat = kit.track(new T.MeshStandardMaterial({ color: MINT, emissive: MINT, emissiveIntensity: 0.1 }));
  const fish = new T.InstancedMesh(new T.CapsuleGeometry(0.012, 0.04, 2, 6).rotateZ(Math.PI / 2), fishMat, 4);
  fish.frustumCulled = false;
  const fd = new T.Object3D();
  for (const m of [lakeDisc, hull, net, dome, bp, tower, rotor, trunks, crowns, shrubs, cherries, fish]) kit.add(m);
  // A little solar-roofed home, wildflowers and a rainbow that appears as the room wakes.
  const home = new T.Mesh(new T.BoxGeometry(0.3, 0.2, 0.24).translate(0, 0.1, 0), kit.track(new T.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.8 })));
  home.position.set(0.05, 0, -0.6);
  const solarMat = kit.track(new T.MeshStandardMaterial({ color: '#1a2a4a', emissive: SOLAR_HI, emissiveIntensity: 0.05, roughness: 0.3, metalness: 0.4 }));
  const homeRoof = new T.Mesh(prismRoof(T, 0.17, 0.34).scale(1, 0.7, 0.85).translate(0, 0.2 + 0.06, 0), solarMat);
  homeRoof.position.copy(home.position);
  const flowerMat = kit.track(new T.MeshStandardMaterial({ color: CORAL, emissive: CORAL, emissiveIntensity: 0.05 }));
  const flowers = new T.InstancedMesh(new T.SphereGeometry(0.02, 6, 4), flowerMat, 12);
  {
    const d = new T.Object3D();
    const r = rng(15);
    for (let i = 0; i < 12; i++) {
      d.position.set(-0.3 + r() * 0.6, 0.03, 0.35 + r() * 0.45);
      d.updateMatrix();
      flowers.setMatrixAt(i, d.matrix);
    }
    flowers.instanceMatrix.needsUpdate = true;
  }
  kit.add(home);
  kit.add(homeRoof);
  kit.add(flowers);
  const rainbow = kit.neonTube(Array.from({ length: 9 }, (_, k) => {
    const a = Math.PI * (k / 8);
    return [0.42 - Math.cos(a) * 0.45, 0.04 + Math.sin(a) * 0.5, -0.05] as V3;
  }), LILAC, { radius: 0.012 });
  const sun = kit.orb([0, 1.18, -0.3], 0.08, GOLD);
  const sign = kit.neonSign('FUTURE GARDEN', [0, 1.42, -0.82], { height: 0.2, color: GOLD });
  return {
    update(t, lit) {
      lakeMat.emissiveIntensity = 0.1 + 0.5 * lit;
      netMat.emissiveIntensity = 0.05 + 0.8 * lit;
      domeMat.emissiveIntensity = 0.05 + 0.5 * lit;
      bpMat.emissiveIntensity = 0.1 + 0.9 * lit;
      crownMat.emissiveIntensity = 0.05 + 0.35 * lit;
      cherryMat.emissiveIntensity = 0.05 + 0.9 * lit;
      fishMat.emissiveIntensity = 0.1 + 1.2 * lit;
      sun.setLit(lit);
      sign.setLit(lit);
      solarMat.emissiveIntensity = 0.05 + 0.8 * lit;
      flowerMat.emissiveIntensity = 0.05 + 1.0 * lit;
      flowers.visible = lit > 0.2;
      rainbow.setLit(lit * 0.6);
      rainbow.visible = lit > 0.3;
      if (!kit.reducedMotion) rotor.rotation.z = t * (0.4 + 2 * lit);
      for (let i = 0; i < 4; i++) {
        const ph = kit.reducedMotion ? 0.5 : (t * 0.5 + i * 0.27) % 1;
        const a = i * 1.6;
        fd.position.set(0.42 + Math.cos(a) * 0.22, 0.04 + Math.sin(ph * Math.PI) * 0.12 * lit, 0.2 + Math.sin(a) * 0.2);
        fd.rotation.set(0, -a, (0.5 - ph) * 2);
        fd.scale.setScalar(Math.max(0.001, 0.3 + 0.7 * lit));
        fd.updateMatrix();
        fish.setMatrixAt(i, fd.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;
    },
  };
};

// ---------------------------------------------------------------- the attraction

const L29: TableDef = {
  lessonId: 'L29',
  signature: 'A Selective Net that spares small fish once its mesh is widened, behind a Design Fork that switches routes',
  ballRole: 'The Wonderball is a game token, not a fish: a real net sorts fish by the size of its mesh holes, and real designs are tested, measured and revised over long stretches of time.',
  theme: {
    bg: ['#163a4c', '#0b1c2a'],
    rail: '#c4e8de',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: '#FF9EAA',
    accent2: MINT,
    bumperCap: '#bfeedd',
    bumperRing: '#1f4a5a',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(113,227,207,0.16)',
    trail: MINT,
  },
  lines: {
    intro: 'Welcome to the Future Garden, the last room in the house, where we get to engineer a happier ending! Every route here tests an idea for keeping a lake town and its wild neighbors healthy.',
    quark: '"A good net catches as many fish as it possibly can. Why would anyone design a net that lets fish get away?" Professor Quark wonders aloud.',
    pipTip: 'Catch the ball on the left flipper, then flip a beat late to send it across to the Town Hall board.',
  },
  build,
  skillShot: 'carp_barrier',
  shots: [
    { id: 'grove', label: 'Shade Grove', on: [{ type: 'shot', id: 'grove_sw' }], insert: 'ins_grove' },
    { id: 'canal', label: 'Carp Canal', on: [{ type: 'spinner', id: 'carp_barrier' }], insert: 'ins_canal' },
    { id: 'ramp', label: 'Test Ramp', on: [{ type: 'ramp', id: 'test_ramp' }], insert: 'ins_ramp' },
    { id: 'fork', label: 'Design Fork', on: [{ type: 'shot', id: 'fork_sw' }], insert: 'ins_fork' },
    { id: 'portal', label: 'Forecast Portal', on: [{ type: 'portal', id: 'forecast' }] },
    { id: 'studio', label: 'Design Studio', on: [{ type: 'saucer', id: 'studio' }], insert: 'ins_studio' },
    { id: 'net', label: 'Selective Net', on: [{ type: 'drop', group: 'bigfish' }, { type: 'drop', group: 'smallfish' }, { type: 'target', id: ['fish_1', 'fish_3', 'fish_5'] }], insert: 'ins_net' },
    { id: 'snails', label: 'Snail Shallows', on: [{ type: 'bumper', group: 'snails' }], insert: 'ins_snails' },
    { id: 'board', label: 'Problem Board', on: [{ type: 'target', group: 'problems' }], insert: 'ins_board' },
    { id: 'define', label: 'Criteria and limits', on: [{ type: 'target', group: 'define' }] },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Name the Problem',
      brief: 'Engineers start by naming the problem. Survey six big ways people disrupt ecosystems, then set the criteria and limits a good design must meet.',
      objectiveIds: ['L29-O2', 'L29-O4'],
      stages: [
        { kind: 'collect', text: 'Name all 6 problems on the Town Hall board', match: { type: 'gate', group: 'survey' }, count: 6, distinct: true, lamps: ['sign_1', 'sign_2', 'sign_3', 'sign_4', 'sign_5', 'sign_6'], preview: ['board'] },
        { kind: 'collect', text: 'Define the design: hit CRITERIA and LIMITS', match: { type: 'target', group: 'define' }, count: 2, distinct: true, lamps: ['criteria', 'constraints'] },
        { kind: 'discover', text: 'Pin the design brief in the Design Studio', pocket: 'studio', questions: 1, types: ['match', 'classify', 'single'] },
      ],
      discovery: 'Over-exploitation, pollution, emerging disease, habitat damage, invasive species and climate change all disrupt ecosystems. Criteria say what success means; constraints are limits like cost.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Ripple Chain',
      brief: 'As a lake town grew, more people fished, and small-hole nets took little fish too. Haul in the old net, then follow the ripple to snails and people.',
      objectiveIds: ['L29-O3', 'L29-O1'],
      stages: [
        { kind: 'collect', text: 'Old fine net: catch 4 fish, small ones too', match: { type: 'drop', id: ['fish_1', 'fish_2', 'fish_3', 'fish_4', 'fish_5'] }, count: 4, distinct: true, lamps: ['fish_1', 'fish_2', 'fish_3', 'fish_4', 'fish_5'], preview: ['net'] },
        { kind: 'collect', text: 'Fewer snail-eaters, more snails: 5 snail hits', match: { type: 'bumper', group: 'snails' }, count: 5, preview: ['snails'] },
        { kind: 'discover', text: 'Trace the chain in the Design Studio', pocket: 'studio', questions: 1, types: ['order', 'single'] },
      ],
      discovery: 'Heavy fishing also removed the small fish that eat snails. With fewer snail-eaters, snails multiplied, and they can carry the parasitic worms that cause bilharzia. A fishing change came back to people.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Test and Revise',
      brief: 'Prototype a better net. Compare a field test with a computer model, then try a wider mesh and weigh what it gains and what it costs.',
      objectiveIds: ['L29-O4', 'L29-O5'],
      stages: [
        { kind: 'shots', text: 'Compare: ride the Test Ramp, run the MODEL route', shots: ['ramp', 'fork'], order: 'any' },
        { kind: 'collect', text: 'Wider mesh: catch both BIG fish, spare the small', match: { type: 'drop', group: 'bigfish' }, count: 2, distinct: true, lamps: ['fish_2', 'fish_4'], preview: ['net'] },
        { kind: 'discover', text: 'Weigh the evidence in the Design Studio', pocket: 'studio', questions: 1, types: ['single', 'classify'] },
      ],
      discovery: 'Nets with bigger holes still catch large fish but let small snail-eaters slip through. Families give up the small-fish catch, a tradeoff. Engineers test, compare evidence, revise and keep monitoring.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'The Future Garden',
    brief: 'Bring the whole town to life: light its routes, run one last prototype test, then present the final design in the Studio.',
    stages: [
      { kind: 'shots', text: 'Wake the garden: light 4 of its 6 routes', shots: ['grove', 'ramp', 'canal', 'fork', 'net', 'board'], order: 'any', count: 4 },
      { kind: 'shots', text: 'Final prototype: Test Ramp, then the MODEL route', shots: ['ramp', 'fork'], order: 'sequence' },
      { kind: 'discover', text: 'Present the final design in the Design Studio', pocket: 'studio', questions: 2 },
    ],
    celebration: 'Shade trees, wider nets, a guarded canal and plans that keep being tested: a future garden engineered one revision at a time. The Wonderlight is yours!',
  },
  onProgress(rt, { slot, stage: st }) {
    // The Design Fork's blade follows the design process: the STUDIO route whenever a discovery
    // waits there, the MODEL route for the comparison and final test, both in turn for the finale.
    const keeper = rt.get<ForkKeeper>('fork_keeper');
    let mode: ForkKeeper['mode'] = 'studio';
    if (st === 2) mode = 'studio';
    else if (slot === 2 && st === 0) mode = 'model';
    else if (slot === 3 && st === 0) mode = 'alternate';
    else if (slot === 3 && st === 1) mode = 'model';
    keeper.mode = mode;
    // The revised wide mesh is in from the Test and Revise mission on (and for the finale).
    rt.get<SelectiveNet>('net').setWide(slot >= 2);
  },
  set: futureSet,
  room: futureRoom,
  icons: {
    snail(ctx, s) {
      // A snail shell spiral with its foot.
      ctx.beginPath();
      ctx.ellipse(s * 0.1, s * 0.62, s * 0.92, s * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = s * 0.16;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const a = (i / 30) * TAU * 1.75;
        const r = s * 0.62 * (1 - i / 34);
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r - s * 0.1);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - s * 0.1);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.5);
      ctx.lineTo(-s * 0.95, s * 0.1);
      ctx.lineWidth = s * 0.08;
      ctx.stroke();
    },
    blueprint(ctx, s) {
      ctx.lineWidth = s * 0.1;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.strokeRect(-s * 0.8, -s * 0.6, s * 1.6, s * 1.2);
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(k * s * 0.4, -s * 0.6);
        ctx.lineTo(k * s * 0.4, s * 0.6);
        ctx.moveTo(-s * 0.8, k * s * 0.3);
        ctx.lineTo(s * 0.8, k * s * 0.3);
      }
      ctx.stroke();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintGarden(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      if (reduced) return;
      // Sun glints on the lake, pollen over the garden, and a pulse along the barrier.
      const w = 0.3 + 0.4 * stage(level, 0, 3);
      for (let i = 0; i < 7; i++) {
        const x = 110 + ((t * 9 + i * 61) % 380);
        const y = 140 + ((i * 47) % 200) + Math.sin(t * 0.8 + i) * 6;
        glowDot(ctx, x, y, 4, WATER_HI, w * (0.4 + 0.3 * Math.sin(t * 2 + i)));
      }
      const p = stage(level, 1.5, 4);
      if (p > 0.01) drift(ctx, 21, 18, t * 0.6, POLLEN, [40, 640, 540, 1000], 6, 1.8, (0.25 + 0.25 * energy) * p);
      const z = (t * 1.6) % 1;
      glowDot(ctx, 503 + z * 40, 560, 6, MINT, 0.4 * stage(level, 0, 1.5));
    },
    celebrate({ ctx, t, reduced }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.45;
      const g = ctx.createRadialGradient(STUDIO[0], STUDIO[1], 10, STUDIO[0], STUDIO[1], 460);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // Reduced motion: a calm glow only, no bursting rings or swimming fish.
      if (reduced) return;
      const cols = [CORAL, GOLD, MINT, LILAC, LEAF];
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU + t * 0.3;
        const d = 50 + p * 300;
        glowDot(ctx, STUDIO[0] + Math.cos(a) * d, STUDIO[1] + Math.sin(a) * d * 0.85, 9, cols[i % cols.length], 1 - p);
      }
      for (let i = 0; i < 5; i++) fishShape(ctx, STUDIO[0] + Math.cos(i * 1.3 + t) * (40 + p * 160), STUDIO[1] - 60 - p * 120 + i * 18, 16, i * 1.3 + t + Math.PI / 2, i % 2 ? GOLD : MINT, 1 - p);
    },
  },
};
export default L29;
