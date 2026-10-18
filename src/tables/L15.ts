// Lesson 15 — Chemical Engineering and Society — "Inventor's Wonderworks"
// A maker's theater at curtain-up. The Grand Conveyor climbs from the left wing, runs across the
// front of the stage and drops its load into the Test Bay, a lock at the head of the funnel-mouthed
// Prototype Test Lane (FLEX spinner) on the right. Resource bins (CORN, OIL, YEW) line the lane
// wall, design-criteria lanes (HOLDS, BENDS, BREAKS) sit on stage behind a polymer chain of
// bumpers, a constraints drop bank (COST, TIME, TOOLS) guards the conveyor's flank, and the
// Design Desk is the Wonder Pocket. A one-way stage door turns plunged balls back onto the stage;
// the Supply Loop runs up the left side and round the proscenium.

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { offsetPath, smoothPath, type Saucer } from '../game/table/mechanisms.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { IconPainter } from '../game/render/icons.ts';
import {
  TAU, drift, gear, glowDot, mix, neonPath, neonText, plaque, rgba, rng, rrect, stage, stars, vgrad,
} from '../game/render/art.ts';

type Pt = [number, number];
type V3 = [number, number, number];

// ---------------------------------------------------------------- palette
const NAVY = '#13204d';
const INK = '#0b1230';
const GOLD = '#FFC75B';
const COPPER = '#FF9A62';
const CORAL = '#FF7F86';
const CRIMSON = '#b8324a';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const BLUEPRINT = '#9fd8ff';
const BRASS = '#d9b46a';
const CORN = '#ffd45a';
const LEAF = '#7fdc8a';
const TRIO = [GOLD, CORAL, MINT];

// ---------------------------------------------------------------- shared geometry
const CONVEYOR: Pt[] = [
  [156, 612], [158, 480], [168, 370], [192, 296], [236, 258], [300, 250], [370, 260], [436, 282],
  [490, 318], [518, 366], [522, 420],
];
const POCKET: Pt = [300, 466];
const BAY: Pt = [522, 446];
const BUMPERS: Pt[] = [[220, 162], [300, 192], [380, 162]];
const LANE_XS = [262, 310, 358];
const RES_Y = [434, 478, 522];
const DROP_Y = [398, 432, 466];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // ---- Supply Loop: the left orbit channel (a right-flipper shot that circles the proscenium)
  b.wall([[74, 640], [74, 372]], { id: 'supply_inner', r: 3 });
  b.post(74, 368, 5);
  b.shotSwitch('supply_sw', 49, 470, -90);
  // Stage door: a one-way gate high on the left. Supply Loop shots pass on their way round;
  // plunged balls coming the other way bounce back onto the stage (criteria lanes and chain).
  b.gate('stage_door', [104, 102], [150, 148], -45);
  // Return gate: a one-way flap, not a wall. Balls dropping down the loop are turned toward the
  // left inlane, while the left kickback below fires straight up through it and round the loop.
  // It meets the outer wall at y = 640 so the loop's mouth stays as wide as the channel.
  b.gate('supply_return', [FRAME.left + 3, 640], [66, 732], -90);
  b.wall([[66, 732], [71, 766], [67, 800]], { id: 'supply_guide', r: 3 });
  // Machine-room floor: seals the slot between the loop and the conveyor (printed as brass works)
  // and turns balls that would have dead-ended in it toward the Supply Loop's mouth.
  b.wall([[74, 640], [122, 676]], { id: 'slot_floor', r: 3 });

  // ---- Prototype Test Lane (right): a funnel-mouthed dead-end lane with the FLEX spinner and
  // the Test Bay lock at its head. The Test Bay holds the prototype, then sends it back down.
  b.wall([[FRAME.laneSep, 340], [496, 392], [496, 580], [424, 694]], { id: 'test_inner', r: 3 });
  b.post(424, 696, 5);
  b.spinner('flex_spinner', [500, 560], [545, 560], { label: 'FLEX' });
  b.shotSwitch('test_lane_sw', 522, 500, -90);
  // No floor label: the lane is narrower than the engine's label, so TEST BAY is printed in the art.
  const bay = b.saucer('test_bay', BAY[0], BAY[1], { role: 'lock', ejectDeg: 90, ejectSpeed: 650, captureMaxSpeed: 2600 });
  bay.autoEjectDelay = 1.3;
  b.wall([[FRAME.laneSep, 666], [520, 712]], { id: 'test_deflect', r: 3 });

  // ---- Resource bins on the Test Lane wall: every material starts as a natural resource
  b.target('res_corn', [489, 418], [489, 450], { group: 'resources', label: 'CORN' }).lampColor = CORN;
  b.target('res_oil', [489, 462], [489, 494], { group: 'resources', label: 'OIL' }).lampColor = COPPER;
  b.target('res_yew', [489, 506], [489, 538], { group: 'resources', label: 'YEW' }).lampColor = LEAF;

  // ---- Grand Conveyor: flared mouth left of centre, across the front of the stage, into the Test Bay
  b.wall([[122, 676], [139, 612]], { id: 'conveyor_flare_l', r: 3 });
  b.wall([[210, 670], [173, 612]], { id: 'conveyor_flare_r', r: 3 });
  // The ramp's name rides on its insert (the 2D ramp label would straddle the flare walls).
  b.ramp('conveyor', { path: CONVEYOR, width: 34, footprintTo: 2, peak: 46 });
  const fl = offsetPath(CONVEYOR.slice(0, 3), 19);
  const fr = offsetPath(CONVEYOR.slice(0, 3), -19);
  // Pitched roof over the conveyor's climb. It also closes the slot behind the ramp, so balls
  // from the upper left roll into the Supply Loop channel instead of dropping down beside it.
  const apex: Pt = [(fl[2][0] + fr[2][0]) / 2 - 4, Math.min(fl[2][1], fr[2][1]) - 32];
  b.wall([[74, 371], apex, [fl[2][0] + 2, fl[2][1] + 2]], { id: 'conveyor_tower', r: 3 });

  // ---- Constraints bank on the conveyor's flank: limits every design must fit within
  b.dropBank('constraints', 198, 384, 94.2, 3, { size: 28, gap: 6, group: 'constraints', labels: ['COST', 'TIME', 'TOOLS'] });

  // ---- Design-criteria lanes on stage: what the new cup must do
  // 'BREAKS' read like a failed cup; the criterion is breaking down after use (biodegrading).
  const crit = ['holds', 'bends', 'breaks'];
  const critLabel = ['HOLDS', 'BENDS', 'DECAYS'];
  LANE_XS.forEach((x, i) => (b.rollover(`crit_${crit[i]}`, x, 98, { group: 'criteria', label: critLabel[i] }).lampColor = MINT));
  for (const gx of [238, 286, 334, 382]) {
    b.wall([[gx, 76], [gx, 120]], { r: 3 });
    b.post(gx, 74, 5);
  }

  // ---- Polymer chain bumpers: three linked repeat units on stage
  BUMPERS.forEach(([x, y], i) => b.bumper(`chain_${'abc'[i]}`, x, y, { group: 'chain', label: 'LINK', icon: 'link', r: 22 }));

  // ---- Design Desk (the Wonder Pocket) in a drafting-hood cup
  const [px, py] = POCKET;
  b.wall([[px - 28, py - 22], [px - 28, py + 26]], { id: 'desk_l', r: 4 });
  b.wall([[px + 28, py - 22], [px + 28, py + 26]], { id: 'desk_r', r: 4 });
  b.wall([[px - 28, py - 22], [px, py - 36], [px + 28, py - 22]], { id: 'desk_hood', r: 4 });
  b.saucer('design_desk', px, py, { role: 'pocket', ejectDeg: 82, ejectSpeed: 760, captureMaxSpeed: 2600, label: 'DESIGN DESK', icon: 'cup' });

  // ---- Inserts (one per shot)
  b.insert('ins_conveyor', 176, 704, { deg: -100, label: 'GRAND CONVEYOR', color: GOLD });
  b.insert('ins_supply', 49, 600, { deg: -90, label: 'LOOP', color: GOLD });
  b.insert('ins_test', 506, 636, { deg: -80, label: 'TEST', color: MINT });
  b.insert('ins_bay', 522, 528, { shape: 'circle', size: 11, color: MINT });
  b.insert('ins_pocket', px, py + 74, { deg: -90, color: GOLD });
  b.insert('ins_bank', 240, 528, { deg: -115, label: 'LIMITS', color: CORAL });
  b.insert('ins_resources', 399, 478, { deg: 0, label: 'SOURCES', color: CORN });
  b.insert('ins_chain', 300, 134, { shape: 'star', size: 11, color: MINT });
}

// ================================================================ icons (caps and printed art)

/** Two interlocking chain links: one repeat unit joined to the next. */
const linkIcon: IconPainter = (ctx, s) => {
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = s * 0.2;
  ctx.beginPath();
  ctx.ellipse(-s * 0.34, 0, s * 0.52, s * 0.3, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(s * 0.34, 0, s * 0.52, s * 0.3, 0, 0, TAU);
  ctx.stroke();
};

const cupIcon: IconPainter = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, -s * 0.7);
  ctx.lineTo(s * 0.55, -s * 0.7);
  ctx.lineTo(s * 0.38, s * 0.75);
  ctx.lineTo(-s * 0.38, s * 0.75);
  ctx.closePath();
  ctx.fill();
};

const cornIcon: IconPainter = (ctx, s) => {
  const fill = ctx.fillStyle;
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.95);
  ctx.quadraticCurveTo(-s * 0.75, s * 0.2, -s * 0.35, -s * 0.5);
  ctx.quadraticCurveTo(-s * 0.2, s * 0.2, 0, s * 0.95);
  ctx.moveTo(0, s * 0.95);
  ctx.quadraticCurveTo(s * 0.75, s * 0.2, s * 0.35, -s * 0.5);
  ctx.quadraticCurveTo(s * 0.2, s * 0.2, 0, s * 0.95);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.1, s * 0.28, s * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,70,0,0.45)';
  for (let r = -3; r <= 3; r++) {
    for (const c of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.arc(c * s * 0.13, -s * 0.1 + r * s * 0.2, s * 0.045, 0, TAU);
      ctx.fill();
    }
  }
};

const oilIcon: IconPainter = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.95);
  ctx.bezierCurveTo(s * 0.25, -s * 0.5, s * 0.7, -s * 0.05, s * 0.62, s * 0.35);
  ctx.arc(0, s * 0.35, s * 0.62, 0, Math.PI);
  ctx.bezierCurveTo(-s * 0.7, -s * 0.05, -s * 0.25, -s * 0.5, 0, -s * 0.95);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, s * 0.25, s * 0.1, s * 0.22, -0.4, 0, TAU);
  ctx.fill();
};

/** A yew sprig: flat needles in two rows along a twig, with one red aril. */
const yewIcon: IconPainter = (ctx, s) => {
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, s * 0.95);
  ctx.quadraticCurveTo(s * 0.1, 0, -s * 0.05, -s * 0.95);
  ctx.stroke();
  ctx.lineWidth = s * 0.14;
  for (let i = 0; i < 7; i++) {
    const y = s * 0.75 - i * s * 0.26;
    const x = s * 0.02 * Math.sin(i);
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + d * s * 0.5, y - s * 0.16);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath();
  ctx.arc(s * 0.3, s * 0.55, s * 0.17, 0, TAU);
  ctx.fill();
};

const coinIcon: IconPainter = (ctx, s) => {
  for (let i = 2; i >= 0; i--) {
    ctx.beginPath();
    ctx.ellipse(0, s * 0.35 - i * s * 0.35, s * 0.75, s * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = s * 0.08;
    ctx.stroke();
  }
};

const clockIcon: IconPainter = (ctx, s) => {
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.78, 0, TAU);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.5);
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.36, s * 0.18);
  ctx.stroke();
};

const wrenchIcon: IconPainter = (ctx, s) => {
  ctx.save();
  ctx.rotate(-0.8);
  ctx.fillRect(-s * 0.13, -s * 0.45, s * 0.26, s * 1.35);
  ctx.beginPath();
  ctx.arc(0, -s * 0.55, s * 0.4, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(-s * 0.13, -s * 1.0, s * 0.26, s * 0.42);
  ctx.restore();
};

const ICONS: Record<string, IconPainter> = { link: linkIcon, cup: cupIcon, corn: cornIcon, oil: oilIcon, yew: yewIcon, coin: coinIcon, clock: clockIcon, wrench: wrenchIcon };

function icon(ctx: CanvasRenderingContext2D, key: keyof typeof ICONS, x: number, y: number, s: number, color: string, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ICONS[key](ctx, s);
  ctx.restore();
}

/** Round medallion with an icon, dim until lit. */
function medallion(ctx: CanvasRenderingContext2D, key: keyof typeof ICONS, x: number, y: number, r: number, color: string, lit: number) {
  ctx.save();
  if (lit > 0.05) glowDot(ctx, x, y, r * 2.2, color, 0.35 * lit);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = rgba(INK, 0.75);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(color, 0.35 + 0.6 * lit);
  ctx.stroke();
  ctx.restore();
  icon(ctx, key, x, y, r * 0.66, color, 0.35 + 0.65 * lit);
}

// ================================================================ printed playfield art

const D2R = Math.PI / 180;
const CONVEYOR_SMOOTH = smoothPath(CONVEYOR, 6);
const MOUTH_PTS = along(CONVEYOR_SMOOTH, 22, 200);
const CHAIN: Pt[] = [[96, 214], [156, 184], [220, 162], [262, 182], [300, 192], [338, 182], [380, 162], [444, 184], [504, 214]];

function strokePts(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
}

/** Points every `step` units along a polyline. */
function along(pts: Pt[], step: number, maxLen = Infinity): { p: Pt; dir: Pt }[] {
  const out: { p: Pt; dir: Pt }[] = [];
  let carry = 0;
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    if (!len) continue;
    const dir: Pt = [(bx - ax) / len, (by - ay) / len];
    let d = carry;
    while (d <= len) {
      if (total + d > maxLen) return out;
      out.push({ p: [ax + dir[0] * d, ay + dir[1] * d], dir });
      d += step;
    }
    carry = d - len;
    total += len;
  }
  return out;
}

function blueprintGrid(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.save();
  ctx.lineWidth = 1;
  for (let x = 0; x <= 600; x += 20) {
    ctx.strokeStyle = rgba(BLUEPRINT, x % 100 === 0 ? 0.09 + 0.05 * lit : 0.035);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1150);
    ctx.stroke();
  }
  for (let y = 0; y <= 1150; y += 20) {
    ctx.strokeStyle = rgba(BLUEPRINT, y % 100 === 0 ? 0.09 + 0.05 * lit : 0.035);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(600, y);
    ctx.stroke();
  }
  ctx.restore();
}

function stageFloor(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(310, 300, 283, Math.PI, TAU);
  ctx.lineTo(593, 236);
  ctx.lineTo(27, 236);
  ctx.closePath();
  ctx.clip();
  const r = rng(15);
  for (let y = 8, i = 0; y < 236; y += 13, i++) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = mix('#2c1c16', '#5c3b25', 0.3 + 0.25 * r() + 0.35 * lit);
    ctx.fillRect(0, y, 600, 12);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#120a08';
    ctx.fillRect(0, y + 12, 600, 1);
    // butt joints
    for (let k = 0; k < 3; k++) ctx.fillRect(40 + ((i * 97 + k * 211) % 540), y, 1, 12);
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(310, 160, 10, 310, 160, 250);
  g.addColorStop(0, rgba(GOLD, 0.04 + 0.22 * lit));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 240);
  ctx.restore();
}

/** Velvet swags hanging from the proscenium arch, with a gold fringe. */
function valance(ctx: CanvasRenderingContext2D, lit: number) {
  const n = 9;
  const a0 = 194;
  const a1 = 346;
  const P = (a: number, rr: number): Pt => [310 + Math.cos(a) * rr, 300 + Math.sin(a) * rr];
  for (let i = 0; i < n; i++) {
    const aa = (a0 + ((a1 - a0) * i) / n) * D2R;
    const ab = (a0 + ((a1 - a0) * (i + 1)) / n) * D2R;
    const am = (aa + ab) / 2;
    const [x0, y0] = P(aa, 285);
    const [cx, cy] = P(am, 226);
    const [mx, my] = P(am, 262);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.arc(310, 300, 285, aa, ab);
    ctx.quadraticCurveTo(cx, cy, x0, y0);
    const g = ctx.createLinearGradient(mx, my - 28, mx, my + 6);
    g.addColorStop(0, rgba('#4a0c1c', 0.9));
    g.addColorStop(1, rgba(mix(CRIMSON, '#ff6a7c', 0.15 + 0.45 * lit), 0.9));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.save();
    const [x1, y1] = P(ab, 285);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x0, y0);
    ctx.strokeStyle = rgba(GOLD, 0.35 + 0.55 * lit);
    ctx.lineWidth = 2.2;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.restore();
  }
  // Gold trim just inside the arch
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.arc(310, 300, 280, 192 * D2R, 348 * D2R);
  }, GOLD, 0.15 + 0.85 * lit, 2);
}

/** A side curtain, gathered toward a gold tie-back. */
function drape(ctx: CanvasRenderingContext2D, side: -1 | 1, lit: number) {
  const outer = side < 0 ? 27 : 545;
  const inner = side < 0 ? 104 : 498;
  const top = side < 0 ? 96 : 132;
  const bot = side < 0 ? 330 : 336;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(outer, top - 40);
  ctx.lineTo(inner, top);
  ctx.quadraticCurveTo(inner + side * 22, 230, (outer + inner) / 2 + side * 10, 262);
  ctx.quadraticCurveTo(inner - side * 6, 300, outer + (inner - outer) * 0.45, bot);
  ctx.lineTo(outer, bot);
  ctx.closePath();
  ctx.clip();
  const folds = 6;
  const w = (inner - outer) / folds;
  for (let i = 0; i < folds; i++) {
    const x = outer + i * w;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, rgba('#3d0817', 0.92));
    g.addColorStop(0.5, rgba(mix(CRIMSON, '#ff6f80', 0.1 + 0.45 * lit), 0.92));
    g.addColorStop(1, rgba('#3d0817', 0.92));
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(x, x + w), 40, Math.abs(w) + 1, 320);
  }
  ctx.restore();
  // tie-back
  const tx = (outer + inner) / 2 + side * 6;
  ctx.save();
  ctx.strokeStyle = rgba(GOLD, 0.45 + 0.5 * lit);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(outer, 268);
  ctx.quadraticCurveTo(tx, 276, tx + side * 14, 262);
  ctx.stroke();
  ctx.fillStyle = rgba(GOLD, 0.5 + 0.5 * lit);
  ctx.beginPath();
  ctx.arc(tx + side * 14, 262, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function footlights(ctx: CanvasRenderingContext2D, lit: number, blaze: number) {
  for (let x = 200; x <= 420; x += 20) {
    ctx.save();
    ctx.fillStyle = rgba('#1a1210', 0.85);
    ctx.beginPath();
    ctx.ellipse(x, 241, 7, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (lit > 0.02) {
      glowDot(ctx, x, 239, 12 + 10 * blaze, GOLD, 0.5 * lit + 0.3 * blaze);
      ctx.save();
      // soft upward wash onto the stage
      const g = ctx.createLinearGradient(x, 240, x, 170);
      g.addColorStop(0, rgba(GOLD, 0.1 * lit + 0.12 * blaze));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 4, 240);
      ctx.lineTo(x - 14, 170);
      ctx.lineTo(x + 14, 170);
      ctx.lineTo(x + 4, 240);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = lit > 0.02 ? rgba('#fff3c4', 0.5 + 0.5 * lit) : 'rgba(90,70,60,0.8)';
    ctx.beginPath();
    ctx.arc(x, 239, 2.6, 0, TAU);
    ctx.fill();
  }
}

/** A long polymer chain of repeat units threading the three Chain bumpers. */
function polymerChain(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.save();
  strokePts(ctx, CHAIN);
  ctx.strokeStyle = rgba(MINT, 0.18 + 0.4 * lit);
  ctx.lineWidth = 2;
  ctx.stroke();
  const pts = along(CHAIN, 15);
  pts.forEach(({ p }, i) => {
    const c = i % 2 ? MINT : BLUEPRINT;
    if (lit > 0.05) glowDot(ctx, p[0], p[1], 9, c, 0.3 * lit);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 4.5, 0, TAU);
    ctx.fillStyle = rgba(c, 0.25 + 0.6 * lit);
    ctx.fill();
  });
  ctx.restore();
}

/** Rollers printed under the conveyor's low end, plus hazard chevrons on the mouth apron. */
function conveyorPrint(ctx: CanvasRenderingContext2D, lit: number) {
  const left = offsetPath(CONVEYOR_SMOOTH, 15);
  const right = offsetPath(CONVEYOR_SMOOTH, -15);
  ctx.save();
  // belt bed along the climbing section
  ctx.beginPath();
  const n = 14;
  left.slice(0, n).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  right.slice(0, n).reverse().forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.fillStyle = rgba('#141022', 0.7);
  ctx.fill();
  const rolls = along(CONVEYOR_SMOOTH, 11, 240);
  rolls.forEach(({ p, dir }, i) => {
    const nx = -dir[1];
    const ny = dir[0];
    ctx.strokeStyle = rgba(i % 2 ? BRASS : '#8a7aa8', 0.45 + 0.4 * lit);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p[0] + nx * 13, p[1] + ny * 13);
    ctx.lineTo(p[0] - nx * 13, p[1] - ny * 13);
    ctx.stroke();
  });
  ctx.restore();
  // mouth apron chevrons
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(128, 690);
  ctx.lineTo(142, 626);
  ctx.lineTo(172, 626);
  ctx.lineTo(206, 686);
  ctx.closePath();
  ctx.clip();
  for (let i = -8; i < 12; i++) {
    ctx.fillStyle = i % 2 ? rgba(GOLD, 0.25 + 0.45 * lit) : rgba(INK, 0.7);
    ctx.beginPath();
    ctx.moveTo(110 + i * 12, 700);
    ctx.lineTo(122 + i * 12, 700);
    ctx.lineTo(162 + i * 12, 620);
    ctx.lineTo(150 + i * 12, 620);
    ctx.fill();
  }
  ctx.restore();
}

/** Brass works behind the conveyor's climb (a closed slot no ball can reach). */
function machinery(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.save();
  ctx.fillStyle = rgba('#0d0a1c', 0.6);
  ctx.fillRect(78, 378, 56, 230);
  gear(ctx, 104, 420, 22, 11, 0.2, rgba(BRASS, 0.3 + 0.45 * lit));
  gear(ctx, 118, 466, 14, 8, 0.6, rgba(COPPER, 0.3 + 0.45 * lit));
  gear(ctx, 98, 512, 18, 10, 0.1, rgba(BRASS, 0.25 + 0.45 * lit));
  rrect(ctx, 100, 540, 10, 66, 4);
  ctx.fillStyle = rgba('#8a7aa8', 0.4 + 0.3 * lit);
  ctx.fill();
  for (const y of [556, 584]) {
    ctx.fillStyle = rgba(GOLD, 0.35 + 0.5 * lit);
    ctx.fillRect(96, y, 18, 5);
  }
  ctx.restore();
}

function supplyChevrons(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.save();
  for (let y = 624; y >= 380; y -= 30) {
    if (Math.abs(y - 470) < 18 || Math.abs(y - 600) < 22) continue;
    ctx.strokeStyle = rgba(GOLD, 0.25 + 0.6 * lit);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(39, y + 6);
    ctx.lineTo(49, y - 4);
    ctx.lineTo(59, y + 6);
    ctx.stroke();
  }
  ctx.restore();
}

function constraintsArt(ctx: CanvasRenderingContext2D, lit: number) {
  const keys: (keyof typeof ICONS)[] = ['coin', 'clock', 'wrench'];
  keys.forEach((k, i) => medallion(ctx, k, 225, DROP_Y[i], 10, CORAL, lit));
  ctx.save();
  ctx.translate(250, 432);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '800 10px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(CORAL, 0.4 + 0.55 * lit);
  ctx.fillText('CONSTRAINTS', 0, 0);
  ctx.restore();
}

function resourceArt(ctx: CanvasRenderingContext2D, lit: number) {
  const keys: (keyof typeof ICONS)[] = ['corn', 'oil', 'yew'];
  const cols = [CORN, COPPER, LEAF];
  // Medallions sit clear of the 2D view's target labels (16 units in front of each bin).
  keys.forEach((k, i) => medallion(ctx, k, 447, RES_Y[i], 10, cols[i], lit));
  ctx.save();
  ctx.translate(430, 478);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '800 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(CORN, 0.35 + 0.55 * lit);
  ctx.fillText('NATURAL RESOURCES', 0, 0);
  ctx.restore();
}

/** Lane stripes and a stress gauge inside the Prototype Test Lane. */
function testLaneArt(ctx: CanvasRenderingContext2D, lit: number, level: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(548, 344);
  ctx.lineTo(499, 395);
  ctx.lineTo(499, 640);
  ctx.lineTo(548, 640);
  ctx.closePath();
  ctx.clip();
  for (let y = 380, i = 0; y < 640; y += 22, i++) {
    ctx.fillStyle = i % 2 ? rgba(MINT, 0.05 + 0.08 * lit) : rgba(INK, 0.35);
    ctx.fillRect(499, y, 50, 22);
  }
  ctx.restore();
  // Printed names: the Test Bay lock under its ring, the FLEX spinner below it.
  ctx.save();
  ctx.font = '800 8px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(MINT, 0.45 + 0.55 * lit);
  ctx.fillText('TEST', 521, 484);
  ctx.fillText('BAY', 521, 495);
  ctx.fillStyle = rgba(GOLD, 0.45 + 0.55 * lit);
  ctx.fillText('FLEX', 521, 581);
  ctx.restore();
  // stress gauge
  const gx = 522;
  const gy = 605;
  ctx.save();
  ctx.beginPath();
  ctx.arc(gx, gy, 12, 0, TAU);
  ctx.fillStyle = rgba(IVORY, 0.12 + 0.25 * lit);
  ctx.fill();
  ctx.strokeStyle = rgba(BRASS, 0.5 + 0.5 * lit);
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (0.8 + (1.4 * i) / 6);
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(a) * 8.5, gy + Math.sin(a) * 8.5);
    ctx.lineTo(gx + Math.cos(a) * 11, gy + Math.sin(a) * 11);
    ctx.strokeStyle = i > 4 ? rgba(CORAL, 0.8) : rgba(INK, 0.8);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  const na = Math.PI * (0.85 + 0.3 * Math.min(4, level));
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + Math.cos(na) * 9, gy + Math.sin(na) * 9);
  ctx.strokeStyle = rgba(CORAL, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** The cup design on the drafting sheet, with a zoom on its long polymer chains. */
function blueprintCard(ctx: CanvasRenderingContext2D, lit: number, win: number) {
  const x = 336;
  const y = 528;
  const w = 104;
  const h = 104;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.06);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  rrect(ctx, x, y, w, h, 6);
  ctx.fillStyle = rgba('#2b5aa8', 0.22 + 0.14 * lit);
  ctx.fill();
  ctx.strokeStyle = rgba(BLUEPRINT, 0.35 + 0.45 * lit);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // cup elevation
  const line = rgba(win > 0.05 ? mix(BLUEPRINT, GOLD, win) : BLUEPRINT, 0.45 + 0.5 * Math.max(lit, win));
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(350, 544);
  ctx.lineTo(392, 544);
  ctx.lineTo(385, 606);
  ctx.lineTo(357, 606);
  ctx.closePath();
  ctx.stroke();
  if (win > 0.05) {
    ctx.fillStyle = rgba(GOLD, 0.35 * win);
    ctx.fill();
  }
  // dimension marks
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(350, 538);
  ctx.lineTo(392, 538);
  ctx.moveTo(398, 544);
  ctx.lineTo(398, 606);
  ctx.stroke();
  ctx.setLineDash([]);
  // zoom bubble: long, flexible chains
  ctx.beginPath();
  ctx.moveTo(380, 580);
  ctx.lineTo(408, 594);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(420, 600, 16, 0, TAU);
  ctx.fillStyle = rgba(INK, 0.7);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    for (let s = 0; s <= 30; s++) {
      const xx = 403 + s * 1.2;
      const yy = 590 + k * 6 + Math.sin(s * 0.7 + k) * 2.5;
      if (s) ctx.lineTo(xx, yy);
      else ctx.moveTo(xx, yy);
    }
    ctx.strokeStyle = rgba(k % 2 ? MINT : GOLD, 0.4 + 0.55 * lit);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
  ctx.font = '800 8px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(BLUEPRINT, 0.45 + 0.5 * lit);
  ctx.fillText('PLA CUP', 371, 622);
  ctx.fillText('LONG CHAINS', 418, 626);
  ctx.restore();
  if (win > 0.05) {
    glowDot(ctx, 371, 575, 60, GOLD, 0.35 * win);
  }
}

/** NATURAL -> PROCESS -> SYNTHETIC teaching strip above the slings. */
function flowStrip(ctx: CanvasRenderingContext2D, lit: number) {
  const y = 752;
  medallion(ctx, 'corn', 228, y, 13, CORN, lit);
  medallion(ctx, 'cup', 372, y, 13, MINT, lit);
  // process: a gear medallion
  ctx.save();
  if (lit > 0.05) glowDot(ctx, 300, y, 28, GOLD, 0.35 * lit);
  ctx.beginPath();
  ctx.arc(300, y, 13, 0, TAU);
  ctx.fillStyle = rgba(INK, 0.75);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(GOLD, 0.35 + 0.6 * lit);
  ctx.stroke();
  ctx.restore();
  gear(ctx, 300, y, 9, 9, 0.2, rgba(GOLD, 0.35 + 0.65 * lit));
  for (const ax of [252, 324]) {
    ctx.save();
    ctx.strokeStyle = rgba(IVORY, 0.25 + 0.55 * lit);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, y);
    ctx.lineTo(ax + 24, y);
    ctx.moveTo(ax + 17, y - 6);
    ctx.lineTo(ax + 24, y);
    ctx.lineTo(ax + 17, y + 6);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.font = '800 8.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(IVORY, 0.35 + 0.55 * lit);
  ctx.fillText('NATURAL', 228, y + 26);
  ctx.fillText('PROCESS', 300, y + 26);
  ctx.fillText('SYNTHETIC', 372, y + 26);
  ctx.restore();
}

function sceneryBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.4, 4);
  // Drafting-table lacquer with a blueprint grid
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1b2b66'], [0.45, '#15235a'], [0.8, NAVY], [1, '#0b1233']]);
  ctx.fillRect(0, 0, 600, 1150);
  blueprintGrid(ctx, s1);
  // The stage
  stageFloor(ctx, 0.25 * s1 + 0.75 * s4);
  valance(ctx, 0.2 + 0.4 * s1 + 0.4 * s4);
  drape(ctx, -1, 0.2 + 0.4 * s1 + 0.4 * s4);
  drape(ctx, 1, 0.2 + 0.4 * s1 + 0.4 * s4);
  plaque(ctx, 'DESIGN CRITERIA', 310, 52, rgba(GOLD, 0.35 + 0.6 * Math.max(s3, 0.25 * s1)), INK, 9);
  polymerChain(ctx, s2);
  footlights(ctx, 0.35 * s1 + 0.65 * s3, s4);
  // Left wing: supply route, machinery, conveyor apron, constraints
  supplyChevrons(ctx, s1);
  machinery(ctx, s2);
  conveyorPrint(ctx, s1);
  constraintsArt(ctx, s3);
  // Right wing: sources and the test lane
  resourceArt(ctx, s1);
  testLaneArt(ctx, s3, level);
  plaque(ctx, 'PROTOTYPE TEST LANE', 488, 752, rgba(MINT, 0.3 + 0.65 * s3), INK, 8);
  // Centre: drafting sheet, marquee, flow strip
  blueprintCard(ctx, s2, s4);
  // Marquee sits between the conveyor's flare and the Test Lane post.
  neonText(ctx, "INVENTOR'S", 318, 652, 14, CORAL, s2);
  neonText(ctx, 'WONDERWORKS', 318, 676, 21, GOLD, s3);
  flowStrip(ctx, s1);
  // Soft spotlight pool between the flippers
  ctx.save();
  const sp = ctx.createRadialGradient(286, 960, 10, 286, 960, 170);
  sp.addColorStop(0, rgba(GOLD, 0.04 + 0.08 * s4));
  sp.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = sp;
  ctx.fillRect(100, 790, 380, 330);
  ctx.restore();
  // Wonderlight: the whole theatre glows
  if (s4 > 0.01) {
    stars(ctx, 41, 70, [40, 280, 560, 800], IVORY);
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
  }
}

// ================================================================ 3D attraction set

const GY = -0.42;

function canvasTex(kit: SetKit, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = kit.track(new kit.THREE.CanvasTexture(c));
  tex.colorSpace = kit.THREE.SRGBColorSpace;
  return tex;
}

function glowMat(kit: SetKit, color: string, base = 0.05): THREE.MeshStandardMaterial {
  return kit.track(new kit.THREE.MeshStandardMaterial({ color: '#0d0a14', emissive: color, emissiveIntensity: base, roughness: 0.4 }));
}

/** Additive material with a fixed colour; brightness is driven through opacity. */
function additiveMat(kit: SetKit, color: string, map?: THREE.Texture): THREE.MeshBasicMaterial {
  const T = kit.THREE;
  return kit.track(new T.MeshBasicMaterial({ color, map, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
}

/**
 * Soft volumetric beam: additive, brightest where the cone faces the viewer and fading to nothing
 * at its silhouette and at the lamp end, so it never reads as a hard-edged sheet.
 */
function beamMaterial(kit: SetKit, color: string): { mat: THREE.ShaderMaterial; opacity: { value: number } } {
  const T = kit.THREE;
  const opacity = { value: 0 };
  const mat = kit.track(new T.ShaderMaterial({
    uniforms: { uColor: { value: new T.Color(color) }, uOpacity: opacity },
    vertexShader: `varying vec3 vN; varying vec3 vView; varying float vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        vV = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vView; varying float vV;
      void main() {
        float f = abs(dot(normalize(vN), normalize(vView)));
        float a = uOpacity * f * f * smoothstep(1.0, 0.55, vV);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide,
  }));
  return { mat, opacity };
}

/**
 * Theatre follow-spot: an open cone of light from a lamp high above a wing down to a floor point,
 * plus a soft pool where it lands. Both sit entirely outside the playfield (|x| > 3.8).
 */
function makeShaft(kit: SetKit, from: V3, to: V3, rTop: number, rBottom: number, color: string, poolTex: THREE.Texture) {
  const T = kit.THREE;
  const a = new T.Vector3(from[0], from[1], from[2]);
  const b = new T.Vector3(to[0], to[1], to[2]);
  const beam = beamMaterial(kit, color);
  const cone = kit.add(new T.Mesh(new T.CylinderGeometry(rTop, rBottom, a.distanceTo(b), 32, 1, true), beam.mat));
  cone.position.copy(a).add(b).multiplyScalar(0.5);
  cone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), a.clone().sub(b).normalize());
  const poolMat = additiveMat(kit, color, poolTex);
  const pool = kit.add(new T.Mesh(new T.CircleGeometry(rBottom * 1.55, 40), poolMat));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(to[0], GY + 0.015, to[2]);
  return { beam: beam.opacity, poolMat };
}

function cupGeometry(kit: SetKit, h: number): THREE.LatheGeometry {
  const V = kit.THREE.Vector2;
  const pts = [new V(0, 0), new V(h * 0.33, 0), new V(h * 0.355, h * 0.04), new V(h * 0.5, h), new V(h * 0.475, h), new V(h * 0.33, h * 0.06), new V(0, h * 0.06)];
  return new kit.THREE.LatheGeometry(pts, 32);
}

/** Folded velvet drape: a plane rippled into pleats. */
function makeDrape(kit: SetKit, w: number, h: number, pleats: number, color: string): THREE.Mesh {
  const T = kit.THREE;
  const geo = new T.PlaneGeometry(w, h, pleats * 8, 6);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const gather = 0.6 + 0.4 * ((y + h / 2) / h);
    p.setX(i, x * gather);
    p.setZ(i, Math.sin((x / w) * pleats * TAU) * 0.09 * (1.2 - gather * 0.4));
  }
  geo.computeVertexNormals();
  const mat = kit.track(new T.MeshPhysicalMaterial({ color, roughness: 0.78, sheen: 1, sheenColor: new T.Color('#ff9aa8'), sheenRoughness: 0.45, side: T.DoubleSide }));
  const m = new T.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** Maker's mill: sawtooth-roofed workshop with a glowing round window, chimney and gears. */
function makeFactory(kit: SetKit) {
  const T = kit.THREE;
  const g = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(2.0, 1.25, 1.3), kit.mats.paintedMetal('#3a2f5c'));
  body.position.y = 0.62;
  body.castShadow = true;
  body.receiveShadow = true;
  const roofShape = new T.Shape();
  roofShape.moveTo(-1.0, 0);
  for (let i = 0; i < 3; i++) {
    roofShape.lineTo(-1.0 + i * 0.667, 0.42);
    roofShape.lineTo(-1.0 + (i + 1) * 0.667, 0);
  }
  roofShape.lineTo(-1.0, 0);
  const roof = new T.Mesh(new T.ExtrudeGeometry(roofShape, { depth: 1.3, bevelEnabled: false }), kit.mats.paintedMetal('#6b2f3c'));
  roof.position.set(0, 1.25, -0.65);
  roof.castShadow = true;
  const winMat = glowMat(kit, GOLD, 0.1);
  const win = new T.Mesh(new T.CircleGeometry(0.3, 32), winMat);
  win.position.set(-0.35, 0.72, 0.66);
  const doorMat = glowMat(kit, COPPER, 0.08);
  const door = new T.Mesh(new T.PlaneGeometry(0.42, 0.62), doorMat);
  door.position.set(0.5, 0.31, 0.66);
  const rim = new T.Mesh(new T.TorusGeometry(0.31, 0.03, 8, 40), kit.mats.brass());
  rim.position.copy(win.position);
  const chimney = new T.Mesh(new T.CylinderGeometry(0.13, 0.17, 1.2, 14), kit.mats.paintedMetal('#2a2238'));
  chimney.position.set(0.7, 1.95, -0.3);
  const band = new T.Mesh(new T.TorusGeometry(0.15, 0.025, 6, 20), kit.mats.brass());
  band.rotation.x = Math.PI / 2;
  band.position.set(0.7, 2.4, -0.3);
  g.add(body, roof, win, rim, door, chimney, band);
  return { g, winMat, doorMat };
}

/** Oil pumpjack: a walking beam that nods over the wellhead. */
function makePumpjack(kit: SetKit) {
  const T = kit.THREE;
  const g = new T.Group();
  const steel = kit.mats.paintedMetal('#4a4368');
  const base = new T.Mesh(new T.BoxGeometry(1.5, 0.1, 0.42), kit.mats.paintedMetal('#2a2238'));
  base.position.y = 0.05;
  const legGeo = new T.CylinderGeometry(0.035, 0.045, 1.05, 8);
  const legA = new T.Mesh(legGeo, steel);
  legA.position.set(-0.08, 0.55, 0.13);
  legA.rotation.x = -0.22;
  const legB = new T.Mesh(legGeo, steel);
  legB.position.set(-0.08, 0.55, -0.13);
  legB.rotation.x = 0.22;
  const beam = new T.Group();
  beam.position.set(-0.08, 1.06, 0);
  const bar = new T.Mesh(new T.BoxGeometry(1.35, 0.1, 0.12), kit.mats.paintedMetal(COPPER));
  bar.castShadow = true;
  const head = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.14, 16, 1, false, 0, Math.PI * 0.7), kit.mats.paintedMetal(COPPER));
  head.rotation.x = Math.PI / 2;
  head.rotation.z = Math.PI * 0.15;
  head.position.set(0.66, -0.02, 0);
  beam.add(bar, head);
  const crank = new T.Group();
  crank.position.set(-0.62, 0.42, 0);
  const weight = new T.Mesh(new T.BoxGeometry(0.16, 0.42, 0.2), kit.mats.paintedMetal('#2a2238'));
  weight.position.y = 0.16;
  crank.add(weight);
  const well = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 0.32, 10), kit.mats.brass());
  well.position.set(0.86, 0.26, 0);
  const rod = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.66, 6), kit.mats.chrome());
  rod.position.set(0.86, 0.72, 0);
  g.add(base, legA, legB, beam, crank, well, rod);
  return { g, beam, crank, rod };
}

/** Rows of corn: stalks, leaves and golden cobs as three instanced meshes. */
function makeCornField(kit: SetKit, cx: number, cz: number, rows: number, cols: number, rotY: number) {
  const T = kit.THREE;
  const n = rows * cols;
  const stalks = new T.InstancedMesh(new T.CylinderGeometry(0.025, 0.035, 1, 6), kit.mats.plastic('#5f9a46'), n);
  const leaves = new T.InstancedMesh(new T.ConeGeometry(0.07, 0.6, 4), kit.mats.plastic('#77c25a'), n * 2);
  const cobs = new T.InstancedMesh(new T.CapsuleGeometry(0.05, 0.16, 4, 8), kit.mats.plastic(CORN), n);
  const m = new T.Matrix4();
  const q = new T.Quaternion();
  const e = new T.Euler();
  const p = new T.Vector3();
  const s = new T.Vector3();
  const r = kit.rand(31);
  let k = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const lx = (j - (cols - 1) / 2) * 0.34 + (r() - 0.5) * 0.08;
      const lz = (i - (rows - 1) / 2) * 0.34 + (r() - 0.5) * 0.08;
      const x = cx + lx * Math.cos(rotY) + lz * Math.sin(rotY);
      const z = cz - lx * Math.sin(rotY) + lz * Math.cos(rotY);
      const h = 0.9 + r() * 0.35;
      p.set(x, GY + h / 2, z);
      s.set(1, h, 1);
      q.identity();
      m.compose(p, q, s);
      stalks.setMatrixAt(k, m);
      for (let l = 0; l < 2; l++) {
        e.set(0, r() * TAU, (l ? 1 : -1) * 0.9);
        q.setFromEuler(e);
        p.set(x, GY + h * (0.35 + l * 0.25), z);
        s.set(1, 1, 1);
        m.compose(p, q, s);
        leaves.setMatrixAt(k * 2 + l, m);
      }
      e.set(0.3, r() * TAU, 0.35);
      q.setFromEuler(e);
      p.set(x + 0.05, GY + h * 0.62, z);
      m.compose(p, q, s);
      cobs.setMatrixAt(k, m);
      k++;
    }
  }
  for (const im of [stalks, leaves, cobs]) {
    im.castShadow = true;
    kit.add(im);
  }
}

/** A small yew: dark, dense, flat-needled crown with red arils. */
function makeYew(kit: SetKit, pos: V3, h: number) {
  const T = kit.THREE;
  const g = new T.Group();
  const trunk = new T.Mesh(new T.CylinderGeometry(h * 0.05, h * 0.08, h * 0.45, 8), kit.mats.plastic('#6b3a26'));
  trunk.position.y = h * 0.22;
  g.add(trunk);
  const leaf = kit.mats.plastic('#24603f');
  const r = kit.rand(7);
  for (let i = 0; i < 4; i++) {
    const c = new T.Mesh(new T.ConeGeometry(h * (0.34 - i * 0.06), h * 0.42, 10), leaf);
    c.position.set((r() - 0.5) * 0.08, h * (0.42 + i * 0.17), (r() - 0.5) * 0.08);
    c.castShadow = true;
    g.add(c);
  }
  const arilMat = kit.mats.plastic('#ff4d5e');
  const arils = new T.InstancedMesh(new T.SphereGeometry(0.035, 8, 6), arilMat, 9);
  const m = new T.Matrix4();
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU;
    const yy = h * (0.45 + r() * 0.45);
    const rr = h * 0.3 * (1 - (yy / h - 0.4));
    m.makeTranslation(Math.cos(a) * rr, yy, Math.sin(a) * rr);
    arils.setMatrixAt(i, m);
  }
  g.add(arils);
  g.position.set(pos[0], pos[1], pos[2]);
  kit.add(g);
  return g;
}

/** Hydraulic test press flex-testing a giant prototype cup. */
function makePress(kit: SetKit) {
  const T = kit.THREE;
  const g = new T.Group();
  const base = new T.Mesh(new T.BoxGeometry(1.4, 0.24, 0.9), kit.mats.paintedMetal('#2a2238'));
  base.position.y = 0.12;
  const platen = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.06, 28), kit.mats.chrome());
  platen.position.y = 0.27;
  const colGeo = new T.CylinderGeometry(0.06, 0.06, 2.0, 12);
  const colA = new T.Mesh(colGeo, kit.mats.chrome());
  colA.position.set(-0.58, 1.1, 0);
  const colB = new T.Mesh(colGeo, kit.mats.chrome());
  colB.position.set(0.58, 1.1, 0);
  const top = new T.Mesh(new T.BoxGeometry(1.4, 0.2, 0.5), kit.mats.paintedMetal(MINT));
  top.position.y = 2.15;
  const ram = new T.Group();
  const head = new T.Mesh(new T.BoxGeometry(1.1, 0.14, 0.42), kit.mats.paintedMetal('#4a4368'));
  const piston = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.9, 12), kit.mats.chrome());
  piston.position.y = 0.5;
  ram.add(head, piston);
  ram.position.y = 1.3;
  const cupMat = kit.track(new T.MeshPhysicalMaterial({ color: '#c8fff1', roughness: 0.12, transmission: 0.55, thickness: 0.3, transparent: true, opacity: 0.85, clearcoat: 1, emissive: MINT, emissiveIntensity: 0.05 }));
  const cup = new T.Mesh(cupGeometry(kit, 0.8), cupMat);
  cup.position.y = 0.3;
  cup.castShadow = true;
  g.add(base, platen, colA, colB, top, ram, cup);
  return { g, ram, cup, cupMat };
}

function gaugeTexture(kit: SetKit) {
  return canvasTex(kit, 256, 256, (ctx) => {
    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(128, 128, 122, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#b8862e';
    ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (0.75 + (1.5 * i) / 10);
      ctx.strokeStyle = i >= 8 ? '#d23a4a' : '#2a1d10';
      ctx.lineWidth = i % 5 === 0 ? 8 : 4;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82);
      ctx.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a1d10';
    ctx.font = '800 30px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FLEX', 128, 190);
  });
}

/** Easel chalkboard: the design brief's criteria and constraints. */
function boardTexture(kit: SetKit) {
  return canvasTex(kit, 512, 384, (ctx) => {
    ctx.fillStyle = '#1d3a2f';
    ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = '#a8794a';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, 494, 366);
    ctx.fillStyle = '#fff7e7';
    ctx.textAlign = 'left';
    ctx.font = '800 50px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillText('CRITERIA', 30, 68);
    ctx.font = '700 36px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ['HOLDS a drink', 'BENDS, no cracks', 'DECAYS after use'].forEach((t, i) => ctx.fillText(`✓ ${t}`, 34, 114 + i * 42));
    ctx.fillStyle = '#ffb0a8';
    ctx.font = '800 50px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillText('CONSTRAINTS', 30, 288);
    ctx.font = '700 36px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillText('cost · time · tools', 34, 338);
  });
}

function backdropPaint(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const lit = Math.min(1, level / 4);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1030');
  g.addColorStop(0.6, mix('#1d1f52', '#3a2c6e', lit));
  g.addColorStop(1, mix('#30244f', '#7a4a5c', lit));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(9);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,247,231,${0.25 + 0.5 * r()})`;
    ctx.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5);
  }
  // Giant blueprint gear wheel rising like a moon
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.35 * lit;
  gear(ctx, w * 0.5, h * 0.42, h * 0.3, 18, 0.1, mix('#4b6fc2', GOLD, lit * 0.7));
  ctx.restore();
  // Workshop skyline: sawtooth roofs and chimneys
  ctx.fillStyle = '#120d24';
  let x = 0;
  const base = h * 0.78;
  while (x < w) {
    const bw = 40 + r() * 70;
    const bh = 40 + r() * 70;
    ctx.fillRect(x, base - bh, bw, h - base + bh);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (k * bw) / 3, base - bh);
      ctx.lineTo(x + (k * bw) / 3, base - bh - 16);
      ctx.lineTo(x + ((k + 1) * bw) / 3, base - bh);
      ctx.fill();
    }
    if (r() < 0.45) ctx.fillRect(x + bw * 0.7, base - bh - 50, 9, 50);
    for (let wy = base - bh + 10; wy < h - 12; wy += 14) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 12) {
        if (r() < 0.35 + 0.5 * lit) {
          ctx.fillStyle = r() < 0.8 ? `rgba(255,217,138,${0.35 + 0.55 * lit})` : `rgba(113,227,207,${0.35 + 0.55 * lit})`;
          ctx.fillRect(wx, wy, 5, 6);
          ctx.fillStyle = '#120d24';
        }
      }
    }
    x += bw + 4;
  }
}

const wonderworksSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  // The house lights come up with each mission: midnight navy warms to an opening-night rose.
  const skyU = (kit.sky('#1b2350', '#05060f').material as THREE.ShaderMaterial).uniforms;
  const SKY_TOP = [new T.Color('#1b2350'), new T.Color('#3b2c72'), new T.Color('#7a3d78')];
  const SKY_BOT = [new T.Color('#05060f'), new T.Color('#140d26'), new T.Color('#3a1a36')];
  kit.boardwalk('#33261f', 30);
  const backdrop = kit.backdrop(backdropPaint, { width: 26, height: 11, z: -15 });

  // ---------------------------------------------------------------- head: the proscenium
  const pillarGeo = new T.CylinderGeometry(0.22, 0.26, 4.4, 20);
  for (const sx of [-1, 1]) {
    const pillar = kit.add(new T.Mesh(pillarGeo, kit.mats.paintedMetal('#3a2f5c')));
    pillar.position.set(sx * 4.7, GY + 2.2, -7.2);
    pillar.castShadow = true;
    const cap = kit.add(new T.Mesh(new T.BoxGeometry(0.7, 0.3, 0.7), kit.mats.brass()));
    cap.position.set(sx * 4.7, GY + 4.5, -7.2);
    const drapeMesh = kit.add(makeDrape(kit, 2.6, 4.6, 6, CRIMSON));
    drapeMesh.position.set(sx * 3.4, GY + 2.25, -7.55);
  }
  const valanceMesh = kit.add(makeDrape(kit, 10.2, 0.9, 16, '#8f1f36'));
  valanceMesh.position.set(0, GY + 4.4, -7.45);
  const marquee = kit.neonSign("INVENTOR'S WONDERWORKS", [0, 1.75, -7.05], { height: 0.72, color: GOLD });
  marquee.rotation.x = -0.6;

  // The chosen design: a golden cup that rises on a pedestal when the Wonderlight is earned.
  const pedestal = kit.add(new T.Mesh(new T.CylinderGeometry(0.32, 0.42, 1.1, 24), kit.mats.paintedMetal('#2a2238')));
  pedestal.position.set(0, GY + 0.55, -8.4);
  const trophyMat = kit.track(new T.MeshPhysicalMaterial({ color: '#ffd77a', metalness: 1, roughness: 0.18, emissive: GOLD, emissiveIntensity: 0.02 }));
  const trophy = kit.add(new T.Mesh(cupGeometry(kit, 0.75), trophyMat));
  trophy.position.set(0, GY + 1.12, -8.4);
  trophy.scale.setScalar(0.01);
  const beamMat = kit.track(new T.MeshBasicMaterial({ color: '#ffe6a8', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const beam = kit.add(new T.Mesh(new T.ConeGeometry(1.1, 5.2, 32, 1, true), beamMat));
  beam.position.set(0, GY + 3.2, -8.4);

  // ---------------------------------------------------------------- left wing: resources to process
  // Natural resources at the front: a corn patch, a nodding oil pumpjack and a slow-growing yew.
  makeCornField(kit, -6.3, 3.05, 3, 4, 0.35);
  const pump = makePumpjack(kit);
  pump.g.position.set(-6.25, GY, 0.55);
  pump.g.rotation.y = 0.55;
  kit.add(pump.g);
  makeYew(kit, [-7.0, GY, -2.45], 2.1);
  const cornSign = kit.panel('CORN', [-6.15, -0.05, 4.25], { w: 0.95, h: 0.3, bg: CORN, rotY: 0.35 });
  const oilSign = kit.panel('CRUDE OIL', [-6.85, -0.05, 1.35], { w: 1.25, h: 0.3, bg: COPPER, rotY: 0.4 });
  const yewSign = kit.panel('YEW NEEDLES', [-6.95, -0.05, -1.0], { w: 1.35, h: 0.3, bg: LEAF, rotY: 0.45 });
  for (const s of [cornSign, oilSign, yewSign]) s.rotation.x = -0.6;

  // A working conveyor belt carries crates of raw material up to the mill.
  const beltA = new T.Vector3(-5.05, 0, 3.7);
  const beltB = new T.Vector3(-4.45, 0, -3.3);
  const beltLen = beltA.distanceTo(beltB);
  const beltAng = Math.atan2(beltB.x - beltA.x, beltB.z - beltA.z);
  const belt = new T.Group();
  belt.position.set((beltA.x + beltB.x) / 2, 0, (beltA.z + beltB.z) / 2);
  belt.rotation.y = beltAng;
  const bed = new T.Mesh(new T.BoxGeometry(0.46, 0.06, beltLen), kit.mats.rubber('#1d1a26'));
  bed.position.y = 0.42;
  bed.receiveShadow = true;
  const railL = new T.Mesh(new T.BoxGeometry(0.04, 0.12, beltLen), kit.mats.brass());
  railL.position.set(-0.25, 0.47, 0);
  const railR = railL.clone();
  railR.position.x = 0.25;
  const nLegs = 6;
  const legs = new T.InstancedMesh(new T.CylinderGeometry(0.03, 0.03, 0.84, 6), kit.mats.paintedMetal('#6b5f8f'), nLegs * 2);
  const nRoll = kit.n(22);
  const rollers = new T.InstancedMesh(new T.CylinderGeometry(0.035, 0.035, 0.5, 8), kit.mats.chrome(), nRoll);
  const tm = new T.Matrix4();
  const tq = new T.Quaternion().setFromEuler(new T.Euler(0, 0, Math.PI / 2));
  const tp = new T.Vector3();
  const ts = new T.Vector3(1, 1, 1);
  for (let i = 0; i < nLegs; i++) {
    for (const sx of [-0.2, 0.2]) {
      tm.makeTranslation(sx, 0.0, -beltLen / 2 + 0.3 + (i * (beltLen - 0.6)) / (nLegs - 1));
      legs.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), tm);
    }
  }
  for (let i = 0; i < nRoll; i++) {
    tp.set(0, 0.38, -beltLen / 2 + 0.15 + (i * (beltLen - 0.3)) / (nRoll - 1));
    tm.compose(tp, tq, ts);
    rollers.setMatrixAt(i, tm);
  }
  const nCrates = 6;
  const crates = new T.InstancedMesh(new T.BoxGeometry(0.3, 0.24, 0.3), kit.mats.wood(), nCrates);
  const kernelMat = glowMat(kit, CORN, 0.1);
  const loads = new T.InstancedMesh(new T.SphereGeometry(0.07, 10, 8), kernelMat, nCrates);
  crates.castShadow = true;
  belt.add(bed, railL, railR, legs, rollers, crates, loads);
  kit.add(belt);
  const placeCrates = (u: number) => {
    for (let i = 0; i < nCrates; i++) {
      const f = (((u + i / nCrates) % 1) + 1) % 1;
      tp.set(0, 0.57, -beltLen / 2 + 0.2 + f * (beltLen - 0.4));
      tm.makeTranslation(tp.x, tp.y, tp.z);
      crates.setMatrixAt(i, tm);
      tm.makeTranslation(tp.x, tp.y + 0.16, tp.z);
      loads.setMatrixAt(i, tm);
    }
    crates.instanceMatrix.needsUpdate = true;
    loads.instanceMatrix.needsUpdate = true;
  };
  placeCrates(0);

  // The mill where chemical processes turn resources into new materials.
  const mill = makeFactory(kit);
  mill.g.position.set(-5.85, GY, -4.75);
  mill.g.rotation.y = 0.5;
  kit.add(mill.g);
  const millGears = [
    kit.gear([-7.15, 0.75, -3.75], 0.55, 12, BRASS, 0.12),
    kit.gear([-7.55, 1.45, -3.45], 0.34, 9, COPPER, 0.1),
  ];
  millGears.forEach((gm) => (gm.rotation.y = 0.5));
  const steam = kit.motes({ x0: -5.6, x1: -5.0, y0: 2.2, y1: 4.6, z0: -5.4, z1: -4.8 }, 36, '#d8e2ff', { speed: 0.35, size: 0.24 });
  const millSign = kit.neonSign('CHEMICAL PROCESSES', [-5.5, 2.4, -3.9], { height: 0.4, color: GOLD, rotY: 0.5 });
  millSign.rotation.x = -0.45;
  const resSign = kit.neonSign('NATURAL RESOURCES', [-5.55, 0.5, 5.25], { height: 0.38, color: CORN, rotY: 0.25 });
  resSign.rotation.x = -0.65;

  // ---------------------------------------------------------------- right wing: the test lab
  const press = makePress(kit);
  press.g.position.set(6.0, GY, -4.2);
  press.g.rotation.y = -0.5;
  kit.add(press.g);
  const gaugeTex = gaugeTexture(kit);
  const gaugeFace = kit.track(new T.MeshStandardMaterial({ map: gaugeTex, emissive: '#fff0c8', emissiveMap: gaugeTex, emissiveIntensity: 0.1 }));
  const gauge = new T.Group();
  const gaugeBack = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.1, 32), kit.mats.brass());
  gaugeBack.rotation.x = Math.PI / 2;
  const face = new T.Mesh(new T.CircleGeometry(0.38, 32), gaugeFace);
  face.position.z = 0.06;
  const needle = new T.Mesh(new T.BoxGeometry(0.03, 0.3, 0.01), kit.mats.paintedMetal('#d23a4a'));
  needle.geometry.translate(0, 0.13, 0);
  needle.position.z = 0.075;
  gauge.add(gaugeBack, face, needle);
  gauge.position.set(7.55, 1.55, -3.2);
  gauge.rotation.set(-0.35, -0.55, 0);
  kit.add(gauge);
  kit.pole([7.55, 0, -3.35], 1.15, '#6b5f8f');
  const labSign = kit.neonSign('PROTOTYPE TEST LAB', [5.55, 0.5, 5.25], { height: 0.38, color: MINT, rotY: -0.25 });
  labSign.rotation.x = -0.65;

  // Industrial composter: PLA breaks down quickly only when kept hot and moist for weeks.
  const vat = kit.add(new T.Mesh(new T.CylinderGeometry(0.62, 0.55, 0.95, 28, 1, true), kit.mats.paintedMetal('#4a4368')));
  vat.position.set(5.75, GY + 0.47, -1.1);
  const vatRim = kit.add(new T.Mesh(new T.TorusGeometry(0.62, 0.04, 8, 40), kit.mats.brass()));
  vatRim.rotation.x = Math.PI / 2;
  vatRim.position.set(5.75, GY + 0.95, -1.1);
  const compostMat = glowMat(kit, '#ff8a3c', 0.1);
  const compost = kit.add(new T.Mesh(new T.CircleGeometry(0.58, 28), compostMat));
  compost.rotation.x = -Math.PI / 2;
  compost.position.set(5.75, GY + 0.78, -1.1);
  const compostSteam = kit.motes({ x0: 5.4, x1: 6.1, y0: 0.5, y1: 2.4, z0: -1.45, z1: -0.75 }, 30, '#ffd2a6', { speed: 0.3, size: 0.2 });
  const compostSign = kit.panel('HOT COMPOST TEST', [5.6, 0.1, -0.2], { w: 1.7, h: 0.3, bg: '#ff9a62', rotY: -0.25 });
  compostSign.rotation.x = -0.5;

  // The design brief on an easel.
  const board = new T.Group();
  const boardTex = boardTexture(kit);
  const boardFace = kit.track(new T.MeshStandardMaterial({ map: boardTex, roughness: 0.9, emissive: '#ffffff', emissiveMap: boardTex, emissiveIntensity: 0.08 }));
  const slate = new T.Mesh(new T.BoxGeometry(2.1, 1.58, 0.07), [kit.mats.wood(), kit.mats.wood(), kit.mats.wood(), kit.mats.wood(), boardFace, kit.mats.wood()]);
  slate.position.y = 1.35;
  slate.rotation.x = -0.5;
  const legGeo = new T.CylinderGeometry(0.035, 0.035, 2.0, 6);
  const legL = new T.Mesh(legGeo, kit.mats.wood());
  legL.position.set(-0.8, 0.9, 0.2);
  legL.rotation.x = -0.35;
  const legR = legL.clone();
  legR.position.x = 0.8;
  board.add(slate, legL, legR);
  board.position.set(6.3, GY, 2.05);
  board.rotation.y = -0.3;
  kit.add(board);

  // Sample shelf: jars of materials made from natural resources (PLA pellets, polyester fibre,
  // food dye, rubber and more).
  const shelf = new T.Group();
  const boardGeo = new T.BoxGeometry(1.5, 0.05, 0.42);
  const shelfWood = kit.mats.wood();
  for (const y of [0.05, 0.62, 1.19]) {
    const plank = new T.Mesh(boardGeo, shelfWood);
    plank.position.y = y;
    shelf.add(plank);
  }
  const sides = new T.InstancedMesh(new T.BoxGeometry(0.05, 1.3, 0.42), shelfWood, 2);
  tm.makeTranslation(-0.75, 0.64, 0);
  sides.setMatrixAt(0, tm);
  tm.makeTranslation(0.75, 0.64, 0);
  sides.setMatrixAt(1, tm);
  shelf.add(sides);
  const nJars = 8;
  const jars = new T.InstancedMesh(new T.CylinderGeometry(0.13, 0.13, 0.34, 16, 1, true), kit.mats.clearPlastic('#e8f6ff', 0.3), nJars);
  const fillMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 }));
  const fills = new T.InstancedMesh(new T.CylinderGeometry(0.11, 0.11, 0.22, 14), fillMat, nJars);
  const jarColors = ['#f4f1e6', '#5b8cff', '#2e6bff', '#ffd45a', '#3a3550', '#ff9a62', '#7fdc8a', '#e05a7a'];
  for (let i = 0; i < nJars; i++) {
    const row = i < 4 ? 0 : 1;
    const x = -0.52 + (i % 4) * 0.35;
    const y = row ? 0.81 : 0.24;
    tm.makeTranslation(x, y, 0);
    jars.setMatrixAt(i, tm);
    tm.makeTranslation(x, y - 0.05, 0);
    fills.setMatrixAt(i, tm);
    fills.setColorAt(i, new T.Color(jarColors[i]));
  }
  shelf.add(jars, fills);
  shelf.position.set(7.2, GY, -2.25);
  shelf.rotation.y = -0.55;
  kit.add(shelf);
  const sampleSign = kit.panel('MATERIAL SAMPLES', [7.0, 1.18, -1.9], { w: 1.6, h: 0.28, bg: MINT, rotY: -0.55 });
  sampleSign.rotation.x = -0.35;

  // Winners' plinth: two prototype orbs light for the two-ball test run, and the chosen design
  // (a golden cup) rises between them when the Wonderlight is earned.
  const WX = 4.45;
  const WZ = 4.0;
  const plinth = kit.add(new T.Mesh(new T.CylinderGeometry(0.42, 0.5, 0.7, 28), kit.mats.paintedMetal('#2a2238')));
  plinth.position.set(WX, GY + 0.35, WZ);
  const plinthRim = kit.add(new T.Mesh(new T.TorusGeometry(0.43, 0.035, 8, 40), kit.mats.brass()));
  plinthRim.rotation.x = Math.PI / 2;
  plinthRim.position.set(WX, GY + 0.7, WZ);
  const orbs = [kit.orb([WX - 0.36, GY + 0.84, WZ], 0.12, MINT), kit.orb([WX + 0.36, GY + 0.84, WZ], 0.12, MINT)];
  const winMat = kit.track(new T.MeshPhysicalMaterial({ color: '#ffd77a', metalness: 1, roughness: 0.16, emissive: GOLD, emissiveIntensity: 0.02 }));
  const winner = kit.add(new T.Mesh(cupGeometry(kit, 0.95), winMat));
  winner.position.set(WX, GY + 0.72, WZ);
  winner.scale.setScalar(0.01);
  const ringPts: V3[] = [];
  for (let i = 0; i < 12; i++) ringPts.push([WX + Math.cos((i / 12) * TAU) * 0.62, GY + 0.06, WZ + Math.sin((i / 12) * TAU) * 0.62]);
  const winRing = kit.neonTube(ringPts, GOLD, { radius: 0.03, closed: true });

  // Opening-night follow-spots: two soft shafts of light fall from the flies onto the wings, the
  // left onto the mill's door (chemical processes), the right onto the chosen design. Both come
  // from lamps behind their targets (never from the camera side), so they don't veil the signs.
  const poolTex = canvasTex(kit, 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  const shaftL = makeShaft(kit, [-9.2, 8.0, -7.6], [-5.35, GY, -3.95], 0.16, 1.0, '#ffc66a', poolTex);
  const shaftR = makeShaft(kit, [3.95, 7.6, 0.4], [WX, GY, WZ], 0.14, 0.8, '#fff0c8', poolTex);

  // ---------------------------------------------------------------- corners, lights and sky
  const bigGears = [
    kit.gear([-4.55, 2.35, -6.3], 0.85, 16, BRASS, 0.16),
    kit.gear([-3.95, 1.32, -6.45], 0.48, 10, COPPER, 0.12),
    kit.gear([4.55, 2.35, -6.3], 0.85, 16, BRASS, 0.16),
    kit.gear([3.95, 1.32, -6.45], 0.48, 10, COPPER, 0.12),
  ];
  for (const [x, z, h] of [[-9, -7.6, 4.8], [9, -7.6, 4.8], [-8.6, -2, 3.4], [-4.5, 4.4, 2.8]] as V3[]) kit.pole([x, 0, z], h, '#6b5f8f');
  // The head strand is only seen in the fly-in, so it stays short (one mesh per bulb).
  const lightsHead = kit.stringLights([-9, 4.8, -7.6], [9, 4.8, -7.6], 0.8, kit.n(14), [GOLD, CORAL, MINT]);
  const lightsL = kit.stringLights([-8.6, 3.4, -2], [-4.5, 2.8, 4.4], 0.45, kit.n(12), [GOLD, CORN]);
  // Sparks drift over the wings only, never over the playfield.
  const sparks = [
    kit.motes({ x0: -10, x1: -3.9, y0: 0, y1: 5, z0: -9, z1: 6 }, 50, GOLD, { speed: 0.1, size: 0.11 }),
    kit.motes({ x0: 3.9, x1: 10, y0: 0, y1: 5, z0: -9, z1: 6 }, 50, '#ffe6a8', { speed: 0.1, size: 0.11 }),
  ];
  const fw = kit.fireworks({ x0: -6, x1: 6, y0: 5.5, y1: 8, z: -10 }, [GOLD, CORAL, MINT, BLUEPRINT]);
  const fwL = kit.fireworks({ x0: -8.4, x1: -5.4, y0: 2.8, y1: 3.8, z: -1.2 }, [GOLD, CORN, CORAL]);
  const fwR = kit.fireworks({ x0: 5.4, x1: 8.4, y0: 2.8, y1: 3.8, z: -1.2 }, [GOLD, MINT, BLUEPRINT]);
  kit.spot([-4.4, 6.2, 2.2], [-6.0, 0.5, -2.0], GOLD, 30, 0.55);
  kit.spot([4.4, 6.2, 2.2], [6.0, 0.6, -2.0], MINT, 28, 0.55);
  const glow = kit.point([WX, GY + 2.0, WZ + 0.4], GOLD, 0, 5);

  // Animation state shared with kit.animate (frozen while paused, skipped for reduced motion).
  let lv = 0;
  let beltU = 0;
  let pumpPh = 0;
  let pressPh = 0;
  let spin = 0;
  kit.animate((t, dt) => {
    const s1 = kit.stage(lv, 0.3, 1.2);
    const s2 = kit.stage(lv, 1.3, 2.2);
    const s3 = kit.stage(lv, 2.3, 3.1);
    const s4 = kit.stage(lv, 3.5, 4);
    beltU += dt * (0.015 + 0.05 * s1 + 0.05 * s4);
    placeCrates(beltU);
    pumpPh += dt * (0.5 + 1.4 * s1);
    pump.beam.rotation.z = Math.sin(pumpPh) * 0.22;
    pump.crank.rotation.z = -pumpPh;
    pump.rod.position.y = 0.72 + Math.sin(pumpPh) * 0.12;
    spin += dt * (0.08 + 0.5 * s2 + 0.6 * s4);
    millGears[0].rotation.z = spin;
    millGears[1].rotation.z = -spin * 1.7;
    bigGears[0].rotation.z = spin * 0.6;
    bigGears[1].rotation.z = -spin * 1.1;
    bigGears[2].rotation.z = -spin * 0.6;
    bigGears[3].rotation.z = spin * 1.1;
    // The press flex-tests the prototype cup while the gauge needle reads the load.
    pressPh += dt * (0.4 + 1.1 * s2);
    const squeeze = Math.max(0, Math.sin(pressPh)) * (0.25 + 0.75 * s2);
    press.ram.position.y = 1.3 - squeeze * 0.24;
    press.cup.scale.set(1 + squeeze * 0.07, 1 - squeeze * 0.12, 1 + squeeze * 0.07);
    needle.rotation.z = 1.9 - squeeze * 2.2 - 0.6 * s3;
    trophy.rotation.y = t * 0.6;
    winner.rotation.y = -t * 0.7;
  });

  return {
    update(t, _dt, level, energy) {
      lv = level;
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.5, 4);
      backdrop.repaint(level);
      // Dormant theatre still glows softly: never a black void.
      marquee.setLit(0.15 + 0.5 * s1 + 0.35 * s3);
      resSign.setLit(0.2 + 0.8 * s1);
      millSign.setLit(0.15 + 0.85 * s1);
      labSign.setLit(0.2 + 0.8 * s3);
      mill.winMat.emissiveIntensity = 0.12 + 2.2 * s1 + 0.6 * energy * s1;
      mill.doorMat.emissiveIntensity = 0.08 + 1.4 * s1;
      kernelMat.emissiveIntensity = 0.1 + 1.6 * s1;
      steam.setLit(0.15 + 0.5 * s1);
      press.cupMat.emissiveIntensity = 0.05 + 0.9 * s2;
      gaugeFace.emissiveIntensity = 0.08 + 0.25 * s2;
      compostMat.emissiveIntensity = 0.1 + 2.4 * s3 * (kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2));
      compostSteam.setLit(0.1 + 0.6 * s3);
      boardFace.emissiveIntensity = 0.08 + 0.4 * s3;
      orbs[0].setLit(0.15 + 0.85 * s3);
      orbs[1].setLit(0.15 + 0.85 * s3);
      lightsHead.setLit(0.2 + 0.8 * s2);
      lightsL.setLit(0.3 + 0.7 * s0);
      sparks[0].setLit(0.2 + 0.4 * s1 + 0.4 * s4);
      sparks[1].setLit(0.2 + 0.4 * s3 + 0.4 * s4);
      // House lights: the sky warms with each mission.
      const sk = Math.min(1, 0.35 * s1 + 0.3 * s2 + 0.35 * s3);
      skyU.top.value.lerpColors(SKY_TOP[0], SKY_TOP[1], sk).lerp(SKY_TOP[2], s4);
      skyU.bottom.value.lerpColors(SKY_BOT[0], SKY_BOT[1], sk).lerp(SKY_BOT[2], s4);
      // Follow-spots: a hint once the line is running, full beams for the Wonderlight.
      shaftL.beam.value = 0.04 * s3 + 0.12 * s4;
      shaftL.poolMat.opacity = 0.1 * s1 + 0.1 * s3 + 0.2 * s4;
      shaftR.beam.value = 0.04 * s3 + 0.13 * s4;
      shaftR.poolMat.opacity = 0.08 * s3 + 0.22 * s4;
      winRing.setLit(0.02 + 0.3 * s3 + 0.68 * s4);
      // The chosen design rises into the spotlight with the Wonderlight.
      trophy.scale.setScalar(0.01 + 0.99 * s4);
      trophy.position.y = GY + 1.12 + 0.35 * s4;
      trophyMat.emissiveIntensity = 0.02 + 0.6 * s4;
      beamMat.opacity = 0.16 * s4;
      winner.scale.setScalar(0.01 + 0.99 * s4);
      winner.position.y = GY + 0.72 + 0.28 * s4;
      winMat.emissiveIntensity = 0.02 + 0.45 * s4;
      if (glow) glow.intensity = 2.2 * s4;
      fw.setLit(s4);
      fwL.setLit(s4);
      fwR.setLit(s4);
    },
    celebrate(p) {
      const b = Math.sin(p * Math.PI);
      const s3 = kit.stage(lv, 2.3, 3.1);
      const s4 = kit.stage(lv, 3.5, 4);
      fw.setLit(Math.max(b, s4));
      fwL.setLit(Math.max(b, s4));
      fwR.setLit(Math.max(b, s4));
      beamMat.opacity = Math.max(beamMat.opacity, 0.12 * b);
      shaftL.beam.value = Math.max(shaftL.beam.value, 0.14 * b);
      shaftR.beam.value = Math.max(shaftR.beam.value, 0.16 * b);
      shaftR.poolMat.opacity = Math.max(shaftR.poolMat.opacity, 0.25 * b);
      winRing.setLit(Math.max(0.02 + 0.3 * s3 + 0.68 * s4, b));
      lightsHead.setLit(0.5 + 0.5 * b);
    },
  };
};

// ================================================================ dollhouse room

const wonderworksRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  // A tiny maker's workshop: the three resources (corn, an oil drum, a potted yew) by the bench,
  // a belt carrying crates into a flex-test press, and the winning cup on the bench.
  const bench = kit.add(new T.Mesh(new T.BoxGeometry(0.8, 0.42, 0.42), kit.mats.wood()));
  bench.position.set(-0.55, 0.21, -0.45);
  const belt = kit.add(new T.Mesh(new T.BoxGeometry(0.8, 0.05, 0.2), kit.mats.rubber('#1d1a26')));
  belt.position.set(0, 0.3, 0.2);
  const legs = new T.InstancedMesh(new T.CylinderGeometry(0.015, 0.015, 0.28, 6), kit.mats.paintedMetal('#6b5f8f'), 4);
  const m = new T.Matrix4();
  const LEGS: [number, number][] = [[-0.35, 0.12], [-0.35, 0.28], [0.35, 0.12], [0.35, 0.28]];
  for (let i = 0; i < LEGS.length; i++) {
    m.makeTranslation(LEGS[i][0], 0.14, LEGS[i][1]);
    legs.setMatrixAt(i, m);
  }
  kit.add(legs);
  const crates = new T.InstancedMesh(new T.BoxGeometry(0.1, 0.08, 0.1), kit.mats.wood(), 3);
  kit.add(crates);
  // Flex-test press at the end of the belt
  const PX = 0.72;
  const PZ = 0.2;
  const pressBase = kit.add(new T.Mesh(new T.BoxGeometry(0.3, 0.06, 0.24), kit.mats.paintedMetal('#2a2238')));
  pressBase.position.set(PX, 0.03, PZ);
  const cols = new T.InstancedMesh(new T.CylinderGeometry(0.015, 0.015, 0.52, 6), kit.mats.chrome(), 2);
  m.makeTranslation(PX - 0.12, 0.29, PZ);
  cols.setMatrixAt(0, m);
  m.makeTranslation(PX + 0.12, 0.29, PZ);
  cols.setMatrixAt(1, m);
  kit.add(cols);
  const crown = kit.add(new T.Mesh(new T.BoxGeometry(0.3, 0.05, 0.1), kit.mats.paintedMetal(MINT)));
  crown.position.set(PX, 0.56, PZ);
  const ram = kit.add(new T.Mesh(new T.BoxGeometry(0.2, 0.04, 0.14), kit.mats.paintedMetal('#4a4368')));
  ram.position.set(PX, 0.3, PZ);
  const testCup = kit.add(new T.Mesh(cupGeometry(kit, 0.16), kit.mats.clearPlastic('#c8fff1', 0.6)));
  testCup.position.set(PX, 0.06, PZ);
  // The winning design on the bench, beside its raw materials
  const cupMat = kit.track(new T.MeshPhysicalMaterial({ color: '#ffd77a', metalness: 1, roughness: 0.2, emissive: GOLD, emissiveIntensity: 0.05 }));
  const cup = kit.add(new T.Mesh(cupGeometry(kit, 0.2), cupMat));
  cup.position.set(-0.55, 0.42, -0.45);
  const cob = kit.add(new T.Mesh(new T.CapsuleGeometry(0.035, 0.12, 4, 8), kit.mats.plastic(CORN)));
  cob.rotation.z = Math.PI / 2;
  cob.position.set(-0.82, 0.46, -0.32);
  const pot = kit.add(new T.Mesh(new T.CylinderGeometry(0.05, 0.04, 0.08, 12), kit.mats.paintedMetal('#6b3a26')));
  pot.position.set(-0.24, 0.46, -0.5);
  const yew = kit.add(new T.Mesh(new T.ConeGeometry(0.07, 0.22, 8), kit.mats.plastic('#24603f')));
  yew.position.set(-0.24, 0.61, -0.5);
  const drum = kit.add(new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.2, 14), kit.mats.paintedMetal(COPPER)));
  drum.position.set(-0.86, 0.1, 0.3);
  const cog = kit.gear([0.55, 1.15, -0.84], 0.2, 10, BRASS, 0.05);
  const cog2 = kit.gear([0.86, 1.32, -0.84], 0.12, 8, COPPER, 0.04);
  const sign = kit.neonSign('WONDERWORKS', [-0.35, 1.15, -0.8], { height: 0.18, color: GOLD });
  const lamp = kit.lantern([-0.85, 1.25, -0.5], GOLD, 0.08);
  let u = 0;
  let lastT = 0;
  return {
    update(t, lit) {
      const dt = Math.min(0.1, Math.max(0, t - lastT));
      lastT = t;
      if (!kit.reducedMotion) u += dt * 0.08 * (0.2 + lit);
      for (let i = 0; i < 3; i++) {
        const f = (u + i / 3) % 1;
        m.makeTranslation(-0.33 + f * 0.66, 0.37, PZ);
        crates.setMatrixAt(i, m);
      }
      crates.instanceMatrix.needsUpdate = true;
      // The press flex-tests the prototype cup.
      const sq = kit.reducedMotion ? 0 : Math.max(0, Math.sin(t * 1.6)) * lit;
      ram.position.y = 0.3 - sq * 0.08;
      testCup.scale.set(1 + sq * 0.08, 1 - sq * 0.15, 1 + sq * 0.08);
      cog.rotation.z = kit.reducedMotion ? 0 : t * 0.5 * lit;
      cog2.rotation.z = kit.reducedMotion ? 0 : -t * 0.8 * lit;
      cupMat.emissiveIntensity = 0.05 + 0.8 * lit;
      cup.rotation.y = kit.reducedMotion ? 0 : t * 0.5;
      sign.setLit(lit);
      lamp.setLit(lit);
    },
  };
};

// ================================================================ table definition

export const L15: TableDef = {
  lessonId: 'L15',
  signature: 'A Grand Conveyor across the stage that feeds the Test Bay lock for a two-ball test run',
  ballRole: 'The Wonderball is a game token standing in for a prototype on the test line. Real materials are tested with careful measurements, not by bouncing them around a stage.',
  theme: {
    bg: ['#1b2b66', '#0b1233'],
    rail: '#e0bd8a',
    railHighlight: '#fff3e0',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: COPPER,
    accent2: MINT,
    bumperCap: '#ffcf8a',
    bumperRing: '#2a2a66',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(113,227,207,0.2)',
    trail: MINT,
  },
  lines: {
    intro: "Welcome to the Inventor's Wonderworks, where corn, crude oil and even tree needles become cups, cloth and medicine. Let's build something brilliant!",
    quark: '"Synthetic stuff is fake and harmful, and natural stuff is always safe. Right?" Professor Quark wonders, eyeing a corn-plastic cup.',
    pipTip: 'A medium launch can drop into the middle BENDS lane for a skill shot. Then aim up the right side for the CORN, OIL and YEW bins.',
  },
  build,
  skillShot: 'crit_bends',
  shots: [
    { id: 'conveyor', label: 'Grand Conveyor', on: [{ type: 'ramp', id: 'conveyor' }], insert: 'ins_conveyor' },
    { id: 'supplyLoop', label: 'Supply Loop', on: [{ type: 'shot', id: 'supply_sw' }], insert: 'ins_supply' },
    { id: 'testLane', label: 'Test Lane', on: [{ type: 'shot', id: 'test_lane_sw' }], insert: 'ins_test' },
    { id: 'testBay', label: 'Test Bay', on: [{ type: 'saucer', id: 'test_bay' }], insert: 'ins_bay' },
    { id: 'pocket', label: 'Design Desk', on: [{ type: 'saucer', id: 'design_desk' }], insert: 'ins_pocket' },
    { id: 'bank', label: 'Constraints bank', on: [{ type: 'dropBank', id: 'constraints' }], insert: 'ins_bank' },
    { id: 'chain', label: 'Chain bumpers', on: [{ type: 'bumper', group: 'chain' }], insert: 'ins_chain' },
    { id: 'resources', label: 'Resource bins', on: [{ type: 'target', group: 'resources' }], insert: 'ins_resources' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Trace It Back',
      brief: 'Every synthetic material starts as natural resources. Find the sources, send them along the Grand Conveyor, then trace the product back.',
      objectiveIds: ['L15-O1'],
      stages: [
        { kind: 'collect', text: 'Find the sources: hit CORN, OIL and YEW', match: { type: 'target', group: 'resources' }, count: 3, distinct: true, lamps: ['res_corn', 'res_oil', 'res_yew'], preview: ['resources'] },
        { kind: 'shots', text: 'Process them: ride the Grand Conveyor', shots: ['conveyor'] },
        { kind: 'discover', text: 'Trace it back at the Design Desk', pocket: 'design_desk', questions: 1 },
      ],
      discovery: "Synthetic doesn't mean fake: chemical processes rearrange the atoms of natural resources into new materials. Corn can become PLA plastic, crude oil can become polyester, and yew needles help make a cancer drug.",
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Built for the Job',
      brief: "A material's properties come from its structure. Link the polymer chain on stage, then flex-test it in the Test Lane.",
      objectiveIds: ['L15-O2'],
      stages: [
        { kind: 'collect', text: 'Link the polymer chain: 6 Chain bumper hits', match: { type: 'bumper', group: 'chain' }, count: 6, preview: ['chain'] },
        { kind: 'collect', text: 'Flex test: run the FLEX spinner twice', match: { type: 'spinner', id: 'flex_spinner' }, count: 2, preview: ['testLane', 'conveyor'] },
        { kind: 'discover', text: 'Explain the result at the Design Desk', pocket: 'design_desk', questions: 1, types: ['match', 'classify', 'order'] },
      ],
      discovery: 'Plastics are long, tangled chains of repeating units, so they are strong and thin pieces can flex. What the chains are made of matters too: PLA is fairly stiff and can crack. Structure decides properties.',
      reward: 'jackpot',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Prototype Test Run',
      brief: 'A new cup must hold a drink, bend without cracking and break down after use. Set the criteria, respect the constraints, then lock a prototype in the Test Bay.',
      objectiveIds: ['L15-O4', 'L15-O3'],
      stages: [
        { kind: 'collect', text: 'Set the criteria: light HOLDS, BENDS, DECAYS', match: { type: 'rollover', group: 'criteria' }, count: 3, distinct: true, lamps: ['crit_holds', 'crit_bends', 'crit_breaks'] },
        { kind: 'shots', text: 'Check the constraints, then lock it in the Test Bay', shots: ['bank', 'testBay'] },
        { kind: 'discover', text: 'Judge the prototype at the Design Desk', pocket: 'design_desk', questions: 1 },
      ],
      discovery: 'Criteria say what a design must do; constraints are limits like cost and time. Tests showed PLA breaks down fast only in hot industrial compost, so engineers keep revising. Evidence decides, not labels.',
      reward: 'multiball',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Opening Night',
    brief: 'The house needs one winning design. Run the whole show, then present it at the Design Desk.',
    stages: [
      { kind: 'shots', text: 'Run the show: Conveyor, Loop, Test Bay, Bank', shots: ['conveyor', 'supplyLoop', 'testBay', 'bank'] },
      { kind: 'discover', text: 'Present the winning design at the Design Desk', pocket: 'design_desk', questions: 2, objectiveIds: ['L15-O3', 'L15-O4'] },
    ],
    celebration: 'Curtain up! The winning cup joins the house. It earned its place on evidence and tradeoffs, not because it was called natural or synthetic.',
  },
  onProgress(rt, { slot, stage: st }) {
    // During the lock stage and the finale the Test Bay holds the prototype a little longer.
    const bay = rt.find<Saucer>('test_bay');
    if (bay) bay.autoEjectDelay = (slot === 2 && st === 1) || slot === 3 ? 2.0 : 1.3;
  },
  set: wonderworksSet,
  room: wonderworksRoom,
  icons: ICONS,
  scenery: {
    backdrop({ ctx, level }) {
      sceneryBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s1 = stage(level, 0.2, 1);
      const s2 = stage(level, 1.2, 2);
      // Material rolling up the conveyor's mouth.
      if (s1 > 0.02) {
        for (let i = 0; i < MOUTH_PTS.length; i++) {
          const p = MOUTH_PTS[i].p;
          const ph = reduced ? 0.5 : (t * 0.8 + i * 0.37) % 1;
          glowDot(ctx, p[0], p[1], 5, i % 3 ? GOLD : MINT, 0.5 * s1 * (0.4 + 0.6 * ph));
        }
      }
      // Footlight flicker with play energy.
      if (s1 > 0.02) {
        for (let x = 200; x <= 420; x += 40) glowDot(ctx, x, 239, 9, GOLD, (0.15 + 0.3 * energy) * s1);
      }
      if (!reduced && s2 > 0) drift(ctx, 15, 16, t, MINT, [250, 300, 470, 640], 10, 1.5, 0.3 * s2);
      if (!reduced && level >= 3.9) {
        for (let i = 0; i < 18; i++) {
          const ph = (t * 0.12 + i / 18) % 1;
          const x = 60 + ((i * 97) % 480) + Math.sin(t + i) * 8;
          glowDot(ctx, x, 60 + ph * 700, 5, TRIO[i % 3], 0.45 * (1 - ph));
        }
      }
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(POCKET[0], POCKET[1], 10, POCKET[0], POCKET[1], 440);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + t * 0.4;
        const d = 60 + p * 280;
        glowDot(ctx, POCKET[0] + Math.cos(a) * d, POCKET[1] + Math.sin(a) * d * 0.8, 10, TRIO[(i + 2) % 3], 1 - p);
      }
      gear(ctx, POCKET[0], POCKET[1], 40 + p * 60, 14, t * 0.8, rgba(GOLD, 0.25 * (1 - p)));
    },
  },
};

export default L15;
