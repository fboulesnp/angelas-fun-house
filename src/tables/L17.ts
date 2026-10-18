// Lesson 17 — The Rock Cycle — "Rock-Cycle Rollercoaster"
// A twilight mountain coaster park printed as a geological cross-section. Two coaster ramps
// climb twin peaks: the Sediment Slide (left, deposition) and the Pressure Plunge (right, heat
// and pressure). Each is shot from the opposite flipper and ends at a brake station (the Delta,
// the Vise) that sets the ball down gently on the other flipper, so the two tracks chain into a
// figure-eight. The Wind & Rain Loop weathers rock and returns to the Delta; a marked Magma
// portal melts a sample and erupts it from the volcano crater into the Crystal Cavern, where it
// cools. Every mission ends at the Sample Station in the volcano's base. Signature: any rock can
// ride any track, in any order.

import type * as THREE from 'three';
import { FRAME, type TableBuilder, type Pt } from '../game/table/builder.ts';
import { Diverter, Portal, Rollover, smoothPath } from '../game/table/mechanisms.ts';
import type { Ball } from '../game/physics/ball.ts';
import type { Collider } from '../game/physics/types.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { TAU, drift, glowDot, mix, neonPath, neonText, plaque, rgba, rng, stage, stars, vgrad } from '../game/render/art.ts';

const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const MAGMA = '#FF5A1F';
const LAVA = '#FFB23A';
const SAND = '#D9A86C';
const SLATE = '#A99CC0';
const BASALT = '#2B2232';
const RIVER = '#3FB6C8';

/** Sedimentary bands (oldest at the bottom), shared by the printed strata, hoodoos and samples. */
const SED_BANDS = ['#C98A52', '#A8644A', '#DCB57A', '#8A5A4C', '#E2C890', '#B97A50'];
/** Metamorphic banding: dark and light minerals squeezed into wavy stripes (gneiss). */
const MET_BANDS = ['#4A3F62', '#B9AED0', '#6C5C88', '#DCD3EA', '#584A74'];

// ---------------------------------------------------------------- playfield geometry

/** Sediment Slide (left coaster): climbs the west peak, then bunny-hops down into the left inlane. */
const SLIDE_PATH: Pt[] = [
  [192, 612], [156, 500], [146, 420], [140, 340], [124, 270], [92, 236], [60, 250], [48, 310],
  [50, 380], [52, 440], [44, 510], [54, 580], [48, 660], [62, 740], [83, 806],
];
/** Pressure Plunge (right coaster): climbs the east peak and dives down the far right. */
const PLUNGE_PATH: Pt[] = [
  [380, 612], [416, 500], [426, 420], [432, 340], [448, 270], [480, 236], [512, 250], [524, 310],
  [524, 380], [524, 460], [522, 600], [510, 720], [489, 806],
];
/** The volcano wall: a steep cone with the Sample Station tucked into a notch in its base. */
const VOLCANO: Pt[] = [[260, 436], [244, 436], [286, 296], [328, 436], [312, 436], [312, 404], [286, 392], [260, 404], [260, 436]];
const STATION: Pt = [286, 420];
// The crater sits just above the cone's tip, low enough that its COOL floor label clears the
// mica bumper.
const CRATER: Pt = [286, 272];
const PORTAL_AT: Pt = [521, 540];

/** Magma portal that remembers which sample just erupted from the crater. */
class MagmaPortal extends Portal {
  readonly erupted = new Map<number, number>();
  update(dt: number) {
    if (!this.transit.length) {
      super.update(dt);
      return;
    }
    const a = this.transit[0]?.ball;
    const b = this.transit[1]?.ball;
    super.update(dt);
    if (a && !this.inTransit(a)) this.erupted.set(a.id, this.rt.time);
    if (b && !this.inTransit(b)) this.erupted.set(b.id, this.rt.time);
  }
  private inTransit(ball: Ball) {
    for (let i = 0; i < this.transit.length; i++) if (this.transit[i].ball === ball) return true;
    return false;
  }
}

/** The crater switch counts COOLING only for a sample that has just erupted as melted rock. */
class Crater extends Rollover {
  portal: MagmaPortal | null = null;
  onSensorEnter(c: Collider, ball: Ball) {
    const t = this.portal?.erupted.get(ball.id);
    if (t === undefined || this.rt.time - t > 1.5) return;
    this.portal!.erupted.delete(ball.id);
    super.onSensorEnter(c, ball);
  }
}

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Wind & Rain Loop (left orbit): WEATHERING. Rain-fed river channel with a return guide. ---
  b.wall([[76, 630], [76, 392]], { id: 'wind_inner', r: 3 });
  b.post(76, 388, 5);
  b.shotSwitch('wind_sw', 50, 480, -90);
  // River return: the loop's exit bends gently down into the left inlane. It is built from
  // one-way gates, so the kickback below can still fire straight up through it.
  const RETURN: Pt[] = [[FRAME.left, 600], [38, 680], [50, 750], [58, 790]];
  for (let i = 0; i + 1 < RETURN.length; i++) b.gate(`wind_return_${i + 1}`, RETURN[i], RETURN[i + 1], -90);

  // --- Coaster brake stations above both inlanes: every coaster run (and the river loop) ends
  // with a short stop, like a coaster pulling into its station, then the car rolls out gently
  // onto the flipper. Left = the Delta, where carried sediment settles. Right = the Vise. ---
  for (const [id, x] of [['delta_brake', 83], ['vise_brake', 489]] as const) {
    const brake = b.saucer(id, x, 820, { role: 'scoop', ejectDeg: 90, ejectSpeed: 20, captureMaxSpeed: 4000 });
    brake.autoEjectDelay = 0.35;
  }

  // --- Sediment Slide (left coaster): DEPOSITION. The outer flare is the SEDIMENTARY specimen. ---
  b.target('spec_sed', [177, 684], [174, 618], { group: 'specimens', label: 'SEDIMENTARY' });
  b.wall([[247, 661], [210, 606]], { id: 'slide_flare', r: 3 });
  b.ramp('slide_ramp', { path: SLIDE_PATH, width: 34, footprintTo: 2, peak: 130 });
  // A peaked roof over the footprint cap so nothing can rest on it.
  b.wall([[125, 424], [146, 402], [167, 418]], { id: 'slide_roof', r: 3 });

  // --- Pressure Plunge (right coaster): HEAT & PRESSURE ---
  b.wall([[325, 661], [362, 606]], { id: 'plunge_flare', r: 3 });
  b.wall([[395, 684], [398, 618]], { id: 'plunge_outer', r: 3 });
  b.ramp('plunge_ramp', { path: PLUNGE_PATH, width: 34, footprintTo: 2, peak: 140 });
  b.wall([[405, 418], [426, 402], [447, 424]], { id: 'plunge_roof', r: 3 });

  // --- Magma Chamber lane (right): MELTING. A marked portal low in the lane carries the sample
  // down to melt; it erupts from the volcano crater, where it COOLS. Rock baked beside the
  // chamber is the METAMORPHIC specimen (heat changes it without melting it). ---
  b.wall([[494, 650], [494, 440]], { id: 'magma_wall', r: 3 });
  b.arc(521, 440, 27, 180, 360, { id: 'magma_cap', r: 3, segments: 12 });
  b.wall([[FRAME.laneSep, 402], [521, 413]], { id: 'magma_shed', r: 3 });
  const portal = b.rt.add(new MagmaPortal(b.rt, 'magma_portal', PORTAL_AT[0], PORTAL_AT[1], { x: CRATER[0], y: CRATER[1] + 4, deg: -90, speed: 620 }, { label: 'MAGMA' }));
  b.wall([[FRAME.laneSep, 664], [516, 714]], { id: 'magma_deflect', r: 3 });
  b.target('spec_met', [487, 540], [487, 492], { group: 'specimens', label: 'METAMORPHIC' });

  // --- The volcano, with the Sample Station (Wonder Pocket) in its base ---
  b.wall(VOLCANO, { id: 'volcano', r: 3 });
  // A flared archway funnels shots up into the station notch; its right flare is the IGNEOUS
  // specimen (the volcano's own rock), so the three families read left to right.
  b.wall([[260, 436], [244, 466]], { id: 'station_flare_l', r: 3 });
  b.target('spec_ign', [312, 436], [328, 466], { group: 'specimens', label: 'IGNEOUS' });
  // Short floor label: the 3D view prints it between the funnel flares, which clip long names.
  b.saucer('station', STATION[0], STATION[1], { role: 'pocket', ejectDeg: 112, ejectSpeed: 320, label: 'STATION', icon: 'lens' });
  const crater = b.rt.add(new Crater(b.rt, 'crater', CRATER[0], CRATER[1], { group: 'process', label: 'COOL' }));
  crater.portal = portal;

  // --- Crystal Cavern: the minerals in granite as pop bumpers ---
  b.bumper('qtz', 222, 272, { group: 'crystals', icon: 'quartz', label: 'Qz', r: 24 });
  b.bumper('fsp', 356, 280, { group: 'crystals', icon: 'feldspar', label: 'Fs', r: 24 });
  b.bumper('mca', 290, 214, { group: 'crystals', icon: 'mica', label: 'Mi', r: 24 });

  // --- Cavern chute: while the Crystal Cavern is the goal, a blade drops balls riding the top
  // of the arch into the power lanes and onto the crystals. Otherwise it folds back behind the
  // arch wall, out of the ball's reach. Switched from onProgress. ---
  b.diverter('cavern_chute', [250, 17.5], 82, 165, 114.5);

  // --- Power lanes: the three energy sources that keep the rock cycle moving ---
  ([['sun', 'SUN'], ['grav', 'GRAVITY'], ['heat', 'HEAT']] as const).forEach(([id, l], i) => b.rollover(`lane_${id}`, 238 + i * 48, 128, { group: 'energy', label: l }));
  for (const gx of [214, 262, 310, 358]) {
    b.wall([[gx, 104], [gx, 150]], { r: 3 });
    b.post(gx, 102, 5);
  }

  // --- Inserts ---
  b.insert('ins_wind', 106, 644, { deg: -115, label: 'WEATHERING', color: RIVER });
  b.insert('ins_slide', 222, 706, { deg: -108, label: 'DEPOSITION', color: SAND });
  b.insert('ins_plunge', 350, 706, { deg: -72, label: 'HEAT + PRESSURE', color: SLATE });
  b.insert('ins_magma', 466, 644, { deg: -66, label: 'MELTING', color: MAGMA });
  b.insert('ins_station', 286, 488, { deg: -90 });
  b.insert('ins_specimens', 286, 566, { shape: 'star', size: 11, color: CORAL });
  b.insert('ins_crystals', 252, 222, { shape: 'star', size: 10, color: MINT });
}

// ---------------------------------------------------------------- printed playfield art

const HZ = 452; // ground line of the cross-section

const MESA: Pt[] = [[24, HZ], [24, 262], [44, 236], [66, 214], [150, 206], [166, 226], [178, 262], [194, 306], [214, HZ]];
const FOLD_PEAK: Pt[] = [[358, HZ], [376, 350], [404, 282], [440, 232], [474, 204], [502, 210], [528, 240], [548, 262], [548, HZ]];
const CONE: Pt[] = [[196, HZ], [252, 334], [272, 296], [300, 296], [320, 334], [376, HZ]];
const STRATA_L: Pt[] = [[24, HZ], [250, HZ], [240, 560], [222, 690], [170, 770], [24, 790]];
const FOLDS_R: Pt[] = [[322, HZ], [548, HZ], [548, 790], [402, 770], [350, 690], [332, 560]];

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Dusk-dimmed colour that brightens as the attraction wakes. */
function dim(c: string, level: number) {
  return mix(c, '#1a0f22', 0.72 - 0.16 * stage(level, 0, 3.2));
}

/** Point and left normal at distance d along a polyline. */
function along(pts: Pt[], lens: number[], d: number): [number, number, number, number] {
  let i = 1;
  while (i < lens.length - 1 && lens[i] < d) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = lens[i] - lens[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (d - lens[i - 1]) / seg));
  const dx = (b[0] - a[0]) / seg;
  const dy = (b[1] - a[1]) / seg;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, -dy, dx];
}

/** The coaster's trestle seen from above: a ladder of ties under each ramp. */
function trestle(ctx: CanvasRenderingContext2D, path: Pt[], level: number, glow: string) {
  const pts = smoothPath(path, 8);
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = lens[lens.length - 1];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(30,16,22,0.32)';
  ctx.lineWidth = 3;
  for (let d = 6; d < total; d += 13) {
    const [x, y, nx, ny] = along(pts, lens, d);
    ctx.beginPath();
    ctx.moveTo(x - nx * 21, y - ny * 21);
    ctx.lineTo(x + nx * 21, y + ny * 21);
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let d = 0; d <= total; d += 6) {
      const [x, y, nx, ny] = along(pts, lens, d);
      if (d === 0) ctx.moveTo(x + nx * 16 * side, y + ny * 16 * side);
      else ctx.lineTo(x + nx * 16 * side, y + ny * 16 * side);
    }
    ctx.strokeStyle = 'rgba(20,10,18,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Chaser lights along the rails wake with the attraction.
  const lit = stage(level, 1.1, 2.4);
  if (lit > 0.01) {
    for (let d = 10; d < total; d += 38) {
      const [x, y, nx, ny] = along(pts, lens, d);
      for (const side of [-1, 1]) glowDot(ctx, x + nx * 20 * side, y + ny * 20 * side, 6, glow, 0.55 * lit);
    }
  }
  ctx.restore();
}

function sedimentBands(ctx: CanvasRenderingContext2D, level: number, y0: number, y1: number, x0: number, x1: number, seed: number, bow = 10) {
  const r = rng(seed);
  let y = y0;
  let k = 0;
  while (y < y1) {
    const h = 18 + r() * 16;
    ctx.fillStyle = dim(SED_BANDS[k % SED_BANDS.length], level);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, y + Math.sin((x - x0) / 180) * bow);
    for (let x = x1; x >= x0; x -= 12) ctx.lineTo(x, y + h + 1 + Math.sin((x - x0) / 180) * bow);
    ctx.closePath();
    ctx.fill();
    // grains
    ctx.fillStyle = 'rgba(255,240,220,0.07)';
    for (let i = 0; i < 26; i++) ctx.fillRect(x0 + r() * (x1 - x0), y + r() * h, 1.6, 1.6);
    if (k % 4 === 2) {
      // a pebbly conglomerate layer
      ctx.fillStyle = 'rgba(40,24,30,0.25)';
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        ctx.ellipse(x0 + r() * (x1 - x0), y + h * (0.3 + r() * 0.4), 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, TAU);
        ctx.fill();
      }
    }
    // bedding line
    ctx.strokeStyle = 'rgba(30,16,24,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, y + Math.sin((x - x0) / 180) * bow);
    ctx.stroke();
    y += h;
    k++;
  }
}

function metamorphicBands(ctx: CanvasRenderingContext2D, level: number, y0: number, y1: number, x0: number, x1: number, amp: number, wave: number, seed: number) {
  const r = rng(seed);
  let k = 0;
  for (let y = y0 - 30; y < y1 + 30; y += 13) {
    ctx.fillStyle = dim(MET_BANDS[k % MET_BANDS.length], level);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, y + Math.sin(x / wave + k * 0.35) * amp);
    for (let x = x1; x >= x0; x -= 6) ctx.lineTo(x, y + 14 + Math.sin(x / wave + (k + 1) * 0.35) * amp);
    ctx.closePath();
    ctx.fill();
    k++;
  }
  // mica glints catch the light as the attraction wakes
  const g = stage(level, 0.3, 1.2);
  for (let i = 0; i < 40; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    ctx.fillStyle = rgba('#ffffff', 0.08 + 0.3 * g * r());
    ctx.fillRect(x, y, 2, 1);
  }
}

function sunGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, a: number) {
  ctx.save();
  ctx.strokeStyle = rgba(color, a);
  ctx.fillStyle = rgba(color, a);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.45, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(t) * s * 0.65, y + Math.sin(t) * s * 0.65);
    ctx.lineTo(x + Math.cos(t) * s, y + Math.sin(t) * s);
    ctx.stroke();
  }
  ctx.restore();
}

function flameGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, a: number) {
  ctx.save();
  ctx.fillStyle = rgba(color, a);
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 0.2, x + s * 0.6, y + s * 0.8, x, y + s * 0.8);
  ctx.bezierCurveTo(x - s * 0.6, y + s * 0.8, x - s * 0.7, y - s * 0.2, x, y - s);
  ctx.fill();
  ctx.restore();
}

function arrowGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, a: number) {
  ctx.save();
  ctx.strokeStyle = rgba(color, a);
  ctx.fillStyle = rgba(color, a);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, y + s * 0.2);
  ctx.lineTo(x + s * 0.45, y + s * 0.2);
  ctx.lineTo(x, y + s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The Track Map sign: three rock families with arrows running every way between them. */
function trackMap(ctx: CanvasRenderingContext2D, level: number) {
  const cx = 286;
  const cy = 790;
  const s2 = stage(level, 1.1, 2);
  const s3 = stage(level, 2.1, 3);
  const nodes: { x: number; y: number; label: string; how: string; c: string }[] = [
    { x: cx, y: cy - 70, label: 'IGNEOUS', how: 'melt + cool', c: MAGMA },
    { x: cx - 66, y: cy + 46, label: 'SEDIMENTARY', how: 'weather + deposit', c: SAND },
    { x: cx + 66, y: cy + 46, label: 'METAMORPHIC', how: 'heat + squeeze', c: SLATE },
  ];
  ctx.save();
  // sign board
  ctx.fillStyle = rgba('#120a1c', 0.55);
  ctx.beginPath();
  ctx.arc(cx, cy, 104, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.18 + 0.5 * s2);
  ctx.lineWidth = 2;
  ctx.stroke();
  // arrows both ways between every pair (curved so they never overlap)
  const lit = 0.15 + 0.85 * s2;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      const a = nodes[i];
      const b = nodes[j];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const ox = mx - cx;
      const oy = my - cy;
      const ol = Math.hypot(ox, oy) || 1;
      const bend = i < j ? 30 : -6;
      const qx = mx + (ox / ol) * bend;
      const qy = my + (oy / ol) * bend;
      const sx = a.x + (qx - a.x) * 0.3;
      const sy = a.y + (qy - a.y) * 0.3;
      const ex = b.x + (qx - b.x) * 0.3;
      const ey = b.y + (qy - b.y) * 0.3;
      neonPath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(qx, qy, ex, ey);
      }, b.c, lit * (i < j ? 1 : 0.8), 2);
      // arrow head at the destination
      const ang = Math.atan2(ey - qy, ex - qx);
      ctx.fillStyle = rgba(b.c, 0.25 + 0.75 * lit);
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(ang) * 6, ey + Math.sin(ang) * 6);
      ctx.lineTo(ex + Math.cos(ang + 2.5) * 6, ey + Math.sin(ang + 2.5) * 6);
      ctx.lineTo(ex + Math.cos(ang - 2.5) * 6, ey + Math.sin(ang - 2.5) * 6);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (const n of nodes) {
    ctx.fillStyle = rgba(mix(n.c, '#1a1030', 0.55), 0.85);
    ctx.beginPath();
    ctx.arc(n.x, n.y, 15, 0, TAU);
    ctx.fill();
    glowDot(ctx, n.x, n.y, 22, n.c, 0.15 + 0.5 * s3);
    ctx.strokeStyle = rgba(n.c, 0.4 + 0.6 * s2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 15, 0, TAU);
    ctx.stroke();
    ctx.font = '800 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(IVORY, 0.55 + 0.45 * s2);
    ctx.fillText(n.label, n.x, n.y + (n.y < cy ? -24 : 26));
    ctx.font = '700 8px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = rgba(n.c, 0.4 + 0.6 * s2);
    ctx.fillText(n.how, n.x, n.y + (n.y < cy ? -34 : 36));
  }
  // tiny rock glyphs inside the nodes
  const [ig, sd, mt] = nodes;
  for (let i = 0; i < 9; i++) {
    const t = (i / 9) * TAU;
    ctx.fillStyle = [IVORY, '#e0a0a8', '#1a1018'][i % 3];
    ctx.fillRect(ig.x + Math.cos(t) * 6 - 1.5, ig.y + Math.sin(t) * 6 - 1.5, 3, 3);
  }
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = SED_BANDS[k];
    ctx.fillRect(sd.x - 9, sd.y - 8 + k * 4, 18, 3.5);
  }
  ctx.strokeStyle = MET_BANDS[3];
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let x = -9; x <= 9; x += 3) ctx.lineTo(mt.x + x, mt.y - 5 + k * 5 + Math.sin(x / 3) * 2);
    ctx.stroke();
  }
  ctx.font = '800 8px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.fillStyle = rgba(GOLD, 0.45 + 0.55 * s2);
  ctx.fillText('TRACK MAP · ANY ROUTE', cx, cy + 4);
  ctx.restore();
}

function paintPlayfield(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.1, 2);
  const s3 = stage(level, 2.1, 3);
  const s4 = stage(level, 3.4, 4);

  // --- Sky at dusk over the coaster park ---
  ctx.fillStyle = vgrad(ctx, 0, HZ, [[0, '#120a28'], [0.4, '#251443'], [0.75, mix('#3c1c4c', '#5e2656', s2)], [1, mix('#5a2450', '#b04f66', 0.25 + 0.55 * s2)]]);
  ctx.fillRect(0, 0, 600, HZ);
  stars(ctx, 17, 50 + Math.round(50 * s4), [40, 20, 560, 300], IVORY);
  // a far ridge
  ctx.fillStyle = mix('#2a1640', '#3a1e50', s2);
  ctx.beginPath();
  ctx.moveTo(24, HZ);
  const fr = rng(23);
  for (let x = 24; x <= 548; x += 22) ctx.lineTo(x, 372 + Math.sin(x / 47) * 22 + fr() * 14);
  ctx.lineTo(548, HZ);
  ctx.closePath();
  ctx.fill();
  // rain cloud over the Wind & Rain Loop and its rain
  ctx.fillStyle = rgba('#b8c4e8', 0.18 + 0.2 * s1);
  for (const [x, y, r] of [[78, 160, 22], [104, 150, 26], [128, 162, 20], [96, 170, 20]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(RIVER, 0.12 + 0.3 * s1);
  ctx.lineWidth = 1.5;
  const rr = rng(41);
  for (let i = 0; i < 24; i++) {
    const x = 64 + rr() * 80;
    const y = 186 + rr() * 60;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 12);
    ctx.stroke();
  }

  // --- West mesa: flat sedimentary layers worn by rain and wind ---
  ctx.save();
  poly(ctx, MESA);
  ctx.clip();
  sedimentBands(ctx, level, 200, HZ + 4, 24, 220, 7, 0);
  ctx.restore();
  ctx.strokeStyle = rgba('#ffd2a0', 0.12 + 0.25 * s2);
  ctx.lineWidth = 2;
  poly(ctx, MESA);
  ctx.stroke();

  // --- East peak: metamorphic rock folded into bands by squeezing ---
  ctx.save();
  poly(ctx, FOLD_PEAK);
  ctx.clip();
  metamorphicBands(ctx, level, 200, HZ, 350, 552, 16, 34, 9);
  ctx.restore();
  ctx.strokeStyle = rgba('#e6dcff', 0.1 + 0.25 * s2);
  ctx.lineWidth = 2;
  poly(ctx, FOLD_PEAK);
  ctx.stroke();

  // --- The volcano: dark basalt (fast-cooled, tiny crystals) with lava that wakes last ---
  ctx.save();
  poly(ctx, CONE);
  ctx.fillStyle = vgrad(ctx, 296, HZ, [[0, mix(BASALT, '#4a2a34', s3)], [1, '#3a2a36']]);
  ctx.fill();
  ctx.clip();
  const vr = rng(5);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 160; i++) ctx.fillRect(196 + vr() * 180, 296 + vr() * 160, 1, 1);
  ctx.restore();
  // lava rivulets (dark tubes until the third discovery)
  for (const [sx, wob, ex] of [[278, 8, 222], [292, -7, 352], [284, 5, 300]] as [number, number, number][]) {
    neonPath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(sx, 300);
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        ctx.lineTo(sx + (ex - sx) * t + Math.sin(k * 1.7) * wob, 300 + t * 140);
      }
    }, LAVA, s3 * 0.9, 3);
  }
  glowDot(ctx, CRATER[0], 296, 26, MAGMA, 0.15 + 0.6 * s3);
  // Sample Station: a stone archway in the volcano's base with a lantern glow
  ctx.fillStyle = '#3b2c3c';
  ctx.beginPath();
  ctx.moveTo(250, 446);
  ctx.lineTo(250, 400);
  ctx.quadraticCurveTo(286, 368, 322, 400);
  ctx.lineTo(322, 446);
  ctx.closePath();
  ctx.fill();
  glowDot(ctx, STATION[0], STATION[1], 40, GOLD, 0.2 + 0.5 * s1);
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.5 * s1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(252, 446);
  ctx.lineTo(252, 401);
  ctx.quadraticCurveTo(286, 371, 320, 401);
  ctx.lineTo(320, 446);
  ctx.stroke();

  // --- Underground cross-section ---
  ctx.fillStyle = vgrad(ctx, HZ, 1150, [[0, '#3a2232'], [0.4, '#2a1828'], [1, '#170e1e']]);
  ctx.fillRect(0, HZ, 600, 1150 - HZ);
  // sedimentary layers on the west (deposited flat, bowed by burial)
  ctx.save();
  poly(ctx, STRATA_L);
  ctx.clip();
  sedimentBands(ctx, level, HZ, 800, 24, 260, 3, 14);
  ctx.restore();
  // metamorphic folds on the east
  ctx.save();
  poly(ctx, FOLDS_R);
  ctx.clip();
  metamorphicBands(ctx, level, HZ, 790, 322, 552, 10, 26, 13);
  ctx.restore();
  // basalt dike: the volcano's feeder pipe
  ctx.fillStyle = mix(BASALT, '#3a2232', 0.3);
  ctx.beginPath();
  ctx.moveTo(262, HZ);
  ctx.bezierCurveTo(262, 520, 300, 560, 300, 620);
  ctx.lineTo(272, 620);
  ctx.bezierCurveTo(272, 560, 244, 520, 244, HZ);
  ctx.closePath();
  ctx.fill();
  // ground line, lit by the sunset
  ctx.fillStyle = vgrad(ctx, HZ - 4, HZ + 6, [[0, rgba('#ffb27a', 0)], [0.5, rgba('#ffb27a', 0.25 + 0.3 * s2)], [1, rgba('#ffb27a', 0)]]);
  ctx.fillRect(24, HZ - 4, 524, 10);

  // --- Magma chamber beside the east folds, with a halo of baked (metamorphosed) rock ---
  const mx = 521;
  const my = 520;
  ctx.save();
  ctx.beginPath();
  ctx.rect(24, HZ, 524, 400);
  ctx.clip();
  ctx.fillStyle = rgba('#f2e2d0', 0.08 + 0.22 * s2);
  ctx.beginPath();
  ctx.ellipse(mx, my, 84, 150, 0, 0, TAU);
  ctx.fill();
  const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
  mg.addColorStop(0, rgba(LAVA, 0.25 + 0.55 * s2));
  mg.addColorStop(0.5, rgba(MAGMA, 0.25 + 0.45 * s2));
  mg.addColorStop(1, rgba('#5a1a22', 0.5));
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.ellipse(mx, my, 62, 124, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the feeder path from the chamber up to the crater (the portal's route)
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(PORTAL_AT[0] - 26, PORTAL_AT[1]);
    ctx.bezierCurveTo(430, 540, 330, 480, 296, HZ - 2);
  }, MAGMA, s2 * 0.8, 3);
  ctx.save();
  ctx.setLineDash([4, 6]);
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(286, 440);
    ctx.lineTo(286, 300);
  }, LAVA, s3 * 0.7, 2);
  ctx.restore();

  // --- River and delta: the Wind & Rain Loop carries sediment down the river return and
  // drops it at the Delta brake, where it settles in fresh layers ---
  const riverPts: Pt[] = [];
  for (let y = 250; y <= 600; y += 25) riverPts.push([50 + Math.sin(y / 46) * 6, y]);
  riverPts.push([54, 650], [62, 700], [70, 750], [78, 792], [83, 812]);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(RIVER, 0.22 + 0.3 * s1);
  ctx.lineWidth = 16;
  ctx.beginPath();
  riverPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.strokeStyle = rgba('#ffffff', 0.08 + 0.15 * s1);
  ctx.lineWidth = 2;
  for (let i = 1; i < riverPts.length - 1; i += 2) {
    const [x, y] = riverPts[i];
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 1, y + 10);
    ctx.stroke();
  }
  ctx.restore();
  // delta fan around the Delta brake, with fresh sand layers
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = rgba(SED_BANDS[(k + 2) % SED_BANDS.length], 0.24 + 0.22 * s1);
    ctx.beginPath();
    ctx.ellipse(83, 814 + k * 4, 34 - k * 6, 15 - k * 2, 0, 0, TAU);
    ctx.fill();
  }
  glowDot(ctx, 83, 820, 26, SAND, 0.15 + 0.35 * s1);
  // the Vise brake at the foot of the Pressure Plunge: two jaws squeezing a banded block
  ctx.save();
  ctx.fillStyle = rgba(mix(SLATE, '#1a1030', 0.4), 0.7);
  ctx.fillRect(458, 806, 9, 28);
  ctx.fillRect(511, 806, 9, 28);
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = rgba(MET_BANDS[k % MET_BANDS.length], 0.35 + 0.3 * s2);
    ctx.fillRect(470, 808 + k * 6, 38, 4);
  }
  ctx.restore();
  glowDot(ctx, 489, 820, 26, SLATE, 0.12 + 0.35 * s2);
  plaque(ctx, 'DELTA', 132, 796, rgba('#1a1030', 0.72), rgba(SAND, 0.65 + 0.35 * s1), 8);
  plaque(ctx, 'VISE', 440, 796, rgba('#1a1030', 0.72), rgba(SLATE, 0.65 + 0.35 * s2), 8);

  // --- Granite pluton under the flippers: magma that cooled slowly underground grew big crystals ---
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(286, 1050, 300, 190, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = 'rgba(70,46,62,0.55)';
  ctx.fillRect(0, 860, 600, 290);
  const gr = rng(77);
  const gcols = ['#e3a3ae', '#f1e8e8', '#140c16', '#c98a90'];
  for (let i = 0; i < 300; i++) {
    const x = gr() * 600;
    const y = 870 + gr() * 280;
    const w = 3 + gr() * 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(gr() * 3);
    ctx.fillStyle = rgba(gcols[i % 4], 0.1 + 0.18 * gr() + 0.12 * s1);
    ctx.fillRect(-w / 2, -w * 0.35, w, w * 0.7);
    ctx.restore();
  }
  ctx.restore();
  plaque(ctx, 'GRANITE: cooled slowly underground, so its crystals grew big', 286, 1068, rgba('#1a1030', 0.72), rgba(IVORY, 0.75), 8);

  // --- Coaster trestles under both ramps ---
  trestle(ctx, SLIDE_PATH, level, SAND);
  trestle(ctx, PLUNGE_PATH, level, SLATE);

  // --- Track names (the 3D view does not label ramps, portals or loops) ---
  const nameBg = rgba('#1a1030', 0.78);
  const sidePlaque = (text: string, x: number, y: number, ink: string, size = 7) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    plaque(ctx, text, 0, 0, nameBg, ink, size);
    ctx.restore();
  };
  // Coaster names sit inside each track's hairpin, the one patch beside a raised ramp that the
  // tilted 3D view never hides behind the ramp itself.
  sidePlaque('SEDIMENT SLIDE', 95, 340, rgba(SAND, 0.8 + 0.2 * s1), 8);
  sidePlaque('PRESSURE PLUNGE', 477, 340, rgba(SLATE, 0.85 + 0.15 * s1), 8);
  sidePlaque('WIND & RAIN LOOP', 64, 540, rgba(RIVER, 0.8 + 0.2 * s1));
  sidePlaque('MAGMA CHAMBER', 521, 612, rgba(LAVA, 0.8 + 0.2 * s2));
  // Specimen tags: the 3D standups are seen edge-on, so their faces cannot be read.
  const tagBg = rgba('#120a1c', 0.8);
  sidePlaque('SEDIMENTARY', 157, 652, rgba(SAND, 0.85 + 0.15 * s1));
  sidePlaque('METAMORPHIC', 469, 518, rgba(SLATE, 0.9 + 0.1 * s1));
  plaque(ctx, 'IGNEOUS', 360, 478, tagBg, rgba(LAVA, 0.85 + 0.15 * s1), 7);

  // --- Track map ---
  trackMap(ctx, level);

  // --- Power lanes: sunlight, gravity and Earth's inner heat drive every process ---
  const pl = 0.35 + 0.65 * s1;
  sunGlyph(ctx, 238, 168, 8, GOLD, pl);
  arrowGlyph(ctx, 286, 168, 8, MINT, pl);
  flameGlyph(ctx, 334, 168, 8, MAGMA, pl);

  // --- Mineral names beside the crystal bumpers ---
  const ml = rgba('#1a1030', 0.85);
  plaque(ctx, 'QUARTZ', 214, 310, ml, rgba(IVORY, 0.7 + 0.3 * s1), 8);
  plaque(ctx, 'FELDSPAR', 366, 318, ml, rgba(IVORY, 0.7 + 0.3 * s1), 8);
  plaque(ctx, 'MICA', 350, 202, ml, rgba(IVORY, 0.7 + 0.3 * s1), 8);

  // --- Marquee ---
  neonText(ctx, 'ROCK-CYCLE', 300, 40, 17, GOLD, 0.15 + 0.85 * s2);
  neonText(ctx, 'ROLLERCOASTER', 300, 62, 12, CORAL, 0.15 + 0.85 * s3);

  // --- Wonderlight ---
  if (s4 > 0) {
    ctx.fillStyle = rgba(GOLD, 0.07 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    glowDot(ctx, CRATER[0], 290, 90, LAVA, 0.35 * s4);
  }
}

// ---------------------------------------------------------------- 3D attraction set

const GROUND = -0.42;
type V3 = [number, number, number];

function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const tex = kit.track(new T.CanvasTexture(c));
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Horizontal sediment bands with grain (hoodoos, the delta block, sandstone samples). */
function strataTexture(kit: SetKit) {
  return canvasTex(kit, 64, 256, (ctx) => {
    const r = rng(11);
    let y = 0;
    let k = 0;
    while (y < 256) {
      const h = 14 + r() * 22;
      ctx.fillStyle = SED_BANDS[k % SED_BANDS.length];
      ctx.fillRect(0, y, 64, h + 1);
      ctx.fillStyle = 'rgba(40,20,20,0.25)';
      ctx.fillRect(0, y, 64, 1.5);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,240,220,${0.05 + r() * 0.12})`;
        ctx.fillRect(r() * 64, y + r() * h, 1.5, 1.5);
      }
      y += h;
      k++;
    }
  });
}

/** Wavy gneiss bands: what squeezing does to layered rock. */
function gneissTexture(kit: SetKit) {
  return canvasTex(kit, 256, 128, (ctx) => {
    let k = 0;
    for (let y = -20; y < 150; y += 11) {
      ctx.fillStyle = MET_BANDS[k % MET_BANDS.length];
      ctx.beginPath();
      for (let x = 0; x <= 256; x += 4) ctx.lineTo(x, y + Math.sin((x / 256) * TAU * 2 + k * 0.4) * 9);
      for (let x = 256; x >= 0; x -= 4) ctx.lineTo(x, y + 12 + Math.sin((x / 256) * TAU * 2 + (k + 1) * 0.4) * 9);
      ctx.closePath();
      ctx.fill();
      k++;
    }
    const r = rng(3);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.4})`;
      ctx.fillRect(r() * 256, r() * 128, 2, 1);
    }
  });
}

/** Wind-rippled sand for dunes and the delta. */
function sandTexture(kit: SetKit, ripples: boolean) {
  return canvasTex(kit, 128, 128, (ctx) => {
    ctx.fillStyle = '#c99a62';
    ctx.fillRect(0, 0, 128, 128);
    const r = rng(19);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? '255,230,190' : '120,80,50'},${0.08 + r() * 0.12})`;
      ctx.fillRect(r() * 128, r() * 128, 1.5, 1.5);
    }
    if (!ripples) return;
    ctx.strokeStyle = 'rgba(110,70,40,0.35)';
    ctx.lineWidth = 2;
    for (let y = 6; y < 128; y += 11) {
      ctx.beginPath();
      for (let x = 0; x <= 128; x += 4) ctx.lineTo(x, y + Math.sin(x / 9 + y) * 2.5);
      ctx.stroke();
    }
  });
}

/** A meandering river ribbon whose current scrolls downstream; it widens toward the delta. */
function riverRibbon(kit: SetKit, path: [number, number][], width: number) {
  const T = kit.THREE;
  const tex = canvasTex(kit, 64, 256, (ctx) => {
    ctx.fillStyle = '#1d6a80';
    ctx.fillRect(0, 0, 64, 256);
    const r = rng(31);
    for (let i = 0; i < 46; i++) {
      ctx.strokeStyle = `rgba(190,240,255,${0.15 + r() * 0.35})`;
      ctx.lineWidth = 1 + r() * 1.5;
      const x = 6 + r() * 52;
      const y = r() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 4, y + 8 + r() * 14);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  const curve = new T.CatmullRomCurve3(path.map(([x, z]) => new T.Vector3(x, 0, z)));
  const n = 64;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const p = new T.Vector3();
  const tan = new T.Vector3();
  const len = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, tan);
    const l = Math.hypot(tan.x, tan.z) || 1;
    const nx = -tan.z / l;
    const nz = tan.x / l;
    const w = (width * (0.7 + 0.8 * u * u)) / 2;
    pos.push(p.x + nx * w, GROUND + 0.035, p.z + nz * w, p.x - nx * w, GROUND + 0.035, p.z - nz * w);
    uvs.push(0, (u * len) / 0.8, 1, (u * len) / 0.8);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = kit.track(new T.MeshStandardMaterial({ map: tex, emissive: RIVER, emissiveMap: tex, emissiveIntensity: 0.05, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.93, side: T.DoubleSide }));
  const mesh = new T.Mesh(geo, mat);
  mesh.receiveShadow = true;
  kit.add(mesh);
  kit.animate((_t, dt) => {
    tex.offset.y -= dt * 0.35;
  });
  return mat;
}

/** Two-world ground: sand and pebbles on the surface side, slate and cinders on the deep side. */
function parkGround(kit: SetKit) {
  const T = kit.THREE;
  const tex = canvasTex(kit, 1024, 1024, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, '#3e2a26');
    g.addColorStop(0.36, '#5a3e2e');
    g.addColorStop(0.5, '#22161f');
    g.addColorStop(0.64, '#2e2438');
    g.addColorStop(1, '#221c2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    const r = rng(29);
    for (let i = 0; i < 2600; i++) {
      const x = r() * 1024;
      const y = r() * 1024;
      ctx.fillStyle = x < 512 ? `rgba(240,200,150,${0.05 + r() * 0.12})` : `rgba(200,190,230,${0.04 + r() * 0.1})`;
      ctx.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 2.5);
    }
    // wind ripples on the sand side
    ctx.strokeStyle = 'rgba(40,20,10,0.18)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 40; k++) {
      const y = r() * 1024;
      const x0 = r() * 380;
      ctx.beginPath();
      for (let x = x0; x < x0 + 120; x += 8) ctx.lineTo(x, y + Math.sin(x / 14) * 3);
      ctx.stroke();
    }
    // cinders on the volcanic side
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(12,8,14,${0.2 + r() * 0.3})`;
      ctx.beginPath();
      ctx.arc(560 + r() * 460, r() * 1024, 1 + r() * 3, 0, TAU);
      ctx.fill();
    }
    const v = ctx.createRadialGradient(512, 512, 200, 512, 512, 520);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,4,12,0.85)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 1024, 1024);
  });
  // Emissive layer: lava veins crack open across the volcanic side and the sand ripples catch
  // the sunset on the surface side as the attraction wakes (canvas x = world x, y = world z).
  const glow = canvasTex(kit, 1024, 1024, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1024, 1024);
    const r = rng(53);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < 34; k++) {
      let x = 596 + r() * 140;
      let y = 360 + r() * 290;
      let a = r() * TAU;
      const w = 1 + r() * 1.8;
      ctx.strokeStyle = k % 3 ? '#ff5a1f' : '#ffb23a';
      ctx.lineWidth = w;
      ctx.shadowColor = '#ff5a1f';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 9; i++) {
        a += (r() - 0.5) * 1.3;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,190,110,0.32)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 22; k++) {
      const y = 370 + r() * 280;
      const x0 = 300 + r() * 110;
      ctx.beginPath();
      for (let x = x0; x < x0 + 26; x += 3) ctx.lineTo(x, y + Math.sin(x / 5) * 1.5);
      ctx.stroke();
    }
  });
  const mat = kit.track(new T.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, emissive: '#ffffff', emissiveMap: glow, emissiveIntensity: 0 }));
  const mesh = new T.Mesh(new T.CircleGeometry(22, 64).rotateX(-Math.PI / 2), mat);
  mesh.position.y = GROUND;
  mesh.receiveShadow = true;
  kit.add(mesh);
  return mat;
}

/** A hoodoo: a weathered pillar of layered rock under a harder cap stone. */
function hoodoo(kit: SetKit, mat: THREE.Material, capMat: THREE.Material, x: number, z: number, h: number, r: number, seed: number) {
  const T = kit.THREE;
  const rr = rng(seed);
  const prof = [[1, 0], [0.92, 0.12], [0.66, 0.3], [0.76, 0.46], [0.52, 0.64], [0.66, 0.8], [0.5, 0.94], [0.4, 1]];
  const pts = prof.map(([px, py]) => new T.Vector2(px * r * (0.92 + rr() * 0.16), py * h));
  const geo = new T.LatheGeometry(pts, 14);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i);
    const vz = p.getZ(i);
    const a = Math.atan2(vz, vx);
    const f = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.1);
    p.setX(i, vx * f);
    p.setZ(i, vz * f);
  }
  geo.computeVertexNormals();
  const m = new T.Mesh(geo, mat);
  m.position.set(x, GROUND, z);
  m.castShadow = true;
  m.receiveShadow = true;
  kit.add(m);
  const cap = new T.Mesh(new T.DodecahedronGeometry(r * 0.62, 0), capMat);
  cap.scale.set(1.15, 0.45, 1.05);
  cap.position.set(x, GROUND + h + r * 0.12, z);
  cap.rotation.y = seed;
  cap.castShadow = true;
  kit.add(cap);
}

interface Coaster {
  segs: THREE.CatmullRomCurve3[];
  lens: number[];
  /** Segments a cart may take after finishing each segment (a fork has two). */
  next: number[][];
  cart: THREE.Group;
  rock: THREE.MeshStandardMaterial;
  seg: number;
  u: number;
  pause: number;
}

/** Steel coaster track (two rails, instanced ties and supports) along one or more segments. */
function coasterTrack(kit: SetKit, segPts: V3[][], rail: THREE.Material, wood: THREE.Material, closed: boolean, bulbColor: string) {
  const T = kit.THREE;
  const up = new T.Vector3(0, 1, 0);
  const segs = segPts.map((pts) => new T.CatmullRomCurve3(pts.map((q) => new T.Vector3(q[0], q[1], q[2])), closed, 'centripetal'));
  const tieMats: THREE.Matrix4[] = [];
  const postMats: THREE.Matrix4[] = [];
  const bulbMats: THREE.Matrix4[] = [];
  const dummy = new T.Object3D();
  const p = new T.Vector3();
  const tan = new T.Vector3();
  const side = new T.Vector3();
  const look = new T.Vector3();
  for (const c of segs) {
    const len = c.getLength();
    const n = Math.max(24, Math.round(len / 0.07));
    for (const s of [-1, 1]) {
      const railPts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        c.getPointAt(u, p);
        c.getTangentAt(u, tan);
        side.crossVectors(tan, up).normalize();
        railPts.push(p.clone().addScaledVector(side, 0.085 * s));
        if (i % 5 === 0) {
          dummy.position.copy(p).addScaledVector(side, 0.11 * s);
          dummy.position.y -= 0.03;
          dummy.updateMatrix();
          bulbMats.push(dummy.matrix.clone());
        }
      }
      const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(railPts, false), n, 0.017, 5, false), rail);
      tube.castShadow = true;
      kit.add(tube);
    }
    for (let d = 0.04; d < len; d += 0.13) {
      const u = d / len;
      c.getPointAt(u, p);
      c.getTangentAt(u, tan);
      dummy.position.copy(p);
      dummy.position.y -= 0.012;
      look.copy(dummy.position).add(tan);
      dummy.lookAt(look);
      dummy.updateMatrix();
      tieMats.push(dummy.matrix.clone());
    }
    for (let d = 0.2; d < len; d += 0.55) {
      c.getPointAt(d / len, p);
      const h = p.y - GROUND - 0.03;
      if (h < 0.18) continue;
      dummy.position.set(p.x, GROUND + h / 2, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      postMats.push(dummy.matrix.clone());
      dummy.scale.set(1, 1, 1);
    }
  }
  const ties = new T.InstancedMesh(new T.BoxGeometry(0.24, 0.022, 0.04), wood, tieMats.length);
  tieMats.forEach((m, i) => ties.setMatrixAt(i, m));
  ties.instanceMatrix.needsUpdate = true;
  kit.add(ties);
  const posts = new T.InstancedMesh(new T.CylinderGeometry(0.02, 0.026, 1, 6), rail, postMats.length);
  postMats.forEach((m, i) => posts.setMatrixAt(i, m));
  posts.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  kit.add(posts);
  const bulbMat = kit.track(new T.MeshStandardMaterial({ color: '#221a2a', emissive: bulbColor, emissiveIntensity: 0.05 }));
  const bulbs = new T.InstancedMesh(new T.SphereGeometry(0.022, 6, 4), bulbMat, bulbMats.length);
  bulbMats.forEach((m, i) => bulbs.setMatrixAt(i, m));
  bulbs.instanceMatrix.needsUpdate = true;
  kit.add(bulbs);
  return { segs, bulbMat };
}

/** An ore cart carrying one rock sample whose look changes with the process it rides through. */
function oreCart(kit: SetKit, body: THREE.Material, rockColor: string, seed: number) {
  const T = kit.THREE;
  const g = new T.Group();
  const tub = new T.Mesh(new T.CylinderGeometry(0.17, 0.12, 0.15, 6, 1, true), body);
  tub.rotation.y = Math.PI / 6;
  tub.position.y = 0.11;
  tub.scale.z = 1.25;
  tub.castShadow = true;
  const floor = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.02, 6), kit.mats.dark());
  floor.rotation.y = Math.PI / 6;
  floor.scale.z = 1.25;
  floor.position.y = 0.04;
  const rockMat = kit.track(new T.MeshStandardMaterial({ color: rockColor, roughness: 0.85, emissive: '#000000', emissiveIntensity: 1 }));
  const rg = new T.IcosahedronGeometry(0.12, 1);
  const pa = rg.attributes.position as THREE.BufferAttribute;
  const r = rng(seed);
  for (let i = 0; i < pa.count; i++) {
    const k = 0.82 + r() * 0.3;
    pa.setXYZ(i, pa.getX(i) * k, pa.getY(i) * k * 0.85, pa.getZ(i) * k);
  }
  rg.computeVertexNormals();
  const rock = new T.Mesh(rg, rockMat);
  rock.position.y = 0.2;
  rock.castShadow = true;
  const lamp = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), kit.mats.glow(GOLD, 2.5));
  lamp.position.set(0, 0.12, 0.2);
  g.add(tub, floor, rock, lamp);
  g.scale.setScalar(1.45);
  kit.add(g);
  return { cart: g, rock: rockMat };
}

const rockSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  kit.sky('#2a1748', '#0b0612');
  const groundMat = parkGround(kit);
  const strata = strataTexture(kit);
  const gneiss = gneissTexture(kit);

  // ======================= WEST: the surface world (sunlight + gravity) =======================
  const hoodooMat = kit.track(new T.MeshStandardMaterial({ map: strata, roughness: 0.92, emissive: '#ff9a60', emissiveIntensity: 0 }));
  const capMat = kit.track(new T.MeshStandardMaterial({ color: '#5a4038', roughness: 0.8, flatShading: true }));
  hoodoo(kit, hoodooMat, capMat, -5.35, -3.6, 1.9, 0.42, 1);
  hoodoo(kit, hoodooMat, capMat, -6.15, -2.8, 1.45, 0.36, 2);
  hoodoo(kit, hoodooMat, capMat, -4.8, -2.35, 1.1, 0.3, 3);
  hoodoo(kit, hoodooMat, capMat, -6.55, -4.0, 2.2, 0.46, 4);
  hoodoo(kit, hoodooMat, capMat, -5.65, -1.75, 0.8, 0.28, 5);
  // Rain cloud weathering the hoodoos; rain falls once the attraction wakes.
  kit.cloud([-5.95, 2.75, -3.1], 0.8, '#c9cfe8');
  const rain = kit.motes({ x0: -6.7, x1: -5.1, y0: 0.1, y1: 2.5, z0: -3.8, z1: -2.4 }, 90, '#9fd8ff', { speed: 2.4, size: 0.07, rise: false });
  // A sunlit orb: sunlight powers wind, rain and evaporation.
  const sun = kit.orb([-6.75, 2.15, -0.7], 0.28, GOLD);
  kit.pole([-6.75, 0, -0.7], 1.86, '#c9a878');
  // River from the hoodoos to a delta, where sediment settles into layers.
  const riverMat = riverRibbon(kit, [[-5.75, -2.3], [-5.3, -1.4], [-5.85, -0.5], [-5.35, 0.4], [-5.7, 1.2]], 0.34);
  const sandMat = kit.track(new T.MeshStandardMaterial({ map: sandTexture(kit, true), roughness: 0.95 }));
  const duneMat = kit.track(new T.MeshStandardMaterial({ map: sandTexture(kit, false), roughness: 0.95 }));
  const delta = new T.Mesh(new T.CircleGeometry(0.9, 24, 0, Math.PI), sandMat);
  delta.rotation.x = -Math.PI / 2;
  delta.rotation.z = Math.PI;
  delta.position.set(-5.65, GROUND + 0.03, 1.5);
  delta.scale.set(1, 0.7, 1);
  kit.add(delta);
  // A cut-away block of fresh sandstone: layers pressed and cemented.
  const blockMat = kit.track(new T.MeshStandardMaterial({ map: strata, roughness: 0.9, emissive: '#ffcf90', emissiveIntensity: 0 }));
  const sandBlock = new T.Mesh(new T.BoxGeometry(0.7, 0.55, 0.5), blockMat);
  sandBlock.position.set(-5.05, GROUND + 0.275, 2.55);
  sandBlock.rotation.y = 0.35;
  sandBlock.castShadow = true;
  kit.add(sandBlock);
  for (const [x, z, sx] of [[-6.3, 3.1, 0.7], [-7.1, 2.0, 0.55], [-6.5, 4.2, 0.5]] as V3[]) {
    const dune = new T.Mesh(new T.SphereGeometry(sx, 20, 10, 0, TAU, 0, Math.PI / 2), duneMat);
    dune.scale.set(1.3, 0.35, 0.9);
    dune.position.set(x, GROUND, z);
    dune.receiveShadow = true;
    kit.add(dune);
  }

  // ======================= EAST: the deep world (Earth's inner heat) =======================
  // The volcano: melting and cooling. Glowing lava streams wake on the third discovery.
  const vgeo = new T.CylinderGeometry(0.34, 1.55, 2.5, 28, 6, true);
  const vp = vgeo.attributes.position as THREE.BufferAttribute;
  const vr = rng(8);
  for (let i = 0; i < vp.count; i++) {
    const y = vp.getY(i);
    if (y > 1.2 || y < -1.2) continue;
    const k = 1 + (vr() - 0.5) * 0.12;
    vp.setX(i, vp.getX(i) * k);
    vp.setZ(i, vp.getZ(i) * k);
  }
  vgeo.computeVertexNormals();
  const volcanoMat = kit.track(new T.MeshStandardMaterial({ color: '#4a3842', roughness: 0.88, flatShading: true, emissive: '#ff3a10', emissiveIntensity: 0 }));
  const volcano = new T.Mesh(vgeo, volcanoMat);
  const VX = 5.9;
  const VZ = -4.5;
  volcano.position.set(VX, GROUND + 1.25, VZ);
  volcano.castShadow = true;
  volcano.receiveShadow = true;
  kit.add(volcano);
  const craterMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: MAGMA, emissiveIntensity: 0.3 }));
  const crater = new T.Mesh(new T.CircleGeometry(0.33, 24), craterMat);
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(VX, GROUND + 2.44, VZ);
  kit.add(crater);
  const streams: (THREE.Mesh & { setLit(v: number): void })[] = [];
  for (const a of [1.75, 2.35, 1.15]) {
    const pts: V3[] = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const rad = 0.38 + 1.18 * t;
      const aa = a + Math.sin(k * 1.3 + a) * 0.08;
      pts.push([VX + Math.cos(aa) * rad, GROUND + 2.47 - 2.45 * t, VZ + Math.sin(aa) * rad]);
    }
    streams.push(kit.neonTube(pts, LAVA, { radius: 0.035 }));
  }
  const embers = kit.motes({ x0: VX - 0.5, x1: VX + 0.5, y0: 2.1, y1: 5.5, z0: VZ - 0.5, z1: VZ + 0.5 }, 50, LAVA, { speed: 0.6, size: 0.1 });
  const craterLight = kit.point([VX, GROUND + 2.9, VZ + 0.3], MAGMA, 0.5, 6);

  // The Pressure Works: a press squeezes a layered block until its bands fold (no melting).
  const steel = kit.mats.paintedMetal('#8a7aa8');
  const PX = 6.2;
  const PZ = -0.4;
  const base = new T.Mesh(new T.BoxGeometry(1.1, 0.16, 0.8), steel);
  base.position.set(PX, GROUND + 0.08, PZ);
  base.castShadow = true;
  kit.add(base);
  for (const dx of [-0.45, 0.45]) {
    const col = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.5, 12), kit.mats.chrome());
    col.position.set(PX + dx, GROUND + 0.83, PZ);
    col.castShadow = true;
    kit.add(col);
  }
  const beam = new T.Mesh(new T.BoxGeometry(1.15, 0.18, 0.5), steel);
  beam.position.set(PX, GROUND + 1.62, PZ);
  beam.castShadow = true;
  kit.add(beam);
  const ram = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.6, 12), kit.mats.chrome());
  kit.add(ram);
  const plate = new T.Mesh(new T.BoxGeometry(0.8, 0.08, 0.55), kit.mats.paintedMetal('#c9b8e8'));
  plate.castShadow = true;
  kit.add(plate);
  const pressMat = kit.track(new T.MeshStandardMaterial({ map: strata, roughness: 0.75, emissive: MAGMA, emissiveIntensity: 0 }));
  const pressBlock = new T.Mesh(new T.BoxGeometry(0.62, 0.5, 0.42), pressMat);
  pressBlock.castShadow = true;
  kit.add(pressBlock);
  const heatPadMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: MAGMA, emissiveIntensity: 0.05 }));
  const heatPad = new T.Mesh(new T.BoxGeometry(0.8, 0.03, 0.55), heatPadMat);
  heatPad.position.set(PX, GROUND + 0.175, PZ);
  kit.add(heatPad);
  const squeeze = (sq: number) => {
    const blockH = 0.5 - 0.1 * sq;
    pressBlock.scale.y = blockH / 0.5;
    pressBlock.position.set(PX, GROUND + 0.19 + blockH / 2, PZ);
    plate.position.set(PX, GROUND + 0.19 + blockH + 0.04, PZ);
    const top = GROUND + 1.53;
    ram.position.set(PX, (plate.position.y + top) / 2, PZ);
    ram.scale.y = (top - plate.position.y) / 0.6;
  };
  squeeze(0);

  // Banded gneiss boulders beside the works.
  const gneissMat = kit.track(new T.MeshStandardMaterial({ map: gneiss, roughness: 0.6, metalness: 0.05 }));
  for (const [x, z, sz, seed] of [[7.0, 1.0, 0.36, 3], [4.6, 1.3, 0.24, 6]] as [number, number, number, number][]) {
    const g = new T.Mesh(new T.DodecahedronGeometry(sz, 1), gneissMat);
    g.scale.y = 0.7;
    g.position.set(x, GROUND + sz * 0.55, z);
    g.rotation.set(0.2, seed, 0.1);
    g.castShadow = true;
    kit.add(g);
  }

  // The magma pool: melting. A crust ring of baked rock surrounds it.
  const MX = 5.6;
  const MZ = 2.7;
  const crust = new T.Mesh(new T.TorusGeometry(0.62, 0.16, 8, 28), kit.track(new T.MeshStandardMaterial({ color: '#4a3a44', roughness: 0.85, flatShading: true })));
  crust.rotation.x = Math.PI / 2;
  crust.scale.z = 0.6;
  crust.position.set(MX, GROUND + 0.05, MZ);
  kit.add(crust);
  const poolMat = kit.track(new T.MeshStandardMaterial({ color: '#2a0806', emissive: MAGMA, emissiveIntensity: 0.25, roughness: 0.5 }));
  const pool = new T.Mesh(new T.CircleGeometry(0.6, 28), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(MX, GROUND + 0.07, MZ);
  kit.add(pool);
  const bubbles: THREE.Mesh[] = [];
  const bubbleMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: LAVA, emissiveIntensity: 0.4 }));
  for (let i = 0; i < 4; i++) {
    const bb = new T.Mesh(new T.SphereGeometry(0.06 + i * 0.015, 10, 8), bubbleMat);
    bb.position.set(MX + Math.cos(i * 1.7) * 0.3, GROUND + 0.06, MZ + Math.sin(i * 1.7) * 0.25);
    bubbles.push(bb);
    kit.add(bb);
  }

  // ======================= The branching ore-cart coasters =======================
  const railMat = kit.mats.paintedMetal('#d9a24a');
  const railMatE = kit.mats.paintedMetal('#b9a6e0');
  const tieMat = kit.mats.wood();
  // West: one looping run through the canyon and the delta (weathering, then deposition).
  const west = coasterTrack(kit, [[
    [-4.3, 0.2, 3.9], [-4.25, 0.55, 2.0], [-4.3, 1.45, -0.2], [-4.55, 2.45, -2.5], [-5.2, 2.75, -4.6],
    [-6.3, 2.1, -5.3], [-7.3, 1.0, -4.3], [-7.1, 1.25, -2.6], [-7.35, 0.55, -1.0], [-6.9, 0.9, 0.6],
    [-7.1, 0.5, 2.2], [-6.2, 0.35, 3.8], [-5.1, 0.3, 4.4],
  ]], railMat, tieMat, true, GOLD);
  // East: from the station the track forks. One branch climbs past the volcano crater (melting,
  // then cooling); the other dives through the Pressure Works (heat and pressure, no melting).
  const east = coasterTrack(kit, [
    [[4.35, 0.2, 3.9], [4.25, 0.55, 2.2], [4.25, 1.3, 0.3], [4.3, 2.05, -1.6], [4.5, 2.4, -2.9]],
    [[4.5, 2.4, -2.9], [4.65, 2.75, -4.2], [5.3, 2.95, -5.5], [6.6, 2.6, -5.4], [7.15, 1.7, -4.0], [7.2, 1.05, -2.2], [7.0, 0.85, -0.4], [7.0, 0.8, 1.2]],
    [[4.5, 2.4, -2.9], [4.85, 1.8, -2.3], [5.5, 0.95, -1.5], [6.2, 0.62, -0.4], [6.75, 0.8, 0.5], [7.0, 0.8, 1.2]],
    [[7.0, 0.8, 1.2], [6.95, 0.55, 2.6], [6.4, 0.75, 4.0], [5.4, 0.35, 4.6], [4.35, 0.2, 3.9]],
  ], railMatE, tieMat, false, '#d6b8ff');
  const r = kit.rand(17);
  const cw = oreCart(kit, kit.mats.paintedMetal(CORAL), '#c0a090', 21);
  const ce = oreCart(kit, kit.mats.paintedMetal('#7a6aa8'), '#c0a090', 22);
  const coasters: Coaster[] = [
    { segs: west.segs, lens: west.segs.map((s) => s.getLength()), next: [[0]], cart: cw.cart, rock: cw.rock, seg: 0, u: 0.02, pause: 0 },
    { segs: east.segs, lens: east.segs.map((s) => s.getLength()), next: [[1, 2], [3], [3], [0]], cart: ce.cart, rock: ce.rock, seg: 0, u: 0.02, pause: 0 },
  ];
  // Station platforms with canopies.
  const stationLamps: (THREE.Group & { setLit(v: number): void })[] = [];
  for (const sx of [-1, 1]) {
    const deck = new T.Mesh(new T.BoxGeometry(0.42, 0.1, 0.8), kit.mats.wood());
    deck.position.set(sx * 4.02, GROUND + 0.16, 3.75);
    deck.castShadow = true;
    kit.add(deck);
    for (let k = 0; k < 4; k++) {
      const stripe = new T.Mesh(new T.BoxGeometry(0.5, 0.03, 0.22), kit.mats.paintedMetal(k % 2 ? IVORY : sx < 0 ? CORAL : '#7a6aa8'));
      stripe.position.set(sx * 4.04, GROUND + 1.0 - sx * 0, 3.42 + k * 0.22);
      stripe.rotation.z = sx * 0.22;
      stripe.castShadow = true;
      kit.add(stripe);
    }
    kit.pole([sx * 3.9, 0, 3.45], 0.55);
    kit.pole([sx * 3.9, 0, 4.05], 0.55);
    stationLamps.push(kit.lantern([sx * 4.08, GROUND + 0.88, 3.75], sx < 0 ? GOLD : '#d6b8ff', 0.07));
  }

  // ======================= Signs =======================
  const sedSign = kit.neonSign('SEDIMENTARY', [-5.2, 0.62, 1.15], { height: 0.26, color: SAND, rotY: 0.35 });
  sedSign.rotation.x = -0.6;
  const metSign = kit.neonSign('METAMORPHIC', [5.15, 0.62, 0.9], { height: 0.26, color: SLATE, rotY: -0.35 });
  metSign.rotation.x = -0.6;
  const ignSign = kit.neonSign('IGNEOUS', [5.85, 1.3, -3.5], { height: 0.26, color: MAGMA, rotY: -0.2 });
  ignSign.rotation.x = -0.6;
  const title = kit.neonSign('ROCK-CYCLE ROLLERCOASTER', [-5.4, 0.98, 5.05], { height: 0.36, color: GOLD, rotY: 0.32 });
  title.rotation.x = -0.62;
  kit.pole([-6.0, 0, 4.85], 0.82);
  kit.pole([-4.8, 0, 5.25], 0.82);
  const anyRoute = kit.neonSign('ANY ROCK · ANY ROUTE', [5.4, 0.95, 5.05], { height: 0.26, color: MINT, rotY: -0.32 });
  anyRoute.rotation.x = -0.62;
  kit.pole([4.85, 0, 5.25], 0.82);
  kit.pole([5.95, 0, 4.85], 0.82);
  // Process panels: each one lights when the attraction wakes that part of the cycle.
  const panelMats: { mat: THREE.MeshPhysicalMaterial; at: number }[] = [];
  for (const [text, pos, rotY, at, bg] of [
    ['WEATHERING', [-6.05, 0.45, -1.25], 0.35, 0.4, '#9fd8ff'],
    ['DEPOSITION', [-6.1, 0.32, 2.2], 0.35, 0.7, SAND],
    ['HEAT + PRESSURE', [6.25, 1.98, -0.4], 0, 1.3, '#c9b8e8'],
    ['MELTING', [4.85, 0.42, 2.45], -0.4, 1.6, LAVA],
    ['COOLING', [6.05, 0.4, -2.55], -0.25, 2.3, '#ffd2a0'],
  ] as [string, V3, number, number, string][]) {
    const w = 0.068 * text.length + 0.3;
    const pnl = kit.panel(text, pos, { w, h: 0.2, bg, fg: '#1a1030', rotY });
    pnl.rotation.x = -0.55;
    const front = (pnl.material as THREE.MeshPhysicalMaterial[])[4];
    front.emissive.set('#ffffff');
    front.emissiveMap = front.map;
    front.emissiveIntensity = 0;
    front.needsUpdate = true;
    panelMats.push({ mat: front, at });
  }

  const sand = kit.motes({ x0: -7.6, x1: -4.2, y0: -0.3, y1: 1.6, z0: -1, z1: 5 }, 60, '#ffd9a0', { speed: 0.12, size: 0.07 });
  // Fireworks stay outboard of the cabinet (burst radius ~2.2), never over the playfield.
  const fwW = kit.fireworks({ x0: -7.8, x1: -6.4, y0: 2.0, y1: 2.8, z: -1.8 }, [GOLD, SAND, RIVER, IVORY]);
  const fwE = kit.fireworks({ x0: 6.4, x1: 7.8, y0: 2.0, y1: 2.8, z: -1.8 }, [LAVA, MAGMA, SLATE, GOLD]);
  const fwW2 = kit.fireworks({ x0: -7.8, x1: -6.6, y0: 1.2, y1: 1.9, z: 1.6 }, [MINT, GOLD, SAND]);
  const fwE2 = kit.fireworks({ x0: 6.6, x1: 7.8, y0: 1.2, y1: 1.9, z: 1.8 }, [LAVA, CORAL, GOLD]);

  // Wonderlight eruption: a lava fountain arcs out of the crater and runs down the cone.
  const FN = kit.n(80);
  const fPos = new Float32Array(FN * 3);
  const fGeo = new T.BufferGeometry();
  fGeo.setAttribute('position', new T.BufferAttribute(fPos, 3));
  const fTex = canvasTex(kit, 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,220,150,0.8)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  });
  const fMat = kit.track(new T.PointsMaterial({ color: LAVA, map: fTex, size: 0.16, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  kit.add(new T.Points(fGeo, fMat));
  const fr = rng(61);
  const fVel = new Float32Array(FN * 4);
  for (let i = 0; i < FN; i++) {
    const a = fr() * TAU;
    const sp = 0.45 + fr() * 0.75;
    fVel.set([Math.cos(a) * sp, 0.9 + fr() * 1.0, Math.sin(a) * sp, fr()], i * 4);
    fPos.set([VX, -10, VZ], i * 3);
  }
  let fountainK = 0;
  kit.animate((t) => {
    fMat.opacity = fountainK;
    if (fountainK <= 0.01) return;
    for (let i = 0; i < FN; i++) {
      const age = ((t / 1.15 + fVel[i * 4 + 3]) % 1) * 1.15;
      fPos[i * 3] = VX + fVel[i * 4] * age;
      fPos[i * 3 + 1] = GROUND + 2.44 + fVel[i * 4 + 1] * age - 2.2 * age * age;
      fPos[i * 3 + 2] = VZ + fVel[i * 4 + 2] * age;
    }
    fGeo.attributes.position.needsUpdate = true;
  });
  kit.spot([-3.4, 8.5, 4.5], [-5.8, 0.6, -1.8], '#ffbb88', 40, 0.5);
  kit.spot([3.4, 8.5, 4.5], [5.9, 0.6, -1.2], '#c8a8ff', 36, 0.5);

  // ======================= Animation =======================
  const pos = new T.Vector3();
  const tan = new T.Vector3();
  const look = new T.Vector3();
  const cSed = new T.Color(SAND);
  const cSand = new T.Color('#e6c28c');
  const cMelt = new T.Color(LAVA);
  const cBasalt = new T.Color('#3a3040');
  const cMet = new T.Color('#c8bcdc');
  let speedK = 0;
  let pressK = 0;
  let pulse = 0;
  let pressPhase = 0;
  let gneissShown = false;
  const placeCart = (c: Coaster) => {
    const curve = c.segs[c.seg];
    curve.getPointAt(c.u, pos);
    curve.getTangentAt(c.u, tan);
    c.cart.position.copy(pos);
    c.cart.position.y += 0.02;
    look.copy(c.cart.position).add(tan);
    c.cart.lookAt(look);
  };
  /** The sample's look follows the process it is riding through. */
  const tintRock = (c: Coaster, isEast: boolean) => {
    const m = c.rock;
    if (!isEast) {
      // west loop: weathered into loose grains in the canyon, settled into sandstone at the delta
      if (c.u > 0.35 && c.u < 0.7) m.color.copy(cSand);
      else if (c.u >= 0.7) m.color.copy(cSed);
      m.emissiveIntensity = 0;
      return;
    }
    if (c.seg === 1) {
      // volcano branch: melts near the crater, then cools into dark igneous rock
      const melt = c.u < 0.35 ? c.u / 0.35 : Math.max(0, 1 - (c.u - 0.35) / 0.45);
      m.color.copy(cBasalt).lerp(cMelt, melt);
      m.emissive.copy(cMelt);
      m.emissiveIntensity = melt * 1.6;
    } else if (c.seg === 2) {
      // pressure branch: squeezed into banded metamorphic rock while staying solid
      if (c.u > 0.45) m.color.copy(cMet);
      m.emissive.copy(cMelt);
      m.emissiveIntensity = Math.max(0, 0.5 - Math.abs(c.u - 0.55) * 2) * 0.6;
    } else {
      m.emissiveIntensity = 0;
    }
  };
  for (const c of coasters) placeCart(c);
  kit.animate((t, dt) => {
    for (let i = 0; i < coasters.length && speedK > 0.001; i++) {
      const c = coasters[i];
      if (c.pause > 0) {
        c.pause -= dt;
        continue;
      }
      c.segs[c.seg].getTangentAt(c.u, tan);
      const v = speedK * (0.9 + 1.4 * Math.max(0, -tan.y) - 0.35 * Math.max(0, tan.y));
      c.u += (v * dt) / c.lens[c.seg];
      if (c.u >= 1) {
        const opts = c.next[c.seg];
        const nx = opts.length > 1 ? opts[r() < 0.5 ? 0 : 1] : opts[0];
        // Brief stop at the station (end of the west loop, or the east return leg).
        if (opts.length === 1 && (i === 0 || c.seg === 3)) c.pause = 0.8;
        c.u = Math.min(0.2, c.u - 1);
        c.seg = nx;
      }
      placeCart(c);
      tintRock(c, i === 1);
    }
    // The press squeezes in a slow rhythm; bubbles rise in the magma pool.
    pressPhase += dt * (0.5 + 1.2 * speedK);
    squeeze((0.5 + 0.5 * Math.sin(pressPhase)) * pressK);
    for (let k = 0; k < bubbles.length; k++) bubbles[k].position.y = GROUND + 0.04 + Math.max(0, Math.sin(t * 1.3 + k * 1.9)) * 0.08;
  });

  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      const flick = kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 6.1) * Math.sin(t * 2.3);
      speedK = 0.25 * s1 + 0.6 * s2 + 0.5 * s3 + 0.8 * s4;
      pressK = 0.3 + 0.7 * s2;
      // West
      hoodooMat.emissiveIntensity = 0.03 + 0.1 * s1 + 0.12 * s4 + 0.1 * pulse;
      blockMat.emissiveIntensity = 0.02 + 0.12 * s1 + 0.1 * s4;
      rain.setLit(0.05 + 0.85 * s1);
      sun.setLit(0.35 + 0.65 * s0 + 0.3 * s4);
      riverMat.emissiveIntensity = 0.04 + 0.2 * s1 + 0.3 * s4;
      sand.setLit(0.15 + 0.4 * s1 + 0.3 * s4);
      sedSign.setLit(0.15 + 0.85 * s1);
      // East
      craterMat.emissiveIntensity = (0.25 + 1.2 * s1 + 2.4 * s3 + 1.5 * pulse) * flick;
      for (let i = 0; i < streams.length; i++) streams[i].setLit(Math.max(0.03, kit.stage(level, 2.2 + i * 0.25, 3 + i * 0.2)) * flick);
      embers.setLit(0.05 + 0.5 * s3 + 0.45 * s4);
      if (craterLight) craterLight.intensity = (0.5 + 3 * s1 + 9 * s3 + 6 * pulse) * flick;
      poolMat.emissiveIntensity = (0.3 + 0.9 * s1 + 1.0 * s2) * flick;
      bubbleMat.emissiveIntensity = 0.4 + 1.6 * s2;
      heatPadMat.emissiveIntensity = 0.05 + 2.2 * s2 * (0.6 + 0.4 * energy);
      pressMat.emissiveIntensity = 0.02 + 0.25 * s2;
      // After the second discovery the squeezed block has folded into banded gneiss.
      const wantGneiss = level >= 1.6;
      if (wantGneiss !== gneissShown) {
        gneissShown = wantGneiss;
        pressMat.map = wantGneiss ? gneiss : strata;
        pressMat.needsUpdate = true;
      }
      metSign.setLit(0.15 + 0.85 * s1);
      ignSign.setLit(0.15 + 0.85 * s1);
      title.setLit(0.3 + 0.45 * s2 + 0.25 * s3);
      west.bulbMat.emissiveIntensity = 0.05 + 1.6 * s1 + 1.6 * s4 + 1.2 * pulse;
      east.bulbMat.emissiveIntensity = 0.05 + 1.6 * s1 + 1.6 * s4 + 1.2 * pulse;
      for (const l of stationLamps) l.setLit(0.4 + 0.6 * s1);
      anyRoute.setLit(0.1 + 0.9 * s3);
      // Panels glow softly but never wash out their lettering.
      for (const p of panelMats) p.mat.emissiveIntensity = 0.16 * kit.stage(level, p.at, p.at + 0.7) + 0.06 * s4;
      groundMat.emissiveIntensity = (0.3 * s3 + 0.65 * s4 + 0.35 * pulse) * flick;
      volcanoMat.emissiveIntensity = (0.02 * s1 + 0.05 * s3 + 0.08 * s4 + 0.12 * pulse) * flick;
      fountainK = Math.max(s4, pulse);
      fwW.setLit(s4);
      fwE.setLit(s4);
      fwW2.setLit(s4);
      fwE2.setLit(s4);
      pulse = Math.max(0, pulse - dt * 0.8);
    },
    celebrate(p) {
      const k = Math.sin(p * Math.PI);
      pulse = Math.max(pulse, k);
      fwW.setLit(k);
      fwE.setLit(k);
      fwW2.setLit(k);
      fwE2.setLit(k);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const rockRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const strata = strataTexture(kit);
  const gneiss = gneissTexture(kit);
  const floor = new T.Mesh(new T.BoxGeometry(2.0, 0.04, 1.7), kit.mats.plastic('#4a3030'));
  floor.position.y = 0.02;
  kit.add(floor);
  // a little volcano with a glowing crater
  const v = new T.Mesh(new T.CylinderGeometry(0.1, 0.42, 0.62, 16, 1, true), kit.mats.plastic('#3a2c38'));
  v.position.set(0.47, 0.35, -0.45);
  kit.add(v);
  const craterMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: MAGMA, emissiveIntensity: 0.2 }));
  const crater = new T.Mesh(new T.CircleGeometry(0.1, 16), craterMat);
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(0.47, 0.66, -0.45);
  kit.add(crater);
  // two lava streams down the cone's front, lit as the room wakes
  const lava = [1.15, 1.95].map((a) => kit.neonTube(
    [0.11, 0.2, 0.31, 0.43].map((rad, i) => [0.47 + Math.cos(a + i * 0.06) * rad, 0.65 - i * 0.2, -0.45 + Math.sin(a + i * 0.06) * rad] as [number, number, number]),
    LAVA, { radius: 0.012 },
  ));
  // a hoodoo of layered sandstone
  const hd = new T.Mesh(new T.CylinderGeometry(0.07, 0.13, 0.62, 10), kit.track(new T.MeshStandardMaterial({ map: strata, roughness: 0.9 })));
  hd.position.set(-0.6, 0.35, -0.45);
  kit.add(hd);
  const cap = new T.Mesh(new T.DodecahedronGeometry(0.1, 0), kit.mats.plastic('#5a4038'));
  cap.scale.y = 0.5;
  cap.position.set(-0.6, 0.69, -0.45);
  kit.add(cap);
  // a mini coaster hill arcing between them
  const pts = [[-0.85, 0.06, 0.2], [-0.45, 0.55, 0.05], [0, 0.85, -0.05], [0.45, 0.5, 0.05], [0.85, 0.06, 0.2]].map((q) => new T.Vector3(q[0], q[1], q[2]));
  const railMat = kit.mats.paintedMetal('#d9a24a');
  for (const dz of [-0.04, 0.04]) {
    kit.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((q) => q.clone().setZ(q.z + dz))), 40, 0.008, 5), railMat));
  }
  const lightMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: GOLD, emissiveIntensity: 0.1 }));
  kit.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((q) => q.clone().setY(q.y - 0.03))), 40, 0.005, 4), lightMat));
  // the three rock families on a specimen shelf
  const shelf = new T.Mesh(new T.BoxGeometry(0.9, 0.04, 0.24), kit.mats.wood());
  shelf.position.set(0, 0.28, 0.45);
  kit.add(shelf);
  const sedR = new T.Mesh(new T.BoxGeometry(0.16, 0.12, 0.12), kit.track(new T.MeshStandardMaterial({ map: strata, roughness: 0.9 })));
  sedR.position.set(-0.28, 0.36, 0.45);
  const metR = new T.Mesh(new T.DodecahedronGeometry(0.08, 0), kit.track(new T.MeshStandardMaterial({ map: gneiss, roughness: 0.6 })));
  metR.position.set(0.28, 0.37, 0.45);
  const iMat = kit.track(new T.MeshStandardMaterial({ color: '#e0b0b8', roughness: 0.7, emissive: MAGMA, emissiveIntensity: 0 }));
  const ignR = new T.Mesh(new T.IcosahedronGeometry(0.08, 0), iMat);
  ignR.position.set(0, 0.37, 0.45);
  kit.add(sedR);
  kit.add(metR);
  kit.add(ignR);
  const cart = new T.Mesh(new T.BoxGeometry(0.12, 0.07, 0.09), kit.mats.paintedMetal(CORAL));
  kit.add(cart);
  const curve = new T.CatmullRomCurve3(pts);
  const p = new T.Vector3();
  return {
    update(t, lit) {
      craterMat.emissiveIntensity = 0.2 + 2.6 * lit;
      for (const l of lava) l.setLit(Math.max(0.05, lit));
      lightMat.emissiveIntensity = 0.1 + 2.4 * lit;
      iMat.emissiveIntensity = 0.3 * lit;
      const u = kit.reducedMotion ? 0.5 : 0.5 + 0.48 * Math.sin(t * 0.8);
      curve.getPointAt(u, p);
      cart.position.set(p.x, p.y + 0.05, p.z);
    },
  };
};

// ---------------------------------------------------------------- definition

export const L17: TableDef = {
  lessonId: 'L17',
  signature: 'Twin coaster ramps and a magma portal: rock material takes many routes, in no set order',
  ballRole: 'The Wonderball is a game token standing in for a bit of rock material. Many real rock-cycle changes take thousands to millions of years, not a few seconds on a coaster.',
  theme: {
    bg: ['#3a1f3c', '#1a1026'],
    rail: '#e0c6a8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#d9f2ff',
    bumperRing: '#3b2a4a',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(255,170,110,0.18)',
    trail: MINT,
  },
  lines: {
    intro: 'Welcome aboard the Rock-Cycle Rollercoaster! Every track here is a real way rock gets worn down, built up, squeezed or melted into something new.',
    quark: '"Surely a rock has to melt before it can turn into a different kind of rock," Professor Quark wonders, tapping a slab of marble.',
    pipTip: 'Launch away: the Cavern Chute drops your first ball onto the crystals. Later, the Sediment Slide feeds the left flipper for a Pressure Plunge.',
  },
  build,
  skillShot: 'lane_heat',
  onProgress(rt, { slot, stage }) {
    rt.get<Diverter>('cavern_chute').set(slot === 0 && stage === 0 ? 1 : 0);
  },
  shots: [
    { id: 'weathering', label: 'Wind & Rain Loop', on: [{ type: 'shot', id: 'wind_sw' }], insert: 'ins_wind' },
    { id: 'deposition', label: 'Sediment Slide', on: [{ type: 'ramp', id: 'slide_ramp' }], insert: 'ins_slide' },
    { id: 'pressure', label: 'Pressure Plunge', on: [{ type: 'ramp', id: 'plunge_ramp' }], insert: 'ins_plunge' },
    { id: 'melting', label: 'Magma Chamber', on: [{ type: 'portal', id: 'magma_portal' }], insert: 'ins_magma' },
    { id: 'cooling', label: 'Volcano Crater', on: [{ type: 'rollover', id: 'crater' }] },
    { id: 'station', label: 'Sample Station', on: [{ type: 'saucer', id: 'station' }], insert: 'ins_station' },
    { id: 'specimens', label: 'Rock specimens', on: [{ type: 'target', group: 'specimens' }], insert: 'ins_specimens' },
    { id: 'crystals', label: 'Crystal Cavern', on: [{ type: 'bumper', group: 'crystals' }], insert: 'ins_crystals' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Rock Spotter',
      brief: 'Ping the quartz, feldspar and mica crystals found in granite, then find one specimen of each rock family.',
      objectiveIds: ['L17-O1'],
      stages: [
        { kind: 'collect', text: 'Hit granite\'s mineral crystals 5 times', match: { type: 'bumper', group: 'crystals' }, count: 5, preview: ['crystals'] },
        { kind: 'collect', text: 'Find IGNEOUS, SEDIMENTARY and METAMORPHIC', match: { type: 'target', group: 'specimens' }, count: 3, distinct: true, lamps: ['spec_ign', 'spec_sed', 'spec_met'], preview: ['specimens'] },
        { kind: 'discover', text: 'Examine your rocks at the Sample Station', pocket: 'station', questions: 1 },
      ],
      discovery: 'Most rocks are built from minerals. Igneous rock hardens from melted rock, sedimentary rock often forms from settled bits pressed and cemented, and metamorphic rock is changed by heat and pressure while solid.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Switch the Tracks',
      brief: 'Build sandstone on the Sediment Slide, then choose how to change it: squeeze it on the Pressure Plunge or melt it in the Magma Chamber.',
      objectiveIds: ['L17-O3', 'L17-O2'],
      stages: [
        { kind: 'shots', text: 'Ride the Sediment Slide to build sandstone', shots: ['deposition'] },
        { kind: 'shots', text: 'Change it: Pressure Plunge or Magma Chamber', shots: ['pressure', 'melting'], order: 'any', count: 1 },
        { kind: 'discover', text: 'Report the new rock at the Sample Station', pocket: 'station', questions: 1 },
      ],
      discovery: 'Heat and pressure can turn quartz sandstone into quartzite while it stays solid. Melting is a separate track: the magma cools into igneous rock, growing bigger crystals the slower it cools.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'No Timetable',
      brief: 'Run any three different processes in any order, then show why no rock has to follow one set route.',
      objectiveIds: ['L17-O4', 'L17-O5'],
      stages: [
        { kind: 'shots', text: 'Run any 3 different processes, any order', shots: ['weathering', 'deposition', 'pressure', 'melting', 'cooling'], order: 'any', count: 3 },
        { kind: 'discover', text: 'Map your route at the Sample Station', pocket: 'station', questions: 1, types: ['classify', 'match'] },
      ],
      discovery: 'The rock cycle has no set order: any rock can be weathered, squeezed or melted next. Sunlight, gravity and Earth\'s inner heat power each change, and the conditions a rock meets decide its route.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Full-Cycle Spectacular',
    brief: 'Send the Wonderball down every track, then bring it home to the Sample Station.',
    stages: [
      { kind: 'shots', text: 'Sun + gravity tracks: Wind & Rain Loop, Sediment Slide', shots: ['weathering', 'deposition'], order: 'any' },
      { kind: 'shots', text: 'Inner-heat tracks: Pressure Plunge, Magma Chamber', shots: ['pressure', 'melting'], order: 'any' },
      { kind: 'discover', text: 'Final report at the Sample Station', pocket: 'station', questions: 2 },
    ],
    celebration: 'Every track is glowing! Weathered, squeezed, melted and cooled, the same rock material keeps getting recycled. The Wonderlight is yours!',
  },
  set: rockSet,
  room: rockRoom,
  icons: {
    lens(ctx, s) {
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.15, s * 0.5, 0, TAU);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.22;
      ctx.beginPath();
      ctx.moveTo(s * 0.22, s * 0.22);
      ctx.lineTo(s * 0.75, s * 0.75);
      ctx.stroke();
    },
    quartz(ctx, s) {
      // six-sided prism with a pointed tip
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.95);
      ctx.lineTo(s * 0.42, -s * 0.5);
      ctx.lineTo(s * 0.42, s * 0.75);
      ctx.lineTo(-s * 0.42, s * 0.75);
      ctx.lineTo(-s * 0.42, -s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.95);
      ctx.lineTo(0, s * 0.75);
      ctx.stroke();
    },
    feldspar(ctx, s) {
      // blocky slanted crystal
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.35);
      ctx.lineTo(-s * 0.2, -s * 0.8);
      ctx.lineTo(s * 0.75, -s * 0.4);
      ctx.lineTo(s * 0.7, s * 0.45);
      ctx.lineTo(s * 0.2, s * 0.85);
      ctx.lineTo(-s * 0.75, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.35);
      ctx.lineTo(s * 0.25, s * 0.05);
      ctx.lineTo(s * 0.75, -s * 0.4);
      ctx.moveTo(s * 0.25, s * 0.05);
      ctx.lineTo(s * 0.2, s * 0.85);
      ctx.stroke();
    },
    mica(ctx, s) {
      // a stack of thin flaky sheets
      for (let i = 0; i < 4; i++) {
        const y = -s * 0.6 + i * s * 0.38;
        ctx.beginPath();
        ctx.moveTo(-s * 0.8 + i * s * 0.06, y);
        ctx.lineTo(s * 0.55 + i * s * 0.08, y - s * 0.12);
        ctx.lineTo(s * 0.8 - i * s * 0.04, y + s * 0.12);
        ctx.lineTo(-s * 0.6, y + s * 0.24);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintPlayfield(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s1 = stage(level, 0.2, 1);
      const s2 = stage(level, 1.1, 2);
      const s3 = stage(level, 2.1, 3);
      if (!reduced && s1 > 0) {
        // rain over the loop, sand drifting at the delta
        ctx.save();
        ctx.strokeStyle = rgba('#bfe6ff', 0.35 * s1);
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 14; i++) {
          const x = 60 + ((i * 37) % 90);
          const y = 190 + ((t * 160 + i * 53) % 90);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + 9);
          ctx.stroke();
        }
        ctx.restore();
        drift(ctx, 5, 10, t, SAND, [40, 640, 170, 760], 8, 1.4, 0.35 * s1);
      }
      // magma chamber and crater breathe
      const breathe = reduced ? 0.8 : 0.7 + 0.3 * Math.sin(t * 1.7);
      glowDot(ctx, 521, 520, 70, MAGMA, (0.08 + 0.22 * s2) * breathe * (0.8 + 0.4 * energy));
      glowDot(ctx, CRATER[0], 292, 24, LAVA, (0.05 + 0.4 * s3) * breathe);
      if (!reduced && level >= 3.9) {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.35 + i / 3) % 1;
          const cx = 140 + i * 150;
          const cy = 150 + (i % 2) * 40;
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * TAU;
            glowDot(ctx, cx + Math.cos(a) * ph * 46, cy + Math.sin(a) * ph * 46, 6, [GOLD, LAVA, MINT][(i + k) % 3], 0.55 * (1 - ph));
          }
        }
      }
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(STATION[0], STATION[1], 10, STATION[0], STATION[1], 440);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(LAVA, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + t * 0.4;
        const d = 60 + p * 260;
        glowDot(ctx, STATION[0] + Math.cos(a) * d, STATION[1] + Math.sin(a) * d * 0.8, 10, [GOLD, LAVA, MINT, SAND][i % 4], 1 - p);
      }
    },
  },
};
export default L17;
