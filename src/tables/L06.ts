// Lesson 6 — Food Webs and Trophic Pyramids — "Food-Web Forest"
// A layered woodland at dusk. The playfield is itself a trophic pyramid: producers in the
// meadow at the bottom left, consumer critters and the Canopy Walk in the middle, predator
// perches at the top, and a Decomposer Den whose portal carries matter back to the meadow.
// Printed energy bands thin out level by level; heat wisps show energy leaving at every step.

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { SetBuilder, RoomBuilder, SetKit } from '../game/render3d/setKit.ts';
import {
  TAU, branch, drift, glowDot, leafShape, mix, neonText, rgba, rng, stage, stars, vgrad,
} from '../game/render/art.ts';

const SUN = '#FFD36B';
const LEAF = '#8FD16A';
const MOSS = '#2F6B4F';
const SPORE = '#B98CFF';
const EMBER = '#FF8A5C';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const BARK = '#6B4A32';

// Trophic pyramid printed under the lacquer: apex at the predator perches, base at the
// flippers. Four equal tiers (producers at the bottom).
const PYR = { apexX: 300, apexY: 96, baseY: 800, halfBase: 196 };
const TIER_Y = [800, 624, 448, 272, 96];
/** The meadow hill (collision outline and printed art share it). */
const MEADOW_HILL: [number, number][] = [[80, 520], [200, 600], [204, 620], [106, 641], [80, 615]];
/** Where the Decomposer Den portal sets the ball back down (left inlane, below the meadow). */
const PORTAL_EXIT: [number, number] = [83, 806];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Sunbeam Orbit: left channel with the sunlight spinner (the energy meter) ---
  b.curve([[92, 392], [84, 450], [80, 520]], { id: 'orbit_inner', r: 3 });
  b.post(92, 388, 5);
  b.spinner('sun_spinner', [28, 476], [77, 476], { label: 'SUNLIGHT' });
  b.shotSwitch('sun_orbit_sw', 52, 420, -90);
  // Orbit return: a one-way gate steers balls coming down the orbit into the left inlane (a
  // controlled feed to the left flipper) while the kickback below can still fire up through it.
  b.gate('orbit_deflect', [FRAME.left, 680], [68, 772], -90);

  // --- Producer Meadow: a hill whose face carries three producer drop targets ---
  // The bank faces the flippers (about 12 degrees off level) so rebounds come back to them
  // instead of skipping across into the right outlane.
  b.wall(MEADOW_HILL, { id: 'meadow_hill', r: 3, closed: true });
  b.dropBank('meadow', 112.5, 646.8, -12.1, 3, { size: 26, gap: 6, group: 'producers', labels: ['GRASS', 'CLOVER', 'SHRUB'] });

  // --- Web Heart (Wonder Pocket) in a hollow stump, open downward ---
  b.wall([[207, 472], [207, 420], [235, 405], [263, 420], [263, 472]], { id: 'stump', r: 4 });
  b.saucer('web_heart', 235, 448, { role: 'pocket', ejectDeg: 72, ejectSpeed: 760, label: 'WEB HEART', icon: 'web' });

  // --- Decomposer Den: a hollow-log tunnel whose portal carries matter back to the meadow ---
  b.wall([[309, 520], [309, 342], [331, 324], [353, 342], [353, 520]], { id: 'den_log', r: 4 });
  // The exit sets the ball down gently in the left inlane, below the meadow: a feed, not a drain.
  b.portal('den_portal', [331, 368], { x: PORTAL_EXIT[0], y: PORTAL_EXIT[1], deg: 90, speed: 30 }, { label: 'DECOMPOSER DEN' });

  // --- Canopy Walk: the consumer platform. A treetop walkway that climbs from mid-right up to
  // the canopy and sets the ball down at the top of the right lane, above the upper flipper.
  b.wall([[385, 549.8], [356, 592]], { r: 3 });
  b.wall([[423, 562.2], [458, 604]], { r: 3 });
  b.ramp('canopy_ramp', {
    path: [[404, 556], [431.8, 470.4], [458, 398], [478, 340], [490, 296]],
    width: 40,
    footprintTo: 2,
    peak: 64,
    label: 'CANOPY WALK',
  });

  // --- Canopy Perch: the right lane above the upper flipper (shoots up to the Owl Perch) ---
  b.wall([[FRAME.laneSep, 660], [534, 690]], { id: 'perch_guide', r: 3 });
  b.flipper('flipper_upper', 530, 702, 'right', { length: 70 });
  // Skirt under the perch: balls kicked up the right side glance back toward the right inlane
  // instead of stalling under the upper flipper and dropping into the right outlane.
  b.wall([[FRAME.laneSep, 716], [524, 786]], { id: 'perch_skirt', r: 3 });

  // --- Critter Clearing: consumer pop bumpers ---
  b.bumper('bumper_rabbit', 160, 320, { group: 'consumers', icon: 'rabbit', r: 24 });
  b.bumper('bumper_mouse', 250, 268, { group: 'consumers', icon: 'mouse', r: 24 });
  b.bumper('bumper_hopper', 165, 215, { group: 'consumers', icon: 'hopper', r: 24 });

  // --- Predator perches: top of the food chain (nothing in this model eats them) ---
  b.target('hawk_target', [358, 112], [400, 112], { group: 'predators', label: 'HAWK' });
  b.target('owl_target', [452, 136], [486, 158], { group: 'predators', label: 'OWL' });

  // --- Inserts (shot previews), coloured by role in the web ---
  b.insert('ins_orbit', 52, 596, { deg: -90, label: 'SUN', color: SUN });
  b.insert('ins_meadow', 226, 708, { deg: -134, label: 'PRODUCERS', color: LEAF });
  b.insert('ins_pocket', 235, 524, { deg: -90, color: SUN });
  b.insert('ins_den', 331, 566, { deg: -90, label: 'DEN', color: SPORE });
  b.insert('ins_hawk', 380, 500, { deg: -90, color: EMBER });
  b.insert('ins_canopy', 382, 628, { deg: -72, label: 'CANOPY WALK', color: MINT });
  b.insert('ins_critters', 140, 404, { shape: 'star', size: 12, label: 'CONSUMERS', color: LEAF });
}

// ---------------------------------------------------------------- printed playfield art

function arrow(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, alpha: number, width = 4) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10 * alpha;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  const [x1, y1] = pts[pts.length - 2];
  const [x2, y2] = pts[pts.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = width * 3.4;
  ctx.beginPath();
  ctx.moveTo(x2 + Math.cos(a) * s * 0.6, y2 + Math.sin(a) * s * 0.6);
  ctx.lineTo(x2 + Math.cos(a + 2.5) * s, y2 + Math.sin(a + 2.5) * s);
  ctx.lineTo(x2 + Math.cos(a - 2.5) * s, y2 + Math.sin(a - 2.5) * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Wavy heat wisp drifting away from an energy path (energy leaving as heat). */
function heatWisp(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, alpha: number, phase = 0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = EMBER;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.shadowColor = EMBER;
  ctx.shadowBlur = 8;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const w = Math.sin(u * 9 + phase) * 4 * (0.3 + u);
    const px = x + dx * u + nx * w;
    const py = y + dy * u + ny * w;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function grassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, seed: number) {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.1;
    const l = h * (0.6 + r() * 0.5);
    ctx.lineWidth = 1.6 + r() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x + (r() - 0.5) * 6, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

function clover(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function mushroomArt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, cap: string, glow: number) {
  ctx.save();
  ctx.fillStyle = '#e9dcc4';
  ctx.fillRect(x - s * 0.18, y - s * 0.7, s * 0.36, s * 0.7);
  if (glow > 0.01) glowDot(ctx, x, y - s * 0.8, s * 2.2, cap, 0.55 * glow);
  ctx.fillStyle = glow > 0.01 ? mix(cap, '#ffffff', 0.15 * glow) : mix(cap, '#1a1a1a', 0.45);
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.72, s * 0.62, s * 0.42, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(IVORY, 0.55);
  for (const [dx, dy] of [[-0.25, -0.95], [0.18, -0.88], [0.02, -1.02]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, s * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function pyramidX(y: number, side: -1 | 1) {
  return PYR.apexX + side * ((y - PYR.apexY) / (PYR.baseY - PYR.apexY)) * PYR.halfBase;
}

function paintBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  // Dusk woodland: canopy sky at the top, mossy floor, rich soil under the flippers.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#0d2830'], [0.22, '#123631'], [0.55, '#163a2c'], [0.78, '#142b20'], [1, '#120d0a']]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 6, 60, [60, 24, 540, 230], IVORY);

  // Canopy leaves framing the arch.
  const lr = rng(12);
  for (let i = 0; i < 70; i++) {
    const a = Math.PI + lr() * Math.PI;
    const rr = 250 + lr() * 34;
    const x = 310 + Math.cos(a) * rr;
    const y = 300 + Math.sin(a) * rr;
    leafShape(ctx, x, y, 16 + lr() * 14, a + Math.PI / 2 + (lr() - 0.5), rgba(mix(MOSS, LEAF, lr() * 0.6), 0.35 + 0.25 * stage(level, 0.5, 2)));
  }

  // Far tree trunks with branches (behind everything, low contrast).
  for (const [x, seed] of [[120, 3], [470, 9], [300, 21]] as [number, number][]) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    branch(ctx, seed, x, 820, 120, -Math.PI / 2, 5, '#0a1f1a', rgba(MOSS, 0.6));
    ctx.restore();
  }

  // Soil band under the flippers with roots.
  ctx.fillStyle = vgrad(ctx, 800, 1150, [[0, 'rgba(40,26,16,0)'], [0.25, 'rgba(40,26,16,0.55)'], [1, 'rgba(24,14,8,0.9)']]);
  ctx.fillRect(0, 800, 600, 350);
  const rr2 = rng(31);
  ctx.save();
  ctx.strokeStyle = 'rgba(120,84,52,0.28)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 1 + rr2() * 2.5;
    ctx.beginPath();
    let x = 40 + rr2() * 520;
    let y = 830 + rr2() * 40;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rr2() - 0.5) * 60;
      y += 18 + rr2() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ---- The trophic pyramid: energy bands that thin out going up.
  const tierAlpha = [0.2, 0.11, 0.065, 0.04];
  for (let i = 0; i < 4; i++) {
    const yb = TIER_Y[i];
    const yt = TIER_Y[i + 1];
    const wake = 0.35 + 0.65 * stage(level, i * 0.9 + 0.2, i * 0.9 + 1.1);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pyramidX(yb, -1), yb);
    ctx.lineTo(pyramidX(yb, 1), yb);
    ctx.lineTo(pyramidX(yt, 1), yt);
    ctx.lineTo(pyramidX(yt, -1), yt);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, yt, 0, yb);
    g.addColorStop(0, rgba(SUN, tierAlpha[i] * wake * 0.7));
    g.addColorStop(1, rgba(SUN, tierAlpha[i] * wake));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    // Heat leaving each tier at both sloping edges.
    const hy = (yb + yt) / 2;
    const heat = 0.18 + 0.6 * stage(level, i * 0.9 + 0.4, i * 0.9 + 1.4);
    heatWisp(ctx, pyramidX(hy, -1) - 6, hy, -34, -26, heat * 0.8, i);
    heatWisp(ctx, pyramidX(hy, 1) + 6, hy, 34, -26, heat * 0.8, i + 2);
  }
  ctx.save();
  ctx.strokeStyle = rgba(SUN, 0.16 + 0.3 * stage(level, 0.5, 3.5));
  ctx.lineWidth = 2;
  ctx.shadowColor = SUN;
  ctx.shadowBlur = 8 * stage(level, 2, 4);
  ctx.beginPath();
  ctx.moveTo(pyramidX(PYR.baseY, -1), PYR.baseY);
  ctx.lineTo(PYR.apexX, PYR.apexY);
  ctx.lineTo(pyramidX(PYR.baseY, 1), PYR.baseY);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = rgba(SUN, 0.18 + 0.25 * stage(level, 1, 3));
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    const y = TIER_Y[i];
    ctx.beginPath();
    ctx.moveTo(pyramidX(y, -1), y);
    ctx.lineTo(pyramidX(y, 1), y);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Sunlight: diagonal shafts from the upper left onto the meadow (energy enters here).
  const sun = stage(level, 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x0, w] of [[40, 34], [96, 22], [150, 28]] as [number, number][]) {
    const g = ctx.createLinearGradient(x0, 120, x0 + 120, 600);
    g.addColorStop(0, rgba(SUN, 0.02 + 0.1 * sun));
    g.addColorStop(1, rgba(SUN, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, 120);
    ctx.lineTo(x0 + w, 120);
    ctx.lineTo(x0 + w + 80, 640);
    ctx.lineTo(x0 + 70, 640);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glowDot(ctx, 52, 476, 40, SUN, 0.12 + 0.3 * sun);
  // The spinner's name, printed in the orbit lane (the 3D view does not draw spinner labels).
  ctx.save();
  ctx.translate(52, 534);
  ctx.rotate(-Math.PI / 2);
  neonText(ctx, 'SUNLIGHT', 0, 0, 12, SUN, 0.3 + 0.7 * sun, '"Atkinson Hyperlegible Next", system-ui, sans-serif');
  ctx.restore();

  // ---- Producer Meadow on and around the hill.
  const prod = stage(level, 0.2, 1);
  const [h0, h1] = MEADOW_HILL;
  const hillTop = (x: number) => h0[1] + (x - h0[0]) * ((h1[1] - h0[1]) / (h1[0] - h0[0]));
  ctx.save();
  ctx.beginPath();
  MEADOW_HILL.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 520, 645, [[0, mix(MOSS, LEAF, 0.25 + 0.3 * prod)], [1, '#1d3a22']]);
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 9; i++) {
    const x = 92 + i * 12;
    grassTuft(ctx, x, hillTop(x) + 4, 14 + (i % 3) * 4, mix('#3f7a34', LEAF, 0.3 + 0.6 * prod), 40 + i);
  }
  clover(ctx, 106, 588, 7, mix('#2f6b3a', '#6fd18a', prod));
  clover(ctx, 132, 604, 6, mix('#2f6b3a', '#6fd18a', prod));
  ctx.save();
  ctx.fillStyle = mix('#28502c', '#5aa84a', prod);
  for (const [x, y, r] of [[98, 556, 12], [112, 548, 10], [104, 540, 9]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 6; i++) grassTuft(ctx, 150 + i * 22, 760 + (i % 2) * 8, 16, mix('#2f5a2c', LEAF, 0.2 + 0.4 * prod), 70 + i);

  // ---- Critter clearing: dappled light pools under the consumer bumpers.
  const cons = stage(level, 0.8, 1.8);
  for (const [x, y] of [[160, 320], [250, 268], [165, 215]] as [number, number][]) glowDot(ctx, x, y, 58, LEAF, 0.06 + 0.12 * cons);

  // ---- Web Heart: a small orb web painted in the hollow stump behind the pocket (the 3D view
  // does not draw saucer icons).
  const heart = stage(level, 0.5, 3);
  ctx.save();
  ctx.strokeStyle = rgba(IVORY, 0.16 + 0.34 * heart);
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(235, 444);
    ctx.lineTo(235 + Math.cos(a) * 24, 444 + Math.sin(a) * 24);
    ctx.stroke();
  }
  for (const rr of [10, 17, 24]) {
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * TAU;
      if (k) ctx.lineTo(235 + Math.cos(a) * rr, 444 + Math.sin(a) * rr);
      else ctx.moveTo(235 + rr, 444);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ---- Decomposer Den: a hollow log with fungi; glows once matter starts cycling (level 2).
  const dec = stage(level, 1.2, 2.1);
  ctx.save();
  ctx.fillStyle = mix(BARK, '#2a1c12', 0.35);
  ctx.beginPath();
  ctx.roundRect(296, 312, 70, 220, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,18,10,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(300 + (i % 2) * 4, 360 + i * 28);
    ctx.lineTo(304 + (i % 2) * 4, 378 + i * 28);
    ctx.stroke();
  }
  ctx.fillStyle = '#0c0806';
  ctx.beginPath();
  ctx.roundRect(313, 338, 36, 186, 16);
  ctx.fill();
  if (dec > 0.01) glowDot(ctx, 331, 400, 70, SPORE, 0.35 * dec);
  ctx.restore();
  // The den's name runs up the hollow (the 3D view does not draw portal labels).
  ctx.save();
  ctx.translate(331, 462);
  ctx.rotate(-Math.PI / 2);
  neonText(ctx, 'DECOMPOSERS', 0, 0, 12, SPORE, 0.25 + 0.75 * dec, '"Atkinson Hyperlegible Next", system-ui, sans-serif');
  ctx.restore();
  mushroomArt(ctx, 300, 540, 16, SPORE, dec);
  mushroomArt(ctx, 364, 536, 13, EMBER, dec);
  mushroomArt(ctx, 352, 548, 9, SPORE, dec);

  // ---- Matter cycle: a fungal thread from the Den back to the meadow (portal route).
  const cyc = stage(level, 1.3, 2.2);
  const thread: [number, number][] = [[331, 540], [318, 600], [268, 650], [190, 700], [124, 748], [PORTAL_EXIT[0] + 4, PORTAL_EXIT[1] - 18]];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(SPORE, 0.12 + 0.45 * cyc);
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 7]);
  ctx.shadowColor = SPORE;
  ctx.shadowBlur = 10 * cyc;
  ctx.beginPath();
  thread.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  for (let i = 1; i < thread.length; i++) {
    const [x1, y1] = thread[i - 1];
    const [x2, y2] = thread[i];
    arrow(ctx, [[x1 + (x2 - x1) * 0.35, y1 + (y2 - y1) * 0.35], [x1 + (x2 - x1) * 0.6, y1 + (y2 - y1) * 0.6]], SPORE, 0.1 + 0.6 * cyc, 2.5);
  }
  // Label rides along the thread (clear of the PRODUCERS insert label below it).
  if (cyc > 0.01) {
    ctx.save();
    ctx.translate(236, 664);
    ctx.rotate(Math.atan2(650 - 700, 268 - 190));
    neonText(ctx, 'MATTER RETURNS', 0, 0, 11, SPORE, cyc);
    ctx.restore();
  }
  glowDot(ctx, PORTAL_EXIT[0], PORTAL_EXIT[1], 22, SPORE, 0.1 + 0.35 * cyc);

  // ---- Food-web arrows (food -> eater): gold for the meal, with heat peeling away.
  const a1 = stage(level, 0.2, 1);
  // Meadow -> rabbit bumper, routed beside the CONSUMERS insert label rather than through it.
  arrow(ctx, [[198, 588], [192, 470], [178, 350]], LEAF, 0.18 + 0.6 * a1, 3.5);
  heatWisp(ctx, 190, 492, -30, -18, 0.15 + 0.45 * a1, 1);
  const a3 = stage(level, 2.2, 3);
  arrow(ctx, [[278, 242], [318, 190], [360, 136]], EMBER, 0.15 + 0.6 * a3, 3);
  heatWisp(ctx, 318, 194, 30, -10, 0.12 + 0.45 * a3, 2);
  arrow(ctx, [[468, 300], [470, 230], [468, 172]], EMBER, 0.15 + 0.6 * a3, 3);
  heatWisp(ctx, 474, 236, 28, 10, 0.12 + 0.45 * a3, 3);

  // ---- Canopy walk leaves along the ramp route.
  const can = stage(level, 0.6, 2);
  const cr = rng(51);
  for (let i = 0; i < 26; i++) {
    const u = cr();
    const x = 404 + (490 - 404) * u + (cr() - 0.5) * 70;
    const y = 556 + (296 - 556) * u + (cr() - 0.5) * 30;
    leafShape(ctx, x, y, 10 + cr() * 10, cr() * TAU, rgba(mix(MOSS, MINT, 0.3 + 0.4 * can), 0.25 + 0.25 * can));
  }

  // ---- Title in the canopy.
  neonText(ctx, 'FOOD-WEB FOREST', 300, 62, 21, SUN, stage(level, 1.4, 2.4));

  // ---- Wonderlight: the whole web glows.
  const wl = stage(level, 3.4, 4);
  if (wl > 0.01) {
    const nodes: [number, number][] = [[150, 620], [160, 320], [250, 268], [165, 215], [379, 112], [469, 147], [331, 420], [440, 470]];
    const links: [number, number][] = [[0, 1], [0, 2], [0, 3], [3, 2], [1, 4], [2, 4], [2, 5], [7, 5], [1, 6], [4, 6], [5, 6]];
    for (const [a, c] of links) arrow(ctx, [nodes[a], nodes[c]], c === 6 ? SPORE : SUN, 0.35 * wl, 1.6);
    for (const [x, y] of nodes) glowDot(ctx, x, y, 22, SUN, 0.6 * wl);
    ctx.fillStyle = rgba(SUN, 0.05 * wl);
    ctx.fillRect(0, 0, 600, 1150);
  }
}

// ---------------------------------------------------------------- 3D attraction set

type V3 = [number, number, number];

function canvasTexture(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  const t = kit.track(new kit.THREE.CanvasTexture(c));
  t.colorSpace = kit.THREE.SRGBColorSpace;
  return t;
}

function stdMat(kit: SetKit, color: string, o: { emissive?: string; ei?: number; rough?: number; metal?: number; transparent?: boolean; opacity?: number } = {}) {
  return kit.track(new kit.THREE.MeshStandardMaterial({
    color, emissive: o.emissive ?? '#000000', emissiveIntensity: o.ei ?? 0, roughness: o.rough ?? 0.78, metalness: o.metal ?? 0,
    transparent: o.transparent ?? false, opacity: o.opacity ?? 1,
  }));
}

/** Small low-poly woodland animals built from primitives (original, stylised). */
function critter(kit: SetKit, kind: 'rabbit' | 'mouse' | 'fox' | 'hawk' | 'owl' | 'snake', pos: V3, size: number, rotY: number, color?: string): THREE.Group {
  const T = kit.THREE;
  const g = new T.Group();
  const fur = kit.mats.plastic(color ?? ({ rabbit: '#d9c4a8', mouse: '#b49a86', fox: '#e0793c', hawk: '#8a5a3a', owl: '#9c7a58', snake: '#7d8f3c' })[kind]);
  const pale = kit.mats.plastic('#f3e7d3');
  const dark = kit.mats.plastic('#1b120c');
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: V3, s: V3 = [1, 1, 1], r: V3 = [0, 0, 0]) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(p[0], p[1], p[2]);
    m.scale.set(s[0], s[1], s[2]);
    m.rotation.set(r[0], r[1], r[2]);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  const sph = (r: number) => new T.SphereGeometry(r, 16, 12);
  if (kind === 'rabbit') {
    add(sph(0.5), fur, [0, 0.42, 0], [0.85, 0.78, 1.15]);
    add(sph(0.3), fur, [0, 0.82, 0.45]);
    add(new T.CapsuleGeometry(0.07, 0.42, 4, 8), fur, [-0.1, 1.22, 0.38], [1, 1, 1], [-0.25, 0, 0.18]);
    add(new T.CapsuleGeometry(0.07, 0.42, 4, 8), fur, [0.1, 1.22, 0.38], [1, 1, 1], [-0.25, 0, -0.18]);
    add(sph(0.14), pale, [0, 0.5, -0.56]);
  } else if (kind === 'mouse') {
    add(sph(0.4), fur, [0, 0.3, 0], [0.8, 0.7, 1.25]);
    add(sph(0.16), pale, [-0.16, 0.62, 0.28]);
    add(sph(0.16), pale, [0.16, 0.62, 0.28]);
    add(new T.CylinderGeometry(0.02, 0.012, 0.9, 6), fur, [0, 0.22, -0.8], [1, 1, 1], [1.2, 0, 0]);
  } else if (kind === 'fox') {
    add(sph(0.45), fur, [0, 0.45, 0], [0.8, 0.75, 1.3]);
    add(new T.ConeGeometry(0.28, 0.6, 12), fur, [0, 0.75, 0.62], [1, 1, 1], [Math.PI / 2, 0, 0]);
    add(new T.ConeGeometry(0.09, 0.24, 6), fur, [-0.14, 1.02, 0.5]);
    add(new T.ConeGeometry(0.09, 0.24, 6), fur, [0.14, 1.02, 0.5]);
    add(new T.ConeGeometry(0.16, 0.7, 10), pale, [0, 0.5, -0.75], [1, 1, 1], [-2.1, 0, 0]);
  } else if (kind === 'snake') {
    // a coiled S-curve body with a raised head
    const body = new T.CatmullRomCurve3([[-0.55, 0.06, -0.35], [-0.2, 0.06, -0.5], [0.2, 0.06, -0.2], [0.05, 0.06, 0.2], [0.35, 0.1, 0.42], [0.45, 0.3, 0.5]].map(([x, y, z]) => new T.Vector3(x, y, z)));
    add(new T.TubeGeometry(body, 40, 0.07, 8, false), fur, [0, 0, 0]);
    add(sph(0.11), fur, [0.47, 0.34, 0.55], [1, 0.75, 1.35]);
  } else {
    // birds of prey: body, head, folded wings, beak
    const owl = kind === 'owl';
    add(sph(0.38), fur, [0, 0.5, 0], [0.85, owl ? 1.15 : 1, owl ? 0.85 : 1.2]);
    add(sph(owl ? 0.3 : 0.22), owl ? pale : fur, [0, owl ? 0.98 : 0.86, owl ? 0.05 : 0.32]);
    add(new T.ConeGeometry(0.05, 0.14, 6), kit.mats.plastic('#f2c14e'), [0, owl ? 0.94 : 0.84, owl ? 0.34 : 0.56], [1, 1, 1], [Math.PI / 2, 0, 0]);
    add(sph(0.3), dark, [-0.3, 0.52, -0.04], [0.25, 0.9, 1.1]);
    add(sph(0.3), dark, [0.3, 0.52, -0.04], [0.25, 0.9, 1.1]);
  }
  g.position.set(pos[0], pos[1], pos[2]);
  g.scale.setScalar(size);
  g.rotation.y = rotY;
  return kit.add(g);
}

const forestSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  const R = kit.rand(61);
  const GY = kit.regions.groundY;
  kit.sky('#123a33', '#020706');
  kit.ground('#162419', 32);

  // Painted far forest behind the head: layered silhouettes that wake into a glowing wood.
  const far = kit.backdrop((ctx, w, h, level) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0a1f26');
    g.addColorStop(0.55, mix('#12352e', '#2c4a2a', stage(level, 3, 4)));
    g.addColorStop(1, '#09140f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.62, 10, w * 0.5, h * 0.62, w * 0.45);
    glow.addColorStop(0, rgba(SUN, 0.1 + 0.4 * stage(level, 0, 4)));
    glow.addColorStop(1, rgba(SUN, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    const r = rng(8);
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = ['#0f2a25', '#0b2019', '#06130e'][layer];
      for (let i = 0; i < 14; i++) {
        const x = r() * w;
        const base = h * (0.72 + layer * 0.1);
        const th = h * (0.35 + r() * 0.25);
        ctx.fillRect(x - 4 - layer * 2, base - th, 8 + layer * 4, th + 60);
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.arc(x + (r() - 0.5) * 60, base - th + (r() - 0.3) * 40, 26 + r() * 30 + layer * 6, 0, TAU);
          ctx.fill();
        }
      }
    }
    const fl = stage(level, 0.5, 4);
    for (let i = 0; i < 70; i++) {
      const x = r() * w;
      const y = h * (0.3 + r() * 0.6);
      const c = [SUN, MINT, SPORE][i % 3];
      const gr = ctx.createRadialGradient(x, y, 0, x, y, 6);
      gr.addColorStop(0, rgba(c, 0.15 + 0.7 * fl * r()));
      gr.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(x - 6, y - 6, 12, 12);
    }
  }, { width: 30, height: 12, z: -16 });

  // ---------------- Woodland: instanced trunks and foliage around both sides.
  const trees: [number, number, number][] = [
    [-8.6, -3.6, 4.6], [-9.4, 0.6, 3.8], [-6.8, 4.4, 2.6], [-4.6, -7.4, 3.6],
    [8.9, -2.6, 4.4], [9.6, 1.8, 3.6], [7.2, 4.6, 2.4], [4.8, -7.6, 3.4], [7.9, -6.6, 4.8],
  ];
  const trunkGeo = new T.CylinderGeometry(0.11, 0.2, 1, 8);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new T.InstancedMesh(trunkGeo, stdMat(kit, '#4d3424', { rough: 0.95 }), trees.length);
  const leafGeo = new T.IcosahedronGeometry(1, 1);
  const leafMat = stdMat(kit, '#ffffff', { emissive: '#2f7a46', ei: 0.02, rough: 0.7 });
  const perTree = 5;
  const foliage = new T.InstancedMesh(leafGeo, leafMat, trees.length * perTree);
  const dummy = new T.Object3D();
  const col = new T.Color();
  trees.forEach(([x, z, h], i) => {
    dummy.position.set(x, GY, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(h * 0.9, h * 0.62, h * 0.9);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < perTree; k++) {
      const s = h * (0.16 + R() * 0.1);
      dummy.position.set(x + (R() - 0.5) * h * 0.45, GY + h * (0.56 + R() * 0.38), z + (R() - 0.5) * h * 0.45);
      dummy.scale.set(s, s * 0.85, s);
      dummy.rotation.set(R(), R(), R());
      dummy.updateMatrix();
      foliage.setMatrixAt(i * perTree + k, dummy.matrix);
      foliage.setColorAt(i * perTree + k, col.set(['#2f6b3f', '#3d7f44', '#27583a', '#4c8f4a'][(i + k) % 4]));
    }
  });
  trunks.castShadow = true;
  foliage.castShadow = true;
  kit.add(trunks);
  kit.add(foliage);

  // ---------------- Left: the Producer Meadow, fed by sunbeams.
  const meadowMat = stdMat(kit, '#2c5a2c', { rough: 0.95 });
  const meadow = new T.Mesh(new T.SphereGeometry(2.6, 40, 12, 0, TAU, 0, Math.PI / 2), meadowMat);
  meadow.scale.y = 0.08;
  meadow.position.set(-6.3, GY - 0.02, 0.3);
  meadow.receiveShadow = true;
  kit.add(meadow);
  const bladeGeo = new T.ConeGeometry(0.035, 0.34, 4);
  bladeGeo.translate(0, 0.17, 0);
  const blades = kit.n(240);
  const grassMat = stdMat(kit, '#ffffff', { emissive: '#5fbf3e', ei: 0.0, rough: 0.8 });
  const grass = new T.InstancedMesh(bladeGeo, grassMat, blades);
  for (let i = 0; i < blades; i++) {
    const a = R() * TAU;
    const r = Math.sqrt(R()) * 2.3;
    dummy.position.set(-6.3 + Math.cos(a) * r, GY, 0.3 + Math.sin(a) * r);
    dummy.rotation.set((R() - 0.5) * 0.5, R() * TAU, (R() - 0.5) * 0.5);
    const s = 0.6 + R() * 0.9;
    dummy.scale.set(s, s * (0.7 + R() * 0.7), s);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    grass.setColorAt(i, col.set(['#5fae3e', '#79c24c', '#4f9a3a', '#a6d860'][i % 4]));
  }
  kit.add(grass);
  const flowerGeo = new T.SphereGeometry(0.06, 8, 6);
  const flowers = kit.n(46);
  const flowerMat = stdMat(kit, '#ffffff', { emissive: SUN, ei: 0.0, rough: 0.5 });
  const flowerMesh = new T.InstancedMesh(flowerGeo, flowerMat, flowers);
  for (let i = 0; i < flowers; i++) {
    const a = R() * TAU;
    const r = Math.sqrt(R()) * 2.2;
    dummy.position.set(-6.3 + Math.cos(a) * r, GY + 0.22 + R() * 0.16, 0.3 + Math.sin(a) * r);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.7 + R() * 0.7);
    dummy.updateMatrix();
    flowerMesh.setMatrixAt(i, dummy.matrix);
    flowerMesh.setColorAt(i, col.set([IVORY, '#ff9fb0', SUN, '#c9b8ff'][i % 4]));
  }
  kit.add(flowerMesh);
  // Shrub and clover clumps
  const shrubMat = stdMat(kit, '#3f8a46', { emissive: '#3f8a46', ei: 0.0, rough: 0.8 });
  for (const [x, z, s] of [[-4.6, -1.2, 0.5], [-7.9, 1.6, 0.6], [-5.2, 2.2, 0.42]] as V3[]) {
    const m = new T.Mesh(new T.IcosahedronGeometry(s, 1), shrubMat);
    m.position.set(x, GY + s * 0.7, z);
    m.scale.y = 0.8;
    m.castShadow = true;
    kit.add(m);
  }
  // Sunbeams: soft light shafts that brighten when producers wake.
  const beamTex = canvasTexture(kit, 4, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const beamMat = kit.track(new T.MeshBasicMaterial({ color: SUN, alphaMap: beamTex, transparent: true, opacity: 0.05, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  for (const [x, z, tilt] of [[-6.4, 0.6, 0.5], [-7.3, -0.4, 0.55]] as V3[]) {
    const geo = new T.CylinderGeometry(0.25, 0.75, 4.2, 24, 1, true);
    geo.translate(0, 2.1, 0);
    const m = new T.Mesh(geo, beamMat);
    m.position.set(x, GY, z);
    m.rotation.set(0.75, 0, tilt);
    m.renderOrder = 3;
    kit.add(m);
  }
  const rabbit = critter(kit, 'rabbit', [-4.8, GY, 1.0], 0.7, 1.3);
  critter(kit, 'mouse', [-5.3, GY, 2.6], 0.42, 0.4);
  critter(kit, 'rabbit', [-7.0, GY, -0.6], 0.32, -0.6, '#c9b39a');
  const prodSign = kit.neonSign('PRODUCERS', [-5.55, 1.55, 1.25], { height: 0.46, color: LEAF, rotY: 0.4 });
  prodSign.rotation.x = -0.65;
  const sunSign = kit.neonSign('SUNLIGHT IN', [-5.6, 2.02, 0.8], { height: 0.28, color: SUN, rotY: 0.4, backing: false });
  sunSign.rotation.x = -0.65;

  // ---------------- Right: the Decomposer Hollow (fallen log, glowing fungi, spores).
  const ringTex = canvasTexture(kit, 128, 128, (ctx) => {
    ctx.fillStyle = '#8a6844';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 10; i > 0; i--) {
      ctx.strokeStyle = i % 2 ? '#6b4a32' : '#a7835a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(64, 64, i * 6, 0, TAU);
      ctx.stroke();
    }
  });
  const hollowTex = canvasTexture(kit, 128, 128, (ctx) => {
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(0, 0, 128, 128);
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 52);
    g.addColorStop(0, '#d9c2ff');
    g.addColorStop(0.45, '#6a3fb0');
    g.addColorStop(1, '#0a0610');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 50, 0, TAU);
    ctx.fill();
  });
  const barkMat = stdMat(kit, '#5b3e2a', { rough: 0.95 });
  const endMat = kit.track(new T.MeshStandardMaterial({ map: ringTex, roughness: 0.85 }));
  const hollowMat = kit.track(new T.MeshStandardMaterial({ map: hollowTex, emissiveMap: hollowTex, emissive: '#ffffff', emissiveIntensity: 0.05, roughness: 0.9 }));
  const logGroup = new T.Group();
  const logMesh = new T.Mesh(new T.CylinderGeometry(0.48, 0.52, 3.6, 22, 1), [barkMat, hollowMat, endMat]);
  logMesh.rotation.x = Math.PI / 2;
  logMesh.castShadow = true;
  logMesh.receiveShadow = true;
  logGroup.add(logMesh);
  logGroup.position.set(6.0, GY + 0.46, 0.4);
  logGroup.rotation.y = -0.38;
  kit.add(logGroup);
  // Moss on the log
  const mossMat = stdMat(kit, '#4f8f3e', { rough: 0.95 });
  const mossTop = new T.Mesh(new T.SphereGeometry(0.5, 16, 8, 0, TAU, 0, Math.PI / 3), mossMat);
  mossTop.scale.set(1, 0.5, 3.3);
  mossTop.position.set(0, 0.2, 0);
  logGroup.add(mossTop);
  // Mushrooms (instanced stems + two glowing cap colours)
  const shrooms: [number, number, number, number][] = [];
  const clusters: V3[] = [[5.0, 1.9, 7], [6.9, -1.4, 6], [7.6, 1.6, 5], [5.4, -0.9, 4], [4.6, 4.0, 4], [-4.4, -3.6, 3]];
  for (const [cx, cz, n] of clusters) for (let i = 0; i < kit.n(n); i++) shrooms.push([cx + (R() - 0.5) * 0.9, cz + (R() - 0.5) * 0.9, 0.12 + R() * 0.26, i % 2]);
  const stemGeo = new T.CylinderGeometry(0.035, 0.05, 1, 8);
  stemGeo.translate(0, 0.5, 0);
  const stems = new T.InstancedMesh(stemGeo, stdMat(kit, '#efe2c8', { rough: 0.6 }), shrooms.length);
  const capGeo = new T.SphereGeometry(1, 18, 8, 0, TAU, 0, Math.PI / 2);
  const capMats = [stdMat(kit, '#6d4aa8', { emissive: SPORE, ei: 0.04, rough: 0.4 }), stdMat(kit, '#a8553a', { emissive: EMBER, ei: 0.04, rough: 0.4 })];
  const caps = capMats.map((m) => new T.InstancedMesh(capGeo, m, shrooms.length));
  const capCount = [0, 0];
  shrooms.forEach(([x, z, s, kind], i) => {
    dummy.position.set(x, GY, z);
    dummy.rotation.set((R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2);
    dummy.scale.set(s * 1.4, s * 2.2, s * 1.4);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, GY + s * 2.1, z);
    dummy.scale.set(s, s * 0.62, s);
    dummy.updateMatrix();
    caps[kind].setMatrixAt(capCount[kind]++, dummy.matrix);
  });
  caps.forEach((c, k) => (c.count = capCount[k]));
  kit.add(stems);
  caps.forEach((c) => kit.add(c));
  const spores = kit.motes({ x0: 4.2, x1: 8.6, y0: GY, y1: 3.4, z0: -2.6, z1: 4.2 }, 90, SPORE, { speed: 0.16, size: 0.09 });
  // Mycelium threads: matter returning from the decomposers, under the head, to the meadow.
  const wiggle = (pts: [number, number][]): V3[] => pts.map(([x, z], i) => [x + Math.sin(i * 2.3) * 0.18, GY + 0.025, z + Math.cos(i * 1.7) * 0.18]);
  const myc1 = kit.neonTube(wiggle([[5.6, 0.0], [5.0, -1.4], [4.5, -3.0], [4.2, -4.8], [3.6, -6.7], [1.8, -7.2], [0, -7.0], [-1.8, -7.2], [-3.6, -6.7], [-4.2, -4.8], [-4.5, -3.0], [-4.8, -1.6], [-5.2, -0.6]]), SPORE, { radius: 0.018 });
  const myc2 = kit.neonTube(wiggle([[6.4, 1.6], [7.0, 2.6], [7.4, 3.6], [8.2, 4.4]]), SPORE, { radius: 0.015 });
  const decSign = kit.neonSign('DECOMPOSERS', [6.15, 2.0, -0.45], { height: 0.46, color: SPORE, rotY: -0.5 });
  decSign.rotation.x = -0.5;
  const snag = new T.Mesh(new T.CylinderGeometry(0.18, 0.28, 1.9, 9), stdMat(kit, '#4a3526', { rough: 0.95 }));
  snag.position.set(8.5, GY + 0.95, -2.6);
  snag.castShadow = true;
  kit.add(snag);
  const owlTreeOwl = critter(kit, 'owl', [8.5, GY + 1.9, -2.6], 0.5, -0.5);
  critter(kit, 'fox', [5.0, GY, 2.9], 0.5, -2.1);

  // ---------------- Top left: the Energy Pyramid (10 percent model), thinning upward.
  const pyr = new T.Group();
  const widths = [3.0, 2.25, 1.5, 0.75];
  const tierH = 0.36;
  const tierMats: THREE.MeshPhysicalMaterial[] = [];
  const labelMats: THREE.MeshBasicMaterial[] = [];
  const values = ['10,000', '1,000', '100', '10'];
  widths.forEach((w, i) => {
    const mat = kit.track(new T.MeshPhysicalMaterial({ color: '#2e2008', emissive: '#ffae2e', emissiveIntensity: 0.03, roughness: 0.62, clearcoat: 0, envMapIntensity: 0.25, transparent: true, opacity: [0.97, 0.88, 0.76, 0.64][i] }));
    const m = new T.Mesh(new T.BoxGeometry(w, tierH, w), mat);
    m.position.y = tierH * (i + 0.5);
    m.castShadow = true;
    pyr.add(m);
    tierMats.push(mat);
    const tex = canvasTexture(kit, 256, 64, (ctx, cw, ch) => {
      ctx.font = '800 44px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(values[i], cw / 2, ch / 2 + 2);
    });
    const lm = kit.track(new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: '#9a8458' }));
    const lbl = new T.Mesh(new T.PlaneGeometry(Math.min(1.2, w * 0.8), 0.3), lm);
    lbl.position.set(0, tierH * (i + 0.5), w / 2 + 0.012);
    pyr.add(lbl);
    labelMats.push(lm);
  });
  pyr.position.set(-5.7, GY, -5.4);
  pyr.rotation.y = 0.55;
  kit.add(pyr);
  // Energy packets: each level keeps about a tenth of the energy below it.
  const orbR = [0.24, 0.13, 0.07, 0.04];
  const energyOrbs = widths.map((w, i) => {
    const local = new T.Vector3(-w / 2 - orbR[i] - 0.06, tierH * (i + 0.5), w / 2 - 0.1);
    local.applyAxisAngle(new T.Vector3(0, 1, 0), pyr.rotation.y);
    return kit.orb([pyr.position.x + local.x, pyr.position.y + local.y, pyr.position.z + local.z], orbR[i], SUN);
  });
  // Who sits on each level: one food chain from the lesson's forest web (shrub -> deer mouse ->
  // snake -> hawk). Each living thing stands beside its own tier's energy label (on the step
  // below it); the hawk perches on the top tier.
  const rim = (i: number) => (widths[i] + widths[i + 1]) / 4;
  const pyrShrub = new T.Mesh(new T.IcosahedronGeometry(0.17, 1), shrubMat);
  pyrShrub.position.set(0.9, 0.12, widths[0] / 2 + 0.2);
  pyrShrub.scale.y = 0.8;
  pyrShrub.castShadow = true;
  pyr.add(pyrShrub);
  pyr.add(critter(kit, 'mouse', [0.85, tierH, rim(0)], 0.3, 0.9));
  pyr.add(critter(kit, 'snake', [0.62, tierH * 2, rim(1) - 0.04], 0.3, 0.2));
  const topHawk = critter(kit, 'hawk', [0, tierH * 4, 0], 0.3, 0);
  pyr.add(topHawk);
  const heat = kit.motes({ x0: -7.6, x1: -3.9, y0: GY + 0.3, y1: 3.6, z0: -7.0, z1: -3.8 }, 70, EMBER, { speed: 0.35, size: 0.1 });
  const pyrSign = kit.neonSign('ENERGY PYRAMID', [-6.1, 0.95, -2.9], { height: 0.36, color: SUN, rotY: 0.45 });
  pyrSign.rotation.x = -0.6;
  const pyrLight = kit.point([-4.6, 2.6, -2.6], SUN, 0, 6);

  // ---------------- Top right: the Glowing Web (finale reveal), drawn on a glass panel.
  const webNodes: { x: number; y: number; label: string; c: string; lvl: number }[] = [
    { x: 0.2, y: 0.86, label: 'GRASS', c: LEAF, lvl: 0.5 },
    { x: 0.42, y: 0.88, label: 'CLOVER', c: LEAF, lvl: 0.5 },
    { x: 0.7, y: 0.86, label: 'SHRUB', c: LEAF, lvl: 0.5 },
    { x: 0.17, y: 0.55, label: 'RABBIT', c: MINT, lvl: 1.5 },
    { x: 0.44, y: 0.6, label: 'GRASSHOPPER', c: MINT, lvl: 1.5 },
    { x: 0.72, y: 0.55, label: 'MOUSE', c: MINT, lvl: 1.5 },
    { x: 0.3, y: 0.2, label: 'HAWK', c: EMBER, lvl: 2.5 },
    { x: 0.66, y: 0.2, label: 'OWL', c: EMBER, lvl: 2.5 },
    { x: 0.92, y: 0.42, label: 'FUNGI', c: SPORE, lvl: 2 },
  ];
  const webEdges: [number, number][] = [[0, 3], [0, 4], [1, 3], [1, 4], [2, 5], [4, 5], [3, 6], [5, 6], [5, 7], [4, 7]];
  const webCanvas = document.createElement('canvas');
  webCanvas.width = 1024;
  webCanvas.height = 640;
  const webTex = kit.track(new T.CanvasTexture(webCanvas));
  webTex.colorSpace = T.SRGBColorSpace;
  let webPainted = -1;
  const paintWeb = (level: number) => {
    const k = Math.round(level * 6);
    if (k === webPainted) return;
    webPainted = k;
    const ctx = webCanvas.getContext('2d')!;
    const W = webCanvas.width;
    const H = webCanvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,16,14,0.55)';
    ctx.beginPath();
    ctx.roundRect(8, 8, W - 16, H - 16, 40);
    ctx.fill();
    const all = stage(level, 3.3, 4);
    for (const [a, b] of webEdges) {
      const na = webNodes[a];
      const nb = webNodes[b];
      const on = Math.max(all, 0.6 * stage(level, Math.max(na.lvl, nb.lvl), Math.max(na.lvl, nb.lvl) + 0.6));
      arrow(ctx, [[na.x * W, na.y * H - 18], [nb.x * W + (na.x - nb.x) * W * 0.12, nb.y * H + 26]], SUN, 0.12 + 0.88 * on, 7);
    }
    for (let i = 0; i < 8; i++) {
      const n = webNodes[i];
      const on = Math.max(all, 0.5 * stage(level, 2, 2.8));
      arrow(ctx, [[n.x * W + 30, n.y * H], [0.9 * W, 0.42 * H + 14 * (i - 4)]], SPORE, 0.06 + 0.5 * on, 3);
    }
    for (const n of webNodes) {
      const on = stage(level, n.lvl, n.lvl + 0.6);
      const g = ctx.createRadialGradient(n.x * W, n.y * H, 4, n.x * W, n.y * H, 60);
      g.addColorStop(0, rgba(n.c, 0.25 + 0.75 * on));
      g.addColorStop(1, rgba(n.c, 0));
      ctx.fillStyle = g;
      ctx.fillRect(n.x * W - 60, n.y * H - 60, 120, 120);
      ctx.font = '800 34px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(IVORY, 0.35 + 0.65 * on);
      ctx.fillText(n.label, n.x * W, n.y * H + (n.y > 0.7 ? 46 : -42));
    }
    ctx.font = '800 40px "Fraunces Variable", Georgia, serif';
    ctx.fillStyle = rgba(SUN, 0.3 + 0.7 * stage(level, 0.5, 2));
    ctx.textAlign = 'left';
    ctx.fillText('FOOD WEB', 40, 52);
    ctx.font = '700 24px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = rgba(IVORY, 0.4 + 0.5 * stage(level, 0.5, 2));
    ctx.textAlign = 'right';
    ctx.fillText('arrows point from food to eater', W - 40, 52);
    webTex.needsUpdate = true;
  };
  const webMat = kit.track(new T.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, color: '#9a9a9a' }));
  const webPanel = new T.Mesh(new T.PlaneGeometry(3.6, 2.25), webMat);
  // Low and tilted back so the title row stays inside the desktop view at the top-right corner;
  // yaw then tilt ('YXZ') keeps the bottom edge level and above the ground.
  webPanel.position.set(5.85, 0.62, -4.75);
  webPanel.rotation.set(-0.78, -0.4, 0, 'YXZ');
  kit.add(webPanel);
  // Dense rectangle points so the Catmull-Rom tube hugs the panel edge instead of bulging out.
  const framePts: V3[] = [];
  for (const [ax, ay, bx, by] of [[-1.8, -1.12, 1.8, -1.12], [1.8, -1.12, 1.8, 1.12], [1.8, 1.12, -1.8, 1.12], [-1.8, 1.12, -1.8, -1.12]]) {
    for (let k = 0; k < 6; k++) framePts.push([ax + ((bx - ax) * k) / 6, ay + ((by - ay) * k) / 6, 0]);
  }
  const webFrame = kit.neonTube(framePts, SUN, { radius: 0.022, closed: true });
  webFrame.position.copy(webPanel.position);
  webFrame.rotation.copy(webPanel.rotation);

  // ---------------- Behind the head: marquee; lanterns and fireflies in the side woods.
  // Bare neon letters (no plate) so the title glows against the dark wood instead of reading as a grey card.
  const marquee = kit.neonSign('FOOD-WEB FOREST', [0, 0.5, -6.8], { height: 0.56, color: SUN, backing: false });
  marquee.rotation.x = -0.8;
  // A back row of shrubs and fungi behind the head
  const backShrubMat = stdMat(kit, '#2c5e38', { emissive: '#3f8a46', ei: 0.02, rough: 0.85 });
  for (let i = 0; i < 9; i++) {
    const x = -4 + i;
    if (Math.abs(x) < 1.7) continue;
    const m = new T.Mesh(new T.IcosahedronGeometry(0.3 + R() * 0.16, 1), backShrubMat);
    m.position.set(x + (R() - 0.5) * 0.4, GY + 0.12, -6.75 - R() * 0.5);
    m.scale.set(1.3, 0.55, 1);
    kit.add(m);
  }
  const lanterns = [
    kit.lantern([-4.4, 1.7, 3.6], SUN, 0.2),
    kit.lantern([4.4, 1.7, 3.6], MINT, 0.2),
  ];
  kit.pole([-4.4, 0, 3.6], 1.45);
  kit.pole([4.4, 0, 3.6], 1.45);
  // Fireflies stay over the side woods (never over the glass, where they could pass for the ball).
  const fireflies = kit.motes({ x0: -10, x1: -3.7, y0: GY + 0.2, y1: 4.5, z0: -9, z1: 6 }, 80, '#ffe9a0', { speed: 0.08, size: 0.11 });
  const firefliesR = kit.motes({ x0: 3.7, x1: 10, y0: GY + 0.2, y1: 4.5, z0: -9, z1: 6 }, 80, '#ffe9a0', { speed: 0.08, size: 0.11 });
  const pollen = kit.motes({ x0: -8.5, x1: -4, y0: GY, y1: 3, z0: -2.5, z1: 3.5 }, 60, LEAF, { speed: 0.1, size: 0.07 });
  for (const [x, z, s] of [[-4.8, -2.4, 0.35], [-8.2, 3.4, 0.5], [5.0, -3.4, 0.4], [8.4, 3.2, 0.45]] as V3[]) kit.rock([x, GY + s * 0.3, z], s, '#4b5a52', Math.round(x * 10));
  // Wonderlight bursts over the meadow and the hollow, where the camera can see them.
  const sparks = kit.fireworks({ x0: -8.2, x1: -6.4, y0: 2.2, y1: 3.0, z: -1.8 }, [SUN, LEAF, MINT]);
  const sparksR = kit.fireworks({ x0: 6.4, x1: 8.2, y0: 2.2, y1: 3.0, z: -1.2 }, [SPORE, SUN, MINT]);

  // Lights (3 max): warm sun on the meadow, violet on the hollow, gold point at the pyramid.
  const sunSpot = kit.spot([-4.5, 7, 2.5], [-6.3, 0, 0.2], SUN, 30, 0.42);
  const sporeSpot = kit.spot([4.8, 6, 3.2], [6.0, 0, 0.4], SPORE, 22, 0.45);

  // Gentle idle motion
  kit.animate((t) => {
    rabbit.position.y = GY + Math.abs(Math.sin(t * 1.6)) * 0.08;
    owlTreeOwl.rotation.y = -0.5 + Math.sin(t * 0.5) * 0.35;
    topHawk.rotation.y = Math.sin(t * 0.7) * 0.4;
  });
  const labelLit = new T.Color('#2a1804');
  const labelDim = new T.Color('#9a8458');
  // Each tier carries about a tenth of the one below (shown as a fading glow).
  const tierGlow = [0.6, 0.26, 0.11, 0.045];

  return {
    update(t, _dt, level, energy) {
      const s1 = kit.stage(level, 0, 1);
      const s2 = kit.stage(level, 1, 2);
      const s3 = kit.stage(level, 2, 3);
      const s4 = kit.stage(level, 3.2, 4);
      far.repaint(level);
      paintWeb(level);
      // Producers wake first: sunbeams, grass, flowers.
      beamMat.opacity = 0.025 + 0.06 * s1;
      grassMat.emissiveIntensity = 0.02 + 0.22 * s1;
      flowerMat.emissiveIntensity = 0.05 + 1.1 * s1 * (0.85 + 0.15 * energy);
      shrubMat.emissiveIntensity = 0.02 + 0.2 * s1;
      backShrubMat.emissiveIntensity = 0.02 + 0.1 * s2 + 0.35 * s4;
      leafMat.emissiveIntensity = 0.02 + 0.1 * s2 + 0.45 * s4;
      prodSign.setLit(0.2 + 0.8 * s1);
      sunSign.setLit(0.15 + 0.85 * s1);
      pollen.setLit(0.1 + 0.6 * s1);
      if (sunSpot) sunSpot.intensity = 12 + 26 * s1;
      // Decomposers glow when matter starts to cycle (mission 2).
      capMats[0].emissiveIntensity = 0.06 + 1.4 * s2;
      capMats[1].emissiveIntensity = 0.06 + 1.1 * s2;
      hollowMat.emissiveIntensity = 0.05 + 1.3 * s2;
      myc1.setLit(0.03 + 0.28 * s2);
      myc2.setLit(0.03 + 0.28 * s2);
      decSign.setLit(0.2 + 0.8 * s2);
      spores.setLit(0.1 + 0.7 * s2);
      if (sporeSpot) sporeSpot.intensity = 8 + 22 * s2;
      // Energy pyramid tiers wake from the base up (plain loops: no per-frame closures).
      for (let i = 0; i < tierMats.length; i++) {
        const on = kit.stage(level, 0.3 + i * 0.85, 1.1 + i * 0.85);
        tierMats[i].emissiveIntensity = 0.03 + tierGlow[i] * on * (0.9 + 0.1 * energy) * (1 + 0.25 * s4);
        energyOrbs[i].setLit(0.04 + 0.5 * on);
        labelMats[i].color.copy(on > 0.5 ? labelLit : labelDim);
      }
      heat.setLit(0.15 + 0.6 * s3);
      pyrSign.setLit(0.15 + 0.85 * s3);
      if (pyrLight) pyrLight.intensity = 0.4 + 2.2 * s3 + 1.2 * s4;
      // Wonderlight: the whole web glows.
      webMat.color.setScalar(0.5 + 0.5 * s1 + 0.9 * s4);
      webFrame.setLit(0.05 + 0.3 * s3 + 0.65 * s4);
      marquee.setLit(0.15 + 0.85 * kit.stage(level, 1.5, 2.5));
      for (let i = 0; i < lanterns.length; i++) lanterns[i].setLit(0.15 + 0.4 * kit.stage(level, i * 0.7, i * 0.7 + 1));
      fireflies.setLit(0.15 + 0.35 * s2 + 0.5 * s4);
      firefliesR.setLit(0.15 + 0.35 * s2 + 0.5 * s4);
      const burst = kit.stage(level, 3.6, 4) * 0.8;
      sparks.setLit(burst);
      sparksR.setLit(burst);
    },
    celebrate(p) {
      const pulse = Math.sin(p * Math.PI);
      sparks.setLit(pulse);
      sparksR.setLit(pulse);
      fireflies.setLit(0.5 + 0.5 * pulse);
      firefliesR.setLit(0.5 + 0.5 * pulse);
      webFrame.setLit(0.4 + 0.6 * pulse);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const ROOM_TIER_GLOW = [1.2, 0.55, 0.25, 0.1];
const CELEBRATE_COLORS = [SUN, LEAF, SPORE, MINT];

const forestRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const floor = new T.Mesh(new T.CircleGeometry(0.9, 32), stdMat(kit, '#2c5a2c', { rough: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.006, -0.05);
  kit.add(floor);
  // A little glowing food web on the back wall (arrows from food to eater).
  const webTex = canvasTexture(kit, 320, 200, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(6,16,14,0.85)';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 18);
    ctx.fill();
    const n: [number, number][] = [[50, 165], [150, 170], [250, 165], [70, 95], [180, 100], [120, 35], [250, 40]];
    for (const [a, b] of [[0, 3], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5], [4, 6]] as [number, number][]) arrow(ctx, [n[a], n[b]], SUN, 0.9, 4);
    n.forEach(([x, y], i) => {
      ctx.fillStyle = i < 3 ? LEAF : i < 5 ? MINT : EMBER;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, TAU);
      ctx.fill();
    });
  });
  const webMat = kit.track(new T.MeshBasicMaterial({ map: webTex, transparent: true, color: '#808080' }));
  const web = new T.Mesh(new T.PlaneGeometry(0.8, 0.5), webMat);
  web.position.set(0.32, 1.18, -0.8);
  kit.add(web);
  const trunk = new T.Mesh(new T.CylinderGeometry(0.05, 0.08, 0.7, 8), stdMat(kit, '#5a3d2a'));
  trunk.position.set(-0.72, 0.35, -0.5);
  kit.add(trunk);
  const leafMat = stdMat(kit, '#3d7f44', { emissive: '#3f9a4a', ei: 0.05 });
  for (const [x, y, z, s] of [[-0.72, 0.86, -0.5, 0.25], [-0.58, 0.74, -0.42, 0.17], [-0.85, 0.72, -0.55, 0.17]] as [number, number, number, number][]) {
    const m = new T.Mesh(new T.IcosahedronGeometry(s, 1), leafMat);
    m.position.set(x, y, z);
    kit.add(m);
  }
  const tierMats: THREE.MeshStandardMaterial[] = [];
  [0.56, 0.42, 0.28, 0.14].forEach((w, i) => {
    const m = stdMat(kit, '#2e2008', { emissive: '#ffae2e', ei: 0.05 });
    const box = new T.Mesh(new T.BoxGeometry(w, 0.1, w), m);
    box.position.set(-0.08, 0.05 + i * 0.1, -0.52);
    box.rotation.y = 0.5;
    kit.add(box);
    tierMats.push(m);
  });
  const log = new T.Mesh(new T.CylinderGeometry(0.1, 0.11, 0.62, 14), stdMat(kit, '#5b3e2a'));
  log.rotation.z = Math.PI / 2;
  log.position.set(0.58, 0.1, -0.42);
  kit.add(log);
  const capMat = stdMat(kit, '#6d4aa8', { emissive: SPORE, ei: 0.1 });
  const stemMat = stdMat(kit, '#efe2c8');
  for (const [x, z, s] of [[0.42, -0.26, 0.07], [0.56, -0.22, 0.05], [0.78, -0.28, 0.06]] as V3[]) {
    const stem = new T.Mesh(new T.CylinderGeometry(s * 0.3, s * 0.4, s * 1.6, 8), stemMat);
    stem.position.set(x, s * 0.8, z);
    const cap = new T.Mesh(new T.SphereGeometry(s, 12, 6, 0, TAU, 0, Math.PI / 2), capMat);
    cap.position.set(x, s * 1.55, z);
    kit.add(stem);
    kit.add(cap);
  }
  const bunny = critter(kit, 'rabbit', [-0.4, 0, -0.32], 0.17, 0.7);
  const glow = kit.cloudOfPoints([0, 0.9, -0.2], 0.7, 50, '#ffe9a0');
  return {
    update(t, lit) {
      leafMat.emissiveIntensity = 0.05 + 0.35 * lit;
      capMat.emissiveIntensity = 0.1 + 1.4 * lit;
      for (let i = 0; i < tierMats.length; i++) tierMats[i].emissiveIntensity = 0.05 + ROOM_TIER_GLOW[i] * lit;
      webMat.color.setScalar(0.35 + 1.1 * lit);
      glow.setLit(lit * 0.8);
      glow.rotation.y = kit.reducedMotion ? 0 : t * 0.15;
      bunny.position.y = kit.reducedMotion ? 0 : Math.abs(Math.sin(t * 1.8)) * 0.03;
    },
  };
};

// ---------------------------------------------------------------- table definition

export const L06: TableDef = {
  lessonId: 'L06',
  signature: 'A decomposer portal that carries matter back to the producer meadow',
  ballRole: 'The Wonderball is only a game token tracing one path through the web; in a real forest, matter moves as countless atoms passed from food to eater and back through decomposers, while energy leaves as heat at every step.',
  theme: {
    bg: ['#173a30', '#0c1d18'],
    rail: '#d3e6c6',
    railHighlight: '#ffffff',
    lampOn: SUN,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: EMBER,
    accent2: LEAF,
    bumperCap: '#b7e08c',
    bumperRing: '#24412c',
    flipper: '#ffe2a0',
    ink: IVORY,
    ramp: 'rgba(143,209,106,0.18)',
    trail: MINT,
  },
  lines: {
    intro: 'Welcome to the Food-Web Forest, where every meal moves matter and energy from the food to the eater. Light up who eats whom and watch the whole wood wake!',
    quark: '"Decomposers recycle everything, so the energy in a fallen leaf must go back into the soil to be used again... right?" Professor Quark wonders.',
    pipTip: 'A gentle plunge can tag the OWL perch for a skill shot. Then aim the right flipper up and left at GRASS, CLOVER and SHRUB.',
  },
  build,
  skillShot: 'owl_target',
  shots: [
    { id: 'meadow', label: 'Producer Meadow', on: [{ type: 'drop', group: 'producers' }], insert: 'ins_meadow' },
    { id: 'critters', label: 'Critter bumpers', on: [{ type: 'bumper', group: 'consumers' }], insert: 'ins_critters' },
    { id: 'canopy', label: 'Canopy Walk', on: [{ type: 'ramp', id: 'canopy_ramp' }], insert: 'ins_canopy' },
    { id: 'den', label: 'Decomposer Den', on: [{ type: 'portal', id: 'den_portal' }], insert: 'ins_den' },
    { id: 'predator', label: 'Predator perches', on: [{ type: 'target', group: 'predators' }], insert: 'ins_hawk' },
    { id: 'sunOrbit', label: 'Sunlight in', on: [{ type: 'shot', id: 'sun_orbit_sw' }, { type: 'spinner', id: 'sun_spinner' }], insert: 'ins_orbit' },
    { id: 'pocket', label: 'Web Heart', on: [{ type: 'saucer', id: 'web_heart' }], insert: 'ins_pocket' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Who Eats Whom?',
      brief: 'Wake the producers in the meadow, then light a feeding arrow from a plant to a critter that eats it.',
      objectiveIds: ['L06-O1'],
      stages: [
        { kind: 'collect', text: 'Wake the producers: GRASS, CLOVER, SHRUB', match: { type: 'drop', group: 'producers' }, count: 3, distinct: true, lamps: ['meadow_1', 'meadow_2', 'meadow_3'] },
        { kind: 'shots', text: 'Light an arrow: a producer, then a critter', shots: ['meadow', 'critters'], order: 'sequence' },
        { kind: 'discover', text: 'Shoot the Web Heart to read the arrow', pocket: 'web_heart', questions: 1 },
      ],
      discovery: 'Producers such as grass make their own food using energy from sunlight. In a food web, each arrow starts at the food and points to the eater.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Matter Comes Back Around',
      brief: 'Follow the arrows from producer to consumer to decomposer, then ride the Den portal as matter returns to the meadow.',
      objectiveIds: ['L06-O2'],
      stages: [
        { kind: 'shots', text: 'Producer, consumer, decomposer: Meadow, Canopy, Den', shots: ['meadow', 'canopy', 'den'], order: 'sequence' },
        { kind: 'discover', text: 'Shoot the Web Heart to model the cycle', pocket: 'web_heart', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'Decomposers break down wastes and remains, releasing carbon dioxide and nutrients that producers take in again. Matter cycles, but energy does not: decomposers use the energy in remains to live, and it leaves as heat.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Energy Pyramid',
      brief: 'Gather sunlight, then pass energy up the chain to a predator perch and predict how much is left at the top.',
      objectiveIds: ['L06-O3'],
      stages: [
        { kind: 'collect', text: 'Gather sunlight: spin the Sunlight spinner 5x', match: { type: 'spinner', id: 'sun_spinner' }, count: 5, preview: ['sunOrbit'] },
        { kind: 'shots', text: 'Pass it up: Meadow, Canopy, a predator perch', shots: ['meadow', 'canopy', 'predator'], order: 'sequence' },
        { kind: 'discover', text: 'Shoot the Web Heart to weigh the pyramid', pocket: 'web_heart', questions: 1 },
      ],
      discovery: 'In the 10 percent model, only about a tenth of the energy at one level reaches the next. Most of the rest is used for living and leaves as heat.',
      reward: 'multiball',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'The Glowing Web',
    brief: 'Send sunlight in, then light the producers, consumers, decomposers and predators of the web. Then bring the Wonderball home.',
    stages: [
      { kind: 'shots', text: 'Light the web: Sun, Meadow, Canopy, Den, Perch', shots: ['sunOrbit', 'meadow', 'canopy', 'den', 'predator'], order: 'any' },
      { kind: 'discover', text: 'Bring it home to the Web Heart', pocket: 'web_heart', questions: 2, objectiveIds: ['L06-O1', 'L06-O2', 'L06-O3', 'L06-O4'] },
    ],
    celebration: 'The whole web glows: sunlight flows in, matter loops back through the decomposers, and energy leaves as heat at every step. The forest Wonderlight is yours!',
  },
  set: forestSet,
  room: forestRoom,
  icons: {
    rabbit(ctx, s) {
      ctx.scale(1.32, 1.32);
      ctx.beginPath();
      ctx.ellipse(s * 0.12, s * 0.3, s * 0.56, s * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.4, -s * 0.04, s * 0.28, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-s * 0.52, -s * 0.56, s * 0.09, s * 0.34, -0.28, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-s * 0.3, -s * 0.6, s * 0.09, s * 0.34, 0.18, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.7, s * 0.18, s * 0.13, 0, TAU);
      ctx.fill();
    },
    mouse(ctx, s) {
      ctx.scale(1.32, 1.32);
      ctx.beginPath();
      ctx.ellipse(s * 0.08, s * 0.18, s * 0.55, s * 0.36, -0.1, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, s * 0.05);
      ctx.lineTo(-s * 0.82, s * 0.2);
      ctx.lineTo(-s * 0.4, s * 0.4);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.22, -s * 0.24, s * 0.22, 0, TAU);
      ctx.fill();
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.6, s * 0.28);
      ctx.quadraticCurveTo(s * 0.95, s * 0.1, s * 0.8, -s * 0.35);
      ctx.stroke();
    },
    hopper(ctx, s) {
      ctx.scale(1.32, 1.32);
      ctx.beginPath();
      ctx.ellipse(0, s * 0.05, s * 0.62, s * 0.18, -0.15, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.62, -s * 0.02, s * 0.17, 0, TAU);
      ctx.fill();
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.1, s * 0.05);
      ctx.lineTo(s * 0.45, -s * 0.45);
      ctx.lineTo(s * 0.75, s * 0.45);
      ctx.stroke();
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.15);
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.7, -s * 0.15, -s * 0.8);
      ctx.moveTo(-s * 0.3, s * 0.15);
      ctx.lineTo(-s * 0.45, s * 0.5);
      ctx.stroke();
    },
    web(ctx, s) {
      ctx.scale(1.32, 1.32);
      const pts: [number, number][] = [[0, -0.75], [0.7, -0.2], [0.45, 0.65], [-0.45, 0.65], [-0.7, -0.2]];
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
      ctx.closePath();
      for (const [x, y] of pts) {
        ctx.moveTo(0, 0);
        ctx.lineTo(x * s, y * s);
      }
      ctx.stroke();
      for (const [x, y] of [[0, 0], ...pts]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, s * 0.16, 0, TAU);
        ctx.fill();
      }
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      if (reduced) return;
      // Fireflies over the woodland and spores drifting up from the Den.
      drift(ctx, 5, 16, t, '#ffe9a0', [40, 120, 540, 780], 6, 1.6, 0.25 + 0.35 * stage(level, 0.5, 2) + 0.2 * energy);
      const dec = stage(level, 1.2, 2.1);
      if (dec > 0.01) drift(ctx, 9, 10, t, SPORE, [296, 300, 366, 540], 10, 1.4, 0.45 * dec);
      if (level >= 3.9) drift(ctx, 13, 20, t * 1.3, SUN, [60, 60, 540, 800], 14, 2, 0.35);
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.45;
      const g = ctx.createRadialGradient(235, 448, 10, 235, 448, 460);
      g.addColorStop(0, rgba(SUN, 0.8));
      g.addColorStop(0.5, rgba(LEAF, 0.25));
      g.addColorStop(1, rgba(LEAF, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU + t * 0.35;
        const d = 50 + p * 300;
        glowDot(ctx, 235 + Math.cos(a) * d, 448 + Math.sin(a) * d * 0.85, 9, CELEBRATE_COLORS[i % 4], 1 - p);
      }
    },
  },
};

export default L06;
