// Lesson 14 — Energy in Chemical Reactions — "Firelight & Frost Pavilion"
// A split pavilion at twilight. The warm left half glows with hot bumpers (a match, a firework
// and a hand warmer) and the Ember Lane; the frost right half holds the icy Bond Bank, the
// Frost Lane and its spinner. A dashed SYSTEM BOUNDARY rings the Balance Pocket in the middle,
// with four boundary gates where energy crosses, and a two-armed Balance Beam above the pocket
// tips toward whichever way the current stage sends energy: OUT to the surroundings (ember) or
// IN to the system (frost). The Heat-Flow Ramp carries the Wonderball from the warm side over
// the top of the pavilion to the cold side, the way thermal energy moves from warmer to cooler.

import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { offsetPath, type Diverter } from '../game/table/mechanisms.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import { REGIONS, type RoomBuilder, type SetBuilder } from '../game/render3d/setKit.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  TAU, drift, glowDot, mix, neonPath, neonText, rgba, rng, rrect, stage, vgrad,
} from '../game/render/art.ts';

const GOLD = '#FFC75B';
const EMBER = '#FF7A3D';
const FROST = '#7FD8FF';
const IVORY = '#FFF7E7';

// ---------------------------------------------------------------- playfield geometry

const POCKET: [number, number] = [286, 470];
const BEAM_PIVOT: [number, number] = [286, 384];
const BEAM_LEN = 44;
const BEAM_TILT = 16;
/** Boundary ring around the Balance Pocket (painted dashed; four gates sit on it). */
const RING_R = 118;
const ringPt = (deg: number): [number, number] => [POCKET[0] + RING_R * Math.cos((deg * Math.PI) / 180), POCKET[1] + RING_R * Math.sin((deg * Math.PI) / 180)];
const GATES: { id: string; deg: number }[] = [
  { id: 'gate_nw', deg: 200 },
  { id: 'gate_ne', deg: 340 },
  { id: 'gate_sw', deg: 125 },
  { id: 'gate_se', deg: 55 },
];
const BUMPERS: { id: string; x: number; y: number; label: string; icon: string }[] = [
  { id: 'hot_match', x: 180, y: 250, label: 'MATCH', icon: 'match' },
  { id: 'hot_firework', x: 262, y: 206, label: 'FIREWORK', icon: 'firework' },
  { id: 'hot_warmer', x: 250, y: 304, label: 'WARMER', icon: 'warmer' },
];
const BANK = { x: 372, y: 232, deg: 24, size: 26, gap: 6, count: 3 };
const RAMP_PATH: [number, number][] = [
  [150, 600], [122, 448], [110, 352], [118, 256], [158, 176], [228, 128], [310, 112], [392, 128],
  [458, 176], [502, 252], [521, 362], [522, 500], [520, 640], [506, 740], [489, 806],
];
/** Climbing part of the ramp (has a playfield footprint). */
const RAMP_BASE = RAMP_PATH.slice(0, 3);
const mirrorX = (p: [number, number]): [number, number] => [FRAME.centerX * 2 - p[0], p[1]];

/**
 * The two side lanes are slanted channels that share their inner wall with the ramp body (left)
 * or its mirror image (right). A channel runs ~10 degrees off vertical: its mouth faces the
 * opposite flipper, and a ball coming back down it is steered onto the same-side flipper.
 */
function laneWalls() {
  const inner = offsetPath(RAMP_BASE, -19);
  const ux = RAMP_BASE[1][0] - RAMP_BASE[0][0];
  const uy = RAMP_BASE[1][1] - RAMP_BASE[0][1];
  const ul = Math.hypot(ux, uy);
  const u: [number, number] = [ux / ul, uy / ul];
  const nl: [number, number] = [u[1], -u[0]]; // left normal
  const W = 60;
  const o0: [number, number] = [inner[0][0] + nl[0] * W, inner[0][1] + nl[1] * W];
  const o1: [number, number] = [inner[1][0] + nl[0] * W, inner[1][1] + nl[1] * W];
  const t = (FRAME.left - o1[0]) / u[0];
  const oTop: [number, number] = [FRAME.left, o1[1] + u[1] * t];
  return {
    inner: [inner[0], inner[1], inner[2]] as [number, number][],
    outer: [oTop, o0, [FRAME.left, o0[1] + 78]] as [number, number][],
    mouth: o0,
  };
}
const LANE = laneWalls();
/** Exit deflector below the Ember Lane mouth (mirrored for the Frost Lane). */
const DEFL_A: [number, number] = [72.3, 614.3];
const DEFL_B: [number, number] = [128, 770];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left', centerPost: true });

  // --- EMBER LANE (warm side): a slanted channel whose mouth faces the right flipper. It runs up
  //     beside the ramp body and opens onto the arch, so a strong shot orbits over to the frost side.
  //     Its inner wall is the ramp body's left flank. The closed wedge behind it is the pavilion pillar.
  b.wall(LANE.inner, { id: 'ember_inner', r: 3 });
  b.post(LANE.inner[0][0], LANE.inner[0][1] + 2, 5, { id: 'lane_split_post' });
  b.wall(LANE.outer, { id: 'ember_outer', r: 3 });
  b.post(LANE.mouth[0], LANE.mouth[1], 5);
  b.shotSwitch('ember_sw', 70, 428, -90, { r: 22 });

  // --- HEAT-FLOW RAMP: climbs beside the Ember Lane, crosses over the top of the pavilion and
  //     comes down the frost side into the right inlane (warm -> cool, like thermal energy).
  const rampRight = offsetPath(RAMP_BASE, 19);
  b.wall([[rampRight[0][0] + 1, rampRight[0][1] + 1], [rampRight[0][0] + 34, rampRight[0][1] + 52]], { id: 'ramp_flare_r', r: 3 });
  b.ramp('heat_ramp', { path: RAMP_PATH, width: 34, footprintTo: 2, peak: 84, label: 'HEAT-FLOW RAMP' });
  // Peaked roof over the end of the ramp footprint so nothing can rest on it.
  b.wall([[88, 358], [110, 334], [132, 352]], { r: 3, style: 'invisible' });

  // --- FROST LANE (cold side): the mirror-image channel facing the left flipper, with a spinner.
  const frostInner = LANE.inner.map(mirrorX);
  b.wall(frostInner, { id: 'frost_inner', r: 3 });
  b.post(frostInner[0][0], frostInner[0][1] + 2, 5);
  b.post(frostInner[2][0], frostInner[2][1] - 4, 5);
  b.wall(LANE.outer.map(mirrorX).map(([x, y]) => [Math.min(x, FRAME.laneSep), y] as [number, number]), { id: 'frost_outer', r: 3 });
  b.post(...mirrorX(LANE.mouth), 5);
  b.spinner('frost_spin', [482, 398], [536, 398], { label: 'FROST' });
  b.shotSwitch('frost_sw', 502, 432, -90, { r: 22 });

  // --- Lane exits: a ball coming DOWN either side lane (a full plunge, an orbit, the SPARK skill
  //     shot) lands on a one-way deflector that throws it back into the open playfield instead of
  //     onto the slingshot. Shots from the opposite flipper (and the kickback) pass up through it.
  b.gate('ember_deflect', DEFL_A, DEFL_B, -20);
  b.gate('frost_deflect', mirrorX(DEFL_A), mirrorX(DEFL_B), -160);

  // --- Hot bumpers (exothermic examples) on the warm side.
  for (const h of BUMPERS) b.bumper(h.id, h.x, h.y, { r: 24, group: 'embers', label: h.label, icon: h.icon });

  // --- Bond Bank: three O=O bonds to break on the frost side, with a backstop behind.
  const d = (BANK.deg * Math.PI) / 180;
  const ux = Math.cos(d);
  const uy = Math.sin(d);
  const nx = uy;
  const ny = -ux; // up-right normal (behind the bank)
  const len = BANK.count * BANK.size + (BANK.count - 1) * BANK.gap;
  b.dropBank('bond_bank', BANK.x, BANK.y, BANK.deg, BANK.count, { size: BANK.size, gap: BANK.gap, group: 'bonds', labels: ['O=O', 'O=O', 'O=O'] });
  const back0: [number, number] = [BANK.x + nx * 11 - ux * 2, BANK.y + ny * 11 - uy * 2];
  const back1: [number, number] = [BANK.x + ux * (len + 2) + nx * 11, BANK.y + uy * (len + 2) + ny * 11];
  b.wall([[BANK.x - ux * 2, BANK.y - uy * 2], back0, back1, [BANK.x + ux * (len + 2), BANK.y + uy * (len + 2)]], { id: 'bank_back', r: 3 });

  // --- Evidence thermometers on the outside of the reaction cup: WARMS (warm side), COOLS (frost side).
  b.target('warm_target', [249, 494], [249, 452], { group: 'evidence', label: 'WARMS' });
  b.target('cool_target', [323, 452], [323, 494], { group: 'evidence', label: 'COOLS' });

  // --- The Balance Pocket in a cup, the Balance Beam above it, and the boundary gates around it.
  b.wall([[258, 494], [258, 446]], { r: 4 });
  b.wall([[258, 446], [286, 432], [314, 446]], { r: 4 });
  b.wall([[314, 446], [314, 494]], { r: 4 });
  b.saucer('balance', POCKET[0], POCKET[1], { role: 'pocket', ejectDeg: 98, ejectSpeed: 760, captureMaxSpeed: 2600, label: 'BALANCE POCKET', icon: 'balance' });
  b.diverter('beam_l', BEAM_PIVOT, BEAM_LEN, 180 + BEAM_TILT, 180 - BEAM_TILT);
  b.diverter('beam_r', BEAM_PIVOT, BEAM_LEN, BEAM_TILT, -BEAM_TILT);
  for (const g of GATES) {
    const [x, y] = ringPt(g.deg);
    b.rollover(g.id, x, y, { group: 'boundary', icon: 'gate' });
  }

  // --- SPARK: the skill-shot switch a gentle plunge can reach (the small push that starts a reaction).
  b.rollover('spark', 514, 362, { r: 16, group: 'spark', label: 'SPARK', icon: 'spark' });

  // --- Inserts that preview shots.
  // Lane and ramp arrows sit on their shot lines, clear of the exit deflectors and the ramp's legs.
  b.insert('ins_ember', 124, 632, { deg: -104, label: 'EMBER LANE', color: EMBER });
  b.insert('ins_ramp', 178, 656, { deg: -116, label: 'HEAT FLOW', color: GOLD });
  b.insert('ins_frost', 448, 632, { deg: -76, label: 'FROST LANE', color: FROST });
  b.insert('ins_bank', 404, 318, { deg: -66, label: 'BONDS', color: FROST });
  b.insert('ins_pocket', 286, 540, { deg: -90, color: GOLD });
  b.insert('ins_embers', 231, 253, { shape: 'star', size: 12, color: EMBER });
  b.insert('ins_boundary', 286, 628, { shape: 'circle', size: 11, label: 'BOUNDARY', color: IVORY });
  // The thermometer targets face sideways, so their names are printed on the floor beside them.
  b.insert('ins_warm', 222, 500, { deg: 0, label: 'WARMS', color: EMBER });
  b.insert('ins_cool', 350, 500, { deg: 180, label: 'COOLS', color: FROST });
}

// ---------------------------------------------------------------- printed playfield art

const EMBER_DEEP = '#9c2f22';
const AMBER = '#FFB347';
const ICE = '#CFF6FF';
const FROST_DEEP = '#2B5FA8';
const PLUM = '#291B46';
const LANE_FONT = '"Atkinson Hyperlegible Next", system-ui, sans-serif';

function polyPath(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Text that follows a circle: along the top (reads left to right) or the bottom. */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, centerDeg: number, size: number, color: string, alpha: number, bottom = false) {
  ctx.save();
  ctx.font = `800 ${size}px ${LANE_FONT}`;
  ctx.fillStyle = rgba(color, alpha);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const widths = [...text].map((ch) => ctx.measureText(ch).width + size * 0.14);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = (centerDeg * Math.PI) / 180 + (bottom ? total / r / 2 : -total / r / 2);
  [...text].forEach((ch, i) => {
    const w = widths[i];
    const mid = a + (bottom ? -w / 2 / r : w / 2 / r);
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * r, cy + Math.sin(mid) * r);
    ctx.rotate(bottom ? mid - Math.PI / 2 : mid + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += bottom ? -w / r : w / r;
  });
  ctx.restore();
}

/** Glowing energy arrow from (x1,y1) to (x2,y2). */
function energyArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lit: number, w = 4) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 9 + w;
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - Math.cos(a) * h * 0.4, y2 - Math.sin(a) * h * 0.4);
  }, color, lit, w);
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x2 - Math.cos(a - 0.5) * h, y2 - Math.sin(a - 0.5) * h);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(a + 0.5) * h, y2 - Math.sin(a + 0.5) * h);
  }, color, lit, w);
}

/** Word written along a slanted lane (rotated to run up the channel). */
function laneWord(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, deg: number, size: number, color: string, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.font = `800 ${size}px ${LANE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (lit > 0.01) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * lit;
  }
  ctx.fillStyle = rgba(color, 0.22 + 0.6 * lit);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Six-armed frost crystal (snowflake) drawn as a branching stroke. */
function frostCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, color: string, alpha: number, width = 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i / 6) * TAU);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    for (const k of [0.38, 0.62, 0.82]) {
      const l = r * (0.42 - k * 0.3);
      ctx.moveTo(0, -r * k);
      ctx.lineTo(-l, -r * k - l * 0.9);
      ctx.moveTo(0, -r * k);
      ctx.lineTo(l, -r * k - l * 0.9);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Stylised three-tongued flame (for printed art). */
function flameShape(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, alpha: number) {
  const tongue = (cx: number, hh: number, lean: number, a: number) => {
    const w = hh * 0.36;
    const g = ctx.createLinearGradient(cx, y, cx, y - hh);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.6, rgba(AMBER, a * 0.85));
    g.addColorStop(1, rgba('#FFF2C4', a * 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w, y);
    ctx.bezierCurveTo(cx - w * 1.1, y - hh * 0.45, cx + lean * 0.5 - w * 0.3, y - hh * 0.7, cx + lean, y - hh);
    ctx.bezierCurveTo(cx + lean * 0.4 + w * 0.5, y - hh * 0.62, cx + w * 1.15, y - hh * 0.4, cx + w, y);
    ctx.quadraticCurveTo(cx, y + hh * 0.12, cx - w, y);
    ctx.fill();
  };
  tongue(x - h * 0.22, h * 0.62, -h * 0.12, alpha * 0.8);
  tongue(x + h * 0.22, h * 0.68, h * 0.12, alpha * 0.8);
  tongue(x, h, h * 0.05, alpha);
}

/** Glowing ribbon under the Heat-Flow Ramp: warm at the mouth, cool at the exit. */
function heatRibbon(ctx: CanvasRenderingContext2D, lit: number) {
  const pts = new TableBuilderLite().curve(RAMP_PATH);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const g = ctx.createLinearGradient(90, 0, 530, 0);
  g.addColorStop(0, rgba(EMBER, 0.16 + 0.3 * lit));
  g.addColorStop(0.45, rgba(GOLD, 0.12 + 0.24 * lit));
  g.addColorStop(1, rgba(FROST, 0.16 + 0.3 * lit));
  ctx.strokeStyle = g;
  ctx.lineWidth = 24;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  // Chevrons pointing along the flow (warm -> cool).
  for (let i = 4; i < pts.length - 2; i += 7) {
    const t = i / (pts.length - 1);
    const [x, y] = pts[i];
    const [x2, y2] = pts[i + 1];
    const a = Math.atan2(y2 - y, x2 - x);
    ctx.strokeStyle = rgba(mix(AMBER, ICE, t), 0.2 + 0.55 * lit);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a - 0.7) * 9, y - Math.sin(a - 0.7) * 9);
    ctx.lineTo(x, y);
    ctx.lineTo(x - Math.cos(a + 0.7) * 9, y - Math.sin(a + 0.7) * 9);
    ctx.stroke();
  }
  ctx.restore();
}

/** Catmull-Rom smoothing without a runtime (the art needs the same curve as the ramp). */
class TableBuilderLite {
  curve(points: [number, number][], per = 6): [number, number][] {
    const out: [number, number][] = [];
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
}

/** Equation plaque: dark rounded panel with a glowing formula. */
function equationPlaque(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, lit: number) {
  ctx.save();
  ctx.font = `700 15px ${LANE_FONT}`;
  const w = ctx.measureText(text).width + 26;
  rrect(ctx, x - w / 2, y - 14, w, 28, 14);
  ctx.fillStyle = 'rgba(14,8,26,0.62)';
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.25 + 0.5 * lit);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (lit > 0.01) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * lit;
  }
  ctx.fillStyle = rgba(mix(color, '#ffffff', 0.35), 0.35 + 0.65 * lit);
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function paintBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1.1); // boundary drawn, lanterns lit
  const s2 = stage(level, 1.2, 2.1); // bond bookkeeping, equations
  const s3 = stage(level, 2.2, 3.1); // the pavilion marquee and packs
  const s4 = stage(level, 3.4, 4); // Wonderlight: fire and frost in balance
  const wake = 0.35 + 0.65 * s1;

  // 1. Split lacquer: ember-red on the left, frost-blue on the right, plum at the seam.
  const base = ctx.createLinearGradient(0, 0, 600, 0);
  base.addColorStop(0, mix('#26101c', '#4a1717', s1));
  base.addColorStop(0.34, mix('#2e1428', '#43192b', s1));
  base.addColorStop(0.5, PLUM);
  base.addColorStop(0.66, mix('#141c42', '#182c5a', s1));
  base.addColorStop(1, mix('#0a1830', '#0e3354', s1));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, 'rgba(6,3,14,0.6)'], [0.2, 'rgba(6,3,14,0.12)'], [0.6, 'rgba(6,3,14,0)'], [0.86, 'rgba(6,3,14,0.25)'], [1, 'rgba(6,3,14,0.6)']]);
  ctx.fillRect(0, 0, 600, 1150);

  // 2. Floor tiles: warm terracotta diamonds on the left, frosted glass diamonds on the right.
  ctx.save();
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 22; col++) {
      const x = col * 30 + (row % 2) * 15;
      const y = row * 30;
      const warm = x < 286;
      const d = Math.abs(x - 286) / 286;
      ctx.fillStyle = warm ? rgba(EMBER, 0.025 + 0.04 * d * wake) : rgba(FROST, 0.025 + 0.04 * d * wake);
      ctx.beginPath();
      ctx.moveTo(x, y - 13);
      ctx.lineTo(x + 13, y);
      ctx.lineTo(x, y + 13);
      ctx.lineTo(x - 13, y);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // 3. Canopy valance under the arch: warm stripes on the left, frost stripes on the right.
  ctx.save();
  const ac = [FRAME.archCx, FRAME.archCy] as const;
  for (let i = 0; i < 26; i++) {
    const a0 = Math.PI + (i / 26) * Math.PI;
    const a1 = Math.PI + ((i + 1) / 26) * Math.PI;
    const warm = i < 13;
    const c = warm ? (i % 2 ? EMBER_DEEP : AMBER) : i % 2 ? FROST_DEEP : ICE;
    ctx.fillStyle = rgba(c, 0.18 + 0.32 * wake);
    ctx.beginPath();
    ctx.arc(ac[0], ac[1], 280, a0, a1);
    ctx.arc(ac[0], ac[1], 258, a1, a0, true);
    ctx.closePath();
    ctx.fill();
    // scalloped edge
    const am = (a0 + a1) / 2;
    ctx.beginPath();
    ctx.arc(ac[0] + Math.cos(am) * 258, ac[1] + Math.sin(am) * 258, 9, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Lanterns hanging under the canopy (warm side) and icicles (frost side).
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + 0.22 + i * 0.2;
    const x = ac[0] + Math.cos(a) * 246;
    const y = ac[1] + Math.sin(a) * 246;
    glowDot(ctx, x, y, 14, AMBER, 0.15 + 0.6 * s1);
    ctx.fillStyle = rgba(EMBER, 0.4 + 0.5 * s1);
    rrect(ctx, x - 4, y - 6, 8, 12, 3);
    ctx.fill();
  }
  for (let i = 0; i < 7; i++) {
    const a = 2 * Math.PI - 0.2 - i * 0.18;
    const x = ac[0] + Math.cos(a) * 252;
    const y = ac[1] + Math.sin(a) * 252;
    const g = ctx.createLinearGradient(x, y, x, y + 20);
    g.addColorStop(0, rgba(ICE, 0.5 + 0.4 * s1));
    g.addColorStop(1, rgba(ICE, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y + 18 + (i % 3) * 5);
    ctx.closePath();
    ctx.fill();
  }

  // 4. Hearth glow behind the hot bumpers; frost bloom behind the Bond Bank.
  const hearth = ctx.createRadialGradient(222, 252, 10, 222, 252, 150);
  hearth.addColorStop(0, rgba(AMBER, 0.12 + 0.3 * wake));
  hearth.addColorStop(0.5, rgba(EMBER, 0.06 + 0.14 * wake));
  hearth.addColorStop(1, rgba(EMBER, 0));
  ctx.fillStyle = hearth;
  ctx.fillRect(60, 100, 330, 320);
  for (const [x, y, h] of [[150, 330, 46], [196, 196, 38], [306, 262, 34], [214, 350, 30]] as [number, number, number][]) flameShape(ctx, x, y, h, EMBER, 0.12 + 0.25 * wake);
  const r = rng(14);
  for (let i = 0; i < 40; i++) glowDot(ctx, 130 + r() * 200, 150 + r() * 230, 2 + r() * 3, r() < 0.5 ? AMBER : EMBER, (0.15 + 0.5 * wake) * r());
  const bloom = ctx.createRadialGradient(414, 262, 10, 414, 262, 150);
  bloom.addColorStop(0, rgba(ICE, 0.1 + 0.25 * wake));
  bloom.addColorStop(0.55, rgba(FROST, 0.05 + 0.12 * wake));
  bloom.addColorStop(1, rgba(FROST, 0));
  ctx.fillStyle = bloom;
  ctx.fillRect(250, 110, 320, 320);
  frostCrystal(ctx, 414, 300, 70, 0.1, ICE, 0.1 + 0.25 * wake, 3);
  frostCrystal(ctx, 352, 186, 26, 0.4, ICE, 0.12 + 0.3 * wake, 2);
  frostCrystal(ctx, 452, 384, 22, 0.2, ICE, 0.12 + 0.3 * wake, 2);
  const r2 = rng(27);
  for (let i = 0; i < 36; i++) glowDot(ctx, 320 + r2() * 200, 160 + r2() * 260, 1.5 + r2() * 2.5, ICE, (0.15 + 0.45 * wake) * r2());

  // 5. The two pavilion pillars (the closed wedges behind the lanes): brick on fire, ice on frost.
  const leftPillar = LANE.outer;
  const rightPillar = LANE.outer.map(mirrorX).map(([x, y]) => [Math.min(x, FRAME.laneSep), y] as [number, number]);
  ctx.save();
  polyPath(ctx, leftPillar);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, 340, 700, [[0, mix('#4a1d1a', '#7a2a1c', s1)], [1, '#2a0f12']]);
  ctx.fillRect(0, 330, 120, 380);
  ctx.strokeStyle = 'rgba(20,6,8,0.55)';
  ctx.lineWidth = 2;
  for (let y = 340; y < 700; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(120, y);
    ctx.stroke();
    for (let x = ((y / 14) % 2) * 12; x < 120; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 14);
      ctx.stroke();
    }
  }
  glowDot(ctx, 40, 560, 34, AMBER, 0.2 + 0.5 * s1);
  ctx.restore();
  ctx.save();
  polyPath(ctx, rightPillar);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, 340, 700, [[0, mix('#1c3d66', '#2f6fa8', s1)], [1, '#0d1d38']]);
  ctx.fillRect(470, 330, 130, 380);
  const r3 = rng(31);
  ctx.strokeStyle = rgba(ICE, 0.35);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    const x = 480 + r3() * 70;
    const y = 360 + r3() * 320;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r3() - 0.5) * 30, y + 10 + r3() * 26);
    ctx.lineTo(x + (r3() - 0.5) * 30, y + 30 + r3() * 26);
    ctx.stroke();
  }
  glowDot(ctx, 532, 560, 34, ICE, 0.2 + 0.5 * s1);
  ctx.restore();

  // 6. Lane floors: EXOTHERMIC runs up the Ember Lane, ENDOTHERMIC up the Frost Lane.
  const laneDeg = (Math.atan2(RAMP_BASE[1][1] - RAMP_BASE[0][1], RAMP_BASE[1][0] - RAMP_BASE[0][0]) * 180) / Math.PI;
  const mid = (a: [number, number], b: [number, number], t = 0.5): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const emberMidLow = mid(LANE.inner[0], LANE.outer[1]);
  const emberMidHigh = mid(LANE.inner[1], [LANE.outer[0][0] + 14, LANE.inner[1][1]]);
  for (let k = 0; k < 4; k++) {
    const [x, y] = mid(emberMidLow, emberMidHigh, 0.12 + k * 0.24);
    energyArrow(ctx, x + 2, y + 10, x - 2, y - 10, EMBER, 0.25 + 0.6 * s1, 3);
  }
  laneWord(ctx, 'EXOTHERMIC', 76, 470, laneDeg, 13, AMBER, s2);
  const frostLow = mirrorX(emberMidLow);
  const frostHigh = mirrorX(emberMidHigh);
  for (let k = 0; k < 4; k++) {
    const [x, y] = mid(frostLow, frostHigh, 0.12 + k * 0.24);
    energyArrow(ctx, x - 2, y + 10, x + 2, y - 10, FROST, 0.25 + 0.6 * s1, 3);
  }
  laneWord(ctx, 'ENDOTHERMIC', 496, 470, 180 - laneDeg, 13, ICE, s2);

  // 7. Heat-flow ribbon under the clear ramp (warmer -> cooler).
  heatRibbon(ctx, 0.3 + 0.7 * s2);

  // 8. The system boundary: a dashed ring around the Balance Pocket.
  const [px, py] = POCKET;
  const inside = ctx.createRadialGradient(px, py, 20, px, py, RING_R);
  inside.addColorStop(0, rgba(GOLD, 0.1 + 0.12 * s1));
  inside.addColorStop(1, rgba(PLUM, 0.05));
  ctx.fillStyle = inside;
  ctx.beginPath();
  ctx.arc(px, py, RING_R, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.setLineDash([12, 9]);
  ctx.lineWidth = 3;
  if (s1 > 0.01) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12 * s1;
  }
  ctx.strokeStyle = rgba(IVORY, 0.3 + 0.55 * s1);
  ctx.beginPath();
  ctx.arc(px, py, RING_R, 0, TAU);
  ctx.stroke();
  ctx.restore();
  arcText(ctx, 'SYSTEM', px, py, RING_R - 16, 90, 12, IVORY, 0.35 + 0.5 * s1, true);
  arcText(ctx, 'SURROUNDINGS', px, py, RING_R + 15, 90, 11, IVORY, 0.3 + 0.4 * s1, true);
  // Energy arrows crossing the boundary: OUT on the fire side, IN on the frost side.
  for (const deg of [150, 180, 210]) {
    const a = (deg * Math.PI) / 180;
    energyArrow(ctx, px + Math.cos(a) * (RING_R - 18), py + Math.sin(a) * (RING_R - 18), px + Math.cos(a) * (RING_R + 14), py + Math.sin(a) * (RING_R + 14), EMBER, 0.2 + 0.8 * s1, 4);
  }
  for (const deg of [-30, 0, 30]) {
    const a = (deg * Math.PI) / 180;
    energyArrow(ctx, px + Math.cos(a) * (RING_R + 14), py + Math.sin(a) * (RING_R + 14), px + Math.cos(a) * (RING_R - 18), py + Math.sin(a) * (RING_R - 18), FROST, 0.2 + 0.8 * s1, 4);
  }

  // 9. The balance: a brass fulcrum from the cup roof up to the beam, with OUT and IN pans.
  ctx.save();
  ctx.fillStyle = rgba('#d9b46a', 0.55 + 0.3 * s1);
  ctx.beginPath();
  ctx.moveTo(BEAM_PIVOT[0], BEAM_PIVOT[1] + 2);
  ctx.lineTo(BEAM_PIVOT[0] + 12, POCKET[1] - 40);
  ctx.lineTo(BEAM_PIVOT[0] - 12, POCKET[1] - 40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  for (const [sx, label, c] of [[-1, 'OUT', EMBER], [1, 'IN', FROST]] as [number, string, string][]) {
    const x = BEAM_PIVOT[0] + sx * 58;
    const y = BEAM_PIVOT[1] + 2;
    ctx.save();
    ctx.strokeStyle = rgba(c, 0.35 + 0.5 * s2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + 8, 14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
    neonText(ctx, label, x, y - 12, 13, c, 0.3 + 0.7 * s2, LANE_FONT);
  }

  // 10. Equations in the bookkeeping band (light after the bond mission). They sit below the
  //     HEAT FLOW insert label (which the 3D view prints 28 units under its arrow).
  equationPlaque(ctx, '4Fe + 3O₂ → 2Fe₂O₃ + energy', 286, 716, EMBER, s2);
  equationPlaque(ctx, 'NH₄Cl + energy → NH₄⁺ + Cl⁻', 286, 750, FROST, s2);

  // 11. Marquee across the canopy, measured and centred so the raised ramp legs never hide it.
  {
    const size = 17;
    const gap = 9;
    const words: [string, string, number][] = [['FIRELIGHT', AMBER, 65], ['&', GOLD, 60], ['FROST', ICE, 65]];
    ctx.save();
    ctx.font = `800 ${size}px "Fraunces Variable", Georgia, serif`;
    const widths = words.map(([w]) => ctx.measureText(w).width);
    ctx.restore();
    let x = 304 - (widths.reduce((a, b) => a + b, 0) + gap * 2) / 2;
    words.forEach(([w, c, y], i) => {
      neonText(ctx, w, x + widths[i] / 2, y, size, c, 0.15 + 0.85 * s3);
      x += widths[i] + gap;
    });
  }

  // 12. Apron: the Pack Picker's two packs, printed between the slings where the 3D view keeps
  //     them clear of the slingshot lamps and the lane deflectors.
  for (const [x, c, word, warm] of [[222, EMBER, 'HAND WARMER', true], [350, FROST, 'COLD PACK', false]] as [number, string, string, boolean][]) {
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.5 * s3;
    rrect(ctx, x - 58, 786, 116, 28, 12);
    ctx.fillStyle = 'rgba(14,8,26,0.62)';
    ctx.fill();
    ctx.strokeStyle = rgba(c, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    if (warm) flameShape(ctx, x - 46, 808, 17, EMBER, 1);
    else frostCrystal(ctx, x - 44, 800, 8, 0, ICE, 1, 1.8);
    ctx.font = `800 12px ${LANE_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = IVORY;
    ctx.fillText(word, x + 10, 801);
    ctx.restore();
  }

  // 13. Wonderlight: fire and frost glow together, in balance.
  if (s4 > 0.01) {
    const g = ctx.createRadialGradient(px, py, 20, px, py, 420);
    g.addColorStop(0, rgba(GOLD, 0.22 * s4));
    g.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 1150);
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = rgba([ICE, FROST, '#b9a7ff'][k], 0.16 * s4);
      ctx.lineWidth = 14 - k * 4;
      ctx.beginPath();
      for (let x = 320; x <= 540; x += 8) ctx.lineTo(x, 150 + k * 20 + Math.sin(x / 40 + k) * 12);
      ctx.stroke();
      ctx.strokeStyle = rgba([AMBER, EMBER, GOLD][k], 0.16 * s4);
      ctx.beginPath();
      for (let x = 40; x <= 260; x += 8) ctx.lineTo(x, 150 + k * 20 + Math.cos(x / 40 + k) * 12);
      ctx.stroke();
    }
  }
}

function paintAmbient(ctx: CanvasRenderingContext2D, t: number, level: number, reduced: boolean, energy: number) {
  const s1 = stage(level, 0.2, 1.2);
  if (reduced) return;
  // Embers rise on the fire side; snow drifts down on the frost side.
  drift(ctx, 5, 16, t, AMBER, [110, 150, 280, 420], 16, 1.8, (0.25 + 0.35 * energy) * (0.4 + 0.6 * s1));
  const r = rng(8);
  for (let i = 0; i < 18; i++) {
    const bx = 320 + r() * 200;
    const sp = 10 + r() * 14;
    const span = 280;
    const y = 140 + ((r() * span + t * sp) % span);
    const x = bx + Math.sin(t * 0.6 + i) * 8;
    ctx.fillStyle = rgba(ICE, (0.25 + 0.35 * s1) * (0.5 + 0.5 * r()));
    ctx.beginPath();
    ctx.arc(x, y, 1.4 + r() * 1.4, 0, TAU);
    ctx.fill();
  }
}

function paintCelebrate(ctx: CanvasRenderingContext2D, t: number, p: number) {
  const [px, py] = POCKET;
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.55;
  const g = ctx.createRadialGradient(px, py, 10, px, py, 440);
  g.addColorStop(0, rgba(GOLD, 0.85));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.restore();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + t * 0.3;
    const d = 50 + p * 280;
    const warm = Math.cos(a) < 0;
    glowDot(ctx, px + Math.cos(a) * d, py + Math.sin(a) * d * 0.85, 10, warm ? [AMBER, EMBER][i % 2] : [ICE, FROST][i % 2], 1 - p);
  }
}

// ---------------------------------------------------------------- 3D attraction set

type V3 = [number, number, number];
/** Opacity of the three nested flame cones (outer to inner) at full light. */
const FLAME_ALPHA = [0.5, 0.65, 0.9];

/** Small repeating floor tile: warm terracotta diamonds or frosted slate flagstones. */
function tileTexture(kind: 'warm' | 'frost'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const r = rng(kind === 'warm' ? 52 : 53);
  if (kind === 'warm') {
    ctx.fillStyle = '#1c0a08';
    ctx.fillRect(0, 0, 256, 256);
    const T = 64;
    for (let y = 0; y <= 256; y += T / 2) {
      for (let x = 0; x <= 256; x += T) {
        const ox = x + ((y / (T / 2)) % 2 ? T / 2 : 0);
        const k = 0.6 + r() * 0.3;
        ctx.fillStyle = `rgb(${Math.round(92 * k)},${Math.round(36 * k)},${Math.round(28 * k)})`;
        for (const dx of [0, -256, 256]) {
          ctx.beginPath();
          ctx.moveTo(ox + dx, y - T / 2 + 3);
          ctx.lineTo(ox + dx + T / 2 - 3, y);
          ctx.lineTo(ox + dx, y + T / 2 - 3);
          ctx.lineTo(ox + dx - T / 2 + 3, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  } else {
    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 64) {
      for (let x = 0; x < 256; x += 128) {
        const ox = x + ((y / 64) % 2 ? 64 : 0);
        const k = 0.7 + r() * 0.3;
        ctx.fillStyle = `rgb(${Math.round(30 * k)},${Math.round(46 * k)},${Math.round(70 * k)})`;
        for (const dx of [0, -256]) ctx.fillRect(ox + dx + 3, y + 3, 122, 58);
      }
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(225,242,255,${0.04 + r() * 0.18})`;
      ctx.beginPath();
      ctx.arc(r() * 256, r() * 256, 2 + r() * 9, 0, TAU);
      ctx.fill();
    }
  }
  return c;
}

/** Striped canopy fabric (warm awning). */
function stripeTexture(a: string, b: string, n = 12): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect((i * 512) / n, 0, 512 / n + 1, 128);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 0, 512, 10);
  return c;
}

/** Soft aurora curtain (vertical light bands fading upward). */
function auroraTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const r = rng(91);
  for (let i = 0; i < 70; i++) {
    const x = r() * 512;
    const w = 6 + r() * 26;
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    const col = r() < 0.5 ? '127,216,255' : r() < 0.5 ? '160,255,220' : '185,167,255';
    g.addColorStop(0, `rgba(${col},0)`);
    g.addColorStop(0.25, `rgba(${col},${0.25 + r() * 0.35})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, 256);
  }
  return c;
}

/** Printed pouch face: a hand warmer (flame) or a cold pack (snowflake). */
function pouchTexture(kind: 'warm' | 'cold'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 180;
  const ctx = c.getContext('2d')!;
  const warm = kind === 'warm';
  ctx.fillStyle = warm ? '#d8a66e' : '#3f7fd0';
  ctx.fillRect(0, 0, 256, 180);
  ctx.strokeStyle = warm ? '#8a4a24' : '#cfeaff';
  ctx.lineWidth = 6;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(10, 10, 236, 160);
  ctx.setLineDash([]);
  if (warm) flameShape(ctx, 128, 118, 76, EMBER, 1);
  else frostCrystal(ctx, 128, 82, 46, 0, '#ffffff', 1, 6);
  ctx.font = `800 26px ${LANE_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = warm ? '#5a1f10' : '#ffffff';
  ctx.fillText(warm ? 'Fe + O₂' : 'NH₄Cl', 128, 158);
  return c;
}

const pavilionSet: SetBuilder = (kit) => {
  const THREE = kit.THREE;
  const G = REGIONS.groundY;
  kit.sky('#2b1648', '#05060f');

  const tex = (canvas: HTMLCanvasElement, repeat = 0) => {
    const t = kit.track(new THREE.CanvasTexture(canvas));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
    }
    return t;
  };
  const glowMat = (color: string, base = 0.08) => kit.track(new THREE.MeshStandardMaterial({ color: '#0b0a12', emissive: color, emissiveIntensity: base, roughness: 0.35 }));
  const addGlow = (color: string) => kit.track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const glowMap = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'pool');
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e3 = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  /** Additive light pool on the ground (cheap fake bounce light). */
  const pool = (x: number, z: number, radius: number, color: string) => {
    const m = kit.track(new THREE.MeshBasicMaterial({ map: glowMap, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), m);
    mesh.position.set(x, G + 0.02, z);
    mesh.renderOrder = 1;
    kit.add(mesh);
    return m;
  };
  /** Layered additive flame with a glow sprite; flickers via kit.animate. */
  const flame = (pos: V3, size: number) => {
    const g = new THREE.Group();
    const mats = [EMBER, AMBER, '#fff1c0'].map(addGlow);
    const dims: [number, number][] = [[0.42, 1.15], [0.3, 0.9], [0.15, 0.6]];
    const cones = dims.map(([r, h], i) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 18, 1, true), mats[i]);
      m.position.y = h / 2;
      g.add(m);
      return m;
    });
    const spriteMat = kit.track(new THREE.SpriteMaterial({ map: glowMap, color: AMBER, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 2.4, 1);
    sprite.position.y = 0.45;
    g.add(sprite);
    g.position.set(pos[0], pos[1], pos[2]);
    g.scale.setScalar(size);
    kit.add(g);
    const ph = pos[0] * 1.7 + pos[2];
    kit.animate((t) => {
      for (let i = 0; i < cones.length; i++) {
        const c = cones[i];
        const f = 1 + 0.13 * Math.sin(t * (8 + i * 3) + ph + i) + 0.06 * Math.sin(t * 21 + i * 2 + ph);
        c.scale.set(1 - (f - 1) * 0.5, f, 1 - (f - 1) * 0.5);
        c.rotation.y = t * (0.5 + i * 0.4);
      }
    });
    return {
      group: g,
      setLit(v: number) {
        for (let i = 0; i < mats.length; i++) mats[i].opacity = v * FLAME_ALPHA[i];
        spriteMat.opacity = v * 0.5;
        g.visible = v > 0.01;
      },
    };
  };
  /** A hexagonal pavilion: deck, six columns, a rim and a roof. Returns its pieces. */
  const pavilion = (x: number, z: number, deckMat: InstanceType<typeof THREE.Material>, colMat: InstanceType<typeof THREE.Material>, colRadius: [number, number]) => {
    const R = 1.25;
    const H = 1.85;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.34, 0.22, 6), deckMat);
    deck.position.set(x, G + 0.11, z);
    deck.rotation.y = Math.PI / 6;
    deck.receiveShadow = true;
    deck.castShadow = true;
    kit.add(deck);
    const cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(colRadius[0], colRadius[1], H, 8), colMat, 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      m4.makeTranslation(x + Math.cos(a) * R, G + 0.22 + H / 2, z + Math.sin(a) * R);
      cols.setMatrixAt(i, m4);
    }
    cols.castShadow = true;
    kit.add(cols);
    return { top: G + 0.22 + H, R };
  };

  // ---- ground: warm tiles on the fire side, snowy slate on the frost side
  for (const side of [-1, 1]) {
    const mat = kit.track(new THREE.MeshPhysicalMaterial({ map: tex(tileTexture(side < 0 ? 'warm' : 'frost'), 34), roughness: side < 0 ? 0.6 : 0.35, clearcoat: side < 0 ? 0.25 : 0.6, clearcoatRoughness: 0.35 }));
    const geo = new THREE.CircleGeometry(30, 48, side < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
    const half = new THREE.Mesh(geo, mat);
    half.position.y = G;
    half.receiveShadow = true;
    kit.add(half);
  }
  const seamC = document.createElement('canvas');
  seamC.width = 128;
  seamC.height = 8;
  const sctx = seamC.getContext('2d')!;
  const sg = sctx.createLinearGradient(0, 0, 128, 0);
  sg.addColorStop(0, 'rgba(18,10,30,0)');
  sg.addColorStop(0.5, 'rgba(18,10,30,0.92)');
  sg.addColorStop(1, 'rgba(18,10,30,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 128, 8);
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(5, 60).rotateX(-Math.PI / 2), kit.track(new THREE.MeshBasicMaterial({ map: tex(seamC), transparent: true, depthWrite: false })));
  seam.position.y = G + 0.01;
  kit.add(seam);
  const warmPool = pool(-5.75, -1.5, 3.4, AMBER);
  const coolPool = pool(5.75, -1.5, 3.2, FROST);

  // ================= LEFT: FIRELIGHT HALL — a striped pavilion around a brazier (energy OUT)
  const FX = -5.75;
  const FZ = -1.7;
  const warmStone = kit.track(new THREE.MeshPhysicalMaterial({ color: '#6a2c20', roughness: 0.55, clearcoat: 0.4 }));
  const fh = pavilion(FX, FZ, warmStone, kit.mats.brass(), [0.05, 0.065]);
  const canopyTex = tex(stripeTexture(EMBER_DEEP, AMBER, 12));
  const canopyMat = kit.track(new THREE.MeshPhysicalMaterial({ map: canopyTex, emissive: '#ffffff', emissiveMap: canopyTex, emissiveIntensity: 0.02, roughness: 0.5, clearcoat: 0.5, side: THREE.DoubleSide }));
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 1.75, 0.8, 6, 1, true), canopyMat);
  canopy.position.set(FX, fh.top + 0.4, FZ);
  canopy.rotation.y = Math.PI / 6;
  canopy.castShadow = true;
  kit.add(canopy);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.04, 6, 6), kit.mats.brass());
  rim.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  rim.position.set(FX, fh.top, FZ);
  kit.add(rim);
  const oculus = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 6, 6), kit.mats.brass());
  oculus.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  oculus.position.set(FX, fh.top + 0.8, FZ);
  kit.add(oculus);
  const finial = flame([FX, fh.top + 0.82, FZ], 0.42);
  // The brazier: an iron bowl of glowing coals and a big flame.
  const iron = kit.mats.paintedMetal('#2b2226');
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 12, 0, TAU, Math.PI / 2, Math.PI / 2), iron);
  bowl.position.set(FX, G + 0.98, FZ);
  bowl.castShadow = true;
  kit.add(bowl);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, 0.72, 12), iron);
  stand.position.set(FX, G + 0.58, FZ);
  kit.add(stand);
  const coalMat = glowMat('#ff4a1c', 0.3);
  const coals = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), coalMat, 14);
  const cr = rng(5);
  for (let i = 0; i < 14; i++) {
    const a = cr() * TAU;
    const d = cr() * 0.34;
    m4.makeTranslation(FX + Math.cos(a) * d, G + 0.96 + cr() * 0.06, FZ + Math.sin(a) * d);
    coals.setMatrixAt(i, m4);
  }
  kit.add(coals);
  const brazier = flame([FX, G + 0.96, FZ], 1.0);
  const fireLight = kit.point([FX, G + 1.7, FZ + 0.4], '#ff9a4a', 0, 7);
  // Energy OUT: neon arrows radiating from the brazier to the surroundings.
  const outArrows: { setLit(v: number): void }[] = [];
  const headGeo = new THREE.ConeGeometry(0.1, 0.24, 12);
  const outHeadMat = glowMat(EMBER);
  const up = new THREE.Vector3(0, 1, 0);
  for (const a of [0.15, 1.0, 1.85]) {
    const dir = new THREE.Vector3(Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2));
    const p0 = new THREE.Vector3(FX, G + 1.55, FZ).addScaledVector(dir, 0.55);
    const p1 = new THREE.Vector3(FX, G + 1.45, FZ).addScaledVector(dir, 2.0);
    const tube = kit.neonTube([[p0.x, p0.y, p0.z], [(p0.x + p1.x) / 2, p0.y + 0.15, (p0.z + p1.z) / 2], [p1.x, p1.y, p1.z]], EMBER, { radius: 0.03 });
    const head = new THREE.Mesh(headGeo, outHeadMat);
    head.position.copy(p1);
    head.quaternion.setFromUnitVectors(up, dir.clone().setY(-0.08).normalize());
    kit.add(head);
    outArrows.push(tube);
  }
  // The giant match, struck: the small push that starts an exothermic reaction.
  const match = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 10), kit.track(new THREE.MeshPhysicalMaterial({ color: '#e8c48a', roughness: 0.7 })));
  stick.position.y = 0.95;
  stick.castShadow = true;
  const headMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#c8322a', roughness: 0.5, clearcoat: 0.5, emissive: '#ff3a1a', emissiveIntensity: 0.05 }));
  const mhead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), headMat);
  mhead.scale.y = 1.35;
  mhead.position.y = 1.95;
  match.add(stick, mhead);
  match.position.set(-4.45, G, 1.6);
  match.rotation.set(-0.1, 0, 0.16);
  kit.add(match);
  const matchTip = new THREE.Vector3(0, 2.0, 0).applyEuler(match.rotation).add(match.position);
  const matchFlame = flame([matchTip.x, matchTip.y, matchTip.z], 0.36);
  const boxMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#c8322a', roughness: 0.5, clearcoat: 0.6 }));
  const striker = kit.mats.paintedMetal('#3a2418');
  const matchBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.42), [striker, striker, boxMat, boxMat, boxMat, boxMat]);
  matchBox.position.set(-4.85, G + 0.08, 2.05);
  matchBox.rotation.y = 0.4;
  kit.add(matchBox);
  // Firework rack (energy leaves as light and sound) — launches at the Wonderlight.
  const rackBase = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.18, 0.5), kit.mats.wood());
  rackBase.position.set(-6.0, G + 0.09, 1.2);
  rackBase.rotation.y = 0.3;
  kit.add(rackBase);
  const tubeMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.4, clearcoat: 0.6 }));
  const tubes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.085, 0.085, 1, 14), tubeMat, 5);
  const tubeCols = [EMBER_DEEP, GOLD, EMBER, AMBER, '#c8322a'];
  for (let i = 0; i < 5; i++) {
    const h = 0.42 + (i % 3) * 0.16;
    v3.set(-6.45 + i * 0.22, G + 0.18 + h / 2, 1.05 + i * 0.07);
    q.setFromEuler(e3.set(0, 0, (i - 2) * 0.1));
    m4.compose(v3, q, new THREE.Vector3(1, h, 1));
    tubes.setMatrixAt(i, m4);
    tubes.setColorAt(i, new THREE.Color(tubeCols[i]));
  }
  tubes.castShadow = true;
  kit.add(tubes);
  // Hand warmers on display: iron powder that warms as it reacts with oxygen.
  const crateL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.7), kit.mats.wood());
  crateL.position.set(-4.75, G + 0.21, 4.45);
  crateL.rotation.y = 0.12;
  crateL.castShadow = true;
  kit.add(crateL);
  const warmFace = tex(pouchTexture('warm'));
  const pouchSide = kit.track(new THREE.MeshPhysicalMaterial({ color: '#c99a6a', roughness: 0.85, emissive: EMBER, emissiveIntensity: 0.02 }));
  const pouchFront = kit.track(new THREE.MeshPhysicalMaterial({ map: warmFace, roughness: 0.8, emissive: EMBER, emissiveMap: warmFace, emissiveIntensity: 0.02 }));
  const pouchGeo = new RoundedBoxGeometry(0.46, 0.34, 0.07, 3, 0.03);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(pouchGeo, [pouchSide, pouchSide, pouchSide, pouchSide, pouchFront, pouchSide]);
    p.position.set(-5.3 + i * 0.52, G + 0.6, 4.35 + i * 0.06);
    p.rotation.set(-0.45, 0.12, (i - 1) * 0.08);
    p.castShadow = true;
    kit.add(p);
  }
  const fireSign = kit.neonSign('FIRELIGHT', [-4.6, 1.52, 0.12], { height: 0.42, color: AMBER, rotY: 0.3 });
  fireSign.rotation.x = -0.55;
  kit.pole([-4.6, 0, 0.15], 1.25, '#d9b46a');
  const embers = kit.motes({ x0: FX - 0.8, x1: FX + 0.8, y0: G + 1.2, y1: 4.2, z0: FZ - 0.8, z1: FZ + 0.8 }, 60, AMBER, { speed: 0.55, size: 0.08 });
  const warmLights = kit.stringLights([FX + 1.5, fh.top - 0.05, FZ + 0.85], [-4.6, 1.3, 0.15], 0.3, kit.n(8), [AMBER, GOLD, EMBER]);

  // ================= RIGHT: FROST HALL — a faceted ice dome over a crystal cluster (energy IN)
  const IX = 5.75;
  const IZ = -1.7;
  const iceDeck = kit.track(new THREE.MeshPhysicalMaterial({ color: '#7fa9c8', roughness: 0.15, clearcoat: 1, emissive: FROST, emissiveIntensity: 0.02 }));
  const iceColMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#bfe6ff', roughness: 0.05, transparent: true, opacity: 0.7, clearcoat: 1, emissive: FROST, emissiveIntensity: 0.04 }));
  const ih = pavilion(IX, IZ, iceDeck, iceColMat, [0.06, 0.09]);
  const domeMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#5f9cc8', roughness: 0.12, transparent: true, opacity: 0.26, clearcoat: 1, flatShading: true, emissive: FROST, emissiveIntensity: 0.03, side: THREE.DoubleSide, depthWrite: false }));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.68, 12, 5, 0, TAU, 0, Math.PI / 2), domeMat);
  dome.position.set(IX, ih.top - 0.04, IZ);
  dome.scale.y = 0.72;
  kit.add(dome);
  const ribMat = glowMat(ICE, 0.05);
  const ribs: InstanceType<typeof THREE.Mesh>[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const pts: InstanceType<typeof THREE.Vector3>[] = [];
    for (let k = 0; k <= 10; k++) {
      const th = (k / 10) * (Math.PI / 2);
      pts.push(new THREE.Vector3(IX + Math.cos(a) * Math.cos(th) * 1.7, ih.top + Math.sin(th) * 1.7 * 0.72, IZ + Math.sin(a) * Math.cos(th) * 1.7));
    }
    const rib = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.022, 6), ribMat);
    kit.add(rib);
    ribs.push(rib);
  }
  const irim = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.04, 6, 6), kit.mats.chrome());
  irim.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  irim.position.set(IX, ih.top, IZ);
  kit.add(irim);
  const icicleMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#e8f8ff', roughness: 0.05, transparent: true, opacity: 0.85, clearcoat: 1, emissive: ICE, emissiveIntensity: 0.04 }));
  const icicles = new THREE.InstancedMesh(new THREE.ConeGeometry(0.045, 1, 6), icicleMat, 24);
  const ir = rng(17);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const len = 0.16 + ir() * 0.32;
    v3.set(IX + Math.cos(a) * 1.68, ih.top - len / 2, IZ + Math.sin(a) * 1.68);
    q.setFromEuler(e3.set(Math.PI, 0, 0));
    m4.compose(v3, q, new THREE.Vector3(1, len, 1));
    icicles.setMatrixAt(i, m4);
  }
  kit.add(icicles);
  const crystals = [
    kit.crystal([IX, G + 0.78, IZ], 0.36, FROST, 3),
    kit.crystal([IX + 0.36, G + 0.55, IZ + 0.18], 0.24, ICE, 4),
    kit.crystal([IX - 0.34, G + 0.52, IZ + 0.22], 0.22, '#9fb4ff', 5),
    kit.crystal([IX + 0.12, G + 0.48, IZ - 0.36], 0.2, ICE, 6),
  ];
  const finialSnow = new THREE.Group();
  const armMat = glowMat(ICE, 0.1);
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.42, 0.03), armMat);
    arm.position.set(Math.cos((i / 6) * TAU) * 0.21, Math.sin((i / 6) * TAU) * 0.21, 0);
    arm.rotation.z = (i / 6) * TAU - Math.PI / 2;
    finialSnow.add(arm);
  }
  finialSnow.position.set(IX, ih.top + 1.68 * 0.72 + 0.32, IZ);
  kit.add(finialSnow);
  const coolLight = kit.point([IX, G + 1.4, IZ + 0.4], '#9fdcff', 0, 6);
  // Energy IN: neon arrows pointing from the surroundings into the dome.
  const inArrows: { setLit(v: number): void }[] = [];
  const inHeadMat = glowMat(FROST);
  for (const a of [-0.15, -1.0, -1.85]) {
    const dir = new THREE.Vector3(Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2));
    const p0 = new THREE.Vector3(IX, G + 1.45, IZ).addScaledVector(dir, 2.1);
    const p1 = new THREE.Vector3(IX, G + 1.55, IZ).addScaledVector(dir, 0.95);
    const tube = kit.neonTube([[p0.x, p0.y, p0.z], [(p0.x + p1.x) / 2, p0.y + 0.15, (p0.z + p1.z) / 2], [p1.x, p1.y, p1.z]], FROST, { radius: 0.03 });
    const head = new THREE.Mesh(headGeo, inHeadMat);
    head.position.copy(p1);
    head.quaternion.setFromUnitVectors(up, dir.clone().multiplyScalar(-1).setY(-0.08).normalize());
    kit.add(head);
    inArrows.push(tube);
  }
  // A frozen pond with low snow banks and ice shards.
  const pondMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#4f86b0', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, emissive: FROST, emissiveIntensity: 0.02 }));
  const pond = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40).rotateX(-Math.PI / 2), pondMat);
  pond.position.set(5.95, G + 0.025, 1.6);
  pond.receiveShadow = true;
  kit.add(pond);
  const snowMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#8fa9c2', roughness: 0.7, flatShading: true, clearcoat: 0.4, sheen: 1, sheenColor: new THREE.Color('#9fc8ef') }));
  const drifts = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 1), snowMat, 11);
  const dr = rng(23);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + dr() * 0.3;
    v3.set(5.95 + Math.cos(a) * (1.08 + dr() * 0.12), G + 0.02, 1.6 + Math.sin(a) * (1.02 + dr() * 0.1));
    q.setFromEuler(e3.set(dr(), dr() * 3, dr()));
    m4.compose(v3, q, new THREE.Vector3(0.7 + dr() * 0.6, 0.35 + dr() * 0.3, 0.6 + dr() * 0.5));
    drifts.setMatrixAt(i, m4);
  }
  drifts.receiveShadow = true;
  kit.add(drifts);
  const shards = [kit.crystal([6.85, G + 0.32, 0.95], 0.24, ICE, 8), kit.crystal([4.95, G + 0.28, 2.3], 0.2, FROST, 9), kit.crystal([6.95, G + 0.26, 2.3], 0.18, '#9fb4ff', 10)];
  // Cold packs on display: ammonium chloride that takes energy in as it dissolves.
  const crateR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.7), kit.mats.wood());
  crateR.position.set(4.75, G + 0.21, 4.45);
  crateR.rotation.y = -0.12;
  crateR.castShadow = true;
  kit.add(crateR);
  const coldFace = tex(pouchTexture('cold'));
  const packSide = kit.track(new THREE.MeshPhysicalMaterial({ color: '#3f7fd0', roughness: 0.3, clearcoat: 0.8, emissive: FROST, emissiveIntensity: 0.02 }));
  const packFront = kit.track(new THREE.MeshPhysicalMaterial({ map: coldFace, roughness: 0.3, clearcoat: 0.8, emissive: FROST, emissiveMap: coldFace, emissiveIntensity: 0.02 }));
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(pouchGeo, [packSide, packSide, packSide, packSide, packFront, packSide]);
    p.position.set(4.2 + i * 0.52, G + 0.6, 4.47 - i * 0.06);
    p.rotation.set(-0.45, -0.12, (i - 1) * 0.08);
    p.castShadow = true;
    kit.add(p);
  }
  const frostSign = kit.neonSign('FROST', [4.6, 1.52, 0.12], { height: 0.42, color: ICE, rotY: -0.3 });
  frostSign.rotation.x = -0.55;
  kit.pole([4.6, 0, 0.15], 1.25, '#cfe8ff');
  const snow = kit.motes({ x0: 3.9, x1: 8.5, y0: G + 0.1, y1: 4.2, z0: -5.5, z1: 4.5 }, 110, '#e8f6ff', { speed: 0.3, size: 0.065, rise: false });
  const coolLights = kit.stringLights([IX - 1.5, ih.top - 0.05, IZ + 0.85], [4.6, 1.3, 0.15], 0.3, kit.n(8), [ICE, FROST, '#9fb4ff']);

  // ================= TOP CORNERS: the giant Balance. Its beam rides above the frame; its two pans
  // hang into view: OUT (a flame) on the fire side, IN (an ice crystal) on the frost side.
  const BEAM_Y = 5.7;
  const BEAM_Z = -7.0;
  const PAN_X = 4.75;
  const PAN_DROP = 4.85;
  const pivot = new THREE.Group();
  pivot.position.set(0, BEAM_Y, BEAM_Z);
  kit.add(pivot);
  const beamBar = new THREE.Mesh(new THREE.BoxGeometry(PAN_X * 2 + 0.4, 0.16, 0.16), kit.mats.brass());
  pivot.add(beamBar);
  const pans = [-1, 1].map((sx) => {
    const g = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.85, 28, 10, 0, TAU, Math.PI * 0.62, Math.PI * 0.38), kit.mats.brass());
    dish.position.y = 0.5;
    dish.castShadow = true;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.035, 8, 40), kit.mats.brass());
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.11;
    const chains = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), kit.mats.chrome(), 3);
    const top = new THREE.Vector3(0, PAN_DROP, -1.4);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5;
      const bot = new THREE.Vector3(Math.cos(a) * 0.68, 0.12, Math.sin(a) * 0.68);
      const mid = bot.clone().add(top).multiplyScalar(0.5);
      const dir = top.clone().sub(bot);
      m4.compose(mid, new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()), new THREE.Vector3(1, dir.length(), 1).multiply(one));
      chains.setMatrixAt(i, m4);
    }
    g.add(dish, lip, chains);
    g.position.set(sx * PAN_X, BEAM_Y - PAN_DROP, BEAM_Z + 1.4);
    kit.add(g);
    return g;
  });
  const panFlame = flame([0, 0.22, 0], 0.62);
  pans[0].add(panFlame.group);
  const panCrystal = kit.crystal([0, 0.58, 0], 0.34, FROST, 12);
  pans[1].add(panCrystal);
  const panCrystal2 = kit.crystal([0.28, 0.4, 0.12], 0.2, ICE, 13);
  pans[1].add(panCrystal2);
  const outSign = kit.neonSign('ENERGY OUT', [-4.6, 1.02, 0.42], { height: 0.24, color: EMBER, rotY: 0.3 });
  outSign.rotation.x = -0.55;
  const inSign = kit.neonSign('ENERGY IN', [4.6, 1.02, 0.42], { height: 0.24, color: FROST, rotY: -0.3 });
  inSign.rotation.x = -0.55;

  // ================= SKY: fireworks and an aurora at the Wonderlight
  // Low enough over the halls to burst inside the camera's top corners (never over the playfield).
  const fwL = kit.fireworks({ x0: -8.0, x1: -6.4, y0: 1.5, y1: 2.0, z: -4.4 }, [AMBER, EMBER, GOLD]);
  const fwR = kit.fireworks({ x0: 6.4, x1: 8.0, y0: 1.5, y1: 2.0, z: -4.4 }, [ICE, FROST, '#b9a7ff', GOLD]);
  const auroraMat = kit.track(new THREE.MeshBasicMaterial({ map: tex(auroraTexture(), 1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const aurora = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.4, 24, 1), auroraMat);
  aurora.position.set(6.5, 2.7, -4.3);
  aurora.rotation.set(-0.55, -0.55, 0);
  kit.add(aurora);
  const apos = aurora.geometry.attributes.position;
  const abase = Float32Array.from(apos.array as ArrayLike<number>);
  kit.animate((t) => {
    for (let i = 0; i < apos.count; i++) apos.setZ(i, abase[i * 3 + 2] + Math.sin(abase[i * 3] * 0.8 + t * 0.6) * 0.3);
    apos.needsUpdate = true;
    if (auroraMat.map) auroraMat.map.offset.x = (t * 0.015) % 1;
  });

  // Neon trims around both hall decks and golden halos on the Balance pans (the balanced display).
  const hexRing = (x: number, z: number, r: number): V3[] => Array.from({ length: 6 }, (_, i) => [x + Math.cos((i / 6) * TAU + Math.PI / 6) * r, G + 0.24, z + Math.sin((i / 6) * TAU + Math.PI / 6) * r] as V3);
  const trims = [kit.neonTube(hexRing(FX, FZ, 1.5), AMBER, { closed: true, radius: 0.028 }), kit.neonTube(hexRing(IX, IZ, 1.5), ICE, { closed: true, radius: 0.028 })];
  const haloMats = pans.map(() => kit.track(new THREE.SpriteMaterial({ map: glowMap, color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  pans.forEach((pan, i) => {
    const halo = new THREE.Sprite(haloMats[i]);
    halo.scale.set(2.6, 2.6, 1);
    halo.position.y = 0.6;
    pan.add(halo);
  });
  // Wonderlight pillars: beams of warm and cool light rising from both halls.
  const pillarMats = [AMBER, FROST].map((c) => kit.track(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  const pillarGeo = new THREE.CylinderGeometry(0.55, 1.15, 6, 24, 1, true);
  const pillars = [[FX, FZ], [IX, IZ]].map(([x, z], i) => {
    const m = new THREE.Mesh(pillarGeo, pillarMats[i]);
    m.position.set(x, G + 3, z);
    m.renderOrder = 4;
    kit.add(m);
    return m;
  });
  // ---- the third light: a key light that lifts both halls as the pavilion wakes
  const key = kit.spot([0, 7.5, 5.5], [0, 0, -1.5], '#fff1dc', 0, 1.1);

  let beamAngle = 0.1;
  let flare = 0;
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.6, 4);
      const e = 0.85 + 0.15 * energy;
      const flick = kit.reducedMotion ? 1 : 0.88 + 0.12 * Math.sin(t * 13) * Math.sin(t * 7.3);
      // Fire side: the brazier always smoulders; it roars as the missions are solved.
      brazier.setLit(Math.min(1.4, (0.3 + 0.4 * s1 + 0.35 * s2 + flare) * e));
      brazier.group.scale.setScalar(0.6 + 0.3 * s2 + 0.1 * s4 + 0.2 * flare);
      finial.setLit(0.1 + 0.9 * s3);
      matchFlame.setLit(0.15 + 0.85 * s1);
      headMat.emissiveIntensity = 0.05 + 0.6 * s1;
      coalMat.emissiveIntensity = 0.5 + 1.6 * s1 + 0.8 * s2;
      if (fireLight) fireLight.intensity = (1.5 + 4 * s1 + 3 * s2 + 4 * flare) * flick;
      canopyMat.emissiveIntensity = 0.02 + 0.22 * s3 + 0.12 * s4;
      pouchSide.emissiveIntensity = pouchFront.emissiveIntensity = 0.02 + 0.45 * s3;
      outHeadMat.emissiveIntensity = 0.08 + 2.2 * s1;
      for (const a of outArrows) a.setLit(0.06 + 0.8 * s1);
      outSign.setLit(0.1 + 0.9 * s1);
      fireSign.setLit(0.2 + 0.8 * s0);
      embers.setLit(0.12 + 0.55 * s2 + 0.3 * s4);
      warmLights.setLit(0.1 + 0.9 * s3);
      warmPool.opacity = 0.1 + 0.18 * s1 + 0.16 * s2 + 0.2 * flare;
      // Frost side: the crystals and the dome brighten as energy flows in.
      for (let i = 0; i < crystals.length; i++) crystals[i].setLit(Math.max(0.12, 0.75 * kit.stage(level, 0.6 + i * 0.25, 1.6 + i * 0.25)) * e + flare * 0.4);
      for (const c of shards) c.setLit(0.1 + 0.6 * s2);
      domeMat.emissiveIntensity = 0.03 + 0.12 * s3 + 0.06 * s4;
      iceColMat.emissiveIntensity = 0.04 + 0.2 * s3;
      ribMat.emissiveIntensity = 0.05 + 0.7 * s3 + 0.1 * s4;
      icicleMat.emissiveIntensity = 0.04 + 0.5 * s2;
      armMat.emissiveIntensity = 0.1 + 1.8 * s3;
      pondMat.emissiveIntensity = 0.02 + 0.22 * s2;
      packSide.emissiveIntensity = packFront.emissiveIntensity = 0.02 + 0.4 * s3;
      if (coolLight) coolLight.intensity = 0.8 + 2 * s2 + 3 * flare;
      inHeadMat.emissiveIntensity = 0.08 + 2.2 * s1;
      for (const a of inArrows) a.setLit(0.06 + 0.8 * s1);
      inSign.setLit(0.1 + 0.9 * s1);
      frostSign.setLit(0.2 + 0.8 * s0);
      snow.setLit(0.15 + 0.5 * s2 + 0.3 * s4);
      coolLights.setLit(0.1 + 0.9 * s3);
      coolPool.opacity = 0.08 + 0.18 * s1 + 0.16 * s2 + 0.2 * flare;
      if (key) key.intensity = 3 + 7 * s1 + 6 * s3;
      // The Balance weighs energy out against energy in, and settles level at the Wonderlight.
      panFlame.setLit(0.3 + 0.7 * s2 + flare * 0.4);
      panCrystal.setLit(0.2 + 0.8 * s2 + flare * 0.4);
      panCrystal2.setLit(0.15 + 0.7 * s3);
      const swing = kit.reducedMotion ? 0.05 : 0.06 * Math.sin(t * 0.45) + 0.015 * Math.sin(t * 1.3);
      const target = (1 - s4) * (0.05 * (1 - s1) + swing * s1);
      beamAngle += (target - beamAngle) * Math.min(1, dt * 2);
      pivot.rotation.z = beamAngle;
      for (let i = 0; i < 2; i++) {
        const sx = i ? 1 : -1;
        pans[i].position.y = BEAM_Y - PAN_DROP + sx * Math.sin(beamAngle) * PAN_X;
        pans[i].position.x = sx * Math.cos(beamAngle) * PAN_X;
      }
      if (!kit.reducedMotion) finialSnow.rotation.y += dt * (0.2 + 0.8 * s3);
      auroraMat.opacity = 0.03 + 0.25 * s3 + 0.75 * s4;
      for (let i = 0; i < 2; i++) {
        trims[i].setLit(0.05 + 0.45 * s3 + (i ? 0.25 : 0.45) * s4);
        haloMats[i].opacity = 0.55 * s4 + 0.3 * flare;
        pillarMats[i].opacity = (i ? 0.045 : 0.13) * s4 + 0.06 * flare;
        pillars[i].rotation.y = kit.reducedMotion ? 0 : t * (i ? -0.3 : 0.3);
      }
      fwL.setLit(Math.max(s4, flare));
      fwR.setLit(Math.max(s4, flare));
      flare *= Math.max(0, 1 - dt * 1.5);
    },
    celebrate(p) {
      flare = Math.max(flare, Math.sin(p * Math.PI));
    },
  };
};

const pavilionRoom: RoomBuilder = ({ kit }) => {
  const THREE = kit.THREE;
  // A tabletop balance: a flame in one pan, an ice crystal in the other.
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.06, 20), kit.mats.wood());
  base.position.set(0, 0.03, -0.2);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 10), kit.mats.brass());
  post.position.set(0, 0.5, -0.2);
  const beam = new THREE.Group();
  beam.position.set(0, 0.96, -0.2);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.035), kit.mats.brass());
  beam.add(bar);
  kit.add(base);
  kit.add(post);
  kit.add(beam);
  const pans = [-0.58, 0.58].map((x) => {
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.11, 0.05, 20), kit.mats.brass());
    pan.position.set(x, 0.62, -0.2);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 6), kit.mats.chrome());
    rod.position.y = 0.17;
    pan.add(rod);
    kit.add(pan);
    return pan;
  });
  const hot = kit.orb([-0.58, 0.72, -0.2], 0.08, AMBER);
  const cold = kit.crystal([0.58, 0.76, -0.2], 0.1, FROST, 3);
  const out = kit.neonSign('OUT', [-0.6, 1.38, -0.75], { height: 0.2, color: AMBER, backing: false });
  const inn = kit.neonSign('IN', [0.6, 1.38, -0.75], { height: 0.2, color: ICE, backing: false });
  const sparks = kit.cloudOfPoints([-0.58, 0.95, -0.2], 0.16, 26, AMBER);
  const flakes = kit.cloudOfPoints([0.58, 1.0, -0.2], 0.22, 30, ICE);
  return {
    update(t, lit) {
      hot.setLit(lit);
      cold.setLit(lit);
      out.setLit(lit);
      inn.setLit(lit);
      sparks.setLit(lit * 0.9);
      flakes.setLit(lit * 0.8);
      const a = kit.reducedMotion ? 0 : 0.08 * Math.sin(t * 0.8) * (1 - lit * 0.7);
      beam.rotation.z = a;
      pans[0].position.y = 0.62 - Math.sin(a) * 0.58;
      pans[1].position.y = 0.62 + Math.sin(a) * 0.58;
      pans[0].position.x = -Math.cos(a) * 0.58;
      pans[1].position.x = Math.cos(a) * 0.58;
      hot.position.y = pans[0].position.y + 0.1;
      cold.position.y = pans[1].position.y + 0.14;
      if (!kit.reducedMotion) sparks.rotation.y = t * 0.6;
      if (!kit.reducedMotion) flakes.rotation.y = -t * 0.3;
    },
  };
};

/** Beam position 0 tips the frost (right) arm down: energy IN. Position 1 tips the ember arm down: energy OUT. */
const TIP_IN = 0;
const TIP_OUT = 1;

export const L14: TableDef = {
  lessonId: 'L14',
  signature: 'A Balance Beam over the system boundary that tips toward energy out (fire) or energy in (frost)',
  ballRole: 'The Wonderball is a game token, not a packet of energy. Its bounces and bonus points are pinball scoring: in real reactions energy is only moved or stored, never created.',
  theme: {
    bg: ['#3a1730', '#101a3c'],
    rail: '#e6cdb8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: EMBER,
    accent2: FROST,
    bumperCap: '#ff9a5c',
    bumperRing: '#5a1f2c',
    flipper: '#ffe2a8',
    ink: IVORY,
    ramp: 'rgba(232,160,104,0.2)',
    trail: '#fff1d6',
  },
  lines: {
    intro: "Welcome to the Firelight & Frost Pavilion, where one wing glows and the other shivers. Let's find out which way the energy is really flowing!",
    quark: '"This cold pack is pouring cold into my paw!" Professor Quark announces. "Cold must flow out of it... right?"',
    pipTip: 'A gentle plunge taps the SPARK switch, like the small push that starts a match. Then roll through the four gates on the dashed system boundary.',
  },
  set: pavilionSet,
  room: pavilionRoom,
  icons: {
    match(ctx, s) {
      // A struck match: stick, head and a small flame.
      ctx.save();
      ctx.rotate(-0.6);
      ctx.fillRect(-s * 0.09, -s * 0.1, s * 0.18, s * 0.95);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.18, s * 0.16, s * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.95);
      ctx.quadraticCurveTo(s * 0.32, -s * 0.55, s * 0.12, -s * 0.38);
      ctx.quadraticCurveTo(0, -s * 0.34, -s * 0.12, -s * 0.38);
      ctx.quadraticCurveTo(-s * 0.32, -s * 0.55, 0, -s * 0.95);
      ctx.fill();
      ctx.restore();
    },
    firework(ctx, s) {
      // A starburst: energy leaving as light and sound.
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const r0 = s * 0.28;
        const r1 = i % 2 ? s * 0.7 : s * 0.95;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.16, 0, TAU);
      ctx.fill();
    },
    warmer(ctx, s) {
      // A hand-warmer pouch with heat rising from it.
      rrect(ctx, -s * 0.55, -s * 0.05, s * 1.1, s * 0.75, s * 0.18);
      ctx.fill();
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      for (const x of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(x * s, -s * 0.18);
        ctx.bezierCurveTo((x - 0.14) * s, -s * 0.4, (x + 0.14) * s, -s * 0.58, x * s, -s * 0.85);
        ctx.stroke();
      }
    },
    balance(ctx, s) {
      // A balance scale: post, beam and two pans.
      ctx.fillRect(-s * 0.06, -s * 0.6, s * 0.12, s * 1.3);
      ctx.fillRect(-s * 0.4, s * 0.62, s * 0.8, s * 0.14);
      ctx.fillRect(-s * 0.9, -s * 0.62, s * 1.8, s * 0.1);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * s * 0.7, -s * 0.05, s * 0.26, 0, Math.PI);
        ctx.fill();
        ctx.lineWidth = s * 0.05;
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.7, -s * 0.57);
        ctx.lineTo(sx * s * 0.47, -s * 0.05);
        ctx.moveTo(sx * s * 0.7, -s * 0.57);
        ctx.lineTo(sx * s * 0.93, -s * 0.05);
        ctx.stroke();
      }
    },
    gate(ctx, s) {
      // A dashed boundary arc crossed by a double arrow.
      ctx.lineWidth = s * 0.12;
      ctx.setLineDash([s * 0.22, s * 0.16]);
      ctx.beginPath();
      ctx.arc(0, s * 1.4, s * 1.3, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(0, s * 0.8);
      ctx.stroke();
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, d * s * 0.5);
        ctx.lineTo(0, d * s * 0.85);
        ctx.lineTo(s * 0.3, d * s * 0.5);
        ctx.stroke();
      }
    },
    spark(ctx, s) {
      // A four-point spark: the small push that starts a reaction.
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2;
        const r = i % 2 ? s * 0.25 : s * 0.95;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    },
  },
  build,
  skillShot: 'spark',
  shots: [
    { id: 'emberLane', label: 'Ember Lane', on: [{ type: 'shot', id: 'ember_sw' }], insert: 'ins_ember' },
    { id: 'frostLane', label: 'Frost Lane', on: [{ type: 'shot', id: 'frost_sw' }], insert: 'ins_frost' },
    { id: 'heatRamp', label: 'Heat-Flow Ramp', on: [{ type: 'ramp', id: 'heat_ramp' }], insert: 'ins_ramp' },
    { id: 'bondBank', label: 'Bond Bank', on: [{ type: 'dropBank', id: 'bond_bank' }], insert: 'ins_bank' },
    { id: 'pocket', label: 'Balance Pocket', on: [{ type: 'saucer', id: 'balance' }], insert: 'ins_pocket' },
    { id: 'embers', label: 'Hot bumpers', on: [{ type: 'bumper', group: 'embers' }], insert: 'ins_embers' },
    { id: 'boundary', label: 'Boundary gates', on: [{ type: 'rollover', group: 'boundary' }], insert: 'ins_boundary' },
    { id: 'evidence', label: 'WARMS / COOLS', on: [{ type: 'target', group: 'evidence' }] },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Draw the Boundary',
      brief: 'Light the four gates on the system boundary, read what the surroundings tell you, then report at the Balance Pocket.',
      objectiveIds: ['L14-O1'],
      stages: [
        { kind: 'collect', text: 'Cross the system boundary: light all 4 gates', match: { type: 'rollover', group: 'boundary' }, count: 4, distinct: true, lamps: GATES.map((g) => g.id), preview: ['boundary'] },
        { kind: 'collect', text: 'Read the surroundings: hit WARMS and COOLS', match: { type: 'target', group: 'evidence' }, count: 2, distinct: true, lamps: ['warm_target', 'cool_target'] },
        { kind: 'discover', text: 'Report at the Balance Pocket', pocket: 'balance', questions: 1 },
      ],
      discovery: 'The system is the matter that reacts, products included; the rest is the surroundings. Warming or light shining out means energy left the system. A cold pack feels cold because energy flows from your hand into it.',
      reward: 'ballsave',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Bond Balance',
      brief: 'Break the O=O bonds in the Bond Bank (energy in), form new bonds on the hot bumpers (energy out), then weigh the net.',
      objectiveIds: ['L14-O2', 'L14-O3'],
      stages: [
        { kind: 'collect', text: 'Break bonds: drop all 3 O=O targets (energy in)', match: { type: 'drop', group: 'bonds' }, count: 3, distinct: true, lamps: ['bond_bank_1', 'bond_bank_2', 'bond_bank_3'], preview: ['bondBank'] },
        { kind: 'collect', text: 'Form bonds: 6 hot-bumper hits (energy out)', match: { type: 'bumper', group: 'embers' }, count: 6, preview: ['embers'] },
        { kind: 'discover', text: 'Weigh the net at the Balance Pocket', pocket: 'balance', questions: 1, types: ['classify', 'order', 'match'] },
      ],
      discovery: 'Breaking bonds takes energy in; forming bonds gives energy out. More out means exothermic (energy written with the products); more in means endothermic (with the reactants). Energy is moved, never made.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Pack Picker',
      brief: 'Test a hand warmer and a cold pack on the lanes and the ramp, then choose the right pack for the job at the Balance Pocket.',
      objectiveIds: ['L14-O4'],
      stages: [
        { kind: 'shots', text: 'Hand-warmer test: Ember Lane and Heat-Flow Ramp', shots: ['emberLane', 'heatRamp'], order: 'any' },
        { kind: 'collect', text: 'Cold-pack test: ride the Frost Lane', match: { type: 'shot', id: 'frost_sw' }, count: 1, preview: ['frostLane'] },
        { kind: 'discover', text: 'Choose the pack at the Balance Pocket', pocket: 'balance', questions: 1 },
      ],
      discovery: 'Match the pack to the need: warming hands calls for an exothermic pack that sends energy out; chilling a juice can calls for an endothermic pack that takes energy in.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Balance the Pavilion',
    brief: 'Fire and frost together: make every major shot, then balance the energy books at the Balance Pocket.',
    stages: [
      { kind: 'shots', text: 'Light the pavilion: both lanes, the ramp, the Bond Bank', shots: ['emberLane', 'frostLane', 'heatRamp', 'bondBank'], order: 'any' },
      { kind: 'discover', text: 'Balance the energy books at the Balance Pocket', pocket: 'balance', questions: 2 },
    ],
    celebration: 'Firelight and frost glow as one: energy flowed out, energy flowed in, and not a scrap of it was created. The pavilion\'s Wonderlight is yours!',
  },
  onProgress(rt, { slot, stage }) {
    // Tip the Balance Beam toward the way the current stage sends energy.
    let tip = TIP_IN;
    if (slot === 1) tip = stage === 0 ? TIP_IN : TIP_OUT;
    else if (slot === 2) tip = stage === 0 ? TIP_OUT : TIP_IN;
    else if (slot === 3) tip = stage === 0 ? TIP_IN : TIP_OUT;
    else if (slot === 0) tip = stage === 1 ? TIP_OUT : TIP_IN;
    rt.get<Diverter>('beam_l').set(tip as 0 | 1);
    rt.get<Diverter>('beam_r').set(tip as 0 | 1);
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      paintAmbient(ctx, t, level, reduced, energy);
    },
    celebrate({ ctx, t }, p) {
      paintCelebrate(ctx, t, p);
    },
  },
};
export default L14;
