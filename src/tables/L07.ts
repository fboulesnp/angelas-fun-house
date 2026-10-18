// Lesson 7 — Global Cycles of Matter — "Planet Carousel"
// A twilight carousel that turns into a miniature planet. Three reservoir saucers (OCEAN,
// ATMOSPHERE, SOIL & ROCK) hold the Wonderball for a moment and kick it into different
// process lanes: the ocean evaporates it up the left lane and over the top, the atmosphere
// rains it down the right lane, the soil sends it back across to the left flipper. A
// Respiration Ramp carries matter from the living world up into the air, nitrogen fixers
// (soil bacteria and lightning) turn N₂ into usable compounds, and three living bumpers ride
// the carousel around the Globe Pocket. Every reservoir can be reached by more than one route.

import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import { REGIONS, type RoomBuilder, type SetBuilder } from '../game/render3d/setKit.ts';
import type { Mesh, MeshStandardMaterial } from 'three';
import {
  TAU, drift, glowDot, hills, neonPath, neonText, rgba, rng, stage, stars, vgrad, mix,
} from '../game/render/art.ts';

type V3 = [number, number, number];

const NIGHT = '#16264f';
const DEEP = '#0c1a2e';
const SEA = '#2a86c4';
const SEA_DARK = '#123d66';
const LAND = '#3f9b6a';
const SOIL = '#8a5a3c';
const GOLD = '#FFC75B';
const CORAL = '#FF8F6B';
const MINT = '#71E3CF';
const SKY = '#9fe0ff';
const IVORY = '#FFF7E7';

// ---------------------------------------------------------------- playfield geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'both' });

  // --- Sky lanes: what the air reservoir holds ---
  const skyXs = [238, 286, 334];
  const skyLabels = ['H₂O', 'CO₂', 'N₂'];
  skyXs.forEach((x, i) => b.rollover(`sky_${i + 1}`, x, 112, { group: 'sky', label: skyLabels[i] }));
  for (const gx of [214, 262, 310, 358]) {
    b.wall([[gx, 90], [gx, 134]], { r: 3 });
    b.post(gx, 88, 5);
  }

  // --- ATMOSPHERE reservoir under the CO₂ lane; its eject rains into the right lane ---
  // (Its name is painted beside it: a floor label would sit hidden behind the decomposer bumper.)
  b.saucer('air', 286, 192, { group: 'reservoir', ejectDeg: 17, ejectSpeed: 720, captureMaxSpeed: 2200, icon: 'cloud' });
  // Storm cloud bumper above the lightning target.
  b.bumper('storm_cloud', 452, 200, { r: 22, group: 'storm', icon: 'cloud' });

  // --- The living carousel: three organism bumpers ringing the planet ---
  b.bumper('life_decomposer', 286, 296, { r: 25, group: 'life', icon: 'mushroom' });
  b.bumper('life_plant', 226, 414, { r: 25, group: 'life', icon: 'sprout' });
  b.bumper('life_animal', 346, 414, { r: 25, group: 'life', icon: 'rabbit' });
  // Globe Pocket under the carousel, in a ball-wide round-topped cup so shots from either flipper settle in.
  b.wall([[258, 512], [258, 488]], { r: 4 });
  b.arc(286, 488, 28, 180, 360, { r: 4, segments: 14 });
  b.wall([[314, 488], [314, 512]], { r: 4 });
  b.saucer('globe', 286, 490, { role: 'pocket', ejectDeg: 100, ejectSpeed: 760, captureMaxSpeed: 2800, label: 'GLOBE POCKET', icon: 'globe' });

  // --- Left lane: EVAPORATION (up). The OCEAN sits at its foot and ejects straight up it ---
  b.wall([[78, 604], [78, 372]], { id: 'evap_inner', r: 3 });
  b.post(78, 368, 5);
  b.post(78, 606, 5);
  b.shotSwitch('evap_sw', 51, 470, -90);
  // It also catches balls arriving down the lane, so a strong launch rides one water-cycle route.
  // No floor label: centred under the saucer it would sit beneath the wall rail, so OCEAN is
  // painted into the bay art instead.
  b.saucer('ocean', 46, 652, { group: 'reservoir', ejectDeg: -90, ejectSpeed: 2400, captureMaxSpeed: 3300, icon: 'wave' });
  // One-way flap, not a wall: lane exits still deflect into play, but the left kickback can
  // fire up through it (the ocean then catches the ball and evaporates it up the lane).
  b.gate('left_deflect', [FRAME.left, 700], [60, 748], -90);

  // --- Right lane: PRECIPITATION (down), with SOIL & ROCK at its foot passing back to the left flipper ---
  b.wall([[496, 380], [496, 640]], { id: 'rain_inner', r: 3 });
  b.post(496, 376, 5);
  b.post(496, 642, 5);
  b.spinner('rain_spin', [500, 480], [544, 480], { label: 'RAIN' });
  b.shotSwitch('rain_sw', 522, 560, 90);
  b.saucer('soil', 522, 690, { group: 'reservoir', ejectDeg: 155, ejectSpeed: 800, captureMaxSpeed: 2700, label: 'SOIL', icon: 'rock' });
  // One-way flap so the right kickback reaches the SOIL saucer instead of bouncing back down.
  b.gate('right_deflect', [FRAME.laneSep, 732], [520, 774], -90);

  // --- RESPIRATION ramp: climbs from the living world and drops the ball into the ATMOSPHERE ---
  b.wall([[144, 706], [161, 652]], { r: 3 });
  b.wall([[228, 700], [199, 652]], { r: 3 });
  b.ramp('resp_ramp', {
    path: [[180, 652], [178, 520], [172, 400], [168, 310], [184, 238], [222, 202], [262, 192]],
    width: 38,
    footprintTo: 2,
    peak: 80,
    label: 'RESPIRATION',
  });
  // Peaked roof over the end of the ramp footprint so nothing can rest on it.
  b.wall([[151, 402], [172, 380], [193, 402]], { r: 3, style: 'invisible' });

  // --- Nitrogen fixers: BACTERIA (in soil and root nodules) and LIGHTNING (in the sky) ---
  b.target('fix_bacteria', [404, 520], [428, 538], { group: 'fix', label: 'BACTERIA' });
  b.target('fix_lightning', [400, 300], [424, 318], { group: 'fix', label: 'LIGHTNING' });

  // --- Inserts that preview shots ---
  b.insert('ins_evap', 51, 560, { deg: -90, label: 'VAPOR', color: SKY });
  b.insert('ins_ocean', 98, 700, { deg: -135, color: SKY });
  b.insert('ins_rain', 522, 420, { deg: 90, label: 'RAIN', color: SKY });
  b.insert('ins_soil', 472, 712, { deg: -40, color: CORAL });
  b.insert('ins_ramp', 190, 736, { deg: -95, label: 'RESPIRE' });
  b.insert('ins_pocket', 286, 566, { deg: -90 });
  b.insert('ins_air', 244, 236, { deg: -40, color: SKY });
  b.insert('ins_fix', 380, 580, { deg: -50, label: 'FIX N₂', color: MINT });
  b.insert('ins_life', 286, 372, { shape: 'star', size: 12, color: MINT });
}

// ---------------------------------------------------------------- printed playfield art

/** Blobby continent made of overlapping circles (deterministic). */
function continent(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, s: number, color: string) {
  const r = rng(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU;
    const d = r() * s * 0.6;
    ctx.moveTo(x + Math.cos(a) * d + s * 0.45, y + Math.sin(a) * d);
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, s * (0.3 + r() * 0.25), 0, TAU);
  }
  ctx.fill();
}

/** Small chevron arrow (process direction), drawn as a glowing stroke. */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, deg: number, color: string, lit: number) {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x - ux * size + uy * size * 0.8, y - uy * size - ux * size * 0.8);
    ctx.lineTo(x, y);
    ctx.lineTo(x - ux * size - uy * size * 0.8, y - uy * size + ux * size * 0.8);
  }, color, lit, 3);
}

function verticalWord(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function paintBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1.1); // reservoirs wake
  const s2 = stage(level, 1.2, 2.1); // water + carbon processes
  const s3 = stage(level, 2.2, 3.1); // nitrogen + carousel lights
  const s4 = stage(level, 3.4, 4); // Wonderlight: a living planet

  // Twilight sky fading to deep sea at the apron.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1b2d60'], [0.3, mix(NIGHT, '#1d4a73', s1)], [0.62, '#123b4d'], [1, DEEP]]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 7, 80, [36, 20, 564, 270], IVORY);

  // Atmosphere: soft cloud banks under the arch, brighter as the reservoirs wake.
  const cloudA = 0.07 + 0.12 * s1;
  for (const [x, y, s] of [[120, 205, 46], [190, 150, 38], [392, 140, 44], [470, 230, 40], [300, 230, 34]] as [number, number, number][]) {
    ctx.fillStyle = rgba('#dff3ff', cloudA);
    ctx.beginPath();
    ctx.arc(x - s * 0.6, y + s * 0.1, s * 0.55, 0, TAU);
    ctx.arc(x, y - s * 0.15, s * 0.7, 0, TAU);
    ctx.arc(x + s * 0.65, y + s * 0.1, s * 0.5, 0, TAU);
    ctx.fill();
  }
  // The AIR reservoir's name beside its saucer.
  neonText(ctx, 'AIR', 338, 194, 15, SKY, 0.35 + 0.65 * s1);
  // Aurora ribbons in the Wonderlight sky.
  if (s4 > 0.01) {
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = rgba([MINT, SKY, '#c7a7ff'][k], 0.16 * s4);
      ctx.lineWidth = 16 - k * 4;
      ctx.beginPath();
      for (let x = 40; x <= 560; x += 10) ctx.lineTo(x, 70 + k * 22 + Math.sin(x / 60 + k) * 14);
      ctx.stroke();
    }
  }

  // The planet: a globe behind the carousel of living bumpers.
  const gx = 286;
  const gy = 372;
  const gr = 128;
  ctx.save();
  ctx.beginPath();
  ctx.arc(gx, gy, gr, 0, TAU);
  ctx.clip();
  ctx.fillStyle = vgrad(ctx, gy - gr, gy + gr, [[0, mix('#24476b', SEA, s1)], [1, mix('#14263f', SEA_DARK, s1)]]);
  ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  const landCol = mix('#2c4a48', LAND, 0.35 + 0.65 * s1);
  continent(ctx, 3, gx - 62, gy - 40, 58, landCol);
  continent(ctx, 11, gx + 58, gy + 22, 52, landCol);
  continent(ctx, 23, gx - 20, gy + 78, 40, mix('#3b3a36', SOIL, 0.4 + 0.6 * s1));
  // polar ice caps
  ctx.fillStyle = rgba(IVORY, 0.12 + 0.25 * s1);
  ctx.beginPath();
  ctx.ellipse(gx, gy - gr + 8, 70, 22, 0, 0, TAU);
  ctx.ellipse(gx, gy + gr - 6, 56, 18, 0, 0, TAU);
  ctx.fill();
  // terminator shading for roundness
  const sh = ctx.createRadialGradient(gx - 40, gy - 50, 20, gx, gy, gr);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)');
  sh.addColorStop(0.7, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = sh;
  ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  ctx.restore();
  // atmosphere halo
  ctx.save();
  ctx.strokeStyle = rgba(SKY, 0.12 + 0.3 * s1 + 0.3 * s4);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(gx, gy, gr + 4, 0, TAU);
  ctx.stroke();
  ctx.restore();

  // Carousel rim: scalloped canopy band and a ring of bulbs around the planet.
  const rr = gr + 22;
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * TAU;
    const a1 = ((i + 1) / 24) * TAU;
    ctx.fillStyle = rgba(i % 2 ? CORAL : IVORY, 0.1 + 0.1 * s1 + 0.15 * s3);
    ctx.beginPath();
    ctx.arc(gx, gy, rr + 8, a0, a1);
    ctx.arc(gx, gy, rr - 6, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const bx = gx + Math.cos(a) * (rr + 1);
    const by = gy + Math.sin(a) * (rr + 1);
    ctx.fillStyle = s3 > 0.02 ? rgba(i % 3 ? GOLD : CORAL, 0.35 + 0.6 * s3) : 'rgba(60,58,80,0.8)';
    ctx.beginPath();
    ctx.arc(bx, by, 2.6, 0, TAU);
    ctx.fill();
    if (s3 > 0.02) glowDot(ctx, bx, by, 9, i % 3 ? GOLD : CORAL, 0.45 * s3);
  }

  // Land between the slings: rolling hills, darker toward the apron.
  hills(ctx, 5, 700, 26, rgba(mix('#1d3b33', LAND, 0.3 * s1 + 0.3 * s4), 0.55), 4);
  hills(ctx, 9, 760, 20, rgba('#10251f', 0.6), 5);

  // OCEAN (left): a curving bay of waves at the foot of the evaporation lane.
  const shore = () => {
    ctx.beginPath();
    ctx.moveTo(24, 572);
    ctx.bezierCurveTo(64, 574, 92, 600, 104, 640);
    ctx.bezierCurveTo(116, 684, 156, 702, 150, 748);
    ctx.bezierCurveTo(144, 792, 96, 812, 62, 842);
  };
  ctx.save();
  shore();
  ctx.lineTo(24, 884);
  ctx.closePath();
  ctx.clip();
  for (let k = 0; k < 6; k++) {
    const y = 600 + k * 30;
    ctx.fillStyle = rgba(mix(SEA_DARK, SEA, 0.3 + 0.7 * s1), 0.3 + k * 0.06);
    ctx.beginPath();
    ctx.moveTo(24, 890);
    for (let x = 24; x <= 170; x += 6) ctx.lineTo(x, y + Math.sin(x / 14 + k * 1.3) * 5);
    ctx.lineTo(170, 890);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Surf line along the shore.
  ctx.save();
  ctx.strokeStyle = rgba('#dff3ff', 0.18 + 0.3 * s1);
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  shore();
  ctx.stroke();
  ctx.restore();
  neonText(ctx, 'OCEAN', 100, 776, 15, SKY, 0.35 + 0.65 * s1);

  // SOIL & ROCK (right): strata at the foot of the precipitation lane, with crystals.
  const mound = () => {
    ctx.beginPath();
    ctx.moveTo(548, 596);
    ctx.bezierCurveTo(500, 600, 452, 622, 438, 664);
    ctx.bezierCurveTo(424, 712, 452, 774, 488, 812);
    ctx.lineTo(510, 846);
    ctx.lineTo(548, 884);
  };
  ctx.save();
  mound();
  ctx.closePath();
  ctx.clip();
  const strata = ['#5d3b28', '#73492f', '#8a5a3c', '#6b5b4e', '#4f4140'];
  strata.forEach((c, k) => {
    ctx.fillStyle = rgba(mix('#2b2a33', c, 0.4 + 0.6 * s1), 0.58);
    ctx.beginPath();
    ctx.moveTo(424, 890);
    for (let x = 424; x <= 548; x += 6) ctx.lineTo(x, 610 + k * 40 + Math.sin(x / 22 + k) * 6);
    ctx.lineTo(548, 890);
    ctx.closePath();
    ctx.fill();
  });
  const rc = rng(31);
  for (let i = 0; i < 14; i++) {
    const x = 440 + rc() * 100;
    const y = 660 + rc() * 150;
    ctx.fillStyle = rgba(['#c9b79c', '#9c8670', '#e3d6c2'][i % 3], 0.35 + 0.25 * s1);
    ctx.beginPath();
    ctx.ellipse(x, y, 4 + rc() * 4, 3 + rc() * 2, rc() * 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Grass-topped rim of the soil bank.
  ctx.save();
  ctx.strokeStyle = rgba(mix('#2c4a3a', LAND, 0.3 + 0.7 * s1), 0.55);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(548, 596);
  ctx.bezierCurveTo(500, 600, 452, 622, 438, 664);
  ctx.bezierCurveTo(424, 712, 452, 774, 488, 812);
  ctx.stroke();
  ctx.restore();
  // Roots reaching from the hills into the soil (where nitrogen-fixing bacteria live).
  ctx.save();
  ctx.strokeStyle = rgba('#c9a27a', 0.25 + 0.3 * s1);
  ctx.lineWidth = 2;
  const rroot = rng(17);
  for (let i = 0; i < 6; i++) {
    let x = 400 + i * 8;
    let y = 600;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rroot() - 0.3) * 14;
      y += 12 + rroot() * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Root nodules: glowing bacteria homes (nitrogen fixation lights up in mission 3).
  for (const [x, y] of [[406, 640], [424, 664], [446, 650], [414, 690]] as [number, number][]) {
    glowDot(ctx, x, y, 10, MINT, 0.15 + 0.6 * s3);
    ctx.fillStyle = rgba(MINT, 0.3 + 0.6 * s3);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, TAU);
    ctx.fill();
  }

  // --- Process art ---
  const proc = 0.15 + 0.85 * s2;
  // Evaporation: chevrons rising up the left lane.
  for (let y = 620; y >= 390; y -= 46) chevron(ctx, 51, y, 9, -90, SKY, s2 * (0.6 + 0.4 * ((620 - y) / 230)));
  verticalWord(ctx, 'EVAPORATION', 51, 450, 13, SKY, 0.25 + 0.55 * proc);
  // Precipitation: rain streaks falling down the right lane.
  ctx.save();
  ctx.lineCap = 'round';
  const rr2 = rng(41);
  for (let i = 0; i < 26; i++) {
    const x = 504 + rr2() * 38;
    const y = 390 + rr2() * 240;
    ctx.strokeStyle = rgba(SKY, 0.12 + 0.45 * s2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 12);
    ctx.stroke();
  }
  ctx.restore();
  verticalWord(ctx, 'PRECIPITATION', 522, 560, 12, SKY, 0.25 + 0.55 * proc);
  // Respiration: CO₂ bubbles drifting up beside the ramp toward the sky.
  const rb = rng(57);
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const x = 120 + Math.sin(t * 7) * 10 + rb() * 6;
    const y = 640 - t * 400;
    ctx.strokeStyle = rgba(GOLD, 0.15 + 0.6 * s2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 3 + rb() * 3, 0, TAU);
    ctx.stroke();
  }
  neonText(ctx, 'CO₂', 116, 300, 14, GOLD, s2);
  verticalWord(ctx, 'RESPIRATION', 104, 470, 12, GOLD, 0.25 + 0.6 * proc);
  // Nitrogen fixation: lightning bolt under the storm cloud, bacteria rods by the target.
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(462, 236);
    ctx.lineTo(446, 262);
    ctx.lineTo(458, 262);
    ctx.lineTo(440, 292);
  }, '#fff3a8', s3, 3);
  for (let i = 0; i < 6; i++) {
    const x = 444 + (i % 3) * 14;
    const y = 548 + Math.floor(i / 3) * 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.5 + i);
    ctx.fillStyle = rgba(MINT, 0.2 + 0.6 * s3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  neonText(ctx, 'N₂ FIXATION', 430, 352, 12, MINT, 0.3 + 0.7 * s3);

  // Apron: the three-cycle badge between the flippers (lights per mission).
  const cx = 286;
  const cy = 1072;
  const badge: [string, string, number][] = [['H₂O', SKY, s2], ['C', GOLD, s2], ['N', MINT, s3]];
  badge.forEach(([lbl, col, lit], i) => {
    const a = -Math.PI / 2 + (i / 3) * TAU;
    const x = cx + Math.cos(a) * 22;
    const y = cy + Math.sin(a) * 22;
    glowDot(ctx, x, y, 14, col, 0.15 + 0.5 * lit);
    neonText(ctx, lbl, x, y, 9, col, lit);
  });
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, 34, -0.3, TAU - 0.6);
  }, GOLD, s1, 2);

  // Marquee lettering under the arch.
  neonText(ctx, 'PLANET CAROUSEL', 300, 44, 16, GOLD, stage(level, 1.5, 2.5));

  // Wonderlight wash.
  if (s4 > 0.01) {
    const g = ctx.createRadialGradient(gx, gy, 40, gx, gy, 520);
    g.addColorStop(0, rgba(GOLD, 0.12 * s4));
    g.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 1150);
  }
}

// ---------------------------------------------------------------- 3D attraction set

const carouselSet: SetBuilder = (kit) => {
  const THREE = kit.THREE;
  const G = REGIONS.groundY;
  kit.sky('#1d3466', '#03060f');
  kit.boardwalk('#2e3a46', 30);

  // ---- small helpers (everything they create is tracked for disposal)
  const canvasTex = (w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d')!);
    const t = kit.track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const glowMat = (color: string) => kit.track(new THREE.MeshStandardMaterial({ color: '#0b0a12', emissive: color, emissiveIntensity: 0.08, roughness: 0.4 }));
  const stoneMats = new Map<string, MeshStandardMaterial>();
  const stone = (color: string) => {
    let m = stoneMats.get(color);
    if (!m) {
      m = kit.track(new THREE.MeshPhysicalMaterial({ color, roughness: 0.78, clearcoat: 0.25, clearcoatRoughness: 0.5 }));
      stoneMats.set(color, m);
    }
    return m;
  };
  /** Smooth, rounded boulder (soft noise on a sphere) instead of a crumpled low-poly rock. */
  const boulder = (pos: V3, size: number, color: string, seed: number, squash = 0.68) => {
    const geo = new THREE.SphereGeometry(size, 20, 14);
    const p = geo.attributes.position;
    const r = rng(seed);
    const k1 = r() * 6;
    const k2 = r() * 6;
    const k3 = r() * 6;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const n = 1 + 0.16 * Math.sin((x * 3.1) / size + k1) * Math.cos((z * 2.7) / size + k2) + 0.08 * Math.sin((y * 4.3) / size + k3);
      p.setXYZ(i, x * n, y * n * squash, z * n);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, stone(color));
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.y = r() * TAU;
    m.castShadow = true;
    m.receiveShadow = true;
    return kit.add(m);
  };
  /** A closed cycle loop: a neon tube plus glowing matter tokens that ride it in one direction. */
  const cycleLoop = (pts: V3[], color: string, tokens: number, radius = 0.03) => {
    const tube = kit.neonTube(pts, color, { closed: true, radius });
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(q[0], q[1], q[2])), true);
    const mat = glowMat(color);
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(radius * 2.4, 12, 8), mat, tokens);
    kit.add(inst);
    const tmp = new THREE.Vector3();
    const m = new THREE.Matrix4();
    let phase = 0;
    const place = () => {
      for (let i = 0; i < tokens; i++) {
        curve.getPointAt((phase + i / tokens) % 1, tmp);
        m.makeTranslation(tmp.x, tmp.y, tmp.z);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
    };
    place();
    return {
      setLit(v: number) {
        tube.setLit(v * 0.42);
        mat.emissiveIntensity = 0.06 + v * 2.6;
      },
      advance(dt: number) {
        phase = (phase + dt) % 1;
        place();
      },
    };
  };
  const ellipseLoop = (c: V3, rx: number, ry: number, tiltZ: number, n = 14): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      out.push([c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry, c[2] + Math.sin(a) * tiltZ]);
    }
    return out;
  };

  // ================= LEFT FRONT: the OCEAN lagoon with a lighthouse and its own water cycle
  const LX = -5.85;
  const LZ = 2.45;
  const LR = 1.55;
  const sand = new THREE.Mesh(new THREE.RingGeometry(LR - 0.05, LR + 0.55, 56).rotateX(-Math.PI / 2), stone('#cdb88f'));
  sand.position.set(LX, G + 0.035, LZ);
  sand.receiveShadow = true;
  kit.add(sand);
  const waterGeo = new THREE.CircleGeometry(LR, 56, 0, TAU).rotateX(-Math.PI / 2);
  const waterMat = kit.track(new THREE.MeshPhysicalMaterial({ color: '#1f6f9f', emissive: '#2fa8ff', emissiveIntensity: 0.0, roughness: 0.06, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 }));
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(LX, G + 0.06, LZ);
  water.receiveShadow = true;
  kit.add(water);
  const wpos = waterGeo.attributes.position;
  const wbase = new Float32Array(wpos.array as ArrayLike<number>);
  kit.animate((t) => {
    for (let i = 0; i < wpos.count; i++) {
      const x = wbase[i * 3];
      const z = wbase[i * 3 + 2];
      wpos.setY(i, Math.sin(x * 2.4 + t * 1.3) * 0.025 + Math.cos(z * 2.9 + t * 1.1) * 0.02);
    }
    wpos.needsUpdate = true;
  });
  boulder([LX - 1.35, G + 0.1, LZ - 0.95], 0.4, '#5b6672', 3);
  boulder([LX + 1.45, G + 0.12, LZ - 1.0], 0.42, '#6b7682', 4);
  boulder([LX + 1.6, G + 0.06, LZ + 0.85], 0.24, '#5b6672', 5);
  // Lighthouse on the back-left rock.
  const lh = new THREE.Group();
  const stripeA = kit.mats.plastic('#f4efe6');
  const stripeB = kit.mats.plastic(CORAL);
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.2 - i * 0.022, 0.23 - i * 0.022, 0.34, 20), i % 2 ? stripeB : stripeA);
    seg.position.y = 0.17 + i * 0.34;
    seg.castShadow = true;
    lh.add(seg);
  }
  const lampMat = glowMat(GOLD);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), lampMat);
  lamp.position.y = 1.5;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.24, 20), kit.mats.paintedMetal('#2b3b55'));
  roof.position.y = 1.72;
  const beamMat = kit.track(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.6, 16, 1, true), beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 0.8;
  const beamPivot = new THREE.Group();
  beamPivot.position.y = 1.5;
  beamPivot.add(beam);
  lh.add(lamp, roof, beamPivot);
  lh.position.set(LX + 1.45, G + 0.24, LZ - 1.0);
  kit.add(lh);
  // A cloud over the lagoon; matter tokens loop up (evaporation) and down (precipitation).
  kit.cloud([LX - 0.2, 2.35, LZ - 0.55], 0.62, '#dfe9f7');
  const waterLoop = cycleLoop(ellipseLoop([LX - 0.2, 1.25, LZ - 0.35], 0.85, 0.98, 0.25), SKY, 7, 0.028);
  const rainFall = kit.motes({ x0: LX - 0.85, x1: LX + 0.45, y0: G + 0.1, y1: 2.2, z0: LZ - 0.7, z1: LZ + 0.1 }, 36, '#bfe6ff', { speed: 1.2, size: 0.06, rise: false });
  const oceanSign = kit.neonSign('OCEAN', [LX + 0.25, 0.4, LZ + 1.95], { height: 0.34, color: SKY });
  oceanSign.rotation.x = -0.7;

  // ================= LEFT BACK: the carousel itself (signature); its riders are reservoirs
  const car = new THREE.Group();
  car.position.set(-5.75, G, -3.05);
  car.scale.setScalar(0.78);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.2, 40), kit.mats.wood());
  deck.position.y = 0.1;
  deck.receiveShadow = true;
  deck.castShadow = true;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 16), kit.mats.brass());
  mast.position.y = 1.3;
  const stripes = canvasTex(512, 128, (c) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? '#FF8F6B' : '#FFF7E7';
      c.fillRect(i * 32, 0, 32, 128);
    }
  });
  const canopyMat = kit.track(new THREE.MeshPhysicalMaterial({ map: stripes, roughness: 0.4, clearcoat: 0.6, emissive: '#ffffff', emissiveMap: stripes, emissiveIntensity: 0.02, side: THREE.DoubleSide }));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.75, 32, 1, true), canopyMat);
  canopy.position.y = 2.75;
  canopy.castShadow = true;
  const valance = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.22, 32, 1, true), canopyMat);
  valance.position.y = 2.24;
  const finialMat = glowMat(GOLD);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), finialMat);
  finial.position.y = 3.22;
  const bulbMat = glowMat(GOLD);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), bulbMat, 28);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    m4.makeTranslation(Math.cos(a) * 1.52, 2.12, Math.sin(a) * 1.52);
    bulbs.setMatrixAt(i, m4);
  }
  const rotor = new THREE.Group();
  // Riders are the reservoirs: ocean, cloud, soil, leaf (living things), rock, air.
  const riderCols = [SEA, '#eef6ff', SOIL, LAND, '#8d8f9a', SKY];
  const riderMats: MeshStandardMaterial[] = [];
  const riders: Mesh[] = [];
  riderCols.forEach((col, i) => {
    const a = (i / riderCols.length) * TAU;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.05, 8), kit.mats.brass());
    pole.position.set(Math.cos(a) * 1.2, 1.22, Math.sin(a) * 1.2);
    const mat = kit.track(new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.04, roughness: 0.25, clearcoat: 1 }));
    riderMats.push(mat);
    const rider = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), mat);
    rider.position.set(Math.cos(a) * 1.2, 1.0, Math.sin(a) * 1.2);
    rider.castShadow = true;
    rotor.add(pole, rider);
    riders.push(rider);
  });
  rotor.add(canopy, valance, finial, bulbs);
  car.add(deck, mast, rotor);
  kit.add(car);

  // ================= RIGHT FRONT: SOIL & ROCK cut-away block with a tree, roots and nodules
  // Built around the origin, then placed and turned so its strata face the player.
  const soilG = new THREE.Group();
  const layers: [string, number][] = [['#5c606c', 0.3], ['#b0643f', 0.18], ['#8a5a3c', 0.22], ['#4a3426', 0.24]];
  let yTop = 0;
  for (const [col, h] of layers) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, h, 1.4), stone(col));
    box.position.set(0, yTop + h / 2, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    soilG.add(box);
    yTop += h;
  }
  const turf = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.06, 1.44), kit.mats.plastic('#3f8f5f'));
  turf.position.set(0, yTop + 0.03, 0);
  turf.receiveShadow = true;
  soilG.add(turf);
  const top = yTop + 0.06;
  soilG.add(kit.tree([-0.35, top, -0.32], 1.8, '#47b072', 21, '#6b4a30'));
  const front = 0.71;
  for (const [x0, sway] of [[0.1, -0.25], [0.42, 0.18], [0.72, 0.3]] as [number, number][]) {
    soilG.add(kit.neonTube([[x0, top - 0.02, front], [x0 + sway * 0.4, top - 0.28, front], [x0 + sway, top - 0.55, front], [x0 + sway * 1.3, 0.12, front]], '#d9b48a', { radius: 0.018 }));
  }
  const nodules = ([[0.05, top - 0.33], [0.55, top - 0.42], [0.92, top - 0.66], [0.25, top - 0.58]] as [number, number][]).map(([x, y]) => {
    const o = kit.orb([x, y, front + 0.02], 0.055, MINT);
    soilG.add(o);
    return o;
  });
  const crystals = [
    kit.crystal([-0.62, 0.17, front], 0.11, MINT, 4),
    kit.crystal([-0.3, 0.12, front], 0.08, '#b9a2ff', 5),
    kit.crystal([0.72, top + 0.12, -0.2], 0.15, GOLD, 6),
  ];
  crystals.forEach((c) => soilG.add(c));
  const capMat = kit.mats.plastic(CORAL);
  const stemMat = kit.mats.plastic('#f4efe6');
  for (const [x, z, s] of [[-0.5, 0.38, 0.9], [-0.25, 0.52, 0.65], [0.8, 0.45, 0.75]] as V3[]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.06 * s, 0.28 * s, 10), stemMat);
    stem.position.set(x, top + 0.14 * s, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 18, 10, 0, TAU, 0, Math.PI / 2), capMat);
    cap.position.set(x, top + 0.26 * s, z);
    cap.castShadow = true;
    soilG.add(stem, cap);
  }
  soilG.position.set(5.75, G, 2.25);
  soilG.rotation.y = -0.42;
  kit.add(soilG);
  boulder([7.0, G + 0.12, 3.3], 0.34, '#6b5b4e', 11);
  boulder([4.55, G + 0.08, 3.35], 0.24, '#7d6b5a', 12);
  const soilSign = kit.neonSign('SOIL & ROCK', [5.55, 0.32, 3.95], { height: 0.32, color: CORAL, rotY: -0.25 });
  soilSign.rotation.x = -0.75;

  // ================= RIGHT BACK: the planet globe with the three cycle rings
  const GP: V3 = [5.75, 1.95, -2.95];
  const globeTex = canvasTex(1024, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#2f7fbf');
    g.addColorStop(0.5, '#1d64a2');
    g.addColorStop(1, '#2f7fbf');
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 512);
    const r = rng(77);
    const blobs = [[180, 180, 120], [330, 300, 90], [560, 170, 140], [640, 330, 80], [860, 230, 110], [470, 400, 60]];
    for (const [bx, by, bs] of blobs) {
      for (let k = 0; k < 9; k++) {
        c.fillStyle = k % 3 === 0 ? '#9a7a4f' : k % 3 === 1 ? '#3f9b6a' : '#5bb174';
        c.beginPath();
        c.arc(bx + (r() - 0.5) * bs, by + (r() - 0.5) * bs * 0.7, bs * (0.25 + r() * 0.3), 0, TAU);
        c.fill();
      }
    }
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.fillRect(0, 0, 1024, 34);
    c.fillRect(0, 484, 1024, 28);
    c.fillStyle = 'rgba(255,255,255,0.32)';
    for (let k = 0; k < 40; k++) {
      c.beginPath();
      c.ellipse(r() * 1024, 60 + r() * 400, 40 + r() * 60, 8 + r() * 6, 0, 0, TAU);
      c.fill();
    }
  });
  const globeMat = kit.track(new THREE.MeshPhysicalMaterial({ map: globeTex, emissive: '#ffffff', emissiveMap: globeTex, emissiveIntensity: 0.05, roughness: 0.35, clearcoat: 0.8 }));
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.82, 48, 32), globeMat);
  globe.position.set(GP[0], GP[1], GP[2]);
  globe.castShadow = true;
  const globeTilt = new THREE.Group();
  globeTilt.position.set(GP[0], GP[1], GP[2]);
  globeTilt.rotation.z = 0.41;
  globe.position.set(0, 0, 0);
  globeTilt.add(globe);
  kit.add(globeTilt);
  const haloMat = kit.track(new THREE.MeshBasicMaterial({ color: SKY, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.93, 32, 20), haloMat);
  halo.position.set(GP[0], GP[1], GP[2]);
  kit.add(halo);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.36, GP[1] - 0.82 - G, 20), kit.mats.brass());
  stand.position.set(GP[0], G + (GP[1] - 0.82 - G) / 2, GP[2]);
  stand.castShadow = true;
  kit.add(stand);
  const ringPts = (r: number, tilt: number, spin: number): V3[] => {
    const pts: V3[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const x = Math.cos(a) * r;
      const y0 = Math.sin(a) * r * Math.sin(tilt);
      const z0 = Math.sin(a) * r * Math.cos(tilt);
      pts.push([GP[0] + x * Math.cos(spin) - z0 * Math.sin(spin), GP[1] + y0, GP[2] + x * Math.sin(spin) + z0 * Math.cos(spin)]);
    }
    return pts;
  };
  const waterRing = cycleLoop(ringPts(1.06, 0.55, 0.2), SKY, 5);
  const carbonRing = cycleLoop(ringPts(1.15, -0.7, 0.9), GOLD, 5);
  const nitroRing = cycleLoop(ringPts(1.24, 1.15, -0.6), MINT, 5);

  // ================= RIGHT MIDDLE: the ATMOSPHERE reservoir, a rain cloud between globe and soil
  // (visible from the play camera; the head strip is only seen during the intro fly-in).
  kit.cloud([6.2, 2.0, -0.5], 0.58, '#e6eeff');
  kit.cloud([6.85, 2.2, -1.0], 0.4, '#dbe8ff');
  const rain = kit.motes({ x0: 5.7, x1: 6.8, y0: G + 0.05, y1: 1.75, z0: -0.9, z1: -0.1 }, 40, SKY, { speed: 1.4, size: 0.07, rise: false });
  const atmoSign = kit.neonSign('ATMOSPHERE', [6.25, 1.35, 0.2], { height: 0.3, color: SKY, backing: false, rotY: -0.3 });
  atmoSign.rotation.x = -0.6;

  // ================= HEAD (intro fly-in): marquee and festoons
  const marquee = kit.neonSign('PLANET CAROUSEL', [0, 1.45, -7.2], { height: 0.7, color: GOLD });
  marquee.rotation.x = -0.75;
  kit.pole([-8.9, 0, -7.0], 3.9);
  kit.pole([8.9, 0, -7.0], 3.9);
  const festoon = kit.stringLights([-8.9, 3.85, -7.0], [8.9, 3.85, -7.0], 0.9, kit.n(22), [GOLD, CORAL, MINT, SKY]);
  const stars3d = kit.motes({ x0: -12, x1: 12, y0: 3.5, y1: 9, z0: -14, z1: 4 }, 110, IVORY, { speed: 0.05, size: 0.08 });
  // Wonderlight fireworks over the carousel and the globe (top corners of the play view).
  const fwL = kit.fireworks({ x0: -7.6, x1: -5.4, y0: 2.3, y1: 2.9, z: -4.0 }, [GOLD, CORAL, SKY]);
  const fwR = kit.fireworks({ x0: 6.2, x1: 8.0, y0: 2.4, y1: 3.0, z: -4.2 }, [MINT, GOLD, CORAL]);
  kit.spot([-3.6, 6.5, 4.5], [-5.8, 0, 0.2], '#9fd8ff', 16, 0.6);
  kit.spot([3.6, 6.5, 4.5], [5.8, 0, 0.2], '#ffd0a8', 16, 0.6);
  kit.point([-5.6, 1.1, -1.2], GOLD, 1.4, 3.2);

  let carAngle = 0;
  let globeAngle = 0;
  let beamAngle = 0;
  let burst = 0;
  return {
    update(t, dt, level, energy) {
      const s1 = kit.stage(level, 0.2, 1.1);
      const s2 = kit.stage(level, 1.2, 2.1);
      const s3 = kit.stage(level, 2.2, 3.1);
      const s4 = kit.stage(level, 3.5, 4);
      // Level 1: the reservoirs wake.
      oceanSign.setLit(0.2 + 0.8 * s1);
      soilSign.setLit(0.2 + 0.8 * s1);
      atmoSign.setLit(0.15 + 0.85 * s1);
      lampMat.emissiveIntensity = 0.2 + 2.6 * s1;
      beamMat.opacity = 0.08 * s1 + 0.06 * s4;
      waterMat.emissiveIntensity = 0.02 + 0.12 * s1 + 0.15 * s4;
      for (let i = 0; i < crystals.length; i++) crystals[i].setLit(Math.max(0.1, kit.stage(level, 0.3 + i * 0.2, 1.1 + i * 0.2)));
      for (let i = 0; i < riderMats.length; i++) riderMats[i].emissiveIntensity = 0.03 + 0.25 * s1 + 0.35 * s3 + 0.3 * s4;
      // Level 2: water and carbon processes run.
      waterLoop.setLit(0.05 + 0.95 * s2);
      waterRing.setLit(0.05 + 0.95 * s2);
      carbonRing.setLit(0.05 + 0.95 * s2);
      rainFall.setLit(0.05 + 0.75 * s2);
      rain.setLit(0.1 + 0.8 * s2);
      // Level 3: nitrogen fixed; the carousel lights up and turns.
      nitroRing.setLit(0.05 + 0.95 * s3);
      for (let i = 0; i < nodules.length; i++) nodules[i].setLit(kit.stage(level, 2.2 + i * 0.15, 3 + i * 0.1));
      bulbMat.emissiveIntensity = 0.12 + 3.0 * Math.max(0.2 * s1, s3) * (0.85 + 0.15 * energy);
      finialMat.emissiveIntensity = 0.1 + 2.5 * Math.max(0.3 * s1, s3);
      canopyMat.emissiveIntensity = 0.02 + 0.06 * s3 + 0.06 * s4;
      // Level 4: Wonderlight.
      marquee.setLit(0.12 + 0.5 * s2 + 0.4 * s4);
      globeMat.emissiveIntensity = 0.05 + 0.08 * s1 + 0.16 * s4;
      haloMat.opacity = 0.03 + 0.05 * s1 + 0.1 * s4;
      festoon.setLit(0.2 + 0.4 * s1 + 0.4 * s4);
      stars3d.setLit(0.3 + 0.5 * s4);
      fwL.setLit(Math.max(s4 * 0.85, burst));
      fwR.setLit(Math.max(s4 * 0.85, burst));
      burst = Math.max(0, burst - dt * 0.6);
      if (!kit.reducedMotion) {
        const spin = 0.05 + 0.45 * s3 + 0.25 * s4 + 0.2 * energy + burst * 0.8;
        carAngle += dt * spin;
        globeAngle += dt * (0.06 + 0.14 * s4);
        beamAngle += dt * 0.6;
        waterLoop.advance(dt * 0.12 * (0.2 + s2));
        waterRing.advance(dt * 0.08 * (0.2 + s2));
        carbonRing.advance(dt * 0.07 * (0.2 + s2));
        nitroRing.advance(dt * 0.06 * (0.2 + s3));
        for (let i = 0; i < riders.length; i++) riders[i].position.y = 1.0 + Math.sin(t * 1.6 + i * 1.7) * 0.12 * (0.3 + s3);
      }
      rotor.rotation.y = carAngle;
      globe.rotation.y = globeAngle;
      beamPivot.rotation.y = Math.PI + Math.sin(beamAngle) * 1.0;
    },
    celebrate(p) {
      burst = Math.max(burst, Math.sin(p * Math.PI));
    },
  };
};

// ---------------------------------------------------------------- dollhouse room vignette

const carouselRoom: RoomBuilder = ({ kit }) => {
  const THREE = kit.THREE;
  const car = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.08, 28), kit.mats.wood());
  deck.position.y = 0.04;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 10), kit.mats.brass());
  mast.position.y = 0.55;
  const canopyMat = kit.track(new THREE.MeshPhysicalMaterial({ color: CORAL, roughness: 0.3, clearcoat: 1, side: THREE.DoubleSide }));
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.34, 24, 1, true), canopyMat);
  canopy.position.y = 1.18;
  const rotor = new THREE.Group();
  const riders: (Mesh & { setLit(v: number): void })[] = [];
  [SEA, '#eef6ff', SOIL].forEach((col, i) => {
    const a = (i / 3) * TAU;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), kit.mats.brass());
    pole.position.set(Math.cos(a) * 0.45, 0.55, Math.sin(a) * 0.45);
    rotor.add(pole);
    const orb = kit.orb([Math.cos(a) * 0.45, 0.42 + i * 0.1, Math.sin(a) * 0.45], 0.1, col);
    rotor.add(orb);
    riders.push(orb);
  });
  rotor.add(canopy);
  car.add(deck, mast, rotor);
  car.position.set(-0.25, 0, -0.1);
  kit.add(car);
  const planet = kit.orb([0.62, 0.32, 0.35], 0.2, SEA);
  const ring = kit.neonTube([[0.36, 0.32, 0.35], [0.62, 0.45, 0.1], [0.88, 0.32, 0.35], [0.62, 0.19, 0.6]], MINT, { closed: true, radius: 0.012 });
  const sign = kit.neonSign('CYCLES', [0, 1.5, -0.8], { height: 0.24, color: GOLD });
  return {
    update(t, lit) {
      for (let i = 0; i < riders.length; i++) riders[i].setLit(lit);
      planet.setLit(lit);
      ring.setLit(lit * 0.9);
      sign.setLit(lit);
      rotor.rotation.y = kit.reducedMotion ? 0 : t * (0.2 + 0.6 * lit);
    },
  };
};

// ---------------------------------------------------------------- table definition

export const L07: TableDef = {
  lessonId: 'L07',
  signature: 'A carousel of reservoir saucers linked by process lanes and a Respiration Ramp',
  ballRole: 'Here the Wonderball is a game token standing in for a bit of matter; real atoms are far too small to see and move by processes like evaporation and eating, not flippers.',
  theme: {
    bg: ['#1b2d60', '#0c1a2e'],
    rail: '#cfe3ee',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#bff3dc',
    bumperRing: '#1f4d5c',
    flipper: '#ffe1a0',
    ink: IVORY,
    ramp: 'rgba(150,215,255,0.18)',
    trail: '#a8ecff',
  },
  lines: {
    intro: 'All aboard the Planet Carousel! Nearly every atom riding this planet has been here since Earth formed, so let’s find out where it goes next.',
    quark: '"Plants are swimming in nitrogen gas, so they must just soak it up from the air to build proteins," Professor Quark wonders aloud.',
    pipTip: 'Hold the plunger just under half a second for the CO₂ skill lane. A full launch rides one water-cycle route: ocean, sky, rain, soil!',
  },
  build,
  skillShot: 'sky_2',
  shots: [
    { id: 'ocean', label: 'Ocean', on: [{ type: 'saucer', id: 'ocean' }], insert: 'ins_ocean' },
    { id: 'air', label: 'Air (atmosphere)', on: [{ type: 'saucer', id: 'air' }], insert: 'ins_air' },
    { id: 'soil', label: 'Soil & Rock', on: [{ type: 'saucer', id: 'soil' }], insert: 'ins_soil' },
    { id: 'evap', label: 'Evaporation lane', on: [{ type: 'shot', id: 'evap_sw' }], insert: 'ins_evap' },
    { id: 'rain', label: 'Precipitation lane', on: [{ type: 'shot', id: 'rain_sw' }], insert: 'ins_rain' },
    { id: 'resp', label: 'Respiration Ramp', on: [{ type: 'ramp', id: 'resp_ramp' }], insert: 'ins_ramp' },
    { id: 'fix', label: 'Nitrogen fixers', on: [{ type: 'target', group: 'fix' }], insert: 'ins_fix' },
    { id: 'life', label: 'Living things', on: [{ type: 'bumper', group: 'life' }], insert: 'ins_life' },
    { id: 'pocket', label: 'Globe Pocket', on: [{ type: 'saucer', id: 'globe' }], insert: 'ins_pocket' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Reservoir Roll Call',
      brief: 'Matter is stored in reservoirs. Visit all three by any route, check in with the living things, then report to the Globe Pocket.',
      objectiveIds: ['L07-O1'],
      stages: [
        { kind: 'collect', text: 'Visit all 3 reservoirs: OCEAN, AIR, SOIL', match: { type: 'saucer', group: 'reservoir' }, count: 3, distinct: true, lamps: ['ocean', 'air', 'soil'] },
        { kind: 'collect', text: 'Living things hold matter too: 5 bumper hits', match: { type: 'bumper', group: 'life' }, count: 5, preview: ['life'] },
        { kind: 'discover', text: 'Shoot the Globe Pocket', pocket: 'globe', questions: 1 },
      ],
      discovery: 'A reservoir stores matter for a while: the ocean holds most of Earth’s water, the air holds nitrogen gas and carbon dioxide, and soil and living things store carbon and nitrogen.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Process Pathways',
      brief: 'Processes carry matter between reservoirs. Ride two of them (evaporation, rain or respiration), then store the matter.',
      objectiveIds: ['L07-O2', 'L07-O1'],
      stages: [
        { kind: 'shots', text: 'Link reservoirs: make 2 process shots', shots: ['evap', 'rain', 'resp'], order: 'any', count: 2 },
        { kind: 'collect', text: 'Store the matter in any reservoir', match: { type: 'saucer', group: 'reservoir' }, count: 1, lamps: ['ocean', 'air', 'soil'] },
        { kind: 'discover', text: 'Shoot the Globe Pocket to map the routes', pocket: 'globe', questions: 1, types: ['match', 'classify'] },
      ],
      discovery: 'Processes link the reservoirs: evaporation lifts water into the air, precipitation brings it down, and cellular respiration returns carbon dioxide to the air. The atoms are reused, not used up.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Follow a Nitrogen Atom',
      brief: 'Plants can’t use nitrogen gas straight from the air. Fix one nitrogen atom, pass it to a plant, then pick its route back to the soil or the air.',
      objectiveIds: ['L07-O3'],
      stages: [
        { kind: 'collect', text: 'Fix the N₂: hit BACTERIA or LIGHTNING', match: { type: 'target', group: 'fix' }, count: 1, lamps: ['fix_bacteria', 'fix_lightning'] },
        { kind: 'collect', text: 'Roots absorb the fixed nitrogen: hit the PLANT', match: { type: 'bumper', id: 'life_plant' }, count: 1, lamps: ['life_plant'] },
        { kind: 'collect', text: 'Pass it on: hit the ANIMAL or the DECOMPOSER', match: { type: 'bumper', id: ['life_animal', 'life_decomposer'] }, count: 1, lamps: ['life_animal', 'life_decomposer'] },
        { kind: 'shots', text: 'Recycle it: SOIL (decay) or AIR (bacteria)', shots: ['soil', 'air'], order: 'any', count: 1 },
        { kind: 'discover', text: 'Shoot the Globe Pocket', pocket: 'globe', questions: 1 },
      ],
      discovery: 'Bacteria and lightning fix nitrogen gas into compounds plants absorb. From a plant, the atom may pass to an animal or a decomposer, then return to the soil or, through denitrifying bacteria, the air.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Spin the Planet',
    brief: 'Turn every cycle on the carousel (water, carbon and nitrogen), then bring the Wonderball home to the Globe Pocket.',
    stages: [
      { kind: 'shots', text: 'Spin every cycle: evaporate, rain, respire, fix', shots: ['evap', 'rain', 'resp', 'fix'], order: 'any' },
      { kind: 'discover', text: 'Bring it home to the Globe Pocket', pocket: 'globe', questions: 2 },
    ],
    celebration: 'The carousel blooms into a living planet! Earth keeps nearly all of its matter, so the same atoms ride again and again through ocean, air, soil and life.',
  },
  set: carouselSet,
  room: carouselRoom,
  icons: {
    sprout(ctx, s) {
      ctx.fillRect(-s * 0.07, -s * 0.2, s * 0.14, s * 0.85);
      ctx.beginPath();
      ctx.ellipse(-s * 0.32, -s * 0.32, s * 0.36, s * 0.18, -0.6, 0, TAU);
      ctx.ellipse(s * 0.34, -s * 0.5, s * 0.4, s * 0.2, 0.6, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, s * 0.72, s * 0.62, s * 0.18, 0, 0, TAU);
      ctx.fill();
    },
    rabbit(ctx, s) {
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, s * 0.3, s * 0.52, s * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.38, -s * 0.12, s * 0.26, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s * 0.3, -s * 0.66, s * 0.09, s * 0.3, -0.15, 0, TAU);
      ctx.ellipse(s * 0.52, -s * 0.62, s * 0.09, s * 0.3, 0.3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.66, s * 0.22, s * 0.14, 0, TAU);
      ctx.fill();
    },
    mushroom(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, s * 0.05);
      ctx.quadraticCurveTo(-s * 0.8, -s * 0.85, 0, -s * 0.85);
      ctx.quadraticCurveTo(s * 0.8, -s * 0.85, s * 0.85, s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.2, 0, s * 0.4, s * 0.8);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (const [x, y, r] of [[-0.4, -0.35, 0.12], [0.15, -0.55, 0.1], [0.45, -0.22, 0.11]]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, r * s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },
    globe(ctx, s) {
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.85, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.38, s * 0.85, 0, 0, TAU);
      ctx.moveTo(-s * 0.85, 0);
      ctx.lineTo(s * 0.85, 0);
      ctx.stroke();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      if (reduced) return;
      const s1 = stage(level, 0.2, 1.1);
      const s2 = stage(level, 1.2, 2.1);
      // Vapor rising from the ocean up the evaporation lane.
      drift(ctx, 13, 10, t, SKY, [32, 380, 72, 660], 26, 1.6, 0.25 + 0.35 * s2);
      // Raindrops falling in the precipitation lane.
      ctx.save();
      ctx.strokeStyle = rgba(SKY, 0.2 + 0.4 * s2);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const x = 506 + ((i * 37) % 34);
        const y = 390 + ((t * 160 + i * 61) % 250);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 9);
        ctx.stroke();
      }
      ctx.restore();
      // Carousel bulbs chase around the planet.
      const k = Math.floor(t * 6) % 36;
      for (let j = 0; j < 3; j++) {
        const a = (((k + j * 12) % 36) / 36) * TAU;
        glowDot(ctx, 286 + Math.cos(a) * 151, 372 + Math.sin(a) * 151, 10, GOLD, (0.25 + 0.5 * s1) * (0.7 + 0.3 * energy));
      }
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(286, 372, 10, 286, 372, 420);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // Riders spin around the planet: water, carbon and nitrogen.
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + t * 0.8;
        const d = 150 + p * 120;
        glowDot(ctx, 286 + Math.cos(a) * d, 372 + Math.sin(a) * d * 0.85, 10, [SKY, GOLD, MINT][i % 3], 1 - p);
      }
    },
  },
};
export default L07;
