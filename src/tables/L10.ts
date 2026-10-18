// Lesson 10 — Energy in Earth's Systems — "Four-Sphere Skyworks"
// An aerial workshop floating above the clouds at dawn. A Convection Loop circles the Globe
// island: a ball rises up one leg, crosses the cool top past the Wind Vane and sinks down the
// other leg onto the flipper below it (a cross-up shot returns to the flipper that sent it). Four sphere
// stations (GEO, HYDRO, ATMO, BIO) ring the loop. The sun's S-U-N lanes and the Evaporation
// Ramp run on solar energy; the Geyser erupts with heat from Earth's hot interior. Everything
// is read in the Globe Lab (the Wonder Pocket) at the base of the globe.

import * as THREE from 'three';
import type { TableBuilder } from '../game/table/builder.ts';
import type { Rollover } from '../game/table/mechanisms.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import {
  TAU, drift, glowDot, mix, neonPath, neonText, plaque, rgba, rng, stage, stars, vgrad,
} from '../game/render/art.ts';

// ---------------------------------------------------------------- palette

const NIGHT = '#0f1b3d';
const SAPPHIRE = '#21407a';
const GOLD = '#FFC75B';
const EMBER = '#FF6A3D';
const MAGMA = '#FF9A4A';
const OCEAN = '#2E8BD6';
const ICE = '#9FE8FF';
const LEAF = '#7ED67A';
const ROCK = '#C98A55';
const AIR = '#BFD6FF';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';

/** The four systems, in the order the stations are introduced. */
const SPHERES = [
  { id: 'geo_station', key: 'GEO', color: ROCK },
  { id: 'hydro_station', key: 'HYDRO', color: OCEAN },
  { id: 'atmo_station', key: 'ATMO', color: AIR },
  { id: 'bio_station', key: 'BIO', color: LEAF },
] as const;

/** Convection Loop: centre, inner (island) and outer wall radii. */
const LOOP = { cx: 286, cy: 384, ri: 62, ro: 122, legBottom: 552 };
const GLOBE = { x: 286, y: 404, r: 48 };
const SANS = '"Atkinson Hyperlegible Next", system-ui, sans-serif';

// ---------------------------------------------------------------- geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });
  const { cx, cy, ri, ro, legBottom } = LOOP;

  // --- Convection Loop: a channel around the Globe island, open at both legs ---
  b.wall([[cx - ro, legBottom], ...b.arcPoints(cx, cy, ro, 180, 360, 24), [cx + ro, legBottom]], { id: 'loop_outer', r: 3 });
  b.post(cx - ro, legBottom + 4, 5, { id: 'loop_post_l' });
  b.post(cx + ro, legBottom + 4, 5, { id: 'loop_post_r' });
  // Globe island with the Globe Lab cup cut into its base
  b.wall([...b.arcPoints(cx, cy, ri, 180, 360, 14), [cx + ri, 532], [314, 532], [314, 488], [286, 474], [258, 488], [258, 532], [cx - ri, 532]], { id: 'globe_island', r: 3, closed: true });
  b.saucer('globe_lab', 286, 508, { role: 'pocket', ejectDeg: 96, ejectSpeed: 740, label: 'GLOBE LAB', icon: 'globe' });
  // The cool top of the cell: wind blows across the Wind Vane; direction-aware loop switches
  b.spinner('wind_vane', [cx, cy - ri - 3], [cx, cy - ro + 3], { label: 'WIND VANE' });
  b.shotSwitch('loop_cw', cx, cy - (ri + ro) / 2, 0, { group: 'loop' });
  b.shotSwitch('loop_ccw', cx, cy - (ri + ro) / 2, 180, { group: 'loop' });
  // Land and water stations on the globe's base, either side of the Globe Lab
  b.target('geo_station', [228, 537], [254, 537], { group: 'spheres', label: 'GEO' });
  b.target('hydro_station', [318, 537], [344, 537], { group: 'spheres', label: 'HYDRO' });

  // --- Geyser Gorge (left): a canyon channel and the geyser in the left lane ---
  b.wall([[80, 610], [80, 440]], { id: 'gorge_wall', r: 3 });
  b.post(80, 436, 5, { id: 'gorge_post' });
  // One-way gate, not a wall: balls coming down the gorge are still deflected into play, but
  // the left kickback below it can fire straight up the gorge instead of into a deflector.
  b.gate('gorge_deflect', [24, 606], [50, 672], -90);
  b.target('bio_station', [87, 590], [87, 540], { group: 'spheres', label: 'BIO' });
  b.saucer('geyser', 122, 610, { ejectDeg: -96, ejectSpeed: 2300, captureMaxSpeed: 3200, label: 'GEYSER', icon: 'geyser' });

  // --- Evaporation Ramp (right): climbs from the ocean into the sunlit sky ---
  b.ramp('evap_ramp', {
    path: [[418, 654], [442, 588], [468, 500], [483, 410], [486, 330], [484, 250], [470, 190], [446, 146], [414, 120], [384, 116], [364, 128], [358, 146]],
    width: 44,
    footprintTo: 1,
    peak: 86,
    label: 'EVAPORATION RAMP',
  });
  // Sloped roof over the ramp's base sheds falling balls into the right lane
  b.wall([[408, 556], [434, 572], [484, 600]], { id: 'ramp_roof', r: 3 });
  b.target('atmo_station', [541, 640], [541, 584], { group: 'spheres', label: 'ATMO' });
  b.wall([[548, 664], [516, 712]], { id: 'rain_deflect', r: 3 });

  // --- Sky: the S-U-N lanes (sunlight arriving) and the cloud bumpers ---
  [260, 308, 356].forEach((x, i) => {
    const r: Rollover = b.rollover(`sun_${i + 1}`, x, 172, { group: 'sun', label: 'SUN'[i] });
    r.lampColor = GOLD;
  });
  for (const gx of [236, 284, 332, 380]) {
    b.wall([[gx, 152], [gx, 192]], { r: 3 });
    b.post(gx, 150, 5);
  }
  b.bumper('cloud_1', 118, 196, { group: 'clouds', r: 24, icon: 'cloud' });
  b.bumper('cloud_2', 200, 140, { group: 'clouds', r: 24, icon: 'cloud' });
  b.bumper('cloud_3', 130, 282, { group: 'clouds', r: 24, icon: 'cloud' });

  // --- Inserts that preview shots ---
  b.insert('ins_loop_l', 196, 606, { deg: -90, color: MAGMA });
  b.insert('ins_loop_r', 376, 606, { deg: -90, color: MAGMA });
  b.insert('ins_pocket', 286, 590, { deg: -90 });
  b.insert('ins_geyser', 150, 672, { deg: -112, color: EMBER });
  b.insert('ins_ramp', 398, 716, { deg: -70, color: ICE });
  b.insert('ins_hydro', 331, 572, { deg: -90, size: 11, color: OCEAN });
  b.insert('ins_atmo', 512, 606, { deg: 0, size: 11, color: AIR });
  b.insert('ins_sun', 308, 116, { shape: 'star', size: 13 });
  b.insert('ins_stations', 286, 640, { shape: 'circle', size: 9, color: MINT });
}

// ---------------------------------------------------------------- printed playfield art

/** Text laid along a circular arc (centre cx,cy; radius r; centred on angle a0, degrees). */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, a0: number, size: number, color: string, lit: number) {
  ctx.save();
  ctx.font = `800 ${size}px "Fraunces Variable", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const widths = [...text].map((ch) => ctx.measureText(ch).width + size * 0.08);
  const total = widths.reduce((s, w) => s + w, 0);
  let a = (a0 * Math.PI) / 180 - total / r / 2;
  for (let i = 0; i < text.length; i++) {
    const w = widths[i];
    const ang = a + w / r / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.rotate(ang + Math.PI / 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,14,34,0.85)';
    ctx.strokeText(text[i], 0, 0);
    if (lit > 0.02) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 * lit;
    }
    ctx.fillStyle = rgba(color, 0.35 + 0.65 * lit);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    a += w / r;
  }
  ctx.restore();
}

function glyphFor(ctx: CanvasRenderingContext2D, glyph: string, s: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (glyph === 'rock') {
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.6);
    ctx.lineTo(-s * 0.55, -s * 0.35);
    ctx.lineTo(-s * 0.05, -s * 0.15);
    ctx.lineTo(s * 0.3, -s * 0.75);
    ctx.lineTo(s, s * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (glyph === 'drop') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.05, s * 0.75, s * 0.9, 0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.75, s * 0.9, -s * 0.9, -s * 0.05, 0, -s);
    ctx.fill();
  } else if (glyph === 'cloud') {
    ctx.beginPath();
    ctx.arc(-s * 0.42, s * 0.15, s * 0.42, 0, TAU);
    ctx.arc(s * 0.08, -s * 0.18, s * 0.55, 0, TAU);
    ctx.arc(s * 0.55, s * 0.18, s * 0.38, 0, TAU);
    ctx.fill();
    ctx.fillRect(-s * 0.42, s * 0.1, s * 0.97, s * 0.46);
  } else if (glyph === 'leaf') {
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, s * 0.8);
    ctx.bezierCurveTo(-s * 0.9, -s * 0.4, s * 0.2, -s, s * 0.85, -s * 0.85);
    ctx.bezierCurveTo(s * 0.9, 0, s * 0.1, s * 0.75, -s * 0.7, s * 0.8);
    ctx.fill();
  }
}

/** Small sphere badge: a disc in the sphere's colour with its glyph. */
function badge(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glyph: string, lit: number) {
  ctx.save();
  if (lit > 0.02) glowDot(ctx, x, y, r * 2.4, color, 0.45 * lit);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = mix('#14203f', color, 0.25 + 0.55 * lit);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(IVORY, 0.35 + 0.5 * lit);
  ctx.stroke();
  ctx.fillStyle = rgba(IVORY, 0.55 + 0.45 * lit);
  ctx.translate(x, y);
  glyphFor(ctx, glyph, r * 0.62);
  ctx.restore();
}

/** Loop channel bed: warm at the bottom of both legs, cooling toward the top. */
function loopBed(ctx: CanvasRenderingContext2D, lit: number, glow: number) {
  const { cx, cy, ri, ro, legBottom } = LOOP;
  const rm = (ri + ro) / 2;
  const width = ro - ri - 8;
  const top = cy - ro;
  const pts: [number, number][] = [];
  for (let y = legBottom; y >= cy; y -= 8) pts.push([cx - rm, y]);
  for (let a = 180; a <= 360; a += 4) pts.push([cx + Math.cos((a * Math.PI) / 180) * rm, cy + Math.sin((a * Math.PI) / 180) * rm]);
  for (let y = cy; y <= legBottom; y += 8) pts.push([cx + rm, y]);
  const heatAt = (y: number) => Math.max(0, Math.min(1, (y - top) / (legBottom - top)));
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const c = mix(mix('#3b7fd0', ICE, 0.35), mix(EMBER, MAGMA, 0.3), Math.pow(heatAt((y1 + y2) / 2), 1.3));
    ctx.strokeStyle = rgba(mix('#1b2550', c, 0.3 + 0.45 * lit), 0.92);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // a dotted centre line of "parcels", brighter as the cell awakens
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = pts[i];
    glowDot(ctx, x, y, 4 + 4 * glow, heatAt(y) > 0.5 ? MAGMA : ICE, 0.25 + 0.6 * glow);
  }
  ctx.restore();
}

/** Cutaway Earth inside the island: ocean and land outside; crust, mantle (with cells) and core inside. */
function globeArt(ctx: CanvasRenderingContext2D, lit: number, heat: number, cells: number) {
  const { x, y, r } = GLOBE;
  ctx.save();
  glowDot(ctx, x, y, r + 16, AIR, 0.18 + 0.3 * lit);
  const og = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  og.addColorStop(0, mix('#3d6fb0', '#6cc4ff', lit));
  og.addColorStop(1, mix('#16305e', '#1d5fa6', lit));
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  const rr = rng(1010);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 7; i++) {
    const a = rr() * TAU;
    const d = rr() * r * 0.7;
    ctx.fillStyle = rgba(mix('#47613a', LEAF, lit), 0.85);
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 8 + rr() * 12, 5 + rr() * 9, rr() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // cutaway wedge showing the layers: thin crust, thick mantle, iron-nickel core
  const a0 = -0.15;
  const a1 = Math.PI * 0.62;
  const wedge = (rad: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, rad, a0, a1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  wedge(r, mix('#5a3a24', ROCK, 0.4 + 0.5 * lit));
  wedge(r - 5, mix('#5a1e14', EMBER, 0.35 + 0.55 * heat));
  wedge(r * 0.45, mix('#7a5a18', GOLD, 0.4 + 0.6 * heat));
  glowDot(ctx, x, y, r * 0.6, GOLD, 0.12 + 0.45 * heat);
  if (cells > 0.01) {
    // mantle convection cells: slow loops of hot, solid rock
    ctx.save();
    ctx.strokeStyle = rgba(IVORY, 0.75 * cells);
    ctx.fillStyle = rgba(IVORY, 0.8 * cells);
    ctx.lineWidth = 1.6;
    for (const ang of [0.28, 0.98]) {
      const mx = x + Math.cos(ang) * r * 0.72;
      const my = y + Math.sin(ang) * r * 0.72;
      ctx.beginPath();
      ctx.ellipse(mx, my, 9, 5.5, ang + Math.PI / 2, 0.3, TAU - 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx + Math.cos(ang + Math.PI / 2 - 0.5) * 9, my + Math.sin(ang + Math.PI / 2 - 0.5) * 9, 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(IVORY, 0.35 + 0.4 * lit);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  glowDot(ctx, x - r * 0.4, y - r * 0.45, r * 0.35, '#ffffff', 0.18);
  ctx.restore();
}

/** Layered rock strata filling a band (the gorge walls). */
function strata(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, lit: number, seed: number) {
  const r = rng(seed);
  const cols = ['#6b4a35', '#8a5b3c', '#5b3d2e', '#a06a44', '#74503a'];
  let y = y0;
  let k = 0;
  while (y < y1) {
    const h = 14 + r() * 22;
    const c = cols[k % cols.length];
    ctx.fillStyle = mix(mix(c, '#1a2140', 0.45), c, 0.35 + 0.5 * lit);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.08 + k) * 3);
    ctx.lineTo(x1, y + h);
    for (let x = x1; x >= x0; x -= 8) ctx.lineTo(x, y + h + Math.sin(x * 0.08 + k + 1) * 3);
    ctx.closePath();
    ctx.fill();
    y += h;
    k++;
  }
}

function paintBackdrop({ ctx, level }: SceneryContext) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);
  const dawn = 0.15 + 0.85 * s2;

  // --- sky: deep sapphire night warming to dawn as the workshop powers up
  ctx.fillStyle = vgrad(ctx, 0, 1150, [
    [0, mix(NIGHT, '#1a3270', dawn)],
    [0.3, mix('#16295a', '#2c5296', dawn)],
    [0.5, mix('#1d2f62', '#4f6fb2', dawn)],
    [0.565, mix('#2a2a5a', '#d98a78', dawn * 0.8)],
    [0.6, mix('#1a2a4c', '#2a4a76', dawn)],
    [1, '#0b1428'],
  ]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 10, 70, [40, 30, 560, 300], IVORY);
  if (s2 < 0.9) {
    ctx.fillStyle = rgba(NIGHT, 0.25 * (1 - s2));
    ctx.fillRect(0, 0, 600, 300);
  }

  // --- the Sun above the S-U-N lanes (radiation: energy travelling as light)
  const sunX = 308;
  const sunY = 92;
  glowDot(ctx, sunX, sunY, 120, GOLD, 0.1 + 0.25 * dawn);
  glowDot(ctx, sunX, sunY, 60, '#fff2c4', 0.15 + 0.3 * dawn);
  ctx.fillStyle = mix('#7a5a2a', '#f2b84e', dawn);
  ctx.beginPath();
  ctx.arc(sunX, sunY, 30, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba('#fff4cf', 0.3 + 0.6 * dawn);
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    ctx.beginPath();
    ctx.moveTo(sunX + Math.cos(a) * 36, sunY + Math.sin(a) * 36);
    ctx.lineTo(sunX + Math.cos(a) * (44 + (i % 2) * 8), sunY + Math.sin(a) * (44 + (i % 2) * 8));
    ctx.stroke();
  }
  // Solar rays (level 2): wavy light arrows down to the ocean and the forest
  if (s2 > 0.01) {
    // wavy light (radiation) leaving the sun toward the sky and the sea
    for (const ang of [-2.6, -0.55, 0.15, 2.95]) {
      neonPath(ctx, () => {
        ctx.beginPath();
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          const d = 58 + u * 70;
          const w = Math.sin(u * 14) * 4;
          const px = sunX + Math.cos(ang) * d - Math.sin(ang) * w;
          const py = sunY + Math.sin(ang) * d + Math.cos(ang) * w;
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
      }, GOLD, 0.6 * s2, 2);
    }
    // the same light arriving at the ocean surface
    for (const x0 of [430, 500]) {
      neonPath(ctx, () => {
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const u = i / 10;
          const px = x0 - 30 + u * 30 + Math.sin(u * 12) * 4;
          const py = 560 + u * 80;
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
      }, GOLD, 0.5 * s2, 2);
    }
  }

  // --- horizon: land on the left, ocean on the right, meeting under the globe
  const hy = 650;
  ctx.fillStyle = vgrad(ctx, hy - 20, 1150, [[0, mix('#1b3f6e', OCEAN, 0.35 + 0.45 * s1)], [0.4, mix('#102a4f', '#1c5c96', s1)], [1, '#081428']]);
  ctx.fillRect(0, hy - 6, 600, 1150 - hy + 6);
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const y = hy + 10 + i * 26;
    ctx.strokeStyle = rgba(ICE, (0.1 + 0.18 * s1) * (1 - i / 22));
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 250; x <= 600; x += 6) {
      const yy = y + Math.sin(x * 0.06 + i * 1.3) * 3;
      if (x === 250) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = vgrad(ctx, hy - 40, 1150, [[0, mix('#2a4030', '#3f7a46', 0.3 + 0.6 * s1)], [0.5, mix('#1c2a22', '#2b4d33', s1)], [1, '#0d160f']]);
  ctx.beginPath();
  ctx.moveTo(0, hy - 30);
  ctx.bezierCurveTo(90, hy - 46, 170, hy - 20, 230, hy + 10);
  ctx.bezierCurveTo(262, hy + 40, 236, hy + 160, 200, hy + 260);
  ctx.bezierCurveTo(170, hy + 360, 150, 1060, 150, 1150);
  ctx.lineTo(0, 1150);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba('#f4dfa0', 0.25 + 0.35 * s1);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(150, hy - 26);
  ctx.bezierCurveTo(200, hy - 12, 240, hy + 20, 246, hy + 60);
  ctx.bezierCurveTo(240, hy + 150, 205, hy + 250, 186, hy + 330);
  ctx.stroke();
  // forest (biosphere) along the land
  const fr = rng(77);
  for (let i = 0; i < 46; i++) {
    const x = 20 + fr() * 190;
    const y = hy - 30 + fr() * 300;
    const shade = fr();
    const s = 6 + fr() * 7;
    if (x > 200 - (y - hy) * 0.15) continue;
    ctx.fillStyle = mix('#1f3b26', LEAF, 0.2 + 0.6 * s1 * (0.6 + 0.4 * shade));
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.6);
    ctx.lineTo(x + s, y + s * 0.4);
    ctx.lineTo(x - s, y + s * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  // --- Geyser Gorge (left): rock strata and a mossy canyon floor
  strata(ctx, 24, 164, 410, 690, s1, 31);
  ctx.fillStyle = vgrad(ctx, 430, 700, [[0, rgba('#0e2a24', 0.85)], [1, rgba(mix('#14322a', '#2d6a4a', s1), 0.9)]]);
  ctx.fillRect(28, 440, 50, 200);
  const fern = rng(12);
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const x = 32 + fern() * 42;
    const y = 450 + fern() * 170;
    ctx.strokeStyle = rgba(mix('#2b5a3a', LEAF, s1), 0.75);
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.quadraticCurveTo(x + (fern() - 0.5) * 16, y, x + (fern() - 0.5) * 14, y - 10);
    ctx.stroke();
  }
  // hot rock under the geyser and its steam column
  glowDot(ctx, 122, 660, 70, EMBER, 0.15 + 0.45 * s2);
  glowDot(ctx, 122, 640, 32, MAGMA, 0.2 + 0.5 * s2);
  for (let i = 0; i < 16; i++) {
    const u = i / 16;
    glowDot(ctx, 122 - u * 40 + Math.sin(i * 1.7) * 6, 590 - u * 330, 16 + u * 10, '#e8f6ff', (0.05 + 0.18 * s2) * (1 - u * 0.6));
  }
  if (s2 > 0.01) {
    for (const ax of [100, 144]) {
      neonPath(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(ax, 750);
        ctx.lineTo(ax, 690);
        ctx.moveTo(ax - 8, 702);
        ctx.lineTo(ax, 690);
        ctx.lineTo(ax + 8, 702);
      }, EMBER, s2, 3);
    }
  }
  neonText(ctx, 'INNER HEAT', 122, 770, 15, EMBER, 0.25 + 0.75 * s2, SANS);

  // --- right: evaporation wisps rising from the ocean along the ramp
  for (let i = 0; i < 26; i++) {
    const u = i / 26;
    const x = 470 + Math.sin(u * 9) * 18 + (u > 0.5 ? (u - 0.5) * -60 : 0);
    const y = 660 - u * 430;
    glowDot(ctx, x, y, 9, ICE, (0.06 + 0.22 * s2) * (0.5 + 0.5 * Math.sin(u * 13)));
  }
  // The ramp's name (the 3D view does not draw ramp labels) and the solar half of the
  // solar-versus-inner-heat pair printed across the lower playfield
  neonText(ctx, 'EVAPORATION RAMP', 468, 742, 12, ICE, 0.35 + 0.65 * s1, SANS);
  neonText(ctx, 'SOLAR ENERGY', 468, 770, 15, GOLD, 0.25 + 0.75 * s2, SANS);

  // --- clouds around the cloud bumpers
  for (const [x, y, s] of [[118, 196, 60], [200, 140, 52], [130, 282, 56], [210, 236, 34], [64, 250, 30]] as [number, number, number][]) {
    for (let k = 0; k < 4; k++) glowDot(ctx, x + (k - 1.5) * s * 0.35, y + Math.sin(k * 2.1) * s * 0.12, s * 0.55, mix('#4a5c8e', '#e6efff', 0.35 + 0.5 * dawn), 0.35);
  }

  // --- the Convection Loop bed and its labels
  loopBed(ctx, 0.35 + 0.65 * s1, s3);
  // Far enough outside the loop's outer wall that the wall does not hide it in the 3D view
  arcText(ctx, 'CONVECTION LOOP', LOOP.cx, LOOP.cy, LOOP.ro + 52, 270, 15, GOLD, 0.35 + 0.65 * s3);
  neonText(ctx, 'COOLS', LOOP.cx - 44, LOOP.cy - 98, 12, ICE, 0.3 + 0.7 * s3, SANS);
  neonText(ctx, 'COOLS', LOOP.cx + 44, LOOP.cy - 98, 12, ICE, 0.3 + 0.7 * s3, SANS);
  for (const lx of [LOOP.cx - (LOOP.ri + LOOP.ro) / 2, LOOP.cx + (LOOP.ri + LOOP.ro) / 2]) {
    ctx.save();
    ctx.translate(lx, 480);
    ctx.rotate(-Math.PI / 2);
    neonText(ctx, 'WARMS', 0, 0, 12, MAGMA, 0.3 + 0.7 * s3, SANS);
    ctx.restore();
  }

  // --- the Globe island: cutaway Earth, the sphere badges and the Globe Lab
  ctx.fillStyle = vgrad(ctx, 320, 532, [[0, mix('#16244a', '#24407a', s1)], [1, mix('#101a36', '#1a2c58', s1)]]);
  ctx.beginPath();
  ctx.arc(LOOP.cx, LOOP.cy, LOOP.ri, Math.PI, TAU);
  ctx.lineTo(LOOP.cx + LOOP.ri, 532);
  ctx.lineTo(LOOP.cx - LOOP.ri, 532);
  ctx.closePath();
  ctx.fill();
  globeArt(ctx, 0.3 + 0.7 * s1, 0.25 + 0.75 * s2, s3);
  // The Wind Vane's name, just under the vane at the top of the loop (3D omits spinner labels)
  neonText(ctx, 'WIND VANE', LOOP.cx, LOOP.cy - LOOP.ri + 18, 10, AIR, 0.35 + 0.65 * s3, SANS);
  ctx.fillStyle = rgba(AIR, 0.45 + 0.5 * s3);
  ctx.beginPath();
  ctx.moveTo(LOOP.cx, LOOP.cy - LOOP.ri + 4);
  ctx.lineTo(LOOP.cx + 5, LOOP.cy - LOOP.ri + 10);
  ctx.lineTo(LOOP.cx - 5, LOOP.cy - LOOP.ri + 10);
  ctx.closePath();
  ctx.fill();
  badge(ctx, 241, 512, 11, ROCK, 'rock', s1);
  badge(ctx, 331, 512, 11, OCEAN, 'drop', s1);
  badge(ctx, 52, 520, 12, LEAF, 'leaf', s1);
  badge(ctx, 512, 560, 12, AIR, 'cloud', s1);
  plaque(ctx, 'ROCK', 241, 492, rgba(ROCK, 0.85), '#1a1030', 8);
  plaque(ctx, 'WATER', 331, 492, rgba(OCEAN, 0.85), '#08142a', 8);
  neonText(ctx, 'FOUR SPHERES, ONE PLANET', 286, 668, 13, MINT, 0.25 + 0.75 * s1, SANS);

  // --- lower apron: the Skyworks emblem (four nested arcs = four spheres)
  SPHERES.forEach((s, i) => {
    ctx.strokeStyle = rgba(s.color, 0.3 + 0.6 * s1);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(286, 1072, 14 + i * 7, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  });
  ctx.fillStyle = rgba(GOLD, 0.4 + 0.5 * s2);
  ctx.beginPath();
  ctx.arc(286, 1072, 7, 0, TAU);
  ctx.fill();

  // --- level 4: aurora ribbons across the powered sky
  if (s4 > 0.01) {
    for (let k = 0; k < 3; k++) {
      const c = [MINT, AIR, LEAF][k];
      const g = ctx.createLinearGradient(0, 20, 0, 260);
      g.addColorStop(0, rgba(c, 0));
      g.addColorStop(0.5, rgba(c, 0.22 * s4));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 260);
      for (let x = 0; x <= 600; x += 12) ctx.lineTo(x, 80 + 40 * Math.sin(x * 0.012 + k * 1.9) - k * 20);
      ctx.lineTo(600, 260);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
  }
  // the lower frame stays calm and dark for readability
  ctx.fillStyle = 'rgba(6,10,24,0.22)';
  ctx.fillRect(0, 800, 600, 350);
}

// ---------------------------------------------------------------- 3D attraction set

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

/** Earth texture: oceans, continents, ice caps and a few cloud streaks. */
function earthTexture(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 1024, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1d4f8f');
    g.addColorStop(0.5, '#2f8bd6');
    g.addColorStop(1, '#1d4f8f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    const r = rng(404);
    for (let i = 0; i < 26; i++) {
      const x = r() * 1024;
      const y = 120 + r() * 280;
      const w = 30 + r() * 110;
      const h = 20 + r() * 70;
      ctx.fillStyle = r() < 0.7 ? '#4f9a4a' : '#b8935a';
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, r() * TAU, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3f8a42';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.2, y - h * 0.2, w * 0.45, h * 0.4, r() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(0, 0, 1024, 40);
    ctx.fillRect(0, 472, 1024, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.ellipse(r() * 1024, 60 + r() * 400, 40 + r() * 60, 6 + r() * 6, 0, 0, TAU);
      ctx.fill();
    }
  });
}

/** Concentric layers for the cut faces of the geosphere model (crust, mantle, outer and inner core). */
function layerFaceTexture(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 512, 512, (ctx) => {
    const c = 256;
    const rings: [number, string][] = [[256, '#7a5236'], [240, '#c2452a'], [190, '#e2662f'], [118, '#ffb347'], [62, '#fff0b0']];
    for (const [rad, col] of rings) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(c, c, rad, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,240,210,0.85)';
    ctx.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.ellipse(c + Math.cos(a) * 178, c + Math.sin(a) * 178, 40, 24, a + Math.PI / 2, 0.4, TAU - 0.6);
      ctx.stroke();
    }
  });
}

/** A hot-air balloon: heated air spreads out, becomes less dense, and is pushed upward. */
function hotAirBalloon(kit: SetKit, color: string, stripe: string): THREE.Group {
  const g = new THREE.Group();
  const tex = canvasTex(kit, 256, 128, (ctx) => {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? color : stripe;
      ctx.fillRect(i * 16, 0, 16, 128);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 44, 256, 10);
  });
  const env = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 20), kit.track(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.45, clearcoat: 0.4, emissive: '#ff9a4a', emissiveIntensity: 0 })));
  env.scale.set(1, 1.2, 1);
  env.position.y = 0.95;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.22, 16, 1, true), kit.mats.plastic(stripe));
  skirt.position.y = 0.3;
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2), kit.mats.wood());
  g.add(env, skirt, basket);
  return g;
}

/** Strata texture for island sides (horizontal rock bands with a grassy lip). */
function strataTexture(kit: SetKit, seed: number, lip: string): THREE.CanvasTexture {
  const t = canvasTex(kit, 512, 256, (ctx) => {
    const r = rng(seed);
    const cols = ['#5b3d2e', '#7a5236', '#8a5b3c', '#4a3328', '#a06a44', '#6b4a35'];
    let y = 0;
    let k = 0;
    while (y < 256) {
      const h = 18 + r() * 34;
      ctx.fillStyle = cols[k % cols.length];
      ctx.fillRect(0, y, 512, h + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 14; i++) ctx.fillRect(r() * 512, y + r() * h, 10 + r() * 40, 2);
      y += h;
      k++;
    }
    ctx.fillStyle = lip;
    ctx.fillRect(0, 0, 512, 18);
    for (let i = 0; i < 60; i++) ctx.fillRect(r() * 512, 14, 4, 6 + r() * 12);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/** Soft cloud-sea texture for the floor the workshop floats on. */
function cloudSeaTexture(kit: SetKit): THREE.CanvasTexture {
  return canvasTex(kit, 1024, 1024, (ctx) => {
    ctx.fillStyle = '#121a38';
    ctx.fillRect(0, 0, 1024, 1024);
    const r = rng(321);
    for (let i = 0; i < 420; i++) {
      const x = r() * 1024;
      const y = r() * 1024;
      const rad = 20 + r() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() < 0.5 ? '170,184,232' : '214,190,226';
      g.addColorStop(0, `rgba(${c},${0.1 + r() * 0.16})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, TAU);
      ctx.fill();
    }
  });
}

/** Island top: a meadow (grass with flowers) or a sandy beach. */
function topTexture(kit: SetKit, base: string, speck: string[], seed: number): THREE.CanvasTexture {
  return canvasTex(kit, 512, 512, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(seed);
    for (let i = 0; i < 160; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const rad = 12 + r() * 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const c = r() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
      g.addColorStop(0, c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = speck[i % speck.length];
      ctx.beginPath();
      ctx.arc(r() * 512, r() * 512, 1.5 + r() * 2.5, 0, TAU);
      ctx.fill();
    }
  });
}

/** Floating island: rock slab with a top (meadow or sand), strata sides and a hanging rock cone. */
function floatingIsland(kit: SetKit, pos: [number, number, number], radius: number, top: string, seed: number, specks: string[] = ['#ffd36b', '#ff9fc0', '#fff7e7']): { group: THREE.Group; topMat: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const side = strataTexture(kit, seed, top);
  const sideMat = kit.track(new THREE.MeshStandardMaterial({ map: side, roughness: 0.9 }));
  const tt = topTexture(kit, top, specks, seed + 1);
  const topMat = kit.track(new THREE.MeshStandardMaterial({ map: tt, roughness: 0.9, emissive: '#ffffff', emissiveMap: tt, emissiveIntensity: 0.02 }));
  const slabGeo = new THREE.CylinderGeometry(radius, radius * 0.9, 0.42, 36, 2);
  const coneGeo = new THREE.ConeGeometry(radius * 0.88, radius * 1.25, 30, 5);
  const r = rng(seed);
  const wob = [r() * TAU, r() * TAU, r() * TAU];
  for (const geo of [slabGeo, coneGeo]) {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const a = Math.atan2(z, x);
      const f = 1 + 0.08 * Math.sin(3 * a + wob[0]) + 0.05 * Math.sin(5 * a + wob[1]) + 0.03 * Math.sin(9 * a + wob[2]);
      p.setXYZ(i, x * f, p.getY(i), z * f);
    }
    geo.computeVertexNormals();
  }
  const slab = new THREE.Mesh(slabGeo, [sideMat, topMat, sideMat]);
  slab.castShadow = true;
  slab.receiveShadow = true;
  const cone = new THREE.Mesh(coneGeo, sideMat);
  cone.rotation.x = Math.PI;
  cone.position.y = -0.21 - radius * 0.62;
  g.add(slab, cone);
  g.position.set(pos[0], pos[1], pos[2]);
  kit.add(g);
  return { group: g, topMat };
}

const skyworksSet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  const motion = !kit.reducedMotion;
  const skyMesh = kit.sky('#2a4686', '#0a0e22');
  const skyU = (skyMesh.material as THREE.ShaderMaterial).uniforms as { top: { value: THREE.Color }; bottom: { value: THREE.Color } };
  const skyTop0 = new THREE.Color('#2a4686');
  const skyTop1 = new THREE.Color('#4a78cc');
  const skyBot0 = new THREE.Color('#0a0e22');
  const skyBot1 = new THREE.Color('#5a3456');
  const seaCool = new THREE.Color('#9fb0ff');
  const seaWarm = new THREE.Color('#ffc8a8');
  const dummy = new THREE.Object3D();
  const tmpC = new THREE.Color();
  const warmC = new THREE.Color(EMBER);
  const coolC = new THREE.Color('#4aa8ff');
  const brass = kit.mats.brass();

  // ---- The cloud sea the workshop floats on: a soft lit floor plus low puffs at the edges
  const seaTex = cloudSeaTexture(kit);
  seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
  seaTex.repeat.set(3, 3);
  const floorMat = kit.track(new THREE.MeshStandardMaterial({ map: seaTex, emissive: '#ffffff', emissiveMap: seaTex, emissiveIntensity: 0.25, roughness: 1 }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(34, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = gy;
  floor.receiveShadow = true;
  kit.add(floor);
  const puffN = kit.n(70);
  const puffMat = kit.track(new THREE.MeshStandardMaterial({ color: '#b4bce4', roughness: 1, emissive: '#7a86c8', emissiveIntensity: 0.3 }));
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), puffMat, puffN);
  const pr = rng(910);
  let placed = 0;
  for (let tries = 0; placed < puffN && tries < puffN * 10; tries++) {
    const x = (pr() - 0.5) * 34;
    const z = -18 + pr() * 26;
    const s = 0.35 + pr() * 0.6;
    const squash = pr();
    const turn = pr();
    // keep the cabinet, the side sets and the head strip clear
    if (Math.abs(x) < 9.6) continue;
    dummy.position.set(x, gy - 0.12, z);
    dummy.scale.set(s * (1.5 + squash), s * 0.45, s);
    dummy.rotation.set(0, turn * TAU, 0);
    dummy.updateMatrix();
    puffs.setMatrixAt(placed++, dummy.matrix);
  }
  puffs.count = placed;
  kit.add(puffs);

  // ---- Left floating island: the geosphere and biosphere (rock, a geyser, a grove)
  const left = floatingIsland(kit, [-6.35, gy + 0.32, 0.6], 2.0, '#3f7a46', 7);
  const geoPos = new THREE.Vector3(-6.2, 1.95, -2.55);
  const R = 1.1;
  const geo = new THREE.Group();
  const shellMat = kit.track(new THREE.MeshPhysicalMaterial({ map: earthTexture(kit), roughness: 0.55, clearcoat: 0.5, emissive: '#2f8bd6', emissiveIntensity: 0.02 }));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32, Math.PI * 0.5, Math.PI * 1.5), shellMat);
  shell.castShadow = true;
  const faceTex = layerFaceTexture(kit);
  const faceMat = kit.track(new THREE.MeshStandardMaterial({ map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.08, roughness: 0.7, side: THREE.DoubleSide }));
  const faceA = new THREE.Mesh(new THREE.CircleGeometry(R, 48, -Math.PI / 2, Math.PI), faceMat);
  const faceB = new THREE.Mesh(new THREE.CircleGeometry(R, 48, -Math.PI / 2, Math.PI), faceMat);
  faceB.rotation.y = -Math.PI / 2;
  const coreMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a2008', emissive: '#ffb347', emissiveIntensity: 0.2 }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.36, 24, 16, 0, Math.PI * 0.5), coreMat);
  geo.add(shell, faceA, faceB, core);
  geo.position.copy(geoPos);
  geo.rotation.set(0.12, 0.62, 0);
  kit.add(geo);
  const gimbal = new THREE.Mesh(new THREE.TorusGeometry(R + 0.12, 0.035, 10, 64, Math.PI * 1.3), brass);
  gimbal.position.copy(geoPos);
  gimbal.rotation.set(0, 0.62, -Math.PI * 0.15);
  kit.add(gimbal);
  const stemH = geoPos.y - R - gy;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, stemH, 12), brass);
  stem.position.set(geoPos.x, gy + stemH / 2, geoPos.z);
  kit.add(stem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.18, 32), kit.mats.paintedMetal('#2b3560'));
  base.position.set(geoPos.x, gy + 0.09, geoPos.z);
  kit.add(base);
  const heatSign = kit.neonSign('INNER HEAT', [-5.55, 0.55, -1.15], { height: 0.36, color: EMBER, rotY: 0.5 });
  heatSign.rotation.x = -0.6;

  // The geyser: a crater mound on the island, powered by hot rock below
  const islandTop = gy + 0.32 + 0.21;
  const moundGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0.95, 0), new THREE.Vector2(0.8, 0.14), new THREE.Vector2(0.5, 0.36), new THREE.Vector2(0.3, 0.5),
    new THREE.Vector2(0.2, 0.52), new THREE.Vector2(0.16, 0.42),
  ], 32);
  const moundTex = canvasTex(kit, 256, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#5b3d2e');
    g.addColorStop(0.55, '#7a5a44');
    g.addColorStop(0.8, '#b8a890');
    g.addColorStop(1, '#efe6d6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const r = rng(61);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.14})`;
      ctx.fillRect(r() * 256, r() * 256, 8 + r() * 30, 2 + r() * 3);
    }
  });
  const mound = new THREE.Mesh(moundGeo, kit.track(new THREE.MeshStandardMaterial({ map: moundTex, roughness: 0.92 })));
  mound.position.set(-5.35, islandTop, 1.2);
  mound.castShadow = true;
  kit.add(mound);
  kit.rock([-4.6, islandTop + 0.05, 1.75], 0.22, '#6b4a35', 9);
  kit.rock([-5.9, islandTop + 0.05, 1.9], 0.18, '#5b3d2e', 10);
  const ventMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: EMBER, emissiveIntensity: 0.2 }));
  const vent = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), ventMat);
  vent.rotation.x = -Math.PI / 2;
  vent.position.set(-5.35, islandTop + 0.43, 1.2);
  kit.add(vent);
  const plumeN = kit.n(220);
  const plumePos = new Float32Array(plumeN * 3);
  const plumeSeed = new Float32Array(plumeN * 3);
  const ps = rng(55);
  for (let i = 0; i < plumeN; i++) {
    plumeSeed[i * 3] = ps();
    plumeSeed[i * 3 + 1] = (ps() - 0.5) * 2;
    plumeSeed[i * 3 + 2] = (ps() - 0.5) * 2;
  }
  const plumeGeo = new THREE.BufferGeometry();
  plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3));
  const plumeMat = kit.track(new THREE.PointsMaterial({ color: '#eaf6ff', size: 0.34, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending }));
  kit.add(new THREE.Points(plumeGeo, plumeMat));
  const vx0 = -5.35;
  const vy0 = islandTop + 0.45;
  const vz0 = 1.2;
  let plumeHeight = 0.6;

  // The biosphere grove on the island's back and far side
  kit.tree([-7.35, islandTop, -0.2], 1.7, '#4fae5a', 2);
  kit.tree([-7.55, islandTop, 1.55], 1.35, '#6cc46a', 4);
  kit.tree([-6.55, islandTop, 2.25], 1.0, '#58b86a', 6);
  const fireflies = kit.motes({ x0: -8.3, x1: -5.2, y0: 0.3, y1: 2.2, z0: -1.0, z1: 2.8 }, 50, LEAF, { speed: 0.08, size: 0.09 });

  // ---- Right floating island: the hydrosphere (an ocean basin), evaporation and a rain cloud
  floatingIsland(kit, [6.4, gy + 0.32, 0.1], 2.05, '#b59a6c', 11, ['#e8d6a8', '#8a7656', '#f4e8c8']);
  const rTop = gy + 0.32 + 0.21;
  const basinRim = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.1, 12, 64), kit.mats.wood());
  basinRim.rotation.x = Math.PI / 2;
  basinRim.position.set(6.35, rTop + 0.08, 0.05);
  kit.add(basinRim);
  const seaTex2 = canvasTex(kit, 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, '#5fc4ff');
    g.addColorStop(1, '#1a5fa6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(220,245,255,0.35)';
    ctx.lineWidth = 3;
    const r = rng(17);
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      const x = r() * 256;
      const y = r() * 256;
      ctx.arc(x, y, 8 + r() * 16, 0.3, 1.6);
      ctx.stroke();
    }
  });
  seaTex2.wrapS = seaTex2.wrapT = THREE.RepeatWrapping;
  const oceanMat = kit.track(new THREE.MeshPhysicalMaterial({ map: seaTex2, emissive: '#2E8BD6', emissiveMap: seaTex2, emissiveIntensity: 0.15, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.94 }));
  const ocean = new THREE.Mesh(new THREE.CircleGeometry(1.32, 48), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(6.35, rTop + 0.1, 0.05);
  kit.add(ocean);
  // Waterfall spilling off the island's front edge back down into the clouds
  const fallTex = canvasTex(kit, 64, 256, (ctx) => {
    const r = rng(23);
    ctx.clearRect(0, 0, 64, 256);
    for (let i = 0; i < 40; i++) {
      const x = r() * 64;
      ctx.fillStyle = `rgba(200,236,255,${0.25 + r() * 0.5})`;
      ctx.fillRect(x, r() * 256, 2 + r() * 3, 30 + r() * 80);
    }
  });
  fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping;
  const fallMat = kit.track(new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, color: '#bfe6ff' }));
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.6, 1, 8), fallMat);
  fall.position.set(7.15, rTop - 0.75, 1.95);
  fall.rotation.y = -0.6;
  kit.add(fall);
  const vapor = kit.motes({ x0: 5.4, x1: 7.3, y0: rTop + 0.1, y1: 2.5, z0: -0.8, z1: 0.9 }, 70, ICE, { speed: 0.22, size: 0.12 });
  const cloudMat = kit.track(new THREE.MeshStandardMaterial({ color: '#c9d2ee', roughness: 1, emissive: '#7180c0', emissiveIntensity: 0.15 }));
  const rainCloud = new THREE.Group();
  const cr = rng(29);
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 + cr() * 0.22, 2), cloudMat);
    puff.position.set((i - 3) * 0.24 + (cr() - 0.5) * 0.1, (cr() - 0.3) * 0.18 + (i % 2) * 0.12, (cr() - 0.5) * 0.35);
    puff.scale.y = 0.75;
    rainCloud.add(puff);
  }
  rainCloud.position.set(6.45, 2.65, -0.55);
  kit.add(rainCloud);
  const rain = kit.motes({ x0: 5.9, x1: 7.0, y0: rTop + 0.1, y1: 2.45, z0: -0.7, z1: -0.2 }, 50, '#bfe6ff', { speed: 1.4, size: 0.06, rise: false });
  const solarSign = kit.neonSign('SOLAR ENERGY', [5.55, 0.62, -1.75], { height: 0.36, color: GOLD, rotY: -0.5 });
  solarSign.rotation.x = -0.6;

  // ---- Front right: the convection tank (a physical model: heated below one end, iced above the other)
  floatingIsland(kit, [5.2, gy + 0.32, 4.05], 1.05, '#8a7a5c', 19, ['#c9b48a', '#5f5240']);
  const tankG = new THREE.Group();
  const glassW = 1.5;
  const glassH = 0.8;
  const glassD = 0.55;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(glassW, glassH, glassD), kit.mats.clearPlastic('#d8f4ff', 0.16));
  glass.position.y = 0.2 + glassH / 2;
  const waterBox = new THREE.Mesh(new THREE.BoxGeometry(glassW - 0.04, glassH * 0.84, glassD - 0.04), kit.mats.clearPlastic('#5fb8f0', 0.2));
  waterBox.position.y = 0.2 + glassH * 0.42 + 0.02;
  const bench = new THREE.Mesh(new THREE.BoxGeometry(glassW + 0.2, 0.2, glassD + 0.2), kit.mats.wood());
  bench.position.y = 0.1;
  const heaterMat = kit.track(new THREE.MeshStandardMaterial({ color: '#220a04', emissive: EMBER, emissiveIntensity: 0.3 }));
  const heater = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, glassD - 0.06), heaterMat);
  heater.position.set(-glassW / 2 + 0.32, 0.22, 0);
  const ice = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.32), kit.mats.clearPlastic('#e8fbff', 0.65));
  ice.position.set(glassW / 2 - 0.32, 0.2 + glassH + 0.08, 0);
  tankG.add(bench, waterBox, glass, heater, ice);
  const dyeN = kit.n(46);
  const dye = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' })), dyeN);
  tankG.add(dye);
  const cellA = glassW * 0.36;
  const cellB = glassH * 0.3;
  const cellY = 0.2 + glassH * 0.44;
  const placeDye = (phase: number, glow: number) => {
    for (let i = 0; i < dyeN; i++) {
      const a = (i / dyeN + phase) * TAU;
      // rise on the left over the heater, cross the top, sink on the right under the ice
      const x = -Math.cos(a) * cellA;
      const y = cellY + Math.sin(a) * cellB;
      dummy.position.set(x, y, Math.sin(i * 1.7) * 0.14);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      dye.setMatrixAt(i, dummy.matrix);
      tmpC.copy(coolC).lerp(warmC, Math.max(0, Math.min(1, 0.5 - x / (cellA * 2)))).multiplyScalar(0.35 + 0.9 * glow);
      dye.setColorAt(i, tmpC);
    }
    dye.instanceMatrix.needsUpdate = true;
    if (dye.instanceColor) dye.instanceColor.needsUpdate = true;
  };
  placeDye(0, 0);
  tankG.position.set(5.2, gy + 0.53, 4.0);
  tankG.rotation.y = -0.38;
  kit.add(tankG);
  const tankSign = kit.neonSign('CONVECTION TANK', [5.3, 1.75, 3.7], { height: 0.3, color: MAGMA, rotY: -0.38 });
  tankSign.rotation.x = -0.6;

  // ---- Hot-air balloons drifting over the cloud sea (warm, less dense air is pushed up)
  const balloons = [
    { g: hotAirBalloon(kit, '#ff7a59', '#ffd36b'), x: 8.3, y: 1.5, z: -3.4, ph: 0 },
    { g: hotAirBalloon(kit, '#5fd0c0', '#fff7e7'), x: -8.7, y: 1.6, z: -1.0, ph: 2.1 },
    { g: hotAirBalloon(kit, '#9b8cff', '#ffc75b'), x: 4.4, y: 2.2, z: -3.8, ph: 4.2 },
  ];
  const burnerMats: THREE.MeshPhysicalMaterial[] = [];
  for (const bl of balloons) {
    bl.g.position.set(bl.x, bl.y, bl.z);
    kit.add(bl.g);
    burnerMats.push((bl.g.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial);
  }

  // ---- Front left: the Wind Vane mast (wind is the moving top of a convection cell)
  floatingIsland(kit, [-4.75, gy + 0.32, 4.3], 0.7, '#4a8a52', 23);
  kit.pole([-4.75, 0, 4.3], 2.2, '#cfe4f2');
  const vaneHead = new THREE.Group();
  vaneHead.position.set(-4.75, 2.22, 4.3);
  const cupMat = kit.mats.paintedMetal(MINT);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), kit.mats.chrome());
    arm.rotation.set(0, a, Math.PI / 2);
    arm.position.set(Math.cos(a) * 0.21, 0, -Math.sin(a) * 0.21);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8, 0, TAU, 0, Math.PI / 2), cupMat);
    cup.position.set(Math.cos(a) * 0.42, 0, -Math.sin(a) * 0.42);
    cup.rotation.set(0, a, Math.PI / 2);
    vaneHead.add(arm, cup);
  }
  kit.add(vaneHead);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.36, 10), kit.mats.paintedMetal(GOLD));
  arrow.rotation.z = -Math.PI / 2;
  arrow.position.set(-4.75, 1.95, 4.3);
  kit.add(arrow);

  // ---- Head: the armillary Four-Sphere Globe with a ring of convection parcels
  const headPos = new THREE.Vector3(0, 2.55, -9.8);
  const head = new THREE.Group();
  head.position.copy(headPos);
  kit.add(head);
  const earthMat = kit.track(new THREE.MeshPhysicalMaterial({ map: earthTexture(kit), roughness: 0.5, clearcoat: 0.6, emissive: '#3a7fd0', emissiveIntensity: 0.03 }));
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.45, 48, 32), earthMat);
  head.add(earth);
  const atmoMat = kit.track(new THREE.MeshBasicMaterial({ color: AIR, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  head.add(new THREE.Mesh(new THREE.SphereGeometry(1.62, 40, 24), atmoMat));
  const ringMats: THREE.MeshStandardMaterial[] = [];
  const rings: THREE.Mesh[] = [];
  SPHERES.forEach((s, i) => {
    const m = kit.track(new THREE.MeshStandardMaterial({ color: '#141022', emissive: s.color, emissiveIntensity: 0.1, roughness: 0.35, metalness: 0.4 }));
    ringMats.push(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9 + i * 0.2, 0.035, 10, 96), m);
    ring.rotation.set(Math.PI / 2 + (i - 1.5) * 0.42, i * 0.7, 0);
    head.add(ring);
    rings.push(ring);
  });
  const loopN = kit.n(72);
  const loopMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2 }));
  const loopBeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), loopMat, loopN);
  head.add(loopBeads);
  const placeLoop = (phase: number, glow: number) => {
    for (let i = 0; i < loopN; i++) {
      const a = (i / loopN) * TAU + phase;
      dummy.position.set(Math.cos(a) * 2.85, Math.sin(a) * 2.0, 0.55);
      dummy.scale.setScalar(0.7 + 0.5 * glow);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      loopBeads.setMatrixAt(i, dummy.matrix);
      tmpC.copy(coolC).lerp(warmC, 0.5 - Math.sin(a) * 0.5).multiplyScalar(0.25 + 1.1 * glow);
      loopBeads.setColorAt(i, tmpC);
    }
    loopBeads.instanceMatrix.needsUpdate = true;
    if (loopBeads.instanceColor) loopBeads.instanceColor.needsUpdate = true;
  };
  placeLoop(0, 0);
  const pedH = headPos.y - 1.45 - gy;
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, pedH, 16), brass);
  pedestal.position.set(headPos.x, gy + pedH / 2, headPos.z);
  kit.add(pedestal);
  const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.25, 40), kit.mats.paintedMetal('#2b3560'));
  pedBase.position.set(headPos.x, gy + 0.12, headPos.z);
  kit.add(pedBase);

  // ---- The Sun: the main power source for water, air and life
  const sunMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffd46b' }));
  const sunBright = new THREE.Color('#ffd46b');
  const sunDim = new THREE.Color('#8a6a40');
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 20), sunMat);
  sun.position.set(-6.4, 5.6, -12.5);
  kit.add(sun);
  const coronaMat = kit.track(new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,214,120,1)', 'rgba(255,170,60,0)', 'sun'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), coronaMat);
  corona.position.copy(sun.position);
  corona.position.z += 0.4;
  kit.add(corona);
  const beamMat = kit.track(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  for (const [tx, ty, tz] of [[0, 2.6, -9.8], [-6.2, 1.9, -2.55]] as [number, number, number][]) {
    const to = new THREE.Vector3(tx, ty, tz);
    const len = sun.position.distanceTo(to);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.55, len, 16, 1, true), beamMat);
    beam.position.copy(sun.position).lerp(to, 0.5);
    beam.lookAt(to);
    beam.rotateX(Math.PI / 2);
    kit.add(beam);
  }
  const marquee = kit.neonSign('FOUR-SPHERE SKYWORKS', [0, 1.38, -7.15], { height: 0.74, color: GOLD });
  marquee.rotation.x = -0.75;

  // ---- The aerial workshop itself: an airship crossing the dawn sky
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), kit.mats.paintedMetal('#cfd8ea'));
  hull.scale.set(2.1, 0.75, 0.75);
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.3), kit.mats.wood());
  gondola.position.y = -0.6;
  const finMat = kit.mats.paintedMetal(EMBER);
  const finV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.04), finMat);
  finV.position.set(-1.35, 0.15, 0);
  const finH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.6), finMat);
  finH.position.set(-1.35, 0, 0);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.06), kit.mats.chrome());
  prop.position.set(-1.6, 0, 0);
  const lampMat = kit.track(new THREE.MeshStandardMaterial({ color: '#201808', emissive: GOLD, emissiveIntensity: 0.2 }));
  const windows = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.32), lampMat);
  windows.position.y = -0.55;
  ship.add(hull, gondola, finV, finH, prop, windows);
  ship.position.set(6.2, 4.9, -10.6);
  ship.rotation.y = 0.25;
  kit.add(ship);

  // ---- The panorama the workshop powers: Earth's dawn limb seen from high above
  const panorama = kit.backdrop((ctx, w, h, level) => {
    const s2 = kit.stage(level, 1.3, 2);
    const s4 = kit.stage(level, 3.4, 4);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, mix('#050818', '#0b1a44', s2));
    g.addColorStop(0.55, mix('#13244e', '#2e5aa6', s2));
    g.addColorStop(0.8, mix('#3a2f5a', '#ff9e6b', 0.25 + 0.6 * s2));
    g.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(88);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(255,247,231,${(0.2 + r() * 0.6) * (1 - 0.6 * s2)})`;
      ctx.fillRect(r() * w, r() * h * 0.6, 1.6, 1.6);
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 1.65, w * 0.9, h * 0.85, 0, 0, TAU);
    ctx.fillStyle = mix('#0e2448', '#1f5fa6', s2);
    ctx.fill();
    ctx.lineWidth = 10 + 18 * s2;
    ctx.strokeStyle = rgba('#8fd0ff', 0.35 + 0.5 * s2);
    ctx.stroke();
    ctx.restore();
    if (s4 > 0.01) {
      for (let k = 0; k < 3; k++) {
        const ag = ctx.createLinearGradient(0, h * 0.05, 0, h * 0.6);
        const c = [MINT, AIR, LEAF][k];
        ag.addColorStop(0, rgba(c, 0));
        ag.addColorStop(0.55, rgba(c, 0.38 * s4));
        ag.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.62);
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.22 + 0.08 * Math.sin(x * 0.011 + k * 1.7)) - k * 16);
        ctx.lineTo(w, h * 0.62);
        ctx.closePath();
        ctx.fill();
      }
    }
  }, { width: 30, height: 13, z: -17 });

  // ---- Wonderlight: fireworks in the four sphere colours and drifting sparks
  const fw = kit.fireworks({ x0: -7, x1: 7, y0: 5.5, y1: 8.5, z: -12 }, [ROCK, OCEAN, AIR, LEAF, GOLD]);
  const sparks = kit.motes({ x0: -10, x1: 10, y0: 0, y1: 6, z0: -12, z1: 6 }, 90, GOLD, { speed: 0.1, size: 0.08 });

  // ---- Workshop garlands strung between the floating islands
  kit.pole([7.55, 0, 1.65], 1.95, '#cfe4f2');
  const garlandL = kit.stringLights([-4.75, 2.08, 4.3], [-7.5, 1.7, 1.5], 0.3, kit.n(11), [GOLD, MINT, MAGMA]);
  const garlandR = kit.stringLights([7.55, 1.9, 1.65], [5.75, 1.62, 3.55], 0.22, kit.n(9), [GOLD, ICE, MAGMA]);
  // In the top corners, where the desktop camera actually sees them (x ±9, z −3.4 fell off-frame)
  const fwL = kit.fireworks({ x0: -7, x1: -5.2, y0: 1.6, y1: 2.5, z: -5 }, [ROCK, LEAF, GOLD]);
  const fwR = kit.fireworks({ x0: 5.2, x1: 7, y0: 1.6, y1: 2.5, z: -5 }, [OCEAN, AIR, GOLD]);
  // Wonderlight beacons rising from the islands, and a sunrise spreading across the cloud sea
  const beamTex = canvasTex(kit, 64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const r = rng(5);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.1 + r() * 0.2})`;
      ctx.fillRect(r() * 64, 0, 2 + r() * 4, 256);
    }
  });
  beamTex.wrapS = THREE.RepeatWrapping;
  const beaconMats = [GOLD, ICE].map((c) => kit.track(new THREE.MeshBasicMaterial({ map: beamTex, color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  [[-5.35, 1.2], [6.35, 0.05]].forEach(([x, z], i) => {
    // Slim enough that the geosphere globe behind the left beacon stays readable at level 4
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.72, 4.6, 40, 1, true), beaconMats[i]);
    b.position.set(x, gy + 0.55 + 2.2, z);
    kit.add(b);
  });
  const dawnMat = kit.track(new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,200,120,1)', 'rgba(255,140,90,0)', 'dawn'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const dawnGlow = new THREE.Mesh(new THREE.PlaneGeometry(44, 34), dawnMat);
  dawnGlow.rotation.x = -Math.PI / 2;
  dawnGlow.position.set(0, gy + 0.03, -6);
  kit.add(dawnGlow);

  // ---- Light: warm sunlight on the geosphere side, cool sky on the ocean side, a glow at the globe
  const sunSpot = kit.spot([-3.5, 7.5, 2.5], [-6.2, 0, 0], '#ffd08a', 36, 0.55);
  const seaSpot = kit.spot([3.5, 7.5, 2.5], [6.2, 0, 1.2], '#9fd8ff', 30, 0.55);
  const globeLight = kit.point([0, 3.2, -7.8], '#bfe0ff', 0, 9);

  if (motion) {
    kit.animate((t) => {
      fallTex.offset.y = -t * 0.9;
      seaTex2.offset.set(t * 0.01, t * 0.013);
    });
  }

  let celebrateBoost = 0;
  let spin = 0;
  let vanePhase = 0;
  let cellPhase = 0;
  let eruptT = 0;
  let lastGlow = -1;
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.0);
      const s2 = kit.stage(level, 1.3, 2.0);
      const s3 = kit.stage(level, 2.3, 3.0);
      const s4 = kit.stage(level, 3.4, 4.0);
      const boost = celebrateBoost;
      celebrateBoost = Math.max(0, celebrateBoost - dt * 0.8);

      // Dormant but alive: the cloud sea glows faintly; marquee and signs idle
      floorMat.emissiveIntensity = 0.24 + 0.16 * s2 + 0.3 * s4 + 0.2 * boost;
      floorMat.emissive.copy(seaCool).lerp(seaWarm, Math.max(0.6 * s2, s4, boost));
      skyU.top.value.copy(skyTop0).lerp(skyTop1, Math.max(0.5 * s2, s4));
      skyU.bottom.value.copy(skyBot0).lerp(skyBot1, Math.max(0.5 * s2, s4));
      puffMat.emissiveIntensity = 0.3 + 0.15 * s2 + 0.25 * s4;
      marquee.setLit(0.2 + 0.8 * Math.max(s1, boost));
      fireflies.setLit(0.15 + 0.7 * s1);
      left.topMat.emissiveIntensity = 0.02 + 0.12 * s1;

      // Level 1: the four spheres are named, so the armillary rings light in their colours
      if (motion) spin += dt * (0.05 + 0.15 * s1 + 0.4 * s4 + boost);
      earth.rotation.y = spin * 0.6;
      for (let i = 0; i < rings.length; i++) {
        ringMats[i].emissiveIntensity = 0.1 + 2.2 * kit.stage(level, 0.3 + i * 0.12, 1.0 + i * 0.12) + boost;
        rings[i].rotation.z = spin * (i % 2 ? -0.5 : 0.5) * (1 + i * 0.2);
      }
      atmoMat.opacity = 0.06 + 0.16 * s1 + 0.2 * s4;
      shellMat.emissiveIntensity = 0.02 + 0.12 * s1;
      oceanMat.emissiveIntensity = 0.12 + 0.35 * s1 + 0.3 * s4;

      // Level 2: two power sources. The Sun blazes (solar); the core and geyser run hot (internal)
      sunMat.color.copy(sunDim).lerp(sunBright, 0.35 + 0.65 * s2);
      coronaMat.opacity = 0.18 + 0.6 * s2 + 0.2 * boost;
      beamMat.opacity = 0.1 * s2 + 0.06 * s4;
      solarSign.setLit(0.2 + 0.8 * s2);
      heatSign.setLit(0.2 + 0.8 * s2);
      coreMat.emissiveIntensity = 0.25 + 1.6 * s2 * (motion ? 0.85 + 0.15 * Math.sin(t * 3) : 1);
      faceMat.emissiveIntensity = 0.05 + 0.22 * s2;
      ventMat.emissiveIntensity = 0.3 + 2.6 * s2;
      vapor.setLit(0.15 + 0.8 * s2);
      rain.setLit(0.08 + 0.6 * s2);
      fallMat.opacity = 0.35 + 0.45 * s2;
      // Geyser: erupts in pulses once the interior heat is awake (always a wisp of steam)
      if (motion) eruptT += dt;
      const cycle = (eruptT % 6) / 6;
      const burst = s2 > 0.05 || boost > 0.05 ? Math.max(0, Math.sin(Math.min(1, cycle / 0.35) * Math.PI)) : 0;
      const target = 0.7 + (2.4 + 1.2 * s4) * burst * Math.max(s2, boost);
      plumeHeight += (target - plumeHeight) * Math.min(1, dt * 4);
      plumeMat.opacity = 0.25 + 0.6 * Math.max(s2 * (0.3 + 0.7 * burst), 0.1);
      for (let i = 0; i < plumeN; i++) {
        const u = motion ? (plumeSeed[i * 3] + t * 0.45) % 1 : plumeSeed[i * 3];
        const spread = 0.05 + u * 0.5;
        plumePos[i * 3] = vx0 + plumeSeed[i * 3 + 1] * spread;
        plumePos[i * 3 + 1] = vy0 + u * plumeHeight;
        plumePos[i * 3 + 2] = vz0 + plumeSeed[i * 3 + 2] * spread;
      }
      plumeGeo.attributes.position.needsUpdate = true;

      // Level 3: convection everywhere. Tank dye loops, balloons rise, the ring of parcels turns
      const glow = Math.max(s3, boost);
      heaterMat.emissiveIntensity = 0.3 + 2.2 * Math.max(s3, 0.25 * s0);
      tankSign.setLit(0.2 + 0.8 * s3);
      loopMat.opacity = 0.15 + 0.85 * glow;
      const g20 = Math.round(glow * 20) / 20;
      if (motion) cellPhase += dt * (0.03 + 0.18 * s3 + 0.1 * boost);
      if (motion || g20 !== lastGlow) {
        placeDye(cellPhase, 0.25 + 0.75 * g20);
        placeLoop(-cellPhase * 2, g20);
        lastGlow = g20;
      }
      for (let i = 0; i < balloons.length; i++) {
        const bl = balloons[i];
        bl.g.position.y = bl.y + 0.6 * s3 + 0.4 * s4 + (motion ? Math.sin(t * 0.5 + bl.ph) * 0.12 : 0);
        burnerMats[i].emissiveIntensity = 0.05 + 0.35 * s3 * (motion ? 0.7 + 0.3 * Math.sin(t * 7 + bl.ph) : 1);
      }
      if (motion) vanePhase += dt * (0.6 + 2.5 * s3 + 3 * energy + 4 * boost);
      vaneHead.rotation.y = vanePhase;
      arrow.rotation.y = motion ? Math.sin(t * 0.3) * 0.5 : 0;

      // Level 4 (Wonderlight): the panorama blazes, aurora, fireworks, the airship lights up
      panorama.repaint(level);
      lampMat.emissiveIntensity = 0.2 + 2.5 * Math.max(s4, s1 * 0.3);
      if (motion) {
        ship.position.x = 6.2 + Math.sin(t * 0.12) * 0.5;
        ship.position.y = 4.9 + Math.sin(t * 0.4) * 0.1;
        prop.rotation.x += dt * (6 + 20 * s4);
      }
      fw.setLit(Math.max(kit.stage(level, 3.6, 4), boost));
      fwL.setLit(Math.max(kit.stage(level, 3.6, 4), boost));
      beaconMats[0].opacity = beaconMats[1].opacity = 0.34 * Math.max(s4, boost);
      if (motion) beamTex.offset.x = t * 0.05;
      dawnMat.opacity = 0.1 * s2 + 0.3 * s4 + 0.25 * boost;
      fwR.setLit(Math.max(kit.stage(level, 3.6, 4), boost));
      garlandL.setLit(0.15 + 0.85 * Math.max(kit.stage(level, 1.3, 2.4), boost));
      garlandR.setLit(0.15 + 0.85 * Math.max(kit.stage(level, 1.3, 2.4), boost));
      cloudMat.emissiveIntensity = 0.12 + 0.2 * s2 + 0.3 * s4;
      sparks.setLit(0.1 + 0.8 * Math.max(s4, boost));
      if (sunSpot) sunSpot.intensity = 20 + 26 * s2 + 10 * boost;
      if (seaSpot) seaSpot.intensity = 18 + 22 * s1 + 10 * boost;
      if (globeLight) globeLight.intensity = 2 + 6 * s1 + 10 * s4 + 8 * boost;
    },
    celebrate(p) {
      celebrateBoost = Math.max(celebrateBoost, Math.sin(Math.min(1, p) * Math.PI));
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const skyworksRoom: RoomBuilder = ({ kit }) => {
  // A tiny sky workshop: the cutaway globe in its four rings, an ocean pool with a rain cloud,
  // a geyser wisp, a tree and a hot-air balloon rising on warm air.
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.5, 10), kit.mats.brass());
  stand.position.set(-0.35, 0.25, -0.3);
  kit.add(stand);
  const globeMat = kit.track(new THREE.MeshStandardMaterial({ map: earthTexture(kit), emissive: OCEAN, emissiveIntensity: 0.05, roughness: 0.5 }));
  const globe = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16, Math.PI * 0.5, Math.PI * 1.5), globeMat);
  const faceTex = layerFaceTexture(kit);
  const faceMat = kit.track(new THREE.MeshStandardMaterial({ map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.05, side: THREE.DoubleSide }));
  const faceA = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24, -Math.PI / 2, Math.PI), faceMat);
  const faceB = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24, -Math.PI / 2, Math.PI), faceMat);
  faceB.rotation.y = -Math.PI / 2;
  globe.add(shell, faceA, faceB);
  globe.position.set(-0.35, 0.75, -0.3);
  globe.rotation.y = 0.6;
  kit.add(globe);
  const ringMats = SPHERES.map((s, i) => {
    const m = kit.track(new THREE.MeshStandardMaterial({ color: '#141022', emissive: s.color, emissiveIntensity: 0.05 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34 + i * 0.04, 0.008, 6, 48), m);
    ring.position.copy(globe.position);
    ring.rotation.set(Math.PI / 2 + (i - 1.5) * 0.4, i * 0.6, 0);
    kit.add(ring);
    return m;
  });
  // ocean pool with a little rain cloud over it
  const poolMat = kit.track(new THREE.MeshStandardMaterial({ color: '#1d5fa6', emissive: OCEAN, emissiveIntensity: 0.05, roughness: 0.1 }));
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0.5, 0.012, 0.35);
  kit.add(pool);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.025, 8, 40), kit.mats.wood());
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0.5, 0.02, 0.35);
  kit.add(rim);
  const cloudMat = kit.track(new THREE.MeshStandardMaterial({ color: '#d6dcf2', roughness: 1, emissive: '#7180c0', emissiveIntensity: 0.05 }));
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (i % 2) * 0.04, 14, 10), cloudMat);
    puff.position.set(0.38 + i * 0.12, 1.02 + (i % 2) * 0.05, 0.3);
    puff.scale.y = 0.75;
    kit.add(puff);
  }
  // a tree (the biosphere) and a geyser wisp from hot rock
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 8), kit.mats.plastic('#5b3a24'));
  trunk.position.set(-0.8, 0.11, 0.4);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 12), kit.mats.plastic('#4fae5a'));
  crown.position.set(-0.8, 0.36, 0.4);
  kit.add(trunk);
  kit.add(crown);
  const ventMat = kit.track(new THREE.MeshStandardMaterial({ color: '#3a1806', emissive: MAGMA, emissiveIntensity: 0.1 }));
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.05, 14), ventMat);
  vent.position.set(-0.2, 0.025, 0.5);
  kit.add(vent);
  const steam = kit.cloudOfPoints([-0.2, 0.42, 0.5], 0.16, 40, '#eaf6ff');
  steam.scale.set(0.6, 2.4, 0.6);
  const balloon = hotAirBalloon(kit, '#ff7a59', '#ffd36b');
  balloon.scale.setScalar(0.3);
  balloon.position.set(0.55, 0.95, -0.35);
  kit.add(balloon);
  const sun = kit.orb([0.85, 1.42, -0.7], 0.1, GOLD);
  return {
    update(t, lit) {
      const motion = !kit.reducedMotion;
      globeMat.emissiveIntensity = 0.05 + 0.25 * lit;
      faceMat.emissiveIntensity = 0.05 + 0.45 * lit;
      ventMat.emissiveIntensity = 0.1 + 1.8 * lit;
      poolMat.emissiveIntensity = 0.05 + 0.6 * lit;
      cloudMat.emissiveIntensity = 0.05 + 0.3 * lit;
      for (let i = 0; i < ringMats.length; i++) ringMats[i].emissiveIntensity = 0.05 + 2 * lit;
      sun.setLit(lit);
      steam.setLit(lit * 0.9);
      globe.rotation.y = 0.6 + (motion ? t * 0.3 : 0);
      balloon.position.y = 0.95 + (motion ? Math.sin(t * 0.8) * 0.05 : 0) + 0.2 * lit;
    },
  };
};

// ---------------------------------------------------------------- the table

export const L10: TableDef = {
  lessonId: 'L10',
  signature: 'A Convection Loop that cycles the Wonderball around the globe, past a Wind Vane at its cool top',
  ballRole: 'The Wonderball is a game token. On the Convection Loop it stands in for a parcel of water, air or mantle rock, but a real convection cell moves a whole body of material together, not one bouncing ball.',
  theme: {
    bg: [SAPPHIRE, '#111c3a'],
    rail: '#d7e6f5',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: '#FF8A5B',
    accent2: MINT,
    bumperCap: '#f2f6ff',
    bumperRing: '#2b4a7a',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(140,210,255,0.18)',
    trail: ICE,
  },
  lines: {
    intro: "Welcome aboard the Four-Sphere Skyworks, a workshop floating above the clouds! Rock, water, air and life get almost all their energy from two main power sources, so let's find out which runs what.",
    quark: '"Heat rises, right? So the heat itself must be what climbs up the loop," Professor Quark wonders, watching the Wind Vane spin.',
    pipTip: 'A half-strength plunge drops into the S-U-N lanes. Then flip up either leg of the Convection Loop: the ball rides over the top and comes down the other leg.',
  },
  build,
  skillShot: 'sun_2',
  shots: [
    { id: 'loop', label: 'Convection Loop', on: [{ type: 'shot', group: 'loop' }], insert: 'ins_loop_r' },
    { id: 'loopLeft', label: 'Convection Loop (left leg)', on: [{ type: 'shot', id: 'loop_cw' }], insert: 'ins_loop_l' },
    { id: 'pocket', label: 'Globe Lab', on: [{ type: 'saucer', id: 'globe_lab' }], insert: 'ins_pocket' },
    { id: 'geyser', label: 'Geyser', on: [{ type: 'saucer', id: 'geyser' }], insert: 'ins_geyser' },
    { id: 'ramp', label: 'Evaporation Ramp', on: [{ type: 'ramp', id: 'evap_ramp' }], insert: 'ins_ramp' },
    { id: 'stations', label: 'Sphere stations', on: [{ type: 'target', group: 'spheres' }], insert: 'ins_stations' },
    { id: 'hydro', label: 'HYDRO station', on: [{ type: 'target', id: 'hydro_station' }], insert: 'ins_hydro' },
    { id: 'atmo', label: 'ATMO station', on: [{ type: 'target', id: 'atmo_station' }], insert: 'ins_atmo' },
    { id: 'sun', label: 'S-U-N lanes', on: [{ type: 'rollover', group: 'sun' }], insert: 'ins_sun' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Sphere Survey',
      brief: 'Scientists model Earth as four overlapping systems. Tag every sphere station, then bring your readings to the Globe Lab.',
      objectiveIds: ['L10-O1'],
      stages: [
        { kind: 'collect', text: 'Tag all 4 spheres: GEO, HYDRO, ATMO, BIO', match: { type: 'target', group: 'spheres' }, count: 4, distinct: true, lamps: ['geo_station', 'hydro_station', 'atmo_station', 'bio_station'], preview: ['stations'] },
        { kind: 'shots', text: 'Vapor is water in air: hit HYDRO, then ATMO', shots: ['hydro', 'atmo'], order: 'sequence' },
        { kind: 'discover', text: 'Bring the readings to the Globe Lab', pocket: 'globe_lab', questions: 1, types: ['classify', 'single'] },
      ],
      discovery: 'Earth can be modeled as four overlapping systems: rock and metal (geosphere), water (hydrosphere), air (atmosphere) and living things (biosphere). Water vapor belongs to the hydrosphere and the atmosphere.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Two Power Sources',
      brief: "Two main power sources run Earth's systems. Ride the Evaporation Ramp up into the S-U-N lanes for solar energy, then erupt the Geyser with inner heat.",
      objectiveIds: ['L10-O3'],
      stages: [
        { kind: 'collect', text: 'Solar energy: light the S-U-N lanes 3 times', match: { type: 'rollover', group: 'sun' }, count: 3, lamps: ['sun_1', 'sun_2', 'sun_3'], preview: ['ramp', 'sun'] },
        { kind: 'shots', text: 'Inner heat: erupt the Geyser', shots: ['geyser'] },
        { kind: 'discover', text: 'Compare the power sources at the Globe Lab', pocket: 'globe_lab', questions: 1, types: ['classify', 'match'] },
      ],
      discovery: "The sun powers most motion in water, air and life, like evaporation lifting water into the air. Heat from Earth's hot interior drives mantle convection, volcanoes and geysers.",
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Keep the Cell Turning',
      brief: 'Model a convection cell: send the ball up one leg of the loop, across the cool top and down the other. Four full turns, then predict.',
      objectiveIds: ['L10-O2', 'L10-O4'],
      stages: [
        { kind: 'collect', text: 'Turn the Convection Loop 4 times', match: { type: 'shot', group: 'loop' }, count: 4, preview: ['loop', 'loopLeft'] },
        { kind: 'discover', text: 'Predict the flow at the Globe Lab', pocket: 'globe_lab', questions: 1, types: ['order', 'single'] },
      ],
      discovery: 'It is not heat that rises. Warmed material usually spreads out and becomes less dense; gravity pulls cooler, denser material down around it, pushing it up. Heated below and cooled above, the loop keeps turning.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Power the Panorama',
    brief: 'Run the whole Skyworks: turn the Convection Loop, lift water on the Ramp and fire the Geyser, then light the panorama from the Globe Lab.',
    stages: [
      { kind: 'shots', text: 'Power up: Loop, Ramp and Geyser', shots: ['loop', 'ramp', 'geyser'], order: 'any' },
      { kind: 'discover', text: 'Light the panorama from the Globe Lab', pocket: 'globe_lab', questions: 2 },
    ],
    celebration: "Sunlight and Earth's inner heat set rock, water, air and life in motion, and the Skyworks panorama blazes to life. Wonderlight earned!",
  },
  set: skyworksSet,
  room: skyworksRoom,
  icons: {
    globe(ctx, s) {
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.85, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.38, s * 0.85, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, 0);
      ctx.lineTo(s * 0.85, 0);
      ctx.stroke();
    },
    geyser(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, s * 0.9);
      ctx.lineTo(-s * 0.3, s * 0.35);
      ctx.lineTo(s * 0.3, s * 0.35);
      ctx.lineTo(s * 0.9, s * 0.9);
      ctx.closePath();
      ctx.fill();
      for (const [x, y, r] of [[0, -0.1, 0.28], [-0.2, -0.5, 0.24], [0.18, -0.72, 0.2]]) {
        ctx.beginPath();
        ctx.arc(x * s, y * s, r * s, 0, TAU);
        ctx.fill();
      }
    },
  },
  scenery: {
    backdrop: paintBackdrop,
    ambient({ ctx, t, level, reduced, energy }) {
      if (reduced) return;
      const s2 = stage(level, 1.2, 2);
      const s3 = stage(level, 2.2, 3);
      // steam drifting up the geyser lane and vapor rising along the ramp
      drift(ctx, 7, 10, t, '#eaf6ff', [96, 300, 150, 640], 26, 2.2, 0.18 + 0.3 * s2);
      drift(ctx, 9, 12, t, ICE, [440, 260, 520, 660], 22, 1.8, 0.12 + 0.3 * s2);
      // parcels circling the loop once the cell is awake
      if (s3 > 0.01) {
        const { cx, cy, ri, ro } = LOOP;
        const rm = (ri + ro) / 2;
        for (let i = 0; i < 8; i++) {
          const a = Math.PI + ((t * 0.35 + i / 8) % 1) * Math.PI;
          glowDot(ctx, cx + Math.cos(a) * rm, cy + Math.sin(a) * rm, 9, i % 2 ? ICE : MAGMA, 0.35 * s3 * (0.6 + 0.4 * energy));
        }
      }
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(GLOBE.x, GLOBE.y, 10, GLOBE.x, GLOBE.y, 460);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU + t * 0.4;
        const d = 70 + p * 280;
        glowDot(ctx, GLOBE.x + Math.cos(a) * d, GLOBE.y + Math.sin(a) * d * 0.85, 11, SPHERES[i % 4].color, 1 - p);
      }
    },
  },
};
export default L10;
