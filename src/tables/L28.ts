// Lesson 28 — The Importance of Healthy Ecosystems — "Living World Market"
// A twilight market town ringed by the Market Loop, a cobbled orbit road. Living services stock
// every stall: the Bee Spinner on the loop pollinates the orchard for the Fruit Stall, the
// Wetland Meander lets muddy water settle clean on its climb to the Water Stall, and at the
// Market Scales (the Wonder Pocket) the Town Council weighs PRICE against VALUES after hearing
// every stakeholder. Every price on this table is pretend, and labelled that way.

import type * as THREE from 'three';
import { FRAME, type TableBuilder, type Pt } from '../game/table/builder.ts';
import { offsetPath, smoothPath } from '../game/table/mechanisms.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { TAU, drift, glowDot, leafShape, mix, plaque, rgba, rng, rrect, stage, stars, vgrad } from '../game/render/art.ts';

const PLUM = '#291B46';
const GOLD = '#FFC75B';
const HONEY = '#F2A93B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const BLOSSOM = '#FFB3C8';
const LEAF = '#8BCF6A';
const APPLE = '#E8564C';
const SKY = '#8FDCFF';
const MUD = '#8A6A42';
const BERRY = '#6A7CE0';
const STONE = '#9A93A8';

const SANS = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
const SERIF = '"Fraunces Variable", Georgia, serif';
const D2R = Math.PI / 180;

// ---------------------------------------------------------------- layout (table units)

/** Market Loop: inner rail of the ring road around the whole town, centre (310, 300). */
const RING_R = 234;
const RING_END = 360 - (Math.acos((498 - 310) / RING_R) * 180) / Math.PI;
/** Centreline of the Wetland Meander, a reedy S-lane that climbs to the Water Stall. */
const MEANDER: Pt[] = [[372, 704], [398, 646], [404, 586], [392, 526], [414, 464], [448, 412], [460, 368]];
const FRUIT: Pt = [160, 300];
const WELL: Pt = [460, 350];
const SCALES: Pt = [286, 462];
/** Lower end of the Council steps, the guide under the wetland pocket. */
const COUNCIL_STEP: Pt = [468, 672];
/** Service targets on the town's west wall (centres), top to bottom. */
const SERVICE_Y = [377, 425, 473, 521];
const SERVICES = [
  { id: 'svc_food', label: 'FOOD', note: 'food & wood' },
  { id: 'svc_pollen', label: 'POLLINATE', note: 'pollination' },
  { id: 'svc_water', label: 'FILTER', note: 'water filtering' },
  { id: 'svc_soil', label: 'SOIL', note: 'soil building' },
];
const STAKEHOLDERS = ['FARM', 'HOME', 'FISH', 'BUILD'];

/** U-shaped stall alcove around a saucer, opening toward `deg` (the eject direction). */
function alcove(cx: number, cy: number, deg: number, half = 30, back = 24, front = 26): Pt[] {
  const a = deg * D2R;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const p = (u: number, v: number): Pt => [cx + ux * u - uy * v, cy + uy * u + ux * v];
  return [p(front, -half), p(-back + 8, -half), p(-back, 0), p(-back + 8, half), p(front, half)];
}

// ================================================================ playfield geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Market Loop: one ring road around the whole town (either direction completes it) ---
  const ring: Pt[] = [[76, 640], ...b.arcPoints(310, 300, RING_R, 180, RING_END, 32), [498, 640]];
  b.wall(ring, { id: 'ring_inner', r: 3 });
  b.post(76, 644, 5, { id: 'ring_post_l' });
  b.post(498, 644, 5, { id: 'ring_post_r' });
  // A one-way gate deflects returning balls into play but lets the kickback fire up through it.
  b.gate('pollen_gate', [FRAME.left, 648], [56, 696], -90);
  b.wall([[FRAME.laneSep, 646], [518, 694]], { id: 'loop_deflect_r', r: 3 });
  // The Bee Spinner sits on the west road: every loop either way buzzes through it.
  b.spinner('bee_spinner', [29, 530], [71, 530], { label: 'BEE SPINNER', group: 'bees' });
  b.shotSwitch('loop_l_sw', 50, 440, -90);
  b.shotSwitch('loop_r_sw', 523, 440, -90);
  // Skill shot: a soft plunge falls back down the east road over OPEN.
  b.rollover('market_open', 523, 372, { label: 'OPEN', group: 'skill' });

  // --- Orchard: blossom bumpers at the top of town ---
  b.bumper('blossom_1', 232, 196, { group: 'blossoms', r: 24, icon: 'blossom' });
  b.bumper('blossom_2', 340, 196, { group: 'blossoms', r: 24, icon: 'blossom' });
  b.bumper('blossom_3', 286, 272, { group: 'blossoms', r: 24, icon: 'blossom' });

  // --- Fruit Stall (upper left): a striped stall alcove around a kick-out saucer ---
  b.wall(alcove(FRUIT[0], FRUIT[1], 64), { id: 'fruit_stall_walls', r: 4 });
  b.saucer('fruit_stall', FRUIT[0], FRUIT[1], { ejectDeg: 64, ejectSpeed: 900, captureMaxSpeed: 2400, label: 'FRUIT', icon: 'bee' });

  // --- Wetland Meander -> Water Stall (right) ---
  const center = b.curvePoints(MEANDER, 6);
  const west = offsetPath(center, -26);
  const east = offsetPath(center, 26);
  // The west bank stops short of the top: clean water spills out west into the orchard.
  const cut = west.findIndex((p) => p[1] < 418);
  b.wall(west.slice(0, cut), { id: 'meander_l', r: 3 });
  b.wall(east, { id: 'meander_r', r: 3 });
  // Hood over the stall rises to the ring rail so nothing can rest on it.
  const top = east[east.length - 1];
  b.wall([top, [494, 280], [468, 290], [444, 300], [428, 306]], { id: 'meander_hood', r: 3 });
  b.shotSwitch('meander_sw', 400, 560, -90);
  // Floor labels are centred under the saucer; two trailing em spaces nudge "WATER" left so the
  // meander's east bank no longer hides its last letter.
  b.saucer('water_stall', WELL[0], WELL[1], { ejectDeg: 210, ejectSpeed: 1100, captureMaxSpeed: 2600, label: 'WATER  ', icon: 'drop' });

  // --- Town Council: four stakeholder drop targets in the wetland pocket (ring rail behind) ---
  b.dropBank('council', 488, 452, 90, 4, { size: 26, gap: 6, group: 'stakeholders', labels: STAKEHOLDERS });
  // Council steps: balls rolling out of the pocket off the meander's bulge were heading for the
  // right outlane; this short apron turns them down-left onto the sling and the right flipper.
  b.wall([[498, 644], [COUNCIL_STEP[0], COUNCIL_STEP[1]]], { id: 'council_steps', r: 3 });

  // --- Market Scales (Wonder Pocket) in a cup, with PRICE and VALUES pans on its sides ---
  const [sx, sy] = SCALES;
  b.wall([[sx - 28, sy + 24], [sx - 28, sy - 22], [sx, sy - 34], [sx + 28, sy - 22], [sx + 28, sy + 24]], { id: 'scales_cup', r: 4 });
  b.saucer('market_scales', sx, sy, { role: 'pocket', ejectDeg: 100, ejectSpeed: 760, captureMaxSpeed: 2400, label: 'SCALES', icon: 'scales' });
  b.target('pan_price', [sx - 42, sy - 16], [sx - 42, sy + 16], { group: 'pans', label: 'PRICE' });
  b.target('pan_values', [sx + 42, sy + 16], [sx + 42, sy - 16], { group: 'pans', label: 'VALUES' });

  // --- Service targets: four kinds of ecosystem service along the town's west wall ---
  SERVICES.forEach((s, i) => {
    const y = SERVICE_Y[i];
    b.target(s.id, [90, y - 21], [90, y + 21], { group: 'services', label: s.label });
  });
  // Sloped cap: a ball rolling down the wall onto the top target always rolls off into play.
  b.wall([[77, 334], [90, 352]], { id: 'services_cap', r: 3 });

  // --- Inserts ---
  b.insert('ins_bee', 50, 600, { deg: -90, label: 'BEES' });
  b.insert('ins_loop', 523, 600, { deg: -90, label: 'LOOP' });
  b.insert('ins_fruit', 196, 420, { deg: -104 });
  b.insert('ins_meander', 352, 760, { deg: -66 });
  b.insert('ins_scales', sx, 540, { deg: -90 });
  b.insert('ins_bank', 448, 640, { deg: -70 });
  b.insert('ins_services', 150, 600, { deg: -120 });
  b.insert('ins_blossoms', 286, 220, { shape: 'star', size: 12 });
}

// ================================================================ printed playfield art

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1, rot = 0, font = SANS, weight = 800) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, size * 0.28);
  ctx.strokeStyle = rgba('#140c22', 0.8 * alpha);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Neon-style lettering laid along an arc (reads clockwise, upright at the top). */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, centerDeg: number, size: number, color: string, lit: number, font = SERIF) {
  ctx.save();
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const widths = [...text].map((ch) => ctx.measureText(ch).width * 1.06);
  const total = widths.reduce((a, w) => a + w, 0);
  let a = centerDeg * D2R - total / r / 2;
  for (let i = 0; i < text.length; i++) {
    const am = a + widths[i] / r / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(am) * r, cy + Math.sin(am) * r);
    ctx.rotate(am + Math.PI / 2);
    ctx.lineWidth = Math.max(3, size * 0.3);
    ctx.strokeStyle = 'rgba(20,12,30,0.85)';
    ctx.strokeText(text[i], 0, 0);
    if (lit > 0.01) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 * lit;
    }
    ctx.fillStyle = rgba(color, 0.35 + 0.65 * lit);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    a += widths[i] / r;
  }
  ctx.restore();
}

/** The frame interior above the lower playfield (outer edge of the Market Loop). */
function traceFrame(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(24, 652);
  ctx.lineTo(24, 300);
  ctx.arc(310, 300, 286, Math.PI, TAU);
  ctx.lineTo(596, 334);
  ctx.lineTo(548, 334);
  ctx.lineTo(548, 652);
  ctx.closePath();
}

/** The town inside the Market Loop's inner rail. */
function traceTown(ctx: CanvasRenderingContext2D) {
  ctx.moveTo(79, 641);
  ctx.lineTo(79, 300);
  ctx.arc(310, 300, RING_R - 3, Math.PI, RING_END * D2R);
  ctx.lineTo(495, 641);
  ctx.closePath();
}

// --- tiny printed pictograms (drawn at x, y with size s) ---

function bee(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha * 0.75;
  ctx.fillStyle = IVORY;
  ctx.beginPath();
  ctx.ellipse(-s * 0.2, -s * 0.62, s * 0.42, s * 0.26, -0.5, 0, TAU);
  ctx.ellipse(s * 0.25, -s * 0.62, s * 0.42, s * 0.26, 0.5, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.75, s * 0.48, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(-s * 0.2, -s * 0.46, s * 0.16, s * 0.92);
  ctx.fillRect(s * 0.2, -s * 0.42, s * 0.16, s * 0.84);
  circle(ctx, s * 0.7, 0, s * 0.24);
  ctx.restore();
}

function apple(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  circle(ctx, x, y, s);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  circle(ctx, x - s * 0.35, y - s * 0.35, s * 0.28);
  ctx.strokeStyle = '#4a2a14';
  ctx.lineWidth = Math.max(1, s * 0.22);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.8);
  ctx.lineTo(x + s * 0.2, y - s * 1.3);
  ctx.stroke();
  ctx.restore();
}

function dropShape(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.25, y - s * 0.5, x + s * 0.75, y, x + s * 0.62, y + s * 0.35);
  ctx.arc(x, y + s * 0.35, s * 0.62, 0, Math.PI);
  ctx.bezierCurveTo(x - s * 0.75, y, x - s * 0.25, y - s * 0.5, x, y - s);
  ctx.fill();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.85);
  ctx.bezierCurveTo(x - s * 1.2, y - s * 0.1, x - s * 0.5, y - s * 0.95, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.95, x + s * 1.2, y - s * 0.1, x, y + s * 0.85);
  ctx.fill();
}

function sprout(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = MUD;
  ctx.fillRect(x - s, y + s * 0.3, s * 2, s * 0.6);
  leafShape(ctx, x, y + s * 0.3, s * 1.1, -2.3, color);
  leafShape(ctx, x, y + s * 0.3, s * 1.1, -0.85, color);
}

function serviceIcon(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, s: number, lit: number) {
  ctx.save();
  if (i === 0) {
    apple(ctx, x, y + 1, s * 0.8, APPLE, 0.55 + 0.45 * lit);
  } else if (i === 1) {
    bee(ctx, x, y + 1, s * 0.9, 0, 0.55 + 0.45 * lit);
  } else if (i === 2) {
    ctx.fillStyle = rgba(SKY, 0.55 + 0.45 * lit);
    dropShape(ctx, x, y, s * 0.85);
  } else {
    sprout(ctx, x, y - 1, s * 0.7, rgba(LEAF, 0.55 + 0.45 * lit));
  }
  ctx.restore();
}

function stakeholderIcon(ctx: CanvasRenderingContext2D, i: number, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  if (i === 0) {
    // barn
    ctx.beginPath();
    ctx.moveTo(x - s, y + s);
    ctx.lineTo(x - s, y - s * 0.2);
    ctx.lineTo(x, y - s);
    ctx.lineTo(x + s, y - s * 0.2);
    ctx.lineTo(x + s, y + s);
    ctx.closePath();
    ctx.fill();
  } else if (i === 1) {
    // house with a window
    ctx.fillRect(x - s * 0.8, y - s * 0.1, s * 1.6, s * 1.1);
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.closePath();
    ctx.fill();
  } else if (i === 2) {
    // fish
    ctx.beginPath();
    ctx.ellipse(x - s * 0.15, y, s * 0.7, s * 0.4, 0, 0, TAU);
    ctx.moveTo(x + s * 0.45, y);
    ctx.lineTo(x + s, y - s * 0.45);
    ctx.lineTo(x + s, y + s * 0.45);
    ctx.closePath();
    ctx.fill();
  } else {
    // little crane
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s);
    ctx.lineTo(x - s * 0.5, y - s);
    ctx.lineTo(x + s, y - s);
    ctx.moveTo(x + s * 0.7, y - s);
    ctx.lineTo(x + s * 0.7, y);
    ctx.stroke();
    ctx.fillRect(x + s * 0.45, y, s * 0.5, s * 0.4);
  }
  ctx.restore();
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#b8862e';
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5, s, s * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.ellipse(x, y, s, s * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// --- big printed pieces ---

function paintPlaza(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s3 = stage(level, 2.2, 3);
  // Terracotta market paving across the lower playfield.
  ctx.fillStyle = vgrad(ctx, 600, 1150, [[0, mix('#3a2a44', '#55384a', s1)], [0.55, mix('#2c2038', '#3c2a40', s1)], [1, '#181024']]);
  ctx.fillRect(24, 600, 572, 550);
  const r = rng(2803);
  for (let row = 0, y = 652; y < 1060; y += 11, row++) {
    for (let x = 26 + (row % 2) * 11; x < 548; x += 22) {
      ctx.fillStyle = rgba(mix('#6e4038', '#9a5c48', r()), (0.16 + 0.1 * s1) * (1 - (y - 650) / 520));
      ctx.fillRect(x, y, 20, 9);
    }
  }
  // Flower boxes beside the outlanes and under the slings.
  for (const [x0, x1] of [[26, 60], [512, 546]] as [number, number][]) {
    ctx.fillStyle = rgba('#24391f', 0.85);
    ctx.fillRect(x0, 700, x1 - x0, 140);
    for (let i = 0; i < 16; i++) {
      const x = x0 + 4 + r() * (x1 - x0 - 8);
      const y = 706 + r() * 128;
      leafShape(ctx, x, y, 7, -1.6 + (r() - 0.5), rgba(LEAF, 0.35 + 0.3 * s1));
      ctx.fillStyle = rgba([BLOSSOM, GOLD, IVORY, CORAL][i % 4], 0.35 + 0.55 * s1);
      circle(ctx, x + 2, y - 4, 2.4);
    }
  }
  // The market board: pretend prices, plus things a price tag leaves out.
  const bx = 116;
  const by = 660;
  const bw = 186;
  const bh = 104;
  ctx.save();
  rrect(ctx, bx - 4, by - 4, bw + 8, bh + 8, 10);
  ctx.fillStyle = '#7a4e30';
  ctx.fill();
  rrect(ctx, bx, by, bw, bh, 7);
  ctx.fillStyle = '#1d2a25';
  ctx.fill();
  ctx.restore();
  const chalk = 0.72 + 0.28 * s3;
  label(ctx, 'MARKET BOARD', bx + bw / 2, by + 14, 12, GOLD, 0.85 + 0.15 * s3, 0, SERIF);
  const rows: [string, string, string][] = [
    ['apples', '3 coins*', IVORY],
    ['jug of water', '1 coin*', IVORY],
    ['bees pollinating', 'no price tag', MINT],
    ['a wetland walk', 'no price tag', MINT],
  ];
  ctx.save();
  ctx.font = `700 10.5px ${SANS}`;
  ctx.textBaseline = 'middle';
  rows.forEach(([item, price, c], i) => {
    const y = by + 33 + i * 15;
    ctx.fillStyle = rgba(IVORY, chalk);
    ctx.textAlign = 'left';
    ctx.fillText(item, bx + 10, y);
    ctx.fillStyle = rgba(c, chalk);
    ctx.textAlign = 'right';
    ctx.fillText(price, bx + bw - 10, y);
    ctx.strokeStyle = rgba(IVORY, 0.18);
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(bx + 14 + ctx.measureText(item).width, y + 1);
    ctx.lineTo(bx + bw - 14 - ctx.measureText(price).width, y + 1);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.font = `700 8.5px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(GOLD, 0.8);
  ctx.fillText('* pretend coins: every price here is made up', bx + bw / 2, by + bh - 9);
  ctx.restore();
  // Apron: the lesson in one line, below the flippers.
  const ax = 286;
  label(ctx, "NATURE'S WORK  ›  SERVICES  ›  OUR MARKET", ax, 1078, 11.5, GOLD, 0.55 + 0.45 * s1);
  label(ctx, 'healthy ecosystems keep the stalls stocked', ax, 1096, 9, IVORY, 0.45 + 0.4 * s1, 0, SANS, 700);
}

function paintRoad(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const wake = stage(level, 0, 3);
  ctx.save();
  ctx.beginPath();
  traceFrame(ctx);
  traceTown(ctx);
  ctx.clip('evenodd');
  ctx.fillStyle = mix('#2a2340', '#392f50', wake);
  ctx.fillRect(0, 0, 600, 660);
  const r = rng(2801);
  for (let row = 0, y = 18; y < 660; y += 10, row++) {
    for (let x = 22 + (row % 2) * 7; x < 600; x += 14) {
      ctx.globalAlpha = 0.5 + 0.35 * r();
      ctx.fillStyle = mix('#3e3554', '#62557a', r() * (0.6 + 0.4 * wake));
      ctx.beginPath();
      ctx.ellipse(x + (r() - 0.5) * 2, y, 6, 4, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Honeycomb paving on the west road under the Bee Spinner.
  ctx.strokeStyle = rgba(GOLD, 0.2 + 0.5 * s1);
  ctx.fillStyle = rgba(HONEY, 0.08 + 0.18 * s1);
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      const hx = 30 + col * 12 + (row % 2) * 6;
      const hy = 502 + row * 10;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.lineTo(hx + Math.cos(k * TAU / 6 + Math.PI / 6) * 6.2, hy + Math.sin(k * TAU / 6 + Math.PI / 6) * 6.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
  // Curb along the inner rail.
  ctx.save();
  ctx.strokeStyle = rgba(IVORY, 0.1 + 0.12 * s1);
  ctx.lineWidth = 3;
  ctx.beginPath();
  traceTown(ctx);
  ctx.stroke();
  // Painted centre line of the road.
  ctx.setLineDash([10, 16]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(GOLD, 0.16 + 0.4 * s1);
  ctx.beginPath();
  ctx.moveTo(50, 636);
  ctx.lineTo(50, 300);
  ctx.arc(310, 300, 260, Math.PI, 1.8 * Math.PI);
  ctx.lineTo(523, 636);
  ctx.stroke();
  ctx.restore();
  // Street lanterns along the inner curb.
  const lamp = (x: number, y: number) => {
    glowDot(ctx, x, y, 12, GOLD, 0.08 + 0.5 * s1);
    ctx.fillStyle = s1 > 0.05 ? rgba('#FFE8B0', 0.4 + 0.6 * s1) : 'rgba(80,70,90,0.8)';
    circle(ctx, x, y, 2.6);
  };
  for (let a = 192; a <= 318; a += 14) lamp(310 + Math.cos(a * D2R) * (RING_R + 11), 300 + Math.sin(a * D2R) * (RING_R + 11));
  for (let y = 360; y <= 620; y += 65) lamp(68, y);
  for (let y = 220; y <= 620; y += 80) lamp(506, y);
  arcText(ctx, 'MARKET LOOP', 310, 300, 260, 211, 12, MINT, s1, SANS);
  label(ctx, 'BEE SPINNER', 50, 466, 12, GOLD, 0.55 + 0.45 * s1, -Math.PI / 2);
  label(ctx, 'MARKET LOOP', 523, 522, 12, MINT, 0.5 + 0.45 * s1, -Math.PI / 2);
}

const ORCHARD: [number, number, number][] = [[232, 192, 44], [340, 192, 44], [286, 270, 40], [148, 186, 26], [424, 176, 28], [118, 236, 16]];

function paintOrchard(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const r = rng(2804);
  for (const [x, y, rr] of ORCHARD) {
    ctx.fillStyle = 'rgba(8,16,8,0.35)';
    circle(ctx, x + 4, y + 6, rr);
    ctx.fillStyle = mix('#203c27', '#3a7038', 0.25 * s1 + 0.75 * s2);
    circle(ctx, x, y, rr);
    const leaves = Math.round(rr * 0.7);
    for (let k = 0; k < leaves; k++) {
      const a = (k / leaves) * TAU + r() * 0.3;
      leafShape(ctx, x + Math.cos(a) * rr * 0.78, y + Math.sin(a) * rr * 0.78, 9 + r() * 4, a + (r() - 0.5), rgba(mix('#2e5a30', '#7cc45e', s2), 0.85));
    }
    // Blossoms open with the morning; many become fruit once the bees have been.
    for (let k = 0; k < Math.round(rr * 0.4); k++) {
      const a = r() * TAU;
      const d = rr * (0.55 + r() * 0.4);
      ctx.fillStyle = rgba(k % 3 ? BLOSSOM : IVORY, (0.4 + 0.5 * s1) * (1 - 0.55 * s2));
      circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 2.4 + r() * 1.4);
    }
    if (s2 > 0.01) {
      for (let k = 0; k < Math.round(rr * 0.28); k++) {
        const a = r() * TAU;
        const d = rr * (0.55 + r() * 0.35);
        apple(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 3.2 + r() * 1.6, k % 3 ? APPLE : HONEY, s2);
      }
    }
  }
  // Printed bees at work.
  const bees: [number, number, number][] = [[198, 236, 0.4], [372, 232, -0.5], [286, 214, 0.1], [180, 160, -0.3], [394, 150, 0.6]];
  for (const [x, y, a] of bees) bee(ctx, x, y, 5, a, 0.25 + 0.65 * s1);
  arcText(ctx, 'LIVING WORLD MARKET', 310, 300, 205, 270, 16, GOLD, stage(level, 1.4, 2.4));
  arcText(ctx, 'FERNBROOK ORCHARD', 310, 300, 184, 270, 9.5, IVORY, 0.4 + 0.6 * s1, SANS);
}

function paintFruitStall(ctx: CanvasRenderingContext2D, level: number) {
  const s2 = stage(level, 1.2, 2);
  const [fx, fy] = FRUIT;
  // Striped awning wrapped around the back of the stall alcove.
  for (let i = 0; i < 10; i++) {
    const a0 = (154 + i * 18) * D2R;
    const a1 = a0 + 18 * D2R;
    ctx.fillStyle = i % 2 ? rgba(IVORY, 0.4 + 0.45 * s2) : rgba(CORAL, 0.45 + 0.45 * s2);
    ctx.beginPath();
    ctx.arc(fx, fy, 57, a0, a1);
    ctx.arc(fx, fy, 35, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = rgba('#3a1a24', 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(fx, fy, 57, 154 * D2R, 334 * D2R);
  ctx.stroke();
  arcText(ctx, 'FRUIT STALL', fx, fy, 46, 244, 10.5, IVORY, 0.3 + 0.7 * s2, SANS);
  // Produce around the saucer once the orchard has been pollinated.
  const goods = [APPLE, HONEY, BERRY, APPLE, '#9BD46A', HONEY];
  goods.forEach((c, i) => {
    const a = (200 + i * 26) * D2R;
    apple(ctx, fx + Math.cos(a) * 24, fy + Math.sin(a) * 24, 3.4, c, 0.25 + 0.75 * s2);
  });
}

function paintServices(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  SERVICES.forEach((s, i) => {
    const y = SERVICE_Y[i];
    ctx.fillStyle = rgba(PLUM, 0.85);
    circle(ctx, 116, y, 12);
    ctx.strokeStyle = rgba(GOLD, 0.3 + 0.6 * s1);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(116, y, 12, 0, TAU);
    ctx.stroke();
    if (s1 > 0.05) glowDot(ctx, 116, y, 22, GOLD, 0.25 * s1);
    serviceIcon(ctx, i, 116, y, 8, s1);
    ctx.save();
    ctx.font = `700 9.5px ${SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,12,34,0.8)';
    ctx.strokeText(s.note, 133, y);
    ctx.fillStyle = rgba(IVORY, 0.5 + 0.4 * s1);
    ctx.fillText(s.note, 133, y);
    ctx.restore();
  });
}

function paintScales(ctx: CanvasRenderingContext2D, level: number) {
  const s3 = stage(level, 2.2, 3);
  const [sx] = SCALES;
  const half = 52;
  // Until the council has weighed both, PRICE outweighs VALUES; then the beam levels out.
  const tilt = 9 * (1 - s3);
  const beamY = 402;
  const metal = mix('#9a7440', GOLD, 0.3 + 0.7 * s3);
  ctx.save();
  ctx.fillStyle = rgba(metal, 0.7);
  ctx.fillRect(sx - 3.5, beamY - 2, 7, 30);
  ctx.beginPath();
  ctx.moveTo(sx - 9, beamY + 2);
  ctx.lineTo(sx, beamY - 12);
  ctx.lineTo(sx + 9, beamY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = metal;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(sx - half - 6, beamY + tilt * 1.1);
  ctx.lineTo(sx + half + 6, beamY - tilt * 1.1);
  ctx.stroke();
  if (s3 > 0.05) glowDot(ctx, sx, beamY, 60, GOLD, 0.25 * s3);
  for (const side of [-1, 1]) {
    const ex = sx + side * half;
    const ey = beamY - side * tilt;
    const py = ey + 92;
    ctx.strokeStyle = rgba(metal, 0.75);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 17, py);
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + 17, py);
    ctx.stroke();
    ctx.fillStyle = rgba(metal, 0.85);
    ctx.beginPath();
    ctx.moveTo(ex - 20, py);
    ctx.quadraticCurveTo(ex, py + 18, ex + 20, py);
    ctx.closePath();
    ctx.fill();
    if (side < 0) {
      for (let k = 0; k < 4; k++) coin(ctx, ex + (k % 2 ? 5 : -4), py - 3 - k * 3, 6.5, 0.9);
      label(ctx, 'PRICE', ex, py + 22, 11, GOLD, 0.7 + 0.3 * s3);
    } else {
      const a = 0.35 + 0.65 * s3;
      ctx.fillStyle = rgba(LEAF, a);
      leafShape(ctx, ex - 14, py - 3, 11, -0.7, rgba(LEAF, a));
      ctx.fillStyle = rgba(SKY, a);
      dropShape(ctx, ex - 1, py - 6, 5.5);
      ctx.fillStyle = rgba(CORAL, a);
      heart(ctx, ex + 11, py - 5, 5);
      bee(ctx, ex + 3, py - 15, 4.2, 0.2, a);
      label(ctx, 'VALUES', ex, py + 22, 11, MINT, 0.7 + 0.3 * s3);
    }
  }
  ctx.restore();
  label(ctx, 'MARKET SCALES', sx, 384, 11, GOLD, 0.65 + 0.35 * s3, 0, SERIF);
  label(ctx, 'price is one way', sx - 30, 572, 9.5, IVORY, 0.5 + 0.4 * s3, 0, SANS, 700);
  label(ctx, 'to measure value', sx - 30, 584, 9.5, IVORY, 0.5 + 0.4 * s3, 0, SANS, 700);
}

function paintMeander(ctx: CanvasRenderingContext2D, level: number) {
  const s2 = stage(level, 1.2, 2);
  const path = smoothPath(MEANDER, 6);
  const stroke = (w: number, style: string | CanvasGradient) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = w;
    ctx.strokeStyle = style;
    ctx.beginPath();
    path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  };
  stroke(76, rgba('#22331f', 0.9));
  stroke(62, rgba(mix('#4a3a26', '#5a4a2e', s2), 0.85));
  // Water runs muddy at the bottom and clear at the top: it slows in the wetland, so mud settles.
  const g = ctx.createLinearGradient(0, 710, 0, 360);
  g.addColorStop(0, mix('#4b3b28', '#6d5634', s2));
  g.addColorStop(0.45, mix('#3c4840', '#3f8a8a', s2));
  g.addColorStop(1, mix('#3e5658', '#86e8ff', s2));
  stroke(46, g);
  const r = rng(2805);
  const n = path.length - 1;
  for (let i = 0; i < 90; i++) {
    const t = Math.pow(r(), 1.8);
    const k = Math.min(n - 1, Math.floor(t * n));
    const [x0, y0] = path[k];
    const [x1, y1] = path[k + 1];
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    const off = (r() - 0.5) * 34;
    ctx.fillStyle = rgba('#b08a52', 0.55 * (1 - t));
    circle(ctx, x0 - ((y1 - y0) / l) * off, y0 + ((x1 - x0) / l) * off, 1.4 + r() * 1.6);
  }
  // Flow chevrons pointing upstream (the way the shot travels).
  ctx.save();
  ctx.strokeStyle = rgba(SKY, 0.15 + 0.55 * s2);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let k = 3; k < n - 2; k += 5) {
    const [x0, y0] = path[k];
    const [x1, y1] = path[k + 1];
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.lineTo(3, 0);
    ctx.lineTo(-5, 7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // Reeds and cattails along both banks.
  for (const side of [-1, 1]) {
    const bank = offsetPath(path, side * 34);
    bank.forEach(([x, y], i) => {
      if (i % 2) return;
      const h = 7 + r() * 7;
      ctx.strokeStyle = rgba(mix('#3d6a34', '#8bcf6a', s2), 0.75);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 4, y - h);
      ctx.stroke();
      if (i % 6 === 0) {
        ctx.fillStyle = rgba('#7a4e2a', 0.85);
        ctx.beginPath();
        ctx.ellipse(x, y - h, 1.8, 3.6, 0, 0, TAU);
        ctx.fill();
      }
    });
  }
}

/** Meander lettering, drawn outside the town clip so the lower ends are not cut off. */
function paintMeanderLabels(ctx: CanvasRenderingContext2D, level: number) {
  const s2 = stage(level, 1.2, 2);
  label(ctx, 'WETLAND MEANDER', 340, 590, 11, SKY, 0.55 + 0.45 * s2, -1.36);
  label(ctx, 'mud settles, water clears', 324, 598, 8.5, IVORY, 0.3 + 0.55 * s2, -1.36, SANS, 700);
}

function paintWaterStall(ctx: CanvasRenderingContext2D, level: number) {
  const s2 = stage(level, 1.2, 2);
  const [wx, wy] = WELL;
  const g = ctx.createRadialGradient(wx, wy, 2, wx, wy, 30);
  g.addColorStop(0, rgba(SKY, 0.25 + 0.55 * s2));
  g.addColorStop(1, rgba(SKY, 0));
  ctx.fillStyle = g;
  circle(ctx, wx, wy, 30);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    ctx.fillStyle = rgba(mix(STONE, '#c8c2d4', (k % 3) / 3), 0.85);
    ctx.beginPath();
    ctx.ellipse(wx + Math.cos(a) * 25, wy + Math.sin(a) * 25, 5, 3.4, a, 0, TAU);
    ctx.fill();
  }
  plaque(ctx, 'WATER STALL', 438, 240, rgba(mix('#2f6a76', MINT, s2), 0.95), '#0e1a22', 10);
  ctx.fillStyle = rgba(SKY, 0.3 + 0.6 * s2);
  dropShape(ctx, 394, 240, 6);
}

function paintCouncil(ctx: CanvasRenderingContext2D, level: number) {
  const s3 = stage(level, 2.2, 3);
  // The hall sits in the wetland pocket, tucked inside the meander's east bank.
  ctx.save();
  ctx.fillStyle = rgba(mix('#2e2444', '#4a3858', s3), 0.75);
  ctx.fillRect(458, 454, 38, 168);
  ctx.beginPath();
  ctx.moveTo(456, 456);
  ctx.lineTo(477, 434);
  ctx.lineTo(498, 456);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(IVORY, 0.08 + 0.12 * s3);
  for (const x of [459, 492]) ctx.fillRect(x, 458, 3, 160);
  ctx.restore();
  if (s3 > 0.05) glowDot(ctx, 471, 518, 70, GOLD, 0.2 * s3);
  label(ctx, 'TOWN', 466, 598, 8.5, GOLD, 0.6 + 0.4 * s3, 0, SANS, 800);
  label(ctx, 'COUNCIL', 466, 610, 8.5, GOLD, 0.6 + 0.4 * s3, 0, SANS, 800);
  STAKEHOLDERS.forEach((_, i) => stakeholderIcon(ctx, i, 468, 465 + i * 32, 6, rgba(i % 2 ? MINT : GOLD, 0.45 + 0.55 * s3)));
}

function paintMarket(c: SceneryContext) {
  const { ctx, level } = c;
  const wake = stage(level, 0, 4);
  const s4 = stage(level, 3.3, 4);
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1b1532'], [0.5, mix('#251a3c', '#33244a', wake)], [1, '#140d22']]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 28, 40, [30, 20, 570, 120], IVORY);
  paintPlaza(ctx, level);
  paintRoad(ctx, level);
  // The town inside the loop.
  ctx.save();
  ctx.beginPath();
  traceTown(ctx);
  ctx.clip();
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  ctx.fillStyle = vgrad(ctx, 66, 640, [
    [0, mix('#213a2a', '#33613a', s2)],
    [0.42, mix('#29383a', '#3a503e', s2)],
    [0.58, mix('#382a42', '#523848', s1)],
    [1, mix('#30243c', '#463044', s1)],
  ]);
  ctx.fillRect(60, 50, 460, 600);
  const r = rng(2802);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 240; i++) {
    const x = 82 + r() * 412;
    const y = 72 + r() * 270;
    ctx.strokeStyle = rgba(mix('#4f8a4a', '#9bd46a', r()), 0.14 + 0.22 * s2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 5);
    ctx.stroke();
  }
  for (let row = 0, y = 350; y < 640; y += 9, row++) {
    for (let x = 80 + (row % 2) * 9; x < 498; x += 18) {
      ctx.fillStyle = rgba(mix('#6a3f3a', '#8a5444', r()), 0.2 + 0.14 * s1);
      ctx.fillRect(x, y, 16, 7);
    }
  }
  paintOrchard(ctx, level);
  paintFruitStall(ctx, level);
  paintMeander(ctx, level);
  // The scales go over the meander's grassy bank so the VALUES pan and label stay whole.
  paintScales(ctx, level);
  paintWaterStall(ctx, level);
  paintCouncil(ctx, level);
  ctx.restore();
  paintMeanderLabels(ctx, level);
  paintServices(ctx, level);
  // Wonderlight: a warm wash over the whole market.
  if (s4 > 0.01) {
    const g = ctx.createRadialGradient(286, 420, 20, 286, 420, 620);
    g.addColorStop(0, rgba(GOLD, 0.12 * s4));
    g.addColorStop(1, rgba(GOLD, 0.02 * s4));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 1150);
  }
}

/** Figure-eight flight path for a printed bee around an orchard tree (written into `out`). */
const BEE_AT: [number, number, number] = [0, 0, 0];
function beePath(i: number, t: number, out: [number, number, number]) {
  const tree = ORCHARD[i % 3];
  const cx = tree[0];
  const cy = tree[1];
  const rr = tree[2];
  const ph = t * (0.7 + (i % 4) * 0.12) + i * 1.7;
  out[0] = cx + Math.sin(ph) * (rr + 14);
  out[1] = cy + Math.sin(ph * 2) * (rr * 0.45);
  out[2] = Math.atan2(Math.cos(ph * 2) * rr * 0.9, Math.cos(ph) * (rr + 14));
}

/** Precomputed once: the ambient layer runs every frame and must not allocate. */
const MEANDER_SPARK_PATH = smoothPath(MEANDER, 3);
const DRIFT_BOX: [number, number, number, number] = [90, 80, 490, 640];
const CELEBRATE_COLORS = [BLOSSOM, GOLD, MINT];

function paintAmbient({ ctx, t, level, reduced, energy }: SceneryContext) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  if (!reduced && s1 > 0.01) {
    const n = 3 + Math.round(5 * s2);
    for (let i = 0; i < n; i++) {
      beePath(i, t * (1 + energy * 0.6), BEE_AT);
      bee(ctx, BEE_AT[0], BEE_AT[1], 4.6, BEE_AT[2], 0.9 * s1);
    }
  }
  if (!reduced && s2 > 0.01) {
    // Sparkles of clean water rising up the meander.
    const path = MEANDER_SPARK_PATH;
    for (let i = 0; i < 10; i++) {
      const u = (t * 0.12 + i / 10) % 1;
      const k = Math.min(path.length - 2, Math.floor(u * (path.length - 1)));
      const p = path[k];
      glowDot(ctx, p[0] + Math.sin(t * 2 + i) * 8, p[1], 7, SKY, 0.5 * s2 * u);
    }
  }
  if (!reduced && level >= 3.6) drift(ctx, 28, 20, t, GOLD, DRIFT_BOX, 9, 1.8, 0.4 * stage(level, 3.6, 4));
}

function paintCelebrate({ ctx, t }: SceneryContext, p: number) {
  const sx = SCALES[0];
  const sy = SCALES[1];
  ctx.save();
  ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
  const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 440);
  g.addColorStop(0, rgba(GOLD, 0.8));
  g.addColorStop(1, rgba(GOLD, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 600, 1150);
  ctx.restore();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + t * 0.5;
    const d = 50 + p * 280;
    if (i % 3 === 0) bee(ctx, sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, 6, a + Math.PI / 2, 1 - p);
    else glowDot(ctx, sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, 9, CELEBRATE_COLORS[i % 3], 1 - p);
  }
}

// ================================================================ 3D attraction set

type V3 = [number, number, number];

function stdMat(kit: SetKit, color: string, o: { emissive?: string; ei?: number; rough?: number; metal?: number; transparent?: boolean; opacity?: number; map?: THREE.Texture; side?: THREE.Side } = {}) {
  const T = kit.THREE;
  return kit.track(new T.MeshStandardMaterial({
    color, emissive: o.emissive ?? '#000000', emissiveIntensity: o.ei ?? 0, roughness: o.rough ?? 0.75, metalness: o.metal ?? 0,
    transparent: o.transparent ?? false, opacity: o.opacity ?? 1, map: o.map ?? null, side: o.side ?? T.FrontSide,
  }));
}

function canvasTexture(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  const tex = kit.track(new kit.THREE.CanvasTexture(c));
  tex.colorSpace = kit.THREE.SRGBColorSpace;
  return tex;
}

/** Chalk "pretend prices" sandwich board: a heading and two short rows. */
function priceBoard(kit: SetKit, rows: [string, string][], pos: V3, rotY: number): THREE.Mesh {
  const T = kit.THREE;
  const tex = canvasTexture(kit, 512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#7a4e30';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d2a25';
    ctx.fillRect(18, 18, w - 36, h - 36);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = `800 52px ${SERIF}`;
    ctx.fillText('PRETEND PRICES', w / 2, 86);
    rows.forEach(([item, price], i) => {
      ctx.font = `700 40px ${SANS}`;
      ctx.fillStyle = IVORY;
      ctx.fillText(item, w / 2, 160 + i * 96);
      ctx.fillStyle = i ? MINT : GOLD;
      ctx.font = `800 40px ${SANS}`;
      ctx.fillText(price, w / 2, 204 + i * 96);
    });
  });
  const mat = kit.track(new T.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12, roughness: 0.85 }));
  const m = new T.Mesh(new T.BoxGeometry(0.72, 0.54, 0.04), [stdMat(kit, '#5a3a24'), stdMat(kit, '#5a3a24'), stdMat(kit, '#5a3a24'), stdMat(kit, '#5a3a24'), mat, mat]);
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(-0.35, rotY, 0);
  m.castShadow = true;
  return kit.add(m);
}

interface Stall {
  group: THREE.Group;
  setLit(v: number): void;
}

/** Market stall: striped half-barrel awning, posts, counter, crates of goods and a sign. */
function marketStall(kit: SetKit, pos: V3, rotY: number, stripe: [string, string], name: string, goods: { color: string; shape: 'round' | 'jug' }[]): Stall {
  const T = kit.THREE;
  const GY = kit.regions.groundY;
  const g = new T.Group();
  const W = 2.3;
  const H = 1.9;
  const D = 1.1;
  const postGeo = new T.CylinderGeometry(0.05, 0.05, H, 10);
  postGeo.translate(0, H / 2, 0);
  const posts = new T.InstancedMesh(postGeo, kit.mats.paintedMetal('#e3cfa8'), 4);
  const dummy = new T.Object3D();
  [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]].forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
  });
  posts.castShadow = true;
  g.add(posts);
  // Awning: a half-cylinder of stripes along X, glowing softly when the stall is stocked.
  const stripeTex = canvasTexture(kit, 256, 32, (ctx, w, h) => {
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = stripe[i % 2];
      ctx.fillRect((i * w) / 10, 0, w / 10 + 1, h);
    }
  });
  const awnMat = kit.track(new T.MeshStandardMaterial({ map: stripeTex, emissive: '#ffffff', emissiveMap: stripeTex, emissiveIntensity: 0.05, roughness: 0.7, side: T.DoubleSide }));
  const awnGeo = new T.CylinderGeometry(D * 0.62, D * 0.62, W + 0.3, 20, 1, true, 0, Math.PI);
  awnGeo.rotateZ(Math.PI / 2);
  const awning = new T.Mesh(awnGeo, awnMat);
  awning.position.set(0, H, 0.05);
  awning.scale.set(1, 0.55, 1);
  awning.castShadow = true;
  g.add(awning);
  const counter = new T.Mesh(new T.BoxGeometry(W, 0.82, 0.5), kit.mats.plastic('#7a4e30'));
  counter.position.set(0, 0.41, D / 2 - 0.25);
  counter.castShadow = true;
  counter.receiveShadow = true;
  const back = new T.Mesh(new T.BoxGeometry(W, H, 0.06), kit.mats.plastic('#2a1c3a'));
  back.position.set(0, H / 2, -D / 2);
  g.add(counter, back);
  // Crates on the counter, goods piled in them.
  const crateGeo = new T.BoxGeometry(0.5, 0.18, 0.36);
  const crates = new T.InstancedMesh(crateGeo, kit.mats.plastic('#b07a48'), 4);
  const crateSpots: V3[] = [[-0.78, 0.91, D / 2 - 0.25], [-0.2, 0.91, D / 2 - 0.25], [0.38, 0.91, D / 2 - 0.25], [0.84, 0.09, D / 2 + 0.3]];
  crateSpots.forEach(([x, y, z], i) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, (i - 1.5) * 0.08, 0);
    dummy.updateMatrix();
    crates.setMatrixAt(i, dummy.matrix);
  });
  crates.castShadow = true;
  g.add(crates);
  const jug = goods[0]?.shape === 'jug';
  const goodGeo = jug ? new T.CylinderGeometry(0.055, 0.07, 0.22, 12) : new T.SphereGeometry(0.075, 12, 10);
  const perCrate = jug ? 6 : 9;
  const count = crateSpots.length * perCrate;
  const goodMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', roughness: jug ? 0.15 : 0.45, metalness: 0, emissive: jug ? SKY : '#000000', emissiveIntensity: 0, transparent: jug, opacity: jug ? 0.85 : 1 }));
  const goodsMesh = new T.InstancedMesh(goodGeo, goodMat, count);
  const col = new T.Color();
  const r = kit.rand(Math.round(pos[0] * 31 + pos[2] * 7 + 99));
  let k = 0;
  crateSpots.forEach(([x, y, z], ci) => {
    for (let j = 0; j < perCrate; j++) {
      const gx = ((j % 3) - 1) * 0.14 + (r() - 0.5) * 0.03;
      const gz = (Math.floor(j / 3) - (jug ? 0.5 : 1)) * 0.11;
      dummy.position.set(x + gx, y + (jug ? 0.2 : 0.14 + (j % 2) * 0.02), z + gz);
      dummy.rotation.set(0, r() * TAU, 0);
      dummy.scale.setScalar(0.85 + r() * 0.3);
      dummy.updateMatrix();
      goodsMesh.setMatrixAt(k, dummy.matrix);
      goodsMesh.setColorAt(k, col.set(goods[(ci + j) % goods.length].color));
      k++;
    }
  });
  goodsMesh.castShadow = true;
  g.add(goodsMesh);
  const sign = kit.panel(name, [0, H + 0.62, D * 0.45], { w: 1.7, h: 0.42, bg: stripe[0], fg: '#1a1030' });
  g.add(sign);
  g.position.set(pos[0], GY, pos[2]);
  g.rotation.y = rotY;
  g.scale.setScalar(0.74);
  kit.add(g);
  return {
    group: g,
    setLit(v) {
      awnMat.emissiveIntensity = 0.02 + 0.12 * v;
      goodMat.emissiveIntensity = jug ? 0.04 + 0.3 * v : 0;
    },
  };
}

const marketSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  const GY = kit.regions.groundY;
  const R = kit.rand(2828);
  const dummy = new T.Object3D();
  const col = new T.Color();
  kit.sky('#2a2058', '#4a2a4c');

  // ---------------- Ground: a moonlit meadow with cobbled market streets beside the cabinet.
  const grassTex = canvasTexture(kit, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#22341f';
    ctx.fillRect(0, 0, w, h);
    const rr = rng(77);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = ['#2c4427', '#1b2b19', '#355230', '#283d24'][i % 4];
      ctx.fillRect(rr() * w, rr() * h, 2 + rr() * 3, 2 + rr() * 5);
    }
  });
  grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping;
  grassTex.repeat.set(14, 14);
  const ground = new T.Mesh(new T.CircleGeometry(36, 64).rotateX(-Math.PI / 2), kit.track(new T.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })));
  ground.position.y = GY;
  ground.receiveShadow = true;
  kit.add(ground);
  const cobbleTex = canvasTexture(kit, 256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(0, 0, w, h);
    const rr = rng(78);
    for (let y = 8, row = 0; y < h; y += 16, row++) {
      for (let x = 8 + (row % 2) * 10; x < w + 10; x += 20) {
        ctx.fillStyle = ['#544a5c', '#463e52', '#5e5262', '#3c3548'][Math.floor(rr() * 4)];
        ctx.beginPath();
        ctx.ellipse(x, y, 8.5, 6.2, 0, 0, TAU);
        ctx.fill();
      }
    }
  });
  cobbleTex.wrapS = cobbleTex.wrapT = T.RepeatWrapping;
  cobbleTex.repeat.set(1.5, 14);
  const streetMat = kit.track(new T.MeshStandardMaterial({ map: cobbleTex, roughness: 0.8 }));
  for (const side of [-1, 1]) {
    const street = new T.Mesh(new T.PlaneGeometry(1.5, 17).rotateX(-Math.PI / 2), streetMat);
    street.position.set(side * 4.45, GY + 0.004, -1.6);
    street.receiveShadow = true;
    kit.add(street);
  }

  // ---------------- Painted head backdrop: the watershed hills that feed the town's water.
  const far = kit.backdrop((ctx, w, h, level) => {
    const s2 = stage(level, 1.2, 2);
    const s4 = stage(level, 3.3, 4);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#120e2c');
    g.addColorStop(0.55, mix('#3a2850', '#6a3c5e', stage(level, 0, 4)));
    g.addColorStop(1, '#1a1426');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rr = rng(81);
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(255,247,231,${0.2 + rr() * 0.6})`;
      ctx.fillRect(rr() * w, rr() * h * 0.45, 2, 2);
    }
    // Rolling hills with forests: the upstream watershed.
    const hill = (base: number, amp: number, color: string, seed: number) => {
      const hr = rng(seed);
      const ph = [hr() * TAU, hr() * TAU, hr() * TAU];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x / 140 + ph[0]) * amp + Math.sin(x / 61 + ph[1]) * amp * 0.4);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 50; i++) {
        const x = hr() * w;
        const y = base + Math.sin(x / 140 + ph[0]) * amp + 6 + hr() * 30;
        ctx.fillStyle = mix('#13281a', '#2f6a38', s2 * hr());
        ctx.beginPath();
        ctx.arc(x, y, 8 + hr() * 9, 0, TAU);
        ctx.fill();
      }
    };
    hill(h * 0.5, 30, mix('#1e3326', '#2c5a34', s2), 82);
    hill(h * 0.62, 24, mix('#18291e', '#24492c', s2), 83);
    // The river from the hills down to the town (clearer once the wetland works).
    ctx.strokeStyle = mix('#4a5a5a', '#7fe0ff', s2);
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.5);
    ctx.bezierCurveTo(w * 0.45, h * 0.62, w * 0.62, h * 0.72, w * 0.5, h * 0.92);
    ctx.stroke();
    // Town roofs with windows that light up as the market wakes.
    for (let i = 0; i < 16; i++) {
      const x = w * (0.1 + i * 0.054) + (rr() - 0.5) * 12;
      const y = h * 0.8 + (rr() - 0.5) * 14;
      const bw = 26 + rr() * 18;
      ctx.fillStyle = '#2a1c2e';
      ctx.fillRect(x - bw / 2, y - 18, bw, 40);
      ctx.fillStyle = ['#8a3a3a', '#6a4a3a', '#4a3a5a'][i % 3];
      ctx.beginPath();
      ctx.moveTo(x - bw / 2 - 4, y - 18);
      ctx.lineTo(x, y - 36);
      ctx.lineTo(x + bw / 2 + 4, y - 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,214,140,${0.1 + 0.8 * stage(level, 0.3 + (i % 4) * 0.6, 1 + (i % 4) * 0.6)})`;
      ctx.fillRect(x - 5, y - 8, 10, 9);
    }
    if (s4 > 0.01) {
      const glow = ctx.createRadialGradient(w / 2, h * 0.75, 10, w / 2, h * 0.75, w * 0.5);
      glow.addColorStop(0, rgba(GOLD, 0.35 * s4));
      glow.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
  }, { width: 30, height: 12, z: -16 });
  const marquee = kit.neonSign('LIVING WORLD MARKET', [0, 1.45, -7.3], { height: 0.62, color: GOLD });
  marquee.rotation.x = -0.72;

  // ---------------- Lights (three in total).
  const spotL = kit.spot([-4.4, 6.6, 2.4], [-6.3, 0, -3.4], '#ffd59a', 14, 0.5);
  const spotR = kit.spot([4.4, 6.6, 2.4], [6.3, 0, -3.0], '#a8e8ff', 12, 0.5);
  const scaleGlow = kit.point([5.6, 1.9, -4.0], GOLD, 0, 6);

  // ================= LEFT: Fernbrook Orchard and the apiary (pollination).
  const trees: V3[] = [[-4.9, -5.0, 2.3], [-6.5, -4.2, 2.8], [-8.0, -5.4, 2.6], [-5.7, -6.7, 2.1], [-8.8, -2.4, 3.0], [-9.4, 1.8, 2.6]];
  const trunkGeo = new T.CylinderGeometry(0.1, 0.17, 1, 8);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new T.InstancedMesh(trunkGeo, stdMat(kit, '#5b3a24', { rough: 0.95 }), trees.length);
  const perTree = 5;
  const foliage = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), stdMat(kit, '#ffffff', { rough: 0.8 }), trees.length * perTree);
  const canopy: { c: THREE.Vector3; r: number }[] = [];
  trees.forEach(([x, z, h], i) => {
    dummy.position.set(x, GY, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(h * 0.9, h * 0.6, h * 0.9);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < perTree; k++) {
      const s = h * (0.17 + R() * 0.09);
      const c = new T.Vector3(x + (R() - 0.5) * h * 0.42, GY + h * (0.62 + R() * 0.3), z + (R() - 0.5) * h * 0.42);
      dummy.position.copy(c);
      dummy.scale.set(s, s * 0.82, s);
      dummy.rotation.set(R(), R(), R());
      dummy.updateMatrix();
      foliage.setMatrixAt(i * perTree + k, dummy.matrix);
      foliage.setColorAt(i * perTree + k, col.set(['#2f6b3f', '#3d7f44', '#2a5a38', '#4a8c48'][(i + k) % 4]));
      canopy.push({ c, r: s });
    }
  });
  trunks.castShadow = true;
  foliage.castShadow = true;
  kit.add(trunks);
  kit.add(foliage);
  // Blossoms dot the canopy; after pollination, fruit swells where flowers were.
  const blossomCount = kit.n(96);
  const blossomGeo = new T.SphereGeometry(0.055, 8, 6);
  const blossomMat = stdMat(kit, '#ffffff', { emissive: BLOSSOM, ei: 0.1, rough: 0.5 });
  const blossoms = new T.InstancedMesh(blossomGeo, blossomMat, blossomCount);
  const blossomSpots: THREE.Vector3[] = [];
  for (let i = 0; i < blossomCount; i++) {
    const cp = canopy[Math.floor(R() * canopy.length)];
    const dir = new T.Vector3(R() - 0.5, R() * 0.9 - 0.2, R() - 0.5).normalize();
    const p = cp.c.clone().addScaledVector(dir, cp.r * 0.95);
    blossomSpots.push(p);
    dummy.position.copy(p);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.8 + R() * 0.5);
    dummy.updateMatrix();
    blossoms.setMatrixAt(i, dummy.matrix);
    blossoms.setColorAt(i, col.set(i % 3 ? BLOSSOM : IVORY));
  }
  kit.add(blossoms);
  const fruitCount = kit.n(54);
  const fruitBase: { p: THREE.Vector3; s: number }[] = [];
  const fruit = new T.InstancedMesh(new T.SphereGeometry(0.12, 12, 10), kit.mats.plastic('#ffffff'), fruitCount);
  for (let i = 0; i < fruitCount; i++) {
    const cp = canopy[Math.floor(R() * canopy.length)];
    const dir = new T.Vector3(R() - 0.5, R() * 0.8 - 0.25, R() - 0.5).normalize();
    fruitBase.push({ p: cp.c.clone().addScaledVector(dir, cp.r * 0.92), s: 0.8 + R() * 0.45 });
    fruit.setColorAt(i, col.set([APPLE, '#ff8a3a', '#e8c040', APPLE][i % 4]));
  }
  fruit.castShadow = true;
  kit.add(fruit);
  let fruitShown = -1;
  const showFruit = (v: number) => {
    const q = Math.round(v * 20) / 20;
    if (q === fruitShown) return;
    fruitShown = q;
    fruitBase.forEach((f, i) => {
      dummy.position.copy(f.p);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0.001, q * f.s));
      dummy.updateMatrix();
      fruit.setMatrixAt(i, dummy.matrix);
    });
    fruit.instanceMatrix.needsUpdate = true;
  };
  showFruit(0);

  // Apiary: three stacked hives on stands (one instanced mesh of boxes).
  const hives: V3[] = [[-4.75, -2.85, 0.15], [-5.55, -2.25, -0.35], [-4.85, -1.45, 0.25]];
  const hiveBoxes = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), kit.mats.plastic('#ffffff'), hives.length * 6);
  const hiveColors = [IVORY, GOLD, MINT, CORAL, '#c9b8e8'];
  const entrances: THREE.Vector3[] = [];
  hives.forEach(([x, z, rot], i) => {
    const parts: [number, number, number, number, string][] = [
      [0, 0.12, 0.62, 0.24, '#6a4a30'],
      [0, 0.39, 0.56, 0.28, hiveColors[i % 5]],
      [0, 0.68, 0.56, 0.28, hiveColors[(i + 1) % 5]],
      [0, 0.97, 0.56, 0.28, hiveColors[(i + 2) % 5]],
      [0, 1.16, 0.66, 0.08, '#8a6a4a'],
      [0.29, 0.31, 0.02, 0.05, '#1a1010'],
    ];
    parts.forEach(([dx, y, w, hh, c], k) => {
      dummy.position.set(x + Math.cos(rot) * dx, GY + y, z - Math.sin(rot) * dx);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(k === 5 ? 0.04 : w, hh, k === 5 ? 0.3 : w * 0.82);
      dummy.updateMatrix();
      hiveBoxes.setMatrixAt(i * 6 + k, dummy.matrix);
      hiveBoxes.setColorAt(i * 6 + k, col.set(c));
    });
    entrances.push(new T.Vector3(x + Math.cos(rot) * 0.34, GY + 0.33, z - Math.sin(rot) * 0.34));
  });
  hiveBoxes.castShadow = true;
  kit.add(hiveBoxes);

  // Wildflower meadow around the hives.
  const flowerSpots: THREE.Vector3[] = [];
  const flowerH: number[] = [];
  while (flowerSpots.length < kit.n(90)) {
    const x = -4.2 - R() * 4.4;
    const z = -3.8 + R() * 7.6;
    if (x > -7.6 && z > -0.4 && z < 2.6) continue; // keep the fruit stall's footprint clear
    flowerH.push(0.18 + R() * 0.28);
    flowerSpots.push(new T.Vector3(x, GY, z));
  }
  const flowerCount = flowerSpots.length;
  const stemGeo = new T.CylinderGeometry(0.008, 0.01, 1, 4);
  stemGeo.translate(0, 0.5, 0);
  const stems = new T.InstancedMesh(stemGeo, stdMat(kit, '#4f8a3a'), flowerCount);
  const heads = new T.InstancedMesh(new T.SphereGeometry(0.05, 8, 6), stdMat(kit, '#ffffff', { emissive: '#ffffff', ei: 0.05, rough: 0.5 }), flowerCount);
  const headMat = heads.material as THREE.MeshStandardMaterial;
  for (let i = 0; i < flowerCount; i++) {
    const { x, z } = flowerSpots[i];
    const hgt = flowerH[i];
    dummy.position.set(x, GY, z);
    dummy.rotation.set((R() - 0.5) * 0.3, 0, (R() - 0.5) * 0.3);
    dummy.scale.set(1, hgt, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, GY + hgt, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.8 + R() * 0.6);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, col.set([BLOSSOM, GOLD, IVORY, '#c9b8ff', CORAL][i % 5]));
    flowerSpots[i].y = GY + hgt + 0.08;
  }
  kit.add(stems);
  kit.add(heads);

  // The pollinators: bees fly loops between hives, flowers and blossoms.
  const beeCount = kit.n(32);
  const stripeTex = canvasTexture(kit, 64, 64, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#1a120a' : '#ffc23a';
      ctx.fillRect(0, (i * h) / 8, w, h / 8 + 1);
    }
  });
  const beeGeo = new T.SphereGeometry(0.05, 12, 8);
  beeGeo.rotateZ(Math.PI / 2);
  beeGeo.scale(1.5, 1, 1);
  const beeMat = kit.track(new T.MeshStandardMaterial({ map: stripeTex, emissive: '#ffb02a', emissiveMap: stripeTex, emissiveIntensity: 0.4, roughness: 0.5 }));
  const beeMesh = new T.InstancedMesh(beeGeo, beeMat, beeCount);
  const wingGeo = new T.PlaneGeometry(0.07, 0.09);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0, 0, 0.05);
  const wingMat = kit.track(new T.MeshBasicMaterial({ color: '#eaf6ff', transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
  const wings = new T.InstancedMesh(wingGeo, wingMat, beeCount * 2);
  kit.add(beeMesh);
  kit.add(wings);
  const routes = Array.from({ length: beeCount }, (_, i) => {
    const from = entrances[i % entrances.length];
    const to = i % 3 === 0 ? blossomSpots[Math.floor(R() * blossomSpots.length)] : flowerSpots[Math.floor(R() * flowerSpots.length)] ?? from;
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const u = to.clone().sub(from);
    const len = Math.max(0.4, u.length());
    u.normalize();
    const v = new T.Vector3(-u.z, 0, u.x).normalize();
    return { mid, u, v, len, w: 0.25 + R() * 0.45, speed: 0.5 + R() * 0.5, ph: R() * TAU, lift: 0.15 + R() * 0.3 };
  });
  const parade = new T.Vector3(-6.3, 2.0, -1.4);
  let beeActive = 0;
  let paradeMix = 0;
  let beeBoost = 1;
  let beeClock = 0;
  const bp = new T.Vector3();
  const bt = new T.Vector3();
  const placeBees = (t: number) => {
    for (let i = 0; i < beeCount; i++) {
      const rt = routes[i];
      const th = t * rt.speed * beeBoost + rt.ph;
      // Commuter loop between hive and flower...
      bp.copy(rt.mid).addScaledVector(rt.u, Math.cos(th) * rt.len * 0.5).addScaledVector(rt.v, Math.sin(th) * rt.w);
      bp.y += Math.sin(th * 2) * 0.12 + rt.lift;
      bt.copy(rt.u).multiplyScalar(-Math.sin(th) * rt.len * 0.5).addScaledVector(rt.v, Math.cos(th) * rt.w);
      // ...blended into a grand figure-eight parade at the Wonderlight.
      if (paradeMix > 0.001) {
        const q = t * 0.55 + (i / beeCount) * TAU;
        const px = parade.x + Math.sin(q) * 2.0;
        const py = parade.y + Math.sin(q * 3) * 0.25 + (i % 3) * 0.12;
        const pz = parade.z + Math.sin(q * 2) * 1.6;
        bp.x += (px - bp.x) * paradeMix;
        bp.y += (py - bp.y) * paradeMix;
        bp.z += (pz - bp.z) * paradeMix;
        bt.x += (Math.cos(q) * 2 - bt.x) * paradeMix;
        bt.z += (Math.cos(q * 2) * 3.2 - bt.z) * paradeMix;
      }
      const yaw = Math.atan2(-bt.z, bt.x);
      const on = i < beeActive;
      dummy.position.copy(bp);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(on ? 1 : 0.0001);
      dummy.updateMatrix();
      beeMesh.setMatrixAt(i, dummy.matrix);
      const flap = Math.sin(t * 48 + i) * 0.7;
      for (let s = 0; s < 2; s++) {
        dummy.position.set(bp.x, bp.y + 0.03, bp.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(on ? 1 : 0.0001, 1, s ? -1 : 1);
        dummy.rotateX(s ? -flap : flap);
        dummy.updateMatrix();
        wings.setMatrixAt(i * 2 + s, dummy.matrix);
      }
    }
    beeMesh.instanceMatrix.needsUpdate = true;
    wings.instanceMatrix.needsUpdate = true;
  };
  placeBees(0);
  kit.animate((_t, dt) => {
    beeClock += dt;
    placeBees(beeClock);
  });

  const pollSign = kit.neonSign('POLLINATION', [-5.05, 2.3, -3.55], { height: 0.36, color: GOLD, rotY: 0.42 });
  pollSign.rotation.x = -0.6;
  kit.pole([-5.05, 0, -3.62], 2.1);

  const fruitStall = marketStall(kit, [-5.75, 0, 0.75], 0.5, [CORAL, '#e8d8c0'], 'FRUIT STALL', [
    { color: APPLE, shape: 'round' }, { color: '#ff9a3a', shape: 'round' }, { color: '#e8c040', shape: 'round' },
    { color: BERRY, shape: 'round' }, { color: '#9BD46A', shape: 'round' },
  ]);
  const fruitBoard = priceBoard(kit, [['apples: 3 coins', '(pretend)'], ["bees' pollen work", 'no price tag']], [-4.7, GY + 0.45, 2.75], 0.5);

  // ================= RIGHT: the wetland that cleans the water, and the Water Stall.
  const pondPos: V3 = [6.45, GY + 0.05, -2.25];
  const PW = 1.52;
  const PD = 1.02;
  const pond = kit.water(pondPos, PW * 1.92, PD * 1.92, '#4a5a48');
  const pondMat = pond.material as THREE.MeshPhysicalMaterial;
  const murky = new T.Color('#5a5a3c');
  const clear = new T.Color('#3fb8e0');
  const bank = new T.Mesh(new T.TorusGeometry(1, 0.13, 8, 48), stdMat(kit, '#4a3a26', { rough: 0.95 }));
  bank.rotation.x = Math.PI / 2;
  bank.scale.set(PW, PD, 1);
  bank.position.set(pondPos[0], GY + 0.03, pondPos[2]);
  kit.add(bank);
  const reedCount = kit.n(80);
  const reedGeo = new T.CylinderGeometry(0.012, 0.02, 1, 5);
  reedGeo.translate(0, 0.5, 0);
  const reeds = new T.InstancedMesh(reedGeo, stdMat(kit, '#5f8f44', { rough: 0.8 }), reedCount);
  const tails = new T.InstancedMesh(new T.CapsuleGeometry(0.035, 0.12, 3, 6), stdMat(kit, '#6a4428'), Math.ceil(reedCount / 3));
  for (let i = 0; i < reedCount; i++) {
    const a = R() * TAU;
    const rr = 1.0 + R() * 0.32;
    const x = pondPos[0] + Math.cos(a) * PW * rr;
    const z = pondPos[2] + Math.sin(a) * PD * rr;
    // Reeds on the far bank stay short so they don't hide the Market Scales behind the pond.
    const h = (Math.sin(a) < -0.2 ? 0.28 : 0.45) + R() * (Math.sin(a) < -0.2 ? 0.3 : 0.6);
    dummy.position.set(x, GY, z);
    dummy.rotation.set((R() - 0.5) * 0.25, 0, (R() - 0.5) * 0.25);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);
    if (i % 3 === 0) {
      dummy.position.set(x, GY + h - 0.02, z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      tails.setMatrixAt(i / 3, dummy.matrix);
    }
  }
  reeds.castShadow = true;
  kit.add(reeds);
  kit.add(tails);
  // Lily pads and a few flowers.
  const pads = new T.InstancedMesh(new T.CylinderGeometry(0.16, 0.16, 0.015, 14, 1, false, 0.3, TAU - 0.5), stdMat(kit, '#3f7a3a'), 9);
  const lilies = new T.InstancedMesh(new T.SphereGeometry(0.05, 8, 6), stdMat(kit, '#ffd0e0', { emissive: BLOSSOM, ei: 0.1 }), 4);
  const lilyMat = lilies.material as THREE.MeshStandardMaterial;
  for (let i = 0; i < 9; i++) {
    const a = R() * TAU;
    const d = 0.3 + R() * 0.6;
    dummy.position.set(pondPos[0] + Math.cos(a) * PW * 0.85 * d, GY + 0.07, pondPos[2] + Math.sin(a) * PD * 0.8 * d);
    dummy.rotation.set(0, R() * TAU, 0);
    dummy.scale.setScalar(0.7 + R() * 0.6);
    dummy.updateMatrix();
    pads.setMatrixAt(i, dummy.matrix);
    if (i < 4) {
      dummy.position.y += 0.04;
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      lilies.setMatrixAt(i, dummy.matrix);
    }
  }
  kit.add(pads);
  kit.add(lilies);
  // Ducks paddle in slow circles.
  const duckBody = new T.InstancedMesh(new T.SphereGeometry(0.12, 12, 10), kit.mats.plastic('#e8dcc4'), 3);
  const duckHead = new T.InstancedMesh(new T.SphereGeometry(0.065, 10, 8), kit.mats.plastic('#2f6a4a'), 3);
  kit.add(duckBody);
  kit.add(duckHead);
  const placeDucks = (t: number) => {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.18 + (i * TAU) / 3;
      const x = pondPos[0] + Math.cos(a) * PW * 0.55;
      const z = pondPos[2] + Math.sin(a) * PD * 0.45;
      const yaw = -a - Math.PI / 2;
      dummy.position.set(x, GY + 0.1, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1.4, 0.8, 1);
      dummy.updateMatrix();
      duckBody.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + Math.cos(yaw) * 0.14, GY + 0.22, z - Math.sin(yaw) * 0.14);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      duckHead.setMatrixAt(i, dummy.matrix);
    }
    duckBody.instanceMatrix.needsUpdate = true;
    duckHead.instanceMatrix.needsUpdate = true;
  };
  placeDucks(0);
  let duckClock = 0;
  kit.animate((_t, dt) => {
    duckClock += dt;
    placeDucks(duckClock);
  });
  // A clear stream runs from the wetland down to the Water Stall's pump.
  const streamCurve = new T.CatmullRomCurve3([
    new T.Vector3(5.55, 0, -1.3), new T.Vector3(5.0, 0, -0.6), new T.Vector3(5.3, 0, 0.15), new T.Vector3(5.15, 0, 0.75),
  ]);
  const streamGeo = new T.TubeGeometry(streamCurve, 40, 0.16, 6, false);
  streamGeo.scale(1, 0.12, 1);
  const streamMat = stdMat(kit, '#4a6a6a', { emissive: SKY, ei: 0.05, rough: 0.15, metal: 0.1 });
  const stream = new T.Mesh(streamGeo, streamMat);
  stream.position.y = GY + 0.02;
  kit.add(stream);
  const waterSparks = kit.motes({ x0: 4.8, x1: 8.0, y0: -0.3, y1: 1.4, z0: -3.6, z1: -1.1 }, 40, SKY, { speed: 0.12, size: 0.09 });

  const waterSign = kit.neonSign('CLEAN WATER', [4.7, 1.95, -0.4], { height: 0.36, color: SKY, rotY: -0.42 });
  waterSign.rotation.x = -0.6;
  kit.pole([4.7, 0, -0.47], 1.75);

  const waterStall = marketStall(kit, [5.8, 0, 0.95], -0.5, ['#4fbfae', '#e8d8c0'], 'WATER STALL', [
    { color: '#9fe6ff', shape: 'jug' }, { color: '#bff0ff', shape: 'jug' }, { color: '#7fd0f0', shape: 'jug' },
  ]);
  const waterBoard = priceBoard(kit, [['jug of water: 1 coin', '(pretend)'], ['wetland filtering', 'no price tag']], [4.55, GY + 0.45, 2.45], -0.5);

  // ================= FRONT RIGHT: the Town Council gazebo, where every stakeholder speaks.
  const gaz = new T.Group();
  gaz.position.set(5.55, GY, 3.3);
  kit.add(gaz);
  const gazFloor = new T.Mesh(new T.CylinderGeometry(0.78, 0.82, 0.1, 8), kit.mats.plastic('#7a6a8a'));
  gazFloor.position.y = 0.05;
  gazFloor.receiveShadow = true;
  const gazPosts = new T.InstancedMesh(new T.CylinderGeometry(0.035, 0.035, 1.15, 8), kit.mats.paintedMetal('#e3cfa8'), 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    dummy.position.set(Math.cos(a) * 0.68, 0.67, Math.sin(a) * 0.68);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    gazPosts.setMatrixAt(i, dummy.matrix);
  }
  const gazRoofMat = stdMat(kit, '#5a3a6a', { emissive: GOLD, ei: 0.02, rough: 0.6 });
  const gazRoof = new T.Mesh(new T.ConeGeometry(0.86, 0.55, 6), gazRoofMat);
  gazRoof.position.y = 1.52;
  gazRoof.rotation.y = 0.26;
  gazRoof.castShadow = true;
  gaz.add(gazFloor, gazPosts, gazRoof);
  const councilTex = canvasTexture(kit, 1024, 192, (ctx, w, h) => {
    ctx.fillStyle = '#2a1c3a';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 36);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = GOLD;
    ctx.font = `800 64px ${SERIF}`;
    ctx.fillText('TOWN COUNCIL', w / 2, 62);
    ctx.font = `800 52px ${SANS}`;
    STAKEHOLDERS.forEach((t, i) => {
      ctx.fillStyle = [GOLD, IVORY, SKY, CORAL][i];
      ctx.fillText(t, w * (0.14 + i * 0.24), 142);
    });
  });
  const councilMat = kit.track(new T.MeshStandardMaterial({ map: councilTex, emissive: '#ffffff', emissiveMap: councilTex, emissiveIntensity: 0.1, roughness: 0.6 }));
  const councilSign = new T.Mesh(new T.PlaneGeometry(1.7, 0.32), councilMat);
  councilSign.position.set(0, 0.42, 0.98);
  councilSign.rotation.x = -0.7;
  gaz.add(councilSign);
  gaz.rotation.y = -0.35;

  // ================= FRONT LEFT: the squash patch (a crop that needs its pollinators).
  const squashN = kit.n(16);
  const squash = new T.InstancedMesh(new T.SphereGeometry(0.13, 14, 10), kit.mats.plastic('#ffffff'), squashN);
  const squashLeaves = new T.InstancedMesh(new T.CircleGeometry(0.17, 10).rotateX(-Math.PI / 2), stdMat(kit, '#3f7a3a', { side: T.DoubleSide }), squashN * 2);
  for (let i = 0; i < squashN; i++) {
    const a = R() * TAU;
    const d = Math.sqrt(R()) * 0.95;
    const x = -5.3 + Math.cos(a) * d * 1.2;
    const z = 3.55 + Math.sin(a) * d * 0.8;
    dummy.position.set(x, GY + 0.08, z);
    dummy.rotation.set(0, R() * TAU, 0);
    dummy.scale.set(1.25, 0.75, 1);
    dummy.updateMatrix();
    squash.setMatrixAt(i, dummy.matrix);
    squash.setColorAt(i, col.set(['#ff9a2e', '#f2c040', '#e8742a', '#d8d070'][i % 4]));
    for (let k = 0; k < 2; k++) {
      dummy.position.set(x + (R() - 0.5) * 0.4, GY + 0.04 + k * 0.03, z + (R() - 0.5) * 0.4);
      dummy.rotation.set((R() - 0.5) * 0.3, R() * TAU, (R() - 0.5) * 0.3);
      dummy.scale.setScalar(0.8 + R() * 0.5);
      dummy.updateMatrix();
      squashLeaves.setMatrixAt(i * 2 + k, dummy.matrix);
    }
  }
  squash.castShadow = true;
  kit.add(squashLeaves);
  kit.add(squash);
  const squashBase: THREE.Matrix4[] = [];
  for (let i = 0; i < squashN; i++) {
    const m = new T.Matrix4();
    squash.getMatrixAt(i, m);
    squashBase.push(m);
  }
  const grown = new T.Matrix4();
  const shrink = new T.Matrix4();
  let squashShown = -1;
  const showSquash = (v: number) => {
    const q = Math.round(v * 20) / 20;
    if (q === squashShown) return;
    squashShown = q;
    const k = 0.3 + 0.7 * q;
    squashBase.forEach((m, i) => {
      grown.copy(m);
      shrink.makeScale(k, k, k);
      // scale about the fruit's own centre
      const e = m.elements;
      shrink.setPosition(e[12] * (1 - k), e[13] * (1 - k), e[14] * (1 - k));
      grown.premultiply(shrink);
      squash.setMatrixAt(i, grown);
    });
    squash.instanceMatrix.needsUpdate = true;
  };
  showSquash(0);

  // ================= TOP RIGHT: the giant Market Scales, PRICE against VALUES.
  const scaleG = new T.Group();
  scaleG.position.set(6.2, GY, -4.5);
  scaleG.rotation.y = -0.18;
  scaleG.scale.setScalar(0.78);
  kit.add(scaleG);
  const plinth = new T.Mesh(new T.BoxGeometry(1.6, 0.36, 0.9), kit.mats.plastic('#4a3a5a'));
  plinth.position.y = 0.18;
  plinth.castShadow = true;
  const post = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 2.3, 12), kit.mats.brass());
  post.position.y = 0.36 + 1.15;
  post.castShadow = true;
  const crown = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), kit.mats.brass());
  crown.position.y = 2.72;
  scaleG.add(plinth, post, crown);
  const beam = new T.Group();
  beam.position.y = 2.62;
  const beamBar = new T.Mesh(new T.BoxGeometry(2.7, 0.07, 0.09), kit.mats.brass());
  beam.add(beamBar);
  scaleG.add(beam);
  const HALF = 1.28;
  const makePan = () => {
    const pan = new T.Group();
    const rod = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.95, 6), kit.mats.brass());
    rod.position.y = -0.47;
    const bowl = new T.Mesh(new T.SphereGeometry(0.4, 24, 10, 0, TAU, Math.PI / 2, Math.PI / 2), kit.mats.brass());
    bowl.position.y = -0.9;
    bowl.scale.y = 0.4;
    pan.add(rod, bowl);
    scaleG.add(pan);
    return pan;
  };
  const panL = makePan();
  const panR = makePan();
  // PRICE pan: a stack of (pretend) coins.
  const coins = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.12, 0.035, 18), kit.mats.brass(), 9);
  for (let i = 0; i < 9; i++) {
    dummy.position.set(((i % 3) - 1) * 0.17, -0.86 + Math.floor(i / 3) * 0.04, (i % 2) * 0.06 - 0.03);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    coins.setMatrixAt(i, dummy.matrix);
  }
  panL.add(coins);
  // VALUES pan: glowing tokens for wildlife, clean water, beauty, recreation and discovery.
  const valueColors = [LEAF, SKY, BLOSSOM, GOLD, MINT];
  // Unlit so each token glows in its own colour (a white emissive washed them into one blob).
  const valueMat = kit.track(new T.MeshBasicMaterial({ color: '#ffffff' }));
  const valueOrbs = new T.InstancedMesh(new T.SphereGeometry(0.1, 16, 12), valueMat, valueColors.length);
  valueColors.forEach((c, i) => valueOrbs.setColorAt(i, col.set(c)));
  panR.add(valueOrbs);
  let valueShown = -1;
  const showValues = (v: number) => {
    const q = Math.round(v * 20) / 20;
    if (q === valueShown) return;
    valueShown = q;
    valueColors.forEach((_, i) => {
      const a = (i / valueColors.length) * TAU;
      dummy.position.set(Math.cos(a) * 0.17, -0.8 + (i === 4 ? 0.12 : 0), Math.sin(a) * 0.12);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0.001, 0.25 + 0.75 * q));
      dummy.updateMatrix();
      valueOrbs.setMatrixAt(i, dummy.matrix);
    });
    valueOrbs.instanceMatrix.needsUpdate = true;
  };
  showValues(0);
  // Name plates hang below the pans, above the wetland reeds that stand between them and the player.
  const priceSign = kit.neonSign('PRICE', [0, 0, 0], { height: 0.3, color: GOLD, backing: false });
  const valuesSign = kit.neonSign('VALUES', [0, 0, 0], { height: 0.3, color: MINT, backing: false });
  scaleG.add(priceSign, valuesSign);
  priceSign.position.set(-HALF, 1.05, 0.5);
  valuesSign.position.set(HALF, 1.05, 0.5);
  priceSign.rotation.x = -0.5;
  valuesSign.rotation.x = -0.5;
  let tiltBase = 0.24;
  let tiltNow = 0.24;
  let swayClock = 0;
  const setTilt = (a: number) => {
    beam.rotation.z = a;
    panL.position.set(-HALF * Math.cos(a), 2.62 - HALF * Math.sin(a), 0);
    panR.position.set(HALF * Math.cos(a), 2.62 + HALF * Math.sin(a), 0);
  };
  setTilt(tiltBase);
  kit.animate((_t, dt) => {
    swayClock += dt;
    tiltNow += (tiltBase - tiltNow) * Math.min(1, dt * 1.5);
    setTilt(tiltNow + Math.sin(swayClock * 0.9) * 0.025);
  });

  // ================= Strings of lights, bunting and lanterns over the market streets.
  kit.pole([-9, 0, -7], 4.6);
  kit.pole([9, 0, -7], 4.6);
  kit.pole([-8.6, 0, -1.4], 3.4);
  kit.pole([8.6, 0, -1.4], 3.4);
  kit.pole([-4.4, 0, 4.3], 2.9);
  kit.pole([4.4, 0, 4.3], 2.9);
  const lightsHead = kit.stringLights([-9, 4.4, -7], [9, 4.4, -7], 0.7, kit.n(28), [GOLD, CORAL, MINT]);
  const lightsL = kit.stringLights([-8.6, 3.2, -1.4], [-4.4, 2.7, 4.3], 0.4, kit.n(16), [GOLD, BLOSSOM, MINT]);
  const lightsR = kit.stringLights([8.6, 3.2, -1.4], [4.4, 2.7, 4.3], 0.4, kit.n(16), [GOLD, SKY, CORAL]);
  const flagGeo = new T.BufferGeometry();
  flagGeo.setAttribute('position', new T.Float32BufferAttribute([-0.11, 0, 0, 0.11, 0, 0, 0, -0.24, 0], 3));
  flagGeo.computeVertexNormals();
  const flagMat = stdMat(kit, '#ffffff', { emissive: '#ffffff', ei: 0.04, rough: 0.6, side: T.DoubleSide });
  const flagsPer = kit.n(14);
  const flags = new T.InstancedMesh(flagGeo, flagMat, flagsPer * 2);
  const flagColors = [CORAL, GOLD, MINT, IVORY, BLOSSOM, SKY];
  for (let s = 0; s < 2; s++) {
    const sx = s ? 1 : -1;
    const a = new T.Vector3(sx * 8.6, 2.9, -1.4);
    const b = new T.Vector3(sx * 4.4, 2.42, 4.3);
    for (let i = 0; i < flagsPer; i++) {
      const u = (i + 0.5) / flagsPer;
      dummy.position.copy(a).lerp(b, u);
      dummy.position.y -= Math.sin(u * Math.PI) * 0.36;
      dummy.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      flags.setMatrixAt(s * flagsPer + i, dummy.matrix);
      flags.setColorAt(s * flagsPer + i, col.set(flagColors[(i + s * 2) % flagColors.length]));
    }
  }
  kit.add(flags);
  // Wonderlight: paper sky lanterns drift up from both market streets.
  const skyCount = kit.n(28);
  const skyMat = stdMat(kit, '#3a2412', { emissive: '#ffb04a', ei: 0, rough: 0.6 });
  const skyLan = new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.085, 0.22, 10), skyMat, skyCount);
  // Right-side lanterns rise in front of the water stall, not across the Market Scales corner.
  const skyBase = Array.from({ length: skyCount }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (4.2 + R() * 3.0), z: i % 2 ? -0.4 + R() * 3.0 : -4.6 + R() * 6.2, ph: R(), sp: 0.07 + R() * 0.05 }));
  kit.add(skyLan);
  let skyLit = 0;
  let skyClock = 0;
  let skyHidden = false;
  const placeSky = (t: number) => {
    for (let i = 0; i < skyCount; i++) {
      const b = skyBase[i];
      const u = (t * b.sp + b.ph) % 1;
      const fade = u < 0.1 ? u / 0.1 : u > 0.85 ? (1 - u) / 0.15 : 1;
      dummy.position.set(b.x + Math.sin(t * 0.6 + i) * 0.15, GY + 0.4 + u * 4.0, b.z + Math.cos(t * 0.5 + i) * 0.1);
      dummy.rotation.set(0, 0, Math.sin(t + i) * 0.1);
      dummy.scale.setScalar(skyLit > 0.01 ? Math.max(0.001, fade) : 0.0001);
      dummy.updateMatrix();
      skyLan.setMatrixAt(i, dummy.matrix);
    }
    skyLan.instanceMatrix.needsUpdate = true;
  };
  placeSky(0);
  kit.animate((_t, dt) => {
    if (skyLit <= 0.01) return;
    skyClock += dt;
    placeSky(skyClock);
  });
  const pollen = kit.motes({ x0: -9.5, x1: -4, y0: 0, y1: 3.2, z0: -7, z1: 3.5 }, 70, GOLD, { speed: 0.1, size: 0.08 });
  // Wonderlight fireworks burst over both market streets (never over the playfield).
  const fwL = kit.fireworks({ x0: -7.8, x1: -6.0, y0: 2.2, y1: 3.0, z: -1.2 }, [GOLD, CORAL, BLOSSOM]);
  const fwR = kit.fireworks({ x0: 6.2, x1: 7.9, y0: 2.2, y1: 3.0, z: -0.4 }, [MINT, SKY, GOLD]);
  let celebrating = 0;
  let beesPlaced = -1;

  return {
    update(_t, _dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.5, 4);
      far.repaint(level);
      marquee.setLit(0.12 + 0.88 * s2);
      pollSign.setLit(0.2 + 0.8 * s1);
      waterSign.setLit(0.2 + 0.8 * s2);
      lightsHead.setLit(0.2 + 0.8 * s2);
      lightsL.setLit(0.3 + 0.7 * s0);
      lightsR.setLit(0.3 + 0.7 * s0);
      flagMat.emissiveIntensity = 0.04 + 0.2 * s1;
      // Observe wakes the meadow; relate stocks the stalls (fruit swells, water runs clear).
      headMat.emissiveIntensity = 0.04 + 0.4 * s1;
      blossomMat.emissiveIntensity = 0.12 + 0.6 * s1 * (1 - 0.5 * s2);
      showFruit(s2);
      fruitStall.setLit(0.15 + 0.85 * s2);
      waterStall.setLit(0.15 + 0.85 * s2);
      (fruitBoard.material as THREE.MeshStandardMaterial[])[4].emissiveIntensity = 0.12 + 0.3 * s1;
      (waterBoard.material as THREE.MeshStandardMaterial[])[4].emissiveIntensity = 0.12 + 0.3 * s1;
      pondMat.color.lerpColors(murky, clear, s2);
      streamMat.color.lerpColors(murky, clear, s2);
      streamMat.emissiveIntensity = 0.05 + 0.5 * s2;
      lilyMat.emissiveIntensity = 0.1 + 0.6 * s2;
      waterSparks.setLit(0.1 + 0.8 * s2);
      beeActive = Math.round(beeCount * (0.18 + 0.32 * s1 + 0.5 * s2));
      beeBoost = 1 + energy * 0.7 + celebrating * 0.8;
      beeMat.emissiveIntensity = 0.35 + 0.6 * s1 + 0.6 * s4;
      paradeMix = Math.max(s4 * 0.65, celebrating * 0.5);
      // Apply: the council weighs both pans, and the beam comes level.
      tiltBase = 0.24 * (1 - s3);
      showValues(s3);
      valueMat.color.setScalar(0.35 + 0.85 * s3 + 0.5 * s4);
      priceSign.setLit(0.3 + 0.7 * s3);
      gazRoofMat.emissiveIntensity = 0.02 + 0.22 * s3;
      councilMat.emissiveIntensity = 0.12 + 0.5 * s3;
      valuesSign.setLit(0.15 + 0.85 * s3);
      if (scaleGlow) scaleGlow.intensity = 0.4 + 3.6 * s3 + 3 * celebrating;
      if (spotL) spotL.intensity = 10 + 12 * s1 + 6 * s4;
      if (spotR) spotR.intensity = 9 + 12 * s2 + 6 * s4;
      pollen.setLit(0.15 + 0.5 * s1 + 0.35 * s4);
      fwL.setLit(Math.max(s4, celebrating));
      fwR.setLit(Math.max(s4, celebrating));
      showSquash(s2);
      skyLit = Math.max(s4, celebrating);
      skyMat.emissiveIntensity = 2.6 * skyLit;
      if (skyLit <= 0.01 && !skyHidden) {
        skyHidden = true;
        placeSky(0);
      } else if (skyLit > 0.01) {
        skyHidden = false;
        if (kit.reducedMotion) placeSky(0);
      }
      // Reduced motion skips the sway animation, so level the beam directly.
      if (kit.reducedMotion && tiltNow !== tiltBase) {
        tiltNow = tiltBase;
        setTilt(tiltNow);
      }
      if (kit.reducedMotion && beesPlaced !== beeActive) {
        beesPlaced = beeActive;
        placeBees(0);
      }
      celebrating *= 0.9;
    },
    celebrate(p) {
      celebrating = Math.sin(p * Math.PI);
    },
  };
};

// ================================================================ dollhouse room

const marketRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const dummy = new T.Object3D();
  const col = new T.Color();
  const floor = new T.Mesh(new T.CircleGeometry(0.88, 32), stdMat(kit, '#5a4a5e', { rough: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.006, -0.02);
  kit.add(floor);
  // A tiny fruit stall against the back wall.
  const back = new T.Mesh(new T.BoxGeometry(0.9, 0.8, 0.04), stdMat(kit, '#2a1c3a'));
  back.position.set(-0.45, 0.4, -0.78);
  const counter = new T.Mesh(new T.BoxGeometry(0.86, 0.32, 0.24), stdMat(kit, '#7a4e30'));
  counter.position.set(-0.45, 0.16, -0.58);
  const stripeTex = canvasTexture(kit, 128, 16, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? IVORY : CORAL;
      ctx.fillRect((i * w) / 8, 0, w / 8 + 1, h);
    }
  });
  const awnMat = kit.track(new T.MeshStandardMaterial({ map: stripeTex, emissive: '#ffffff', emissiveMap: stripeTex, emissiveIntensity: 0.05, side: T.DoubleSide }));
  const awnGeo = new T.CylinderGeometry(0.2, 0.2, 0.96, 14, 1, true, 0, Math.PI);
  awnGeo.rotateZ(Math.PI / 2);
  const awning = new T.Mesh(awnGeo, awnMat);
  awning.position.set(-0.45, 0.8, -0.6);
  awning.scale.set(1, 0.5, 1);
  for (const m of [back, counter, awning]) kit.add(m);
  const goods = new T.InstancedMesh(new T.SphereGeometry(0.04, 10, 8), kit.mats.plastic('#ffffff'), 12);
  for (let i = 0; i < 12; i++) {
    dummy.position.set(-0.78 + (i % 6) * 0.12, 0.35 + Math.floor(i / 6) * 0.04, -0.6 + Math.floor(i / 6) * 0.06);
    dummy.updateMatrix();
    goods.setMatrixAt(i, dummy.matrix);
    goods.setColorAt(i, col.set([APPLE, HONEY, BERRY, '#9BD46A'][i % 4]));
  }
  kit.add(goods);
  // An apple tree in fruit.
  const trunk = new T.Mesh(new T.CylinderGeometry(0.04, 0.06, 0.6, 8), stdMat(kit, '#5b3a24'));
  trunk.position.set(0.55, 0.3, -0.5);
  const leafMat = stdMat(kit, '#3d7f44', { emissive: '#4f9a4a', ei: 0.05 });
  const crown1 = new T.Mesh(new T.IcosahedronGeometry(0.24, 1), leafMat);
  crown1.position.set(0.55, 0.75, -0.5);
  const crown2 = new T.Mesh(new T.IcosahedronGeometry(0.17, 1), leafMat);
  crown2.position.set(0.72, 0.64, -0.42);
  for (const m of [trunk, crown1, crown2]) kit.add(m);
  const apples = new T.InstancedMesh(new T.SphereGeometry(0.035, 8, 6), stdMat(kit, APPLE, { emissive: APPLE, ei: 0.05 }), 8);
  const appleMat = apples.material as THREE.MeshStandardMaterial;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    dummy.position.set(0.55 + Math.cos(a) * 0.22, 0.66 + Math.sin(i * 1.7) * 0.08, -0.5 + Math.sin(a) * 0.2);
    dummy.updateMatrix();
    apples.setMatrixAt(i, dummy.matrix);
  }
  kit.add(apples);
  // Beehive at the front left, pond with reeds at the front right.
  const hive = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), kit.mats.plastic('#ffffff'), 4);
  [[0.08, 0.16, GOLD], [0.24, 0.12, IVORY], [0.36, 0.12, MINT], [0.44, 0.04, '#8a6a4a']].forEach(([y, h, c], i) => {
    dummy.position.set(-0.86, y as number, 0.42);
    dummy.scale.set(0.2, h as number, 0.17);
    dummy.updateMatrix();
    hive.setMatrixAt(i, dummy.matrix);
    hive.setColorAt(i, col.set(c as string));
  });
  kit.add(hive);
  // A stone basin of clean water (the wetland's work, in miniature).
  const basin = new T.Mesh(new T.CylinderGeometry(0.24, 0.27, 0.14, 20), kit.mats.plastic('#8a8496'));
  basin.position.set(0.55, 0.07, 0.3);
  const pondMat = stdMat(kit, '#3fb8e0', { emissive: SKY, ei: 0.05, rough: 0.1 });
  const pond = new T.Mesh(new T.CircleGeometry(0.21, 20), pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(0.55, 0.145, 0.3);
  kit.add(basin);
  kit.add(pond);
  const reeds = new T.InstancedMesh(new T.CylinderGeometry(0.006, 0.01, 0.3, 4), stdMat(kit, '#5f8f44'), 10);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI + Math.PI;
    dummy.position.set(0.55 + Math.cos(a) * 0.34, 0.15, 0.3 + Math.sin(a) * 0.3);
    dummy.scale.set(1, 0.7 + (i % 3) * 0.2, 1);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);
  }
  kit.add(reeds);
  // A little balance: price and values, level at last.
  const pole = new T.Mesh(new T.CylinderGeometry(0.012, 0.016, 0.42, 8), kit.mats.brass());
  pole.position.set(0.02, 0.21, 0.05);
  const beam = new T.Mesh(new T.BoxGeometry(0.4, 0.016, 0.02), kit.mats.brass());
  beam.position.set(0.02, 0.42, 0.05);
  kit.add(pole);
  kit.add(beam);
  const pans = new T.InstancedMesh(new T.CylinderGeometry(0.06, 0.035, 0.03, 12), kit.mats.brass(), 2);
  for (let i = 0; i < 2; i++) {
    dummy.position.set(0.02 + (i ? 0.18 : -0.18), 0.33, 0.05);
    dummy.updateMatrix();
    pans.setMatrixAt(i, dummy.matrix);
  }
  kit.add(pans);
  const sign = kit.neonSign('MARKET', [-0.45, 1.12, -0.82], { height: 0.2, color: GOLD });
  const bees = new T.InstancedMesh(new T.SphereGeometry(0.022, 8, 6), stdMat(kit, '#ffc23a', { emissive: '#ffb02a', ei: 0.4 }), 6);
  const beeMat = bees.material as THREE.MeshStandardMaterial;
  kit.add(bees);
  const placeBees = (t: number) => {
    for (let i = 0; i < 6; i++) {
      const a = t * (0.9 + i * 0.1) + i;
      dummy.position.set(0.0 + Math.sin(a) * 0.62, 0.55 + Math.sin(a * 2) * 0.12 + (i % 2) * 0.1, -0.15 + Math.sin(a * 2) * 0.3);
      dummy.updateMatrix();
      bees.setMatrixAt(i, dummy.matrix);
    }
    bees.instanceMatrix.needsUpdate = true;
  };
  placeBees(0);
  return {
    update(t, lit) {
      awnMat.emissiveIntensity = 0.05 + 0.5 * lit;
      leafMat.emissiveIntensity = 0.05 + 0.3 * lit;
      appleMat.emissiveIntensity = 0.05 + 0.6 * lit;
      pondMat.emissiveIntensity = 0.05 + 0.5 * lit;
      beeMat.emissiveIntensity = 0.3 + 1.2 * lit;
      sign.setLit(lit);
      if (!kit.reducedMotion) placeBees(t);
    },
  };
};

// ================================================================ the table

export const L28: TableDef = {
  lessonId: 'L28',
  signature: 'A Market Loop ring road whose Bee Spinner stocks the stalls, and Market Scales that weigh PRICE against VALUES',
  ballRole: 'The Wonderball is a game token, not a bee or a drop of water: real bees fly flower to flower, and real water seeps slowly through soil and wetland mud.',
  theme: {
    bg: ['#2a1d3e', '#1a1428'],
    rail: '#e3cfa8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: BLOSSOM,
    bumperRing: '#3a5a2a',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(113,227,207,0.16)',
    trail: GOLD,
  },
  lines: {
    intro: "Welcome to the Living World Market, where every stall is stocked by workers who never send a bill. Let's meet the bees, the wetland and the soil behind the shelves!",
    quark: '"Nobody sells anything at the wetland, so it can\'t be worth much to the market... can it?" Professor Quark wonders aloud.',
    pipTip: 'A soft plunge drops back over OPEN for a skill shot. Then aim at the glowing service targets on the left wall.',
  },
  build,
  skillShot: 'market_open',
  shots: [
    { id: 'loop', label: 'Market Loop', on: [{ type: 'shot', id: ['loop_l_sw', 'loop_r_sw'] }], insert: 'ins_loop' },
    { id: 'bee', label: 'Bee Spinner', on: [{ type: 'spinner', id: 'bee_spinner' }], insert: 'ins_bee' },
    { id: 'fruit', label: 'Fruit Stall', on: [{ type: 'saucer', id: 'fruit_stall' }], insert: 'ins_fruit' },
    { id: 'meander', label: 'Wetland Meander', on: [{ type: 'shot', id: 'meander_sw' }], insert: 'ins_meander' },
    { id: 'water', label: 'Water Stall', on: [{ type: 'saucer', id: 'water_stall' }], insert: 'ins_meander' },
    { id: 'scales', label: 'Market Scales', on: [{ type: 'saucer', id: 'market_scales' }], insert: 'ins_scales' },
    { id: 'council', label: 'Town Council', on: [{ type: 'dropBank', id: 'council' }], insert: 'ins_bank' },
    { id: 'services', label: 'Service targets', on: [{ type: 'target', group: 'services' }], insert: 'ins_services' },
    { id: 'blossoms', label: 'Orchard blossoms', on: [{ type: 'bumper', group: 'blossoms' }], insert: 'ins_blossoms' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Market Morning',
      brief: 'The stalls open at dawn. Spot four of the natural services that stock them, then bring what you found to the Market Scales.',
      objectiveIds: ['L28-O1'],
      stages: [
        { kind: 'collect', text: 'Spot 4 services: FOOD, POLLINATE, FILTER, SOIL', match: { type: 'target', group: 'services' }, count: 4, distinct: true, lamps: SERVICES.map((s) => s.id), preview: ['services'] },
        { kind: 'discover', text: 'Shoot the Market Scales to look closer', pocket: 'market_scales', questions: 1 },
      ],
      discovery: 'An ecosystem service is natural work a healthy ecosystem does that people benefit from: pollinating crops, filtering water, building soil and supplying food, wood and places to explore.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Behind Every Stall',
      brief: 'Trace each stall back to the living work behind it: bees for the fruit, wetland plants and mud for the water. Lose a worker and a stall can empty.',
      objectiveIds: ['L28-O2', 'L28-O3'],
      stages: [
        { kind: 'shots', text: 'Pollinate: Bee Spinner, then the Fruit Stall', shots: ['bee', 'fruit'], order: 'sequence' },
        { kind: 'shots', text: 'Filter: up the Wetland Meander to the Water Stall', shots: ['meander', 'water'], order: 'sequence' },
        { kind: 'discover', text: 'Link them at the Market Scales', pocket: 'market_scales', questions: 1, types: ['match', 'order', 'classify'] },
      ],
      discovery: 'Services come from living work: bees carrying pollen help many fruit crops form (wheat, rice and corn use wind or self-pollination), and wetland plants slow water so mud settles. Lose a worker and its service can fail.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Fernbrook Council',
      brief: 'Fernbrook must decide whether to pave its wetland. Hear every stakeholder, weigh PRICE and VALUES, then decide at the Market Scales.',
      objectiveIds: ['L28-O4'],
      stages: [
        { kind: 'collect', text: 'Hear all 4 stakeholders: FARM, HOME, FISH, BUILD', match: { type: 'drop', group: 'stakeholders' }, count: 4, distinct: true, lamps: ['council_1', 'council_2', 'council_3', 'council_4'], preview: ['council'] },
        { kind: 'collect', text: 'Weigh both pans: PRICE and VALUES', match: { type: 'target', group: 'pans' }, count: 2, distinct: true, lamps: ['pan_price', 'pan_values'] },
        { kind: 'discover', text: 'Decide at the Market Scales', pocket: 'market_scales', questions: 1 },
      ],
      discovery: 'Good choices weigh criteria, constraints, evidence and every stakeholder. A price tag counts costs, but people also value nature for recreation, wildlife, beauty and future discoveries.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Market Day',
    brief: 'Stock the whole market at once: ride the loop, spin the bees and fill both stalls, then bring the Wonderball home to the Market Scales.',
    stages: [
      { kind: 'shots', text: 'Market Day: Loop, Bee Spinner and both stalls', shots: ['loop', 'bee', 'fruit', 'water'], order: 'any' },
      { kind: 'discover', text: 'Final weighing at the Market Scales', pocket: 'market_scales', questions: 2 },
    ],
    celebration: 'The market hums: bees in the orchard, clear water from the wetland, rich soil underfoot, and a town that knows a price tag is only part of the story. The Wonderlight is yours!',
  },
  set: marketSet,
  room: marketRoom,
  icons: {
    blossom(ctx, s) {
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(s * 0.5, 0, s * 0.42, s * 0.26, 0, 0, TAU);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = s * 0.07;
        ctx.strokeStyle = '#8a2a4a';
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#FFC75B';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.24, 0, TAU);
      ctx.fill();
      ctx.lineWidth = s * 0.06;
      ctx.strokeStyle = '#8a5a14';
      ctx.stroke();
      ctx.restore();
    },
    scales(ctx, s) {
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.8);
      ctx.lineTo(0, s * 0.8);
      ctx.moveTo(-s * 0.85, -s * 0.5);
      ctx.lineTo(s * 0.85, -s * 0.5);
      ctx.moveTo(-s * 0.5, s * 0.8);
      ctx.lineTo(s * 0.5, s * 0.8);
      ctx.stroke();
      for (const x of [-0.65, 0.65]) {
        ctx.beginPath();
        ctx.moveTo((x - 0.3) * s, s * 0.05);
        ctx.quadraticCurveTo(x * s, s * 0.45, (x + 0.3) * s, s * 0.05);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
  scenery: {
    backdrop: paintMarket,
    ambient: paintAmbient,
    celebrate: paintCelebrate,
  },
};
export default L28;
