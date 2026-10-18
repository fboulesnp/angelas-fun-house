// Lesson 27 — Biodiversity — "Biodiversity Lantern Festival"
// A night garden where every lantern stands for one KIND of living thing. Three lantern beds
// (the low-diversity tundra, the middling kelp forest and the high-diversity rainforest) feed the
// Lantern Census, a board that counts kinds, not visits. The Tundra Trail drops the Wonderball
// into the Lantern Lift and onto the Lantern Launcher, an upper flipper that fires up the Lantern
// Gap into the rainforest canopy. The Festival Ramp curls over the top-left into the Tundra Trail,
// so one combo tours all three beds. The Moon Gate is the Wonder Pocket.

import type * as THREE from 'three';
import { FRAME, type TableBuilder, type Pt } from '../game/table/builder.ts';
import { Insert, Mechanism, type Diverter, type Rollover } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import {
  TAU, drift, glowDot, leafShape, mix, neonPath, neonText, rgba, rng, rrect, stage, stars, stringLights, vgrad,
} from '../game/render/art.ts';

const NIGHT = '#17184a';
const DEEP = '#0a1424';
const GOLD = '#FFC75B';
const AMBER = '#FFB35C';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const ICE = '#BFE6FF';
const AURORA = '#7CF2C8';
const AURORA2 = '#A98BFF';
const KELP = '#B9D45A';
const LEAF = '#3FAF62';
const ORCHID = '#FF8FD0';
const URCHIN = '#8B5CF0';

// ---------------------------------------------------------------- lanterns (one per kind of life)

type Bed = 'tundra' | 'kelp' | 'rainforest';
interface LanternSpec {
  id: string;
  label: string;
  bed: Bed;
  color: string;
}
/** Every lantern is a different kind of organism; each bed holds as many kinds as its natural level. */
const LANTERNS: LanternSpec[] = [
  { id: 'lan_fox', label: 'FOX', bed: 'tundra', color: '#DDF1FF' },
  { id: 'lan_gull', label: 'GULL', bed: 'tundra', color: '#9FD4FF' },
  { id: 'lan_kelp', label: 'KELP', bed: 'kelp', color: '#C6E26A' },
  { id: 'lan_fish', label: 'FISH', bed: 'kelp', color: '#5FE0E8' },
  { id: 'lan_crab', label: 'CRAB', bed: 'kelp', color: '#FF8A5C' },
  { id: 'lan_orchid', label: 'ORCHID', bed: 'rainforest', color: '#FF8FD0' },
  { id: 'lan_beetle', label: 'BEETLE', bed: 'rainforest', color: '#B98CFF' },
  { id: 'lan_frog', label: 'FROG', bed: 'rainforest', color: '#7CF29A' },
  { id: 'lan_toucan', label: 'TOUCAN', bed: 'rainforest', color: '#FFC75B' },
  { id: 'lan_sloth', label: 'SLOTH', bed: 'rainforest', color: '#F0B987' },
];
const LANTERN_BY_ID = new Map(LANTERNS.map((l) => [l.id, l]));
const bedIds = (bed: Bed) => LANTERNS.filter((l) => l.bed === bed).map((l) => l.id);
const BED_COLOR: Record<Bed, string> = { tundra: ICE, kelp: '#5FE0C8', rainforest: LEAF };
/** Census board columns (x) and the lowest lamp row (y): one lamp per kind, stacked like bars. */
const CENSUS_X: Record<Bed, number> = { tundra: 248, kelp: 286, rainforest: 324 };
const CENSUS_Y = 784;
const CENSUS_STEP = 17;

/**
 * The Lantern Census (signature): a board of lamps that counts KINDS, not visits. A kind's lamp
 * lights the first time its lantern is lit and stays counted, so the three columns grow into a
 * bar chart of each bed's variety; counted lanterns keep glowing on the playfield. With the otters
 * gone the kelp column goes dark (and kelp lanterns cannot be counted) until the kelp regrows.
 * While the rescue plans are judged, the kelp column acts out each test: replanted kelp flares
 * and is grazed away again, while protecting the otters brings it back for good.
 */
class LanternCensus extends Mechanism {
  readonly kind = 'census';
  readonly counted = new Set<string>();
  kelp: 'normal' | 'barren' | 'recovering' = 'normal';
  private judging = false;
  private planA = 0;
  private planB = false;
  private lamps: { spec: LanternSpec; ins: Insert; roll: Rollover }[] = [];
  private t = 0;
  constructor(rt: TableRuntime, id: string) {
    super(rt, id);
  }
  attach(spec: LanternSpec, ins: Insert, roll: Rollover) {
    this.lamps.push({ spec, ins, roll });
  }
  setKelp(state: 'normal' | 'barren' | 'recovering') {
    if (state === 'barren' && this.kelp !== 'barren') for (const id of bedIds('kelp')) this.counted.delete(id);
    this.kelp = state;
  }
  setJudging(on: boolean) {
    if (on === this.judging) return;
    this.judging = on;
    this.planA = 0;
    this.planB = false;
  }
  update(dt: number) {
    super.update(dt);
    this.t += dt;
    this.planA = Math.max(0, this.planA - dt);
    for (const e of this.rt.events) {
      if (e.type === 'rollover') {
        const spec = LANTERN_BY_ID.get(e.id);
        if (spec && !(spec.bed === 'kelp' && this.kelp === 'barren')) this.counted.add(e.id);
      } else if (this.judging && e.type === 'target') {
        if (e.id === 'kelp_target') this.planA = 3;
        if (e.id === 'otter_target') this.planB = true;
      }
    }
    const full = this.counted.size === LANTERNS.length;
    let k = 0;
    for (let i = 0; i < this.lamps.length; i++) {
      const { spec, ins, roll } = this.lamps[i];
      const on = this.counted.has(spec.id);
      const kelpDark = spec.bed === 'kelp' && this.kelp === 'barren';
      if (spec.bed === 'kelp' && this.judging) {
        // Plan A: the bed flares as kelp is replanted, then the urchins graze it away top-down.
        // Plan B: with otters protected, the kelp stays.
        const row = k++;
        const a = this.planA > 0 ? (this.planA > 2.2 ? 'flash' : this.planA > 0.6 + row * 0.5 ? 'on' : 'off') : 'off';
        ins.lamp = this.planB ? 'pulse' : a;
      } else if (kelpDark) ins.lamp = 'off';
      else if (spec.bed === 'kelp' && this.kelp === 'recovering') ins.lamp = on ? 'pulse' : 'off';
      // A full census runs a slow chase up the columns.
      else if (full) ins.lamp = Math.floor(this.t * 3 - i * 0.4) % 4 === 0 ? 'flash' : 'on';
      else ins.lamp = on ? 'on' : 'off';
      // The lantern itself keeps glowing once its kind is counted (mission flashes take precedence).
      if (roll.lamp !== 'flash') roll.lamp = kelpDark ? 'off' : on ? 'on' : 'off';
    }
  }
}

// ---------------------------------------------------------------- playfield geometry

/** Kelp Current funnel: a straight slanted inner wall, wide at the mouth for left-flipper shots. */
const KELP_FUNNEL: Pt[] = [[436, 590], [486, 352]];
const FUNNEL_LEN = Math.hypot(KELP_FUNNEL[1][0] - KELP_FUNNEL[0][0], KELP_FUNNEL[1][1] - KELP_FUNNEL[0][1]);
/** Point on the funnel's outer (left) face, `s` units up from the mouth, standing `off` units proud. */
function funnelFace(s: number, off: number): Pt {
  const ux = (KELP_FUNNEL[1][0] - KELP_FUNNEL[0][0]) / FUNNEL_LEN;
  const uy = (KELP_FUNNEL[1][1] - KELP_FUNNEL[0][1]) / FUNNEL_LEN;
  return [KELP_FUNNEL[0][0] + ux * s + uy * off, KELP_FUNNEL[0][1] + uy * s - ux * off];
}
/** Kelp bed, bottom to top: the keystone otter, the urchin bank, the kelp habitat target. */
const FACE = { otter: 12, urchins: 58, kelp: 166 };

/** Moon Gate (the Wonder Pocket): a ring open at the bottom. */
const MOON: Pt = [318, 466];

/**
 * Festival Ramp: a short climb up the left-centre that curls over the top-left and drops the
 * Wonderball into the head of the Tundra Trail, so every ride also lights FOX and GULL and lands
 * on the Lantern Launcher. The Launcher then fires up the Lantern Gap (between the trail and the
 * ramp) into the rainforest canopy: one combo tours all three beds.
 */
const RAMP_PATH: Pt[] = [
  [196, 566], [195, 500], [192, 430], [184, 362], [166, 304], [136, 268], [100, 258], [70, 272], [52, 302], [48, 336],
];
/** Ice chute under the Launcher: a missed flip is turned back into the left inlane. */
const CHUTE: Pt[] = [[178, 676], [190, 708], [184, 742], [164, 768], [136, 786]];
const CANOPY_GUIDES = [197, 243, 289, 335, 381, 427];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'right' });
  const rolls = new Map<string, Rollover>();
  const lantern = (id: string, x: number, y: number, opts: { role?: 'lane' | 'star'; r?: number } = {}) => {
    const spec = LANTERN_BY_ID.get(id)!;
    const r = b.rollover(id, x, y, { group: spec.bed, label: spec.label, role: opts.role, r: opts.r });
    r.lampColor = spec.color;
    rolls.set(id, r);
    return r;
  };

  // --- Tundra Trail: a one-way lane down the left side. Orbits, full plunges and Festival Ramp
  // rides roll past the FOX and GULL lanterns into the Lantern Lift, which sets the Wonderball on
  // the Lantern Launcher (upper flipper).
  b.wall([[86, 352], [86, 548], [68, 580], [68, 590]], { id: 'trail_inner', r: 3 });
  b.post(86, 348, 5, { id: 'trail_cap' });
  b.post(68, 594, 5, { id: 'trail_foot' });
  // The trail lanterns' switches span the whole lane, so a ball hugging the wall still lights them.
  b.shotSwitch('trail_sw', 55, 392, 90, { r: 22 });
  lantern('lan_fox', 55, 446, { r: 21 });
  lantern('lan_gull', 55, 514, { r: 21 });
  const lift = b.saucer('lantern_lift', 46, 614, { ejectDeg: 35, ejectSpeed: 160, captureMaxSpeed: 4200 });
  lift.autoEjectDelay = 0.55;
  // The ice floor meets the flipper's top surface at its rest angle (like an inlane guide), so the
  // ball rolls straight onto the Launcher; hold the flipper up to cradle it in the corner.
  b.wall([[FRAME.left, 628], [80, 660]], { id: 'ice_floor', r: 3 });
  b.flipper('flipper_upper', 76, 668, 'left', { length: 72, restDeg: 30, upDeg: -28 });
  b.curve(CHUTE, { id: 'ice_chute', r: 4 });
  // The Breathing Hole (a seal's hole in the ice) catches every ball coming into the left inlane
  // and lets it drop gently onto the flipper, so a missed Launcher flip becomes a calm, catchable feed.
  const hole = b.saucer('breathing_hole', 83, 818, { ejectDeg: 90, ejectSpeed: 30, captureMaxSpeed: 3200 });
  hole.autoEjectDelay = 0.3;

  // --- Canopy Gate: a blade at the top-left of the arch. Open, it lies outside the arch and orbits
  // run on to the Tundra Trail; closed, it turns them down into the canopy lanes.
  b.diverter('canopy_gate', [176.5, 38], 70, 200, 65);

  // --- Canopy lanes: five rainforest lanterns.
  for (const gx of CANOPY_GUIDES) {
    b.wall([[gx, 118], [gx, 166]], { r: 3 });
    b.post(gx, 116, 4);
  }
  bedIds('rainforest').forEach((id, i) => lantern(id, (CANOPY_GUIDES[i] + CANOPY_GUIDES[i + 1]) / 2, 142));

  // --- Fig-tree pop bumpers: three trees, one kind.
  b.bumper('tree_1', 256, 236, { group: 'canopy', r: 25, label: 'FIG' });
  b.bumper('tree_2', 372, 236, { group: 'canopy', r: 25, label: 'FIG' });
  b.bumper('tree_3', 314, 312, { group: 'canopy', r: 25, label: 'FIG' });

  // --- Festival Ramp with a flared mouth; its left flare stays clear of the Lantern Gap.
  b.wall([[178, 566], [148, 596]], { r: 3, id: 'ramp_flare_l' });
  b.wall([[214, 566], [238, 622]], { r: 3, id: 'ramp_flare_r' });
  b.ramp('festival_ramp', { path: RAMP_PATH, width: 36, footprintTo: 2, peak: 74, label: 'FESTIVAL RAMP' });
  // Lantern Gap deflector: turns Launcher shots up and right toward the fig trees and the canopy lanes.
  b.curve([[90, 330], [100, 280], [120, 240], [150, 214], [180, 204]], { r: 3, id: 'gap_deflector' });
  // A peaked roof over the end of the ramp's footing sheds falling balls to either side.
  b.wall([[170, 425], [192, 409], [214, 423]], { r: 3, id: 'ramp_roof' });
  // Habitat target beside the ramp mouth: the ramp leads to the tundra.
  b.target('tundra_target', [244, 632], [262, 664], { group: 'habitat', label: 'TUNDRA' });

  // --- Moon Gate (Wonder Pocket): a ring open at the bottom.
  b.arc(MOON[0], MOON[1], 30, 150, 390, { r: 4, segments: 18, id: 'moon_ring' });
  // Garden-path flares under the gate funnel near misses into the opening.
  b.wall([[MOON[0] - 26, MOON[1] + 15], [MOON[0] - 44, MOON[1] + 46]], { id: 'moon_flare_l', r: 3 });
  b.wall([[MOON[0] + 26, MOON[1] + 15], [MOON[0] + 44, MOON[1] + 46]], { id: 'moon_flare_r', r: 3 });
  b.saucer('moon_gate', MOON[0], MOON[1], { role: 'pocket', ejectDeg: 100, ejectSpeed: 720, captureMaxSpeed: 3000, label: 'MOON GATE', icon: 'moon' });
  // Tilted so nothing can rest on it.
  b.target('rain_target', [290, 372], [342, 386], { group: 'habitat', label: 'RAINFOREST' });

  // --- Kelp Current: a funnel-mouthed right orbit with a spinner and a kelp lantern.
  b.wall(KELP_FUNNEL, { id: 'kelp_funnel', r: 3 });
  b.post(KELP_FUNNEL[1][0], KELP_FUNNEL[1][1] - 4, 5, { id: 'kelp_cap' });
  b.post(KELP_FUNNEL[0][0], KELP_FUNNEL[0][1] + 2, 5, { id: 'kelp_lip' });
  b.spinner('kelp_spinner', [478, 404], [545, 404], { label: 'KELP' });
  // The switch spans the whole channel: flipper shots meet the outer wall and ride up it, so a
  // narrow switch in the middle missed about a third of real orbits.
  b.shotSwitch('kelp_sw', 504, 468, -90, { r: 30 });
  lantern('lan_kelp', 506, 540);
  // One-way flap: returns are turned back into play, the right kickback fires up through it.
  b.gate('kelp_flap', [FRAME.laneSep, 652], [512, 702], -90);
  // Kelp bed on the funnel's outer face.
  b.target('otter_target', funnelFace(FACE.otter, 8), funnelFace(FACE.otter + 36, 8), { group: 'keystone', label: 'OTTER' });
  const u0 = funnelFace(FACE.urchins, 9);
  b.dropBank('urchins', u0[0], u0[1], (Math.atan2(KELP_FUNNEL[1][1] - KELP_FUNNEL[0][1], KELP_FUNNEL[1][0] - KELP_FUNNEL[0][0]) * 180) / Math.PI, 3, { size: 26, gap: 5, group: 'urchins', labels: ['U', 'U', 'U'] });
  b.target('kelp_target', funnelFace(FACE.kelp, 8), funnelFace(FACE.kelp + 36, 8), { group: 'habitat', label: 'KELP' });
  lantern('lan_fish', 404, 616, { role: 'star' });
  lantern('lan_crab', 402, 370, { role: 'star' });

  // --- Inserts that preview shots
  b.insert('ins_ramp', 196, 606, { deg: -90, label: 'FESTIVAL' });
  b.insert('ins_kelp', 470, 690, { deg: -60, label: 'KELP CURRENT' });
  b.insert('ins_pocket', 318, 560, { deg: -90 });
  b.insert('ins_otter', 410, 566, { deg: -8, size: 12 });
  b.insert('ins_urchins', 414, 506, { deg: -12, label: 'URCHINS' });
  b.insert('ins_kelpbed', 440, 438, { deg: -14, size: 12 });
  b.insert('ins_canopy', 314, 190, { shape: 'star', size: 12 });
  b.insert('ins_tundra', 292, 648, { deg: -168, size: 12 });
  b.insert('ins_rain', 316, 411, { shape: 'circle', size: 9 });

  // --- The Lantern Census board (inserts driven by the census mechanism)
  const census = b.rt.add(new LanternCensus(b.rt, 'census'));
  for (const bed of ['tundra', 'kelp', 'rainforest'] as Bed[]) {
    bedIds(bed).forEach((id, i) => {
      const spec = LANTERN_BY_ID.get(id)!;
      census.attach(spec, b.insert(`cen_${id}`, CENSUS_X[bed], CENSUS_Y - i * CENSUS_STEP, { shape: 'circle', size: 7, color: spec.color }), rolls.get(id)!);
    });
  }
}

// ---------------------------------------------------------------- printed playfield art

function paperLantern(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, lit: number, cord = 0) {
  ctx.save();
  if (cord > 0) {
    ctx.strokeStyle = 'rgba(16,10,26,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - s - cord);
    ctx.lineTo(x, y - s);
    ctx.stroke();
  }
  if (lit > 0.02) glowDot(ctx, x, y, s * 3.4, color, 0.5 * lit);
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.8, s, 0, 0, TAU);
  ctx.fillStyle = lit > 0.02 ? mix('#3a2a26', color, 0.3 + 0.7 * lit) : 'rgba(58,44,52,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,24,0.45)';
  ctx.lineWidth = Math.max(0.6, s * 0.08);
  for (const k of [-0.45, 0, 0.45]) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(k) * s * 0.8 + 0.4, s, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = '#6b5236';
  ctx.fillRect(x - s * 0.42, y - s * 1.1, s * 0.84, s * 0.24);
  ctx.fillRect(x - s * 0.42, y + s * 0.86, s * 0.84, s * 0.24);
  ctx.restore();
}

function rotatedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, deg: number, size: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(10,8,22,0.75)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function aurora(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, h: number, color: string, alpha: number, seed: number) {
  if (alpha <= 0.01) return;
  const r = rng(seed);
  const p1 = r() * TAU;
  const p2 = r() * TAU;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let x = x0; x <= x1; x += 3) {
    const u = (x - x0) / (x1 - x0);
    const yy = y + Math.sin(u * 5 + p1) * 16 + Math.sin(u * 11 + p2) * 6;
    const hh = h * (0.55 + 0.45 * Math.sin(u * 7 + p2));
    const g = ctx.createLinearGradient(0, yy - hh, 0, yy);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.75, rgba(color, 0.22 * alpha));
    g.addColorStop(1, rgba(color, 0.5 * alpha));
    ctx.fillStyle = g;
    ctx.fillRect(x, yy - hh, 3.2, hh);
  }
  ctx.restore();
}

function kelpFrond(ctx: CanvasRenderingContext2D, x: number, y0: number, h: number, sway: number, color: string, alpha: number) {
  ctx.save();
  ctx.strokeStyle = rgba(mix(color, '#2a4a20', 0.4), alpha);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  const pt = (u: number): Pt => [x + Math.sin(u * 3.2 + sway) * 9 * u, y0 - u * h];
  for (let i = 0; i <= 20; i++) {
    const [px, py] = pt(i / 20);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
  for (let i = 2; i < 20; i += 2) {
    const [px, py] = pt(i / 20);
    leafShape(ctx, px, py, 13 + (i % 4) * 2, (i % 4 ? -0.5 : Math.PI + 0.5) - 0.3, rgba(color, alpha * 0.9));
  }
  ctx.restore();
}

function urchinSpot(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save();
  ctx.strokeStyle = rgba(URCHIN, alpha);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * s * 0.4, y + Math.sin(a) * s * 0.4);
    ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    ctx.stroke();
  }
  ctx.fillStyle = rgba('#4a2a7a', alpha);
  ctx.beginPath();
  ctx.arc(x, y, s * 0.45, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function snowflake(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
    ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    ctx.stroke();
  }
  ctx.restore();
}

function waveGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.6;
  for (const dy of [-s * 0.35, s * 0.35]) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const px = x - s + u * 2 * s;
      const py = y + dy + Math.sin(u * TAU) * s * 0.25;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The whole printed garden for one awakening level. */
function paintGarden(ctx: CanvasRenderingContext2D, level: number) {
  const s0 = stage(level, 0, 0.6);
  const sT = stage(level, 0.4, 1.3);
  const sK = stage(level, 1.3, 2.3);
  const sR = stage(level, 2.3, 3.2);
  const sF = stage(level, 3.3, 4);

  // Night lacquer with the moon rising behind the Moon Gate.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1c1a52'], [0.32, NIGHT], [0.66, '#0f2238'], [1, DEEP]]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 27, 110, [40, 20, 560, 330], IVORY);
  glowDot(ctx, MOON[0], MOON[1], 150, '#FFF1C8', 0.08 + 0.16 * s0 + 0.22 * sF);

  // ---- Rainforest canopy (top): layered leaves, hanging vines, orchids.
  const rr = rng(41);
  const leafCols = ['#1d4a36', '#24603f', '#2f7448', '#1a3f33'];
  for (let i = 0; i < 70; i++) {
    const x = 70 + rr() * 460;
    const y = 40 + rr() * 150 + (Math.abs(x - 312) < 120 ? 0 : 60 * rr());
    const len = 22 + rr() * 26;
    const col = leafCols[i % 4];
    leafShape(ctx, x, y, len, rr() * TAU, rgba(sR > 0.05 ? mix(col, '#3fb46a', 0.35 * sR) : col, 0.45 + 0.3 * rr()));
  }
  // vines on both sides of the canopy
  for (const [vx, vlen, seed] of [[150, 150, 3], [178, 110, 5], [452, 170, 7], [492, 120, 9], [520, 190, 11]] as [number, number, number][]) {
    const r = rng(seed);
    ctx.save();
    ctx.strokeStyle = rgba('#2d6a40', 0.55 + 0.25 * sR);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vx, 60);
    for (let k = 1; k <= 12; k++) ctx.lineTo(vx + Math.sin(k * 0.9 + seed) * 6, 60 + (vlen * k) / 12);
    ctx.stroke();
    ctx.restore();
    for (let k = 2; k <= 12; k += 2) leafShape(ctx, vx + Math.sin(k * 0.9 + seed) * 6, 60 + (vlen * k) / 12, 9 + r() * 5, k % 4 ? 0.6 : Math.PI - 0.6, rgba('#3f9a58', 0.5 + 0.3 * sR));
  }
  // Fig leaves around each fig-tree bumper, with figs.
  for (const [fx, fy] of [[256, 236], [372, 236], [314, 312]] as Pt[]) {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + fx * 0.01;
      leafShape(ctx, fx + Math.cos(a) * 30, fy + Math.sin(a) * 30, 20, a, rgba('#2e7a4a', 0.55 + 0.3 * sR));
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 0.4;
      ctx.fillStyle = rgba('#7a3d8c', 0.55 + 0.35 * sR);
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 42, fy + Math.sin(a) * 42, 3.2, 0, TAU);
      ctx.fill();
    }
  }
  // Orchids and canopy flowers wake with the rainforest.
  const ro = rng(77);
  for (let i = 0; i < 22; i++) {
    const x = 90 + ro() * 420;
    const y = 50 + ro() * 160;
    const c = [ORCHID, '#FFD36B', '#FF9F7A'][i % 3];
    if (sR > 0.02) glowDot(ctx, x, y, 9, c, 0.55 * sR);
    ctx.fillStyle = rgba(c, 0.25 + 0.6 * sR);
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, 0, TAU);
      ctx.fill();
    }
  }

  // ---- Tundra (left): an icy trail and snowy drifts under the shimmering aurora.
  for (const [x, y, rx, ry] of [[60, 420, 70, 120], [70, 600, 80, 110], [130, 700, 110, 90], [140, 520, 70, 90], [60, 760, 60, 50]] as [number, number, number, number][]) {
    blob(ctx, x, y, rx, ry, '#a9c8ee', 0.12 + 0.1 * sT);
  }
  // ice lane of the trail with cracks
  ctx.save();
  ctx.fillStyle = rgba('#cfe8ff', 0.1 + 0.12 * sT);
  rrect(ctx, 28, 340, 54, 250, 18);
  ctx.fill();
  ctx.strokeStyle = rgba('#eaf6ff', 0.25 + 0.3 * sT);
  ctx.lineWidth = 1;
  const rc = rng(13);
  for (let i = 0; i < 10; i++) {
    let x = 34 + rc() * 42;
    let y = 350 + rc() * 230;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (rc() - 0.5) * 16;
      y += 6 + rc() * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // snow drifts in the Lantern Gap and around the Launcher
  for (const [x, y, w, h] of [[150, 600, 70, 26], [120, 520, 46, 18], [60, 650, 50, 20], [110, 760, 60, 22], [170, 500, 30, 12]] as [number, number, number, number][]) {
    blob(ctx, x, y, w, h, '#eef7ff', 0.18 + 0.2 * sT);
  }
  stars(ctx, 19, 40, [30, 340, 210, 800], ICE);
  aurora(ctx, 30, 300, 320, 90, AURORA, 0.15 + 0.85 * sT, 3);
  aurora(ctx, 40, 240, 290, 70, AURORA2, 0.1 + 0.7 * sT, 8);
  // Chevrons up the Lantern Gap toward the Festival Ramp.
  for (let k = 0; k < 4; k++) {
    const cy = 600 - k * 34;
    const cx = 126;
    neonPath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy + 6);
      ctx.lineTo(cx - 2, cy - 6);
      ctx.lineTo(cx + 10, cy + 6);
    }, GOLD, (0.25 + 0.75 * s0) * (0.4 + 0.15 * k), 2.5);
  }
  rotatedText(ctx, 'TUNDRA TRAIL', 77, 470, -90, 10, ICE, 0.45 + 0.5 * sT);
  rotatedText(ctx, 'LANTERN GAP', 150, 540, -90, 10, GOLD, 0.45 + 0.5 * s0);
  rotatedText(ctx, 'LAUNCHER', 120, 732, 30, 9, GOLD, 0.45 + 0.5 * s0);
  rotatedText(ctx, 'LIFT', 46, 586, 0, 8, ICE, 0.5 + 0.4 * sT);
  rotatedText(ctx, 'FESTIVAL RAMP', 232, 470, -90, 9, AMBER, 0.45 + 0.5 * s0);

  // ---- Kelp forest (right): sunlit water, swaying kelp, urchins on the bed.
  for (let x = 372; x < 548; x += 4) {
    const edge = stage(x, 372, 420);
    const top = 350 + Math.sin(x * 0.08) * 6;
    ctx.fillStyle = vgrad(ctx, top, 820, [[0, rgba('#1b6b8a', (0.16 + 0.14 * sK) * edge)], [0.6, rgba('#155a74', (0.22 + 0.14 * sK) * edge)], [1, rgba('#0e3d52', 0.25 * edge)]]);
    ctx.fillRect(x, top, 4.4, 820 - top);
  }
  // Light shafts from the surface.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const x of [400, 452, 520]) {
    const g = ctx.createLinearGradient(x, 350, x - 30, 780);
    g.addColorStop(0, rgba('#9fe8ff', 0.08 + 0.12 * sK));
    g.addColorStop(1, rgba('#9fe8ff', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 10, 350);
    ctx.lineTo(x + 14, 350);
    ctx.lineTo(x - 14, 780);
    ctx.lineTo(x - 50, 780);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  for (const [x, h, sw] of [[392, 330, 0.2], [418, 250, 1.4], [462, 230, 2.2], [500, 300, 0.9], [530, 360, 3.1], [380, 200, 2.7]] as [number, number, number][]) {
    kelpFrond(ctx, x, 812, h, sw, KELP, 0.32 + 0.5 * sK);
  }
  const rb = rng(55);
  for (let i = 0; i < 26; i++) {
    const x = 392 + rb() * 150;
    const y = 360 + rb() * 420;
    ctx.strokeStyle = rgba('#d8f6ff', 0.25 + 0.35 * sK);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + rb() * 2.5, 0, TAU);
    ctx.stroke();
  }
  // bioluminescent sparks wake with the kelp bed
  if (sK > 0.02) {
    const rs = rng(66);
    for (let i = 0; i < 30; i++) glowDot(ctx, 392 + rs() * 150, 380 + rs() * 400, 5, MINT, 0.5 * sK * rs());
  }
  for (const [x, y] of [[424, 560], [430, 470], [452, 600], [418, 660]] as Pt[]) urchinSpot(ctx, x, y, 9, 0.35 + 0.3 * (1 - sK * 0.5));
  rotatedText(ctx, 'KELP CURRENT', 528, 600, -90, 10, MINT, 0.45 + 0.5 * sK);
  rotatedText(ctx, 'KELP BED', 488, 520, -78, 9, KELP, 0.4 + 0.5 * sK);

  // ---- Garden path from the Moon Gate to the census, with lantern posts.
  ctx.save();
  const rp = rng(91);
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const x = 318 + (286 - 318) * u + Math.sin(u * 3) * 8;
    const y = 520 + u * 150;
    rrect(ctx, x - 13 + rp() * 4, y - 6, 24 + rp() * 6, 12, 5);
    ctx.fillStyle = rgba('#5d6a8a', 0.22 + 0.18 * s0);
    ctx.fill();
  }
  ctx.restore();
  // The moon window motif under the Wonder Pocket.
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.arc(MOON[0], MOON[1], 47, 0, TAU);
  }, '#FFE6A8', 0.2 + 0.5 * s0 + 0.3 * sF, 2);

  // ---- Paper lanterns strung under the arch: they light bed by bed as the garden wakes.
  const strung: { x: number; y: number; c: string; lit: number }[] = [];
  const cols = LANTERNS.map((l) => l.color);
  for (let i = 0; i < 13; i++) {
    const u = (i + 0.5) / 13;
    const a = Math.PI + u * Math.PI;
    const x = 310 + Math.cos(a) * 246;
    const y = 300 + Math.sin(a) * 246 + 26;
    const bedLit = u < 0.34 ? sT : u > 0.66 ? sK : sR;
    strung.push({ x, y, c: cols[i % cols.length], lit: Math.max(0.12 * s0, bedLit) });
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(16,10,26,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  strung.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y - 9) : ctx.moveTo(p.x, p.y - 9)));
  ctx.stroke();
  ctx.restore();
  for (const p of strung) paperLantern(ctx, p.x, p.y, 6, p.c, p.lit, 4);

  // ---- The Lantern Census board.
  ctx.save();
  rrect(ctx, 222, 694, 128, 112, 12);
  ctx.fillStyle = 'rgba(14,10,30,0.62)';
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.45 + 0.4 * s0);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  neonText(ctx, 'LANTERN CENSUS', 286, 680, 12, GOLD, 0.35 + 0.65 * s0);
  rotatedText(ctx, 'KINDS, NOT VISITS', 286, 702, 0, 7, IVORY, 0.6);
  for (const bed of ['tundra', 'kelp', 'rainforest'] as Bed[]) {
    const x = CENSUS_X[bed];
    const n = bedIds(bed).length;
    ctx.fillStyle = rgba(BED_COLOR[bed], 0.12);
    rrect(ctx, x - 9, CENSUS_Y - (n - 1) * CENSUS_STEP - 9, 18, (n - 1) * CENSUS_STEP + 18, 8);
    ctx.fill();
    const lit = bed === 'tundra' ? sT : bed === 'kelp' ? sK : sR;
    if (bed === 'tundra') snowflake(ctx, x, 798, 5, ICE, 0.6 + 0.4 * lit);
    else if (bed === 'kelp') waveGlyph(ctx, x, 798, 6, '#5FE0C8', 0.6 + 0.4 * lit);
    else leafShape(ctx, x - 6, 798, 12, -0.3, rgba(LEAF, 0.7 + 0.3 * lit));
  }

  // ---- Festival night (finale): golden wash, sky lanterns, the festival title.
  if (sF > 0.01) {
    ctx.fillStyle = rgba(GOLD, 0.05 * sF);
    ctx.fillRect(0, 0, 600, 1150);
    const rf = rng(123);
    for (let i = 0; i < 18; i++) {
      const x = 70 + rf() * 460;
      const y = 40 + rf() * 300;
      paperLantern(ctx, x, y, 4 + rf() * 3, [GOLD, CORAL, AMBER, ORCHID][i % 4], sF);
    }
  }
  neonText(ctx, 'LANTERN FESTIVAL', 310, 46, 19, GOLD, 0.15 + 0.85 * sF);
  neonText(ctx, 'BIODIVERSITY LANTERN FESTIVAL', 286, 1082, 10, IVORY, 0.15 + 0.5 * s0);
}

// ---------------------------------------------------------------- 3D attraction set helpers

type V3 = [number, number, number];
const GROUND = -0.42;

function matte(kit: SetKit, color: string, o: { emissive?: string; ei?: number; rough?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const T = kit.THREE;
  return kit.track(new T.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: 0, emissive: o.emissive ?? '#000000', emissiveIntensity: o.ei ?? 0, flatShading: !!o.flat }));
}

/** Builds one vertex-coloured mesh out of simple parts (keeps the figure count to one draw call). */
class Sculpt {
  private kit: SetKit;
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  constructor(kit: SetKit) {
    this.kit = kit;
  }
  add(geo: THREE.BufferGeometry, color: string, p: V3, s: V3 | number = 1, r: V3 = [0, 0, 0]) {
    const T = this.kit.THREE;
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const sc = typeof s === 'number' ? new T.Vector3(s, s, s) : new T.Vector3(s[0], s[1], s[2]);
    const m = new T.Matrix4().compose(new T.Vector3(p[0], p[1], p[2]), new T.Quaternion().setFromEuler(new T.Euler(r[0], r[1], r[2])), sc);
    g.applyMatrix4(m);
    const pa = g.attributes.position.array;
    const na = g.attributes.normal.array;
    const c = new T.Color(color);
    for (let i = 0; i < pa.length; i++) {
      this.pos.push(pa[i]);
      this.nor.push(na[i]);
    }
    for (let i = 0; i < pa.length / 3; i++) this.col.push(c.r, c.g, c.b);
    g.dispose();
    geo.dispose();
    return this;
  }
  mesh(o: { rough?: number; emissive?: string; ei?: number; flat?: boolean; shadow?: boolean } = {}): THREE.Mesh {
    const T = this.kit.THREE;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    geo.computeBoundingSphere();
    const mat = this.kit.track(new T.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.75, metalness: 0, emissive: o.emissive ?? '#000000', emissiveIntensity: o.ei ?? 0, flatShading: !!o.flat }));
    const mesh = new T.Mesh(geo, mat);
    // Only hero pieces cast shadows; the rest of the garden just receives them (keeps the shadow pass light).
    mesh.castShadow = !!o.shadow;
    mesh.receiveShadow = true;
    return this.kit.add(mesh);
  }
}

/** Round paper-lantern body (lathe) with its axis on Y, height ~1.15 at scale 1. */
function lanternGeo(kit: SetKit): THREE.BufferGeometry {
  const T = kit.THREE;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 9; i++) {
    const u = i / 9;
    // a paper barrel: full in the middle, gathered toward the rims
    const r = 0.22 + 0.28 * Math.pow(Math.sin(Math.PI * u), 0.55);
    pts.push(new T.Vector2(r, (u - 0.5) * 1.2));
  }
  return kit.track(new T.LatheGeometry(pts, 12));
}

interface LanternItem { p: V3; s: number; color: string }
/** A field of glowing paper lanterns: one instanced body + caps + soft halos, lit per lantern. */
class LanternField {
  readonly body: THREE.InstancedMesh;
  readonly caps: THREE.InstancedMesh;
  readonly halos: THREE.Points;
  readonly items: LanternItem[];
  private base: THREE.Color[];
  private tmp: THREE.Color;
  private halo: THREE.BufferAttribute;
  private hpos: THREE.BufferAttribute;
  private o: THREE.Object3D;
  constructor(kit: SetKit, items: LanternItem[], haloSize = 0.9) {
    const T = kit.THREE;
    this.items = items;
    const n = items.length;
    this.body = new T.InstancedMesh(lanternGeo(kit), kit.track(new T.MeshBasicMaterial({ color: '#ffffff' })), n);
    this.caps = new T.InstancedMesh(kit.track(new T.CylinderGeometry(0.25, 0.25, 0.1, 10)), kit.mats.plastic('#2a1418'), n * 2);
    this.base = items.map((it) => new T.Color(it.color));
    this.tmp = new T.Color();
    this.o = new T.Object3D();
    const hp = new Float32Array(n * 3);
    const hc = new Float32Array(n * 3);
    const geo = new T.BufferGeometry();
    this.hpos = new T.BufferAttribute(hp, 3);
    this.halo = new T.BufferAttribute(hc, 3);
    geo.setAttribute('position', this.hpos);
    geo.setAttribute('color', this.halo);
    this.halos = new T.Points(geo, kit.track(new T.PointsMaterial({ size: haloSize, vertexColors: true, map: radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 'l27halo'), transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
    items.forEach((it, i) => this.place(i, it.p[0], it.p[1], it.p[2], it.s));
    for (let i = 0; i < n; i++) this.set(i, 0);
    this.commit(true);
    this.fitBounds();
    kit.add(this.body);
    kit.add(this.caps);
    kit.add(this.halos);
  }
  /** Position lantern `i` (allocation-free, so moving lanterns can call it every frame). */
  place(i: number, x: number, y: number, z: number, s: number) {
    const o = this.o;
    o.position.set(x, y, z);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(s);
    o.updateMatrix();
    this.body.setMatrixAt(i, o.matrix);
    for (let k = 0; k < 2; k++) {
      o.position.set(x, y + (k ? 0.6 : -0.6) * s, z);
      o.updateMatrix();
      this.caps.setMatrixAt(i * 2 + k, o.matrix);
    }
    this.hpos.setXYZ(i, x, y, z);
  }
  /** lit 0 = dark paper, 1 = glowing (HDR so the bloom catches it). */
  set(i: number, lit: number) {
    const t = this.tmp.copy(this.base[i]).multiplyScalar(0.07 + 1.9 * lit);
    this.body.setColorAt(i, t);
    const h = this.base[i];
    this.halo.setXYZ(i, h.r * lit, h.g * lit, h.b * lit);
  }
  commit(moved = false) {
    if (this.body.instanceColor) this.body.instanceColor.needsUpdate = true;
    this.halo.needsUpdate = true;
    if (moved) {
      this.body.instanceMatrix.needsUpdate = true;
      this.caps.instanceMatrix.needsUpdate = true;
      this.hpos.needsUpdate = true;
    }
  }
  /** Culling bounds from the lantern positions (or a fixed volume for lanterns that move). */
  fitBounds(volume?: { center: V3; radius: number }) {
    if (volume) {
      const sphere = this.body.geometry.boundingSphere?.clone() ?? this.halos.geometry.boundingSphere?.clone();
      if (!sphere) return;
      sphere.center.set(volume.center[0], volume.center[1], volume.center[2]);
      sphere.radius = volume.radius;
      this.body.boundingSphere = sphere;
      this.caps.boundingSphere = sphere.clone();
      this.halos.geometry.boundingSphere = sphere.clone();
      return;
    }
    this.body.computeBoundingSphere();
    this.caps.computeBoundingSphere();
    this.halos.geometry.computeBoundingSphere();
  }
  setVisible(v: boolean) {
    this.body.visible = v;
    this.caps.visible = v;
    this.halos.visible = v;
  }
}

function kelpTexture(kit: SetKit): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = '#6f8f2c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(32, 512);
  ctx.bezierCurveTo(26, 380, 38, 200, 32, 0);
  ctx.stroke();
  for (let i = 0; i < 14; i++) {
    const y = 470 - i * 34;
    const left = i % 2 === 0;
    const g = ctx.createLinearGradient(32, y, left ? 2 : 62, y - 30);
    g.addColorStop(0, '#9fb83c');
    g.addColorStop(1, '#d8e878');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.quadraticCurveTo(left ? 0 : 64, y - 10, left ? 6 : 58, y - 42);
    ctx.quadraticCurveTo(left ? 22 : 42, y - 22, 32, y);
    ctx.fill();
  }
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** An irregular, gently rippling pond (sea ice water, tide pool) with soft organic edges. */
function pond(kit: SetKit, x: number, z: number, rx: number, rz: number, color: string, seed: number, y = GROUND + 0.03): THREE.Mesh {
  const T = kit.THREE;
  const seg = 56;
  const geo = new T.CircleGeometry(1, seg, 0, TAU);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const r = rng(seed);
  const bumps = [r() * TAU, r() * TAU, r() * TAU];
  for (let i = 1; i < p.count; i++) {
    const vx = p.getX(i);
    const vz = p.getZ(i);
    const a = Math.atan2(vz, vx);
    const k = 1 + 0.1 * Math.sin(a * 3 + bumps[0]) + 0.06 * Math.sin(a * 5 + bumps[1]) + 0.04 * Math.sin(a * 9 + bumps[2]);
    p.setXYZ(i, vx * rx * k, 0, vz * rz * k);
  }
  geo.computeVertexNormals();
  const mat = kit.track(new T.MeshPhysicalMaterial({ color, roughness: 0.06, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 }));
  const mesh = new T.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  kit.add(mesh);
  const base = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    base[i * 2] = p.getX(i);
    base[i * 2 + 1] = p.getZ(i);
  }
  kit.animate((t) => {
    for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(base[i * 2] * 2.1 + t * 1.3) * 0.015 + Math.cos(base[i * 2 + 1] * 2.6 + t * 1.1) * 0.012);
    p.needsUpdate = true;
  });
  return mesh;
}

function groundTexture(kit: SetKit): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1d3a2e';
  ctx.fillRect(0, 0, 1024, 1024);
  const r = rng(7);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1024;
    const y = r() * 1024;
    ctx.strokeStyle = `rgba(${60 + r() * 40},${110 + r() * 60},${70 + r() * 30},${0.25 + r() * 0.3})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 6, y - 5 - r() * 7);
    ctx.stroke();
  }
  // flagstone paths
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const d = 160 + r() * 340;
    const x = 512 + Math.cos(a) * d;
    const y = 512 + Math.sin(a) * d * 0.9;
    ctx.fillStyle = `rgba(${80 + r() * 20},${92 + r() * 20},${104 + r() * 20},0.28)`;
    ctx.beginPath();
    ctx.ellipse(x, y, 12 + r() * 10, 8 + r() * 6, r() * 3, 0, TAU);
    ctx.fill();
  }
  // fallen petals
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = ['rgba(255,143,208,0.5)', 'rgba(255,199,91,0.45)', 'rgba(191,230,255,0.4)'][i % 3];
    ctx.beginPath();
    ctx.arc(r() * 1024, r() * 1024, 1.5 + r() * 2, 0, TAU);
    ctx.fill();
  }
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(5, 5);
  t.anisotropy = 8;
  return t;
}

function auroraTexture(kit: SetKit): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const r = rng(5);
  for (let x = 0; x < 256; x += 2) {
    const h = 60 + r() * 60;
    const g = ctx.createLinearGradient(0, 128 - h, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, `rgba(255,255,255,${0.25 + r() * 0.2})`);
    g.addColorStop(1, 'rgba(255,255,255,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 128 - h, 2, h);
  }
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

function paintHorizon(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const sF = stage(level, 3.3, 4);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d0f2e');
  g.addColorStop(0.7, '#1b2a56');
  g.addColorStop(1, '#22365e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,247,231,${0.3 + r() * 0.6})`;
    ctx.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5);
  }
  // moon
  const mg = ctx.createRadialGradient(w * 0.22, h * 0.25, 0, w * 0.22, h * 0.25, 90);
  mg.addColorStop(0, 'rgba(255,244,214,1)');
  mg.addColorStop(0.35, 'rgba(255,240,200,0.9)');
  mg.addColorStop(0.4, 'rgba(255,240,200,0.25)');
  mg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(0, 0, w, h);
  // icy hills on the left, rainforest canopy on the right
  ctx.fillStyle = '#2c3f66';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w * 0.5; x += 16) ctx.lineTo(x, h * 0.62 + Math.sin(x * 0.02) * 30 - (x < w * 0.25 ? 40 : 0) * Math.sin((x / (w * 0.25)) * Math.PI));
  ctx.lineTo(w * 0.5, h);
  ctx.fill();
  ctx.fillStyle = '#16362c';
  for (let i = 0; i < 26; i++) {
    const x = w * 0.45 + r() * w * 0.58;
    const y = h * 0.58 + r() * h * 0.12;
    ctx.beginPath();
    ctx.arc(x, y, 30 + r() * 40, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#0f2a22';
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  if (sF > 0.01) {
    for (let i = 0; i < 60; i++) {
      const x = r() * w;
      const y = h * 0.1 + r() * h * 0.6;
      const lg = ctx.createRadialGradient(x, y, 0, x, y, 12);
      lg.addColorStop(0, `rgba(255,199,91,${0.9 * sF})`);
      lg.addColorStop(1, 'rgba(255,199,91,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 12, y - 12, 24, 24);
    }
  }
}

// ---------------------------------------------------------------- the 3D attraction set

const festivalSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  kit.sky('#1b1d52', '#04050d');
  const ground = new T.Mesh(new T.CircleGeometry(30, 64).rotateX(-Math.PI / 2), kit.track(new T.MeshStandardMaterial({ map: groundTexture(kit), roughness: 0.95, color: '#a8b8b0' })));
  ground.position.y = GROUND;
  ground.receiveShadow = true;
  kit.add(ground);
  const horizon = kit.backdrop(paintHorizon, { width: 30, height: 11, z: -15 });

  // ================= LEFT: the tundra bed, with a polar bear on breaking sea ice behind it =================
  // A raised tundra bed: low moss and lichen, tussock grasses, a few snow patches, few kinds.
  const snow = new Sculpt(kit);
  const rs = rng(17);
  const SX = -6.3;
  const SZ = -0.3;
  snow.add(new T.CylinderGeometry(1.45, 1.55, 0.22, 28), '#4a4a52', [SX, GROUND + 0.11, SZ], [1, 1, 1.15]);
  snow.add(new T.CylinderGeometry(1.36, 1.36, 0.06, 28), '#5f6b4c', [SX, GROUND + 0.24, SZ], [1, 1, 1.15]);
  for (let i = 0; i < 5; i++) {
    const a = rs() * TAU;
    const d = rs() * 0.9;
    snow.add(new T.IcosahedronGeometry(1, 2), '#dfe8f4', [SX + Math.cos(a) * d, GROUND + 0.25, SZ + Math.sin(a) * d * 1.1], [0.28 + rs() * 0.22, 0.05, 0.22 + rs() * 0.18], [0, rs() * 3, 0]);
  }
  for (let i = 0; i < 18; i++) {
    const a = rs() * TAU;
    const d = 0.2 + rs() * 1.0;
    snow.add(new T.ConeGeometry(0.07, 0.18, 5), ['#8c8a4a', '#a39a5c', '#6f7a44'][i % 3], [SX + Math.cos(a) * d, GROUND + 0.35, SZ + Math.sin(a) * d * 1.1]);
  }
  for (let i = 0; i < 24; i++) {
    const a = rs() * TAU;
    const d = 0.2 + rs() * 1.1;
    snow.add(new T.SphereGeometry(0.04, 6, 4), ['#c9d46a', '#ff8fd0', '#ffd36b', '#e8eef8'][i % 4], [SX + Math.cos(a) * d, GROUND + 0.29, SZ + Math.sin(a) * d * 1.1], [1, 0.6, 1]);
  }
  snow.mesh({ rough: 0.95 });
  ([[-6.9, 0.25, 0.32], [-5.7, -0.9, 0.26], [-6.6, -1.2, 0.22]] as V3[]).forEach(([x, z, sz], i) => kit.rock([x, GROUND + 0.3, z], sz, '#6c7562', 70 + i));
  // Ice shards (no glass transmission: they glow instead, which keeps the frame cheap).
  const shards = new Sculpt(kit);
  for (const [x, z, sz, rz] of [[-7.25, -0.85, 0.14, 0.2], [-5.45, 0.35, 0.12, -0.25], [-7.05, 0.75, 0.12, 0.1], [-6.0, -1.25, 0.1, -0.1]]) {
    shards.add(new T.OctahedronGeometry(sz, 0), '#cfeaff', [x, GROUND + 0.28 + sz * 1.2, z], [0.6, 1.7, 0.6], [0.1, rz * 4, rz]);
  }
  const shardMesh = shards.mesh({ rough: 0.15, emissive: ICE, ei: 0.05, flat: true });
  const shardMat = shardMesh.material as THREE.MeshStandardMaterial;
  // Arctic fox curled on the snow, waiting for a polar bear's leftovers.
  const fox = new Sculpt(kit);
  const sph = (r = 1, w = 14, h = 10) => new T.SphereGeometry(r, w, h);
  fox.add(sph(0.22), '#e9e4da', [0, 0.2, 0], [1.4, 0.8, 0.85]);
  fox.add(sph(0.13), '#e9e4da', [0.3, 0.33, 0.02]);
  fox.add(new T.ConeGeometry(0.06, 0.14, 8), '#e9e4da', [0.42, 0.31, 0.02], 1, [0, 0, -Math.PI / 2]);
  fox.add(sph(0.025), '#1a1a22', [0.49, 0.31, 0.02]);
  fox.add(new T.ConeGeometry(0.045, 0.1, 6), '#e8eef8', [0.27, 0.46, 0.07]);
  fox.add(new T.ConeGeometry(0.045, 0.1, 6), '#e8eef8', [0.31, 0.46, -0.05]);
  fox.add(sph(0.12), '#ffffff', [-0.3, 0.16, 0.12], [1.6, 0.7, 0.8], [0, 0.6, 0.3]);
  for (const [lx, lz] of [[0.18, 0.08], [0.18, -0.08], [-0.15, 0.08], [-0.15, -0.08]]) fox.add(new T.CylinderGeometry(0.03, 0.03, 0.16, 6), '#e4ecf8', [lx, 0.06, lz]);
  const foxMesh = fox.mesh({ rough: 0.85, shadow: true });
  foxMesh.position.set(-5.95, GROUND + 0.26, 0.15);
  foxMesh.rotation.y = 0.9;
  foxMesh.scale.setScalar(1.2);
  // A gull on a mooring post.
  const gull = new Sculpt(kit);
  gull.add(new T.CylinderGeometry(0.06, 0.07, 1.0, 8), '#6b5240', [0, 0.5, 0]);
  gull.add(sph(0.14), '#ffffff', [0, 1.12, 0], [1.5, 0.85, 0.9]);
  gull.add(sph(0.08), '#ffffff', [0.19, 1.22, 0]);
  gull.add(new T.ConeGeometry(0.025, 0.1, 6), '#ffc84a', [0.29, 1.21, 0], 1, [0, 0, -Math.PI / 2]);
  gull.add(sph(0.12), '#a9b4c4', [-0.04, 1.15, 0.12], [1.5, 0.35, 0.6], [0.3, 0, 0]);
  gull.add(sph(0.12), '#a9b4c4', [-0.04, 1.15, -0.12], [1.5, 0.35, 0.6], [-0.3, 0, 0]);
  const gullMesh = gull.mesh({ rough: 0.7 });
  gullMesh.position.set(-4.35, GROUND, -0.6);
  gullMesh.rotation.y = 0.3;
  // Sea ice breaking up: a floe on dark water, a polar bear by a seal's breathing hole.
  pond(kit, -6.6, -3.55, 2.3, 1.5, '#16314f', 4);
  const floe = new Sculpt(kit);
  const floeGeo = new T.CylinderGeometry(1, 1.06, 0.2, 9);
  floe.add(floeGeo, '#e3f3ff', [-6.4, GROUND + 0.1, -3.7], [1.25, 1, 0.85], [0, 0.3, 0]);
  floe.add(new T.CylinderGeometry(1, 1.04, 0.16, 7), '#d0e8fb', [-4.9, GROUND + 0.08, -3.0], [0.5, 1, 0.4], [0, 1, 0]);
  floe.add(new T.CylinderGeometry(1, 1.04, 0.16, 7), '#d0e8fb', [-7.7, GROUND + 0.08, -2.6], [0.45, 1, 0.35], [0, 0.4, 0]);
  floe.add(new T.CylinderGeometry(0.16, 0.16, 0.22, 12), '#0c1a2c', [-6.0, GROUND + 0.12, -3.3]);
  floe.mesh({ rough: 0.35, flat: true });
  const bear = new Sculpt(kit);
  const cream = '#e6dfcf';
  bear.add(sph(0.46, 20, 14), cream, [0, 0.56, 0], [1.6, 0.78, 0.82]);
  bear.add(sph(0.32, 16, 12), cream, [0.2, 0.74, 0], [1.2, 0.7, 0.86]);
  bear.add(sph(0.26, 16, 12), cream, [0.62, 0.6, 0], [1.15, 0.85, 0.82]);
  bear.add(sph(0.18, 16, 12), cream, [0.9, 0.55, 0], [1.3, 0.82, 0.8]);
  bear.add(sph(0.1, 12, 8), '#d6cdb8', [1.08, 0.5, 0], [1.2, 0.8, 0.85]);
  bear.add(sph(0.045), '#15151c', [1.19, 0.52, 0]);
  bear.add(sph(0.06), cream, [0.86, 0.72, 0.12]);
  bear.add(sph(0.06), cream, [0.86, 0.72, -0.12]);
  bear.add(sph(0.025), '#15151c', [0.99, 0.6, 0.08]);
  bear.add(sph(0.025), '#15151c', [0.99, 0.6, -0.08]);
  for (const [lx, lz] of [[0.42, 0.22], [0.46, -0.22], [-0.42, 0.22], [-0.38, -0.22]]) {
    bear.add(new T.CylinderGeometry(0.13, 0.12, 0.42, 10), cream, [lx, 0.2, lz]);
    bear.add(sph(0.13, 10, 6), '#d6cdb8', [lx + 0.04, 0.02, lz], [1.2, 0.4, 1]);
  }
  const bearMesh = bear.mesh({ rough: 0.85, shadow: true });
  bearMesh.position.set(-6.85, GROUND + 0.2, -3.9);
  bearMesh.rotation.y = 0.55;
  // aurora curtains over the tundra (and, at the festival, across the whole sky)
  const aTex = auroraTexture(kit);
  const auroras = ([[-9.4, -4.0, 0.2, -5.8, AURORA], [-9.0, -4.7, 0.55, -6.5, AURORA2], [3.9, 9.2, 1.6, -7.0, AURORA]] as [number, number, number, number, string][]).map(([x0, x1, y, z, color], k) => {
    const seg = 40;
    const geo = new T.PlaneGeometry(1, 1, seg, 1);
    const mat = kit.track(new T.MeshBasicMaterial({ color, map: aTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
    const mesh = new T.Mesh(geo, mat);
    kit.add(mesh);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const shape = (t: number) => {
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const x = x0 + (x1 - x0) * u;
        const zz = z + Math.sin(u * 4 + t * 0.35 + k) * 0.7;
        const hh = 1.15 + Math.sin(u * 7 + t * 0.5 + k * 2) * 0.3;
        pos.setXYZ(i, x, y + hh, zz);
        pos.setXYZ(i + seg + 1, x, y, zz + 0.3);
      }
      pos.needsUpdate = true;
    };
    shape(0);
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius += 1.2;
    kit.animate((t) => shape(t));
    return mat;
  });

  // ================= RIGHT FRONT: the kelp forest tide pool =================
  const rockCol = '#3a4a5c';
  ([[4.3, 0.7, 0.5], [7.7, 0.2, 0.6], [5.2, 2.3, 0.45], [7.0, -1.3, 0.55], [4.6, -1.0, 0.42], [7.9, 2.1, 0.4]] as V3[]).forEach(([x, z, s], i) => kit.rock([x, GROUND + 0.05, z], s, rockCol, 50 + i));
  pond(kit, 6.1, 0.55, 1.85, 1.95, '#1a6d8a', 9, GROUND + 0.12);
  const kelpTex = kelpTexture(kit);
  const frondGeo = kit.track(new T.PlaneGeometry(0.34, 2.4, 1, 8).translate(0, 1.2, 0));
  const frondMat = kit.track(new T.MeshStandardMaterial({ map: kelpTex, alphaTest: 0.4, side: T.DoubleSide, emissive: KELP, emissiveMap: kelpTex, emissiveIntensity: 0.05, roughness: 0.6 }));
  const fronds: { x: number; z: number; h: number; ph: number; ry: number }[] = [];
  const rk = rng(23);
  for (let i = 0; i < kit.n(12); i++) fronds.push({ x: 4.8 + rk() * 2.7, z: -0.9 + rk() * 2.9, h: 0.6 + rk() * 0.6, ph: rk() * TAU, ry: rk() * Math.PI });
  const kelp = new T.InstancedMesh(frondGeo, frondMat, fronds.length);
  const ko = new T.Object3D();
  const placeKelp = (t: number) => {
    for (let i = 0; i < fronds.length; i++) {
      const f = fronds[i];
      ko.position.set(f.x, GROUND + 0.1, f.z);
      ko.rotation.set(Math.sin(t * 0.8 + f.ph) * 0.12, f.ry, Math.sin(t * 0.6 + f.ph * 1.3) * 0.14);
      ko.scale.set(1, f.h, 1);
      ko.updateMatrix();
      kelp.setMatrixAt(i, ko.matrix);
    }
    kelp.instanceMatrix.needsUpdate = true;
  };
  placeKelp(0);
  kelp.computeBoundingSphere();
  if (kelp.boundingSphere) kelp.boundingSphere.radius += 0.6;
  kit.add(kelp);
  kit.animate((t) => placeKelp(t));
  // Sea otter floating on its back, an urchin on its chest.
  const otter = new Sculpt(kit);
  const fur = '#7a5236';
  otter.add(sph(0.26), fur, [0, 0, 0], [1.7, 0.6, 0.8]);
  otter.add(sph(0.17), '#9a7656', [0.5, 0.06, 0]);
  otter.add(sph(0.08), '#d9c7ae', [0.62, 0.05, 0], [1, 0.8, 1]);
  otter.add(sph(0.03), '#15151c', [0.69, 0.08, 0]);
  otter.add(sph(0.1), fur, [-0.48, 0.02, 0], [1.6, 0.5, 0.7]);
  otter.add(sph(0.07), URCHIN, [0.18, 0.17, 0]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    otter.add(new T.ConeGeometry(0.012, 0.09, 4), '#b48cff', [0.18 + Math.cos(a) * 0.08, 0.17 + Math.sin(a) * 0.08, 0], 1, [0, 0, a - Math.PI / 2]);
  }
  const otterMesh = otter.mesh({ rough: 0.9, shadow: true });
  otterMesh.position.set(5.5, GROUND + 0.24, 1.5);
  kit.animate((t) => {
    otterMesh.position.y = GROUND + 0.24 + Math.sin(t * 1.3) * 0.03;
    otterMesh.rotation.y = 0.4 + Math.sin(t * 0.3) * 0.25;
  });
  // Urchins on the rocks and a shore crab.
  const urch = new Sculpt(kit);
  for (const [ux, uy, uz] of [[4.45, 0.18, 0.95], [7.55, 0.08, 0.1], [7.0, 0.1, -1.05], [4.75, 0.05, -0.75]] as V3[]) {
    urch.add(sph(0.11, 10, 8), '#5a2a9a', [ux, GROUND + uy + 0.1, uz]);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const b = ((i * 7) % 18) / 18 * Math.PI - Math.PI / 2;
      urch.add(new T.ConeGeometry(0.016, 0.17, 4), '#a678ff', [ux + Math.cos(a) * Math.cos(b) * 0.15, GROUND + uy + 0.1 + Math.sin(b) * 0.15, uz + Math.sin(a) * Math.cos(b) * 0.15], 1, [Math.sin(a) * Math.cos(b) * 1.6, 0, -Math.cos(a) * Math.cos(b) * 1.6 + (b > 0 ? 0 : 0)]);
    }
  }
  const crabCol = '#ff7a4a';
  urch.add(sph(0.13, 12, 8), crabCol, [5.1, GROUND + 0.52, 2.35], [1.3, 0.55, 1]);
  urch.add(sph(0.06), crabCol, [5.29, GROUND + 0.56, 2.48]);
  urch.add(sph(0.06), crabCol, [5.29, GROUND + 0.56, 2.22]);
  urch.add(sph(0.025), '#15151c', [5.2, GROUND + 0.62, 2.39]);
  urch.add(sph(0.025), '#15151c', [5.2, GROUND + 0.62, 2.31]);
  urch.mesh({ rough: 0.6 });

  // ================= RIGHT BACK: the rainforest corner =================
  const forest = new Sculpt(kit);
  const bark = '#5a4632';
  forest.add(new T.CylinderGeometry(0.2, 0.38, 3.4, 10), bark, [6.3, GROUND + 1.7, -4.6]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    forest.add(new T.BoxGeometry(0.7, 0.55, 0.06), '#4c3a28', [6.3 + Math.cos(a) * 0.34, GROUND + 0.27, -4.6 + Math.sin(a) * 0.34], 1, [0, -a, 0]);
  }
  forest.add(new T.CylinderGeometry(0.07, 0.1, 1.6, 8), bark, [5.6, GROUND + 2.6, -4.4], 1, [0, 0, 1.0]);
  forest.add(new T.CylinderGeometry(0.06, 0.09, 1.4, 8), bark, [7.0, GROUND + 2.8, -4.5], 1, [0, 0, -1.1]);
  forest.add(new T.CylinderGeometry(0.14, 0.24, 2.6, 8), bark, [4.4, GROUND + 1.3, -5.7]);
  forest.add(new T.CylinderGeometry(0.12, 0.2, 2.2, 8), bark, [8.3, GROUND + 1.1, -3.4]);
  const greens = ['#1f6b3e', '#2c8a4c', '#3aa35a', '#18573a'];
  const rf = rng(31);
  for (const [cx, cy, cz, n, rad] of [[6.3, 3.5, -4.6, 9, 1.4], [4.4, 2.6, -5.7, 6, 0.9], [8.3, 2.3, -3.4, 5, 0.8]] as [number, number, number, number, number][]) {
    for (let i = 0; i < n; i++) {
      const a = rf() * TAU;
      const d = rf() * rad;
      forest.add(new T.IcosahedronGeometry(0.55 + rf() * 0.4, 1), greens[i % 4], [cx + Math.cos(a) * d, GROUND + cy + (rf() - 0.3) * 0.6, cz + Math.sin(a) * d * 0.8], [1, 0.75, 1]);
    }
  }
  // giant understory leaves
  for (let i = 0; i < 10; i++) {
    const a = rf() * TAU;
    forest.add(sph(0.4, 10, 6), greens[(i + 1) % 4], [5.6 + Math.cos(a) * 1.6, GROUND + 0.35, -3.6 + Math.sin(a) * 1.0], [1.3, 0.12, 0.55], [0.4, a, 0.3]);
  }
  // hanging vines
  for (let i = 0; i < 7; i++) {
    const x = 5.3 + rf() * 2.2;
    const z = -4.9 + rf() * 1.0;
    const len = 0.9 + rf() * 1.4;
    forest.add(new T.CylinderGeometry(0.012, 0.012, len, 4), '#3f7a3a', [x, GROUND + 3.1 - len / 2, z]);
  }
  forest.mesh({ rough: 0.8, flat: true });
  // Rainforest animals, each living in its own narrow niche.
  const fauna = new Sculpt(kit);
  // toucan on the left branch
  fauna.add(sph(0.12), '#121218', [5.15, GROUND + 3.05, -4.25], [0.9, 1.3, 0.8]);
  fauna.add(sph(0.075), '#121218', [5.18, GROUND + 3.24, -4.22]);
  fauna.add(sph(0.06), '#fff3c4', [5.24, GROUND + 3.12, -4.18], [0.8, 1, 0.6]);
  fauna.add(new T.ConeGeometry(0.05, 0.24, 8), '#ff9a2a', [5.36, GROUND + 3.24, -4.2], 1, [0, 0, -Math.PI / 2]);
  // red-eyed tree frog on a big leaf
  fauna.add(sph(0.08), '#4fd06a', [6.75, GROUND + 0.5, -3.1], [1.3, 0.7, 1]);
  fauna.add(sph(0.03), '#ff3a3a', [6.83, GROUND + 0.56, -3.06]);
  fauna.add(sph(0.03), '#ff3a3a', [6.83, GROUND + 0.56, -3.14]);
  // three-toed sloth hanging from the right branch
  fauna.add(sph(0.16), '#8a7258', [7.25, GROUND + 2.62, -4.45], [0.9, 1.3, 0.9]);
  fauna.add(sph(0.09), '#b39a7c', [7.27, GROUND + 2.42, -4.4]);
  fauna.add(new T.CylinderGeometry(0.025, 0.025, 0.36, 6), '#8a7258', [7.2, GROUND + 2.85, -4.4]);
  fauna.add(new T.CylinderGeometry(0.025, 0.025, 0.36, 6), '#8a7258', [7.32, GROUND + 2.85, -4.5]);
  // jewel beetle on the trunk
  fauna.add(sph(0.06), '#8a5cff', [6.18, GROUND + 1.4, -4.25], [0.8, 1.2, 0.5]);
  fauna.mesh({ rough: 0.35 });
  // Orchids clinging to bark high up, lit as the rainforest wakes.
  const orchidMat = kit.track(new T.MeshStandardMaterial({ color: '#ffd1ec', emissive: ORCHID, emissiveIntensity: 0.1, roughness: 0.5 }));
  const orchidSpots: V3[] = [];
  for (let i = 0; i < kit.n(16); i++) {
    const a = rf() * TAU;
    orchidSpots.push(rf() < 0.5 ? [6.3 + Math.cos(a) * 0.28, GROUND + 1.0 + rf() * 2.2, -4.6 + Math.sin(a) * 0.28] : [4.4 + Math.cos(a) * 0.2, GROUND + 0.6 + rf() * 1.6, -5.7 + Math.sin(a) * 0.2]);
  }
  const orchids = new T.InstancedMesh(kit.track(new T.ConeGeometry(0.09, 0.07, 5)), orchidMat, orchidSpots.length);
  orchidSpots.forEach((p, i) => {
    ko.position.set(p[0], p[1], p[2]);
    ko.rotation.set(Math.PI / 2, 0, rf() * TAU);
    ko.scale.setScalar(1);
    ko.updateMatrix();
    orchids.setMatrixAt(i, ko.matrix);
  });
  kit.add(orchids);

  // ================= FRONT LEFT: the Lantern Census, a bar chart built of lanterns =================
  const frame = new Sculpt(kit);
  const wood = '#6b4a2e';
  const lacquer = '#8a2f3a';
  const cx0 = -5.3;
  const cz0 = 3.05;
  frame.add(new T.BoxGeometry(2.5, 0.16, 0.8), '#3d2a1c', [cx0, GROUND + 0.08, cz0 - 0.15]);
  for (const dx of [-1.12, 1.12]) {
    frame.add(new T.BoxGeometry(0.09, 2.5, 0.09), lacquer, [cx0 + dx, GROUND + 1.25, cz0 - 0.25]);
    frame.add(new T.BoxGeometry(0.2, 0.08, 0.2), '#c9a25a', [cx0 + dx, GROUND + 0.2, cz0 - 0.25]);
  }
  frame.add(new T.BoxGeometry(2.62, 0.1, 0.16), lacquer, [cx0, GROUND + 2.42, cz0 - 0.25]);
  frame.add(new T.BoxGeometry(2.3, 0.07, 0.12), wood, [cx0, GROUND + 2.24, cz0 - 0.25]);
  // a festival roof with upturned eaves
  for (const dx of [-1.36, 1.36]) frame.add(new T.ConeGeometry(0.06, 0.22, 6), '#c9a25a', [cx0 + dx, GROUND + 2.5, cz0 - 0.25], 1, [0, 0, dx > 0 ? -0.7 : 0.7]);
  // one cord per bed, each threaded with that bed's kinds
  for (const dx of [-0.75, 0, 0.75]) frame.add(new T.CylinderGeometry(0.008, 0.008, 2.0, 4), '#2a2230', [cx0 + dx, GROUND + 1.24, cz0 - 0.25]);
  frame.mesh({ rough: 0.6, shadow: true });
  const censusPlate = (() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1a1230';
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 256, 40);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = '800 72px "Fraunces Variable", Georgia, serif';
    ctx.fillText('LANTERN CENSUS', 512, 96);
    ctx.font = '700 46px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = ICE;
    ctx.fillText('TUNDRA', 190, 196);
    ctx.fillStyle = '#5FE0C8';
    ctx.fillText('KELP', 512, 196);
    ctx.fillStyle = '#7fe08a';
    ctx.fillText('RAINFOREST', 834, 196);
    const t = kit.track(new T.CanvasTexture(c));
    t.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(new T.PlaneGeometry(2.3, 0.575), kit.track(new T.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25, roughness: 0.6 })));
    m.position.set(cx0, GROUND + 0.34, cz0 + 0.4);
    m.rotation.x = -0.75;
    return kit.add(m);
  })();

  // ================= All the festival's lanterns (one instanced field) =================
  const items: LanternItem[] = [];
  const groupOf: ('tundra' | 'kelp' | 'rainforest' | 'census' | 'path')[] = [];
  const censusCol: number[] = [];
  const push = (p: V3, s: number, color: string, g: (typeof groupOf)[number], col = -1) => {
    items.push({ p, s, color });
    groupOf.push(g);
    censusCol.push(col);
  };
  // census columns: 2 tundra kinds, 3 kelp kinds, 5 rainforest kinds
  (['tundra', 'kelp', 'rainforest'] as Bed[]).forEach((bed, ci) => {
    bedIds(bed).forEach((id, k) => push([cx0 - 0.75 + ci * 0.75, GROUND + 0.64 + k * 0.34, cz0 - 0.25], 0.28, LANTERN_BY_ID.get(id)!.color, 'census', ci));
  });
  // Bed lanterns: one lantern per kind, hung from lamp-post arms (or rainforest branches).
  const poles = new Sculpt(kit);
  const brass = '#c9a25a';
  /** A lamp post whose arm holds a lantern out to one side; returns the lantern's centre. */
  const lampPost = (x: number, z: number, top: number, side: number, s: number): V3 => {
    poles.add(new T.CylinderGeometry(0.035, 0.05, top - GROUND, 8), '#3c3346', [x, (top + GROUND) / 2, z]);
    poles.add(new T.SphereGeometry(0.06, 8, 6), brass, [x, top, z]);
    poles.add(new T.CylinderGeometry(0.018, 0.018, 0.34, 6), '#3c3346', [x + side * 0.17, top - 0.05, z], 1, [0, 0, Math.PI / 2]);
    poles.add(new T.CylinderGeometry(0.006, 0.006, 0.12, 4), '#2a2230', [x + side * 0.3, top - 0.11, z]);
    return [x + side * 0.3, top - 0.17 - 0.66 * s, z];
  };
  push(lampPost(-6.95, 1.2, 2.0, 1, 0.34), 0.34, LANTERN_BY_ID.get('lan_fox')!.color, 'tundra');
  push(lampPost(-5.75, -1.85, 2.15, -1, 0.34), 0.34, LANTERN_BY_ID.get('lan_gull')!.color, 'tundra');
  push(lampPost(4.1, 2.3, 1.95, 1, 0.32), 0.32, LANTERN_BY_ID.get('lan_kelp')!.color, 'kelp');
  push(lampPost(7.95, 2.0, 1.9, -1, 0.32), 0.32, LANTERN_BY_ID.get('lan_fish')!.color, 'kelp');
  push(lampPost(8.15, -0.9, 1.95, -1, 0.32), 0.32, LANTERN_BY_ID.get('lan_crab')!.color, 'kelp');
  ([[5.45, 2.35, -4.3], [6.0, 2.0, -4.1], [6.75, 2.3, -4.25], [7.25, 2.05, -4.15], [4.6, 1.7, -5.3]] as V3[]).forEach((p, i) => push(p, 0.27, LANTERN_BY_ID.get(bedIds('rainforest')[i])!.color, 'rainforest'));
  // A lantern walk along the front of both side beds.
  for (let i = 0; i < 4; i++) {
    push(lampPost(-4.1, 4.6 - i * 2.2, 0.95, -1, 0.22), 0.22, [GOLD, CORAL, AMBER, ORCHID][i], 'path');
    push(lampPost(4.1, 4.6 - i * 2.2, 0.95, 1, 0.22), 0.22, [AMBER, GOLD, ORCHID, CORAL][i], 'path');
  }
  const lanterns = new LanternField(kit, items, 1.0);
  // Tall poles for the festival strands.
  for (const [x, z, h] of [[-8.6, -5.6, 3.4], [-8.5, 4.4, 2.8], [8.6, -5.8, 3.4], [8.5, 4.4, 2.8]] as V3[]) {
    poles.add(new T.CylinderGeometry(0.04, 0.06, h - GROUND, 8), '#3c3346', [x, (h + GROUND) / 2, z]);
    poles.add(new T.SphereGeometry(0.07, 8, 6), brass, [x, h, z]);
  }
  const strandL = kit.stringLights([-8.6, 3.35, -5.6], [-8.5, 2.75, 4.4], 0.5, kit.n(22), [GOLD, ICE, CORAL]);
  const strandR = kit.stringLights([8.6, 3.35, -5.8], [8.5, 2.75, 4.4], 0.5, kit.n(22), [GOLD, MINT, ORCHID]);
  // Front strands swag from the corner poles to festival posts beside the cabinet (never over it).
  for (const x of [-4.45, 4.45]) {
    poles.add(new T.CylinderGeometry(0.035, 0.05, 1.7 - GROUND, 8), '#3c3346', [x, (1.7 + GROUND) / 2, 5.3]);
    poles.add(new T.SphereGeometry(0.06, 8, 6), brass, [x, 1.7, 5.3]);
  }
  const strandFL = kit.stringLights([-8.5, 2.75, 4.4], [-4.45, 1.68, 5.3], 0.35, kit.n(14), [GOLD, CORAL, ICE]);
  const strandFR = kit.stringLights([8.5, 2.75, 4.4], [4.45, 1.68, 5.3], 0.35, kit.n(14), [GOLD, MINT, ORCHID]);
  poles.mesh({ rough: 0.5 });

  // Sky lanterns that rise from both beds when the festival begins (level 4 and celebrations).
  const skyN = kit.n(36);
  const skyItems: LanternItem[] = [];
  const skyBase: { x: number; z: number; ph: number; sp: number; dr: number }[] = [];
  const rsk = rng(99);
  for (let i = 0; i < skyN; i++) {
    const left = i % 2 === 0;
    skyBase.push({ x: (left ? -1 : 1) * (4.0 + rsk() * 4.4), z: -5.5 + rsk() * 9.5, ph: rsk(), sp: 0.07 + rsk() * 0.06, dr: rsk() * TAU });
    skyItems.push({ p: [0, -5, 0], s: 0.16 + rsk() * 0.1, color: [GOLD, AMBER, CORAL, '#FFE08A'][i % 4] });
  }
  const sky = new LanternField(kit, skyItems, 0.8);
  sky.fitBounds({ center: [0, GROUND + 2.6, -0.6], radius: 10.5 });
  sky.setVisible(false);
  let skyLit = 0;
  kit.animate((t) => {
    if (skyLit <= 0.01) return;
    for (let i = 0; i < skyN; i++) {
      const b = skyBase[i];
      const u = (t * b.sp + b.ph) % 1;
      sky.place(i, b.x + Math.sin(t * 0.4 + b.dr) * 0.3 * u, GROUND + 0.4 + u * 4.6, b.z + Math.cos(t * 0.3 + b.dr) * 0.3 * u, skyItems[i].s);
      sky.set(i, skyLit * Math.min(1, u * 6) * Math.min(1, (1 - u) * 3));
    }
    sky.commit(true);
  });

  // ================= Signs, moon, fireflies, fireworks, lights =================
  const signT = kit.neonSign('TUNDRA', [-4.5, 1.15, -1.95], { height: 0.4, color: ICE, rotY: 0.4 });
  kit.pole([-4.5, 0, -2.02], 0.95);
  const signK = kit.neonSign('KELP FOREST', [4.6, 1.3, -1.9], { height: 0.36, color: '#5FE0C8', rotY: -0.45 });
  const signR = kit.neonSign('RAINFOREST', [4.45, 2.15, -3.9], { height: 0.36, color: '#7fe08a', rotY: -0.4 });
  // ================= FRONT RIGHT: the festival maypole, a lantern umbrella over a round stage =================
  const MP = { x: 5.55, z: 3.45 };
  const stage3d = new Sculpt(kit);
  stage3d.add(new T.CylinderGeometry(1.05, 1.12, 0.22, 32), '#5a3a24', [MP.x, GROUND + 0.11, MP.z]);
  stage3d.add(new T.CylinderGeometry(0.98, 0.98, 0.04, 32), '#7a5232', [MP.x, GROUND + 0.24, MP.z]);
  stage3d.add(new T.CylinderGeometry(0.05, 0.07, 2.45, 10), '#8a2f3a', [MP.x, GROUND + 1.45, MP.z]);
  stage3d.add(new T.SphereGeometry(0.11, 12, 8), '#c9a25a', [MP.x, GROUND + 2.72, MP.z]);
  const spokes = 8;
  const ring: V3[] = [];
  const mayItems: LanternItem[] = [];
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * TAU + 0.2;
    const end: V3 = [MP.x + Math.cos(a) * 1.0, GROUND + 0.62, MP.z + Math.sin(a) * 1.0];
    ring.push(end);
    const top: V3 = [MP.x, GROUND + 2.62, MP.z];
    const dx = end[0] - top[0];
    const dy = end[1] - top[1];
    const dz = end[2] - top[2];
    const len = Math.hypot(dx, dy, dz);
    const mid: V3 = [(end[0] + top[0]) / 2, (end[1] + top[1]) / 2, (end[2] + top[2]) / 2];
    // orient a thin cylinder along the spoke
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / len, dy / len, dz / len));
    const e = new T.Euler().setFromQuaternion(q);
    stage3d.add(new T.CylinderGeometry(0.007, 0.007, len, 4), '#2a2230', mid, 1, [e.x, e.y, e.z]);
    stage3d.add(new T.CylinderGeometry(0.025, 0.03, 0.62, 6), '#3c3346', [end[0], GROUND + 0.42, end[2]]);
    for (const u of [0.35, 0.62, 0.88]) mayItems.push({ p: [top[0] + dx * u, top[1] + dy * u - 0.09, top[2] + dz * u], s: 0.15, color: [GOLD, CORAL, MINT, ORCHID, ICE, AMBER, '#7fe08a', '#B98CFF'][(k + Math.round(u * 3)) % 8] });
  }
  stage3d.mesh({ rough: 0.6, shadow: true });
  const maypole = new LanternField(kit, mayItems, 0.55);
  let mayChase = 0;
  const signF = kit.neonSign('LANTERN FESTIVAL', [5.35, GROUND + 1.25, 2.15], { height: 0.36, color: GOLD, rotY: -0.3 });
  kit.pole([5.35, 0, 2.08], GROUND + 1.05);

  // ================= Night-blooming garden borders at the front =================
  const bush = new Sculpt(kit);
  const bloomSpots: V3[] = [];
  const rb = rng(61);
  for (const [bx, bz, bs] of [[-4.75, 4.9, 0.5], [-7.4, 4.3, 0.6], [-8.4, 2.4, 0.5], [-4.6, 1.9, 0.4], [4.75, 4.9, 0.5], [8.3, 1.9, 0.55], [4.6, -2.9, 0.42]] as V3[]) {
    for (let k = 0; k < 4; k++) {
      const ox = (rb() - 0.5) * bs * 1.2;
      const oz = (rb() - 0.5) * bs * 1.0;
      bush.add(new T.IcosahedronGeometry(bs * (0.45 + rb() * 0.25), 1), ['#1f5a3a', '#2a6e44', '#245038'][k % 3], [bx + ox, GROUND + bs * 0.35, bz + oz], [1, 0.75, 1]);
    }
    for (let k = 0; k < kit.n(7); k++) {
      const a = rb() * TAU;
      bloomSpots.push([bx + Math.cos(a) * bs * 0.55, GROUND + bs * (0.4 + rb() * 0.35), bz + Math.sin(a) * bs * 0.45]);
    }
  }
  bush.mesh({ rough: 0.8, flat: true });
  const bloomMat = kit.track(new T.MeshStandardMaterial({ color: '#fff0f6', emissive: '#ffd6ec', emissiveIntensity: 0.1, roughness: 0.5 }));
  const blooms = new T.InstancedMesh(kit.track(new T.IcosahedronGeometry(0.05, 0)), bloomMat, bloomSpots.length);
  bloomSpots.forEach((p, i) => {
    ko.position.set(p[0], p[1], p[2]);
    ko.rotation.set(0, 0, 0);
    ko.scale.setScalar(1);
    ko.updateMatrix();
    blooms.setMatrixAt(i, ko.matrix);
  });
  kit.add(blooms);
  const marquee = kit.neonSign('BIODIVERSITY LANTERN FESTIVAL', [0, 1.5, -7.3], { height: 0.6, color: GOLD });
  for (const s of [signT, signK, signR, signF]) s.rotation.x = -0.6;
  marquee.rotation.x = -0.75;
  const moon = kit.orb([-4.55, 1.55, -6.3], 0.36, '#FFF0C8');
  const moonHalo = new T.Sprite(kit.track(new T.SpriteMaterial({ map: radialTexture('rgba(255,240,200,0.7)', 'rgba(255,240,200,0)', 'l27moon'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.4 })));
  moonHalo.position.set(-4.55, 1.55, -6.35);
  moonHalo.scale.setScalar(1.9);
  kit.add(moonHalo);
  const fireflies = kit.motes({ x0: -8.5, x1: -3.8, y0: 0, y1: 2.6, z0: -5, z1: 4.5 }, 50, '#d8ff8a', { speed: 0.08, size: 0.09 });
  const sparks = kit.motes({ x0: 3.8, x1: 8.5, y0: 0, y1: 3.2, z0: -5.5, z1: 3 }, 60, MINT, { speed: 0.1, size: 0.09 });
  const fw = kit.fireworks({ x0: -8.6, x1: -5.2, y0: 1.8, y1: 2.8, z: -3.6 }, [GOLD, CORAL, ICE, AURORA]);
  const fw2 = kit.fireworks({ x0: 5.2, x1: 8.6, y0: 1.8, y1: 2.8, z: -2.6 }, [GOLD, ORCHID, MINT, AMBER]);
  const moonLight = kit.spot([-4.2, 6.5, -1.2], [-6.6, 0, -2.4], '#a9c8ff', 18, 0.55);
  const warmLight = kit.spot([4.5, 6.5, 3.5], [6.2, 0, -1.8], '#ffcf8a', 26, 0.55);
  const poolLight = kit.point([6.1, 0.5, 0.6], '#3fe0d0', 0, 5);

  // Lantern brightness by group and level.
  let chase = 0;
  const bedLevel = (g: (typeof groupOf)[number], sT: number, sK: number, sR: number, s0: number) =>
    g === 'tundra' ? sT : g === 'kelp' ? sK : g === 'rainforest' ? sR : g === 'path' ? s0 : 0;

  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const sT = kit.stage(level, 0.4, 1.3);
      const sK = kit.stage(level, 1.3, 2.3);
      const sR = kit.stage(level, 2.3, 3.2);
      const sF = kit.stage(level, 3.3, 4);
      if (!kit.reducedMotion) chase += dt * (0.6 + 2.4 * sF);
      for (let i = 0; i < items.length; i++) {
        const g = groupOf[i];
        let lit: number;
        if (g === 'census') {
          const c = censusCol[i];
          lit = c === 0 ? sT : c === 1 ? sK : sR;
          lit = 0.12 + 0.88 * lit;
        } else lit = 0.14 + 0.86 * bedLevel(g, sT, sK, sR, s0);
        // Festival chase: a wave of extra brightness ripples through every lantern.
        if (sF > 0.01) lit = Math.min(1.3, lit + sF * 0.35 * (0.5 + 0.5 * Math.sin(chase * 2 - i * 0.7)));
        lanterns.set(i, lit * (0.92 + 0.08 * energy));
      }
      lanterns.commit();
      for (let i = 0; i < auroras.length; i++) auroras[i].opacity = i < 2 ? 0.08 + 0.6 * sT + 0.3 * sF : 0.85 * sF;
      frondMat.emissiveIntensity = 0.05 + 0.5 * sK + 0.2 * sF;
      orchidMat.emissiveIntensity = 0.1 + 2.2 * sR;
      shardMat.emissiveIntensity = 0.05 + 0.9 * sT;
      signT.setLit(0.2 + 0.8 * sT);
      signK.setLit(0.2 + 0.8 * sK);
      signR.setLit(0.2 + 0.8 * sR);
      signF.setLit(0.3 + 0.7 * Math.max(s0 * 0.6, sF));
      marquee.setLit(0.2 + 0.8 * Math.max(s0 * 0.5, sF));
      moon.setLit(0.4 + 0.6 * s0);
      (moonHalo.material as THREE.SpriteMaterial).opacity = 0.3 + 0.3 * s0 + 0.3 * sF;
      strandL.setLit(0.15 + 0.85 * sT);
      strandR.setLit(0.15 + 0.85 * Math.max(sK, sR));
      strandFL.setLit(0.2 + 0.8 * Math.max(s0 * 0.5, sF));
      strandFR.setLit(0.2 + 0.8 * Math.max(s0 * 0.5, sF));
      fireflies.setLit(0.2 + 0.6 * sR + 0.2 * sF);
      sparks.setLit(0.15 + 0.7 * sK);
      fw.setLit(sF);
      fw2.setLit(sF);
      bloomMat.emissiveIntensity = 0.1 + 1.6 * Math.max(sR * 0.6, sF);
      // the maypole: dim paper by day-one, a turning chase of colour at the festival
      if (!kit.reducedMotion) mayChase += dt * (0.4 + 3 * sF);
      for (let i = 0; i < mayItems.length; i++) {
        const spoke = Math.floor(i / 3);
        const wave = 0.5 + 0.5 * Math.sin(mayChase * 2 - spoke * 0.8);
        maypole.set(i, 0.12 + 0.35 * s0 + 0.55 * Math.max(sR, sF) * (sF > 0.01 ? 0.5 + 0.5 * wave : 1));
      }
      maypole.commit();
      if (poolLight) poolLight.intensity = 1 + 6 * sK;
      if (moonLight) moonLight.intensity = 12 + 6 * s0;
      if (warmLight) warmLight.intensity = 14 + 14 * Math.max(sR, sF);
      horizon.repaint(level);
      skyLit = Math.max(sF, skyLit * 0.98 - 0.002);
      sky.setVisible(skyLit > 0.01 && !kit.reducedMotion);
      (censusPlate.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + 0.5 * s0;
    },
    celebrate(p) {
      const k = Math.sin(p * Math.PI);
      fw.setLit(Math.max(k, 0));
      fw2.setLit(Math.max(k, 0));
      skyLit = Math.max(skyLit, k);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room vignette

const festivalRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const floor = new T.Mesh(new T.CylinderGeometry(0.95, 1.0, 0.06, 32), matte(kit, '#1f3a2c'));
  floor.position.y = 0.03;
  kit.add(floor);
  // three little beds: tundra, kelp, rainforest
  const beds = new Sculpt(kit);
  beds.add(new T.BoxGeometry(0.5, 0.1, 0.5), '#e4f0ff', [-0.6, 0.11, 0.05]);
  beds.add(new T.BoxGeometry(0.5, 0.1, 0.5), '#2a7a8c', [0, 0.11, 0.05]);
  beds.add(new T.BoxGeometry(0.5, 0.1, 0.5), '#2f8a4a', [0.6, 0.11, 0.05]);
  beds.add(new T.ConeGeometry(0.12, 0.42, 7), '#2c8a4c', [0.78, 0.37, -0.12]);
  beds.add(new T.ConeGeometry(0.09, 0.3, 7), '#3aa35a', [0.45, 0.31, -0.15]);
  beds.add(new T.ConeGeometry(0.025, 0.42, 5), '#a8c44a', [-0.15, 0.37, -0.12], 1, [0, 0, 0.12]);
  beds.add(new T.ConeGeometry(0.022, 0.34, 5), '#c6e26a', [0.16, 0.33, -0.14], 1, [0, 0, -0.15]);
  beds.add(new T.SphereGeometry(0.05, 10, 8), '#7a5236', [0.05, 0.19, 0.2], [1.6, 0.6, 0.8]);
  beds.add(new T.DodecahedronGeometry(0.07, 0), '#d4e6fb', [-0.75, 0.2, -0.1]);
  beds.mesh({ rough: 0.8 });
  // a lantern bar chart: 2 tundra kinds, 3 kelp kinds, 5 rainforest kinds
  const items: LanternItem[] = [];
  (['tundra', 'kelp', 'rainforest'] as Bed[]).forEach((bed, ci) => {
    bedIds(bed).forEach((id, k) => items.push({ p: [-0.6 + ci * 0.6, 0.28 + k * 0.15, 0.12], s: 0.1, color: LANTERN_BY_ID.get(id)!.color }));
  });
  const lan = new LanternField(kit, items, 0.16);
  // a thin cord threads each bed's column of kinds
  const cords = new Sculpt(kit);
  for (const x of [-0.6, 0, 0.6]) cords.add(new T.CylinderGeometry(0.004, 0.004, 0.9, 4), '#2a2230', [x, 0.62, 0.12]);
  cords.add(new T.BoxGeometry(1.5, 0.025, 0.025), '#8a2f3a', [0, 1.07, 0.12]);
  cords.mesh({ rough: 0.6 });
  // the Moon Gate arch with its moon
  const gate = new T.Mesh(new T.TorusGeometry(0.42, 0.035, 10, 40, Math.PI), matte(kit, '#c9a25a', { rough: 0.4 }));
  gate.position.set(0, 0.06, -0.62);
  kit.add(gate);
  const moon = kit.orb([0, 0.62, -0.7], 0.13, '#FFF0C8');
  return {
    update(t, lit) {
      for (let i = 0; i < items.length; i++) {
        const col = i < 2 ? 0 : i < 5 ? 1 : 2;
        const wave = kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 2 + i);
        lan.set(i, 0.75 * lit * wave * (0.6 + 0.4 * Math.max(0, Math.min(1, lit * 3 - col * 0.6))));
      }
      lan.commit();
      moon.setLit(lit);
    },
  };
};

// ---------------------------------------------------------------- the attraction

// Shared constants for the 2D per-frame draws (no allocations while drawing).
const FIREFLY_BOX: [number, number, number, number] = [40, 60, 560, 330];
const SNOW_BOX: [number, number, number, number] = [30, 340, 200, 780];
const CENSUS_BULBS = [GOLD, CORAL, MINT];
const SKY_COLORS = [GOLD, CORAL, MINT, ORCHID, ICE];

export const L27: TableDef = {
  lessonId: 'L27',
  signature: 'Lantern beds that count kinds, not visits, and a Festival Ramp that delivers the Wonderball to a Lantern Launcher upper flipper aimed at the rainforest canopy',
  ballRole: 'The Wonderball is a game token, not a plant or an animal: each lantern it lights stands for a whole kind of living thing, and a real habitat holds far more kinds than this garden.',
  theme: {
    bg: ['#1c1a52', '#0a1424'],
    rail: '#b9c9e8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: AMBER,
    accent2: '#9C7CF0',
    bumperCap: '#FFD98A',
    bumperRing: '#22402e',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(255,199,91,0.18)',
    trail: '#FFE3A0',
  },
  lines: {
    intro: 'Welcome to the Lantern Festival, where every lantern stands for one kind of living thing! When your textbook was written, scientists had named about 1.9 million kinds, and they are still counting.',
    quark: '"Look at all these fig trees! A bed packed with that many trees must be the most biodiverse spot in the garden, surely?" Professor Quark wonders.',
    pipTip: 'A full plunge rolls down the Tundra Trail onto the Lantern Launcher. Hold left to catch it, then flip it up the Lantern Gap into the rainforest canopy.',
  },
  build,
  onProgress(rt, { slot, stage: st }) {
    const census = rt.find<LanternCensus>('census');
    if (!census) return;
    census.setKelp(slot === 1 ? (st < 2 ? 'barren' : st === 2 ? 'recovering' : 'normal') : 'normal');
    census.setJudging(slot === 2 && st === 0);
    // The Canopy Gate stays open at the start, so a full plunge really does roll down the Tundra
    // Trail onto the Launcher (Pip's first tip). It closes, turning Kelp Current orbits down into
    // the canopy lanes and onto the rainforest target, while a stage needs the rainforest.
    const gate = rt.find<Diverter>('canopy_gate');
    if (gate) gate.set((slot === 0 && st >= 2) || (slot === 3 && st === 0) ? 1 : 0);
  },
  skillShot: 'lan_frog',
  shots: [
    { id: 'festivalRamp', label: 'Festival Ramp', on: [{ type: 'ramp', id: 'festival_ramp' }], insert: 'ins_ramp' },
    { id: 'kelpCurrent', label: 'Kelp Current', on: [{ type: 'shot', id: 'kelp_sw' }], insert: 'ins_kelp' },
    { id: 'moonGate', label: 'Moon Gate', on: [{ type: 'saucer', id: 'moon_gate' }], insert: 'ins_pocket' },
    { id: 'otter', label: 'Otter target', on: [{ type: 'target', id: 'otter_target' }], insert: 'ins_otter' },
    { id: 'urchins', label: 'Urchin bank', on: [{ type: 'dropBank', id: 'urchins' }], insert: 'ins_urchins' },
    { id: 'kelpTarget', label: 'Kelp target', on: [{ type: 'target', id: 'kelp_target' }], insert: 'ins_kelpbed' },
    { id: 'tundra', label: 'Tundra target', on: [{ type: 'target', id: 'tundra_target' }], insert: 'ins_tundra' },
    { id: 'rainforest', label: 'Rainforest target', on: [{ type: 'target', id: 'rain_target' }], insert: 'ins_rain' },
    { id: 'canopy', label: 'Fig trees', on: [{ type: 'bumper', group: 'canopy' }], insert: 'ins_canopy' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Count the Kinds',
      brief: 'Is the richest bed the one you visit most, or the one with the most kinds? Visit the fig trees, then count the kinds in the tundra and rainforest beds.',
      objectiveIds: ['L27-O1'],
      stages: [
        { kind: 'collect', text: 'Visit the FIG trees 5 times: still one kind', match: { type: 'bumper', group: 'canopy' }, count: 5, preview: ['canopy'] },
        { kind: 'collect', text: 'Tundra bed: light both kinds, FOX and GULL', match: { type: 'rollover', group: 'tundra' }, count: 2, distinct: true, lamps: bedIds('tundra'), preview: ['festivalRamp', 'kelpCurrent'] },
        { kind: 'collect', text: 'Rainforest bed: light 3 different kinds', match: { type: 'rollover', group: 'rainforest' }, count: 3, distinct: true, lamps: bedIds('rainforest'), preview: ['canopy', 'kelpCurrent'] },
        { kind: 'discover', text: 'Compare the beds at the Moon Gate', pocket: 'moon_gate', questions: 1 },
      ],
      discovery: 'Biodiversity counts kinds, not how many individuals: three trees of one fig species are still one kind. Comparing species, the tundra bed holds only a few kinds and the rainforest bed holds many.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'When One Lantern Goes Dark',
      brief: 'Hunters took the sea otters and the kelp bed went dark. Follow the chain: bring the otters home, let them eat urchins, and give the kelp a chance to regrow.',
      objectiveIds: ['L27-O2', 'L27-O4'],
      stages: [
        { kind: 'collect', text: 'Otters come home: hit the OTTER target', match: { type: 'target', id: 'otter_target' }, count: 1, lamps: ['otter_target'], preview: ['otter'] },
        { kind: 'collect', text: 'Otters eat urchins: drop all 3 URCHINS', match: { type: 'drop', group: 'urchins' }, count: 3, distinct: true, lamps: ['urchins_1', 'urchins_2', 'urchins_3'], preview: ['urchins'] },
        { kind: 'collect', text: 'Kelp regrows: light KELP, FISH and CRAB', match: { type: 'rollover', group: 'kelp' }, count: 3, distinct: true, lamps: bedIds('kelp'), preview: ['kelpCurrent'] },
        { kind: 'discover', text: 'See what changed at the Moon Gate', pocket: 'moon_gate', questions: 1 },
      ],
      discovery: 'When hunters removed sea otters, urchins boomed and ate the kelp, and many species declined. Otters are a keystone species: their effect far outweighs their numbers. They lived on elsewhere, so they could return.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Judge the Rescue Plan',
      brief: 'Down the coast, otters are scarce, urchins are booming and the kelp is shrinking. Test two plans, replanting kelp or protecting otters, then keep measuring.',
      objectiveIds: ['L27-O5', 'L27-O4'],
      stages: [
        { kind: 'collect', text: 'Test both plans: hit the KELP and OTTER targets', match: { type: 'target', id: ['kelp_target', 'otter_target'] }, count: 2, distinct: true, lamps: ['kelp_target', 'otter_target'], preview: ['kelpTarget', 'otter'] },
        { kind: 'shots', text: 'Keep measuring: survey the kelp in the Kelp Current', shots: ['kelpCurrent'] },
        { kind: 'discover', text: 'Judge the plans at the Moon Gate', pocket: 'moon_gate', questions: 1 },
      ],
      discovery: 'A strong plan goes after the cause the evidence points to. Replanted kelp is eaten while urchins boom; protecting otters tackles the cause. Keep measuring, because recovery depends on local conditions.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Light the Festival',
    brief: 'Light the target in every habitat, then send the Wonderball over the Festival Ramp and through the Kelp Current to start the festival.',
    stages: [
      { kind: 'collect', text: 'Light every habitat: TUNDRA, KELP, RAINFOREST', match: { type: 'target', group: 'habitat' }, count: 3, distinct: true, lamps: ['tundra_target', 'kelp_target', 'rain_target'], preview: ['tundra', 'kelpTarget', 'kelpCurrent'] },
      { kind: 'shots', text: 'Ride the Festival Ramp and the Kelp Current', shots: ['festivalRamp', 'kelpCurrent'], order: 'any' },
      { kind: 'discover', text: 'Final look through the Moon Gate', pocket: 'moon_gate', questions: 2 },
    ],
    celebration: 'Every bed in the garden glows! Many kinds of life often give an ecosystem backups when one kind is lost, though no amount of variety protects it from every disturbance.',
  },
  set: festivalSet,
  room: festivalRoom,
  icons: {
    moon(ctx, s) {
      // Crescent: outer circle (r 0.85) minus an offset circle (r 0.7, shifted 0.4 right).
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.85, (54.8 * Math.PI) / 180, (305.2 * Math.PI) / 180, false);
      ctx.arc(s * 0.4, 0, s * 0.7, (277.4 * Math.PI) / 180, (82.6 * Math.PI) / 180, true);
      ctx.closePath();
      ctx.fill();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintGarden(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s1 = stage(level, 0.4, 1.3);
      const s3 = stage(level, 2.3, 3.2);
      if (!reduced) {
        drift(ctx, 5, 14, t, '#d8ff8a', FIREFLY_BOX, 6, 1.6, 0.25 + 0.4 * s3);
        drift(ctx, 6, 10, t, ICE, SNOW_BOX, 8, 1.4, 0.2 + 0.4 * s1);
      }
      stringLights(ctx, 228, 664, 344, 664, 10, 7, CENSUS_BULBS, (0.3 + 0.7 * stage(level, 0, 0.6)) * (0.7 + 0.3 * energy), reduced ? 0 : t);
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(MOON[0], MOON[1], 10, MOON[0], MOON[1], 460);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 20; i++) {
        const x = 60 + ((i * 97) % 480);
        const y = 760 - p * 640 - ((i * 53) % 120) + Math.sin(t * 2 + i) * 6;
        paperLantern(ctx, x, y, 6, SKY_COLORS[i % 5], 1 - p * 0.5);
      }
    },
  },
};
export default L27;
