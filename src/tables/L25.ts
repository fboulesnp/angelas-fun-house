// Lesson 25 — Volcanic Eruptions and Earthquakes — "Rumble Mountain Rescue"
// A mountain observatory at night. Rumble Mountain (a subduction volcano) carries three plate-
// boundary survey markers on its east face, a Magma Vent scoop at its foot and a test ground
// for two bridge models. Three monitoring sensors (QUAKES, GAS, SWELL) pop under the stars,
// the Ring of Fire orbit sweeps the rim past a seismograph, and the Bridge Tester ramp carries
// every model across Rumble Valley under the same test. The Observatory is the Wonder Pocket.
// Science line: eruptions can be forecast from warning signs; earthquake chances can only be
// estimated over years; engineers build to match the risk and compare designs with fair tests.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import { TAU, glowDot, mix, neonPath, neonText, rgba, rng, rrect, stage, stars, vgrad } from '../game/render/art.ts';

type P2 = [number, number];
type V3 = [number, number, number];

const LAVA = '#FF6A2B';
const EMBER = '#FF9A3C';
const GOLD = '#FFC75B';
const MINT = '#71E3CF';
const CORAL = '#FF7F86';
const IVORY = '#FFF7E7';
const SKYBLUE = '#8FB8FF';
const VIOLET = '#B48CFF';

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: P2, b: P2, k = 1): P2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const unit = (deg: number): P2 => [Math.cos(rad(deg)), Math.sin(rad(deg))];

// ================================================================ shared layout

const VENT: P2 = [178, 552];
const VENT_AXIS = 72; // the notch opens down-right, toward the right flipper
const OBS: P2 = [306, 472];
const SUMMIT: P2 = [150, 314];
const RAMP_PATH: P2[] = [
  [392, 626], [414, 566], [428, 496], [432, 420], [424, 348], [400, 286], [360, 240], [304, 212], [240, 204],
  [180, 214], [128, 244], [88, 292], [62, 360], [50, 440], [48, 540], [50, 640], [62, 730], [83, 806],
];
const BUMPERS: P2[] = [[250, 300], [340, 300], [296, 372]];
const SENSORS: [string, string, string][] = [['quakes', 'QUAKES', CORAL], ['gas', 'GAS', MINT], ['swell', 'SWELL', GOLD]];

function ventNotch() {
  const u = unit(VENT_AXIS);
  const p: P2 = [u[1], -u[0]];
  const back = add(VENT, u, -17);
  const mouth = add(VENT, u, 44);
  return { rightBack: add(back, p, 22), leftBack: add(back, p, -22), rightMouth: add(mouth, p, 28), leftMouth: add(mouth, p, -28) };
}
const NOTCH = ventNotch();
const VOLCANO: P2[] = [[74, 640], [74, 396], SUMMIT, [220, 408], [220, 500], NOTCH.rightMouth, NOTCH.rightBack, NOTCH.leftBack, NOTCH.leftMouth];

/** A point along the volcano's foot (the test ground), `s` units from the vent mouth, pushed out by `off`. */
function footPoint(s: number, off: number): P2 {
  const a = NOTCH.leftMouth;
  const b: P2 = [74, 640];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d: P2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  return add(add(a, d, s), [-d[1], d[0]], -off);
}

// ================================================================ playfield geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Left channel: the return path down the mountain's west face (the kickback fires up it) ---
  b.post(74, 392, 5);
  b.shotSwitch('ring_sw_l', 49, 480, -90);
  b.gate('ring_deflect', [FRAME.left, 646], [54, 694], -90);

  // --- Ring of Fire orbit: a funnelled right channel the left flipper can reach, with the seismograph ---
  b.wall([[476, 446], [498, 376]], { id: 'fault_wall', r: 3 });
  b.post(498, 372, 5);
  b.post(476, 450, 5);
  b.shotSwitch('ring_sw_r', 523, 420, -90);
  b.spinner('seismo', [502, 380], [544, 380], { label: 'SEISMOGRAPH' });
  b.wall([[FRAME.laneSep, 646], [494, 702]], { id: 'fault_deflect', r: 3 });

  // --- Skill shot: a soft plunge drops onto the epicenter ---
  b.rollover('epicenter', 497, 330, { group: 'skill', label: 'EPICENTER' });

  // --- Rumble Mountain: one solid block with the Magma Vent notch at its south-east foot ---
  b.wall(VOLCANO, { id: 'volcano', r: 3, closed: true });
  b.saucer('vent', VENT[0], VENT[1], { role: 'scoop', ejectDeg: 80, ejectSpeed: 720, captureMaxSpeed: 2600, label: 'VENT', icon: 'flame' });

  // --- Plate-boundary survey markers on the mountain's east face ---
  b.target('convergent', [227, 412], [227, 462], { group: 'plates', label: 'CONVERGENT' });
  b.target('divergent', [227, 472], [227, 522], { group: 'plates', label: 'DIVERGENT' });
  b.target('transform', [227, 532], [225.8, 580], { group: 'plates', label: 'TRANSFORM' });

  // --- Two bridge models on the test ground along the mountain's foot ---
  b.target('model_a', footPoint(10, 7), footPoint(44, 7), { group: 'models', label: 'MODEL A' });
  b.target('model_b', footPoint(56, 7), footPoint(90, 7), { group: 'models', label: 'MODEL B' });

  // --- The Observatory dome: the Wonder Pocket ---
  const [ox, oy] = OBS;
  b.wall([[ox - 30, oy + 22], ...b.arcPoints(ox, oy - 2, 30, 180, 360, 14), [ox + 30, oy + 22]], { id: 'dome', r: 4 });
  b.saucer('observatory', ox, oy, { role: 'pocket', ejectDeg: 106, ejectSpeed: 760, captureMaxSpeed: 2400, label: 'OBSERVATORY', icon: 'observatory' });

  // --- Volcano-watch sensors: three pop bumpers ---
  BUMPERS.forEach(([x, y], i) => b.bumper(`sensor_${SENSORS[i][0]}`, x, y, { group: 'signs', r: 24, label: SENSORS[i][1], icon: `sign_${SENSORS[i][0]}` }));

  // --- Bridge Tester ramp: flared mouth, climbs past the observatory and spans Rumble Valley ---
  const p0 = RAMP_PATH[0];
  const p1 = RAMP_PATH[1];
  const dl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const d: P2 = [(p1[0] - p0[0]) / dl, (p1[1] - p0[1]) / dl];
  const nn: P2 = [-d[1], d[0]];
  // Only a left flare: the right side stays open so (a) left-flipper shots can reach the Ring of
  // Fire lane beside the mouth and (b) a weak shot that stalls in the mouth rolls back out onto clear
  // playfield (the ramp's footprint wall is the mouth's right edge).
  const lr = add(p0, nn, -19);
  b.wall([add(lr, d, 2), add(add(lr, d, -50), nn, -18)], { id: 'ramp_flare_l', r: 3 });
  b.ramp('bridge', { path: RAMP_PATH, width: 38, footprintTo: 2, peak: 95, label: 'BRIDGE TESTER' });

  // --- Inserts (one per shot) ---
  b.insert('ins_ring', 470, 600, { deg: -63, color: EMBER });
  b.insert('ins_bridge', 372, 690, { deg: -70, color: MINT });
  b.insert('ins_vent', 214, 640, { deg: -108, color: LAVA });
  b.insert('ins_obs', 306, 556, { deg: -90, color: GOLD });
  b.insert('ins_plates', 262, 600, { deg: -100, color: CORAL });
  b.insert('ins_models', 186, 680, { deg: -124, color: MINT });
  b.insert('ins_signs', 296, 316, { shape: 'star', size: 12, color: IVORY });
}

// ================================================================ printed playfield art

function poly(ctx: CanvasRenderingContext2D, pts: P2[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Small readable printed label (Atkinson), optionally rotated. */
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
  ctx.strokeStyle = `rgba(10,6,24,${0.8 * alpha})`;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Two small arrows that show how plates move at a boundary. */
function plateArrows(ctx: CanvasRenderingContext2D, kind: 'convergent' | 'divergent' | 'transform', x: number, y: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.fillStyle = rgba(color, alpha);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  const head = (hx: number, hy: number, dir: number) => {
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(dir) * 5, hy + Math.sin(dir) * 5);
    ctx.lineTo(hx + Math.cos(dir + 2.5) * 5, hy + Math.sin(dir + 2.5) * 5);
    ctx.lineTo(hx + Math.cos(dir - 2.5) * 5, hy + Math.sin(dir - 2.5) * 5);
    ctx.closePath();
    ctx.fill();
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  if (kind === 'convergent') {
    line(-12, 0, -4, 0);
    head(-3, 0, 0);
    line(12, 0, 4, 0);
    head(3, 0, Math.PI);
  } else if (kind === 'divergent') {
    line(-3, 0, -10, 0);
    head(-11, 0, Math.PI);
    line(3, 0, 10, 0);
    head(11, 0, 0);
  } else {
    line(-4, 8, -4, -4);
    head(-4, -6, -Math.PI / 2);
    line(4, -8, 4, 4);
    head(4, 6, Math.PI / 2);
  }
  ctx.restore();
}

function mountainRange(ctx: CanvasRenderingContext2D, pts: P2[], bottom: number, color: string) {
  const top = Math.min(...pts.map((p) => p[1]));
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color);
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], bottom);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(pts[pts.length - 1][0], bottom);
  ctx.closePath();
  ctx.fill();
}

/** One pre-painted aurora column per colour, so the animated 2D aurora draws without allocating. */
const auroraSprites: Record<string, HTMLCanvasElement> = {};
function auroraSprite(c: string): HTMLCanvasElement {
  let s = auroraSprites[c];
  if (!s) {
    s = document.createElement('canvas');
    s.width = 1;
    s.height = 64;
    const sx = s.getContext('2d')!;
    const g = sx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(0.75, rgba(c, 0.07 / 0.16));
    g.addColorStop(1, rgba(mix(c, IVORY, 0.4), 1));
    sx.fillStyle = g;
    sx.fillRect(0, 0, 1, 64);
    auroraSprites[c] = s;
  }
  return s;
}

function aurora(ctx: CanvasRenderingContext2D, lit: number, t = 0) {
  if (lit <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const base = 70 + k * 34;
    const sprite = auroraSprite(k === 1 ? VIOLET : MINT);
    for (let x = 40; x <= 560; x += 6) {
      const win = Math.pow(Math.sin(((x - 40) / 520) * Math.PI), 0.8);
      const y = base + Math.sin(x / 70 + k * 1.7 + t * 0.3) * 18 + Math.sin(x / 23 + k + t * 0.7) * 5;
      const h = (46 + 26 * Math.sin(x / 47 + k * 2.3)) * win;
      if (h < 2) continue;
      ctx.globalAlpha = Math.min(1, 0.16 * lit * win);
      ctx.drawImage(sprite, x, y - h, 6, h);
    }
  }
  ctx.restore();
}

function paintPlayfield(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.2, 4);

  // ---- night sky and the high ranges
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#0d0920'], [0.2, '#1b1436'], [0.45, '#271b3e'], [0.75, '#2a1b38'], [1, '#150e22']]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 25, 150, [24, 14, 576, 250], IVORY);
  aurora(ctx, s4);
  mountainRange(ctx, [[0, 236], [60, 196], [104, 220], [158, 168], [204, 204], [250, 160], [288, 194], [330, 182], [374, 150], [422, 198], [466, 166], [514, 212], [560, 186], [600, 226]], 330, '#241b40');
  mountainRange(ctx, [[0, 276], [70, 238], [124, 262], [182, 226], [236, 250], [272, 232], [300, 276], [328, 232], [368, 254], [420, 224], [472, 256], [522, 232], [600, 268]], 340, '#2d2147');
  // snow-light on the peaks
  for (const [x, y] of [[158, 168], [250, 160], [374, 150], [466, 166]] as P2[]) {
    ctx.fillStyle = rgba('#d9d4f0', 0.14 + 0.08 * s1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 14, y + 16);
    ctx.lineTo(x + 13, y + 15);
    ctx.closePath();
    ctx.fill();
  }
  // Rumble Valley under the bridge span: a river glinting far below
  ctx.strokeStyle = rgba(MINT, 0.12 + 0.4 * s3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(296, 236);
  ctx.bezierCurveTo(306, 250, 290, 262, 300, 276);
  ctx.stroke();

  // ---- title (glows from the second mission)
  const sTitle = stage(level, 1.4, 2.4);
  // (kept high: the Bridge Tester's raised span hides anything printed much below y = 100 in 3D)
  neonText(ctx, 'RUMBLE MOUNTAIN', 304, 62, 25, EMBER, 0.3 + 0.7 * sTitle);
  neonText(ctx, 'RESCUE', 304, 90, 18, GOLD, 0.3 + 0.7 * sTitle);

  // ---- survey contours across the plateau (a topographic map of the mountain)
  ctx.save();
  ctx.lineWidth = 1.2;
  const cr = rng(31);
  for (let k = 1; k <= 9; k++) {
    ctx.strokeStyle = rgba(IVORY, 0.05 + 0.03 * s1);
    ctx.beginPath();
    const R = 60 + k * 46;
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU;
      const wob = 1 + 0.06 * Math.sin(a * 3 + k) + 0.03 * Math.sin(a * 7 + cr() * 0.2);
      const x = SUMMIT[0] + Math.cos(a) * R * 1.25 * wob;
      const y = SUMMIT[1] + 60 + Math.sin(a) * R * wob;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ---- the observatory's telescope beam (wakes with the sensors)
  const beam = 0.05 + 0.12 * s2 + 0.12 * s4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bg = ctx.createLinearGradient(0, 440, 0, 40);
  bg.addColorStop(0, rgba(GOLD, beam));
  bg.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = bg;
  poly(ctx, [[298, 440], [314, 440], [372, 40], [330, 40]]);
  ctx.fill();
  ctx.restore();

  // ---- sensor station under the bumpers: rings and data cables to the observatory
  BUMPERS.forEach(([x, y], i) => {
    const c = SENSORS[i][2];
    ctx.strokeStyle = rgba(c, 0.16 + 0.5 * s2);
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + OBS[0]) / 2 + (i - 1) * 18, (y + 440) / 2 + 10, OBS[0] + (i - 1) * 10, 440);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = rgba(c, 0.2 + 0.5 * s2);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 33, 0, TAU);
    ctx.stroke();
    if (s2 > 0.01) glowDot(ctx, x, y, 46, c, 0.25 * s2);
  });

  // ---- Rumble Mountain: a stratovolcano cut open to show its magma
  ctx.save();
  poly(ctx, VOLCANO);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, 300, 650, [[0, '#7a5f6e'], [0.35, '#54424f'], [1, '#2a2132']]);
  ctx.fillRect(60, 290, 180, 370);
  // ash and lava layers parallel to the flanks (a stratovolcano is built of many layers)
  for (let k = 1; k < 11; k++) {
    const dy = k * 30;
    ctx.strokeStyle = k % 2 ? rgba('#a08390', 0.12) : rgba('#1c1424', 0.22);
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(SUMMIT[0] - 200, SUMMIT[1] + dy + 216);
    ctx.lineTo(SUMMIT[0], SUMMIT[1] + dy);
    ctx.lineTo(SUMMIT[0] + 200, SUMMIT[1] + dy + 268);
    ctx.stroke();
  }
  // magma chamber, a tapering conduit up to the crater, and a side dike feeding the vent
  const mg = 0.35 + 0.45 * s2 + 0.15 * s4;
  ctx.save();
  ctx.shadowColor = LAVA;
  ctx.shadowBlur = 16 * mg;
  ctx.fillStyle = rgba(LAVA, mg);
  ctx.beginPath();
  ctx.moveTo(110, 588);
  ctx.bezierCurveTo(124, 540, 136, 450, 147, 322);
  ctx.lineTo(153, 322);
  ctx.bezierCurveTo(146, 450, 138, 540, 128, 588);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(126, 566);
  ctx.quadraticCurveTo(144, 548, 160, 546);
  ctx.lineTo(160, 554);
  ctx.quadraticCurveTo(144, 556, 130, 574);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(84, 604);
  ctx.bezierCurveTo(88, 584, 112, 578, 132, 584);
  ctx.bezierCurveTo(156, 590, 160, 606, 142, 614);
  ctx.bezierCurveTo(122, 622, 92, 620, 84, 604);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, 120, 600, 22, GOLD, 0.25 + 0.45 * s2);
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.5 * s2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 588);
  ctx.bezierCurveTo(131, 540, 141, 450, 150, 324);
  ctx.stroke();
  ctx.restore();
  label(ctx, 'MAGMA', 98, 560, 8, GOLD, 0.35 + 0.5 * s2);
  // instruments on the flanks: seismometer, gas sensor, GPS (they light during the sensor mission)
  const inst: [number, number, string][] = [[106, 470, CORAL], [128, 392, MINT], [186, 436, GOLD]];
  inst.forEach(([x, y, c], i) => {
    ctx.fillStyle = rgba('#1a1226', 0.85);
    if (i === 0) ctx.fillRect(x - 7, y - 5, 14, 10);
    else if (i === 1) ctx.fillRect(x - 2, y - 12, 4, 16);
    else {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x - 7, y + 6);
      ctx.lineTo(x + 7, y + 6);
      ctx.closePath();
      ctx.fill();
    }
    glowDot(ctx, x, y - 8, 7 + 6 * s2, c, 0.35 + 0.6 * s2);
  });
  ctx.restore();
  // rim light on the mountain outline
  ctx.strokeStyle = rgba(EMBER, 0.18 + 0.2 * s2);
  ctx.lineWidth = 2;
  poly(ctx, VOLCANO);
  ctx.stroke();
  // the vent glows inside its notch
  ctx.fillStyle = rgba(LAVA, 0.18 + 0.3 * s2);
  poly(ctx, [NOTCH.rightMouth, NOTCH.rightBack, NOTCH.leftBack, NOTCH.leftMouth]);
  ctx.fill();
  glowDot(ctx, VENT[0], VENT[1], 30, EMBER, 0.3 + 0.4 * s2);
  // crater glow and drifting gas
  glowDot(ctx, SUMMIT[0], SUMMIT[1] + 4, 18, EMBER, 0.35 + 0.45 * s2);
  for (let i = 0; i < 4; i++) {
    glowDot(ctx, SUMMIT[0] - 6 + i * 7, SUMMIT[1] - 18 - i * 16, 13 + i * 4, '#d9d2e6', 0.07 + 0.14 * s2);
  }
  label(ctx, 'GAS', SUMMIT[0] + 30, SUMMIT[1] - 34, 9, IVORY, 0.25 + 0.55 * s2);

  // ---- boundary icons beside the survey markers
  plateArrows(ctx, 'convergent', 254, 437, GOLD, 0.35 + 0.6 * s1);
  plateArrows(ctx, 'divergent', 254, 497, GOLD, 0.35 + 0.6 * s1);
  plateArrows(ctx, 'transform', 254, 556, GOLD, 0.35 + 0.6 * s1);
  // The markers' own faces are edge-on to the 3D camera, so print their names on the mountain
  // just inside its east wall (the 2D view prints its target labels outside the wall).
  ([['CONVERGENT', 437], ['DIVERGENT', 497], ['TRANSFORM', 556]] as [string, number][]).forEach(([t, y]) =>
    label(ctx, t, 207, y, 8.5, GOLD, 0.5 + 0.5 * s1, -Math.PI / 2));

  // ---- observatory platform under the dome
  ctx.fillStyle = rgba('#efe6ff', 0.06 + 0.06 * s2);
  ctx.beginPath();
  ctx.ellipse(OBS[0], OBS[1] + 26, 56, 16, 0, 0, TAU);
  ctx.fill();
  glowDot(ctx, OBS[0], OBS[1], 60, GOLD, 0.12 + 0.25 * s2 + 0.3 * s4);

  // ---- seismograph strip down the Ring of Fire lane
  ctx.fillStyle = rgba(IVORY, 0.05 + 0.08 * s2);
  ctx.fillRect(505, 392, 36, 250);
  ctx.save();
  ctx.strokeStyle = rgba(CORAL, 0.35 + 0.55 * s2);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const tr = rng(77);
  for (let y = 394; y <= 640; y += 3) {
    const burst = Math.exp(-((y - 520) ** 2) / 900);
    const amp = 2 + 14 * burst;
    const x = 523 + (tr() - 0.5) * 2 * amp;
    if (y === 394) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  label(ctx, 'SEISMOGRAPH', 533, 460, 9, IVORY, 0.5 + 0.4 * s2, -Math.PI / 2);
  label(ctx, 'RING OF FIRE', 492, 640, 11, EMBER, 0.55 + 0.4 * s1, rad(-63));

  // ---- Ring of Fire map: volcanoes and quakes gather along the rim of an ocean
  const cx = 292;
  const cy = 728;
  const rx = 104;
  const ry = 44;
  ctx.fillStyle = rgba('#1c3a5c', 0.22 + 0.22 * s1);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(SKYBLUE, 0.12 + 0.2 * s1);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // trench (convergent) along the inner west rim, ridge (divergent) with transform offsets in the east
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.5 * s1);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 14, ry - 9, 0, rad(150), rad(250));
  ctx.stroke();
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(342, 696);
  ctx.lineTo(346, 712);
  ctx.lineTo(352, 712);
  ctx.lineTo(356, 730);
  ctx.lineTo(362, 730);
  ctx.lineTo(366, 752);
  ctx.stroke();
  ctx.setLineDash([]);
  const rim = 22;
  for (let i = 0; i <= rim; i++) {
    const a = rad(150 + (240 * i) / rim);
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    if (i % 2 === 0) {
      ctx.fillStyle = rgba(EMBER, 0.4 + 0.6 * s1);
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x - 5, y + 4);
      ctx.lineTo(x + 5, y + 4);
      ctx.closePath();
      ctx.fill();
      if (s1 > 0.01) glowDot(ctx, x, y, 10, EMBER, 0.4 * s1);
    } else {
      glowDot(ctx, x, y, 6, GOLD, 0.4 + 0.6 * s1);
    }
  }
  // the hot spot: an island chain far from any boundary
  [[276, 730, 6], [289, 724, 4.5], [300, 719, 3.5], [310, 715, 2.5]].forEach(([x, y, r], i) => {
    ctx.fillStyle = rgba(i === 0 ? LAVA : '#8a6d70', 0.5 + 0.5 * s1);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  });
  glowDot(ctx, 276, 730, 14, LAVA, 0.25 + 0.5 * s1);
  label(ctx, 'HOT SPOT', 284, 746, 9, IVORY, 0.4 + 0.5 * s1);
  label(ctx, 'RING OF FIRE', cx, 788, 12, GOLD, 0.45 + 0.55 * s1);

  // ---- test ground: blueprints for the two bridge models
  ctx.save();
  rrect(ctx, 84, 652, 92, 44, 6);
  ctx.fillStyle = rgba('#163a52', 0.25 + 0.25 * s3);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = rgba(MINT, 0.12 + 0.25 * s3);
  ctx.lineWidth = 1;
  for (let x = 84; x <= 176; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 652);
    ctx.lineTo(x, 696);
    ctx.stroke();
  }
  for (let y = 652; y <= 696; y += 8) {
    ctx.beginPath();
    ctx.moveTo(84, y);
    ctx.lineTo(176, y);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(IVORY, 0.35 + 0.5 * s3);
  ctx.lineWidth = 1.6;
  // model A: a truss span
  ctx.beginPath();
  ctx.moveTo(92, 676);
  ctx.lineTo(126, 676);
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(92 + i * 8.5, 676);
    ctx.lineTo(96 + i * 8.5, 667);
    ctx.lineTo(100 + i * 8.5, 676);
  }
  ctx.moveTo(96, 667);
  ctx.lineTo(122, 667);
  ctx.stroke();
  // model B: a deck on rubber bearings
  ctx.beginPath();
  ctx.moveTo(136, 670);
  ctx.lineTo(170, 670);
  ctx.moveTo(142, 670);
  ctx.lineTo(142, 680);
  ctx.moveTo(164, 670);
  ctx.lineTo(164, 680);
  ctx.stroke();
  ctx.fillStyle = rgba(GOLD, 0.35 + 0.5 * s3);
  ctx.fillRect(138, 680, 8, 4);
  ctx.fillRect(160, 680, 8, 4);
  ctx.restore();
  label(ctx, 'A', 109, 686, 9, MINT, 0.5 + 0.5 * s3);
  label(ctx, 'B', 153, 690, 9, MINT, 0.5 + 0.5 * s3);
  label(ctx, 'TEST GROUND', 130, 706, 9, MINT, 0.45 + 0.5 * s3);
  label(ctx, 'SAME TEST,', 130, 720, 8, MINT, 0.3 + 0.6 * s3);
  label(ctx, 'EVERY MODEL', 130, 731, 8, MINT, 0.3 + 0.6 * s3);

  // ---- Bridge Tester label along the ramp lane
  label(ctx, 'BRIDGE TESTER', 404, 736, 11, MINT, 0.55 + 0.4 * s3, rad(-70));

  // ---- hazard map between the slings: risk is estimated as chances, not dates
  ctx.save();
  rrect(ctx, 196, 846, 180, 74, 12);
  ctx.fillStyle = rgba('#120b22', 0.35);
  ctx.fill();
  ctx.clip();
  const hz = 0.18 + 0.4 * s2;
  const bands: [string, number][] = [[MINT, 1], [GOLD, 0.68], [LAVA, 0.4]];
  for (const [c, k] of bands) {
    ctx.fillStyle = rgba(c, hz * (0.55 + 0.45 * (1 - k)));
    ctx.beginPath();
    ctx.ellipse(250, 880, 80 * k, 40 * k, -0.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  label(ctx, 'HAZARD MAP', 330, 868, 11, IVORY, 0.45 + 0.5 * s2);
  label(ctx, 'CHANCES,', 330, 886, 9, GOLD, 0.45 + 0.5 * s2);
  label(ctx, 'NOT DATES', 330, 900, 9, GOLD, 0.45 + 0.5 * s2);

  // ---- Wonderlight: a warm wash over the whole mountain
  if (s4 > 0.01) {
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    neonPath(ctx, () => {
      ctx.beginPath();
      ctx.arc(OBS[0], OBS[1] - 2, 44, Math.PI, TAU);
    }, GOLD, s4, 3);
  }
}

function paintAmbient({ ctx, t, level, reduced, energy }: SceneryContext) {
  const s2 = stage(level, 1.2, 2);
  if (!reduced) {
    // gas drifting up from the crater
    for (let i = 0; i < 5; i++) {
      const ph = (t * 0.12 + i / 5) % 1;
      glowDot(ctx, SUMMIT[0] - 4 + Math.sin(t * 0.6 + i) * 8 + ph * 10, SUMMIT[1] - 10 - ph * 70, 8 + ph * 12, '#d9d2e6', (0.05 + 0.12 * s2) * (1 - ph));
    }
    // a pen dot tracing the seismograph
    const y = 394 + ((t * 40) % 246);
    glowDot(ctx, 523 + Math.sin(t * 40) * (2 + 6 * energy), y, 5, CORAL, 0.25 + 0.5 * s2);
  }
  if (level >= 3.9) aurora(ctx, 0.5, reduced ? 0 : t);
}

function paintCelebrate({ ctx, t }: SceneryContext, p: number) {
  const a = Math.sin(p * Math.PI);
  ctx.save();
  ctx.globalAlpha = a * 0.5;
  const g = ctx.createRadialGradient(OBS[0], OBS[1], 10, OBS[0], OBS[1], 460);
  g.addColorStop(0, rgba(GOLD, 0.85));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.restore();
  for (let k = 0; k < 3; k++) {
    const r = ((p * 1.6 + k / 3) % 1) * 380;
    ctx.strokeStyle = rgba(GOLD, 0.5 * a * (1 - r / 380));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(OBS[0], OBS[1], r, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * TAU + t * 0.4;
    const d = 70 + p * 260;
    glowDot(ctx, OBS[0] + Math.cos(ang) * d, OBS[1] + Math.sin(ang) * d * 0.8, 10, [GOLD, MINT, CORAL][i % 3], 1 - p);
  }
}

// ================================================================ icons (bumper caps, pocket)

function capText(ctx: CanvasRenderingContext2D, s: number, text: string) {
  ctx.fillStyle = '#1a1030';
  ctx.font = `800 ${Math.round(s * 0.5)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, s * 0.52);
}

const ICONS_L25: TableDef['icons'] = {
  sign_quakes(ctx, s) {
    ctx.strokeStyle = '#1a1030';
    ctx.lineWidth = s * 0.1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const pts = [-0.9, -0.62, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.62, 0.9];
    const amp = [0, 0.05, -0.1, 0.45, -0.55, 0.6, -0.4, 0.25, -0.1, 0.05, 0];
    pts.forEach((x, i) => (i ? ctx.lineTo(x * s, -s * 0.22 - amp[i] * s * 0.6) : ctx.moveTo(x * s, -s * 0.22)));
    ctx.stroke();
    capText(ctx, s, 'QUAKES');
  },
  sign_gas(ctx, s) {
    ctx.fillStyle = '#1a1030';
    for (const [x, y, r] of [[-0.32, -0.12, 0.22], [0.02, -0.3, 0.28], [0.34, -0.14, 0.2]]) {
      ctx.beginPath();
      ctx.arc(x * s, y * s, r * s, 0, TAU);
      ctx.fill();
    }
    capText(ctx, s, 'GAS');
  },
  sign_swell(ctx, s) {
    ctx.strokeStyle = '#1a1030';
    ctx.fillStyle = '#1a1030';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, -s * 0.05);
    ctx.quadraticCurveTo(0, -s * 0.75, s * 0.8, -s * 0.05);
    ctx.stroke();
    for (const x of [-0.35, 0.35]) {
      ctx.beginPath();
      ctx.moveTo(x * s, -s * 0.62);
      ctx.lineTo(x * s - s * 0.14, -s * 0.42);
      ctx.lineTo(x * s + s * 0.14, -s * 0.42);
      ctx.closePath();
      ctx.fill();
    }
    capText(ctx, s, 'SWELL');
  },
  observatory(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, s * 0.1, s * 0.7, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-s * 0.75, s * 0.1, s * 1.5, s * 0.5);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(-s * 0.08, -s * 0.6, s * 0.16, s * 0.62);
    ctx.restore();
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

/** Concave stratovolcano with a shallow crater: a flat-shaded lathe with baked vertex colours. */
function volcanoMesh(kit: SetKit, R: number, H: number, seed: number): THREE.Mesh {
  const rTop = R * 0.16;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    prof.push(new THREE.Vector2(R - (R - rTop) * u, H * Math.pow(u, 1.55)));
  }
  prof.push(new THREE.Vector2(rTop * 0.7, H * 0.965));
  prof.push(new THREE.Vector2(0.001, H * 0.955));
  const base = new THREE.LatheGeometry(prof, 30);
  const pa = base.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i);
    const y = pa.getY(i);
    const z = pa.getZ(i);
    const a = Math.atan2(z, x);
    const u = y / H;
    if (u > 0.93 || u < 0.01) continue;
    const k = 1 + 0.08 * Math.sin(a * 5 + seed) * (1 - u) + 0.04 * Math.sin(a * 11 + u * 9 + seed);
    pa.setXYZ(i, x * k, y, z * k);
  }
  const geo = base.toNonIndexed();
  base.dispose();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const cBase = new THREE.Color('#4a3a56');
  const cMid = new THREE.Color('#715668');
  const cTop = new THREE.Color('#987064');
  const cHot = new THREE.Color('#e07a4c');
  const c = new THREE.Color();
  const r = rng(seed * 7 + 1);
  for (let f = 0; f < pos.count; f += 3) {
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const u = cy / H;
    if (u > 0.94) c.copy(cHot);
    else if (u > 0.5) c.copy(cMid).lerp(cTop, (u - 0.5) / 0.44);
    else c.copy(cBase).lerp(cMid, u / 0.5);
    if (Math.sin(u * 34 + seed) > 0.8) c.multiplyScalar(0.84);
    c.multiplyScalar(0.9 + 0.2 * r());
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // glowing fissures near the crater (lathe v runs from the crater (0) down to the base (1))
  const cracks = canvasTex(kit, 256, 256, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 60);
    g.addColorStop(0, 'rgba(255,200,140,1)');
    g.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 60);
    const cr = rng(seed + 40);
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      let x = cr() * 256;
      let y = 34;
      const len = 40 + cr() * 70;
      ctx.lineWidth = 1.5 + cr() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < 34 + len) {
        y += 6;
        x += (cr() - 0.5) * 7;
        ctx.strokeStyle = `rgba(255,150,80,${1 - (y - 34) / len})`;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
  const mat = kit.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, flatShading: true, emissive: LAVA, emissiveMap: cracks, emissiveIntensity: 0.3 }));
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A glowing crater: an emissive rim ring and a soft hot floor. */
function craterGlow(kit: SetKit, at: V3, R: number, H: number) {
  const rTop = R * 0.16;
  const rimMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a1208', emissive: LAVA, emissiveIntensity: 0.5, roughness: 0.6 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rTop * 0.92, rTop * 0.12, 8, 28), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(at[0], at[1] + H * 0.985, at[2]);
  kit.add(rim);
  const floorMat = kit.track(new THREE.MeshStandardMaterial({ color: '#1a0804', emissive: EMBER, emissiveIntensity: 0.3 }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(rTop * 0.78, 20).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(at[0], at[1] + H * 0.96, at[2]);
  kit.add(floor);
  return { rimMat, floorMat };
}

/** A soft additive glow sprite (one point) for halos around hot or lit things. */
function haloPoint(kit: SetKit, at: V3, color: string, size: number) {
  const mat = kit.track(new THREE.PointsMaterial({ color, size, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(at), 3));
  kit.add(new THREE.Points(geo, mat));
  return mat;
}

function wideSign(kit: SetKit, text: string, pos: V3, w: number, h: number, color: string) {
  const tex = canvasTex(kit, 2048, Math.round((2048 * h) / w), (ctx) => {
    const Hh = ctx.canvas.height;
    let size = Math.round(Hh * 0.66);
    ctx.font = `800 ${size}px "Fraunces Variable", Georgia, serif`;
    while (ctx.measureText(text).width > 1900 && size > 20) {
      size -= 4;
      ctx.font = `800 ${size}px "Fraunces Variable", Georgia, serif`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 1024, Hh / 2 + size * 0.04);
  });
  const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveMap: tex, emissiveIntensity: 0.1, alphaMap: tex, transparent: true, depthWrite: false }));
  const g = new THREE.Group();
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  glyph.position.z = 0.05;
  glyph.renderOrder = 3;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, h * 1.3, 0.08), kit.mats.plastic('#1a1030'));
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.05, 0.1), kit.mats.brass());
  trim.position.y = -h * 0.68;
  const trim2 = trim.clone();
  trim2.position.y = h * 0.68;
  g.add(back, glyph, trim, trim2);
  g.position.set(pos[0], pos[1], pos[2]);
  kit.add(g);
  return { g, setLit: (v: number) => (mat.emissiveIntensity = 0.08 + v * 3) };
}

/** Night panorama for the head flat: ranges, the distant volcano, aurora at the Wonderlight. */
function paintPanorama(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const s2 = stage(level, 1.2, 2);
  const s4 = stage(level, 3.2, 4);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a0820');
  g.addColorStop(0.6, '#241a46');
  g.addColorStop(1, '#3a2450');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,247,231,${0.3 + r() * 0.6})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h * 0.7, 0.6 + r() * 1.6, 0, TAU);
    ctx.fill();
  }
  if (s4 > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      for (let x = 0; x < w; x += 4) {
        const y = h * (0.28 + k * 0.06) + Math.sin(x / 90 + k * 1.3) * 26;
        const hh = 70 + 40 * Math.sin(x / 61 + k);
        const gg = ctx.createLinearGradient(0, y - hh, 0, y);
        const c = k % 2 ? VIOLET : MINT;
        gg.addColorStop(0, rgba(c, 0));
        gg.addColorStop(1, rgba(c, 0.18 * s4));
        ctx.fillStyle = gg;
        ctx.fillRect(x, y - hh, 4, hh);
      }
    }
    ctx.restore();
  }
  // ranges
  const ridge = (base: number, amp: number, seed: number, color: string) => {
    const rr = rng(seed);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    let y = base;
    for (let x = 0; x <= w; x += 24) {
      y = base - rr() * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  ridge(h * 0.7, h * 0.22, 3, '#2a2048');
  // the distant twin of Rumble Mountain with a warm crater
  ctx.fillStyle = '#33264c';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h);
  ctx.quadraticCurveTo(w * 0.24, h * 0.62, w * 0.28, h * 0.4);
  ctx.lineTo(w * 0.32, h * 0.4);
  ctx.quadraticCurveTo(w * 0.36, h * 0.62, w * 0.5, h);
  ctx.closePath();
  ctx.fill();
  const cg = ctx.createRadialGradient(w * 0.3, h * 0.4, 2, w * 0.3, h * 0.4, 60);
  cg.addColorStop(0, rgba(EMBER, 0.5 + 0.3 * s2));
  cg.addColorStop(1, rgba(EMBER, 0));
  ctx.fillStyle = cg;
  ctx.fillRect(w * 0.3 - 60, h * 0.4 - 60, 120, 120);
  ridge(h * 0.86, h * 0.14, 9, '#1c1534');
}

const rumbleSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  kit.sky('#2a2160', '#05040c');
  const mtx = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();

  // ---- volcanic plain: dusky violet basalt with pale grit
  const groundTex = canvasTex(kit, 512, 512, (ctx) => {
    ctx.fillStyle = '#3a2b4e';
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(12);
    for (let i = 0; i < 1600; i++) {
      const k = r();
      ctx.fillStyle = k < 0.45 ? `rgba(150,128,170,${0.12 + r() * 0.2})` : k < 0.9 ? `rgba(22,14,34,${0.18 + r() * 0.28})` : `rgba(255,170,110,${0.06 + r() * 0.08})`;
      ctx.beginPath();
      ctx.arc(r() * 512, r() * 512, 1 + r() * 4.5, 0, TAU);
      ctx.fill();
    }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(10, 10);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), kit.track(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9 })));
  ground.position.y = gy;
  ground.receiveShadow = true;
  kit.add(ground);

  // ---- LEFT BACK: Rumble Mountain with a glowing crater, drifting gas and its Ring of Fire lanterns
  const VR = 2.35;
  const VH = 3.0;
  const vAt: V3 = [-6.35, gy - 0.02, -2.15];
  const volcano = volcanoMesh(kit, VR, VH, 3);
  volcano.position.set(vAt[0], vAt[1], vAt[2]);
  kit.add(volcano);
  const volcanoMat = volcano.material as THREE.MeshStandardMaterial;
  const crater = craterGlow(kit, vAt, VR, VH);
  const craterHalo = haloPoint(kit, [vAt[0], vAt[1] + VH * 1.02, vAt[2]], EMBER, 2.6);
  const gas = kit.motes({ x0: vAt[0] - 0.3, x1: vAt[0] + 0.3, y0: vAt[1] + VH, y1: vAt[1] + VH + 2.0, z0: vAt[2] - 0.3, z1: vAt[2] + 0.3 }, 40, '#d6cfe4', { speed: 0.3, size: 0.34 });
  // Ring of Fire survey lanterns around the mountain's foot (light with the first mission)
  const ringN = 13;
  const ringPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6), kit.mats.paintedMetal('#2a2234'), ringN);
  const ringMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: EMBER, emissiveIntensity: 0.1 }));
  const ringLamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 8), ringMat, ringN);
  for (let i = 0; i < ringN; i++) {
    const a = rad(-30 + (210 * i) / (ringN - 1));
    const x = vAt[0] + Math.cos(a) * (VR + 0.35);
    const z = vAt[2] + Math.sin(a) * (VR + 0.35);
    ringPosts.setMatrixAt(i, mtx.makeTranslation(x, gy + 0.21, z));
    ringLamps.setMatrixAt(i, mtx.makeTranslation(x, gy + 0.46, z));
  }
  kit.add(ringPosts);
  kit.add(ringLamps);
  // Wonderlight crown: a slow golden ring above the restored mountain
  const crownMat = kit.track(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 8, 56), crownMat);
  crown.position.set(vAt[0], vAt[1] + VH + 0.75, vAt[2]);
  crown.rotation.x = Math.PI / 2 - 0.3;
  crown.visible = false;
  kit.add(crown);
  const cEmber = new THREE.Color(EMBER);
  const cGold = new THREE.Color(GOLD);
  const mtnSign = kit.neonSign('RUMBLE MOUNTAIN', [-4.75, gy + 0.5, 0.95], { height: 0.24, color: EMBER, rotY: 0.35 });
  mtnSign.rotation.x = -0.55;

  // ---- LEFT FRONT: the Volcano Watch station (seismometer hut, gas sensor, GPS for swelling)
  const st = new THREE.Group();
  const plateau = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.26, 10), kit.mats.plastic('#5a4870'));
  plateau.position.y = 0.13;
  plateau.receiveShadow = true;
  st.add(plateau);
  const top = 0.26;
  const hut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.42), kit.mats.plastic('#e6e0f0'));
  hut.position.set(-0.42, top + 0.18, -0.12);
  hut.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.22, 4), kit.mats.plastic('#c8463c'));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(-0.42, top + 0.47, -0.12);
  const mastGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.018, 0.022, 0.6, 6).translate(-0.27, top + 0.66, -0.22),
    new THREE.CylinderGeometry(0.022, 0.026, 0.9, 6).translate(0.42, top + 0.45, -0.3),
    new THREE.BoxGeometry(0.18, 0.12, 0.14).translate(0.42, top + 0.86, -0.3),
    new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5).rotateZ(0.32).translate(0.06, top + 0.24, 0.42),
    new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5).rotateZ(-0.32).translate(0.22, top + 0.24, 0.42),
    new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5).rotateX(0.32).translate(0.14, top + 0.24, 0.34),
  ]);
  const masts = new THREE.Mesh(mastGeo, kit.mats.paintedMetal('#d8d2e6'));
  const gpsDome = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, TAU, 0, Math.PI / 2), kit.mats.plastic('#f6f2ff'));
  gpsDome.position.set(0.14, top + 0.49, 0.39);
  st.add(hut, roof, masts, gpsDome);
  const lampGeo = new THREE.SphereGeometry(0.05, 12, 8);
  const instLights = SENSORS.map(([, , c], i) => {
    const m = kit.track(new THREE.MeshStandardMaterial({ color: '#1a1020', emissive: c, emissiveIntensity: 0.1 }));
    const s = new THREE.Mesh(lampGeo, m);
    const at = ([[-0.27, top + 0.98, -0.22], [0.42, top + 0.97, -0.3], [0.14, top + 0.63, 0.39]] as V3[])[i];
    s.position.set(at[0], at[1], at[2]);
    st.add(s);
    return m;
  });
  st.position.set(-5.55, gy, 2.35);
  st.rotation.y = 0.4;
  kit.add(st);
  const instSigns = SENSORS.map(([, text, c], i) => {
    const sg = kit.neonSign(text, [-6.15 + i * 0.92, gy + 0.62 + (i === 1 ? 0.08 : 0), 3.7 - i * 0.18], { height: 0.17, color: c, rotY: 0.36 });
    sg.rotation.x = -0.62;
    return sg;
  });

  // ---- RIGHT BACK: the observatory on its hill (turning dome, telescope beam at the Wonderlight)
  const hillMat = kit.track(new THREE.MeshStandardMaterial({ color: '#4c3d62', roughness: 0.9, flatShading: true }));
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1.7, 18, 8, 0, TAU, 0, Math.PI / 2), hillMat);
  hill.scale.set(1.15, 0.5, 1);
  hill.position.set(6.55, gy, -3.95);
  hill.receiveShadow = true;
  kit.add(hill);
  const obsAt: V3 = [6.5, gy + 0.78, -3.8];
  const building = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.76, 0.66, 28), kit.mats.plastic('#ece6f6'));
  building.position.set(obsAt[0], obsAt[1] + 0.33, obsAt[2]);
  building.castShadow = true;
  kit.add(building);
  const winTex = canvasTex(kit, 512, 64, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) ctx.fillRect(i * 42 + 12, 22, 18, 24);
  });
  const winMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a2234', emissive: GOLD, emissiveMap: winTex, emissiveIntensity: 0.1, transparent: true, alphaMap: winTex }));
  const windows = new THREE.Mesh(new THREE.CylinderGeometry(0.715, 0.745, 0.28, 28, 1, true), winMat);
  windows.position.set(obsAt[0], obsAt[1] + 0.36, obsAt[2]);
  kit.add(windows);
  const domeG = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.74, 32, 14, 0.2, TAU - 0.4, 0, Math.PI / 2), kit.mats.paintedMetal('#dfe5f2'));
  dome.castShadow = true;
  const slitMat = kit.track(new THREE.MeshStandardMaterial({ color: '#141020', emissive: GOLD, emissiveIntensity: 0.1, side: THREE.DoubleSide }));
  const slit = new THREE.Mesh(new THREE.SphereGeometry(0.72, 6, 14, -0.2, 0.4, 0, Math.PI / 2), slitMat);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.9, 14), kit.mats.paintedMetal('#2c2a3c'));
  scope.rotation.z = -0.7;
  scope.position.set(0.3, 0.42, 0);
  const beamMat = kit.track(new THREE.MeshBasicMaterial({ color: '#fff0c4', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beamGeo = new THREE.ConeGeometry(0.75, 9, 24, 1, true);
  beamGeo.translate(0, -4.5, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI - 0.7;
  beam.position.set(0.6, 0.7, 0);
  // Sphere segments start at -x; turn the dome so its slit opens where the telescope points (+x).
  dome.rotation.y = Math.PI;
  slit.rotation.y = Math.PI;
  domeG.add(dome, slit, scope, beam);
  domeG.position.set(obsAt[0], obsAt[1] + 0.66, obsAt[2]);
  kit.add(domeG);
  const obsHalo = haloPoint(kit, [obsAt[0], obsAt[1] + 0.5, obsAt[2] + 0.3], GOLD, 3.2);
  const obsSign = kit.neonSign('OBSERVATORY', [7.25, gy + 0.55, -1.75], { height: 0.24, color: MINT, rotY: -0.5 });
  obsSign.rotation.x = -0.55;

  // ---- RIGHT MIDDLE: a seismograph drum turning out its trace
  const seisTex = canvasTex(kit, 512, 128, (ctx) => {
    ctx.fillStyle = '#d9d0c0';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = 'rgba(80,110,160,0.35)';
    for (let y = 16; y < 128; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#b8322c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const r = rng(4);
    for (let x = 0; x <= 512; x += 2) {
      const burst = Math.exp(-((x - 300) ** 2) / 1800) + 0.5 * Math.exp(-((x - 120) ** 2) / 400);
      const y = 64 + (r() - 0.5) * (4 + 90 * burst);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  seisTex.wrapS = THREE.RepeatWrapping;
  const traceTex = canvasTex(kit, 512, 128, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const r = rng(4);
    for (let x = 0; x <= 512; x += 2) {
      const burst = Math.exp(-((x - 300) ** 2) / 1800) + 0.5 * Math.exp(-((x - 120) ** 2) / 400);
      const y = 64 + (r() - 0.5) * (4 + 90 * burst);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  traceTex.wrapS = THREE.RepeatWrapping;
  const seisMat = kit.track(new THREE.MeshStandardMaterial({ map: seisTex, color: '#b8b0a4', emissive: CORAL, emissiveMap: traceTex, emissiveIntensity: 0.05, roughness: 0.7 }));
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.72, 28, 1, true), seisMat);
  drum.rotation.z = Math.PI / 2;
  const caps = new THREE.Mesh(mergeGeometries([
    new THREE.CylinderGeometry(0.31, 0.31, 0.03, 24).rotateZ(Math.PI / 2).translate(-0.37, 0.96, 0),
    new THREE.CylinderGeometry(0.31, 0.31, 0.03, 24).rotateZ(Math.PI / 2).translate(0.37, 0.96, 0),
  ]), kit.mats.brass());
  const seis = new THREE.Group();
  const deskGeo = mergeGeometries([
    new THREE.BoxGeometry(1.0, 0.08, 0.62).translate(0, 0.62, 0),
    new THREE.BoxGeometry(0.06, 0.62, 0.06).translate(-0.42, 0.31, -0.25),
    new THREE.BoxGeometry(0.06, 0.62, 0.06).translate(0.42, 0.31, -0.25),
    new THREE.BoxGeometry(0.06, 0.62, 0.06).translate(-0.42, 0.31, 0.25),
    new THREE.BoxGeometry(0.06, 0.62, 0.06).translate(0.42, 0.31, 0.25),
    new THREE.BoxGeometry(0.05, 0.38, 0.05).translate(-0.4, 0.85, 0),
    new THREE.BoxGeometry(0.05, 0.38, 0.05).translate(0.4, 0.85, 0),
  ]);
  const desk = new THREE.Mesh(deskGeo, kit.mats.paintedMetal('#6b4a3a'));
  drum.position.set(0, 0.96, 0);
  const pen = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.44), kit.mats.brass());
  pen.position.set(0, 1.08, 0.42);
  seis.add(desk, drum, caps, pen);
  seis.position.set(4.55, gy, -2.35);
  seis.rotation.y = -0.15;
  kit.add(seis);

  // ---- RIGHT FRONT: the resilient crossing, a suspension bridge over Rumble Gorge
  const BZ = 1.15;
  const xA = 4.0;
  const xB = 7.7;
  const t1 = 4.75;
  const t2 = 6.95;
  const deckY = gy + 0.72;
  const towerTop = deckY + 1.25;
  const gorgeTex = canvasTex(kit, 128, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(20,12,30,0)');
    g.addColorStop(0.25, 'rgba(20,12,30,0.85)');
    g.addColorStop(0.75, 'rgba(20,12,30,0.85)');
    g.addColorStop(1, 'rgba(20,12,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 512);
    ctx.globalCompositeOperation = 'destination-in';
    const e = ctx.createLinearGradient(0, 0, 0, 512);
    e.addColorStop(0, 'rgba(0,0,0,0)');
    e.addColorStop(0.12, 'rgba(0,0,0,1)');
    e.addColorStop(0.88, 'rgba(0,0,0,1)');
    e.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = e;
    ctx.fillRect(0, 0, 128, 512);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(40,96,140,0.95)';
    ctx.beginPath();
    ctx.moveTo(56, 0);
    for (let y = 0; y <= 512; y += 16) ctx.lineTo(56 + Math.sin(y / 60) * 6, y);
    for (let y = 512; y >= 0; y -= 16) ctx.lineTo(72 + Math.sin(y / 60) * 6, y);
    ctx.closePath();
    ctx.fill();
    const r = rng(9);
    for (let i = 0; i < 60; i++) {
      const y = r() * 512;
      ctx.fillStyle = `rgba(200,240,255,${0.2 + r() * 0.4})`;
      ctx.fillRect(58 + Math.sin(y / 60) * 6 + r() * 10, y, 1.5, 6 + r() * 14);
    }
    ctx.globalCompositeOperation = 'source-over';
  });
  const riverMat = kit.track(new THREE.MeshStandardMaterial({ map: gorgeTex, transparent: true, depthWrite: false, emissive: '#3aa8e0', emissiveMap: gorgeTex, emissiveIntensity: 0.05, roughness: 0.5 }));
  const gorge = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 6.6).rotateX(-Math.PI / 2), riverMat);
  gorge.position.set((t1 + t2) / 2, gy + 0.008, BZ - 0.2);
  kit.add(gorge);
  const abutMat = kit.track(new THREE.MeshStandardMaterial({ color: '#5a4a6e', roughness: 0.9, flatShading: true }));
  for (const [x, s] of [[xA + 0.15, 1], [xB - 0.1, 1.1]] as [number, number][]) {
    const ab = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62 * s, 0), abutMat);
    ab.scale.set(1.15, (deckY - gy + 0.05) / (0.62 * s), 1.2);
    ab.position.set(x, gy, BZ);
    ab.castShadow = true;
    kit.add(ab);
  }
  const steel = kit.mats.paintedMetal('#a9bfd6');
  const deckGeo = mergeGeometries([
    new THREE.BoxGeometry(xB - xA, 0.07, 0.5).translate((xA + xB) / 2, deckY, BZ),
    new THREE.BoxGeometry(xB - xA, 0.03, 0.03).translate((xA + xB) / 2, deckY + 0.14, BZ - 0.24),
    new THREE.BoxGeometry(xB - xA, 0.03, 0.03).translate((xA + xB) / 2, deckY + 0.14, BZ + 0.24),
  ]);
  const deck = new THREE.Mesh(deckGeo, steel);
  deck.castShadow = true;
  kit.add(deck);
  const towerParts: THREE.BufferGeometry[] = [];
  for (const tx of [t1, t2]) {
    for (const dz of [-0.28, 0.28]) towerParts.push(new THREE.BoxGeometry(0.11, towerTop - gy + 0.05, 0.11).translate(tx, (towerTop + gy) / 2, BZ + dz));
    towerParts.push(new THREE.BoxGeometry(0.11, 0.09, 0.68).translate(tx, towerTop - 0.06, BZ));
    towerParts.push(new THREE.BoxGeometry(0.11, 0.09, 0.68).translate(tx, deckY + 0.6, BZ));
  }
  const towers = new THREE.Mesh(mergeGeometries(towerParts), kit.mats.paintedMetal('#d24a3e'));
  towers.castShadow = true;
  kit.add(towers);
  towerParts.forEach((g) => g.dispose());
  // rubber base isolators where the deck rests on each tower (a real earthquake-resistant detail)
  const pads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12), kit.mats.rubber('#2a2430'), 4);
  [[t1, -0.15], [t1, 0.15], [t2, -0.15], [t2, 0.15]].forEach(([x, dz], i) => pads.setMatrixAt(i, mtx.makeTranslation(x, deckY - 0.075, BZ + dz)));
  kit.add(pads);
  // side-span cables (anchors to towers) and the lit main cables (tower to tower)
  const sideCables: THREE.BufferGeometry[] = [];
  for (const dz of [-0.28, 0.28]) {
    for (const [a, bx] of [[xA + 0.05, t1], [xB - 0.05, t2]] as [number, number][]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(a, deckY + 0.08, BZ + dz), new THREE.Vector3((a + bx) / 2, (deckY + towerTop) / 2 - 0.1, BZ + dz), new THREE.Vector3(bx, towerTop, BZ + dz)]);
      sideCables.push(new THREE.TubeGeometry(curve, 12, 0.016, 5));
    }
  }
  kit.add(new THREE.Mesh(mergeGeometries(sideCables), kit.mats.paintedMetal('#e2dcee')));
  sideCables.forEach((g) => g.dispose());
  const sag = towerTop - (deckY + 0.4);
  const cableA = kit.stringLights([t1, towerTop + 0.06, BZ - 0.28], [t2, towerTop + 0.06, BZ - 0.28], sag, kit.n(14), [GOLD, MINT]);
  const cableB = kit.stringLights([t1, towerTop + 0.06, BZ + 0.28], [t2, towerTop + 0.06, BZ + 0.28], sag, kit.n(14), [MINT, GOLD]);
  const nH = 8;
  const hangers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 4), kit.mats.paintedMetal('#e2dcee'), nH * 2);
  let hk = 0;
  for (const dz of [-0.28, 0.28]) {
    for (let i = 1; i <= nH; i++) {
      const u = i / (nH + 1);
      const yc = towerTop - Math.sin(u * Math.PI) * sag;
      const len = yc - deckY;
      hangers.setMatrixAt(hk++, mtx.compose(new THREE.Vector3(t1 + (t2 - t1) * u, deckY + len / 2, BZ + dz), q0, new THREE.Vector3(1, len, 1)));
    }
  }
  kit.add(hangers);
  // deck lamps in two alternating sets so a wave of light can run across the span
  const deckLamps = [GOLD, IVORY].map((c, k) => {
    const n = kit.n(9);
    const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#221a20', emissive: c, emissiveIntensity: 0.05 }));
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), mat, n * 2);
    let j = 0;
    for (let i = 0; i < n; i++) {
      const x = xA + 0.2 + ((xB - xA - 0.4) * (i * 2 + k)) / (n * 2 - 1);
      for (const dz of [-0.24, 0.24]) inst.setMatrixAt(j++, mtx.makeTranslation(x, deckY + 0.19, BZ + dz));
    }
    kit.add(inst);
    return mat;
  });
  const bridgeSign = kit.neonSign('RESILIENT CROSSING', [5.95, gy + 0.42, 2.85], { height: 0.22, color: GOLD, rotY: -0.3 });
  bridgeSign.rotation.x = -0.65;

  // ---- the shake table: models A and B wait for the very same test
  const shake = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.62), kit.mats.paintedMetal('#46607a'));
  table.position.y = 0.05;
  const legGeo = mergeGeometries([[-0.42, -0.24], [0.42, -0.24], [-0.42, 0.24], [0.42, 0.24]].map(([x, z]) => new THREE.BoxGeometry(0.05, 0.36, 0.05).translate(x, -0.18, z)));
  const legs = new THREE.Mesh(legGeo, kit.mats.paintedMetal('#2c3646'));
  const modelA = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(0.36, 0.03, 0.14).translate(-0.22, 0.24, 0),
    new THREE.BoxGeometry(0.03, 0.14, 0.14).translate(-0.38, 0.17, 0),
    new THREE.BoxGeometry(0.03, 0.14, 0.14).translate(-0.06, 0.17, 0),
    new THREE.BoxGeometry(0.22, 0.025, 0.025).rotateZ(0.62).translate(-0.27, 0.18, 0.06),
    new THREE.BoxGeometry(0.22, 0.025, 0.025).rotateZ(-0.62).translate(-0.17, 0.18, 0.06),
  ]), kit.mats.paintedMetal(CORAL));
  const modelB = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(0.36, 0.03, 0.14).translate(0.22, 0.25, 0),
    new THREE.BoxGeometry(0.05, 0.08, 0.12).translate(0.08, 0.17, 0),
    new THREE.BoxGeometry(0.05, 0.08, 0.12).translate(0.36, 0.17, 0),
  ]), kit.mats.paintedMetal(MINT));
  shake.add(table, legs, modelA, modelB);
  const shakeAt: V3 = [4.55, gy + 0.36, 3.35];
  shake.position.set(shakeAt[0], shakeAt[1], shakeAt[2]);
  shake.rotation.y = -0.25;
  kit.add(shake);
  const modelLamp = kit.track(new THREE.MeshStandardMaterial({ color: '#1a1020', emissive: MINT, emissiveIntensity: 0.1 }));
  const modelGlow = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.025, 0.025), modelLamp);
  modelGlow.position.set(0, 0.06, 0.32);
  shake.add(modelGlow);

  // ---- mountain pines and boulders
  const pineN = kit.n(16);
  const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.8, 7), kit.mats.plastic('#2c5a4a'), pineN);
  const pr = rng(21);
  for (let i = 0; i < pineN; i++) {
    const left = i % 2 === 0;
    const x = left ? -8.6 + pr() * 1.6 : 8.0 + pr() * 1.6;
    const z = left ? -0.2 + pr() * 2.2 : -3 + pr() * 6;
    const s = 0.7 + pr() * 0.7;
    pines.setMatrixAt(i, mtx.compose(new THREE.Vector3(x, gy + 0.4 * s, z), q0, new THREE.Vector3(s, s, s)));
  }
  pines.castShadow = true;
  kit.add(pines);
  const boulders = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 0), kit.mats.paintedMetal('#5a4a6a'), kit.n(12));
  const br = rng(33);
  for (let i = 0; i < boulders.count; i++) {
    const x = (i % 2 ? 1 : -1) * (4 + br() * 4);
    const z = -0.5 + br() * 5.5;
    const s = 0.5 + br() * 1.1;
    boulders.setMatrixAt(i, mtx.compose(new THREE.Vector3(x, gy + 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(br(), br() * 3, br())), new THREE.Vector3(s, s * 0.7, s)));
  }
  kit.add(boulders);

  // ---- head: painted panorama and marquee (seen on the fly-in)
  const pano = kit.backdrop(paintPanorama, { width: 26, height: 10, z: -15, y: 3.8 });
  const marquee = wideSign(kit, 'RUMBLE MOUNTAIN RESCUE', [0, 1.3, -7.2], 5.4, 0.6, EMBER);
  marquee.g.rotation.x = -0.72;

  // ---- Wonderlight: aurora ribbons, fireworks over the mountain and the crossing, golden motes
  const auroraTex = canvasTex(kit, 256, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(180,140,255,0)');
    g.addColorStop(0.45, 'rgba(150,120,255,0.55)');
    g.addColorStop(0.85, 'rgba(113,227,207,0.9)');
    g.addColorStop(1, 'rgba(113,227,207,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  });
  const auroraMat = kit.track(new THREE.MeshBasicMaterial({ map: auroraTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  // Low in the top corners, behind the mountain and the observatory, and clear of the rails.
  const curtains = [-1, 1].map((side) => {
    const geo = new THREE.PlaneGeometry(5.0, 1.6, 40, 1);
    const m = new THREE.Mesh(geo, auroraMat);
    m.position.set(side * 6.7, 2.15, -5.3);
    m.rotation.set(-0.2, side * -0.3, 0);
    m.visible = false;
    kit.add(m);
    return { m, base: (geo.attributes.position as THREE.BufferAttribute).clone(), side };
  });
  // Burst centres sit far enough out that a full 2.2-unit burst never reaches over the rails.
  const fwL = kit.fireworks({ x0: -7.8, x1: -6.0, y0: 1.7, y1: 2.3, z: 0.2 }, [GOLD, EMBER, MINT, VIOLET]);
  const fwR = kit.fireworks({ x0: 6.0, x1: 7.8, y0: 1.8, y1: 2.4, z: -0.8 }, [GOLD, MINT, CORAL, IVORY]);
  const gold = kit.motes({ x0: -9, x1: 9, y0: 0, y1: 4, z0: -7, z1: 6 }, 90, GOLD, { speed: 0.1, size: 0.09 });

  // ---- lights (three): lava-warm on the mountain, cool moonlight on the crossing, Wonderlight glow
  kit.spot([-3.4, 6.5, 3], [-6.2, 0.9, -1.8], '#ffb48a', 34, 0.62);
  kit.spot([3.8, 7, 5.5], [5.9, 0.4, -0.6], '#c4d8ff', 32, 0.66);
  const glow = kit.point([0, 3.2, 6.5], GOLD, 0, 16);

  let domeAngle = 0;
  let scroll = 0;
  let boost = 0;
  return {
    update(t, dt, level, energy) {
      const s1 = kit.stage(level, 0.2, 1);
      const s2 = kit.stage(level, 1.2, 2);
      const s3 = kit.stage(level, 2.2, 3);
      const s4 = kit.stage(level, 3.2, 4);
      const motion = !kit.reducedMotion;
      const cel = Math.max(s4, boost);
      pano.repaint(level);
      marquee.setLit(0.15 + 0.85 * kit.stage(level, 0.4, 1.6));
      // Rumble Mountain: a warm, watched glow (never an eruption)
      const flick = motion ? 0.08 * Math.sin(t * 3.1) + 0.05 * Math.sin(t * 7.3) : 0;
      crater.rimMat.emissiveIntensity = 0.6 + 0.6 * s1 + 0.9 * s2 + flick + 0.3 * energy;
      crater.floorMat.emissiveIntensity = 0.4 + 0.5 * s2 + flick;
      volcanoMat.emissiveIntensity = 0.35 + 0.35 * s1 + 0.6 * s2 + flick;
      craterHalo.opacity = 0.22 + 0.15 * s1 + 0.25 * s2;
      gas.setLit(0.08 + 0.32 * s2);
      mtnSign.setLit(0.2 + 0.8 * s1);
      // mission 1: the Ring of Fire lanterns light around the mountain (gold pulses at the Wonderlight)
      ringMat.emissive.copy(cel > 0.5 ? cGold : cEmber);
      ringMat.emissiveIntensity = 0.35 + 2.2 * s1 + (motion ? 0.8 * cel * (0.5 + 0.5 * Math.sin(t * 3)) : 0);
      // mission 2: the volcano-watch instruments wake and blink
      for (let i = 0; i < instLights.length; i++) {
        const blink = motion ? 0.5 + 0.5 * Math.sin(t * (2 + i * 0.7) + i * 2) : 1;
        instLights[i].emissiveIntensity = 0.1 + (0.5 + 2.4 * blink) * s2;
        instSigns[i].setLit(0.12 + 0.88 * s2);
      }
      // observatory: lights on after the survey; the dome turns and its slit glows with the sensors
      winMat.emissiveIntensity = 0.1 + 0.8 * s1 + 1.2 * s2;
      slitMat.emissiveIntensity = 0.1 + 1.8 * s2;
      obsHalo.opacity = 0.05 + 0.15 * s2 + 0.3 * cel;
      obsSign.setLit(0.15 + 0.85 * Math.max(s1 * 0.6, s2));
      // The dome sweeps back and forth across the outer sky (-1.1..0.3 rad), so the telescope
      // beam always points away from the playfield and the slit swings round toward the player.
      if (motion) domeAngle += dt * (0.05 + 0.25 * s2 + 0.35 * cel);
      domeG.rotation.y = -0.4 + 0.7 * Math.sin(domeAngle);
      beamMat.opacity = 0.04 * s2 + 0.2 * cel;
      // seismograph: the drum turns and the pen trembles with the action
      seisMat.emissiveIntensity = 0.05 + 2.2 * s2;
      if (motion) scroll += dt * (0.02 + 0.12 * s2);
      seisTex.offset.x = scroll;
      traceTex.offset.x = scroll;
      pen.position.x = motion ? Math.sin(t * 31) * 0.02 * (0.2 + energy) : 0;
      // mission 3: the crossing lights up; at the Wonderlight a wave of lamps runs across it
      const wave = motion ? 0.5 + 0.5 * Math.sin(t * 4) : 0.5;
      const chase = cel > 0.01;
      deckLamps[0].emissiveIntensity = 0.05 + 2.4 * s3 * (chase ? wave : 1);
      deckLamps[1].emissiveIntensity = 0.05 + 2.4 * s3 * (chase ? 1 - wave : 1);
      cableA.setLit(0.08 + 0.92 * s3);
      cableB.setLit(0.08 + 0.92 * s3);
      bridgeSign.setLit(0.12 + 0.88 * s3);
      modelLamp.emissiveIntensity = 0.1 + 2.2 * s3;
      riverMat.emissiveIntensity = 0.05 + 0.25 * s3 + 0.3 * s4;
      shake.position.x = shakeAt[0] + (motion ? Math.sin(t * 19) * 0.014 * boost : 0);
      // level 4: aurora, fireworks, golden motes and the Wonderlight glow
      auroraMat.opacity = 0.8 * cel;
      for (let k = 0; k < curtains.length; k++) {
        const c = curtains[k];
        c.m.visible = cel > 0.01;
        if (!c.m.visible || !motion) continue;
        const p = c.m.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) {
          const x = c.base.getX(i);
          p.setZ(i, Math.sin(x * 0.9 + t * 0.6 * c.side) * 0.45);
          p.setY(i, c.base.getY(i) + Math.sin(x * 1.7 + t * 0.9) * 0.12);
        }
        p.needsUpdate = true;
      }
      crown.visible = cel > 0.01;
      crownMat.opacity = 0.85 * cel;
      if (motion) crown.rotation.z += dt * 0.4;
      crown.scale.setScalar(1 + (motion ? 0.06 * Math.sin(t * 2) : 0));
      fwL.setLit(cel);
      fwR.setLit(cel);
      gold.setLit(0.05 + 0.75 * s4);
      if (glow) glow.intensity = 6 * s4 + 1.5 * s2;
      boost = Math.max(0, boost - dt * 0.6);
    },
    celebrate(p) {
      boost = Math.max(boost, Math.sin(p * Math.PI));
      gold.setLit(0.4 + 0.6 * Math.sin(p * Math.PI));
    },
  };
};

// ================================================================ dollhouse room

const rumbleRoom: RoomBuilder = ({ kit }) => {
  const mtx = new THREE.Matrix4();
  // Rumble Mountain with its crater and gas
  const v = volcanoMesh(kit, 0.5, 0.8, 5);
  v.position.set(-0.55, 0, -0.4);
  kit.add(v);
  const vMat = v.material as THREE.MeshStandardMaterial;
  const craterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a0d06', emissive: LAVA, emissiveIntensity: 0.3 }));
  const crater = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16).rotateX(-Math.PI / 2), craterMat);
  crater.position.set(-0.55, 0.77, -0.4);
  kit.add(crater);
  const gas = kit.motes({ x0: -0.62, x1: -0.48, y0: 0.8, y1: 1.4, z0: -0.47, z1: -0.33 }, 18, '#d6cfe4', { speed: 0.2, size: 0.07 });
  // Ring of Fire lanterns around its foot
  const ringMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: EMBER, emissiveIntensity: 0.1 }));
  const ring = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), ringMat, 9);
  for (let i = 0; i < 9; i++) {
    const a = rad(-20 + (200 * i) / 8);
    ring.setMatrixAt(i, mtx.makeTranslation(-0.55 + Math.cos(a) * 0.6, 0.05, -0.4 + Math.sin(a) * 0.6));
  }
  kit.add(ring);
  // the observatory on the right
  const building = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.2, 20), kit.mats.plastic('#e4dcef'));
  building.position.set(0.68, 0.1, -0.5);
  kit.add(building);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 10, 0.2, TAU - 0.4, 0, Math.PI / 2), kit.mats.paintedMetal('#cfd6e6'));
  dome.position.set(0.68, 0.2, -0.5);
  kit.add(dome);
  const slitMat = kit.track(new THREE.MeshStandardMaterial({ color: '#141020', emissive: GOLD, emissiveIntensity: 0.1, side: THREE.DoubleSide }));
  const slit = new THREE.Mesh(new THREE.SphereGeometry(0.175, 4, 10, -0.2, 0.4, 0, Math.PI / 2), slitMat);
  slit.position.copy(dome.position);
  kit.add(slit);
  // the resilient crossing in front
  const deckY = 0.2;
  const z = 0.45;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.025, 0.12), kit.mats.paintedMetal('#a9bfd6'));
  deck.position.set(0.12, deckY, z);
  kit.add(deck);
  const tx = [-0.12, 0.36];
  const towers = new THREE.Mesh(mergeGeometries(tx.flatMap((x) => [
    new THREE.BoxGeometry(0.025, 0.5, 0.025).translate(x, 0.25, z - 0.06),
    new THREE.BoxGeometry(0.025, 0.5, 0.025).translate(x, 0.25, z + 0.06),
    new THREE.BoxGeometry(0.025, 0.025, 0.15).translate(x, 0.49, z),
  ])), kit.mats.paintedMetal('#d24a3e'));
  kit.add(towers);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    pts.push(new THREE.Vector3(tx[0] + (tx[1] - tx[0]) * u, 0.5 - Math.sin(u * Math.PI) * 0.22, z));
  }
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.005, 4), kit.mats.paintedMetal('#e2dcee'));
  kit.add(cable);
  const bulbMat = kit.track(new THREE.MeshStandardMaterial({ color: '#221a20', emissive: GOLD, emissiveIntensity: 0.1 }));
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 8, 6), bulbMat, 7);
  for (let i = 0; i < 7; i++) bulbs.setMatrixAt(i, mtx.makeTranslation(pts[(i + 1) * 2].x, pts[(i + 1) * 2].y - 0.012, z));
  kit.add(bulbs);
  const sky = kit.orb([0.05, 1.38, -0.72], 0.07, IVORY);
  return {
    update(t, lit) {
      const flick = kit.reducedMotion ? 0 : 0.15 * Math.sin(t * 3);
      craterMat.emissiveIntensity = 0.3 + 1.8 * lit + flick;
      vMat.emissiveIntensity = 0.25 + 0.8 * lit;
      gas.setLit(0.1 + 0.5 * lit);
      ringMat.emissiveIntensity = 0.1 + 2.4 * lit;
      slitMat.emissiveIntensity = 0.1 + 2 * lit;
      bulbMat.emissiveIntensity = 0.1 + 2.6 * lit;
      sky.setLit(lit);
      dome.rotation.y = kit.reducedMotion ? 0 : t * 0.2;
      slit.rotation.y = dome.rotation.y;
    },
  };
};

// ================================================================ the attraction

export const L25: TableDef = {
  lessonId: 'L25',
  signature: 'The Bridge Tester: every bridge model crosses Rumble Valley under the very same test',
  ballRole: 'The Wonderball is only a game token, not a rock or a blob of magma: real magma is melted rock beneath the surface, and real earthquakes come from rock suddenly slipping along faults.',
  theme: {
    bg: ['#2b1d44', '#140e26'],
    rail: '#dccbd8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: '#FF8A4C',
    accent2: MINT,
    bumperCap: '#ffd3a8',
    bumperRing: '#4a2a40',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(170,205,235,0.2)',
    trail: '#9ff0e0',
  },
  lines: {
    intro: "Welcome to Rumble Mountain, where the observatory never sleeps! Let's map where the ground rumbles, read the volcano's warning signs and test a crossing that can take a shake.",
    quark: '"If we watch the ground closely enough, surely we can name the exact day of the next big earthquake," Professor Quark wonders aloud.',
    pipTip: 'Pull the plunger back about a third of the way: a soft launch drops onto the EPICENTER for a skill bonus.',
  },
  build,
  skillShot: 'epicenter',
  shots: [
    { id: 'ring', label: 'Ring of Fire orbit', on: [{ type: 'shot', id: ['ring_sw_r', 'ring_sw_l'] }], insert: 'ins_ring' },
    { id: 'bridge', label: 'Bridge Tester', on: [{ type: 'ramp', id: 'bridge' }], insert: 'ins_bridge' },
    { id: 'vent', label: 'Magma Vent', on: [{ type: 'saucer', id: 'vent' }], insert: 'ins_vent' },
    { id: 'obs', label: 'Observatory', on: [{ type: 'saucer', id: 'observatory' }], insert: 'ins_obs' },
    { id: 'plates', label: 'Boundary markers', on: [{ type: 'target', group: 'plates' }], insert: 'ins_plates' },
    { id: 'modelA', label: 'Model A', on: [{ type: 'target', id: 'model_a' }], insert: 'ins_models' },
    { id: 'modelB', label: 'Model B', on: [{ type: 'target', id: 'model_b' }], insert: 'ins_models' },
    { id: 'signs', label: 'Volcano-watch sensors', on: [{ type: 'bumper', group: 'signs' }], insert: 'ins_signs' },
    { id: 'seismo', label: 'Seismograph', on: [{ type: 'spinner', id: 'seismo' }], insert: 'ins_ring' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Ring of Fire Survey',
      brief: 'Survey the three kinds of plate boundary, then trace the Ring of Fire to see where volcanoes and quakes gather.',
      objectiveIds: ['L25-O1'],
      stages: [
        { kind: 'collect', text: 'Survey 3 plate boundaries: hit every boundary marker', match: { type: 'target', group: 'plates' }, count: 3, distinct: true, lamps: ['convergent', 'divergent', 'transform'], preview: ['plates'] },
        { kind: 'shots', text: 'Trace the Ring of Fire orbit', shots: ['ring'] },
        { kind: 'discover', text: 'Shoot the Observatory to map the pattern', pocket: 'observatory', questions: 1 },
      ],
      discovery: 'Most volcanoes and earthquakes gather in belts along plate boundaries, like the Ring of Fire around the Pacific. Hot spots such as Hawaii, and faults inside plates, are important exceptions.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Read the Restless Mountain',
      brief: "Read the volcano's three sensors, then compare rising magma in the Magma Vent with a locked fault on the Seismograph.",
      objectiveIds: ['L25-O2', 'L25-O3'],
      stages: [
        { kind: 'collect', text: 'Read the sensors: pop QUAKES, GAS and SWELL', match: { type: 'bumper', group: 'signs' }, count: 3, distinct: true, lamps: ['sensor_quakes', 'sensor_gas', 'sensor_swell'], preview: ['signs'] },
        { kind: 'shots', text: 'Magma vs. fault: Magma Vent and the Seismograph', shots: ['vent', 'seismo'] },
        { kind: 'discover', text: 'Shoot the Observatory to compare the evidence', pocket: 'observatory', questions: 1, types: ['order', 'classify'] },
      ],
      discovery: 'Rising magma cracks rock, lets out gas and swells the ground, so an eruption can be forecast as more likely. No reliable warning sign is known before a fault slips, so quake risk is estimated as chances over years.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Bridge Test Day',
      brief: 'Load each bridge model on the test ground, then give both the very same shake test on the Bridge Tester.',
      objectiveIds: ['L25-O4'],
      stages: [
        { kind: 'shots', text: 'Model A: hit it, then ride the Bridge Tester', shots: ['modelA', 'bridge'], order: 'sequence' },
        { kind: 'shots', text: 'Same test for Model B: hit it, then the Bridge Tester', shots: ['modelB', 'bridge'], order: 'sequence' },
        { kind: 'discover', text: 'Shoot the Observatory to choose a design', pocket: 'observatory', questions: 1, types: ['classify', 'match'] },
      ],
      discovery: 'A fair test gives every design the same shaking. Engineers pick the one that meets the criteria within the constraints, and important bridges must keep working after strong, rare quakes.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'The Resilient Crossing',
    brief: 'Run the final survey across the Bridge Tester, the Ring of Fire and the Magma Vent, then report to the Observatory.',
    stages: [
      { kind: 'shots', text: 'Final survey: Bridge Tester, Ring of Fire, Magma Vent', shots: ['bridge', 'ring', 'vent'], order: 'any' },
      { kind: 'discover', text: 'Bring the Wonderball home to the Observatory', pocket: 'observatory', questions: 2 },
    ],
    celebration: "Forecast eruptions from warning signs, estimate quake chances over years, and build to match the risk. The crossing holds and Rumble Mountain's Wonderlight shines!",
  },
  set: rumbleSet,
  room: rumbleRoom,
  icons: ICONS_L25,
  scenery: {
    backdrop({ ctx, level }) {
      paintPlayfield(ctx, level);
    },
    ambient: paintAmbient,
    celebrate: paintCelebrate,
  },
};
export default L25;
