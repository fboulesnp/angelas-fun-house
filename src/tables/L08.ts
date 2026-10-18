// Lesson 8 — Investigating Rock Strata — "Canyon of Clues"
// A twilight canyon read like a book. Signature: the Strata Stack, four in-line drop targets in
// a slot canyon, so the oldest layer (1, nearest the flippers) must fall before the younger ones
// behind it can be reached. A Magma Dike ramp slices across the canyon, the Fault Lane's diverter
// slips open after the first discovery, matching fossil beds sit on both canyon walls, and every
// mission ends at the Core Sampler (the Wonder Pocket).

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Diverter, DropBank, DropTarget } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { TAU, drift, glowDot, mix, neonPath, neonText, rgba, rng, stage, stars, vgrad } from '../game/render/art.ts';

const NIGHT = '#120b26';
const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const MAGMA = '#FF6A2A';
const RIVER = '#3BB8C4';
const BONE = '#FFE9C4';
const BURST = [GOLD, CORAL, MINT];
const SPARK = [GOLD, MINT, CORAL];

/**
 * Rock layers from oldest (bottom) to youngest (top). The same sequence is used on the printed
 * walls, the Strata Stack, both 3D buttes and the dollhouse room, so matching layers really match.
 * Hues alternate the way real canyon walls do: colour is never a clue to age.
 */
const BANDS: { y0: number; y1: number; c: string }[] = [
  { y0: 740, y1: 1150, c: '#3a2433' }, // basement schist
  { y0: 692, y1: 740, c: '#6b3a3a' }, // dark mudstone
  { y0: 629, y1: 692, c: '#8a6a58' }, // brown sandstone
  { y0: 595, y1: 629, c: '#a3462e' }, // layer 1: rust sandstone
  { y0: 561, y1: 595, c: '#c9a46a' }, // layer 2: buff sandstone
  { y0: 527, y1: 561, c: '#7d5f78' }, // layer 3: mauve shale
  { y0: 493, y1: 527, c: '#d07a48' }, // layer 4: orange sandstone
  { y0: 440, y1: 493, c: '#b98d6a' }, // tan siltstone
  { y0: 385, y1: 440, c: '#9c4a3a' }, // red shale
  { y0: 330, y1: 385, c: '#d9c7a0' }, // pale limestone caprock (youngest)
];
const ROCKS = BANDS.map((b) => b.c);

// ---------------------------------------------------------------- geometry

/** In-line strata targets: they never rise while any ball is inside the stack lane. */
const STACK_BOX = { x0: 252, x1: 320, y0: 470, y1: 652 };
class StrataTarget extends DropTarget {
  tryRaise(): boolean {
    for (const b of this.rt.world.balls) {
      if (b.state === 'drained') continue;
      if (b.x > STACK_BOX.x0 && b.x < STACK_BOX.x1 && b.y > STACK_BOX.y0 && b.y < STACK_BOX.y1) return false;
    }
    return super.tryRaise();
  }
}

function strataStack(b: TableBuilder) {
  const rt = b.rt;
  const bank = rt.add(new DropBank(rt, 'strata', { group: 'strata' }));
  [612, 578, 544, 510].forEach((y, i) => {
    const t = rt.add(new StrataTarget(rt, `strata_${i + 1}`, 269, y, 303, y, { group: 'strata', label: String(i + 1) }));
    t.bank = bank;
    bank.targets.push(t);
  });
}

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'right' });

  // --- River Run: the left orbit (the river that carved the canyon) ---
  b.wall([[78, 606], [78, 392]], { id: 'river_inner', r: 3 });
  b.post(78, 388, 5);
  b.spinner('erosion_spinner', [29, 536], [73, 536], { label: 'EROSION' });
  b.shotSwitch('river_sw', 51, 470, -90);
  // Return guide: a ball coming back down the river is steered into the left inlane. It is a
  // one-way gate, so flipper shots up the river pass through it instead of bouncing off.
  b.gate('river_deflect', [FRAME.left, 618], [58, 668], -90);

  // --- Fault Lane: right channel. The fault diverter closes its top until the fault slips. ---
  b.wall([[494, 606], [494, 400]], { id: 'fault_inner', r: 3 });
  b.post(494, 396, 5);
  b.shotSwitch('fault_sw', 521, 486, -90);
  // One-way gate (not a wall): the right kickback fires straight up this column, through the
  // gate and up the Fault Lane, while balls coming down the lane are still steered to the inlane.
  b.gate('fault_deflect', [FRAME.laneSep, 618], [514, 668], -90);
  // position 0 = closed (blade up to the lane separator), position 1 = slipped open (along the wall)
  b.diverter('fault_diverter', [494, 396], 69, -41.5, 90);

  // --- Strata Stack: a slot canyon with four in-line layers (1 = oldest, nearest you) ---
  // A peaked cap closes the top so the last layer has a backstop and nothing can fall in.
  b.wall([[264, 640], [264, 494]], { id: 'stack_wall_l', r: 3, style: 'glass' });
  b.wall([[308, 640], [308, 494]], { id: 'stack_wall_r', r: 3, style: 'glass' });
  b.wall([[264, 494], [286, 480], [308, 494]], { id: 'stack_cap', r: 4 });
  b.wall([[248, 692], [264, 640]], { id: 'stack_flare_l', r: 3 });
  b.wall([[324, 692], [308, 640]], { id: 'stack_flare_r', r: 3 });
  strataStack(b);

  // --- Magma Dike ramp: climbs on the left, slices across the canyon, drops into the Fault Lane ---
  b.wall([[123, 676], [138, 612]], { r: 3 });
  b.wall([[209, 672], [172, 612]], { r: 3 });
  b.ramp('dike_ramp', {
    path: [[155, 612], [156, 500], [182, 414], [250, 372], [340, 350], [420, 344], [478, 350], [512, 380], [521, 430], [521, 470]],
    width: 34,
    footprintTo: 2,
    label: 'MAGMA DIKE',
  });

  // --- Core Sampler: the Wonder Pocket in a drill-rig cup on the right wall ---
  b.wall([[394, 534], [394, 488]], { r: 4 });
  b.wall([[446, 534], [446, 488]], { r: 4 });
  b.wall([[394, 488], [420, 476], [446, 488]], { r: 4 });
  b.saucer('core_sampler', 420, 510, { role: 'pocket', ejectDeg: 100, ejectSpeed: 760, label: 'CORE SAMPLER', icon: 'core' });

  // --- Fossil beds: the same fossils in the same layers on both canyon walls. Trilobites sit in
  // the lower (older) pair, ammonites in the higher (younger) pair, as fossil succession has it.
  b.target('fossil_tri_l', [215, 600], [243, 588], { group: 'fossils', label: 'TRILOBITE' });
  b.target('fossil_amm_l', [178, 566], [178, 522], { group: 'fossils', label: 'AMMONITE' });
  b.target('fossil_tri_r', [329, 588], [357, 600], { group: 'fossils', label: 'TRILOBITE' });
  b.target('fossil_amm_r', [490, 566], [490, 522], { group: 'fossils', label: 'AMMONITE' });

  // --- A-G-E lanes along the canyon rim ---
  ['A', 'G', 'E'].forEach((l, i) => b.rollover(`age_${i + 1}`, 150 + i * 46, 192, { group: 'age', label: l }));
  for (const gx of [127, 173, 219, 265]) {
    b.wall([[gx, 166], [gx, 214]], { r: 3 });
    b.post(gx, 164, 5);
  }

  // --- Rockfall: boulder bumpers where soft launches tumble off the rim ---
  b.bumper('boulder_a', 372, 236, { group: 'rockfall', r: 24, icon: 'rock' });
  b.bumper('boulder_b', 446, 206, { group: 'rockfall', r: 24, icon: 'rock' });
  b.bumper('boulder_c', 430, 284, { group: 'rockfall', r: 24, icon: 'rock' });
  b.rollover('rim_lane', 518, 314, { label: 'RIM', r: 18 });

  // --- Inserts that preview shots ---
  b.insert('ins_river', 51, 584, { deg: -90, label: 'RIVER' });
  b.insert('ins_fault', 521, 560, { deg: -90, label: 'FAULT' });
  b.insert('ins_stack', 286, 712, { deg: -90 });
  b.insert('ins_dike', 155, 704, { deg: -92, label: 'DIKE' });
  b.insert('ins_core', 420, 572, { deg: -90 });
  b.insert('ins_fossil', 286, 772, { shape: 'star', size: 11 });
  b.insert('ins_rockfall', 410, 160, { shape: 'star', size: 11 });
  b.insert('ins_age', 196, 238, { shape: 'star', size: 10 });
}

// ---------------------------------------------------------------- printed playfield

/** Canyon walls: x where each band (bottom to top) meets the open canyon on the left/right. */
const EDGE_L = [244, 232, 222, 214, 210, 204, 196, 182, 160, 140];
const EDGE_R = [332, 340, 350, 358, 362, 368, 376, 392, 412, 432];
/** The fault crosses the right wall from the rim and runs down the Fault Lane. */
const FAULT: [number, number][] = [[467, 330], [485, 470], [509, 600], [535, 740]];

function shade(c: string, level: number) {
  return mix(c, '#1a0f22', 0.5 - 0.17 * stage(level, 0, 3.2));
}

function canyonVoid(ctx: CanvasRenderingContext2D) {
  // Stepped walls: hard layers stand as cliffs, soft ones weather back into slopes.
  ctx.beginPath();
  ctx.moveTo(EDGE_L[9], 330);
  for (let i = 9; i >= 1; i--) {
    const y1 = BANDS[i].y1;
    if (i % 2 === 1) {
      ctx.lineTo(EDGE_L[i], y1);
      ctx.lineTo(EDGE_L[i - 1], y1);
    } else ctx.lineTo(EDGE_L[i - 1], y1);
  }
  ctx.lineTo(EDGE_L[0], 790);
  ctx.lineTo(262, 820);
  ctx.lineTo(310, 820);
  ctx.lineTo(EDGE_R[0], 790);
  ctx.lineTo(EDGE_R[0], 740);
  for (let i = 1; i <= 9; i++) {
    const y0 = BANDS[i].y0;
    if (i % 2 === 1) {
      ctx.lineTo(EDGE_R[i], BANDS[i].y1);
      ctx.lineTo(EDGE_R[i], y0);
    } else ctx.lineTo(EDGE_R[i], y0);
  }
  ctx.closePath();
}

function drawBands(ctx: CanvasRenderingContext2D, level: number, x0: number, x1: number, dy = 0) {
  const r = rng(31);
  BANDS.forEach((b, i) => {
    const y0 = b.y0 + dy;
    const y1 = (i === 0 ? 1150 : b.y1) + dy;
    ctx.fillStyle = shade(b.c, level);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // bedding lines and grain
    ctx.strokeStyle = 'rgba(20,10,24,0.28)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 3; k++) {
      ctx.beginPath();
      const yy = y0 + ((y1 - y0) * k) / 3 + (r() - 0.5) * 4;
      ctx.moveTo(x0, yy);
      for (let x = x0; x <= x1; x += 30) ctx.lineTo(x, yy + Math.sin(x * 0.05 + i) * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,240,220,0.05)';
    for (let k = 0; k < 40; k++) ctx.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 1.5, 1.5);
    // a thin bright top edge on each layer
    ctx.fillStyle = rgba(mix(b.c, '#ffffff', 0.35), 0.12 + 0.1 * stage(level, 0.5, 3));
    ctx.fillRect(x0, y0, x1 - x0, 1.5);
  });
}

function ammonite(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  if (lit > 0.01) glowDot(ctx, 0, 0, s * 2.4, GOLD, 0.45 * lit);
  ctx.strokeStyle = rgba(color, 0.35 + 0.65 * lit);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let a = 0; a < TAU * 2.6; a += 0.15) {
    const rr = s * Math.exp(-0.2 * (TAU * 2.6 - a)) * 1.0;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  for (let a = TAU * 1.2; a < TAU * 2.6; a += 0.42) {
    const rr = s * Math.exp(-0.2 * (TAU * 2.6 - a));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.55);
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    ctx.stroke();
  }
  ctx.restore();
}

function trilobite(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  if (lit > 0.01) glowDot(ctx, 0, 0, s * 2.2, GOLD, 0.45 * lit);
  ctx.strokeStyle = rgba(color, 0.35 + 0.65 * lit);
  ctx.fillStyle = rgba(color, 0.08 + 0.2 * lit);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.62, s, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -s * 0.62, s * 0.5, Math.PI, TAU);
  ctx.stroke();
  for (let k = -3; k <= 4; k++) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, k * s * 0.2);
    ctx.lineTo(s * 0.58, k * s * 0.2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.9);
  ctx.lineTo(-s * 0.2, s * 0.95);
  ctx.moveTo(s * 0.2, -s * 0.9);
  ctx.lineTo(s * 0.2, s * 0.95);
  ctx.stroke();
  ctx.restore();
}

function shell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  if (lit > 0.01) glowDot(ctx, 0, 0, s * 2, GOLD, 0.4 * lit);
  ctx.strokeStyle = rgba(color, 0.3 + 0.6 * lit);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(0, s * 0.4, s, Math.PI * 1.1, Math.PI * 1.9);
  ctx.lineTo(0, s * 0.4);
  ctx.closePath();
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (1.15 + k * 0.17);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.4);
    ctx.lineTo(Math.cos(a) * s, s * 0.4 + Math.sin(a) * s);
    ctx.stroke();
  }
  ctx.restore();
}

const RAMP_LINE: [number, number][] = [[155, 700], [155, 612], [156, 500], [182, 414], [250, 372], [340, 350], [420, 344], [478, 350], [512, 380], [521, 430], [521, 470]];

function smoothStroke(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

function paintCanyon(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1.1);
  const s2 = stage(level, 1.2, 2.1);
  const s3 = stage(level, 2.2, 3.1);
  const s4 = stage(level, 3.4, 4);

  // --- Twilight sky inside the arch ---
  ctx.fillStyle = vgrad(ctx, 0, 340, [[0, NIGHT], [0.45, '#22163f'], [0.8, mix('#4a2440', '#7a3a4a', s4)], [1, mix('#5a2a40', '#a0503c', 0.3 + 0.4 * s4)]]);
  ctx.fillRect(0, 0, 600, 340);
  stars(ctx, 81, 60 + Math.round(70 * stage(level, 0, 4)), [40, 24, 560, 240], IVORY);
  // crescent moon
  glowDot(ctx, 430, 96, 46, '#ffe7b0', 0.18 + 0.2 * s4);
  ctx.fillStyle = 'rgba(255,240,205,0.85)';
  ctx.beginPath();
  ctx.arc(430, 96, 17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1d1238';
  ctx.beginPath();
  ctx.arc(438, 90, 15, 0, TAU);
  ctx.fill();
  // distant mesas on the horizon, faintly banded
  const r = rng(12);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 340);
  let x = 0;
  while (x < 600) {
    const w = 50 + r() * 90;
    const h = 30 + r() * 70;
    ctx.lineTo(x + 8, 330 - h);
    ctx.lineTo(x + w - 8, 330 - h);
    ctx.lineTo(x + w, 330 - h * (0.2 + r() * 0.3));
    x += w;
  }
  ctx.lineTo(600, 340);
  ctx.closePath();
  ctx.fillStyle = mix('#2c1838', '#4a2236', s4 * 0.6);
  ctx.fill();
  ctx.clip();
  for (let y = 240; y < 340; y += 9) {
    ctx.fillStyle = `rgba(255,190,150,${0.03 + 0.03 * ((y / 9) % 2)})`;
    ctx.fillRect(0, y, 600, 4);
  }
  ctx.restore();

  // --- Strata walls (full width), then the fault offset on the right wall ---
  drawBands(ctx, level, 0, 600);
  const slip = 18 * stage(level, 0.35, 1.1);
  if (slip > 0.4) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(FAULT[0][0], FAULT[0][1]);
    for (const p of FAULT) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(600, 740);
    ctx.lineTo(600, 330);
    ctx.closePath();
    ctx.clip();
    drawBands(ctx, level, 440, 600, slip);
    // the dropped block leaves a small step (a fault scarp) at the rim
    ctx.fillStyle = mix('#2c1838', '#4a2236', s4 * 0.6);
    ctx.fillRect(440, 330, 160, slip);
    ctx.restore();
  }
  // rim line and scrub along the canyon edge
  ctx.fillStyle = 'rgba(30,18,36,0.6)';
  ctx.fillRect(0, 326, 600, 5);
  const rr = rng(5);
  for (let i = 0; i < 26; i++) {
    const bx = 30 + rr() * 540;
    if (bx > EDGE_L[9] - 4 && bx < EDGE_R[9] + 4) continue;
    ctx.fillStyle = 'rgba(40,60,44,0.8)';
    ctx.beginPath();
    ctx.arc(bx, 326 - rr() * 3, 3 + rr() * 4, 0, TAU);
    ctx.fill();
  }

  // --- The open canyon carved by the river (younger than every layer it cuts) ---
  ctx.save();
  canyonVoid(ctx);
  ctx.fillStyle = vgrad(ctx, 330, 820, [[0, mix('#24183c', '#3a2a58', s4)], [0.6, '#1a1230'], [1, '#13202c']]);
  ctx.fill();
  ctx.clip();
  // haze bands and a far wall glow
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(160,140,220,${0.025 + 0.012 * i})`;
    ctx.fillRect(0, 360 + i * 70, 600, 30);
  }
  drift(ctx, 44, 30, 0, IVORY, [150, 340, 430, 800], 0, 1.1, 0.18);
  ctx.restore();
  // stepped wall edges (lit gold at the Wonderlight)
  neonPath(ctx, () => canyonVoid(ctx), GOLD, s4, 2);

  // --- Basement rock and the river through the inner gorge ---
  ctx.save();
  ctx.strokeStyle = 'rgba(255,160,180,0.10)';
  ctx.lineWidth = 2;
  const vr = rng(8);
  for (let i = 0; i < 18; i++) {
    const vx = vr() * 600;
    const vy = 760 + vr() * 360;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.lineTo(vx + 40 + vr() * 50, vy - 30 - vr() * 30);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(262, 790);
  ctx.bezierCurveTo(250, 880, 200, 960, 150, 1150);
  ctx.lineTo(430, 1150);
  ctx.bezierCurveTo(380, 960, 322, 880, 310, 790);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 790, 1150, [[0, rgba(RIVER, 0.24 + 0.14 * s1)], [1, rgba('#1f6f8a', 0.38)]]);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = `rgba(220,255,250,${0.12 + 0.18 * s1})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    const wy = 800 + i * 22;
    ctx.beginPath();
    ctx.moveTo(150 + (i % 3) * 40, wy);
    ctx.quadraticCurveTo(286, wy + 8, 420 - (i % 2) * 40, wy);
    ctx.stroke();
  }
  ctx.restore();

  // --- River Run: the river spilling down the left orbit ---
  ctx.save();
  ctx.fillStyle = vgrad(ctx, 300, 700, [[0, rgba(RIVER, 0.2)], [0.5, rgba(RIVER, 0.38 + 0.2 * s1)], [1, rgba(RIVER, 0.5)]]);
  ctx.beginPath();
  ctx.moveTo(28, 300);
  ctx.lineTo(74, 300);
  ctx.lineTo(74, 610);
  ctx.quadraticCurveTo(80, 680, 110, 760);
  ctx.lineTo(60, 780);
  ctx.quadraticCurveTo(30, 690, 28, 620);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(230,255,250,${0.18 + 0.22 * s1})`;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 18; i++) {
    const fy = 310 + i * 22;
    ctx.beginPath();
    ctx.moveTo(34 + (i % 3) * 8, fy);
    ctx.lineTo(40 + (i % 3) * 8, fy + 14);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(51, 500);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '700 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(IVORY, 0.55 + 0.35 * s1);
  ctx.fillText('EROSION', 0, 0);
  ctx.restore();

  // --- Magma dike under the ramp: an intrusion that cuts across the layers ---
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  smoothStroke(ctx, RAMP_LINE);
  ctx.strokeStyle = 'rgba(42,26,34,0.85)';
  ctx.lineWidth = 30;
  ctx.stroke();
  smoothStroke(ctx, RAMP_LINE);
  ctx.strokeStyle = mix('#3c2a30', '#7a2c18', s2);
  ctx.lineWidth = 22;
  ctx.stroke();
  if (s2 > 0.01) {
    // The glowing dike shows only in the rock walls: the canyon is younger and cut it away too.
    canyonVoid(ctx); // starts a new path
    ctx.rect(0, 0, 600, 1150);
    ctx.clip('evenodd');
    ctx.shadowColor = MAGMA;
    ctx.shadowBlur = 16 * s2;
    smoothStroke(ctx, RAMP_LINE);
    ctx.strokeStyle = rgba(MAGMA, 0.75 * s2);
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  ctx.restore();

  // --- Fault line across the right wall (appears once the fault has slipped) ---
  const fl = stage(level, 0.35, 1.1);
  if (fl > 0.01) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    FAULT.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = `rgba(16,8,18,${0.85 * fl})`;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    neonPath(ctx, () => {
      ctx.beginPath();
      FAULT.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    }, CORAL, s2, 2);
  }

  // --- Matching fossils on both walls (same layer, same species; oldest kinds lowest) ---
  const fz = s3;
  for (const fx of [104, 468]) {
    shell(ctx, fx, 664, 9, BONE, fz);
    trilobite(ctx, fx, 612, 10, BONE, fz);
    ammonite(ctx, fx + 4, 544, 11, BONE, fz);
  }

  // --- The Strata Stack pillar: layer windows that glow as you read them ---
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,16,0.55)';
  ctx.fillRect(258, 478, 56, 166);
  for (let i = 3; i <= 6; i++) {
    const b = BANDS[i];
    ctx.fillStyle = mix(b.c, '#1a0f22', 0.35 - 0.2 * s1);
    ctx.fillRect(266, b.y0, 40, b.y1 - b.y0);
    if (s1 > 0.01) {
      ctx.fillStyle = rgba(MINT, 0.18 * s1);
      ctx.fillRect(266, b.y0, 40, 2);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(268, 480, 6, 160);
  ctx.restore();
  // "read from the bottom up" arrow and labels
  ctx.save();
  ctx.strokeStyle = rgba(MINT, 0.45 + 0.4 * s1);
  ctx.fillStyle = rgba(MINT, 0.45 + 0.4 * s1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(318, 628);
  ctx.lineTo(318, 506);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(318, 498);
  ctx.lineTo(313, 508);
  ctx.lineTo(323, 508);
  ctx.closePath();
  ctx.fill();
  ctx.font = '700 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(IVORY, 0.75);
  ctx.fillText('OLDER', 286, 664);
  ctx.fillText('YOUNGER', 286, 440);
  ctx.restore();

  // --- Title and finale glow ---
  neonText(ctx, 'CANYON OF CLUES', 300, 62, 24, GOLD, stage(level, 1.4, 2.4));
  if (s4 > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, rgba(GOLD, 0.07 * s4)], [0.35, rgba(CORAL, 0.035 * s4)], [1, rgba(GOLD, 0)]]);
    ctx.fillRect(0, 0, 600, 1150);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- 3D attraction set

const GROUND = -0.42;

/** Rocky outline: a smooth, deterministic wobble around a layer's rim. */
function wob(a: number, seed: number) {
  return 1 + 0.07 * Math.sin(a * 3 + seed) + 0.045 * Math.sin(a * 7 + seed * 1.7) + 0.025 * Math.sin(a * 13 + seed * 0.3);
}

function wobble(geo: THREE.BufferGeometry, seed: number) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    if (Math.abs(x) + Math.abs(z) < 1e-5) continue;
    const f = wob(Math.atan2(z, x), seed);
    p.setX(i, x * f);
    p.setZ(i, z * f);
  }
  geo.computeVertexNormals();
}

/** Grayscale sandstone grain with cross-bedding: tinted per layer, also used as a bump map. */
function grainTexture(kit: SetKit): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#bdbdbd';
  ctx.fillRect(0, 0, 256, 256);
  const r = kit.rand(19);
  for (let i = 0; i < 2600; i++) {
    const v = 150 + Math.floor(r() * 105);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2.5, 1 + r() * 1.5);
  }
  for (let k = 0; k < 14; k++) {
    const y = r() * 256;
    ctx.strokeStyle = `rgba(70,70,70,${0.18 + r() * 0.25})`;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.04 + k) * 3 + (r() - 0.5) * 2);
    ctx.stroke();
  }
  const tex = kit.track(new T.CanvasTexture(c));
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.anisotropy = 4;
  return tex;
}

interface Butte {
  group: THREE.Group;
  layers: THREE.MeshStandardMaterial[];
  seams: THREE.MeshStandardMaterial[];
}

/** Profile of a stepped butte: [height, bottom radius, top radius] per layer, oldest first. */
const PROFILE: [number, number, number][] = [
  [0.62, 1.95, 1.8], [0.3, 1.78, 1.66], [0.34, 1.66, 1.5], [0.3, 1.52, 1.48], [0.3, 1.48, 1.4],
  [0.3, 1.4, 1.2], [0.32, 1.22, 1.18], [0.36, 1.18, 1.04], [0.34, 1.05, 0.96], [0.24, 0.98, 0.95],
];

function butte(kit: SetKit, grain: THREE.Texture, pos: [number, number], seed: number, scale = 1): Butte {
  const T = kit.THREE;
  const group = new T.Group();
  const layers: THREE.MeshStandardMaterial[] = [];
  const seams: THREE.MeshStandardMaterial[] = [];
  let y = 0;
  PROFILE.forEach(([h, rb, rt], i) => {
    const geo = new T.CylinderGeometry(rt * scale, rb * scale, h * scale, 22, 2);
    wobble(geo, seed + i * 0.6);
    const mat = kit.track(new T.MeshStandardMaterial({ color: ROCKS[i], map: grain, bumpMap: grain, bumpScale: 0.6, roughness: 0.92, metalness: 0, emissive: ROCKS[i], emissiveIntensity: 0 }));
    const m = new T.Mesh(geo, mat);
    m.position.y = y + (h * scale) / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    layers.push(mat);
    y += h * scale;
    if (i < PROFILE.length - 1) {
      // a glowing "layer window" seam along the top edge of the layer
      const sg = new T.CylinderGeometry(rt * scale * 1.012, rt * scale * 1.012, 0.035, 22, 1, true);
      wobble(sg, seed + i * 0.6);
      const sm = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: MINT, emissiveIntensity: 0.02, roughness: 0.5, side: T.DoubleSide }));
      const s = new T.Mesh(sg, sm);
      s.position.y = y - 0.02;
      group.add(s);
      seams.push(sm);
    }
  });
  group.position.set(pos[0], GROUND, pos[1]);
  kit.add(group);
  return { group, layers, seams };
}

/** Logarithmic-spiral ammonite on a stone plaque, facing the camera. */
function ammonitePlaque(kit: SetKit, pos: [number, number, number], rotY: number, size: number) {
  const T = kit.THREE;
  const g = new T.Group();
  const plate = new T.Mesh(new T.CylinderGeometry(size * 1.25, size * 1.32, 0.08, 28), kit.mats.plastic('#d8c3a0'));
  plate.rotation.x = Math.PI / 2;
  g.add(plate);
  const pts: THREE.Vector3[] = [];
  for (let a = 0; a <= TAU * 2.7; a += 0.12) {
    const rr = size * Math.exp(-0.19 * (TAU * 2.7 - a));
    pts.push(new T.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0.05));
  }
  const mat = kit.track(new T.MeshStandardMaterial({ color: '#3a2a22', emissive: BONE, emissiveIntensity: 0.05, roughness: 0.6 }));
  const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 160, size * 0.07, 6, false), mat);
  g.add(tube);
  g.position.set(...pos);
  g.rotation.set(-0.35, rotY, 0);
  kit.add(g);
  return mat;
}

/** Cylinder spanning two points (derrick legs, braces). */
function strut(kit: SetKit, a: [number, number, number], b: [number, number, number], r: number, mat: THREE.Material) {
  const T = kit.THREE;
  const va = new T.Vector3(...a);
  const vb = new T.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  m.castShadow = true;
  kit.add(m);
  return m;
}

/** Core sample: a horizontal cylinder printed with the canyon's layers in order. */
function coreTexture(kit: SetKit): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const ctx = c.getContext('2d')!;
  const order = ROCKS.slice(2).reverse();
  const w = 256 / order.length;
  order.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(i * w, 0, w + 1, 32);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(i * w, 0, 1.5, 32);
  });
  const tex = kit.track(new T.CanvasTexture(c));
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Desert floor: warm sand with wind ripples, pebbles and dark varnish streaks. */
function desertGround(kit: SetKit) {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3e241e';
  ctx.fillRect(0, 0, 512, 512);
  const r = kit.rand(23);
  for (let i = 0; i < 5000; i++) {
    const v = r();
    ctx.fillStyle = v < 0.5 ? `rgba(20,8,10,${0.12 + r() * 0.2})` : `rgba(230,170,120,${0.05 + r() * 0.12})`;
    ctx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.strokeStyle = 'rgba(240,190,140,0.07)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 26; k++) {
    const y = r() * 512;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + k) * 6);
    ctx.stroke();
  }
  for (let k = 0; k < 60; k++) {
    ctx.fillStyle = `rgba(${70 + r() * 50},${40 + r() * 30},${34 + r() * 24},0.75)`;
    ctx.beginPath();
    ctx.ellipse(r() * 512, r() * 512, 1.5 + r() * 3.5, 1 + r() * 2.5, r() * 3, 0, TAU);
    ctx.fill();
  }
  const tex = kit.track(new T.CanvasTexture(c));
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.anisotropy = 8;
  const mat = kit.track(new T.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.8, roughness: 0.96, metalness: 0 }));
  const mesh = new T.Mesh(new T.CircleGeometry(34, 64).rotateX(-Math.PI / 2), mat);
  mesh.position.y = GROUND;
  mesh.receiveShadow = true;
  kit.add(mesh);
}

/** Weathered boulder in canyon rock, with the shared sandstone grain. */
function boulder(kit: SetKit, mats: Map<string, THREE.MeshStandardMaterial>, grain: THREE.Texture, pos: [number, number], size: number, color: string, seed: number) {
  const T = kit.THREE;
  const geo = new T.IcosahedronGeometry(size, 3);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 0.86 + 0.12 * Math.sin(x * 5.1 + seed) * Math.cos(z * 4.3 - seed) + 0.06 * Math.sin(y * 9 + seed * 2);
    p.setXYZ(i, x * n, y * n * 0.62, z * n);
  }
  geo.computeVertexNormals();
  let mat = mats.get(color);
  if (!mat) {
    mat = kit.track(new T.MeshStandardMaterial({ color, map: grain, bumpMap: grain, bumpScale: 0.6, roughness: 0.95 }));
    mats.set(color, mat);
  }
  const m = new T.Mesh(geo, mat);
  m.position.set(pos[0], GROUND + size * 0.42, pos[1]);
  m.rotation.y = seed;
  m.castShadow = true;
  m.receiveShadow = true;
  kit.add(m);
}

/** Stylised juniper: a twisted trunk and a few faceted clumps of foliage. */
function juniper(kit: SetKit, leaf: THREE.Material, bark: THREE.Material, pos: [number, number], h: number, seed: number) {
  const T = kit.THREE;
  const r = kit.rand(seed);
  const g = new T.Group();
  const trunk = new T.Mesh(new T.CylinderGeometry(h * 0.04, h * 0.08, h * 0.55, 6), bark);
  trunk.position.y = h * 0.27;
  trunk.rotation.z = (r() - 0.5) * 0.3;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const blob = new T.Mesh(new T.IcosahedronGeometry(h * (0.2 + r() * 0.1), 1), leaf);
    blob.position.set((r() - 0.5) * h * 0.4, h * (0.55 + i * 0.15), (r() - 0.5) * h * 0.4);
    blob.scale.y = 0.75;
    blob.castShadow = true;
    g.add(blob);
  }
  g.position.set(pos[0], GROUND, pos[1]);
  kit.add(g);
}

/** A-frame field tent with a dark doorway. */
function fieldTent(kit: SetKit, pos: [number, number], rotY: number) {
  const T = kit.THREE;
  const shape = new T.Shape();
  shape.moveTo(-0.55, 0);
  shape.lineTo(0.55, 0);
  shape.lineTo(0, 0.72);
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false });
  geo.translate(0, 0, -0.5);
  const canvas = new T.Mesh(geo, kit.mats.plastic('#cfae76'));
  canvas.castShadow = true;
  const door = new T.Shape();
  door.moveTo(-0.22, 0);
  door.lineTo(0.22, 0);
  door.lineTo(0, 0.42);
  door.closePath();
  const doorMesh = new T.Mesh(new T.ShapeGeometry(door), kit.mats.dark());
  doorMesh.position.z = 0.505;
  const g = new T.Group();
  g.add(canvas, doorMesh);
  g.position.set(pos[0], GROUND, pos[1]);
  g.rotation.y = rotY;
  kit.add(g);
}

const canyonSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  kit.sky('#160c30', '#c0604a');
  desertGround(kit);
  const grain = grainTexture(kit);
  const rockMats = new Map<string, THREE.MeshStandardMaterial>();

  // Matching buttes on both sides of the cabinet: the same layers, in the same order.
  const west = butte(kit, grain, [-6.15, -2.7], 1.3, 0.94);
  const east = butte(kit, grain, [6.15, -2.7], 4.1, 0.94);
  // A magma dike slices through the east butte (younger than every layer it cuts).
  const dikeMat = kit.track(new T.MeshStandardMaterial({ color: '#2a1410', emissive: '#ff4a1a', emissiveIntensity: 0.05, roughness: 0.55 }));
  const dike = new T.Mesh(new T.BoxGeometry(0.15, 2.7, 2.7), dikeMat);
  dike.position.set(6.0, 1.0, -2.6);
  dike.rotation.set(0, -0.35, 0.42);
  kit.add(dike);
  // Matching ammonites on the two walls.
  const ammW = ammonitePlaque(kit, [-5.05, 1.05, -1.25], 0.55, 0.26);
  const ammE = ammonitePlaque(kit, [5.05, 1.05, -1.25], -0.55, 0.26);
  // A time arrow up the west butte: read from the bottom up.
  const arrow = kit.neonTube([[-4.75, 0.0, -1.5], [-4.82, 1.0, -1.72], [-4.95, 2.05, -2.0]], MINT, { radius: 0.035 });
  const arrowHead = kit.neonTube([[-5.12, 1.86, -1.9], [-4.95, 2.12, -2.02], [-4.78, 1.86, -1.98]], MINT, { radius: 0.035 });
  const older = kit.panel('OLDER', [-4.55, 0.18, -1.05], { w: 0.62, h: 0.2, bg: '#e8c48a', fg: '#2a1530', rotY: 0.5 });
  const younger = kit.panel('YOUNGER', [-4.75, 2.42, -1.65], { w: 0.74, h: 0.2, bg: '#e8c48a', fg: '#2a1530', rotY: 0.5 });
  older.rotation.x = -0.5;
  younger.rotation.x = -0.5;

  // The river that carved the canyon: down past the cabinet, then bending out under a footbridge.
  const reach = kit.water([-4.4, GROUND + 0.1, -3.4], 0.7, 6.1, '#1f6f86');
  const bend = kit.water([-6.03, GROUND + 0.1, 1.43], 0.74, 5.2, '#1f6f86');
  bend.rotation.y = -0.673;
  // At the Wonderlight the river itself begins to glow.
  const riverMats = [reach.material, bend.material] as THREE.MeshPhysicalMaterial[];
  for (const m of riverMats) m.emissive.set(RIVER);
  for (const [x, z, sz, c, seed] of [
    [-3.95, -5.0, 0.3, ROCKS[2], 3], [-4.95, -4.4, 0.22, ROCKS[7], 9], [-4.9, -0.2, 0.26, ROCKS[4], 4],
    [-5.1, 3.95, 0.2, ROCKS[1], 5], [-7.25, 1.75, 0.24, ROCKS[6], 12], [7.4, 1.0, 0.46, ROCKS[3], 6], [4.1, -5.0, 0.32, ROCKS[7], 7], [6.9, 3.4, 0.3, ROCKS[5], 8],
  ] as [number, number, number, string, number][]) boulder(kit, rockMats, grain, [x, z], sz, c, seed);
  // Footbridge across the bend.
  const plank = kit.mats.wood();
  const across = Math.atan2(3.95, 3.15);
  const deck = new T.Mesh(new T.BoxGeometry(1.25, 0.05, 0.36), plank);
  deck.position.set(-6.03, GROUND + 0.2, 1.43);
  deck.rotation.y = -across;
  deck.castShadow = true;
  kit.add(deck);
  for (const side of [-1, 1]) {
    const rail = new T.Mesh(new T.BoxGeometry(1.25, 0.04, 0.03), plank);
    rail.position.set(-6.03 + side * 0.17 * Math.sin(across), GROUND + 0.42, 1.43 + side * 0.17 * Math.cos(across));
    rail.rotation.y = -across;
    kit.add(rail);
  }
  const leaf = kit.track(new T.MeshStandardMaterial({ color: '#3f5a3c', roughness: 0.9, flatShading: true }));
  const sage = kit.track(new T.MeshStandardMaterial({ color: '#7d8c62', roughness: 0.95, flatShading: true }));
  const bark = kit.track(new T.MeshStandardMaterial({ color: '#5a3a26', roughness: 0.9 }));
  juniper(kit, leaf, bark, [-7.3, 3.9], 1.25, 3);
  juniper(kit, leaf, bark, [7.0, -0.2], 1.15, 7);
  for (const [x, z, sz] of [[-6.6, 3.0, 0.2], [4.3, 3.9, 0.18], [6.4, 1.9, 0.2]] as [number, number, number][]) {
    const b = new T.Mesh(new T.IcosahedronGeometry(sz, 1), sage);
    b.position.set(x, GROUND + sz * 0.5, z);
    b.scale.y = 0.7;
    kit.add(b);
  }

  // Field camp (west): tent, lantern, campfire, crates and a sign.
  fieldTent(kit, [-6.95, 0.15], 0.75);
  kit.pole([-4.55, 0, 0.75], 1.35);
  const camp = kit.lantern([-4.55, 1.5, 0.75], GOLD, 0.13);
  const fire = kit.orb([-5.45, GROUND + 0.12, 2.45], 0.12, '#ff8a3a');
  const logs = kit.mats.plastic('#4a2a1a');
  for (const a of [0, 1.1, 2.2]) {
    const l = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.36, 6), logs);
    l.position.set(-5.45, GROUND + 0.04, 2.45);
    l.rotation.set(Math.PI / 2, 0, a);
    kit.add(l);
  }
  const crateMat = kit.mats.wood();
  for (const [x, z, sz] of [[-6.2, -0.3, 0.34], [-5.85, -0.05, 0.26]] as [number, number, number][]) {
    const c = new T.Mesh(new T.BoxGeometry(sz, sz, sz), crateMat);
    c.position.set(x, GROUND + sz / 2, z);
    c.rotation.y = x;
    c.castShadow = true;
    kit.add(c);
  }
  const sign = kit.panel('READ THE ROCKS', [-5.35, 0.62, 3.25], { w: 1.25, h: 0.34, bg: '#e8c48a', fg: '#2a1530', rotY: 0.45 });
  sign.rotation.x = -0.45;
  kit.pole([-5.35, 0, 3.32], 0.5, '#6b4a30');

  // Fault block (west, foreground): matching layers, broken and offset by a fault.
  const faultMats: THREE.MeshStandardMaterial[] = [];
  const blockLayers = [ROCKS[3], ROCKS[4], ROCKS[5], ROCKS[6]];
  for (const side of [-1, 1]) {
    // The east half has dropped along the fault, so its layers no longer line up with the west half.
    const drop = side > 0 ? 0.12 : 0;
    blockLayers.forEach((col, i) => {
      const mat = kit.track(new T.MeshStandardMaterial({ color: col, map: grain, bumpMap: grain, bumpScale: 0.5, roughness: 0.9, emissive: col, emissiveIntensity: 0 }));
      faultMats.push(mat);
      const m = new T.Mesh(new T.BoxGeometry(0.62, 0.17, 0.85), mat);
      m.position.set(-4.85 + side * 0.33, GROUND + 0.085 + i * 0.17 - drop, 4.35);
      m.castShadow = true;
      m.receiveShadow = true;
      kit.add(m);
    });
  }
  const faultLineMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: CORAL, emissiveIntensity: 0.02 }));
  const faultLine = new T.Mesh(new T.BoxGeometry(0.03, 0.7, 0.88), faultLineMat);
  faultLine.position.set(-4.85, GROUND + 0.33, 4.35);
  kit.add(faultLine);

  // Core Sampler derrick (east): four-legged tower, braces, deck, motor, pulley, drill and lamp.
  const steel = kit.mats.paintedMetal('#d2a070');
  const cx = 5.25;
  const cz = 0.65;
  const topY = 2.5;
  const apex: [number, number, number] = [cx, topY, cz];
  const foot = 0.52;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]) strut(kit, [cx + dx * foot, GROUND, cz + dz * foot], apex, 0.045, steel);
  for (const hy of [0.45, 1.35]) {
    const k = 1 - (hy - GROUND) / (topY - GROUND);
    const ring = new T.Mesh(new T.TorusGeometry(foot * k * Math.SQRT2, 0.022, 6, 4), steel);
    ring.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    ring.position.set(cx, hy, cz);
    kit.add(ring);
  }
  const rigDeck = new T.Mesh(new T.BoxGeometry(1.25, 0.06, 1.25), crateMat);
  rigDeck.position.set(cx, GROUND + 0.12, cz);
  rigDeck.receiveShadow = true;
  kit.add(rigDeck);
  const motor = new T.Mesh(new T.BoxGeometry(0.34, 0.26, 0.3), kit.mats.paintedMetal(CORAL));
  motor.position.set(cx + 0.36, GROUND + 0.28, cz + 0.32);
  motor.castShadow = true;
  kit.add(motor);
  const crown = new T.Mesh(new T.BoxGeometry(0.24, 0.14, 0.24), kit.mats.brass());
  crown.position.set(...apex);
  kit.add(crown);
  const pulley = new T.Mesh(new T.TorusGeometry(0.11, 0.025, 8, 24), kit.mats.chrome());
  pulley.position.set(cx, topY - 0.16, cz + 0.06);
  kit.add(pulley);
  strut(kit, [cx, GROUND, cz], [cx, topY - 0.05, cz], 0.032, kit.mats.chrome());
  const bit = kit.gear([cx, GROUND + 0.22, cz], 0.2, 10, GOLD, 0.06);
  bit.rotation.x = Math.PI / 2;
  const rigLamp = kit.lantern([cx, topY + 0.22, cz], GOLD, 0.11);
  // Wonderlight beam rising from the core sampler (finale only).
  const beamMat = kit.track(new T.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const beam = new T.Mesh(new T.CylinderGeometry(0.16, 0.42, 7, 24, 1, true), beamMat);
  beam.position.set(cx, topY + 3.7, cz);
  kit.add(beam);
  // Core rack: three cores showing the same layers in order.
  const rack = new T.Mesh(new T.BoxGeometry(1.15, 0.06, 0.6), crateMat);
  rack.position.set(5.05, 0.12, 2.65);
  rack.rotation.y = -0.35;
  rack.castShadow = true;
  kit.add(rack);
  for (const lx of [-0.45, 0.45]) {
    const leg = new T.Mesh(new T.BoxGeometry(0.06, 0.52, 0.5), crateMat);
    leg.position.set(5.05 + lx * Math.cos(0.35), GROUND + 0.26, 2.65 + lx * Math.sin(0.35));
    leg.rotation.y = -0.35;
    kit.add(leg);
  }
  const coreTex = coreTexture(kit);
  const coreMat = kit.track(new T.MeshStandardMaterial({ map: coreTex, roughness: 0.7, emissive: '#ffffff', emissiveMap: coreTex, emissiveIntensity: 0.02 }));
  for (let i = 0; i < 3; i++) {
    const core = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.0, 16), coreMat);
    core.rotation.set(0, -0.35, Math.PI / 2);
    core.position.set(5.05 + (i - 1) * 0.06, 0.2, 2.65 + (i - 1) * 0.17);
    core.castShadow = true;
    kit.add(core);
  }
  const labSign = kit.neonSign('CORE LAB', [5.95, 1.15, 2.2], { height: 0.28, color: MINT, rotY: -0.5 });
  labSign.rotation.x = -0.55;
  kit.pole([5.95, 0, 2.24], 0.98);
  // The attraction's marquee on two posts in the east foreground.
  const title = kit.neonSign('CANYON OF CLUES', [5.55, 1.05, 4.35], { height: 0.42, color: GOLD, rotY: -0.42 });
  title.rotation.x = -0.62;
  kit.pole([4.86, 0, 4.06], 0.95);
  kit.pole([6.24, 0, 4.66], 0.95);

  // Festival lights strung between the camp and the canyon trail, and across the core lab.
  kit.pole([-7.35, 0, -0.25], 2.0);
  kit.pole([7.35, 0, -0.6], 2.0);
  const lightsW = kit.stringLights([-7.35, 1.98, -0.25], [-4.55, 1.33, 0.75], 0.28, kit.n(8), [GOLD, CORAL, MINT]);
  const lightsE = kit.stringLights([7.35, 1.98, -0.6], [5.95, 0.98, 2.24], 0.3, kit.n(8), [GOLD, MINT, CORAL]);

  const dust = kit.motes({ x0: -8.5, x1: 8.5, y0: -0.2, y1: 3.6, z0: -6.5, z1: 5 }, kit.n(110), GOLD, { speed: 0.07, size: 0.09 });
  const sparkW = kit.fireworks({ x0: -7.4, x1: -4.8, y0: 3.0, y1: 4.0, z: -1.7 }, [GOLD, CORAL, MINT, BONE]);
  const sparkE = kit.fireworks({ x0: 4.8, x1: 7.4, y0: 3.0, y1: 4.0, z: -1.7 }, [GOLD, MAGMA, MINT, BONE]);
  kit.spot([-2.6, 9, 5], [-6.1, 1.0, -2.6], '#ffb07a', 44, 0.42);
  kit.spot([2.6, 9, 5], [6.1, 1.0, -2.6], '#ff9fb8', 38, 0.42);
  const magmaLight = kit.point([5.1, 1.5, -1.4], MAGMA, 0.5, 7);

  let bitAngle = 0;
  let pulse = 0;
  const mintC = new T.Color(MINT);
  const goldC = new T.Color(GOLD);
  const seamCount = west.seams.length;
  return {
    update(t, dt, level, energy) {
      const s1 = kit.stage(level, 0.2, 1.1);
      const s2 = kit.stage(level, 1.2, 2.1);
      const s3 = kit.stage(level, 2.2, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      const flick = kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
      // Layer windows light from the bottom up as discoveries are made.
      for (let i = 0; i < seamCount; i++) {
        const lit = Math.max(0.05, kit.stage(level, 0.1 + i * 0.32, 0.6 + i * 0.32));
        const wave = kit.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 1.6 - i * 0.6);
        const v = lit * 1.7 * wave + s4 * 0.8 + pulse * 1.6;
        west.seams[i].emissiveIntensity = v;
        east.seams[i].emissiveIntensity = v;
        west.seams[i].emissive.copy(s4 > 0.5 ? goldC : mintC);
        east.seams[i].emissive.copy(s4 > 0.5 ? goldC : mintC);
      }
      for (let i = 0; i < west.layers.length; i++) {
        const glow = 0.02 + 0.12 * kit.stage(level, 0.1 + i * 0.32, 0.8 + i * 0.32) + 0.12 * s4;
        west.layers[i].emissiveIntensity = glow;
        east.layers[i].emissiveIntensity = glow;
      }
      for (const m of faultMats) m.emissiveIntensity = 0.04 + 0.1 * s1;
      faultLineMat.emissiveIntensity = 0.05 + 2.6 * s1 * (0.85 + 0.15 * energy);
      dikeMat.emissiveIntensity = 0.12 + 1.5 * s2 * flick + 0.4 * s4;
      if (magmaLight) magmaLight.intensity = 0.5 + 9 * s2 * flick;
      ammW.emissiveIntensity = 0.05 + 2.2 * s3;
      ammE.emissiveIntensity = 0.05 + 2.2 * s3;
      arrow.setLit(0.25 + 0.75 * s1);
      arrowHead.setLit(0.25 + 0.75 * s1);
      camp.setLit(0.65);
      fire.setLit(0.55 * flick + 0.3);
      rigLamp.setLit(0.3 + 0.7 * s1);
      coreMat.emissiveIntensity = 0.03 + 0.35 * s1;
      title.setLit(0.18 + 0.82 * s2);
      labSign.setLit(0.25 + 0.75 * s1);
      lightsW.setLit(0.35 + 0.65 * s1);
      lightsE.setLit(0.35 + 0.65 * s3);
      dust.setLit(0.2 + 0.35 * s1 + 0.45 * s4);
      for (const m of riverMats) m.emissiveIntensity = 0.03 + 0.08 * s1 + 0.16 * s4;
      sparkW.setLit(s4);
      sparkE.setLit(s4);
      beamMat.opacity = (0.22 + (kit.reducedMotion ? 0 : 0.06 * Math.sin(t * 2))) * s4 + 0.25 * pulse;
      if (!kit.reducedMotion) bitAngle += dt * (0.4 + 2.5 * s1 + 3 * energy);
      bit.rotation.z = bitAngle;
      pulse = Math.max(0, pulse - dt * 0.8);
    },
    celebrate(p) {
      const k = Math.sin(p * Math.PI);
      pulse = Math.max(pulse, k);
      sparkW.setLit(Math.max(k, 0));
      sparkE.setLit(Math.max(k, 0));
    },
  };
};

const canyonRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const floor = new T.Mesh(new T.BoxGeometry(2.0, 0.05, 1.7), kit.mats.plastic('#5a3528'));
  floor.position.y = 0.025;
  kit.add(floor);
  const river = new T.Mesh(new T.PlaneGeometry(0.28, 1.6), kit.track(new T.MeshStandardMaterial({ color: '#1d6f80', emissive: RIVER, emissiveIntensity: 0.1, roughness: 0.2 })));
  river.rotation.x = -Math.PI / 2;
  river.position.set(-0.05, 0.056, 0.05);
  kit.add(river);
  // A miniature layered butte with glowing layer windows.
  const glows: THREE.MeshStandardMaterial[] = [];
  const mini = [ROCKS[1], ROCKS[3], ROCKS[4], ROCKS[5], ROCKS[6], ROCKS[9]];
  let y = 0.05;
  mini.forEach((col, i) => {
    const h = 0.15;
    const r0 = 0.5 - i * 0.045;
    const geo = new T.CylinderGeometry(r0 - 0.03, r0, h, 14, 1);
    wobble(geo, 2 + i);
    const mat = kit.track(new T.MeshStandardMaterial({ color: col, roughness: 0.9, emissive: col, emissiveIntensity: 0 }));
    const m = new T.Mesh(geo, mat);
    m.position.set(-0.52, y + h / 2, -0.25);
    kit.add(m);
    glows.push(mat);
    y += h;
  });
  const dikeMat = kit.track(new T.MeshStandardMaterial({ color: '#2a1612', emissive: MAGMA, emissiveIntensity: 0.05 }));
  const dike = new T.Mesh(new T.BoxGeometry(0.05, 0.95, 0.7), dikeMat);
  dike.position.set(-0.5, 0.48, -0.25);
  dike.rotation.z = 0.45;
  kit.add(dike);
  // Tiny core-sampler derrick and an ammonite standing on a plinth.
  const steel = kit.mats.paintedMetal('#c9a27a');
  const apex: [number, number, number] = [0.55, 1.0, 0.05];
  for (const [dx, dz] of [[-0.2, 0.16], [0.2, 0.16], [0, -0.22]] as [number, number][]) strut(kit, [0.55 + dx, 0.05, 0.05 + dz], apex, 0.012, steel);
  strut(kit, [0.55, 0.05, 0.05], [0.55, 0.98, 0.05], 0.008, kit.mats.chrome());
  const lamp = kit.lantern([0.55, 1.07, 0.05], GOLD, 0.05);
  const plinth = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 0.12), kit.mats.plastic('#d8c3a0'));
  plinth.position.set(0.05, 0.11, 0.55);
  kit.add(plinth);
  const pts: THREE.Vector3[] = [];
  for (let a = 0; a <= TAU * 2.5; a += 0.2) {
    const rr = 0.11 * Math.exp(-0.2 * (TAU * 2.5 - a));
    pts.push(new T.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0));
  }
  const ammMat = kit.track(new T.MeshStandardMaterial({ color: '#3a2a22', emissive: BONE, emissiveIntensity: 0.05 }));
  const amm = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.014, 5, false), ammMat);
  amm.position.set(0.05, 0.3, 0.56);
  kit.add(amm);
  return {
    update(t, lit) {
      const wave = kit.reducedMotion ? 0 : t;
      for (let i = 0; i < glows.length; i++) glows[i].emissiveIntensity = lit * (0.15 + 0.2 * Math.max(0, Math.sin(wave * 1.5 - i * 0.7)));
      dikeMat.emissiveIntensity = 0.05 + 2 * lit;
      ammMat.emissiveIntensity = 0.05 + 1.8 * lit;
      lamp.setLit(lit);
    },
  };
};

// ---------------------------------------------------------------- the attraction

export const L08: TableDef = {
  lessonId: 'L08',
  signature: 'The Strata Stack: in-line layers you can only read from the bottom up',
  theme: {
    bg: ['#2a1834', '#140b1c'],
    rail: '#e3c19c',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: '#FF8A5C',
    accent2: MINT,
    bumperCap: '#f0cfa2',
    bumperRing: '#5c2a36',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(255,96,48,0.30)',
    trail: MINT,
  },
  lines: {
    intro: 'Welcome to the Canyon of Clues! These cliffs are a diary written in stone, and we\'ll read it one layer at a time.',
    quark: 'Professor Quark taps the Magma Dike: "It slices through every layer, so it must be older than all of them. Right?"',
    pipTip: 'Aim up the slot canyon in the middle: layer 1, the oldest of the four, comes first.',
  },
  build,
  skillShot: 'rim_lane',
  shots: [
    { id: 'layers', label: 'Strata Stack', on: [{ type: 'drop', group: 'strata' }], insert: 'ins_stack' },
    { id: 'river', label: 'River Run', on: [{ type: 'shot', id: 'river_sw' }], insert: 'ins_river' },
    { id: 'fault', label: 'Fault Lane', on: [{ type: 'shot', id: 'fault_sw' }], insert: 'ins_fault' },
    { id: 'dike', label: 'Magma Dike', on: [{ type: 'ramp', id: 'dike_ramp' }], insert: 'ins_dike' },
    { id: 'core', label: 'Core Sampler', on: [{ type: 'saucer', id: 'core_sampler' }], insert: 'ins_core' },
    { id: 'fossils', label: 'Fossil beds', on: [{ type: 'target', group: 'fossils' }], insert: 'ins_fossil' },
    { id: 'rockfall', label: 'Rockfall', on: [{ type: 'bumper', group: 'rockfall' }], insert: 'ins_rockfall' },
    { id: 'age', label: 'A-G-E lanes', on: [{ type: 'rollover', group: 'age' }], insert: 'ins_age' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Read the Layers',
      brief: 'In undisturbed, right-side-up layers the oldest is at the bottom. Drop layers 1 to 4 from the bottom up, then take a core.',
      objectiveIds: ['L08-O1'],
      stages: [
        { kind: 'collect', text: 'Read bottom-up: drop layers 1, 2, 3 and 4', match: { type: 'drop', group: 'strata' }, count: 4, distinct: true, lamps: ['strata_1', 'strata_2', 'strata_3', 'strata_4'], preview: ['layers'] },
        { kind: 'discover', text: 'Take a core at the Core Sampler', pocket: 'core_sampler', questions: 1 },
      ],
      discovery: 'In undisturbed layers, each new layer settles on top of older ones, so the oldest rock is at the bottom and the youngest is at the top. Steeply tilted or folded layers were moved later.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'What Cut Across?',
      brief: 'The fault has slipped and magma has pushed into a crack. Trace both features that cut the layers, then decide what came first.',
      objectiveIds: ['L08-O2', 'L08-O5'],
      stages: [
        { kind: 'shots', text: 'Trace the Magma Dike and the Fault Lane', shots: ['dike', 'fault'], order: 'any' },
        { kind: 'discover', text: 'What came first? Ask the Core Sampler', pocket: 'core_sampler', questions: 1, types: ['order', 'match', 'single'] },
      ],
      discovery: 'A fault or a magma intrusion that cuts across rock layers is younger than those layers: the layers had to be there before anything could cut through them.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Matching Walls',
      brief: 'A river carved this gap through layers that were once joined. Match the fossils on both canyon walls to compare their ages.',
      objectiveIds: ['L08-O3', 'L08-O5'],
      stages: [
        { kind: 'collect', text: 'Match the fossils on both canyon walls', match: { type: 'target', group: 'fossils' }, count: 4, distinct: true, lamps: ['fossil_tri_l', 'fossil_amm_l', 'fossil_tri_r', 'fossil_amm_r'], preview: ['fossils'] },
        { kind: 'discover', text: 'Compare the evidence at the Core Sampler', pocket: 'core_sampler', questions: 1 },
      ],
      discovery: 'Matching layers with the same index fossils on both walls formed at about the same time. That gives a relative age, not an exact number of years.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Light the Canyon',
    brief: 'Light four canyon features: the river, the dike, the fault, the Strata Stack or the A-G-E lanes. Then tell the canyon\'s story.',
    stages: [
      { kind: 'shots', text: 'Light 4: River, Dike, Fault, Strata Stack or A-G-E', shots: ['river', 'dike', 'fault', 'layers', 'age'], order: 'any', count: 4 },
      { kind: 'discover', text: 'Read the whole canyon at the Core Sampler', pocket: 'core_sampler', questions: 2 },
    ],
    celebration: 'From the river to the rim, every layer glows in order. You read the canyon\'s story, clue by clue. The Wonderlight is yours!',
  },
  onProgress(rt: TableRuntime, info) {
    // Before the first discovery the layers are undisturbed and the Fault Lane is closed;
    // after it the fault "slips" and stays open for the rest of the visit.
    const slipped = info.slot >= 1 || info.level >= 1;
    rt.get<Diverter>('fault_diverter').set(slipped ? 1 : 0);
  },
  set: canyonSet,
  room: canyonRoom,
  icons: {
    core(ctx, s) {
      // a drilled core sample: a banded cylinder
      ctx.save();
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.7, s * 0.42, s * 0.16, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, -s * 0.7);
      ctx.lineTo(-s * 0.42, s * 0.75);
      ctx.moveTo(s * 0.42, -s * 0.7);
      ctx.lineTo(s * 0.42, s * 0.75);
      ctx.stroke();
      for (const y of [-0.25, 0.15, 0.5]) {
        ctx.beginPath();
        ctx.ellipse(0, y * s, s * 0.42, s * 0.14, 0, 0, Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintCanyon(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      if (reduced) return;
      // foam sliding down the River Run, and dust drifting through the canyon
      const flow = 0.25 + 0.35 * stage(level, 0.2, 1.1);
      for (let i = 0; i < 10; i++) {
        const y = 300 + ((t * 120 + i * 37) % 360);
        glowDot(ctx, 40 + ((i * 13) % 26), y, 5, '#e6fffb', flow * 0.6);
      }
      drift(ctx, 61, 14, t, GOLD, [150, 340, 430, 780], 8, 1.4, 0.18 + 0.25 * stage(level, 1, 3) + 0.15 * energy);
      if (level >= 3.9) {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.3 + i / 3) % 1;
          const cx = 140 + i * 160;
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * TAU;
            glowDot(ctx, cx + Math.cos(a) * ph * 46, 110 + Math.sin(a) * ph * 46, 6, BURST[(i + k) % 3], 0.55 * (1 - ph));
          }
        }
      }
    },
    celebrate({ ctx, t, reduced }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(420, 510, 10, 420, 510, 460);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // the layers light one after another, from the bottom up
      for (let i = 0; i < BANDS.length; i++) {
        const k = Math.max(0, Math.min(1, p * 1.6 - i * 0.07));
        if (k <= 0) continue;
        ctx.fillStyle = rgba(MINT, 0.22 * Math.sin(k * Math.PI));
        ctx.fillRect(0, BANDS[i].y0, 600, 3);
      }
      if (reduced) return;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + t * 0.4;
        const d = 50 + p * 240;
        glowDot(ctx, 420 + Math.cos(a) * d, 510 + Math.sin(a) * d * 0.8, 9, SPARK[i % 3], 1 - p);
      }
    },
  },
};
export default L08;

