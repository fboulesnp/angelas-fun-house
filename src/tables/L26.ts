// Lesson 26 — Mass Wasting, Tsunamis, and Floods — "Stormwater Harbor"
// A miniature harbor on a stormy night. The Slope Lab hill carries the same slope at three
// angles (80° cliff, 45° face, 15° face) as drop banks; MOON / WIND / QUAKE lanes ask what really
// moves the sea; the Flood Gauge splits flood water into RUNOFF and SURGE; the Sea Wall orbit
// carries the DART warning chain (SENSOR -> BUOY -> SATELLITE); the Drainage Channel ramp
// arcs over the harbor; and the Flood Gate (the signature) swings shut across the Harbor Watch
// basin while the storm builds, opening only when the Wonder Pocket is lit.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Diverter } from '../game/table/mechanisms.ts';
import type { Ball } from '../game/physics/ball.ts';
import type { Collider, ContactInfo } from '../game/physics/types.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import { TAU, glowDot, mix, neonPath, neonText, rgba, rng, rrect, stage, vgrad } from '../game/render/art.ts';

type P2 = [number, number];

// ================================================================ palette

const NIGHT = '#0d1528';
const STORM = '#1b2b48';
const SEA = '#17506a';
const SEA_DEEP = '#0c2c42';
const FOAM = '#d8f3ff';
const GOLD = '#FFC75B';
const ORANGE = '#FF9F5A';
const CORAL = '#FF7F86';
const TEAL = '#6FE3D6';
const GRASS = '#5f9a55';
const MOSS = '#3f6a45';
const SOIL = '#7a5236';
const STONE = '#8a8fa3';
const IVORY = '#FFF7E7';
const RAIN = '#9fd8ff';
const DAWN = '#ffb27a';

// ================================================================ shared layout

/** Harbor basin (the Wonder Pocket cup) and its Flood Gate arms. */
const BASIN = { x: 178, y: 462, half: 28, top: 432, mouth: 496 };
const GATE_LEN = 28;
// Open: the left arm flares out to funnel right-flipper shots; the right arm hangs straight down.
// (Flared to 68° it formed a V-pocket with the Drainage Channel base that trapped balls at 231,519.)
const GATE_OPEN = [112, 90] as const; // left arm, right arm
const GATE_SHUT = [-8, 188] as const; // arms meet across the mouth

/** The Slope Lab hill: summit junction, cliff top, then cliff, steep and gentle faces. */
const HILL: P2[] = [[548, 338], [428, 370], [436, 424], [472, 460], [540, 478], [548, 480]];

/** Flood Gauge on the right wall: RUNOFF (upper) and SURGE (lower) target ends. */
const GAUGE: P2[] = [[522, 520], [531, 565], [532, 571], [541, 616]];

/** Drainage Channel: up from the harbor front, over the basin, down along the sea wall. */
const RAMP_X = 258;
const RAMP_PATH: P2[] = [
  [RAMP_X, 612], [RAMP_X, 520], [250, 432], [222, 376], [170, 342], [114, 334], [70, 368], [52, 440], [48, 600], [62, 730], [83, 806],
];

/** Point on the ray from the arch centre through `p`, at radius `r` (just inside the arch). */
function archPoint(p: P2, r: number): P2 {
  const dx = p[0] - FRAME.archCx;
  const dy = p[1] - FRAME.archCy;
  const l = Math.hypot(dx, dy);
  return [FRAME.archCx + (dx / l) * r, FRAME.archCy + (dy / l) * r];
}

// ================================================================ mechanisms

/**
 * One arm of the storm-surge barrier. It only swings while no ball is in the harbor basin or the
 * gate's sweep, and while shut it reports hits so a closed barrier can be tested.
 */
class FloodGateArm extends Diverter {
  /** Shared by both arms so one hit on the closed barrier counts once. */
  shared: { lastHit: number };
  constructor(rt: TableRuntime, id: string, pivot: P2, deg: readonly [number, number], shared: { lastHit: number }) {
    super(rt, id, pivot[0], pivot[1], GATE_LEN, deg[0], deg[1]);
    this.shared = shared;
    this.group = 'floodgate';
    this.label = 'FLOOD GATE';
  }
  update(dt: number) {
    if (this.pending !== null) {
      const busy = this.rt.world.balls.some((b) => b.state !== 'drained' && b.x > BASIN.x - BASIN.half - 16 && b.x < BASIN.x + BASIN.half + 16 && b.y > BASIN.top - 20 && b.y < BASIN.mouth + 44);
      if (busy) {
        this.hitFlash = Math.max(0, this.hitFlash - dt);
        return;
      }
    }
    super.update(dt);
  }
  onContact(_c: Collider, ball: Ball, info: ContactInfo) {
    if (this.position !== 1 || info.impact < 140) return;
    const t = this.rt.time;
    if (t - this.shared.lastHit < 0.3) return;
    this.shared.lastHit = t;
    this.hitFlash = 0.35;
    this.rt.emit({ type: 'target', id: this.id, group: 'floodgate', ball, x: BASIN.x, y: BASIN.mouth });
  }
}

function slopeBank(b: TableBuilder, id: string, a: P2, c: P2, count: number, label: string, pad: number) {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // (nx, ny) points into the hill; the targets stand 9 units out from the face
  const nx = uy;
  const ny = -ux;
  const gap = 5;
  const size = (len - pad * 2 - gap * (count - 1)) / count;
  const x = a[0] + ux * pad - nx * 9;
  const y = a[1] + uy * pad - ny * 9;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  b.dropBank(id, x, y, deg, count, { size, gap, group: 'slopes', labels: Array(count).fill(label) });
}

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'both' });

  // --- Sea Wall orbit (left) with the DART warning chain on its inner face ---
  b.wall([[74, 640], [74, 380]], { id: 'seawall_inner', r: 3 });
  b.post(74, 376, 5);
  b.shotSwitch('seawall_sw', 49, 470, -90);
  b.gate('seawall_deflect', [FRAME.left, 646], [54, 694], -90);
  b.target('dart_sensor', [80, 612], [80, 574], { group: 'dart', label: 'SENSOR' });
  b.target('dart_buoy', [80, 534], [80, 496], { group: 'dart', label: 'BUOY' });
  b.target('dart_sat', [80, 456], [80, 418], { group: 'dart', label: 'SATELLITE' });

  // --- Storm-cloud bumpers up under the arch ---
  for (const [id, x, y] of [['cloud_a', 320, 106], ['cloud_b', 404, 106], ['cloud_c', 362, 208]] as [string, number, number][]) {
    b.bumper(id, x, y, { group: 'clouds', r: 22, icon: 'cloud', kick: 900 });
  }

  // --- What moves the sea? MOON / WIND / QUAKE lanes guard the way into the storm ---
  const laneXs = [316, 362, 408];
  ['MOON', 'WIND', 'QUAKE'].forEach((l, i) => b.rollover(`sea_${l.toLowerCase()}`, laneXs[i], 292, { group: 'movers', label: l }));
  for (const gx of [293, 339, 385, 431]) {
    b.wall([[gx, 272], [gx, 312]], { r: 3 });
    b.post(gx, 270, 5);
  }
  // Storm walls: the storm cell drains back out through the three lanes. Two one-way gates up
  // at the arch let a launched ball sail over the top (right to left) but catch slower balls.
  b.wall([[293, 270], [266, 196], [260, 132]], { id: 'storm_wall_l', r: 4 });
  b.wall([[431, 270], [454, 204], [462, 150]], { id: 'storm_wall_r', r: 4 });
  b.gate('storm_gate_l', [260, 132], archPoint([260, 132], 280), 163);
  b.gate('storm_gate_r', [462, 150], archPoint([462, 150], 280), -135);

  // --- Harbor basin: the Harbor Watch (Wonder Pocket) behind the Flood Gate ---
  const L = BASIN.x - BASIN.half;
  const R = BASIN.x + BASIN.half;
  b.wall([[L, BASIN.mouth], [L, BASIN.top + 10], [BASIN.x, BASIN.top], [R, BASIN.top + 10], [R, BASIN.mouth]], { id: 'basin', r: 4 });
  b.saucer('harbor_watch', BASIN.x, BASIN.y, { role: 'pocket', ejectDeg: 80, ejectSpeed: 760, captureMaxSpeed: 2400, label: 'WATCH', icon: 'buoy' });
  const shared = { lastHit: -1 };
  b.rt.add(new FloodGateArm(b.rt, 'gate_left', [L, BASIN.mouth], [GATE_OPEN[0], GATE_SHUT[0]], shared));
  b.rt.add(new FloodGateArm(b.rt, 'gate_right', [R, BASIN.mouth], [GATE_OPEN[1], GATE_SHUT[1]], shared));

  // --- Slope Lab hill: three slope models at three angles (drop banks on its faces) ---
  b.wall(HILL, { id: 'hill', r: 4, closed: true });
  slopeBank(b, 'slope_cliff', HILL[1], HILL[2], 1, '80°', 8);
  slopeBank(b, 'slope_steep', HILL[2], HILL[3], 2, '45°', 2);
  slopeBank(b, 'slope_gentle', HILL[3], HILL[4], 3, '15°', 4);
  b.rollover('summit', 488, 339, { label: 'SUMMIT' });

  // --- Flood Gauge on the right wall: the two flood sources, RUNOFF and SURGE ---
  // A slanted cap above the gauge sheds balls that roll down the wall from the hill.
  // The gauge leans out at the top so its face turns toward the left flipper; the cap and the
  // tight joints seal the wedge behind the two targets.
  b.wall([[FRAME.laneSep - 1, 497], [523, 515]], { id: 'gauge_cap', r: 3 });
  b.target('flood_runoff', GAUGE[0], GAUGE[1], { group: 'flood', label: 'RUNOFF' });
  b.target('flood_surge', GAUGE[2], GAUGE[3], { group: 'flood', label: 'SURGE' });
  // keep balls that hug the shooter-lane wall out of the right outlane
  b.gate('right_deflect', [FRAME.laneSep - 2, 634], [496, 700], -90);

  // --- Drainage Channel ramp: from the harbor front, over the basin, down the sea wall ---
  b.wall([[RAMP_X - 34, 676], [RAMP_X - 19, 612]], { r: 3 });
  b.wall([[RAMP_X + 36, 672], [RAMP_X + 19, 612]], { r: 3 });
  b.ramp('drain_ramp', { path: RAMP_PATH, width: 34, footprintTo: 0, label: 'DRAINAGE CHANNEL' });
  // Ramp footprint under the climb, with a peaked cap so nothing can rest on it.
  b.wall([[RAMP_X - 19, 612], [RAMP_X - 19, 532], [RAMP_X, 512], [RAMP_X + 19, 532], [RAMP_X + 19, 612]], { id: 'drain_ramp_base', r: 3, style: 'invisible' });

  // --- Inserts ---
  b.insert('ins_seawall', 49, 600, { deg: -90 });
  b.insert('ins_drain', RAMP_X, 708, { deg: -90, label: 'CHANNEL' });
  b.insert('ins_gate', BASIN.x, 566, { deg: -90 });
  b.insert('ins_slopes', 402, 548, { deg: -55, label: 'SLOPES' });
  b.insert('ins_flood', 478, 560, { deg: -10, label: 'FLOOD' });
  b.insert('ins_sensor', 104, 593, { shape: 'circle', size: 8 });
  b.insert('ins_buoy', 104, 515, { shape: 'circle', size: 8 });
  b.insert('ins_sat', 104, 437, { shape: 'circle', size: 8 });
  b.insert('ins_clouds', 362, 150, { shape: 'star', size: 11 });
  b.insert('ins_lanes', 362, 346, { shape: 'star', size: 10 });
}

// ================================================================ printed playfield (2D)

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

/** Small readable printed label, optionally rotated. */
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
  ctx.strokeStyle = `rgba(6,12,28,${0.8 * alpha})`;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A soft storm-cloud mass built from overlapping puffs, lit along its top by `glow`. */
function stormCloud(ctx: CanvasRenderingContext2D, seed: number, cx: number, cy: number, w: number, h: number, body: string, rim: string, glow: number) {
  const r = rng(seed);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    puffs.push([cx - w / 2 + u * w + (r() - 0.5) * 12, cy + (r() - 0.5) * h * 0.5 - Math.sin(u * Math.PI) * h * 0.35, h * (0.32 + r() * 0.28)]);
  }
  ctx.save();
  ctx.fillStyle = body;
  for (const [x, y, rr] of puffs) {
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
  }
  if (glow > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [x, y, rr] of puffs) {
      const g = ctx.createRadialGradient(x, y - rr * 0.6, rr * 0.1, x, y - rr * 0.3, rr);
      g.addColorStop(0, rgba(rim, 0.35 * glow));
      g.addColorStop(1, rgba(rim, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wall: string, roof: string, lit: number) {
  ctx.fillStyle = wall;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 3, y - h);
  ctx.lineTo(x, y - h - w * 0.45);
  ctx.lineTo(x + w / 2 + 3, y - h);
  ctx.closePath();
  ctx.fill();
  const win = lit > 0.02 ? rgba(GOLD, 0.35 + 0.65 * lit) : 'rgba(20,26,44,0.85)';
  ctx.fillStyle = win;
  ctx.fillRect(x - w * 0.28, y - h * 0.68, w * 0.2, h * 0.28);
  ctx.fillRect(x + w * 0.08, y - h * 0.68, w * 0.2, h * 0.28);
  if (lit > 0.02) glowDot(ctx, x, y - h * 0.55, w * 0.9, GOLD, 0.25 * lit);
}

function boat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hull: string, cabin: string, lit: number, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  ctx.fillStyle = 'rgba(4,10,24,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.5, s * 1.3, s * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-s * 1.2, 0);
  ctx.lineTo(s * 1.25, 0);
  ctx.lineTo(s * 0.9, s * 0.42);
  ctx.lineTo(-s * 0.95, s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cabin;
  ctx.fillRect(-s * 0.55, -s * 0.5, s * 0.75, s * 0.5);
  ctx.fillStyle = lit > 0.02 ? rgba(GOLD, 0.4 + 0.6 * lit) : 'rgba(20,26,44,0.8)';
  ctx.fillRect(-s * 0.42, -s * 0.38, s * 0.22, s * 0.2);
  ctx.fillRect(-s * 0.12, -s * 0.38, s * 0.22, s * 0.2);
  ctx.strokeStyle = 'rgba(230,236,250,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, 0);
  ctx.lineTo(s * 0.5, -s * 1.05);
  ctx.stroke();
  if (lit > 0.02) glowDot(ctx, s * 0.5, -s * 1.08, s * 0.5, CORAL, 0.8 * lit);
  ctx.restore();
}

/** Lab-tray frame around a slope bank: an outline parallel to the face plus an angle mark. */
function slopeTray(ctx: CanvasRenderingContext2D, a: P2, c: P2, name: string, deg: string, color: string, lit: number, labelAt: P2) {
  const dx = c[0] - a[0];
  const dy = c[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const o = 30;
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = rgba(color, 0.35 + 0.55 * lit);
  ctx.lineWidth = 2;
  poly(ctx, [[a[0] - ux * 6, a[1] - uy * 6], [c[0] + ux * 6, c[1] + uy * 6], [c[0] + ux * 6 + nx * o, c[1] + uy * 6 + ny * o], [a[0] - ux * 6 + nx * o, a[1] - uy * 6 + ny * o]]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  label(ctx, name, labelAt[0], labelAt[1], 10, color, 0.6 + 0.4 * lit);
  label(ctx, deg, labelAt[0], labelAt[1] + 12, 9, IVORY, 0.45 + 0.4 * lit);
}

function moonIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, s, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x + s * 0.45, y - s * 0.25, s * 0.85, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function windIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [dy, w] of [[-0.45, 1], [0.05, 1.3], [0.55, 0.8]]) {
    ctx.beginPath();
    ctx.moveTo(x - s, y + dy * s);
    ctx.lineTo(x - s + w * s * 1.3, y + dy * s);
    ctx.arc(x - s + w * s * 1.3, y + dy * s - s * 0.22, s * 0.22, Math.PI / 2, -Math.PI * 0.8, true);
    ctx.stroke();
  }
  ctx.restore();
}

function quakeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const pts = [-1, 0, -0.7, 0, -0.5, -0.5, -0.25, 0.7, 0, -0.9, 0.25, 0.6, 0.45, -0.3, 0.65, 0, 1, 0];
  for (let i = 0; i < pts.length; i += 2) {
    const px = x + pts[i] * s;
    const py = y + pts[i + 1] * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function satelliteIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  ctx.fillStyle = rgba('#6f8fd0', 0.6 + 0.4 * lit);
  ctx.fillRect(-s * 1.6, -s * 0.3, s * 1.0, s * 0.6);
  ctx.fillRect(s * 0.6, -s * 0.3, s * 1.0, s * 0.6);
  ctx.fillStyle = rgba(IVORY, 0.7 + 0.3 * lit);
  ctx.fillRect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9);
  ctx.restore();
  if (lit > 0.02) glowDot(ctx, x, y, s * 2.2, TEAL, 0.35 * lit);
}

function buoyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number) {
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.45, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = IVORY;
  ctx.fillRect(x - s * 0.12, y - s * 1.4, s * 0.24, s * 1.2);
  if (lit > 0.02) glowDot(ctx, x, y - s * 1.5, s * 1.3, CORAL, 0.8 * lit);
}

/** River and flood plain from the foot of the hill to the quay, and the Flood Gauge board. */
const RIVER: P2[] = [[458, 488], [440, 530], [414, 568], [398, 612], [406, 656], [432, 694], [452, 730], [452, 756]];

function paintFloodPlain(ctx: CanvasRenderingContext2D, s1: number, s2: number, s3: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // the low ground beside the river that floods first
  smoothLine(ctx, RIVER);
  ctx.strokeStyle = rgba(mix('#2f5a5e', TEAL, 0.3 * s2), 0.22 + 0.1 * s2);
  ctx.lineWidth = 64;
  ctx.stroke();
  smoothLine(ctx, RIVER);
  ctx.strokeStyle = rgba('#16405a', 0.85);
  ctx.lineWidth = 14;
  ctx.stroke();
  smoothLine(ctx, RIVER);
  ctx.strokeStyle = rgba(mix(FOAM, TEAL, s2), 0.25 + 0.45 * s2);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 9]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  label(ctx, 'FLOOD PLAIN', 352, 664, 9, '#bfe6e2', 0.5 + 0.4 * s1, -1.2);
  // gauge board behind the two flood targets: depth ticks along the leaning face
  const [a, , , d] = GAUGE;
  const len = Math.hypot(d[0] - a[0], d[1] - a[1]);
  const ux = (d[0] - a[0]) / len;
  const uy = (d[1] - a[1]) / len;
  ctx.save();
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const x = a[0] + (d[0] - a[0]) * u - 12;
    const y = a[1] + (d[1] - a[1]) * u;
    ctx.strokeStyle = rgba(i % 5 === 0 ? GOLD : IVORY, 0.45 + 0.35 * s1);
    ctx.lineWidth = i % 5 === 0 ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (i % 5 === 0 ? 10 : 6) * (1 - ux * 0.2), y - uy * 0.5);
    ctx.stroke();
  }
  ctx.restore();
  // RUNOFF: rain falling faster than the ground soaks it up; SURGE: wind piling the sea ashore
  const rx = 490;
  const ry = 533;
  stormCloud(ctx, 31, rx, ry - 6, 26, 14, rgba('#55688e', 0.9), RAIN, 0.4 + 0.5 * s1);
  ctx.strokeStyle = rgba(RAIN, 0.55 + 0.4 * s1);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(rx - 9 + i * 6, ry + 4);
    ctx.lineTo(rx - 11 + i * 6, ry + 12);
    ctx.stroke();
  }
  const sx = 500;
  const sy = 616;
  ctx.fillStyle = rgba('#2a7a96', 0.75 + 0.2 * s1);
  ctx.beginPath();
  ctx.moveTo(sx - 16, sy + 6);
  ctx.quadraticCurveTo(sx - 6, sy - 10, sx + 6, sy - 2);
  ctx.quadraticCurveTo(sx + 2, sy + 2, sx + 12, sy + 6);
  ctx.closePath();
  ctx.fill();
  windIcon(ctx, sx - 2, sy - 14, 6, '#cfe8ff', 0.55 + 0.4 * s1);
  label(ctx, 'FLOOD GAUGE', 470, 652, 9, GOLD, 0.55 + 0.45 * Math.max(s1, s3), 0);
}

function paintHarbor(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);

  // ---- Sky to sea. The storm lifts toward a clear dawn as the harbor is defended.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [
    [0, mix('#121a33', '#2a3a72', s4)],
    [0.22, mix('#1d2b4c', '#6a5288', s4)],
    [0.33, mix('#22385a', '#c27a6a', s4 * 0.85)],
    [0.42, mix('#1a4a62', '#226580', s4)],
    [0.7, mix(SEA_DEEP, '#123f58', s4)],
    [1, mix('#091d30', '#0b2c44', s4)],
  ]);
  ctx.fillRect(0, 0, 600, 1150);
  if (s4 > 0.01) {
    // dawn sun low on the horizon behind the storm cell
    glowDot(ctx, 362, 300, 200, DAWN, 0.35 * s4);
    glowDot(ctx, 362, 300, 60, '#fff1c4', 0.5 * s4);
  }

  // ---- The open sea: long swells on the left and across the harbor mouth
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const y = 340 + i * 17;
    // each swell fades out toward the flood plain instead of ending on a hard edge
    const a = 0.05 + 0.04 * ((i * 7) % 3) + 0.05 * s3;
    const fade = ctx.createLinearGradient(24, 0, 330, 0);
    fade.addColorStop(0, rgba(FOAM, a));
    fade.addColorStop(0.65, rgba(FOAM, a));
    fade.addColorStop(1, rgba(FOAM, 0));
    ctx.strokeStyle = fade;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 24; x <= 330; x += 6) {
      const yy = y + Math.sin(x / 26 + i * 1.7) * 3;
      if (x === 24) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ---- Storm cell (top): heavy clouds around the cloud bumpers, rain falling toward the hill
  const cloudBody = mix('#2a3656', '#6b5a86', s4);
  const cloudRim = s4 > 0.5 ? DAWN : '#9fb4ff';
  stormCloud(ctx, 3, 362, 96, 250, 120, rgba(cloudBody, 0.95), cloudRim, 0.4 + 0.6 * s4);
  stormCloud(ctx, 8, 300, 196, 120, 80, rgba(mix('#24304e', '#5e5080', s4), 0.9), cloudRim, 0.3 + 0.7 * s4);
  stormCloud(ctx, 12, 430, 196, 110, 74, rgba(mix('#24304e', '#5e5080', s4), 0.9), cloudRim, 0.3 + 0.7 * s4);
  if (s4 < 0.99) {
    ctx.save();
    ctx.strokeStyle = rgba(RAIN, 0.22 * (1 - s4));
    ctx.lineWidth = 1.2;
    const rr = rng(21);
    for (let i = 0; i < 70; i++) {
      const x = 270 + rr() * 280;
      const y = 150 + rr() * 220;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 16);
      ctx.stroke();
    }
    ctx.restore();
  }
  label(ctx, 'STORM CELL', 362, 46, 10, '#cfe0ff', 0.55 + 0.35 * s1);

  // ---- What moves the sea? Icons under the three lanes
  const iconA = 0.55 + 0.45 * s1;
  moonIcon(ctx, 316, 328, 7, '#f4f0d0', iconA);
  windIcon(ctx, 362, 328, 8, '#cfe8ff', iconA);
  quakeIcon(ctx, 408, 328, 9, CORAL, iconA);

  // ---- Slope Lab hill (right): grassy upland, soil on the slope faces, houses on top
  ctx.save();
  poly(ctx, [[548, 120], [470, 140], [462, 150], [454, 204], [431, 270], [428, 370], [436, 424], [472, 460], [540, 478], [548, 480]]);
  ctx.fillStyle = vgrad(ctx, 120, 480, [[0, mix('#2f4a3c', '#4f7a52', s4)], [0.55, mix(MOSS, GRASS, 0.3 + 0.4 * s4)], [1, mix('#3a3a2a', SOIL, 0.6)]]);
  ctx.fill();
  ctx.restore();
  // soil cross-section along the three faces (layers parallel to the surface)
  ctx.save();
  poly(ctx, [[428, 370], [436, 424], [472, 460], [540, 478], [548, 480], [548, 440], [520, 446], [470, 420], [452, 392], [446, 360]]);
  ctx.clip();
  for (let k = 0; k < 6; k++) {
    ctx.strokeStyle = rgba(k % 2 ? '#a0703e' : '#5e3e26', 0.75);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(424 + k * 7, 360);
    ctx.lineTo(432 + k * 7, 424 - k * 3);
    ctx.lineTo(472 + k * 3, 460 - k * 7);
    ctx.lineTo(548, 478 - k * 7);
    ctx.stroke();
  }
  ctx.restore();
  // the summit road and a few houses that the slopes put at risk
  house(ctx, 470, 236, 16, 12, '#d8cbb0', '#a8463a', s2);
  house(ctx, 500, 214, 14, 11, '#c9d4e0', '#3f5a86', s2);
  house(ctx, 522, 262, 16, 12, '#e0d2b8', '#a8463a', s2);
  house(ctx, 488, 300, 14, 10, '#d8cbb0', '#3f5a86', s2);
  for (const [x, y, h] of [[452, 300, 18], [530, 300, 16], [480, 180, 15], [536, 196, 14]] as [number, number, number][]) {
    ctx.fillStyle = mix('#2c4a33', '#4e8a52', s4);
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + h * 0.45, y);
    ctx.lineTo(x - h * 0.45, y);
    ctx.closePath();
    ctx.fill();
  }
  // summit flag
  ctx.strokeStyle = IVORY;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(512, 334);
  ctx.lineTo(512, 312);
  ctx.stroke();
  ctx.fillStyle = ORANGE;
  poly(ctx, [[512, 312], [526, 317], [512, 322]]);
  ctx.fill();
  label(ctx, 'SLOPE LAB', 494, 400, 13, GOLD, 0.65 + 0.35 * s1);
  // slope-model trays: the same hill at three angles, each tagged with a kind of mass wasting it
  // can show (rock falls drop from cliffs, mudflows rush down steep slopes, creep inches along)
  slopeTray(ctx, HILL[1], HILL[2], 'ROCK FALL', '80°', CORAL, s1, [382, 388]);
  slopeTray(ctx, HILL[2], HILL[3], 'MUDFLOW', '45°', ORANGE, s1, [430, 474]);
  slopeTray(ctx, HILL[3], HILL[4], 'CREEP', '15°', GOLD, s1, [500, 490]);
  // a retaining wall and a drain at the foot of the hill (level 2: drainage installed)
  if (s2 > 0.01) {
    neonPath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(548, 500);
      ctx.lineTo(470, 486);
      ctx.lineTo(430, 470);
    }, TEAL, s2, 3);
  }

  // ---- Drainage Channel: a concrete channel printed under the ramp, with the flow direction
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  smoothLine(ctx, RAMP_PATH);
  ctx.strokeStyle = rgba('#3a4a66', 0.7);
  ctx.lineWidth = 40;
  ctx.stroke();
  smoothLine(ctx, RAMP_PATH);
  ctx.strokeStyle = rgba(mix('#2a6a8a', TEAL, s2), 0.35 + 0.4 * s2);
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.restore();
  label(ctx, 'DRAINAGE CHANNEL', RAMP_X, 600 - 50, 11, TEAL, 0.7 + 0.3 * s2, -Math.PI / 2);

  // ---- Sea Wall (left orbit): stone blocks along the coast
  ctx.save();
  const sw = rng(5);
  for (let y = 300; y < 700; y += 14) {
    for (let x = 24; x < 74; x += 25) {
      const off = ((y / 14) % 2) * 12;
      ctx.fillStyle = mix(STONE, '#5a5f73', sw() * 0.6);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x + off - 12, y, 23, 12);
    }
  }
  ctx.restore();
  label(ctx, 'SEA WALL', 49, 520, 11, IVORY, 0.65 + 0.35 * s3, -Math.PI / 2);

  // ---- DART warning chain along the sea wall: seafloor sensor -> buoy -> satellite
  const seafloorY = 640;
  const surfaceY = 556;
  ctx.fillStyle = rgba('#3a2e2a', 0.65);
  ctx.fillRect(84, seafloorY, 70, 10);
  ctx.strokeStyle = rgba(FOAM, 0.4 + 0.3 * s3);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(84, surfaceY);
  ctx.lineTo(150, surfaceY);
  ctx.stroke();
  ctx.setLineDash([]);
  // sound rings rising from the sensor to the buoy
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = rgba(TEAL, (0.25 + 0.5 * s3) * (1 - i * 0.18));
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(122, seafloorY - 8 - i * 18, 8 + i * 4, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.fillStyle = mix('#6f7a90', IVORY, s3 * 0.5);
  ctx.beginPath();
  ctx.arc(122, seafloorY, 9, Math.PI, 0);
  ctx.fill();
  buoyIcon(ctx, 124, surfaceY + 2, 9, s3);
  satelliteIcon(ctx, 128, 418, 7, s3);
  // satellite link to the Harbor Watch
  ctx.save();
  ctx.setLineDash([2, 6]);
  ctx.strokeStyle = rgba(TEAL, 0.25 + 0.6 * s3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(134, 412);
  ctx.quadraticCurveTo(150, 392, 168, 420);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  label(ctx, '1', 100, 612, 10, GOLD, 0.7 + 0.3 * s3);
  label(ctx, '2', 100, 534, 10, GOLD, 0.7 + 0.3 * s3);
  label(ctx, '3', 100, 456, 10, GOLD, 0.7 + 0.3 * s3);
  label(ctx, 'DART', 132, 600, 9, TEAL, 0.55 + 0.45 * s3);

  // ---- Harbor basin and the Harbor Watch: calm inner water behind the Flood Gate
  ctx.save();
  rrect(ctx, BASIN.x - 40, BASIN.top - 22, 80, 112, 30);
  ctx.fillStyle = rgba('#0a2236', 0.6);
  ctx.fill();
  ctx.strokeStyle = rgba(STONE, 0.6);
  ctx.lineWidth = 3;
  ctx.stroke();
  const inner = ctx.createRadialGradient(BASIN.x, BASIN.y, 4, BASIN.x, BASIN.y, 36);
  inner.addColorStop(0, rgba(mix(TEAL, GOLD, s4), 0.55 + 0.3 * s1));
  inner.addColorStop(1, rgba(SEA, 0));
  ctx.fillStyle = inner;
  ctx.fillRect(BASIN.x - 40, BASIN.top - 20, 80, 110);
  ctx.restore();
  // the watch tower drawn behind the pocket
  ctx.fillStyle = rgba(IVORY, 0.55);
  ctx.fillRect(BASIN.x - 4, BASIN.top - 18, 8, 16);
  glowDot(ctx, BASIN.x, BASIN.top - 20, 10, GOLD, 0.4 + 0.6 * s1);
  // sector-gate silhouettes at the basin mouth
  for (const side of [-1, 1]) {
    ctx.strokeStyle = rgba(GOLD, 0.25 + 0.5 * s3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(BASIN.x + side * BASIN.half, BASIN.mouth, 32, side < 0 ? 0.25 : Math.PI - 1.2, side < 0 ? 1.2 : Math.PI - 0.25);
    ctx.stroke();
  }
  label(ctx, 'FLOOD GATE', BASIN.x, 538, 10, GOLD, 0.6 + 0.4 * s3);
  label(ctx, 'HARBOR WATCH', BASIN.x, 398, 9, IVORY, 0.6 + 0.4 * s1);

  paintFloodPlain(ctx, s1, s2, s3);

  // ---- Waterfront town in the middle, quay and moored boats near the flippers
  const town: [number, number, number, number, string, string][] = [
    [312, 742, 22, 18, '#c9b79a', '#8a3a36'], [338, 748, 18, 14, '#a9b8cc', '#2f4870'], [362, 740, 24, 20, '#d9c9a8', '#8a3a36'],
    [390, 748, 18, 15, '#b8c6d6', '#2f4870'], [414, 744, 20, 18, '#cdbb9e', '#7a4a30'], [440, 750, 18, 14, '#a9b8cc', '#8a3a36'],
    [150, 750, 20, 15, '#cdbb9e', '#2f4870'], [174, 744, 22, 18, '#d9c9a8', '#8a3a36'],
  ];
  for (const [x, y, w, h, wall, roof] of town) house(ctx, x, y, w, h, mix(wall, '#3a4560', 0.45 - 0.35 * s4), roof, s2);
  // quay edge
  ctx.fillStyle = rgba(STONE, 0.5);
  ctx.fillRect(120, 752, 340, 6);
  // harbor lamps along the quay
  for (let i = 0; i < 7; i++) {
    const x = 140 + i * 50;
    ctx.fillStyle = 'rgba(20,24,40,0.9)';
    ctx.fillRect(x - 1, 728, 2, 24);
    glowDot(ctx, x, 727, 12, GOLD, 0.15 + 0.75 * s2);
  }
  // harbor water and boats down by the flippers
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const y = 790 + i * 22;
    ctx.strokeStyle = rgba(FOAM, 0.05 + 0.05 * s4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 30; x <= 545; x += 8) {
      const yy = y + Math.sin(x / 22 + i) * 2.5;
      if (x === 30) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  boat(ctx, 214, 800, 12, '#c9443e', '#e8e2d2', s3);
  boat(ctx, 360, 806, 11, '#2f5f9a', '#e8e2d2', s3, -1);
  boat(ctx, 286, 1092, 10, '#d9a441', '#e8e2d2', s3);
  // the attraction's name on the quay (lights at level 2)
  neonText(ctx, 'STORMWATER HARBOR', 286, 784, 19, GOLD, stage(level, 1.5, 2.5));

  // ---- Wonderlight: harbor bathed in warm dawn
  if (s4 > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(GOLD, 0.03 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    ctx.restore();
  }
}

function paintAmbient({ ctx, t, level, reduced, energy }: SceneryContext) {
  if (reduced) return;
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);
  // rain sweeping through the storm cell and over the hill (eases off as the harbor recovers)
  const rain = (1 - s4) * (0.35 + 0.25 * energy);
  if (rain > 0.02) {
    ctx.save();
    ctx.strokeStyle = rgba(RAIN, rain);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 26; i++) {
      const x0 = 280 + ((i * 53) % 260);
      const y = 120 + ((t * 260 + i * 41) % 300);
      ctx.beginPath();
      ctx.moveTo(x0 - (y - 120) * 0.12, y);
      ctx.lineTo(x0 - (y - 120) * 0.12 - 4, y + 14);
      ctx.stroke();
    }
    ctx.restore();
  }
  // glints on the harbor water by the flippers
  for (let i = 0; i < 10; i++) {
    const x = 60 + ((i * 97 + t * 14) % 470);
    const y = 820 + ((i * 61) % 240);
    glowDot(ctx, x, y, 5, FOAM, 0.12 + 0.12 * Math.sin(t * 2 + i));
  }
  // warning pulses climbing the DART chain once the warning system is built
  if (s3 > 0.01) {
    for (let k = 0; k < 2; k++) {
      const u = (t * 0.45 + k * 0.5) % 1;
      const y = 640 - u * 230;
      glowDot(ctx, 122 + Math.sin(u * 9) * 3, y, 8, TEAL, 0.7 * s3 * Math.sin(u * Math.PI));
    }
  }
}

function paintCelebrate({ ctx, t }: SceneryContext, p: number) {
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
  const g = ctx.createRadialGradient(BASIN.x, BASIN.y, 10, BASIN.x, BASIN.y, 460);
  g.addColorStop(0, rgba(GOLD, 0.8));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.restore();
  // warning rings spreading from the Harbor Watch, like a signal sent across the bay
  for (let i = 0; i < 4; i++) {
    const r = ((p * 1.4 + i * 0.25) % 1) * 420;
    ctx.strokeStyle = rgba(i % 2 ? TEAL : GOLD, 0.6 * (1 - r / 420));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(BASIN.x, BASIN.y, r, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + t * 0.4;
    const d = 50 + p * 260;
    glowDot(ctx, BASIN.x + Math.cos(a) * d, BASIN.y + Math.sin(a) * d * 0.8, 9, [GOLD, TEAL, CORAL][i % 3], 1 - p);
  }
}

// ================================================================ 3D attraction set

type V3 = [number, number, number];

function std(kit: SetKit, color: string, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return kit.track(new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o }));
}

function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  const tex = kit.track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Merge indexed primitives into one geometry (one draw call) and free the parts. */
function merged(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(geos, false);
  geos.forEach((x) => x.dispose());
  return g;
}

/** A box spanning two points (beams, braces, rails). */
function beam(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.BufferGeometry {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(t, len, t);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Glowing sign with a long name on a dark backing with brass trims. */
function wideSign(kit: SetKit, text: string, pos: V3, w: number, h: number, color: string) {
  const tex = canvasTex(kit, 2048, Math.round((2048 * h) / w), (ctx, cw, ch) => {
    let size = Math.round(ch * 0.62);
    const font = (s: number) => `800 ${s}px "Fraunces Variable", Georgia, serif`;
    ctx.font = font(size);
    while (ctx.measureText(text).width > cw * 0.92 && size > 20) {
      size -= 4;
      ctx.font = font(size);
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2 + size * 0.04);
  });
  const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveMap: tex, emissiveIntensity: 0.1, alphaMap: tex, transparent: true, depthWrite: false }));
  const g = new THREE.Group();
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  glyph.position.z = 0.05;
  glyph.renderOrder = 3;
  const frame = new THREE.Mesh(merged([
    new THREE.BoxGeometry(w * 1.05, h * 1.25, 0.07),
  ]), kit.mats.plastic('#0b1426'));
  const trims = new THREE.Mesh(merged([
    new THREE.BoxGeometry(w * 1.09, 0.045, 0.1).translate(0, h * 0.64, 0),
    new THREE.BoxGeometry(w * 1.09, 0.045, 0.1).translate(0, -h * 0.64, 0),
  ]), kit.mats.brass());
  g.add(frame, trims, glyph);
  g.position.set(pos[0], pos[1], pos[2]);
  kit.add(g);
  return { g, setLit: (v: number) => (mat.emissiveIntensity = 0.08 + v * 3) };
}

/** Scrolling white-water texture for flowing drains and channels. */
function flowTexture(kit: SetKit, seed: number): THREE.CanvasTexture {
  const tex = canvasTex(kit, 256, 64, (ctx) => {
    ctx.fillStyle = '#3f8fb8';
    ctx.fillRect(0, 0, 256, 64);
    const r = rng(seed);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(230,248,255,${0.2 + r() * 0.65})`;
      ctx.fillRect(r() * 256, r() * 64, 12 + r() * 46, 1.5 + r() * 3);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Open concrete U-channel along a curve (walls + bed as one geometry) and the water ribbon inside
 * it, with u running along the length so a flow texture can scroll.
 */
function channelGeometry(curve: THREE.Curve<THREE.Vector3>, segs: number, w: number, h: number) {
  const pts = curve.getSpacedPoints(segs);
  const prof: [number, number][] = [[-w - 0.035, -0.03], [-w - 0.035, h], [-w, h], [-w, 0.01], [w, 0.01], [w, h], [w + 0.035, h], [w + 0.035, -0.03]];
  const pos: number[] = [];
  const wpos: number[] = [];
  const wuv: number[] = [];
  const side = new THREE.Vector3();
  const tan = new THREE.Vector3();
  let len = 0;
  for (let i = 0; i <= segs; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(segs, i + 1)];
    tan.subVectors(b, a).normalize();
    side.set(-tan.z, 0, tan.x).normalize();
    if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
    for (const [x, y] of prof) pos.push(pts[i].x + side.x * x, pts[i].y + y, pts[i].z + side.z * x);
    for (const k of [-1, 1]) {
      wpos.push(pts[i].x + side.x * w * 0.92 * k, pts[i].y + h * 0.45, pts[i].z + side.z * w * 0.92 * k);
      wuv.push(len / 0.6, k < 0 ? 0 : 1);
    }
  }
  const P = prof.length;
  const idx: number[] = [];
  const widx: number[] = [];
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < P - 1; j++) {
      const a = i * P + j;
      const b = (i + 1) * P + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const a = i * 2;
    widx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  walls.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  walls.setIndex(idx);
  walls.computeVertexNormals();
  const water = new THREE.BufferGeometry();
  water.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  water.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
  water.setIndex(widx);
  water.computeVertexNormals();
  return { walls, water };
}

/** Two-mesh stylised tree (trunk + merged crown) added to `parent`. */
function smallTree(kit: SetKit, parent: THREE.Object3D, pos: V3, h: number, leaf: string, seed: number, lean = 0) {
  const r = rng(seed);
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.05, h * 0.08, h * 0.6, 7).translate(0, h * 0.3, 0), kit.mats.plastic('#5b3a24'));
  trunk.castShadow = true;
  const blobs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    blobs.push(new THREE.IcosahedronGeometry(h * (0.18 + r() * 0.1), 1).translate((r() - 0.5) * h * 0.4, h * (0.62 + r() * 0.3), (r() - 0.5) * h * 0.4));
  }
  const crown = new THREE.Mesh(merged(blobs), kit.mats.plastic(leaf));
  crown.castShadow = true;
  g.add(trunk, crown);
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.x = lean;
  parent.add(g);
}

// ---- The Slope Lab hill: summit plateau, an 80° cliff, a 45° face and a 15° face
const HILL_PROFILE: [number, number][] = [[0, 0], [0, 1.7], [0.95, 1.7], [1.07, 1.0], [1.35, 1.0], [1.85, 0.5], [2.15, 0.5], [4.02, 0]];
const HILL_LEN = 4.02;
const HILL_TOP = 1.7;

/** Height of the hill surface at profile distance u (0 = back, 4.02 = foot). */
function hillV(u: number): number {
  const p = HILL_PROFILE;
  for (let i = 1; i < p.length - 1; i++) {
    const [u0, v0] = p[i];
    const [u1, v1] = p[i + 1];
    if (u >= u0 && u <= u1) return v0 + ((v1 - v0) * (u - u0)) / Math.max(1e-6, u1 - u0);
  }
  return u < 0.5 ? HILL_TOP : 0;
}

/** Soil cross-section painted on the hill's cut face: layers follow the surface, plus angle tags. */
function paintStrata(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const X = (u: number) => (u / HILL_LEN) * w;
  const Y = (v: number) => (1 - v / HILL_TOP) * h;
  ctx.fillStyle = '#4b4f5e';
  ctx.fillRect(0, 0, w, h);
  const layers: [number, string][] = [[0, '#3f5f3a'], [0.07, '#6b4a2e'], [0.24, '#9a6a3c'], [0.46, '#c49a62'], [0.72, '#7d6a5c'], [1.0, '#5a5c68']];
  for (const [d, col] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    for (const [u, v] of HILL_PROFILE.slice(1)) ctx.lineTo(X(u), Y(Math.max(0, v - d)));
    ctx.closePath();
    ctx.fill();
  }
  const r = rng(26);
  for (let i = 0; i < 260; i++) {
    const u = r() * HILL_LEN;
    const v = r() * hillV(u);
    ctx.fillStyle = `rgba(${r() < 0.5 ? '30,24,20' : '235,220,190'},${0.18 + r() * 0.25})`;
    ctx.beginPath();
    ctx.arc(X(u), Y(v), 1.5 + r() * 3.5, 0, TAU);
    ctx.fill();
  }
  // surface rim
  ctx.strokeStyle = '#2c4a2a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  HILL_PROFILE.slice(1).forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
  ctx.stroke();
  // angle tags on the three faces
  const tag = (text: string, u: number, v: number, col: string) => {
    ctx.font = `800 ${Math.round(w * 0.06)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, w * 0.01);
    ctx.strokeStyle = 'rgba(10,14,28,0.85)';
    ctx.strokeText(text, X(u), Y(v));
    ctx.fillStyle = col;
    ctx.fillText(text, X(u), Y(v));
  };
  tag('80°', 0.7, 1.3, CORAL);
  tag('45°', 1.32, 0.62, ORANGE);
  tag('15°', 2.9, 0.16, GOLD);
}

/** Storm cloud: merged puffs on one material whose colour moves from storm slate to dawn. */
function stormCloud3D(kit: SetKit, at: V3, puffs: [number, number, number, number][], mat: THREE.MeshStandardMaterial): THREE.Mesh {
  const geos = puffs.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 2).translate(x, y, z));
  const m = new THREE.Mesh(merged(geos), mat);
  m.position.set(at[0], at[1], at[2]);
  return kit.add(m);
}

/** Jagged lightning bolt below a cloud (neon tube). */
function bolt(kit: SetKit, top: V3, seed: number, color: string) {
  const r = rng(seed);
  const pts: V3[] = [top];
  let [x, y, z] = top;
  for (let i = 0; i < 5; i++) {
    x += (r() - 0.5) * 0.35;
    y -= 0.25 + r() * 0.12;
    z += (r() - 0.5) * 0.12;
    pts.push([x, y, z]);
  }
  return kit.neonTube(pts, color, { radius: 0.022 });
}

/** One arm of the storm-surge barrier: a steel truss and a curved gate that swings about a pivot. */
function barrierArm(kit: SetKit, pivot: V3, len: number, gateMat: THREE.Material, steel: THREE.Material, lampMat: THREE.Material) {
  const g = new THREE.Group();
  const half = 0.28;
  const gateH = 0.62;
  const ends = [-half, half].map((a) => new THREE.Vector3(Math.cos(a) * len, 0.35, -Math.sin(a) * len));
  const hub = new THREE.Vector3(0, 0.3, 0);
  const truss = [
    beam(hub, ends[0], 0.05),
    beam(hub, ends[1], 0.05),
    beam(new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(len * 0.98, 0.62, 0), 0.045),
    beam(new THREE.Vector3(len * 0.5, 0.33, 0), new THREE.Vector3(len * 0.98, 0.62, 0), 0.035),
    beam(new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(len * 0.5, 0.33, 0), 0.035),
    beam(ends[0].clone().setY(0.62), ends[1].clone().setY(0.62), 0.04),
    new THREE.SphereGeometry(0.14, 14, 10).translate(0, 0.3, 0),
  ];
  g.add(new THREE.Mesh(merged(truss), steel));
  // the gate: an arc of a circle centred on the pivot (a sector gate), bulging toward the sea
  const gate = new THREE.Mesh(new THREE.CylinderGeometry(len, len, gateH, 14, 1, true, Math.PI / 2 - half, half * 2).translate(0, 0.08 + gateH / 2, 0), gateMat);
  gate.castShadow = true;
  g.add(gate);
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), lampMat, 5);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 5; i++) {
    const a = -half + (i / 4) * half * 2;
    lamps.setMatrixAt(i, m4.makeTranslation(Math.cos(a) * len, 0.08 + gateH + 0.04, -Math.sin(a) * len));
  }
  lamps.instanceMatrix.needsUpdate = true;
  lamps.computeBoundingSphere();
  g.add(lamps);
  g.position.set(pivot[0], pivot[1], pivot[2]);
  return kit.add(g);
}

/** Head panorama (seen on the fly-in): storm over a hill town and the sea, clearing to dawn. */
function paintPanorama(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const s4 = stage(level, 3.2, 4);
  const s2 = stage(level, 1, 2);
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, mix('#0e1730', '#2a3a72', s4)], [0.55, mix('#1c2a4c', '#d08a72', s4)], [0.72, mix('#203a58', '#ffc98f', s4)], [1, mix('#0b2034', '#1f5a78', s4)]]);
  ctx.fillRect(0, 0, w, h);
  if (s4 > 0.01) glowDot(ctx, w * 0.62, h * 0.66, h * 0.5, '#ffd7a0', 0.6 * s4);
  for (let i = 0; i < 7; i++) stormCloud(ctx, 40 + i, (i + 0.5) * (w / 7), h * (0.18 + (i % 3) * 0.08), w * 0.2, h * 0.24, rgba(mix('#2a3656', '#b98aa0', s4), 0.92), s4 > 0.5 ? DAWN : '#9fb4ff', 0.3 + 0.6 * s4);
  ctx.fillStyle = mix('#1a2b2a', '#2f5a4a', s4);
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h * 0.74);
  ctx.quadraticCurveTo(w * 0.75, h * 0.42, w, h * 0.5);
  ctx.lineTo(w, h * 0.76);
  ctx.closePath();
  ctx.fill();
  const r = rng(9);
  for (let i = 0; i < 26; i++) {
    const x = w * (0.6 + r() * 0.38);
    const y = h * (0.6 + r() * 0.12);
    ctx.fillStyle = 'rgba(14,18,32,0.9)';
    ctx.fillRect(x, y, 10, 8);
    ctx.fillStyle = rgba(GOLD, 0.2 + 0.7 * s2);
    ctx.fillRect(x + 3, y + 2, 3, 3);
  }
  ctx.fillStyle = mix('#0e2c44', '#1f6a8a', s4);
  ctx.fillRect(0, h * 0.74, w, h * 0.26);
  ctx.strokeStyle = rgba(FOAM, 0.25 + 0.25 * s4);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.78 + i * 0.035) + Math.sin(x / 40 + i) * 3);
    ctx.stroke();
  }
}

/** Wet stone paving for the quay around the cabinet. */
function paintQuay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2a3140';
  ctx.fillRect(0, 0, w, h);
  const r = rng(61);
  const rows = 8;
  const rh = h / rows;
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * 0.5;
    const cols = 6;
    const cw = w / cols;
    for (let i = -1; i < cols; i++) {
      const x = (i + off) * cw + 3;
      const shade = r();
      ctx.fillStyle = shade < 0.33 ? '#3c4559' : shade < 0.66 ? '#363e50' : '#424c61';
      rrect(ctx, x, j * rh + 3, cw - 6, rh - 6, 8);
      ctx.fill();
      ctx.fillStyle = `rgba(160,190,230,${0.04 + r() * 0.08})`;
      rrect(ctx, x + 6, j * rh + 7, (cw - 18) * r(), 5, 3);
      ctx.fill();
    }
  }
  for (let i = 0; i < 9; i++) {
    const g = ctx.createRadialGradient(r() * w, r() * h, 2, r() * w, r() * h, 30 + r() * 40);
    g.addColorStop(0, 'rgba(120,170,220,0.12)');
    g.addColorStop(1, 'rgba(120,170,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Meadow on the land side, with a ragged edge toward the quay (alpha-tested). */
function paintMeadow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(17);
  ctx.fillStyle = '#35583a';
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(40, 0);
  for (let y = 0; y <= h; y += 32) ctx.lineTo(18 + r() * 34, y);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 2600; i++) {
    const k = r();
    ctx.fillStyle = k < 0.5 ? `rgba(90,140,80,${0.25 + r() * 0.3})` : k < 0.95 ? `rgba(20,40,26,${0.2 + r() * 0.3})` : ['#e8d8a0', '#ff9f8a', '#fff7e7'][Math.floor(r() * 3)];
    ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 5);
  }
  ctx.restore();
}

/** The DART display: the deep ocean cut open from the seafloor sensor up to the surface buoy. */
function paintDartPanel(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#3a8ab0'], [0.18, '#1d5f86'], [0.8, '#0a2440'], [1, '#081a2c']]);
  ctx.fillRect(0, 0, w, h);
  // seabed
  ctx.fillStyle = '#4a3c30';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * 0.88 + Math.sin(x / 70) * 8);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // surface swell
  ctx.strokeStyle = 'rgba(216,243,255,0.8)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * 0.07 + Math.sin(x / 40) * 6);
  ctx.stroke();
  // sound path, sensor to buoy
  ctx.strokeStyle = 'rgba(111,227,214,0.75)';
  ctx.setLineDash([16, 14]);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.84);
  ctx.lineTo(w * 0.62, h * 0.12);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(111,227,214,${0.7 - i * 0.12})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w * 0.62, h * (0.76 - i * 0.16), 26 + i * 6, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.font = '800 40px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const tag = (t: string, y: number) => {
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(6,14,28,0.8)';
    ctx.strokeText(t, 36, y);
    ctx.fillStyle = '#e8f6ff';
    ctx.fillText(t, 36, y);
  };
  tag('2  SURFACE BUOY', h * 0.17);
  tag('SOUND SIGNAL', h * 0.5);
  tag('1  SEAFLOOR SENSOR', h * 0.8);
}

/** Red-and-white sector-gate skin with a warning band along the top. */
function paintGate(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#e6ebf0';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c9443e';
  ctx.fillRect(0, 0, w, h * 0.22);
  ctx.fillStyle = 'rgba(40,50,70,0.35)';
  for (let i = 1; i < 8; i++) ctx.fillRect((i * w) / 8 - 2, h * 0.22, 4, h * 0.78);
  ctx.fillRect(0, h * 0.6, w, 4);
}

const harborSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  const m4 = new THREE.Matrix4();
  const sky = kit.sky('#16223f', '#070a14');
  const skyU = (sky.material as THREE.ShaderMaterial).uniforms as { top: { value: THREE.Color }; bottom: { value: THREE.Color } };
  const skyTop = [new THREE.Color('#16223f'), new THREE.Color('#33478a')];
  const skyBottom = [new THREE.Color('#070a14'), new THREE.Color('#b8756a')];

  // ---------------------------------------------------------------- ground: quay, sea and meadow
  const quayTex = canvasTex(kit, 512, 512, paintQuay);
  quayTex.wrapS = quayTex.wrapT = THREE.RepeatWrapping;
  quayTex.repeat.set(30, 30);
  const quayMat = std(kit, '#ffffff', { map: quayTex, roughness: 0.6, metalness: 0.05 });
  const quay = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), quayMat);
  quay.position.y = gy;
  quay.receiveShadow = true;
  kit.add(quay);
  const meadowTex = canvasTex(kit, 512, 1024, paintMeadow);
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 13).rotateX(-Math.PI / 2), std(kit, '#ffffff', { map: meadowTex, alphaTest: 0.5, roughness: 0.95 }));
  meadow.position.set(6.95, gy + 0.006, -0.8);
  meadow.receiveShadow = true;
  kit.add(meadow);
  const sea = kit.water([-7.65, gy + 0.1, -1.4], 7.5, 16.4, '#1d5274');
  const seaMat = sea.material as THREE.MeshPhysicalMaterial;
  seaMat.transparent = false;
  seaMat.opacity = 1;
  seaMat.transmission = 0;
  seaMat.emissive = new THREE.Color('#174d73');
  seaMat.emissiveIntensity = 0.3;
  const seaDark = new THREE.Color('#174d73');
  const seaDawn = new THREE.Color('#3a8aa8');
  const stone = std(kit, '#4c5363', { roughness: 0.92 });
  const stoneCap = std(kit, '#666e80', { roughness: 0.85 });
  const steel = kit.mats.paintedMetal('#8a96ad');
  // the sea wall along the quay: a wall, a stepped revetment on the sea side and a pale coping
  kit.add(new THREE.Mesh(merged([
    new THREE.BoxGeometry(0.22, 0.36, 12.6).translate(-3.98, gy + 0.18, -0.4),
    new THREE.BoxGeometry(0.22, 0.2, 12.6).translate(-4.2, gy + 0.1, -0.4),
    new THREE.BoxGeometry(0.2, 0.1, 12.6).translate(-4.41, gy + 0.05, -0.4),
  ]), stone));
  kit.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 12.6).translate(-3.98, gy + 0.38, -0.4), stoneCap));
  // harbor lamps along the sea wall
  const lampPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.032, 0.7, 8), steel, 5);
  const lampHeadMat = std(kit, '#2a2418', { emissive: GOLD, emissiveIntensity: 0.1 });
  const lampHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 12, 8), lampHeadMat, 5);
  for (let i = 0; i < 5; i++) {
    const z = -5.6 + i * 2.6;
    lampPosts.setMatrixAt(i, m4.makeTranslation(-3.98, gy + 0.4 + 0.35, z));
    lampHeads.setMatrixAt(i, m4.makeTranslation(-3.98, gy + 1.13, z));
  }
  for (const im of [lampPosts, lampHeads]) {
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    kit.add(im);
  }

  // ---------------------------------------------------------------- DART display (back left)
  const tank = new THREE.Group();
  const TW3 = 2.2;
  const TD = 0.9;
  const BED = 0.2;
  const PANEL_H = 1.25;
  const LEAN = 0.5;
  const SURF = BED + PANEL_H * Math.cos(LEAN) - 0.08;
  const FZ = 0.3;
  tank.add(new THREE.Mesh(new THREE.BoxGeometry(TW3, BED, TD).translate(0, BED / 2, 0), std(kit, '#56463a', { roughness: 0.95 })));
  const panelTex = canvasTex(kit, 1024, 580, paintDartPanel);
  const panelMat = kit.track(new THREE.MeshStandardMaterial({ map: panelTex, emissive: '#ffffff', emissiveMap: panelTex, emissiveIntensity: 0.12, roughness: 0.6 }));
  const panelPivot = new THREE.Group();
  panelPivot.position.set(0, BED, 0.15);
  panelPivot.rotation.x = -LEAN;
  panelPivot.add(new THREE.Mesh(new THREE.PlaneGeometry(TW3 - 0.06, PANEL_H).translate(0, PANEL_H / 2, 0), panelMat));
  tank.add(panelPivot);
  const topZ = 0.15 - PANEL_H * Math.sin(LEAN);
  const topY = BED + PANEL_H * Math.cos(LEAN);
  const fg: THREE.BufferGeometry[] = [];
  for (const x of [-TW3 / 2, TW3 / 2]) {
    fg.push(beam(new THREE.Vector3(x, BED, 0.15), new THREE.Vector3(x, topY, topZ), 0.05));
    fg.push(beam(new THREE.Vector3(x, BED, TD / 2), new THREE.Vector3(x, SURF + 0.05, TD / 2), 0.04));
    fg.push(beam(new THREE.Vector3(x, SURF + 0.05, TD / 2), new THREE.Vector3(x, topY, topZ), 0.04));
  }
  fg.push(beam(new THREE.Vector3(-TW3 / 2, topY, topZ), new THREE.Vector3(TW3 / 2, topY, topZ), 0.05));
  tank.add(new THREE.Mesh(merged(fg), steel));
  const surfMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#2a7aa0', roughness: 0.1, transparent: true, opacity: 0.6, clearcoat: 1, emissive: '#2a8ab8', emissiveIntensity: 0.1, depthWrite: false }));
  tank.add(new THREE.Mesh(new THREE.PlaneGeometry(TW3 - 0.06, 0.42).rotateX(-Math.PI / 2).translate(0, SURF, FZ), surfMat));
  const sensorMat = std(kit, '#c9a24a', { emissive: GOLD, emissiveIntensity: 0.1, roughness: 0.4, metalness: 0.3 });
  const SX = 0.25;
  const sensor = new THREE.Mesh(merged([
    new THREE.CylinderGeometry(0.15, 0.19, 0.11, 16).translate(0, 0.055, 0),
    new THREE.SphereGeometry(0.095, 14, 10, 0, TAU, 0, Math.PI / 2).translate(0, 0.11, 0),
  ]), sensorMat);
  sensor.position.set(SX, BED, FZ);
  tank.add(sensor);
  const ringMats: THREE.MeshBasicMaterial[] = [];
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const mat = kit.track(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 6, 28, Math.PI * 0.8).rotateZ(Math.PI * 0.1), mat);
    ring.position.set(SX, BED + 0.3, FZ);
    ring.rotation.x = -0.6;
    tank.add(ring);
    ringMats.push(mat);
    rings.push(ring);
  }
  const buoy = new THREE.Group();
  buoy.add(new THREE.Mesh(merged([
    new THREE.CylinderGeometry(0.24, 0.18, 0.16, 18),
    new THREE.TorusGeometry(0.23, 0.032, 8, 22).rotateX(Math.PI / 2).translate(0, 0.05, 0),
  ]), kit.mats.plastic(ORANGE)));
  buoy.add(new THREE.Mesh(merged([
    beam(new THREE.Vector3(-0.14, 0.07, -0.09), new THREE.Vector3(0, 0.56, 0), 0.028),
    beam(new THREE.Vector3(0.14, 0.07, -0.09), new THREE.Vector3(0, 0.56, 0), 0.028),
    beam(new THREE.Vector3(0, 0.07, 0.15), new THREE.Vector3(0, 0.56, 0), 0.028),
    new THREE.BoxGeometry(0.3, 0.02, 0.2).rotateX(-0.5).translate(0, 0.38, 0.06),
    new THREE.CylinderGeometry(0.008, 0.008, 0.32, 5).translate(0.04, 0.72, 0),
  ]), kit.mats.plastic('#e8edf2')));
  const buoyLampMat = std(kit, '#2a1a10', { emissive: CORAL, emissiveIntensity: 0.1 });
  buoy.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8).translate(0, 0.6, 0), buoyLampMat));
  buoy.position.set(SX, SURF, FZ);
  tank.add(buoy);
  tank.add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, SURF - BED, 4).translate(SX - 0.3, (SURF + BED) / 2, FZ - 0.05), kit.mats.dark()));
  tank.position.set(-6.3, gy, -3.85);
  tank.rotation.y = 0.4;
  kit.add(tank);
  const dartSign = kit.neonSign('DART', [0, 0, 0], { height: 0.3, color: TEAL });
  tank.add(dartSign);
  dartSign.position.set(-0.62, topY + 0.2, topZ + 0.05);
  dartSign.rotation.x = -0.5;

  // satellite above the display: relays the buoy's message to the Harbor Watch
  const sat = new THREE.Group();
  sat.add(new THREE.Mesh(merged([
    new THREE.BoxGeometry(0.22, 0.22, 0.3),
    new THREE.CylinderGeometry(0.02, 0.02, 0.46, 6).rotateZ(Math.PI / 2),
    new THREE.SphereGeometry(0.13, 14, 8, 0, TAU, 0, Math.PI / 2.4).rotateX(Math.PI).translate(0, -0.11, 0),
  ]), kit.mats.brass()));
  const satPanelMat = std(kit, '#22407a', { emissive: '#6aa8ff', emissiveIntensity: 0.05, roughness: 0.3, metalness: 0.4 });
  sat.add(new THREE.Mesh(merged([
    new THREE.BoxGeometry(0.56, 0.015, 0.24).translate(-0.5, 0, 0),
    new THREE.BoxGeometry(0.56, 0.015, 0.24).translate(0.5, 0, 0),
  ]), satPanelMat));
  const satLampMat = std(kit, '#101820', { emissive: TEAL, emissiveIntensity: 0.1 });
  sat.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8).translate(0, 0.15, 0.11), satLampMat));
  sat.position.set(-5.5, 1.72, -4.85);
  sat.rotation.set(0.35, 0.5, 0.15);
  kit.add(sat);

  // ---------------------------------------------------------------- Harbor Watch tower (left)
  const tower = new THREE.Group();
  const TH3 = 1.5;
  const tg: THREE.BufferGeometry[] = [];
  const legs = [[-0.24, -0.24], [0.24, -0.24], [0.24, 0.24], [-0.24, 0.24]];
  legs.forEach(([x, z], i) => {
    const a = new THREE.Vector3(x, 0, z);
    const b = new THREE.Vector3(x * 0.45, TH3, z * 0.45);
    tg.push(beam(a, b, 0.045));
    const [nx, nz] = legs[(i + 1) % 4];
    for (const k of [0.3, 0.62]) {
      tg.push(beam(a.clone().lerp(b, k), new THREE.Vector3(nx, 0, nz).lerp(new THREE.Vector3(nx * 0.45, TH3, nz * 0.45), k + 0.25), 0.022));
    }
  });
  tg.push(new THREE.BoxGeometry(0.5, 0.04, 0.5).translate(0, TH3, 0));
  tower.add(new THREE.Mesh(merged(tg), steel));
  tower.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.36).translate(0, TH3 + 0.15, 0), kit.mats.plastic('#e8e2d2')));
  const towerWinMat = std(kit, '#1a1a22', { emissive: GOLD, emissiveIntensity: 0.1 });
  tower.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.38).translate(0, TH3 + 0.17, 0), towerWinMat));
  tower.add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 4).rotateY(Math.PI / 4).translate(0, TH3 + 0.38, 0), kit.mats.plastic('#b8443e')));
  const beaconMat = std(kit, '#2a1a10', { emissive: CORAL, emissiveIntensity: 0.1 });
  tower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12).translate(0, TH3 + 0.54, 0), beaconMat));
  const beamTex = canvasTex(kit, 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,225,190,1)');
    g.addColorStop(1, 'rgba(255,225,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const beamMat = kit.track(new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const beamPivot = new THREE.Group();
  beamPivot.position.y = TH3 + 0.54;
  beamPivot.add(new THREE.Mesh(new THREE.ConeGeometry(0.34, 2.4, 20, 1, true).rotateZ(Math.PI / 2).translate(1.2, 0, 0), beamMat));
  tower.add(beamPivot);
  tower.position.set(-5.0, gy, -1.05);
  tower.scale.setScalar(1.15);
  kit.add(tower);
  const watchSign = wideSign(kit, 'HARBOR WATCH', [-5.75, gy + 0.45, -0.3], 1.5, 0.26, GOLD);
  watchSign.g.rotation.set(-0.5, 0.4, 0);

  // ---------------------------------------------------------------- storm-surge barrier (left front)
  const PZ = [1.6, 4.4];
  const PX = -5.95;
  kit.add(new THREE.Mesh(merged(PZ.map((z) => new THREE.BoxGeometry(1.75, 0.3, 0.42).translate(-5.2, gy + 0.15, z))), stone));
  kit.add(new THREE.Mesh(merged(PZ.map((z) => new THREE.BoxGeometry(1.8, 0.04, 0.48).translate(-5.2, gy + 0.32, z))), stoneCap));
  const gateTex = canvasTex(kit, 512, 128, paintGate);
  const gateMat = std(kit, '#ffffff', { map: gateTex, roughness: 0.5, side: THREE.DoubleSide, emissive: '#ffb27a', emissiveIntensity: 0 });
  const barrierLampMat = std(kit, '#2a2418', { emissive: GOLD, emissiveIntensity: 0.1 });
  const ARM = 1.4;
  const DOCK = 0.45;
  const armN = barrierArm(kit, [PX, gy + 0.05, PZ[0]], ARM, gateMat, steel, barrierLampMat);
  const armS = barrierArm(kit, [PX, gy + 0.05, PZ[1]], ARM, gateMat, steel, barrierLampMat);
  const barrierSign = kit.neonSign('SURGE BARRIER', [-4.42, gy + 0.62, 2.3], { height: 0.24, color: GOLD, rotY: 0.3 });
  barrierSign.rotation.x = -0.6;
  // a fishing boat moored safely inside the barrier
  const boat = new THREE.Group();
  const hullShape = new THREE.Shape([new THREE.Vector2(-0.34, 0), new THREE.Vector2(0.28, 0), new THREE.Vector2(0.4, 0.06), new THREE.Vector2(0.3, 0.16), new THREE.Vector2(-0.34, 0.16)]);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.22, bevelEnabled: false }).translate(0, 0, -0.11), kit.mats.plastic('#c9443e'));
  boat.add(hull);
  boat.add(new THREE.Mesh(merged([
    new THREE.BoxGeometry(0.22, 0.14, 0.16).translate(-0.08, 0.23, 0),
    new THREE.CylinderGeometry(0.01, 0.01, 0.4, 5).translate(0.06, 0.36, 0),
  ]), kit.mats.plastic('#e8e2d2')));
  const boatLampMat = std(kit, '#201a10', { emissive: GOLD, emissiveIntensity: 0.1 });
  boat.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.17).translate(-0.08, 0.25, 0), boatLampMat));
  boat.position.set(-4.58, gy + 0.07, 3.15);
  boat.rotation.y = Math.PI / 2 + 0.1;
  kit.add(boat);

  // ---------------------------------------------------------------- the Slope Lab hill (right back)
  const HW = 2.5;
  const HROT = 0.45;
  const hill = new THREE.Group();
  hill.rotation.y = HROT;
  {
    const cx = -HW / 2;
    const cz = HILL_LEN / 2;
    const c = Math.cos(HROT);
    const s = Math.sin(HROT);
    hill.position.set(6.1 - (cx * c + cz * s), gy, -3.5 - (-cx * s + cz * c));
  }
  kit.add(hill);
  const shape = new THREE.Shape(HILL_PROFILE.map(([u, v]) => new THREE.Vector2(u, v)));
  const hillGeo = new THREE.ExtrudeGeometry(shape, { depth: HW, bevelEnabled: false, steps: 1 });
  hillGeo.rotateY(-Math.PI / 2);
  const nrm = hillGeo.attributes.normal as THREE.BufferAttribute;
  const cols = new Float32Array(nrm.count * 3);
  const grass = new THREE.Color('#4a7d45');
  const soil = new THREE.Color('#8a5c3a');
  const rock = new THREE.Color('#7a7e8c');
  for (let i = 0; i < nrm.count; i++) {
    const ny = nrm.getY(i);
    const col = ny > 0.8 ? grass : ny > 0.4 ? soil : ny > -0.5 ? rock : soil;
    cols.set([col.r, col.g, col.b], i * 3);
  }
  hillGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const strata = canvasTex(kit, 1024, 434, paintStrata);
  strata.repeat.set(1 / HILL_LEN, 1 / HILL_TOP);
  const capMat = kit.track(new THREE.MeshStandardMaterial({ map: strata, emissiveMap: strata, emissive: '#ffffff', emissiveIntensity: 0.08, roughness: 0.9 }));
  const hillMesh = new THREE.Mesh(hillGeo, [capMat, kit.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }))]);
  hillMesh.castShadow = true;
  hillMesh.receiveShadow = true;
  hill.add(hillMesh);
  /** Local point on the hill: u along the profile, s across (0 = cut face, 1 = far side). */
  const L = (u: number, s: number, up = 0) => new THREE.Vector3(-HW + s * HW, hillV(u) + up, u);
  const homes = [L(0.3, 0.22), L(0.6, 0.52), L(0.32, 0.82)];
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.26, 0.3).translate(0, 0.13, 0), kit.mats.plastic('#d8cbb0'), 6);
  const roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.3, 0.2, 4).rotateY(Math.PI / 4).translate(0, 0.36, 0), kit.mats.plastic('#a8463a'), 6);
  const winMat = std(kit, '#1a1a22', { emissive: GOLD, emissiveIntensity: 0.1 });
  const wins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.07, 0.31).translate(0, 0.15, 0), winMat, 6);
  homes.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y, p.z);
    walls.setMatrixAt(i, m4);
    roofs.setMatrixAt(i, m4);
    wins.setMatrixAt(i, m4);
  });
  // three more homes on the low ground beside the runoff pond, in world space
  const lowHomes: V3[] = [[4.45, gy, 3.75], [5.05, gy, 3.95], [5.65, gy, 3.75]];
  const toLocal = (p: V3) => hill.worldToLocal(new THREE.Vector3(p[0], p[1], p[2]));
  hill.updateMatrixWorld(true);
  const qInv = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -HROT);
  lowHomes.forEach((p, i) => {
    m4.compose(toLocal(p), qInv, new THREE.Vector3(1, 1, 1));
    walls.setMatrixAt(3 + i, m4);
    roofs.setMatrixAt(3 + i, m4);
    wins.setMatrixAt(3 + i, m4);
  });
  for (const im of [walls, roofs, wins]) {
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true;
    hill.add(im);
  }
  const tp = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];
  smallTree(kit, hill, tp(L(0.75, 0.92)), 0.55, '#4f8a4a', 3);
  smallTree(kit, hill, tp(L(0.15, 0.55)), 0.5, '#3f7a45', 8);
  // creep on the 15° face: fence posts and a tree lean further downhill
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.24, 0.035).translate(0, 0.12, 0), kit.mats.plastic('#9a7a58'), 6);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 6; i++) {
    q.setFromEuler(e.set(0.12 + i * 0.07, 0, 0));
    posts.setMatrixAt(i, m4.compose(L(2.45 + i * 0.26, 0.14, -0.02), q, one));
  }
  posts.instanceMatrix.needsUpdate = true;
  posts.computeBoundingSphere();
  hill.add(posts);
  smallTree(kit, hill, tp(L(3.2, 0.34, -0.02)), 0.5, '#5a9a52', 12, 0.32);
  // rock fall below the 80° cliff; a soaked slump below the unprotected end of the 45° face
  for (let i = 0; i < 4; i++) {
    const r = kit.rock([0, 0, 0], 0.09 + (i % 3) * 0.035, '#8a8c96', 30 + i);
    r.position.copy(L(1.15 + (i % 2) * 0.12, 0.18 + i * 0.22, 0.05));
    hill.add(r);
  }
  const mud = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, 0, TAU, 0, Math.PI / 2), kit.mats.plastic('#6a4428'));
  mud.scale.set(0.6, 0.16, 0.36);
  mud.position.copy(L(2.0, 0.17));
  hill.add(mud);
  // retaining wall and drains on the 45° face (they come on at level 2)
  const rwU = 1.88;
  const rwY = hillV(2.0);
  hill.add(new THREE.Mesh(new THREE.BoxGeometry(HW * 0.6, 0.26, 0.07).translate(-HW * 0.3, rwY + 0.13, rwU), stone));
  const wallGlowMat = std(kit, '#103038', { emissive: TEAL, emissiveIntensity: 0.05 });
  hill.add(new THREE.Mesh(new THREE.BoxGeometry(HW * 0.6, 0.025, 0.08).translate(-HW * 0.3, rwY + 0.27, rwU), wallGlowMat));
  const pipeS = [0.5, 0.7, 0.9];
  hill.add(new THREE.Mesh(merged(pipeS.map((s) => new THREE.CylinderGeometry(0.04, 0.04, 0.16, 12).rotateX(Math.PI / 2).translate(-HW + s * HW, rwY + 0.12, rwU + 0.07))), steel));
  const flowTex = flowTexture(kit, 26);
  flowTex.repeat.set(5, 1);
  const flowMat = kit.track(new THREE.MeshStandardMaterial({ color: '#cfefff', map: flowTex, emissive: '#7fd8ff', emissiveMap: flowTex, emissiveIntensity: 0.05, roughness: 0.15, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
  const spouts = pipeS.map((s) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-HW + s * HW, rwY + 0.12, rwU + 0.15),
    new THREE.Vector3(-HW + s * HW, rwY + 0.04, rwU + 0.28),
    L(2.3, s - 0.02, 0.02),
  ]), 10, 0.026, 6, false));
  // collecting chute across the top of the 15° face and down it, then out to the runoff pond
  hill.updateMatrixWorld(true);
  const W = (v: THREE.Vector3) => hill.localToWorld(v.clone());
  const chuteCurve = new THREE.CatmullRomCurve3([
    W(L(2.3, 0.94, 0.03)), W(L(2.3, 0.66, 0.03)), W(L(3.0, 0.6, 0.03)), W(L(3.95, 0.56, 0.03)),
    new THREE.Vector3(5.45, gy + 0.03, -0.45), new THREE.Vector3(5.15, gy + 0.03, 0.55), new THREE.Vector3(5.05, gy + 0.03, 1.5),
  ]);
  const chan = channelGeometry(chuteCurve, 70, 0.075, 0.07);
  kit.add(new THREE.Mesh(chan.walls, std(kit, '#6a7284', { roughness: 0.85, side: THREE.DoubleSide })));
  const hillToWorld = new THREE.Matrix4().copy(hill.matrixWorld);
  kit.add(new THREE.Mesh(merged([...spouts.map((g) => g.applyMatrix4(hillToWorld)), chan.water]), flowMat));
  // the runoff pond in a rounded concrete rim
  const PONDC: V3 = [5.05, gy, 2.35];
  const pond = kit.water([PONDC[0], gy + 0.04, PONDC[2]], 1.9, 1.3, '#1d5a6a');
  const pondMat = pond.material as THREE.MeshPhysicalMaterial;
  pondMat.emissive = new THREE.Color('#2a8ab8');
  pondMat.emissiveIntensity = 0.05;
  const rim = new THREE.Shape();
  rim.moveTo(-1.05, -0.75);
  rim.lineTo(1.05, -0.75);
  rim.lineTo(1.05, 0.75);
  rim.lineTo(-1.05, 0.75);
  rim.closePath();
  const hole = new THREE.Path();
  hole.absellipse(0, 0, 0.92, 0.6, 0, TAU, true, 0);
  rim.holes.push(hole);
  kit.add(new THREE.Mesh(new THREE.ExtrudeGeometry(rim, { depth: 0.12, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2).translate(PONDC[0], gy, PONDC[2]), stoneCap));
  // Wonderlight: every defense traced in running gold light (sea wall, barrier piers, channel)
  const dashTex = canvasTex(kit, 256, 16, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.7, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  dashTex.wrapS = THREE.RepeatWrapping;
  dashTex.repeat.set(10, 1);
  const circuitMat = kit.track(new THREE.MeshBasicMaterial({ color: GOLD, map: dashTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const line = (pts: V3[], segs: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0), segs, 0.026, 6, false);
  const cy = gy + 0.415;
  const circuitParts = [
    line([[-3.86, cy, 6.1], [-3.86, cy, -0.4], [-3.86, cy, -6.9]], 40),
    ...PZ.map((z) => line([[-4.3, gy + 0.345, z - 0.24], [-6.1, gy + 0.345, z - 0.24], [-6.1, gy + 0.345, z + 0.24], [-4.3, gy + 0.345, z + 0.24]], 30)),
  ];
  for (const k of [-1, 1]) {
    const off: V3[] = [];
    const cpts = chuteCurve.getSpacedPoints(50);
    for (let i = 0; i < cpts.length; i++) {
      const a = cpts[Math.max(0, i - 1)];
      const b = cpts[Math.min(cpts.length - 1, i + 1)];
      const tx = b.x - a.x;
      const tz = b.z - a.z;
      const l = Math.hypot(tx, tz) || 1;
      off.push([cpts[i].x - (tz / l) * 0.112 * k, cpts[i].y + 0.075, cpts[i].z + (tx / l) * 0.112 * k]);
    }
    circuitParts.push(line(off, 60));
  }
  const circuit = new THREE.Mesh(merged(circuitParts), circuitMat);
  circuit.visible = false;
  kit.add(circuit);
  // flood gauge post by the pond: the glowing water mark rises in the storm and falls at dawn
  const gaugeTex = canvasTex(kit, 64, 512, (ctx, w, h) => {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#e8edf2' : '#c9443e';
      ctx.fillRect(0, (i * h) / 10, w, h / 10);
    }
    ctx.fillStyle = '#1a1030';
    for (let i = 1; i < 20; i++) ctx.fillRect(0, (i * h) / 20 - 2, w * (i % 2 ? 0.35 : 0.6), 4);
  });
  const GX = 3.95;
  const GZ = 2.2;
  kit.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.25, 0.1).translate(GX, gy + 0.625, GZ), kit.track(new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.6 }))));
  const markMat = kit.track(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.2), markMat);
  mark.position.set(GX, gy + 0.3, GZ);
  kit.add(mark);
  const gaugeSign = kit.neonSign('FLOOD GAUGE', [5.15, gy + 0.42, 3.15], { height: 0.22, color: TEAL, rotY: -0.25 });
  gaugeSign.rotation.x = -0.65;
  const slopeSign = wideSign(kit, 'SLOPE LAB', [4.5, gy + 0.62, -1.55], 1.25, 0.26, ORANGE);
  slopeSign.g.rotation.set(-0.5, -0.35, 0);

  // ---------------------------------------------------------------- weather
  const cloudMatL = std(kit, '#3a4766', { roughness: 0.95, emissive: '#9fb4ff', emissiveIntensity: 0 });
  const cloudMatR = std(kit, '#3a4766', { roughness: 0.95, emissive: '#9fb4ff', emissiveIntensity: 0 });
  const cloudL = stormCloud3D(kit, [-7.4, 2.45, -1.6], [[0, 0, 0, 0.55], [0.6, -0.1, 0.1, 0.42], [-0.62, -0.08, -0.05, 0.45], [0.2, 0.32, -0.1, 0.4], [-0.3, 0.25, 0.15, 0.36], [1.05, -0.2, -0.05, 0.3]], cloudMatL);
  const cloudR = stormCloud3D(kit, [6.6, 2.2, -3.6], [[0, 0, 0, 0.52], [0.6, -0.08, 0.05, 0.4], [-0.58, -0.1, 0.05, 0.4], [0.15, 0.3, -0.12, 0.4], [-0.95, -0.2, 0, 0.28]], cloudMatR);
  const boltL = bolt(kit, [-7.2, 2.05, -1.4], 4, '#cfe0ff');
  const boltR = bolt(kit, [6.75, 1.82, -3.4], 9, '#cfe0ff');
  boltL.visible = false;
  boltR.visible = false;
  const rainL = kit.motes({ x0: -8.3, x1: -6.5, y0: 0, y1: 2.1, z0: -2.2, z1: -1.0 }, 60, RAIN, { speed: 2.6, size: 0.1, rise: false });
  const rainR = kit.motes({ x0: 5.8, x1: 7.4, y0: 0.6, y1: 2.0, z0: -4.4, z1: -2.8 }, 50, RAIN, { speed: 2.6, size: 0.1, rise: false });
  const cloudStorm = new THREE.Color('#3a4766');
  const cloudDawn = new THREE.Color('#e7b0a2');
  // dawn sun rising behind the Slope Lab hill (top-right corner), glitter on the sea (level 4)
  const sunMat = std(kit, '#3a2a10', { emissive: '#ffd27a', emissiveIntensity: 0.1 });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 18), sunMat);
  sun.position.set(7.75, -0.8, -6.9);
  kit.add(sun);
  const halo = new THREE.Sprite(kit.track(new THREE.SpriteMaterial({ map: radialTexture('rgba(255,214,150,1)', 'rgba(255,214,150,0)', 'sunhalo'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  halo.scale.set(3.4, 3.4, 1);
  kit.add(halo);
  const glitter = kit.motes({ x0: -7.6, x1: -4.6, y0: gy + 0.16, y1: gy + 0.2, z0: -6.5, z1: 5.5 }, 90, '#ffe2a8', { speed: 0.012, size: 0.12 });
  // storm waves throwing spray against the sea wall (dies away at dawn)
  const spray = kit.motes({ x0: -4.75, x1: -4.3, y0: gy + 0.12, y1: gy + 0.75, z0: -6.4, z1: 5.6 }, 46, FOAM, { speed: 0.5, size: 0.09 });
  // harbor festival lights: from the Harbor Watch to the sea-wall lamps, and along the land quay
  const towerTop: V3 = [-5.0, gy + 1.5 * 1.15 + 0.32, -1.05];
  const fest = [
    kit.stringLights(towerTop, [-3.98, gy + 1.08, -5.6], 0.28, kit.n(12), [GOLD, CORAL, TEAL]),
    kit.stringLights(towerTop, [-3.98, gy + 1.08, 2.2], 0.32, kit.n(12), [GOLD, TEAL, CORAL]),
    kit.stringLights([4.0, gy + 1.0, -0.75], [3.95, gy + 1.22, 2.2], 0.26, kit.n(10), [GOLD, CORAL, TEAL]),
  ];
  kit.pole([4.0, 0, -0.75], gy + 1.04, '#8a96ad');
  const gold = kit.motes({ x0: -9, x1: 9, y0: 0, y1: 3.2, z0: -7, z1: 5 }, 80, GOLD, { speed: 0.12, size: 0.09 });

  // ---------------------------------------------------------------- the warning chain
  tank.updateMatrixWorld(true);
  tower.updateMatrixWorld(true);
  sat.updateMatrixWorld(true);
  const wpos = (o: THREE.Object3D, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z));
  const chain = new THREE.CatmullRomCurve3([
    wpos(tank, SX, BED + 0.15, FZ),
    wpos(tank, SX, SURF - 0.05, FZ),
    wpos(tank, SX + 0.04, SURF + 0.75, FZ),
    wpos(sat, 0, -0.35, 0),
    wpos(sat, 0, -0.15, 0),
    new THREE.Vector3(-5.3, 2.0, -2.9),
    wpos(tower, 0, TH3 + 0.62, 0),
  ]);
  const chainLine = kit.neonTube(chain.getPoints(48).map((p) => [p.x, p.y, p.z] as V3), TEAL, { radius: 0.008 });
  const NP = kit.n(14);
  const pulsePos = new Float32Array(NP * 3);
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulseMat = kit.track(new THREE.PointsMaterial({ color: '#bffaf0', size: 0.2, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  const pulses = new THREE.Points(pulseGeo, pulseMat);
  pulses.frustumCulled = false;
  kit.add(pulses);
  const tmp = new THREE.Vector3();
  const placePulses = (phase: number) => {
    for (let i = 0; i < NP; i++) {
      chain.getPointAt((phase + i / NP) % 1, tmp);
      pulsePos[i * 3] = tmp.x;
      pulsePos[i * 3 + 1] = tmp.y;
      pulsePos[i * 3 + 2] = tmp.z;
    }
    pulseGeo.attributes.position.needsUpdate = true;
  };
  placePulses(0);

  // ---------------------------------------------------------------- head: panorama + marquee
  const pano = kit.backdrop(paintPanorama, { width: 26, height: 10, z: -15, y: 3.8 });
  const marquee = wideSign(kit, 'STORMWATER HARBOR', [0, 1.3, -7.2], 5.0, 0.6, GOLD);
  marquee.g.rotation.x = -0.72;

  // ---------------------------------------------------------------- lights (three)
  const spotL = kit.spot([-5, 6.5, 3.5], [-6.0, 0.2, -1.2], '#a8c8ff', 32, 0.6);
  const spotR = kit.spot([5, 6.5, 3.5], [6.0, 0.4, -2.2], '#ffd9a8', 30, 0.55);
  const harborGlow = kit.point([-5.4, 2.0, 2.4], GOLD, 0, 9);
  const coolL = new THREE.Color('#a8c8ff');
  const warm = new THREE.Color('#ffc890');

  // ---------------------------------------------------------------- state + motion
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let storm = 1;
  let boost = 0;
  let shutTarget = 0;
  let shut = 0;
  let flash = 0;
  let nextFlash = 3;
  let beamA = 0;
  let pulseT = 0;
  const setArms = (v: number) => {
    // each arm rests in its dock beside its pier and swings out to meet the other mid-channel
    armN.rotation.y = DOCK + v * (-Math.PI / 2 - DOCK);
    armS.rotation.y = -DOCK + v * (Math.PI / 2 + DOCK);
  };
  setArms(0);
  kit.animate((t, dt) => {
    shut += (shutTarget - shut) * Math.min(1, dt * 0.9);
    setArms(shut);
    // soft lightning pulses while the storm lasts (one every few seconds, never strobing)
    if (t > nextFlash) {
      flash = 1;
      nextFlash = t + 3.5 + ((t * 7.31) % 3);
    }
    flash = Math.max(0, flash - dt * 3.2);
    const fl = flash * storm;
    const fr = Math.max(0, flash - 0.4) * storm * 1.6;
    cloudMatL.emissiveIntensity = 0.02 + 0.5 * fl;
    cloudMatR.emissiveIntensity = 0.02 + 0.5 * fr;
    boltL.setLit(fl * 0.9);
    boltR.setLit(fr);
    boltL.visible = fl > 0.03;
    boltR.visible = fr > 0.03;
    buoy.position.y = SURF + Math.sin(t * 1.3) * 0.02;
    buoy.rotation.z = Math.sin(t * 0.9) * 0.06;
    boat.position.y = gy + 0.07 + Math.sin(t * 1.1 + 1) * 0.015;
    boat.rotation.z = Math.sin(t * 0.8) * 0.04;
    sat.rotation.y = 0.5 + Math.sin(t * 0.25) * 0.2;
    beamA += dt * (0.5 + 0.9 * s4 + 1.5 * boost);
    // the beacon sweeps the open sea, never across the playfield
    beamPivot.rotation.y = Math.PI + Math.sin(beamA) * 1.1;
    // sound pings climb from the seafloor sensor to the buoy
    const on = Math.max(s3, boost);
    for (let i = 0; i < rings.length; i++) {
      const u = (t * 0.45 + i / rings.length) % 1;
      rings[i].position.y = BED + 0.22 + u * (SURF - BED - 0.3);
      rings[i].scale.setScalar(0.7 + u * 0.8);
      ringMats[i].opacity = on * 0.85 * Math.sin(u * Math.PI);
    }
    // warning pulses run sensor -> buoy -> satellite -> Harbor Watch
    pulseT += dt * (0.1 + 0.12 * boost);
    placePulses(pulseT);
    if (s2 > 0.01) flowTex.offset.x -= dt * (0.6 + 0.6 * s2);
    if (circuit.visible) dashTex.offset.x -= dt * (0.35 + 0.8 * boost);
    satLampMat.emissiveIntensity = 0.1 + on * (1.6 + 1.4 * Math.max(0, Math.sin(t * 3)));
    buoyLampMat.emissiveIntensity = 0.1 + on * (1.4 + 1.6 * Math.max(0, Math.sin(t * 2.2)));
  });

  return {
    update(_t, dt, level, energy) {
      const s1 = kit.stage(level, 0, 1);
      s2 = kit.stage(level, 1, 2);
      s3 = kit.stage(level, 2, 3);
      s4 = kit.stage(level, 3.2, 4);
      storm = 1 - s4;
      pano.repaint(level);
      skyU.top.value.copy(skyTop[0]).lerp(skyTop[1], s4);
      skyU.bottom.value.copy(skyBottom[0]).lerp(skyBottom[1], s4);
      // the barrier stands open in calm weather, shuts while the storm builds, opens at dawn
      shutTarget = kit.stage(level, 0.5, 1) * (1 - kit.stage(level, 3.4, 4));
      if (kit.reducedMotion) {
        shut = shutTarget;
        setArms(shut);
        satLampMat.emissiveIntensity = 0.1 + 2 * s3;
        buoyLampMat.emissiveIntensity = 0.1 + 2 * s3;
        for (const m of ringMats) m.opacity = 0.5 * s3;
      }
      // mission 1: every hazard is labelled
      slopeSign.setLit(0.2 + 0.8 * s1);
      gaugeSign.setLit(0.2 + 0.8 * s1);
      dartSign.setLit(0.2 + 0.8 * Math.max(s1 * 0.6, s3));
      capMat.emissiveIntensity = 0.08 + 0.3 * s1;
      panelMat.emissiveIntensity = 0.12 + 0.25 * s1 + 0.35 * s3;
      towerWinMat.emissiveIntensity = 0.2 + 1.6 * s1;
      markMat.opacity = 0.35 + 0.5 * s1;
      mark.position.y = gy + 0.25 + 0.55 * kit.stage(level, 0, 1.5) - 0.5 * s3;
      // mission 2: drains and the runoff pond come on; town windows and harbor lamps glow
      flowMat.opacity = 0.25 + 0.7 * s2;
      flowMat.emissiveIntensity = 0.05 + 0.9 * s2;
      wallGlowMat.emissiveIntensity = 0.05 + 2.2 * s2;
      pondMat.emissiveIntensity = 0.05 + 0.35 * s2 + 0.2 * s4;
      winMat.emissiveIntensity = 0.15 + 1.8 * s2;
      lampHeadMat.emissiveIntensity = 0.15 + 2.6 * Math.max(s2, s4);
      boatLampMat.emissiveIntensity = 0.1 + 1.8 * Math.max(s2, s4);
      // mission 3: the warning chain lights up; the tower beacon sweeps
      surfMat.emissiveIntensity = 0.1 + 0.5 * s3;
      sensorMat.emissiveIntensity = 0.1 + 1.6 * s3;
      satPanelMat.emissiveIntensity = 0.05 + 0.5 * s3;
      chainLine.setLit(0.03 + 0.22 * s3);
      pulseMat.opacity = Math.max(s3, boost) * 0.95;
      beaconMat.emissiveIntensity = 0.1 + 2.6 * Math.max(s3, boost);
      beamMat.opacity = 0.22 * s3 + 0.1 * s4 + 0.2 * boost;
      watchSign.setLit(0.18 + 0.82 * s3);
      barrierSign.setLit(0.2 + 0.8 * Math.max(s2, s3));
      barrierLampMat.emissiveIntensity = 0.1 + 1.4 * s3 + 1.6 * s4;
      // Wonderlight: the storm clears to dawn over a defended harbor
      cloudMatL.color.copy(cloudStorm).lerp(cloudDawn, s4);
      cloudMatR.color.copy(cloudStorm).lerp(cloudDawn, s4);
      rainL.setLit(storm * (0.3 + 0.4 * (1 - s3 * 0.6)));
      rainR.setLit(storm * (0.35 + 0.5 * (1 - s2 * 0.5)));
      rainL.visible = storm > 0.02;
      rainR.visible = storm > 0.02;
      seaMat.emissive.copy(seaDark).lerp(seaDawn, s4);
      seaMat.emissiveIntensity = 0.3 + 0.12 * s3 + 0.25 * s4;
      quayMat.color.setScalar(1).lerp(warm, 0.25 * s4);
      gateMat.emissiveIntensity = 0.2 * s4 + 0.3 * boost;
      sunMat.emissiveIntensity = 0.1 + 2.4 * s4;
      sun.position.y = -1.4 + 1.85 * s4;
      halo.position.set(sun.position.x, sun.position.y, sun.position.z + 0.5);
      (halo.material as THREE.SpriteMaterial).opacity = 0.6 * s4;
      halo.visible = s4 > 0.01;
      circuit.visible = s4 > 0.01 || boost > 0.01;
      circuitMat.opacity = 0.9 * Math.max(s4, boost);
      glitter.setLit(Math.max(s4, boost * 0.6) * 0.9);
      glitter.visible = s4 > 0.01 || boost > 0.01;
      gold.setLit(0.05 + 0.75 * Math.max(s4, boost));
      spray.setLit(storm * 0.55);
      spray.visible = storm > 0.02;
      for (const f of fest) f.setLit(0.08 + 0.3 * s2 + 0.62 * Math.max(s4, boost));
      // the storm moves off: clouds drift away from the harbor as they turn to dawn colours
      cloudL.position.set(-7.4 - 1.3 * s4, 2.45 + 0.35 * s4, -1.6 - 0.8 * s4);
      cloudR.position.set(6.6 + 1.1 * s4, 2.2 + 0.35 * s4, -3.6 + 0.6 * s4);
      marquee.setLit(0.12 + 0.5 * s1 + 0.38 * s2 + 0.2 * energy * s4);
      if (spotL) {
        spotL.color.copy(coolL).lerp(warm, 0.7 * s4);
        spotL.intensity = 32 + 10 * s4;
      }
      if (spotR) spotR.intensity = 30 + 10 * s4;
      if (harborGlow) harborGlow.intensity = 1.5 * s2 + 5 * s4 + 4 * boost;
      boost = Math.max(0, boost - dt * 0.6);
    },
    celebrate(p) {
      boost = Math.max(boost, Math.sin(p * Math.PI));
    },
  };
};

const harborRoom: RoomBuilder = ({ kit }) => {
  // Seen from the front: the Slope Lab hill in cross-section on the left, the sea wall and the
  // Harbor Watch in the middle, and a cut-open sea with the DART sensor and buoy on the right.
  const s = 0.36;
  const shape = new THREE.Shape(HILL_PROFILE.map(([u, v]) => new THREE.Vector2(u * s, v * s)));
  const strata = canvasTex(kit, 512, 217, paintStrata);
  strata.repeat.set(1 / (HILL_LEN * s), 1 / (HILL_TOP * s));
  const hillGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: false });
  const hill = new THREE.Mesh(hillGeo, [
    kit.track(new THREE.MeshStandardMaterial({ map: strata, emissiveMap: strata, emissive: '#ffffff', emissiveIntensity: 0.1, roughness: 0.9 })),
    kit.mats.plastic('#4f7a4a'),
  ]);
  hill.position.set(-1.02, 0, -0.75);
  kit.add(hill);
  const top = HILL_TOP * s;
  kit.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.13).translate(-0.86, top + 0.055, -0.45), kit.mats.plastic('#d8cbb0')));
  kit.add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.09, 4).rotateY(Math.PI / 4).translate(-0.86, top + 0.155, -0.45), kit.mats.plastic('#a8463a')));
  const winMat = kit.track(new THREE.MeshStandardMaterial({ color: '#1a1a22', emissive: GOLD, emissiveIntensity: 0.1 }));
  kit.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.135).translate(-0.86, top + 0.06, -0.45), winMat));
  // sea wall with the little Harbor Watch tower and its beacon
  kit.add(new THREE.Mesh(merged([
    new THREE.BoxGeometry(0.1, 0.42, 1.5).translate(0.43, 0.21, 0.0),
    new THREE.BoxGeometry(0.035, 0.42, 0.035).translate(0.43, 0.63, -0.55),
  ]), kit.mats.plastic('#7d8596')));
  kit.add(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.08, 4).rotateY(Math.PI / 4).translate(0.43, 0.92, -0.55), kit.mats.plastic('#b8443e')));
  const beaconMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: CORAL, emissiveIntensity: 0.1 }));
  kit.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.12).translate(0.43, 0.85, -0.55), beaconMat));
  // the cut-open sea: seafloor sensor, a buoy riding the surface, the satellite overhead
  const seaMat = kit.track(new THREE.MeshStandardMaterial({ color: '#1d5a7a', emissive: '#2a8ab8', emissiveIntensity: 0.1, transparent: true, opacity: 0.78, roughness: 0.2 }));
  kit.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.32, 1.5).translate(0.76, 0.16, 0.0), seaMat));
  const sensorMat = kit.track(new THREE.MeshStandardMaterial({ color: '#c9a24a', emissive: GOLD, emissiveIntensity: 0.1 }));
  kit.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.06, 12).translate(0.76, 0.03, 0.35), sensorMat));
  const buoy = new THREE.Group();
  buoy.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.06, 14), kit.mats.plastic(ORANGE)));
  buoy.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 5).translate(0, 0.13, 0), kit.mats.plastic('#e8edf2')));
  const lampMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: CORAL, emissiveIntensity: 0.1 }));
  buoy.add(new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8).translate(0, 0.25, 0), lampMat));
  buoy.position.set(0.76, 0.34, 0.35);
  kit.add(buoy);
  const sat = new THREE.Mesh(merged([new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.BoxGeometry(0.34, 0.01, 0.08)]), kit.mats.brass());
  sat.position.set(0.78, 1.12, -0.3);
  sat.rotation.z = 0.2;
  kit.add(sat);
  // the surge barrier: two curved gate arms on the sea that swing shut in the storm
  const gateMat = kit.track(new THREE.MeshStandardMaterial({ color: '#e6ebf0', side: THREE.DoubleSide, emissive: GOLD, emissiveIntensity: 0 }));
  const arms = [-1, 1].map((side) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10, 1, true, Math.PI / 2 - 0.3, 0.6).translate(0, 0.05, 0), gateMat));
    g.position.set(0.76 + side * 0.24, 0.32, 0.62);
    kit.add(g);
    return { g, side };
  });
  // storm cloud and rain over the hill; both clear as the room glows
  const cloudMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a4766', roughness: 0.95, emissive: '#ffb27a', emissiveIntensity: 0 }));
  const cloud = new THREE.Mesh(merged([[0, 0, 0, 0.15], [0.16, -0.03, 0, 0.11], [-0.16, -0.03, 0.02, 0.11], [0.05, 0.09, -0.03, 0.1]].map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z))), cloudMat);
  cloud.position.set(-0.5, 1.22, -0.35);
  kit.add(cloud);
  const rain = kit.motes({ x0: -0.72, x1: -0.28, y0: 0.62, y1: 1.1, z0: -0.5, z1: -0.2 }, 22, RAIN, { speed: 1.4, size: 0.05, rise: false });
  const sign = kit.neonSign('HARBOR', [0.12, 1.42, -0.86], { height: 0.2, color: GOLD });
  const storm = new THREE.Color('#3a4766');
  const dawn = new THREE.Color('#e7b0a2');
  return {
    update(t, lit) {
      winMat.emissiveIntensity = 0.1 + 2 * lit;
      const blink = kit.reducedMotion ? 1 : 0.6 + 0.4 * Math.max(0, Math.sin(t * 2.4));
      lampMat.emissiveIntensity = 0.1 + 1.8 * lit * blink;
      beaconMat.emissiveIntensity = 0.1 + 2 * lit * blink;
      sensorMat.emissiveIntensity = 0.1 + 1.2 * lit;
      seaMat.emissiveIntensity = 0.1 + 0.5 * lit;
      gateMat.emissiveIntensity = 0.3 * lit;
      cloudMat.color.copy(storm).lerp(dawn, lit);
      cloudMat.emissiveIntensity = 0.25 * lit;
      rain.setLit(0.6 * (1 - lit));
      rain.visible = lit < 0.98;
      sign.setLit(lit);
      // shut across the water in the storm, swung back toward the sea wall once the room glows
      for (const a of arms) a.g.rotation.y = a.side < 0 ? lit * (Math.PI / 2) : Math.PI - lit * (Math.PI / 2);
      buoy.position.y = 0.34 + (kit.reducedMotion ? 0 : Math.sin(t * 1.4) * 0.01);
    },
  };
};

export const L26: TableDef = {
  lessonId: 'L26',
  signature: 'The Flood Gate: twin storm-surge barrier arms that shut the harbor basin while the storm builds',
  ballRole: 'The Wonderball is a game token, not a boulder or a raindrop: real landslides, tsunamis and floods move enormous amounts of earth and water.',
  theme: {
    bg: [STORM, NIGHT],
    rail: '#b9c8dc',
    railHighlight: '#ffffff',
    lampOn: '#FFC75B',
    lampOff: 'rgba(255,247,231,0.12)',
    accent: '#FF9F5A',
    accent2: '#6FE3D6',
    bumperCap: '#d6e6f5',
    bumperRing: '#33456b',
    flipper: '#ffd98a',
    ink: '#FFF7E7',
    ramp: 'rgba(111,227,214,0.16)',
    trail: '#9fe8ff',
  },
  lines: {
    intro: 'Welcome to Stormwater Harbor, where every rockslide, wave and flood has a cause. Read the clues, build the defenses and keep the harbor lights burning!',
    quark: '"A tsunami is just a giant high tide, isn\'t it? The Moon must be pulling extra hard tonight," Professor Quark wonders.',
    pipTip: 'A soft plunge drops onto the Slope Lab hill and rolls across the SUMMIT lane.',
  },
  build,
  skillShot: 'summit',
  shots: [
    { id: 'seaWall', label: 'Sea Wall orbit', on: [{ type: 'shot', id: 'seawall_sw' }], insert: 'ins_seawall' },
    { id: 'drainage', label: 'Drainage Channel', on: [{ type: 'ramp', id: 'drain_ramp' }], insert: 'ins_drain' },
    { id: 'floodGate', label: 'Flood Gate', on: [{ type: 'target', group: 'floodgate' }, { type: 'saucer', id: 'harbor_watch' }], insert: 'ins_gate' },
    { id: 'slopes', label: 'Slope models', on: [{ type: 'drop', group: 'slopes' }], insert: 'ins_slopes' },
    { id: 'sensor', label: 'Seafloor SENSOR', on: [{ type: 'target', id: 'dart_sensor' }], insert: 'ins_sensor' },
    { id: 'buoy', label: 'BUOY', on: [{ type: 'target', id: 'dart_buoy' }], insert: 'ins_buoy' },
    { id: 'satellite', label: 'SATELLITE', on: [{ type: 'target', id: 'dart_sat' }], insert: 'ins_sat' },
    { id: 'clouds', label: 'Storm clouds', on: [{ type: 'bumper', group: 'clouds' }], insert: 'ins_clouds' },
    { id: 'lanes', label: 'Sea lanes', on: [{ type: 'rollover', group: 'movers' }], insert: 'ins_lanes' },
    { id: 'flood', label: 'Flood Gauge', on: [{ type: 'target', group: 'flood' }], insert: 'ins_flood' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Hazard Spotter',
      brief: 'Spot three hazards: slopes giving way to gravity, a tsunami (not a tide or a wind wave), and floods from runoff or storm surge.',
      objectiveIds: ['L26-O1'],
      stages: [
        { kind: 'collect', text: 'Gravity at work: knock down 3 slope targets', match: { type: 'drop', group: 'slopes' }, count: 3, preview: ['slopes'] },
        { kind: 'collect', text: 'Sea movers: MOON tide, WIND wave, QUAKE tsunami', match: { type: 'rollover', group: 'movers' }, count: 3, distinct: true, lamps: ['sea_moon', 'sea_wind', 'sea_quake'] },
        { kind: 'collect', text: 'Flood sources: hit RUNOFF and SURGE', match: { type: 'target', group: 'flood' }, count: 2, distinct: true, lamps: ['flood_runoff', 'flood_surge'] },
        { kind: 'discover', text: 'Report to the Harbor Watch', pocket: 'harbor_watch', questions: 1 },
      ],
      discovery: 'Gravity pulls soil and rock downhill. A tsunami usually starts with a sudden seafloor shift; tides come from the Moon and Sun, and everyday waves from wind. Floods come mainly from runoff or storm surge.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Slope and Storm Lab',
      brief: 'Soak the hill with the storm clouds, watch the slopes give way, then send the runoff down the Drainage Channel.',
      objectiveIds: ['L26-O2', 'L26-O3'],
      stages: [
        { kind: 'collect', text: 'Storm rain soaks the hill: hit the clouds 6 times', match: { type: 'bumper', group: 'clouds' }, count: 6, preview: ['clouds'] },
        { kind: 'collect', text: 'Soaked slopes slip: knock down 4 slope targets', match: { type: 'drop', group: 'slopes' }, count: 4, preview: ['slopes'] },
        { kind: 'shots', text: 'Too much rain runs off: shoot the Drainage Channel', shots: ['drainage'] },
        { kind: 'discover', text: 'Compare the evidence at the Harbor Watch', pocket: 'harbor_watch', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'Steep, rain-soaked slopes fail more often and faster than dry, gentle ones. Rain that falls faster than the ground can soak it up becomes runoff, which can flood low ground.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Defend the Harbor',
      brief: 'Pass a warning up the DART chain, fit each defense to the place it protects, then weigh them at the Harbor Watch.',
      objectiveIds: ['L26-O4', 'L26-O3'],
      stages: [
        { kind: 'shots', text: 'Warn the coast: SENSOR, BUOY, then SATELLITE', shots: ['sensor', 'buoy', 'satellite'], order: 'sequence' },
        { kind: 'shots', text: 'Fit each defense: Sea Wall, Channel, Flood Gate', shots: ['seaWall', 'drainage', 'floodGate'], order: 'any' },
        { kind: 'discover', text: 'Weigh the defenses at the Harbor Watch', pocket: 'harbor_watch', questions: 1 },
      ],
      discovery: 'No single defense fits every place. Channels steer water around slopes, sea walls and surge barriers guard coasts, and warnings buy time. Each lowers the risk; none removes it.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Resilient Harbor',
    brief: 'Combine every defense, then bring the Wonderball home to the Harbor Watch.',
    stages: [
      { kind: 'shots', text: 'Combine defenses: wall, drain, gate and warning', shots: ['seaWall', 'drainage', 'floodGate', 'satellite'], order: 'any' },
      { kind: 'discover', text: 'Final report at the Harbor Watch', pocket: 'harbor_watch', questions: 2 },
    ],
    celebration: 'The storm clouds part over a better-prepared harbor, where walls, drains, gates and warnings work together to lower the risk. The Wonderlight is yours!',
  },
  onProgress(rt: TableRuntime, { slot, stage }) {
    // Calm weather (the first mission) and every discovery: the gate stands open. While the storm
    // builds (missions 2-3 and the finale), the barrier swings shut across the basin.
    const stages = slot === 3 ? L26.finale.stages : slot < 3 ? L26.missions[slot as 0 | 1 | 2].stages : [];
    const discovering = stages[stage]?.kind === 'discover';
    const shut = slot >= 1 && slot <= 3 && !discovering;
    for (const id of ['gate_left', 'gate_right']) rt.get<Diverter>(id).set(shut ? 1 : 0);
  },
  set: harborSet,
  room: harborRoom,
  icons: {
    buoy(ctx, s) {
      // a DART-style surface buoy: float, mast and beacon
      ctx.beginPath();
      ctx.ellipse(0, s * 0.45, s * 0.85, s * 0.32, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-s * 0.1, -s * 0.75, s * 0.2, s * 1.1);
      ctx.beginPath();
      ctx.arc(0, -s * 0.8, s * 0.2, 0, TAU);
      ctx.fill();
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.arc(0, -s * 0.8, s * 0.45, -2.4, -0.7);
      ctx.stroke();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintHarbor(ctx, level);
    },
    ambient: paintAmbient,
    celebrate: paintCelebrate,
  },
};
export default L26;
