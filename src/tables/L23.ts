// Lesson 23 — The Motion of Particles — "Particle Dance Party"
// A twilight dance hall with three state rooms. Up top, four pop bumpers are packed into the
// SOLID CRYSTAL, so the Wonderball rattles in place against them; on the right the hairpin
// FLOW RAMP pours down to the right inlane like a liquid; on the left the GAS HALL fires the
// ball between two fast slings and up the Gas Loop, past the kPa pads of the Pressure Wall.
// In the middle, the DANCE FLOOR spinner is the hall's thermostat: every pass warms the light-up
// floor tiles, the Crystal bumpers and Gas Hall slings kick harder as it heats, and the particles
// in the 3D model tanks speed up with it. The particles never grow: every model in the hall uses
// the same particle size.

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Spinner, type Bumper, type Insert, type Slingshot } from '../game/table/mechanisms.ts';
import type { Ball } from '../game/physics/ball.ts';
import type { Collider } from '../game/physics/types.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { TAU, glowDot, mix, neonPath, neonText, rgba, rng, rrect, stage, vgrad } from '../game/render/art.ts';

type P2 = [number, number];
type V3 = [number, number, number];

// ---------------------------------------------------------------- palette

const GOLD = '#FFC75B';
const CORAL = '#FF7F86'; // gas: hot and fast
const AQUA = '#4FC3F7'; // liquid
const ICE = '#A9D8FF'; // solid
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const PLUM = '#291B46';
const INK = '#120a26';
/** Dance-floor tile colours, cool to hot (the floor is the hall's thermometer). */
const HEAT = ['#8FB8FF', '#7FD8F0', '#71E3CF', '#FFC75B', '#FFA070', '#FF7F86'];

// ---------------------------------------------------------------- shared geometry

const FLOW_PATH: P2[] = [[420, 612], [422, 530], [430, 450], [446, 372], [466, 316], [492, 290], [516, 298], [524, 350], [522, 440], [520, 540], [514, 640], [502, 740], [489, 806]];
const CRYSTAL: P2[] = [[300, 190], [272, 238], [328, 238], [300, 286]];
const CRYSTAL_C: P2 = [300, 238];
const POCKET: P2 = [214, 572];
const FLOOR_C: P2 = [300, 462];
/** Light-up dance-floor tiles (inserts): bottom row cool, top row hot. */
const TILES: P2[] = [[278, 478], [300, 478], [322, 478], [278, 452], [300, 452], [322, 452]];
/** Water's boiling line for the printed state map: [°C, kPa] (approximate measured values). */
const BOIL_LINE: P2[] = [[81, 50], [86, 60], [93.5, 80], [100, 101], [105, 120], [111, 150], [120, 200]];

// ---------------------------------------------------------------- the Dance Floor (signature)

/** Hall temperature 0..1, read by the 2D ambient glow and the 3D model tanks (the kicks use the floor's own heat). */
const hall = { heat: 0 };

/** Crystal bumper and Gas Hall sling kicks, cool floor -> hot floor. */
const CRYSTAL_KICK: P2 = [980, 1260];
const GAS_KICK: P2 = [1040, 1340];

/**
 * The Dance Floor spinner is the hall's thermostat. Each pass adds heat (more for a faster
 * pass); heat slowly leaks away. Six floor tiles light cool-to-hot as the floor warms, and the
 * hall really does speed up: the Crystal bumpers vibrate the ball harder and the Gas Hall slings
 * fire it faster, while the 3D model tanks speed their particles up. Hotter means faster, never
 * bigger.
 */
class DanceFloor extends Spinner {
  heat = 0;
  tiles: Insert[] = [];
  crystal: Bumper[] = [];
  gasSlings: Slingshot[] = [];
  onSensorEnter(_c: Collider, ball: Ball) {
    if (!this.ready(ball, 0.25)) return;
    const spins = Math.max(1, Math.min(24, Math.round(Math.hypot(ball.vx, ball.vy) / 140)));
    this.rate = spins * 6;
    this.heat = Math.min(TILES.length, this.heat + 1 + spins * 0.08);
    this.rt.emit({ type: 'spinner', id: this.id, group: this.group, ball, value: spins, x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2 });
  }
  update(dt: number) {
    super.update(dt);
    this.heat = Math.max(0, this.heat - dt * 0.09);
    const h = this.heat / TILES.length;
    hall.heat = h;
    for (let i = 0; i < this.tiles.length; i++) {
      this.tiles[i].lamp = this.heat >= i + 1 ? 'on' : this.heat >= i + 0.35 ? 'pulse' : 'off';
    }
    for (let i = 0; i < this.crystal.length; i++) this.crystal[i].kick = CRYSTAL_KICK[0] + (CRYSTAL_KICK[1] - CRYSTAL_KICK[0]) * h;
    for (let i = 0; i < this.gasSlings.length; i++) this.gasSlings[i].kick = GAS_KICK[0] + (GAS_KICK[1] - GAS_KICK[0]) * h;
  }
  reset() {
    super.reset();
    this.heat = 0;
    hall.heat = 0;
  }
}

// ---------------------------------------------------------------- playfield geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- GAS HALL (left): the Gas Loop orbit, two fast slings and the Pressure Wall ---
  b.wall([[80, 640], [80, 452]], { id: 'gas_loop_inner', r: 3 });
  b.post(80, 640, 5);
  // Fast slings: they kick harder than the standard pair, and harder still when the floor is hot.
  const gasSlings = [
    b.sling('gas_sling', [82, 344], [82, 448], [122, 448], { kick: GAS_KICK[0] }),
    b.sling('gas_sling_r', [208, 344], [208, 448], [168, 448], { kick: GAS_KICK[0] }),
  ];
  b.shotSwitch('gas_loop_sw', 52, 520, -90);
  b.shotSwitch('gas_hall_sw', 145, 466, -90, { r: 21 });
  // A one-way flap: Gas Loop balls coming down are turned into play, kickback saves pass up.
  b.gate('gas_loop_flap', [FRAME.left, 646], [54, 694], -90);
  b.target('pad_1', [87, 470], [87, 506], { group: 'pressure', label: 'kPa' });
  b.target('pad_2', [87, 520], [87, 556], { group: 'pressure', label: 'kPa' });
  b.target('pad_3', [87, 570], [87, 606], { group: 'pressure', label: 'kPa' });

  // --- SOLID CRYSTAL (top centre): four pop bumpers packed too tightly to pass between ---
  const crystal = CRYSTAL.map(([x, y], i) => b.bumper(`crystal_${i + 1}`, x, y, { r: 21, group: 'solid', icon: 'lattice', kick: CRYSTAL_KICK[0] }));

  // --- DANCE FLOOR: the thermostat spinner between two posts, with its light-up tiles ---
  b.post(262, 420, 5);
  b.post(338, 420, 5);
  const floor = b.rt.add(new DanceFloor(b.rt, 'dance_floor', 268, 420, 332, 420, { label: 'DANCE FLOOR' }));
  floor.tiles = TILES.map(([x, y], i) => b.insert(`tile_${i + 1}`, x, y, { shape: 'circle', size: 8, color: HEAT[i] }));
  floor.crystal = crystal;
  floor.gasSlings = gasSlings;

  // --- MODEL WINDOW (Wonder Pocket) in a protective frame ---
  const [px, py] = POCKET;
  b.wall([[px - 28, py + 26], [px - 28, py - 20], [px, py - 34], [px + 28, py - 20], [px + 28, py + 26]], { id: 'window_cup', r: 4 });
  b.saucer('model_window', px, py, { role: 'pocket', ejectDeg: 96, ejectSpeed: 740, captureMaxSpeed: 2400, label: 'MODEL WINDOW', icon: 'window' });

  // --- LIQUID: the Flow Ramp, a hairpin that pours down to the right inlane ---
  b.wall([[392, 680], [404, 616]], { id: 'flow_flare_l', r: 3 });
  b.wall([[452, 676], [438, 616]], { id: 'flow_flare_r', r: 3 });
  // No mechanism label: the 2D view would print it inside the mouth; FLOW RAMP is printed in the art.
  b.ramp('flow_ramp', { path: FLOW_PATH, width: 36, footprintTo: 3, peak: 80 });

  // --- Right side: soft plunges drop over WARM UP; a long deflector keeps them out of the outlane ---
  b.rollover('warm_up', 492, 420, { r: 17, label: 'WARM UP', group: 'skill' });
  b.wall([[FRAME.laneSep, 646], [492, 726]], { id: 'right_deflect', r: 3 });

  // --- Inserts (one per shot) ---
  b.insert('ins_gas', 145, 512, { deg: -90, label: 'GAS', color: CORAL });
  b.insert('ins_pads', 116, 590, { deg: 180, color: MINT });
  b.insert('ins_pocket', px, py + 84, { deg: -90, color: GOLD });
  b.insert('ins_dance', 300, 506, { deg: -90, color: GOLD });
  b.insert('ins_flow', 422, 708, { deg: -90, color: AQUA });
  b.insert('ins_crystal', 300, 332, { shape: 'star', size: 12, color: ICE });
}

// ================================================================ printed playfield art

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1, rot = 0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, size * 0.3);
  ctx.strokeStyle = `rgba(10,6,24,${0.85 * alpha})`;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** One printed particle: a shaded sphere. Every particle in the hall has the same radius. */
function particle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, rgba(mix(color, '#ffffff', 0.65), alpha));
  g.addColorStop(0.6, rgba(color, alpha));
  g.addColorStop(1, rgba(mix(color, '#000000', 0.45), alpha));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** The playfield outline (walls and arch), for clipping printed rooms. */
function fieldPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(24, 1150);
  ctx.lineTo(24, 300);
  ctx.arc(310, 300, 286, Math.PI, TAU);
  ctx.lineTo(596, 1150);
  ctx.closePath();
}

function smoothLine(ctx: CanvasRenderingContext2D, pts: P2[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

/** Arc-length sampled Flow Ramp centreline, for printing and ambient sliders. */
const FLOW_SAMPLES: P2[] = (() => {
  const out: P2[] = [];
  for (let i = 0; i < FLOW_PATH.length - 1; i++) {
    const p0 = FLOW_PATH[Math.max(0, i - 1)];
    const p1 = FLOW_PATH[i];
    const p2 = FLOW_PATH[i + 1];
    const p3 = FLOW_PATH[Math.min(FLOW_PATH.length - 1, i + 2)];
    for (let s = 0; s < 8; s++) {
      const t = s / 8;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(FLOW_PATH[FLOW_PATH.length - 1]);
  return out;
})();
const FLOW_LEN: number[] = (() => {
  const acc = [0];
  for (let i = 1; i < FLOW_SAMPLES.length; i++) acc.push(acc[i - 1] + Math.hypot(FLOW_SAMPLES[i][0] - FLOW_SAMPLES[i - 1][0], FLOW_SAMPLES[i][1] - FLOW_SAMPLES[i - 1][1]));
  return acc;
})();

/** Point and unit normal at arc-length fraction u (0..1) of the Flow Ramp. */
function flowAt(u: number): [number, number, number, number] {
  const total = FLOW_LEN[FLOW_LEN.length - 1];
  const d = Math.max(0, Math.min(total, u * total));
  let i = 1;
  while (i < FLOW_LEN.length - 1 && FLOW_LEN[i] < d) i++;
  const a = FLOW_SAMPLES[i - 1];
  const b = FLOW_SAMPLES[i];
  const seg = FLOW_LEN[i] - FLOW_LEN[i - 1] || 1;
  const k = (d - FLOW_LEN[i - 1]) / seg;
  const tx = (b[0] - a[0]) / seg;
  const ty = (b[1] - a[1]) / seg;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, -ty, tx];
}

/** Triangle-wave bounce of v between lo and hi (straight-line motion off two walls). */
function bounce(v: number, lo: number, hi: number) {
  const L = hi - lo;
  let m = (v - lo) % (2 * L);
  if (m < 0) m += 2 * L;
  return lo + (m < L ? m : 2 * L - m);
}

/** Small printed model window: a framed circle holding particles in one state (same size). */
function stateBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, kind: 'solid' | 'liquid' | 'gas', color: string, lit: number) {
  const R = 22;
  ctx.save();
  ctx.fillStyle = rgba(INK, 0.75);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, R - 1, 0, TAU);
  ctx.clip();
  const pr = 4;
  const a = 0.45 + 0.55 * lit;
  if (kind === 'solid') {
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) particle(ctx, cx + i * 8.4, cy + j * 8.4, pr, color, a);
  } else if (kind === 'liquid') {
    const pts: P2[] = [[-14, 12], [-6, 13], [2, 12], [10, 13], [17, 9], [-17, 5], [-10, 5], [-2, 4], [6, 5], [14, 2], [-12, -3], [-4, -4], [4, -3]];
    for (const [x, y] of pts) particle(ctx, cx + x, cy + y, pr, color, a);
  } else {
    const pts: [number, number, number][] = [[-12, -8, 0.6], [9, -11, 2.4], [-4, 10, 4.1], [13, 7, 5.3]];
    for (const [x, y, ang] of pts) {
      ctx.strokeStyle = rgba(color, 0.45 * a);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + x, cy + y);
      ctx.lineTo(cx + x - Math.cos(ang) * 11, cy + y - Math.sin(ang) * 11);
      ctx.stroke();
      particle(ctx, cx + x, cy + y, pr, color, a);
    }
  }
  ctx.restore();
  ctx.strokeStyle = rgba(GOLD, 0.35 + 0.5 * lit);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
}

function paintBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1); // rooms named (mission 1)
  const s2 = stage(level, 1.2, 2); // heat + pressure (mission 2)
  const s3 = stage(level, 2.2, 3); // state map (mission 3)
  const s4 = stage(level, 3.3, 4); // Wonderlight

  // Velvet dance hall.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#170e33'], [0.3, '#22164a'], [0.62, '#1f1546'], [1, '#110a26']]);
  ctx.fillRect(0, 0, 600, 1150);

  ctx.save();
  fieldPath(ctx);
  ctx.clip();

  // Ballroom floor: a diamond parquet in the lower hall.
  for (let y = 600, row = 0; y < 1170; y += 18, row++) {
    for (let x = row % 2 ? 18 : 0; x < 620; x += 36) {
      ctx.fillStyle = (row + Math.round(x / 36)) % 2 ? 'rgba(58,38,100,0.22)' : 'rgba(26,16,56,0.22)';
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x + 18, y);
      ctx.lineTo(x, y + 18);
      ctx.lineTo(x - 18, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Art-deco sunburst from the dance floor.
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI + (i + 0.5) * (Math.PI / 18);
    ctx.strokeStyle = rgba(GOLD, 0.035 + 0.05 * s2);
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(FLOOR_C[0] + Math.cos(a) * 70, FLOOR_C[1] + Math.sin(a) * 70);
    ctx.lineTo(FLOOR_C[0] + Math.cos(a) * 420, FLOOR_C[1] + Math.sin(a) * 420);
    ctx.stroke();
  }
  ctx.restore();

  // ---- GAS HALL (left): far apart, fast, free ----
  ctx.save();
  const gasGlow = ctx.createRadialGradient(140, 420, 20, 140, 420, 300);
  gasGlow.addColorStop(0, rgba(CORAL, 0.1 + 0.16 * s1));
  gasGlow.addColorStop(1, rgba(CORAL, 0));
  ctx.fillStyle = gasGlow;
  ctx.fillRect(24, 100, 260, 560);
  // Container outline (glass wall of the gas room).
  ctx.strokeStyle = rgba(CORAL, 0.25 + 0.4 * s1);
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.moveTo(232, 640);
  ctx.lineTo(232, 330);
  ctx.quadraticCurveTo(232, 214, 150, 160);
  ctx.stroke();
  ctx.setLineDash([]);
  const rg = rng(23);
  const gasPts: P2[] = [[126, 196], [196, 250], [104, 300], [166, 316], [222, 190], [58, 380], [150, 520], [116, 640], [196, 650], [230, 470]];
  gasPts.forEach(([x, y], i) => {
    const ang = rg() * TAU;
    const len = 26 + rg() * 26;
    ctx.strokeStyle = rgba(CORAL, 0.18 + 0.3 * s1);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
    ctx.stroke();
    ctx.setLineDash([]);
    particle(ctx, x, y, 6, i % 3 ? CORAL : '#ffa3a8', 0.5 + 0.45 * s1);
  });
  ctx.restore();
  label(ctx, 'GAS HALL', 150, 238, 17, CORAL, 0.55 + 0.45 * s1);
  label(ctx, 'far apart · on their own', 150, 258, 10, IVORY, 0.45 + 0.4 * s1);
  label(ctx, 'PRESSURE WALL', 106, 538, 10, MINT, 0.5 + 0.5 * s2, -Math.PI / 2);

  // ---- SOLID CRYSTAL (top centre): packed, vibrating in place ----
  ctx.save();
  const [ccx, ccy] = CRYSTAL_C;
  ctx.beginPath();
  ctx.moveTo(ccx, ccy - 96);
  ctx.lineTo(ccx + 92, ccy);
  ctx.lineTo(ccx, ccy + 96);
  ctx.lineTo(ccx - 92, ccy);
  ctx.closePath();
  ctx.fillStyle = rgba(ICE, 0.06 + 0.12 * s1);
  ctx.fill();
  ctx.strokeStyle = rgba(ICE, 0.3 + 0.5 * s1);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  for (let gy = -96; gy <= 96; gy += 13) {
    for (let gx = -96; gx <= 96; gx += 13) particle(ctx, ccx + gx, ccy + gy, 5.6, ICE, 0.35 + 0.45 * s1);
  }
  ctx.restore();
  // Vibration marks around a few lattice particles at the crystal's edge.
  ctx.save();
  ctx.strokeStyle = rgba(ICE, 0.3 + 0.5 * s1);
  ctx.lineWidth = 1.5;
  for (const [x, y] of [[ccx - 62, ccy - 20], [ccx + 62, ccy + 20], [ccx - 22, ccy + 70], [ccx + 22, ccy - 70]] as P2[]) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x, y, 9, side > 0 ? -0.6 : Math.PI - 0.6, side > 0 ? 0.6 : Math.PI + 0.6);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Kept well above the crystal: the 3D bumper caps hide anything printed just over them.
  label(ctx, 'SOLID CRYSTAL', ccx, 108, 15, ICE, 0.55 + 0.45 * s1);
  label(ctx, 'packed · vibrating in place', ccx, 125, 10, IVORY, 0.45 + 0.4 * s1);

  // ---- LIQUID (right): close, touching, sliding past one another ----
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  smoothLine(ctx, FLOW_PATH);
  ctx.strokeStyle = rgba(AQUA, 0.08 + 0.12 * s1);
  ctx.lineWidth = 46;
  ctx.stroke();
  smoothLine(ctx, FLOW_PATH);
  ctx.strokeStyle = rgba(AQUA, 0.22 + 0.35 * s1);
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 10]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let k = 0; k < 64; k++) {
    const [x, y, nx, ny] = flowAt((k + 0.5) / 64);
    const off = (k % 2 ? 1 : -1) * 6.5;
    particle(ctx, x + nx * off, y + ny * off, 6, k % 3 ? AQUA : '#8fdcff', 0.3 + 0.4 * s1);
  }
  ctx.restore();
  label(ctx, 'LIQUID', 484, 540, 13, AQUA, 0.55 + 0.45 * s1, -Math.PI / 2);
  // Left of the ramp's return leg (x ≈ 480+ here) so the 3D ramp never covers the words.
  label(ctx, 'FLOW RAMP', 416, 742, 14, AQUA, 0.6 + 0.4 * s1);
  label(ctx, 'touching · sliding past', 408, 759, 10, IVORY, 0.45 + 0.4 * s1);
  // Warm Up lane: rising heat ripples.
  ctx.save();
  ctx.strokeStyle = rgba(CORAL, 0.25 + 0.35 * s1);
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const x = 470 + i * 14;
    ctx.beginPath();
    for (let y = 480; y >= 448; y -= 4) ctx.lineTo(x + Math.sin(y * 0.35) * 3, y);
    ctx.stroke();
  }
  ctx.restore();

  // ---- DANCE FLOOR (centre): the thermostat ----
  ctx.save();
  const [fx, fy] = FLOOR_C;
  const R = 56;
  const floorGlow = ctx.createRadialGradient(fx, fy, 10, fx, fy, R + 40);
  floorGlow.addColorStop(0, rgba(GOLD, 0.12 + 0.2 * s2));
  floorGlow.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = floorGlow;
  ctx.beginPath();
  ctx.arc(fx, fy, R + 40, 0, TAU);
  ctx.fill();
  for (let ring = 0; ring < 3; ring++) {
    const r0 = 16 + ring * 14;
    const n = 8 + ring * 6;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU;
      const a1 = ((i + 1) / n) * TAU;
      ctx.fillStyle = (i + ring) % 2 ? rgba(PLUM, 0.85) : rgba(HEAT[(i + ring * 2) % HEAT.length], 0.12 + 0.3 * s2);
      ctx.beginPath();
      ctx.arc(fx, fy, r0 + 13, a0, a1);
      ctx.arc(fx, fy, r0, a1, a0, true);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = rgba(GOLD, 0.25 + 0.4 * s2);
  ctx.beginPath();
  ctx.arc(fx, fy, 14, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.45 + 0.45 * s2);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(fx, fy, R, 0, TAU);
  ctx.stroke();
  ctx.restore();
  label(ctx, 'DANCE FLOOR', fx, 532, 13, GOLD, 0.6 + 0.4 * s2);
  label(ctx, 'hotter = faster', fx, 548, 10, IVORY, 0.5 + 0.45 * s2);

  // ---- MODEL WINDOW frame behind the Wonder Pocket ----
  ctx.save();
  const [px, py] = POCKET;
  rrect(ctx, px - 38, py - 58, 76, 90, 10);
  ctx.fillStyle = rgba('#0c1430', 0.75);
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.45 + 0.4 * s1);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = rgba(GOLD, 0.2 + 0.25 * s1);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py - 58);
  ctx.lineTo(px, py - 34);
  ctx.moveTo(px - 38, py - 30);
  ctx.lineTo(px + 38, py - 30);
  ctx.stroke();
  particle(ctx, px - 22, py - 44, 5, ICE, 0.7);
  particle(ctx, px + 18, py - 46, 5, AQUA, 0.7);
  particle(ctx, px + 33, py + 12, 4.5, CORAL, 0.7);
  // Dark plate under the 3D floor label (drawn 45 units below the pocket), readable at every level.
  rrect(ctx, px - 52, py + 36, 104, 19, 9);
  ctx.fillStyle = rgba(INK, 0.88);
  ctx.fill();
  ctx.restore();

  // ---- Same particles, same size: three little model windows above the slings ----
  const badgeLit = stage(level, 0.6, 1.4);
  stateBadge(ctx, 222, 784, 'solid', ICE, badgeLit);
  stateBadge(ctx, 300, 784, 'liquid', AQUA, badgeLit);
  stateBadge(ctx, 378, 784, 'gas', CORAL, badgeLit);
  label(ctx, 'SOLID', 222, 816, 9, ICE, 0.6 + 0.4 * badgeLit);
  label(ctx, 'LIQUID', 300, 816, 9, AQUA, 0.6 + 0.4 * badgeLit);
  label(ctx, 'GAS', 378, 816, 9, CORAL, 0.6 + 0.4 * badgeLit);
  label(ctx, 'same particles · same size', 300, 836, 10, GOLD, 0.55 + 0.45 * badgeLit);

  // ---- STATE MAP (mission 3): water's state diagram, temperature across, pressure up ----
  // Axes: −100…200°C across, 50…200 kPa up. The melting line sits at 0°C; the boiling line
  // follows water's measured boiling points (81°C at 50 kPa … 120°C at 200 kPa).
  ctx.save();
  const mx0 = 106;
  const my0 = 668;
  const mw = 92;
  const mh = 84;
  const mapX = (tC: number) => mx0 + ((tC + 100) / 300) * mw;
  const mapY = (kPa: number) => my0 + (mh * (200 - kPa)) / 150;
  rrect(ctx, mx0 - 20, my0 - 22, mw + 28, mh + 40, 8);
  ctx.fillStyle = rgba(INK, 0.55 + 0.2 * s3);
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.5 * s3);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const meltX = mapX(0);
  ctx.fillStyle = rgba(ICE, 0.1 + 0.25 * s3);
  ctx.fillRect(mx0, my0, meltX - mx0, mh);
  const boil = BOIL_LINE;
  ctx.fillStyle = rgba(AQUA, 0.1 + 0.25 * s3);
  ctx.beginPath();
  ctx.moveTo(meltX, my0 + mh);
  for (const [tC, kPa] of boil) ctx.lineTo(mapX(tC), mapY(kPa));
  ctx.lineTo(meltX, my0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(CORAL, 0.1 + 0.25 * s3);
  ctx.beginPath();
  ctx.moveTo(mx0 + mw, my0 + mh);
  for (const [tC, kPa] of boil) ctx.lineTo(mapX(tC), mapY(kPa));
  ctx.lineTo(mx0 + mw, my0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(IVORY, 0.3 + 0.4 * s3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(meltX, my0);
  ctx.lineTo(meltX, my0 + mh);
  for (let i = 0; i < boil.length; i++) ctx[i ? 'lineTo' : 'moveTo'](mapX(boil[i][0]), mapY(boil[i][1]));
  ctx.stroke();
  ctx.strokeStyle = rgba(IVORY, 0.45 + 0.4 * s3);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mx0, my0 - 4);
  ctx.lineTo(mx0, my0 + mh);
  ctx.lineTo(mx0 + mw + 4, my0 + mh);
  ctx.stroke();
  ctx.restore();
  label(ctx, 'WATER STATE MAP', mx0 + mw / 2 - 4, my0 - 12, 9, GOLD, 0.5 + 0.5 * s3);
  label(ctx, 'S', mx0 + 15, my0 + 40, 11, ICE, 0.5 + 0.5 * s3);
  label(ctx, 'L', mx0 + 45, my0 + 40, 11, AQUA, 0.5 + 0.5 * s3);
  label(ctx, 'G', mx0 + 80, my0 + 52, 11, CORAL, 0.5 + 0.5 * s3);
  label(ctx, 'temperature →', mx0 + mw / 2, my0 + mh + 10, 8, IVORY, 0.45 + 0.45 * s3);
  label(ctx, 'pressure →', mx0 - 10, my0 + mh / 2, 8, IVORY, 0.45 + 0.45 * s3, -Math.PI / 2);

  // Marquee under the arch: dim until the Wonderlight.
  neonText(ctx, 'PARTICLE DANCE PARTY', 302, 84, 18, GOLD, 0.15 + 0.85 * s4);
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.arc(310, 300, 262, Math.PI * 1.17, Math.PI * 1.83);
  }, MINT, 0.1 + 0.9 * s3, 3);

  // Wonderlight: the hall glows gold and the floor sparkles.
  if (s4 > 0.01) {
    ctx.fillStyle = rgba(GOLD, 0.07 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    const rs = rng(77);
    for (let i = 0; i < 40; i++) glowDot(ctx, 40 + rs() * 520, 80 + rs() * 1000, 8, [GOLD, MINT, CORAL, ICE][i % 4], 0.35 * s4);
  }
  // A dormant hall is dimmer (it is waiting to wake up).
  if (level < 1) {
    ctx.fillStyle = `rgba(8,4,20,${0.22 * (1 - stage(level, 0, 1))})`;
    ctx.fillRect(0, 0, 600, 1150);
  }
  ctx.restore();
}

// ================================================================ 3D attraction set

/** Particle radius in every 3D model: the same particles in every state. */
const PR = 0.07;

interface Tank {
  group: THREE.Group;
  setLit(v: number): void;
  step(dt: number, speed: number): void;
}

/**
 * A glass model tank on a plinth whose particles show one state of matter.
 * solid: a packed lattice that only vibrates in place; liquid: a crowd at the bottom whose
 * rings swirl at different speeds, so neighbours slide past one another; gas: a few particles
 * zooming in straight lines and bouncing off the walls. `speed` is the hall temperature.
 */
function modelTank(kit: SetKit, pos: V3, rotY: number, size: V3, kind: 'solid' | 'liquid' | 'gas', color: string, text: string): Tank {
  const T = kit.THREE;
  const [W, H, D] = size;
  const g = new T.Group();
  g.position.set(pos[0], kit.regions.groundY, pos[2]);
  g.rotation.y = rotY;
  kit.add(g);
  const base = 0.34;
  const plinth = new T.Mesh(new T.BoxGeometry(W + 0.26, base, D + 0.26), kit.mats.plastic('#1d1433'));
  plinth.position.y = base / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  const bandMat = kit.track(new T.MeshStandardMaterial({ color: '#0e0a18', emissive: color, emissiveIntensity: 0.05, roughness: 0.4 }));
  const band = new T.Mesh(new T.BoxGeometry(W + 0.28, 0.05, D + 0.28), bandMat);
  band.position.y = base - 0.03;
  const floorMat = kit.track(new T.MeshStandardMaterial({ color: '#0b0816', emissive: color, emissiveIntensity: 0.03, roughness: 0.6 }));
  const floor = new T.Mesh(new T.BoxGeometry(W, 0.02, D), floorMat);
  floor.position.y = base + 0.01;
  const glass = new T.Mesh(new T.BoxGeometry(W, H, D), kit.mats.clearPlastic('#e2f4ff', 0.14));
  glass.position.y = base + H / 2;
  glass.renderOrder = 2;
  g.add(plinth, band, floor, glass);
  // Brass frame: the twelve edges as one instanced mesh.
  const edges = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), kit.mats.brass(), 12);
  const m4 = new T.Matrix4();
  const q = new T.Quaternion();
  const vp = new T.Vector3();
  const vs = new T.Vector3();
  const e = 0.035;
  let k = 0;
  const yc = base + H / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) edges.setMatrixAt(k++, m4.compose(vp.set((sx * W) / 2, yc, (sz * D) / 2), q, vs.set(e, H + e, e)));
  }
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) edges.setMatrixAt(k++, m4.compose(vp.set(0, yc + (sy * H) / 2, (sz * D) / 2), q, vs.set(W + e, e, e)));
    for (const sx of [-1, 1]) edges.setMatrixAt(k++, m4.compose(vp.set((sx * W) / 2, yc + (sy * H) / 2, 0), q, vs.set(e, e, D + e)));
  }
  edges.instanceMatrix.needsUpdate = true;
  edges.castShadow = true;
  g.add(edges);

  // Particles
  const pMat = kit.track(new T.MeshStandardMaterial({ color: mix(color, '#1a1030', 0.25), emissive: color, emissiveIntensity: 0.1, roughness: 0.22, metalness: 0.15 }));
  const geo = new T.SphereGeometry(PR, 14, 10);
  const pos0: number[] = [];
  const ph: number[] = [];
  const x0 = -W / 2 + PR + 0.04;
  const x1 = W / 2 - PR - 0.04;
  const z0 = -D / 2 + PR + 0.04;
  const z1 = D / 2 - PR - 0.04;
  const y0 = base + 0.02 + PR;
  const y1 = base + H - PR - 0.04;
  const r = rng(kind.length * 31 + Math.round(pos[0] * 10));
  const step = PR * 2.08;
  if (kind === 'solid') {
    const nx = Math.min(7, Math.floor((W * 0.8) / step));
    const nz = Math.min(4, Math.floor((D * 0.75) / step));
    const ny = 4;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        for (let iz = 0; iz < nz; iz++) {
          pos0.push((ix - (nx - 1) / 2) * step, y0 + iy * step, (iz - (nz - 1) / 2) * step);
          ph.push(r() * TAU, r() * TAU, r() * TAU);
        }
      }
    }
  } else if (kind === 'liquid') {
    // Rings (in x-z) of touching particles, two layers deep; each ring keeps its own angle.
    for (let layer = 0; layer < 2; layer++) {
      pos0.push(0, y0 + layer * step * 0.95, 0, 0);
      for (const u of [0.32, 0.64, 0.96]) {
        const ra = x1 * u;
        const rb = z1 * u;
        const per = Math.PI * (3 * (ra + rb) - Math.sqrt((3 * ra + rb) * (ra + 3 * rb)));
        const n = Math.max(3, Math.floor(per / (step * 1.02)));
        for (let i = 0; i < n; i++) pos0.push(u, y0 + layer * step * 0.95, (i / n) * TAU + layer * 0.3, 0);
      }
    }
  } else {
    for (let i = 0, gn = kit.n(16); i < gn; i++) {
      pos0.push(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), z0 + r() * (z1 - z0));
      const th = r() * TAU;
      const u = r() * 1.4 - 0.7;
      const s = Math.sqrt(1 - u * u);
      ph.push(s * Math.cos(th), u, s * Math.sin(th));
    }
  }
  const stride = kind === 'liquid' ? 4 : 3;
  const n = pos0.length / stride;
  const parts = new T.InstancedMesh(geo, pMat, n);
  g.add(parts);
  const cur = new Float32Array(n * 3);
  let phase = 0;
  const ringAngle = [0, 0, 0, 0];
  const stepFn = (dt: number, speed: number) => {
    phase += dt * (5 + 7 * speed);
    if (kind === 'solid') {
      const A = 0.006 + 0.016 * speed;
      for (let i = 0; i < n; i++) {
        cur[i * 3] = pos0[i * 3] + A * Math.sin(phase + ph[i * 3]);
        cur[i * 3 + 1] = pos0[i * 3 + 1] + A * Math.sin(phase * 1.13 + ph[i * 3 + 1]);
        cur[i * 3 + 2] = pos0[i * 3 + 2] + A * Math.sin(phase * 0.91 + ph[i * 3 + 2]);
      }
    } else if (kind === 'liquid') {
      // Inner rings turn faster than outer rings: neighbours slide past one another.
      for (let ring = 0; ring < 4; ring++) ringAngle[ring] += dt * (0.2 + 0.55 * speed) * (1.25 - ring * 0.22);
      for (let i = 0; i < n; i++) {
        const u = pos0[i * 4];
        const y = pos0[i * 4 + 1];
        const a0 = pos0[i * 4 + 2];
        const ring = u < 0.1 ? 0 : u < 0.5 ? 1 : u < 0.8 ? 2 : 3;
        const ang = a0 + ringAngle[ring] * (y > y0 + 0.01 ? 1.15 : 1);
        cur[i * 3] = Math.cos(ang) * x1 * u;
        cur[i * 3 + 1] = y + 0.008 * Math.sin(phase * 0.4 + a0 * 3);
        cur[i * 3 + 2] = Math.sin(ang) * z1 * u;
      }
    } else {
      const v = 0.35 + 1.5 * speed;
      for (let i = 0; i < n; i++) {
        for (let ax = 0; ax < 3; ax++) {
          const lo = ax === 0 ? x0 : ax === 1 ? y0 : z0;
          const hi = ax === 0 ? x1 : ax === 1 ? y1 : z1;
          let p = pos0[i * 3 + ax] + ph[i * 3 + ax] * v * dt;
          if (p < lo) {
            p = lo + (lo - p);
            ph[i * 3 + ax] = Math.abs(ph[i * 3 + ax]);
          } else if (p > hi) {
            p = hi - (p - hi);
            ph[i * 3 + ax] = -Math.abs(ph[i * 3 + ax]);
          }
          pos0[i * 3 + ax] = p;
          cur[i * 3 + ax] = p;
        }
      }
    }
    for (let i = 0; i < n; i++) parts.setMatrixAt(i, m4.makeTranslation(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]));
    parts.instanceMatrix.needsUpdate = true;
  };
  stepFn(0, 0.3);
  const sign = kit.neonSign(text, [0, 0, 0], { height: 0.38, color });
  g.add(sign);
  sign.position.set(0, base + H + 0.34, -D / 2 + 0.05);
  sign.rotation.set(-0.45, 0, 0);
  return {
    group: g,
    setLit(v) {
      pMat.emissiveIntensity = 0.1 + v * 0.62;
      bandMat.emissiveIntensity = 0.05 + v * 2.2;
      floorMat.emissiveIntensity = 0.03 + v * 0.25;
      sign.setLit(v);
    },
    step: stepFn,
  };
}

/** A flat grid of light-up dance-floor tiles (one instanced mesh, unlit colours). */
function ledFloor(kit: SetKit, cx: number, cz: number, cols: number, rows: number, tile: number, rotY: number) {
  const T = kit.THREE;
  const g = new T.Group();
  g.position.set(cx, kit.regions.groundY + 0.012, cz);
  g.rotation.y = rotY;
  kit.add(g);
  const frame = new T.Mesh(new T.BoxGeometry(cols * tile + 0.16, 0.04, rows * tile + 0.16), kit.mats.plastic('#120c22'));
  frame.receiveShadow = true;
  g.add(frame);
  const geo = new T.PlaneGeometry(tile * 0.9, tile * 0.9).rotateX(-Math.PI / 2);
  const mat = kit.track(new T.MeshBasicMaterial({ color: '#ffffff' }));
  const inst = new T.InstancedMesh(geo, mat, cols * rows);
  const m4 = new T.Matrix4();
  const col = new T.Color();
  const palette = HEAT.map((h) => new T.Color(h));
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      inst.setMatrixAt(i, m4.makeTranslation((c - (cols - 1) / 2) * tile, 0.03, (r - (rows - 1) / 2) * tile));
      inst.setColorAt(i, col.setRGB(0.05, 0.04, 0.08));
      i++;
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  g.add(inst);
  return {
    update(t: number, lit: number, heat: number) {
      let j = 0;
      const tt = kit.reducedMotion ? 0 : t;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wave = 0.5 + 0.5 * Math.sin(tt * (1.6 + heat * 2.4) - (c + r) * 0.9);
          const p = palette[(c * 3 + r * 5 + Math.floor(tt * 0.8)) % palette.length];
          const b = (0.06 + 0.94 * lit) * (0.25 + 0.75 * wave);
          col.copy(p).multiplyScalar(b);
          col.r = Math.max(col.r, 0.04);
          col.g = Math.max(col.g, 0.03);
          col.b = Math.max(col.b, 0.07);
          inst.setColorAt(j++, col);
        }
      }
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    },
  };
}

/** Upward light beam from a stage fixture (additive cone, never over the playfield). */
function beam(kit: SetKit, pos: V3, color: string, length = 6, radius = 0.7) {
  const T = kit.THREE;
  const geo = new T.ConeGeometry(radius, length, 24, 1, true).rotateX(Math.PI).translate(0, length / 2, 0);
  const mat = kit.track(new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const m = new T.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  kit.add(m);
  const head = new T.Mesh(new T.CylinderGeometry(0.11, 0.15, 0.26, 16), kit.mats.paintedMetal('#2a2238'));
  head.position.set(pos[0], pos[1] - 0.08, pos[2]);
  kit.add(head);
  return { mesh: m, mat };
}

function paintHallWall(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#120a2a'], [0.6, '#22164a'], [1, '#170e33']]);
  ctx.fillRect(0, 0, w, h);
  const lit = Math.min(1, level / 4);
  // Art-deco arches, each framing a particle model.
  for (let i = 0; i < 7; i++) {
    const cx = (i + 0.5) * (w / 7);
    ctx.strokeStyle = rgba(GOLD, 0.15 + 0.45 * lit);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 52, h);
    ctx.lineTo(cx - 52, h * 0.45);
    ctx.arc(cx, h * 0.45, 52, Math.PI, TAU);
    ctx.lineTo(cx + 52, h);
    ctx.stroke();
    const kind = i % 3;
    const c = [ICE, AQUA, CORAL][kind];
    const r = rng(i + 3);
    for (let k = 0; k < 9; k++) {
      const x = cx - 34 + (kind === 0 ? (k % 3) * 34 : r() * 68);
      const y = h * 0.42 + (kind === 0 ? Math.floor(k / 3) * 34 : kind === 1 ? 60 + r() * 50 : r() * 160);
      glowDot(ctx, x, y, 14, c, 0.25 + 0.6 * lit);
    }
  }
}

const danceSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  const gy = kit.regions.groundY;
  kit.sky('#22134a', '#05030c');
  kit.ground('#140c26', 30);
  const wall = kit.backdrop(paintHallWall, { width: 28, height: 11, z: -15 });

  // The three model tanks: the same particles, three dances.
  const gas = modelTank(kit, [-5.75, 0, -1.05], 0.38, [1.9, 1.3, 1.15], 'gas', CORAL, 'GAS');
  const liquid = modelTank(kit, [5.75, 0, -1.05], -0.38, [1.6, 1.0, 1.2], 'liquid', AQUA, 'LIQUID');
  const solid = modelTank(kit, [-6.35, 0, -4.85], 0.55, [1.35, 1.0, 1.0], 'solid', ICE, 'SOLID');
  const tanks = [solid, liquid, gas];

  // Right back corner: the heat lab. A balloon warms over a hot plate and swells, but the
  // particles inside keep exactly the same size; they only move faster and spread out.
  const lab = new T.Group();
  lab.position.set(6.25, gy, -4.7);
  kit.add(lab);
  const plate = new T.Mesh(new T.CylinderGeometry(0.62, 0.7, 0.36, 32), kit.mats.paintedMetal('#2a2238'));
  plate.position.y = 0.18;
  const coilMat = kit.track(new T.MeshStandardMaterial({ color: '#1a0c10', emissive: CORAL, emissiveIntensity: 0.05, roughness: 0.5 }));
  const coil = new T.Mesh(new T.TorusGeometry(0.4, 0.05, 10, 40), coilMat);
  coil.rotation.x = Math.PI / 2;
  coil.position.y = 0.37;
  const balloonMat = kit.track(new T.MeshPhysicalMaterial({ color: '#ffd1d6', roughness: 0.15, transparent: true, opacity: 0.2, clearcoat: 1, depthWrite: false, side: T.DoubleSide }));
  const balloon = new T.Mesh(new T.SphereGeometry(1, 36, 24), balloonMat);
  balloon.renderOrder = 2;
  const neck = new T.Mesh(new T.CylinderGeometry(0.05, 0.12, 0.22, 14), kit.mats.plastic('#ff9fa8'));
  lab.add(plate, coil, balloon, neck);
  const bN = kit.n(18);
  const bParts = new T.InstancedMesh(new T.SphereGeometry(PR, 14, 10), kit.track(new T.MeshStandardMaterial({ color: '#ffd0d4', emissive: CORAL, emissiveIntensity: 0.2, roughness: 0.25 })), bN);
  lab.add(bParts);
  const bPos = new Float32Array(bN * 3);
  const bVel = new Float32Array(bN * 3);
  const br = rng(9);
  for (let i = 0; i < bN; i++) {
    const th = br() * TAU;
    const u = br() * 2 - 1;
    const rad = Math.cbrt(br()) * 0.8;
    const s = Math.sqrt(1 - u * u);
    bPos[i * 3] = rad * s * Math.cos(th);
    bPos[i * 3 + 1] = rad * u;
    bPos[i * 3 + 2] = rad * s * Math.sin(th);
    const th2 = br() * TAU;
    const u2 = br() * 2 - 1;
    const s2 = Math.sqrt(1 - u2 * u2);
    bVel[i * 3] = s2 * Math.cos(th2);
    bVel[i * 3 + 1] = u2;
    bVel[i * 3 + 2] = s2 * Math.sin(th2);
  }
  const labSign = kit.neonSign('HOTTER = FASTER', [6.2, 1.25, -5.55], { height: 0.34, color: CORAL, rotY: -0.55 });
  labSign.rotation.x = -0.45;
  const sizeSign = kit.panel('Same-size particles!', [6.05, 0.2, -3.75], { w: 1.5, h: 0.36, bg: IVORY, fg: '#2a1638', rotY: -0.5 });
  sizeSign.rotation.x = -0.85;

  // A tall neon thermometer beside the lab: it fills with the hall's temperature.
  const thermo = new T.Group();
  thermo.position.set(7.35, gy, -3.2);
  thermo.rotation.y = -0.6;
  kit.add(thermo);
  const board = new T.Mesh(new T.BoxGeometry(0.62, 2.7, 0.08), kit.mats.plastic('#1d1433'));
  board.position.set(0, 1.4, -0.12);
  board.castShadow = true;
  const tube = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 2.2, 20), kit.mats.clearPlastic('#e8f6ff', 0.3));
  tube.position.y = 1.55;
  const cap = new T.Mesh(new T.SphereGeometry(0.11, 16, 10), kit.mats.clearPlastic('#e8f6ff', 0.3));
  cap.position.y = 2.65;
  const mercMat = kit.track(new T.MeshStandardMaterial({ color: '#1a0c10', emissive: CORAL, emissiveIntensity: 0.4 }));
  const merc = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 1, 14), mercMat);
  const bulb = new T.Mesh(new T.SphereGeometry(0.19, 24, 16), mercMat);
  bulb.position.y = 0.36;
  const ticks = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.02, 0.02), kit.mats.brass(), 9);
  const tm = new T.Matrix4();
  for (let i = 0; i < 9; i++) ticks.setMatrixAt(i, tm.makeTranslation(i % 2 ? 0.2 : 0.22, 0.7 + i * 0.22, 0));
  ticks.instanceMatrix.needsUpdate = true;
  thermo.add(board, tube, cap, merc, bulb, ticks);

  // Light-up dance floors on both sides, in front of the tanks.
  const floorL = ledFloor(kit, -6.15, 2.25, 8, 6, 0.46, 0.12);
  const floorR = ledFloor(kit, 6.15, 2.25, 8, 6, 0.46, -0.12);

  // Stage poles with string lights and search beams that point up and away from the table.
  kit.pole([-4.45, 0, 4.35], 2.4);
  kit.pole([4.45, 0, 4.35], 2.4);
  kit.pole([-8.7, 0, -2.6], 3.2);
  kit.pole([8.7, 0, -2.6], 3.2);
  kit.pole([-8.7, 0, -6.6], 3.6);
  kit.pole([8.7, 0, -6.6], 3.6);
  const lightsL = kit.stringLights([-8.7, 3.0, -2.6], [-4.45, 2.25, 4.35], 0.45, kit.n(16), [GOLD, CORAL, MINT]);
  const lightsR = kit.stringLights([8.7, 3.0, -2.6], [4.45, 2.25, 4.35], 0.45, kit.n(16), [GOLD, AQUA, ICE]);
  const lightsB = kit.stringLights([-8.7, 3.4, -6.6], [8.7, 3.4, -6.6], 0.8, kit.n(26), [GOLD, CORAL, AQUA, ICE]);
  // Front beams lean hard outward (away from the tanks); back beams rise behind them.
  const beams = [
    { ...beam(kit, [-4.45, 2.5, 4.35], CORAL, 6, 0.55), tilt: 0.8 },
    { ...beam(kit, [4.45, 2.5, 4.35], AQUA, 6, 0.55), tilt: 0.8 },
    { ...beam(kit, [-8.7, 3.3, -2.6], GOLD, 7, 0.75), tilt: 0.25 },
    { ...beam(kit, [8.7, 3.3, -2.6], MINT, 7, 0.75), tilt: 0.25 },
  ];

  // Marquee over the head of the table.
  const marquee = kit.neonSign('PARTICLE DANCE PARTY', [0, 1.4, -7.2], { height: 0.62, color: GOLD });
  marquee.rotation.x = -0.75;

  const motes = kit.motes({ x0: -10, x1: 10, y0: 0, y1: 5.5, z0: -9, z1: 6 }, 110, MINT, { speed: 0.1, size: 0.09 });
  // Wonderlight: same-size glowing particles rise all around the hall.
  const riseL = kit.motes({ x0: -9, x1: -3.8, y0: -0.3, y1: 4.5, z0: -6, z1: 5 }, 70, CORAL, { speed: 0.35, size: 0.16 });
  const riseR = kit.motes({ x0: 3.8, x1: 9, y0: -0.3, y1: 4.5, z0: -6, z1: 5 }, 70, AQUA, { speed: 0.35, size: 0.16 });
  const fw = kit.fireworks({ x0: -7, x1: 7, y0: 4.5, y1: 7, z: -9 }, [GOLD, CORAL, AQUA, ICE]);
  const fwL = kit.fireworks({ x0: -8.2, x1: -5.0, y0: 2.1, y1: 3.0, z: 1.6 }, [CORAL, GOLD]);
  const fwR = kit.fireworks({ x0: 5.0, x1: 8.2, y0: 2.1, y1: 3.0, z: 1.6 }, [AQUA, ICE]);
  kit.spot([-4.2, 6, 3.2], [-5.9, 0.5, -1.4], CORAL, 26, 0.5);
  kit.spot([4.2, 6, 3.2], [5.9, 0.5, -1.4], AQUA, 26, 0.5);
  const heatLight = kit.point([6.25, 0.9, -4.5], CORAL, 1, 5);

  let warm = 0;
  let celebrating = 0;
  /** Scenery clock: advances with dt, so it stops while the game is paused. */
  let clock = 0;
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.8);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.2);
      const s4 = kit.stage(level, 3.4, 4);
      clock += dt;
      wall.repaint(level);
      // Hall temperature: the dance floor's heat, plus a baseline that rises as rooms wake.
      const target = Math.min(1, 0.15 + 0.12 * level + 0.75 * hall.heat + 0.25 * energy + 0.4 * celebrating);
      warm += (target - warm) * Math.min(1, dt * 1.5);
      // Rooms light in mission order: every tank is visible (dimly) even when dormant.
      for (const tk of tanks) tk.setLit(0.18 + 0.82 * s1);
      if (!kit.reducedMotion) for (const tk of tanks) tk.step(dt, warm);
      floorL.update(clock, 0.15 + 0.85 * Math.max(s2, 0.4 * s0), warm);
      floorR.update(clock, 0.15 + 0.85 * Math.max(s2, 0.4 * s0), warm);
      // Heat lab: the balloon swells with temperature; its particles do not.
      const R = 0.46 + 0.26 * warm;
      balloon.scale.setScalar(R);
      balloon.position.y = 0.42 + R;
      neck.position.y = 0.44;
      coilMat.emissiveIntensity = 0.08 + 2.6 * warm * (0.4 + 0.6 * s2);
      if (heatLight) heatLight.intensity = 0.4 + 5 * warm * (0.3 + 0.7 * s2);
      if (!kit.reducedMotion) {
        const v = 0.25 + 1.3 * warm;
        const lim = 1 - (PR + 0.03) / R;
        for (let i = 0; i < bN; i++) {
          let x = bPos[i * 3] + (bVel[i * 3] * v * dt) / R;
          let y = bPos[i * 3 + 1] + (bVel[i * 3 + 1] * v * dt) / R;
          let z = bPos[i * 3 + 2] + (bVel[i * 3 + 2] * v * dt) / R;
          const d = Math.hypot(x, y, z);
          if (d > lim) {
            // Reflect off the balloon wall.
            const nx = x / d;
            const ny = y / d;
            const nz = z / d;
            const dot = bVel[i * 3] * nx + bVel[i * 3 + 1] * ny + bVel[i * 3 + 2] * nz;
            bVel[i * 3] -= 2 * dot * nx;
            bVel[i * 3 + 1] -= 2 * dot * ny;
            bVel[i * 3 + 2] -= 2 * dot * nz;
            x = nx * lim;
            y = ny * lim;
            z = nz * lim;
          }
          bPos[i * 3] = x;
          bPos[i * 3 + 1] = y;
          bPos[i * 3 + 2] = z;
        }
      }
      for (let i = 0; i < bN; i++) bParts.setMatrixAt(i, tm.makeTranslation(bPos[i * 3] * R, 0.42 + R + bPos[i * 3 + 1] * R, bPos[i * 3 + 2] * R));
      bParts.instanceMatrix.needsUpdate = true;
      labSign.setLit(0.15 + 0.85 * s2);
      // Thermometer column follows the temperature.
      const fill = 0.12 + 1.95 * warm;
      merc.scale.y = fill;
      merc.position.y = 0.45 + fill / 2;
      mercMat.emissiveIntensity = 0.3 + 2.2 * Math.max(s0 * 0.5, s2);
      lightsL.setLit(0.25 + 0.75 * s1);
      lightsR.setLit(0.25 + 0.75 * s1);
      lightsB.setLit(0.15 + 0.85 * s3);
      marquee.setLit(0.12 + 0.5 * s3 + 0.38 * s4);
      motes.setLit(0.25 + 0.6 * s2);
      riseL.setLit(s4 * 0.9 + 0.5 * celebrating - 0.15);
      riseR.setLit(s4 * 0.9 + 0.5 * celebrating - 0.15);
      // Search beams sweep once the hall is fully awake (always pointing up and outward).
      const tt = kit.reducedMotion ? 0 : clock;
      const beamOpacity = (0.04 + 0.16 * s4 + 0.06 * celebrating) * Math.max(s3, 0.6 * s4);
      for (let i = 0; i < beams.length; i++) {
        const bm = beams[i];
        const side = bm.mesh.position.x < 0 ? -1 : 1;
        bm.mat.opacity = beamOpacity;
        bm.mesh.rotation.z = -side * (bm.tilt + 0.14 * Math.sin(tt * 0.6 + i * 1.7));
        bm.mesh.rotation.x = -0.15 + 0.12 * Math.sin(tt * 0.45 + i);
      }
      fw.setLit(s4);
      fwL.setLit(0.6 * s4);
      fwR.setLit(0.6 * s4);
      celebrating = Math.max(0, celebrating - dt * 0.5);
    },
    celebrate(p) {
      celebrating = Math.sin(p * Math.PI);
      fw.setLit(Math.max(0.4, Math.sin(p * Math.PI)));
      fwL.setLit(Math.sin(p * Math.PI));
      fwR.setLit(Math.sin(p * Math.PI));
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const danceRoom: RoomBuilder = ({ kit, w, d }) => {
  const T = kit.THREE;
  // A tiny light-up floor.
  const cols = 6;
  const rows = 4;
  const tile = Math.min((w - 0.2) / cols, (d - 0.3) / rows);
  const tiles = new T.InstancedMesh(new T.PlaneGeometry(tile * 0.88, tile * 0.88).rotateX(-Math.PI / 2), kit.track(new T.MeshBasicMaterial({ color: '#ffffff' })), cols * rows);
  const m4 = new T.Matrix4();
  const col = new T.Color();
  const palette = HEAT.map((h) => new T.Color(h));
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.setMatrixAt(k, m4.makeTranslation((c - (cols - 1) / 2) * tile, 0.03, (r - (rows - 1) / 2) * tile + 0.08));
      tiles.setColorAt(k++, col.setRGB(0.05, 0.04, 0.08));
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  kit.add(tiles);
  // Three little model boxes on a back shelf: solid, liquid, gas (same particle size).
  const shelf = new T.Mesh(new T.BoxGeometry(w * 0.86, 0.06, 0.3), kit.mats.wood());
  shelf.position.set(0, 0.62, -d / 2 + 0.2);
  kit.add(shelf);
  const kinds: { c: string; pts: V3[] }[] = [
    { c: ICE, pts: [] },
    { c: AQUA, pts: [] },
    { c: CORAL, pts: [] },
  ];
  const pr = 0.026;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let l = 0; l < 2; l++) kinds[0].pts.push([(i - 1) * pr * 2.1, pr + j * pr * 2.1, (l - 0.5) * pr * 2.1]);
  const lr = rng(5);
  for (let i = 0; i < 12; i++) kinds[1].pts.push([(lr() - 0.5) * 0.18, pr + lr() * 0.06, (lr() - 0.5) * 0.1]);
  for (let i = 0; i < 6; i++) kinds[2].pts.push([(lr() - 0.5) * 0.2, pr + lr() * 0.2, (lr() - 0.5) * 0.12]);
  const boxes: { mat: THREE.MeshStandardMaterial; inst: THREE.InstancedMesh; base: V3[]; kind: number }[] = [];
  kinds.forEach((kd, i) => {
    const x = (i - 1) * 0.46;
    const box = new T.Mesh(new T.BoxGeometry(0.3, 0.28, 0.2), kit.mats.clearPlastic('#e2f4ff', 0.2));
    box.position.set(x, 0.65 + 0.14, -d / 2 + 0.2);
    kit.add(box);
    const mat = kit.track(new T.MeshStandardMaterial({ color: mix(kd.c, '#ffffff', 0.3), emissive: kd.c, emissiveIntensity: 0.1 }));
    const inst = new T.InstancedMesh(new T.SphereGeometry(pr, 10, 8), mat, kd.pts.length);
    inst.position.set(x, 0.65, -d / 2 + 0.2);
    kit.add(inst);
    boxes.push({ mat, inst, base: kd.pts, kind: i });
  });
  const sign = kit.neonSign('DANCE', [0, 1.3, -d / 2 + 0.06], { height: 0.26, color: GOLD });
  const glow = kit.orb([0, 1.52, 0], 0.07, GOLD);
  // Mini heat lab: the balloon swells and shrinks as it warms and cools; its particles keep their size.
  const plate = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.1, 20), kit.mats.paintedMetal('#2a2238'));
  plate.position.set(-0.62, 0.05, 0.22);
  kit.add(plate);
  const balloonMat = kit.track(new T.MeshPhysicalMaterial({ color: '#ffd1d6', roughness: 0.2, transparent: true, opacity: 0.28, depthWrite: false }));
  const balloon = new T.Mesh(new T.SphereGeometry(1, 24, 16), balloonMat);
  kit.add(balloon);
  const bN = 6;
  const bMat = kit.track(new T.MeshStandardMaterial({ color: '#ffd0d4', emissive: CORAL, emissiveIntensity: 0.1 }));
  const bParts = new T.InstancedMesh(new T.SphereGeometry(pr, 10, 8), bMat, bN);
  kit.add(bParts);
  // A little thermometer on the right.
  const tube = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.62, 12), kit.mats.clearPlastic('#e8f6ff', 0.3));
  tube.position.set(0.66, 0.4, 0.2);
  const mercMat = kit.track(new T.MeshStandardMaterial({ color: '#1a0c10', emissive: CORAL, emissiveIntensity: 0.3 }));
  const merc = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 1, 8), mercMat);
  const bulb = new T.Mesh(new T.SphereGeometry(0.06, 14, 10), mercMat);
  bulb.position.set(0.66, 0.08, 0.2);
  kit.add(tube);
  kit.add(merc);
  kit.add(bulb);
  return {
    update(t, lit) {
      const tt = kit.reducedMotion ? 0 : t;
      let j = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wave = 0.5 + 0.5 * Math.sin(tt * 2 - (c + r) * 0.9);
          col.copy(palette[(c * 3 + r * 5 + Math.floor(tt * 0.8)) % palette.length]).multiplyScalar((0.06 + 0.94 * lit) * (0.3 + 0.7 * wave));
          tiles.setColorAt(j++, col);
        }
      }
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      for (const bx of boxes) {
        bx.mat.emissiveIntensity = 0.1 + 1.6 * lit;
        for (let i = 0; i < bx.base.length; i++) {
          const p = bx.base[i];
          let x = p[0];
          let y = p[1];
          if (bx.kind === 0) {
            x += 0.004 * Math.sin(tt * 14 + i);
            y += 0.004 * Math.sin(tt * 13 + i * 2);
          } else if (bx.kind === 1) {
            x = Math.max(-0.11, Math.min(0.11, x + 0.03 * Math.sin(tt * 0.9 + i)));
          } else {
            x = bounce(x + tt * 0.25 * (i % 2 ? 1 : -1), -0.11, 0.11);
            y = bounce(y + tt * 0.21 * (i % 3 ? 1 : -1), pr, 0.25);
          }
          bx.inst.setMatrixAt(i, m4.makeTranslation(x, y, p[2]));
        }
        bx.inst.instanceMatrix.needsUpdate = true;
      }
      sign.setLit(lit);
      glow.setLit(lit);
      const warmth = lit * (0.6 + 0.4 * Math.sin(tt * 0.7));
      const R = 0.13 + 0.06 * warmth;
      balloon.scale.setScalar(R);
      balloon.position.set(-0.62, 0.12 + R, 0.22);
      for (let i = 0; i < bN; i++) {
        const a = i * 2.4 + tt * (0.6 + 1.6 * warmth) * (i % 2 ? 1 : -1);
        const rr = R * (0.35 + 0.1 * (i % 3));
        bParts.setMatrixAt(i, m4.makeTranslation(-0.62 + Math.cos(a) * rr, 0.12 + R + Math.sin(a * 1.3) * rr, 0.22 + Math.sin(a) * rr * 0.6));
      }
      bParts.instanceMatrix.needsUpdate = true;
      bMat.emissiveIntensity = 0.1 + 1.4 * lit;
      const fill = 0.1 + 0.4 * warmth;
      merc.scale.y = fill;
      merc.position.set(0.66, 0.12 + fill / 2, 0.2);
      mercMat.emissiveIntensity = 0.2 + 1.8 * lit;
    },
  };
};

// ================================================================ table definition

export const L23: TableDef = {
  lessonId: 'L23',
  signature: 'A dance-floor thermostat spinner that heats three state rooms: a packed bumper Crystal, a hairpin Flow Ramp and a sling-fired Gas Hall',
  ballRole: 'The Wonderball is a game token standing in for one particle. Real particles are far too small to see, and they never grow or shrink when a sample expands.',
  theme: {
    bg: ['#24164a', '#110a26'],
    rail: '#c9b8e8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#c7e6ff',
    bumperRing: '#3b2466',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(79,195,247,0.2)',
    trail: MINT,
  },
  lines: {
    intro: 'Welcome to the Particle Dance Party! Every guest here is the same kind of particle, and the conditions in each room decide whether they pack, slide or zoom.',
    quark: '"When a balloon warms up and swells, every particle inside must be puffing up bigger too," Professor Quark wonders.',
    pipTip: 'Pull the plunger about a third of the way back to drop over WARM UP, then shoot straight up the middle to shake the Crystal.',
  },
  build,
  skillShot: 'warm_up',
  shots: [
    { id: 'gas', label: 'Gas Hall', on: [{ type: 'shot', id: ['gas_loop_sw', 'gas_hall_sw'] }], insert: 'ins_gas' },
    { id: 'flow', label: 'Flow Ramp', on: [{ type: 'ramp', id: 'flow_ramp' }], insert: 'ins_flow' },
    { id: 'solid', label: 'Solid Crystal', on: [{ type: 'bumper', group: 'solid' }], insert: 'ins_crystal' },
    { id: 'dance', label: 'Dance Floor', on: [{ type: 'spinner', id: 'dance_floor' }], insert: 'ins_dance' },
    { id: 'pressure', label: 'Pressure Wall', on: [{ type: 'target', group: 'pressure' }], insert: 'ins_pads' },
    { id: 'pocket', label: 'Model Window', on: [{ type: 'saucer', id: 'model_window' }], insert: 'ins_pocket' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Three Ways to Dance',
      brief: 'Visit all three rooms and watch the same particles pack, slide or zoom.',
      objectiveIds: ['L23-O1'],
      stages: [
        { kind: 'collect', text: 'Shake the Solid Crystal 6 times', match: { type: 'bumper', group: 'solid' }, count: 6, preview: ['solid'] },
        { kind: 'shots', text: 'Ride the Flow Ramp and fire into the Gas Hall', shots: ['flow', 'gas'], order: 'any' },
        { kind: 'discover', text: 'Compare the rooms in the Model Window', pocket: 'model_window', questions: 1, types: ['classify', 'match', 'single'] },
      ],
      discovery: 'Same particles, three dances: packed and vibrating in place (solid), touching but sliding past each other (liquid), far apart and moving on their own in straight lines (gas).',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Heat and Squeeze',
      brief: 'Heat the Dance Floor until the whole hall speeds up, then let the gas pound the Pressure Wall to see what heat and pressure do.',
      objectiveIds: ['L23-O2'],
      stages: [
        { kind: 'collect', text: 'Heat the Dance Floor: pass through it 4 times', match: { type: 'spinner', id: 'dance_floor' }, count: 4, preview: ['dance'] },
        { kind: 'collect', text: 'Gas hits push on walls: light all 3 kPa pads', match: { type: 'target', group: 'pressure' }, count: 3, distinct: true, lamps: ['pad_1', 'pad_2', 'pad_3'] },
        { kind: 'discover', text: 'Explain the pressure in the Model Window', pocket: 'model_window', questions: 1 },
      ],
      discovery: 'Heat a balloon and its particles move faster, hitting the walls harder and more often, so it swells. The particles never grow. Gas pressure is the push of countless particle hits on an area.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Call the State',
      brief: 'Each card gives a sample, its temperature and pressure, and where it changes state. Compare them to call the state, then shoot that room.',
      objectiveIds: ['L23-O3', 'L23-O4'],
      stages: [
        { kind: 'shots', text: 'Gallium (melts ~30°C) at 23°C, 101 kPa: Solid Crystal', shots: ['solid'], order: 'any' },
        { kind: 'shots', text: 'Water (melts 0°C, boils 100°C) at 50°C, 101 kPa: Flow Ramp', shots: ['flow'], order: 'any' },
        { kind: 'shots', text: 'CO₂ (solid below −78.5°C) at 23°C, 101 kPa: Gas Hall', shots: ['gas'], order: 'any' },
        { kind: 'discover', text: 'Check your calls in the Model Window', pocket: 'model_window', questions: 1, types: ['classify', 'single'] },
      ],
      discovery: 'Temperature and pressure together set a state. At 101 kPa, water is liquid between 0°C and 100°C, gallium melts near 30°C, and solid carbon dioxide turns straight into a gas at −78.5°C.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Wonderlight Dance',
    brief: 'Light every room of the hall, then bring the Wonderball home to the Model Window.',
    stages: [
      { kind: 'shots', text: 'Light the hall: Crystal, Flow, Gas Hall, Dance Floor', shots: ['solid', 'flow', 'gas', 'dance'], order: 'any' },
      { kind: 'discover', text: 'Final look through the Model Window', pocket: 'model_window', questions: 2 },
    ],
    celebration: 'Every room is dancing: packed, flowing and zooming, and not one particle grew. The Particle Dance Party Wonderlight is yours!',
  },
  set: danceSet,
  room: danceRoom,
  icons: {
    window(ctx, s) {
      ctx.lineWidth = s * 0.14;
      ctx.strokeRect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.75);
      ctx.lineTo(0, s * 0.75);
      ctx.moveTo(-s * 0.75, 0);
      ctx.lineTo(s * 0.75, 0);
      ctx.stroke();
      for (const [x, y] of [[-0.38, -0.38], [0.38, -0.36], [-0.36, 0.4], [0.4, 0.38]]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, s * 0.14, 0, TAU);
        ctx.fill();
      }
    },
    lattice(ctx, s) {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.arc(i * s * 0.5, j * s * 0.5, s * 0.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.lineWidth = s * 0.07;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.95, side > 0 ? -0.5 : Math.PI - 0.5, side > 0 ? 0.5 : Math.PI + 0.5);
        ctx.stroke();
      }
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const heat = hall.heat;
      const s1 = stage(level, 0.2, 1);
      // The dance floor glows with its temperature.
      if (heat > 0.02) glowDot(ctx, FLOOR_C[0], FLOOR_C[1], 70, mix(GOLD, CORAL, heat), 0.25 * heat);
      if (reduced) return;
      const k = 0.4 + 0.5 * s1 + 0.3 * energy;
      // Solid: lattice particles jiggle in place at the crystal's edge.
      const A = 1 + 2.5 * heat;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const x = CRYSTAL_C[0] + Math.cos(a) * 74 + A * Math.sin(t * 19 + i * 2.1);
        const y = CRYSTAL_C[1] + Math.sin(a) * 74 + A * Math.sin(t * 17 + i * 1.3);
        glowDot(ctx, x, y, 5, ICE, 0.4 * k);
      }
      // Gas: a few particles zoom in straight lines and bounce off the hall's walls.
      const v = 40 + 110 * heat;
      for (let i = 0; i < 6; i++) {
        const x = bounce(100 + i * 23 + t * v * (0.6 + 0.13 * i), 96, 228);
        const y = bounce(170 + i * 31 + t * v * (0.9 - 0.1 * i), 160, 330);
        glowDot(ctx, x, y, 6, CORAL, 0.5 * k);
      }
      // Liquid: particles slide along the Flow Ramp's printed stream, passing one another.
      for (let i = 0; i < 12; i++) {
        const u = (((i / 12 + t * (0.025 + 0.03 * heat) * (i % 2 ? 1.25 : 0.85)) % 1) + 1) % 1;
        const [x, y, nx, ny] = flowAt(u);
        const off = (i % 2 ? 1 : -1) * 7;
        glowDot(ctx, x + nx * off, y + ny * off, 6, AQUA, 0.45 * k);
      }
    },
    celebrate({ ctx, t }, p) {
      const [px, py] = POCKET;
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(px, py, 10, px, py, 460);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // The sample expands: particles spread out, every one the same size as before.
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU + t * 0.3;
        const d = 30 + p * 300 * (0.7 + (0.3 * ((i * 7) % 5)) / 4);
        glowDot(ctx, px + Math.cos(a) * d, py + Math.sin(a) * d * 0.9, 10, [ICE, AQUA, CORAL, GOLD][i % 4], 1 - p);
      }
    },
  },
};
export default L23;
