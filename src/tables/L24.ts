// Lesson 24 — Heat, Temperature, and State Changes — "Heatwave Ice Palace"
// A palace of ice, water and vapor at the edge of a heatwave. The orbit around the palace is the
// state triangle itself: WATER pools at the foot of the table, the ICE HALL fills the top-left
// corner and the VAPOR VAULT the top-right. Six State Gates read the Wonderball's direction, so a
// trip one way reads FREEZE -> SUBLIME -> CONDENSE and the reverse trip EVAPORATE -> DEPOSIT -> MELT:
// every change has a partner running the other way. The Heat Bridge only runs from the warm
// terrace to the ice, two boiling pots sit on the Palace Keep, and the Keep's Fountain is the
// Wonder Pocket that blooms into a luminous fountain when the palace wakes.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Ball } from '../game/physics/ball.ts';
import type { Collider } from '../game/physics/types.ts';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Rollover } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import {
  TAU, glowDot, mix, neonText, rgba, rng, rrect, stage, stars, vgrad,
} from '../game/render/art.ts';

type P2 = [number, number];
type V3 = [number, number, number];

const GOLD = '#FFD27A';
const APRICOT = '#FFA06B';
const AQUA = '#7FE7F2';
const FROST = '#BFEFFF';
const PEARL = '#F4FBFF';
const ROSE = '#FF9FC4';
const ICEBLUE = '#8FD3FF';

// ================================================================ playfield geometry

/**
 * A state gate: a rollover that reads the direction the Wonderball crosses it. The orbit is a
 * model of the state triangle (WATER at the bottom, ICE top-left, VAPOR top-right), so a trip
 * clockwise reads FREEZE -> SUBLIME -> CONDENSE and counter-clockwise EVAPORATE -> DEPOSIT -> MELT.
 * A gate after the first of a trip counts only when the Wonderball came through the gate before
 * it moments ago, so a plunged ball sweeping over the top lights nothing by itself.
 */
class StateGate extends Rollover {
  readonly dx: number;
  readonly dy: number;
  readonly after: string | null;
  readonly trail: Map<number, { id: string; t: number }>;
  constructor(rt: TableRuntime, id: string, x: number, y: number, dirDeg: number, o: { heatIn: boolean; after?: string; label: string; r?: number; trail: Map<number, { id: string; t: number }> }) {
    super(rt, id, x, y, { group: o.heatIn ? 'heatIn' : 'heatOut', label: o.label, role: 'lane', r: o.r ?? 16 });
    this.dx = Math.cos((dirDeg * Math.PI) / 180);
    this.dy = Math.sin((dirDeg * Math.PI) / 180);
    this.after = o.after ?? null;
    this.trail = o.trail;
    this.lampColor = o.heatIn ? APRICOT : AQUA;
  }
  onSensorEnter(c: Collider, ball: Ball) {
    if (ball.vx * this.dx + ball.vy * this.dy < 60) return;
    if (this.after) {
      const prev = this.trail.get(ball.id);
      if (!prev || prev.id !== this.after || this.rt.time - prev.t > 3) return;
    }
    this.trail.set(ball.id, { id: this.id, t: this.rt.time });
    super.onSensorEnter(c, ball);
  }
}

const POCKET: P2 = [280, 574];
const ARC_C: P2 = [310, 300];
const arcPt = (deg: number, r = 268): P2 => [ARC_C[0] + Math.cos((deg * Math.PI) / 180) * r, ARC_C[1] + Math.sin((deg * Math.PI) / 180) * r];
// The bridge lands in the Ice Stair beside the ice blocks (its cool end), so the Wonderball comes
// down the stair to the exit deflector like an orbit return. Dropping it all the way into the left
// inlane gave a ~2600 u/s return that went straight past the flipper almost every time.
const BRIDGE_PATH: P2[] = [
  [388, 596], [416, 530], [444, 462], [468, 396], [480, 330], [478, 260], [460, 195], [422, 140], [364, 104],
  [294, 90], [226, 96], [166, 118], [118, 160], [84, 218], [62, 290], [52, 370], [52, 440],
];
const BRIDGE_END = BRIDGE_PATH[BRIDGE_PATH.length - 1];
const KEEP: P2[] = [[226, 566], [226, 480], [280, 430], [334, 480], [334, 566]];
const STAIR_INNER: P2[] = [[158, 572], [98, 420], [90, 360]];
const FLUE_INNER: P2[] = [[420, 572], [493, 400], [498, 372], [498, 276]];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });
  const trail = new Map<number, { id: string; t: number }>();
  const gate = (id: string, at: P2, dir: number, heatIn: boolean, label: string, after?: string) =>
    b.rt.add(new StateGate(b.rt, id, at[0], at[1], dir, { heatIn, after, label, trail }));

  // --- Ice Stair (left orbit, WATER -> ICE): a funnel mouth that catches the right flipper's
  //     shallow shots, then the channel along the cabinet wall. ---
  b.wall(STAIR_INNER, { id: 'stair_inner', r: 3 });
  b.post(158, 574, 5);
  b.post(90, 357, 5);
  b.gate('stair_deflect', [FRAME.left, 646], [54, 694], -90);
  // Both gates sit where the climb meets the arch, in the ICE corner: arriving = FREEZING,
  // leaving down the stair = MELTING.
  gate('gate_freeze', arcPt(214), -56, false, 'FREEZE');
  gate('gate_melt', arcPt(229), 139, true, 'MELT', 'gate_deposit');

  // --- Frost Gallery (top arch, ICE <-> VAPOR) ---
  gate('gate_sublime', arcPt(256), 0, true, 'SUBLIME', 'gate_freeze');
  gate('gate_deposit', arcPt(284), 180, false, 'DEPOSIT', 'gate_evaporate');

  // --- Vapor Flue (right orbit, WATER <-> VAPOR) ---
  // The wall rises past the shooter-lane gate so a ball coming down the right side of the arch
  // (bounced off the gate) drops into the flue instead of flying back across the palace.
  b.wall(FLUE_INNER, { id: 'flue_inner', r: 3 });
  b.post(420, 574, 5);
  b.post(498, 273, 5);
  // A long deflector: a ball drifting down the wide funnel is steered toward the right inlane.
  b.wall([[FRAME.laneSep, 646], [502, 712]], { id: 'flue_deflect', r: 3 });
  gate('gate_evaporate', [522, 412], -90, true, 'EVAPORATE');
  gate('gate_condense', [523, 336], 90, false, 'CONDENSE', 'gate_sublime');
  b.rollover('skill_drip', 527, 474, { group: 'skill', label: 'SKILL' });

  // --- Heat Bridge: from the warm terrace (right) over the palace to the ice (the Ice Stair) ---
  b.wall([[370, 590], [398, 522], [426, 454], [446, 392], [494, 368]], { id: 'bridge_body', r: 3, style: 'invisible' });
  b.wall([[370, 591], [348, 648]], { id: 'bridge_flare', r: 3 });
  b.ramp('heat_bridge', { path: BRIDGE_PATH, width: 36, footprintTo: 0, peak: 110, label: 'HEAT BRIDGE' });

  // --- The Palace Keep: Fountain pocket in its foot, two boiling pots on its lower faces ---
  b.wall(KEEP, { id: 'keep', r: 4 });
  b.wall([[256, 600], [256, 552], [280, 541], [304, 552], [304, 600]], { id: 'keep_cup', r: 4 });
  b.target('pot_small', [226, 567], [255, 600], { group: 'pots', label: 'SMALL POT' });
  b.target('pot_big', [305, 600], [334, 567], { group: 'pots', label: 'BIG POT' });
  b.saucer('fountain', POCKET[0], POCKET[1], { role: 'pocket', ejectDeg: 100, ejectSpeed: 760, captureMaxSpeed: 2400, label: 'FOUNTAIN', icon: 'fountain' });

  // --- Ice Hall: ice blocks across the top of the left lane, with a backstop ---
  b.dropBank('ice', 104, 372, -15, 3, { size: 26, gap: 5, group: 'ice', labels: ['ICE', 'ICE', 'ICE'] });
  b.wall([[90, 360], [198, 335]], { id: 'ice_backstop', r: 3 });

  // --- Vapor Vault: water-vapor bumpers spread far apart, as gas particles are ---
  b.bumper('vapor_a', 230, 215, { group: 'vapor', r: 22, icon: 'molecule' });
  b.bumper('vapor_b', 342, 196, { group: 'vapor', r: 22, icon: 'molecule' });
  b.bumper('vapor_c', 405, 270, { group: 'vapor', r: 22, icon: 'molecule' });
  b.bumper('vapor_d', 300, 290, { group: 'vapor', r: 22, icon: 'molecule' });

  // --- Inserts ---
  b.insert('ins_stair', 120, 640, { deg: -112, color: AQUA });
  b.insert('ins_flue', 430, 640, { deg: -67, color: APRICOT });
  b.insert('ins_bridge', 376, 664, { deg: -70, color: APRICOT });
  b.insert('ins_pocket', 280, 660, { deg: -90, color: GOLD });
  b.insert('ins_ice', 180, 640, { deg: -105, color: FROST });
  b.insert('ins_small', 222, 610, { shape: 'circle', size: 9, color: GOLD });
  b.insert('ins_big', 338, 610, { shape: 'circle', size: 9, color: GOLD });
  b.insert('ins_vault', 300, 380, { shape: 'star', size: 11, color: PEARL });
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

/** Printed label (Atkinson) with a dark keyline, optionally rotated. */
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1, rot = 0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, size * 0.32);
  ctx.strokeStyle = `rgba(6,14,34,${0.82 * alpha})`;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A printed plaque: rounded tag with a dark ground and a coloured rim. */
function plaqueTag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, lit: number) {
  ctx.save();
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + size * 1.4;
  const h = size * 1.75;
  rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(8,16,38,0.72)';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = rgba(color, 0.35 + 0.55 * lit);
  ctx.stroke();
  ctx.restore();
  label(ctx, text, x, y + 0.5, size, color, 0.55 + 0.45 * lit);
}

/** Process arrow along a smooth path with an arrowhead. */
function arrow(ctx: CanvasRenderingContext2D, pts: P2[], color: string, alpha: number, width = 3) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(6,14,34,${0.5 * alpha})`;
  ctx.lineWidth = width + 3;
  smoothLine(ctx, pts);
  ctx.stroke();
  if (alpha > 0.5) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * (alpha - 0.5);
  }
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  smoothLine(ctx, pts);
  ctx.stroke();
  const [x1, y1] = pts[pts.length - 2];
  const [x2, y2] = pts[pts.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = width * 3.2;
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x2 + Math.cos(a) * h * 0.7, y2 + Math.sin(a) * h * 0.7);
  ctx.lineTo(x2 + Math.cos(a + 2.4) * h, y2 + Math.sin(a + 2.4) * h);
  ctx.lineTo(x2 + Math.cos(a - 2.4) * h, y2 + Math.sin(a - 2.4) * h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Faceted ice crystal (hexagonal prism with a pointed tip) seen from the front. */
function crystal2d(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, lit: number) {
  const tip = Math.min(h * 0.32, w * 0.95);
  ctx.fillStyle = rgba(mix('#2c5784', '#86c9ef', 0.2 + 0.55 * lit), 0.7);
  poly(ctx, [[x - w / 2, base], [x - w / 2, base - h + tip], [x, base - h], [x, base]]);
  ctx.fill();
  ctx.fillStyle = rgba(mix('#4a7fae', '#d6f3ff', 0.2 + 0.6 * lit), 0.7);
  poly(ctx, [[x, base], [x, base - h], [x + w / 2, base - h + tip], [x + w / 2, base]]);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.18 + 0.4 * lit);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x, base - 2);
  ctx.lineTo(x, base - h);
  ctx.moveTo(x - w / 2, base - h + tip);
  ctx.lineTo(x, base - h);
  ctx.lineTo(x + w / 2, base - h + tip);
  ctx.stroke();
  if (lit > 0.05) glowDot(ctx, x, base - h + tip * 0.6, w, FROST, 0.3 * lit);
}

function snowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(TAU / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(-r * 0.24, -r * 0.78);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(r * 0.24, -r * 0.78);
    ctx.stroke();
  }
  ctx.restore();
}

/** SOLID model: particles locked in rows, each with a small vibration ring. */
function latticeModel(ctx: CanvasRenderingContext2D, x: number, y: number, cols: number, rows: number, gap: number, color: string, lit: number) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = x + (c - (cols - 1) / 2) * gap;
      const py = y + (r - (rows - 1) / 2) * gap;
      ctx.strokeStyle = rgba(color, 0.2 + 0.3 * lit);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, gap * 0.4, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba(color, 0.55 + 0.45 * lit);
      ctx.beginPath();
      ctx.arc(px, py, gap * 0.22, 0, TAU);
      ctx.fill();
    }
  }
}

/** GAS model: a few particles far apart, each trailing a motion streak. */
function gasModel(ctx: CanvasRenderingContext2D, seed: number, area: [number, number, number, number], n: number, color: string, lit: number, avoid: [number, number, number][]) {
  const r = rng(seed);
  let made = 0;
  for (let k = 0; k < n * 4 && made < n; k++) {
    const x = area[0] + r() * (area[2] - area[0]);
    const y = area[1] + r() * (area[3] - area[1]);
    const a = r() * TAU;
    const len = 14 + r() * 18;
    if (avoid.some(([ax, ay, ar]) => Math.hypot(x - ax, y - ay) < ar)) continue;
    made++;
    const g = ctx.createLinearGradient(x - Math.cos(a) * len, y - Math.sin(a) * len, x, y);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, 0.25 + 0.4 * lit));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = rgba(color, 0.55 + 0.45 * lit);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, TAU);
    ctx.fill();
  }
}

/** LIQUID model: particles close together but jumbled, free to slide. */
function liquidModel(ctx: CanvasRenderingContext2D, seed: number, cx: number, cy: number, rx: number, ry: number, color: string, lit: number) {
  const r = rng(seed);
  const pts: P2[] = [];
  for (let k = 0; k < 160 && pts.length < 18; k++) {
    const a = r() * TAU;
    const d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    if (pts.some(([px, py]) => Math.hypot(px - x, py - y) < 7.2)) continue;
    pts.push([x, y]);
  }
  for (const [x, y] of pts) {
    ctx.fillStyle = rgba(color, 0.5 + 0.5 * lit);
    ctx.beginPath();
    ctx.arc(x, y, 3.1, 0, TAU);
    ctx.fill();
  }
}

function pot2d(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, lit: number) {
  // flames under the pot
  for (let i = 0; i < 3; i++) {
    const fx = x + (i - 1) * w * 0.3;
    ctx.fillStyle = rgba(mix('#a0563a', '#ffb05a', lit), 0.45 + 0.5 * lit);
    ctx.beginPath();
    ctx.moveTo(fx - 3, base + 6);
    ctx.quadraticCurveTo(fx, base - 2, fx + 3, base + 6);
    ctx.fill();
  }
  ctx.fillStyle = mix('#4f5d72', '#c3d0e0', 0.3 + 0.45 * lit);
  rrect(ctx, x - w / 2, base - h, w, h, 3);
  ctx.fill();
  ctx.fillStyle = mix('#6d7d93', '#eef4fb', 0.3 + 0.5 * lit);
  ctx.fillRect(x - w / 2 - 2.5, base - h - 2, w + 5, 3);
  ctx.fillRect(x - w / 2 - 6, base - h + 3, 5, 2.5);
  ctx.fillRect(x + w / 2 + 1, base - h + 3, 5, 2.5);
  ctx.fillStyle = rgba(AQUA, 0.35 + 0.5 * lit);
  ctx.fillRect(x - w / 2 + 2, base - h + 1, w - 4, 2);
}

function thermometer2d(ctx: CanvasRenderingContext2D, x: number, top: number, h: number, lit: number) {
  ctx.fillStyle = rgba('#e9f6ff', 0.35 + 0.3 * lit);
  rrect(ctx, x - 2.6, top, 5.2, h, 2.6);
  ctx.fill();
  ctx.fillStyle = rgba('#ff5a5a', 0.55 + 0.45 * lit);
  ctx.beginPath();
  ctx.arc(x, top + h + 2, 4.6, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 1.3, top + h * 0.14, 2.6, h * 0.86 + 2);
  ctx.strokeStyle = rgba('#ffffff', 0.4);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 4, top + h * 0.14);
  ctx.lineTo(x + 7, top + h * 0.14);
  ctx.stroke();
}

/**
 * Heating curve of ice at normal sea-level air pressure, as (time fraction, °C). Illustrative, but
 * in the right order: the boiling step is the longest (vaporizing water takes far more energy than
 * melting the same ice), and warming the liquid from 0 to 100 °C takes a little longer than melting.
 */
const CURVE_PTS: [number, number][] = [[0, -20], [0.08, 0], [0.24, 0], [0.43, 100], [0.9, 100], [1, 114]];

/** The heating curve for ice at normal sea-level air pressure, lighting segment by segment. */
function heatingCurve(ctx: CanvasRenderingContext2D, level: number) {
  const X0 = 170;
  const Y0 = 706;
  const W = 238;
  const H = 96;
  const lit = stage(level, 0.3, 3.5);
  ctx.save();
  rrect(ctx, X0 - 6, Y0 - 20, W + 12, H + 34, 12);
  ctx.fillStyle = 'rgba(7,18,40,0.6)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(FROST, 0.25 + 0.4 * lit);
  ctx.stroke();
  ctx.restore();
  label(ctx, 'HEATING CURVE', X0 + W / 2 - 34, Y0 - 8, 11, PEARL, 0.6 + 0.4 * lit);
  label(ctx, 'sea-level pressure', X0 + W - 52, Y0 - 8, 8.5, FROST, 0.5 + 0.4 * lit);
  const ax = X0 + 34;
  const ay = Y0 + H - 6;
  const top = Y0 + 6;
  const right = X0 + W - 6;
  ctx.strokeStyle = rgba(PEARL, 0.45 + 0.3 * lit);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ax, top - 2);
  ctx.lineTo(ax, ay);
  ctx.lineTo(right, ay);
  ctx.stroke();
  const tx = (u: number) => ax + 4 + u * (right - ax - 8);
  const ty = (T: number) => ay - 6 - ((T + 20) / 140) * (ay - top - 10);
  const P = CURVE_PTS;
  const segLit = [stage(level, 0.2, 1), stage(level, 0.5, 1.3), stage(level, 1.3, 2.1), stage(level, 2.3, 3.1), stage(level, 3.3, 4)];
  // dashed guides at the two plateaus
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = rgba(PEARL, 0.2);
  ctx.lineWidth = 1;
  for (const T of [0, 100]) {
    ctx.beginPath();
    ctx.moveTo(ax, ty(T));
    ctx.lineTo(right, ty(T));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let i = 0; i < 5; i++) {
    const a: P2 = [tx(P[i][0]), ty(P[i][1])];
    const c: P2 = [tx(P[i + 1][0]), ty(P[i + 1][1])];
    const plateau = i === 1 || i === 3;
    const col = plateau ? GOLD : APRICOT;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(PEARL, 0.28);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
    if (segLit[i] > 0.01) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 10 * segLit[i];
      ctx.strokeStyle = rgba(col, 0.35 + 0.65 * segLit[i]);
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  label(ctx, '0 °C', ax - 15, ty(0), 9.5, FROST, 0.75 + 0.25 * lit);
  label(ctx, '100 °C', ax - 17, ty(100), 9.5, FROST, 0.75 + 0.25 * lit);
  label(ctx, 'MELTING', tx(0.15), ty(0) - 9, 9, AQUA, 0.6 + 0.4 * segLit[1]);
  label(ctx, 'BOILING', tx(0.66), ty(100) + 10, 9, GOLD, 0.6 + 0.4 * segLit[3]);
  label(ctx, 'time', right - 12, ay + 8, 8.5, FROST, 0.55 + 0.3 * lit);
}

/** The printed playfield under the lacquer. */
function paintPlayfield(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);

  // ---- Base: violet vapor-sky at the top, palace blue in the middle, water toward the flippers
  ctx.fillStyle = vgrad(ctx, 0, 1150, [
    [0, mix('#1d1647', '#33276c', s4 * 0.7)],
    [0.25, mix('#1b2a5f', '#273c80', s3 * 0.6)],
    [0.52, '#173d69'],
    [0.75, mix('#0f3b57', '#145570', s2 * 0.5 + s4 * 0.2)],
    [1, '#0a1f33'],
  ]);
  ctx.fillRect(0, 0, 600, 1150);

  // ---- Palace marble: a faint diamond lattice, frosty on the ice side, warm on the hearth side
  ctx.save();
  ctx.lineWidth = 1;
  for (let i = -24; i < 40; i++) {
    const x = i * 34;
    const warmth = Math.max(0, Math.min(1, (x + 300) / 900));
    ctx.strokeStyle = rgba(mix(ICEBLUE, APRICOT, warmth), 0.05 + 0.03 * s2);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 700, 1150);
    ctx.moveTo(x + 700, 0);
    ctx.lineTo(x, 1150);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Thermal washes: the ice corner cool, the vapor vault and the hearth warm
  radial(ctx, 110, 300, 340, '#7fd0ff', 0.13 + 0.12 * s3);
  radial(ctx, 455, 610, 300, APRICOT, 0.07 + 0.17 * s2);
  radial(ctx, 380, 220, 230, ROSE, 0.05 + 0.08 * s1);
  stars(ctx, 24, Math.round(55 * (1 - 0.4 * s4)), [60, 20, 540, 330], PEARL);

  // ---- Water at the foot of the palace: ripples spreading from the Fountain
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const r = 46 + i * 34;
    ctx.strokeStyle = rgba(mix('#4fb3d8', '#bff4ff', s4), 0.09 + 0.05 * s2 - i * 0.006);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(POCKET[0], POCKET[1] + 40, r * 1.15, r * 0.55, 0, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();

  // ---- ICE HALL (top-left corner): crystal spires behind the ice blocks
  const crystals: [number, number, number, number][] = [[118, 336, 20, 78], [142, 330, 24, 132], [168, 326, 22, 102], [194, 320, 18, 70], [128, 300, 14, 40], [212, 318, 14, 46]];
  const iceLit = 0.25 + 0.35 * s1 + 0.4 * s3;
  for (const [x, base, w, h] of crystals) crystal2d(ctx, x, base, w, h, iceLit);
  snowflake(ctx, 150, 214, 11, FROST, 0.3 + 0.4 * s3);
  snowflake(ctx, 196, 252, 7, FROST, 0.25 + 0.4 * s3);
  snowflake(ctx, 112, 262, 6, FROST, 0.25 + 0.35 * s3);
  latticeModel(ctx, 155, 296, 4, 2, 11, PEARL, s1);
  plaqueTag(ctx, 'ICE · SOLID', 157, 318, 10, FROST, 0.4 + 0.6 * s3);

  // ---- VAPOR VAULT (top-right): a few fast particles far apart, the bumpers among them
  gasModel(ctx, 7, [180, 140, 470, 330], 16, ROSE, 0.3 + 0.7 * s1, [[230, 215, 30], [342, 196, 30], [405, 270, 30], [300, 290, 30], [300, 134, 18]]);
  plaqueTag(ctx, 'WATER VAPOR · GAS', 300, 346, 10, ROSE, 0.4 + 0.6 * s3);

  // ---- Title arch under the bridge's crest
  neonText(ctx, 'HEATWAVE ICE PALACE', 300, 134, 15, GOLD, stage(level, 1.4, 2.4));

  // ---- The six gate names, painted beside the State Gates
  const gIn = 0.4 + 0.6 * s3;
  // top centre: ICE <-> VAPOR
  label(ctx, 'SUBLIMING ➜', 310, 36, 10.5, APRICOT, gIn);
  label(ctx, '⬅ DEPOSITING', 310, 55, 10.5, AQUA, gIn);
  // left stair: WATER <-> ICE (the gates sit where the stair meets the ICE corner)
  {
    const wallX = (y: number) => 158 - ((572 - y) * 60) / 152;
    const ang = Math.atan2(-152, -60);
    arrow(ctx, [[wallX(588) - 18, 588], [wallX(530) - 18, 530], [wallX(452) - 18, 452]], AQUA, gIn, 2.6);
    label(ctx, 'FREEZING', wallX(522) - 31, 522, 9.5, AQUA, gIn, ang);
    arrow(ctx, [[wallX(486) - 46, 486], [wallX(540) - 46, 540], [wallX(596) - 46, 596]], APRICOT, gIn, 2.6);
    label(ctx, 'MELTING', wallX(548) - 58, 548, 9.5, APRICOT, gIn, ang);
  }
  // right flue: WATER <-> VAPOR
  arrow(ctx, [[510, 632], [510, 560], [510, 500]], APRICOT, gIn, 2.6);
  label(ctx, 'EVAPORATING', 510, 560, 9.5, APRICOT, gIn, -Math.PI / 2);
  arrow(ctx, [[537, 498], [537, 560], [537, 632]], AQUA, gIn, 2.6);
  label(ctx, 'CONDENSING', 537, 566, 9.5, AQUA, gIn, Math.PI / 2);
  label(ctx, 'VAPOR FLUE', 478, 606, 10, PEARL, 0.55 + 0.45 * s3);
  // left stair
  label(ctx, 'ICE STAIR', 124, 612, 10, PEARL, 0.55 + 0.45 * s3);
  // the plus / minus key (the textbook's +heat / -heat arrows)
  label(ctx, '+ heat ↑   − heat ↓', 476, 624, 8.5, FROST, 0.5 + 0.5 * s3);
  label(ctx, '− heat ↑   + heat ↓', 116, 628, 8.5, FROST, 0.5 + 0.5 * s3);

  // ---- The Palace Keep: its windows hold the two boiling pots, both at 100 °C
  ctx.save();
  poly(ctx, [[229, 563], [229, 481], [280, 434], [331, 481], [331, 563], [306, 563], [306, 553], [280, 540], [254, 553], [254, 563]]);
  ctx.fillStyle = vgrad(ctx, 434, 565, [[0, rgba(mix('#4f84b8', '#bfe9ff', s3), 0.55)], [1, rgba('#23466f', 0.6)]]);
  ctx.fill();
  ctx.strokeStyle = rgba(FROST, 0.25 + 0.4 * s1);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  // a small pot and a big pot, both reading 100 °C
  label(ctx, '100 °C', 249, 497, 9.5, PEARL, 0.7 + 0.3 * s1);
  label(ctx, '100 °C', 311, 497, 9.5, PEARL, 0.7 + 0.3 * s1);
  thermometer2d(ctx, 249, 507, 24, s1);
  thermometer2d(ctx, 316, 507, 22, s1);
  pot2d(ctx, 242, 556, 16, 12, s1);
  pot2d(ctx, 318, 558, 22, 19, s1);
  glowDot(ctx, 280, 470, 14, GOLD, 0.25 + 0.5 * s4);

  // ---- The Fountain in the Keep's foot
  radial(ctx, POCKET[0], POCKET[1] + 20, 70, GOLD, 0.08 + 0.12 * s1 + 0.25 * s4);
  ctx.save();
  ctx.strokeStyle = rgba(mix(AQUA, GOLD, s4), 0.3 + 0.4 * s4);
  ctx.lineWidth = 1.6;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(POCKET[0] + k * 4, POCKET[1] - 18);
    ctx.quadraticCurveTo(POCKET[0] + k * 20, POCKET[1] - 34, POCKET[0] + k * 22, POCKET[1] - 6);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Heat Bridge hearth: the warm end of the bridge
  radial(ctx, 398, 616, 80, APRICOT, 0.1 + 0.3 * s2);
  ctx.save();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    ctx.strokeStyle = rgba(GOLD, 0.15 + 0.4 * s2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(452 + Math.cos(a) * 11, 652 + Math.sin(a) * 11);
    ctx.lineTo(452 + Math.cos(a) * 17, 652 + Math.sin(a) * 17);
    ctx.stroke();
  }
  ctx.fillStyle = mix('#7a5a3a', '#ffcf72', 0.3 + 0.7 * s2);
  ctx.beginPath();
  ctx.arc(452, 652, 8, 0, TAU);
  ctx.fill();
  ctx.restore();
  label(ctx, 'HEAT BRIDGE', 432, 686, 12, GOLD, 0.6 + 0.4 * s2);
  label(ctx, 'warm ➜ cool', 432, 703, 9.5, APRICOT, 0.55 + 0.45 * s2);
  // at the cool end, where the bridge lands in the Ice Stair beside the ice blocks
  radial(ctx, BRIDGE_END[0], BRIDGE_END[1] + 40, 46, FROST, 0.08 + 0.2 * s2);
  label(ctx, 'COOL END', BRIDGE_END[0] - 10, BRIDGE_END[1] + 78, 8.5, FROST, 0.45 + 0.5 * s2, -Math.PI / 2);

  // ---- Heating curve between the slingshots
  heatingCurve(ctx, level);

  // ---- WATER · LIQUID at the foot of the table
  liquidModel(ctx, 5, 286, 868, 30, 12, ICEBLUE, s1);
  plaqueTag(ctx, 'WATER · LIQUID', 286, 840, 10, ICEBLUE, 0.4 + 0.6 * s3);

  // ---- Wonderlight: the whole palace glints gold
  if (s4 > 0.01) {
    radial(ctx, 300, 520, 520, GOLD, 0.08 * s4);
    const r = rng(77);
    for (let i = 0; i < 46; i++) glowDot(ctx, 40 + r() * 510, 30 + r() * 760, 3 + r() * 4, [GOLD, AQUA, PEARL, ROSE][i % 4], 0.5 * s4);
  }
}

function paintAmbient({ ctx, t, level, reduced, energy }: SceneryContext) {
  if (reduced) return;
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  // vapor particles zip across the vault: gas particles move fast and far apart
  const a = 0.25 + 0.4 * s1 + 0.2 * energy;
  for (let i = 0; i < 9; i++) {
    const sp = 60 + ((i * 37) % 50);
    const ang = i * 2.4;
    const x = 180 + ((((Math.cos(ang) * sp * t + i * 71) % 290) + 290) % 290);
    const y = 140 + ((((Math.sin(ang) * sp * t + i * 53) % 190) + 190) % 190);
    glowDot(ctx, x, y, 5, ROSE, a);
  }
  // frost glints in the Ice Hall
  for (let i = 0; i < 6; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.1);
    glowDot(ctx, 112 + i * 18, 240 + ((i * 29) % 70), 4, FROST, 0.35 * tw * (0.4 + 0.6 * s1));
  }
  // mist droplets drift up from the Fountain once the heat flows
  if (s2 > 0.01) {
    for (let i = 0; i < 8; i++) {
      const ph = (t * 0.25 + i / 8) % 1;
      glowDot(ctx, POCKET[0] - 20 + ((i * 13) % 40) + Math.sin(t + i) * 4, POCKET[1] + 30 - ph * 60, 3, PEARL, 0.4 * s2 * (1 - ph));
    }
  }
}

function paintCelebrate({ ctx, t }: SceneryContext, p: number) {
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
  radial(ctx, POCKET[0], POCKET[1], 440, GOLD, 0.7);
  ctx.restore();
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU + t * 0.3;
    const d = 40 + p * 300;
    glowDot(ctx, POCKET[0] + Math.cos(a) * d, POCKET[1] + Math.sin(a) * d * 0.75, 9, [GOLD, AQUA, PEARL, APRICOT][i % 4], 1 - p);
  }
  // the fountain's crown: arcs of droplets
  for (let k = 0; k < 12; k++) {
    const dir = (k / 12) * TAU;
    for (let j = 1; j <= 6; j++) {
      const u = (j / 6) * Math.min(1, p * 1.6);
      const x = POCKET[0] + Math.cos(dir) * u * 120;
      const y = POCKET[1] - Math.sin(Math.PI * u) * 90 + Math.sin(dir) * u * 40;
      glowDot(ctx, x, y, 5, k % 2 ? AQUA : PEARL, 0.8 * (1 - p * 0.6));
    }
  }
}

// ================================================================ 3D attraction set

function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const tex = kit.track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Faceted ice spires (hexagonal prisms with pointed tips) merged into one geometry. */
function spireGeometry(specs: [number, number, number, number][]): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, z, r, h] of specs) {
    const tip = Math.min(h * 0.4, r * 2.4);
    const body = new THREE.CylinderGeometry(r * 0.86, r, h - tip, 6, 1);
    body.translate(x, (h - tip) / 2, z);
    const cone = new THREE.ConeGeometry(r * 0.86, tip, 6, 1);
    cone.translate(x, h - tip / 2, z);
    parts.push(body, cone);
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

function lathe(profile: [number, number][], segs = 32): THREE.LatheGeometry {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segs);
}

function paintIceFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#5f86ab';
  ctx.fillRect(0, 0, w, h);
  const r = rng(12);
  // soft patches of frost and clear ice
  for (let i = 0; i < 60; i++) {
    const x = r() * w;
    const y = r() * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + r() * 90);
    g.addColorStop(0, r() < 0.5 ? 'rgba(220,242,255,0.22)' : 'rgba(40,80,120,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // cracks
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = r() * w;
    let y = r() * h;
    let a = r() * TAU;
    ctx.strokeStyle = `rgba(235,248,255,${0.25 + r() * 0.35})`;
    ctx.lineWidth = 0.8 + r() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      a += (r() - 0.5) * 1.1;
      x += Math.cos(a) * (14 + r() * 30);
      y += Math.sin(a) * (14 + r() * 30);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** The heating-curve sign face: axes, labels and region names (the curve itself is neon). */
function paintCurveFace(ctx: CanvasRenderingContext2D, w: number, h: number, sx: (x: number) => number, sy: (y: number) => number, yT: (T: number) => number, xU: (u: number) => number) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,22,46,0.92)';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 26);
  ctx.fill();
  ctx.strokeStyle = 'rgba(191,239,255,0.7)';
  ctx.lineWidth = 6;
  ctx.stroke();
  const txt = (s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', rot = 0) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(s, 0, 0);
    ctx.restore();
  };
  txt('HEATING CURVE OF WATER', w / 2, 56, 50, '#FFD27A');
  txt('at normal sea-level air pressure', w / 2, 104, 30, '#BFEFFF');
  // axes
  ctx.strokeStyle = 'rgba(244,251,255,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sx(xU(0) - 0.06), sy(yT(125)));
  ctx.lineTo(sx(xU(0) - 0.06), sy(yT(-28)));
  ctx.lineTo(sx(xU(1) + 0.02), sy(yT(-28)));
  ctx.stroke();
  ctx.setLineDash([12, 12]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(244,251,255,0.35)';
  for (const T of [0, 100]) {
    ctx.beginPath();
    ctx.moveTo(sx(xU(0) - 0.06), sy(yT(T)));
    ctx.lineTo(sx(xU(1)), sy(yT(T)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  txt('0 °C', sx(xU(0) - 0.1), sy(yT(0)), 30, '#F4FBFF', 'right');
  txt('100 °C', sx(xU(0) - 0.1), sy(yT(100)), 30, '#F4FBFF', 'right');
  txt('temperature', sx(xU(0) - 0.2), sy(yT(50)), 26, '#BFEFFF', 'center', -Math.PI / 2);
  txt('time (energy keeps flowing in) →', sx(xU(0.5)), sy(yT(-28)) + 30, 26, '#BFEFFF');
  txt('melting', sx(xU(0.16)), sy(yT(0)) - 30, 30, '#7FE7F2');
  txt('boiling', sx(xU(0.66)), sy(yT(100)) + 32, 30, '#FFD27A');
  txt('ice', sx(xU(0.02)), sy(yT(-6)) - 26, 26, '#BFEFFF');
  txt('water', sx(xU(0.3)), sy(yT(46)), 26, '#8FD3FF', 'right');
  txt('vapor', sx(xU(0.97)), sy(yT(112)) - 28, 26, '#FF9FC4');
  txt('flat steps: the state changes, the temperature holds', w / 2, h - 38, 26, '#F4FBFF');
}

const palaceSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  kit.sky('#28245f', '#04060f');
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmpCol = new THREE.Color();

  // ---- Floor: a frozen lake that has melted into open water on the warm (right) side
  const iceTex = canvasTex(kit, 1024, 1024, (ctx) => paintIceFloor(ctx, 1024, 1024));
  iceTex.wrapS = iceTex.wrapT = THREE.RepeatWrapping;
  iceTex.repeat.set(4, 4);
  const floorMat = kit.track(new THREE.MeshPhysicalMaterial({ map: iceTex, color: '#a9c9e6', roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = gy;
  floor.receiveShadow = true;
  kit.add(floor);
  const lake = kit.water([8.6, gy + 0.03, -1.2], 9.2, 18, '#1f7590');
  const lakeMat = lake.material as THREE.MeshPhysicalMaterial;
  lakeMat.emissive = new THREE.Color('#13607a');
  lakeMat.emissiveIntensity = 0.25;
  // slush along the melting edge
  const slushN = kit.n(30);
  const slush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 0), kit.mats.plastic('#e4f4ff'), slushN);
  const sr = rng(31);
  for (let i = 0; i < slushN; i++) {
    const z = -9.6 + (i / slushN) * 15.2 + (sr() - 0.5) * 0.3;
    q.setFromEuler(new THREE.Euler(0, sr() * 3, 0));
    sc.set(0.8 + sr() * 1.4, 0.18 + sr() * 0.12, 0.6 + sr() * 1.1);
    mtx.compose(tmp.set(4.15 + 0.35 * Math.sin(z * 1.3) + sr() * 0.9, gy + 0.03, z), q, sc);
    slush.setMatrixAt(i, mtx);
  }
  slush.instanceMatrix.needsUpdate = true;
  kit.add(slush);

  // ---- Back left: the Ice Palace, a cluster of faceted spires on a frosted hexagonal plinth
  const SPIRES: [number, number, number, number][] = [
    [0, 0, 0.44, 3.0], [0.85, 0.45, 0.32, 2.2], [-0.8, 0.7, 0.34, 2.45], [0.35, 1.25, 0.24, 1.45],
    [-1.35, -0.3, 0.27, 1.8], [1.3, -0.45, 0.22, 1.35], [-0.35, 1.55, 0.18, 1.0], [0.55, -0.85, 0.3, 2.6],
  ];
  const iceMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#c9ecff', roughness: 0.06, metalness: 0, transmission: 0.35, thickness: 0.5, transparent: true, opacity: 0.9, clearcoat: 1, emissive: '#6fcfff', emissiveIntensity: 0.08, flatShading: true }));
  const palace = new THREE.Group();
  const spires = new THREE.Mesh(spireGeometry(SPIRES), iceMat);
  spires.castShadow = true;
  const coreMat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#7fe7ff', emissiveIntensity: 0.1 }));
  const cores = new THREE.Mesh(spireGeometry(SPIRES.map(([x, z, r, h]) => [x, z, r * 0.36, h * 0.86] as [number, number, number, number])), coreMat);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.3, 0.24, 6), kit.mats.plastic('#cfe6f6'));
  plinth.position.y = 0.06;
  plinth.receiveShadow = true;
  spires.position.y = 0.18;
  cores.position.y = 0.18;
  const gateArch = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 28, Math.PI), iceMat);
  gateArch.position.set(0.2, 0.18, 1.75);
  palace.add(plinth, spires, cores, gateArch);
  palace.position.set(-6.4, gy, -4.1);
  palace.rotation.y = 0.3;
  kit.add(palace);
  // On the palace's cabinet side, clear of the heating-curve sign that stands in front of the plinth.
  const palaceSign = kit.neonSign('ICE HALL', [-4.55, gy + 0.62, -3.35], { height: 0.24, color: FROST, rotY: 0.3 });
  palaceSign.rotation.x = -0.6;
  // frost crystals scattered over the frozen lake
  const crystals = ([[-4.45, 0.2, -1.7, 0.2], [-4.9, 0.18, 0.55, 0.17], [-8.0, 0.24, -1.4, 0.26], [-4.25, 0.15, 1.35, 0.14], [-8.3, 0.22, 0.9, 0.22], [-7.4, 0.2, 3.6, 0.2]] as [number, number, number, number][])
    .map(([x, y, z, s], i) => kit.crystal([x, gy + y, z], s, i % 2 ? FROST : '#a8dcff', i + 3));
  const snow = kit.motes({ x0: -9.5, x1: -3.8, y0: 0, y1: 4.5, z0: -7.5, z1: 5 }, 80, '#eaf6ff', { speed: 0.28, size: 0.09, rise: false });

  // ---- Middle left: the heating-curve sign (lights segment by segment)
  const curve = new THREE.Group();
  const CW = 2.6;
  const CH = 1.66;
  const yT = (T: number) => -0.42 + ((T + 20) / 140) * 0.86;
  const xU = (u: number) => -0.82 + u * 1.84;
  const faceW = 1024;
  const faceH = Math.round((1024 * CH) / CW);
  const sx = (x: number) => ((x + CW / 2) / CW) * faceW;
  const sy = (y: number) => ((CH / 2 - y) / CH) * faceH;
  const faceTex = canvasTex(kit, faceW, faceH, (ctx) => paintCurveFace(ctx, faceW, faceH, sx, sy, yT, xU));
  const faceMat = kit.track(new THREE.MeshStandardMaterial({ map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.12, transparent: true, roughness: 0.6 }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), faceMat);
  face.position.z = 0.035;
  const back = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.08, CH + 0.08, 0.06), kit.mats.paintedMetal('#2b3d63'));
  curve.add(back, face);
  const CP: V3[] = CURVE_PTS.map(([u, T]) => [xU(u), yT(T), 0.07]);
  const segs = [0, 1, 2, 3, 4].map((i) => {
    const m = kit.neonTube([CP[i], CP[i + 1]], i === 1 || i === 3 ? GOLD : APRICOT, { radius: 0.028 });
    curve.add(m);
    return m;
  });
  curve.position.set(-5.85, gy + 1.62, -0.35);
  curve.rotation.order = 'YXZ';
  curve.rotation.y = 0.62;
  curve.rotation.x = -0.42;
  kit.add(curve);
  curve.updateMatrixWorld(true);
  for (const lx of [-1.05, 1.05]) {
    const p = curve.localToWorld(tmp.set(lx, -CH / 2 + 0.05, -0.05));
    kit.pole([p.x, 0, p.z], p.y, '#9fb8d8');
  }

  // ---- Back right: the heatwave sun, a low blazing disc with turning rays
  const sun = new THREE.Group();
  const sunMat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffbf5a', emissiveIntensity: 0.5 }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), sunMat);
  const haloMat = kit.track(new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,200,120,1)', 'rgba(255,140,80,0)', 'sunhalo'), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), haloMat);
  halo.position.z = -0.02;
  const rayParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const len = i % 2 ? 0.34 : 0.52;
    const g = new THREE.BufferGeometry();
    const r0 = 0.72;
    const wv = 0.07;
    const pts = [
      Math.cos(a - wv) * r0, Math.sin(a - wv) * r0, 0,
      Math.cos(a + wv) * r0, Math.sin(a + wv) * r0, 0,
      Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len), 0,
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    rayParts.push(g);
  }
  const rayMat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ff9a4a', emissiveIntensity: 0.4, side: THREE.DoubleSide }));
  const rays = new THREE.Mesh(mergeGeometries(rayParts)!, rayMat);
  rayParts.forEach((g) => g.dispose());
  sun.add(halo, disc, rays);
  sun.position.set(5.75, 1.45, -4.45);
  sun.scale.setScalar(0.8);
  sun.rotation.order = 'YXZ';
  sun.rotation.y = -0.35;
  sun.rotation.x = -0.3;
  kit.add(sun);

  // ---- Middle right: the Grand Fountain, standing in the melted lake
  const F: V3 = [5.75, gy, -1.55];
  const marble = kit.mats.plastic('#e8eef7');
  const fountain = new THREE.Group();
  const basin = new THREE.Mesh(lathe([[0, 0], [0.98, 0], [1.04, 0.06], [1.04, 0.26], [0.95, 0.28], [0.92, 0.08], [0, 0.08]], 40), marble);
  const columns = new THREE.Mesh(mergeGeometries([
    new THREE.CylinderGeometry(0.1, 0.15, 0.82, 16).translate(0, 0.5, 0),
    new THREE.CylinderGeometry(0.06, 0.08, 0.44, 12).translate(0, 1.18, 0),
  ])!, marble);
  const bowls = new THREE.Mesh(mergeGeometries([
    lathe([[0.04, 0], [0.5, 0.04], [0.56, 0.14], [0.52, 0.16], [0.08, 0.08]], 32).translate(0, 0.9, 0),
    lathe([[0.03, 0], [0.26, 0.03], [0.3, 0.1], [0.27, 0.12], [0.05, 0.06]], 24).translate(0, 1.4, 0),
  ])!, kit.mats.brass());
  const fwMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0f3354', emissive: '#5fd8ff', emissiveIntensity: 0.15, roughness: 0.15 }));
  const fwater = new THREE.Mesh(mergeGeometries([
    new THREE.CircleGeometry(0.92, 36).rotateX(-Math.PI / 2).translate(0, 0.22, 0),
    new THREE.CircleGeometry(0.5, 28).rotateX(-Math.PI / 2).translate(0, 1.03, 0),
    new THREE.CircleGeometry(0.25, 20).rotateX(-Math.PI / 2).translate(0, 1.5, 0),
  ])!, fwMat);
  const finialMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#fff4d8', emissive: GOLD, emissiveIntensity: 0.2, roughness: 0.1, clearcoat: 1 }));
  const finial = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), finialMat);
  finial.position.y = 1.66;
  fountain.add(basin, columns, bowls, fwater, finial);
  fountain.position.set(F[0], F[1], F[2]);
  for (const m of [basin, columns, bowls]) m.castShadow = true;
  kit.add(fountain);
  const fountainSign = kit.neonSign('THE FOUNTAIN', [F[0] - 0.15, gy + 0.55, F[2] + 1.35], { height: 0.22, color: GOLD, rotY: -0.42 });
  fountainSign.rotation.x = -0.5;
  // Jets as droplet points: spills from the bowls (always), rim jets as the gates open, and a
  // peony crown of arcs at the Wonderlight that rains out over the melted lake.
  type Jet = { o: V3; v: V3; n: number; life: number; tier: 0 | 1 | 2; col: string };
  const jets: Jet[] = [];
  const spill = (ringR: number, y: number, n: number, out: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      jets.push({ o: [Math.cos(a) * ringR, y, Math.sin(a) * ringR], v: [Math.cos(a) * out, 0.15, Math.sin(a) * out], n: kit.n(5), life: 0.5, tier: 0, col: '#dff6ff' });
    }
  };
  spill(0.29, 1.5, 10, 0.35);
  spill(0.55, 1.04, 14, 0.42);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3;
    jets.push({ o: [Math.cos(a) * 1.0, 0.28, Math.sin(a) * 1.0], v: [Math.cos(a) * 0.7, 2.6, Math.sin(a) * 0.7], n: kit.n(18), life: 1.3, tier: 1, col: i % 2 ? AQUA : PEARL });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    jets.push({ o: [0, 1.7, 0], v: [Math.cos(a) * 1.1, 2.4, Math.sin(a) * 1.1], n: kit.n(24), life: 1.5, tier: 2, col: [GOLD, AQUA, PEARL][i % 3] });
  }
  jets.push({ o: [0, 1.72, 0], v: [0, 3.4, 0], n: kit.n(26), life: 1.6, tier: 2, col: GOLD });
  // ...and at the Wonderlight the Ice Palace itself becomes a fountain: arcs leap from its plinth
  const PAL: V3 = [-6.4 - F[0], 0, -4.1 - F[2]];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    jets.push({ o: [PAL[0] + Math.cos(a) * 2.2, 0.26, PAL[2] + Math.sin(a) * 2.2], v: [-Math.cos(a) * 0.95, 3.0, -Math.sin(a) * 0.95], n: kit.n(18), life: 1.25, tier: 2, col: [AQUA, '#b9a2ff', PEARL][i % 3] });
  }
  const NJ = jets.reduce((sum, j) => sum + j.n, 0);
  const jetPos = new Float32Array(NJ * 3);
  const jetCol = new Float32Array(NJ * 3);
  {
    let k = 0;
    for (const j of jets) {
      tmpCol.set(j.col);
      for (let i = 0; i < j.n; i++) {
        jetCol[k++] = tmpCol.r;
        jetCol[k++] = tmpCol.g;
        jetCol[k++] = tmpCol.b;
      }
    }
  }
  const jetGeo = new THREE.BufferGeometry();
  jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
  jetGeo.setAttribute('color', new THREE.BufferAttribute(jetCol, 3));
  const jetMat = kit.track(new THREE.PointsMaterial({ size: 0.21, vertexColors: true, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  const jetPts = new THREE.Points(jetGeo, jetMat);
  jetPts.frustumCulled = false;
  jetPts.position.set(F[0], F[1], F[2]);
  kit.add(jetPts);
  let rimOn = 0;
  let crown = 0;
  let surge = 0;
  const G = 4.2;
  const placeJets = (t: number) => {
    let k = 0;
    for (const j of jets) {
      const on = j.tier === 0 ? 1 : j.tier === 1 ? Math.max(rimOn, surge) : Math.max(crown, surge);
      for (let i = 0; i < j.n; i++) {
        const tau = ((t / j.life + i / j.n) % 1) * j.life;
        const y = j.o[1] + j.v[1] * tau - 0.5 * G * tau * tau;
        jetPos[k++] = j.o[0] + j.v[0] * tau;
        jetPos[k++] = on < 0.02 ? -50 : Math.max(0.06, y);
        jetPos[k++] = j.o[2] + j.v[2] * tau;
      }
    }
    jetGeo.attributes.position.needsUpdate = true;
  };
  placeJets(0.3);
  kit.animate((t) => placeJets(t));
  const mist = kit.motes({ x0: F[0] - 1.1, x1: F[0] + 1.1, y0: gy + 0.1, y1: gy + 1.4, z0: F[2] - 1.1, z1: F[2] + 1.1 }, 46, '#e6f6ff', { speed: 0.3, size: 0.1 });
  const fountainLight = kit.point([F[0], gy + 2.1, F[2]], GOLD, 0.5, 7);

  // ---- Front left: the State Gallery, three glass cases of particles (solid, liquid, gas)
  const gal = new THREE.Group();
  const galPlinth = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.34, 0.86), kit.mats.plastic('#dbe7f4'));
  galPlinth.position.y = 0.17;
  galPlinth.castShadow = true;
  const CASE_X = [-0.98, 0, 0.98];
  const caseW = 0.8;
  const caseH = 0.94;
  const caseD = 0.62;
  // open-topped glass cases (four panes each) in a quiet, low-reflection glass
  const paneParts: THREE.BufferGeometry[] = [];
  for (const x of CASE_X) {
    const yc = 0.34 + caseH / 2;
    paneParts.push(
      new THREE.PlaneGeometry(caseW, caseH).translate(x, yc, caseD / 2),
      new THREE.PlaneGeometry(caseW, caseH).translate(x, yc, -caseD / 2),
      new THREE.PlaneGeometry(caseD, caseH).rotateY(Math.PI / 2).translate(x - caseW / 2, yc, 0),
      new THREE.PlaneGeometry(caseD, caseH).rotateY(Math.PI / 2).translate(x + caseW / 2, yc, 0),
    );
  }
  const glassMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#dff4ff', transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, envMapIntensity: 0.12, side: THREE.DoubleSide, depthWrite: false, emissive: '#9fdcff', emissiveIntensity: 0.04 }));
  const glass = new THREE.Mesh(mergeGeometries(paneParts)!, glassMat);
  paneParts.forEach((g) => g.dispose());
  // brass edge frames (top and bottom rims, four corner posts) around each case
  const trimParts: THREE.BufferGeometry[] = [];
  for (const x of CASE_X) {
    for (const y of [0.36, 0.34 + caseH]) {
      for (const z of [-caseD / 2, caseD / 2]) trimParts.push(new THREE.BoxGeometry(caseW + 0.03, 0.03, 0.03).translate(x, y, z));
      for (const dx of [-caseW / 2, caseW / 2]) trimParts.push(new THREE.BoxGeometry(0.03, 0.03, caseD).translate(x + dx, y, 0));
    }
    for (const dx of [-caseW / 2, caseW / 2]) for (const z of [-caseD / 2, caseD / 2]) trimParts.push(new THREE.BoxGeometry(0.025, caseH, 0.025).translate(x + dx, 0.34 + caseH / 2, z));
  }
  const trims = new THREE.Mesh(mergeGeometries(trimParts)!, kit.mats.brass());
  trimParts.forEach((g) => g.dispose());
  const galLabelTex = canvasTex(kit, 1024, 80, (ctx) => {
    ctx.fillStyle = '#16233f';
    ctx.fillRect(0, 0, 1024, 80);
    ctx.font = '800 46px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cols = [FROST, ICEBLUE, ROSE];
    ['SOLID', 'LIQUID', 'GAS'].forEach((s, i) => {
      ctx.fillStyle = cols[i];
      ctx.fillText(s, ((CASE_X[i] + 1.4) / 2.8) * 1024, 42);
    });
  });
  const galLabelMat = kit.track(new THREE.MeshStandardMaterial({ map: galLabelTex, emissive: '#ffffff', emissiveMap: galLabelTex, emissiveIntensity: 0.2 }));
  const galLabel = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.22), galLabelMat);
  galLabel.position.set(0, 0.17, 0.432);
  // particles: 27 locked in a lattice, 22 crowded but sliding, 8 far apart and fast
  const NS = 27;
  const NL = 22;
  const NG = 8;
  const NP = NS + NL + NG;
  const partMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const parts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.052, 12, 8), partMat, NP);
  const base: V3[] = [];
  for (let a = 0; a < 3; a++) for (let b2 = 0; b2 < 3; b2++) for (let c = 0; c < 3; c++) base.push([CASE_X[0] + (a - 1) * 0.2, 0.34 + 0.27 + b2 * 0.2, (c - 1) * 0.17]);
  const lr = rng(8);
  for (let i = 0; i < NL; i++) {
    const a = lr() * TAU;
    const d = Math.sqrt(lr()) * 0.27;
    base.push([CASE_X[1] + Math.cos(a) * d, 0.34 + 0.08 + (i % 3) * 0.1 + lr() * 0.04, Math.sin(a) * d * 0.8]);
  }
  const gasV: V3[] = [];
  for (let i = 0; i < NG; i++) {
    base.push([CASE_X[2] + (lr() - 0.5) * 0.6, 0.34 + 0.1 + lr() * 0.75, (lr() - 0.5) * 0.42]);
    const a = lr() * TAU;
    const e = lr() * 0.8 - 0.4;
    gasV.push([Math.cos(a) * 1.1, e * 1.1, Math.sin(a) * 0.9]);
  }
  const live: V3[] = base.map((p) => [p[0], p[1], p[2]]);
  const gasLim: V3 = [caseW / 2 - 0.07, caseH / 2 - 0.07, caseD / 2 - 0.07];
  const gasCtr: V3 = [CASE_X[2], 0.34 + caseH / 2, 0];
  for (let i = 0; i < NP; i++) parts.setColorAt(i, tmpCol.set(i < NS ? FROST : i < NS + NL ? ICEBLUE : ROSE));
  const placeParts = (t: number, dt: number) => {
    for (let i = 0; i < NP; i++) {
      const p = live[i];
      const b0 = base[i];
      if (i < NS) {
        // solid: vibrate about a fixed place
        p[0] = b0[0] + 0.018 * Math.sin(t * 23 + i * 1.7);
        p[1] = b0[1] + 0.018 * Math.sin(t * 19 + i * 2.3);
        p[2] = b0[2] + 0.018 * Math.sin(t * 21 + i * 0.9);
      } else if (i < NS + NL) {
        // liquid: close together, sliding past one another
        const ph = i * 1.37;
        p[0] = b0[0] + 0.09 * Math.sin(t * 0.9 + ph);
        p[1] = b0[1] + 0.025 * Math.sin(t * 1.7 + ph * 2);
        p[2] = b0[2] + 0.07 * Math.cos(t * 0.8 + ph);
      } else {
        // gas: far apart, flying fast in straight lines, bouncing off the glass
        const v = gasV[i - NS - NL];
        const step = Math.min(dt, 0.05);
        for (let k = 0; k < 3; k++) p[k] += v[k] * step;
        for (let k = 0; k < 3; k++) {
          if (p[k] > gasCtr[k] + gasLim[k]) { p[k] = gasCtr[k] + gasLim[k]; v[k] = -Math.abs(v[k]); }
          if (p[k] < gasCtr[k] - gasLim[k]) { p[k] = gasCtr[k] - gasLim[k]; v[k] = Math.abs(v[k]); }
        }
      }
      parts.setMatrixAt(i, mtx.makeTranslation(p[0], p[1], p[2]));
    }
    parts.instanceMatrix.needsUpdate = true;
  };
  placeParts(0.5, 0);
  kit.animate((t, dt) => placeParts(t, dt));
  gal.add(galPlinth, glass, trims, galLabel, parts);
  gal.position.set(-5.55, gy, 2.7);
  gal.rotation.y = 0.4;
  kit.add(gal);
  const galSign = kit.neonSign('STATES OF WATER', [-5.7, gy + 1.62, 2.45], { height: 0.26, color: AQUA, rotY: 0.4 });
  galSign.rotation.x = -0.55;

  // ---- Front right: two pots on a stove, both at 100 °C (same temperature, different thermal energy)
  const potG = new THREE.Group();
  const stove = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.56, 0.72), kit.mats.paintedMetal('#5a4a5e'));
  stove.position.y = 0.28;
  stove.castShadow = true;
  const burnerMat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ff7a3a', emissiveIntensity: 0.1 }));
  const burners = new THREE.Mesh(mergeGeometries([
    new THREE.RingGeometry(0.08, 0.17, 24).rotateX(-Math.PI / 2).translate(-0.45, 0.565, 0),
    new THREE.RingGeometry(0.12, 0.3, 28).rotateX(-Math.PI / 2).translate(0.35, 0.565, 0),
  ])!, burnerMat);
  const potProfile = (r: number, h: number): [number, number][] => [[0, 0], [r, 0], [r * 1.02, h * 0.08], [r, h], [r * 1.08, h * 1.02], [r * 1.04, h * 1.06], [r * 0.96, h * 1.0], [r * 0.97, h * 0.1], [0, h * 0.1]];
  const pots = new THREE.Mesh(mergeGeometries([
    lathe(potProfile(0.17, 0.22), 28).translate(-0.45, 0.57, 0),
    lathe(potProfile(0.31, 0.36), 32).translate(0.35, 0.57, 0),
  ])!, kit.mats.paintedMetal('#c9d4e2'));
  const potWaterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#103a5c', emissive: '#6fe0ff', emissiveIntensity: 0.1 }));
  const potWater = new THREE.Mesh(mergeGeometries([
    new THREE.CircleGeometry(0.16, 20).rotateX(-Math.PI / 2).translate(-0.45, 0.76, 0),
    new THREE.CircleGeometry(0.29, 24).rotateX(-Math.PI / 2).translate(0.35, 0.9, 0),
  ])!, potWaterMat);
  const thermoGlass = new THREE.Mesh(mergeGeometries([
    new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10).translate(-0.4, 0.98, 0.04),
    new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10).translate(0.42, 1.1, 0.06),
  ])!, kit.mats.clearPlastic('#ffffff', 0.35));
  const redMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a0505', emissive: '#ff4a4a', emissiveIntensity: 0.3 }));
  const thermoRed = new THREE.Mesh(mergeGeometries([
    new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8).translate(-0.4, 0.93, 0.04),
    new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8).translate(0.42, 1.05, 0.06),
    new THREE.SphereGeometry(0.038, 10, 8).translate(-0.4, 0.68, 0.04),
    new THREE.SphereGeometry(0.038, 10, 8).translate(0.42, 0.8, 0.06),
  ])!, redMat);
  const potBoardTex = canvasTex(kit, 1024, 360, (ctx) => {
    ctx.fillStyle = '#16233f';
    ctx.beginPath();
    ctx.roundRect(0, 0, 1024, 360, 36);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 76px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = PEARL;
    ctx.fillText('100 °C', 250, 82);
    ctx.fillText('100 °C', 760, 82);
    ctx.font = '800 54px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = FROST;
    ctx.fillText('SMALL POT', 250, 170);
    ctx.fillText('BIG POT', 760, 170);
    ctx.font = '800 44px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText('same temperature · the big pot holds more thermal energy', 512, 280);
  });
  const boardMat = kit.track(new THREE.MeshStandardMaterial({ map: potBoardTex, emissive: '#ffffff', emissiveMap: potBoardTex, emissiveIntensity: 0.15 }));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.67), boardMat);
  board.position.set(0, 1.75, -0.32);
  board.rotation.x = -0.25;
  potG.add(stove, burners, pots, potWater, thermoGlass, thermoRed, board);
  potG.position.set(5.5, gy, 2.75);
  potG.rotation.y = -0.4;
  kit.add(potG);
  potG.updateMatrixWorld(true);
  const pw = potG.localToWorld(tmp.set(-0.05, 1.0, 0));
  const steam = kit.motes({ x0: pw.x - 0.55, x1: pw.x + 0.55, y0: gy + 1.0, y1: gy + 1.8, z0: pw.z - 0.25, z1: pw.z + 0.25 }, 30, '#f4fbff', { speed: 0.4, size: 0.09 });

  // ---- Head: marquee and the palace domes beyond (seen on the fly-in)
  const marquee = kit.neonSign('HEATWAVE ICE PALACE', [0, 1.45, -7.25], { height: 0.6, color: GOLD });
  marquee.rotation.x = -0.72;
  const domeMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#cfeeff', roughness: 0.1, transparent: true, opacity: 0.55, clearcoat: 1, emissive: '#6fcfff', emissiveIntensity: 0.1, side: THREE.DoubleSide }));
  const domes = new THREE.Mesh(mergeGeometries([
    new THREE.SphereGeometry(1.7, 32, 14, 0, TAU, 0, Math.PI / 2).translate(0, 0.9, -10),
    new THREE.CylinderGeometry(1.7, 1.7, 0.9, 32, 1, true).translate(0, 0.45, -10),
    new THREE.SphereGeometry(1.05, 24, 10, 0, TAU, 0, Math.PI / 2).translate(-3, 0.5, -9.4),
    new THREE.SphereGeometry(1.05, 24, 10, 0, TAU, 0, Math.PI / 2).translate(3, 0.5, -9.4),
  ])!, domeMat);
  domes.position.y = gy;
  kit.add(domes);
  const headSpires = new THREE.Mesh(spireGeometry([[0, -10, 0.16, 3.4], [-3, -9.4, 0.12, 2.3], [3, -9.4, 0.12, 2.3], [-1.6, -10.6, 0.1, 2.6], [1.6, -10.6, 0.1, 2.6]]), iceMat);
  headSpires.position.y = gy;
  kit.add(headSpires);

  // ---- Heat flow: an arc of light from the sun to the ice, with packets of energy riding it
  const flowCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.3, 1.35, -4.7), new THREE.Vector3(3.3, 1.45, -6.45), new THREE.Vector3(0, 1.5, -6.85),
    new THREE.Vector3(-3.3, 1.45, -6.45), new THREE.Vector3(-5.5, 1.75, -4.55),
  ]);
  const flowPts: V3[] = flowCurve.getPoints(24).map((p) => [p.x, p.y, p.z]);
  const flowTube = kit.neonTube(flowPts, APRICOT, { radius: 0.045 });
  const NPK = 9;
  const packetMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0 }));
  const packets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 12, 8), packetMat, NPK);
  packets.frustumCulled = false;
  kit.add(packets);
  const headMat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: APRICOT, emissiveIntensity: 0.05 }));
  const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 14), headMat);
  const endP = flowCurve.getPointAt(0.97);
  const endT = flowCurve.getTangentAt(0.97);
  arrowHead.position.copy(endP);
  arrowHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endT.normalize());
  kit.add(arrowHead);
  let flowOn = 0;
  const warmCol = new THREE.Color(APRICOT);
  const coolCol = new THREE.Color(FROST);
  const placePackets = (t: number) => {
    for (let i = 0; i < NPK; i++) {
      const u = (t * 0.09 + i / NPK) % 1;
      flowCurve.getPointAt(u, tmp);
      const s = flowOn > 0.02 ? 0.6 + 0.6 * Math.sin(u * Math.PI) : 0.001;
      mtx.makeScale(s, s, s).setPosition(tmp);
      packets.setMatrixAt(i, mtx);
      packets.setColorAt(i, tmpCol.copy(warmCol).lerp(coolCol, u));
    }
    packets.instanceMatrix.needsUpdate = true;
    if (packets.instanceColor) packets.instanceColor.needsUpdate = true;
  };
  placePackets(0);
  kit.animate((t) => placePackets(t));

  // ---- Lanterns, sparkle and fireworks
  kit.pole([-4.35, 0, 4.4], 1.35, '#9fb8d8');
  kit.pole([4.35, 0, 4.4], 1.35, '#c8a888');
  const lampL = kit.lantern([-4.35, 1.58, 4.4], FROST, 0.17);
  const lampR = kit.lantern([4.35, 1.58, 4.4], APRICOT, 0.17);
  // Sparkle and fireworks stay in the side regions and top corners (never over the playfield, and
  // not in the head strip, which only the intro fly-in sees).
  const sparkleL = kit.motes({ x0: -9, x1: -3.9, y0: 0.2, y1: 4, z0: -7, z1: 5 }, 35, GOLD, { speed: 0.16, size: 0.1 });
  const sparkleR = kit.motes({ x0: 3.9, x1: 9, y0: 0.2, y1: 4, z0: -7, z1: 5 }, 35, GOLD, { speed: 0.16, size: 0.1 });
  const fwL = kit.fireworks({ x0: -7.9, x1: -5.4, y0: 1.7, y1: 2.3, z: -3.9 }, [AQUA, PEARL, '#b9a2ff', GOLD]);
  const fwR = kit.fireworks({ x0: 5.2, x1: 7.6, y0: 1.7, y1: 2.3, z: -3.7 }, [GOLD, APRICOT, ROSE, PEARL]);

  // ---- Lights (three): cool on the ice, warm on the fountain and pots, gold in the fountain
  const coolSpot = kit.spot([-3.6, 6.6, 2.2], [-6.2, 0.4, -2.2], '#9fdcff', 22, 0.55);
  const warmSpot = kit.spot([4.2, 6.6, 2.6], [5.8, 0.3, 0.6], '#ffb27a', 22, 0.6);

  let celebrateP = 0;
  return {
    update(t, _dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.8);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      const pulse = kit.reducedMotion ? 0 : 0.5 + 0.5 * Math.sin(t * 2.2);
      // ice palace: faint frost glow when dormant, luminous cores as the state gates open
      iceMat.emissiveIntensity = 0.06 + 0.06 * s1 + 0.1 * s3 + 0.06 * s4;
      coreMat.emissiveIntensity = 0.12 + 0.4 * s1 + 0.7 * s3 + 0.5 * s4 * (0.8 + 0.2 * pulse);
      if (s4 > 0.01 && !kit.reducedMotion) coreMat.emissive.setHSL((0.52 + 0.1 * Math.sin(t * 0.4) + 1) % 1, 0.9, 0.55);
      palaceSign.setLit(0.2 + 0.8 * s1);
      for (let i = 0; i < crystals.length; i++) crystals[i].setLit(0.15 + 0.85 * kit.stage(level, 0.4 + i * 0.4, 1.2 + i * 0.4));
      snow.setLit(0.35 + 0.4 * s3);
      // heating curve: each segment wakes in turn
      faceMat.emissiveIntensity = 0.1 + 0.35 * s1 + 0.25 * s4;
      segs[0].setLit(0.1 + 0.9 * s1);
      segs[1].setLit(0.1 + 0.9 * kit.stage(level, 0.6, 1.4));
      segs[2].setLit(0.1 + 0.9 * s2);
      segs[3].setLit(0.1 + 0.9 * s3);
      segs[4].setLit(0.1 + 0.9 * s4);
      // the sun blazes once heat starts to flow
      sunMat.emissiveIntensity = 0.45 + 0.6 * s0 + 1.4 * s2 + 0.5 * s4;
      rayMat.emissiveIntensity = 0.35 + 1.1 * s2 + 0.6 * s4;
      haloMat.opacity = 0.18 + 0.35 * s2 + 0.25 * s4;
      // fountain
      fwMat.emissiveIntensity = 0.15 + 0.4 * s1 + 0.8 * s4;
      finialMat.emissiveIntensity = 0.25 + 0.8 * s2 + 1.6 * s4 * (0.8 + 0.2 * pulse);
      rimOn = s3;
      crown = s4;
      jetMat.opacity = 0.4 + 0.2 * s1 + 0.35 * s3 + 0.05 * s4;
      mist.setLit(0.25 + 0.3 * s2 + 0.3 * s4);
      fountainSign.setLit(0.2 + 0.8 * s1);
      if (fountainLight) fountainLight.intensity = 0.6 + 2.2 * s1 + 4 * s4 + 3 * celebrateP;
      lakeMat.emissiveIntensity = 0.14 + 0.12 * s2 + 0.06 * s4;
      // state gallery and pots
      partMat.color.setScalar(0.35 + 0.45 * s0 + 0.2 * s1 + 0.25 * s4);
      galLabelMat.emissiveIntensity = 0.2 + 0.8 * s1;
      galSign.setLit(0.2 + 0.8 * s1);
      burnerMat.emissiveIntensity = 0.1 + 1.8 * s1;
      potWaterMat.emissiveIntensity = 0.1 + 0.6 * s1;
      redMat.emissiveIntensity = 0.3 + 1.4 * s1;
      boardMat.emissiveIntensity = 0.15 + 0.5 * s1;
      steam.setLit(0.15 + 0.6 * s1);
      // heat flowing warm to cool along the arc
      flowOn = s2;
      flowTube.setLit(0.04 + 0.85 * s2 + 0.3 * s4);
      flowTube.visible = s2 > 0.02;
      arrowHead.visible = s2 > 0.02;
      packets.visible = s2 > 0.02;
      packetMat.opacity = 0.95 * s2;
      headMat.emissiveIntensity = 0.05 + 2.4 * s2;
      // marquee, lanterns, sparkle, fireworks
      marquee.setLit(0.15 + 0.85 * s2);
      lampL.setLit(0.3 + 0.7 * s1);
      lampR.setLit(0.3 + 0.7 * s1);
      const spk = 0.05 + 0.15 * s3 + 0.8 * s4;
      sparkleL.setLit(spk);
      sparkleR.setLit(spk);
      const boom = Math.max(s4, Math.sin(celebrateP * Math.PI));
      fwL.setLit(boom);
      fwR.setLit(boom);
      if (coolSpot) coolSpot.intensity = 14 + 10 * s1 + 8 * s3 + energy * 4;
      if (warmSpot) warmSpot.intensity = 12 + 14 * s2 + 6 * s4 + energy * 4;
      surge = Math.max(0, surge - 0.02);
      celebrateP = Math.max(0, celebrateP - 0.01);
    },
    celebrate(p) {
      celebrateP = p;
      surge = Math.sin(p * Math.PI);
    },
  };
};

// ================================================================ dollhouse room

const palaceRoom: RoomBuilder = ({ kit }) => {
  const iceMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#cfeeff', emissive: '#7fdcff', emissiveIntensity: 0.1, roughness: 0.08, transparent: true, opacity: 0.88, clearcoat: 1, flatShading: true }));
  const spires = new THREE.Mesh(spireGeometry([[-0.45, -0.42, 0.11, 1.0], [-0.22, -0.55, 0.08, 0.74], [-0.66, -0.24, 0.075, 0.6], [-0.3, -0.18, 0.06, 0.42], [-0.62, -0.58, 0.06, 0.52]]), iceMat);
  kit.add(spires);
  // a little fountain with spilling droplets
  const marble = kit.mats.plastic('#e8eef7');
  const basin = new THREE.Mesh(lathe([[0, 0], [0.34, 0], [0.36, 0.03], [0.36, 0.1], [0.32, 0.11], [0.31, 0.03], [0, 0.03]], 28), marble);
  basin.position.set(0.25, 0, -0.12);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.36, 10), marble);
  column.position.set(0.25, 0.2, -0.12);
  const bowl = new THREE.Mesh(lathe([[0.02, 0], [0.16, 0.02], [0.18, 0.06], [0.16, 0.07], [0.03, 0.03]], 20), kit.mats.brass());
  bowl.position.set(0.25, 0.38, -0.12);
  const waterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0f3354', emissive: '#5fd8ff', emissiveIntensity: 0.1 }));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2), waterMat);
  water.position.set(0.25, 0.085, -0.12);
  kit.add(basin);
  kit.add(column);
  kit.add(bowl);
  kit.add(water);
  const NDR = 48;
  const dropPos = new Float32Array(NDR * 3);
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const dropMat = kit.track(new THREE.PointsMaterial({ color: '#e6faff', size: 0.05, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2 }));
  const drops = new THREE.Points(dropGeo, dropMat);
  drops.frustumCulled = false;
  drops.position.set(0.25, 0, -0.12);
  kit.add(drops);
  // the sun
  const sunMat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffbf5a', emissiveIntensity: 0.3 }));
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), sunMat);
  sunDisc.position.set(0.7, 1.08, -0.82);
  const haloMat = kit.track(new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,200,120,1)', 'rgba(255,140,80,0)', 'sunhalo'), transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), haloMat);
  halo.position.set(0.7, 1.08, -0.84);
  kit.add(sunDisc);
  kit.add(halo);
  // three state jars: solid, liquid, gas
  const jars = new THREE.Mesh(mergeGeometries([-0.42, -0.1, 0.22].map((x) => new THREE.CylinderGeometry(0.11, 0.11, 0.3, 18, 1, true).translate(x, 0.15, 0.48)))!, kit.mats.clearPlastic('#e6f6ff', 0.22));
  kit.add(jars);
  const partMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const NJR = 22;
  const parts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), partMat, NJR);
  const pb: V3[] = [];
  for (let a = 0; a < 2; a++) for (let b2 = 0; b2 < 2; b2++) for (let c = 0; c < 2; c++) pb.push([-0.42 + (a - 0.5) * 0.07, 0.07 + b2 * 0.07, 0.48 + (c - 0.5) * 0.07]);
  const r = rng(4);
  for (let i = 0; i < 9; i++) pb.push([-0.1 + (r() - 0.5) * 0.12, 0.04 + r() * 0.06, 0.48 + (r() - 0.5) * 0.12]);
  for (let i = 0; i < 5; i++) pb.push([0.22 + (r() - 0.5) * 0.14, 0.05 + r() * 0.22, 0.48 + (r() - 0.5) * 0.14]);
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();
  pb.forEach((p, i) => {
    parts.setMatrixAt(i, m4.makeTranslation(p[0], p[1], p[2]));
    parts.setColorAt(i, col.set(i < 8 ? FROST : i < 17 ? ICEBLUE : ROSE));
  });
  kit.add(parts);
  const sign = kit.neonSign('ICE PALACE', [0.05, 1.18, -0.84], { height: 0.16, color: AQUA });
  return {
    update(t, lit) {
      iceMat.emissiveIntensity = 0.1 + 0.9 * lit;
      waterMat.emissiveIntensity = 0.1 + 0.9 * lit;
      sunMat.emissiveIntensity = 0.3 + 1.6 * lit;
      haloMat.opacity = 0.1 + 0.4 * lit;
      dropMat.opacity = 0.2 + 0.7 * lit;
      partMat.color.setScalar(0.35 + 0.65 * lit);
      sign.setLit(lit);
      const tt = kit.reducedMotion ? 0.4 : t;
      let k = 0;
      for (let i = 0; i < NDR; i++) {
        const a = (i / 12) * TAU;
        const tau = ((tt * 1.4 + (i % 4) / 4) % 1) * 0.42;
        dropPos[k++] = Math.cos(a) * (0.17 + 0.32 * tau);
        dropPos[k++] = Math.max(0.09, 0.45 + 0.25 * tau - 2.2 * tau * tau);
        dropPos[k++] = Math.sin(a) * (0.17 + 0.32 * tau);
      }
      dropGeo.attributes.position.needsUpdate = true;
      if (!kit.reducedMotion) {
        for (let i = 0; i < 8; i++) {
          const p = pb[i];
          parts.setMatrixAt(i, m4.makeTranslation(p[0] + 0.004 * Math.sin(t * 20 + i), p[1] + 0.004 * Math.sin(t * 17 + i * 2), p[2]));
        }
        for (let i = 17; i < NJR; i++) {
          const p = pb[i];
          parts.setMatrixAt(i, m4.makeTranslation(p[0] + 0.04 * Math.sin(t * 1.9 + i), p[1] + 0.09 * Math.sin(t * 1.3 + i * 2), p[2] + 0.04 * Math.cos(t * 1.6 + i)));
        }
        parts.instanceMatrix.needsUpdate = true;
      }
    },
  };
};

// ================================================================ the attraction

export const L24: TableDef = {
  lessonId: 'L24',
  signature: 'Six State Gates read which way the Wonderball circles the palace: every change of state has a partner running the other way',
  ballRole: 'The Wonderball is a game token: at the State Gates it plays a bit of water changing state, and on the Heat Bridge it only marks which way energy moves. Real water particles are far too small to see, and heat is energy on the move, not a thing that rolls.',
  theme: {
    bg: ['#1b2a5f', '#0a1f33'],
    rail: '#d6f1ff',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(244,251,255,0.12)',
    accent: APRICOT,
    accent2: AQUA,
    bumperCap: '#f3e9ff',
    bumperRing: '#5a3f8f',
    flipper: '#ffe2b0',
    ink: PEARL,
    ramp: 'rgba(255,170,110,0.15)',
    trail: '#9FEFFF',
  },
  lines: {
    intro: 'Welcome to the Heatwave Ice Palace, where ice, water and vapor trade places all day long! Follow the energy and you will see what decides which state wins.',
    quark: '"Keep the stove on under a pot of melting ice and the thermometer must climb the whole time. Right?" Professor Quark wonders aloud.',
    pipTip: 'First stop, the Vapor Vault: from either flipper, shoot just to the right of the Palace Keep and the vapor bumpers take it from there.',
  },
  build,
  skillShot: 'skill_drip',
  shots: [
    { id: 'stair', label: 'Ice Stair', on: [{ type: 'rollover', id: 'gate_freeze' }], insert: 'ins_stair' },
    { id: 'flue', label: 'Vapor Flue', on: [{ type: 'rollover', id: 'gate_evaporate' }], insert: 'ins_flue' },
    { id: 'iceLoop', label: 'Ice Stair round trip (freeze, sublime, condense)', on: [{ type: 'rollover', id: 'gate_condense' }], insert: 'ins_stair' },
    { id: 'vaporLoop', label: 'Vapor Flue round trip (evaporate, deposit, melt)', on: [{ type: 'rollover', id: 'gate_melt' }], insert: 'ins_flue' },
    { id: 'bridge', label: 'Heat Bridge', on: [{ type: 'ramp', id: 'heat_bridge' }], insert: 'ins_bridge' },
    { id: 'pocket', label: 'Fountain', on: [{ type: 'saucer', id: 'fountain' }], insert: 'ins_pocket' },
    { id: 'ice', label: 'Ice Blocks', on: [{ type: 'drop', group: 'ice' }], insert: 'ins_ice' },
    { id: 'vault', label: 'Vapor Vault', on: [{ type: 'bumper', group: 'vapor' }], insert: 'ins_vault' },
    { id: 'smallPot', label: 'Small Pot', on: [{ type: 'target', id: 'pot_small' }], insert: 'ins_small' },
    { id: 'bigPot', label: 'Big Pot', on: [{ type: 'target', id: 'pot_big' }], insert: 'ins_big' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Same Reading, Different Pots',
      brief: 'Speed up the vapor particles, compare two pots that both read 100 °C, then report at the Fountain.',
      objectiveIds: ['L24-O1'],
      stages: [
        { kind: 'collect', text: 'Faster particles, higher temperature: pop vapor 5 times', match: { type: 'bumper', group: 'vapor' }, count: 5, preview: ['vault'] },
        { kind: 'collect', text: 'Both read 100 °C: hit SMALL POT and BIG POT', match: { type: 'target', group: 'pots' }, count: 2, distinct: true, lamps: ['pot_small', 'pot_big'], preview: ['smallPot', 'bigPot'] },
        { kind: 'discover', text: 'Shoot the Fountain to compare the pots', pocket: 'fountain', questions: 1 },
      ],
      discovery: 'Both pots read 100 °C, so their particles have the same average energy of motion. The big pot holds more thermal energy because it has more particles. Heat is energy on the move, warm to cool.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'apply',
      title: 'Warm to Cool',
      brief: 'Send energy over the Heat Bridge from the warm hearth to the ice, melt the ice blocks, then predict the flow.',
      objectiveIds: ['L24-O2'],
      stages: [
        { kind: 'shots', text: 'Heat flows warm to cool: cross the Heat Bridge', shots: ['bridge'] },
        { kind: 'collect', text: 'The cooler ice gains energy: melt 3 ice blocks', match: { type: 'drop', group: 'ice' }, count: 3, distinct: true, preview: ['ice'] },
        { kind: 'discover', text: 'Shoot the Fountain to predict the flow', pocket: 'fountain', questions: 1 },
      ],
      discovery: 'Energy flows as heat from the warmer object to the cooler one until both reach the same temperature, then the net flow stops. Cold does not flow: an ice pack feels cold because energy leaves your hand.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'relate',
      title: 'The Six State Gates',
      brief: 'Circle the palace both ways to light the three energy-in gates and their energy-out partners, then sort all six at the Fountain.',
      objectiveIds: ['L24-O3', 'L24-O4'],
      stages: [
        { kind: 'collect', text: 'Energy in: light MELT, EVAPORATE and SUBLIME', match: { type: 'rollover', group: 'heatIn' }, count: 3, distinct: true, lamps: ['gate_melt', 'gate_evaporate', 'gate_sublime'], preview: ['flue', 'stair'] },
        { kind: 'collect', text: 'Energy out: light FREEZE, CONDENSE and DEPOSIT', match: { type: 'rollover', group: 'heatOut' }, count: 3, distinct: true, lamps: ['gate_freeze', 'gate_condense', 'gate_deposit'], preview: ['stair', 'flue'] },
        { kind: 'discover', text: 'Shoot the Fountain to sort the six changes', pocket: 'fountain', questions: 1, types: ['classify', 'match'] },
      ],
      discovery: 'Energy in melts, evaporates or sublimes; energy out freezes, condenses or deposits. While ice melts or water boils at steady pressure, the temperature holds steady: the energy goes into pulling particles apart.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'The Luminous Fountain',
    brief: 'Circle the palace once each way through three gates, cross the Heat Bridge, then bring the Wonderball home to the Fountain.',
    stages: [
      { kind: 'shots', text: 'Circle the palace both ways and cross the Heat Bridge', shots: ['iceLoop', 'vaporLoop', 'bridge'], order: 'any' },
      { kind: 'discover', text: 'Bring the Wonderball home to the Fountain', pocket: 'fountain', questions: 2 },
    ],
    celebration: 'Ice melts, water evaporates, vapor returns as frost, and heat flows from warm to cool. The Heatwave Ice Palace blooms into a luminous fountain!',
  },
  set: palaceSet,
  room: palaceRoom,
  icons: {
    fountain(ctx, s) {
      // a basin with three arcing jets
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, s * 0.35);
      ctx.lineTo(s * 0.85, s * 0.35);
      ctx.lineTo(s * 0.6, s * 0.8);
      ctx.lineTo(-s * 0.6, s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.08, -s * 0.2, s * 0.16, s * 0.55);
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(0, -s * 0.9);
      ctx.moveTo(0, -s * 0.5);
      ctx.quadraticCurveTo(-s * 0.55, -s * 0.85, -s * 0.7, s * 0.2);
      ctx.moveTo(0, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.55, -s * 0.85, s * 0.7, s * 0.2);
      ctx.stroke();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintPlayfield(ctx, level);
    },
    ambient: paintAmbient,
    celebrate: paintCelebrate,
  },
};
export default L24;
