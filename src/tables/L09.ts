// Lesson 9 — Reconstructing Earth's History — "Deep-Time Dream Machine"
// An observatory time theater at night. A long Deep-Time Orbit runs up the right channel, over the
// dome and down the left channel, lighting the four eons in order (labelled NOT TO SCALE). Every
// left-channel return drops into the Eyepiece, which sets the ball on the Telescope flipper (upper
// left) to fire the Telescope Ramp over the West wall into the meteorite bumpers. Two canyon walls
// of fossil targets hold different parts of the rock record and share one layer, so reading both
// joins them into a longer history. A marked Time Tunnel rewinds the ball to the start of the orbit.
// Everything is read in the Dream Machine (the Wonder Pocket).

import * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { Rollover } from '../game/table/mechanisms.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import {
  TAU, drift, glowDot, mix, neonPath, neonText, plaque, rgba, rng, rrect, stage, stars, vgrad,
} from '../game/render/art.ts';

// ---------------------------------------------------------------- palette

const NIGHT = '#151238';
const INDIGO = '#221c55';
const GOLD = '#FFC75B';
const BRASS = '#D8B26A';
const EMBER = '#FF8A5B';
const AURORA = '#7FE3D8';
const VIOLET = '#9C7BFF';
const IVORY = '#FFF7E7';

/** The four eons, oldest first. `share` is the eon's rounded fraction of Earth's history. */
const EONS = [
  { id: 'eon_1', name: 'HADEAN', short: 'H', color: '#FF6B45', share: 0.13 },
  { id: 'eon_2', name: 'ARCHEAN', short: 'A', color: '#36C9B4', share: 0.33 },
  { id: 'eon_3', name: 'PROTEROZOIC', short: 'P', color: '#77A9FF', share: 0.42 },
  { id: 'eon_4', name: 'PHANEROZOIC', short: 'Ph', color: '#B4E86E', share: 0.12 },
];

/**
 * The joined rock record, oldest first. Neither canyon wall holds all of it: the West wall shows
 * the three oldest layers, the East wall the three youngest, and the footprint sandstone appears
 * in both, which is how the two records are matched and joined (lateral continuity).
 */
const STRATA = [
  { label: 'TRILOBITE', rock: '#6F7FA0', glyph: 'trilobite' }, // muddy-sea shale
  { label: 'CRINOID', rock: '#A9A28C', glyph: 'crinoid' }, // shallow-sea limestone
  { label: 'TRACKS', rock: '#D98E55', glyph: 'track' }, // desert sandstone with footprints (shared)
  { label: 'DINOSAUR', rock: '#9C5A3C', glyph: 'bone' },
  { label: 'MAMMAL', rock: '#D9C27A', glyph: 'mammal' },
] as const;
type Stratum = (typeof STRATA)[number];
/** Index of the layer both walls share. */
const SHARED = 2;
/** Each wall's layers from top (youngest) to bottom (oldest). */
const WEST: Stratum[] = [STRATA[2], STRATA[1], STRATA[0]];
const EAST: Stratum[] = [STRATA[4], STRATA[3], STRATA[2]];

// ---------------------------------------------------------------- geometry

function build(b: TableBuilder) {
  // The kickback sits under the left outlane: it fires up through the Eyepiece floor (a one-way
  // gate), the Eyepiece catches the ball and sets it on the Telescope flipper.
  b.standardFrame({ kickback: 'left' });

  // --- Deep-Time Orbit: up the right channel, over the dome, down the left channel ---
  b.wall([[494, 650], [494, 372]], { id: 'orbit_r_inner', r: 3 });
  b.post(494, 368, 5);
  b.wall([[FRAME.laneSep, 646], [520, 692]], { id: 'orbit_r_deflect', r: 3 });
  b.shotSwitch('orbit_sw', 521, 500, -90);
  // The left channel's foot narrows (37 clear) so every return drops into the Eyepiece.
  b.wall([[80, 372], [80, 540], [70, 570], [70, 588]], { id: 'orbit_l_inner', r: 3 });
  b.post(80, 368, 5);
  b.post(70, 592, 5, { id: 'orbit_l_foot' });
  // Eon rollovers in time order along the orbit (oldest first); a dot lamp beside each previews it.
  const eonAt: [number, number, number][] = [[521, 595, 539], [521, 410, 539], [52, 400, 68], [52, 520, 68]];
  EONS.forEach((e, i) => {
    const [x, y, dx] = eonAt[i];
    const r: Rollover = b.rollover(e.id, x, y, { group: 'eons', label: e.short });
    r.lampColor = e.color;
    b.insert(`ins_${e.id}`, dx, y + 2, { shape: 'circle', size: 8, color: e.color });
  });
  b.rollover('skill_star', 521, 340, { group: 'star' });

  // --- Eyepiece + Telescope flipper (upper left) ---
  // Orbit and plunge returns arrive at ~2000 u/s, far too fast to aim. The Eyepiece (a scoop at
  // the foot of the left channel) catches them, pauses, and sets the ball gently on the Telescope
  // flipper. Tap left as it rolls (an 80 ms window), or hold left to cradle it and drop-flip,
  // to fire the Telescope Ramp; a missed flip just rolls on toward the left flipper.
  const eyepiece = b.saucer('eyepiece', 46, 614, { ejectDeg: 35, ejectSpeed: 160, captureMaxSpeed: 4200 });
  eyepiece.autoEjectDelay = 0.55;
  b.gate('eyepiece_floor', [FRAME.left + 3, 628], [80, 660], -90);
  b.flipper('flipper_upper', 76, 668, 'left', { length: 76, restDeg: 28, upDeg: -28 });

  // --- Telescope Ramp: mouth right above the Telescope flipper, drops into the meteorites ---
  // A short climb and an open bend, so a Telescope-flipper shot (~1500 u/s) carries over the top.
  b.wall([[91, 504], [99, 469]], { id: 'ramp_flare_l', r: 3 });
  b.wall([[166, 532], [133, 471]], { id: 'ramp_flare_r', r: 3 });
  b.ramp('telescope_ramp', {
    path: [[116, 470], [119, 414], [134, 364], [158, 348], [190, 344], [224, 346]],
    width: 34,
    footprintTo: 2,
    peak: 84,
    label: 'TELESCOPE RAMP',
  });
  b.wall([[80, 368], [117, 356]], { id: 'ramp_roof', r: 3 });

  // --- West canyon wall: the three OLDEST layers on the ramp body (oldest lowest) ---
  b.target('west_1', [143, 462], [144, 436], { group: 'fossils', label: WEST[2].label });
  b.target('west_2', [145, 428], [147, 402], { group: 'fossils', label: WEST[1].label });
  b.target('west_3', [149, 394], [154, 368], { group: 'fossils', label: WEST[0].label });

  // --- Dream Machine Wonder Pocket in its cup ---
  b.wall([[302, 452], [302, 512]], { id: 'pocket_l', r: 4 });
  b.wall([[358, 452], [358, 512]], { id: 'pocket_r', r: 4 });
  b.wall([[302, 452], [330, 438], [358, 452]], { id: 'pocket_cap', r: 4 });
  b.saucer('dream_pocket', 330, 478, { role: 'pocket', ejectDeg: 100, ejectSpeed: 760, label: 'DREAM MACHINE', icon: 'hourglass' });

  // --- Time Tunnel lane: the portal rewinds the ball to the start of the Deep-Time Orbit ---
  b.wall([[440, 640], [440, 420]], { id: 'tunnel_wall', r: 3 });
  b.wall([[440, 420], [494, 396]], { id: 'tunnel_cap', r: 3 });
  b.portal('time_tunnel', [467, 448], { x: 521, y: 626, deg: -90, speed: 2150 }, { label: 'TIME TUNNEL' });

  // --- East canyon wall: the three YOUNGEST layers on the tunnel wall; its lowest layer (the
  // footprint sandstone) is the one the West wall's top layer matches ---
  b.target('east_1', [434, 600], [434, 572], { group: 'fossils', label: EAST[2].label });
  b.target('east_2', [434, 565], [434, 537], { group: 'fossils', label: EAST[1].label });
  b.target('east_3', [434, 530], [434, 502], { group: 'fossils', label: EAST[0].label });

  // --- Meteorite bumpers under the dome ---
  b.bumper('meteor_1', 334, 232, { group: 'meteors', r: 24, icon: 'meteor' });
  b.bumper('meteor_2', 418, 246, { group: 'meteors', r: 24, icon: 'meteor' });
  b.bumper('meteor_3', 374, 318, { group: 'meteors', r: 24, icon: 'meteor' });

  // --- Inserts that preview shots ---
  b.insert('ins_orbit', 521, 690, { deg: -90, color: EONS[0].color });
  b.insert('ins_tunnel', 467, 690, { deg: -90, color: VIOLET });
  b.insert('ins_ramp', 128, 545, { deg: -86 });
  b.insert('ins_pocket', 330, 560, { deg: -90 });
  b.insert('ins_west', 200, 500, { deg: -150, color: EMBER });
  b.insert('ins_east', 392, 640, { deg: -70, color: EMBER });
  b.insert('ins_meteors', 410, 400, { shape: 'star', size: 12 });
}

// ---------------------------------------------------------------- printed playfield art

function fossilGlyph(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  if (kind === 'trilobite') {
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s, 0, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = s * 0.12;
    for (let i = -2; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, i * s * 0.28);
      ctx.lineTo(s * 0.5, i * s * 0.28);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s);
    ctx.lineTo(-s * 0.16, s);
    ctx.moveTo(s * 0.16, -s);
    ctx.lineTo(s * 0.16, s);
    ctx.stroke();
  } else if (kind === 'track') {
    // Three-toed footprint
    ctx.beginPath();
    ctx.ellipse(0, s * 0.3, s * 0.35, s * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = s * 0.26;
    for (const a of [-0.55, 0, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.1);
      ctx.lineTo(Math.sin(a) * s * 0.95, -Math.cos(a) * s * 0.95 + s * 0.1);
      ctx.stroke();
    }
  } else if (kind === 'mammal') {
    // Small mammal skull in profile
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, 0, s * 0.65, s * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.2);
    ctx.lineTo(s * 0.95, s * 0.05);
    ctx.lineTo(s * 0.3, s * 0.32);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(-s * 0.05, -s * 0.05, s * 0.16, 0, TAU);
    ctx.fill();
  } else if (kind === 'crinoid') {
    // Sea lily: a jointed stem, a small cup and feathery arms
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s);
    ctx.quadraticCurveTo(s * 0.12, s * 0.35, 0, -s * 0.15);
    ctx.stroke();
    for (let k = 0; k < 4; k++) ctx.fillRect(-s * 0.14 + k * s * 0.03, s * (0.8 - k * 0.25), s * 0.26, s * 0.06);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.22, s * 0.2, s * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = s * 0.09;
    for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.3);
      ctx.quadraticCurveTo(Math.sin(a) * s * 0.75, -s * 0.6, Math.sin(a) * s * 0.55, -s * 0.98);
      ctx.stroke();
    }
  } else if (kind === 'bone') {
    // A leg bone with knobbed ends
    ctx.save();
    ctx.rotate(-0.6);
    ctx.fillRect(-s * 0.62, -s * 0.12, s * 1.24, s * 0.24);
    for (const [bx, by] of [[-0.68, -0.16], [-0.68, 0.16], [0.68, -0.16], [0.68, 0.16]]) {
      ctx.beginPath();
      ctx.arc(bx * s, by * s, s * 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

/** A canyon wall of three strata bands (top = youngest), each with its fossil, lit by `lit`. */
function canyonWall(ctx: CanvasRenderingContext2D, layers: Stratum[], x0: number, x1: number, tops: number[], lit: number, seed: number, label: string, labelY: number) {
  const r = rng(seed);
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    const y0 = tops[i];
    const y1 = tops[i + 1];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, y0 + Math.sin(x * 0.11 + i) * 2);
    ctx.lineTo(x1, y1);
    for (let x = x1; x >= x0; x -= 6) ctx.lineTo(x, y1 + Math.sin(x * 0.11 + i + 1) * 2);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(L.rock, '#1a1636', 0.55 - 0.4 * lit), 0.55 + 0.35 * lit);
    ctx.fill();
    ctx.clip();
    // grain lines
    ctx.strokeStyle = rgba('#000000', 0.18);
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const yy = y0 + ((k + 0.5) / 5) * (y1 - y0) + (r() - 0.5) * 3;
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x1, yy + (r() - 0.5) * 4);
      ctx.stroke();
    }
    ctx.restore();
    fossilGlyph(ctx, L.glyph, (x0 + x1) / 2, (y0 + y1) / 2, 8, lit > 0.05 ? mix('#fff1d6', L.rock, 0.2) : '#e9dcc0', 0.35 + 0.6 * lit);
  }
  ctx.save();
  ctx.font = '800 10px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(IVORY, 0.55 + 0.45 * lit);
  ctx.fillText(label, (x0 + x1) / 2, labelY);
  ctx.restore();
}

/** Points along the Deep-Time Orbit from the right-channel entrance to the left-channel exit. */
function orbitPath(): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = 660; y >= 300; y -= 20) pts.push([521, y]);
  for (let a = 0; a >= -180; a -= 6) {
    const rad = (a * Math.PI) / 180;
    pts.push([310 + Math.cos(rad) * 262, 300 + Math.sin(rad) * 262]);
  }
  for (let y = 300; y <= 540; y += 20) pts.push([52, y]);
  return pts;
}
const ORBIT = orbitPath();
/**
 * Fraction of the orbit path where each eon segment ends. Not to scale (the plaque says so): the
 * splits only keep each eon rollover inside its own coloured band.
 */
const EON_SPLIT = [0.16, 0.42, 0.92, 1];

/** Cumulative arc-length fraction (0 at the first point, 1 at the last) along a polyline. */
function arcFractions(pts: readonly (readonly number[])[]): number[] {
  const out = [0];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let d2 = 0;
    for (let k = 0; k < pts[i].length; k++) d2 += (pts[i][k] - pts[i - 1][k]) ** 2;
    acc += Math.sqrt(d2);
    out.push(acc);
  }
  return out.map((v) => v / (acc || 1));
}
/** End of each eon as a fraction of Earth's history (to scale). */
const EON_ENDS = (() => {
  let acc = 0;
  return EONS.map((e) => (acc += e.share));
})();
/** Which eon a to-scale fraction of Earth's history (0 = 4.6 Ga, 1 = today) falls in. */
function eonAtFraction(f: number): number {
  for (let i = 0; i < EON_ENDS.length; i++) if (f < EON_ENDS[i]) return i;
  return EONS.length - 1;
}
/** The printed time spiral (oldest at the centre), sampled once. */
const SPIRAL_2D = (() => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 240; i++) {
    const u = i / 240;
    const a = u * 3.2 * TAU - Math.PI / 2;
    const rr = 10 + u * 82;
    pts.push([286 + Math.cos(a) * rr, 690 + Math.sin(a) * rr * 0.62]);
  }
  return { pts, frac: arcFractions(pts) };
})();

function paintBackdrop({ ctx, level }: SceneryContext) {
  const s1 = stage(level, 0.3, 1.0);
  const s2 = stage(level, 1.3, 2.0);
  const s3 = stage(level, 2.3, 3.0);
  const s4 = stage(level, 3.4, 4.0);

  // Night sky over the observatory
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#120f31'], [0.32, NIGHT], [0.62, '#1a1645'], [1, '#0b0a1f']]);
  ctx.fillRect(0, 0, 600, 1150);
  for (const [x, y, rad, c, a] of [[150, 160, 220, VIOLET, 0.12], [470, 420, 240, AURORA, 0.08], [300, 760, 260, INDIGO, 0.5]] as [number, number, number, string, number][]) {
    const g = ctx.createRadialGradient(x, y, 10, x, y, rad);
    g.addColorStop(0, rgba(c, a * (0.6 + 0.4 * s4)));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 1150);
  }
  // Milky Way band
  const mw = rng(31);
  for (let i = 0; i < 260; i++) {
    const u = mw();
    const x = 40 + u * 520;
    const y = 520 - u * 380 + (mw() - 0.5) * 70;
    ctx.fillStyle = rgba(IVORY, 0.12 + 0.3 * mw());
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  stars(ctx, 9, 120, [30, 20, 570, 760], IVORY);

  // Constellation lines (Wonderlight)
  if (s4 > 0.01) {
    neonPath(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(196, 120);
      ctx.lineTo(232, 96);
      ctx.lineTo(270, 108);
      ctx.lineTo(300, 82);
      ctx.moveTo(232, 96);
      ctx.lineTo(240, 140);
    }, GOLD, s4, 1.5);
    for (const [x, y] of [[196, 120], [232, 96], [270, 108], [300, 82], [240, 140]]) glowDot(ctx, x, y, 6, GOLD, s4);
  }

  // Observatory dome under the arch (slit opens as the time scale is read)
  ctx.save();
  const domeG = ctx.createLinearGradient(170, 90, 450, 250);
  domeG.addColorStop(0, mix('#2c4f5c', '#5f9e8f', s3));
  domeG.addColorStop(1, mix('#1b2238', '#2f5b63', s3));
  ctx.fillStyle = domeG;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(300, 236, 128, 128, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(300, 236, 128 * Math.cos((i / 6) * (Math.PI / 2)) , 128, 0, Math.PI, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18 + 0.4 * s3;
  const slitW = 5 + 10 * s3;
  const sg = ctx.createLinearGradient(0, 110, 0, 236);
  sg.addColorStop(0, rgba(GOLD, 0.7));
  sg.addColorStop(1, rgba(GOLD, 0.05));
  ctx.fillStyle = sg;
  ctx.fillRect(300 - slitW / 2, 110, slitW, 126);
  ctx.restore();
  ctx.fillStyle = rgba('#120e2a', 0.65);
  ctx.fillRect(166, 236, 268, 14);
  neonText(ctx, 'DEEP-TIME DREAM MACHINE', 310, 88, 16, GOLD, stage(level, 0.2, 1.2));

  // Meteors streaking toward the meteorite bumpers
  const mr = rng(12);
  for (let i = 0; i < 7; i++) {
    const x = 400 + mr() * 140;
    const y = 70 + mr() * 120;
    const len = 30 + mr() * 40;
    const a = 0.25 + 0.4 * s2 + 0.3 * s4;
    const g = ctx.createLinearGradient(x, y, x - len * 0.8, y + len * 0.6);
    g.addColorStop(0, rgba(IVORY, a));
    g.addColorStop(1, rgba(EMBER, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.8, y + len * 0.6);
    ctx.stroke();
    glowDot(ctx, x, y, 4, IVORY, a);
  }

  // The painted spyglass: nested sections EON > ERA > PERIOD > EPOCH (the units telescope inside one another)
  ctx.save();
  ctx.translate(206, 262);
  ctx.rotate(-0.95);
  const secs: [string, number, number, number][] = [['EPOCH', 0, 36, 7], ['PERIOD', 32, 40, 9.5], ['ERA', 68, 38, 12], ['EON', 102, 50, 15]];
  for (const [word, x0, len, hw] of secs) {
    const tg = ctx.createLinearGradient(0, -hw, 0, hw);
    tg.addColorStop(0, mix('#1d2450', '#33407e', s3));
    tg.addColorStop(0.45, mix('#2a3366', '#5a6cc0', s3));
    tg.addColorStop(1, '#0f1230');
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = tg;
    rrect(ctx, x0, -hw, len, hw * 2, 3);
    ctx.fill();
    ctx.fillStyle = mix('#6b5530', BRASS, 0.4 + 0.6 * s3);
    ctx.fillRect(x0 + len - 4, -hw - 1, 4, hw * 2 + 2);
    ctx.globalAlpha = 0.55 + 0.45 * s3;
    ctx.fillStyle = mix('#c9a45e', '#FFE3A0', s3);
    ctx.font = '800 7.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word, x0 + len / 2 - 2, 0.5);
  }
  ctx.globalAlpha = 1;
  glowDot(ctx, 154, 0, 16, '#cfefff', 0.25 + 0.6 * s3);
  ctx.restore();
  // Starlight beam from the objective lens (time scale read)
  if (s3 > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.22 * s3;
    const bx = 206 + Math.cos(-0.95) * 154;
    const by = 262 + Math.sin(-0.95) * 154;
    const bg = ctx.createRadialGradient(bx, by, 4, bx, by, 90);
    bg.addColorStop(0, rgba(GOLD, 0.9));
    bg.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.arc(bx, by, 90, -1.3, -0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // The Deep-Time Orbit: one band, four eons, compressed (labelled NOT TO SCALE)
  const n = ORBIT.length - 1;
  EONS.forEach((e, i) => {
    const from = Math.floor((i === 0 ? 0 : EON_SPLIT[i - 1]) * n);
    const to = Math.ceil(EON_SPLIT[i] * n);
    const seg = () => {
      ctx.beginPath();
      for (let k = from; k <= to; k++) (k === from ? ctx.moveTo : ctx.lineTo).call(ctx, ORBIT[k][0], ORBIT[k][1]);
    };
    ctx.save();
    seg();
    ctx.strokeStyle = rgba(e.color, 0.1 + 0.16 * s2);
    ctx.lineWidth = 34;
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.restore();
    neonPath(ctx, seg, e.color, 0.15 + 0.85 * s2, 2.5);
  });
  // Eon names written along the channels
  const vText = (t: string, x: number, y: number, c: string, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.font = '800 8.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(c, 0.5 + 0.5 * s2);
    ctx.fillText(t, 0, 0);
    ctx.restore();
  };
  vText(EONS[0].name, 521, 532, EONS[0].color, -Math.PI / 2);
  vText(EONS[1].name, 521, 454, EONS[1].color, -Math.PI / 2);
  vText(EONS[2].name, 52, 334, EONS[2].color, Math.PI / 2);
  vText(EONS[3].name, 52, 478, EONS[3].color, Math.PI / 2);
  plaque(ctx, 'ORBIT TIMELINE: NOT TO SCALE', 310, 62, rgba('#0d0a22', 0.85), rgba(IVORY, 0.7 + 0.3 * s2), 9.5);
  plaque(ctx, 'OLDEST FIRST', 516, 724, rgba('#0d0a22', 0.85), rgba(EONS[0].color, 0.75 + 0.25 * s2), 8.5);

  // Canyon walls: the West wall holds the three oldest layers, the East wall the three youngest.
  // The footprint sandstone at the top of the West wall matches the base of the East wall; a tie
  // line (faint at first, bright once the record is joined) shows where the two records join.
  ctx.save();
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 2 + 1.5 * s1;
  ctx.strokeStyle = rgba(STRATA[SHARED].rock, 0.3 + 0.6 * s1);
  ctx.beginPath();
  ctx.moveTo(214, 379);
  ctx.bezierCurveTo(250, 470, 300, 600, 380, 588);
  ctx.stroke();
  ctx.restore();
  plaque(ctx, 'SAME LAYER', 318, 606, rgba('#0d0a22', 0.82), rgba(STRATA[SHARED].rock, 0.7 + 0.3 * s1), 8.5);
  canyonWall(ctx, WEST, 158, 212, [360, 398, 432, 470], s1, 3, 'WEST WALL', 352);
  canyonWall(ctx, EAST, 382, 430, [496, 533, 568, 606], s1, 5, 'EAST WALL', 489);
  if (s1 > 0.01) {
    // The shared band glows on both walls once they are matched
    ctx.save();
    ctx.strokeStyle = rgba(GOLD, 0.8 * s1);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(158, 360, 54, 38);
    ctx.strokeRect(382, 568, 48, 38);
    ctx.restore();
  }

  // Eyepiece (the scoop at the foot of the left channel) and the Telescope Ramp's name
  ctx.save();
  ctx.strokeStyle = rgba(BRASS, 0.55 + 0.4 * s3);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(46, 614, 17, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(46, 614, 22, 0, TAU);
  ctx.stroke();
  ctx.restore();
  glowDot(ctx, 46, 614, 26, '#cfefff', 0.15 + 0.45 * s3);
  plaque(ctx, 'EYEPIECE', 112, 610, rgba('#0d0a22', 0.85), rgba(BRASS, 0.8 + 0.2 * s3), 8);
  plaque(ctx, 'TELESCOPE RAMP', 198, 562, rgba('#0d0a22', 0.85), rgba(AURORA, 0.75 + 0.25 * s3), 9);

  // Time Tunnel: rings receding toward the portal
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const cy = 620 - u * 168;
    const w = 22 - u * 12;
    const h = 14 - u * 6;
    ctx.strokeStyle = rgba(i % 2 ? AURORA : VIOLET, 0.25 + 0.35 * s2 * (0.5 + 0.5 * u));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(467, cy, w, h, 0, 0, TAU);
    ctx.stroke();
  }
  glowDot(ctx, 467, 448, 28, VIOLET, 0.35 + 0.4 * s2);
  vText('TIME TUNNEL', 467, 560, IVORY, -Math.PI / 2);

  // Dream Machine: clockwork ring and hourglass behind the pocket
  ctx.save();
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.45 * s3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(330, 478, 46, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(330 + Math.cos(a) * 40, 478 + Math.sin(a) * 40);
    ctx.lineTo(330 + Math.cos(a) * 46, 478 + Math.sin(a) * 46);
    ctx.stroke();
  }
  ctx.restore();
  glowDot(ctx, 330, 478, 60, GOLD, 0.12 + 0.25 * s4);
  ctx.save();
  ctx.translate(330, 410);
  ctx.fillStyle = rgba(GOLD, 0.35 + 0.5 * s3);
  ctx.beginPath();
  ctx.moveTo(-9, -12);
  ctx.lineTo(9, -12);
  ctx.lineTo(0, 0);
  ctx.lineTo(9, 12);
  ctx.lineTo(-9, 12);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // The time spiral: Earth's history wound up TO SCALE (oldest at the centre). Each eon gets a
  // share of the spiral's LENGTH equal to its share of time, so the outer turns are not inflated.
  const lit3 = 0.25 + 0.75 * s3;
  const sp = SPIRAL_2D;
  for (let i = 0; i + 1 < sp.pts.length; i++) {
    const f = sp.frac[i];
    const e = EONS[eonAtFraction(f)];
    ctx.strokeStyle = rgba(e.color, 0.3 + 0.6 * lit3);
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sp.pts[i][0], sp.pts[i][1]);
    ctx.lineTo(sp.pts[i + 1][0], sp.pts[i + 1][1]);
    ctx.stroke();
  }
  // Drawn-to-scale bar under the spiral
  const bx0 = 176;
  const bw = 220;
  const by = 800;
  let x = bx0;
  ctx.save();
  EONS.forEach((e) => {
    const w = bw * e.share;
    ctx.fillStyle = rgba(e.color, 0.3 + 0.6 * s3);
    ctx.fillRect(x, by - 6, w - 1.5, 12);
    ctx.fillStyle = rgba('#120e2a', 0.9);
    ctx.font = '800 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(e.short, x + w / 2, by + 0.5);
    x += w;
  });
  ctx.fillStyle = rgba(IVORY, 0.6 + 0.4 * s3);
  ctx.font = '800 9.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('4.6 Ga', bx0, by + 17);
  ctx.textAlign = 'right';
  ctx.fillText('TODAY', bx0 + bw, by + 17);
  ctx.textAlign = 'center';
  ctx.fillText("EARTH'S HISTORY DRAWN TO SCALE", bx0 + bw / 2, by - 15);
  ctx.restore();

  // Distant canyon mesas along the bottom of the field (the joined record, oldest at the bottom)
  for (const [mx, mw, mh] of [[34, 150, 96], [196, 110, 64], [318, 150, 90], [452, 92, 70]] as [number, number, number][]) {
    STRATA.forEach((L, i) => {
      const y1 = 1072 - i * (mh / 5);
      const y0 = y1 - mh / 5;
      const in0 = i * 7 + 7;
      const in1 = i * 7;
      ctx.fillStyle = rgba(mix(L.rock, '#151030', 0.6 - 0.25 * s1), 0.28);
      ctx.beginPath();
      ctx.moveTo(mx + in1, y1);
      ctx.lineTo(mx + in0, y0);
      ctx.lineTo(mx + mw - in0, y0);
      ctx.lineTo(mx + mw - in1, y1);
      ctx.closePath();
      ctx.fill();
    });
  }

  // Wonderlight: aurora curtains along the top and a warm wash
  if (s4 > 0.01) {
    for (let i = 0; i < 3; i++) {
      const g = ctx.createLinearGradient(0, 40, 0, 260);
      g.addColorStop(0, rgba([AURORA, VIOLET, '#B4E86E'][i], 0));
      g.addColorStop(0.5, rgba([AURORA, VIOLET, '#B4E86E'][i], 0.26 * s4));
      g.addColorStop(1, rgba([AURORA, VIOLET, '#B4E86E'][i], 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(40, 260);
      for (let xx = 40; xx <= 560; xx += 20) ctx.lineTo(xx, 120 + Math.sin(xx * 0.02 + i * 2) * 40 - i * 18);
      ctx.lineTo(560, 260);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    glowDot(ctx, 330, 478, 150, GOLD, 0.22 * s4);
    // Golden rims on both canyon walls and a halo around the time spiral
    ctx.save();
    ctx.strokeStyle = rgba(GOLD, 0.7 * s4);
    ctx.lineWidth = 2;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12 * s4;
    ctx.strokeRect(158, 360, 54, 110);
    ctx.strokeRect(382, 496, 48, 110);
    ctx.beginPath();
    ctx.ellipse(286, 690, 100, 64, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
    const sr = rng(57);
    for (let i = 0; i < 40; i++) glowDot(ctx, 40 + sr() * 520, 60 + sr() * 980, 3 + sr() * 5, [GOLD, AURORA, IVORY][i % 3], 0.5 * s4);
  }
}

// ---------------------------------------------------------------- 3D attraction set

const EON_COLORS = EONS.map((e) => new THREE.Color(e.color));

function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = kit.track(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** An irregular rock prism (a cylinder with a wavy outline), used for strata layers. */
function rockPrism(rTop: number, rBot: number, h: number, seed: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, 18, 1, false);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const f = 1 + 0.12 * Math.sin(3 * a + seed * 1.7) + 0.06 * Math.sin(5 * a + seed * 0.9);
    p.setXYZ(i, x * f * 1.3, p.getY(i), z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Strata textures shared by every mesa (index matches STRATA). */
function strataTextures(kit: SetKit): THREE.CanvasTexture[] {
  const r = rng(23);
  return STRATA.map((L) => {
    const t = canvasTex(kit, 512, 96, (ctx) => {
      ctx.fillStyle = L.rock;
      ctx.fillRect(0, 0, 512, 96);
      for (let k = 0; k < 9; k++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.12 + r() * 0.18})`;
        ctx.lineWidth = 1 + r() * 2.5;
        ctx.beginPath();
        const y = 6 + k * 10 + r() * 4;
        ctx.moveTo(0, y);
        for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + (r() - 0.5) * 4);
        ctx.stroke();
      }
      for (let k = 0; k < 4; k++) fossilGlyph(ctx, L.glyph, 64 + k * 128, 48, 16, '#fff3dc', 0.95);
    });
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(2, 1);
    return t;
  });
}

/** A layered butte of one wall's strata (`layers` top = youngest); returns glow materials in the same order. */
function strataMesa(kit: SetKit, tex: THREE.CanvasTexture[], layers: Stratum[], pos: [number, number, number], rotY: number, seed: number) {
  const g = new THREE.Group();
  const mats: THREE.MeshStandardMaterial[] = [];
  const layerH = 0.36;
  // Oldest at the bottom, youngest on top
  for (let i = 0; i < layers.length; i++) {
    const li = layers.length - 1 - i;
    const t = tex[STRATA.indexOf(layers[li])];
    const mat = kit.track(new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.04, roughness: 0.92 }));
    mats[li] = mat;
    const rb = 0.8 - i * 0.09;
    const m = new THREE.Mesh(rockPrism(rb - 0.04, rb, layerH, seed + i * 0.3), mat);
    m.position.y = i * layerH + layerH / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  const cap = new THREE.Mesh(rockPrism(0.2, 0.5, 0.26, seed + 2), kit.mats.plastic('#9b7457'));
  cap.position.y = layers.length * layerH + 0.13;
  g.add(cap);
  g.position.set(pos[0], kit.regions.groundY + pos[1], pos[2]);
  g.rotation.y = rotY;
  kit.add(g);
  return mats; // index matches `layers` (top = youngest first)
}

const dreamSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  kit.sky('#17134a', '#030209');

  // Observatory floor: dark stone with the time spiral inlaid (glows as eons are read)
  kit.ground('#0f0c20', 34);
  const floorTex = canvasTex(kit, 1024, 1024, (ctx) => {
    ctx.clearRect(0, 0, 1024, 1024);
    // Coloured by share of the spiral's length, so each eon's stretch is to scale
    const pts: [number, number][] = [];
    for (let i = 0; i <= 900; i++) {
      const u = i / 900;
      const a = u * 4.2 * TAU;
      const rr = 60 + u * 440;
      pts.push([512 + Math.cos(a) * rr, 512 + Math.sin(a) * rr]);
    }
    const frac = arcFractions(pts);
    for (let i = 0; i < pts.length; i++) {
      ctx.fillStyle = EONS[eonAtFraction(Math.min(frac[i], 0.9999))].color;
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 5, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,199,91,0.55)';
    ctx.lineWidth = 3;
    for (const rr of [505, 470]) {
      ctx.beginPath();
      ctx.arc(512, 512, rr, 0, TAU);
      ctx.stroke();
    }
  });
  const floorMat = kit.track(new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, gy + 0.012, -1.5);
  kit.add(floor);

  // ---- Left: the giant brass telescope on its tripod, aimed at the sky over the dome
  const scope = new THREE.Group();
  const mount = new THREE.Vector3(-6.0, 1.6, -1.5);
  scope.position.copy(mount);
  const brass = kit.mats.brass();
  const tubeLen = 3.2;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, tubeLen, 28, 1, true), kit.mats.paintedMetal('#2b2f5c'));
  tube.position.y = tubeLen * 0.25;
  const tubeIn = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.21, tubeLen, 20, 1, true), kit.track(new THREE.MeshStandardMaterial({ color: '#0a0812', roughness: 0.9, side: THREE.BackSide })));
  tubeIn.position.y = tube.position.y;
  scope.add(tube, tubeIn);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.235 + (i / 3) * 0.075, 0.035, 8, 32), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = tube.position.y - tubeLen / 2 + 0.25 + i * 1.0;
    scope.add(ring);
  }
  const dew = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 0.55, 28, 1, true), brass);
  dew.position.y = tube.position.y + tubeLen / 2 + 0.2;
  scope.add(dew);
  const lensMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0b1a2a', emissive: '#bfe9ff', emissiveIntensity: 0.05, roughness: 0.05, metalness: 0.2 }));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.31, 32), lensMat);
  lens.rotation.x = -Math.PI / 2;
  lens.position.y = dew.position.y + 0.05;
  scope.add(lens);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 12), brass);
  eye.position.set(0.12, tube.position.y - tubeLen / 2 - 0.1, 0);
  eye.rotation.z = 0.5;
  scope.add(eye);
  const finder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 12), brass);
  finder.position.set(0.36, tube.position.y + 0.6, 0);
  scope.add(finder);
  // Starlight beam from the lens (lights up when the time scale is read)
  const beamMat = kit.track(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.3, 2.8, 24, 1, true), beamMat);
  beam.position.y = dew.position.y + 1.45;
  scope.add(beam);
  // Aim: tilt back toward the dome and slightly inward
  scope.rotation.set(-0.62, 0, -0.42);
  kit.add(scope);
  // Equatorial head + tripod
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), kit.mats.paintedMetal('#3a2f55'));
  head.position.copy(mount);
  kit.add(head);
  const legLen = mount.y - gy + 0.15;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    const foot = new THREE.Vector3(mount.x + Math.cos(a) * 1.0, gy, mount.z + Math.sin(a) * 1.0);
    const mid = foot.clone().add(mount).multiplyScalar(0.5);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, legLen * 1.1, 8), kit.mats.wood());
    leg.position.copy(mid);
    leg.lookAt(mount);
    leg.rotateX(Math.PI / 2);
    leg.castShadow = true;
    kit.add(leg);
  }

  // ---- Left foreground: the Fossil Archive cabinet
  const arch = new THREE.Group();
  const wood = kit.mats.wood();
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.9, 0.08), kit.mats.plastic('#21183a'));
  back.position.set(0, 0.95, -0.3);
  arch.add(back);
  for (const sx of [-1.2, 1.2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.95, 0.7), wood);
    side.position.set(sx, 0.975, 0);
    arch.add(side);
  }
  const glyphKinds = ['trilobite', 'crinoid', 'track', 'bone'];
  const specimenMats: THREE.MeshStandardMaterial[] = [];
  const specimenTex = glyphKinds.map((k, i) => canvasTex(kit, 128, 96, (ctx) => {
    ctx.fillStyle = ['#5d6b88', '#8d8672', '#a8673d', '#7c4a33'][i];
    ctx.fillRect(0, 0, 128, 96);
    fossilGlyph(ctx, k, 64, 48, 30, '#fff1d6', 1);
  }));
  for (let row = 0; row < 3; row++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.06, 0.66), wood);
    shelf.position.set(0, 0.25 + row * 0.6, 0);
    shelf.receiveShadow = true;
    arch.add(shelf);
    for (let k = 0; k < kit.n(4); k++) {
      const tex = specimenTex[(row + k) % 4];
      const mat = kit.track(new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.05, roughness: 0.7 }));
      specimenMats.push(mat);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.33, 0.05), mat);
      slab.position.set(-0.84 + k * 0.56, 0.25 + row * 0.6 + 0.2, -0.05);
      slab.rotation.x = -0.18;
      arch.add(slab);
    }
  }
  arch.position.set(-5.45, gy, 2.1);
  arch.rotation.y = 0.6;
  kit.add(arch);
  const archiveSign = kit.neonSign('FOSSIL ARCHIVE', [-5.45, 2.25, 2.1], { height: 0.42, color: EMBER, rotY: 0.6 });
  archiveSign.rotation.x = -0.5;

  // ---- Canyon mesas on both sides: the West wall's record on the left, the East wall's on the
  // right. Their shared footprint layer (top of the left mesa, base of the right) pulses together.
  const strata = strataTextures(kit);
  const mesaL = strataMesa(kit, strata, WEST, [-5.0, 0, 3.7], 0.35, 1);
  const mesaR = strataMesa(kit, strata, EAST, [5.0, 0, 3.7], -0.35, 1);

  // ---- Right: the Deep-Time Spiral, Earth's history wound to scale in glowing beads
  const spiral = new THREE.Group();
  const beadCount = kit.n(150);
  const beadMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), beadMat, beadCount);
  const dummy = new THREE.Object3D();
  // Beads sit at EQUAL distances along the helix (not equal turns), so bead count and length both
  // stay proportional to time: the sign on this piece says it is to scale.
  const helix: [number, number, number][] = [];
  for (let k = 0; k <= 600; k++) {
    const u = k / 600;
    const a = u * 5.2 * TAU;
    const rr = 1.25 - u * 1.0;
    helix.push([Math.cos(a) * rr, 0.25 + u * 3.1, Math.sin(a) * rr]);
  }
  const helixFrac = arcFractions(helix);
  const beadEon: number[] = [];
  let hk = 0;
  for (let i = 0; i < beadCount; i++) {
    const f = i / (beadCount - 1);
    while (hk < helix.length - 2 && helixFrac[hk + 1] < f) hk++;
    const span = helixFrac[hk + 1] - helixFrac[hk] || 1;
    const w = Math.min(1, Math.max(0, (f - helixFrac[hk]) / span));
    const p0 = helix[hk];
    const p1 = helix[hk + 1];
    dummy.position.set(p0[0] + (p1[0] - p0[0]) * w, p0[1] + (p1[1] - p0[1]) * w, p0[2] + (p1[2] - p0[2]) * w);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    beads.setMatrixAt(i, dummy.matrix);
    const ei = eonAtFraction(Math.min(f, 0.9999));
    beadEon.push(ei);
    beads.setColorAt(i, EON_COLORS[ei].clone().multiplyScalar(0.15));
  }
  spiral.add(beads);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.6, 12), brass);
  pole.position.y = 1.8;
  spiral.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.18, 40), kit.mats.paintedMetal('#2a2450'));
  base.position.y = 0.09;
  spiral.add(base);
  const todayMat = kit.track(new THREE.MeshStandardMaterial({ color: '#201a10', emissive: GOLD, emissiveIntensity: 0.1 }));
  const today = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), todayMat);
  today.position.y = 3.55;
  spiral.add(today);
  spiral.position.set(5.75, gy, -3.0);
  kit.add(spiral);
  const spiralSign = kit.neonSign('4.6 BILLION YEARS TO SCALE', [4.85, 0.62, -1.95], { height: 0.34, color: AURORA, rotY: -0.35 });
  spiralSign.rotation.x = -0.55;

  // ---- Right foreground: the Time Tunnel, glowing rings receding into the dark
  const tunnel = new THREE.Group();
  const ringMats: THREE.MeshStandardMaterial[] = [];
  const rings: THREE.Mesh[] = [];
  const ringN = kit.n(8);
  for (let i = 0; i < ringN; i++) {
    const u = i / Math.max(1, ringN - 1);
    const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#0d0a18', emissive: i % 2 ? AURORA : VIOLET, emissiveIntensity: 0.1, roughness: 0.3 }));
    ringMats.push(mat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95 - u * 0.55, 0.045, 10, 48), mat);
    ring.position.set(u * 2.0, u * 0.3, -u * 1.85);
    ring.rotation.y = -0.82;
    tunnel.add(ring);
    rings.push(ring);
  }
  const vortexMat = kit.track(new THREE.MeshBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
  const vortex = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), vortexMat);
  vortex.position.set(2.12, 0.32, -1.96);
  vortex.rotation.y = -0.82;
  tunnel.add(vortex);
  tunnel.position.set(4.65, 1.0, 1.45);
  kit.add(tunnel);
  const tunnelSign = kit.neonSign('TIME TUNNEL', [5.25, 2.15, 1.35], { height: 0.38, color: VIOLET, rotY: -0.55 });
  tunnelSign.rotation.x = -0.5;

  // ---- Head: the observatory dome, its marquee and a painted deep-time panorama
  const dome = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.6, 1.3, 48), kit.mats.paintedMetal('#2c2752'));
  drum.position.y = 0.65;
  dome.add(drum);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(2.5, 48, 24, 0, TAU, 0, Math.PI / 2), kit.mats.paintedMetal('#4f8f86'));
  shell.position.y = 1.3;
  dome.add(shell);
  const slitMat = kit.track(new THREE.MeshStandardMaterial({ color: '#120c06', emissive: GOLD, emissiveIntensity: 0.15, side: THREE.DoubleSide }));
  const slit = new THREE.Mesh(new THREE.SphereGeometry(2.52, 8, 16, Math.PI / 2 - 0.16, 0.32, 0.05, Math.PI / 2 - 0.05), slitMat);
  slit.position.y = 1.3;
  dome.add(slit);
  const shutter = new THREE.Mesh(new THREE.SphereGeometry(2.56, 8, 16, Math.PI / 2 - 0.2, 0.4, 0.05, Math.PI / 2 - 0.05), kit.mats.paintedMetal('#3d6f69'));
  shutter.position.y = 1.3;
  dome.add(shutter);
  const domeScope = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 16), brass);
  domeScope.position.set(0, 3.1, 1.1);
  domeScope.rotation.x = 0.65;
  dome.add(domeScope);
  dome.position.set(0, gy, -10.2);
  kit.add(dome);
  const marquee = kit.neonSign('DEEP-TIME DREAM MACHINE', [0, 1.35, -7.15], { height: 0.78, color: GOLD });
  marquee.rotation.x = -0.75;
  const panorama = kit.backdrop((ctx, w, h, level) => {
    const s3 = kit.stage(level, 2.3, 3);
    const s4 = kit.stage(level, 3.4, 4);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a0820');
    g.addColorStop(0.6, '#1c1650');
    g.addColorStop(1, '#2b1f4e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(77);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,247,231,${0.25 + r() * 0.7})`;
      ctx.fillRect(r() * w, r() * h * 0.8, 1.5 + r() * 1.5, 1.5 + r() * 1.5);
    }
    // Milky Way
    for (let i = 0; i < 700; i++) {
      const u = r();
      ctx.fillStyle = `rgba(200,190,255,${0.05 + r() * 0.12})`;
      ctx.fillRect(u * w, h * 0.65 - u * h * 0.55 + (r() - 0.5) * 60, 2, 2);
    }
    // Aurora (Wonderlight)
    if (s4 > 0.01) {
      for (let k = 0; k < 3; k++) {
        const ag = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.6);
        const c = [AURORA, VIOLET, '#B4E86E'][k];
        ag.addColorStop(0, rgba(c, 0));
        ag.addColorStop(0.55, rgba(c, 0.35 * s4));
        ag.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.6);
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.25 + 0.08 * Math.sin(x * 0.01 + k * 1.7)) - k * 18);
        ctx.lineTo(w, h * 0.6);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Layered canyon mesas on the horizon (the joined record, oldest at the bottom)
    const mesas = [[0.02, 0.2], [0.28, 0.16], [0.7, 0.22], [0.9, 0.14]];
    for (const [mx, mw] of mesas) {
      const x0 = mx * w;
      const ww = mw * w;
      STRATA.forEach((L, i) => {
        ctx.fillStyle = mix(L.rock, '#140f2a', 0.55 - 0.35 * s3);
        ctx.fillRect(x0 + i * 5, h * (0.86 - (i + 1) * 0.045), ww - i * 10, h * 0.045 + 1);
      });
    }
    ctx.fillStyle = '#100c22';
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  }, { width: 30, height: 12, z: -16 });

  // ---- Top corners: Earth's layered interior (left) and the Moon (right)
  const earth = new THREE.Group();
  const coreMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1404', emissive: '#FFB347', emissiveIntensity: 0.1 }));
  const mantleMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a120a', emissive: '#FF6B45', emissiveIntensity: 0.06, side: THREE.DoubleSide }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), coreMat);
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24, 0, Math.PI * 1.5), mantleMat);
  const crust = new THREE.Mesh(new THREE.SphereGeometry(0.7, 40, 28, 0, Math.PI * 1.5), kit.track(new THREE.MeshPhysicalMaterial({ color: '#2f6fa8', roughness: 0.35, clearcoat: 0.8, side: THREE.DoubleSide })));
  earth.add(core, mantle, crust);
  earth.position.set(-4.75, 2.25, -4.1);
  earth.rotation.set(0.2, 2.6, 0.15);
  kit.add(earth);
  const moonMat = kit.track(new THREE.MeshStandardMaterial({ color: '#8d8aa0', emissive: '#e8e6ff', emissiveIntensity: 0.04, roughness: 0.95 }));
  const moonGeo = new THREE.IcosahedronGeometry(0.62, 4);
  const mp = moonGeo.attributes.position as THREE.BufferAttribute;
  const mr = rng(19);
  const craters = Array.from({ length: 9 }, () => new THREE.Vector3(mr() - 0.5, mr() - 0.5, mr() - 0.5).normalize());
  const v = new THREE.Vector3();
  for (let i = 0; i < mp.count; i++) {
    v.fromBufferAttribute(mp, i).normalize();
    let d = 1;
    for (const c of craters) {
      const k = v.dot(c);
      if (k > 0.94) d -= (k - 0.94) * 0.9;
    }
    v.multiplyScalar(0.62 * d);
    mp.setXYZ(i, v.x, v.y, v.z);
  }
  moonGeo.computeVertexNormals();
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.position.set(4.7, 2.45, -4.3);
  kit.add(moon);

  // ---- Lamp posts with brass globe lanterns
  const lanterns = [
    kit.lantern([-4.25, 1.75, -0.4], GOLD, 0.2),
    kit.lantern([4.25, 1.75, -0.4], GOLD, 0.2),
    kit.lantern([-7.7, 2.25, -3.4], AURORA, 0.22),
    kit.lantern([7.7, 2.25, -3.4], VIOLET, 0.22),
  ];
  kit.pole([-4.25, 0, -0.4], 1.45, BRASS);
  kit.pole([4.25, 0, -0.4], 1.45, BRASS);
  kit.pole([-7.7, 0, -3.4], 1.95, BRASS);
  kit.pole([7.7, 0, -3.4], 1.95, BRASS);
  const garlandL = kit.stringLights([-7.7, 1.95, -3.4], [-4.25, 1.5, -0.4], 0.35, kit.n(14), [GOLD, AURORA, IVORY]);
  const garlandR = kit.stringLights([7.7, 1.95, -3.4], [4.25, 1.5, -0.4], 0.35, kit.n(14), [GOLD, VIOLET, IVORY]);
  // Loose boulders around the canyon mesas
  [[-4.1, 4.6, 0.22], [-6.1, 3.2, 0.3], [4.15, 4.7, 0.25], [6.0, 3.1, 0.28]].forEach(([x, z, sz], i) => kit.rock([x, gy + sz * 0.45, z], sz, i % 2 ? '#a57e5f' : '#8e7f9e', 30 + i));
  // A gold halo on the floor around the cabinet (Wonderlight)
  const haloMat = kit.track(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Mesh(new THREE.RingGeometry(4.25, 4.42, 120), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.scale.set(1, 1.45, 1);
  halo.position.set(0, gy + 0.02, 0);
  kit.add(halo);
  // Aurora curtains rising behind the side pieces (Wonderlight)
  const auroraTex = canvasTex(kit, 256, 256, (ctx) => {
    for (let x = 0; x < 256; x += 2) {
      const k = 0.5 + 0.5 * Math.sin(x * 0.09) * Math.sin(x * 0.023 + 1);
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(156,123,255,0)');
      g.addColorStop(0.35, `rgba(156,123,255,${0.35 * k})`);
      g.addColorStop(0.75, `rgba(127,227,216,${0.8 * k})`);
      g.addColorStop(1, 'rgba(127,227,216,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 2, 256);
    }
  });
  auroraTex.wrapS = THREE.RepeatWrapping;
  const auroraMats: THREE.MeshBasicMaterial[] = [];
  const auroras = [-1, 1].map((sx) => {
    const mat = kit.track(new THREE.MeshBasicMaterial({ map: auroraTex.clone(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    kit.track(mat.map!);
    mat.map!.needsUpdate = true;
    auroraMats.push(mat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.0, 24, 1), mat);
    m.position.set(sx * 7.1, 1.75, -4.9);
    m.rotation.y = -sx * 0.5;
    kit.add(m);
    return m;
  });

  // ---- Sky effects: star dust, a meteor shower and Wonderlight fireworks
  const dust = kit.motes({ x0: -11, x1: 11, y0: 0.2, y1: 6, z0: -12, z1: 6 }, 110, '#cfe8ff', { speed: 0.08, size: 0.08 });
  const meteorN = kit.n(10);
  const meteorMat = kit.track(new THREE.MeshBasicMaterial({ color: '#fff4dc', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const meteorGeo = new THREE.CylinderGeometry(0.02, 0.005, 1.4, 6);
  meteorGeo.rotateZ(Math.PI / 2);
  const meteors = new THREE.InstancedMesh(meteorGeo, meteorMat, meteorN);
  const meteorPhase = Array.from({ length: meteorN }, (_, i) => i / meteorN);
  const meteorRand = rng(91);
  const meteorLane = Array.from({ length: meteorN }, (_, i) => [(i % 2 ? 1 : -1) * (7.4 + meteorRand() * 1.4), 2.9 + meteorRand() * 0.9, -2.2 - meteorRand() * 2.2]);
  meteors.frustumCulled = false;
  kit.add(meteors);
  const fw = kit.fireworks({ x0: -8.4, x1: -6.4, y0: 2.6, y1: 3.4, z: -3.9 }, [GOLD, AURORA, VIOLET, EMBER]);
  const fw2 = kit.fireworks({ x0: 6.4, x1: 8.4, y0: 2.6, y1: 3.4, z: -3.9 }, [GOLD, VIOLET, AURORA, '#B4E86E']);

  // ---- Lights (three at most)
  kit.spot([-3.2, 6.5, 2.5], [-6.0, 1.0, -2.2], GOLD, 30, 0.5);
  kit.spot([3.2, 6.5, 2.5], [6.0, 1.0, -1.6], AURORA, 30, 0.5);
  const domeLight = kit.point([0, 3.0, -10.0], GOLD, 0, 6);

  let spin = 0;
  let tunnelPhase = 0;
  let beadLevel = -1;
  let shutterOpen = 0;
  let celebrateBoost = 0;
  const tmpC = new THREE.Color();
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.0);
      const s2 = kit.stage(level, 1.3, 2.0);
      const s3 = kit.stage(level, 2.3, 3.0);
      const s4 = kit.stage(level, 3.4, 4.0);
      const boost = celebrateBoost;
      celebrateBoost = Math.max(0, celebrateBoost - dt * 0.8);
      const motion = !kit.reducedMotion;
      // Dormant but alive: lanterns and garlands always glow a little
      for (let i = 0; i < lanterns.length; i++) lanterns[i].setLit(0.3 + 0.7 * (i < 2 ? s0 : s3) * (0.85 + 0.15 * energy));
      garlandL.setLit(0.2 + 0.8 * s2);
      garlandR.setLit(0.2 + 0.8 * s2);
      dust.setLit(0.25 + 0.6 * s1);
      marquee.setLit(0.18 + 0.82 * Math.max(s1, boost));
      // Level 1: the canyon strata and fossil archive light, matching layers together
      archiveSign.setLit(0.2 + 0.8 * s1);
      for (let i = 0; i < specimenMats.length; i++) specimenMats[i].emissiveIntensity = 0.05 + (0.6 + (motion ? 0.15 * Math.sin(t * 1.5 + i) : 0)) * s1;
      // The shared layer (West top = East base) pulses in step on both mesas once matched
      const sharedGlow = 0.06 + 0.9 * s1 * (motion ? 0.75 + 0.25 * Math.sin(t * 2.2) : 1);
      for (let i = 0; i < 3; i++) {
        const glow = 0.04 + 0.4 * s1;
        mesaL[i].emissiveIntensity = i === 0 ? sharedGlow : glow;
        mesaR[i].emissiveIntensity = i === 2 ? sharedGlow : glow;
      }
      // Level 2: the eons light along the Deep-Time Spiral, oldest first; the tunnel hums
      const bl = Math.round((0.15 + 0.85 * s2 + 0.3 * s4) * 40) / 40;
      if (bl !== beadLevel) {
        beadLevel = bl;
        const c = tmpC;
        for (let i = 0; i < beadCount; i++) {
          const u = i / (beadCount - 1);
          const on = Math.min(1, Math.max(0, (s2 * 1.15 - u) * 6));
          c.copy(EON_COLORS[beadEon[i]]).multiplyScalar(0.15 + 1.25 * Math.max(on, 0.0) + 0.3 * s4);
          beads.setColorAt(i, c);
        }
        if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
      }
      spiralSign.setLit(0.15 + 0.85 * s2);
      todayMat.emissiveIntensity = 0.1 + 2.5 * s2;
      if (motion) spin += dt * (0.08 + 0.25 * s2 + 0.6 * s4 + boost);
      spiral.rotation.y = spin;
      tunnelSign.setLit(0.2 + 0.8 * s2);
      if (motion) tunnelPhase += dt * (0.6 + 2.4 * s2 + boost * 3);
      for (let i = 0; i < ringN; i++) {
        const wave = 0.5 + 0.5 * Math.sin(tunnelPhase * 2 - i * 0.9);
        ringMats[i].emissiveIntensity = 0.12 + (0.6 + 2.2 * wave) * Math.max(0.15, s2);
        rings[i].rotation.z = motion ? tunnelPhase * (i % 2 ? -0.4 : 0.4) : 0;
      }
      vortexMat.opacity = 0.15 + 0.6 * s2;
      vortex.rotation.z = motion ? -tunnelPhase : 0;
      coreMat.emissiveIntensity = 0.1 + 2.2 * s2;
      mantleMat.emissiveIntensity = 0.06 + 1.0 * s2;
      if (motion) earth.rotation.y += dt * 0.12;
      // Level 3: the telescope sees deep time; the dome opens; the moon rises bright
      lensMat.emissiveIntensity = 0.05 + 2.4 * s3;
      beamMat.opacity = 0.14 * s3 + 0.1 * s4;
      shutterOpen += (s3 - shutterOpen) * Math.min(1, dt * 1.5);
      shutter.rotation.x = -shutterOpen * 1.15;
      slitMat.emissiveIntensity = 0.15 + 2.6 * s3;
      if (domeLight) domeLight.intensity = 5 * s3 + 4 * s4 + 6 * boost;
      moonMat.emissiveIntensity = 0.04 + 0.5 * s3;
      if (motion) moon.rotation.y += dt * 0.05;
      if (motion && s4 > 0.01) dome.rotation.y = Math.sin(t * 0.25) * 0.25 * s4;
      // Level 4 (Wonderlight): floor spiral glows, a meteor shower streaks the sky, fireworks
      floorMat.opacity = 0.1 + 0.25 * s2 + 0.45 * s4;
      panorama.repaint(level);
      const showers = Math.max(s4, boost);
      meteorMat.opacity = showers * 0.9;
      if (showers > 0.01) {
        for (let i = 0; i < meteorN; i++) {
          const ph = motion ? (t * 0.22 + meteorPhase[i]) % 1 : meteorPhase[i];
          const lane = meteorLane[i];
          const mx = lane[0];
          const my = lane[1];
          const mz = lane[2];
          const side = mx > 0 ? 1 : -1;
          dummy.position.set(mx - side * ph * 2.8, my - ph * 1.5, mz);
          dummy.rotation.set(0, 0, side > 0 ? 0.49 : -0.49);
          dummy.scale.setScalar(Math.sin(ph * Math.PI));
          dummy.updateMatrix();
          meteors.setMatrixAt(i, dummy.matrix);
        }
        meteors.instanceMatrix.needsUpdate = true;
      }
      fw.setLit(Math.max(kit.stage(level, 3.6, 4), boost));
      fw2.setLit(Math.max(kit.stage(level, 3.6, 4), boost));
      haloMat.opacity = 0.06 + 0.12 * s3 + 0.75 * Math.max(s4, boost);
      for (let i = 0; i < auroraMats.length; i++) {
        const m = auroraMats[i];
        m.opacity = 0.9 * Math.max(s4, boost * 0.8);
        if (motion && m.map) m.map.offset.x = t * (i ? 0.03 : -0.025);
        if (motion) auroras[i].position.y = 1.75 + Math.sin(t * 0.6 + i) * 0.08;
      }
    },
    celebrate(p) {
      celebrateBoost = Math.max(celebrateBoost, Math.sin(Math.min(1, p) * Math.PI));
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const dreamRoom: RoomBuilder = ({ kit }) => {
  // Little observatory: dome with a glowing slit, a brass telescope, the joined strata column
  // (both canyon walls' layers, oldest at the bottom) and a bead spiral
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.22, 24), kit.mats.paintedMetal('#2c2752'));
  drum.position.set(0.5, 0.11, -0.45);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 12, 0, TAU, 0, Math.PI / 2), kit.mats.paintedMetal('#4f8f86'));
  shell.position.set(0.5, 0.22, -0.45);
  const slitMat = kit.track(new THREE.MeshStandardMaterial({ color: '#120c06', emissive: GOLD, emissiveIntensity: 0.1 }));
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.02), slitMat);
  slit.position.set(0.5, 0.4, -0.15);
  slit.rotation.x = -0.6;
  kit.add(drum);
  kit.add(shell);
  kit.add(slit);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.55, 14), kit.mats.brass());
  tube.position.set(-0.25, 0.62, -0.25);
  tube.rotation.set(-0.5, 0, -0.45);
  kit.add(tube);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), kit.mats.wood());
    leg.position.set(-0.25 + Math.cos(a) * 0.1, 0.24, -0.25 + Math.sin(a) * 0.1);
    leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    kit.add(leg);
  }
  const layerMats = STRATA.map((L, i) => {
    const m = kit.track(new THREE.MeshStandardMaterial({ color: L.rock, emissive: L.rock, emissiveIntensity: 0.02, roughness: 0.9 }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.36 - i * 0.03, 0.11, 0.28), m);
    box.position.set(-0.6, 0.055 + i * 0.11, 0.25);
    kit.add(box);
    return m;
  });
  const n = 36;
  const beadMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 8, 6), beadMat, n);
  const d = new THREE.Object3D();
  let acc = 0;
  const bounds = EONS.map((e) => (acc += e.share));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const a = u * 3.6 * TAU;
    d.position.set(Math.cos(a) * (0.22 - u * 0.16), 0.05 + u * 0.6, Math.sin(a) * (0.22 - u * 0.16));
    d.updateMatrix();
    beads.setMatrixAt(i, d.matrix);
    beads.setColorAt(i, EON_COLORS[Math.max(0, bounds.findIndex((b) => u <= b + 1e-6))]);
  }
  const spiral = new THREE.Group();
  spiral.add(beads);
  spiral.position.set(0.78, 0, 0.45);
  kit.add(spiral);
  const moon = kit.orb([-0.35, 1.15, -0.6], 0.12, '#e8e6ff');
  const stars = kit.cloudOfPoints([0, 1.2, -0.4], 0.75, 60, IVORY);
  return {
    update(t, lit) {
      slitMat.emissiveIntensity = 0.1 + 2.4 * lit;
      for (let i = 0; i < layerMats.length; i++) layerMats[i].emissiveIntensity = 0.02 + 0.45 * lit * (kit.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 1.4 + i));
      beadMat.color.setScalar(0.25 + 0.95 * lit);
      spiral.rotation.y = kit.reducedMotion ? 0 : t * 0.4;
      moon.setLit(lit);
      stars.setLit(lit * 0.8);
    },
  };
};

// ---------------------------------------------------------------- the table

export const L09: TableDef = {
  lessonId: 'L09',
  signature: 'A Deep-Time Orbit that lights the four eons in order and drops into the Eyepiece, setting up the Telescope flipper',
  ballRole: 'Here the Wonderball is a game token, not a time traveler: no one can visit the past, so scientists read its clues in rock layers and fossils.',
  theme: {
    bg: [INDIGO, '#0c0a20'],
    rail: '#d7c08e',
    railHighlight: '#fff6dd',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: EMBER,
    accent2: AURORA,
    bumperCap: '#f3dcb3',
    bumperRing: '#2a2660',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(127,227,216,0.18)',
    trail: '#bfefff',
  },
  lines: {
    intro: 'Welcome to the Deep-Time Dream Machine! Earth kept a diary in stone, and tonight we read it from the bottom layer up.',
    quark: '"My time-scale poster gives the eras with animals almost the whole page, so animals must have been around for most of Earth\'s history," Professor Quark muses.',
    pipTip: 'A full launch drops into the Eyepiece and onto the upper flipper. Tap left as the ball rolls to fire it up the Telescope Ramp!',
  },
  build,
  skillShot: 'skill_star',
  shots: [
    { id: 'orbit', label: 'Deep-Time Orbit', on: [{ type: 'shot', id: 'orbit_sw' }], insert: 'ins_orbit' },
    { id: 'ramp', label: 'Telescope Ramp', on: [{ type: 'ramp', id: 'telescope_ramp' }], insert: 'ins_ramp' },
    { id: 'tunnel', label: 'Time Tunnel', on: [{ type: 'portal', id: 'time_tunnel' }], insert: 'ins_tunnel' },
    { id: 'pocket', label: 'Dream Machine', on: [{ type: 'saucer', id: 'dream_pocket' }], insert: 'ins_pocket' },
    { id: 'west', label: 'West canyon wall', on: [{ type: 'target', id: ['west_1', 'west_2', 'west_3'] }], insert: 'ins_west' },
    { id: 'east', label: 'East canyon wall', on: [{ type: 'target', id: ['east_1', 'east_2', 'east_3'] }], insert: 'ins_east' },
    { id: 'meteors', label: 'Meteorites', on: [{ type: 'bumper', group: 'meteors' }], insert: 'ins_meteors' },
    { id: 'hadean', label: 'Hadean Eon', on: [{ type: 'rollover', id: 'eon_1' }], insert: 'ins_eon_1' },
    { id: 'archean', label: 'Archean Eon', on: [{ type: 'rollover', id: 'eon_2' }], insert: 'ins_eon_2' },
    { id: 'proterozoic', label: 'Proterozoic Eon', on: [{ type: 'rollover', id: 'eon_3' }], insert: 'ins_eon_3' },
    { id: 'phanerozoic', label: 'Phanerozoic Eon', on: [{ type: 'rollover', id: 'eon_4' }], insert: 'ins_eon_4' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'apply',
      title: 'Canyon Correlation',
      brief: 'Each canyon wall holds only part of the story. Read both walls, then match the footprint layer they share to join them into one longer record.',
      objectiveIds: ['L09-O4'],
      stages: [
        { kind: 'collect', text: 'Read the West wall: hit all 3 fossil layers', match: { type: 'target', id: ['west_1', 'west_2', 'west_3'] }, count: 3, distinct: true, lamps: ['west_1', 'west_2', 'west_3'], preview: ['west'] },
        { kind: 'collect', text: 'Read the East wall: hit all 3 fossil layers', match: { type: 'target', id: ['east_1', 'east_2', 'east_3'] }, count: 3, distinct: true, lamps: ['east_1', 'east_2', 'east_3'], preview: ['east'] },
        { kind: 'discover', text: 'Join the two walls in the Dream Machine', pocket: 'dream_pocket', questions: 1 },
      ],
      discovery: 'Footprint sandstone tops the West wall and sits at the base of the East wall. Matching that shared layer joins two short rock records into one longer history.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Order of the Ages',
      brief: 'Meteorites date the solar system. Then ride the Deep-Time Orbit through the four eons, oldest first, and put Earth\'s big events in order.',
      objectiveIds: ['L09-O2', 'L09-O3'],
      stages: [
        { kind: 'collect', text: 'Date the solar system: 5 meteorite hits', match: { type: 'bumper', group: 'meteors' }, count: 5, preview: ['meteors'] },
        { kind: 'shots', text: 'Light the eons in order, oldest first', shots: ['hadean', 'archean', 'proterozoic', 'phanerozoic'], order: 'sequence' },
        { kind: 'discover', text: 'Put the events in order at the Dream Machine', pocket: 'dream_pocket', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'Order matters: oxygen from cyanobacteria first reacted with iron in seawater, leaving banded iron layers. Only after that iron ran low did oxygen build up in the air.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'observe',
      title: 'The Deep-Time Telescope',
      brief: 'Zoom the Telescope Ramp from eons down to eras, periods and epochs, then take the Time Tunnel to see Earth\'s whole history drawn to scale.',
      objectiveIds: ['L09-O1'],
      stages: [
        { kind: 'collect', text: 'Zoom in: Telescope Ramp 3 times', match: { type: 'ramp', id: 'telescope_ramp' }, count: 3, preview: ['ramp'] },
        { kind: 'shots', text: 'See it to scale: take the Time Tunnel', shots: ['tunnel'] },
        { kind: 'discover', text: 'Read the time scale in the Dream Machine', pocket: 'dream_pocket', questions: 1 },
      ],
      discovery: 'Eons hold eras, eras hold periods, periods hold epochs. Drawn to scale, the Phanerozoic Eon is only about one-eighth of Earth\'s history.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Wake the Dream Machine',
    brief: 'Run the whole machine: the orbit, the Telescope Ramp, the Time Tunnel and both canyon walls, then bring the Wonderball home.',
    stages: [
      { kind: 'shots', text: 'Orbit, ramp, tunnel and both canyon walls', shots: ['orbit', 'ramp', 'tunnel', 'west', 'east'], order: 'any' },
      { kind: 'discover', text: 'Final reading in the Dream Machine', pocket: 'dream_pocket', questions: 2 },
    ],
    celebration: 'Deep time is mapped! The Dream Machine opens its dome, and the ancient observatory at the heart of the Spark & Story Wing begins to stir.',
  },
  onProgress(rt, { level }) {
    // Once the eons have been ordered, the Deep-Time Orbit stays lit as a finished timeline.
    for (const e of EONS) {
      const r = rt.find(e.id);
      if (r) r.lamp = level >= 2 ? 'on' : 'off';
    }
  },
  set: dreamSet,
  room: dreamRoom,
  icons: {
    meteor(ctx, s) {
      ctx.beginPath();
      const pts = [[0.55, -0.1], [0.35, 0.45], [-0.15, 0.6], [-0.55, 0.3], [-0.6, -0.2], [-0.25, -0.55], [0.3, -0.5]];
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      for (const [x, y, r] of [[-0.2, -0.15, 0.16], [0.18, 0.2, 0.12], [-0.25, 0.32, 0.08]]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, r * s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },
    hourglass(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.85);
      ctx.lineTo(s * 0.55, -s * 0.85);
      ctx.lineTo(s * 0.08, 0);
      ctx.lineTo(s * 0.55, s * 0.85);
      ctx.lineTo(-s * 0.55, s * 0.85);
      ctx.lineTo(-s * 0.08, 0);
      ctx.closePath();
      ctx.fill();
    },
  },
  scenery: {
    backdrop: paintBackdrop,
    ambient({ ctx, t, level, reduced, energy }) {
      if (reduced) return;
      const s2 = stage(level, 1, 2);
      // Twinkle a few stars and send the odd meteor across the dome
      for (let i = 0; i < 14; i++) {
        const x = 60 + ((i * 97) % 480);
        const y = 40 + ((i * 53) % 260);
        glowDot(ctx, x, y, 5, IVORY, 0.25 * (0.5 + 0.5 * Math.sin(t * (1 + (i % 3)) + i)));
      }
      const ph = (t * 0.25) % 1;
      if (ph < 0.35) {
        const u = ph / 0.35;
        const x = 520 - u * 220;
        const y = 70 + u * 120;
        glowDot(ctx, x, y, 7, IVORY, (1 - u) * (0.5 + 0.4 * energy));
      }
      if (s2 > 0) drift(ctx, 7, 14, t, AURORA, [40, 300, 560, 760], 8, 1.4, 0.3 * s2);
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(330, 478, 10, 330, 478, 460);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(0.5, rgba(VIOLET, 0.25));
      g.addColorStop(1, rgba(VIOLET, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU + t * 0.5;
        const d = 50 + p * 300;
        glowDot(ctx, 330 + Math.cos(a) * d, 478 + Math.sin(a) * d * 0.8, 9, EONS[i % 4].color, 1 - p);
      }
    },
  },
};
export default L09;
