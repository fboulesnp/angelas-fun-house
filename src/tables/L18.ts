// Lesson 18 — The Water Cycle — "Raindrop Royal Regatta"
// A royal harbor regatta at the foot of two mountains. The Cloud Ramp tunnels into Rain
// Mountain, climbs into the sky and rains down the garden side; the one-way Runoff Run carries
// water back to the sea; the Soak-In Well sends it underground to re-emerge at a spring; the
// Garden Lane's leaf spinner lifts water through plants; the Glacier melts on Snow Peak; the
// Aquifer Grotto (Wonder Pocket) holds groundwater. The sun's energy lifts water, gravity
// brings it down, and no drop has to visit every stop.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { Portal } from '../game/table/mechanisms.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import {
  TAU, branch, glowDot, mix, neonText, rgba, rng, rrect, stage, stars, stringLights, vgrad,
} from '../game/render/art.ts';

const NAVY = '#0b1a3a';
const AQUA = '#5FD9EE';
const FOAM = '#DFF7FF';
const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const LEAF = '#8FE388';
const SNOW = '#EEF8FF';
const ICE = '#BFE9FF';
const ROCK = '#4d5a7c';
const IVORY = '#FFF7E7';
const RAIN = '#9FDCFF';

type P2 = [number, number];
type V3 = [number, number, number];

// ================================================================ playfield geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Runoff Run: the left channel carries water DOWN the mountain past a one-way weir ---
  // A one-way flap: it turns runoff toward the inlane but lets a kickback save pass upward.
  b.gate('runoff_deflect', [FRAME.left + 2, 646], [54, 694], -90);
  b.gate('runoff_weir', [28, 616], [70, 616], 90);
  b.shotSwitch('runoff_sw', 49, 560, 90);

  // --- Rain Mountain (one solid block). Its west face walls the Runoff Run; its foot holds
  //     two notches: the Soak-In Well (left) and the Cloud Ramp tunnel (right). ---
  b.wall([
    [257, 578], [256, 500], [214, 500], [213, 578], // ramp tunnel
    [190, 582], [166, 516], [138, 510], [110, 536], [134, 602], // soak-in notch (tilted toward the right flipper)
    [74, 640], [74, 384], [150, 296], [258, 430], [257, 578], // west face, peak, east face
  ], { id: 'mountain', r: 3 });

  // --- Cloud Ramp: climbs the mountain, sails across the sky, rains down the garden side ---
  b.ramp('cloud_ramp', {
    path: RAMP_PATH,
    width: 36,
    footprintTo: 0,
    peak: 120,
    // no mechanism label: the printed CLOUD RAMP under the tunnel names it in both 2D and 3D
  });

  // --- Soak-In Well: infiltration portal; groundwater re-emerges at the Spring ---
  const well = b.portal('soak_in', [140, 534], { x: SPRING[0], y: SPRING[1], deg: 90, speed: 420 }, { label: 'SOAK IN' });
  (well as Portal).transitTime = 1.2;

  // --- Aquifer Grotto (Wonder Pocket) ---
  b.wall([[302, 526], [302, 466], [354, 492], [354, 526]], { id: 'grotto', r: 3 });
  b.saucer('aquifer', POCKET[0], POCKET[1], { role: 'pocket', ejectDeg: 93, ejectSpeed: 760, captureMaxSpeed: 2400, label: 'AQUIFER GROTTO', icon: 'drop' });

  // --- Glacier: three ice blocks on Snow Peak, facing the left flipper ---
  b.dropBank('glacier', 345, 352, 16, 3, { size: 28, gap: 6, group: 'ice', labels: ['ICE', 'ICE', 'ICE'] });
  b.wall([[344, 340], [442, 368], [446, 404]], { id: 'glacier_back', r: 3 });

  // --- Garden Lane: a slanted lane through the transpiration spinner, rising into the sky ---
  b.wall([[390, 592], [440, 456], [446, 404]], { id: 'garden_left', r: 3 });
  b.post(446, 404, 5);
  b.wall([[438, 608], [488, 470], [498, 430], [498, 376]], { id: 'garden_right', r: 3 });
  b.post(498, 372, 5);
  b.spinner('leaf_spinner', [417, 528], [464, 545], { label: 'LEAF' });
  b.shotSwitch('garden_sw', 472, 430, -90);
  // Right channel (soft plunges fall back here) and its deflector.
  b.wall([[FRAME.laneSep, 646], [518, 694]], { id: 'garden_deflect', r: 3 });
  b.rollover('dew_drop', 523, 420, { group: 'dew', label: 'DEW' });

  // --- Storm-cloud pop bumpers ---
  b.bumper('cloud_a', 270, 195, { group: 'clouds', r: 24, icon: 'cloud' });
  b.bumper('cloud_b', 370, 180, { group: 'clouds', r: 24, icon: 'cloud' });
  b.bumper('cloud_c', 330, 268, { group: 'clouds', r: 24, icon: 'cloud' });

  // --- Inserts (one per shot) ---
  b.insert('ins_ramp', 235, 640, { deg: -92, color: AQUA });
  b.insert('ins_soak', 166, 640, { deg: -112, color: '#4FA8FF' });
  b.insert('ins_pocket', 328, 590, { deg: -90, color: GOLD });
  b.insert('ins_garden', 396, 650, { deg: -70, color: LEAF });
  b.insert('ins_glacier', 380, 420, { deg: -75, color: ICE });
  b.insert('ins_clouds', 260, 290, { shape: 'star', size: 12, color: IVORY });
  b.insert('ins_runoff', 49, 520, { deg: 90, color: AQUA });
}

const RAMP_PATH: P2[] = [[235, 570], [235, 510], [229, 430], [210, 350], [182, 272], [172, 206], [198, 148], [258, 112], [336, 100], [414, 110], [478, 146], [514, 210], [526, 300], [526, 420], [524, 520], [518, 630], [506, 716], [489, 800]];
const SPRING: P2 = [49, 470];
const POCKET: P2 = [328, 506];
const MOUNTAIN: P2[] = [[74, 640], [74, 384], [150, 296], [258, 430], [257, 578], [213, 578], [190, 582], [134, 602]];

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
  ctx.lineWidth = Math.max(2.5, size * 0.3);
  ctx.strokeStyle = `rgba(6,16,36,${0.8 * alpha})`;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Process arrow along a smooth path, with an arrowhead. Dashed = something you cannot see. */
function flowArrow(ctx: CanvasRenderingContext2D, pts: P2[], color: string, alpha: number, width = 3, dashed = false) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(6,16,36,0.45)';
  ctx.lineWidth = width + 3;
  if (dashed) ctx.setLineDash([2, 8]);
  smoothLine(ctx, pts);
  ctx.stroke();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  smoothLine(ctx, pts);
  ctx.stroke();
  ctx.setLineDash([]);
  const [x1, y1] = pts[pts.length - 2];
  const [x2, y2] = pts[pts.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = width * 3.4;
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(x2 + Math.cos(a) * h * 0.7, y2 + Math.sin(a) * h * 0.7);
  ctx.lineTo(x2 + Math.cos(a + 2.4) * h, y2 + Math.sin(a + 2.4) * h);
  ctx.lineTo(x2 + Math.cos(a - 2.4) * h, y2 + Math.sin(a - 2.4) * h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A cloud drawn as what it really is: a crowd of tiny droplets. */
function dropletCloud(ctx: CanvasRenderingContext2D, seed: number, cx: number, cy: number, rx: number, ry: number, lit: number) {
  const r = rng(seed);
  // soft body
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    glowDot(ctx, cx + Math.cos(a) * rx * 0.55, cy + Math.sin(a) * ry * 0.4, ry * (0.9 + r() * 0.4), mix('#5f7fa8', '#eaf4ff', 0.3 + 0.5 * lit), 0.18 + 0.22 * lit);
  }
  // droplets
  const n = 120;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    const s = 1.1 + r() * 1.8;
    ctx.fillStyle = rgba(mix('#9db5d6', '#ffffff', lit), 0.35 + 0.5 * lit * r());
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
  }
}

function sailboat2d(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hull: string, sail: string, flag: string, lit: number, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  // reflection
  ctx.fillStyle = rgba(sail, 0.08 + 0.1 * lit);
  ctx.beginPath();
  ctx.ellipse(0, s * 0.55, s * 0.95, s * 0.18, 0, 0, TAU);
  ctx.fill();
  // hull
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-s, 0);
  ctx.lineTo(s * 1.05, -s * 0.05);
  ctx.lineTo(s * 0.72, s * 0.36);
  ctx.lineTo(-s * 0.78, s * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(GOLD, 0.5 + 0.5 * lit);
  ctx.fillRect(-s * 0.85, s * 0.06, s * 1.75, s * 0.06);
  // mast and sails
  ctx.fillStyle = '#e9dcc0';
  ctx.fillRect(-s * 0.05, -s * 1.75, s * 0.08, s * 1.75);
  ctx.fillStyle = mix(sail, '#ffffff', 0.15 * lit);
  ctx.beginPath();
  ctx.moveTo(-s * 0.08, -s * 1.65);
  ctx.quadraticCurveTo(-s * 0.85, -s * 0.8, -s * 0.85, -s * 0.12);
  ctx.lineTo(-s * 0.08, -s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(IVORY, 0.85);
  ctx.beginPath();
  ctx.moveTo(s * 0.08, -s * 1.5);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.7, s * 0.95, -s * 0.12);
  ctx.lineTo(s * 0.08, -s * 0.12);
  ctx.closePath();
  ctx.fill();
  // pennant
  ctx.fillStyle = flag;
  ctx.beginPath();
  ctx.moveTo(s * 0.02, -s * 1.78);
  ctx.lineTo(s * 0.5, -s * 1.68);
  ctx.lineTo(s * 0.02, -s * 1.58);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (lit > 0.05) glowDot(ctx, x + flip * s * 0.9, y - s * 0.25, s * 0.5, GOLD, 0.8 * lit);
}

function paintPlayfield(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);

  // ---- Sky: night that warms toward a golden dawn as the harbor awakens
  // (kept mid-toned even at dawn so the glowing ball stays the brightest moving thing)
  ctx.fillStyle = vgrad(ctx, 0, 760, [
    [0, mix('#0a1430', '#15296a', s2)],
    [0.3, mix('#10264f', '#24438a', s2)],
    [0.55, mix('#15365c', '#4f4f92', s2 * 0.85)],
    [0.8, mix('#174565', '#a35f73', s2 * 0.75)],
    [1, mix('#1a4e6c', '#d98a5c', s2 * 0.7 + s4 * 0.2)],
  ]);
  ctx.fillRect(0, 0, 600, 760);
  stars(ctx, 18, Math.round(70 * (1 - 0.7 * s2)), [30, 20, 570, 300], IVORY);

  // ---- The sun: its energy lifts water (lights at mission 2)
  const sunLit = 0.25 + 0.75 * stage(level, 0.8, 2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.strokeStyle = rgba(GOLD, 0.12 + 0.35 * sunLit);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(300 + Math.cos(a) * 30, 50 + Math.sin(a) * 30);
    ctx.lineTo(300 + Math.cos(a) * 46, 50 + Math.sin(a) * 46);
    ctx.stroke();
  }
  glowDot(ctx, 300, 50, 70, GOLD, 0.15 + 0.45 * sunLit);
  ctx.fillStyle = mix('#7a6a3a', '#ffd76e', sunLit);
  ctx.beginPath();
  ctx.arc(300, 50, 22, 0, TAU);
  ctx.fill();

  // ---- Distant range
  ctx.fillStyle = mix('#14294a', '#5a6fa8', s2 * 0.6);
  ctx.beginPath();
  ctx.moveTo(24, 470);
  const far: P2[] = [[24, 360], [90, 300], [140, 330], [210, 270], [300, 340], [360, 300], [430, 330], [500, 290], [548, 330], [596, 300], [596, 470]];
  for (const [x, y] of far) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();

  // ---- Snow Peak (right) with its glacier tongue reaching down to the ice blocks
  const peak: P2[] = [[270, 470], [330, 380], [398, 286], [440, 320], [470, 300], [560, 410], [560, 470]];
  ctx.fillStyle = vgrad(ctx, 286, 470, [[0, mix('#3c4b72', '#7d8fc2', s2 * 0.6)], [1, mix('#26365a', '#4a5f8f', s2 * 0.5)]]);
  poly(ctx, peak);
  ctx.fill();
  ctx.fillStyle = mix('#a9bfd8', SNOW, 0.4 + 0.6 * s1);
  poly(ctx, [[360, 334], [398, 286], [440, 320], [470, 300], [500, 340], [470, 330], [440, 342], [418, 326], [395, 344], [378, 336]]);
  ctx.fill();
  // glacier tongue (flows down-left to the ICE bank)
  ctx.fillStyle = vgrad(ctx, 290, 380, [[0, mix('#9fc4dc', ICE, s1)], [1, mix('#6f9cc0', '#9fdcff', s1)]]);
  ctx.beginPath();
  ctx.moveTo(392, 292);
  ctx.quadraticCurveTo(420, 330, 446, 366);
  ctx.lineTo(344, 338);
  ctx.quadraticCurveTo(372, 320, 392, 292);
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(370 + i * 14, 322 + i * 4);
    ctx.lineTo(384 + i * 14, 340 + i * 4);
    ctx.stroke();
  }

  // ---- Garden hill (right) where plants lift water through their leaves
  ctx.fillStyle = vgrad(ctx, 380, 720, [[0, mix('#1f4a3c', '#3f8f5c', s2)], [1, mix('#173a33', '#2d6b49', s2)]]);
  ctx.beginPath();
  ctx.moveTo(360, 720);
  ctx.quadraticCurveTo(380, 470, 470, 430);
  ctx.quadraticCurveTo(530, 405, 560, 410);
  ctx.lineTo(560, 720);
  ctx.closePath();
  ctx.fill();
  const tr = rng(41);
  const trees: [number, number, number][] = [[372, 640, 46], [520, 520, 52], [530, 640, 44], [505, 450, 40], [380, 545, 38]];
  for (const [x, y, h] of trees) {
    branch(ctx, Math.round(x * 7 + y), x, y, h * 0.45, -Math.PI / 2 + (tr() - 0.5) * 0.2, 5, mix('#3a2a20', '#6b4a32', s2), mix('#3f7f5a', LEAF, 0.3 + 0.7 * s2));
  }
  // flowers
  for (let i = 0; i < 26; i++) {
    const x = 380 + tr() * 165;
    const y = 470 + tr() * 240;
    glowDot(ctx, x, y, 3.2, [CORAL, GOLD, IVORY][i % 3], 0.25 + 0.5 * s2);
  }

  // ---- Rain Mountain (left) with strata, snowcap and a tunnel for the Cloud Ramp
  ctx.fillStyle = vgrad(ctx, 296, 640, [[0, mix('#4a5a82', '#7c8fc0', s2 * 0.6)], [0.5, mix('#36456a', '#5b6c9c', s2 * 0.5)], [1, mix('#2a3554', '#45527c', s2 * 0.4)]]);
  poly(ctx, [[24, 700], [24, 380], [74, 384], [150, 296], [258, 430], [257, 578], [213, 578], [190, 582], [134, 602], [74, 640], [74, 700]]);
  ctx.fill();
  ctx.save();
  poly(ctx, MOUNTAIN);
  ctx.clip();
  ctx.strokeStyle = 'rgba(10,20,40,0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(60, 360 + i * 30);
    ctx.quadraticCurveTo(170, 340 + i * 30 + (i % 2 ? 14 : -10), 270, 370 + i * 30);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = mix('#a9bfd8', SNOW, 0.4 + 0.6 * s1);
  poly(ctx, [[112, 340], [150, 296], [200, 358], [184, 350], [170, 362], [152, 346], [136, 360], [124, 348]]);
  ctx.fill();
  // tunnel mouth (Cloud Ramp) and the Soak-In sinkhole
  ctx.fillStyle = vgrad(ctx, 500, 580, [[0, '#060c1c'], [1, '#14223f']]);
  poly(ctx, [[213, 578], [214, 500], [256, 500], [257, 578]]);
  ctx.fill();
  glowDot(ctx, 235, 540, 34, AQUA, 0.15 + 0.3 * s1);
  ctx.fillStyle = vgrad(ctx, 510, 600, [[0, '#08142a'], [1, '#1b3a6a']]);
  poly(ctx, [[190, 582], [166, 516], [138, 510], [110, 536], [134, 602]]);
  ctx.fill();
  glowDot(ctx, 146, 548, 34, '#4FA8FF', 0.2 + 0.35 * s3);

  // ---- Coastal lowland under the mountain: meadow grading to a sandy shore
  ctx.fillStyle = vgrad(ctx, 578, 712, [[0, mix('#1f3f3c', '#3f7f52', s2)], [0.62, mix('#24443e', '#5f9a5a', s2)], [0.8, mix('#4a4a44', '#c9b27c', s2)], [1, mix('#5a5446', '#e3cd96', s2)]]);
  poly(ctx, [[74, 640], [134, 602], [190, 582], [257, 578], [257, 712], [74, 712]]);
  ctx.fill();
  const tufts = rng(57);
  ctx.strokeStyle = rgba(mix('#3f6f4a', LEAF, s2), 0.5 + 0.3 * s2);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) {
    const x = 90 + tufts() * 160;
    const y = 612 + tufts() * 50;
    if (y < 600 + (x < 190 ? (190 - x) * 0.35 : 0)) continue;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x, y - 6);
    ctx.lineTo(x + 3, y);
    ctx.stroke();
  }

  // ---- Runoff Run: a mountain stream down the left channel, over the weir, to the sea
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(mix('#2b6a9a', AQUA, s1), 0.55 + 0.3 * s1);
  ctx.lineWidth = 26;
  smoothLine(ctx, [[49, 330], [48, 420], [50, 520], [48, 616], [56, 680], [80, 720]]);
  ctx.stroke();
  ctx.strokeStyle = rgba(FOAM, 0.18 + 0.4 * s1);
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    ctx.setLineDash([10, 18]);
    ctx.lineDashOffset = k * 9;
    smoothLine(ctx, [[42 + k * 7, 340], [41 + k * 7, 440], [43 + k * 7, 540], [42 + k * 7, 612]]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  glowDot(ctx, 49, 622, 26, FOAM, 0.2 + 0.4 * s1); // weir splash
  // the Spring where groundwater comes back out of the mountainside
  glowDot(ctx, SPRING[0], SPRING[1], 22, '#4FA8FF', 0.25 + 0.55 * s3);
  label(ctx, 'SPRING', 49, 446, 10, IVORY, 0.6 + 0.4 * s3);

  // ---- Underground cutaway between the mountains: soil, sand and gravel with pores
  const ground: P2[] = [[257, 450], [300, 456], [360, 452], [396, 445], [372, 720], [257, 720]];
  ctx.fillStyle = vgrad(ctx, 450, 720, [[0, '#5a3e2c'], [0.25, '#6f5034'], [0.5, '#7e6a4c'], [1, '#3d3b4a']]);
  poly(ctx, ground);
  ctx.fill();
  ctx.save();
  poly(ctx, ground);
  ctx.clip();
  // grass edge
  ctx.fillStyle = mix('#2f5f3a', '#4f9a55', s2);
  ctx.fillRect(250, 444, 160, 10);
  // pores; below the water table they are filled with groundwater (the aquifer)
  const pr = rng(77);
  const table = 528;
  for (let i = 0; i < 260; i++) {
    const x = 257 + pr() * 140;
    const y = 458 + pr() * 260;
    const s = 1.6 + pr() * 2.6;
    const wet = y > table;
    ctx.fillStyle = wet ? rgba(mix('#2a5a8a', '#6fd4ff', s3), 0.45 + 0.5 * s3) : 'rgba(20,12,8,0.45)';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(mix('#4f86b5', AQUA, s3), 0.5 + 0.5 * s3);
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  for (let x = 257; x <= 400; x += 6) ctx.lineTo(x, table + Math.sin(x / 14) * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  glowDot(ctx, POCKET[0], POCKET[1], 46, '#4FA8FF', 0.15 + 0.45 * s3);
  label(ctx, 'WATER', 378, table - 20, 9, IVORY, 0.55 + 0.45 * s3);
  label(ctx, 'TABLE', 378, table - 9, 9, IVORY, 0.55 + 0.45 * s3);

  // ---- Clouds around the storm bumpers: made of droplets, not vapor
  dropletCloud(ctx, 5, 318, 222, 120, 62, 0.25 + 0.75 * s1);
  dropletCloud(ctx, 9, 100, 200, 60, 26, 0.2 + 0.6 * s1);
  // the rain cloud the precipitation falls from (rain needs a cloud above it)
  dropletCloud(ctx, 23, 500, 200, 46, 24, 0.25 + 0.7 * s1);

  // ---- Rain falling from that cloud down the garden side (precipitation)
  ctx.save();
  ctx.strokeStyle = rgba(RAIN, 0.18 + 0.4 * s1);
  ctx.lineWidth = 1.6;
  const rr = rng(13);
  for (let i = 0; i < 70; i++) {
    const x = 470 + rr() * 76;
    const y = 222 + rr() * 498;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 12);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Harbor: the sea where every route can end (and begin again)
  ctx.fillStyle = vgrad(ctx, 700, 1150, [[0, mix('#1c5f86', '#2f8fb8', s2)], [0.35, mix('#123f66', '#1f6c98', s2)], [1, NAVY]]);
  ctx.beginPath();
  ctx.moveTo(0, 1150);
  ctx.lineTo(0, 712);
  for (let x = 0; x <= 600; x += 10) ctx.lineTo(x, 708 + Math.sin(x / 26) * 4);
  ctx.lineTo(600, 1150);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = rgba(FOAM, 0.12 + 0.2 * s2);
  ctx.lineWidth = 2;
  for (let row = 0; row < 12; row++) {
    const y = 735 + row * 34;
    ctx.beginPath();
    for (let x = 0; x <= 600; x += 8) ctx.lineTo(x, y + Math.sin(x / 18 + row * 1.7) * 3);
    ctx.stroke();
  }
  ctx.restore();
  // a glittering path of sun-glints on the water once the Wonderlight is earned
  if (s4 > 0) {
    const gr = rng(71);
    for (let i = 0; i < 70; i++) {
      const v = gr();
      const y = 724 + v * 400;
      const half = 18 + v * 90;
      const x = 286 + (gr() * 2 - 1) * half;
      ctx.fillStyle = rgba(GOLD, (0.25 + 0.35 * gr()) * s4);
      ctx.fillRect(x - 6 - v * 8, y, 12 + v * 16, 2);
    }
  }

  // ---- Regatta boats (they light their lanterns as the attraction awakens)
  // (kept inboard so SUN LIFTS clears the Cloud Ramp's return rail)
  sailboat2d(ctx, 208, 770, 22, '#7a2f3a', '#f2e6cc', CORAL, s4, 1);
  sailboat2d(ctx, 364, 770, 22, '#1d3c6b', '#ffe3a0', AQUA, s4, -1);
  sailboat2d(ctx, 290, 1092, 16, '#5a3a24', '#e9f3ff', GOLD, s4 * 0.8, 1);

  // ---- Title banner over the harbor mouth
  ctx.fillStyle = 'rgba(6,16,36,0.55)';
  rrect(ctx, 112, 684, 348, 32, 10);
  ctx.fill();
  neonText(ctx, 'RAINDROP ROYAL REGATTA', 286, 700, 21, GOLD, 0.25 + 0.75 * stage(level, 0.5, 1.5));

  // ---- The cycle, labelled: sun lifts (gold, up), gravity drops (blue, down)
  const up = 0.25 + 0.75 * s2;
  const down = 0.25 + 0.75 * s2;
  // evaporation from the sea and transpiration from the garden: water vapor is invisible, so dashed
  flowArrow(ctx, [[150, 690], [130, 640], [110, 470], [90, 260]], GOLD, 0.35 * up, 2.4, true);
  flowArrow(ctx, [[560, 700], [565, 600], [568, 420]], GOLD, 0.35 * up, 2.4, true);
  label(ctx, 'EVAPORATION', 104, 430, 13, GOLD, 0.6 + 0.4 * up, -Math.PI / 2 + 0.12);
  label(ctx, 'TRANSPIRATION', 452, 466, 12, LEAF, 0.6 + 0.4 * up, -1.3);
  label(ctx, 'VAPOR IS', 156, 388, 10, IVORY, 0.6 + 0.4 * s1);
  label(ctx, 'INVISIBLE', 156, 401, 10, IVORY, 0.6 + 0.4 * s1);
  label(ctx, 'CONDENSATION', 290, 318, 13, FOAM, 0.6 + 0.4 * s1);
  label(ctx, 'CLOUD = DROPLETS', 100, 238, 10, FOAM, 0.55 + 0.45 * s1);
  flowArrow(ctx, [[540, 250], [540, 330], [540, 400]], RAIN, 0.45 * down, 2.4);
  label(ctx, 'PRECIPITATION', 474, 280, 12, RAIN, 0.6 + 0.4 * down, Math.PI / 2 - 0.08);
  label(ctx, 'MELTING', 396, 298, 12, ICE, 0.6 + 0.4 * up);
  label(ctx, 'RUNOFF', 49, 384, 13, AQUA, 0.65 + 0.35 * down, Math.PI / 2);
  label(ctx, 'INFILTRATION', 170, 450, 11, '#9fd0ff', 0.6 + 0.4 * s3, -0.5);
  label(ctx, 'GROUNDWATER', 326, 630, 11, '#9fd0ff', 0.6 + 0.4 * s3);
  label(ctx, 'SUN LIFTS', 428, 762, 14, GOLD, 0.45 + 0.55 * s2);
  label(ctx, 'GRAVITY DROPS', 92, 762, 14, RAIN, 0.45 + 0.55 * s2);
  // Shot names the missions use (the 3D view draws no ramp, portal or lane labels)
  label(ctx, 'CLOUD RAMP', 236, 604, 10, AQUA, 0.75 + 0.25 * s1);
  label(ctx, 'SOAK IN', 178, 476, 10, '#9fd0ff', 0.75 + 0.25 * s1, -0.5);
  label(ctx, 'GARDEN LANE', 446, 628, 10, LEAF, 0.75 + 0.25 * s1);

  // ---- Wonderlight: fireworks bloom over the regatta
  if (s4 > 0) {
    const fr = rng(99);
    for (let k = 0; k < 4; k++) {
      const cx = 110 + k * 125;
      const cy = 300 + (k % 2) * 60;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        glowDot(ctx, cx + Math.cos(a) * 34, cy + Math.sin(a) * 34, 7, [GOLD, CORAL, AQUA, LEAF][(k + i) % 4], 0.45 * s4 * (0.6 + 0.4 * fr()));
      }
    }
  }
}

function paintAmbient({ ctx, t, level, reduced, energy }: SceneryContext) {
  const s1 = stage(level, 0.2, 1);
  const s4 = stage(level, 3.3, 4);
  const tt = reduced ? 0 : t;
  // Pennant lights strung across the harbor mouth
  stringLights(ctx, 70, 726, 300, 732, 12, 10, [GOLD, CORAL, AQUA], (0.25 + 0.75 * stage(level, 0.5, 2)) * (0.7 + 0.3 * energy), tt);
  stringLights(ctx, 300, 732, 520, 726, 12, 10, [AQUA, GOLD, CORAL], (0.25 + 0.75 * stage(level, 0.5, 2)) * (0.7 + 0.3 * energy), tt);
  if (reduced) return;
  // Shimmer on the sea
  for (let i = 0; i < 8; i++) {
    const x = ((t * 18 + i * 83) % 640) - 20;
    const y = 760 + ((i * 53) % 300);
    ctx.fillStyle = rgba(FOAM, 0.08 + 0.1 * s1);
    ctx.fillRect(x, y, 26, 2);
  }
  // Raindrops sliding down the garden side
  if (s1 > 0) {
    ctx.strokeStyle = rgba(RAIN, 0.35 * s1);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const x = 476 + ((i * 37) % 70);
      const y = 226 + ((t * 260 + i * 97) % 480);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y + 10);
      ctx.stroke();
    }
  }
  // Wonderlight: lantern glow drifting over the water
  if (s4 > 0) {
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.12 + i / 6) % 1;
      glowDot(ctx, 120 + i * 70, 1060 - ph * 300, 8, GOLD, 0.5 * s4 * Math.sin(ph * Math.PI));
    }
  }
}

function paintCelebrate({ ctx, t }: SceneryContext, p: number) {
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.45;
  const g = ctx.createRadialGradient(POCKET[0], POCKET[1], 10, POCKET[0], POCKET[1], 460);
  g.addColorStop(0, rgba(GOLD, 0.8));
  g.addColorStop(0.5, rgba(AQUA, 0.3));
  g.addColorStop(1, rgba(AQUA, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.restore();
  // ripples spreading from the Aquifer Grotto
  for (let k = 0; k < 4; k++) {
    const r = ((p * 1.6 + k * 0.25) % 1) * 380;
    ctx.strokeStyle = rgba(FOAM, 0.5 * (1 - r / 380));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(POCKET[0], POCKET[1], r, r * 0.75, 0, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + t * 0.5;
    const d = 50 + p * 280;
    glowDot(ctx, POCKET[0] + Math.cos(a) * d, POCKET[1] + Math.sin(a) * d * 0.8, 9, [GOLD, AQUA, IVORY][i % 3], 1 - p);
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

/** Seam-safe relief for the low-poly peaks (periodic in angle a, u = height fraction). */
function peakK(a: number, u: number, seed: number) {
  return 1 + 0.12 * Math.sin(a * 3 + seed) * Math.cos(u * 7 + seed * 0.7) + 0.06 * Math.sin(a * 7 + seed * 1.3);
}

interface PeakSpec {
  at: V3;
  r: number;
  h: number;
  seed: number;
}

/** A point on a peak's surface (matches the vertex relief), nudged outward by `out`. */
function peakPoint(p: PeakSpec, a: number, u: number, out: number): THREE.Vector3 {
  const rad = p.r * (1 - u) * peakK(a, u, p.seed) + out;
  const y = p.at[1] + u * p.h + 0.04 * p.h * Math.sin(a * 5 + p.seed) * (1 - u);
  return new THREE.Vector3(p.at[0] + Math.cos(a) * rad, y, p.at[2] + Math.sin(a) * rad);
}

/** Low-poly mountain with rock-to-snow facets baked into vertex colours: one mesh. */
function snowPeak(kit: SetKit, p: PeakSpec, rock: string, snow: string, snowline: number, segs = 18): THREE.Mesh {
  const base = new THREE.ConeGeometry(p.r, p.h, segs, 8);
  const pa = base.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i);
    const y = pa.getY(i);
    const z = pa.getZ(i);
    const u = (y + p.h / 2) / p.h;
    if (u > 0.98) continue;
    const a = Math.atan2(z, x);
    const k = peakK(a, u, p.seed);
    pa.setXYZ(i, x * k, y + 0.04 * p.h * Math.sin(a * 5 + p.seed) * (1 - u), z * k);
  }
  const geo = base.toNonIndexed();
  base.dispose();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const cRock = new THREE.Color(rock);
  const cDeep = new THREE.Color(rock).multiplyScalar(0.55);
  const cSnow = new THREE.Color(snow);
  const c = new THREE.Color();
  const r = rng(p.seed * 31 + 7);
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const a = Math.atan2(cz, cx);
    const u = (cy + p.h / 2) / p.h;
    const line = snowline + 0.07 * Math.sin(a * 5 + p.seed * 2) + 0.04 * Math.sin(a * 11 + p.seed);
    if (u > line) c.copy(cSnow);
    else c.copy(cDeep).lerp(cRock, Math.min(1, Math.pow(u / line, 0.7)));
    c.multiplyScalar(0.9 + 0.2 * r());
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = kit.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: true }));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p.at[0], p.at[1] + p.h / 2, p.at[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  return kit.add(m);
}

/** Sprite for one droplet: a bright bead with a soft rim (clouds and spray are liquid water). */
function dropSprite(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(26, 26, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(236,246,255,0.95)');
    g.addColorStop(0.8, 'rgba(190,220,250,0.55)');
    g.addColorStop(1, 'rgba(190,220,250,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 31, 0, TAU);
    ctx.fill();
  });
}

/** A crowd of droplets shaped like a cumulus: clouds are liquid water (or ice), not vapor.
 *  Droplets are shaded grey underneath and bright on top; `setLit` brightens the whole cloud. */
function dropletCloud3D(kit: SetKit, at: V3, puffs: [number, number, number, number][], count: number, size: number, seed: number): THREE.Points & { setLit(v: number): void } {
  const n = kit.n(count);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const r = rng(seed);
  const total = puffs.reduce((s, q) => s + q[3] ** 3, 0);
  const top = new THREE.Color('#ffffff');
  const under = new THREE.Color('#8fa3be');
  const c = new THREE.Color();
  const span = Math.max(...puffs.map((q) => q[1] + q[3])) + 0.45 * Math.max(...puffs.map((q) => q[3]));
  for (let i = 0; i < n; i++) {
    let pick = r() * total;
    let q = puffs[0];
    for (const cand of puffs) {
      pick -= cand[3] ** 3;
      if (pick <= 0) {
        q = cand;
        break;
      }
    }
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = r() * 2 - 1;
      y = r() * 2 - 1;
      z = r() * 2 - 1;
    } while (x * x + y * y + z * z > 1 || y < -0.45);
    const py = q[1] + y * q[3] * 0.8;
    pos[i * 3] = at[0] + q[0] + x * q[3];
    pos[i * 3 + 1] = at[1] + py;
    pos[i * 3 + 2] = at[2] + q[2] + z * q[3] * 0.7;
    c.copy(under).lerp(top, Math.min(1, Math.max(0, (py + 0.3) / (span + 0.3))) * (0.75 + 0.25 * r()));
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = kit.track(new THREE.PointsMaterial({ size, vertexColors: true, map: dropSprite(kit), alphaTest: 0.02, transparent: true, depthWrite: false, opacity: 0.6 }));
  // a soft body behind the droplets: from far away, countless tiny droplets blur into white
  const bodyPos = new Float32Array(puffs.length * 3 * 3);
  puffs.forEach((q, i) => {
    for (let k = 0; k < 3; k++) {
      const o = (i * 3 + k) * 3;
      bodyPos[o] = at[0] + q[0] + (k - 1) * q[3] * 0.35;
      bodyPos[o + 1] = at[1] + q[1] + (k === 1 ? 0.12 : -0.05) * q[3];
      bodyPos[o + 2] = at[2] + q[2] - 0.05;
    }
  });
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyPos, 3));
  const bodySize = 2.2 * Math.max(...puffs.map((q) => q[3]));
  const bodyMat = kit.track(new THREE.PointsMaterial({ color: '#dfe9f6', size: bodySize, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, opacity: 0.2 }));
  const body = new THREE.Points(bodyGeo, bodyMat);
  body.renderOrder = -1;
  kit.add(body);
  const dim = new THREE.Color('#7f8ea6');
  const bright = new THREE.Color('#ffffff');
  const pts = new THREE.Points(geo, mat) as unknown as THREE.Points & { setLit(v: number): void };
  pts.setLit = (v) => {
    mat.opacity = 0.6 + 0.4 * v;
    mat.color.copy(dim).lerp(bright, v);
    bodyMat.opacity = 0.16 + 0.22 * v;
  };
  return kit.add(pts);
}

/** Flowing-water texture (streaks), scrolled along a tube's length. */
function flowTexture(kit: SetKit, seed: number): THREE.CanvasTexture {
  const tex = canvasTex(kit, 256, 64, (ctx) => {
    ctx.fillStyle = '#5fb7e8';
    ctx.fillRect(0, 0, 256, 64);
    const r = rng(seed);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(235,250,255,${0.25 + r() * 0.6})`;
      ctx.fillRect(r() * 256, r() * 64, 14 + r() * 40, 1.5 + r() * 3);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function waterTube(kit: SetKit, pts: THREE.Vector3[], radius: number, tex: THREE.CanvasTexture): { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial } {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, Math.max(32, pts.length * 10), radius, 8, false);
  const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#cfefff', map: tex, emissive: '#7fd8ff', emissiveMap: tex, emissiveIntensity: 0.2, roughness: 0.15, transparent: true, opacity: 0.92 }));
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh: kit.add(mesh), mat };
}

/** Compact stylised tree: trunk + one merged foliage mesh (2 meshes). */
function smallTree(kit: SetKit, parent: THREE.Object3D, pos: V3, h: number, leaf: string, seed: number) {
  const r = rng(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.05, h * 0.08, h * 0.6, 8), kit.mats.plastic('#5b3a24'));
  trunk.position.set(pos[0], pos[1] + h * 0.3, pos[2]);
  trunk.castShadow = true;
  const blobs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.IcosahedronGeometry(h * (0.18 + r() * 0.12), 1);
    g.translate((r() - 0.5) * h * 0.45, h * (0.6 + r() * 0.35), (r() - 0.5) * h * 0.45);
    blobs.push(g);
  }
  const merged = mergeGeometries(blobs);
  blobs.forEach((g) => g.dispose());
  const crown = new THREE.Mesh(merged, kit.mats.plastic(leaf));
  crown.position.set(pos[0], pos[1], pos[2]);
  crown.castShadow = true;
  parent.add(trunk, crown);
}

interface Boat {
  g: THREE.Group;
  lamp: THREE.MeshStandardMaterial;
  sail: THREE.MeshStandardMaterial;
}

function makeBoat(kit: SetKit, hullColor: string, sailColor: string, flagColor: string): Boat {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.46, 0.1);
  shape.lineTo(0.52, 0.12);
  shape.quadraticCurveTo(0.42, -0.06, 0.3, -0.1);
  shape.lineTo(-0.36, -0.1);
  shape.quadraticCurveTo(-0.46, -0.02, -0.46, 0.1);
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  hullGeo.translate(0, 0, -0.14);
  const hull = new THREE.Mesh(hullGeo, kit.mats.paintedMetal(hullColor));
  hull.castShadow = true;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1.05, 8), kit.mats.plastic('#e9dcc0'));
  mast.position.set(0.02, 0.62, 0);
  const sail = kit.track(new THREE.MeshStandardMaterial({ color: sailColor, emissive: sailColor, emissiveIntensity: 0.04, roughness: 0.7, side: THREE.DoubleSide }));
  const main = new THREE.Shape();
  main.moveTo(0, 0);
  main.lineTo(0, 0.9);
  main.quadraticCurveTo(-0.32, 0.42, -0.5, 0.02);
  main.lineTo(0, 0);
  const mainSail = new THREE.Mesh(new THREE.ShapeGeometry(main, 6), sail);
  mainSail.position.set(0, 0.17, 0.005);
  const jibShape = new THREE.Shape();
  jibShape.moveTo(0, 0);
  jibShape.lineTo(0, 0.78);
  jibShape.quadraticCurveTo(0.26, 0.32, 0.46, 0.0);
  jibShape.lineTo(0, 0);
  const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape, 6), kit.track(new THREE.MeshStandardMaterial({ color: IVORY, roughness: 0.7, side: THREE.DoubleSide })));
  jib.position.set(0.05, 0.17, -0.005);
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.2, -0.04);
  flagShape.lineTo(0, -0.09);
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), kit.track(new THREE.MeshStandardMaterial({ color: flagColor, emissive: flagColor, emissiveIntensity: 0.25, side: THREE.DoubleSide })));
  flag.position.set(0.03, 1.15, 0);
  const lamp = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1c10', emissive: GOLD, emissiveIntensity: 0.1 }));
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), lamp);
  lantern.position.set(-0.38, 0.22, 0);
  g.add(hull, mast, mainSail, jib, flag, lantern);
  return { g, lamp, sail };
}

function makeLighthouse(kit: SetKit, pos: V3, scale: number) {
  const g = new THREE.Group();
  const red = kit.mats.paintedMetal('#c8424a');
  const white = kit.mats.paintedMetal('#f2efe6');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.35, 20), kit.mats.paintedMetal('#5f6577'));
  base.position.y = 0.17;
  g.add(base);
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const r0 = 0.42 - i * 0.05;
    const r1 = 0.42 - (i + 1) * 0.05;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 0.6, 20), i % 2 ? white : red);
    seg.position.y = 0.35 + 0.3 + i * 0.6;
    seg.castShadow = true;
    g.add(seg);
  }
  const top = 0.35 + bands * 0.6;
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20), kit.mats.paintedMetal('#2c3346'));
  gallery.position.y = top + 0.03;
  const lampMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a2210', emissive: GOLD, emissiveIntensity: 0.1 }));
  const room = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 16), lampMat);
  room.position.y = top + 0.22;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.3, 16), red);
  roof.position.y = top + 0.53;
  const beamMat = kit.track(new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beamGeo = new THREE.ConeGeometry(0.32, 2.6, 20, 1, true);
  beamGeo.translate(0, -1.3, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  const rotor = new THREE.Group();
  rotor.position.y = top + 0.22;
  rotor.add(beam);
  g.add(gallery, room, roof, rotor);
  g.position.set(pos[0], pos[1], pos[2]);
  g.scale.setScalar(scale);
  kit.add(g);
  return { lampMat, beamMat, rotor, topY: pos[1] + (top + 0.22) * scale };
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
  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 1.3, 0.08), kit.mats.plastic('#0c1a35'));
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.05, 0.1), kit.mats.brass());
  trim.position.y = -h * 0.68;
  const trim2 = trim.clone();
  trim2.position.y = h * 0.68;
  g.add(back, glyph, trim, trim2);
  g.position.set(pos[0], pos[1], pos[2]);
  kit.add(g);
  return { g, setLit: (v: number) => (mat.emissiveIntensity = 0.08 + v * 3) };
}

/** Earth cross-section for the aquifer block: soil, sand, gravel with water in its pores, bedrock.
 *  `water` paints only the glowing groundwater (used as the emissive map). */
function paintStrata(ctx: CanvasRenderingContext2D, w: number, h: number, water: boolean, wellU: number, labels = false) {
  const bands: [string, number][] = [['#4f8f3f', 0.07], ['#5e4030', 0.2], ['#b8945e', 0.2], ['#7a7f8f', 0.32], ['#383c4e', 0.21]];
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  let y = 0;
  const r = rng(23);
  const tops: number[] = [];
  bands.forEach(([c, f], i) => {
    const bh = f * h;
    tops.push(y);
    if (!water) {
      ctx.fillStyle = c;
      ctx.fillRect(0, y, w, bh + 1);
      // grain
      for (let k = 0; k < 140; k++) {
        ctx.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.16)';
        ctx.fillRect(r() * w, y + r() * bh, (2 + r() * 3) * (w / 512), (1.5 + r() * 2) * (w / 512));
      }
    }
    if (i === 3) {
      // the aquifer: gravel and sand with groundwater filling the spaces between grains
      ctx.fillStyle = water ? '#3fb6ff' : '#1d4f86';
      ctx.fillRect(0, y, w, bh);
      const rr = rng(99);
      for (let k = 0; k < 520; k++) {
        const gx = rr() * w;
        const gy2 = y + rr() * bh;
        const s = (3 + rr() * 6) * (w / 512);
        ctx.fillStyle = water ? '#000000' : ['#8d8f9c', '#a39a86', '#6f7384'][k % 3];
        ctx.beginPath();
        ctx.ellipse(gx, gy2, s, s * 0.75, rr() * 3, 0, TAU);
        ctx.fill();
      }
      // water table: the top of the saturated zone
      ctx.strokeStyle = water ? '#bff0ff' : '#9fdcff';
      ctx.lineWidth = 3 * (w / 512);
      ctx.setLineDash([10 * (w / 512), 7 * (w / 512)]);
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      ctx.lineTo(w, y + 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    y += bh;
  });
  // layer names (the aquifer's name glows with its water)
  if (labels) {
    const names: [string, number, number][] = [['SOIL', 1, 0.1], ['SAND', 2, 0.1], ['AQUIFER', 3, 0.15], ['BEDROCK', 4, 0.1]];
    for (const [text, i, size] of names) {
      if (water && i !== 3) continue;
      const cy = tops[i] + (bands[i][1] * h) / 2;
      ctx.font = `800 ${Math.round(size * h)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (!water) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * h * 0.28;
        ctx.strokeStyle = 'rgba(8,14,30,0.85)';
        ctx.strokeText(text, w * 0.68, cy);
        ctx.fillStyle = i === 3 ? '#bff0ff' : '#fff7e7';
      } else {
        ctx.fillStyle = '#e8fbff';
      }
      ctx.fillText(text, w * 0.68, cy);
    }
  }
  // the well shaft drilled down into the aquifer
  if (wellU >= 0) {
    const x = wellU * w;
    const bottom = tops[3] + 0.6 * bands[3][1] * h;
    if (!water) {
      ctx.fillStyle = '#1b1f2c';
      ctx.fillRect(x - 9, 0, 18, bottom);
      ctx.fillStyle = '#c7ccd8';
      ctx.fillRect(x - 4, 0, 8, bottom);
    }
    ctx.fillStyle = water ? '#7fdcff' : '#3fa4e8';
    ctx.fillRect(x - 4, tops[3], 8, bottom - tops[3]);
  }
}

/** Head-of-table painted panorama: the whole cycle as one theatrical flat. */
function paintPanorama(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, mix('#0b1636', '#24408a', s2)], [0.55, mix('#183a66', '#c9848a', s2 * 0.8)], [0.75, mix('#1d4a6c', '#f2b47e', s2 * 0.7)], [1, '#0d2c4a']]);
  ctx.fillRect(0, 0, w, h);
  stars(ctx, 3, Math.round(90 * (1 - s2)), [0, 0, w, h * 0.5], IVORY);
  const sx = w * 0.72;
  const sy = h * (0.62 - 0.32 * stage(level, 0.6, 2.2));
  glowDot(ctx, sx, sy, 150, GOLD, 0.25 + 0.5 * s2);
  ctx.fillStyle = mix('#8a6f3a', '#ffd76e', 0.3 + 0.7 * s2);
  ctx.beginPath();
  ctx.arc(sx, sy, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix('#22345a', '#5b6fa6', s2 * 0.6);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.78);
  const ridge: P2[] = [[0, 0.55], [0.08, 0.36], [0.16, 0.5], [0.26, 0.3], [0.36, 0.52], [0.46, 0.44], [0.56, 0.62], [0.66, 0.5], [0.78, 0.64], [0.9, 0.42], [1, 0.58]];
  for (const [x, y] of ridge) ctx.lineTo(x * w, y * h);
  ctx.lineTo(w, h * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mix('#b8c8de', SNOW, s1);
  for (const [x, y] of [[0.08, 0.36], [0.26, 0.3], [0.9, 0.42]] as P2[]) {
    ctx.beginPath();
    ctx.moveTo(x * w, y * h);
    ctx.lineTo(x * w - 34, y * h + 30);
    ctx.lineTo(x * w + 34, y * h + 30);
    ctx.closePath();
    ctx.fill();
  }
  for (const [x, y, rx] of [[0.2, 0.22, 110], [0.45, 0.16, 90], [0.88, 0.24, 100]] as [number, number, number][]) {
    const r = rng(Math.round(x * 100));
    for (let i = 0; i < 160; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r());
      ctx.fillStyle = rgba('#ffffff', 0.35 + 0.5 * s1 * r());
      ctx.beginPath();
      ctx.arc(x * w + Math.cos(a) * rx * d, y * h + Math.sin(a) * rx * 0.38 * d, 1.5 + r() * 2, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(RAIN, 0.2 + 0.5 * s1);
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const xx = x * w - rx * 0.6 + r() * rx * 1.2;
      const yy = y * h + 30 + r() * 80;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx - 4, yy + 16);
      ctx.stroke();
    }
  }
  ctx.fillStyle = vgrad(ctx, h * 0.76, h, [[0, mix('#1c5f86', '#2f8fb8', s2)], [1, '#0a2140']]);
  ctx.fillRect(0, h * 0.76, w, h * 0.24);
  for (let i = 0; i < 7; i++) {
    sailboat2d(ctx, w * (0.1 + i * 0.13), h * 0.84, 22, ['#7a2f3a', '#1d3c6b', '#5a3a24'][i % 3], ['#f2e6cc', '#ffe3a0', '#e9f3ff'][i % 3], [CORAL, AQUA, GOLD][i % 3], s4, i % 2 ? -1 : 1);
  }
  flowArrow(ctx, [[w * 0.62, h * 0.74], [w * 0.6, h * 0.5], [w * 0.52, h * 0.24]], GOLD, 0.25 + 0.6 * s2, 6, true);
  flowArrow(ctx, [[w * 0.3, h * 0.3], [w * 0.28, h * 0.52], [w * 0.22, h * 0.72]], RAIN, 0.25 + 0.6 * s2, 6);
  flowArrow(ctx, [[w * 0.36, h * 0.66], [w * 0.4, h * 0.74], [w * 0.47, h * 0.78]], '#6fbfff', 0.2 + 0.6 * s3, 5);
  label(ctx, 'SUN LIFTS', w * 0.66, h * 0.4, 30, GOLD, 0.3 + 0.7 * s2);
  label(ctx, 'GRAVITY DROPS', w * 0.2, h * 0.5, 30, RAIN, 0.3 + 0.7 * s2);
  if (s4 > 0) {
    for (let k = 0; k < 5; k++) {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        glowDot(ctx, w * (0.12 + k * 0.19) + Math.cos(a) * 50, h * 0.14 + Math.sin(a) * 50, 10, [GOLD, CORAL, AQUA, LEAF][(i + k) % 4], 0.5 * s4);
      }
    }
  }
}

/** Rainbow band texture for a half-ring (planar UVs): violet inside, red outside. */
function rainbowTexture(kit: SetKit, inner: number, outer: number): THREE.CanvasTexture {
  return canvasTex(kit, 512, 512, (ctx) => {
    const k = 256 / outer;
    const bands = ['#8b5cff', '#4f7dff', '#3fd0ff', '#5fe08a', '#ffe45c', '#ffa43f', '#ff5a5a'];
    const r0 = inner * k;
    const r1 = outer * k;
    const step = (r1 - r0) / bands.length;
    ctx.lineWidth = step + 1;
    bands.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(256, 256, r0 + step * (i + 0.5), 0, TAU);
      ctx.stroke();
    });
    // soften both edges
    const g = ctx.createRadialGradient(256, 256, r0, 256, 256, r1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.18, 'rgba(0,0,0,0)');
    g.addColorStop(0.82, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
}

const harborSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  kit.sky('#2a4d8f', '#040915');

  // ---- Harbor water around a timber pier that carries the cabinet
  const sea = kit.water([0, gy - 0.03, -2], 34, 30, '#15567d');
  const seaMat = sea.material as THREE.MeshPhysicalMaterial;
  seaMat.emissive = new THREE.Color('#0e3b5e');
  seaMat.emissiveIntensity = 0.25;
  const seaDark = new THREE.Color('#0e3b5e');
  const seaBright = new THREE.Color('#2a86b8');
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.16, 15.4), kit.mats.wood());
  deck.position.set(0, gy - 0.06, -0.7);
  deck.receiveShadow = true;
  kit.add(deck);
  const pileSpots: [number, number][] = [];
  for (const x of [-4.3, 4.3]) for (const z of [-7.6, -3.6, 0.4, 4.4, 6.9]) pileSpots.push([x, z]);
  const piles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.9, 10), kit.mats.plastic('#4a3324'), pileSpots.length);
  const mtx = new THREE.Matrix4();
  pileSpots.forEach(([x, z], i) => piles.setMatrixAt(i, mtx.makeTranslation(x, gy - 0.1, z)));
  kit.add(piles);

  // ---- Back left: Rain Mountain and its shoulder peak, with snowfields and droplet clouds
  const rainPeak: PeakSpec = { at: [-6.7, gy - 0.05, -3.7], r: 2.1, h: 3.0, seed: 2 };
  const shoulder: PeakSpec = { at: [-4.9, gy - 0.05, -5.7], r: 1.3, h: 1.85, seed: 5 };
  snowPeak(kit, rainPeak, '#55648a', '#f1f7ff', 0.66);
  snowPeak(kit, shoulder, '#4b5a7e', '#eaf3ff', 0.7, 14);
  const cloudL = dropletCloud3D(kit, [-5.3, 1.95, -2.55], [[0, 0, 0, 0.5], [0.5, -0.1, 0.05, 0.38], [-0.52, -0.12, -0.05, 0.38], [0.14, 0.28, -0.08, 0.36]], 560, 0.17, 11);
  const cloudR = dropletCloud3D(kit, [-7.2, 2.05, -1.95], [[0, 0, 0, 0.42], [0.42, -0.07, 0, 0.32], [-0.4, -0.09, 0, 0.3]], 340, 0.17, 17);
  const rain = kit.motes({ x0: -5.8, x1: -4.75, y0: 0.0, y1: 1.6, z0: -2.75, z1: -2.35 }, 46, RAIN, { speed: 2.4, size: 0.15, rise: false });
  const rain2 = kit.motes({ x0: -7.6, x1: -6.9, y0: 0.2, y1: 1.7, z0: -2.1, z1: -1.8 }, 26, RAIN, { speed: 2.4, size: 0.15, rise: false });
  // Runoff: a meltwater stream winding down the mountain into the harbor
  const streamPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = 0.6 - i * 0.06;
    streamPts.push(peakPoint(rainPeak, 0.72 + 0.22 * Math.sin(u * 9), u, 0.03));
  }
  const foot = streamPts[streamPts.length - 1];
  streamPts.push(new THREE.Vector3(foot.x + 0.25, gy - 0.02, foot.z + 0.3));
  const streamTex = flowTexture(kit, 8);
  streamTex.repeat.set(5, 1);
  const stream = waterTube(kit, streamPts, 0.075, streamTex);
  const splash = kit.motes({ x0: foot.x - 0.15, x1: foot.x + 0.45, y0: gy, y1: gy + 0.35, z0: foot.z, z1: foot.z + 0.5 }, 24, FOAM, { speed: 0.5, size: 0.07 });
  const mtnSign = kit.neonSign('RAIN MOUNTAIN', [-5.3, gy + 0.95, -1.75], { height: 0.26, color: RAIN, rotY: 0.42 });
  mtnSign.rotation.x = -0.55;

  // ---- Front left: the Aquifer cutaway hill (water fills the pores of buried gravel)
  const aq = new THREE.Group();
  const AW = 2.4;
  const AH = 1.45;
  const AD = 0.8;
  const wellX = -0.42;
  const wellU = (wellX + AW / 2) / AW;
  const frontMap = canvasTex(kit, 1024, 512, (ctx) => paintStrata(ctx, 1024, 512, false, wellU, true));
  const frontGlow = canvasTex(kit, 1024, 512, (ctx) => paintStrata(ctx, 1024, 512, true, wellU, true));
  const sideMap = canvasTex(kit, 256, 256, (ctx) => paintStrata(ctx, 256, 256, false, -1));
  const sideGlow = canvasTex(kit, 256, 256, (ctx) => paintStrata(ctx, 256, 256, true, -1));
  const frontMat = kit.track(new THREE.MeshStandardMaterial({ map: frontMap, emissive: '#7fdcff', emissiveMap: frontGlow, emissiveIntensity: 0.08, roughness: 0.85 }));
  const sideMat = kit.track(new THREE.MeshStandardMaterial({ map: sideMap, emissive: '#7fdcff', emissiveMap: sideGlow, emissiveIntensity: 0.08, roughness: 0.85 }));
  const grassMat = kit.track(new THREE.MeshStandardMaterial({ color: '#4f9a4a', roughness: 0.8 }));
  const darkMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a2a36', roughness: 0.9 }));
  const block = new THREE.Mesh(new THREE.BoxGeometry(AW, AH, AD), [sideMat, darkMat, grassMat, darkMat, frontMat, darkMat]);
  block.position.y = AH / 2;
  block.castShadow = true;
  block.receiveShadow = true;
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 2), grassMat);
  mound.scale.set(AW / 2 - 0.02, 0.24, AD / 2 - 0.02);
  mound.position.y = AH;
  mound.receiveShadow = true;
  aq.add(block, mound);
  smallTree(kit, aq, [0.5, AH + 0.12, -0.08], 0.72, '#5fbf72', 4);
  smallTree(kit, aq, [0.88, AH + 0.04, 0.12], 0.52, LEAF, 7);
  // the well house: stone ring, two posts, a little roof, and water glinting inside
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.16, 16, 1, true), kit.mats.plastic('#9aa0ad'));
  ring.position.set(wellX, AH + 0.2, 0.05);
  const wellWaterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0d2a4a', emissive: '#4fb8ff', emissiveIntensity: 0.1 }));
  const wellWater = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), wellWaterMat);
  wellWater.rotation.x = -Math.PI / 2;
  wellWater.position.set(wellX, AH + 0.2, 0.05);
  const postGeo = mergeGeometries([new THREE.BoxGeometry(0.03, 0.42, 0.03).translate(-0.14, 0.21, 0), new THREE.BoxGeometry(0.03, 0.42, 0.03).translate(0.14, 0.21, 0)]);
  const posts = new THREE.Mesh(postGeo, kit.mats.plastic('#6b4a32'));
  posts.position.set(wellX, AH + 0.12, 0.05);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.18, 4), kit.mats.plastic('#c8424a'));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(wellX, AH + 0.62, 0.05);
  aq.add(ring, wellWater, posts, roof);
  aq.position.set(-5.35, gy, 3.0);
  aq.rotation.y = 0.42;
  kit.add(aq);
  aq.updateWorldMatrix(true, false);
  // the spring: groundwater flowing out of the hillside and back to the sea
  const springTex = flowTexture(kit, 15);
  springTex.repeat.set(2, 1);
  const springLocal: V3[] = [[AW / 2 - 0.02, 0.5, 0.25], [AW / 2 + 0.12, 0.42, 0.28], [AW / 2 + 0.22, 0.2, 0.32], [AW / 2 + 0.28, -0.02, 0.36]];
  const spring = waterTube(kit, springLocal.map((q) => aq.localToWorld(new THREE.Vector3(q[0], q[1], q[2]))), 0.05, springTex);

  // ---- Right: the Transpiration Garden islet with its leaf pinwheel, and the lighthouse
  const islet = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.15, 0.3, 28), kit.mats.plastic('#3e7a4e'));
  islet.position.set(6.25, gy + 0.05, -2.2);
  islet.receiveShadow = true;
  kit.add(islet);
  const garden = new THREE.Group();
  smallTree(kit, garden, [6.9, gy + 0.2, -2.9], 1.55, '#4aa865', 6);
  smallTree(kit, garden, [7.4, gy + 0.2, -1.7], 1.2, LEAF, 9);
  smallTree(kit, garden, [5.9, gy + 0.2, -3.3], 1.3, '#5fbf72', 3);
  kit.add(garden);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), kit.track(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, emissive: '#331a10', emissiveIntensity: 0.4 })), kit.n(26));
  const fr = rng(61);
  const fc = new THREE.Color();
  for (let i = 0; i < flowers.count; i++) {
    const a = fr() * TAU;
    const d = 0.6 + fr() * 1.05;
    flowers.setMatrixAt(i, mtx.makeTranslation(6.25 + Math.cos(a) * d, gy + 0.24, -2.2 + Math.sin(a) * d * 0.9));
    flowers.setColorAt(i, fc.set([CORAL, GOLD, IVORY, '#ff9fc0'][i % 4]));
  }
  kit.add(flowers);
  // leaf pinwheel: echoes the LEAF spinner on the playfield; it spins up with the sun
  const wheelPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.25, 10), kit.mats.paintedMetal('#d8e8d0'));
  wheelPost.position.set(5.15, gy + 0.2 + 0.62, -1.35);
  kit.add(wheelPost);
  const leafShape3 = new THREE.Shape();
  leafShape3.moveTo(0, 0);
  leafShape3.quadraticCurveTo(0.2, 0.18, 0.56, 0);
  leafShape3.quadraticCurveTo(0.2, -0.18, 0, 0);
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.ShapeGeometry(leafShape3, 6);
    g.rotateZ((i / 6) * TAU);
    blades.push(g);
  }
  const leafMat = kit.track(new THREE.MeshStandardMaterial({ color: '#6fd27a', emissive: LEAF, emissiveIntensity: 0.05, roughness: 0.55, side: THREE.DoubleSide }));
  const pinwheel = new THREE.Mesh(mergeGeometries(blades), leafMat);
  blades.forEach((g) => g.dispose());
  pinwheel.position.set(5.15, gy + 1.48, -1.25);
  pinwheel.rotation.y = -0.35;
  kit.add(pinwheel);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), kit.mats.brass());
  hub.position.set(5.15, gy + 1.48, -1.22);
  kit.add(hub);
  const gardenSign = kit.neonSign('LEAF GARDEN', [6.55, gy + 0.62, -0.45], { height: 0.26, color: LEAF, rotY: -0.38 });
  gardenSign.rotation.x = -0.55;
  const lighthouse = makeLighthouse(kit, [7.35, gy, -4.85], 0.66);

  // ---- Regatta: three boats on each side bob at anchor, then sail a parade loop at level 4
  const boatSpecs: [string, string, string][] = [['#7a2f3a', '#f2e6cc', CORAL], ['#1d3c6b', '#ffe3a0', AQUA], ['#5a3a24', '#e9f3ff', GOLD]];
  const boats: (Boat & { side: number; phase: number; home: V3 })[] = [];
  const homes: V3[] = [[-5.2, gy, -0.05], [-7.4, gy, 0.45], [-6.1, gy, 1.95], [5.15, gy, 0.3], [7.4, gy, 1.05], [5.8, gy, 2.0]];
  homes.forEach((home, i) => {
    const [hc, sc, fcol] = boatSpecs[i % 3];
    const boat = makeBoat(kit, hc, sc, fcol);
    boat.g.position.set(home[0], home[1], home[2]);
    boat.g.scale.setScalar(1.05);
    kit.add(boat.g);
    boats.push({ ...boat, side: home[0] < 0 ? -1 : 1, phase: (i % 3) * (TAU / 3), home });
  });

  // ---- Harbor fountains: the regatta circles them; at the Wonderlight they throw a crown of spray
  const FOUNT: [number, number][] = [[-6.05, 0.75], [6.05, 0.75]];
  const basinGeo = new THREE.CylinderGeometry(0.34, 0.4, 0.2, 24, 1, true);
  const poolGeo = new THREE.CircleGeometry(0.33, 24).rotateX(-Math.PI / 2);
  const spoutGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.34, 12);
  const fountainWaterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0f3354', emissive: '#5fd0ff', emissiveIntensity: 0.1, roughness: 0.2 }));
  for (const [fx, fz] of FOUNT) {
    const basin = new THREE.Mesh(basinGeo, kit.mats.paintedMetal('#d9cdb4'));
    basin.position.set(fx, gy + 0.06, fz);
    const pool = new THREE.Mesh(poolGeo, fountainWaterMat);
    pool.position.set(fx, gy + 0.12, fz);
    const spout = new THREE.Mesh(spoutGeo, kit.mats.brass());
    spout.position.set(fx, gy + 0.25, fz);
    kit.add(basin);
    kit.add(pool);
    kit.add(spout);
  }
  // spray: 6 radial arcs + 1 tall centre jet per fountain, positions computed in place
  const ARCS = 7;
  const PER = kit.n(26);
  const NJ = FOUNT.length * ARCS * PER;
  const jetPos = new Float32Array(NJ * 3);
  const jetSeed = new Float32Array(NJ * 3);
  const jr = rng(5);
  for (let i = 0; i < jetSeed.length; i++) jetSeed[i] = jr();
  const jetGeo = new THREE.BufferGeometry();
  jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPos, 3));
  const jetMat = kit.track(new THREE.PointsMaterial({ color: '#e6f9ff', size: 0.15, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const jets = new THREE.Points(jetGeo, jetMat);
  jets.frustumCulled = false;
  jets.visible = false;
  kit.add(jets);
  // ---- Level-4 spectacle: sunlight through the spray paints a rainbow over the left harbor
  const rbInner = 1.5;
  const rbOuter = 1.9;
  const rainbowMat = kit.track(new THREE.MeshBasicMaterial({ map: rainbowTexture(kit, rbInner, rbOuter), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const rainbow = new THREE.Mesh(new THREE.RingGeometry(rbInner, rbOuter, 72, 1, 0, Math.PI), rainbowMat);
  rainbow.rotation.order = 'YXZ';
  rainbow.rotation.set(-0.3, 0.45, 0);
  rainbow.position.set(-5.85, gy - 0.15, 0.05);
  rainbow.visible = false;
  kit.add(rainbow);
  const fwL = kit.fireworks({ x0: -8.4, x1: -5.6, y0: 2.3, y1: 2.9, z: -2.4 }, [GOLD, CORAL, AQUA, LEAF]);
  const fwR = kit.fireworks({ x0: 5.6, x1: 8.2, y0: 1.5, y1: 2.2, z: -4.6 }, [GOLD, AQUA, CORAL, '#ff9fc0']);

  // ---- Head: painted panorama, the marquee, and the rising sun (seen on the fly-in)
  const pano = kit.backdrop(paintPanorama, { width: 26, height: 10, z: -15, y: 3.8 });
  const marquee = wideSign(kit, 'RAINDROP ROYAL REGATTA', [0, 1.3, -7.2], 5.2, 0.62, GOLD);
  marquee.g.rotation.x = -0.72;
  const sunMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a2a10', emissive: GOLD, emissiveIntensity: 0.2 }));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 20), sunMat);
  sun.position.set(4.2, 3.0, -12.5);
  kit.add(sun);

  // ---- Bunting from the lighthouse to the pier, harbor lanterns, golden motes
  kit.pole([4.4, 0, -1.6], 1.9);
  kit.pole([4.4, 0, 4.4], 1.9);
  const flagsR = kit.stringLights([7.35, lighthouse.topY - 0.1, -4.85], [4.4, 1.85, -1.6], 0.35, kit.n(9), [AQUA, GOLD, CORAL]);
  const flagsR2 = kit.stringLights([4.4, 1.85, -1.6], [4.4, 1.85, 4.4], 0.4, kit.n(10), [GOLD, CORAL, AQUA]);
  kit.pole([-4.4, 0, -1.3], 1.5);
  const lampL = kit.lantern([-4.4, 1.72, -1.3], GOLD, 0.13);
  const gold = kit.motes({ x0: -9, x1: 9, y0: 0, y1: 4, z0: -7, z1: 6 }, 90, GOLD, { speed: 0.1, size: 0.09 });

  // ---- Lights (three): cool light on the mountain, warm light on the garden, harbor glow
  kit.spot([-4.5, 7, 3], [-6.4, 0.6, -2.6], '#a8d8ff', 30, 0.5);
  kit.spot([4.5, 7, 3], [6.2, 0.5, -2.2], '#ffd9a0', 28, 0.5);
  const glow = kit.point([0, 3.2, 6.5], GOLD, 0, 16);

  let beamAngle = 0;
  let regatta = 0;
  let spin = 0;
  let celebrateBoost = 0;
  return {
    update(t, dt, level, energy) {
      const s1 = kit.stage(level, 0, 1);
      const s2 = kit.stage(level, 1, 2);
      const s3 = kit.stage(level, 2, 3);
      const s4 = kit.stage(level, 3.2, 4);
      pano.repaint(level);
      // harbor glow
      seaMat.emissiveIntensity = 0.22 + 0.2 * s2 + 0.3 * s4;
      seaMat.emissive.copy(seaDark).lerp(seaBright, 0.6 * s4);
      // mission 1: water's disguises (clouds of droplets, rain, runoff)
      cloudL.setLit(0.35 + 0.65 * s1);
      cloudR.setLit(0.3 + 0.6 * s1);
      rain.setLit(0.1 + 0.8 * s1);
      rain2.setLit(0.1 + 0.7 * s1);
      splash.setLit(0.15 + 0.65 * s1);
      stream.mat.emissiveIntensity = 0.12 + 1.0 * s1;
      if (!kit.reducedMotion) streamTex.offset.x -= dt * (0.4 + 0.8 * s1);
      mtnSign.setLit(0.15 + 0.85 * s1);
      // mission 2: the sun lifts (garden pinwheel, lighthouse lamp), gravity drops
      gardenSign.setLit(0.15 + 0.85 * s2);
      leafMat.emissiveIntensity = 0.05 + 0.5 * s2;
      if (!kit.reducedMotion) spin += dt * (0.15 + 2.2 * s2 + 2 * s4);
      pinwheel.rotation.z = spin;
      sunMat.emissiveIntensity = 0.25 + 2.2 * s2;
      sun.position.y = 2.6 + 3.6 * kit.stage(level, 0.6, 2.4);
      lighthouse.lampMat.emissiveIntensity = 0.1 + 2.6 * s2;
      lighthouse.beamMat.opacity = 0.08 * s2 + 0.03 * s4;
      if (!kit.reducedMotion) beamAngle += dt * (0.4 + 0.6 * s4);
      lighthouse.rotor.rotation.y = beamAngle;
      // mission 3: groundwater routes (aquifer, well, spring) and the regatta lanterns
      const aqGlow = 0.06 + 1.5 * s3 * (0.85 + 0.15 * energy);
      frontMat.emissiveIntensity = aqGlow;
      sideMat.emissiveIntensity = aqGlow;
      wellWaterMat.emissiveIntensity = 0.1 + 1.6 * s3;
      spring.mat.emissiveIntensity = 0.1 + 1.1 * s3;
      spring.mat.opacity = 0.35 + 0.6 * s3;
      if (!kit.reducedMotion) springTex.offset.x -= dt * 0.8 * s3;
      lampL.setLit(0.2 + 0.8 * Math.max(s3, s4));
      marquee.setLit(0.15 + 0.85 * kit.stage(level, 0.4, 1.6));
      flagsR.setLit(0.2 + 0.4 * s1 + 0.4 * s3);
      flagsR2.setLit(0.2 + 0.4 * s1 + 0.4 * s3);
      // level 4: the Royal Regatta
      gold.setLit(0.05 + 0.75 * s4);
      if (glow) glow.intensity = 6 * s4 + 1.2 * s2;
      fwL.setLit(Math.max(s4, celebrateBoost));
      fwR.setLit(Math.max(s4, celebrateBoost));
      rainbow.visible = s4 > 0.01 || celebrateBoost > 0.01;
      rainbowMat.opacity = 0.75 * Math.max(s4, celebrateBoost);
      if (!kit.reducedMotion) regatta += dt * 0.22 * s4;
      for (const b of boats) {
        b.lamp.emissiveIntensity = 0.1 + 2.6 * Math.max(s3 * 0.7, s4);
        b.sail.emissiveIntensity = 0.04 + 0.4 * s4;
        const bob = kit.reducedMotion ? 0 : Math.sin(t * 1.3 + b.phase * 2) * 0.03;
        const rest = b.side < 0 ? 0.4 : Math.PI - 0.4;
        if (s4 > 0.01) {
          // mirrored parade loops; the bow (+x in boat space) follows the direction of travel
          const a = regatta + b.phase;
          const x = b.side * (6.05 + Math.cos(a) * 1.05);
          const z = 0.75 + Math.sin(a) * 1.25;
          b.g.position.set(b.home[0] + (x - b.home[0]) * s4, gy + bob, b.home[2] + (z - b.home[2]) * s4);
          const heading = Math.atan2(-Math.cos(a), -b.side * Math.sin(a));
          const turn = Math.atan2(Math.sin(heading - rest), Math.cos(heading - rest));
          b.g.rotation.y = rest + turn * s4;
        } else {
          b.g.position.set(b.home[0], gy + bob, b.home[2]);
          b.g.rotation.y = rest;
        }
        b.g.rotation.z = kit.reducedMotion ? 0 : Math.sin(t * 1.1 + b.phase) * 0.05;
      }
      // fountains: a gentle bubble once groundwater flows (level 3), a crown of spray at level 4
      fountainWaterMat.emissiveIntensity = 0.1 + 0.45 * s3 + 0.5 * s4;
      const salute = Math.max(s4, celebrateBoost);
      jets.visible = salute > 0.01;
      jetMat.opacity = 0.9 * salute;
      if (jets.visible) {
        const tt = kit.reducedMotion ? 0.4 : t;
        let k = 0;
        for (let f = 0; f < FOUNT.length; f++) {
          const [fx, fz] = FOUNT[f];
          for (let j = 0; j < ARCS; j++) {
            const centre = j === ARCS - 1;
            const ang = (j / (ARCS - 1)) * TAU + 0.3 + f;
            const vh = centre ? 0 : 0.68 * salute;
            const vy = centre ? 3.5 : 2.9;
            const life = centre ? 1.35 : 1.12;
            for (let i = 0; i < PER; i++) {
              const age = ((tt * 0.85 + i / PER + j * 0.11) % 1) * life;
              const jx = 0.07 * (jetSeed[k] - 0.5);
              const jz = 0.07 * (jetSeed[k + 2] - 0.5);
              jetPos[k] = fx + Math.cos(ang) * vh * age + jx * (1 + age * 2);
              jetPos[k + 1] = gy + 0.4 + vy * age * salute - 2.6 * age * age * salute;
              jetPos[k + 2] = fz + Math.sin(ang) * vh * age + jz * (1 + age * 2);
              k += 3;
            }
          }
        }
        jetGeo.attributes.position.needsUpdate = true;
      }
      celebrateBoost = Math.max(0, celebrateBoost - dt * 0.6);
    },
    celebrate(p) {
      celebrateBoost = Math.max(celebrateBoost, Math.sin(p * Math.PI));
      gold.setLit(0.4 + 0.6 * Math.sin(p * Math.PI));
    },
  };
};

// ================================================================ dollhouse room

const harborRoom: RoomBuilder = ({ kit }) => {
  const pool = kit.water([0.1, 0.05, 0.2], 1.9, 1.1, '#1f6f99');
  const poolMat = pool.material as THREE.MeshPhysicalMaterial;
  poolMat.emissive = new THREE.Color('#2a7fb0');
  snowPeak(kit, { at: [-0.6, 0, -0.5], r: 0.42, h: 0.9, seed: 3 }, ROCK, SNOW, 0.62, 12);
  const cloud = dropletCloud3D(kit, [-0.3, 1.32, -0.4], [[0, 0, 0, 0.2], [0.2, -0.03, 0, 0.15], [-0.2, -0.04, 0, 0.14]], 160, 0.06, 3);
  const rain = kit.motes({ x0: -0.5, x1: -0.1, y0: 0.15, y1: 1.18, z0: -0.5, z1: -0.3 }, 28, RAIN, { speed: 0.9, size: 0.04, rise: false });
  const sun = kit.orb([0.72, 1.36, -0.62], 0.12, GOLD);
  const boat = makeBoat(kit, '#7a2f3a', '#f2e6cc', CORAL);
  boat.g.scale.setScalar(0.42);
  boat.g.position.set(0.3, 0.08, 0.3);
  boat.g.rotation.y = 0.5;
  kit.add(boat.g);
  smallTree(kit, kit.root, [0.75, 0.0, -0.35], 0.6, LEAF, 4);
  return {
    update(t, lit) {
      cloud.setLit(0.2 + 0.8 * lit);
      rain.setLit(lit * 0.9);
      sun.setLit(lit);
      boat.lamp.emissiveIntensity = 0.1 + 2.4 * lit;
      boat.sail.emissiveIntensity = 0.04 + 0.3 * lit;
      boat.g.position.y = 0.08 + (kit.reducedMotion ? 0 : Math.sin(t * 1.4) * 0.015);
      poolMat.emissiveIntensity = 0.1 + 0.5 * lit;
    },
  };
};

// ================================================================ the attraction

export const L18: TableDef = {
  lessonId: 'L18',
  signature: 'A sky-high Cloud Ramp that tunnels into Rain Mountain and rains down on the harbor',
  ballRole: 'The Wonderball is a game token standing in for a bit of water. Real water molecules are far too small to see, and water vapor is an invisible gas, not a glowing ball.',
  theme: {
    bg: ['#15456b', '#0a2140'],
    rail: '#bfe6f5',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: AQUA,
    bumperCap: '#e9f6ff',
    bumperRing: '#1d4f7a',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(150,225,255,0.2)',
    trail: AQUA,
  },
  lines: {
    intro: "Welcome to the Raindrop Royal Regatta, where every drop of water sails its own route! Let's find out what lifts water into the sky and what brings it home.",
    quark: '"That fluffy white cloud is made of water vapor, so vapor must be white and puffy," Professor Quark wonders aloud.',
    pipTip: 'Cradle the Wonderball on the left flipper, then flip straight up into the mountain tunnel to ride the Cloud Ramp.',
  },
  build,
  skillShot: 'dew_drop',
  shots: [
    { id: 'ramp', label: 'Cloud Ramp', on: [{ type: 'ramp', id: 'cloud_ramp' }], insert: 'ins_ramp' },
    { id: 'garden', label: 'Garden Lane', on: [{ type: 'shot', id: 'garden_sw' }], insert: 'ins_garden' },
    { id: 'soak', label: 'Soak-In Well', on: [{ type: 'portal', id: 'soak_in' }], insert: 'ins_soak' },
    { id: 'glacier', label: 'Glacier', on: [{ type: 'drop', group: 'ice' }], insert: 'ins_glacier' },
    { id: 'pocket', label: 'Aquifer Grotto', on: [{ type: 'saucer', id: 'aquifer' }], insert: 'ins_pocket' },
    { id: 'clouds', label: 'Storm Clouds', on: [{ type: 'bumper', group: 'clouds' }], insert: 'ins_clouds' },
    { id: 'runoff', label: 'Runoff Run', on: [{ type: 'shot', id: 'runoff_sw' }], insert: 'ins_runoff' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: "Water's Disguises",
      brief: 'Grow raindrops in the storm clouds, then spot three water cycle processes around the harbor.',
      objectiveIds: ['L18-O1'],
      stages: [
        { kind: 'collect', text: 'Bump the storm clouds 5 times to grow raindrops', match: { type: 'bumper', group: 'clouds' }, count: 5, preview: ['clouds'] },
        { kind: 'shots', text: 'Spot 3 processes: Garden Lane, Glacier, Cloud Ramp', shots: ['garden', 'glacier', 'ramp'], order: 'any' },
        { kind: 'discover', text: 'Shoot the Aquifer Grotto', pocket: 'aquifer', questions: 1 },
      ],
      discovery: 'Water keeps changing places and states. Water vapor is an invisible gas; the clouds you can see are tiny liquid droplets or ice crystals made when vapor cools.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Sun Lifts, Gravity Drops',
      brief: 'Power the climb with sunshine, then let gravity bring the water home.',
      objectiveIds: ['L18-O2'],
      stages: [
        { kind: 'shots', text: 'Sun power: spin the Garden Lane and melt the Glacier', shots: ['garden', 'glacier'], order: 'any' },
        { kind: 'shots', text: "Gravity's turn: rain off the Cloud Ramp and Soak In", shots: ['ramp', 'soak'], order: 'any' },
        { kind: 'discover', text: 'Shoot the Aquifer Grotto to sort sun and gravity', pocket: 'aquifer', questions: 1, types: ['classify'] },
      ],
      discovery: "The sun's energy powers evaporation, transpiration and melting. Vapor gives that energy back as it cools and condenses. Gravity pulls water down and downhill: precipitation, runoff and infiltration.",
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Every Drop, Its Own Route',
      brief: 'Trace two different routes a drop can take, then map them in the Aquifer Grotto.',
      objectiveIds: ['L18-O3'],
      stages: [
        { kind: 'shots', text: 'Route 1: rain down the Cloud Ramp, then Soak In', shots: ['ramp', 'soak'], order: 'sequence' },
        { kind: 'shots', text: 'Route 2: melt the Glacier, then rise from the Garden', shots: ['glacier', 'garden'], order: 'sequence' },
        { kind: 'discover', text: 'Shoot the Aquifer Grotto to map the routes', pocket: 'aquifer', questions: 1, types: ['order', 'match'] },
      ],
      discovery: 'The water cycle has no starting line and no fixed order. One drop rains straight back into the sea; another melts, soaks underground or rises from a leaf. No drop must visit every stop.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'The Royal Regatta',
    brief: 'Sail drops down four different paths, then bring the Wonderball home to the Aquifer Grotto.',
    stages: [
      { kind: 'shots', text: 'Launch the regatta: Ramp, Garden, Soak In, Glacier', shots: ['ramp', 'garden', 'soak', 'glacier'], order: 'any' },
      { kind: 'discover', text: 'Bring the Wonderball home to the Aquifer Grotto', pocket: 'aquifer', questions: 2 },
    ],
    celebration: 'Sunshine lifts it, gravity brings it home, and every drop takes its own route. The Royal Regatta sets sail and the Water Wonderlight shines!',
  },
  set: harborSet,
  room: harborRoom,
  scenery: {
    backdrop({ ctx, level }) {
      paintPlayfield(ctx, level);
    },
    ambient: paintAmbient,
    celebrate: paintCelebrate,
  },
};
export default L18;
