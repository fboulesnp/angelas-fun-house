// Lesson 2 — Molecules and Extended Structures — "Molecule Masquerade"
// A crystal ballroom where every dancer is an atom in a mask. The H₂O pop-bumper trio is
// printed as a ball-and-stick model, the Atom Bank holds H/O/C/N tokens, an upper flipper on
// the right launches the Lattice Ramp in a grand arch over the dance floor, and the Model
// Mirror is the Wonder Pocket. The finale assembles a salt-crystal canopy: an extended
// structure (a repeating Na/Cl lattice, never "NaCl molecules").

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { TAU, drift, glowDot, mix, neonPath, neonText, rgba, rng, rrect, stage, vgrad } from '../game/render/art.ts';

// ---------------------------------------------------------------- palette

const GOLD = '#FFC75B';
const ROSE = '#FF7F86';
const AQUA = '#7FE3F0';
const ICE = '#BFE9FF';
const IVORY = '#FFF7E7';
const SAPPHIRE = '#273A86';
// Ball-and-stick colours used by chemistry model kits (as in the lesson's models).
const H_COL = '#F2F5FF';
const H_3D = '#d3d9ec';
const O_COL = '#FF5A5F';
const C_COL = '#454B5C';
const N_COL = '#5B86FF';
const NA_COL = '#B98CFF';
const CL_COL = '#7FE39A';
const SI_COL = '#E3B57E';

/** The H₂O bumper trio (oxygen, hydrogen, hydrogen): bumpers and the printed bonds share these. */
const ATOM_O: [number, number] = [300, 292];
const ATOM_H1: [number, number] = [226, 346];
const ATOM_H2: [number, number] = [374, 346];

/** Lattice Ramp centreline (shared by the geometry and the printed lattice ribbon beneath it). */
const RAMP_PATH: [number, number][] = [
  [474, 506], [472, 420], [462, 340], [440, 262], [396, 204], [330, 172], [260, 170], [190, 192],
  [132, 238], [90, 306], [66, 396], [46, 450], [76, 500], [42, 550], [76, 600], [42, 650], [76, 700], [46, 750], [83, 808],
];

// ---------------------------------------------------------------- playfield geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Polymer Loop: the left orbit channel. Its inner wall is short, so angled shots from
  // the right inlane slip in beneath it; full plunges come back down through the spinner.
  b.wall([[80, 530], [80, 384]], { id: 'loop_inner', r: 3 });
  b.post(80, 380, 5);
  b.post(80, 534, 5);
  b.spinner('polymer_spinner', [28, 500], [76, 500], { label: 'POLYMER' });
  b.shotSwitch('loop_sw', 52, 430, -90);
  // A one-way gate, not a wall: loop and orbit returns are still deflected into play, but the
  // left kickback below can fire up through it instead of bouncing off it into the outlane.
  b.gate('loop_deflect', [FRAME.left, 656], [56, 704], -90);

  // --- Return lane: loops and soft plunges drop down the right side onto the upper flipper.
  b.wall([[500, 590], [500, 380]], { id: 'return_inner', r: 3 });
  b.post(500, 376, 5);
  b.post(500, 592, 5);
  b.rollover('mask_lane', 524, 440, { label: 'MASK' });
  // Solid feed block guides the ball onto the flipper base and leaves no pocket beneath it.
  b.wall([[548, 606], [516, 642], [523, 657], [548, 720]], { id: 'upper_feed', r: 3, closed: true });
  b.flipper('flipper_upper', 512, 650, 'right', { length: 80, restDeg: 152, upDeg: 210 });

  // --- Lattice Ramp: climbs the right side, arches over the ballroom, drops to the left inlane.
  b.wall([[420, 566], [452, 506]], { id: 'ramp_flare', r: 3 });
  b.ramp('lattice_ramp', { path: RAMP_PATH, width: 44, footprintTo: 3, peak: 80, label: 'LATTICE RAMP' });

  // --- The H₂O trio: one oxygen bumper bonded to two smaller hydrogen bumpers.
  b.bumper('bumper_o', ...ATOM_O, { r: 26, group: 'water', label: 'O', icon: 'atomO' });
  b.bumper('bumper_h1', ...ATOM_H1, { r: 21, group: 'water', label: 'H', icon: 'atomH' });
  b.bumper('bumper_h2', ...ATOM_H2, { r: 21, group: 'water', label: 'H', icon: 'atomH' });

  // --- Atom Bank: four atom tokens with a roofed backstop block behind them.
  b.dropBank('atom_bank', 146, 494, -20, 4, { size: 26, gap: 5, group: 'atoms', labels: ['H', 'O', 'C', 'N'] });
  b.wall([[142, 483], [254, 442], [190, 405]], { id: 'bank_block', r: 3, closed: true });

  // --- Model Mirror: the Wonder Pocket in a protective frame.
  b.wall([[296, 548], [296, 512], [326, 494], [356, 512], [356, 548]], { id: 'mirror_cup', r: 4 });
  b.saucer('mirror', 326, 530, { role: 'pocket', ejectDeg: 68, ejectSpeed: 700, label: 'MODEL MIRROR', icon: 'mirror' });

  // --- Inserts that preview shots
  b.insert('ins_ramp', 440, 586, { deg: -85, label: 'LATTICE', color: ICE });
  b.insert('ins_loop', 62, 596, { deg: -100, label: 'LOOP', color: ROSE });
  b.insert('ins_bank', 214, 530, { deg: -110, label: 'ATOMS' });
  b.insert('ins_pocket', 326, 604, { deg: -90 });
  b.insert('ins_bumpers', 300, 366, { shape: 'star', size: 11 });
}

// ---------------------------------------------------------------- printed playfield art

/** Shaded sphere (ball-and-stick atom) for printed art. */
function sphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, mix(color, '#ffffff', 0.6));
  g.addColorStop(0.55, color);
  g.addColorStop(1, mix(color, '#000000', 0.5));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function stick(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(8,10,30,0.7)';
  ctx.lineWidth = w + 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1, w * 0.3);
  ctx.stroke();
  ctx.restore();
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// Original masquerade mask: swept cat-eye wings, a notch over the nose, almond eye holes,
// a curling plume on the left wing and a slim handle on the right (unit half-width).
const MASK_OUTLINE: [number, number][] = [
  [-1.18, 0.6], [-0.86, 0.44], [-0.5, 0.36], [-0.2, 0.3], [0, 0.16], [0.2, 0.3], [0.5, 0.36], [0.86, 0.44],
  [1.18, 0.6], [1.02, 0.12], [0.78, -0.2], [0.45, -0.3], [0.18, -0.2], [0, -0.04], [-0.18, -0.2], [-0.45, -0.3],
  [-0.78, -0.2], [-1.02, 0.12],
];
const MASK_PLUME: [number, number][] = [[-0.92, 0.5], [-1.08, 0.86], [-0.96, 1.2], [-0.7, 1.42], [-0.42, 1.48]];
const MASK_HANDLE: [number, number][] = [[0.86, -0.18], [0.98, -0.6], [1.08, -1.1]];

/** Almond eye-hole outline (closed polyline) centred at ex, tilted up toward the outer corner. */
function maskEye(ex: number, n = 12): [number, number][] {
  const out: [number, number][] = [];
  const tilt = ex < 0 ? -0.22 : 0.22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const x = Math.cos(a) * 0.27;
    const y = Math.sin(a) * 0.1 * (1 - 0.35 * Math.abs(Math.cos(a)));
    out.push([ex + x * Math.cos(tilt) - y * Math.sin(tilt), 0.06 + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return out;
}

/** Original masquerade-mask shape (filled outline with eye holes), centred at cx,cy, half-width s. */
function maskPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const P = MASK_OUTLINE;
  const n = P.length;
  const mid = (i: number): [number, number] => [(P[i % n][0] + P[(i + 1) % n][0]) / 2, (P[i % n][1] + P[(i + 1) % n][1]) / 2];
  ctx.beginPath();
  const m0 = mid(n - 1);
  ctx.moveTo(cx + m0[0] * s, cy - m0[1] * s);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(cx + P[i][0] * s, cy - P[i][1] * s, cx + m[0] * s, cy - m[1] * s);
  }
  ctx.closePath();
  for (const ex of [-0.45, 0.45]) {
    const e = maskEye(ex);
    e.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy - y * s) : ctx.moveTo(cx + x * s, cy - y * s)));
    ctx.closePath();
  }
}

/** The plume and handle strokes that finish a printed mask. */
function maskTrim(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  for (const line of [MASK_PLUME, MASK_HANDLE]) {
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy - y * s) : ctx.moveTo(cx + x * s, cy - y * s)));
    ctx.stroke();
  }
}

/** Gold portrait frame (ballroom gallery) with a dark velvet mat. */
function portrait(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, lit: number) {
  ctx.save();
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, 6);
  ctx.fillStyle = rgba('#0c0f2e', 0.72);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(GOLD, 0.35 + 0.55 * lit);
  if (lit > 0.05) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 10 * lit;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  rrect(ctx, cx - w / 2 + 5, cy - h / 2 + 5, w - 10, h - 10, 4);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.4 * lit);
  ctx.stroke();
  ctx.restore();
}

/**
 * Name plate for a printed portrait: dark velvet with gold lettering, so the words stay readable
 * when the lit playfield print blooms at Wonderlight (a bright gold plate washes dark ink out).
 */
function nameplate(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, lit: number, size = 9) {
  ctx.save();
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 12;
  rrect(ctx, x - w / 2, y - size, w, size * 2, size * 0.6);
  ctx.fillStyle = 'rgba(12,10,36,0.9)';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = rgba(GOLD, 0.45 + 0.4 * lit);
  ctx.stroke();
  ctx.fillStyle = mix(GOLD, IVORY, 0.35 + 0.3 * lit);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

/** Catmull-Rom smoothing of a polyline (for printing along the ramp). */
function smooth(points: [number, number][], perSpan = 6): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < perSpan; s++) {
      const t = s / perSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const RAMP_SMOOTH = smooth(RAMP_PATH, 8);

function paintBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);

  // Ballroom lacquer
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1e2766'], [0.45, '#171e55'], [1, '#0a0d2a']]);
  ctx.fillRect(0, 0, 600, 1150);

  // Harlequin parquet: a repeating lattice of diamonds (the masquerade floor).
  const DW = 46;
  const DH = 66;
  for (let j = -1; j <= Math.ceil(1150 / (DH / 2)) + 1; j++) {
    const odd = ((j % 2) + 2) % 2;
    for (let i = -1; i <= Math.ceil(600 / DW) + 1; i++) {
      const cx = i * DW + (odd ? DW / 2 : 0);
      const cy = (j * DH) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - DH / 2);
      ctx.lineTo(cx + DW / 2, cy);
      ctx.lineTo(cx, cy + DH / 2);
      ctx.lineTo(cx - DW / 2, cy);
      ctx.closePath();
      ctx.fillStyle = odd ? 'rgba(46,34,104,0.42)' : 'rgba(30,44,118,0.34)';
      ctx.fill();
      // From level 3 the floor lattice lights in a repeating unit (one motif, over and over).
      if (s3 > 0.01 && (((i + 2 * j) % 3) + 3) % 3 === 0) {
        ctx.fillStyle = rgba(AQUA, 0.09 * s3);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(GOLD, 0.05 + 0.08 * s3);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Soft vignette toward the drain keeps the lower field calm and readable.
  ctx.fillStyle = vgrad(ctx, 760, 1150, [[0, 'rgba(8,8,26,0)'], [1, 'rgba(8,8,26,0.55)']]);
  ctx.fillRect(0, 760, 600, 390);

  // Moonlit glow under the arch and the marquee title.
  const halo = ctx.createRadialGradient(300, 90, 10, 300, 90, 260);
  halo.addColorStop(0, rgba(ICE, 0.1 + 0.12 * s2));
  halo.addColorStop(1, rgba(ICE, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 600, 400);

  // Lattice ribbon printed under the Lattice Ramp: alternating sodium and chlorine dots,
  // a picture of a salt crystal's repeating pattern.
  {
    const lit = 0.25 + 0.75 * s3;
    let acc = 0;
    let k = 0;
    for (let i = 1; i < RAMP_SMOOTH.length; i++) {
      const [x0, y0] = RAMP_SMOOTH[i - 1];
      const [x1, y1] = RAMP_SMOOTH[i];
      const seg = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / seg;
      const ny = (x1 - x0) / seg;
      acc += seg;
      while (acc >= 15) {
        acc -= 15;
        const u = 1 - acc / seg;
        const x = x0 + (x1 - x0) * u;
        const y = y0 + (y1 - y0) * u;
        for (const side of [-1, 1]) {
          const c = (k + (side > 0 ? 1 : 0)) % 2 ? NA_COL : CL_COL;
          ctx.fillStyle = rgba(c, 0.18 + 0.5 * lit);
          ctx.beginPath();
          ctx.arc(x + nx * side * 8, y + ny * side * 8, 3.4, 0, TAU);
          ctx.fill();
        }
        k++;
      }
    }
  }

  // Dance-floor medallion under the H₂O trio, inlaid with an ice-like hexagon lattice.
  {
    const cx = 300;
    const cy = 324;
    const R = 106;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    const g = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, R);
    g.addColorStop(0, rgba('#3550b0', 0.5 + 0.2 * s1));
    g.addColorStop(1, rgba('#141a50', 0.6));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = rgba(ICE, 0.1 + 0.25 * s3);
    ctx.lineWidth = 1.2;
    const hr = 15;
    for (let row = -8; row <= 8; row++) {
      for (let col = -6; col <= 6; col++) {
        const hx = cx + col * hr * Math.sqrt(3) + (row % 2 ? (hr * Math.sqrt(3)) / 2 : 0);
        const hy = cy + row * hr * 1.5;
        hexPath(ctx, hx, hy, hr);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(GOLD, 0.45 + 0.45 * s1);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 7, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      ctx.fillStyle = rgba(i % 2 ? GOLD : ICE, 0.4 + 0.5 * s1);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6), 2.4, 0, TAU);
      ctx.fill();
    }
  }

  // The printed ball-and-stick model: a chemical bond holds each hydrogen to the oxygen.
  for (const [hx, hy] of [ATOM_H1, ATOM_H2]) {
    if (s1 > 0.01) {
      ctx.save();
      ctx.shadowColor = ICE;
      ctx.shadowBlur = 16 * s1;
      stick(ctx, ATOM_O[0], ATOM_O[1], hx, hy, 13, rgba(ICE, 0.5 * s1));
      ctx.restore();
    }
    stick(ctx, ATOM_O[0], ATOM_O[1], hx, hy, 11, '#c9d3ea', 0.85);
  }
  neonText(ctx, 'H₂O', 300, 404, 22, ICE, 0.25 + 0.75 * s1);

  // Model key card: the colour code used by ball-and-stick models.
  {
    const x = 92;
    const y = 572;
    rrect(ctx, x, y, 124, 50, 8);
    ctx.fillStyle = 'rgba(10,12,40,0.78)';
    ctx.fill();
    ctx.strokeStyle = rgba(GOLD, 0.5 + 0.4 * s1);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '700 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = rgba(IVORY, 0.85);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MODEL KEY', x + 62, y + 10);
    const keys: [string, string, string][] = [['H', H_COL, '#1a1030'], ['O', O_COL, '#ffffff'], ['C', C_COL, '#ffffff'], ['N', N_COL, '#ffffff']];
    keys.forEach(([el, c, ink], i) => {
      const kx = x + 20 + i * 28;
      sphere(ctx, kx, y + 32, 10, c);
      ctx.font = '800 11px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.fillStyle = ink;
      ctx.fillText(el, kx, y + 33);
    });
  }

  // Polymer chain along the Polymer Loop: the same subunit repeated link after link.
  {
    const lit = 0.3 + 0.7 * s3;
    for (let y = 640; y >= 392; y -= 31) {
      ctx.strokeStyle = rgba(ROSE, 0.25 + 0.5 * lit);
      ctx.lineWidth = 2;
      hexPath(ctx, 52, y, 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(52, y - 9);
      ctx.lineTo(52, y - 22);
      ctx.stroke();
      ctx.fillStyle = rgba(O_COL, 0.3 + 0.5 * lit);
      ctx.beginPath();
      ctx.arc(60, y - 16, 3, 0, TAU);
      ctx.fill();
    }
  }

  // The Model Mirror: an ornate oval frame around the Wonder Pocket.
  {
    const cx = 326;
    const cy = 524;
    const sheen = ctx.createRadialGradient(cx - 14, cy - 22, 4, cx, cy, 70);
    sheen.addColorStop(0, rgba('#dfefff', 0.22 + 0.1 * s2));
    sheen.addColorStop(1, rgba('#5b6db8', 0.06));
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 58, 70, 0, 0, TAU);
    ctx.fill();
    neonPath(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 58, 70, 0, 0, TAU);
    }, GOLD, 0.35 + 0.65 * s2, 3);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      glowDot(ctx, cx + Math.cos(a) * 64, cy + Math.sin(a) * 76, 4, GOLD, 0.35 + 0.4 * s2);
    }
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(ROSE, 0.5 + 0.5 * s1);
    maskPath(ctx, cx, cy - 86, 20);
    ctx.stroke();
    ctx.restore();
  }

  // Molecule portraits (light at level 2): a molecule can be one element (O₂) or several (NH₃).
  {
    portrait(ctx, 140, 372, 58, 50, s2);
    stick(ctx, 127, 366, 153, 366, 3, '#c9d3ea', 0.6 + 0.4 * s2);
    sphere(ctx, 127, 366, 8.5, O_COL, 0.5 + 0.5 * s2);
    sphere(ctx, 153, 366, 8.5, O_COL, 0.5 + 0.5 * s2);
    nameplate(ctx, 'O₂', 140, 388, s2);
    portrait(ctx, 410, 408, 58, 50, s2);
    for (const [hx, hy] of [[394, 410], [426, 410], [410, 418]] as [number, number][]) {
      stick(ctx, 410, 398, hx, hy, 3, '#c9d3ea', 0.6 + 0.4 * s2);
      sphere(ctx, hx, hy, 5, H_COL, 0.6 + 0.4 * s2);
    }
    sphere(ctx, 410, 398, 8, N_COL, 0.6 + 0.4 * s2);
    nameplate(ctx, 'NH₃', 410, 426, s2);
  }

  // Gallery of extended structures (light at level 3).
  {
    const y = 704;
    neonText(ctx, 'EXTENDED STRUCTURES', 270, 652, 13, ICE, 0.15 + 0.85 * s3, '"Atkinson Hyperlegible Next", system-ui, sans-serif');
    // Salt: sodium and chlorine alternate 1 : 1 in a grid that could keep going.
    portrait(ctx, 158, y, 84, 72, s3);
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        const px = 158 - 28 + gx * 14;
        const py = y - 21 + gy * 14;
        if (gx < 4) stick(ctx, px, py, px + 14, py, 2, '#8d96b8', 0.5 + 0.4 * s3);
        if (gy < 3) stick(ctx, px, py, px, py + 14, 2, '#8d96b8', 0.5 + 0.4 * s3);
      }
    }
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 5; gx++) sphere(ctx, 158 - 28 + gx * 14, y - 21 + gy * 14, (gx + gy) % 2 ? 4.2 : 5.4, (gx + gy) % 2 ? NA_COL : CL_COL, 0.55 + 0.45 * s3);
    }
    nameplate(ctx, 'SALT 1 Na : 1 Cl', 158, y + 48, s3);
    // Ice: water molecules arranged in six-sided rings.
    portrait(ctx, 270, y, 84, 72, s3);
    ctx.strokeStyle = rgba(ICE, 0.35 + 0.55 * s3);
    ctx.lineWidth = 1.5;
    const rings: [number, number][] = [[270, y - 10], [256, y + 14], [284, y + 14]];
    for (const [hx, hy] of rings) {
      hexPath(ctx, hx, hy, 13);
      ctx.stroke();
    }
    for (const [hx, hy] of rings) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        sphere(ctx, hx + Math.cos(a) * 13, hy + Math.sin(a) * 13, 3.3, O_COL, 0.5 + 0.5 * s3);
      }
    }
    nameplate(ctx, 'ICE H₂O rings', 270, y + 48, s3);
    // Quartz: each silicon owns the oxygen to its right and the one below it, and the bonds run
    // off the edge where the crystal keeps going, so the slice shows exactly 9 Si : 18 O (1 : 2).
    portrait(ctx, 382, y, 84, 72, s3);
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const px = 356 + gx * 20;
        const py = y - 22 + gy * 18;
        stick(ctx, px, py, px + (gx < 2 ? 20 : 15), py, 2, '#8d96b8', 0.5 + 0.4 * s3);
        stick(ctx, px, py, px, py + (gy < 2 ? 18 : 14), 2, '#8d96b8', 0.5 + 0.4 * s3);
      }
    }
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const px = 356 + gx * 20;
        const py = y - 22 + gy * 18;
        sphere(ctx, px + 10, py, 3.4, O_COL, 0.55 + 0.45 * s3);
        sphere(ctx, px, py + 9, 3.4, O_COL, 0.55 + 0.45 * s3);
        sphere(ctx, px, py, 5, SI_COL, 0.55 + 0.45 * s3);
      }
    }
    nameplate(ctx, 'QUARTZ 1 Si : 2 O', 382, y + 48, s3);
  }

  // Masquerade masks in the upper corners.
  for (const [mx, my, c] of [[92, 202, ROSE], [512, 236, AQUA]] as [number, number, string][]) {
    ctx.save();
    maskPath(ctx, mx, my, 24);
    ctx.fillStyle = rgba(c, 0.12 + 0.2 * s1);
    ctx.fill('evenodd');
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(c, 0.45 + 0.5 * s1);
    if (s1 > 0.05) {
      ctx.shadowColor = c;
      ctx.shadowBlur = 12 * s1;
    }
    ctx.stroke();
    ctx.lineWidth = 1.6;
    maskTrim(ctx, mx, my, 24);
    ctx.restore();
  }

  // Wonderlight: a crystal canopy of light over the whole ballroom.
  if (s4 > 0.01) {
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    const r = rng(23);
    for (let i = 0; i < 60; i++) glowDot(ctx, 40 + r() * 500, 40 + r() * 720, 4 + r() * 5, [ICE, GOLD, AQUA][i % 3], 0.5 * s4);
  }
}

// ---------------------------------------------------------------- 3D attraction set

interface AtomSpec {
  p: [number, number, number];
  r: number;
  c: string;
}

type Lit = { setLit(v: number): void };

/** Ball-and-stick model built from one instanced mesh per element colour plus one for bonds. */
function ballStick(kit: SetKit, atoms: AtomSpec[], bonds: [number, number][], opts: { stick?: number; glow?: number } = {}): { group: THREE.Group } & Lit {
  const T = kit.THREE;
  const g = new T.Group();
  const mats: { m: THREE.MeshPhysicalMaterial; k: number }[] = [];
  const colors = [...new Set(atoms.map((a) => a.c))];
  const sphereGeo = new T.SphereGeometry(1, 28, 18);
  const dummy = new T.Object3D();
  for (const c of colors) {
    const list = atoms.filter((a) => a.c === c);
    const mat = kit.track(new T.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.04, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }));
    // White atoms bloom very easily; keep their glow gentler.
    mats.push({ m: mat, k: c === H_3D ? 0.3 : 1 });
    const im = new T.InstancedMesh(sphereGeo, mat, list.length);
    list.forEach((a, i) => {
      dummy.position.set(...a.p);
      dummy.scale.setScalar(a.r);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.castShadow = true;
    g.add(im);
  }
  if (bonds.length) {
    const stickMat = kit.track(new T.MeshPhysicalMaterial({ color: '#d9def0', metalness: 0.6, roughness: 0.25, emissive: ICE, emissiveIntensity: 0.02 }));
    mats.push({ m: stickMat, k: 0.25 });
    const im = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 10), stickMat, bonds.length);
    const up = new T.Vector3(0, 1, 0);
    const a = new T.Vector3();
    const b = new T.Vector3();
    const dir = new T.Vector3();
    bonds.forEach(([i, j], n) => {
      a.set(...atoms[i].p);
      b.set(...atoms[j].p);
      dir.copy(b).sub(a);
      const len = dir.length();
      dummy.position.copy(a).add(b).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, dir.normalize());
      dummy.scale.set(opts.stick ?? 0.07, len, opts.stick ?? 0.07);
      dummy.updateMatrix();
      im.setMatrixAt(n, dummy.matrix);
    });
    g.add(im);
  }
  kit.add(g);
  const glow = opts.glow ?? 0.8;
  return {
    group: g,
    setLit(v) {
      for (let i = 0; i < mats.length; i++) mats[i].m.emissiveIntensity = 0.04 + v * glow * mats[i].k;
    },
  };
}

/**
 * Salt crystal: a cubic grid in which sodium and chlorine alternate 1 : 1 (an extended
 * structure, never "NaCl molecules"). It assembles unit by unit as `grow` rises 0..1.
 */
function saltCrystal(kit: SetKit, pos: [number, number, number], dims: [number, number, number], step: number, order: 'radial' | 'rising' = 'radial') {
  const T = kit.THREE;
  const g = new T.Group();
  const [nx, ny, nz] = dims;
  type Node = { p: THREE.Vector3; na: boolean; rank: number; idx: number };
  const nodes: Node[] = [];
  const cx = (nx - 1) / 2;
  const cy = (ny - 1) / 2;
  const cz = (nz - 1) / 2;
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      for (let z = 0; z < nz; z++) {
        const spread = Math.hypot(x - cx, (y - cy) * 1.6, (z - cz) * 1.6);
        nodes.push({ p: new T.Vector3((x - cx) * step, (y - cy) * step, (z - cz) * step), na: (x + y + z) % 2 === 0, rank: order === 'rising' ? y * 10 + Math.hypot(x - cx, z - cz) : spread, idx: 0 });
      }
    }
  }
  // Assembly order (outward from the centre, or rising layer by layer): rank -> 0..1.
  const sorted = [...nodes].sort((a, b) => a.rank - b.rank);
  sorted.forEach((n, i) => (n.rank = i / (sorted.length - 1)));
  const naMat = kit.track(new T.MeshPhysicalMaterial({ color: NA_COL, emissive: NA_COL, emissiveIntensity: 0.05, roughness: 0.15, clearcoat: 1 }));
  const clMat = kit.track(new T.MeshPhysicalMaterial({ color: CL_COL, emissive: CL_COL, emissiveIntensity: 0.05, roughness: 0.15, clearcoat: 1 }));
  const geo = new T.SphereGeometry(1, 20, 14);
  const naNodes = nodes.filter((n) => n.na);
  const clNodes = nodes.filter((n) => !n.na);
  naNodes.forEach((n, i) => (n.idx = i));
  clNodes.forEach((n, i) => (n.idx = i));
  const naMesh = new T.InstancedMesh(geo, naMat, naNodes.length);
  const clMesh = new T.InstancedMesh(geo, clMat, clNodes.length);
  const bonds: [Node, Node][] = [];
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b || a.p.x > b.p.x || a.p.y > b.p.y || a.p.z > b.p.z) continue;
      if (Math.abs(a.p.distanceTo(b.p) - step) < 1e-3) bonds.push([a, b]);
    }
  }
  const stickMat = kit.track(new T.MeshPhysicalMaterial({ color: '#cfd6ee', metalness: 0.7, roughness: 0.2, emissive: ICE, emissiveIntensity: 0.05 }));
  const stickMesh = new T.InstancedMesh(new T.CylinderGeometry(0.035, 0.035, 1, 8), stickMat, bonds.length);
  g.add(naMesh, clMesh, stickMesh);
  g.position.set(...pos);
  kit.add(g);
  const dummy = new T.Object3D();
  const up = new T.Vector3(0, 1, 0);
  const dir = new T.Vector3();
  const pop = (rank: number, growth: number) => Math.max(0, Math.min(1, (growth - rank) * 12 + 1));
  let lastGrowth = -1;
  const grow = (growth: number) => {
    const q = Math.round(growth * 120) / 120;
    if (q === lastGrowth) return;
    lastGrowth = q;
    for (const n of nodes) {
      const s = pop(n.rank, q);
      dummy.position.copy(n.p);
      dummy.quaternion.identity();
      dummy.scale.setScalar(Math.max(1e-4, s * (n.na ? 0.1 : 0.14)));
      dummy.updateMatrix();
      (n.na ? naMesh : clMesh).setMatrixAt(n.idx, dummy.matrix);
    }
    bonds.forEach(([a, b], i) => {
      const s = Math.min(pop(a.rank, q), pop(b.rank, q));
      dir.copy(b.p).sub(a.p).normalize();
      dummy.position.copy(a.p).add(b.p).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, dir);
      dummy.scale.set(Math.max(1e-4, s), step * Math.max(1e-4, s), Math.max(1e-4, s));
      dummy.updateMatrix();
      stickMesh.setMatrixAt(i, dummy.matrix);
    });
    naMesh.instanceMatrix.needsUpdate = true;
    clMesh.instanceMatrix.needsUpdate = true;
    stickMesh.instanceMatrix.needsUpdate = true;
  };
  return {
    group: g,
    grow,
    setLit(v: number) {
      // Gentle enough that sodium and chlorine keep their colours (the pattern stays readable).
      naMat.emissiveIntensity = 0.05 + v * 0.55;
      clMat.emissiveIntensity = 0.05 + v * 0.55;
      stickMat.emissiveIntensity = 0.05 + v * 0.35;
    },
  };
}

/** Neon masquerade mask (outline, almond eyes, plume and handle) facing +Z, tilted to the camera. */
function neonMask(kit: SetKit, pos: [number, number, number], size: number, color: string, rotY: number, trim = true): THREE.Group & Lit {
  const T = kit.THREE;
  const g = new T.Group() as THREE.Group & Lit;
  const to3 = (pts: [number, number][]) => pts.map(([x, y]) => [x * size, y * size, 0] as [number, number, number]);
  const tubes = [kit.neonTube(to3(MASK_OUTLINE), color, { radius: 0.03, closed: true })];
  for (const ex of [-0.45, 0.45]) tubes.push(kit.neonTube(to3(maskEye(ex, 10)), color, { radius: 0.022, closed: true }));
  if (trim) {
    tubes.push(kit.neonTube(to3(MASK_PLUME), GOLD, { radius: 0.026 }));
    tubes.push(kit.neonTube(to3(MASK_HANDLE), GOLD, { radius: 0.03 }));
  }
  for (const t of tubes) g.add(t);
  g.position.set(...pos);
  g.rotation.set(-0.5, rotY, 0);
  g.setLit = (v) => {
    for (let i = 0; i < tubes.length; i++) tubes[i].setLit(v);
  };
  kit.add(g);
  return g;
}

/** Ballroom column: plinth, marble shaft and gilded capital. Returns the capital top. */
function column(kit: SetKit, x: number, z: number, h: number): [number, number, number] {
  const T = kit.THREE;
  const y0 = kit.regions.groundY;
  const base = new T.Mesh(new T.BoxGeometry(0.62, 0.2, 0.62), kit.mats.brass());
  base.position.set(x, y0 + 0.1, z);
  const shaft = new T.Mesh(new T.CylinderGeometry(0.19, 0.23, h - 0.45, 24), kit.mats.plastic('#ece7f7'));
  shaft.position.set(x, y0 + 0.2 + (h - 0.45) / 2, z);
  shaft.castShadow = true;
  const cap = new T.Mesh(new T.CylinderGeometry(0.34, 0.2, 0.25, 24), kit.mats.brass());
  cap.position.set(x, y0 + h - 0.12, z);
  kit.add(base);
  kit.add(shaft);
  kit.add(cap);
  return [x, y0 + h, z];
}

function harlequinTexture(kit: SetKit, a: string, b: string, seam: string, repeat: number): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 256, 256);
  const d = (cx: number, cy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 64);
    ctx.lineTo(cx + 64, cy);
    ctx.lineTo(cx, cy + 64);
    ctx.lineTo(cx - 64, cy);
    ctx.closePath();
  };
  ctx.fillStyle = b;
  for (const [cx, cy] of [[128, 128], [0, 0], [256, 0], [0, 256], [256, 256]]) {
    d(cx, cy);
    ctx.fill();
  }
  ctx.strokeStyle = seam;
  ctx.lineWidth = 3;
  for (const [cx, cy] of [[128, 128], [0, 0], [256, 0], [0, 256], [256, 256], [128, 0], [0, 128], [256, 128], [128, 256]]) {
    d(cx, cy);
    ctx.stroke();
  }
  const tex = kit.track(new T.CanvasTexture(c));
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  return tex;
}

/** Painted ballroom wall behind the head: tall lattice windows, drapes and molecule chandeliers. */
function paintBallroomWall(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const s1 = stage(level, 0.3, 1.2);
  const s2 = stage(level, 1.3, 2.2);
  const s3 = stage(level, 2.3, 3.1);
  const s4 = stage(level, 3.4, 4);
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#120d36'], [0.6, '#1d1752'], [1, '#0b0a22']]);
  ctx.fillRect(0, 0, w, h);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.5) / n) * w;
    const ww = (w / n) * 0.5;
    const top = h * 0.12;
    const bot = h * 0.9;
    // Moonlit window with a lattice of panes.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - ww / 2, bot);
    ctx.lineTo(cx - ww / 2, top + ww / 2);
    ctx.arc(cx, top + ww / 2, ww / 2, Math.PI, 0);
    ctx.lineTo(cx + ww / 2, bot);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, rgba('#9fd2ff', 0.35 + 0.35 * s2));
    g.addColorStop(1, rgba('#2b3a8a', 0.5 + 0.2 * s2));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = rgba('#0d0b26', 0.85);
    ctx.lineWidth = 3;
    for (let y = top; y < bot; y += ww / 3) {
      ctx.beginPath();
      ctx.moveTo(cx - ww, y);
      ctx.lineTo(cx + ww, y);
      ctx.stroke();
    }
    for (let x = -1; x <= 1; x++) {
      ctx.beginPath();
      ctx.moveTo(cx + (x * ww) / 3, top);
      ctx.lineTo(cx + (x * ww) / 3, bot);
      ctx.stroke();
    }
    if (s3 > 0.02) {
      // Frost crystals bloom on the panes once the lattice awakens.
      const r = rng(31 + i);
      for (let k = 0; k < 10; k++) glowDot(ctx, cx + (r() - 0.5) * ww, top + r() * (bot - top), 5 + r() * 6, ICE, 0.5 * s3);
    }
    ctx.restore();
    // Drapes between windows
    if (i < n - 1) {
      const dx = ((i + 1) / n) * w;
      ctx.fillStyle = rgba(ROSE, 0.28 + 0.25 * s1);
      ctx.beginPath();
      ctx.moveTo(dx - 30, 0);
      ctx.quadraticCurveTo(dx - 10, h * 0.5, dx - 24, h);
      ctx.lineTo(dx + 24, h);
      ctx.quadraticCurveTo(dx + 10, h * 0.5, dx + 30, 0);
      ctx.closePath();
      ctx.fill();
      // Hanging molecule chandelier (water) between the windows
      const y = h * 0.16;
      ctx.strokeStyle = rgba(GOLD, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx, 0);
      ctx.lineTo(dx, y - 10);
      ctx.stroke();
      const lit = 0.3 + 0.7 * s2;
      for (const sx of [-1, 1]) stick(ctx, dx, y, dx + sx * 16, y + 13, 4, '#c9d3ea', lit);
      sphere(ctx, dx, y, 10, O_COL, lit);
      sphere(ctx, dx - 16, y + 13, 7, H_COL, lit);
      sphere(ctx, dx + 16, y + 13, 7, H_COL, lit);
      if (lit > 0.4) glowDot(ctx, dx, y + 4, 30, GOLD, 0.35 * lit);
    }
  }
  // Gilded cornice
  ctx.fillStyle = rgba(GOLD, 0.35 + 0.3 * s1);
  ctx.fillRect(0, h * 0.06, w, 4);
  ctx.fillRect(0, h * 0.92, w, 5);
  if (s4 > 0.01) {
    ctx.fillStyle = rgba(GOLD, 0.12 * s4);
    ctx.fillRect(0, 0, w, h);
  }
}

const masqueradeSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  const gy = kit.regions.groundY;
  kit.sky('#1c1552', '#04030c');
  // Polished harlequin marble ballroom floor with a gilded inlay ring around the cabinet.
  const floorTex = harlequinTexture(kit, '#121338', '#1b1442', 'rgba(255,199,91,0.28)', 34);
  const floorMat = kit.track(new T.MeshPhysicalMaterial({ map: floorTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.05 }));
  const floor = new T.Mesh(new T.CircleGeometry(30, 72).rotateX(-Math.PI / 2), floorMat);
  floor.position.y = gy;
  floor.receiveShadow = true;
  kit.add(floor);
  const inlayMat = kit.track(new T.MeshStandardMaterial({ color: '#2a2010', emissive: GOLD, emissiveIntensity: 0.15, roughness: 0.4, metalness: 0.6 }));
  for (const r of [9.2, 9.55]) {
    const ring = new T.Mesh(new T.RingGeometry(r, r + 0.08, 96).rotateX(-Math.PI / 2), inlayMat);
    ring.position.y = gy + 0.004;
    kit.add(ring);
  }
  const wall = kit.backdrop(paintBallroomWall, { width: 30, height: 12, z: -15 });

  // Colonnade: tall columns behind the head, shorter ones along the sides.
  const capL = column(kit, -4.4, -6.9, 4.4);
  const capR = column(kit, 4.4, -6.9, 4.4);
  const sideL = column(kit, -8.6, -2.4, 3.4);
  const sideR = column(kit, 8.6, -2.4, 3.4);
  const frontL = column(kit, -4.8, 4.3, 2.6);
  const frontR = column(kit, 4.8, 4.3, 2.6);
  const strandHead = kit.stringLights(capL, capR, 0.6, kit.n(16), [ICE, GOLD, ROSE]);
  const strandL = kit.stringLights(sideL, frontL, 0.35, kit.n(12), [GOLD, ICE]);
  const strandR = kit.stringLights(sideR, frontR, 0.35, kit.n(12), [GOLD, AQUA]);

  // Marquee over the head of the table.
  const marquee = kit.neonSign('MOLECULE MASQUERADE', [0, 1.35, -7.3], { height: 0.6, color: GOLD });
  marquee.rotation.x = -0.75;

  // Left: a water molecule (H₂O) turning on a gilded pedestal, with an O₂ pair in front.
  const pedestal = (x: number, z: number, h: number) => {
    const m = new T.Mesh(new T.CylinderGeometry(0.28, 0.4, h, 28), kit.mats.plastic('#e9e2f2'));
    m.position.set(x, gy + h / 2, z);
    m.castShadow = true;
    const collar = new T.Mesh(new T.TorusGeometry(0.3, 0.035, 8, 32), kit.mats.brass());
    collar.rotation.x = Math.PI / 2;
    collar.position.set(x, gy + h, z);
    kit.add(m);
    kit.add(collar);
  };
  pedestal(-6.1, -0.2, 1.05);
  const water = ballStick(kit, [
    { p: [0, 0, 0], r: 0.42, c: O_COL },
    { p: [-0.63, -0.49, 0], r: 0.27, c: H_3D },
    { p: [0.63, -0.49, 0], r: 0.27, c: H_3D },
  ], [[0, 1], [0, 2]], { glow: 0.55 });
  water.group.position.set(-6.1, 1.6, -0.2);
  const waterSign = kit.neonSign('H₂O', [-6.1, 2.55, -0.45], { height: 0.42, color: ICE, rotY: 0.4, backing: false });
  waterSign.rotation.x = -0.5;
  pedestal(-6.7, 1.05, 0.5);
  const oxygen = ballStick(kit, [
    { p: [-0.26, 0, 0], r: 0.3, c: O_COL },
    { p: [0.26, 0, 0], r: 0.3, c: O_COL },
  ], [[0, 1]], { stick: 0.06, glow: 0.55 });
  oxygen.group.position.set(-6.7, 0.55, 1.05);
  const oxySign = kit.neonSign('O₂', [-6.7, 1.2, 1.0], { height: 0.3, color: ROSE, rotY: 0.35, backing: false });
  oxySign.rotation.x = -0.55;

  // Right: ammonia (NH₃) turning on a pedestal.
  pedestal(6.1, -0.2, 1.05);
  const nh: AtomSpec[] = [{ p: [0, 0.12, 0], r: 0.4, c: N_COL }];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    nh.push({ p: [Math.cos(a) * 0.68, -0.32, Math.sin(a) * 0.68], r: 0.26, c: H_3D });
  }
  const ammonia = ballStick(kit, nh, [[0, 1], [0, 2], [0, 3]], { glow: 0.55 });
  ammonia.group.position.set(6.1, 1.7, -0.2);
  const nhSign = kit.neonSign('NH₃', [6.1, 2.55, -0.45], { height: 0.42, color: AQUA, rotY: -0.4, backing: false });
  nhSign.rotation.x = -0.5;

  // Right front: a polymer garland, one small subunit repeated link after link.
  const links: AtomSpec[] = [];
  const linkBonds: [number, number][] = [];
  const nLinks = kit.n(10);
  const from = new T.Vector3(frontR[0] - 0.1, frontR[1] - 0.25, frontR[2]);
  const to = new T.Vector3(sideR[0] - 0.1, sideR[1] - 0.3, sideR[2]);
  for (let i = 0; i < nLinks; i++) {
    const u = (i + 0.5) / nLinks;
    const p = from.clone().lerp(to, u);
    p.y -= Math.sin(u * Math.PI) * 0.55;
    const base = links.length;
    links.push({ p: [p.x, p.y, p.z], r: 0.13, c: C_COL });
    links.push({ p: [p.x + 0.1, p.y - 0.22, p.z + 0.08], r: 0.1, c: O_COL });
    linkBonds.push([base, base + 1]);
    if (i > 0) linkBonds.push([base - 2, base]);
  }
  const polymer = ballStick(kit, links, linkBonds, { stick: 0.035, glow: 0.8 });
  const polySign = kit.neonSign('POLYMER', [5.85, 0.22, 0.95], { height: 0.3, color: ROSE, rotY: -0.35, backing: false });
  polySign.rotation.x = -0.55;

  // Neon masquerade masks crown the front columns.
  // The handle runs down the column, so the mask reads as mounted on it (same height with or
  // without reduced motion; the bob below only moves it a few centimetres around this).
  const maskY = frontL[1] + 0.07;
  const maskL = neonMask(kit, [frontL[0], maskY, frontL[2]], 0.6, ROSE, 0.3);
  const maskR = neonMask(kit, [frontR[0], maskY, frontR[2]], 0.6, AQUA, -0.3);
  maskL.rotation.x = -0.8;
  maskR.rotation.x = -0.8;

  // The crystal canopy: two salt-crystal towers at the head corners assemble layer by layer,
  // and a lattice lintel joins them behind the head for the Wonderlight.
  const towerL = saltCrystal(kit, [-6.2, gy + 0.32 + 2 * 0.4, -4.5], [3, 5, 3], 0.4, 'rising');
  const towerR = saltCrystal(kit, [6.2, gy + 0.32 + 2 * 0.4, -4.5], [3, 5, 3], 0.4, 'rising');
  for (const tw of [towerL, towerR]) {
    const plinth = new T.Mesh(new T.BoxGeometry(1.5, 0.22, 1.5), kit.mats.brass());
    plinth.position.set(tw.group.position.x, gy + 0.11, tw.group.position.z);
    kit.add(plinth);
  }
  const saltSign = kit.neonSign('SALT  1 Na : 1 Cl', [-6.2, 0.3, -3.45], { height: 0.36, color: ICE });
  saltSign.rotation.set(-0.7, 0.3, 0);
  const extSign = kit.neonSign('EXTENDED STRUCTURE', [6.2, 0.3, -3.45], { height: 0.36, color: ICE });
  extSign.rotation.set(-0.7, -0.3, 0);

  // Mirror balls hang from gilded arms on the side columns.
  const balls: THREE.Mesh[] = [];
  const ballMat = kit.track(new T.MeshPhysicalMaterial({ color: '#dfe6ff', metalness: 1, roughness: 0.1, flatShading: true, emissive: ICE, emissiveIntensity: 0.02 }));
  for (const sx of [-1, 1]) {
    const arm = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.1, 8), kit.mats.brass());
    arm.rotation.z = Math.PI / 2;
    arm.position.set(sx * 8.05, gy + 3.3, -2.4);
    const drop = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.5, 6), kit.mats.chrome());
    drop.position.set(sx * 7.55, gy + 3.05, -2.4);
    const mb = new T.Mesh(new T.IcosahedronGeometry(0.36, 2), ballMat);
    mb.position.set(sx * 7.55, gy + 2.45, -2.4);
    mb.castShadow = true;
    kit.add(arm);
    kit.add(drop);
    kit.add(mb);
    balls.push(mb);
  }

  // Ice and quartz crystal clusters around the plinths.
  const crystals = [
    kit.crystal([-7.1, 0.0, -0.9], 0.3, ICE, 1),
    kit.crystal([-6.9, -0.08, 0.5], 0.2, AQUA, 2),
    kit.crystal([7.1, 0.0, -0.9], 0.3, '#c9b3ff', 3),
    kit.crystal([6.9, -0.08, 0.5], 0.2, ICE, 4),
    kit.crystal([-4.3, -0.05, 3.3], 0.22, ICE, 5),
    kit.crystal([4.3, -0.05, 3.3], 0.22, '#c9b3ff', 6),
    kit.crystal([-7.4, 0.0, -4.4], 0.26, AQUA, 7),
    kit.crystal([7.4, 0.0, -4.4], 0.26, ICE, 8),
  ];

  // Wonderlight: the whole ballroom crystallizes. These shards grow only in the finale.
  const bloom: THREE.Mesh[] = [];
  const bloomSpots: [number, number, number, string][] = [
    [-4.25, -2.2, 0.34, ICE], [-4.3, 1.2, 0.26, AQUA], [-7.4, 2.1, 0.4, '#c9b3ff'], [-8.6, -0.6, 0.3, ICE], [-5.1, -3.3, 0.22, AQUA],
    [4.25, -2.2, 0.34, ICE], [4.3, 1.2, 0.26, '#c9b3ff'], [7.4, 2.1, 0.4, AQUA], [8.6, -0.6, 0.3, ICE], [5.1, -3.3, 0.22, '#c9b3ff'],
  ];
  bloomSpots.slice(0, kit.n(10)).forEach(([x, z, size, c], i) => {
    const m = kit.crystal([x, gy + size * 1.2, z], size, c, 20 + i);
    m.scale.setScalar(0.001);
    m.setLit(1);
    bloom.push(m);
  });
  const motes = kit.motes({ x0: -10, x1: 10, y0: 0, y1: 5, z0: -9, z1: 6 }, 110, ICE, { speed: 0.08, size: 0.09 });
  const fwL = kit.fireworks({ x0: -8.6, x1: -5.4, y0: 2.4, y1: 3.4, z: -2.6 }, [ICE, GOLD, ROSE]);
  const fwR = kit.fireworks({ x0: 5.4, x1: 8.6, y0: 2.4, y1: 3.4, z: -2.6 }, [ICE, GOLD, AQUA]);
  const spotL = kit.spot([-4.6, 6.2, 3.2], [-6.1, 0.9, -0.6], ROSE, 10, 0.55);
  const spotR = kit.spot([4.6, 6.2, 3.2], [6.1, 0.9, -0.6], AQUA, 10, 0.55);
  const glow = kit.point([0, 2.4, -7.6], GOLD, 1, 9);

  let spin = 0;
  let pulse = 0;
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      wall.repaint(level);
      // Dormant ballroom: dim but visible. Observe wakes the water model and the masks.
      water.setLit(0.15 + 0.85 * s1);
      waterSign.setLit(0.12 + 0.88 * s1);
      oxygen.setLit(0.12 + 0.88 * s1);
      oxySign.setLit(0.1 + 0.9 * s1);
      maskL.setLit(0.15 + 0.85 * s1);
      maskR.setLit(0.15 + 0.85 * s1);
      if (spotL) spotL.intensity = 8 + 22 * s1;
      if (spotR) spotR.intensity = 8 + 22 * s2;
      // Relate: ammonia and the ballroom lights.
      ammonia.setLit(0.12 + 0.88 * s2);
      nhSign.setLit(0.1 + 0.9 * s2);
      marquee.setLit(0.12 + 0.88 * s2);
      strandHead.setLit(0.2 + 0.8 * s2);
      strandL.setLit(0.25 + 0.75 * s0);
      strandR.setLit(0.25 + 0.75 * s0);
      inlayMat.emissiveIntensity = 0.12 + 0.5 * s2 + 0.6 * s4;
      // Apply: the polymer garland, then the crystal canopy assembles unit by unit.
      polymer.setLit(0.12 + 0.88 * s3);
      polySign.setLit(0.1 + 0.9 * s3);
      saltSign.setLit(0.1 + 0.9 * s3);
      extSign.setLit(0.1 + 0.9 * s3);
      const grow = 0.18 + 0.52 * s3 + 0.3 * s4;
      towerL.grow(grow);
      towerR.grow(grow);
      const lit = 0.2 + 0.45 * s3 + 0.35 * s4 + 0.12 * energy + pulse;
      towerL.setLit(lit);
      towerR.setLit(lit);
      if (glow) glow.intensity = 1 + 5 * s4 + 4 * pulse;
      ballMat.emissiveIntensity = 0.02 + 0.5 * s4;
      for (let i = 0; i < crystals.length; i++) crystals[i].setLit(0.12 + 0.88 * kit.stage(level, 2 + i * 0.12, 2.8 + i * 0.12));
      motes.setLit(0.2 + 0.4 * s3 + 0.4 * s4);
      for (let i = 0; i < bloom.length; i++) bloom[i].scale.setScalar(Math.max(0.001, kit.stage(level, 3.4 + i * 0.04, 3.9 + i * 0.01)));
      fwL.setLit(s4);
      fwR.setLit(s4);
      pulse = Math.max(0, pulse - dt * 0.8);
      if (!kit.reducedMotion) {
        spin += dt * (0.18 + 0.4 * s2 + 0.5 * s4);
        water.group.rotation.y = spin * (0.4 + 0.6 * s1);
        ammonia.group.rotation.y = -spin * (0.4 + 0.6 * s2);
        oxygen.group.rotation.y = spin * 0.7;
        for (let i = 0; i < balls.length; i++) balls[i].rotation.y = spin * (i ? -1.4 : 1.4);
        towerL.group.rotation.y = Math.sin(t * 0.2) * 0.12 * s4;
        towerR.group.rotation.y = -Math.sin(t * 0.2) * 0.12 * s4;
        maskL.position.y = maskY + Math.sin(t * 0.8) * 0.05;
        maskR.position.y = maskY + Math.sin(t * 0.8 + 1.5) * 0.05;
      }
    },
    celebrate(p) {
      pulse = Math.sin(p * Math.PI) * 0.6;
      const f = Math.max(0.25, Math.sin(p * Math.PI));
      fwL.setLit(f);
      fwR.setLit(f);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const masqueradeRoom: RoomBuilder = ({ kit, w, d }) => {
  const T = kit.THREE;
  const floor = new T.Mesh(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2), kit.track(new T.MeshPhysicalMaterial({ map: harlequinTexture(kit, '#1b1d52', '#2a1d55', 'rgba(255,199,91,0.6)', 2), roughness: 0.3, clearcoat: 1 })));
  floor.position.y = 0.034;
  kit.add(floor);
  const water = ballStick(kit, [
    { p: [0, 0, 0], r: 0.13, c: O_COL },
    { p: [-0.19, -0.15, 0], r: 0.085, c: H_3D },
    { p: [0.19, -0.15, 0], r: 0.085, c: H_3D },
  ], [[0, 1], [0, 2]], { stick: 0.025 });
  water.group.position.set(-0.5, 0.8, -0.1);
  // A small piece of a salt crystal: 3 x 3 x 3 alternating atoms, a slice of a grid that could
  // keep going (not a lone "NaCl molecule").
  const cube: AtomSpec[] = [];
  const cubeBonds: [number, number][] = [];
  const step = 0.15;
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      for (let z = 0; z < 3; z++) {
        const na = (x + y + z) % 2 === 1;
        cube.push({ p: [(x - 1) * step, (y - 1) * step, (z - 1) * step], r: na ? 0.034 : 0.046, c: na ? NA_COL : CL_COL });
      }
    }
  }
  cube.forEach((a, i) => cube.forEach((b, j) => {
    if (j > i && Math.abs(Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) - step) < 1e-3) cubeBonds.push([i, j]);
  }));
  const lattice = ballStick(kit, cube, cubeBonds, { stick: 0.008 });
  lattice.group.position.set(0.38, 0.55, -0.15);
  const mask = neonMask(kit, [0, 0.98, -0.82], 0.3, ROSE, 0, false);
  mask.rotation.x = 0;
  const mb = new T.Mesh(new T.IcosahedronGeometry(0.12, 1), kit.track(new T.MeshPhysicalMaterial({ color: '#dfe6ff', metalness: 1, roughness: 0.12, flatShading: true })));
  mb.position.set(-0.05, 1.3, -0.3);
  kit.add(mb);
  const glowOrb = kit.orb([0.38, 0.2, -0.15], 0.06, GOLD);
  return {
    update(t, lit) {
      water.setLit(lit);
      lattice.setLit(lit);
      mask.setLit(lit);
      glowOrb.setLit(lit);
      if (!kit.reducedMotion) {
        water.group.rotation.y = t * 0.5;
        lattice.group.rotation.y = -t * 0.35;
        mb.rotation.y = t * 0.6;
      }
    },
  };
};

// ---------------------------------------------------------------- table definition

export const L02: TableDef = {
  lessonId: 'L02',
  signature: 'An upper flipper that launches the Lattice Ramp in a grand arch over the dance floor',
  ballRole: 'The Wonderball is a game token, not an atom: real atoms and molecules are far too small to see and never roll like a pinball.',
  theme: {
    bg: ['#1c2462', '#0b0e2a'],
    rail: '#d6e2ff',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: ROSE,
    accent2: AQUA,
    bumperCap: '#efeaff',
    bumperRing: '#2d2a72',
    flipper: '#ffe2a0',
    ink: IVORY,
    ramp: 'rgba(170,225,255,0.22)',
    trail: '#a8f0ff',
  },
  lines: {
    intro: 'Welcome to the Molecule Masquerade! Every dancer is an atom in disguise, and tonight they team up into molecules or repeat into crystals that could keep on growing.',
    quark: '"If water is a heap of H₂O molecules, then salt must be a heap of tiny NaCl molecules, right?" Professor Quark wonders.',
    pipTip: 'A soft plunge drops into the Mask Lane. Hold right to catch the ball on the upper flipper, then let go and flip it up the Lattice Ramp.',
  },
  build,
  skillShot: 'mask_lane',
  shots: [
    { id: 'ramp', label: 'Lattice Ramp', on: [{ type: 'ramp', id: 'lattice_ramp' }], insert: 'ins_ramp' },
    { id: 'loop', label: 'Polymer Loop', on: [{ type: 'shot', id: 'loop_sw' }], insert: 'ins_loop' },
    { id: 'bank', label: 'Atom Bank', on: [{ type: 'dropBank', id: 'atom_bank' }], insert: 'ins_bank' },
    { id: 'pocket', label: 'Model Mirror', on: [{ type: 'saucer', id: 'mirror' }], insert: 'ins_pocket' },
    { id: 'water', label: 'H₂O atoms', on: [{ type: 'bumper', group: 'water' }], insert: 'ins_bumpers' },
    { id: 'mask', label: 'Mask Lane', on: [{ type: 'rollover', id: 'mask_lane' }] },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Masks Off!',
      brief: 'Every dancer hides an atom. Read the H₂O model on the dance floor atom by atom, then check your reading in the Model Mirror.',
      objectiveIds: ['L02-O1'],
      stages: [
        { kind: 'collect', text: 'H₂O has 2 H: hit the hydrogen bumpers twice', match: { type: 'bumper', id: ['bumper_h1', 'bumper_h2'] }, count: 2, lamps: ['bumper_h1', 'bumper_h2'], preview: ['water'] },
        { kind: 'collect', text: '…and 1 O: hit the oxygen bumper once', match: { type: 'bumper', id: 'bumper_o' }, count: 1, lamps: ['bumper_o'], preview: ['water'] },
        { kind: 'discover', text: 'Read the model in the Model Mirror', pocket: 'mirror', questions: 1 },
      ],
      discovery: 'H₂O describes one water molecule: two hydrogen atoms and one oxygen atom, with a chemical bond holding each hydrogen to the oxygen.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Molecule Builder',
      brief: 'Fill a model kit at the Atom Bank, then build one ammonia molecule, NH₃: exactly 1 nitrogen atom and 3 hydrogen atoms.',
      objectiveIds: ['L02-O2', 'L02-O1'],
      stages: [
        { kind: 'collect', text: 'Fill the model kit: drop the H, O, C and N tokens', match: { type: 'drop', group: 'atoms' }, count: 4, distinct: true, lamps: ['atom_bank_1', 'atom_bank_2', 'atom_bank_3', 'atom_bank_4'], preview: ['bank'] },
        { kind: 'collect', text: 'NH₃ has 1 N and 3 H: hit the hydrogen bumpers 3 times', match: { type: 'bumper', id: ['bumper_h1', 'bumper_h2'] }, count: 3, lamps: ['bumper_h1', 'bumper_h2'], preview: ['water'] },
        { kind: 'discover', text: 'Check your build in the Model Mirror', pocket: 'mirror', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'A formula gives exact counts: one NH₃ molecule has 1 nitrogen bonded to 3 hydrogens. Change the count (H₂O vs H₂O₂) or the bonding (butane vs isobutane) and you get a different substance.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Pattern on Repeat',
      brief: 'Salt, quartz and ice each repeat one subunit again and again. Ride the Lattice Ramp and the Polymer Loop, then sort molecules from extended structures.',
      objectiveIds: ['L02-O3', 'L02-O4'],
      stages: [
        { kind: 'collect', text: 'Repeat the subunit: ride the Lattice Ramp twice', match: { type: 'ramp', id: 'lattice_ramp' }, count: 2, preview: ['ramp'] },
        { kind: 'shots', text: 'Link a polymer chain: shoot the Polymer Loop', shots: ['loop'] },
        { kind: 'discover', text: 'Molecule or extended structure? Shoot the Mirror', pocket: 'mirror', questions: 1, types: ['classify'] },
      ],
      discovery: 'A molecule has an exact atom count; an extended structure like salt repeats a subunit in a fixed ratio. A salt crystal with a million sodium atoms holds a million chlorine atoms: NaCl names a ratio, not a molecule.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Crystal Canopy',
    brief: 'Make every major shot to grow a crystal canopy over the ballroom, then bring the Wonderball home to the Model Mirror.',
    stages: [
      { kind: 'shots', text: 'Grow the canopy: Ramp, Loop, Atom Bank and H₂O', shots: ['ramp', 'loop', 'bank', 'water'], order: 'any' },
      { kind: 'discover', text: 'Final reflection in the Model Mirror', pocket: 'mirror', questions: 2 },
    ],
    celebration: 'One subunit, repeated again and again: the crystal canopy spans the ballroom, and the Masquerade’s Wonderlight shines!',
  },
  set: masqueradeSet,
  room: masqueradeRoom,
  icons: {
    atomH(ctx, s) {
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s * 0.95);
      g.addColorStop(0, '#dfe5f7');
      g.addColorStop(0.55, '#9ea8c8');
      g.addColorStop(1, '#4c5678');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.95, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0d0a1e';
      ctx.font = `800 ${Math.round(s * 1.3)}px "Fraunces Variable", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', 0, s * 0.08);
    },
    atomO(ctx, s) {
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.35, s * 0.1, 0, 0, s);
      g.addColorStop(0, '#ffc2c4');
      g.addColorStop(0.55, O_COL);
      g.addColorStop(1, '#9e2028');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${Math.round(s * 1.3)}px "Fraunces Variable", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('O', 0, s * 0.08);
    },
    mirror(ctx, s) {
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.6, s * 0.85, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(-s * 0.15, -s * 0.2, s * 0.18, s * 0.32, 0.4, 0, TAU);
      ctx.fill();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s2 = stage(level, 1, 2);
      if (!reduced) drift(ctx, 7, 16, t, ICE, [40, 360, 540, 780], 9, 1.5, 0.25 + 0.2 * s2);
      // Mirror-ball flecks sweep across the dance floor once the ballroom is lit.
      if (s2 > 0.05) {
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a = (reduced ? 0 : t * 0.35) + (i / n) * TAU;
          const rr = 70 + (i % 3) * 22;
          glowDot(ctx, 300 + Math.cos(a) * rr, 324 + Math.sin(a) * rr * 0.8, 5, [ICE, ROSE, GOLD][i % 3], (0.25 + 0.25 * energy) * s2);
        }
      }
    },
    celebrate({ ctx }, p) {
      // Hexagonal rings of light ripple out from the Model Mirror.
      ctx.save();
      for (let k = 0; k < 3; k++) {
        const q = (p + k / 3) % 1;
        ctx.strokeStyle = rgba(k % 2 ? ICE : GOLD, 0.6 * (1 - q));
        ctx.lineWidth = 4;
        hexPath(ctx, 326, 530, 30 + q * 420);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.35;
      const g = ctx.createRadialGradient(326, 530, 10, 326, 530, 460);
      g.addColorStop(0, rgba(ICE, 0.8));
      g.addColorStop(1, rgba(SAPPHIRE, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
    },
  },
};
export default L02;
