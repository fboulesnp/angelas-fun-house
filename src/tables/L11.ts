// Lesson 11 — Scales of Change on Earth's Surface — "Glacier Clocktower"
// A clocktower stands in an icy valley and a glacier threads right through it. The Clock Lane runs
// up the middle to the Time Vault (the Wonder Pocket); above it two clock hands swing with the
// missions to send the Clock Lane to the FAST side (rockfall bumpers) or the SLOW side (the Ice
// Field). A long Glacier Ramp climbs the right, crests over the tower and creeps down the left.
// A Space Ruler (MICRO / HUMAN / GLOBAL) and a Time Ruler drop bank (SECONDS / YEARS / MILLENNIA)
// flank the tower, and every shot is printed with the real time it stands for. A time-lapse
// window shows one valley over about 20,000 years as the missions are solved.

import * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Diverter, Mechanism, type Insert } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import {
  TAU, drift, glowDot, mix, neonPath, neonText, plaque, rgba, rng, rrect, stage, stars, vgrad,
} from '../game/render/art.ts';

// ---------------------------------------------------------------- palette

const NAVY = '#0E1A36';
const DUSK = '#1C3158';
const STONE = '#3B4A6E';
const ICE = '#9FE3FF';
const ICE_DEEP = '#4C8FD0';
const SNOW = '#E8F6FF';
const GOLD = '#FFC75B';
const BRASS = '#D9B56A';
const ROSE = '#FF9A7A';
const EMBER = '#FF7A59';
const AURORA = '#7CFFB2';
const VIOLET = '#A08CFF';
const IVORY = '#F4F8FF';
const SAND = '#E2B27A';
const FONT = '"Atkinson Hyperlegible Next", system-ui, sans-serif';

type Pt = [number, number];

const GLACIER_PATH: Pt[] = [
  [404, 680], [440, 600], [446, 520], [452, 440], [450, 360], [436, 290], [406, 228], [360, 182], [300, 160],
  [240, 166], [186, 194], [146, 240], [118, 300], [96, 370], [70, 440], [50, 520], [46, 610], [56, 710], [83, 806],
];

/** The Time Vault sits at the hub of the printed clock dial. */
const HUB: Pt = [286, 380];

// ---------------------------------------------------------------- the clock hands

type Route = 'vault' | 'slow' | 'fast';

/**
 * The two clock hands hang from the top of the Clock Lane and reach down to y = 480. The short
 * hour hand swings left to the SLOW side (the Ice Field); the long minute hand swings right and
 * kicks the ball up to the FAST side (rockfall bumpers and the Landslide Lane).
 */
const HOUR = { y: 414, len: 66, swing: 40 };
const MINUTE = { y: 400, len: 80, swing: 126 };

/** Hand positions: 0 = hanging down along the lane wall, 1 = swung across the junction. */
const ROUTES: Record<Route, [0 | 1, 0 | 1]> = { vault: [0, 0], slow: [1, 0], fast: [0, 1] };

/**
 * Swings the two clock hands to the route the current mission stage wants. The hands only move
 * while no ball is near them, and one hand always returns home before the other swings out, so
 * they can never cross or close on a ball. In the finale the clock "ticks": every Clock Lane
 * shot flips the route between fast and slow.
 */
class ClockKeeper extends Mechanism {
  kind = 'clockKeeper' as const;
  want: Route = 'vault';
  ticking = false;
  private lastFlash = 0;
  private hour: Diverter;
  private minute: Diverter;
  private lane: Mechanism;
  constructor(rt: TableRuntime, id: string, hour: Diverter, minute: Diverter, lane: Mechanism) {
    super(rt, id);
    this.hour = hour;
    this.minute = minute;
    this.lane = lane;
  }
  private clear(): boolean {
    for (const b of this.rt.world.balls) {
      if (b.state === 'drained' || b.layer !== 0) continue;
      if (Math.hypot(b.x - this.hour.px, b.y - this.hour.py) < HOUR.len + 22) return false;
      if (Math.hypot(b.x - this.minute.px, b.y - this.minute.py) < MINUTE.len + 22) return false;
    }
    return true;
  }
  update(dt: number) {
    super.update(dt);
    if (this.ticking && this.lane.hitFlash > this.lastFlash + 0.2) this.want = this.want === 'fast' ? 'slow' : 'fast';
    this.lastFlash = this.lane.hitFlash;
    const [h, m] = ROUTES[this.want];
    const settled = this.hour.position === h && this.minute.position === m && this.hour.pending === null && this.minute.pending === null;
    if (!settled && this.clear()) {
      if (h === 0 && this.hour.position !== 0) this.hour.set(0);
      if (m === 0 && this.minute.position !== 0) this.minute.set(0);
      if (h === 1 && this.minute.position === 0 && this.minute.pending === null) this.hour.set(1);
      if (m === 1 && this.hour.position === 0 && this.hour.pending === null) this.minute.set(1);
    }
    const slow = this.rt.find<Insert>('ins_slow');
    const fast = this.rt.find<Insert>('ins_fast');
    if (slow) slow.lamp = this.hour.position === 1 ? 'pulse' : 'off';
    if (fast) fast.lamp = this.minute.position === 1 ? 'pulse' : 'off';
  }
}

/** Which way the clock hands point for each mission stage. */
function routeFor(slot: number, stage: number): Route {
  if (slot === 2) return stage === 0 ? 'fast' : stage === 1 ? 'slow' : 'vault';
  return 'vault';
}

// ---------------------------------------------------------------- geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Meltwater Channel: left orbit lane with an exit deflector ---
  b.wall([[76, 648], [76, 388]], { id: 'melt_inner', r: 3 });
  b.post(76, 384, 5);
  b.shotSwitch('melt_sw', 50, 500, -90);
  // A one-way gate rather than a wall: meltwater exits are deflected into play, but the
  // kickback under the left outlane fires straight up through it.
  b.gate('melt_deflect', [FRAME.left, 654], [56, 702], -90);

  // --- Landslide Lane: right channel with a spinner; soft plunges drop onto the ICE star ---
  b.spinner('landslide', [478, 560], [544, 560], { label: 'LANDSLIDE' });
  b.shotSwitch('slide_sw', 511, 480, -90);
  b.wall([[FRAME.laneSep, 648], [518, 696]], { id: 'slide_deflect', r: 3 });
  b.rollover('skill_star', 526, 324, { label: 'ICE', r: 16 });

  // --- Glacier Ramp: climbs the right, crests over the clocktower, creeps down the left ---
  b.wall([[366, 712], [386, 672]], { id: 'glacier_flare_l', r: 3 });
  b.wall([[450, 716], [423, 690]], { id: 'glacier_flare_r', r: 3 });
  b.ramp('glacier', { path: GLACIER_PATH, width: 36, footprintTo: 3, peak: 96, label: 'GLACIER RAMP' });
  b.wall([[430, 444], [452, 420], [474, 444]], { id: 'glacier_roof', r: 3 });

  // --- Space Ruler: three standups on the ramp body ---
  b.wall([[404, 612], [420, 468]], { id: 'space_back', r: 3 });
  b.target('space_micro', [398.4, 589.2], [402.0, 557.4], { group: 'space', label: 'MICRO' });
  b.target('space_human', [403.1, 547.5], [406.8, 515.7], { group: 'space', label: 'HUMAN' });
  b.target('space_global', [407.9, 505.8], [411.5, 474.0], { group: 'space', label: 'GLOBAL' });

  // --- Clock Lane up the middle, the Time Vault (Wonder Pocket) at its top, two clock hands ---
  b.wall([[258, 646], [258, 480]], { id: 'lane_l', r: 4 });
  b.wall([[314, 578], [314, 480]], { id: 'lane_r', r: 4 });
  b.post(258, 650, 5);
  b.post(314, 578, 5);
  const lane = b.shotSwitch('clock_sw', 286, 560, -90);
  // Escapement gate: shots pass up the lane; anything falling back is steered out to the right.
  b.gate('escapement', [262, 598], [318, 642], -90);
  b.wall([[258, HOUR.y], [258, 344], [286, 330], [314, 344], [314, MINUTE.y]], { id: 'vault_cup', r: 4 });
  b.saucer('vault', HUB[0], HUB[1], { role: 'pocket', ejectDeg: 90, ejectSpeed: 700, captureMaxSpeed: 2600, label: 'VAULT', icon: 'clock' });
  const hour = b.diverter('hand_hour', [258, HOUR.y], HOUR.len, 90, HOUR.swing);
  const minute = b.diverter('hand_minute', [314, MINUTE.y], MINUTE.len, 90, MINUTE.swing);
  b.rt.add(new ClockKeeper(b.rt, 'clock_keeper', hour, minute, lane));

  // --- The four shapers on the Clock Lane walls ---
  b.target('shape_weather', [249, 566], [249, 600], { group: 'shapers', label: 'WEATHER' });
  b.target('shape_erode', [249, 608], [249, 642], { group: 'shapers', label: 'ERODE' });
  b.target('shape_deposit', [323, 490], [323, 524], { group: 'shapers', label: 'DEPOSIT' });
  b.target('shape_uplift', [323, 532], [323, 566], { group: 'shapers', label: 'UPLIFT' });

  // --- Time Ruler: SECONDS / YEARS / MILLENNIA drop bank with a backstop joined to the lane ---
  b.dropBank('time_bank', 128, 604, -24, 3, { size: 32, gap: 5, group: 'timeScale', labels: ['SEC', 'YEARS', '1000s'] });
  b.wall([[122, 595], [254, 536]], { id: 'time_back', r: 3 });
  b.wall([[128, 604], [122, 595]], { id: 'time_cap', r: 3 });

  // --- Rockfall (fast side) bumpers and the Ice Field (slow side) rollovers ---
  b.bumper('rock_1', 346, 264, { group: 'rockfall', r: 26, icon: 'rock' });
  b.bumper('rock_2', 394, 346, { group: 'rockfall', r: 26, icon: 'rock' });
  b.rollover('ice_1', 214, 442, { group: 'ice', label: 'I' });
  b.rollover('ice_2', 170, 430, { group: 'ice', label: 'II' });
  b.rollover('ice_3', 128, 422, { group: 'ice', label: 'III' });

  // --- Inserts ---
  b.insert('ins_glacier', 372, 738, { deg: -62, label: 'GLACIER' });
  b.insert('ins_clock', 286, 708, { deg: -90, label: 'CLOCK' });
  b.insert('ins_vault', 286, 520, { shape: 'circle', size: 12 });
  // Beside the channel mouth rather than under the Glacier Ramp, so it stays readable in 3D.
  b.insert('ins_melt', 98, 690, { deg: -118, label: 'MELT' });
  b.insert('ins_slide', 511, 616, { deg: -90, label: 'SLIDE' });
  b.insert('ins_time', 180, 648, { deg: -115 });
  b.insert('ins_space', 352, 610, { deg: -40 });
  b.insert('ins_shapers', 286, 766, { shape: 'star', size: 12 });
  b.insert('ins_rockfall', 370, 305, { shape: 'star', size: 10, color: ROSE });
  b.insert('ins_ice', 170, 474, { shape: 'star', size: 11, color: ICE });
  b.insert('ins_slow', 232, 456, { deg: -150, size: 12, color: ICE });
  b.insert('ins_fast', 340, 450, { deg: -20, size: 12, color: ROSE });
}

// ---------------------------------------------------------------- printed playfield helpers

function catmull(points: Pt[], per = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number, deg = 0, weight = 800) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8,14,32,0.75)';
  ctx.lineWidth = Math.max(2, size * 0.28);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Jagged mountain range with snow caps. */
function range(ctx: CanvasRenderingContext2D, seed: number, baseY: number, peakY: number, color: string, snow: string, snowA: number) {
  const r = rng(seed);
  const pts: Pt[] = [[0, baseY]];
  let x = -20;
  while (x < 640) {
    const w = 40 + r() * 60;
    pts.push([x + w * 0.5, peakY + r() * (baseY - peakY) * 0.55]);
    pts.push([x + w, baseY - r() * (baseY - peakY) * 0.35]);
    x += w;
  }
  pts.push([620, baseY + 400], [-20, baseY + 400]);
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
  if (snowA <= 0) return;
  ctx.fillStyle = rgba(snow, snowA);
  for (let i = 1; i < pts.length - 3; i += 2) {
    const [px, py] = pts[i];
    if (py > baseY - (baseY - peakY) * 0.45) continue;
    const d = (baseY - py) * 0.3;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - d * 0.7, py + d);
    ctx.lineTo(px - d * 0.2, py + d * 0.75);
    ctx.lineTo(px + d * 0.15, py + d * 1.05);
    ctx.lineTo(px + d * 0.7, py + d);
    ctx.closePath();
    ctx.fill();
  }
}

/** The ice of the glacier printed under the ramp, with crevasses and moraine ridges. */
function glacierBand(ctx: CanvasRenderingContext2D, lit: number, melt: number) {
  const pts = catmull(GLACIER_PATH, 8);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // moraine ridges (rock the ice drops at its edges)
  tracePath(ctx, pts);
  ctx.strokeStyle = rgba('#6d6a78', 0.55);
  ctx.lineWidth = 86;
  ctx.stroke();
  const r = rng(17);
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = pts[i];
    for (let k = 0; k < 2; k++) {
      const a = r() * TAU;
      const d = 34 + r() * 8;
      ctx.fillStyle = rgba(['#8a8496', '#a39a8c', '#5f5a6c'][k % 3], 0.75);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + r() * 3, 0, TAU);
      ctx.fill();
    }
  }
  // the ice itself
  tracePath(ctx, pts);
  ctx.strokeStyle = rgba(mix('#4f74a6', '#7fb2dc', lit), 0.8 - melt * 0.2);
  ctx.lineWidth = 66;
  ctx.stroke();
  tracePath(ctx, pts);
  ctx.strokeStyle = rgba(SNOW, 0.12 + 0.14 * lit);
  ctx.lineWidth = 30;
  ctx.stroke();
  // crevasses across the flow
  for (let i = 3; i < pts.length - 2; i += 3) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i + 1];
    const tx = x1 - x0;
    const ty = y1 - y0;
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l;
    const ny = tx / l;
    const [cx, cy] = pts[i];
    const w = 14 + r() * 12;
    ctx.strokeStyle = rgba(ICE_DEEP, 0.45 + 0.3 * lit);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - nx * w + tx / l * 3, cy - ny * w + ty / l * 3);
    ctx.quadraticCurveTo(cx + tx / l * 6, cy + ty / l * 6, cx + nx * w, cy + ny * w);
    ctx.stroke();
  }
  // meltwater sparkle once the ice starts to retreat
  if (melt > 0) {
    tracePath(ctx, pts.slice(Math.floor(pts.length * 0.75)));
    ctx.strokeStyle = rgba('#5fd0ff', 0.5 * melt);
    ctx.lineWidth = 8;
    ctx.stroke();
  }
  ctx.restore();
}

/** The great clock dial printed around the Time Vault: a slow (ice) half and a fast (rock) half. */
function dial(ctx: CanvasRenderingContext2D, level: number) {
  const [cx, cy] = HUB;
  const R = 112;
  const lit = stage(level, 0.1, 1);
  const halves = stage(level, 0.6, 2.4);
  ctx.save();
  // face
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
  g.addColorStop(0, rgba('#22365f', 0.95));
  g.addColorStop(1, rgba('#101c3a', 0.95));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  // slow half (left, ice) and fast half (right, rock)
  ctx.globalAlpha = 0.16 + 0.3 * halves;
  ctx.fillStyle = ICE;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R - 6, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ROSE;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, R - 6, -Math.PI / 2, Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // brass rings
  ctx.strokeStyle = rgba(BRASS, 0.55 + 0.45 * lit);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 26, 0, TAU);
  ctx.stroke();
  // ticks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const major = i % 5 === 0;
    const r0 = R - (major ? 22 : 12);
    ctx.strokeStyle = rgba(IVORY, major ? 0.55 + 0.4 * lit : 0.3);
    ctx.lineWidth = major ? 3 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
    ctx.stroke();
  }
  // time-scale words around the ring: fast on the right, slow on the left
  const words: [string, number, string][] = [
    ['SECONDS', -50, ROSE], ['MINUTES', -15, ROSE], ['YEARS', 20, ROSE],
    ['1000s OF YEARS', 160, ICE], ['MILLIONS', 195, ICE], ['BILLIONS', 230, ICE],
  ];
  for (const [w, deg, c] of words) {
    const a = (deg * Math.PI) / 180;
    const rr = R - 40;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    const rot = deg > 90 && deg < 270 ? deg + 180 : deg;
    label(ctx, w, x, y, w.length > 9 ? 7.5 : 9, c, 0.55 + 0.45 * lit, rot);
  }
  label(ctx, 'SLOW', cx - 74, cy + 92, 13, ICE, 0.5 + 0.5 * halves);
  label(ctx, 'FAST', cx + 74, cy + 92, 13, ROSE, 0.5 + 0.5 * halves);
  label(ctx, 'TIME VAULT', cx, cy - 76, 9, GOLD, 0.6 + 0.4 * lit);
  ctx.restore();
}

/** One valley, one time-lapse frame per awakening step (about 5,000 years apart). */
function valleyFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number) {
  ctx.save();
  rrect(ctx, x, y, w, h, 10);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, step >= 4 ? '#3b5c9a' : '#22355f');
  sky.addColorStop(1, step >= 4 ? '#f2b48a' : '#4a5f8f');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  if (step >= 4) {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba([AURORA, VIOLET, AURORA][i], 0.35);
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) ctx.lineTo(x + (w * k) / 20, y + 10 + i * 6 + Math.sin(k * 0.8 + i) * 4);
      ctx.stroke();
    }
  }
  // valley walls (the U shape the ice carved; ice fills it at first)
  const fy = y + h * 0.78;
  ctx.fillStyle = '#4b5878';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h * 0.22);
  ctx.lineTo(x + w * 0.14, y + h * 0.1);
  ctx.lineTo(x + w * 0.24, y + h * 0.3);
  ctx.quadraticCurveTo(x + w * 0.3, fy, x + w * 0.5, fy);
  ctx.quadraticCurveTo(x + w * 0.7, fy, x + w * 0.76, y + h * 0.3);
  ctx.lineTo(x + w * 0.86, y + h * 0.08);
  ctx.lineTo(x + w, y + h * 0.2);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(SNOW, 0.8);
  for (const [px, py] of [[x + w * 0.14, y + h * 0.1], [x + w * 0.86, y + h * 0.08]] as Pt[]) {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 9, py + 9);
    ctx.lineTo(px + 9, py + 9);
    ctx.closePath();
    ctx.fill();
  }
  // ice: full, thinning, retreating, gone
  const ice = [1, 0.7, 0.35, 0.08, 0][Math.min(4, step)];
  if (ice > 0) {
    ctx.fillStyle = rgba('#d9f2ff', 0.92);
    ctx.beginPath();
    const top = fy - (h * 0.5) * ice;
    ctx.moveTo(x + w * 0.5 - w * 0.26 * Math.min(1, ice + 0.3), fy);
    ctx.quadraticCurveTo(x + w * 0.5, top - 6, x + w * 0.5 + w * 0.26 * Math.min(1, ice + 0.3), fy);
    ctx.closePath();
    ctx.fill();
  }
  // meltwater lake that slowly fills with sediment (deposition)
  if (step >= 2) {
    const lw = [0, 0, 0.24, 0.3, 0.24][step];
    ctx.fillStyle = rgba('#5fb8e8', 0.9);
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, fy - 2, w * lw, 5, 0, 0, TAU);
    ctx.fill();
  }
  if (step >= 3) {
    const r = rng(5 + step);
    for (let i = 0; i < 10 + step * 4; i++) {
      const tx = x + w * (0.08 + r() * 0.84);
      const side = tx < x + w * 0.3 || tx > x + w * 0.7;
      const ty = side ? y + h * (0.55 + r() * 0.3) : fy + 4 + r() * 6;
      ctx.fillStyle = rgba(step >= 4 ? '#3f8f6a' : '#4f7f63', 0.95);
      ctx.beginPath();
      ctx.moveTo(tx, ty - 7);
      ctx.lineTo(tx - 3, ty);
      ctx.lineTo(tx + 3, ty);
      ctx.closePath();
      ctx.fill();
    }
  }
  // moraine boulders the ice dropped
  ctx.fillStyle = '#9b93a0';
  for (const [px, py, s] of [[0.33, 0.86, 3], [0.62, 0.9, 4], [0.7, 0.84, 2.5]]) {
    ctx.beginPath();
    ctx.arc(x + w * px, y + h * py, s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = rgba(BRASS, 0.85);
  ctx.lineWidth = 3;
  rrect(ctx, x, y, w, h, 10);
  ctx.stroke();
}

const LAPSE = ['≈ 20,000 YEARS AGO', '≈ 15,000 YEARS AGO', '≈ 10,000 YEARS AGO', '≈ 5,000 YEARS AGO', 'TODAY'];

function personIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string, a: number) {
  ctx.fillStyle = rgba(c, a);
  ctx.beginPath();
  ctx.arc(x, y - s * 0.6, s * 0.28, 0, TAU);
  ctx.fill();
  rrect(ctx, x - s * 0.25, y - s * 0.28, s * 0.5, s * 0.9, s * 0.15);
  ctx.fill();
}

function globeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string, a: number) {
  ctx.strokeStyle = rgba(c, a);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, s, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.45, s, 0, 0, TAU);
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.stroke();
}

function grainIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string, a: number) {
  const r = rng(3);
  ctx.fillStyle = rgba(c, a);
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * s * 1.6, y + (r() - 0.5) * s * 1.2, 1 + r() * 1.4, 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- printed playfield

const SNOW_AREA: [number, number, number, number] = [30, 40, 560, 780];
const BURST_COLORS = [GOLD, ICE, AURORA];
/** 2D aurora stroke, reused every frame (no per-frame closure). */
const auroraLine = { ctx: null as CanvasRenderingContext2D | null, t: 0 };
const drawAuroraLine = () => {
  const ctx = auroraLine.ctx!;
  ctx.beginPath();
  for (let k = 0; k <= 30; k++) ctx.lineTo(20 + k * 19, 90 + Math.sin(k * 0.5 + auroraLine.t * 0.6) * 18);
};

const scenery: TableDef['scenery'] = {
  backdrop({ ctx, level }) {
    const s1 = stage(level, 0.2, 1);
    const s2 = stage(level, 1.2, 2);
    const s3 = stage(level, 2.2, 3);
    const s4 = stage(level, 3.3, 4);
    const step = Math.max(0, Math.min(4, Math.round(level)));

    // Twilight over the valley
    ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#14254a'], [0.3, DUSK], [0.62, '#172a52'], [1, '#0a1430']]);
    ctx.fillRect(0, 0, 600, 1150);
    stars(ctx, 11, 80, [30, 20, 570, 300], IVORY);
    // Aurora (the Wonderlight spectacle)
    if (s3 > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const c = [AURORA, VIOLET, AURORA, '#5fd0ff'][i];
        ctx.strokeStyle = rgba(c, (0.08 + 0.12 * s4) * (s3 * 0.4 + s4 * 0.6));
        ctx.lineWidth = 26 - i * 4;
        ctx.beginPath();
        for (let k = 0; k <= 30; k++) ctx.lineTo(20 + k * 19, 60 + i * 26 + Math.sin(k * 0.55 + i * 1.7) * 22);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Mountains behind the tower
    range(ctx, 4, 300, 120, mix('#1b2b50', '#2a3f6c', s1), SNOW, 0.35 + 0.5 * s2);
    range(ctx, 9, 360, 220, mix('#16244a', '#22355f', s1), SNOW, 0.25 + 0.5 * s2);
    // Snowfield floor with faint sastrugi stripes
    ctx.fillStyle = vgrad(ctx, 640, 1150, [[0, rgba('#1d2e55', 0.0)], [0.2, '#1a2a4f'], [1, '#0d1834']]);
    ctx.fillRect(0, 640, 600, 510);
    ctx.save();
    ctx.globalAlpha = 0.07 + 0.05 * s2;
    ctx.strokeStyle = SNOW;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      for (let x = 0; x <= 600; x += 20) ctx.lineTo(x, 700 + i * 26 + Math.sin(x * 0.02 + i) * 5);
      ctx.stroke();
    }
    ctx.restore();

    // The glacier under its ramp
    glacierBand(ctx, s3, s4);

    // Meltwater Channel (left orbit) and Landslide Lane (right channel)
    ctx.fillStyle = vgrad(ctx, 380, 660, [[0, rgba('#3d8fd0', 0.25 + 0.3 * s2)], [1, rgba('#3d8fd0', 0.08)]]);
    ctx.fillRect(28, 380, 46, 280);
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = rgba('#9fe3ff', 0.18 + 0.25 * s2);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let y = 390; y < 650; y += 10) ctx.lineTo(40 + i * 4 + Math.sin(y * 0.05 + i) * 4, y);
      ctx.stroke();
    }
    // In the strip of the channel the Glacier Ramp does not cover.
    label(ctx, 'MELTWATER · YEARS', 37, 420, 8.5, ICE, 0.6 + 0.4 * s2, -90);
    const rr = rng(23);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rgba(['#7a6a62', '#9a8574', '#5c5058'][i % 3], 0.65);
      const x = 482 + rr() * 60;
      const y = 340 + rr() * 300;
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 5, y + 2);
      ctx.lineTo(x - 4, y + 4);
      ctx.closePath();
      ctx.fill();
    }
    label(ctx, 'LANDSLIDE · MINUTES', 528, 470, 9, ROSE, 0.55 + 0.45 * s1, -90);

    // The clocktower body behind the lane, then the dial around the Time Vault
    ctx.save();
    ctx.fillStyle = vgrad(ctx, 250, 660, [[0, mix(STONE, '#56679a', s1)], [1, '#22304f']]);
    ctx.beginPath();
    ctx.moveTo(214, 660);
    ctx.lineTo(214, 300);
    ctx.lineTo(286, 236);
    ctx.lineTo(358, 300);
    ctx.lineTo(358, 660);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba('#0c1430', 0.45);
    ctx.lineWidth = 1;
    for (let y = 300; y < 660; y += 14) {
      ctx.beginPath();
      ctx.moveTo(214, y);
      ctx.lineTo(358, y);
      ctx.stroke();
      for (let x = 214 + ((y / 14) % 2) * 14; x < 358; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 14);
        ctx.stroke();
      }
    }
    ctx.restore();
    dial(ctx, level);
    // Kept left of the Rockfall bumpers so their caps never hide the name in the 3D view.
    neonText(ctx, 'GLACIER CLOCKTOWER', 238, 230, 11.5, GOLD, stage(level, 0.6, 1.6));

    // Ice Field (slow side) and Rockfall (fast side)
    ctx.save();
    ctx.strokeStyle = rgba(ICE, 0.3 + 0.45 * s2);
    ctx.lineWidth = 1.6;
    const ri = rng(41);
    for (let i = 0; i < 14; i++) {
      const x = 100 + ri() * 130;
      const y = 400 + ri() * 70;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + ri() * 10, y - 4 + ri() * 8);
      ctx.lineTo(x + 18 + ri() * 10, y + ri() * 6);
      ctx.stroke();
    }
    ctx.restore();
    label(ctx, 'ICE FIELD', 160, 393, 11, ICE, 0.6 + 0.4 * s2);
    label(ctx, 'THOUSANDS OF YEARS', 168, 494, 8, ICE, 0.5 + 0.5 * s2);
    label(ctx, 'ROCKFALL', 404, 396, 9, ROSE, 0.6 + 0.4 * s2);
    label(ctx, 'SECONDS', 404, 407, 7, ROSE, 0.5 + 0.5 * s2);
    ctx.save();
    ctx.fillStyle = rgba('#5a4a5c', 0.55);
    ctx.beginPath();
    ctx.moveTo(318, 200);
    ctx.lineTo(352, 214);
    ctx.lineTo(372, 196);
    ctx.lineTo(408, 232);
    ctx.lineTo(420, 300);
    ctx.lineTo(404, 300);
    ctx.lineTo(390, 260);
    ctx.lineTo(360, 230);
    ctx.lineTo(330, 236);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 9; i++) glowDot(ctx, 360 + Math.sin(i * 2.1) * 40, 300 + i * 12, 4, EMBER, 0.15 + 0.3 * s1);
    ctx.restore();

    // The two rulers
    label(ctx, 'TIME RULER', 168, 626, 10, GOLD, 0.6 + 0.4 * s2, -24);
    const tWords = ['SECONDS', 'YEARS', 'MILLENNIA'];
    for (let i = 0; i < 3; i++) {
      const s = 16 + i * 37;
      const bx = 128 + Math.cos((-24 * Math.PI) / 180) * s;
      const by = 604 + Math.sin((-24 * Math.PI) / 180) * s;
      label(ctx, tWords[i], bx - 2, by + 15, 7, IVORY, 0.55 + 0.45 * s2, -24);
    }
    // The Space Ruler standups face sideways, so their names are printed beside them.
    label(ctx, 'SPACE RULER', 358, 556, 8.5, GOLD, 0.6 + 0.4 * s2, -84);
    const spaceWords: [string, number, number][] = [['MICRO', 386, 573], ['HUMAN', 391, 532], ['GLOBAL', 396, 490]];
    for (const [w, x, y] of spaceWords) label(ctx, w, x, y, 7.5, IVORY, 0.65 + 0.35 * s2, -84);
    grainIcon(ctx, 375, 573, 5, SAND, 0.7 + 0.3 * s2);
    personIcon(ctx, 379, 534, 10, IVORY, 0.65 + 0.35 * s2);
    globeIcon(ctx, 384, 490, 5, ICE, 0.7 + 0.3 * s2);

    // Shapers: the Clock Lane standups also face sideways, so each name is printed beside it.
    label(ctx, 'SHAPERS', 230, 662, 9, GOLD, 0.55 + 0.45 * s1, -90);
    const shaperWords: [string, number, number][] = [['WEATHER', 238, 583], ['ERODE', 238, 625], ['DEPOSIT', 334, 507], ['UPLIFT', 334, 549]];
    for (const [w, x, y] of shaperWords) label(ctx, w, x, y, 7.5, GOLD, 0.7 + 0.3 * s1, -90);
    // The represented time of the Glacier Ramp, beside its mouth.
    label(ctx, 'ICE FLOW', 436, 750, 9, ICE, 0.6 + 0.4 * s3);
    label(ctx, '10,000s OF YEARS', 436, 763, 8, ICE, 0.55 + 0.45 * s3);

    // Time-lapse window: one valley, about 20,000 years in one visit
    plaque(ctx, `TIME-LAPSE · ${LAPSE[step]}`, 286, 790, NAVY, step >= 4 ? GOLD : ICE, 11);
    valleyFrame(ctx, 192, 806, 188, 70, step);
    label(ctx, 'ONE VALLEY · 20,000 YEARS · MODEL', 286, 888, 7, IVORY, 0.55 + 0.35 * s1);

    // Wonderlight wash
    if (s4 > 0) {
      ctx.fillStyle = rgba(GOLD, 0.035 * s4);
      ctx.fillRect(0, 0, 600, 1150);
    }
  },
  ambient({ ctx, t, level, reduced }) {
    if (reduced) return;
    drift(ctx, 13, 22, t, SNOW, SNOW_AREA, 8, 1.6, 0.25 + 0.25 * stage(level, 1, 3));
    const s4 = stage(level, 3.3, 4);
    if (s4 > 0) {
      auroraLine.ctx = ctx;
      auroraLine.t = t;
      neonPath(ctx, drawAuroraLine, AURORA, 0.5 * s4, 3);
    }
  },
  celebrate({ ctx, t }, p) {
    ctx.save();
    ctx.globalAlpha = Math.sin(p * Math.PI) * 0.45;
    const g = ctx.createRadialGradient(HUB[0], HUB[1], 10, HUB[0], HUB[1], 460);
    g.addColorStop(0, rgba(ICE, 0.85));
    g.addColorStop(1, rgba(ICE, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 1150);
    ctx.restore();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + t * 0.5;
      const d = 50 + p * 280;
      glowDot(ctx, HUB[0] + Math.cos(a) * d, HUB[1] + Math.sin(a) * d * 0.85, 9, BURST_COLORS[i % 3], 1 - p);
    }
  },
};

// ---------------------------------------------------------------- 3D attraction set

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

function stoneTexture(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 256, 256, (ctx) => {
    const r = rng(8);
    ctx.fillStyle = '#5a6788';
    ctx.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * 64 + (row % 2) * 32;
        const shade = 0.8 + r() * 0.35;
        ctx.fillStyle = `rgb(${Math.round(86 * shade)},${Math.round(100 * shade)},${Math.round(134 * shade)})`;
        ctx.fillRect(x + 2, row * 32 + 2, 60, 28);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 400; i++) ctx.fillRect(r() * 256, r() * 256, 2, 2);
  });
}

/** Clock face for the tower: time-scale words instead of numerals. */
function dialTexture(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 512, 512, (ctx) => {
    const c = 256;
    const g = ctx.createRadialGradient(c, c, 20, c, c, 250);
    g.addColorStop(0, '#fff7e4');
    g.addColorStop(1, '#e9d9b4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, 250, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(159,227,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, 236, Math.PI / 2, Math.PI * 1.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,154,122,0.3)';
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, 236, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2a1a';
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU;
      const major = i % 5 === 0;
      ctx.lineWidth = major ? 9 : 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * (major ? 196 : 214), c + Math.sin(a) * (major ? 196 : 214));
      ctx.lineTo(c + Math.cos(a) * 236, c + Math.sin(a) * 236);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a1e30';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Words sit inside the tick ring (radius < 190) and never overlap SLOW / FAST below the hub.
    ctx.font = `800 26px ${FONT}`;
    const words: [string, number][] = [['NOW', -90], ['SECONDS', -35], ['YEARS', 20], ['1000s YRS', 160], ['MILLIONS', 215]];
    for (const [w, deg] of words) {
      const a = (deg * Math.PI) / 180;
      ctx.fillText(w, c + Math.cos(a) * 135, c + Math.sin(a) * 135, 150);
    }
    ctx.font = `700 19px ${FONT}`;
    ctx.fillStyle = '#5a4a3a';
    ctx.fillText('TIME-LAPSE CLOCK', c, c + 82, 200);
    ctx.font = `800 32px ${FONT}`;
    ctx.fillStyle = '#2f6fa8';
    ctx.fillText('SLOW', c - 72, c + 134);
    ctx.fillStyle = '#c4502e';
    ctx.fillText('FAST', c + 72, c + 134);
  });
}

type Scene = 'rockfall' | 'glacier' | 'canyon';

/** An arched landscape window: the same kind of place seen at a different time scale. */
function windowTexture(kit: SetKit, scene: Scene, caption: string, sub: string): THREE.CanvasTexture {
  return canvasTex(kit, 256, 400, (ctx) => {
    const W = 256;
    const H = 400;
    const arch = () => {
      ctx.beginPath();
      ctx.moveTo(14, H - 14);
      ctx.lineTo(14, 128);
      ctx.arc(128, 128, 114, Math.PI, 0);
      ctx.lineTo(242, H - 14);
      ctx.closePath();
    };
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    arch();
    ctx.clip();
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#24407a');
    sky.addColorStop(0.6, '#f0a77c');
    sky.addColorStop(1, '#f6cf9a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const r = rng(scene.length * 7);
    if (scene === 'rockfall') {
      ctx.fillStyle = '#6b5b6e';
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.lineTo(120, 90);
      ctx.lineTo(150, 260);
      ctx.lineTo(256, 300);
      ctx.lineTo(256, 400);
      ctx.lineTo(0, 400);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8b7a84';
      for (let i = 0; i < 9; i++) {
        const x = 150 + i * 10 + r() * 10;
        const y = 150 + i * 22;
        ctx.beginPath();
        ctx.arc(x, y, 6 + r() * 8, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(240,220,200,0.35)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(170 + r() * 70, 280 + r() * 50, 18 + r() * 14, 0, TAU);
        ctx.fill();
      }
    } else if (scene === 'glacier') {
      ctx.fillStyle = '#4b5878';
      ctx.beginPath();
      ctx.moveTo(0, 400);
      ctx.lineTo(0, 120);
      ctx.lineTo(50, 90);
      ctx.lineTo(80, 170);
      ctx.quadraticCurveTo(100, 320, 128, 320);
      ctx.quadraticCurveTo(156, 320, 176, 170);
      ctx.lineTo(206, 86);
      ctx.lineTo(256, 120);
      ctx.lineTo(256, 400);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e4f6ff';
      ctx.beginPath();
      ctx.moveTo(84, 190);
      ctx.quadraticCurveTo(128, 150, 172, 190);
      ctx.lineTo(160, 318);
      ctx.lineTo(96, 318);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7fb7e0';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(100 + i * 4, 210 + i * 22);
        ctx.lineTo(156 - i * 4, 214 + i * 22);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#c4703f';
      ctx.fillRect(0, 170, W, H);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = ['#d98a5a', '#b5603a', '#e3a874', '#9c5235'][i % 4];
        ctx.fillRect(0, 170 + i * 22, W, 12);
      }
      ctx.fillStyle = '#5a2e22';
      ctx.beginPath();
      ctx.moveTo(60, 170);
      ctx.lineTo(100, 250);
      ctx.lineTo(110, 330);
      ctx.lineTo(146, 330);
      ctx.lineTo(160, 250);
      ctx.lineTo(200, 170);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5fb8e8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(128, 330);
      ctx.quadraticCurveTo(120, 360, 132, 400);
      ctx.stroke();
    }
    ctx.restore();
    // caption plate
    ctx.fillStyle = 'rgba(14,26,54,0.86)';
    ctx.fillRect(14, H - 82, W - 28, 68);
    ctx.fillStyle = '#fff7e4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(caption, W / 2, H - 58);
    ctx.font = `700 19px ${FONT}`;
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(sub, W / 2, H - 31);
    // brass frame
    ctx.strokeStyle = '#e8c47a';
    ctx.lineWidth = 10;
    arch();
    ctx.stroke();
  });
}

/** A two-line neon panel (the neon helper only fits one line). */
function neonPanel(kit: SetKit, lines: [string, string], pos: [number, number, number], w: number, color: string, rotY: number) {
  const tex = canvasTex(kit, 1024, 384, (ctx) => {
    ctx.clearRect(0, 0, 1024, 384);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 120px "Fraunces Variable", Georgia, serif`;
    ctx.fillText(lines[0], 512, 110, 980);
    ctx.fillText(lines[1], 512, 270, 980);
  });
  const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveMap: tex, emissiveIntensity: 0.06, alphaMap: tex, transparent: true, depthWrite: false }));
  const g = new THREE.Group();
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * 384) / 1024), mat);
  glyph.position.z = 0.04;
  glyph.renderOrder = 3;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, (w * 384) / 1024 * 1.05, 0.05), kit.mats.plastic('#141a30'));
  g.add(back, glyph);
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.y = rotY;
  kit.add(g);
  return { group: g, setLit: (v: number) => (mat.emissiveIntensity = 0.06 + v * 3) };
}

const _P = new THREE.Vector3();
const _T = new THREE.Vector3();
const _S = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

/**
 * (Re)writes a lofted tongue between curve fractions `from` and `to`: a flattened half-tube whose
 * width and height vary along the curve. UVs keep the absolute curve fraction, so the texture
 * stays put on the ground when the tongue grows or shrinks. Allocation-free.
 */
function writeTongue(geo: THREE.BufferGeometry, curve: THREE.Curve<THREE.Vector3>, segs: number, ring: number, from: number, to: number, width: (u: number) => number, height: (u: number) => number, lift = 0) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  let n = 0;
  for (let i = 0; i <= segs; i++) {
    const u = from + ((to - from) * i) / segs;
    curve.getPointAt(u, _P);
    curve.getTangentAt(u, _T);
    _S.crossVectors(_T, _UP).normalize();
    const w = width(u);
    const h = height(u);
    for (let k = 0; k <= ring; k++) {
      const th = -Math.PI / 2 + (k / ring) * Math.PI;
      const sx = Math.sin(th) * w;
      const sy = Math.pow(Math.max(0, Math.cos(th)), 0.55) * h;
      pos.setXYZ(n, _P.x + _S.x * sx, _P.y + lift + sy, _P.z + _S.z * sx);
      uv.setXY(n, k / ring, u);
      n++;
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

/** A glacier tongue lofted along a curve (see writeTongue). */
function tongueGeometry(curve: THREE.Curve<THREE.Vector3>, segs: number, ring: number, width: (u: number) => number, height: (u: number) => number, from = 0, to = 1, lift = 0): THREE.BufferGeometry {
  const count = (segs + 1) * (ring + 1);
  const idx: number[] = [];
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * (ring + 1) + k;
      const b = a + ring + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  geo.setIndex(idx);
  writeTongue(geo, curve, segs, ring, from, to, width, height, lift);
  return geo;
}

/** Bare valley floor the ice leaves behind: outwash gravel, braided meltwater streams, first plants. */
function valleyTexture(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 128, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, '#5d6a52');
    g.addColorStop(0.25, '#8d8c80');
    g.addColorStop(0.5, '#a19d90');
    g.addColorStop(0.75, '#8d8c80');
    g.addColorStop(1, '#5d6a52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 512);
    const r = rng(31);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = ['rgba(60,56,64,0.5)', 'rgba(200,196,186,0.5)', 'rgba(88,120,72,0.45)'][i % 3];
      ctx.fillRect(r() * 128, r() * 512, 2, 2);
    }
    ctx.strokeStyle = 'rgba(120,200,240,0.85)';
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = 3 - k * 0.6;
      ctx.beginPath();
      for (let y = 0; y <= 512; y += 8) ctx.lineTo(64 + Math.sin(y * 0.035 + k * 2.1) * (14 + k * 8), y);
      ctx.stroke();
    }
  });
}

/** Glacier ice: dirty moraine edges, white-blue middle, crevasses and flow bands. */
function iceTexture(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 256, 1024, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, '#6f7488');
    g.addColorStop(0.1, '#a9c6e2');
    g.addColorStop(0.3, '#e6f6ff');
    g.addColorStop(0.5, '#f4fbff');
    g.addColorStop(0.7, '#e6f6ff');
    g.addColorStop(0.9, '#a9c6e2');
    g.addColorStop(1, '#6f7488');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 1024);
    // ogives: gentle light and dark bands across the flow
    for (let y = 0; y < 1024; y += 64) {
      ctx.fillStyle = 'rgba(120,170,220,0.16)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(128, y + 36, 256, y);
      ctx.lineTo(256, y + 18);
      ctx.quadraticCurveTo(128, y + 54, 0, y + 18);
      ctx.closePath();
      ctx.fill();
    }
    // crevasses
    const r = rng(77);
    ctx.strokeStyle = 'rgba(40,96,160,0.75)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const y = r() * 1024;
      const x = 30 + r() * 196;
      const l = 14 + r() * 26;
      ctx.lineWidth = 1.5 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x - l, y - 4);
      ctx.quadraticCurveTo(x, y + 6, x + l, y - 4);
      ctx.stroke();
    }
    // medial moraine stripe
    ctx.fillStyle = 'rgba(90,86,104,0.35)';
    for (let y = 0; y < 1024; y += 6) ctx.fillRect(124 + Math.sin(y * 0.03) * 6, y, 6, 4);
  });
}

const clockSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  kit.sky('#22346a', '#03060f');
  kit.ground('#18233f', 34);

  // Soft snow drifts on the ground (flattened, matte)
  const driftMat = kit.track(new THREE.MeshStandardMaterial({ color: '#5a6f96', roughness: 0.95 }));
  const driftGeo = new THREE.SphereGeometry(1, 20, 10);
  const drifts: [number, number, number, number][] = [
    [-4.4, -5.3, 0.9, 0.5], [-8.6, -2.5, 1.4, 0.8], [-7.7, -0.5, 0.6, 0.9], [-7.6, 3.4, 1.2, 0.8],
    [4.4, -5.2, 0.9, 0.5], [8.2, -3.6, 1.3, 0.8], [4.3, 2.9, 0.6, 0.8], [7.4, 3.9, 1.2, 0.7],
  ];
  for (const [x, z, s, e] of drifts.slice(0, kit.n(8))) {
    const d = new THREE.Mesh(driftGeo, driftMat);
    d.position.set(x, gy - 0.02, z);
    d.scale.set(s, s * 0.3, s * e);
    d.receiveShadow = true;
    kit.add(d);
  }

  // ---- Left: the Glacier Clocktower, with the glacier flowing through its arch
  const tower = new THREE.Group();
  tower.position.set(-5.5, gy, -1.6);
  tower.rotation.y = 0.47;
  const stoneMat = kit.track(new THREE.MeshStandardMaterial({ map: stoneTexture(kit), roughness: 0.85, color: '#cfd9ee' }));
  for (const sx of [-0.78, 0.78]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 1.7), stoneMat);
    pillar.position.set(sx, 0.5, 0);
    pillar.castShadow = true;
    tower.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.3, 1.8), stoneMat);
  lintel.position.y = 1.15;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.6), stoneMat);
  shaft.position.y = 2.2;
  shaft.castShadow = true;
  const trimMat = kit.mats.paintedMetal('#2c3b62');
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.12, 1.84), trimMat);
  cornice.position.y = 3.14;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.24, 0.95, 4), kit.mats.paintedMetal('#31508a'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.67;
  tower.add(lintel, shaft, cornice, roof);
  const face = new THREE.Group();
  // Stand the face proud of the shaft so its tilted top edge is not buried in the stone.
  face.position.set(0, 2.24, 0.95);
  face.rotation.x = -0.16;
  const dialTex = dialTexture(kit);
  const dialMat = kit.track(new THREE.MeshStandardMaterial({ map: dialTex, emissive: '#fff1d0', emissiveMap: dialTex, emissiveIntensity: 0.12, roughness: 0.5 }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.64, 48), dialMat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 10, 64), kit.mats.brass());
  const hourGeo = new THREE.BoxGeometry(0.06, 0.34, 0.025);
  hourGeo.translate(0, 0.14, 0);
  const minGeo = new THREE.BoxGeometry(0.04, 0.52, 0.025);
  minGeo.translate(0, 0.22, 0);
  const handMat = kit.mats.paintedMetal('#1c1a2a');
  const hourHand = new THREE.Mesh(hourGeo, handMat);
  hourHand.position.z = 0.03;
  const minHand = new THREE.Mesh(minGeo, handMat);
  minHand.position.z = 0.05;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 16), kit.mats.brass());
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.07;
  face.add(disc, rim, hourHand, minHand, cap);
  tower.add(face);
  const lampMat = kit.track(new THREE.MeshStandardMaterial({ color: '#201a10', emissive: GOLD, emissiveIntensity: 0.1 }));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), lampMat);
  lamp.position.y = 4.24;
  tower.add(lamp);
  kit.add(tower);
  const gearA = kit.gear([0, 0, 0], 0.4, 14, BRASS, 0.08);
  const gearB = kit.gear([0, 0, 0], 0.26, 10, '#c79a52', 0.08);
  gearA.position.set(0.82, 1.95, 0.2);
  gearA.rotation.y = Math.PI / 2;
  gearB.position.set(0.83, 2.5, -0.4);
  gearB.rotation.y = Math.PI / 2;
  tower.add(gearA, gearB);

  // The glacier: one lofted tongue of ice from the mountains, squeezing through the arch, to its snout
  const flow = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9.5, gy + 0.55, -7.3), new THREE.Vector3(-7.5, gy + 0.18, -4.4), new THREE.Vector3(-5.5, gy, -1.6),
    new THREE.Vector3(-4.75, gy, 1.2), new THREE.Vector3(-4.55, gy, 3.2), new THREE.Vector3(-4.7, gy - 0.02, 4.4),
  ]);
  const ARCH = 0.505;
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const valleyW = (u: number) => (u < ARCH ? 0.46 + 0.95 * smooth(0, 0.3, ARCH - u) : 0.46 + 0.5 * smooth(0, 0.18, u - ARCH));
  // Time-lapse: the snout retreats up the valley as the missions advance represented time.
  let iceEnd = 1;
  const snout = (u: number) => 1 - smooth(iceEnd - 0.09, iceEnd, u) * 0.85;
  const width = (u: number) => valleyW(u) * snout(u);
  const height = (u: number) => (0.22 + 0.42 * (1 - u) + 0.08 * Math.sin(u * 18)) * snout(u);
  const iceTex = iceTexture(kit);
  const iceMat = kit.track(new THREE.MeshPhysicalMaterial({ map: iceTex, color: '#a9c6e4', roughness: 0.42, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: '#4c8fd0', emissiveMap: iceTex, emissiveIntensity: 0.03, side: THREE.DoubleSide }));
  const glacierGeo = kit.track(tongueGeometry(flow, 80, 16, width, height));
  const glacier = new THREE.Mesh(glacierGeo, iceMat);
  glacier.castShadow = true;
  glacier.receiveShadow = true;
  kit.add(glacier);
  // The valley floor the ice uncovers (hidden under the ice until it retreats).
  const floorMat = kit.track(new THREE.MeshStandardMaterial({ map: valleyTexture(kit), color: '#9a9a92', roughness: 0.95 }));
  const floorGeo = kit.track(tongueGeometry(flow, 40, 8, (u) => valleyW(u) * 1.12, () => 0.012, 0.5, 1, 0.006));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  kit.add(floor);
  const mountain = kit.rock([-9.6, gy + 0.2, -7.6], 1.6, '#3a4562', 7);
  mountain.scale.set(1.3, 0.8, 1.1);
  // seracs (ice crystals) ride on the ice margins; moraines (rock the ice drops) stay behind
  const tmp = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const seracs: { mesh: THREE.Mesh & { setLit(v: number): void }; u: number }[] = [];
  for (let i = 0; i < kit.n(6); i++) {
    const u = 0.12 + (i / 6) * 0.78;
    flow.getPointAt(u, tmp);
    flow.getTangentAt(u, tan);
    const side = i % 2 ? 1 : -1;
    const w = valleyW(u) + 0.18;
    seracs.push({ u, mesh: kit.crystal([tmp.x + tan.z * w * side, tmp.y + 0.22, tmp.z - tan.x * w * side], 0.16 + (i % 3) * 0.05, i % 3 ? ICE : '#c9b8ff', 60 + i) });
  }
  for (let i = 0; i < kit.n(12); i++) {
    const u = 0.15 + (i / 12) * 0.82;
    flow.getPointAt(u, tmp);
    flow.getTangentAt(u, tan);
    const side = i % 2 ? 1 : -1;
    const w = valleyW(u) * 1.12 + 0.08;
    kit.rock([tmp.x + tan.z * w * side, gy + 0.03, tmp.z - tan.x * w * side], 0.09 + (i % 4) * 0.04, '#7d7488', 80 + i);
  }
  for (let i = 0; i < kit.n(5); i++) kit.rock([-5.2 + i * 0.28, gy + 0.03, 4.85 + Math.sin(i * 1.7) * 0.12], 0.1 + (i % 2) * 0.06, '#8c8296', 130 + i);
  // Meltwater lake dammed by the terminal moraine, growing as the ice pulls back
  const lakeMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#1f5d8f', roughness: 0.12, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0, emissive: '#3fa0d8', emissiveIntensity: 0.02 }));
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40), lakeMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.y = gy + 0.03;
  lake.visible = false;
  kit.add(lake);
  // Conifers return to the uncovered valley (one instanced mesh for crowns, one for trunks)
  const treeCount = kit.n(16);
  const crownGeo = kit.track(new THREE.ConeGeometry(0.16, 0.5, 7));
  crownGeo.translate(0, 0.37, 0);
  const trunkGeo = kit.track(new THREE.CylinderGeometry(0.025, 0.035, 0.14, 6));
  trunkGeo.translate(0, 0.07, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, kit.mats.plastic('#2f6b52'), treeCount);
  const trunks = new THREE.InstancedMesh(trunkGeo, kit.mats.plastic('#5b3a24'), treeCount);
  crowns.castShadow = true;
  kit.add(crowns);
  kit.add(trunks);
  const trees: { x: number; z: number; u: number; s: number; early: boolean }[] = [];
  const tr = rng(57);
  for (let i = 0; i < treeCount; i++) {
    const early = i % 3 === 0;
    const u = early ? 0.6 + tr() * 0.32 : 0.68 + tr() * 0.11;
    flow.getPointAt(u, tmp);
    flow.getTangentAt(u, tan);
    const side = i % 2 ? 1 : -1;
    const w = valleyW(u) * (early ? 1.3 + tr() * 0.35 : 0.15 + tr() * 0.75);
    trees.push({ x: tmp.x + tan.z * w * side, z: tmp.z - tan.x * w * side, u, s: 0.65 + tr() * 0.6, early });
  }
  const dummy = new THREE.Object3D();
  const placeTrees = (level: number) => {
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const grow = kit.stage(level, t.early ? 2.4 : 3.1, t.early ? 3.4 : 4) * (t.u > iceEnd + 0.03 ? 1 : 0);
      dummy.position.set(t.x, gy, t.z);
      dummy.scale.setScalar(Math.max(0.0001, grow * t.s));
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
      trunks.setMatrixAt(i, dummy.matrix);
    }
    crowns.instanceMatrix.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
  };
  // A time-lapse plaque by the old ice edge: the represented time, never arcade time
  const lapseTex = canvasTex(kit, 512, 640, (ctx) => {
    const rows = ['ABOUT 20,000 YEARS AGO', 'ABOUT 15,000 YEARS AGO', 'ABOUT 10,000 YEARS AGO', 'ABOUT 5,000 YEARS AGO', 'TODAY'];
    rows.forEach((row, i) => {
      const y0 = i * 128;
      ctx.fillStyle = '#0e1a36';
      ctx.fillRect(0, y0, 512, 128);
      ctx.strokeStyle = '#e8c47a';
      ctx.lineWidth = 6;
      ctx.strokeRect(5, y0 + 5, 502, 118);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#9fe3ff';
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText('ONE VALLEY · TIME-LAPSE', 256, y0 + 36, 480);
      ctx.fillStyle = i === 4 ? '#ffc75b' : '#fff7e4';
      ctx.font = `800 ${i === 4 ? 56 : 42}px ${FONT}`;
      ctx.fillText(row, 256, y0 + 84, 480);
    });
  });
  lapseTex.repeat.set(1, 0.2);
  lapseTex.offset.set(0, 0.8);
  const lapseMat = kit.track(new THREE.MeshStandardMaterial({ map: lapseTex, emissive: '#ffffff', emissiveMap: lapseTex, emissiveIntensity: 0.25, roughness: 0.6 }));
  const lapse = new THREE.Group();
  const lapseFace = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.31), lapseMat);
  lapseFace.position.z = 0.03;
  const lapseBack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.37, 0.05), kit.mats.brass());
  lapse.add(lapseBack, lapseFace);
  lapse.position.set(-6.25, gy + 0.5, 3.3);
  lapse.rotation.set(-0.7, 0.3, 0, 'YXZ');
  kit.add(lapse);
  kit.pole([-6.25, 0, 3.22], gy + 0.36, '#c9b8e8');
  let lastLevel = -1;
  let lastStep = -1;
  const applyTimeLapse = (level: number) => {
    if (Math.abs(level - lastLevel) < 0.004) return;
    lastLevel = level;
    const c = (v: number) => Math.max(0, Math.min(1, v));
    iceEnd = 1 - 0.07 * c(level) - 0.08 * c(level - 1) - 0.1 * c(level - 2) - 0.11 * c(level - 3);
    writeTongue(glacierGeo, flow, 80, 16, 0, iceEnd, width, height);
    for (const sr of seracs) sr.mesh.visible = sr.u < iceEnd - 0.05;
    // A slim lake behind the terminal moraine, kept clear of the front-left lantern pole.
    const from = Math.max(iceEnd + 0.04, 0.8);
    const to = 0.92;
    lake.visible = to - from > 0.012;
    if (lake.visible) {
      flow.getPointAt((from + to) / 2, tmp);
      lake.position.x = tmp.x;
      lake.position.z = tmp.z;
      lake.scale.set(0.36 + 0.16 * c((to - from) / 0.1), ((to - from) * 13.2) / 2 * 0.85, 1);
    }
    lakeMat.opacity = 0.8 * c((to - from) / 0.05);
    placeTrees(level);
    const step = Math.max(0, Math.min(4, Math.round(level)));
    if (step !== lastStep) {
      lastStep = step;
      lapseTex.offset.y = (4 - step) / 5;
    }
  };
  applyTimeLapse(0);

  // ---- Right: the Time-Scale Windows gallery (the same kind of place at three time scales)
  const gallery = new THREE.Group();
  gallery.position.set(5.65, gy, -2.75);
  gallery.rotation.y = -0.6;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4.05, 2.3, 0.3), stoneMat);
  wall.position.y = 1.15;
  wall.castShadow = true;
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.14, 0.48), trimMat);
  ledge.position.y = 2.34;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.25, 0.16, 0.5), trimMat);
  plinth.position.y = 0.08;
  gallery.add(wall, ledge, plinth);
  const scenes: [Scene, string, string][] = [
    ['rockfall', 'ROCKFALL', 'SECONDS'],
    ['glacier', 'GLACIER VALLEY', '10,000s OF YEARS'],
    ['canyon', 'RIVER CANYON', 'MILLIONS OF YEARS'],
  ];
  const windowMats: THREE.MeshStandardMaterial[] = [];
  scenes.forEach(([scene, cap0, cap1], i) => {
    const tex = windowTexture(kit, scene, cap0, cap1);
    const mat = kit.track(new THREE.MeshStandardMaterial({ map: tex, color: '#55607a', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.02, transparent: true, alphaTest: 0.4, roughness: 0.4 }));
    windowMats.push(mat);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.7), mat);
    pane.position.set(-1.3 + i * 1.3, 1.15, 0.16);
    gallery.add(pane);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.07, 0.2), kit.mats.brass());
    sill.position.set(-1.3 + i * 1.3, 0.28, 0.22);
    gallery.add(sill);
  });
  kit.add(gallery);
  const title = kit.neonSign('GLACIER CLOCKTOWER', [5.55, 2.72, -2.6], { height: 0.44, color: GOLD, rotY: -0.6 });
  title.rotation.x = -0.3;

  // ---- Right front: hoodoos (the same processes carve the same shapes all over the world)
  const hoodooMats = ['#d98a5a', '#e8b07a', '#c47248', '#efc28e'].map((c) => kit.mats.plastic(c));
  const capMat = kit.mats.plastic('#5d4c48');
  const hoodoos: [number, number, number][] = [[4.5, 1.75, 1.15], [5.2, 1.05, 1.5], [5.9, 2.0, 1.0]];
  for (const [hx, hz, hh] of hoodoos) {
    const segs = 4;
    for (let k = 0; k < segs; k++) {
      const rad = 0.19 + 0.07 * Math.sin(k * 1.7 + hx);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.85, rad, hh / segs, 12), hoodooMats[(k + Math.round(hx * 3)) % 4]);
      seg.position.set(hx, gy + (hh / segs) * (k + 0.5), hz);
      seg.castShadow = true;
      kit.add(seg);
    }
    const capRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), capMat);
    capRock.scale.set(1.2, 0.45, 1.1);
    capRock.position.set(hx, gy + hh + 0.07, hz);
    capRock.castShadow = true;
    kit.add(capRock);
  }
  const keySign = neonPanel(kit, ['THE PRESENT IS', 'THE KEY TO THE PAST'], [5.2, 1.42, 0.55], 1.6, '#ffd98a', -0.5);
  keySign.group.rotation.x = -0.45;
  keySign.group.updateMatrix();
  for (const sx of [-0.62, 0.62]) {
    // posts meet the sign's lower corners
    const foot = new THREE.Vector3(sx, -0.3, -0.03).applyMatrix4(keySign.group.matrix);
    kit.pole([foot.x, 0, foot.z], foot.y);
  }

  // ---- An hourglass whose sand piles up as the time-lapse runs
  const hg = new THREE.Group();
  hg.position.set(-4.55, gy, -4.6);
  const glassProfile: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const v = i / 16;
    glassProfile.push(new THREE.Vector2(0.06 + 0.26 * Math.pow(Math.abs(v - 0.5) * 2, 1.4), v * 1.05));
  }
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 28), kit.mats.clearPlastic('#e8f6ff', 0.28));
  glass.position.y = 0.1;
  const plateGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.07, 24);
  const plateA = new THREE.Mesh(plateGeo, kit.mats.wood());
  plateA.position.y = 0.05;
  const plateB = new THREE.Mesh(plateGeo, kit.mats.wood());
  plateB.position.y = 1.19;
  const sandMat = kit.track(new THREE.MeshStandardMaterial({ color: SAND, emissive: SAND, emissiveIntensity: 0.05, roughness: 0.8 }));
  const sandTop = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.34, 24), sandMat);
  sandTop.rotation.x = Math.PI;
  sandTop.position.y = 0.86;
  const sandBot = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.32, 24), sandMat);
  sandBot.position.y = 0.27;
  hg.add(glass, plateA, plateB, sandTop, sandBot);
  kit.add(hg);

  // ---- Lanterns and string lights along the paths
  kit.pole([-4.3, 0, 4.3], 2.1);
  kit.pole([-7.0, 0, 0.9], 2.8);
  kit.pole([4.3, 0, 4.3], 2.1);
  kit.pole([7.0, 0, 1.7], 2.8);
  const lightsL = kit.stringLights([-7.0, 2.75, 0.9], [-4.3, 2.05, 4.3], 0.35, kit.n(10), [GOLD, ICE, IVORY]);
  const lightsR = kit.stringLights([7.0, 2.75, 1.7], [4.3, 2.05, 4.3], 0.35, kit.n(10), [GOLD, ICE, IVORY]);
  // Two signposts at the front corners: the slow glacier side and the fast rockfall side
  const slowSign = kit.neonSign('SLOW · MILLENNIA', [-4.95, 2.55, 4.2], { height: 0.27, color: ICE, rotY: 0.32 });
  slowSign.rotation.x = -0.55;
  const fastSign = kit.neonSign('FAST · SECONDS', [4.95, 2.55, 4.2], { height: 0.26, color: ROSE, rotY: -0.32 });
  fastSign.rotation.x = -0.55;

  // ---- Right front: a rockfall frozen mid-tumble (the sudden side of the clock)
  const cliff = kit.rock([5.75, gy + 0.4, 3.75], 0.62, '#5e5163', 211);
  cliff.scale.set(0.85, 1.6, 0.75);
  const boulders: THREE.Mesh[] = [];
  for (let i = 0; i < kit.n(6); i++) {
    const b = kit.rock([5.3 - i * 0.2, gy + 0.5 - i * 0.1 + (i % 2) * 0.07, 3.85 + (i % 3) * 0.18], 0.07 + (i % 3) * 0.04, i % 2 ? '#8b7a84' : '#6f6070', 220 + i);
    boulders.push(b);
  }
  const dust = kit.motes({ x0: 4.3, x1: 5.6, y0: -0.3, y1: 0.8, z0: 3.5, z1: 4.6 }, 30, '#f0d6c0', { speed: 0.12, size: 0.14 });
  const lanterns = [kit.lantern([-4.3, 2.26, 4.3], ICE, 0.15), kit.lantern([4.3, 2.26, 4.3], GOLD, 0.15)];

  // ---- Top corners: ice crystal clusters
  const corner: { setLit(v: number): void }[] = [];
  // Alternate sides so both corners keep crystals when kit.n() trims the count.
  for (let i = 0; i < kit.n(6); i++) {
    const sx = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    corner.push(kit.crystal([sx * (4.6 + k * 0.42), gy + 0.22, -5.4 + k * 0.28], 0.18 + k * 0.05, k % 2 ? ICE : VIOLET, 120 + i));
  }

  // ---- Aurora ribbons low over the far corners (a gentle Wonderlight glow, never a wash)
  const auroraTex = canvasTex(kit, 64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(160,140,255,0)');
    g.addColorStop(0.4, 'rgba(160,140,255,0.35)');
    g.addColorStop(0.75, 'rgba(124,255,178,0.55)');
    g.addColorStop(1, 'rgba(124,255,178,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
  });
  const auroraMat = kit.track(new THREE.MeshBasicMaterial({ map: auroraTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const curtains: { geo: THREE.PlaneGeometry; base: Float32Array }[] = [];
  for (const sx of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(4.6, 1.5, 30, 1);
    const mesh = new THREE.Mesh(geo, auroraMat);
    mesh.position.set(sx * 7.6, 1.7, -4.6);
    mesh.rotation.y = sx * -0.35;
    mesh.renderOrder = 4;
    kit.add(mesh);
    curtains.push({ geo, base: Float32Array.from((geo.attributes.position as THREE.BufferAttribute).array as Float32Array) });
  }
  let auroraLit = 0;
  kit.animate((t) => {
    if (auroraLit <= 0.01) return;
    for (const c of curtains) {
      const p = c.geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = c.base[i * 3];
        p.setZ(i, Math.sin(x * 1.1 + t * 0.7) * 0.35 + Math.sin(x * 2.6 - t * 1.1) * 0.1);
      }
      p.needsUpdate = true;
    }
  });

  // ---- Snowfall at the sides, ice sparkle over the glacier, three lights
  const snowL = kit.motes({ x0: -11, x1: -3.9, y0: -0.3, y1: 5, z0: -8, z1: 6 }, 70, SNOW, { speed: 0.16, size: 0.07, rise: false });
  const snowR = kit.motes({ x0: 3.9, x1: 11, y0: -0.3, y1: 5, z0: -8, z1: 6 }, 70, SNOW, { speed: 0.16, size: 0.07, rise: false });
  const sparkle = kit.motes({ x0: -7.4, x1: -4.0, y0: -0.2, y1: 1.2, z0: -4.5, z1: 4.5 }, 60, ICE, { speed: 0.08, size: 0.15 });
  kit.spot([-3.2, 6.2, 2.4], [-5.9, 1.4, -1.6], '#ffd9a0', 30, 0.5);
  kit.spot([3.2, 6.2, 2.4], [5.6, 1.0, -2.2], '#cfe9ff', 28, 0.55);
  kit.point([-4.9, 1.6, 1.0], '#9fe3ff', 1.0, 4);

  // Ice-sparkle bursts over both sides once the Wonderlight is earned
  const burstsL = kit.fireworks({ x0: -7.4, x1: -5.6, y0: 2.4, y1: 3.0, z: -0.6 }, [ICE, AURORA, VIOLET, GOLD]);
  const burstsR = kit.fireworks({ x0: 5.6, x1: 7.4, y0: 2.6, y1: 3.2, z: 0.4 }, [GOLD, ICE, AURORA, VIOLET]);

  let minuteAngle = 0;
  let hourAngle = 0;
  let gearAngle = 0;
  let celebrateBoost = 0;
  const dark = new THREE.Color('#55607a');
  const gravel = new THREE.Color('#9a9a92');
  const meadow = new THREE.Color('#7f9d70');
  const white = new THREE.Color('#ffffff');
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.7);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      // The time-lapse clock runs faster as the missions advance represented time.
      if (!kit.reducedMotion) {
        const rate = 0.25 + 1.2 * s1 + 2.5 * s3 + 4 * s4 + celebrateBoost * 8;
        minuteAngle -= dt * rate;
        hourAngle -= (dt * rate) / 12;
        gearAngle += dt * (0.2 + 0.6 * s1 + 1.2 * s4 + celebrateBoost * 3);
      } else {
        minuteAngle = -level * 1.4;
        hourAngle = -level * 0.5;
      }
      minHand.rotation.z = minuteAngle;
      hourHand.rotation.z = hourAngle;
      gearA.rotation.x = gearAngle;
      gearB.rotation.x = -gearAngle * 1.55;
      dialMat.emissiveIntensity = 0.08 + 0.26 * s1 + 0.08 * s4 + 0.16 * celebrateBoost;
      lampMat.emissiveIntensity = 0.1 + 2.4 * s0 * (0.85 + 0.15 * energy);
      for (let i = 0; i < windowMats.length; i++) {
        const w = kit.stage(level, 0.4 + i * 0.95, 1.1 + i * 0.95);
        windowMats[i].color.copy(dark).lerp(white, w);
        windowMats[i].emissiveIntensity = 0.02 + 0.34 * w;
      }
      iceMat.emissiveIntensity = 0.03 + 0.08 * s2 + 0.16 * s4 + 0.12 * celebrateBoost;
      applyTimeLapse(level);
      for (let i = 0; i < seracs.length; i++) seracs[i].mesh.setLit(Math.max(0.1, kit.stage(level, 0.8 + i * 0.3, 1.6 + i * 0.3)) * (0.85 + 0.15 * energy));
      floorMat.color.copy(gravel).lerp(meadow, kit.stage(level, 2.5, 4));
      lapseMat.emissiveIntensity = 0.25 + 0.35 * s1 + 0.3 * celebrateBoost;
      for (let i = 0; i < corner.length; i++) corner[i].setLit(0.15 + 0.85 * s2);
      lakeMat.emissiveIntensity = 0.02 + 0.1 * s4;
      sandTop.scale.setScalar(Math.max(0.05, 1 - 0.22 * level));
      sandBot.scale.setScalar(0.25 + 0.19 * level);
      sandMat.emissiveIntensity = 0.05 + 0.3 * s4;
      title.setLit(0.15 + 0.85 * s1);
      keySign.setLit(0.1 + 0.9 * s3);
      lightsL.setLit(0.25 + 0.75 * s0);
      lightsR.setLit(0.25 + 0.75 * s0);
      for (let i = 0; i < lanterns.length; i++) lanterns[i].setLit(0.2 + 0.8 * s1);
      slowSign.setLit(0.15 + 0.85 * s2);
      fastSign.setLit(0.15 + 0.85 * s2);
      dust.setLit(0.1 + 0.5 * s1 + 0.3 * energy);
      if (!kit.reducedMotion) for (let i = 0; i < boulders.length; i++) boulders[i].rotation.z = t * (0.4 + i * 0.15) * (0.3 + s1);
      snowL.setLit(0.35 + 0.2 * s2);
      snowR.setLit(0.35 + 0.2 * s2);
      sparkle.setLit(0.1 + 0.5 * s2 + 0.3 * s4);
      auroraLit = 0.15 * s3 + 0.55 * s4 + 0.3 * celebrateBoost;
      auroraMat.opacity = Math.min(0.75, auroraLit);
      const bursts = Math.max(kit.stage(level, 3.6, 4) * 0.7, celebrateBoost);
      burstsL.setLit(bursts);
      burstsR.setLit(bursts);
      celebrateBoost = Math.max(0, celebrateBoost - dt * 0.8);
    },
    celebrate(p) {
      celebrateBoost = Math.max(celebrateBoost, Math.sin(p * Math.PI));
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const clockRoom: RoomBuilder = ({ kit }) => {
  const stone = kit.mats.plastic('#5a6788');
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 0.42), stone);
  tower.position.set(-0.45, 0.48, -0.4);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.34, 4), kit.mats.paintedMetal('#31508a'));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(-0.45, 1.12, -0.4);
  const faceMat = kit.track(new THREE.MeshStandardMaterial({ color: '#fff1d0', emissive: '#fff1d0', emissiveIntensity: 0.1 }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), faceMat);
  face.position.set(-0.45, 0.72, -0.185);
  const handGeo = new THREE.BoxGeometry(0.018, 0.12, 0.01);
  handGeo.translate(0, 0.05, 0);
  const hand = new THREE.Mesh(handGeo, kit.mats.dark());
  hand.position.set(-0.45, 0.72, -0.17);
  const iceTex = iceTexture(kit);
  const iceMat = kit.track(new THREE.MeshPhysicalMaterial({ map: iceTex, color: '#c4dcf0', roughness: 0.4, clearcoat: 0.6, emissive: '#4c8fd0', emissiveMap: iceTex, emissiveIntensity: 0.04, side: THREE.DoubleSide }));
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(0.55, 0.0, -0.85), new THREE.Vector3(0.05, 0.0, -0.45), new THREE.Vector3(-0.35, 0.0, 0.05), new THREE.Vector3(-0.72, 0.0, 0.62)]);
  const ice = [new THREE.Mesh(tongueGeometry(path, 40, 10, (u) => (0.34 - 0.1 * u) * (1 - 0.8 * Math.max(0, (u - 0.9) / 0.1)), (u) => (0.14 - 0.06 * u) * (1 - 0.8 * Math.max(0, (u - 0.9) / 0.1))), iceMat)];
  const hoodoo = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.14, 10), kit.mats.plastic(['#d98a5a', '#e8b07a', '#c47248'][k]));
    seg.position.y = 0.07 + k * 0.14;
    hoodoo.add(seg);
  }
  const capRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), kit.mats.plastic('#5d4c48'));
  capRock.scale.y = 0.5;
  capRock.position.y = 0.47;
  hoodoo.add(capRock);
  hoodoo.position.set(0.6, 0, 0.2);
  for (const m of [tower, roof, face, hand, ...ice]) kit.add(m);
  kit.add(hoodoo);
  const crystals = [kit.crystal([0.25, 0.14, -0.45], 0.09, ICE, 3), kit.crystal([0.42, 0.12, -0.3], 0.07, VIOLET, 4)];
  const glow = kit.orb([-0.45, 1.33, -0.4], 0.05, GOLD);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.75, 7), kit.mats.plastic('#3a4562'));
  peak.position.set(0.55, 0.37, -0.7);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 7), kit.mats.plastic('#eef7ff'));
  cap.position.set(0.55, 0.6, -0.7);
  kit.add(peak);
  kit.add(cap);
  // pines on the ground the ice gave back, and a meltwater pond at the snout
  const pineMat = kit.mats.plastic('#2f6b52');
  for (const [x, z, h] of [[0.22, 0.42, 0.26], [0.4, 0.62, 0.2], [0.05, 0.7, 0.22]] as [number, number, number][]) {
    const pine = new THREE.Mesh(new THREE.ConeGeometry(h * 0.32, h, 7), pineMat);
    pine.position.set(x, h / 2, z);
    kit.add(pine);
  }
  const pondMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a6fa8', emissive: '#5fd0ff', emissiveIntensity: 0.05, roughness: 0.1 }));
  const pond = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.scale.set(1.2, 0.7, 1);
  pond.position.set(-0.5, 0.035, 0.78);
  kit.add(pond);
  return {
    update(t, lit) {
      faceMat.emissiveIntensity = 0.1 + 0.85 * lit;
      pondMat.emissiveIntensity = 0.05 + 0.4 * lit;
      iceMat.emissiveIntensity = 0.04 + 0.2 * lit;
      for (let i = 0; i < crystals.length; i++) crystals[i].setLit(lit);
      glow.setLit(lit);
      hand.rotation.z = kit.reducedMotion ? 0 : -t * (0.4 + 2 * lit);
    },
  };
};

// ---------------------------------------------------------------- the attraction

export const L11: TableDef = {
  lessonId: 'L11',
  signature: 'Clock hands that swing the Clock Lane to the fast side, the slow side or the Time Vault',
  ballRole: 'The Wonderball is a game token, not a boulder or a chunk of ice: real glacier ice usually creeps too slowly to see it move, so the big shots here are labeled with the time spans they stand for.',
  theme: {
    bg: ['#1C3158', '#0B1630'],
    rail: '#C4DCF2',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(244,248,255,0.12)',
    accent: '#FFB48F',
    accent2: ICE,
    bumperCap: '#E4F3FF',
    bumperRing: '#2B4B7A',
    flipper: '#F2E2BC',
    ink: IVORY,
    ramp: 'rgba(159,227,255,0.24)',
    trail: ICE,
  },
  lines: {
    intro: 'Welcome to the Glacier Clocktower! This glacier looks frozen in place, yet over many thousands of years ice like this can carve out a whole valley.',
    quark: '"That glacier hardly moves at all. Surely only big, fast events like landslides can really reshape the land?" Professor Quark wonders aloud.',
    pipTip: 'Pull the plunger back about a third of the way: a soft launch drops onto the ICE star for a skill shot.',
  },
  build,
  skillShot: 'skill_star',
  shots: [
    { id: 'glacier', label: 'Glacier Ramp', on: [{ type: 'ramp', id: 'glacier' }], insert: 'ins_glacier' },
    { id: 'clock', label: 'Clock Lane', on: [{ type: 'shot', id: 'clock_sw' }], insert: 'ins_clock' },
    { id: 'vault', label: 'Time Vault', on: [{ type: 'saucer', id: 'vault' }], insert: 'ins_vault' },
    { id: 'melt', label: 'Meltwater Channel', on: [{ type: 'shot', id: 'melt_sw' }], insert: 'ins_melt' },
    { id: 'slide', label: 'Landslide Lane', on: [{ type: 'shot', id: 'slide_sw' }], insert: 'ins_slide' },
    { id: 'timeBank', label: 'Time Ruler', on: [{ type: 'drop', group: 'timeScale' }], insert: 'ins_time' },
    { id: 'space', label: 'Space Ruler', on: [{ type: 'target', group: 'space' }], insert: 'ins_space' },
    { id: 'shapers', label: 'Shaper targets', on: [{ type: 'target', group: 'shapers' }], insert: 'ins_shapers' },
    { id: 'rockfall', label: 'Rockfall', on: [{ type: 'bumper', group: 'rockfall' }], insert: 'ins_rockfall' },
    { id: 'ice', label: 'Ice Field', on: [{ type: 'rollover', group: 'ice' }], insert: 'ins_ice' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Shapers of the Valley',
      brief: 'Spot four processes that reshape land on the Clock Lane targets, then shoot the Time Vault to name what you saw.',
      objectiveIds: ['L11-O1'],
      stages: [
        { kind: 'collect', text: 'Find all 4 shapers: WEATHER, ERODE, DEPOSIT, UPLIFT', match: { type: 'target', group: 'shapers' }, count: 4, distinct: true, lamps: ['shape_weather', 'shape_erode', 'shape_deposit', 'shape_uplift'], preview: ['shapers'] },
        { kind: 'discover', text: 'Shoot the Clock Lane into the Time Vault', pocket: 'vault', questions: 1 },
      ],
      discovery: 'Weathering breaks rock where it sits, erosion carries the pieces away, deposition drops them somewhere new, and uplift, usually very slowly, raises large areas of crust.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Two Rulers',
      brief: 'Measure change twice: hit the Space Ruler from MICRO to GLOBAL, then drop the Time Ruler from SECONDS to MILLENNIA.',
      objectiveIds: ['L11-O2'],
      stages: [
        { kind: 'collect', text: 'Space ruler: hit MICRO, HUMAN and GLOBAL', match: { type: 'target', group: 'space' }, count: 3, distinct: true, lamps: ['space_micro', 'space_human', 'space_global'], preview: ['space'] },
        { kind: 'collect', text: 'Time ruler: drop SECONDS, YEARS and MILLENNIA', match: { type: 'drop', group: 'timeScale' }, count: 3, distinct: true, lamps: ['time_bank_1', 'time_bank_2', 'time_bank_3'], preview: ['timeBank'] },
        { kind: 'discover', text: 'Chart both rulers in the Time Vault', pocket: 'vault', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'Size alone does not tell you speed. Dust from a big asteroid impact can cool the whole planet in days, while a cave formation smaller than a backpack takes thousands of years.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Sudden or Slow?',
      brief: 'The clock hands now pick a side. Set off sudden rockfalls and landslides, add up slow ice work, then predict what time will do.',
      objectiveIds: ['L11-O3', 'L11-O4'],
      stages: [
        { kind: 'collect', text: 'Sudden: set off 4 rockfalls or landslides', match: [{ type: 'bumper', group: 'rockfall' }, { type: 'spinner', id: 'landslide' }], count: 4, preview: ['clock', 'slide'] },
        { kind: 'collect', text: 'Slow sum: add up 3 ice moves (Ice Field or Glacier)', match: [{ type: 'rollover', group: 'ice' }, { type: 'ramp', id: 'glacier' }], count: 3, preview: ['clock', 'glacier'] },
        { kind: 'discover', text: 'Predict the future in the Time Vault', pocket: 'vault', questions: 1 },
      ],
      discovery: 'Sudden events like landslides take only minutes, but slow weathering often sets them up. Tiny changes repeated over many thousands of years add up to whole valleys.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Run the Time-Lapse',
    brief: 'The clock ticks between fast and slow with every Clock Lane shot. Make four lit shots, then bring the Wonderball home to the Time Vault.',
    stages: [
      { kind: 'shots', text: 'Run the time-lapse: make 4 lit shots', shots: ['glacier', 'clock', 'slide', 'melt', 'timeBank'], order: 'any', count: 4 },
      { kind: 'discover', text: 'Final reading in the Time Vault', pocket: 'vault', questions: 2 },
    ],
    celebration: 'The time-lapse runs twenty thousand years in one visit: the glacier melts back and reveals the wide U-shaped valley that slow ice work carved. The Wonderlight is yours!',
  },
  onProgress(rt, { slot, stage }) {
    const k = rt.find<ClockKeeper>('clock_keeper');
    if (!k) return;
    k.ticking = slot === 3 && stage === 0;
    k.want = k.ticking ? (k.want === 'vault' ? 'fast' : k.want) : routeFor(slot, stage);
  },
  scenery,
  set: clockSet,
  room: clockRoom,
};
export default L11;
