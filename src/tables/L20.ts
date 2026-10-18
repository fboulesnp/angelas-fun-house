// Lesson 20 — Resources in Living Systems — "Habitat Hide-and-Seek"
// A moonlit steppe menagerie. Wild horses graze a meadow that regrows tuft by tuft, yaks crowd
// the high ridge, marmots hide in their burrow, and the Creek Ramp carries water down the bank.
// The signature Herd Gauge lets the herd grow only as far as its scarcest resource allows.

import * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { DropBank, type DropTarget, Insert, Mechanism } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { TAU, drift, glowDot, mix, rgba, rng, stage, stars, vgrad } from '../game/render/art.ts';

const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const GRASS = '#9BD46A';
const STEPPE = '#C9B46A';
const WATER = '#5CC8F0';
const EARTH = '#B9845A';
const DUN = '#C9A16A';
const MOON = '#F3EBC8';
const AURORA = '#7CF5B5';
const VIOLET = '#B99BFF';

type P2 = [number, number];
type V3 = [number, number, number];

// ================================================================ the Herd Gauge (signature)

/** Whole units of a 0..3 meter (what its lamps show). */
const units = (v: number) => Math.floor(v + 1e-6);

/**
 * The Herd Gauge: a tiny population model drawn with lamps under the lacquer.
 * - FOOD (0-3) rises when the herd grazes a grass tuft and falls when yaks graze the same
 *   meadow; WATER (0-3) rises with every run of the Creek Ramp. Both slowly run down, food
 *   faster when there are more mouths to feed.
 * - The herd's LIMIT is twice the scarcer meter, and never more than six: the meadow's space.
 *   Below the limit a foal is born every few seconds; above it the herd shrinks.
 * - The Herd Count spinner only counts the herd (a census); counting never adds a horse.
 * - Grass tufts regrow one by one, faster when water is plentiful, and faster again for a while
 *   once SUN, CO2 and SOIL are all lit.
 * Feeding the scarcer meter emits a 'limit' shot so a mission can ask the player to find it.
 */
class HerdGauge extends Mechanism {
  kind = 'herdGauge' as const;
  food = 2;
  water = 1;
  herd = 2;
  /** When true, only the limiting resource's shot insert flashes (mission hint). */
  hint = false;
  private changeAt = 0;
  private regrowAt = 0;
  private boostUntil = 0;
  private lanesLit = new Set<string>();
  private foodLamps: Insert[] = [];
  private waterLamps: Insert[] = [];
  private herdLamps: Insert[] = [];
  private lanes: Mechanism[] = [];
  private bank?: DropBank;
  private grazeInsert?: Insert;
  private creekInsert?: Insert;
  /** Events already counted (robust even if a harness steps without draining the queue). */
  private seen = new WeakSet<object>();

  constructor(rt: TableRuntime, id: string) {
    super(rt, id);
    // Its 'limit' shots carry this group, so missions can match them.
    this.group = 'limit';
  }

  link() {
    const rt = this.rt;
    this.foodLamps = [1, 2, 3].map((i) => rt.get<Insert>(`food_${i}`));
    this.waterLamps = [1, 2, 3].map((i) => rt.get<Insert>(`water_${i}`));
    this.herdLamps = [1, 2, 3, 4, 5, 6].map((i) => rt.get<Insert>(`herd_${i}`));
    this.lanes = rt.byGroup('plant');
    this.bank = rt.get<DropBank>('meadow');
    this.bank.autoReset = false;
    this.grazeInsert = rt.get<Insert>('ins_graze');
    this.creekInsert = rt.get<Insert>('ins_creek');
  }

  /** How many horses the habitat can support right now. */
  get limit() {
    return Math.min(6, 2 * Math.min(units(this.food), units(this.water)));
  }

  private feed(which: 'food' | 'water', x: number, y: number) {
    const mine = which === 'food' ? this.food : this.water;
    const other = which === 'food' ? this.water : this.food;
    const scarcest = units(mine) <= units(other);
    const after = Math.min(3, mine + 1);
    if (which === 'food') this.food = after;
    else this.water = after;
    if (scarcest && after > mine) this.rt.emit({ type: 'shot', id: `limit_${which}`, group: 'limit', x, y });
  }

  update(dt: number) {
    super.update(dt);
    const rt = this.rt;
    const t = rt.time;
    const n = rt.events.length;
    for (let i = 0; i < n; i++) {
      const e = rt.events[i];
      if (this.seen.has(e)) continue;
      this.seen.add(e);
      if (e.type === 'drop' && e.group === 'grass') this.feed('food', e.x, e.y);
      else if (e.type === 'ramp' && e.id === 'creek_ramp') this.feed('water', e.x, e.y);
      else if (e.type === 'target' && e.group === 'yaks') this.food = Math.max(0, this.food - 0.5);
      else if (e.type === 'bumper' && e.id === 'bumper_yak') this.food = Math.max(0, this.food - 0.15);
      else if (e.type === 'rollover' && e.group === 'plant' && !this.lanesLit.has(e.id)) {
        this.lanesLit.add(e.id);
        if (this.lanesLit.size === this.lanes.length) {
          this.boostUntil = t + 30;
          this.lanesLit.clear();
          rt.emit({ type: 'shot', id: 'grass_boost', group: 'boost', x: e.x, y: e.y });
        }
      }
    }
    // Resources run down: water slowly, food faster when there are more mouths to feed.
    this.water = Math.max(0, this.water - dt / 70);
    this.food = Math.max(0, this.food - (dt * (0.4 + 0.1 * this.herd)) / 60);
    // Births below the limit, losses above it (a hardy pair always remains).
    const lim = Math.max(1, this.limit);
    if (this.herd === lim) this.changeAt = 0;
    else if (this.changeAt <= 0) this.changeAt = t + (this.herd < lim ? 4 : 3);
    else if (t >= this.changeAt) {
      this.herd += this.herd < lim ? 1 : -1;
      this.changeAt = 0;
      if (this.herd > 1) rt.emit({ type: 'shot', id: `herd_${this.herd}`, group: 'herd', x: 286, y: 778 });
    }
    // Grass regrows tuft by tuft: faster with water, faster again with SUN, CO2 and SOIL lit.
    const bank = this.bank;
    if (bank) {
      let down: DropTarget | undefined;
      for (const d of bank.targets) if (d.down) { down = d; break; }
      if (!down) this.regrowAt = 0;
      else if (this.regrowAt <= 0) {
        const w = units(this.water);
        this.regrowAt = t + (w >= 2 ? 2.5 : w === 1 ? 5 : 10) * (t < this.boostUntil ? 0.5 : 1);
      } else if (t >= this.regrowAt && down.tryRaise()) this.regrowAt = 0;
    }
    // Lamps: whole units on; the scarcer meter's next lamp pulses as the LIMIT.
    const f = units(this.food);
    const w = units(this.water);
    const foodShort = f <= w;
    const waterShort = w <= f;
    // Plain loops: this runs every physics step, so no per-step closures.
    for (let i = 0; i < this.foodLamps.length; i++) this.foodLamps[i].lamp = i < f ? 'on' : foodShort && i === f ? 'pulse' : 'off';
    for (let i = 0; i < this.waterLamps.length; i++) this.waterLamps[i].lamp = i < w ? 'on' : waterShort && i === w ? 'pulse' : 'off';
    const limit = this.limit;
    for (let i = 0; i < this.herdLamps.length; i++) this.herdLamps[i].lamp = i < this.herd ? 'on' : i < limit ? 'pulse' : 'off';
    const boosting = t < this.boostUntil;
    for (const m of this.lanes) {
      if (m.lamp === 'flash') continue; // the skill shot owns the lamp for a moment
      m.lamp = this.lanesLit.has(m.id) ? 'on' : boosting ? 'pulse' : 'off';
    }
    if (this.hint && this.grazeInsert && this.creekInsert) {
      this.grazeInsert.lamp = foodShort ? 'flash' : 'off';
      this.creekInsert.lamp = waterShort ? 'flash' : 'off';
    }
  }
}

// ================================================================ playfield geometry

const BURROW: P2 = [112, 540];
const LOG: P2 = [332, 466];
/** Creek Ramp centreline: climbs the ridge, hooks over the spring and pours into the creek bed. */
const CREEK: P2[] = [[230, 626], [230, 520], [230, 420], [226, 330], [208, 250], [172, 196], [124, 178], [82, 200], [58, 252], [50, 330]];
/** Meadow Hill: the bank of grass tufts and the hill behind it. */
const BANK_DEG = 24;
const BANK_P0: P2 = [430, 540];
const HILL: P2[] = [[424.9, 526.8], [544, 462], [544, 630], [527.2, 572.3]];
const GAUGE = { foodX: 172, waterX: 400, herdX0: 211, herdDx: 30, y: 778 };

/** A rounded U around (cx, cy) that opens toward `axisDeg` (a saucer sits inside). */
function cupPoints(b: TableBuilder, cx: number, cy: number, axisDeg: number, r = 27, lip = 14): P2[] {
  const a = (axisDeg * Math.PI) / 180;
  const u: P2 = [Math.cos(a), Math.sin(a)];
  const arc = b.arcPoints(cx, cy, r, axisDeg + 90, axisDeg + 270, 12);
  const first = arc[0];
  const last = arc[arc.length - 1];
  return [[first[0] + u[0] * lip, first[1] + u[1] * lip], ...arc, [last[0] + u[0] * lip, last[1] + u[1] * lip]];
}

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Creek bed: the left channel. Launches and the Creek Ramp both run down it, and a one-way
  //     flap turns them toward the left flipper (a kickback can still fire up through it). ---
  b.wall([[74, 640], [74, 420]], { id: 'creek_bank', r: 3 });
  b.post(74, 416, 5);
  b.gate('bank_deflect', [FRAME.left, 646], [54, 694], -90);

  // --- The Ridge: one rock block carrying the Creek Ramp, the Herd Trail and the Hollow Log.
  //     Its roof falls away on both sides of a single peak, so nothing can rest on top. ---
  b.wall([[196, 678], [208, 630], [208, 424], [252, 400]], { id: 'ridge_west', r: 3 });
  b.wall([[252, 630], [252, 402]], { id: 'trail_west', r: 3 });
  b.post(252, 632, 4);
  b.gate('trail_gate', [255, 401], [299, 421], -90);
  b.wall([[302, 624], [302, 422], [362, 450], [362, 504]], { id: 'log_hollow', r: 4 });
  b.post(302, 626, 4);

  // --- Creek Ramp (the water route): climbs the ridge and pours down the creek bed ---
  b.ramp('creek_ramp', { path: CREEK, width: 36, footprintTo: 0, peak: 96, label: 'CREEK' });

  // --- Herd Trail: the lane through the Herd Count spinner, one-way at the top ---
  b.spinner('herd_spinner', [255, 548], [298, 548], { label: 'HERD COUNT' });
  b.shotSwitch('herd_sw', 277, 490, -90);

  // --- Hollow Log (shelter two, the Wonder Pocket) beside the trail ---
  b.saucer('hollow_log', LOG[0], LOG[1], { role: 'pocket', ejectDeg: 86, ejectSpeed: 620, captureMaxSpeed: 2600, icon: 'log' });

  // --- Marmot Burrow (shelter one): dug into the creek bank, facing the right flipper ---
  // A wide mouth (r 30, short lips) so the long right-flipper shot has a fair window.
  b.wall(cupPoints(b, BURROW[0], BURROW[1], 65, 30, 10), { id: 'burrow_mound', r: 4 });
  b.saucer('burrow', BURROW[0], BURROW[1], { role: 'scoop', ejectDeg: 70, ejectSpeed: 620, captureMaxSpeed: 2600, icon: 'marmot' });

  // --- Grazer pop bumpers: horse, yak and marmot all eat the same grass ---
  b.bumper('bumper_horse', 282, 262, { group: 'grazers', icon: 'horse', r: 25 });
  b.bumper('bumper_yak', 378, 262, { group: 'grazers', icon: 'yak', r: 25 });
  b.bumper('bumper_marmot', 146, 412, { group: 'grazers', icon: 'marmot', r: 23 });

  // --- Yak Ridge: two yak herds on the high pasture, facing the left flipper ---
  b.target('yak_a', [398, 380], [422, 389], { group: 'yaks', label: 'YAK' });
  b.target('yak_b', [448, 344], [472, 353], { group: 'yaks', label: 'YAK' });

  // --- What grass needs: SUN, CO₂ and SOIL lanes at the top (the Creek brings the water) ---
  const laneXs = [278, 326, 374];
  const names = ['SUN', 'CO₂', 'SOIL'];
  laneXs.forEach((x, i) => b.rollover(`need_${['sun', 'co2', 'soil'][i]}`, x, 150, { group: 'plant', label: names[i] }));
  for (const gx of [254, 302, 350, 398]) {
    b.wall([[gx, 126], [gx, 174]], { r: 3 });
    b.post(gx, 124, 5);
  }

  // --- Meadow Hill: three grass tufts (drop targets) that regrow, facing the left flipper ---
  b.dropBank('meadow', BANK_P0[0], BANK_P0[1], BANK_DEG, 3, { size: 26, gap: 6, group: 'grass', labels: ['GRASS', 'GRASS', 'GRASS'] });
  b.wall(HILL, { id: 'meadow_hill', r: 3, closed: true });

  // --- Inserts (shot previews) ---
  b.insert('ins_creek', 230, 688, { deg: -90, color: WATER });
  b.insert('ins_herd', 277, 662, { deg: -90, color: GOLD });
  b.insert('ins_pocket', 332, 662, { deg: -90, color: MINT });
  b.insert('ins_burrow', 150, 640, { deg: -115, color: EARTH });
  b.insert('ins_graze', 420, 640, { deg: -66, label: 'GRASS', color: GRASS });
  b.insert('ins_grazers', 330, 330, { shape: 'star', size: 12, color: CORAL });
  b.insert('ins_yaks', 392, 470, { deg: -70, color: CORAL });

  // --- The Herd Gauge lamps: FOOD and WATER meters around a row of six horses ---
  for (let i = 0; i < 3; i++) {
    b.insert(`food_${i + 1}`, GAUGE.foodX, GAUGE.y - i * 24, { shape: 'circle', size: 8, color: GRASS });
    b.insert(`water_${i + 1}`, GAUGE.waterX, GAUGE.y - i * 24, { shape: 'circle', size: 8, color: WATER });
  }
  for (let i = 0; i < 6; i++) b.insert(`herd_${i + 1}`, GAUGE.herdX0 + i * GAUGE.herdDx, GAUGE.y, { shape: 'circle', size: 9, color: GOLD });

  const gauge = b.rt.add(new HerdGauge(b.rt, 'herd_gauge'));
  gauge.link();
}

// ================================================================ animal silhouettes (shared 2D + 3D)

/** Wild horse in profile, facing +x, hooves at y = 0 (y up). */
const HORSE: P2[] = [
  [-0.5, 0.62], [-0.3, 0.66], [0.05, 0.64], [0.22, 0.7], [0.34, 0.86], [0.44, 1.0], [0.43, 1.1], [0.49, 1.01],
  [0.56, 0.98], [0.72, 0.78], [0.75, 0.7], [0.68, 0.66], [0.56, 0.72], [0.46, 0.68], [0.38, 0.52], [0.36, 0.4],
  [0.34, 0.26], [0.36, 0.02], [0.28, 0], [0.26, 0.24], [0.22, 0.34], [-0.24, 0.34], [-0.3, 0.26], [-0.26, 0.02],
  [-0.34, 0], [-0.38, 0.22], [-0.48, 0.36], [-0.53, 0.5], [-0.58, 0.52], [-0.66, 0.3], [-0.62, 0.16], [-0.56, 0.3],
  [-0.54, 0.56],
];
/** Yak in profile, facing +x: humped, shaggy, with an upswept horn. */
const YAK: P2[] = [
  [-0.6, 0.55], [-0.3, 0.62], [0.05, 0.74], [0.22, 0.78], [0.38, 0.66], [0.46, 0.6], [0.44, 0.7], [0.5, 0.84],
  [0.56, 0.66], [0.66, 0.56], [0.74, 0.4], [0.68, 0.32], [0.56, 0.36], [0.5, 0.22], [0.46, 0.1], [0.44, 0],
  [0.34, 0], [0.32, 0.12], [0.1, 0.14], [-0.2, 0.13], [-0.36, 0.12], [-0.38, 0], [-0.48, 0], [-0.52, 0.16],
  [-0.62, 0.36], [-0.68, 0.4], [-0.74, 0.2], [-0.66, 0.16], [-0.62, 0.48],
];

function silhouette2d(ctx: CanvasRenderingContext2D, pts: P2[], x: number, y: number, s: number, flip = 1) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const X = x + px * s * flip;
    const Y = y - py * s;
    if (i) ctx.lineTo(X, Y);
    else ctx.moveTo(X, Y);
  });
  ctx.closePath();
}

// ================================================================ printed playfield art

function poly(ctx: CanvasRenderingContext2D, pts: P2[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
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

/** Small readable printed label (Atkinson), optionally rotated. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, size * 0.32);
  ctx.strokeStyle = `rgba(10,16,24,${0.85 * alpha})`;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Display lettering (Fraunces) with a soft glow that grows with `lit`. */
function title(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, lit: number) {
  ctx.save();
  ctx.font = `800 ${size}px "Fraunces Variable", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.22);
  ctx.strokeStyle = 'rgba(10,14,28,0.85)';
  ctx.strokeText(text, x, y);
  if (lit > 0.01) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * lit;
  }
  ctx.fillStyle = rgba(color, 0.45 + 0.55 * lit);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A field of short grass strokes (deterministic). */
function grassField(ctx: CanvasRenderingContext2D, seed: number, area: [number, number, number, number], n: number, colors: string[], alpha: number, len = 9) {
  const r = rng(seed);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * (area[2] - area[0]);
    const y = area[1] + r() * (area[3] - area[1]);
    const l = len * (0.6 + r() * 0.8);
    const lean = (r() - 0.5) * 0.9;
    ctx.strokeStyle = rgba(colors[i % colors.length], alpha * (0.5 + 0.5 * r()));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * l * 0.3, y - l * 0.6, x + lean * l, y - l);
    ctx.stroke();
  }
  ctx.restore();
}

/** Tuft of grass blades fanning up from (x, y). */
function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = Math.max(1.2, s * 0.12);
  ctx.lineCap = 'round';
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * s * 0.08, y);
    ctx.quadraticCurveTo(x + k * s * 0.18, y - s * 0.6, x + k * s * 0.32, y - s * (0.85 - Math.abs(k) * 0.08));
    ctx.stroke();
  }
  ctx.restore();
}

function hoofprint(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, s, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.arc(x, y + s * 0.15, s * 0.45, Math.PI * 0.85, Math.PI * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function marmot2d(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, body: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.55, s * 0.36, s * 0.55, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - s * 1.18, s * 0.28, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - s * 0.2, y - s * 1.4, s * 0.08, 0, TAU);
  ctx.arc(x + s * 0.2, y - s * 1.4, s * 0.08, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,215,0.75)';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.5, s * 0.2, s * 0.36, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.arc(x - s * 0.1, y - s * 1.22, s * 0.04, 0, TAU);
  ctx.arc(x + s * 0.1, y - s * 1.22, s * 0.04, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** An aurora curtain: soft vertical streaks along a wavy band. */
function auroraBand(ctx: CanvasRenderingContext2D, seed: number, x0: number, x1: number, y: number, h: number, a: string, b: string, alpha: number) {
  if (alpha <= 0.01) return;
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let x = x0; x <= x1; x += 3) {
    const u = (x - x0) / (x1 - x0);
    const yy = y + Math.sin(u * 7 + seed) * h * 0.18 + Math.sin(u * 17 + seed * 2) * h * 0.06;
    const k = 0.35 + 0.65 * Math.abs(Math.sin(u * 11 + seed)) * (0.6 + 0.4 * r());
    const g = ctx.createLinearGradient(0, yy - h, 0, yy);
    g.addColorStop(0, rgba(b, 0));
    g.addColorStop(0.55, rgba(b, 0.16 * alpha * k));
    g.addColorStop(1, rgba(a, 0.42 * alpha * k));
    ctx.fillStyle = g;
    ctx.fillRect(x, yy - h, 3.2, h);
  }
  ctx.restore();
}

function paintPlayfield(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);
  const lush = Math.min(1, 0.35 * s1 + 0.35 * s2 + 0.3 * s3);

  // ---- Moonlit sky over the steppe, deepening into meadow
  ctx.fillStyle = vgrad(ctx, 0, 1150, [
    [0, mix('#151a3c', '#1d2456', s4)],
    [0.2, mix('#212a55', '#283a6c', s2)],
    [0.34, mix('#273c4c', '#2d5056', lush)],
    [0.55, mix('#2a3d2c', '#2f5a34', lush)],
    [0.78, mix('#22331f', '#294a2a', lush)],
    [1, '#131f16'],
  ]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 20, 80, [40, 24, 560, 250], IVORY);
  auroraBand(ctx, 3, 60, 540, 150, 120, AURORA, VIOLET, 0.25 * s3 + 0.75 * s4);
  auroraBand(ctx, 7, 90, 520, 215, 90, MINT, '#8fb8ff', 0.6 * s4);

  // ---- The moon (it brightens as the habitat wakes)
  glowDot(ctx, 470, 98, 90, MOON, 0.18 + 0.3 * s1 + 0.25 * s4);
  ctx.fillStyle = mix('#a9a58c', MOON, 0.4 + 0.6 * s1);
  ctx.beginPath();
  ctx.arc(470, 98, 26, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,110,90,0.22)';
  for (const [dx, dy, rr] of [[-8, -6, 6], [7, 5, 4], [-2, 10, 3], [10, -8, 3]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(470 + dx, 98 + dy, rr, 0, TAU);
    ctx.fill();
  }

  // ---- Distant mountains and rolling steppe hills
  ctx.fillStyle = mix('#28305a', '#35467a', s2);
  ctx.beginPath();
  ctx.moveTo(24, 330);
  const ridge: P2[] = [[24, 300], [70, 250], [120, 278], [180, 226], [240, 270], [300, 236], [356, 262], [420, 214], [480, 250], [540, 230], [576, 262], [576, 330]];
  for (const [x, y] of ridge) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mix('#bfc6e0', '#ffffff', s1);
  for (const [x, y] of [[180, 226], [420, 214], [540, 230]] as P2[]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 16, y + 14);
    ctx.lineTo(x - 4, y + 10);
    ctx.lineTo(x + 3, y + 16);
    ctx.lineTo(x + 16, y + 13);
    ctx.closePath();
    ctx.fill();
  }
  for (const [base, col, seed] of [[330, '#2c4636', 2], [380, '#30503a', 5]] as [number, string, number][]) {
    ctx.fillStyle = mix(col, '#3f7a48', lush * 0.7);
    ctx.beginPath();
    ctx.moveTo(24, 1150);
    const r = rng(seed);
    const ph = r() * TAU;
    for (let x = 24; x <= 576; x += 8) ctx.lineTo(x, base + Math.sin(x / 70 + ph) * 16 + Math.sin(x / 29 + ph) * 6);
    ctx.lineTo(576, 1150);
    ctx.closePath();
    ctx.fill();
  }
  // grass texture over the whole meadow (lusher with every mission)
  grassField(ctx, 11, [30, 360, 570, 1100], 900, [mix(STEPPE, GRASS, lush), mix('#7e8a52', '#5fae5a', lush), '#e6d38a'], 0.22 + 0.25 * lush);

  // ---- The creek bed (left channel) and the spring under the ramp's hook
  const creek: P2[] = [[48, 300], [44, 380], [52, 460], [44, 540], [50, 620], [42, 680]];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = mix('#203a5a', '#2a6f9e', s1);
  ctx.lineWidth = 44;
  smoothLine(ctx, creek);
  ctx.stroke();
  ctx.strokeStyle = rgba(WATER, 0.25 + 0.5 * s1);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 14]);
  for (const off of [-10, 2, 12]) {
    smoothLine(ctx, creek.map(([x, y]) => [x + off, y] as P2));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  // spring pool fed by the ramp, reeds around it
  ctx.fillStyle = mix('#1f3f63', '#2f86b8', s1);
  ctx.beginPath();
  ctx.ellipse(128, 292, 46, 26, -0.15, 0, TAU);
  ctx.fill();
  glowDot(ctx, 128, 292, 60, WATER, 0.12 + 0.3 * s1);
  ctx.strokeStyle = rgba('#ffffff', 0.18 + 0.3 * s1);
  ctx.lineWidth = 1.5;
  for (const rr of [12, 24, 36]) {
    ctx.beginPath();
    ctx.ellipse(128, 292, rr, rr * 0.55, -0.15, 0, TAU);
    ctx.stroke();
  }
  for (const [x, y] of [[88, 300], [96, 276], [168, 304], [160, 278], [176, 290]] as P2[]) tuft(ctx, x, y, 14, mix('#5d7d4c', GRASS, lush), 0.9);
  label(ctx, 'SPRING', 128, 330, 11, '#bfe9ff', 0.8);

  // ---- The Ridge: rock under the Creek Ramp, the dirt Herd Trail, and the Hollow Log
  ctx.fillStyle = mix('#3b3a4a', '#5a5466', s1 * 0.6);
  poly(ctx, [[196, 690], [208, 630], [208, 420], [252, 396], [252, 690]]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,18,28,0.35)';
  ctx.lineWidth = 1.5;
  const rr = rng(31);
  for (let i = 0; i < 18; i++) {
    const x = 212 + rr() * 34;
    const y = 430 + rr() * 250;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + rr() * 8, y + 4 - rr() * 8);
    ctx.stroke();
  }
  // water route glow under the translucent ramp
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(WATER, 0.18 + 0.35 * s1);
  ctx.lineWidth = 20;
  smoothLine(ctx, CREEK);
  ctx.stroke();
  ctx.restore();
  // Herd Trail: packed earth with hoofprints going up
  ctx.fillStyle = mix('#5a4636', '#7a5e44', s1);
  ctx.fillRect(254, 404, 46, 230);
  for (let i = 0; i < 8; i++) hoofprint(ctx, 266 + (i % 2) * 20, 612 - i * 26, 4.5, '#2b1f16', 0.55);
  label(ctx, 'HERD COUNT', 277, 585, 10, GOLD, 0.95, -Math.PI / 2);
  // Hollow Log: a fallen trunk seen end-on, the pocket in its heart
  ctx.fillStyle = mix('#4a3322', '#6b4a30', s1);
  poly(ctx, [[302, 418], [362, 446], [366, 512], [302, 512]]);
  ctx.fill();
  ctx.fillStyle = mix('#7a5638', '#a57a4e', s1);
  ctx.beginPath();
  ctx.arc(LOG[0], LOG[1], 30, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,24,12,0.55)';
  ctx.lineWidth = 1.6;
  for (const ring of [22, 15]) {
    ctx.beginPath();
    ctx.arc(LOG[0], LOG[1], ring, 0, TAU);
    ctx.stroke();
  }
  glowDot(ctx, LOG[0], LOG[1], 46, MINT, 0.15 + 0.35 * s1);
  label(ctx, 'HOLLOW', 332, 522, 11, MINT, 0.95);
  label(ctx, 'LOG', 332, 537, 11, MINT, 0.95);

  // ---- Marmot Burrow: an earth mound in the creek bank
  const mg = ctx.createRadialGradient(BURROW[0], BURROW[1], 6, BURROW[0], BURROW[1], 52);
  mg.addColorStop(0, '#2a1a10');
  mg.addColorStop(0.45, mix('#6a4a32', '#8a6142', s1));
  mg.addColorStop(1, 'rgba(90,64,42,0)');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(BURROW[0], BURROW[1], 52, 0, TAU);
  ctx.fill();
  for (const [x, y] of [[86, 506], [140, 500], [96, 590]] as P2[]) tuft(ctx, x, y, 12, mix('#6d7e45', GRASS, lush), 0.9);
  marmot2d(ctx, 158, 498, 15, mix('#8a6a48', '#c49460', s1), 0.5 + 0.5 * s1);
  label(ctx, 'MARMOT', 112, 590, 11, '#f0c79a', 0.95);
  label(ctx, 'BURROW', 112, 605, 11, '#f0c79a', 0.95);

  // ---- Meadow Hill with its grass and the GRAZE arrow side
  ctx.fillStyle = mix('#3e5a32', '#4f8a3e', lush);
  poly(ctx, [[418, 520], [548, 452], [548, 640], [520, 640]]);
  ctx.fill();
  grassField(ctx, 41, [440, 470, 545, 630], 120, [mix(STEPPE, GRASS, lush), '#d7e79a'], 0.6, 11);
  label(ctx, 'MEADOW', 508, 504, 11, '#e8ffd0', 0.95, -0.5);
  // the grass tufts the targets stand for, printed just in front of them
  for (let i = 0; i < 3; i++) {
    const s = 13 + i * 32;
    const x = BANK_P0[0] + Math.cos((BANK_DEG * Math.PI) / 180) * s - Math.sin((BANK_DEG * Math.PI) / 180) * 18;
    const y = BANK_P0[1] + Math.sin((BANK_DEG * Math.PI) / 180) * s + Math.cos((BANK_DEG * Math.PI) / 180) * 18;
    tuft(ctx, x, y, 14, mix('#7c9a52', GRASS, lush), 0.85);
  }

  // ---- Yak Ridge: a rocky high pasture with resting yaks
  ctx.fillStyle = mix('#323850', '#454c6a', s2);
  poly(ctx, [[380, 404], [430, 352], [478, 318], [532, 296], [548, 300], [548, 420], [480, 430]]);
  ctx.fill();
  ctx.fillStyle = mix('#1a1a24', '#2c2430', s2);
  silhouette2d(ctx, YAK, 500, 410, 30, -1);
  ctx.fill();
  silhouette2d(ctx, YAK, 520, 368, 24, -1);
  ctx.fill();
  label(ctx, 'YAK RIDGE', 470, 302, 11, '#ffc4c8', 0.9, -0.38);

  // ---- Lanes: what grass needs
  label(ctx, 'WHAT GRASS NEEDS (+ CREEK WATER)', 326, 187, 10, '#e8ffd0', 0.95);
  label(ctx, 'CREEK', 230, 652, 11, '#bfe9ff', 0.95);

  // ---- Grazer bumpers sit on the open steppe
  label(ctx, 'GRAZERS', 330, 352, 10, '#ffd8c8', 0.85);

  // ---- The herd itself: silhouettes appear as the habitat wakes
  const herd: [number, number, number, number][] = [[110, 740, 34, 1], [138, 776, 28, -1], [462, 736, 34, -1], [492, 772, 26, 1], [90, 690, 26, 1]];
  herd.forEach(([x, y, s, f], i) => {
    const a = i < 2 ? 0.35 + 0.55 * s1 : i < 4 ? 0.55 * s2 + 0.35 * s3 : 0.9 * s3;
    if (a <= 0.02) return;
    ctx.fillStyle = rgba(mix('#2a1e14', DUN, 0.25 + 0.45 * s3), a);
    silhouette2d(ctx, HORSE, x, y, s, f);
    ctx.fill();
  });

  // ---- The Herd Gauge panel (the signature): FOOD and WATER set the herd's LIMIT
  ctx.save();
  ctx.fillStyle = 'rgba(8,14,18,0.55)';
  ctx.strokeStyle = rgba(GOLD, 0.35 + 0.4 * s1);
  ctx.lineWidth = 2;
  const px = 146;
  const pw = 280;
  ctx.beginPath();
  ctx.roundRect(px, 700, pw, 110, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  label(ctx, 'FOOD', GAUGE.foodX, 712, 10, GRASS, 1);
  label(ctx, 'WATER', GAUGE.waterX, 712, 10, WATER, 1);
  label(ctx, 'HERD GAUGE', 286, 714, 13, GOLD, 1);
  label(ctx, 'the scarcer resource sets the limit', 286, 735, 10, IVORY, 0.9);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = rgba(mix('#a07a50', DUN, s1), 0.85);
    silhouette2d(ctx, HORSE, GAUGE.herdX0 + i * GAUGE.herdDx, 764, 15, 1);
    ctx.fill();
  }
  label(ctx, 'SPACE FOR 6', 286, 798, 10, IVORY, 0.9);
  // the LIMIT bracket from the meters to the herd row
  ctx.save();
  ctx.strokeStyle = rgba(GOLD, 0.45);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(GAUGE.foodX + 12, 778);
  ctx.lineTo(GAUGE.herdX0 - 14, 778);
  ctx.moveTo(GAUGE.waterX - 12, 778);
  ctx.lineTo(GAUGE.herdX0 + 5 * GAUGE.herdDx + 14, 778);
  ctx.stroke();
  ctx.restore();

  // ---- Title lettering across the top of the arch
  title(ctx, 'Habitat Hide-and-Seek', 338, 62, 18, GOLD, stage(level, 0.6, 1.6));

  // ---- Wonderlight: fireflies everywhere and a warm wash
  if (s4 > 0.01) {
    const r = rng(77);
    for (let i = 0; i < 70; i++) glowDot(ctx, 40 + r() * 520, 260 + r() * 560, 5 + r() * 4, i % 3 ? GOLD : AURORA, 0.6 * s4);
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
  }
}

function paintAmbient({ ctx, t, level, reduced, energy }: SceneryContext) {
  const s1 = stage(level, 0.2, 1);
  const s4 = stage(level, 3.3, 4);
  if (reduced) return;
  // fireflies drifting over the meadow (more as the habitat wakes)
  drift(ctx, 5, 10 + Math.round(20 * s4), t, GOLD, [60, 380, 540, 800], 8, 1.6, (0.25 + 0.35 * energy) * (0.4 + 0.6 * s1));
  // ripples running down the creek bed
  ctx.save();
  ctx.strokeStyle = rgba('#dff6ff', 0.25 + 0.3 * s1);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const y = 320 + ((t * 70 + i * 74) % 370);
    ctx.beginPath();
    ctx.moveTo(36, y);
    ctx.quadraticCurveTo(48, y + 6, 62, y);
    ctx.stroke();
  }
  ctx.restore();
}

function paintCelebrate({ ctx, t }: SceneryContext, p: number) {
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
  const g = ctx.createRadialGradient(LOG[0], LOG[1], 10, LOG[0], LOG[1], 420);
  g.addColorStop(0, rgba(MINT, 0.8));
  g.addColorStop(1, rgba(MINT, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.restore();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + t * 0.4;
    const d = 60 + p * 260;
    glowDot(ctx, LOG[0] + Math.cos(a) * d, LOG[1] + Math.sin(a) * d * 0.8, 10, [GOLD, MINT, GRASS][i % 3], 1 - p);
  }
}

// ================================================================ bumper and saucer icons

const icons: TableDef['icons'] = {
  horse(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0.3 * s, -0.9 * s);
    ctx.lineTo(0.12 * s, -0.52 * s);
    ctx.quadraticCurveTo(-0.2 * s, -0.38 * s, -0.62 * s, 0.18 * s);
    ctx.quadraticCurveTo(-0.8 * s, 0.42 * s, -0.55 * s, 0.52 * s);
    ctx.quadraticCurveTo(-0.3 * s, 0.56 * s, -0.1 * s, 0.32 * s);
    ctx.quadraticCurveTo(0.15 * s, 0.46 * s, 0.25 * s, 0.9 * s);
    ctx.lineTo(0.72 * s, 0.9 * s);
    ctx.quadraticCurveTo(0.74 * s, -0.2 * s, 0.42 * s, -0.56 * s);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(-0.06 * s, -0.16 * s, 0.07 * s, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 0.08 * s;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((0.5 + i * 0.06) * s, (-0.4 + i * 0.3) * s);
      ctx.lineTo((0.78 + i * 0.04) * s, (-0.3 + i * 0.3) * s);
      ctx.stroke();
    }
  },
  yak(ctx, s) {
    ctx.lineWidth = 0.15 * s;
    ctx.lineCap = 'round';
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(k * 0.32 * s, -0.36 * s);
      ctx.quadraticCurveTo(k * 0.85 * s, -0.42 * s, k * 0.78 * s, -0.92 * s);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0.06 * s, 0.44 * s, 0.56 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = -0.6 * s + (i / 8) * 1.2 * s;
      ctx.lineTo(x, (0.5 + (i % 2) * 0.32) * s);
    }
    ctx.lineTo(0.3 * s, 0.2 * s);
    ctx.lineTo(-0.3 * s, 0.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(k * 0.2 * s, -0.08 * s, 0.07 * s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  marmot(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(0, 0.28 * s, 0.42 * s, 0.6 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -0.45 * s, 0.34 * s, 0, TAU);
    ctx.fill();
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(k * 0.24 * s, -0.74 * s, 0.1 * s, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(k * 0.13 * s, -0.5 * s, 0.06 * s, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0.32 * s, 0.2 * s, 0.34 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  log(ctx, s) {
    ctx.lineWidth = 0.14 * s;
    for (const r of [0.85, 0.55, 0.25]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * s, 0, TAU);
      ctx.stroke();
    }
  },
};

// ================================================================ 3D attraction set

function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const tex = kit.track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A painted, extruded cut-out animal (theatre-flat style); its emissive wakes with the set. */
function cutout(kit: SetKit, pts: P2[], height: number, paint: (ctx: CanvasRenderingContext2D) => void, side: string) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -0.08);
  geo.scale(height, height, height);
  // Cap UVs are the shape's own (x, y): map x -0.8..0.9 and y -0.05..1.2 onto the painting.
  const tex = canvasTex(kit, 256, 192, (ctx) => {
    ctx.translate(0, 192);
    ctx.scale(256 / 1.7, -192 / 1.25);
    ctx.translate(0.8, 0.05);
    paint(ctx);
  });
  tex.repeat.set(1 / 1.7, 1 / 1.25);
  tex.offset.set(0.8 / 1.7, 0.05 / 1.25);
  const cap = kit.track(new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.04, roughness: 0.8 }));
  const rim = kit.track(new THREE.MeshStandardMaterial({ color: side, roughness: 0.85 }));
  const m = new THREE.Mesh(geo, [cap, rim]);
  m.castShadow = true;
  return { mesh: m, mat: cap };
}

function paintHorse(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = DUN;
  ctx.fillRect(-0.8, -0.05, 1.7, 1.25);
  ctx.fillStyle = '#e6cfa2';
  ctx.beginPath();
  ctx.ellipse(-0.02, 0.38, 0.32, 0.08, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e9dcc0';
  ctx.beginPath();
  ctx.ellipse(0.7, 0.71, 0.09, 0.06, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(-0.8, -0.05, 1.7, 0.26);
  ctx.beginPath();
  ctx.moveTo(0.2, 0.7);
  ctx.lineTo(0.34, 0.9);
  ctx.lineTo(0.45, 1.03);
  ctx.lineTo(0.42, 0.88);
  ctx.lineTo(0.3, 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-0.7, 0.1, 0.16, 0.45);
  ctx.fillStyle = '#120c08';
  ctx.beginPath();
  ctx.arc(0.57, 0.89, 0.025, 0, TAU);
  ctx.fill();
}

function paintYak(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#3a2c24';
  ctx.fillRect(-0.8, -0.05, 1.7, 1.25);
  ctx.fillStyle = '#5b463a';
  ctx.beginPath();
  ctx.ellipse(0.0, 0.55, 0.42, 0.14, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#23180f';
  ctx.lineWidth = 0.018;
  for (let x = -0.55; x < 0.5; x += 0.05) {
    ctx.beginPath();
    ctx.moveTo(x, 0.34);
    ctx.lineTo(x + 0.02, 0.12);
    ctx.stroke();
  }
  ctx.fillStyle = '#efe6d2';
  ctx.beginPath();
  ctx.moveTo(0.44, 0.68);
  ctx.lineTo(0.5, 0.86);
  ctx.lineTo(0.57, 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8cbb4';
  ctx.beginPath();
  ctx.ellipse(0.66, 0.44, 0.07, 0.1, 0.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0c0806';
  ctx.beginPath();
  ctx.arc(0.6, 0.54, 0.022, 0, TAU);
  ctx.fill();
}

/** Upright marmot (a lathe, so one mesh). */
function marmotMesh(kit: SetKit, scale: number) {
  const prof = [[0, 0], [0.1, 0.01], [0.135, 0.08], [0.13, 0.19], [0.1, 0.25], [0.085, 0.28], [0.095, 0.32], [0.09, 0.37], [0.06, 0.41], [0, 0.42]].map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
  const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#8a6440', emissive: '#ffb870', emissiveIntensity: 0.02, roughness: 0.85 }));
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), mat);
  m.castShadow = true;
  return { m, mat };
}

/** A strip of animated water along a curve on the ground (a winding creek). */
function creekRibbon(kit: SetKit, pts: V3[], width: number) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const N = 80;
  const pos = new Float32Array((N + 1) * 2 * 3);
  const uv = new Float32Array((N + 1) * 2 * 2);
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const tg = new THREE.Vector3();
  const len = curve.getLength();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tg);
    const nx = -tg.z;
    const nz = tg.x;
    const nl = Math.hypot(nx, nz) || 1;
    const w = width * (0.75 + 0.25 * Math.sin(u * 9));
    for (let k = 0; k < 2; k++) {
      const sgn = k ? 1 : -1;
      const j = (i * 2 + k) * 3;
      pos[j] = p.x + (nx / nl) * w * 0.5 * sgn;
      pos[j + 1] = p.y;
      pos[j + 2] = p.z + (nz / nl) * w * 0.5 * sgn;
      uv[(i * 2 + k) * 2] = k;
      uv[(i * 2 + k) * 2 + 1] = (u * len) / 1.6;
    }
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = canvasTex(kit, 128, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, '#16507a');
    g.addColorStop(0.5, '#2f8fc4');
    g.addColorStop(1, '#16507a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
    const r = rng(12);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(220,245,255,${0.25 + r() * 0.5})`;
      ctx.lineWidth = 2;
      const x = 14 + r() * 100;
      const y = r() * 256;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.quadraticCurveTo(x, y + 5, x + 8, y);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = kit.track(new THREE.MeshStandardMaterial({ map: tex, emissive: '#4fc3ff', emissiveMap: tex, emissiveIntensity: 0.12, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, side: THREE.DoubleSide }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  kit.add(mesh);
  kit.animate((_t, dt) => (tex.offset.y -= dt * 0.35));
  return { mesh, mat };
}

/**
 * Rounded mound with seam-safe noise. With `top`, vertex colours fade from `color` on the
 * flanks to `top` on the crown (a grassy hill); `smooth` gives soft earth instead of faceted rock.
 */
function rockyMound(kit: SetKit, r: number, h: number, seed: number, color: string, opts: { top?: string; smooth?: boolean } = {}) {
  const geo = new THREE.SphereGeometry(r, 28, 14, 0, TAU, 0, Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(p.count * 3);
  const c0 = new THREE.Color(color);
  const c1 = new THREE.Color(opts.top ?? color);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    // Noise from the direction vector (not the angle), so the crown has no radial creases.
    const nx = x / r;
    const nz = z / r;
    const u = y / r;
    const k = 1 + 0.09 * Math.sin(nx * 3.1 + seed) * Math.cos(nz * 2.7 + seed * 1.3) + 0.04 * Math.sin(nx * 7 + nz * 5 + seed);
    p.setXYZ(i, x * k, u * h * (1 + 0.08 * Math.sin(nx * 4 + nz * 3 + seed)), z * k);
    const g = Math.max(0, Math.min(1, (u - 0.55) / 0.25 + 0.12 * Math.sin(nx * 6 + nz * 5 + seed)));
    c.copy(c0).lerp(c1, g).multiplyScalar(0.9 + 0.1 * Math.sin(nx * 9 + nz * 7 + seed * 3));
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.95, flatShading: !opts.smooth }));
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Aurora curtain: an additive, gently waving shader band (only animates while visible). */
function auroraCurtain(kit: SetKit, pos: V3, w: number, h: number, rotY: number, a: string, b: string, seed: number, tilt = 0) {
  const geo = new THREE.PlaneGeometry(w, h, 48, 6);
  const uni = { time: { value: 0 }, intensity: { value: 0 }, colA: { value: new THREE.Color(a) }, colB: { value: new THREE.Color(b) }, seed: { value: seed } };
  const mat = kit.track(new THREE.ShaderMaterial({
    uniforms: uni,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: 'uniform float time; uniform float seed; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x*0.55 + time*0.6 + seed)*0.6; p.y += sin(p.x*0.9 + time*0.4 + seed)*0.25; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
    fragmentShader: 'uniform float time; uniform float intensity; uniform vec3 colA; uniform vec3 colB; uniform float seed; varying vec2 vUv; void main(){ float x = vUv.x; float folds = 0.5 + 0.25*sin(x*23.0 + sin(x*5.0 + time*0.4 + seed)*2.5) + 0.25*sin(x*41.0 - time*0.7 + seed*2.0); float streak = 0.35 + 0.65*folds*folds; float hem = 0.12 + 0.08*sin(x*9.0 + time*0.5 + seed); float base = smoothstep(hem - 0.06, hem + 0.1, vUv.y) * (1.0 - smoothstep(0.4, 1.0, vUv.y)); float edge = smoothstep(0.0, 0.15, x) * (1.0 - smoothstep(0.85, 1.0, x)); vec3 c = mix(colA, colB, smoothstep(0.25, 0.95, vUv.y)); gl_FragColor = vec4(c * streak * base * edge * intensity, 1.0); }',
  }));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  // Yaw first, then lean the curtain back so it faces the raised cabinet camera.
  m.rotation.set(tilt, rotY, 0, 'YXZ');
  m.renderOrder = -5;
  kit.add(m);
  kit.animate((t) => {
    if (uni.intensity.value > 0.005) uni.time.value = t;
  });
  return uni;
}

function wideSign(kit: SetKit, text: string, pos: V3, w: number, h: number, color: string) {
  const tex = canvasTex(kit, 2048, Math.round((2048 * h) / w), (ctx) => {
    const H = ctx.canvas.height;
    let size = Math.round(H * 0.66);
    ctx.font = `800 ${size}px "Fraunces Variable", Georgia, serif`;
    while (ctx.measureText(text).width > 1900 && size > 20) {
      size -= 4;
      ctx.font = `800 ${size}px "Fraunces Variable", Georgia, serif`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 1024, H / 2 + size * 0.04);
  });
  const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveMap: tex, emissiveIntensity: 0.1, alphaMap: tex, transparent: true, depthWrite: false }));
  const g = new THREE.Group();
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  glyph.position.z = 0.05;
  glyph.renderOrder = 3;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 1.3, 0.08), kit.mats.plastic('#16233a'));
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.05, 0.1), kit.mats.brass());
  trim.position.y = -h * 0.68;
  const trim2 = trim.clone();
  trim2.position.y = h * 0.68;
  g.add(back, glyph, trim, trim2);
  g.position.set(pos[0], pos[1], pos[2]);
  kit.add(g);
  return { g, setLit: (v: number) => (mat.emissiveIntensity = 0.08 + v * 3) };
}

/** Head-of-table panorama: the steppe at night, hills, a far herd, the moon and the aurora. */
function paintPanorama(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, mix('#0d1230', '#16205a', s4)], [0.55, mix('#1d2b55', '#2c4a7a', s2)], [0.72, mix('#2a3f52', '#3d6a6a', s2)], [1, '#16261a']]);
  ctx.fillRect(0, 0, w, h);
  stars(ctx, 9, 140, [0, 0, w, h * 0.55], IVORY);
  auroraBand(ctx, 5, 0, w, h * 0.42, h * 0.32, AURORA, VIOLET, 0.3 * s3 + 0.7 * s4);
  auroraBand(ctx, 9, w * 0.1, w * 0.9, h * 0.32, h * 0.22, MINT, '#8fb8ff', 0.6 * s4);
  glowDot(ctx, w * 0.78, h * 0.24, 120, MOON, 0.2 + 0.35 * s1);
  ctx.fillStyle = mix('#b5b096', MOON, 0.4 + 0.6 * s1);
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.24, 30, 0, TAU);
  ctx.fill();
  // mountains
  ctx.fillStyle = mix('#232c50', '#34446f', s2);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.75);
  const ridge: P2[] = [[0, 0.58], [0.1, 0.44], [0.2, 0.55], [0.3, 0.4], [0.42, 0.56], [0.52, 0.47], [0.64, 0.6], [0.74, 0.46], [0.86, 0.57], [1, 0.48]];
  for (const [x, y] of ridge) ctx.lineTo(x * w, y * h);
  ctx.lineTo(w, h * 0.75);
  ctx.closePath();
  ctx.fill();
  // rolling steppe
  for (const [base, col] of [[0.7, '#24402e'], [0.8, '#2b4f33']] as [number, string][]) {
    ctx.fillStyle = mix(col, '#3d7a44', 0.3 * s1 + 0.4 * s3);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * base + Math.sin(x / 90 + base * 9) * 14);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  // a far herd crossing the steppe, and a winding creek
  ctx.strokeStyle = rgba(WATER, 0.3 + 0.5 * s1);
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  smoothLine(ctx, [[w * 0.05, h * 0.98], [w * 0.2, h * 0.86], [w * 0.12, h * 0.8], [w * 0.3, h * 0.76]]);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = i < 3 ? 0.35 + 0.6 * s1 : i < 6 ? 0.9 * s2 : 0.9 * s3;
    if (a < 0.02) continue;
    ctx.fillStyle = rgba('#120e0c', a);
    silhouette2d(ctx, HORSE, w * (0.4 + i * 0.055), h * (0.83 + (i % 2) * 0.03), 30, 1);
    ctx.fill();
  }
  if (s4 > 0.01) {
    const r = rng(17);
    for (let i = 0; i < 90; i++) glowDot(ctx, r() * w, h * (0.55 + r() * 0.45), 4 + r() * 4, i % 2 ? GOLD : AURORA, 0.7 * s4);
  }
}

const habitatSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  kit.sky('#1b2350', '#04060c');

  // ---- Night steppe ground: a painted grass disc that brightens as the habitat wakes
  const groundTex = canvasTex(kit, 512, 512, (ctx) => {
    ctx.fillStyle = '#26361f';
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(4);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '70,96,52' : '30,44,26'},0.35)`;
      ctx.beginPath();
      ctx.arc(r() * 512, r() * 512, 20 + r() * 50, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 2200; i++) {
      ctx.strokeStyle = ['#3d5a2e', '#4b6a36', '#5f7a3c', '#2a3a20', '#6d7a44'][i % 5];
      ctx.lineWidth = 1.2;
      const x = r() * 512;
      const y = r() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6);
      ctx.stroke();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(9, 9);
  const groundMat = kit.track(new THREE.MeshStandardMaterial({ map: groundTex, color: '#9fb0a0', roughness: 0.95, emissive: '#16241a', emissiveIntensity: 0.1 }));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = gy;
  ground.receiveShadow = true;
  kit.add(ground);

  // ---- Grass tufts and creek reeds (instanced: one mesh each)
  const blades = kit.n(240);
  const bladeGeo = new THREE.ConeGeometry(0.035, 0.32, 3);
  bladeGeo.translate(0, 0.16, 0);
  const grass = new THREE.InstancedMesh(bladeGeo, kit.track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })), blades);
  const dummy = new THREE.Object3D();
  const gr = rng(21);
  const col = new THREE.Color();
  for (let i = 0; i < blades; i++) {
    const side = i % 2 ? 1 : -1;
    dummy.position.set(side * (3.75 + gr() * 5.0), gy, -6.5 + gr() * 12);
    dummy.rotation.set((gr() - 0.5) * 0.5, gr() * TAU, (gr() - 0.5) * 0.5);
    const s = 0.6 + gr() * 0.9;
    dummy.scale.set(s, s * (0.8 + gr() * 0.6), s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, col.set(['#6f9a4a', '#8fb85a', '#b5b46a', '#5a8a44'][i % 4]));
  }
  grass.castShadow = true;
  kit.add(grass);

  // ---- LEFT: a creek winding from a rocky spring past the marmot burrow and a hollow log
  const creekPath: V3[] = [[-6.6, gy + 0.02, -6.4], [-6.1, gy + 0.02, -4.6], [-6.8, gy + 0.02, -2.8], [-6.0, gy + 0.02, -0.8], [-6.7, gy + 0.02, 1.2], [-5.7, gy + 0.02, 3.2], [-6.2, gy + 0.02, 5.4], [-5.6, gy + 0.02, 7.2]];
  const creek = creekRibbon(kit, creekPath, 0.8);
  const reeds = kit.n(46);
  const reedGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.62, 4);
  reedGeo.translate(0, 0.31, 0);
  const reedMesh = new THREE.InstancedMesh(reedGeo, kit.mats.plastic('#5e8a46'), reeds);
  const headGeo = new THREE.CapsuleGeometry(0.03, 0.1, 2, 6);
  const reedHeads = new THREE.InstancedMesh(headGeo, kit.mats.plastic('#6b4328'), reeds);
  const creekCurve = new THREE.CatmullRomCurve3(creekPath.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const tmp = new THREE.Vector3();
  const rr = rng(33);
  for (let i = 0; i < reeds; i++) {
    creekCurve.getPointAt(0.08 + rr() * 0.84, tmp);
    const side = rr() < 0.5 ? -1 : 1;
    dummy.position.set(tmp.x + side * (0.42 + rr() * 0.25), gy, tmp.z + (rr() - 0.5) * 0.3);
    dummy.rotation.set((rr() - 0.5) * 0.25, 0, (rr() - 0.5) * 0.25);
    const s = 0.75 + rr() * 0.6;
    dummy.scale.set(1, s, 1);
    dummy.updateMatrix();
    reedMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = gy + 0.62 * s * Math.cos(dummy.rotation.x) - 0.02;
    dummy.position.x += Math.sin(-dummy.rotation.z) * 0.62 * s;
    dummy.position.z += Math.sin(dummy.rotation.x) * 0.62 * s;
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    reedHeads.setMatrixAt(i, dummy.matrix);
  }
  kit.add(reedMesh);
  kit.add(reedHeads);
  // the spring: stacked boulders with water spilling out
  for (const [x, z, r0, h, seed] of [[-6.9, -6.9, 0.95, 0.85, 3], [-5.9, -7.2, 0.7, 0.6, 6], [-7.7, -5.9, 0.6, 0.5, 8]] as [number, number, number, number, number][]) {
    const b = rockyMound(kit, r0, h, seed, '#5d6378');
    b.position.set(x, gy, z);
    kit.add(b);
  }
  for (const [x, z, r0, seed] of [[-7.6, -2.6, 0.42, 1], [-5.3, -0.2, 0.3, 2], [-7.5, 2.4, 0.38, 4], [-5.0, 4.6, 0.28, 5]] as [number, number, number, number][]) {
    const b = rockyMound(kit, r0, r0 * 0.75, seed, '#666c82', { smooth: true });
    b.position.set(x, gy, z);
    kit.add(b);
  }
  // marmot burrow: an earth mound with three holes facing the player; marmots play peekaboo
  const mound = rockyMound(kit, 1.05, 0.55, 7, '#7a5a3e', { top: '#5f7d3e', smooth: true });
  mound.position.set(-4.75, gy, -2.0);
  kit.add(mound);
  const holeMat = kit.track(new THREE.MeshBasicMaterial({ color: '#100804' }));
  const holes: V3[] = [[-4.35, 0.36, -1.45], [-5.15, 0.34, -1.5], [-4.8, 0.5, -2.1]];
  const marmots = holes.map((h, i) => {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), holeMat);
    hole.rotation.x = -Math.PI / 2 + 0.55;
    hole.position.set(h[0], gy + h[1], h[2]);
    kit.add(hole);
    const mm = marmotMesh(kit, 1.55 - i * 0.12);
    mm.m.position.set(h[0], gy + h[1] - 0.6, h[2] - 0.05);
    kit.add(mm.m);
    return { ...mm, base: gy + h[1] - 0.06 };
  });
  // hollow log by the creek, its open end toward the player, with eyes peeking out
  const barkTex = canvasTex(kit, 128, 256, (ctx) => {
    ctx.fillStyle = '#5a3d27';
    ctx.fillRect(0, 0, 128, 256);
    const r = rng(9);
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '30,18,10' : '120,88,58'},0.6)`;
      ctx.lineWidth = 2 + r() * 3;
      const x = r() * 128;
      ctx.beginPath();
      ctx.moveTo(x, r() * 256);
      ctx.lineTo(x + (r() - 0.5) * 6, r() * 256);
      ctx.stroke();
    }
  });
  const logMat = kit.track(new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.9, side: THREE.DoubleSide }));
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 1.8, 18, 1, true), logMat);
  log.rotation.x = Math.PI / 2;
  log.rotation.z = 0.25;
  log.position.set(-4.75, gy + 0.36, 2.9);
  log.castShadow = true;
  kit.add(log);
  const ringTex = canvasTex(kit, 128, 128, (ctx) => {
    ctx.fillStyle = '#b58a5a';
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#120a05';
    ctx.beginPath();
    ctx.arc(64, 64, 46, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,40,18,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, TAU);
    ctx.stroke();
  });
  const ringMat = kit.track(new THREE.MeshStandardMaterial({ map: ringTex, transparent: true, emissive: '#ffd59a', emissiveMap: ringTex, emissiveIntensity: 0.0 }));
  const logEnd = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), ringMat);
  logEnd.position.set(-4.75 - Math.sin(0.25) * 0.91, gy + 0.36, 2.9 + Math.cos(0.25) * 0.91);
  logEnd.rotation.y = -0.25;
  kit.add(logEnd);
  const eyeMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0 }));
  const eyes = new THREE.Group();
  for (const dx of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    eye.position.set(dx, 0, 0);
    eyes.add(eye);
  }
  eyes.position.set(-4.75 - Math.sin(0.25) * 0.8, gy + 0.33, 2.9 + Math.cos(0.25) * 0.8);
  eyes.rotation.y = -0.25;
  kit.add(eyes);
  kit.tree([-7.9, gy, -4.2], 2.4, '#3f6f4a', 3, '#4a3424');
  kit.tree([-5.0, gy, -5.8], 1.8, '#4f7f52', 8, '#4a3424');

  // ---- RIGHT: Yak Ridge with its yaks, the watering hole and the wild-horse pasture
  const ridgeA = rockyMound(kit, 1.9, 1.4, 5, '#59607c', { top: '#4f7a45' });
  ridgeA.position.set(6.9, gy, -5.1);
  kit.add(ridgeA);
  const ridgeB = rockyMound(kit, 1.25, 0.75, 9, '#5f6884', { top: '#5a8248' });
  ridgeB.position.set(5.0, gy, -5.6);
  kit.add(ridgeB);
  const yakSpots: [number, number, number, number, number][] = [[6.3, gy + 1.05, -4.3, 0.74, -0.5], [7.6, gy + 1.0, -4.3, 0.66, 0.45], [4.8, gy + 0.55, -5.0, 0.6, -0.2]];
  const yaks = yakSpots.map(([x, y, z, s, ry]) => {
    const c = cutout(kit, YAK, s, paintYak, '#2a1f18');
    c.mesh.position.set(x, y - 0.7, z);
    c.mesh.rotation.y = ry;
    kit.add(c.mesh);
    return { ...c, y };
  });
  const pondMat = kit.track(new THREE.MeshStandardMaterial({ color: '#1d5f8c', emissive: '#4fc3ff', emissiveIntensity: 0.08, roughness: 0.08, metalness: 0.2 }));
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1.2, 40).rotateX(-Math.PI / 2), pondMat);
  pond.scale.set(1.25, 1, 0.8);
  pond.position.set(6.1, gy + 0.015, 0.9);
  kit.add(pond);
  // the herd: five wild horses, hidden in the tall grass until the habitat wakes
  const homes: [number, number, number, number][] = [[4.7, -1.5, 0.95, 0.3], [7.2, -0.6, 0.85, 2.7], [5.3, 3.0, 0.92, -0.4], [7.3, 2.6, 0.78, 3.5], [6.2, 4.6, 0.68, 0.8]];
  const horses = homes.map(([x, z, s, ry], i) => {
    const c = cutout(kit, HORSE, s, paintHorse, '#4a3524');
    c.mesh.position.set(x, gy - 1, z);
    c.mesh.rotation.y = ry;
    kit.add(c.mesh);
    return { ...c, x, z, ry, show: 0.2 + i * 0.7, phase: i * (TAU / 5) };
  });
  kit.tree([8.0, gy, 3.8], 1.9, '#4a7a4c', 12, '#4a3424');

  // ---- Resource signs on posts, tilted back toward the player (they light as needs are met)
  const signWater = kit.neonSign('WATER', [-6.2, 1.75, 0.9], { height: 0.4, color: WATER, rotY: 0.35 });
  const signShelter = kit.neonSign('SHELTER', [-4.75, 1.85, -3.3], { height: 0.38, color: '#f0b880', rotY: 0.3 });
  const signFood = kit.neonSign('FOOD', [4.35, 1.8, 1.5], { height: 0.42, color: GRASS, rotY: -0.3 });
  const signSpace = kit.neonSign('SPACE', [4.7, 1.75, -2.8], { height: 0.38, color: CORAL, rotY: -0.3 });
  for (const s of [signFood, signWater, signShelter, signSpace]) s.rotation.x = -0.6;
  kit.pole([-6.2, 0, 1.0], 1.45);
  kit.pole([-4.75, 0, -3.2], 1.55);
  kit.pole([4.3, 0, 1.6], 1.5);
  kit.pole([4.7, 0, -2.7], 1.45);

  // ---- Festoons between the sign posts: the seekers' path lights up mission by mission
  const festoonL = kit.stringLights([-4.75, 1.55, -3.2], [-6.2, 1.42, 1.0], 0.35, kit.n(12), [GOLD, MINT, '#f0b880']);
  const festoonR = kit.stringLights([4.7, 1.42, -2.7], [4.3, 1.48, 1.6], 0.35, kit.n(12), [GOLD, CORAL, GRASS]);

  // ---- Seekers' lanterns along the front
  const lanterns = ([[-4.2, 0.5, 5.0, GOLD], [4.2, 0.5, 5.0, GOLD], [-4.1, 0.45, 0.6, MINT], [4.1, 0.45, -0.2, MINT]] as [number, number, number, string][]).map(([x, y, z, c]) => kit.lantern([x, y, z], c, 0.15));

  // ---- Head: painted panorama, the marquee, the moon and the aurora in the top corners
  const pano = kit.backdrop(paintPanorama, { width: 26, height: 10, z: -15, y: 3.8 });
  const marquee = wideSign(kit, 'HABITAT HIDE-AND-SEEK', [0, 1.3, -7.2], 5.2, 0.6, GOLD);
  marquee.g.rotation.x = -0.72;
  const moonHalo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2), kit.track(new THREE.MeshBasicMaterial({ map: canvasTex(kit, 128, 128, (ctx) => glowDot(ctx, 64, 64, 64, MOON, 0.95)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2 })));
  moonHalo.position.set(6.4, gy + 0.03, 0.7);
  moonHalo.scale.set(1, 1, 0.7);
  kit.add(moonHalo);
  const auroraA = auroraCurtain(kit, [-6.5, 0.9, -6.2], 6.6, 2.8, 0.3, AURORA, VIOLET, 1, -0.6);
  const auroraB = auroraCurtain(kit, [6.5, 1.1, -5.6], 6.2, 2.8, -0.4, MINT, '#8fb8ff', 4, -0.6);
  const fireflies = kit.motes({ x0: -9, x1: 9, y0: -0.2, y1: 2.2, z0: -7, z1: 6 }, 200, GOLD, { speed: 0.08, size: 0.2 });
  const glimmers = kit.motes({ x0: -8, x1: -4, y0: -0.3, y1: 0.4, z0: -6, z1: 6 }, 40, '#bfe9ff', { speed: 0.04, size: 0.08 });

  // ---- Lights (three): moonlight over the creek, a warm lantern over the pasture, a finale glow.
  //      At the Wonderlight the two spots sweep the habitat like seekers' searchlights.
  const moonSpot = kit.spot([-4.6, 7, 3], [-5.8, 0, -1], '#b8ccff', 26, 0.55);
  const warmSpot = kit.spot([4.8, 7, 3.4], [6.1, 0, 0.6], '#ffd9a0', 24, 0.55);
  const glow = kit.point([0, 3.0, 6.5], GOLD, 0, 16);

  let gallop = 0;
  let sweep = 0;
  let party = 0;
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.8);
      const s1 = kit.stage(level, 0.2, 1);
      const s2 = kit.stage(level, 1.2, 2);
      const s3 = kit.stage(level, 2.2, 3);
      const s4 = kit.stage(level, 3.3, 4);
      pano.repaint(level);
      groundMat.emissiveIntensity = 0.08 + 0.12 * s1 + 0.12 * s3 + 0.2 * s4;
      creek.mat.emissiveIntensity = 0.1 + 0.8 * s1 + 0.5 * s4 * (0.85 + 0.15 * energy);
      pondMat.emissiveIntensity = 0.06 + 0.6 * s1 + 0.4 * s4;
      signWater.setLit(0.15 + 0.85 * s1);
      signFood.setLit(0.15 + 0.85 * s1);
      signShelter.setLit(0.15 + 0.85 * s1);
      signSpace.setLit(0.12 + 0.88 * s3);
      marquee.setLit(0.15 + 0.85 * kit.stage(level, 0.4, 1.6));
      const twinkle = kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 3);
      festoonL.setLit((0.1 + 0.5 * s1 + 0.4 * s4) * twinkle);
      festoonR.setLit((0.1 + 0.5 * s2 + 0.4 * s4) * twinkle);
      for (let i = 0; i < lanterns.length; i++) lanterns[i].setLit(0.55 * Math.max(0.15 * s0, kit.stage(level, 0.3 + i * 0.7, 1.1 + i * 0.7)));
      (moonHalo.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.3 * s1 + 0.3 * s4;
      auroraA.intensity.value = 0.25 * s3 + 1.25 * s4 + 0.5 * party;
      auroraB.intensity.value = 0.2 * s3 + 1.15 * s4 + 0.5 * party;
      fireflies.setLit(0.08 + 0.3 * s1 + 0.62 * s4);
      glimmers.setLit(0.1 + 0.6 * s1);
      ringMat.emissiveIntensity = 0.05 + 0.5 * s1;
      eyes.visible = level > 0.3;
      eyeMat.opacity = s1 * (kit.reducedMotion ? 1 : 0.55 + 0.45 * Math.sin(t * 0.7) ** 2);
      if (glow) glow.intensity = 6 * s4 + 1.2 * s2 + 4 * party;
      // seekers' searchlights sweep the habitat once the Wonderlight is earned
      if (!kit.reducedMotion) sweep += dt * (0.5 * s4 + party);
      if (moonSpot) moonSpot.target.position.set(-5.8 + Math.sin(sweep) * 1.4 * s4, 0, -1 + Math.cos(sweep * 0.7) * 3 * s4);
      if (warmSpot) warmSpot.target.position.set(6.1 + Math.cos(sweep * 0.8) * 1.4 * s4, 0, 0.6 + Math.sin(sweep * 0.6) * 3 * s4);
      // hide-and-seek: marmots pop out of the burrow as needs are met, then play peekaboo
      for (let i = 0; i < marmots.length; i++) {
        const mm = marmots[i];
        const show = kit.stage(level, 0.2 + i * 0.35, 0.9 + i * 0.35);
        const peek = kit.reducedMotion ? 0 : Math.max(0, Math.sin(t * 1.6 + i * 2.1)) * 0.1 * (s4 + party);
        mm.m.position.y = mm.base - 0.6 * (1 - show) + peek;
        mm.mat.emissiveIntensity = 0.02 + 0.12 * show;
      }
      // yaks climb onto the ridge with the competition mission
      for (let i = 0; i < yaks.length; i++) {
        const y = yaks[i];
        const show = kit.stage(level, 0.9 + i * 0.3, 1.6 + i * 0.3);
        y.mesh.position.y = y.y - 0.7 * (1 - show);
        y.mat.emissiveIntensity = 0.03 + 0.3 * show;
      }
      // the herd rises out of the tall grass level by level; at the Wonderlight it gallops
      if (!kit.reducedMotion) gallop += dt * (0.32 * s4 + 0.5 * party);
      for (let i = 0; i < horses.length; i++) {
        const h = horses[i];
        const show = kit.stage(level, h.show, h.show + 0.6);
        const a = gallop + h.phase;
        const lx = 5.7 + Math.cos(a) * 1.45;
        const lz = 1.4 + Math.sin(a) * 2.6;
        const bob = kit.reducedMotion ? 0 : Math.abs(Math.sin(t * 7 + i)) * 0.06 * s4;
        h.mesh.position.set(h.x + (lx - h.x) * s4, gy - 1 * (1 - show) + bob, h.z + (lz - h.z) * s4);
        h.mesh.rotation.y = s4 > 0.5 ? Math.atan2(-Math.cos(a) * 2.6, -Math.sin(a) * 1.45) : h.ry;
        h.mat.emissiveIntensity = 0.04 + 0.26 * show;
      }
    },
    celebrate(p) {
      party = Math.sin(p * Math.PI);
      fireflies.setLit(0.4 + 0.6 * party);
    },
  };
};

// ================================================================ dollhouse room

const habitatRoom: RoomBuilder = ({ kit }) => {
  const turf = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.08, 28), kit.mats.plastic('#3f6a36'));
  turf.scale.set(1, 1, 0.85);
  turf.position.set(0, 0.04, 0);
  kit.add(turf);
  // the marmot's burrow mound, with the hole it pops out of
  const mound = rockyMound(kit, 0.38, 0.22, 2, '#7a5a3e', { top: '#5f7d3e', smooth: true });
  mound.position.set(-0.45, 0.08, -0.25);
  kit.add(mound);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14), kit.track(new THREE.MeshBasicMaterial({ color: '#100804' })));
  hole.rotation.x = -Math.PI / 2 + 0.5;
  hole.position.set(-0.4, 0.24, -0.08);
  kit.add(hole);
  const mm = marmotMesh(kit, 0.5);
  mm.m.position.set(-0.4, 0.12, -0.1);
  kit.add(mm.m);
  // a dun wild horse and a yak sharing the same patch of grass
  const horse = cutout(kit, HORSE, 0.42, paintHorse, '#4a3524');
  horse.mesh.position.set(0.35, 0.08, 0.05);
  horse.mesh.rotation.y = -0.4;
  kit.add(horse.mesh);
  const yak = cutout(kit, YAK, 0.34, paintYak, '#2a1f18');
  yak.mesh.position.set(0.55, 0.08, -0.5);
  yak.mesh.rotation.y = 2.6;
  kit.add(yak.mesh);
  // a little hollow log at the front left
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.3, 12, 1, true), kit.track(new THREE.MeshStandardMaterial({ color: '#6b4a30', roughness: 0.9, side: THREE.DoubleSide })));
  log.rotation.set(Math.PI / 2, 0, 0.9);
  log.position.set(-0.78, 0.14, 0.5);
  kit.add(log);
  // grass blades and the creek
  const n = 36;
  const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(0.012, 0.12, 3).translate(0, 0.06, 0), kit.mats.plastic('#8fb85a'), n);
  const d = new THREE.Object3D();
  const r = rng(5);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const rad = 0.3 + r() * 0.55;
    d.position.set(Math.cos(a) * rad, 0.08, Math.sin(a) * rad * 0.8);
    d.rotation.set((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4);
    d.updateMatrix();
    blades.setMatrixAt(i, d.matrix);
  }
  kit.add(blades);
  const creek = creekRibbon(kit, [[-0.95, 0.09, 0.6], [-0.4, 0.09, 0.35], [0.1, 0.09, 0.55], [0.9, 0.09, 0.4]], 0.18);
  const moon = kit.orb([0.7, 1.35, -0.65], 0.12, MOON);
  const lamp = kit.lantern([0.82, 0.22, 0.45], GOLD, 0.06);
  const flies = kit.cloudOfPoints([0, 0.7, 0], 0.6, 40, GOLD);
  return {
    update(t, lit) {
      moon.setLit(0.3 + 0.7 * lit);
      lamp.setLit(lit * 0.7);
      flies.setLit(lit * 0.9);
      flies.rotation.y = kit.reducedMotion ? 0 : t * 0.2;
      creek.mat.emissiveIntensity = 0.1 + 0.8 * lit;
      horse.mat.emissiveIntensity = 0.04 + 0.3 * lit;
      yak.mat.emissiveIntensity = 0.04 + 0.3 * lit;
      mm.mat.emissiveIntensity = 0.02 + 0.3 * lit;
      // hide-and-seek: the marmot peeks out more often as the room wakes
      mm.m.position.y = 0.04 + 0.1 * lit + (kit.reducedMotion ? 0 : Math.max(0, Math.sin(t * 1.4)) * 0.05 * lit);
    },
  };
};

// ================================================================ the attraction

export const L20: TableDef = {
  lessonId: 'L20',
  signature: 'The Herd Gauge: the herd grows only as far as its scarcest resource allows, and never past its space',
  ballRole: 'The Wonderball is a game token, not an animal, and the Herd Gauge is sped up: real herds change over months and years as animals are born, die, or move in and out.',
  theme: {
    bg: ['#22285a', '#16301f'],
    rail: '#d8cfa8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#f4e2b8',
    bumperRing: '#3d5a2c',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(92,200,240,0.2)',
    trail: MINT,
  },
  lines: {
    intro: "Welcome to Habitat Hide-and-Seek! Every creature here makes its home where its needs are met, so let's seek out what each one needs.",
    quark: '"The meadow keeps growing grass, so the herd can keep growing too, forever and ever. Right?" Professor Quark wonders aloud.',
    pipTip: 'Flip straight up from the left flipper to ride the Creek Ramp. From the right flipper, straight up drops into the Hollow Log.',
  },
  build,
  skillShot: 'need_co2',
  shots: [
    { id: 'creek', label: 'Creek Ramp', on: [{ type: 'ramp', id: 'creek_ramp' }], insert: 'ins_creek' },
    { id: 'graze', label: 'Meadow Grass', on: [{ type: 'drop', group: 'grass' }], insert: 'ins_graze' },
    { id: 'herd', label: 'Herd Count', on: [{ type: 'spinner', id: 'herd_spinner' }], insert: 'ins_herd' },
    { id: 'burrow', label: 'Marmot Burrow', on: [{ type: 'saucer', id: 'burrow' }], insert: 'ins_burrow' },
    { id: 'pocket', label: 'Hollow Log', on: [{ type: 'saucer', id: 'hollow_log' }], insert: 'ins_pocket' },
    { id: 'yaks', label: 'Yak Ridge', on: [{ type: 'target', group: 'yaks' }], insert: 'ins_yaks' },
    { id: 'grazers', label: 'Grazers', on: [{ type: 'bumper', group: 'grazers' }], insert: 'ins_grazers' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Two Shopping Lists',
      brief: "Find what a wild horse needs, then what a marmot needs. Both eat grass, but their lists aren't the same!",
      objectiveIds: ['L20-O1'],
      stages: [
        { kind: 'shots', text: "Horse's list: graze the GRASS, drink at the CREEK", shots: ['graze', 'creek'], order: 'any' },
        { kind: 'shots', text: "Marmot's list: GRASS too, plus a safe BURROW", shots: ['graze', 'burrow'], order: 'any' },
        { kind: 'discover', text: 'Seek the Hollow Log to compare the lists', pocket: 'hollow_log', questions: 1 },
      ],
      discovery: "Each species needs its own mix of resources. Horses and marmots both need grass and water, but marmots also need burrows. Grass doesn't eat at all: it makes its own food from water and CO₂ using sunlight's energy.",
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Not Enough to Go Around',
      brief: 'Yaks and horses share one meadow. Watch the Herd Gauge, find the scarcer resource, and feed it.',
      objectiveIds: ['L20-O2', 'L20-O5'],
      stages: [
        { kind: 'collect', text: 'Yaks move in: find both YAK herds on the ridge', match: { type: 'target', group: 'yaks' }, count: 2, distinct: true, lamps: ['yak_a', 'yak_b'] },
        { kind: 'collect', text: 'Find the limit: feed the flashing, scarcer resource 2×', match: { type: 'shot', group: 'limit' }, count: 2, preview: ['graze', 'creek'] },
        { kind: 'discover', text: 'Seek the Hollow Log to explain the limit', pocket: 'hollow_log', questions: 1, types: ['classify', 'single'] },
      ],
      discovery: 'When living things need the same limited resource, they compete. Yaks and horses are two populations sharing one meadow: when grass is scarce, each leaves less for the other, so fewer of each can survive.',
      reward: 'jackpot',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'A Run of Wet Years',
      brief: 'Bring rain to the creek, grow the grass, then count the herd. Can it keep growing forever?',
      objectiveIds: ['L20-O3', 'L20-O4'],
      stages: [
        { kind: 'collect', text: 'Two wet years: run the CREEK twice', match: { type: 'ramp', id: 'creek_ramp' }, count: 2, preview: ['creek'] },
        { kind: 'shots', text: 'Grow the GRASS, then take a HERD COUNT', shots: ['graze', 'herd'], order: 'sequence' },
        { kind: 'discover', text: 'Seek the Hollow Log to predict the herd', pocket: 'hollow_log', questions: 1, types: ['numeric', 'single'] },
      ],
      discovery: 'Measured data show a pattern: wetter years tend to grow more grass. Grass needs water and horses eat grass, so more rain can mean more horses. But no herd grows forever: water, space or food runs short.',
      reward: 'multiball',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Everyone Found',
    brief: 'Seek every corner of the habitat, then bring the Wonderball home to the Hollow Log.',
    stages: [
      { kind: 'shots', text: 'Seek them all: Creek, Grass, Herd Count, Burrow', shots: ['creek', 'graze', 'herd', 'burrow'], order: 'any' },
      { kind: 'discover', text: 'Final seek: the Hollow Log', pocket: 'hollow_log', questions: 2, objectiveIds: ['L20-O1', 'L20-O2', 'L20-O3', 'L20-O4', 'L20-O5'] },
    ],
    celebration: 'Every need is met and every hider is found: the herd gallops under the aurora and the Habitat Wonderlight glows!',
  },
  onProgress(rt, { slot, stage: st }) {
    const g = rt.find<HerdGauge>('herd_gauge');
    if (g) g.hint = slot === 1 && st === 1;
  },
  set: habitatSet,
  room: habitatRoom,
  icons,
  scenery: {
    backdrop({ ctx, level }) {
      paintPlayfield(ctx, level);
    },
    ambient: paintAmbient,
    celebrate: paintCelebrate,
  },
};
export default L20;
