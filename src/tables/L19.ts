// Lesson 19 — Earth's Natural Resources — "Resource Treasure Railway"
// A twilight frontier railway across a giant treasure map. Every deposit sits where the Earth
// processes that made it once met: the Oil Well in an ancient shallow-sea basin, the copper Mine in
// the volcanic arc above a sinking plate, the Hot Springs where Earth's heat leaks out, and Dry
// Gulch's aquifer under a valley recharged by rain and snowmelt. The Mine-Cart Scoop dispatches the
// Wonderball up the Treasure Line, a timber trestle that tours the whole map and returns down the
// West Line. Renewable or not is set by nature's clock against a human lifetime; whether a use lasts
// is a race between two rates, and renewable never means unlimited.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { smoothPath, type Ramp } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { Stage, TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import { TAU, drift, glowDot, mix, neonText, rgba, rng, stage, stars, vgrad } from '../game/render/art.ts';

type P2 = [number, number];
type V3 = [number, number, number];

// ---------------------------------------------------------------- palette

const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const SAND = '#d8aa6c';
const COPPER = '#ff8a4c';
const MALACHITE = '#43d39c';
const WATER = '#62c6ff';
const SNOW = '#eef6ff';
const PINE = '#3f9a5c';
const MAGMA = '#ff6a2a';
const AMBER = '#ffb347';
const STEAM = '#e8fbff';
const TIMBER = '#7a4e2e';
const RAIL = '#c9b48f';

// ---------------------------------------------------------------- key geometry (table units)

const MINE: P2 = [452, 556];
const OIL: P2 = [158, 452];
const DEPOT: P2 = [286, 474];
const SPRINGS: P2[] = [[360, 190], [440, 230], [420, 316]];
const RECHARGE: [number, number, string][] = [[160, 575, 'RAIN'], [236, 560, 'SNOW'], [336, 560, 'MELT']];
const R_RING = 228;
function ring(deg: number): P2 {
  const a = (deg * Math.PI) / 180;
  return [310 + R_RING * Math.cos(a), 300 + R_RING * Math.sin(a)];
}
/** The Treasure Line trestle: mine -> up the volcanic arc -> over the snowy pass -> down the west. */
const TRESTLE: P2[] = [[452, 532], [454, 452], [466, 372], [492, 296], ring(-28), ring(-50), ring(-72), ring(-95), ring(-120), ring(-145), ring(-168), [78, 360], [64, 460], [54, 580], [56, 690], [83, 806]];
const TUNNEL_UPPER: P2[] = [[432, 528], [372, 697]];
const TUNNEL_LOWER: P2[] = [[472, 528], [474, 565], [421, 705]];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- West Line: the ground-level railway up the west edge and over the top of the map. The
  // channel is short so the right flipper's long diagonal can reach it; the windmill PUMP spins
  // inside it, and the switch at the top of the arch counts each clockwise run of the line ---
  b.wall([[74, 476], [74, 384]], { id: 'west_inner', r: 3 });
  b.post(74, 380, 5);
  b.post(74, 480, 5);
  b.spinner('pump', [28, 452], [70, 452], { label: 'PUMP' });
  b.shotSwitch('west_sw', 250, 38, 0, { r: 18 });
  // One-way exit: balls coming down the line slide into the left inlane; kickback saves pass upward.
  b.gate('west_gate', [28, 700], [66, 790], -90);

  // --- Mine tunnel (axis about -69 deg, lined up with the left flipper) to the Mine-Cart Scoop ---
  b.wall(TUNNEL_UPPER, { id: 'tunnel_upper', r: 3, style: 'wood' });
  b.wall(TUNNEL_LOWER, { id: 'tunnel_lower', r: 3, style: 'wood' });
  // No floor label here: it would fall inside the tunnel walls; the MINE insert below names the shot.
  b.saucer('mine_cart', MINE[0], MINE[1], { role: 'scoop', ejectDeg: -90, ejectSpeed: 2300, captureMaxSpeed: 3600, icon: 'cart' });

  // --- The Treasure Line trestle (signature): the mine cart dispatches the ball up the volcanic
  // arc, over the snowy pass and down the west side into the left inlane ---
  b.ramp('treasure_line', { path: TRESTLE, width: 36, footprintTo: 1, peak: 80, label: 'TREASURE LINE' });
  // Peaked roof over the end of the trestle footprint so nothing can rest on it.
  b.wall([[430, 456], [454, 432], [478, 456]], { id: 'trestle_roof', r: 3, style: 'invisible' });
  // Return guide: balls dropping down the east edge are steered into the right inlane.
  b.wall([[FRAME.laneSep, 680], [500, 740]], { id: 'east_deflect', r: 3 });

  // --- Oil Well in the ancient sea basin (a round-topped cup under the derrick) ---
  b.wall([[130, 476], [130, 440]], { r: 4 });
  b.arc(OIL[0], 440, 28, 180, 360, { r: 4, segments: 14 });
  b.wall([[186, 440], [186, 476]], { r: 4 });
  b.saucer('oil_well', OIL[0], OIL[1], { group: 'deposits', ejectDeg: 80, ejectSpeed: 760, captureMaxSpeed: 2800, label: 'OIL WELL', icon: 'derrick' });

  // --- Treasure Depot: the Wonder Pocket, a station house in Dry Gulch ---
  b.wall([[258, 498], [258, 472]], { r: 4 });
  b.arc(DEPOT[0], 472, 28, 180, 360, { r: 4, segments: 14 });
  b.wall([[314, 472], [314, 498]], { r: 4 });
  b.saucer('depot', DEPOT[0], DEPOT[1], { role: 'pocket', ejectDeg: 98, ejectSpeed: 760, captureMaxSpeed: 3800, label: 'TREASURE DEPOT', icon: 'depot' });

  // --- Sorting yard: the renewable / nonrenewable signal targets above the Depot ---
  b.target('renewable', [214, 390], [250, 378], { group: 'sort', label: 'RENEWABLE' });
  b.target('nonrenewable', [322, 378], [358, 390], { group: 'sort', label: 'NONRENEWABLE' });

  // --- Hot Springs: geyser bumpers where Earth's heat leaks out along the volcanic arc ---
  SPRINGS.forEach(([x, y], i) => b.bumper(`spring_${'abc'[i]}`, x, y, { group: 'springs', r: 24, icon: 'spring' }));

  // --- Recharge rollovers: rain, snow and meltwater soaking into the valley floor ---
  RECHARGE.forEach(([x, y, l], i) => b.rollover(`rain_${i + 1}`, x, y, { group: 'rain', label: l, role: 'star' }));

  // --- Skill shot: the summit signal where a soft launch tumbles off the arch ---
  b.rollover('signal', 316, 142, { label: 'SIGNAL', r: 18 });

  // --- Inserts that preview shots ---
  // Beside the trestle (not under it, and clear of the side rail) so its label reads in full.
  b.insert('ins_west', 102, 556, { deg: -118, label: 'WEST LINE' });
  b.insert('ins_mine', 384, 740, { deg: -69, label: 'MINE' });
  // Between the OIL WELL floor label (above) and the RAIN label (below).
  b.insert('ins_oil', OIL[0], 525, { deg: -90, size: 12 });
  b.insert('ins_depot', DEPOT[0], 548, { deg: -90 });
  b.insert('ins_springs', 400, 262, { shape: 'star', size: 11 });
  b.insert('ins_rain', 286, 616, { shape: 'star', size: 10, color: WATER });
}

// ================================================================ printed playfield (2D)

function poly(ctx: CanvasRenderingContext2D, pts: P2[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16,10,22,0.8)';
  ctx.lineWidth = Math.max(2.5, size * 0.24);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

interface Sample {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

/** A polyline resampled every `step` units, with unit tangents. */
function resample(path: P2[], step: number): Sample[] {
  const out: Sample[] = [];
  let carry = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [x1, y1] = path[i];
    const [x2, y2] = path[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1e-6) continue;
    const tx = (x2 - x1) / len;
    const ty = (y2 - y1) / len;
    let d = carry;
    while (d <= len) {
      out.push({ x: x1 + tx * d, y: y1 + ty * d, tx, ty });
      d += step;
    }
    carry = d - len;
  }
  return out;
}

/** Painted railway: timber ties, then two steel rails that glow when the line is awake. */
function railway(ctx: CanvasRenderingContext2D, pts: Sample[], gauge: number, tieLen: number, tieColor: string, lit: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = tieColor;
  ctx.lineWidth = 5;
  for (const p of pts) {
    ctx.beginPath();
    ctx.moveTo(p.x + p.ty * tieLen * 0.5, p.y - p.tx * tieLen * 0.5);
    ctx.lineTo(p.x - p.ty * tieLen * 0.5, p.y + p.tx * tieLen * 0.5);
    ctx.stroke();
  }
  for (const s of [-1, 1]) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = p.x - p.ty * gauge * s;
      const y = p.y + p.tx * gauge * s;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = 'rgba(20,14,20,0.8)';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = mix('#8d8478', RAIL, lit);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    if (lit > 0.02) {
      ctx.save();
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 10 * lit;
      ctx.strokeStyle = rgba(GOLD, 0.55 * lit);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** The orbit railway painted along the West Line and around the arch (outside the trestle). */
const ORBIT_RAIL: P2[] = (() => {
  const pts: P2[] = [[49, 700], [49, 300]];
  for (let a = 180; a <= 352; a += 4) pts.push([310 + 268 * Math.cos((a * Math.PI) / 180), 300 + 268 * Math.sin((a * Math.PI) / 180)]);
  return pts;
})();
const ORBIT_SAMPLES = resample(ORBIT_RAIL, 4);
const TRESTLE_SAMPLES = resample(smoothPath(TRESTLE, 6), 15);

function derrick2d(ctx: CanvasRenderingContext2D, x: number, base: number, top: number, w: number, lit: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(16,10,22,0.7)';
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w, base);
  ctx.lineTo(x, top);
  ctx.lineTo(x + w, base);
  ctx.stroke();
  ctx.strokeStyle = mix('#a8927c', AMBER, 0.6 * lit);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w, base);
  ctx.lineTo(x, top);
  ctx.lineTo(x + w, base);
  ctx.stroke();
  for (let k = 1; k <= 4; k++) {
    const u = k / 5;
    const y = base + (top - base) * u;
    const hw = w * (1 - u);
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x + hw, y);
    const y2 = base + (top - base) * (k + 1) / 5;
    const hw2 = w * (1 - (k + 1) / 5);
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x + hw2, y2);
    ctx.stroke();
  }
  ctx.restore();
  glowDot(ctx, x, top - 3, 9, CORAL, 0.25 + 0.7 * lit);
}

function pine2d(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3b2618';
  ctx.fillRect(x - 1.5, y - h * 0.18, 3, h * 0.2);
  ctx.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    const yy = y - h * 0.15 - k * h * 0.26;
    const ww = h * (0.34 - k * 0.08);
    poly(ctx, [[x - ww, yy], [x, yy - h * 0.42], [x + ww, yy]]);
    ctx.fill();
  }
  ctx.restore();
}

function house2d(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, body: string, lit: number) {
  ctx.fillStyle = body;
  ctx.fillRect(x - w / 2, y - h, w, h);
  poly(ctx, [[x - w / 2 - 2, y - h], [x, y - h - w * 0.45], [x + w / 2 + 2, y - h]]);
  ctx.fill();
  ctx.fillStyle = lit > 0.05 ? rgba(GOLD, 0.25 + 0.7 * lit) : 'rgba(40,30,40,0.9)';
  ctx.fillRect(x - w * 0.22, y - h * 0.7, w * 0.16, h * 0.3);
  ctx.fillRect(x + w * 0.06, y - h * 0.7, w * 0.16, h * 0.3);
}

function paintPlayfield(ctx: CanvasRenderingContext2D, level: number) {
  const s0 = stage(level, 0, 0.6);
  const s1 = stage(level, 0.3, 1.2); // M1: railway and sorting yard light up
  const s2 = stage(level, 1.3, 2.2); // M2: formation clues glow
  const s3 = stage(level, 2.3, 3.1); // M3: water returns to Dry Gulch
  const s4 = stage(level, 3.4, 4); // Wonderlight
  const r = rng(19);

  // --- Twilight over a treasure map: violet sky fading to warm desert umber
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1a1534'], [0.28, '#2b1e3f'], [0.55, '#3a2532'], [0.8, '#2f1e1a'], [1, '#1a110e']]);
  ctx.fillRect(0, 0, 600, 1150);
  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = rgba(r() < 0.55 ? SAND : '#000000', 0.025 + r() * 0.04);
    ctx.fillRect(r() * 600, r() * 1150, 1 + r() * 2.2, 1 + r() * 2.2);
  }
  stars(ctx, 191, 80, [40, 22, 560, 150], IVORY);

  // --- Snowy pass: two mountain ranges under the trestle loop; snow glows when water returns
  ctx.fillStyle = mix('#272348', '#33366a', s3);
  poly(ctx, [[60, 330], [120, 230], [180, 250], [250, 150], [300, 200], [360, 140], [420, 190], [470, 150], [540, 260], [548, 340]]);
  ctx.fill();
  const peaks: [number, number, number][] = [[150, 250, 62], [238, 132, 78], [318, 178, 66], [398, 122, 82], [478, 206, 66]];
  for (const [x, py, hw] of peaks) {
    const g = ctx.createLinearGradient(x, py, x, 340);
    g.addColorStop(0, mix('#4c4466', '#6a6a9c', s3));
    g.addColorStop(1, '#2a2036');
    ctx.fillStyle = g;
    poly(ctx, [[x - hw * 1.6, 340], [x - hw * 0.2, py + 6], [x, py], [x + hw * 0.25, py + 8], [x + hw * 1.6, 340]]);
    ctx.fill();
    ctx.fillStyle = rgba(SNOW, 0.32 + 0.5 * s3);
    poly(ctx, [[x - hw * 0.5, py + 34], [x - hw * 0.2, py + 6], [x, py], [x + hw * 0.25, py + 8], [x + hw * 0.52, py + 36], [x + hw * 0.24, py + 26], [x + hw * 0.05, py + 40], [x - hw * 0.2, py + 28]]);
    ctx.fill();
  }
  label(ctx, 'SNOWY PASS', 200, 212, 11, SNOW, 0.55 + 0.4 * s3);

  // --- Volcanic arc (east): a sinking plate, a magma chamber and the volcano the trestle climbs
  ctx.fillStyle = rgba('#4b3b62', 0.55);
  poly(ctx, [[548, 420], [548, 488], [404, 790], [344, 790]]);
  ctx.fill();
  label(ctx, 'SINKING PLATE', 508, 548, 9, '#c9b8e8', 0.7, -1.13);
  const vg = ctx.createLinearGradient(470, 290, 470, 600);
  vg.addColorStop(0, '#4a3238');
  vg.addColorStop(1, '#2a1a20');
  ctx.fillStyle = vg;
  poly(ctx, [[388, 600], [456, 312], [470, 300], [496, 300], [512, 316], [548, 430], [548, 600]]);
  ctx.fill();
  // magma rising from the slab into a chamber below the mine
  ctx.save();
  ctx.strokeStyle = rgba(MAGMA, 0.15 + 0.55 * s2);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(470, 640);
  ctx.bezierCurveTo(500, 600, 470, 520, 490, 440);
  ctx.bezierCurveTo(500, 380, 480, 340, 483, 304);
  ctx.stroke();
  ctx.restore();
  glowDot(ctx, 490, 640, 40, MAGMA, 0.12 + 0.5 * s2);
  glowDot(ctx, 483, 300, 30, MAGMA, 0.15 + 0.6 * s2);
  // copper veins: hot fluids from the magma left copper minerals in the rock around the mine
  const rv = rng(44);
  for (let i = 0; i < 26; i++) {
    const a = rv() * TAU;
    const d = 30 + rv() * 60;
    const x = MINE[0] + 20 + Math.cos(a) * d * 0.7;
    const y = MINE[1] + 30 + Math.sin(a) * d;
    if (x > 545) continue;
    glowDot(ctx, x, y, 3 + rv() * 4, rv() < 0.5 ? COPPER : MALACHITE, 0.25 + 0.6 * s2);
  }
  label(ctx, 'VOLCANIC ARC', 512, 470, 10, CORAL, 0.6 + 0.35 * s2, -1.25);
  label(ctx, 'COPPER ORE', 506, 640, 10, COPPER, 0.55 + 0.4 * s2, -1.2);

  // --- Hot springs: pools of heated groundwater around the geyser bumpers
  for (const [x, y] of SPRINGS) {
    const pg = ctx.createRadialGradient(x, y, 18, x, y, 40);
    pg.addColorStop(0, rgba(MINT, 0.35 + 0.4 * s2));
    pg.addColorStop(1, rgba(MINT, 0));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#e8dcc8', 0.25 + 0.35 * s2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, TAU);
    ctx.stroke();
  }
  label(ctx, 'HOT SPRINGS', 336, 252, 10, MINT, 0.6 + 0.4 * s2);
  label(ctx, 'EARTH HEAT', 336, 265, 8, STEAM, 0.45 + 0.45 * s2);

  // --- Ancient sea basin (west): layered rock that was once a warm, shallow sea floor. Each band
  // fades out toward the valley so the basin has no hard edge.
  const bands: [number, string][] = [[340, '#6e4a33'], [380, '#5a4a55'], [420, '#7d6d5c'], [470, '#2a1c16'], [520, '#8a5c3c'], [570, '#4d4250'], [630, '#6a4a34'], [700, '#3a2c2a'], [770, '#3a2c2a']];
  const bandY = (y0: number, x: number) => y0 + 34 * Math.max(0, 1 - ((x - 140) / 120) ** 2);
  for (let i = 0; i + 1 < bands.length; i++) {
    const [y0, c] = bands[i];
    const y1 = bands[i + 1][0];
    const fade = ctx.createLinearGradient(24, 0, 268, 0);
    const a0 = i === bands.length - 2 ? 0.25 : 0.55;
    fade.addColorStop(0, rgba(c, a0));
    fade.addColorStop(0.65, rgba(c, a0 * 0.8));
    fade.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = fade;
    ctx.beginPath();
    for (let x = 24; x <= 268; x += 6) ctx.lineTo(x, bandY(y0, x));
    for (let x = 268; x >= 24; x -= 6) ctx.lineTo(x, bandY(y1, x));
    ctx.closePath();
    ctx.fill();
  }
  // oil trapped in the porous layer, glowing amber when the clues awaken
  const ro = rng(7);
  for (let i = 0; i < 36; i++) {
    const x = 40 + ro() * 196;
    const y = bandY(476, x) + ro() * 38;
    glowDot(ctx, x, y, 2.5 + ro() * 3, AMBER, (0.18 + 0.6 * s2) * (x > 200 ? 0.5 : 1));
  }
  // fossil sea life in the limestone (the organisms whose remains became oil)
  const rf = rng(12);
  for (let i = 0; i < 9; i++) {
    const x = 44 + rf() * 180;
    const y = bandY(428, x) + rf() * 30;
    ctx.save();
    ctx.strokeStyle = rgba(IVORY, 0.18 + 0.45 * s2);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 26; k++) {
      const an = k * 0.42;
      const rr = 0.35 * an;
      ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
    }
    ctx.stroke();
    ctx.restore();
  }
  derrick2d(ctx, OIL[0], 408, 340, 20, s2);
  label(ctx, 'ANCIENT SEA BASIN', 150, 620, 10, SAND, 0.6 + 0.3 * s2);
  label(ctx, 'OIL', 104, 500, 10, AMBER, 0.55 + 0.45 * s2);

  // --- Dry Gulch valley: a soft shadowed floor over its aquifer (water filling the pores of
  // buried gravel), a lens that tapers out at both ends
  ctx.save();
  ctx.translate(286, 672);
  ctx.scale(1, 0.34);
  const vf = ctx.createRadialGradient(0, 0, 40, 0, 0, 240);
  vf.addColorStop(0, 'rgba(45,30,26,0.55)');
  vf.addColorStop(1, 'rgba(45,30,26,0)');
  ctx.fillStyle = vf;
  ctx.beginPath();
  ctx.arc(0, 0, 240, 0, TAU);
  ctx.fill();
  ctx.restore();
  const AX0 = 104;
  const AX1 = 468;
  const lensW = (x: number) => Math.pow(Math.max(0, Math.sin((Math.PI * (x - AX0)) / (AX1 - AX0))), 0.6);
  const lensTop = (x: number) => 672 - 24 * lensW(x) + 3 * Math.sin(x / 23);
  const lensBot = (x: number) => 672 + 22 * lensW(x);
  const aqFade = ctx.createLinearGradient(AX0, 0, AX1, 0);
  const aqA = 0.1 + 0.42 * s3;
  aqFade.addColorStop(0, rgba(WATER, 0));
  aqFade.addColorStop(0.18, rgba(WATER, aqA));
  aqFade.addColorStop(0.82, rgba(WATER, aqA));
  aqFade.addColorStop(1, rgba(WATER, 0));
  ctx.fillStyle = aqFade;
  ctx.beginPath();
  for (let x = AX0; x <= AX1; x += 4) ctx.lineTo(x, lensTop(x));
  for (let x = AX1; x >= AX0; x -= 4) ctx.lineTo(x, lensBot(x));
  ctx.closePath();
  ctx.fill();
  const ra = rng(23);
  for (let i = 0; i < 150; i++) {
    const x = AX0 + ra() * (AX1 - AX0);
    const w = lensW(x);
    const y = lensTop(x) + 3 + ra() * Math.max(1, lensBot(x) - lensTop(x) - 6);
    ctx.fillStyle = rgba(ra() < 0.5 ? '#9a8a76' : '#6c5c50', 0.6 * w);
    ctx.beginPath();
    ctx.arc(x, y, (2 + ra() * 3) * (0.5 + 0.5 * w), 0, TAU);
    ctx.fill();
  }
  // the water table: the top of the saturated gravel
  ctx.save();
  ctx.strokeStyle = aqFade;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = AX0; x <= AX1; x += 4) ctx.lineTo(x, lensTop(x));
  ctx.stroke();
  ctx.restore();
  label(ctx, 'AQUIFER', 214, 676, 10, WATER, 0.55 + 0.45 * s3);
  // recharge: rain and meltwater soak down from each rollover to the aquifer
  for (const [x, y] of RECHARGE) {
    const yEnd = lensTop(x) - 4;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = rgba(WATER, 0.2 + 0.6 * s3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 18);
    ctx.lineTo(x, yEnd - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(WATER, 0.25 + 0.6 * s3);
    poly(ctx, [[x - 5, yEnd - 9], [x + 5, yEnd - 9], [x, yEnd]]);
    ctx.fill();
    ctx.restore();
  }
  // the town around the Depot, with a water tower; windows light when water returns
  house2d(ctx, 214, 528, 20, 14, '#2a1d24', s3);
  house2d(ctx, 240, 520, 14, 12, '#31222a', s3);
  house2d(ctx, 340, 520, 16, 12, '#31222a', s3);
  house2d(ctx, 364, 530, 20, 14, '#2a1d24', s3);
  ctx.fillStyle = '#2a1d24';
  ctx.fillRect(392, 470, 3, 34);
  ctx.fillRect(405, 470, 3, 34);
  ctx.fillStyle = mix('#3a2a34', WATER, 0.6 * s3);
  ctx.fillRect(386, 446, 28, 24);
  label(ctx, 'DRY GULCH', DEPOT[0], 588, 11, IVORY, 0.6 + 0.3 * s3);
  // the station roof over the Depot
  ctx.fillStyle = mix('#3b2620', '#8a2f2a', s1);
  poly(ctx, [[250, 438], [286, 412], [322, 438], [316, 444], [286, 422], [256, 444]]);
  ctx.fill();
  glowDot(ctx, DEPOT[0], 430, 7, GOLD, 0.3 + 0.6 * s1);
  // the sorting signals' names in print below each target (the 3D target faces are small); 34 units
  // out, so they clear the 2D view's own target labels at 16
  label(ctx, 'RENEWABLE', 243, 416, 11, MINT, 0.72 + 0.28 * s1, -0.32);
  label(ctx, 'NONRENEWABLE', 330, 416, 11, CORAL, 0.72 + 0.28 * s1, 0.32);

  // --- Timberland (south-west) with replanted saplings, and topsoil farms (south-east)
  const rt = rng(31);
  for (let i = 0; i < 16; i++) {
    const x = 102 + rt() * 136;
    const y = 716 + rt() * 70;
    pine2d(ctx, x, y, 20 + rt() * 14, mix('#24402e', PINE, s1), 0.85);
  }
  for (let i = 0; i < 5; i++) pine2d(ctx, 246 + i * 11, 790, 9, mix('#2c4a32', '#8fe388', s1), 0.9);
  label(ctx, 'TIMBERLAND', 168, 800, 9, '#8fe388', 0.55 + 0.4 * s1);
  ctx.save();
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = rgba('#5c3d22', 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(306, 744 + i * 9);
    ctx.quadraticCurveTo(366, 736 + i * 9, 430, 748 + i * 9);
    ctx.stroke();
    ctx.strokeStyle = rgba('#8fbf5a', 0.25 + 0.4 * s1);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(308, 741 + i * 9);
    ctx.quadraticCurveTo(366, 733 + i * 9, 428, 745 + i * 9);
    ctx.stroke();
  }
  ctx.restore();
  label(ctx, 'TOPSOIL FARMS', 368, 796, 9, '#d9c08a', 0.5 + 0.35 * s1);

  // --- The railways: West Line + arch rails, the trestle's timber ties, the mine tunnel
  railway(ctx, ORBIT_SAMPLES.filter((_, i) => i % 3 === 0), 8, 22, rgba(TIMBER, 0.75), s1, 0.85);
  railway(ctx, TRESTLE_SAMPLES, 9, 48, rgba(TIMBER, 0.95), s1, 0.9);
  ctx.fillStyle = 'rgba(14,9,12,0.88)';
  poly(ctx, [TUNNEL_UPPER[0], TUNNEL_UPPER[1], TUNNEL_LOWER[2], TUNNEL_LOWER[1], TUNNEL_LOWER[0]]);
  ctx.fill();
  railway(ctx, resample([[397, 702], MINE], 12), 7, 30, rgba(TIMBER, 0.95), s1);
  glowDot(ctx, MINE[0], MINE[1], 30, COPPER, 0.18 + 0.4 * s2);
  label(ctx, 'TREASURE LINE', 512, 380, 11, GOLD, 0.6 + 0.4 * s1, -1.3);
  label(ctx, 'PUMP', 100, 432, 9, WATER, 0.6 + 0.4 * s3, -Math.PI / 2);

  // --- Treasure route: X marks each deposit where the map's clues point (lit by mission 2)
  ctx.save();
  ctx.setLineDash([6, 7]);
  ctx.strokeStyle = rgba(GOLD, 0.12 + 0.5 * s2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(OIL[0] + 30, OIL[1] - 30);
  ctx.quadraticCurveTo(250, 300, SPRINGS[2][0] - 34, SPRINGS[2][1] + 10);
  ctx.moveTo(SPRINGS[2][0] + 6, SPRINGS[2][1] + 34);
  ctx.quadraticCurveTo(410, 470, MINE[0] - 28, MINE[1] - 10);
  ctx.stroke();
  ctx.restore();
  for (const [x, y] of [[OIL[0] + 38, OIL[1] - 40], [SPRINGS[2][0] - 42, SPRINGS[2][1] + 8], [MINE[0] - 34, MINE[1] - 16]] as P2[]) {
    ctx.save();
    ctx.strokeStyle = rgba(CORAL, 0.3 + 0.65 * s2);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6);
    ctx.lineTo(x + 6, y + 6);
    ctx.moveTo(x + 6, y - 6);
    ctx.lineTo(x - 6, y + 6);
    ctx.stroke();
    ctx.restore();
  }

  // --- Marquee lettering low on the map (lights after the second discovery)
  neonText(ctx, 'TREASURE RAILWAY', 286, 822, 20, GOLD, stage(level, 1.5, 2.5));
  // a faint first glow so the dormant map is never a black void
  if (s0 > 0) glowDot(ctx, DEPOT[0], DEPOT[1], 90, GOLD, 0.06 * s0);
  // --- Wonderlight: the whole map warms to gold
  if (s4 > 0) {
    ctx.fillStyle = rgba(GOLD, 0.07 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    const rs = rng(77);
    for (let i = 0; i < 40; i++) glowDot(ctx, 40 + rs() * 520, 40 + rs() * 740, 4 + rs() * 6, [GOLD, MINT, COPPER][i % 3], 0.5 * s4);
  }
}

function paintAmbient({ ctx, t, level, reduced, energy }: SceneryContext) {
  const s1 = stage(level, 0.3, 1.2);
  const s2 = stage(level, 1.3, 2.2);
  if (s1 > 0.01 && !reduced) {
    // a little lantern train running the orbit rails: headlight and three glowing cars
    const n = ORBIT_SAMPLES.length;
    const head = Math.floor(((t * (0.05 + 0.04 * energy)) % 1) * n);
    for (let k = 0; k < 4; k++) {
      const p = ORBIT_SAMPLES[(head - k * 5 + n * 4) % n];
      glowDot(ctx, p.x, p.y, k === 0 ? 11 : 6, k === 0 ? GOLD : [COPPER, WATER, PINE][k - 1], (k === 0 ? 0.8 : 0.55) * s1);
    }
  }
  if (s2 > 0.01 && !reduced) {
    // steam rising off the hot springs
    for (const [x, y] of SPRINGS) drift(ctx, Math.round(x + y), 4, t, STEAM, [x - 22, y - 70, x + 22, y - 20], 10, 2.2, 0.35 * s2);
  }
}

function paintCelebrate({ ctx, t }: SceneryContext, p: number) {
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
  const g = ctx.createRadialGradient(DEPOT[0], DEPOT[1], 10, DEPOT[0], DEPOT[1], 460);
  g.addColorStop(0, rgba(GOLD, 0.85));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.restore();
  // sparks race along the trestle like a train of light
  const n = TRESTLE_SAMPLES.length;
  for (let k = 0; k < 14; k++) {
    const s = TRESTLE_SAMPLES[Math.floor(((p * 1.4 + k / 14) % 1) * (n - 1))];
    glowDot(ctx, s.x, s.y, 10, [GOLD, COPPER, MINT, WATER][k % 4], 1 - p);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + t * 0.3;
    const d = 50 + p * 280;
    glowDot(ctx, DEPOT[0] + Math.cos(a) * d, DEPOT[1] + Math.sin(a) * d * 0.85, 9, [GOLD, CORAL, MINT][i % 3], 1 - p);
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
  return tex;
}

/** A straight beam between two points (for lattice towers, frames and trestle bents). */
function beam(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(t, len, t);
  const dir = b.clone().sub(a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** Lattice tower (oil derrick, windmill tower, headframe) as one merged geometry. */
function latticeTower(h: number, base: number, top: number, levels: number, t: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const corner = (u: number, i: number) => {
    const w = (base + (top - base) * u) / 2;
    const sx = i === 0 || i === 3 ? -1 : 1;
    const sz = i < 2 ? -1 : 1;
    return new THREE.Vector3(sx * w, u * h, sz * w);
  };
  for (let i = 0; i < 4; i++) parts.push(beam(corner(0, i), corner(1, i), t * 1.4));
  for (let k = 0; k <= levels; k++) {
    const u = k / levels;
    for (let i = 0; i < 4; i++) parts.push(beam(corner(u, i), corner(u, (i + 1) % 4), t));
    if (k < levels) {
      const u2 = (k + 1) / levels;
      for (let i = 0; i < 4; i++) parts.push(beam(corner(u, i), corner(u2, (i + 1) % 4), t * 0.7));
    }
  }
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

/** Layered sandstone texture for mesas (the strata of the ancient sea basin). */
function paintStrata(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cols = ['#b56b40', '#cf8a52', '#8e5a3c', '#d9a46a', '#a0603a', '#c47a48', '#7a4a32'];
  const r = rng(5);
  let y = 0;
  let i = 0;
  while (y < h) {
    const bh = h * (0.06 + r() * 0.1);
    ctx.fillStyle = cols[i++ % cols.length];
    ctx.fillRect(0, y, w, bh + 1);
    y += bh;
  }
  for (let k = 0; k < 600; k++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
    ctx.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 2);
  }
}

/** Parchment treasure map under the whole attraction (sides are what the camera sees). */
function paintGroundMap(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.5);
  g.addColorStop(0, '#9b7a52');
  g.addColorStop(0.75, '#7a5a3c');
  g.addColorStop(1, '#3a281c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(9);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '60,40,20' : '230,200,150'},${0.04 + r() * 0.06})`;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
  }
  // contour lines of hills and basins
  ctx.strokeStyle = 'rgba(70,45,25,0.35)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 9; k++) {
    const cx = r() * w;
    const cy = r() * h;
    for (let j = 1; j <= 4; j++) {
      ctx.beginPath();
      for (let a = 0; a <= 40; a++) {
        const ang = (a / 40) * TAU;
        const rr = j * 16 * (1 + 0.15 * Math.sin(ang * 3 + k));
        ctx.lineTo(cx + Math.cos(ang) * rr * 1.4, cy + Math.sin(ang) * rr);
      }
      ctx.stroke();
    }
  }
  // dotted trails and X marks
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(150,40,40,0.55)';
  ctx.lineWidth = 4;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(r() * w, r() * h);
    ctx.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineWidth = 6;
  for (let k = 0; k < 7; k++) {
    const x = r() * w;
    const y = r() * h;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 12);
    ctx.lineTo(x + 12, y + 12);
    ctx.moveTo(x + 12, y - 12);
    ctx.lineTo(x - 12, y + 12);
    ctx.stroke();
  }
  // compass rose
  const cx = w * 0.22;
  const cy = h * 0.8;
  ctx.fillStyle = 'rgba(80,50,28,0.7)';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const len = k % 2 ? 40 : 80;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.lineTo(cx + Math.cos(a + 0.3) * 14, cy + Math.sin(a + 0.3) * 14);
    ctx.lineTo(cx + Math.cos(a - 0.3) * 14, cy + Math.sin(a - 0.3) * 14);
    ctx.closePath();
    ctx.fill();
  }
}

/** Distant panorama behind the head: mesas, a volcano chain, and the Wonderlight aurora. */
function paintPanorama(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const s4 = stage(level, 3.4, 4);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#120f2a');
  g.addColorStop(0.6, '#3a2446');
  g.addColorStop(1, '#5a3030');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,247,231,${0.3 + r() * 0.6})`;
    ctx.fillRect(r() * w, r() * h * 0.55, 1.5, 1.5);
  }
  if (s4 > 0) {
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = rgba([GOLD, MINT, COPPER][k], 0.35 * s4);
      ctx.lineWidth = 18;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.18 + k * 0.07) + Math.sin(x / 90 + k) * 20);
      ctx.stroke();
    }
  }
  // volcano chain on the right with glowing craters
  ctx.fillStyle = '#2a1d33';
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h);
  ctx.lineTo(w * 0.68, h * 0.42);
  ctx.lineTo(w * 0.71, h * 0.42);
  ctx.lineTo(w * 0.8, h * 0.7);
  ctx.lineTo(w * 0.88, h * 0.5);
  ctx.lineTo(w * 0.9, h * 0.5);
  ctx.lineTo(w, h * 0.75);
  ctx.lineTo(w, h);
  ctx.fill();
  const lv = stage(level, 1.3, 2.2);
  for (const x of [0.695, 0.89]) {
    const gg = ctx.createRadialGradient(w * x, h * 0.44, 2, w * x, h * 0.44, 50);
    gg.addColorStop(0, rgba(MAGMA, 0.25 + 0.6 * lv));
    gg.addColorStop(1, rgba(MAGMA, 0));
    ctx.fillStyle = gg;
    ctx.fillRect(w * x - 50, h * 0.44 - 50, 100, 100);
  }
  // mesas on the left
  ctx.fillStyle = '#3a2430';
  for (const [x0, x1, top] of [[0, 0.16, 0.62], [0.2, 0.32, 0.7], [0.36, 0.44, 0.78]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * x0, h);
    ctx.lineTo(w * x0 + 20, h * top);
    ctx.lineTo(w * x1 - 20, h * top);
    ctx.lineTo(w * x1, h);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,199,91,0.08)';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

/** Firework bursts over the side regions: large soft sparks that bloom, droop and fade.
 *  One Points object for every burst; only animates while lit. */
function fireworkShow(kit: SetKit, areas: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[], colors: string[]) {
  const per = kit.n(90);
  const bursts = areas.length * 3;
  const n = per * bursts;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = kit.track(new THREE.PointsMaterial({ size: 0.44, vertexColors: true, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  kit.add(pts);
  const r = rng(91);
  const dirs = Array.from({ length: per }, () => {
    const u = r() * 2 - 1;
    const th = r() * TAU;
    const sq = Math.sqrt(1 - u * u);
    return [sq * Math.cos(th), u, sq * Math.sin(th)];
  });
  const palette = colors.map((c) => new THREE.Color(c));
  let lit = 0;
  let clock = 0;
  for (let i = 0; i < n; i++) pos[i * 3 + 1] = -50;
  kit.animate((_t, dt) => {
    clock += dt;
    if (lit <= 0.01) return;
    for (let b = 0; b < bursts; b++) {
      const area = areas[b % areas.length];
      const period = 2.4 + (b % 3) * 0.35;
      const phase = clock / period + b * 0.37;
      const cycle = Math.floor(phase);
      const cyc = phase - cycle;
      const h = (cycle * 7919 + b * 104729) % 1000;
      const cx = area.x0 + ((h * 0.37) % 1) * (area.x1 - area.x0);
      const cy = area.y0 + ((h * 0.61) % 1) * (area.y1 - area.y0);
      const cz = area.z0 + ((h * 0.83) % 1) * (area.z1 - area.z0);
      const c = palette[(cycle + b) % palette.length];
      const rad = 1.5 * (1 - (1 - cyc) ** 3);
      const fade = Math.max(0, 1 - cyc) ** 1.4 * lit;
      for (let k = 0; k < per; k++) {
        const i = b * per + k;
        const d = dirs[k];
        pos[i * 3] = cx + d[0] * rad;
        pos[i * 3 + 1] = cy + d[1] * rad - cyc * cyc * 0.7;
        pos[i * 3 + 2] = cz + d[2] * rad;
        col[i * 3] = c.r * fade;
        col[i * 3 + 1] = c.g * fade;
        col[i * 3 + 2] = c.b * fade;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });
  return { setLit: (v: number) => { lit = v; mat.opacity = Math.min(1, v * 1.2); } };
}

interface Train {
  cars: THREE.Group[];
  headMat: THREE.MeshStandardMaterial;
  glowMats: THREE.MeshStandardMaterial[];
  stack: THREE.Object3D;
}

function makeTrain(kit: SetKit): Train {
  const dark = kit.mats.plastic('#1d1a22');
  const red = kit.mats.plastic('#b8433c');
  const brass = kit.mats.brass();
  const wheelGeo = (n: number, len: number) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      for (const sx of [-1, 1]) {
        const w = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12);
        w.rotateZ(Math.PI / 2);
        w.translate(sx * 0.1, 0.05, -len / 2 + (len * (i + 0.5)) / n);
        parts.push(w);
      }
    }
    const g = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    return g;
  };
  // Locomotive: built facing +z
  const loco = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.6), dark);
  chassis.position.y = 0.09;
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 18).rotateX(Math.PI / 2), red);
  boiler.position.set(0, 0.21, 0.08);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.2), red);
  cab.position.set(0, 0.24, -0.2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.25), dark);
  roof.position.set(0, 0.36, -0.2);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.13, 12), brass);
  stack.position.set(0, 0.36, 0.17);
  const headMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a2010', emissive: GOLD, emissiveIntensity: 0.2 }));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), headMat);
  lamp.position.set(0, 0.25, 0.27);
  const catcher = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.1, 4).rotateX(Math.PI / 2), brass);
  catcher.position.set(0, 0.08, 0.32);
  const wheels = new THREE.Mesh(wheelGeo(3, 0.5), dark);
  loco.add(chassis, boiler, cab, roof, stack, lamp, catcher, wheels);
  // Cars: copper ore, water tank, timber
  const cars: THREE.Group[] = [loco];
  const glowMats: THREE.MeshStandardMaterial[] = [];
  const carBase = (body: THREE.Material) => {
    const g = new THREE.Group();
    const w = new THREE.Mesh(wheelGeo(2, 0.36), dark);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.42), body);
    b.position.y = 0.15;
    g.add(w, b);
    return g;
  };
  const ore = carBase(kit.mats.paintedMetal('#4a4652'));
  const oreMat = kit.track(new THREE.MeshStandardMaterial({ color: '#7a4a2a', emissive: COPPER, emissiveIntensity: 0.1, roughness: 0.5, flatShading: true }));
  const nug: THREE.BufferGeometry[] = [];
  const rr = rng(4);
  for (let i = 0; i < 9; i++) nug.push(new THREE.IcosahedronGeometry(0.045 + rr() * 0.025, 0).translate((rr() - 0.5) * 0.16, 0.23 + rr() * 0.04, (rr() - 0.5) * 0.32));
  const nuggets = new THREE.Mesh(mergeGeometries(nug), oreMat);
  nug.forEach((g) => g.dispose());
  ore.add(nuggets);
  glowMats.push(oreMat);
  const tank = carBase(kit.mats.plastic('#2a2a34'));
  const waterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#1d4a6a', emissive: WATER, emissiveIntensity: 0.08, roughness: 0.25, metalness: 0.3 }));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.38, 18).rotateX(Math.PI / 2), waterMat);
  drum.position.y = 0.27;
  tank.add(drum);
  glowMats.push(waterMat);
  const logs = carBase(kit.mats.plastic('#3b2a22'));
  const logGeo: THREE.BufferGeometry[] = [];
  for (const [x, y] of [[-0.06, 0.25], [0.06, 0.25], [0, 0.33]] as P2[]) logGeo.push(new THREE.CylinderGeometry(0.05, 0.05, 0.44, 10).rotateX(Math.PI / 2).translate(x, y, 0));
  const logMesh = new THREE.Mesh(mergeGeometries(logGeo), kit.mats.plastic('#8a5a34'));
  logGeo.forEach((g) => g.dispose());
  logs.add(logMesh);
  cars.push(ore, tank, logs);
  for (const c of cars) {
    c.scale.setScalar(1.35);
    c.traverse((o) => (o.castShadow = true));
    kit.add(c);
  }
  return { cars, headMat, glowMats, stack };
}

const railwaySet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  const Y0 = gy + 0.05;
  kit.sky('#2a1f4f', '#07050d');

  // ---- Ground: a parchment treasure map under the whole attraction
  const mapTex = canvasTex(kit, 1024, 1024, (ctx) => paintGroundMap(ctx, 1024, 1024));
  const groundMat = kit.track(new THREE.MeshStandardMaterial({ map: mapTex, color: '#a08870', roughness: 0.95 }));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(26, 64).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = gy;
  ground.receiveShadow = true;
  kit.add(ground);

  // ---- The Treasure Line loop: around the cabinet, onto a trestle on the east side, and through
  // tunnels under the front (so it never crosses the player's view)
  const YU = gy - 1.5;
  const YT = gy + 0.75;
  const ctrl: V3[] = [
    [-4.55, Y0, 3.5], [-4.6, Y0, 1.6], [-4.6, Y0, -1.6], [-4.6, Y0, -4.6], [-4.0, Y0, -6.6], [-2.2, Y0, -7.4], [0, Y0, -7.6],
    [2.2, Y0, -7.4], [4.0, Y0, -6.6], [4.65, Y0 + 0.12, -4.8], [4.75, YT, -2.9], [4.75, YT, 0.0], [4.7, Y0 + 0.28, 2.2],
    [4.55, Y0, 3.5], [4.3, YU, 4.9], [1.8, YU, 5.7], [-1.8, YU, 5.7], [-4.3, YU, 4.9],
  ];
  const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
  const L = curve.getLength();
  const N = kit.n(220);
  const pts = curve.getSpacedPoints(N);
  const up = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const railL: THREE.Vector3[] = [];
  const railR: THREE.Vector3[] = [];
  const tieMtx: THREE.Matrix4[] = [];
  const bentMtx: THREE.Matrix4[] = [];
  const bulbPos: THREE.Vector3[] = [];
  const q = new THREE.Quaternion();
  for (let i = 0; i < N; i++) {
    const p = pts[i];
    tan.copy(pts[(i + 1) % N]).sub(pts[(i + N - 1) % N]).normalize();
    side.crossVectors(tan, up).normalize();
    railL.push(p.clone().addScaledVector(side, 0.09).setY(p.y + 0.04));
    railR.push(p.clone().addScaledVector(side, -0.09).setY(p.y + 0.04));
    if (p.y < gy - 0.2) continue;
    const yaw = Math.atan2(tan.x, tan.z);
    q.setFromAxisAngle(up, yaw);
    if (i % 2 === 0) tieMtx.push(new THREE.Matrix4().compose(p.clone().setY(p.y + 0.015), q, new THREE.Vector3(1, 1, 1)));
    if (p.y > gy + 0.25 && i % 6 === 0) bentMtx.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, gy + (p.y - gy) / 2, p.z), q, new THREE.Vector3(1, p.y - gy, 1)));
    if (i % 5 === 0) bulbPos.push(p.clone().addScaledVector(side, 0.2).setY(p.y + 0.09));
  }
  const railMat = kit.mats.paintedMetal('#b9a88a');
  for (const rp of [railL, railR]) {
    const rc = new THREE.CatmullRomCurve3(rp, true);
    kit.add(new THREE.Mesh(new THREE.TubeGeometry(rc, N, 0.016, 5, true), railMat));
  }
  const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.03, 0.07), kit.mats.plastic('#4a3020'), tieMtx.length);
  tieMtx.forEach((m, i) => ties.setMatrixAt(i, m));
  ties.receiveShadow = true;
  kit.add(ties);
  // timber trestle bents under the elevated east side
  const bentGeo = mergeGeometries([
    new THREE.BoxGeometry(0.04, 1, 0.04).translate(-0.17, 0, 0),
    new THREE.BoxGeometry(0.04, 1, 0.04).translate(0.17, 0, 0),
    new THREE.BoxGeometry(0.4, 0.035, 0.035).translate(0, 0.25, 0),
    new THREE.BoxGeometry(0.4, 0.035, 0.035).translate(0, -0.2, 0),
  ]);
  if (bentMtx.length) {
    const bents = new THREE.InstancedMesh(bentGeo, kit.mats.plastic('#6b4a32'), bentMtx.length);
    bentMtx.forEach((m, i) => bents.setMatrixAt(i, m));
    bents.castShadow = true;
    kit.add(bents);
  }
  kit.track(bentGeo);
  // lantern garlands strung between poles over both side regions (bulbs share the line's instances)
  const garlands: [V3, V3, number][] = [
    [[-8.3, 2.5, -4.0], [-5.25, 1.9, -0.9], 0.35],
    [[-5.25, 1.9, -0.9], [-8.4, 2.2, 3.9], 0.32],
    [[5.12, 1.9, 0.1], [8.4, 2.4, 0.4], 0.32],
    [[8.4, 2.4, 0.4], [8.2, 2.0, 4.3], 0.3],
  ];
  const poleSpots: V3[] = [[-8.3, 2.5, -4.0], [-5.25, 1.9, -0.9], [-8.4, 2.2, 3.9], [5.12, 1.9, 0.1], [8.4, 2.4, 0.4], [8.2, 2.0, 4.3]];
  poleSpots.forEach(([x, h, z]) => kit.pole([x, 0, z], h, '#6b4a32'));
  const wireMat = kit.mats.dark();
  for (const [a, b, sag] of garlands) {
    const wp: THREE.Vector3[] = [];
    const nb = kit.n(11);
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      wp.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag, a[2] + (b[2] - a[2]) * u));
    }
    kit.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wp), 24, 0.008, 4), wireMat));
    for (let i = 0; i < nb; i++) {
      const u = (i + 0.5) / nb;
      bulbPos.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * sag - 0.05, a[2] + (b[2] - a[2]) * u));
    }
  }
  // lantern bulbs along the line and garlands (one instanced mesh, coloured per bulb)
  const bulbMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 10, 8), bulbMat, bulbPos.length);
  const bulbCols = [GOLD, COPPER, MINT, WATER].map((c) => new THREE.Color(c));
  bulbPos.forEach((p, i) => {
    bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
    bulbs.setColorAt(i, bulbCols[i % 4]);
  });
  kit.add(bulbs);
  // tunnel portals where the line dives under the front of the attraction
  const rockMat = kit.track(new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.95, flatShading: true }));
  for (const sx of [-1, 1]) {
    const portal = new THREE.Group();
    const stone = kit.mats.plastic('#7a6a5e');
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 18, Math.PI), stone);
    arch.position.y = 0.24;
    const legs = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(0.14, 0.26, 0.2).translate(-0.3, 0.11, 0), new THREE.BoxGeometry(0.14, 0.26, 0.2).translate(0.3, 0.11, 0)]), stone);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.26, 18, 0, Math.PI), kit.mats.dark());
    mouth.position.set(0, 0.24, 0.02);
    const mouthLow = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.24), kit.mats.dark());
    mouthLow.position.set(0, 0.12, 0.02);
    const hillGeo = new THREE.IcosahedronGeometry(0.6, 1);
    const hp = hillGeo.attributes.position as THREE.BufferAttribute;
    const rh = rng(sx > 0 ? 5 : 6);
    for (let i = 0; i < hp.count; i++) {
      const k = 0.85 + rh() * 0.3;
      hp.setXYZ(i, hp.getX(i) * k, Math.max(-0.05, hp.getY(i) * k), hp.getZ(i) * k);
    }
    hillGeo.computeVertexNormals();
    const hill = new THREE.Mesh(hillGeo, rockMat);
    hill.scale.set(1.05, 0.5, 0.8);
    hill.position.set(0, -0.02, -0.4);
    portal.add(hill, arch, legs, mouth, mouthLow);
    portal.position.set(sx * 4.56, gy, 3.62);
    portal.rotation.y = Math.PI + sx * 0.08;
    kit.add(portal);
  }

  const train = makeTrain(kit);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  let trainU = 0.34;
  const spacing = 0.78 / L;
  const placeTrain = () => {
    for (let k = 0; k < train.cars.length; k++) {
      const c = train.cars[k];
      const u = (trainU - k * spacing + 2) % 1;
      curve.getPointAt(u, tmpA);
      curve.getPointAt((u + 0.003) % 1, tmpB);
      c.position.copy(tmpA);
      c.lookAt(tmpB);
      c.visible = tmpA.y > gy - 0.25;
    }
  };
  placeTrain();

  // smoke puffs from the locomotive's stack
  const PUFFS = kit.n(28);
  const puffPos = new Float32Array(PUFFS * 3);
  const puffBirth = new Float32Array(PUFFS).fill(-99);
  // park every puff below the ground until it is born (reduced motion never moves them)
  for (let i = 0; i < PUFFS; i++) puffPos[i * 3 + 1] = -50;
  const puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute('position', new THREE.BufferAttribute(puffPos, 3));
  const puffMat = kit.track(new THREE.PointsMaterial({ color: '#e9e2ff', size: 0.22, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, opacity: 0.5 }));
  const puffs = new THREE.Points(puffGeo, puffMat);
  puffs.frustumCulled = false;
  kit.add(puffs);
  const puffOrigin = new Float32Array(PUFFS * 3);
  let puffNext = 0;
  let puffClock = 0;

  // ---- West: the ancient sea basin (mesas of layered rock), an oil derrick and a pumpjack
  const strataTex = canvasTex(kit, 256, 256, (ctx) => paintStrata(ctx, 256, 256));
  const strataMat = kit.track(new THREE.MeshStandardMaterial({ map: strataTex, roughness: 0.9 }));
  const capMat = kit.mats.plastic('#9a6a46');
  for (const [x, z, rt, rb, h, seed] of [[-7.7, -1.9, 0.85, 1.15, 1.3, 3], [-7.7, 1.5, 0.55, 0.8, 0.85, 9]] as number[][]) {
    const mg = new THREE.CylinderGeometry(rt, rb, h, 14, 3);
    const mp = mg.attributes.position as THREE.BufferAttribute;
    const rm = rng(seed);
    const jit = Array.from({ length: 15 }, () => 0.85 + rm() * 0.3);
    for (let i = 0; i < mp.count; i++) {
      const a = Math.atan2(mp.getZ(i), mp.getX(i));
      const k = jit[Math.round(((a + Math.PI) / TAU) * 14) % 14];
      mp.setX(i, mp.getX(i) * k);
      mp.setZ(i, mp.getZ(i) * k);
    }
    mg.computeVertexNormals();
    const mesa = new THREE.Mesh(mg, [strataMat, capMat, capMat]);
    mesa.position.set(x, gy + h / 2, z);
    mesa.castShadow = true;
    mesa.receiveShadow = true;
    kit.add(mesa);
  }
  const derrickMat = kit.mats.paintedMetal('#c9a46a');
  const derrick = new THREE.Mesh(latticeTower(2.0, 0.7, 0.14, 6, 0.035), derrickMat);
  derrick.position.set(-6.55, gy, 0.15);
  derrick.castShadow = true;
  kit.add(derrick);
  const beaconMat = kit.track(new THREE.MeshStandardMaterial({ color: '#300', emissive: CORAL, emissiveIntensity: 0.2 }));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), beaconMat);
  beacon.position.set(-6.55, gy + 2.07, 0.15);
  kit.add(beacon);
  // pumpjack: the walking beam nods as oil is drawn up
  const pj = new THREE.Group();
  const pjDark = kit.mats.paintedMetal('#2d2a36');
  const pjBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.3), pjDark);
  pjBase.position.y = 0.04;
  const sampson = new THREE.Mesh(mergeGeometries([beam(new THREE.Vector3(-0.15, 0, -0.1), new THREE.Vector3(0, 0.62, 0), 0.05), beam(new THREE.Vector3(0.15, 0, 0.1), new THREE.Vector3(0, 0.62, 0), 0.05), beam(new THREE.Vector3(-0.15, 0, 0.1), new THREE.Vector3(0, 0.62, 0), 0.05)]), pjDark);
  const walking = new THREE.Group();
  walking.position.y = 0.64;
  const beamBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.08), kit.mats.plastic('#c8a040'));
  const horse = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.09, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2), kit.mats.plastic('#c8a040'));
  horse.position.x = 0.5;
  horse.rotation.z = -Math.PI / 2;
  walking.add(beamBar, horse);
  const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16).rotateX(Math.PI / 2), kit.mats.plastic('#b8433c'));
  crank.position.set(-0.38, 0.24, 0);
  pj.add(pjBase, sampson, walking, crank);
  pj.position.set(-5.65, gy, -2.55);
  pj.rotation.y = 0.75;
  pj.scale.setScalar(1.15);
  kit.add(pj);
  // giant fossil ammonite half-buried in the basin: sea life that became oil
  const shellPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const a = i * 0.16;
    const rr = 0.04 * Math.exp(0.18 * a);
    shellPts.push(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, 0));
  }
  const shellCurve = new THREE.CatmullRomCurve3(shellPts);
  const shellGeo = new THREE.TubeGeometry(shellCurve, 120, 0.06, 8, false);
  const sp = shellGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(sp, i);
    const k = 0.4 + 1.6 * Math.min(1, Math.hypot(v.x, v.y) / 0.5);
    sp.setZ(i, v.z * k);
  }
  shellGeo.computeVertexNormals();
  const fossilMat = kit.track(new THREE.MeshStandardMaterial({ color: '#d9c7a0', emissive: AMBER, emissiveIntensity: 0.03, roughness: 0.55 }));
  const fossil = new THREE.Mesh(shellGeo, fossilMat);
  fossil.position.set(-5.65, gy + 0.18, 1.25);
  fossil.rotation.set(-0.9, 0.5, 0);
  fossil.scale.setScalar(1.4);
  kit.add(fossil);

  // ---- West front: the windmill pump and Dry Gulch's water tank
  const mill = new THREE.Group();
  const millTower = new THREE.Mesh(latticeTower(1.7, 0.5, 0.12, 5, 0.03), kit.mats.paintedMetal('#9a9aa8'));
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.78, 0.12);
  const bladeGeo: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const g = new THREE.BoxGeometry(0.07, 0.36, 0.01).translate(0, 0.24, 0).rotateZ((i / 12) * TAU);
    bladeGeo.push(g);
  }
  const blades = new THREE.Mesh(mergeGeometries(bladeGeo), kit.mats.plastic('#e8e2d0'));
  bladeGeo.forEach((g) => g.dispose());
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10).rotateX(Math.PI / 2), kit.mats.brass());
  rotor.add(blades, hub);
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.36), kit.mats.plastic('#b8433c'));
  vane.position.set(0, 1.78, -0.3);
  mill.add(millTower, rotor, vane);
  mill.position.set(-6.15, gy, 3.6);
  mill.rotation.y = 0.35;
  kit.add(mill);
  const tankG = new THREE.Group();
  const tankLegs = new THREE.Mesh(latticeTower(0.8, 0.5, 0.42, 2, 0.03), kit.mats.plastic('#6b4a32'));
  const tankWaterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#5b3d26', emissive: WATER, emissiveIntensity: 0.03, roughness: 0.6 }));
  const tankBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 18), tankWaterMat);
  tankBody.position.y = 1.05;
  const tankRoof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.22, 18), kit.mats.plastic('#7a3a30'));
  tankRoof.position.y = 1.41;
  tankG.add(tankLegs, tankBody, tankRoof);
  // in view beside the windmill (it was past the left edge of the desktop frame), with the pump's
  // pipe running from the mill to the tank; both fill with light when Dry Gulch's water returns
  tankG.position.set(-6.35, gy, 2.55);
  kit.add(tankG);
  const pumpPipeMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a4652', emissive: WATER, emissiveIntensity: 0.04, metalness: 0.5, roughness: 0.35 }));
  const pumpPipeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-6.2, gy + 0.05, 3.36), new THREE.Vector3(-6.27, gy + 0.06, 2.98), new THREE.Vector3(-6.3, gy + 0.1, 2.75), new THREE.Vector3(-6.3, gy + 0.8, 2.72)]);
  kit.add(new THREE.Mesh(new THREE.TubeGeometry(pumpPipeCurve, 16, 0.035, 6, false), pumpPipeMat));

  // ---- Station: the Treasure Depot at the back-left corner of the line
  const depot = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.7), kit.mats.plastic('#7a4a32'));
  walls.position.y = 0.35;
  const windowTex = canvasTex(kit, 256, 128, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#fff';
    for (const x of [24, 88, 152, 216]) ctx.fillRect(x - 14, 34, 28, 44);
  });
  const winMat = kit.track(new THREE.MeshStandardMaterial({ color: '#000', emissive: GOLD, emissiveMap: windowTex, emissiveIntensity: 0.1, transparent: true, alphaMap: windowTex, depthWrite: false }));
  const windows = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), winMat);
  windows.position.set(0, 0.35, 0.356);
  const roofGeo = mergeGeometries([
    new THREE.BoxGeometry(1.7, 0.04, 0.52).rotateX(-0.62).translate(0, 0.84, -0.2),
    new THREE.BoxGeometry(1.7, 0.04, 0.52).rotateX(0.62).translate(0, 0.84, 0.2),
    new THREE.BoxGeometry(2.1, 0.03, 0.42).rotateX(0.25).translate(0, 0.62, 0.58),
  ]);
  const depotRoof = new THREE.Mesh(roofGeo, kit.track(new THREE.MeshStandardMaterial({ color: '#8a2f2a', roughness: 0.7 })));
  const platform = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.6), kit.mats.wood());
  platform.position.set(0, 0.04, 0.62);
  depot.add(walls, windows, depotRoof, platform);
  depot.position.set(-6.3, gy, -4.7);
  depot.rotation.y = 0.35;
  depot.traverse((o) => (o.castShadow = true));
  kit.add(depot);
  const depotSign = kit.neonSign('TREASURE DEPOT', [-6.25, gy + 1.7, -4.45], { height: 0.32, color: GOLD, rotY: 0.35 });
  depotSign.rotation.x = -0.45;
  const marquee = kit.neonSign('TREASURE RAILWAY', [0, 1.6, -8.6], { height: 0.7, color: GOLD });
  marquee.rotation.x = -0.7;

  // ---- East: the volcanic arc, the copper mine in its flank, hot springs and a geothermal plant
  const vH = 3.0;
  const vR = 2.1;
  const vGeoBase = new THREE.CylinderGeometry(0.32, vR, vH, 16, 7);
  const vp = vGeoBase.attributes.position as THREE.BufferAttribute;
  const rv = rng(21);
  for (let i = 0; i < vp.count; i++) {
    const y = vp.getY(i);
    const u = (y + vH / 2) / vH;
    if (u > 0.99) continue;
    const a = Math.atan2(vp.getZ(i), vp.getX(i));
    const k = 1 + 0.1 * Math.sin(a * 4 + 1) * (1 - u) + 0.05 * Math.sin(a * 9) + (rv() - 0.5) * 0.04;
    vp.setX(i, vp.getX(i) * k);
    vp.setZ(i, vp.getZ(i) * k);
  }
  const vGeo = vGeoBase.toNonIndexed();
  vGeoBase.dispose();
  const vpos = vGeo.attributes.position as THREE.BufferAttribute;
  const vcol = new Float32Array(vpos.count * 3);
  const cBase = new THREE.Color('#5a3a30');
  const cRock = new THREE.Color('#3a2c38');
  const cSnow = new THREE.Color('#e8eefa');
  const c = new THREE.Color();
  for (let f = 0; f < vpos.count; f += 3) {
    const cy = (vpos.getY(f) + vpos.getY(f + 1) + vpos.getY(f + 2)) / 3;
    const u = (cy + vH / 2) / vH;
    if (u > 0.74 && u < 0.97) c.copy(cSnow);
    else c.copy(cBase).lerp(cRock, Math.min(1, u * 1.6));
    c.multiplyScalar(0.88 + 0.24 * rv());
    for (let j = 0; j < 3; j++) vcol.set([c.r, c.g, c.b], (f + j) * 3);
  }
  vGeo.setAttribute('color', new THREE.BufferAttribute(vcol, 3));
  vGeo.computeVertexNormals();
  const volcano = new THREE.Mesh(vGeo, kit.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true })));
  const VX = 7.0;
  const VZ = -3.3;
  volcano.position.set(VX, gy + vH / 2, VZ);
  volcano.castShadow = true;
  volcano.receiveShadow = true;
  kit.add(volcano);
  const craterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#200', emissive: MAGMA, emissiveIntensity: 0.15 }));
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.1, 14), craterMat);
  crater.position.set(VX, gy + vH + 0.0, VZ);
  kit.add(crater);
  const smoke = kit.motes({ x0: VX - 0.3, x1: VX + 0.3, y0: gy + vH + 0.1, y1: gy + vH + 2.0, z0: VZ - 0.3, z1: VZ + 0.3 }, 40, '#b8a8c8', { speed: 0.35, size: 0.3 });
  const craterLight = kit.point([VX, gy + vH + 0.6, VZ], MAGMA, 0, 7);
  // copper veins glowing inside the mountain's flank
  const veinMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1a14', emissive: COPPER, emissiveIntensity: 0.05, roughness: 0.4, flatShading: true }));
  const veinParts: THREE.BufferGeometry[] = [];
  const rvn = rng(8);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.55 + rvn() * 0.5);
    const u = 0.12 + rvn() * 0.4;
    const rad = vR * (1 - u * 0.85) + 0.02;
    veinParts.push(new THREE.IcosahedronGeometry(0.05 + rvn() * 0.05, 0).translate(VX + Math.cos(a) * rad, gy + u * vH, VZ + Math.sin(a) * rad));
  }
  const veins = new THREE.Mesh(mergeGeometries(veinParts), veinMat);
  veinParts.forEach((g) => g.dispose());
  kit.add(veins);
  // the mine portal, with rails and ore carts rolling out of the mountain
  const mine = new THREE.Group();
  const timber = kit.mats.plastic('#6b4a32');
  const frame = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(0.09, 0.62, 0.09).translate(-0.3, 0.31, 0),
    new THREE.BoxGeometry(0.09, 0.62, 0.09).translate(0.3, 0.31, 0),
    new THREE.BoxGeometry(0.78, 0.1, 0.12).translate(0, 0.66, 0),
  ]), timber);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.6), kit.mats.dark());
  hole.position.set(0, 0.3, -0.04);
  const mineSignTex = canvasTex(kit, 512, 128, (ctx) => {
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 504, 120);
    ctx.fillStyle = '#ffe2b0';
    ctx.font = '800 66px "Fraunces Variable", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('COPPER MINE', 256, 68, 470);
  });
  const mineSign = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.21), kit.track(new THREE.MeshStandardMaterial({ map: mineSignTex, roughness: 0.7 })));
  mineSign.position.set(0, 0.84, 0.05);
  mineSign.rotation.x = -0.3;
  const spurRails = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(0.025, 0.025, 1.6).translate(-0.12, 0.012, 0.8),
    new THREE.BoxGeometry(0.025, 0.025, 1.6).translate(0.12, 0.012, 0.8),
  ]), kit.mats.paintedMetal('#b9a88a'));
  const cartMat = kit.mats.paintedMetal('#3a3644');
  const cartOreMat = kit.track(new THREE.MeshStandardMaterial({ color: '#4a6a3a', emissive: MALACHITE, emissiveIntensity: 0.08, flatShading: true }));
  const cartCopperMat = kit.track(new THREE.MeshStandardMaterial({ color: '#7a4a2a', emissive: COPPER, emissiveIntensity: 0.08, flatShading: true }));
  const carts: THREE.Group[] = [];
  for (let k = 0; k < 2; k++) {
    const cart = new THREE.Group();
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.18, 4, 1).rotateY(Math.PI / 4), cartMat);
    bin.position.y = 0.16;
    const lumps: THREE.BufferGeometry[] = [];
    const rl = rng(13 + k);
    for (let i = 0; i < 6; i++) lumps.push(new THREE.IcosahedronGeometry(0.05 + rl() * 0.03, 0).translate((rl() - 0.5) * 0.18, 0.27, (rl() - 0.5) * 0.18));
    const lumpMesh = new THREE.Mesh(mergeGeometries(lumps), k ? cartOreMat : cartCopperMat);
    lumps.forEach((g) => g.dispose());
    cart.add(bin, lumpMesh);
    cart.position.set(0, 0, 0.5 + k * 0.5);
    carts.push(cart);
    mine.add(cart);
  }
  mine.add(frame, hole, mineSign, spurRails);
  mine.position.set(5.55, gy, -1.75);
  mine.rotation.y = -0.55;
  mine.traverse((o) => (o.castShadow = true));
  kit.add(mine);
  // headframe with a turning sheave wheel
  const head = new THREE.Group();
  const headTower = new THREE.Mesh(latticeTower(1.5, 0.5, 0.2, 4, 0.03), kit.mats.paintedMetal('#7a6a5a'));
  const sheave = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 22), kit.mats.paintedMetal('#c86a3a'));
  sheave.position.set(0, 1.58, 0);
  head.add(headTower, sheave);
  head.position.set(6.4, gy, -0.7);
  kit.add(head);
  // hot springs: a travertine terrace pool fed by heated groundwater, with a geyser
  const spring = new THREE.Group();
  const terrace = new THREE.Mesh(mergeGeometries([
    new THREE.CylinderGeometry(0.85, 0.95, 0.1, 24).translate(0, 0.05, 0),
    new THREE.CylinderGeometry(0.62, 0.7, 0.1, 24).translate(0, 0.15, 0),
  ]), kit.mats.plastic('#e4d6bc'));
  const poolMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0e4a52', emissive: MINT, emissiveIntensity: 0.12, roughness: 0.15, metalness: 0.2 }));
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24).rotateX(-Math.PI / 2), poolMat);
  pool.position.y = 0.205;
  const plumeMat = kit.track(new THREE.MeshBasicMaterial({ color: STEAM, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 1, 14, 1, true).translate(0, 0.5, 0), plumeMat);
  plume.position.y = 0.2;
  spring.add(terrace, pool, plume);
  spring.position.set(5.85, gy, 1.0);
  spring.scale.setScalar(0.8);
  kit.add(spring);
  const steam = kit.motes({ x0: 5.5, x1: 6.2, y0: gy + 0.2, y1: gy + 2.1, z0: 0.7, z1: 1.3 }, 46, STEAM, { speed: 0.55, size: 0.24 });
  // geothermal plant: steam turns turbines; the cooled water is piped back underground. It sits in
  // view beside the hot spring (the desktop frame ends near x = 7 here), tower behind the hall.
  const plant = new THREE.Group();
  const hall = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.6), kit.mats.plastic('#cfd6de'));
  hall.position.y = 0.225;
  const towerPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    towerPts.push(new THREE.Vector2(0.32 - 0.14 * Math.sin(u * Math.PI) + 0.02 * u, u * 0.9));
  }
  const coolTower = new THREE.Mesh(new THREE.LatheGeometry(towerPts, 20), kit.mats.plastic('#b9c2cc'));
  coolTower.position.set(0.12, 0, -0.55);
  // the reinjection pipe leaves the front of the hall and dives back into the ground
  const pipeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3, 0.2, 0.28), new THREE.Vector3(-0.42, 0.24, 0.5), new THREE.Vector3(-0.5, 0.06, 0.66), new THREE.Vector3(-0.52, -0.3, 0.7)]);
  const reinjectMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a4652', emissive: WATER, emissiveIntensity: 0.05, metalness: 0.5, roughness: 0.3 }));
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 20, 0.045, 8, false), reinjectMat);
  plant.add(hall, coolTower, pipe);
  plant.position.set(6.55, gy, 2.35);
  plant.rotation.y = -0.3;
  plant.scale.setScalar(0.75);
  plant.traverse((o) => (o.castShadow = true));
  kit.add(plant);
  const plantSteam = kit.motes({ x0: 6.6, x1: 6.95, y0: gy + 0.72, y1: gy + 2.1, z0: 1.85, z1: 2.15 }, 24, STEAM, { speed: 0.4, size: 0.28 });
  const geoSign = kit.neonSign('GEOTHERMAL', [6.4, gy + 0.5, 2.82], { height: 0.17, color: MINT, rotY: -0.3 });
  geoSign.rotation.x = -0.55;

  // ---- East front: a replanted timber forest (renewable only while regrowth keeps pace)
  const treeSpots: [number, number, number][] = [];
  const rtr = rng(61);
  for (let i = 0; i < kit.n(24); i++) {
    const x = 5.3 + rtr() * 3.1;
    const z = 2.7 + rtr() * 1.9;
    const h = 0.42 + rtr() * 0.4;
    // leave the geothermal plant's lot clear
    treeSpots.push(x > 5.7 && z < 3.2 ? [x, z + 0.8, h] : [x, z, h]);
  }
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 1, 6).translate(0, 0.5, 0), kit.mats.plastic('#5b3a24'), treeSpots.length);
  const crownMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.24, 1, 8).translate(0, 0.5, 0), kit.mats.plastic('#2f7a4a'), treeSpots.length);
  treeSpots.forEach(([x, z, h], i) => {
    trunkMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, gy, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 0.35, 1)));
    crownMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, gy + h * 0.22, z), new THREE.Quaternion(), new THREE.Vector3(h, h, h)));
  });
  trunkMesh.castShadow = true;
  crownMesh.castShadow = true;
  kit.add(trunkMesh);
  kit.add(crownMesh);
  const saplingMat = kit.track(new THREE.MeshStandardMaterial({ color: '#4a8a3a', emissive: '#8fe388', emissiveIntensity: 0.05 }));
  const saplings = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.26, 6).translate(0, 0.13, 0), saplingMat, 7);
  for (let i = 0; i < 7; i++) saplings.setMatrixAt(i, new THREE.Matrix4().makeTranslation(4.95 + i * 0.19, gy, 2.35 + (i % 2) * 0.18));
  kit.add(saplings);
  const stumps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 8).translate(0, 0.04, 0), kit.mats.plastic('#8a6a4a'), 4);
  for (let i = 0; i < 4; i++) stumps.setMatrixAt(i, new THREE.Matrix4().makeTranslation(5.05 + i * 0.33, gy, 2.2));
  kit.add(stumps);

  // ---- The sorting signals by the cabinet's front corners: renewable (mint), nonrenewable (coral)
  const signal = (text: string, x: number, color: string, rotY: number) => {
    kit.pole([x, 0, 3.9], 1.25, '#5a4a48');
    const s = kit.neonSign(text, [x, 1.1, 3.95], { height: 0.2, color, rotY });
    s.rotation.x = -0.6;
    const lampMat = kit.track(new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: 0.1 }));
    const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), lampMat);
    lampM.position.set(x, 1.38, 3.9);
    kit.add(lampM);
    return { s, lampMat };
  };
  const sigRenew = signal('RENEWABLE', -4.05, MINT, 0.3);
  const sigNon = signal('NONRENEWABLE', 4.05, CORAL, -0.3);

  // ---- Head backdrop, motes, fireworks and lights
  const pano = kit.backdrop(paintPanorama, { width: 30, height: 10, z: -15 });
  const motes = kit.motes({ x0: -10, x1: 10, y0: 0, y1: 5, z0: -9, z1: 6 }, 90, GOLD, { speed: 0.1, size: 0.09 });
  const fireworks = fireworkShow(kit, [
    { x0: -8.3, x1: -6.0, y0: 1.9, y1: 2.8, z0: -4.6, z1: -0.8 },
    { x0: 6.0, x1: 8.3, y0: 1.9, y1: 2.8, z0: -1.4, z1: 2.4 },
  ], [GOLD, COPPER, MINT, WATER, CORAL]);
  // golden Wonderlight pools on the ground of both side regions
  const poolGlowMat = kit.track(new THREE.MeshBasicMaterial({ color: GOLD, map: radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 'pool'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  for (const sx of [-1, 1]) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 11).rotateX(-Math.PI / 2), poolGlowMat);
    glow.position.set(sx * 6.6, gy + 0.012, -0.6);
    glow.renderOrder = 1;
    kit.add(glow);
  }
  // the volcano showers golden sparks once the Wonderlight is earned
  const sparks = kit.motes({ x0: VX - 0.25, x1: VX + 0.25, y0: gy + vH + 0.05, y1: gy + vH + 2.6, z0: VZ - 0.25, z1: VZ + 0.25 }, 60, GOLD, { speed: 1.4, size: 0.22 });
  // a treasure chest at the station that opens as the supplies arrive
  const chest = new THREE.Group();
  const chestWood = kit.mats.plastic('#6b3f22');
  const chestBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.4), chestWood);
  chestBox.position.y = 0.16;
  const goldMat = kit.track(new THREE.MeshStandardMaterial({ color: '#7a5a10', emissive: GOLD, emissiveIntensity: 0.1, metalness: 0.6, roughness: 0.3 }));
  const coins: THREE.BufferGeometry[] = [];
  const rc = rng(17);
  for (let i = 0; i < 14; i++) coins.push(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10).toNonIndexed().rotateX(rc() * 0.8).translate((rc() - 0.5) * 0.46, 0.33 + rc() * 0.05, (rc() - 0.5) * 0.28));
  for (let i = 0; i < 4; i++) coins.push(new THREE.IcosahedronGeometry(0.05, 0).translate((rc() - 0.5) * 0.4, 0.36, (rc() - 0.5) * 0.22));
  const hoard = new THREE.Mesh(mergeGeometries(coins), goldMat);
  coins.forEach((g) => g.dispose());
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.32, -0.2);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), chestWood);
  lid.position.z = 0.2;
  lidPivot.add(lid);
  const bands = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(0.05, 0.33, 0.42).translate(-0.2, 0.16, 0), new THREE.BoxGeometry(0.05, 0.33, 0.42).translate(0.2, 0.16, 0)]), kit.mats.brass());
  chest.add(chestBox, hoard, lidPivot, bands);
  chest.position.set(-5.35, gy, 2.15);
  chest.rotation.y = 0.5;
  chest.scale.setScalar(0.9);
  kit.add(chest);
  kit.spot([-5, 6, 4], [-6.4, 0, -1], GOLD, 30, 0.5);
  kit.spot([5, 6, 4], [6.2, 0, -0.5], CORAL, 26, 0.5);

  // ---- Motion (routed through kit.animate: skipped under reduced motion, frozen when paused)
  let lvl = 0;
  let clock = 0;
  let geyserPhase = 0;
  kit.animate((_t, dt) => {
    clock += dt;
    const s1 = kit.stage(lvl, 0.3, 1.2);
    const s4 = kit.stage(lvl, 3.4, 4);
    const speed = (0.15 + 0.55 * s1 + 0.8 * s4) * (lvl > 0.05 ? 1 : 0.4);
    trainU = (trainU + (dt * speed) / L) % 1;
    placeTrain();
    rotor.rotation.z -= dt * (0.6 + 2.2 * s1);
    walking.rotation.z = Math.sin(clock * (1 + kit.stage(lvl, 1.3, 2.2) * 1.2)) * 0.28;
    crank.rotation.z = clock * (1 + kit.stage(lvl, 1.3, 2.2) * 1.2);
    sheave.rotation.z = -clock * (0.5 + 1.5 * kit.stage(lvl, 1.3, 2.2));
    for (let k = 0; k < carts.length; k++) carts[k].position.z = 0.5 + k * 0.5 + 0.12 * Math.sin(clock * 0.8 + k);
    // geyser: periodic eruption once the hot springs awaken
    const s2 = kit.stage(lvl, 1.3, 2.2);
    geyserPhase = (geyserPhase + dt * 0.35) % 1;
    const burst = Math.max(s2 * Math.max(0, Math.sin(geyserPhase * Math.PI * 2)) ** 2, s4 * (0.7 + 0.3 * Math.sin(clock * 5)));
    plume.scale.set(1, 0.05 + 1.9 * burst, 1);
    plumeMat.opacity = 0.32 * burst;
    // smoke puffs from the stack while the train runs
    puffClock += dt;
    if (puffClock > 0.22 && train.cars[0].visible) {
      puffClock = 0;
      train.stack.getWorldPosition(tmpA);
      puffOrigin[puffNext * 3] = tmpA.x;
      puffOrigin[puffNext * 3 + 1] = tmpA.y + 0.05;
      puffOrigin[puffNext * 3 + 2] = tmpA.z;
      puffBirth[puffNext] = clock;
      puffNext = (puffNext + 1) % PUFFS;
    }
    for (let i = 0; i < PUFFS; i++) {
      const age = clock - puffBirth[i];
      if (age > 2.2 || age < 0) {
        puffPos[i * 3 + 1] = -50;
        continue;
      }
      puffPos[i * 3] = puffOrigin[i * 3] + Math.sin(i) * 0.1 * age;
      puffPos[i * 3 + 1] = puffOrigin[i * 3 + 1] + age * 0.42;
      puffPos[i * 3 + 2] = puffOrigin[i * 3 + 2] + Math.cos(i) * 0.1 * age;
    }
    puffGeo.attributes.position.needsUpdate = true;
  });

  return {
    update(t, _dt, level, energy) {
      lvl = level;
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      pano.repaint(level);
      // the line and station wake first (a dormant set still glows softly)
      bulbMat.color.setScalar(0.12 + 0.5 * s1 + 0.5 * s4 * (kit.reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 3)));
      train.headMat.emissiveIntensity = 0.3 + 2.6 * s1;
      winMat.emissiveIntensity = 0.15 + 1.8 * s1;
      depotSign.setLit(0.2 + 0.8 * s1);
      marquee.setLit(0.1 + 0.9 * s2);
      sigRenew.s.setLit(0.15 + 0.85 * s1);
      sigNon.s.setLit(0.15 + 0.85 * s1);
      const blink = kit.reducedMotion ? 1 : 0.5 + 0.5 * Math.sin(t * 2.4);
      sigRenew.lampMat.emissiveIntensity = 0.1 + 2.4 * s1 * blink;
      sigNon.lampMat.emissiveIntensity = 0.1 + 2.4 * s1 * (1 - blink);
      // formation clues: magma, copper, oil, hot springs
      craterMat.emissiveIntensity = 0.3 + 2.6 * s2 + 0.6 * energy * s2;
      if (craterLight) craterLight.intensity = 1 + 9 * s2;
      veinMat.emissiveIntensity = 0.05 + 1.8 * s2;
      cartCopperMat.emissiveIntensity = 0.08 + 1.6 * s2;
      cartOreMat.emissiveIntensity = 0.08 + 1.2 * s2;
      train.glowMats[0].emissiveIntensity = 0.1 + 1.4 * Math.max(s2, s4);
      beaconMat.emissiveIntensity = 0.3 + 2.2 * s2 * (kit.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(t * 4));
      fossilMat.emissiveIntensity = 0.03 + 0.5 * s2;
      poolMat.emissiveIntensity = 0.15 + 1.0 * s2;
      geoSign.setLit(0.15 + 0.85 * s2);
      steam.setLit(0.1 + 0.6 * s2);
      plantSteam.setLit(0.1 + 0.6 * s2);
      smoke.setLit(0.15 + 0.4 * s2);
      // water returns: tank and reinjection pipe glow, the water car lights
      tankWaterMat.emissiveIntensity = 0.03 + 0.9 * s3;
      reinjectMat.emissiveIntensity = 0.05 + 1.5 * s3;
      pumpPipeMat.emissiveIntensity = 0.04 + 1.6 * s3;
      train.glowMats[1].emissiveIntensity = 0.08 + 1.4 * Math.max(s3, s4);
      saplingMat.emissiveIntensity = 0.05 + 0.6 * Math.max(s1, s3);
      puffMat.opacity = 0.25 + 0.4 * s0;
      motes.setLit(0.2 + 0.4 * s1 + 0.4 * s4);
      fireworks.setLit(s4);
      poolGlowMat.opacity = 0.05 * s1 + 0.3 * s4;
      sparks.setLit(s4);
      goldMat.emissiveIntensity = 0.1 + 0.5 * s3 + 2.2 * s4;
      lidPivot.rotation.x = -1.9 * Math.max(0.12 * s1, s4);
    },
    celebrate(p) {
      const c = Math.sin(p * Math.PI);
      fireworks.setLit(Math.max(c, lvl >= 3.9 ? 1 : 0));
      sparks.setLit(c);
      bulbMat.color.setScalar(1);
      lidPivot.rotation.x = -1.9 * Math.max(c, 0.12);
    },
  };
};

// ================================================================ dollhouse room vignette

const railwayRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  // an oval of track with timber ties (ties are one instanced mesh)
  const RX = 0.74;
  const RZ = 0.42;
  const CZ = 0.12;
  const railMat = kit.track(new T.MeshStandardMaterial({ color: '#c9b48f', metalness: 0.6, roughness: 0.35, emissive: GOLD, emissiveIntensity: 0.02 }));
  const rail = new T.Mesh(new T.TorusGeometry(1, 0.012, 6, 72), railMat);
  rail.rotation.x = -Math.PI / 2;
  rail.scale.set(RX, RZ, 1);
  rail.position.set(0, 0.035, CZ);
  kit.add(rail);
  const tieCount = 30;
  const ties = new T.InstancedMesh(new T.BoxGeometry(0.1, 0.012, 0.03), kit.mats.plastic('#5a3a24'), tieCount);
  const q = new T.Quaternion();
  for (let i = 0; i < tieCount; i++) {
    const a = (i / tieCount) * TAU;
    q.setFromAxisAngle(new T.Vector3(0, 1, 0), -a);
    ties.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(Math.cos(a) * RX, 0.026, CZ + Math.sin(a) * RZ), q, new T.Vector3(1, 1, 1)));
  }
  kit.add(ties);
  // the volcanic arc mountain with a glowing crater and its copper mine
  const mtn = new T.Mesh(new T.ConeGeometry(0.36, 0.66, 9), kit.mats.plastic('#5a4048'));
  mtn.position.set(0.2, 0.33, -0.5);
  const cap = new T.Mesh(new T.ConeGeometry(0.13, 0.17, 9), kit.mats.plastic('#eef2fa'));
  cap.position.set(0.2, 0.585, -0.5);
  const craterMat = kit.track(new T.MeshStandardMaterial({ color: '#200', emissive: MAGMA, emissiveIntensity: 0.1 }));
  const crater = new T.Mesh(new T.SphereGeometry(0.045, 10, 8), craterMat);
  crater.position.set(0.2, 0.68, -0.5);
  const portal = new T.Mesh(new T.BoxGeometry(0.1, 0.12, 0.02), kit.mats.dark());
  portal.position.set(0.13, 0.07, -0.19);
  const oreMat = kit.track(new T.MeshStandardMaterial({ color: '#7a4a2a', emissive: COPPER, emissiveIntensity: 0.1, flatShading: true }));
  const pile = new T.Mesh(new T.IcosahedronGeometry(0.07, 0), oreMat);
  pile.scale.set(1, 0.55, 1);
  pile.position.set(0.32, 0.03, -0.16);
  kit.add(mtn);
  kit.add(cap);
  kit.add(crater);
  kit.add(portal);
  kit.add(pile);
  // the ancient-sea basin: a striped mesa and an oil derrick
  const mesa = new T.Mesh(new T.CylinderGeometry(0.16, 0.21, 0.22, 10), kit.mats.plastic('#b56b40'));
  mesa.position.set(-0.55, 0.11, -0.6);
  const derrickM = new T.Mesh(latticeTower(0.6, 0.2, 0.05, 4, 0.012), kit.mats.paintedMetal('#c9a46a'));
  derrickM.position.set(-0.84, 0, -0.4);
  kit.add(mesa);
  kit.add(derrickM);
  // Dry Gulch's water tower and a replanted pine
  const tankMat = kit.track(new T.MeshStandardMaterial({ color: '#5b3d26', emissive: WATER, emissiveIntensity: 0.05 }));
  const tank = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.16, 14), tankMat);
  tank.position.set(0.86, 0.38, -0.45);
  const legs = new T.Mesh(latticeTower(0.3, 0.16, 0.14, 1, 0.01), kit.mats.plastic('#6b4a32'));
  legs.position.set(0.86, 0, -0.45);
  const pine = new T.Mesh(new T.ConeGeometry(0.09, 0.3, 8), kit.mats.plastic('#2f7a4a'));
  pine.position.set(-0.3, 0.15, -0.68);
  kit.add(tank);
  kit.add(legs);
  kit.add(pine);
  // a little train (locomotive, ore car, water car) circling the oval
  const loco = new T.Group();
  const boiler = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.15, 12).rotateX(Math.PI / 2), kit.mats.plastic('#b8433c'));
  boiler.position.set(0, 0.075, 0.03);
  const headMat = kit.track(new T.MeshStandardMaterial({ color: '#221', emissive: GOLD, emissiveIntensity: 0.2 }));
  const cab = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.07), headMat);
  cab.position.set(0, 0.085, -0.07);
  loco.add(boiler, cab);
  kit.add(loco);
  const cars = [oreMat, tankMat].map((m) => {
    const car = new T.Mesh(new T.BoxGeometry(0.09, 0.06, 0.12), m);
    kit.add(car);
    return car;
  });
  const sign = kit.neonSign('ALL ABOARD', [0, 1.3, -0.8], { height: 0.2, color: GOLD });
  const place = (obj: THREE.Object3D, a: number, y: number) => {
    obj.position.set(Math.cos(a) * RX, y, CZ + Math.sin(a) * RZ);
    obj.rotation.y = Math.atan2(-Math.sin(a) * RX, Math.cos(a) * RZ);
  };
  return {
    update(t, lit) {
      const a = kit.reducedMotion ? 1.3 : t * (0.35 + 0.4 * lit);
      place(loco, a, 0.03);
      for (let k = 0; k < cars.length; k++) place(cars[k], a - 0.36 * (k + 1), 0.065);
      railMat.emissiveIntensity = 0.02 + 0.6 * lit;
      craterMat.emissiveIntensity = 0.1 + 2.4 * lit;
      tankMat.emissiveIntensity = 0.05 + 0.9 * lit;
      headMat.emissiveIntensity = 0.2 + 2 * lit;
      oreMat.emissiveIntensity = 0.1 + 1.4 * lit;
      sign.setLit(lit);
    },
  };
};

// ================================================================ mission-driven table script

/** Shot ids worth previewing in a stage (mirrors the session's preview rules). */
function stageShots(st: Stage | undefined): string[] {
  if (!st) return [];
  if (st.kind === 'collect') return st.preview ?? [];
  if (st.kind === 'shots') return st.shots;
  return [];
}

export const L19: TableDef = {
  lessonId: 'L19',
  signature: 'A Mine-Cart Scoop that dispatches the Wonderball around the whole map on the Treasure Line trestle',
  ballRole: 'The Wonderball is a game token standing in for one load of cargo. Real ore and timber are hauled by the ton, while oil and water mostly flow through pipes.',
  theme: {
    bg: ['#2b1e3f', '#1a110e'],
    rail: '#d9b98a',
    railHighlight: '#fff3d6',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: COPPER,
    accent2: MINT,
    bumperCap: '#8fe8e6',
    bumperRing: '#24485a',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(214,150,90,0.24)',
    trail: GOLD,
  },
  lines: {
    intro: "All aboard the Resource Treasure Railway! Every stop on this map is a clue to why Earth's treasures turn up where they do.",
    quark: '"If a resource is renewable, we can use as much as we like and it will never run out, right?" Professor Quark wonders.',
    pipTip: 'A launch just under half strength tumbles onto the SIGNAL lamp. Then shoot up the mine tunnel from the left flipper to ride the Treasure Line.',
  },
  build,
  skillShot: 'signal',
  shots: [
    { id: 'mine', label: 'Mine-Cart Scoop', on: [{ type: 'saucer', id: 'mine_cart' }, { type: 'rampEnter', id: 'treasure_line' }], insert: 'ins_mine' },
    { id: 'westLine', label: 'West Line', on: [{ type: 'shot', id: 'west_sw' }], insert: 'ins_west' },
    { id: 'oilWell', label: 'Oil Well', on: [{ type: 'saucer', id: 'oil_well' }], insert: 'ins_oil' },
    { id: 'springs', label: 'Hot Springs', on: [{ type: 'bumper', group: 'springs' }], insert: 'ins_springs' },
    { id: 'rain', label: 'Recharge rollovers', on: [{ type: 'rollover', group: 'rain' }], insert: 'ins_rain' },
    { id: 'depot', label: 'Treasure Depot', on: [{ type: 'saucer', id: 'depot' }], insert: 'ins_depot' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Renewable or Not?',
      brief: 'Haul loads on the railway, then sort each one by how long nature takes to replace it, measured against a human lifetime.',
      objectiveIds: ['L19-O1'],
      stages: [
        { kind: 'collect', text: 'Haul 3 loads: Mine, West Line or Oil Well', match: [{ type: 'saucer', id: ['mine_cart', 'oil_well'] }, { type: 'shot', id: 'west_sw' }], count: 3, preview: ['mine', 'westLine', 'oilWell'] },
        { kind: 'collect', text: 'Sort the loads: RENEWABLE and NONRENEWABLE', match: { type: 'target', group: 'sort' }, count: 2, distinct: true, lamps: ['renewable', 'nonrenewable'] },
        { kind: 'discover', text: 'Check your sorting at the Treasure Depot', pocket: 'depot', questions: 1 },
      ],
      discovery: 'Renewable means nature replaces it within about a human lifetime, not that it never runs out. Use a lake or a forest faster than nature refills or regrows it and it still runs low.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Read the Rocks',
      brief: 'Each treasure formed where the right Earth processes met. Follow the map clues to the oil basin, the copper arc and the hot springs.',
      objectiveIds: ['L19-O2'],
      stages: [
        { kind: 'shots', text: 'Dig where the clues point: Oil, Mine, Springs', shots: ['oilWell', 'mine', 'springs'], order: 'any' },
        { kind: 'discover', text: 'Match each find to its story at the Depot', pocket: 'depot', questions: 1, types: ['match', 'order'] },
      ],
      discovery: 'Resources cluster where their forming conditions met: most oil formed from sea life buried under ancient warm, shallow seas, most copper ore above sinking plates, and geothermal heat is strongest near plate boundaries.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Water for Dry Gulch',
      brief: "Dry Gulch shares one slow-refilling aquifer. Let rain and snow recharge it, pump only what came back, then plan the town's share.",
      objectiveIds: ['L19-O4', 'L19-O3'],
      stages: [
        { kind: 'collect', text: 'Recharge: roll through RAIN, SNOW and MELT', match: { type: 'rollover', group: 'rain' }, count: 3, distinct: true, lamps: ['rain_1', 'rain_2', 'rain_3'] },
        { kind: 'collect', text: 'Pump only what came back: West Line PUMP x2', match: { type: 'shot', id: 'west_sw' }, count: 2, preview: ['westLine'] },
        { kind: 'discover', text: 'Plan the water budget at the Depot', pocket: 'depot', questions: 1, types: ['numeric', 'classify'] },
      ],
      discovery: 'A shared aquifer holds steady only while total pumping stays within what rain and snow put back. Pump more and the water table keeps falling, so towns plan each share.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Supply the Mansion',
    brief: 'Run every route on the Treasure Railway, then bring the supplies home to the Depot.',
    stages: [
      { kind: 'shots', text: 'Run every route: Mine, West Line, Oil, Springs', shots: ['mine', 'westLine', 'oilWell', 'springs'], order: 'any' },
      { kind: 'discover', text: 'Unload the supplies at the Treasure Depot', pocket: 'depot', questions: 2 },
    ],
    celebration: 'Water, copper, oil and timber roll in along the line, geothermal steam spins the turbines, and the mansion glows again. Use every supply with care. The Wonderlight is yours!',
  },
  onProgress(rt: TableRuntime, { slot, stage: st, level }) {
    // The trestle's glow strip pulses whenever the Mine (its only way in) is a useful shot,
    // and stays lit once the Wonderlight is earned.
    const stages = slot === 3 ? L19.finale.stages : slot < 3 ? L19.missions[slot as 0 | 1 | 2].stages : [];
    const want = stageShots(stages[st]).includes('mine');
    rt.get<Ramp>('treasure_line').lamp = want ? 'pulse' : level >= 4 ? 'on' : 'off';
  },
  set: railwaySet,
  room: railwayRoom,
  icons: {
    spring(ctx, s) {
      // a geyser: a jet of hot water rising from a pool
      ctx.beginPath();
      ctx.ellipse(0, s * 0.62, s * 0.8, s * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, s * 0.55);
      ctx.quadraticCurveTo(-s * 0.1, -s * 0.2, -s * 0.42, -s * 0.62);
      ctx.quadraticCurveTo(0, -s * 0.95, s * 0.42, -s * 0.62);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.2, s * 0.16, s * 0.55);
      ctx.closePath();
      ctx.fill();
    },
    cart(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, -s * 0.3);
      ctx.lineTo(s * 0.8, -s * 0.3);
      ctx.lineTo(s * 0.55, s * 0.4);
      ctx.lineTo(-s * 0.55, s * 0.4);
      ctx.closePath();
      ctx.fill();
      for (const x of [-0.35, 0.35]) {
        ctx.beginPath();
        ctx.arc(x * s, s * 0.62, s * 0.2, 0, TAU);
        ctx.fill();
      }
      for (const [x, y] of [[-0.35, -0.42], [0.05, -0.5], [0.4, -0.4]]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, s * 0.18, 0, TAU);
        ctx.fill();
      }
    },
    derrick(ctx, s) {
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, s * 0.85);
      ctx.lineTo(0, -s * 0.85);
      ctx.lineTo(s * 0.55, s * 0.85);
      ctx.moveTo(-s * 0.35, s * 0.25);
      ctx.lineTo(s * 0.35, s * 0.25);
      ctx.moveTo(-s * 0.18, -s * 0.3);
      ctx.lineTo(s * 0.18, -s * 0.3);
      ctx.moveTo(-s * 0.35, s * 0.25);
      ctx.lineTo(s * 0.18, -s * 0.3);
      ctx.stroke();
    },
    depot(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, -s * 0.05);
      ctx.lineTo(0, -s * 0.8);
      ctx.lineTo(s * 0.9, -s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.65, -s * 0.05, s * 1.3, s * 0.8);
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
export default L19;
