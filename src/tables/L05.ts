// Lesson 5 — Using Stored Energy — "Mitochondria Midnight Express"
// A clockwork railway winds through an illustrated cell at midnight. The Express Loop is a
// closed horseshoe track around the whole cell with four station rollovers: two plant-cell
// stops and two animal-cell stops, because both kinds of cells respire. A clearly marked
// Tunnel portal lifts the train to the top of the line, oxygen bumpers and a C6-H12-O6 sugar
// bank feed the reaction, signal gates turn descending trains toward the inlanes (and let
// kickbacks fly up and around the line), and the Respiration Station (Wonder Pocket) sits in
// a mitochondrion at the heart of the cell.

import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { SetBuilder, RoomBuilder, SetKit } from '../game/render3d/setKit.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import type * as THREE_NS from 'three';
import { TAU, gear, glowDot, mix, neonPath, neonText, plaque, rgba, rng, rrect, stage, stars, vgrad } from '../game/render/art.ts';

const NIGHT = '#141b45';
const PLUM = '#291B46';
const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const LEAF = '#8FE388';
const OXY = '#8FD3FF';
const BRASS = '#d9b46a';
const RUST = '#b8683a';

// ---------------------------------------------------------------- shared loop geometry
const ARC_C: [number, number] = [310, 300];
const INNER_R = 236;
const TRACK_R = 261;
const RIGHT_END_DEG = 323;
const deg2rad = (d: number) => (d * Math.PI) / 180;
const onTrack = (deg: number, r = TRACK_R): [number, number] => [ARC_C[0] + r * Math.cos(deg2rad(deg)), ARC_C[1] + r * Math.sin(deg2rad(deg))];
const ST_LEAF: [number, number] = [49, 390];
const ST_ROOT = onTrack(200);
const ST_PAW = onTrack(335);
const ST_FIN: [number, number] = [523, 440];
const STATION: [number, number] = [286, 420];
const TUNNEL_IN: [number, number] = [472, 404];
const TUNNEL_OUT: [number, number] = [286, 39];
/** Plant-cell stops on the west of the line, animal-cell stops on the east. */
const STATIONS: [string, [number, number], string][] = [
  ['st_leaf', ST_LEAF, LEAF],
  ['st_root', ST_ROOT, LEAF],
  ['st_paw', ST_PAW, CORAL],
  ['st_fin', ST_FIN, CORAL],
];
/** Painted nameboards, each kept inside the track channel (radius 239–282 on the arch). */
const STATION_BOARDS: [string, [number, number], string][] = [
  ['LEAF', [ST_LEAF[0], ST_LEAF[1] - 24], LEAF],
  ['ROOT', onTrack(190, 258), LEAF],
  ['PAW', onTrack(327, 258), CORAL],
  ['FIN', [ST_FIN[0], ST_FIN[1] - 24], CORAL],
];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'both' });

  // ---------------------------------------------------------------- Express Loop (horseshoe)
  const re = onTrack(RIGHT_END_DEG, INNER_R);
  b.wall([[74, 444], ...b.arcPoints(ARC_C[0], ARC_C[1], INNER_R, 180, RIGHT_END_DEG, 30), [re[0], 630]], { id: 'loop_inner', r: 3 });
  b.post(74, 446, 5);
  b.post(re[0], 632, 5);
  // Signal gates: one-way flaps that turn descending trains toward the inlanes, while letting
  // kickback shots fly straight up the channels and all the way around the line.
  b.gate('signal_west', [FRAME.left + 3, 600], [60, 690], -90);
  b.gate('signal_east', [FRAME.laneSep - 3, 640], [508, 692], -90);
  // Direction-aware loop switches: only trains travelling UP a channel count.
  b.shotSwitch('loop_left_sw', 49, 330, -90);
  b.shotSwitch('loop_right_sw', 523, 340, -90);
  b.spinner('wheel_spinner', [500, 560], [546, 560], { label: 'WHEEL' });

  // Station rollovers: plant cells on the west side of the line, animal cells on the east.
  // Their names are painted as station nameboards in the backdrop (STATION_BOARDS): a floor
  // label sits 22 units above the switch, which on the arch slides under the outer rail.
  for (const [id, [x, y], color] of STATIONS) b.rollover(id, x, y, { group: 'stations' }).lampColor = color;

  // ---------------------------------------------------------------- Respiration Station
  // The pocket sits inside a mitochondrion; long flared walls funnel angled shots inside.
  b.wall([[254, 458], ...b.arcPoints(286, 404, 32, 180, 360, 10), [318, 458]], { id: 'station_cup', r: 4 });
  b.wall([[254, 458], [214, 508]], { id: 'station_flare_l', r: 3 });
  b.wall([[318, 458], [350, 500]], { id: 'station_flare_r', r: 3 });
  b.saucer('station', STATION[0], STATION[1], { role: 'pocket', ejectDeg: 97, ejectSpeed: 780, label: 'STATION', icon: 'mito' });

  // ---------------------------------------------------------------- Oxygen bumpers (upper west)
  b.bumper('o2_a', 150, 205, { group: 'oxygen', label: 'O₂', r: 24 });
  b.bumper('o2_b', 208, 205, { group: 'oxygen', label: 'O₂', r: 24 });
  b.bumper('o2_c', 179, 254, { group: 'oxygen', label: 'O₂', r: 24 });

  // ---------------------------------------------------------------- Food cars on the west platform
  b.target('food_sugar', [80, 304], [80, 340], { group: 'food', label: 'SUGAR' });
  b.target('food_starch', [80, 352], [80, 388], { group: 'food', label: 'STARCH' });
  b.target('food_fat', [80, 400], [80, 436], { group: 'food', label: 'FAT' });

  // ---------------------------------------------------------------- Sugar bank C6 H12 O6 (upper east)
  b.dropBank('sugar_bank', 340, 228, 12, 3, { size: 28, gap: 6, group: 'sugar', labels: ['C₆', 'H₁₂', 'O₆'] });
  b.wall([[339, 215], [440, 237]], { id: 'sugar_backstop', r: 3 });

  // ---------------------------------------------------------------- Tunnel lane + portal (east)
  b.wall([[446, 560], [446, 392], [460, 372], [480, 368]], { id: 'tunnel_wall', r: 3 });
  b.portal('tunnel', TUNNEL_IN, { x: TUNNEL_OUT[0], y: TUNNEL_OUT[1], deg: 180, speed: 1150 }, { label: 'TUNNEL' });

  // ---------------------------------------------------------------- Inserts (one per shot)
  b.insert('ins_loop_left', 49, 560, { deg: -90, label: 'LOOP', color: GOLD });
  b.insert('ins_loop_right', 523, 604, { deg: -90, label: 'LOOP', color: GOLD });
  b.insert('ins_station', 286, 534, { deg: -90, color: CORAL });
  b.insert('ins_tunnel', 472, 600, { deg: -90, label: 'TUNNEL', color: MINT });
  b.insert('ins_sugar', 392, 292, { deg: -100, label: 'SUGAR', color: GOLD });
  b.insert('ins_oxygen', 180, 312, { shape: 'star', size: 12, color: OXY });
  b.insert('ins_food', 128, 370, { deg: 180, label: 'FOOD', color: CORAL });
}

// ================================================================ printed playfield art

/** Centre line of the painted railway along the Express Loop. */
function trackPoints(): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = 650; y > 300; y -= 14) pts.push([49, y]);
  for (let d = 180; d <= 324.5; d += 3) pts.push(onTrack(d));
  for (let y = 160; y <= 650; y += 14) pts.push([523, y]);
  return pts;
}
const TRACK = trackPoints();
/** Celebration chase colours and a reusable track tracer (no per-frame closures). */
const CHASE = [GOLD, MINT, CORAL];
let trackCtx: CanvasRenderingContext2D | null = null;
const traceTrack = () => {
  if (trackCtx) strokePath(trackCtx, TRACK);
};

function strokePath(ctx: CanvasRenderingContext2D, pts: [number, number][], off = 0) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const x = p[0] + (-(b[1] - a[1]) / l) * off;
    const y = p[1] + ((b[0] - a[0]) / l) * off;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
}

function drawRailway(ctx: CanvasRenderingContext2D, glow: number) {
  ctx.save();
  // Ballast bed
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  strokePath(ctx, TRACK);
  ctx.strokeStyle = 'rgba(8,6,20,0.55)';
  ctx.lineWidth = 34;
  ctx.stroke();
  // Sleepers
  for (let i = 1; i < TRACK.length - 1; i++) {
    const a = TRACK[i - 1];
    const b = TRACK[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    const [x, y] = TRACK[i];
    ctx.strokeStyle = '#4a3326';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - nx * 14, y - ny * 14);
    ctx.lineTo(x + nx * 14, y + ny * 14);
    ctx.stroke();
  }
  // Rails: brass, glowing as the route awakens ("outputs illuminate the route").
  for (const off of [-8, 8]) {
    strokePath(ctx, TRACK, off);
    ctx.strokeStyle = mix('#8a7048', GOLD, glow);
    ctx.lineWidth = 2.6;
    if (glow > 0.02) {
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 14 * glow;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

/**
 * Closed outline of a mitochondrion's inner membrane: an ellipse whose top and bottom edges
 * fold inward as finger-like cristae, interleaved like the textbook cutaway.
 */
function cristaePath(rx: number, ry: number, folds: number, samples = 220): [number, number][] {
  const edge = (x: number) => ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
  const span = (2 * rx) / (folds + 0.5);
  const fw = span * 0.2;
  const topXs = Array.from({ length: folds }, (_, k) => -rx + (k + 0.6) * span);
  const botXs = Array.from({ length: folds }, (_, k) => -rx + (k + 0.9) * span);
  const notch = (x: number, xs: number[]) => {
    let d = 0;
    for (const fx of xs) {
      const u = (x - fx) / fw;
      if (Math.abs(u) < 1) d = Math.max(d, 1.12 * edge(fx) * Math.sqrt(1 - u * u));
    }
    return d;
  };
  const pts: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const x = -rx + (2 * rx * i) / samples;
    pts.push([x, -(edge(x) - notch(x, topXs))]);
  }
  for (let i = samples - 1; i > 0; i--) {
    const x = -rx + (2 * rx * i) / samples;
    pts.push([x, edge(x) - notch(x, botXs)]);
  }
  return pts;
}

/** Mitochondrion cutaway: outer membrane, matrix, and folded inner membrane (cristae). */
function drawMito(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, lit: number, folds = 6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // Outer membrane
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = rgba('#ff9d7e', 0.32 + 0.4 * lit);
  ctx.fill();
  ctx.lineWidth = Math.max(2, rx * 0.07);
  ctx.strokeStyle = rgba(CORAL, 0.6 + 0.4 * lit);
  if (lit > 0.05) {
    ctx.shadowColor = CORAL;
    ctx.shadowBlur = 16 * lit;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Matrix inside the folded inner membrane
  const pts = cristaePath(rx * 0.86, ry * 0.8, folds, rx > 40 ? 220 : 90);
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = rgba('#7a2f45', 0.55 + 0.25 * lit);
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.45 + 0.55 * lit);
  ctx.lineWidth = Math.max(1.2, rx * 0.035);
  ctx.lineJoin = 'round';
  if (lit > 0.05) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 8 * lit;
  }
  ctx.stroke();
  ctx.restore();
}

function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lit: number, level: number) {
  ctx.save();
  // Clockwork gears behind the face
  gear(ctx, x - r * 0.95, y + r * 0.55, r * 0.42, 10, 0.2, rgba(BRASS, 0.32 + 0.3 * lit));
  gear(ctx, x + r * 0.98, y + r * 0.42, r * 0.34, 9, 0.5, rgba(BRASS, 0.3 + 0.3 * lit));
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, rgba(IVORY, 0.22 + 0.4 * lit));
  g.addColorStop(1, rgba('#3a3470', 0.6));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(BRASS, 0.7 + 0.3 * lit);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const l = i % 3 === 0 ? 0.22 : 0.12;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * (0.92 - l), y + Math.sin(a) * r * (0.92 - l));
    ctx.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
    ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
    ctx.strokeStyle = rgba(IVORY, 0.55 + 0.4 * lit);
    ctx.stroke();
  }
  // The hands creep toward midnight as the attraction awakens: 11:00 dormant, 12:00 at level 4.
  const minutes = 660 + Math.min(4, level) * 15;
  const hA = ((minutes / 60) % 12) / 12 * TAU - Math.PI / 2;
  const mA = ((minutes % 60) / 60) * TAU - Math.PI / 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(GOLD, 0.8 + 0.2 * lit);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(hA) * r * 0.5, y + Math.sin(hA) * r * 0.5);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(mA) * r * 0.78, y + Math.sin(mA) * r * 0.78);
  ctx.stroke();
  glowDot(ctx, x, y, 6, GOLD, 0.9);
  ctx.restore();
}

/** Stone tunnel mouth with a glowing portal swirl. */
function drawTunnel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(6,4,14,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, TAU);
  ctx.lineTo(r, r * 0.9);
  ctx.lineTo(-r, r * 0.9);
  ctx.closePath();
  ctx.fill();
  // Arch stones
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI;
    ctx.beginPath();
    ctx.arc(0, 0, r + 9, a0 + 0.03, a1 - 0.03);
    ctx.arc(0, 0, r, a1 - 0.03, a0 + 0.03, true);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#6d6688' : '#5a5478';
    ctx.fill();
  }
  ctx.fillStyle = '#5a5478';
  ctx.fillRect(-r - 9, 0, 9, r * 0.9);
  ctx.fillRect(r, 0, 9, r * 0.9);
  // Portal swirl
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(0, r * 0.25, r * (0.25 + k * 0.2), Math.PI * (1 + k * 0.3), Math.PI * (2.2 + k * 0.3));
    ctx.strokeStyle = rgba(k % 2 ? CORAL : MINT, 0.35 + 0.6 * lit);
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();
}

/** Midnight city silhouette whose windows light up as the Express powers it. */
function drawCity(ctx: CanvasRenderingContext2D, lit: number) {
  const r = rng(51);
  const wr = rng(52);
  ctx.save();
  let x = 92;
  while (x < 482) {
    const w = 22 + Math.floor(r() * 26);
    const h = 34 + Math.floor(r() * 70);
    const spire = r() < 0.35;
    const base = 792;
    ctx.fillStyle = '#1b1742';
    ctx.fillRect(x, base - h, w, h);
    if (spire) {
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x + w / 2, base - h - 14);
      ctx.lineTo(x + w, base - h);
      ctx.fill();
    }
    // Moonlit rim along the roofline
    ctx.fillStyle = 'rgba(160,170,255,0.22)';
    ctx.fillRect(x, base - h, w, 2);
    for (let wy = base - h + 8; wy < base - 8; wy += 11) {
      for (let wx = x + 4; wx < x + w - 5; wx += 8) {
        // Fixed draws per window so the skyline never changes shape as it lights up.
        const order = wr();
        const tint = wr();
        const a = wr();
        const on = order < lit * 0.95;
        ctx.fillStyle = on ? rgba(tint < 0.8 ? GOLD : MINT, 0.55 + 0.35 * a) : 'rgba(90,90,150,0.2)';
        ctx.fillRect(wx, wy, 4, 5);
      }
    }
    x += w + 3 + Math.floor(r() * 6);
  }
  ctx.restore();
}

function leafIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s, s * 0.2, -s * 0.5, -s * 0.8, 0, -s);
  ctx.bezierCurveTo(s * 0.5, -s * 0.8, s, s * 0.2, 0, s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,30,10,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.lineTo(0, -s * 0.6);
  ctx.stroke();
  ctx.restore();
}

function rootIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s * 0.2);
  ctx.moveTo(x, y - s * 0.3);
  ctx.quadraticCurveTo(x - s * 0.6, y, x - s * 0.8, y + s);
  ctx.moveTo(x, y - s * 0.1);
  ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.2, x + s * 0.7, y + s);
  ctx.moveTo(x, y + s * 0.2);
  ctx.lineTo(x - s * 0.1, y + s);
  ctx.stroke();
  ctx.restore();
}

function pawIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.3, s * 0.5, s * 0.42, 0, 0, TAU);
  ctx.fill();
  for (const [dx, dy] of [[-0.55, -0.25], [-0.2, -0.6], [0.2, -0.6], [0.55, -0.25]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, s * 0.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function finIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.7);
  ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.2, x + s * 0.5, y - s);
  ctx.quadraticCurveTo(x + s * 0.3, y, x + s, y + s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Round platform medallion beside a station rollover. */
function medallion(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, lit: number, icon: (c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) => void) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, TAU);
  ctx.fillStyle = rgba('#0c0a22', 0.85);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(color, 0.45 + 0.55 * lit);
  if (lit > 0.05) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * lit;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  icon(ctx, x, y, 7, rgba(color, 0.6 + 0.4 * lit));
  ctx.restore();
}

function hexRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function sceneryBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.2, 4);
  // Night-blue cytoplasm with a soft cell glow that warms as energy flows.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1d2766'], [0.42, NIGHT], [1, '#0d0a24']]);
  ctx.fillRect(0, 0, 600, 1150);
  const cg = ctx.createRadialGradient(286, 420, 30, 286, 420, 430);
  cg.addColorStop(0, rgba(mix(MINT, GOLD, s2), 0.1 + 0.14 * s1 + 0.1 * s4));
  cg.addColorStop(1, rgba(PLUM, 0));
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, 600, 1150);
  // Cytoplasm speckle and drifting organelles (soft, low contrast so the ball stays brightest).
  const r = rng(505);
  for (let i = 0; i < 26; i++) {
    const x = 90 + r() * 400;
    const y = 150 + r() * 520;
    const rx = 8 + r() * 18;
    ctx.fillStyle = rgba(r() < 0.5 ? '#6f6ad8' : '#3fa8a0', 0.08 + 0.05 * r());
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * (0.4 + r() * 0.4), r() * Math.PI, 0, TAU);
    ctx.fill();
  }
  stars(ctx, 55, 70, [80, 60, 520, 330], IVORY);
  // Little mitochondria scattered through the cell (plant and animal cells usually have many).
  for (const [x, y, rot] of [[132, 520, 0.6], [432, 520, -0.5], [370, 150, 0.2], [176, 590, -0.3], [400, 650, 0.4]] as [number, number, number][]) {
    drawMito(ctx, x, y, 20, 11, rot, s2 * 0.8, 4);
  }
  // Cell membrane glow just inside the inner track wall.
  ctx.save();
  ctx.beginPath();
  ctx.arc(ARC_C[0], ARC_C[1], INNER_R - 10, Math.PI, deg2rad(RIGHT_END_DEG));
  ctx.lineTo(onTrack(RIGHT_END_DEG, INNER_R - 10)[0], 640);
  ctx.moveTo(ARC_C[0] - INNER_R + 10, ARC_C[1]);
  ctx.lineTo(ARC_C[0] - INNER_R + 10, 440);
  ctx.strokeStyle = rgba(MINT, 0.18 + 0.3 * s1);
  ctx.lineWidth = 6;
  ctx.shadowColor = MINT;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();
  // The railway itself (rails glow once respiration's outputs light the route).
  drawRailway(ctx, Math.max(0.15 * s1, s2 * 0.75 + 0.25 * s4));
  // Station medallions (plant = green, animal = coral).
  medallion(ctx, ST_LEAF[0], ST_LEAF[1] + 34, LEAF, s3, leafIcon);
  const rootM = onTrack(208);
  medallion(ctx, rootM[0], rootM[1], LEAF, s3, rootIcon);
  const pawM = onTrack(343);
  medallion(ctx, pawM[0], pawM[1], CORAL, s3, pawIcon);
  medallion(ctx, ST_FIN[0], ST_FIN[1] - 48, CORAL, s3, finIcon);
  // Station nameboards, upright so they read at a glance from the flippers.
  for (const [name, [x, y], color] of STATION_BOARDS) plaque(ctx, name, x, y, rgba(color, 0.62 + 0.36 * s3), '#140c1e', 8.5);
  // Plant / animal captions run along the channels beside their stations.
  const capFont = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
  for (const [text, x, y, color, rot] of [['PLANT CELLS', 49, 498, LEAF, -Math.PI / 2], ['ANIMAL CELLS', 523, 505, CORAL, Math.PI / 2]] as [string, number, number, string, number][]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    neonText(ctx, text, 0, 0, 11, color, 0.2 + 0.8 * s3, capFont);
    ctx.restore();
  }
  // Title under the top of the line.
  neonText(ctx, 'MIDNIGHT EXPRESS', 296, 104, 15, GOLD, 0.2 + 0.8 * s1);
  // Clockwork station clock: the hands reach midnight with the Wonderlight.
  drawClock(ctx, 286, 214, 42, s1, level);
  // Tunnel mouths: the entry on the east lane and the matching exit at the top of the line.
  drawTunnel(ctx, TUNNEL_IN[0], TUNNEL_IN[1] - 4, 19, 0, 0.3 + 0.7 * s3);
  drawTunnel(ctx, TUNNEL_OUT[0] + 18, TUNNEL_OUT[1] + 2, 15, -Math.PI / 2, 0.3 + 0.7 * s3);
  plaque(ctx, 'TUNNEL', TUNNEL_IN[0], 452, rgba(MINT, 0.85), '#0d1830', 9);
  // Sugar molecule motif under the bank.
  hexRing(ctx, 446, 290, 13, rgba(GOLD, 0.35 + 0.55 * s2));
  plaque(ctx, 'C₆H₁₂O₆', 392, 264, rgba(GOLD, 0.9), '#2a1a08', 10);
  // Oxygen bubbles around the bumper cluster.
  for (const [x, y, rr] of [[112, 250, 9], [232, 268, 7], [118, 160, 6], [248, 170, 8]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.strokeStyle = rgba(OXY, 0.35 + 0.5 * s2);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  plaque(ctx, 'OXYGEN  O₂', 180, 290, rgba(OXY, 0.85), '#0d1830', 9);
  // Freight platform beside the food cars.
  ctx.fillStyle = 'rgba(60,40,30,0.55)';
  ctx.fillRect(86, 298, 22, 144);
  ctx.fillStyle = rgba(GOLD, 0.5);
  ctx.fillRect(106, 298, 3, 144);
  plaque(ctx, 'FOOD CARS', 130, 456, rgba(CORAL, 0.9), '#2a0d14', 9);
  // The Respiration Station: a big mitochondrion cradling the Wonder Pocket.
  drawMito(ctx, STATION[0], STATION[1] - 4, 100, 62, 0, 0.25 + 0.75 * s2, 6);
  neonText(ctx, 'RESPIRATION STATION', 286, 326, 13, CORAL, 0.35 + 0.65 * s2, '"Atkinson Hyperlegible Next", system-ui, sans-serif');
  // The equation route board: reactants light after mission 1, products after mission 2.
  ctx.save();
  rrect(ctx, 92, 566, 388, 40, 12);
  ctx.fillStyle = 'rgba(8,6,24,0.7)';
  ctx.fill();
  ctx.strokeStyle = rgba(BRASS, 0.6);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  const eqFont = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
  neonText(ctx, 'C₆H₁₂O₆ + 6O₂', 172, 586, 15, GOLD, 0.25 + 0.75 * s1, eqFont);
  neonText(ctx, '→', 252, 586, 16, IVORY, 0.25 + 0.75 * s2, eqFont);
  neonText(ctx, '6CO₂ + 6H₂O + energy', 368, 586, 15, MINT, 0.2 + 0.8 * s2, eqFont);
  // Midnight city on the horizon; windows wake up with every mission.
  drawCity(ctx, 0.08 + 0.92 * Math.min(1, level / 4));
  // Platform floor near the flippers, with a gold safety line.
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? '#3a2a40' : '#2a2038';
    ctx.fillRect(0, 800 + i * 26, 600, 13);
  }
  ctx.restore();
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = rgba(GOLD, 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(196, 1076);
  ctx.lineTo(376, 1076);
  ctx.stroke();
  ctx.restore();
  // Signal-gate lamps at the loop exits.
  glowDot(ctx, 40, 640, 9, s1 > 0.5 ? LEAF : CORAL, 0.6);
  glowDot(ctx, 534, 676, 9, s1 > 0.5 ? LEAF : CORAL, 0.6);
  // Wonderlight wash
  if (s4 > 0) {
    ctx.fillStyle = rgba(GOLD, 0.07 * s4);
    ctx.fillRect(0, 0, 600, 1150);
  }
}

// ================================================================ 3D attraction set

/** A small toy locomotive or carriage, built along +Z (forward). */
function makeCar(kit: SetKit, color: string, loco: boolean) {
  const T = kit.THREE;
  const g = new T.Group();
  const body = new T.Mesh(new T.BoxGeometry(0.24, 0.16, loco ? 0.42 : 0.36), kit.mats.plastic(color));
  body.position.y = 0.14;
  body.castShadow = true;
  g.add(body);
  const winMat = kit.track(new T.MeshStandardMaterial({ color: '#120c18', emissive: loco ? GOLD : color, emissiveIntensity: 0.1 }));
  if (loco) {
    const boiler = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.3, 16), kit.mats.brass());
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 0.25, 0.08);
    const stack = new T.Mesh(new T.CylinderGeometry(0.04, 0.03, 0.14, 10), kit.mats.paintedMetal('#2a2238'));
    stack.position.set(0, 0.38, 0.17);
    const cab = new T.Mesh(new T.BoxGeometry(0.24, 0.16, 0.14), winMat);
    cab.position.set(0, 0.3, -0.13);
    const lamp = new T.Mesh(new T.SphereGeometry(0.045, 12, 8), winMat);
    lamp.position.set(0, 0.25, 0.25);
    g.add(boiler, stack, cab, lamp);
  } else {
    const win = new T.Mesh(new T.BoxGeometry(0.25, 0.06, 0.3), winMat);
    win.position.y = 0.17;
    g.add(win);
  }
  return { g, winMat };
}

/** Storybook oak: a stout trunk, broad flattened canopy clumps and a few acorns. */
function makeOak(kit: SetKit, h: number, seed = 12) {
  const T = kit.THREE;
  const g = new T.Group();
  const r = kit.rand(seed);
  const bark = kit.mats.plastic('#5b3a24');
  const trunk = new T.Mesh(new T.CylinderGeometry(h * 0.07, h * 0.11, h * 0.55, 10), bark);
  trunk.position.y = h * 0.27;
  g.add(trunk);
  for (const a of [0.8, -0.9]) {
    const limb = new T.Mesh(new T.CylinderGeometry(h * 0.03, h * 0.05, h * 0.35, 8), bark);
    limb.position.set(Math.sin(a) * h * 0.1, h * 0.55, 0);
    limb.rotation.z = -a * 0.7;
    g.add(limb);
  }
  // Matte foliage: clearcoat plastic under the lanterns read as glossy blobs, not leaves.
  const leafA = kit.track(new T.MeshStandardMaterial({ color: '#3f8f4e', roughness: 0.82 }));
  const leafB = kit.track(new T.MeshStandardMaterial({ color: '#5aa85a', roughness: 0.82 }));
  const clump = new T.IcosahedronGeometry(1, 1);
  for (let i = 0; i < kit.n(7); i++) {
    const a = (i / 7) * TAU + r() * 0.5;
    const d = i === 0 ? 0 : h * (0.22 + r() * 0.12);
    const m = new T.Mesh(clump, i % 2 ? leafB : leafA);
    const s = h * (i === 0 ? 0.36 : 0.22 + r() * 0.08);
    m.scale.set(s * 1.2, s * 0.72, s * 1.2);
    m.position.set(Math.cos(a) * d, h * (0.82 + r() * 0.12) - (i === 0 ? 0 : h * 0.06), Math.sin(a) * d * 0.8);
    m.castShadow = true;
    g.add(m);
  }
  const nutMat = kit.mats.plastic('#c98b45');
  for (let i = 0; i < 3; i++) {
    const nut = new T.Mesh(new T.SphereGeometry(h * 0.035, 10, 8), nutMat);
    nut.scale.y = 1.3;
    nut.position.set((i - 1) * h * 0.22, h * 0.6, h * 0.24);
    g.add(nut);
  }
  return g;
}

/** Low-poly squirrel holding an acorn (consumer cells respire too). */
function makeSquirrel(kit: SetKit) {
  const T = kit.THREE;
  const g = new T.Group();
  const fur = kit.mats.plastic(RUST);
  const cream = kit.mats.plastic('#f2dcc0');
  const body = new T.Mesh(new T.SphereGeometry(0.26, 20, 14), fur);
  body.scale.set(1, 1.3, 0.9);
  body.position.y = 0.34;
  const belly = new T.Mesh(new T.SphereGeometry(0.19, 16, 12), cream);
  belly.scale.set(1, 1.3, 0.6);
  belly.position.set(0, 0.32, 0.12);
  const head = new T.Mesh(new T.SphereGeometry(0.17, 18, 12), fur);
  head.position.set(0, 0.74, 0.06);
  const earGeo = new T.ConeGeometry(0.05, 0.12, 8);
  const earL = new T.Mesh(earGeo, fur);
  earL.position.set(-0.09, 0.9, 0.02);
  const earR = new T.Mesh(earGeo, fur);
  earR.position.set(0.09, 0.9, 0.02);
  const eyeMat = kit.mats.dark();
  const eyeL = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), eyeMat);
  eyeL.position.set(-0.06, 0.77, 0.21);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.06;
  const tailCurve = new T.CatmullRomCurve3([
    new T.Vector3(0, 0.16, -0.2), new T.Vector3(0, 0.42, -0.44), new T.Vector3(0, 0.82, -0.42), new T.Vector3(0, 1.02, -0.2), new T.Vector3(0, 0.98, -0.02),
  ]);
  const tail = new T.Mesh(new T.TubeGeometry(tailCurve, 32, 0.16, 12, false), fur);
  tail.scale.x = 1.15;
  const nut = new T.Mesh(new T.SphereGeometry(0.07, 12, 10), kit.mats.plastic('#c98b45'));
  nut.scale.y = 1.25;
  nut.position.set(0, 0.52, 0.26);
  const cap = new T.Mesh(new T.SphereGeometry(0.075, 12, 6, 0, TAU, 0, Math.PI / 2), kit.mats.plastic('#6b4a2a'));
  cap.position.set(0, 0.57, 0.26);
  g.add(body, belly, head, earL, earR, eyeL, eyeR, tail, nut, cap);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/**
 * Giant cutaway mitochondrion, built like the textbook diagram: an outer membrane ring, the
 * matrix, and a glowing folded inner membrane (cristae). Faces +Z; the caller tilts it.
 */
function makeMitochondrion(kit: SetKit, w: number, h: number) {
  const T = kit.THREE;
  const g = new T.Group();
  const rx = w / 2;
  const ry = h / 2;
  const ell = (sx: number, sy: number) => {
    const p = new T.Shape();
    p.absellipse(0, 0, sx, sy, 0, TAU, false, 0);
    return p;
  };
  const ringShape = ell(rx, ry);
  const hole = new T.Path();
  hole.absellipse(0, 0, rx - w * 0.045, ry - w * 0.045, 0, TAU, true, 0);
  ringShape.holes.push(hole);
  const ringMat = kit.track(new T.MeshPhysicalMaterial({ color: '#ff8c7a', emissive: CORAL, emissiveIntensity: 0.06, roughness: 0.3, clearcoat: 1 }));
  const ring = new T.Mesh(new T.ExtrudeGeometry(ringShape, { depth: w * 0.06, bevelEnabled: true, bevelSize: w * 0.012, bevelThickness: w * 0.012, bevelSegments: 2, curveSegments: 64 }), ringMat);
  ring.castShadow = true;
  // The space between the membranes, then the matrix inside the folded inner membrane.
  const gapMat = kit.track(new T.MeshStandardMaterial({ color: '#3a1630', emissive: '#ff9a8a', emissiveIntensity: 0.04, roughness: 0.6 }));
  const gap = new T.Mesh(new T.ShapeGeometry(ell(rx - w * 0.03, ry - w * 0.03), 48), gapMat);
  gap.position.z = w * 0.02;
  const fold = cristaePath(rx * 0.86, ry * 0.78, 6, 160);
  const foldShape = new T.Shape(fold.map(([x, y]) => new T.Vector2(x, -y)));
  const matrixMat = kit.track(new T.MeshStandardMaterial({ color: '#6e2a44', emissive: '#ffb08a', emissiveIntensity: 0.05, roughness: 0.5 }));
  const matrix = new T.Mesh(new T.ShapeGeometry(foldShape), matrixMat);
  matrix.position.z = w * 0.03;
  const cristaeMat = kit.track(new T.MeshStandardMaterial({ color: '#1a0c08', emissive: GOLD, emissiveIntensity: 0.08 }));
  const curve = new T.CatmullRomCurve3(fold.map(([x, y]) => new T.Vector3(x, -y, w * 0.035)), true, 'centripetal');
  const cristae = new T.Mesh(new T.TubeGeometry(curve, 480, w * 0.012, 6, true), cristaeMat);
  g.add(gap, matrix, cristae, ring);
  return {
    g,
    setLit(v: number, pulse: number) {
      ringMat.emissiveIntensity = 0.08 + v * 0.18 + pulse * 0.06;
      gapMat.emissiveIntensity = 0.03 + v * 0.04;
      matrixMat.emissiveIntensity = 0.04 + v * 0.05 + pulse * 0.03;
      cristaeMat.emissiveIntensity = 0.15 + v * 0.85 + pulse * 0.35;
    },
  };
}

/** Facade texture with a grid of windows (alpha-free, used as emissive map). */
function windowTexture(kit: SetKit, seed: number) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 128, 256);
  const r = rng(seed);
  for (let y = 10; y < 246; y += 18) {
    for (let x = 10; x < 118; x += 20) {
      if (r() < 0.62) {
        ctx.fillStyle = r() < 0.8 ? '#ffd98a' : '#9ff0e2';
        ctx.fillRect(x, y, 10, 11);
      }
    }
  }
  const tex = kit.track(new kit.THREE.CanvasTexture(c));
  tex.colorSpace = kit.THREE.SRGBColorSpace;
  return tex;
}

function clockTexture(kit: SetKit) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.arc(128, 128, 122, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#b8862e';
  ctx.stroke();
  ctx.fillStyle = '#2a1d10';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.save();
    ctx.translate(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillRect(-3, -10, 6, i % 3 === 0 ? 22 : 12);
    ctx.restore();
  }
  const tex = kit.track(new kit.THREE.CanvasTexture(c));
  tex.colorSpace = kit.THREE.SRGBColorSpace;
  return tex;
}

/** Railway signal: a post with red and green lamps (red while dormant, green once running). */
function makeSignal(kit: SetKit, pos: [number, number, number], rotY: number) {
  const T = kit.THREE;
  const g = new T.Group();
  const post = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 2.0, 10), kit.mats.paintedMetal('#3b3360'));
  post.position.y = 1.0;
  const head = new T.Mesh(new T.BoxGeometry(0.26, 0.5, 0.16), kit.mats.paintedMetal('#1c1830'));
  head.position.y = 2.05;
  const red = kit.track(new T.MeshStandardMaterial({ color: '#200808', emissive: '#ff4a4a', emissiveIntensity: 0.1 }));
  const green = kit.track(new T.MeshStandardMaterial({ color: '#082010', emissive: '#6dff9a', emissiveIntensity: 0.1 }));
  const lampGeo = new T.SphereGeometry(0.07, 14, 10);
  const r = new T.Mesh(lampGeo, red);
  r.position.set(0, 2.17, 0.08);
  const gr = new T.Mesh(lampGeo, green);
  gr.position.set(0, 1.93, 0.08);
  g.add(post, head, r, gr);
  g.position.set(pos[0], pos[1] + REGION_Y, pos[2]);
  g.rotation.y = rotY;
  kit.add(g);
  return (go: number) => {
    red.emissiveIntensity = 0.1 + 3 * (1 - go);
    green.emissiveIntensity = 0.1 + 3 * go;
  };
}

const REGION_Y = -0.42;

type V3 = [number, number, number];

/**
 * Midnight-city townhouses [x, z, width, depth, height, rotY], placed where the player's camera
 * sees them: the top corners beside the Respiration Station and the railway, and the far
 * right edge. (Index % 4 picks the window group that wakes with each mission.)
 */
const CITY: [number, number, number, number, number, number][] = [
  [-8.15, -5.85, 0.9, 0.8, 2.0, 0.2],
  [5.8, -6.2, 0.85, 0.7, 1.55, -0.1],
  [8.3, -3.2, 0.7, 0.8, 1.85, -0.25],
  [-7.05, -6.15, 0.85, 0.7, 1.35, 0.1],
  [8.1, -5.85, 0.9, 0.8, 2.05, -0.2],
  [-8.3, -4.5, 0.7, 0.9, 1.55, 0.25],
  [4.75, -6.05, 0.8, 0.7, 1.2, -0.05],
  [8.35, -1.95, 0.65, 0.8, 1.25, -0.25],
  [-4.75, -6.05, 0.8, 0.7, 1.1, 0.05],
  [6.95, -6.0, 0.9, 0.8, 1.3, -0.15],
  [8.25, -4.5, 0.75, 0.9, 1.6, -0.25],
  [-8.35, -3.35, 0.65, 0.8, 1.15, 0.25],
];

/** Firework burst centres, all in the side regions (|x| ≥ 5.7, bursts reach ±1.2). */
const BURST_SITES: V3[] = [[-5.7, 3.1, 0.3], [6.4, 2.8, 1.9], [-6.7, 2.5, -1.5], [5.7, 3.1, 0.3], [-6.3, 2.9, 2.1], [6.8, 2.5, -1.4]];

/**
 * A magnified cell on a brass stand, framed by a lens rim that faces the player. The plant
 * cell is boxy (its cell wall) with chloroplasts, left unlit because they can't photosynthesize
 * in the dark; the animal cell is round. Both hold mitochondria sharing one glowing material,
 * because both kinds respire.
 */
function makeCell(kit: SetKit, plant: boolean, pos: V3, mitoMat: THREE_NS.Material) {
  const T = kit.THREE;
  const tint = plant ? LEAF : '#ff9fb0';
  const g = new T.Group();
  const shellMat = kit.track(new T.MeshPhysicalMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.04, roughness: 0.2, transparent: true, opacity: 0.24, depthWrite: false }));
  const shellGeo = plant ? new T.BoxGeometry(0.72, 0.52, 0.5) : new T.SphereGeometry(0.36, 28, 18);
  const shell = new T.Mesh(shellGeo, shellMat);
  shell.renderOrder = 2;
  if (!plant) shell.scale.set(1.12, 0.9, 1);
  g.add(shell);
  const edgeMat = kit.track(new T.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.4 }));
  if (plant) g.add(new T.LineSegments(new T.EdgesGeometry(shellGeo), edgeMat));
  const nucleus = new T.Mesh(new T.SphereGeometry(0.085, 18, 12), kit.mats.plastic('#7a5ad0'));
  nucleus.position.set(plant ? 0.18 : 0.12, 0.04, -0.05);
  g.add(nucleus);
  const m4 = new T.Matrix4();
  const q = new T.Quaternion();
  const e = new T.Euler();
  const p = new T.Vector3();
  const one = new T.Vector3(1, 1, 1);
  const count = Math.min(3, kit.n(3));
  const spots: [number, number, number, number][] = plant
    ? [[-0.2, -0.1, 0.1, 0.4], [-0.04, 0.13, -0.08, 2.2], [0.08, -0.13, 0.12, 1.1]]
    : [[-0.16, 0.08, 0.1, 0.6], [0.04, -0.15, 0.06, 2.4], [-0.12, -0.08, -0.13, 1.4]];
  const mitos = new T.InstancedMesh(new T.CapsuleGeometry(0.038, 0.1, 4, 10), mitoMat, count);
  for (let i = 0; i < count; i++) {
    const [x, y, z, a] = spots[i];
    mitos.setMatrixAt(i, m4.compose(p.set(x, y, z), q.setFromEuler(e.set(a * 0.5, a, Math.PI / 2 + a)), one));
  }
  g.add(mitos);
  if (plant) {
    const chloro = new T.InstancedMesh(new T.SphereGeometry(0.055, 14, 10), kit.track(new T.MeshStandardMaterial({ color: '#3f9a4a', roughness: 0.6 })), count);
    const cs: V3[] = [[-0.2, 0.13, 0.04], [0.22, -0.12, 0.1], [0.02, 0.0, -0.16]];
    const flat = new T.Vector3(1.5, 0.75, 0.95);
    for (let i = 0; i < count; i++) chloro.setMatrixAt(i, m4.compose(p.set(cs[i][0], cs[i][1], cs[i][2]), q.setFromEuler(e.set(0, i * 1.1, 0.3 * i)), flat));
    g.add(chloro);
  }
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.set(-0.3, plant ? 0.45 : -0.45, 0);
  kit.add(g);
  const rodLen = pos[1] - (plant ? 0.26 : 0.32) - REGION_Y;
  const rod = kit.add(new T.Mesh(new T.CylinderGeometry(0.022, 0.032, rodLen, 8), kit.mats.brass()));
  rod.position.set(pos[0], REGION_Y + rodLen / 2, pos[2]);
  const rim = kit.add(new T.Mesh(new T.TorusGeometry(0.5, 0.022, 8, 56), kit.mats.brass()));
  rim.position.set(pos[0], pos[1], pos[2]);
  rim.lookAt(0, 16, 13.3);
  const baseRY = g.rotation.y;
  return {
    setLit(v: number) {
      shellMat.emissiveIntensity = 0.04 + 0.3 * v;
      edgeMat.opacity = 0.3 + 0.6 * v;
    },
    /** Slow turn so the organelles read in depth (motion only; callers skip it when reduced). */
    spin(t: number) {
      g.rotation.y = baseRY + Math.sin(t * 0.35) * 0.25;
    },
  };
}

/**
 * Firework bursts that cycle through `sites`. One Points cloud, preallocated buffers and
 * colours; it updates only through kit.animate, so reduced motion hides it entirely.
 */
function makeBursts(kit: SetKit, sites: V3[], colors: string[]) {
  const T = kit.THREE;
  const groups = 4;
  const per = Math.max(12, Math.floor(kit.n(260) / groups));
  const n = per * groups;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const dir = new Float32Array(n * 3);
  const r = kit.rand(55);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1;
    const th = r() * TAU;
    const s = Math.sqrt(1 - u * u);
    const k = 0.7 + 0.3 * r();
    dir[i * 3] = s * Math.cos(th) * k;
    dir[i * 3 + 1] = u * k;
    dir[i * 3 + 2] = s * Math.sin(th) * k;
    pos[i * 3] = sites[0][0];
    pos[i * 3 + 1] = sites[0][1];
    pos[i * 3 + 2] = sites[0][2];
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  geo.boundingSphere = new T.Sphere(new T.Vector3(0, 2.8, 0.4), 9);
  const mat = kit.track(new T.PointsMaterial({ size: 0.42, vertexColors: true, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  const pts = new T.Points(geo, mat);
  pts.visible = false;
  kit.add(pts);
  const palette = colors.map((c) => new T.Color(c));
  const state = { lit: 0 };
  kit.animate((t) => {
    if (state.lit <= 0.01) return;
    for (let b = 0; b < groups; b++) {
      const ph = t * 0.38 + b / groups;
      const cyc = ph % 1;
      const k = Math.floor(ph);
      const site = sites[(k * groups + b) % sites.length];
      const c = palette[(k + b * 2) % palette.length];
      const rad = (1 - (1 - cyc) ** 3) * 1.2;
      const fade = (1 - cyc) ** 1.6 * state.lit * 1.5;
      for (let i = b * per; i < (b + 1) * per; i++) {
        const j = i * 3;
        pos[j] = site[0] + dir[j] * rad;
        pos[j + 1] = site[1] + dir[j + 1] * rad - cyc * cyc * 0.55;
        pos[j + 2] = site[2] + dir[j + 2] * rad * 0.7;
        col[j] = c.r * fade;
        col[j + 1] = c.g * fade;
        col[j + 2] = c.b * fade;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });
  return {
    get lit() {
      return state.lit;
    },
    setLit(v: number) {
      state.lit = v;
      pts.visible = v > 0.01 && !kit.reducedMotion;
    },
  };
}

/** Soft starburst (additive) for the Wonderlight behind the giant mitochondrion. */
function raysTexture(kit: SetKit) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(256, 256, 16, 256, 256, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.globalCompositeOperation = 'lighter';
  const rg = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  rg.addColorStop(0, 'rgba(255,255,255,0.45)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const w = i % 2 ? 0.04 : 0.08;
    ctx.beginPath();
    ctx.moveTo(256, 256);
    ctx.arc(256, 256, 256, a - w, a + w);
    ctx.closePath();
    ctx.fill();
  }
  const tex = kit.track(new kit.THREE.CanvasTexture(c));
  tex.colorSpace = kit.THREE.SRGBColorSpace;
  return tex;
}

const expressSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  kit.sky('#1a2366', '#04030c');
  kit.boardwalk('#29233f', 30);

  // ---------------------------------------------------------------- the moon and the stars
  const moon = kit.add(new T.Mesh(new T.CircleGeometry(1.3, 48), kit.track(new T.MeshBasicMaterial({ color: '#fff4d6' }))));
  moon.position.set(-8.5, 8.2, -20);
  const halo = kit.add(new T.Mesh(new T.CircleGeometry(2.6, 48), kit.track(new T.MeshBasicMaterial({ color: '#b8c8ff', transparent: true, opacity: 0.12, depthWrite: false }))));
  halo.position.set(-8.5, 8.2, -20.1);
  {
    const n = kit.n(220);
    const pos = new Float32Array(n * 3);
    const r = kit.rand(9);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI - Math.PI;
      const e = 0.12 + r() * 0.9;
      pos[i * 3] = Math.cos(a) * 60 * Math.cos(e);
      pos[i * 3 + 1] = Math.sin(e) * 45 + 2;
      pos[i * 3 + 2] = Math.sin(a) * 60 * Math.cos(e) * 0.7 - 10;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    kit.add(new T.Points(geo, kit.track(new T.PointsMaterial({ color: '#dfe6ff', size: 0.18, transparent: true, opacity: 0.85, depthWrite: false }))));
  }

  // ---------------------------------------------------------------- the midnight city
  // Townhouses fill the top corners and the far right edge, the parts of the side regions the
  // player's camera actually sees. Four window groups wake mission by mission (the finale's
  // "Power the Midnight City"); one instanced mesh per group keeps the city to four draws.
  const cityGroups: InstanceType<typeof T.MeshStandardMaterial>[] = [];
  {
    const geo = new T.BoxGeometry(1, 1, 1);
    const roofMat = kit.mats.paintedMetal('#231d48');
    const count = Math.min(CITY.length, kit.n(CITY.length));
    const m4 = new T.Matrix4();
    const q = new T.Quaternion();
    const p = new T.Vector3();
    const sc = new T.Vector3();
    const up = new T.Vector3(0, 1, 0);
    for (let gi = 0; gi < 4; gi++) {
      const winMat = kit.track(new T.MeshStandardMaterial({ color: '#1a1640', emissive: '#ffffff', emissiveMap: windowTexture(kit, 31 + gi), emissiveIntensity: 0.02, roughness: 0.8 }));
      cityGroups.push(winMat);
      const mine = CITY.slice(0, count).filter((_, i) => i % 4 === gi);
      if (!mine.length) continue;
      // Box faces: +x, -x, +y (roof), -y, +z, -z.
      const inst = new T.InstancedMesh(geo, [winMat, winMat, roofMat, roofMat, winMat, winMat], mine.length);
      mine.forEach(([x, z, w, d, h, rotY], j) => {
        q.setFromAxisAngle(up, rotY);
        m4.compose(p.set(x, REGION_Y + h / 2, z), q, sc.set(w, h, d));
        inst.setMatrixAt(j, m4);
      });
      inst.computeBoundingSphere();
      inst.castShadow = true;
      kit.add(inst);
    }
  }
  const marquee = kit.neonSign('MIDNIGHT EXPRESS', [0, 1.55, -7.3], { height: 0.62, color: GOLD });
  marquee.rotation.x = -0.7;

  // ---------------------------------------------------------------- top-left: the Respiration Station
  const MX = -6.0;
  const MZ = -3.6;
  const mito = makeMitochondrion(kit, 3.1, 1.75);
  mito.g.position.set(MX, 1.55, MZ);
  mito.g.rotation.set(-0.5, 0.45, 0.03);
  kit.add(mito.g);
  const plinth = kit.add(new T.Mesh(new T.BoxGeometry(2.7, 0.5, 0.7), kit.mats.paintedMetal('#2b2552')));
  plinth.position.set(MX + 0.05, -0.17, MZ + 0.2);
  plinth.rotation.y = 0.45;
  for (const dx of [-0.85, 0.85]) {
    const leg = kit.add(new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 1.2, 10), kit.mats.brass()));
    leg.position.set(MX + dx * Math.cos(0.45), 0.55, MZ - dx * Math.sin(0.45) + 0.1);
  }
  const gears = [
    kit.gear([MX - 1.75, 0.95, MZ + 0.9], 0.5, 12, BRASS, 0.12),
    kit.gear([MX - 1.4, 1.62, MZ + 1.25], 0.3, 9, '#c9a25a', 0.1),
    kit.gear([MX + 1.55, 0.5, MZ - 0.5], 0.4, 10, BRASS, 0.12),
  ];
  gears.forEach((gm) => (gm.rotation.y = 0.45));
  const haloMat = kit.track(new T.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  const mitoHalo = new T.Mesh(new T.TorusGeometry(1, 0.035, 8, 96), haloMat);
  mitoHalo.scale.set(1.85, 1.08, 1);
  mito.g.add(mitoHalo);
  const stationSign = kit.neonSign('RESPIRATION STATION', [MX + 0.25, 0.34, MZ + 0.66], { height: 0.34, color: CORAL, rotY: 0.45 });
  stationSign.rotation.x = -0.45;
  const setSignal = [makeSignal(kit, [-4.25, 0, -2.2], 0.3), makeSignal(kit, [4.25, 0, -2.2], -0.3)];

  // ---------------------------------------------------------------- west front: plant cells
  const oak = makeOak(kit, 2.0);
  oak.position.set(-5.7, REGION_Y, 1.3);
  kit.add(oak);
  const plantSign = kit.neonSign('PLANT CELLS RESPIRE', [-5.75, 0.55, 3.85], { height: 0.36, color: LEAF, rotY: 0.3 });
  plantSign.rotation.x = -0.6;
  // Magnified cells on brass stands: the mitochondria glow inside a boxy plant cell (its
  // chloroplasts stay dark at midnight) and inside a round animal cell. Both kinds respire.
  const miniMat = kit.track(new T.MeshStandardMaterial({ color: '#2a0f18', emissive: CORAL, emissiveIntensity: 0.08 }));
  const plantCell = makeCell(kit, true, [-5.95, 1.22, 3.05], miniMat);
  const animalCell = makeCell(kit, false, [4.85, 1.32, 1.2], miniMat);

  // ---------------------------------------------------------------- east front: animal cells
  const stump = kit.add(new T.Mesh(new T.CylinderGeometry(0.5, 0.6, 0.6, 16), kit.mats.plastic('#5b3a24')));
  stump.position.set(5.6, -0.12, 2.5);
  const squirrel = makeSquirrel(kit);
  squirrel.scale.setScalar(1.55);
  squirrel.position.set(5.6, 0.18, 2.5);
  squirrel.rotation.y = -0.5;
  kit.add(squirrel);
  const animalSign = kit.neonSign('ANIMAL CELLS RESPIRE', [5.75, 0.55, 3.85], { height: 0.36, color: CORAL, rotY: -0.3 });
  animalSign.rotation.x = -0.6;

  // ---------------------------------------------------------------- east: the toy railway loop
  const loopC = new T.Vector3(6.05, 0.55, -2.6);
  const RX = 1.25;
  const RZ = 2.05;
  const curvePts: InstanceType<typeof T.Vector3>[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    curvePts.push(new T.Vector3(loopC.x + Math.cos(a) * RX, loopC.y + Math.sin(a * 2) * 0.1, loopC.z + Math.sin(a) * RZ));
  }
  const loopCurve = new T.CatmullRomCurve3(curvePts, true);
  for (const off of [-0.085, 0.085]) {
    const pts = curvePts.map((p) => {
      const d = new T.Vector3((p.x - loopC.x) / RX, 0, (p.z - loopC.z) / RZ).normalize();
      return new T.Vector3(p.x + d.x * off, p.y + 0.06, p.z + d.z * off);
    });
    kit.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 160, 0.018, 6, true), kit.mats.brass()));
  }
  {
    const n = kit.n(52);
    const ties = new T.InstancedMesh(new T.BoxGeometry(0.3, 0.035, 0.06), kit.mats.plastic('#4a3326'), n);
    const nPosts = Math.ceil(n / 4);
    const posts = new T.InstancedMesh(new T.CylinderGeometry(0.03, 0.03, 1, 6), kit.mats.paintedMetal('#6b5f8f'), nPosts);
    const m4 = new T.Matrix4();
    const q = new T.Quaternion();
    const q0 = new T.Quaternion();
    const p = new T.Vector3();
    const tan = new T.Vector3();
    const fwd = new T.Vector3(0, 0, 1);
    const one = new T.Vector3(1, 1, 1);
    const sc = new T.Vector3();
    for (let i = 0; i < n; i++) {
      loopCurve.getPointAt(i / n, p);
      loopCurve.getTangentAt(i / n, tan);
      tan.y = 0;
      q.setFromUnitVectors(fwd, tan.normalize());
      m4.compose(p, q, one);
      ties.setMatrixAt(i, m4);
      if (i % 4 === 0 && i / 4 < nPosts) {
        const hh = p.y - REGION_Y;
        sc.set(1, hh, 1);
        p.y = REGION_Y + hh / 2;
        m4.compose(p, q0, sc);
        posts.setMatrixAt(i / 4, m4);
      }
    }
    kit.add(ties);
    kit.add(posts);
  }
  const train = [makeCar(kit, '#3a2f66', true), ...[GOLD, OXY, MINT].map((c) => makeCar(kit, c, false))];
  train.forEach((c) => kit.add(c.g));
  const beamMat = kit.track(new T.MeshBasicMaterial({ color: '#ffe6a8', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  const beam = new T.Mesh(new T.ConeGeometry(0.22, 0.9, 16, 1, true), beamMat);
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.25, 0.7);
  train[0].g.add(beam);
  const railSign = kit.neonSign('ALL ABOARD', [6.0, 2.05, -4.7], { height: 0.38, color: GOLD, rotY: -0.42 });
  railSign.rotation.x = -0.55;
  // Station house in the middle of the loop; its gable clock creeps toward midnight.
  const house = new T.Group();
  const walls = new T.Mesh(new T.BoxGeometry(0.9, 0.7, 1.5), kit.mats.paintedMetal('#3b3266'));
  walls.position.y = 0.35;
  const roofGeo = new T.CylinderGeometry(0.62, 0.62, 1.66, 3, 1);
  roofGeo.rotateX(Math.PI / 2);
  roofGeo.rotateZ(Math.PI / 2);
  const roof = new T.Mesh(roofGeo, kit.mats.paintedMetal('#5a2c3c'));
  roof.scale.set(1, 0.55, 1);
  roof.position.y = 0.86;
  const winMat = kit.track(new T.MeshStandardMaterial({ color: '#120c18', emissive: GOLD, emissiveIntensity: 0.1 }));
  const win = new T.Mesh(new T.BoxGeometry(0.92, 0.18, 1.1), winMat);
  win.position.y = 0.4;
  const faceTex = clockTexture(kit);
  const faceMat = kit.track(new T.MeshStandardMaterial({ map: faceTex, emissive: '#fff0c8', emissiveMap: faceTex, emissiveIntensity: 0.15 }));
  const face = new T.Mesh(new T.CircleGeometry(0.3, 36), faceMat);
  face.position.set(0, 0.92, 0.84);
  const handMat = kit.mats.paintedMetal('#2a1d10');
  const hourHand = new T.Mesh(new T.BoxGeometry(0.035, 0.17, 0.015), handMat);
  const minHand = new T.Mesh(new T.BoxGeometry(0.025, 0.25, 0.015), handMat);
  hourHand.geometry.translate(0, 0.07, 0);
  minHand.geometry.translate(0, 0.11, 0);
  hourHand.position.set(0, 0.92, 0.86);
  minHand.position.set(0, 0.92, 0.87);
  house.add(walls, roof, win, face, hourHand, minHand);
  house.position.set(loopC.x, REGION_Y + 0.42, loopC.z);
  house.rotation.y = -0.25;
  kit.add(house);
  const housePlinth = kit.add(new T.Mesh(new T.CylinderGeometry(0.95, 1.05, 0.42, 20), kit.mats.paintedMetal('#2b2552')));
  housePlinth.position.set(loopC.x, REGION_Y + 0.21, loopC.z);

  // ---------------------------------------------------------------- freight on the platforms
  // Food cars' cargo (energy-storing food molecules) waits on the west platform behind the
  // oak, whose acorns pack starch and fat. Only the faces the player sees carry the label.
  const crateLabel = (text: string, bg: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const x = c.getContext('2d')!;
    x.fillStyle = bg;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(40,20,10,0.55)';
    x.lineWidth = 14;
    x.strokeRect(10, 10, 236, 236);
    x.fillStyle = '#2a1a0c';
    x.font = '800 54px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, 128, 132, 220);
    const tex = kit.track(new T.CanvasTexture(c));
    tex.colorSpace = T.SRGBColorSpace;
    return kit.track(new T.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  };
  const crateGeo = new T.BoxGeometry(0.46, 0.46, 0.46);
  const crateSide = kit.track(new T.MeshStandardMaterial({ color: '#b98a4e', roughness: 0.85 }));
  ([['SUGAR', '#f2d38a', -6.85, -1.0, 0, 0.12], ['STARCH', '#e8c27a', -7.35, -1.35, 0, 0.3], ['FAT', '#f0b46a', -7.05, -1.2, 0.46, 0.5]] as [string, string, number, number, number, number][]).forEach(([label, bg, x, z, y, rot]) => {
    const face = crateLabel(label, bg);
    // Box faces: +x, -x, +y (top), -y, +z (front), -z.
    const m = kit.add(new T.Mesh(crateGeo, [crateSide, crateSide, face, crateSide, face, crateSide]));
    m.position.set(x, REGION_Y + 0.23 + y, z);
    m.rotation.y = rot;
    m.castShadow = true;
  });

  // ---------------------------------------------------------------- platform lamps and garlands
  const lamps = [
    kit.lantern([-4.3, 2.35, 4.4], GOLD, 0.16),
    kit.lantern([4.3, 2.35, 4.4], GOLD, 0.16),
    kit.lantern([-4.4, 2.75, 0.6], MINT, 0.16),
    kit.lantern([4.4, 2.75, 0.6], MINT, 0.16),
  ];
  kit.pole([-4.3, 0, 4.4], 2.1, '#6b5f8f');
  kit.pole([4.3, 0, 4.4], 2.1, '#6b5f8f');
  kit.pole([-4.4, 0, 0.6], 2.5, '#6b5f8f');
  kit.pole([4.4, 0, 0.6], 2.5, '#6b5f8f');
  const garlandL = kit.stringLights([-4.4, 2.5, 0.6], [-4.3, 2.1, 4.4], 0.3, kit.n(10), [GOLD, LEAF]);
  const garlandR = kit.stringLights([4.4, 2.5, 0.6], [4.3, 2.1, 4.4], 0.3, kit.n(10), [GOLD, CORAL]);

  // ---------------------------------------------------------------- drifting molecules and fireworks
  const oxygenMotes = kit.motes({ x0: 4, x1: 9.5, y0: 0, y1: 5, z0: -6, z1: 4 }, 70, OXY, { speed: 0.18, size: 0.12 });
  const sugarMotes = kit.motes({ x0: -9.5, x1: -4, y0: 0, y1: 5, z0: -6, z1: 4 }, 70, GOLD, { speed: 0.14, size: 0.12 });
  // Midnight fireworks over both side regions (bigger sparks than the kit's, so they read from
  // the player's seat); they never reach x within ±4.2, so nothing crosses the cabinet.
  const bursts = makeBursts(kit, BURST_SITES, [GOLD, CORAL, MINT, LEAF, OXY, IVORY]);
  // The Wonderlight: a starburst of light opens behind the giant mitochondrion.
  const raysMat = kit.track(new T.MeshBasicMaterial({ map: raysTexture(kit), color: GOLD, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  const rays = new T.Mesh(new T.PlaneGeometry(4.2, 3.0), raysMat);
  rays.position.z = -0.12;
  mito.g.add(rays);

  kit.spot([-3.6, 6.5, 1.5], [-6.0, 1.2, -3.4], CORAL, 22, 0.45);
  kit.spot([4.2, 6.5, 1.5], [6.0, 0.6, -2.6], GOLD, 26, 0.5);
  const warm = kit.point([-6.0, 1.0, -2.2], '#ff9a7a', 0, 5);

  // Animation state (no per-frame allocation).
  let travel = 0;
  let speed = 0;
  const tmpP = new T.Vector3();
  const tmpT = new T.Vector3();
  const look = new T.Vector3();
  const placeCar = (obj: InstanceType<typeof T.Group>, u: number) => {
    const uu = ((u % 1) + 1) % 1;
    loopCurve.getPointAt(uu, tmpP);
    loopCurve.getTangentAt(uu, tmpT);
    obj.position.copy(tmpP);
    look.copy(tmpP).add(tmpT);
    obj.lookAt(look);
  };
  const carGap = 0.04;
  train.forEach((c, i) => placeCar(c.g, -i * carGap));

  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.5, 4);
      // Never a black void: dormant signs glow faintly and brighten with each mission.
      marquee.setLit(0.15 + 0.85 * s1);
      railSign.setLit(0.2 + 0.8 * s1);
      stationSign.setLit(0.25 + 0.75 * s2);
      plantSign.setLit(0.15 + 0.85 * s3);
      animalSign.setLit(0.15 + 0.85 * s3);
      for (let i = 0; i < lamps.length; i++) lamps[i].setLit(0.3 + 0.7 * (i < 2 ? s0 : s1));
      garlandL.setLit(0.2 + 0.8 * s1);
      garlandR.setLit(0.2 + 0.8 * s1);
      for (let i = 0; i < setSignal.length; i++) setSignal[i](s1);
      // The mitochondrion pulses with play energy once respiration is understood.
      const pulse = kit.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.4);
      mito.setLit(0.25 + 0.75 * s2, (0.3 + 0.7 * energy) * (0.3 + 0.7 * s2) * pulse + s4 * 0.3);
      haloMat.opacity = s4 * (0.55 + 0.35 * pulse);
      mitoHalo.scale.set(1.85 + 0.06 * pulse * s4, 1.08 + 0.04 * pulse * s4, 1);
      raysMat.opacity = 0.1 * s2 + 0.75 * s4 * (0.8 + 0.2 * pulse);
      if (!kit.reducedMotion) rays.rotation.z = Math.sin(t * 0.25) * 0.06;
      // Mitochondria glow in both magnified cells once the stations are visited (mission 3).
      miniMat.emissiveIntensity = 0.08 + 0.5 * s2 + 1.6 * s3 + 0.8 * s4 * pulse;
      plantCell.setLit(0.15 + 0.85 * s3);
      animalCell.setLit(0.15 + 0.85 * s3);
      if (!kit.reducedMotion) {
        gears[0].rotation.z += dt * (0.1 + 0.9 * s2);
        gears[1].rotation.z -= dt * (0.15 + 1.3 * s2);
        gears[2].rotation.z -= dt * (0.12 + 1.0 * s2);
        plantCell.spin(t);
        animalCell.spin(t);
      }
      // City windows wake mission by mission; all ablaze with the Wonderlight.
      for (let i = 0; i < cityGroups.length; i++) cityGroups[i].emissiveIntensity = 0.03 + 0.95 * kit.stage(level, i * 0.9 + 0.2, i * 0.9 + 1.0) + 0.5 * s4;
      if (warm) warm.intensity = 0.6 + 1.2 * s2 + 1.2 * s4;
      // The clock creeps from eleven toward midnight as the attraction awakens.
      faceMat.emissiveIntensity = 0.12 + 0.35 * s1;
      winMat.emissiveIntensity = 0.1 + 1.4 * s1;
      const minutes = 660 + Math.min(4, level) * 15;
      hourHand.rotation.z = -(((minutes / 60) % 12) / 12) * TAU;
      minHand.rotation.z = -((minutes % 60) / 60) * TAU;
      // The Express: parked while dormant, faster with each mission.
      const target = level < 0.2 ? 0 : 0.014 + 0.012 * s2 + 0.014 * s3 + 0.022 * s4;
      speed += (target - speed) * Math.min(1, dt * 0.8);
      if (!kit.reducedMotion) travel += dt * speed;
      for (let i = 0; i < train.length; i++) {
        placeCar(train[i].g, travel - i * carGap);
        train[i].winMat.emissiveIntensity = 0.12 + 2.4 * s1;
      }
      beamMat.opacity = 0.25 * s1 + 0.25 * s4;
      oxygenMotes.setLit(0.15 + 0.6 * s2);
      sugarMotes.setLit(0.15 + 0.6 * s1);
      bursts.setLit(s4);
    },
    celebrate(p) {
      bursts.setLit(Math.max(bursts.lit, Math.sin(p * Math.PI)));
    },
  };
};

// ================================================================ dollhouse room

const expressRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  // Toy track ring with a little Express circling a cutaway mitochondrion.
  const ring = kit.add(new T.Mesh(new T.TorusGeometry(0.55, 0.02, 6, 48), kit.mats.brass()));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  const mito = makeMitochondrion(kit, 0.62, 0.36);
  mito.g.position.set(0, 0.42, -0.05);
  mito.g.rotation.x = -0.2;
  kit.add(mito.g);
  const carMats = [GOLD, OXY, MINT].map((c) => kit.track(new T.MeshStandardMaterial({ color: '#181030', emissive: c, emissiveIntensity: 0.1 })));
  const cars = carMats.map((m, i) => kit.add(new T.Mesh(i === 0 ? new T.CylinderGeometry(0.05, 0.05, 0.16, 12).rotateX(Math.PI / 2) : new T.BoxGeometry(0.09, 0.07, 0.14), m)));
  // Midnight skyline on the back wall; its windows light with the room.
  const winMat = kit.track(new T.MeshStandardMaterial({ color: '#1a1640', emissive: GOLD, emissiveIntensity: 0.05 }));
  [[-0.78, 0.5], [-0.6, 0.34], [0.55, 0.42], [0.74, 0.58], [0.9, 0.3]].forEach(([x, h]) => {
    const b = kit.add(new T.Mesh(new T.BoxGeometry(0.15, h, 0.08), winMat));
    b.position.set(x, h / 2, -0.82);
  });
  // Clock at midnight above the skyline.
  const face = kit.add(new T.Mesh(new T.CircleGeometry(0.13, 24), kit.track(new T.MeshStandardMaterial({ color: '#fff3d6', emissive: '#fff0c8', emissiveIntensity: 0.1 }))));
  face.position.set(-0.62, 1.0, -0.84);
  const hand = kit.add(new T.Mesh(new T.BoxGeometry(0.018, 0.11, 0.01), kit.mats.paintedMetal('#2a1d10')));
  hand.position.set(-0.62, 1.05, -0.83);
  const sign = kit.neonSign('EXPRESS', [0.25, 0.98, -0.8], { height: 0.2, color: GOLD });
  // A tiny oak and a squirrel on its stump: both kinds of cells respire.
  const trunk = kit.add(new T.Mesh(new T.CylinderGeometry(0.025, 0.04, 0.3, 8), kit.mats.plastic('#5b3a24')));
  trunk.position.set(-0.78, 0.15, 0.25);
  const crown = kit.add(new T.Mesh(new T.IcosahedronGeometry(0.16, 1), kit.mats.plastic('#3f8f4e')));
  crown.scale.set(1.2, 0.8, 1.2);
  crown.position.set(-0.78, 0.38, 0.25);
  const stump = kit.add(new T.Mesh(new T.CylinderGeometry(0.08, 0.09, 0.1, 12), kit.mats.plastic('#5b3a24')));
  stump.position.set(0.8, 0.05, 0.3);
  const critter = kit.add(new T.Mesh(new T.SphereGeometry(0.06, 12, 10), kit.mats.plastic(RUST)));
  critter.scale.y = 1.3;
  critter.position.set(0.8, 0.17, 0.3);
  const tail = kit.add(new T.Mesh(new T.SphereGeometry(0.05, 10, 8), kit.mats.plastic(RUST)));
  tail.scale.set(0.7, 1.5, 0.7);
  tail.position.set(0.8, 0.22, 0.24);
  return {
    update(t, lit) {
      mito.setLit(lit, 0);
      sign.setLit(lit);
      winMat.emissiveIntensity = 0.05 + 1.4 * lit;
      const a0 = kit.reducedMotion ? 0.6 : t * 0.5;
      for (let i = 0; i < cars.length; i++) {
        const a = a0 - i * 0.34;
        cars[i].position.set(Math.cos(a) * 0.55, 0.09, Math.sin(a) * 0.55);
        cars[i].rotation.y = -a;
        carMats[i].emissiveIntensity = 0.1 + 1.6 * lit;
      }
    },
  };
};

// ================================================================ the attraction

export const L05: TableDef = {
  lessonId: 'L05',
  signature: 'The Express Loop: a clockwork railway whose plant and animal stations all run on respiration',
  ballRole: 'The Wonderball plays the Midnight Express, a game token: real cells have no trains, and the sugar and oxygen they use are molecules far too small to see.',
  theme: {
    bg: ['#1b2560', '#0e0a26'],
    rail: '#d9c79c',
    railHighlight: '#fff3d6',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: OXY,
    bumperRing: '#1d2a5a',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(255,199,91,0.16)',
    trail: GOLD,
  },
  lines: {
    intro: 'All aboard the Mitochondria Midnight Express! Tonight we follow the energy stored in food all the way to the station where cells release it.',
    quark: '"Plants make their own food and have no lungs, so surely they never need cellular respiration," Professor Quark muses. "Or do they?"',
    pipTip: 'A soft plunge rolls back past FIN for a skill shot. Then aim the right flipper at the red FOOD cars.',
  },
  build,
  skillShot: 'st_fin',
  shots: [
    { id: 'loopLeft', label: 'West Loop', on: [{ type: 'shot', id: 'loop_left_sw' }], insert: 'ins_loop_left' },
    { id: 'loopRight', label: 'East Loop', on: [{ type: 'shot', id: 'loop_right_sw' }], insert: 'ins_loop_right' },
    { id: 'station', label: 'Respiration Station', on: [{ type: 'saucer', id: 'station' }], insert: 'ins_station' },
    { id: 'tunnel', label: 'Tunnel', on: [{ type: 'portal', id: 'tunnel' }], insert: 'ins_tunnel' },
    { id: 'sugar', label: 'Sugar bank', on: [{ type: 'drop', group: 'sugar' }], insert: 'ins_sugar' },
    { id: 'oxygen', label: 'Oxygen bumpers', on: [{ type: 'bumper', group: 'oxygen' }], insert: 'ins_oxygen' },
    { id: 'food', label: 'Food cars', on: [{ type: 'target', group: 'food' }], insert: 'ins_food' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Stored-Energy Freight',
      brief: 'Load the food cars that carry stored chemical energy, haul them around the line, then deliver them to the station.',
      objectiveIds: ['L05-O1', 'L05-O4'],
      stages: [
        { kind: 'collect', text: 'Load the food cars: SUGAR, STARCH, FAT', match: { type: 'target', group: 'food' }, count: 3, distinct: true, lamps: ['food_sugar', 'food_starch', 'food_fat'] },
        { kind: 'shots', text: 'Haul the freight: run the Loop or the Tunnel', shots: ['loopLeft', 'loopRight', 'tunnel'], count: 1 },
        { kind: 'discover', text: 'Deliver the fuel to the Respiration Station', pocket: 'station', questions: 1 },
      ],
      discovery: 'Sugar, starch and fat are food molecules that store chemical energy. Producers and consumers both run their cells on energy stored in food.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Respiration Run',
      brief: 'Feed the station six oxygen molecules and one sugar molecule, then watch it rearrange their atoms.',
      objectiveIds: ['L05-O2'],
      stages: [
        { kind: 'collect', text: 'Pump in 6 O₂: hit the oxygen bumpers', match: { type: 'bumper', group: 'oxygen' }, count: 6, preview: ['oxygen'] },
        { kind: 'collect', text: 'Load one sugar, C₆H₁₂O₆: drop all three', match: { type: 'drop', group: 'sugar' }, count: 3, distinct: true, lamps: ['sugar_bank_1', 'sugar_bank_2', 'sugar_bank_3'], preview: ['sugar'] },
        { kind: 'discover', text: 'Run the reaction at the Respiration Station', pocket: 'station', questions: 1, types: ['order', 'match', 'classify'] },
      ],
      discovery: 'Sugar + oxygen → carbon dioxide + water + energy, mostly inside mitochondria. The same atoms go in and come out, just rearranged, as the energy stored in food is released.',
      reward: 'jackpot',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Midnight Shift',
      brief: 'Lights out! Photosynthesis stops at night. Visit the plant and animal stations, then run the line to see which cells keep respiring.',
      objectiveIds: ['L05-O3', 'L05-O5'],
      stages: [
        { kind: 'collect', text: 'Stop at all 4 stations: plant and animal cells', match: { type: 'rollover', group: 'stations' }, count: 4, distinct: true, lamps: ['st_leaf', 'st_root', 'st_paw', 'st_fin'] },
        { kind: 'shots', text: 'Midnight run: the West Loop and the Tunnel', shots: ['loopLeft', 'tunnel'], order: 'any' },
        { kind: 'discover', text: 'Report to the Respiration Station', pocket: 'station', questions: 1 },
      ],
      discovery: 'Living plant cells respire day and night to release energy from sugar, just like animal cells. Breathing moves air or water over lungs or gills; cellular respiration is the reaction inside cells.',
      reward: 'multiball',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Power the Midnight City',
    brief: 'Run the whole line, both Loops and the Tunnel, then bring the Express home to the Respiration Station as the clock strikes twelve.',
    stages: [
      { kind: 'shots', text: 'Run the line: West Loop, Tunnel and East Loop', shots: ['loopLeft', 'tunnel', 'loopRight'], order: 'any' },
      { kind: 'discover', text: 'Final stop: the Respiration Station', pocket: 'station', questions: 2 },
    ],
    celebration: 'Midnight, and the whole city glows! Day and night, mitochondria in plant and animal cells release energy stored in food. The Wonderlight is yours!',
  },
  set: expressSet,
  room: expressRoom,
  onProgress(rt, { slot, stage: st, level }) {
    // Once the Respiration Run is solved, its outputs light the route: the station lamps
    // glow along the line, except while Midnight Shift is asking the player to visit them.
    if (slot === 2 && st === 0) return;
    for (const id of ['st_leaf', 'st_root', 'st_paw', 'st_fin']) {
      const m = rt.find(id);
      if (m) m.lamp = level >= 2 ? 'pulse' : 'off';
    }
  },
  icons: {
    mito(ctx, s) {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.95, s * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, 0);
      for (let i = 0; i < 5; i++) ctx.lineTo(-s * 0.45 + i * s * 0.25, i % 2 ? -s * 0.3 : s * 0.3);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      sceneryBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      // 2D view: the Express headlight runs the line once the route is awake.
      const run = stage(level, 0.2, 1);
      if (run <= 0 || reduced) return;
      const n = TRACK.length;
      const u = (t * (0.06 + 0.04 * stage(level, 2, 4))) % 1;
      const f = u * (n - 1);
      const i = Math.floor(f);
      const a = TRACK[i];
      const b = TRACK[Math.min(n - 1, i + 1)];
      const k = f - i;
      glowDot(ctx, a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, 14, GOLD, 0.5 * run * (0.7 + 0.3 * energy));
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(STATION[0], STATION[1], 10, STATION[0], STATION[1], 440);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(CORAL, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // Energy chases around the whole line.
      const n = TRACK.length;
      for (let k = 0; k < 8; k++) {
        const idx = Math.floor((((p * 1.5 + k / 8 + t * 0.05) % 1) * (n - 1)));
        glowDot(ctx, TRACK[idx][0], TRACK[idx][1], 16, CHASE[k % 3], 1 - p * 0.6);
      }
      trackCtx = ctx;
      neonPath(ctx, traceTrack, GOLD, Math.sin(p * Math.PI), 3);
    },
  },
};
export default L05;
