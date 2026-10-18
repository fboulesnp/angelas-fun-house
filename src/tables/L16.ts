// Lesson 16 — Earth's Tectonic Plates — "Pangaea Puzzle Palace"
// A palace stands on two puzzle-piece continents, South America and Africa, across a spreading
// Atlantic. Matching fossil targets face each other over the mid-ocean ridge, a ridge spine splits
// the ocean into two spreading lanes that end at the Keystone Pocket, a drill line samples seafloor
// ages, and three boundary gates (convergent Andes orbit, divergent ridge, transform lane) lead to
// the quake belt and the Mantle Portal. Every clue rebuilds a little more of the palace.

import type * as THREE from 'three';
import { FRAME, type Pt, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { TAU, glowDot, neonPath, neonText, rgba, rng, stage, vgrad } from '../game/render/art.ts';

// ---------------------------------------------------------------- palette

const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const MAGMA = '#FF7A3D';
const LAVA = '#FF3B12';
const SAND = '#D9B26F';
const SANDSTONE = '#E8D3A8';
/** Seafloor age colours, youngest (at the ridge) to oldest. */
const AGE = ['#FF4F4F', '#FF8C42', '#FFD166', '#8AD46B', '#47B8C4', '#3A7BD5', '#2B4C9B', '#22356F'];
/** Band edges (table units from the ridge) for the printed age stripes. */
const AGE_EDGES = [12, 30, 55, 85, 125, 175, 240, 400];

// ---------------------------------------------------------------- geometry

// Continent outlines (closed). North is up the table. SA's west coast is the Andes orbit's inner
// wall; Africa's slanted east coast is the transform lane's inner wall.
const SOUTH_AMERICA: Pt[] = [
  [80, 452], [104, 416], [132, 396], [160, 408], [184, 430], [198, 458], [200, 486], [192, 512],
  [178, 548], [162, 584], [146, 612], [132, 628], [120, 626], [106, 600], [94, 556], [84, 500],
];
const AFRICA: Pt[] = [
  [494, 412], [494, 452], [480, 496], [463, 534], [447, 572], [431, 606], [420, 630], [410, 636],
  [404, 616], [400, 586], [399, 548], [400, 506], [388, 490], [374, 472], [372, 446], [390, 416],
  [416, 394], [444, 384], [468, 392],
];
const RIDGE_X = 286;
const DRILL_Y = 700;
const DRILL: { x: number; label: string; band: number }[] = [
  { x: 198, label: 'OLD', band: 4 }, { x: 242, label: 'MID', band: 2 }, { x: 286, label: 'NEW', band: 0 },
  { x: 330, label: 'MID', band: 2 }, { x: 374, label: 'OLD', band: 4 },
];
const PORTAL: Pt = [514, 372];
const PORTAL_EXIT: Pt = [52, 340];
const QUAKES: Pt[] = [[206, 252], [286, 214], [366, 252]];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'right' });

  // --- Continent platforms with clue targets on their facing coasts.
  b.wall(SOUTH_AMERICA, { id: 'south_america', r: 4, closed: true });
  b.wall(AFRICA, { id: 'africa', r: 4, closed: true });
  b.target('sa_fit', [204, 456], [206, 488], { group: 'sa', label: 'FIT' });
  b.target('sa_glosso', [197.6, 514.2], [183.6, 550.2], { group: 'sa', label: 'GLOSSO' });
  b.target('sa_meso', [167.2, 587], [151.2, 615], { group: 'sa', label: 'MESO' });
  b.target('af_fit', [371, 479], [389, 501], { group: 'af', label: 'FIT' });
  b.target('af_glosso', [393, 508], [393, 548], { group: 'af', label: 'GLOSSO' });
  b.target('af_meso', [394, 586], [398, 618], { group: 'af', label: 'MESO' });

  // --- Mid-ocean ridge: a spine splits the Atlantic into West and East spreading lanes and ends
  //     in the Keystone cup, the Wonder Pocket.
  b.post(RIDGE_X, 414, 5, { id: 'ridge_cap' });
  b.wall([[RIDGE_X, 418], [RIDGE_X, 564]], { id: 'ridge_spine', r: 4 });
  b.wall([[262, 618], [262, 578], [RIDGE_X, 564], [310, 578], [310, 618]], { id: 'keystone_cup', r: 4 });
  b.saucer('keystone', RIDGE_X, 598, { role: 'pocket', ejectDeg: 84, ejectSpeed: 720, captureMaxSpeed: 2400, label: 'KEYSTONE', icon: 'keystone' });
  b.spinner('west_spinner', [220, 456], [266, 456], { label: 'SPREAD' });
  b.spinner('east_spinner', [306, 456], [352, 456], { label: 'SPREAD' });
  b.shotSwitch('west_sw', 238, 426, -90, { r: 30 });
  b.shotSwitch('east_sw', 330, 426, -90, { r: 30 });

  // --- Seafloor drill line: five core sites, youngest at the ridge, older on both sides.
  DRILL.forEach((d, i) => {
    const r = b.rollover(`drill_${i + 1}`, d.x, DRILL_Y, { group: 'drill', label: d.label });
    r.lampColor = AGE[d.band];
  });

  // --- Andes orbit (convergent boundary gate). The one-way gate lets balls up the channel and
  //     turns balls coming down toward the left inlane.
  b.shotSwitch('andes_sw', 52, 476, -90, { r: 22 });
  b.gate('convergent_gate', [FRAME.left + 3, 620], [70, 712], -90);
  // Trench lip: balls glancing off the Keystone cup used to slip under South America's tip
  // into the left outlane; this guide drops them (and portal returns) into the left inlane.
  b.wall([[70, 712], [74, 750], [69, 786]], { id: 'trench_guide', r: 3 });

  // --- Transform lane (transform boundary gate) up the right channel to the Mantle Portal.
  b.shotSwitch('transform_sw', 521, 446, -90, { r: 22 });
  b.gate('transform_gate', [FRAME.laneSep - 3, 620], [500, 714], -90);
  b.rollover('seismo_lane', 508, 338, { label: 'SKILL' });
  b.portal('mantle_portal', PORTAL, { x: PORTAL_EXIT[0], y: PORTAL_EXIT[1], deg: 90, speed: 500 }, { label: 'MANTLE PORTAL' });

  // --- Quake belt: pop bumpers strung along a narrow arc at the palace steps.
  QUAKES.forEach(([x, y], i) => b.bumper(['quake_w', 'quake_n', 'quake_e'][i], x, y, { group: 'quakes', icon: 'quake', r: 24 }));

  // --- Inserts that preview each shot.
  b.insert('ins_andes', 52, 604, { deg: -90, label: 'ANDES' });
  b.insert('ins_west', 236, 548, { deg: -90 });
  b.insert('ins_east', 336, 548, { deg: -90 });
  b.insert('ins_pocket', RIDGE_X, 748, { deg: -90 });
  b.insert('ins_transform', 521, 604, { deg: -90 });
  b.insert('ins_sa', 226, 606, { deg: -150, color: CORAL });
  b.insert('ins_af', 348, 616, { deg: -30, color: CORAL });
  b.insert('ins_quakes', RIDGE_X, 300, { shape: 'star', size: 12, color: MAGMA });
  b.insert('ins_drill', RIDGE_X, 776, { shape: 'circle', size: 9, color: AGE[0] });
}

// ---------------------------------------------------------------- printed playfield art

function polyPath(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Ridge axis on the printed map: offset by two fracture zones (transform faults). */
function ridgeAt(y: number) {
  return y < 400 ? 300 : y < 736 ? RIDGE_X : 274;
}

function ageStripes(ctx: CanvasRenderingContext2D, alpha: number) {
  const y0 = 230;
  const y1 = 850;
  const segs: [number, number][] = [[y0, 400], [400, 736], [736, y1]];
  for (let k = AGE_EDGES.length - 1; k >= 0; k--) {
    const e = AGE_EDGES[k];
    const c = AGE[k];
    ctx.fillStyle = vgrad(ctx, y0, y1, [[0, rgba(c, 0)], [0.14, rgba(c, alpha)], [0.86, rgba(c, alpha)], [1, rgba(c, 0)]]);
    for (const [a, b] of segs) {
      const cx = ridgeAt((a + b) / 2);
      ctx.fillRect(cx - e, a, e * 2, b - a);
    }
  }
}

function mesosaurus(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ang: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(s * 0.64, 0);
  ctx.quadraticCurveTo(s * 0.42, -s * 0.035, s * 0.25, -s * 0.07);
  ctx.quadraticCurveTo(0, -s * 0.12, -s * 0.26, -s * 0.06);
  ctx.quadraticCurveTo(-s * 0.56, s * 0.02, -s * 0.84, -s * 0.07);
  ctx.quadraticCurveTo(-s * 0.56, s * 0.08, -s * 0.26, s * 0.065);
  ctx.quadraticCurveTo(0, s * 0.11, s * 0.25, s * 0.05);
  ctx.quadraticCurveTo(s * 0.42, s * 0.03, s * 0.64, 0);
  ctx.fill();
  for (const [lx, d] of [[0.13, 1], [-0.17, 1], [0.13, -1], [-0.17, -1]] as [number, number][]) {
    ctx.save();
    ctx.translate(lx * s, d * s * 0.09);
    ctx.rotate(d * 0.7);
    ctx.beginPath();
    ctx.ellipse(0, d * s * 0.04, s * 0.03, s * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = rgba('#1a1030', alpha * 0.8);
  ctx.beginPath();
  ctx.arc(s * 0.26, -s * 0.025, s * 0.018, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function glossLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ang: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-s * 0.3, -s * 0.22, -s * 0.26, -s * 0.86, 0, -s);
  ctx.bezierCurveTo(s * 0.26, -s * 0.86, s * 0.3, -s * 0.22, 0, 0);
  ctx.fill();
  ctx.strokeStyle = rgba('#10301c', alpha * 0.7);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -s * 0.94);
  for (let i = 1; i < 6; i++) {
    const yy = -s * (0.12 + i * 0.14);
    ctx.moveTo(0, yy);
    ctx.lineTo(-s * 0.17, yy - s * 0.1);
    ctx.moveTo(0, yy);
    ctx.lineTo(s * 0.17, yy - s * 0.1);
  }
  ctx.stroke();
  ctx.restore();
}

function puzzleKnob(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = rgba(color, alpha);
  ctx.fillStyle = rgba(color, alpha * 0.25);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-s, -s);
  ctx.lineTo(-s * 0.3, -s);
  ctx.arc(0, -s, s * 0.32, Math.PI, 0, false);
  ctx.lineTo(s, -s);
  ctx.lineTo(s, -s * 0.3);
  ctx.arc(s, 0, s * 0.32, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(s, s);
  ctx.lineTo(-s, s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function volcano(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, glow: number) {
  ctx.save();
  ctx.fillStyle = '#6b4a35';
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.6);
  ctx.lineTo(x - s * 0.22, y - s * 0.55);
  ctx.lineTo(x + s * 0.22, y - s * 0.55);
  ctx.lineTo(x + s, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba('#3a2618', 0.6);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.05, y - s * 0.55);
  ctx.lineTo(x + s * 0.22, y - s * 0.55);
  ctx.lineTo(x + s, y + s * 0.6);
  ctx.lineTo(x + s * 0.3, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
  if (glow > 0.01) {
    glowDot(ctx, x, y - s * 0.6, s * 1.4, MAGMA, 0.55 * glow);
    ctx.strokeStyle = rgba('#FFB35C', 0.9 * glow);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.05, y - s * 0.5);
    ctx.quadraticCurveTo(x - s * 0.35, y, x - s * 0.5, y + s * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function vText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number, rot = -Math.PI / 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function smallText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number, weight = 800) {
  ctx.save();
  ctx.font = `${weight} ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(6,14,26,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Two little arrowheads showing plate motion: 'in' (convergent), 'out' (divergent), 'slide' (transform). */
function motion(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'in' | 'out' | 'slide', color: string, alpha: number, s = 7) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = rgba(color, alpha);
  const head = (hx: number, hy: number, dir: number) => {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(dir);
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.6, -s * 0.75);
    ctx.lineTo(-s * 0.25, 0);
    ctx.lineTo(-s * 0.6, s * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  if (kind === 'in') {
    head(-s * 1.4, 0, 0);
    head(s * 1.4, 0, Math.PI);
  } else if (kind === 'out') {
    head(-s * 1.4, 0, Math.PI);
    head(s * 1.4, 0, 0);
  } else {
    head(-s * 0.7, -s * 0.2, -Math.PI / 2);
    head(s * 0.7, s * 0.2, Math.PI / 2);
  }
  ctx.restore();
}

function paintLand(ctx: CanvasRenderingContext2D, pts: Pt[], seed: number, stops: [number, string][], shelf: number) {
  // Continental shelf: the true puzzle edge, a little way offshore.
  ctx.save();
  polyPath(ctx, pts);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba('#7FD6E6', 0.1 + 0.18 * shelf);
  ctx.lineWidth = 26;
  ctx.stroke();
  ctx.strokeStyle = rgba('#9BE6F0', 0.16 + 0.22 * shelf);
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.fillStyle = vgrad(ctx, 380, 650, stops);
  ctx.fill();
  ctx.clip();
  const r = rng(seed);
  for (let i = 0; i < 220; i++) {
    const x = 70 + r() * 440;
    const y = 380 + r() * 270;
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,240,200,0.12)' : 'rgba(30,40,20,0.14)';
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + r() * 2.4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function paintPalace(ctx: CanvasRenderingContext2D, level: number) {
  const found = stage(level, 0.2, 1);
  const walls = stage(level, 1.1, 2);
  const towers = stage(level, 2.1, 3);
  const crown = stage(level, 3.2, 4);
  const cx = RIDGE_X;
  if (crown > 0.01) glowDot(ctx, cx, 120, 170, GOLD, 0.16 * crown);
  // Blueprint ghost of the whole palace (always visible, faint): the rebuild target.
  const towerX = [190, 238, 334, 382];
  const towerTop = [104, 90, 90, 104];
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = rgba(IVORY, 0.28);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(176, 132, 220, 42);
  towerX.forEach((x, i) => ctx.strokeRect(x - 12, towerTop[i], 24, 174 - towerTop[i]));
  ctx.strokeRect(cx - 20, 84, 40, 90);
  ctx.beginPath();
  ctx.arc(cx, 84, 20, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
  // Foundation: two continent plinths that lock together like puzzle pieces (Pangaea).
  const pa = 0.12 + 0.88 * found;
  ctx.save();
  ctx.fillStyle = rgba('#5E9E5A', pa);
  ctx.beginPath();
  ctx.moveTo(150, 176);
  ctx.lineTo(cx, 176);
  ctx.lineTo(cx, 181);
  ctx.arc(cx + 2, 185, 5, -Math.PI / 2, Math.PI / 2, false);
  ctx.lineTo(cx, 196);
  ctx.lineTo(160, 196);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(SAND, pa);
  ctx.beginPath();
  ctx.moveTo(cx, 176);
  ctx.lineTo(422, 176);
  ctx.lineTo(412, 196);
  ctx.lineTo(cx, 196);
  ctx.lineTo(cx, 190);
  ctx.arc(cx + 2, 185, 5, Math.PI / 2, -Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Walls with crenellations and a gate.
  if (walls > 0.01) {
    ctx.save();
    ctx.globalAlpha = walls;
    ctx.fillStyle = vgrad(ctx, 128, 176, [[0, '#D8C08E'], [1, '#9E8458']]);
    ctx.fillRect(176, 136, 220, 40);
    for (let x = 176; x < 396; x += 14) ctx.fillRect(x, 129, 8, 8);
    ctx.fillStyle = '#2a1d14';
    ctx.beginPath();
    ctx.moveTo(cx - 13, 176);
    ctx.lineTo(cx - 13, 158);
    ctx.arc(cx, 158, 13, Math.PI, 0);
    ctx.lineTo(cx + 13, 176);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Towers, keep and domes.
  if (towers > 0.01) {
    ctx.save();
    ctx.globalAlpha = towers;
    towerX.forEach((x, i) => {
      const top = towerTop[i];
      ctx.fillStyle = vgrad(ctx, top, 176, [[0, '#E2CC9C'], [1, '#A68A5C']]);
      ctx.fillRect(x - 12, top, 24, 176 - top);
      if (i === 0 || i === 3) {
        ctx.fillStyle = CORAL;
        ctx.beginPath();
        ctx.moveTo(x - 15, top);
        ctx.lineTo(x, top - 24);
        ctx.lineTo(x + 15, top);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.arc(x, top, 13, Math.PI, 0);
        ctx.fill();
      }
    });
    ctx.fillStyle = vgrad(ctx, 84, 176, [[0, '#E6D2A2'], [1, '#A88C5E']]);
    ctx.fillRect(cx - 20, 84, 40, 92);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(cx, 84, 22, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 1.5, 50, 3, 14);
    ctx.restore();
  }
  // Windows light up as the evidence comes together.
  const win = towers * (0.18 + 0.82 * Math.max(stage(level, 2.6, 3.2), crown));
  if (win > 0.01) {
    ctx.save();
    for (const [i, x] of towerX.entries()) {
      for (let k = 0; k < 3; k++) {
        const y = towerTop[i] + 12 + k * 20;
        if (y > 160) continue;
        ctx.fillStyle = rgba(GOLD, win);
        ctx.fillRect(x - 3, y, 6, 9);
      }
    }
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = rgba(GOLD, win);
      ctx.fillRect(cx - 12 + k * 10, 100, 5, 12);
    }
    ctx.restore();
  }
  // Pennants on the Wonderlight.
  if (crown > 0.01) {
    for (const [i, x] of towerX.entries()) {
      const top = towerTop[i] - (i === 0 || i === 3 ? 24 : 13);
      ctx.strokeStyle = rgba(IVORY, crown);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top - 12);
      ctx.stroke();
      ctx.fillStyle = rgba([CORAL, MINT, MINT, CORAL][i], crown);
      ctx.beginPath();
      ctx.moveTo(x, top - 12);
      ctx.lineTo(x + 10, top - 9);
      ctx.lineTo(x, top - 6);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function paintBackdrop({ ctx, level }: SceneryContext) {
  const s1 = stage(level, 0.2, 1);
  const s2 = stage(level, 1.2, 2);
  const s3 = stage(level, 2.2, 3);
  const s4 = stage(level, 3.3, 4);

  // Deep Atlantic.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#0A2442'], [0.3, '#0F3A5F'], [0.62, '#0D3354'], [1, '#071629']]);
  ctx.fillRect(0, 0, 600, 1150);
  // Sonar contour ripples (the seafloor is anything but flat).
  ctx.save();
  ctx.strokeStyle = 'rgba(159,216,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    for (let x = 0; x <= 600; x += 12) {
      const y = 110 + i * 42 + Math.sin(x / 47 + i * 1.7) * 8 + Math.sin(x / 13 + i) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Seafloor age stripes, symmetric about the ridge (clear once the cores are drilled, but kept
  // mid-tone so the glowing ball and the drill labels stay readable over them).
  ageStripes(ctx, 0.07 + 0.13 * s2);
  // Fracture zones: transform faults offset the ridge.
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = rgba(IVORY, 0.14 + 0.25 * s2);
  ctx.lineWidth = 1.2;
  for (const y of [400, 736]) {
    ctx.beginPath();
    ctx.moveTo(110, y);
    ctx.lineTo(470, y);
    ctx.stroke();
  }
  ctx.restore();
  // The ridge itself: a glowing volcanic seam where new seafloor forms.
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(300, 236);
    ctx.lineTo(300, 400);
    ctx.lineTo(RIDGE_X, 400);
    ctx.lineTo(RIDGE_X, 736);
    ctx.lineTo(274, 736);
    ctx.lineTo(274, 830);
  }, '#FF5A3C', 0.22 + 0.78 * s2, 3);

  // Clue match lines across the ocean (after the clues are matched).
  if (s1 > 0.01) {
    ctx.save();
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 2;
    const pairs: [Pt, Pt, string][] = [[[208, 472], [378, 490], GOLD], [[194, 532], [390, 528], MINT], [[162, 601], [393, 602], CORAL]];
    for (const [a, c, col] of pairs) {
      ctx.strokeStyle = rgba(col, 0.55 * s1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Continents.
  paintLand(ctx, SOUTH_AMERICA, 16, [[0, '#2F7A45'], [0.45, '#4E9452'], [0.8, '#B59A5C'], [1, '#C9A867']], s1);
  paintLand(ctx, AFRICA, 61, [[0, '#E0BB72'], [0.32, '#CFAE68'], [0.55, '#4C8E4E'], [0.8, '#8EA25A'], [1, '#BFA463']], s1);
  // Rivers.
  ctx.save();
  ctx.strokeStyle = 'rgba(120,200,240,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(98, 470);
  ctx.bezierCurveTo(124, 452, 150, 470, 176, 444);
  ctx.moveTo(470, 404);
  ctx.bezierCurveTo(462, 440, 476, 470, 458, 500);
  ctx.stroke();
  ctx.restore();
  // East African Rift: a young divergent boundary splitting Africa.
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = rgba('#FF6A4A', 0.35 + 0.5 * s3);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(486, 420);
  ctx.lineTo(470, 476);
  ctx.lineTo(462, 520);
  ctx.stroke();
  ctx.restore();
  // Andes along South America's west coast, with a volcano fed by the sinking plate.
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const x = 96 + u * 26 + Math.sin(i * 1.7) * 2;
    const y = 462 + u * 140;
    ctx.fillStyle = '#7A5B40';
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 6);
    ctx.lineTo(x, y - 8);
    ctx.lineTo(x + 7, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,240,0.85)';
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y - 3);
    ctx.lineTo(x, y - 8);
    ctx.lineTo(x + 2.5, y - 3);
    ctx.closePath();
    ctx.fill();
  }
  volcano(ctx, 112, 528, 10, Math.max(0.25 * s1, s3));
  // Fossil and fit clues printed beside their targets.
  const clue = 0.55 + 0.45 * s1;
  mesosaurus(ctx, 128, 590, 40, -0.95, CORAL, clue);
  mesosaurus(ctx, 420, 584, 40, 1.2, CORAL, clue);
  glossLeaf(ctx, 162, 534, 22, -0.5, '#8FE3A0', clue);
  glossLeaf(ctx, 172, 540, 18, 0.3, '#8FE3A0', clue * 0.85);
  glossLeaf(ctx, 428, 538, 22, 0.4, '#8FE3A0', clue);
  glossLeaf(ctx, 418, 544, 18, -0.4, '#8FE3A0', clue * 0.85);
  puzzleKnob(ctx, 178, 470, 7, GOLD, clue);
  puzzleKnob(ctx, 420, 452, 7, GOLD, clue);
  smallText(ctx, 'S. AMERICA', 140, 432, 9, IVORY, 0.85);
  smallText(ctx, 'AFRICA', 438, 416, 9, IVORY, 0.85);

  // Convergent trench down the Andes orbit; transform lane on the right.
  ctx.save();
  ctx.fillStyle = vgrad(ctx, 380, 700, [[0, 'rgba(3,10,20,0)'], [0.15, 'rgba(3,10,20,0.55)'], [0.85, 'rgba(3,10,20,0.55)'], [1, 'rgba(3,10,20,0)']]);
  ctx.fillRect(28, 380, 50, 320);
  ctx.restore();
  vText(ctx, 'CONVERGENT', 41, 535, 10, CORAL, 0.55 + 0.4 * s3);
  vText(ctx, 'TRENCH', 64, 535, 8, IVORY, 0.45);
  motion(ctx, 52, 446, 'in', CORAL, 0.45 + 0.45 * s3, 6);
  vText(ctx, 'TRANSFORM', 530, 520, 10, MINT, 0.55 + 0.4 * s3, Math.PI / 2);
  motion(ctx, 514, 520, 'slide', MINT, 0.45 + 0.45 * s3, 7);
  smallText(ctx, 'DIVERGENT', RIDGE_X, 378, 9, '#FF8A6A', 0.6 + 0.4 * s2);
  motion(ctx, RIDGE_X, 392, 'out', '#FF8A6A', 0.5 + 0.4 * s2, 5);

  // Mantle Portal: a window into hot, mostly solid mantle rock (not a sea of magma).
  const [px, py] = PORTAL;
  glowDot(ctx, px, py, 52, MAGMA, 0.16 + 0.3 * s3);
  ctx.save();
  ctx.fillStyle = '#5E4430';
  ctx.beginPath();
  ctx.arc(px, py, 31, 0, TAU);
  ctx.fill();
  const mg = ctx.createRadialGradient(px, py, 4, px, py, 26);
  mg.addColorStop(0, '#F08A3A');
  mg.addColorStop(1, '#8A341C');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(px, py, 26, 0, TAU);
  ctx.fill();
  const rr = rng(7);
  for (let i = 0; i < 60; i++) {
    const a = rr() * TAU;
    const d = rr() * 25;
    ctx.fillStyle = rr() < 0.5 ? 'rgba(40,14,8,0.45)' : 'rgba(255,200,120,0.35)';
    ctx.beginPath();
    ctx.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, 0.8 + rr() * 1.4, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(IVORY, 0.75);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    const x = px - 24 + u * 48;
    const y = py - 8 + Math.sin(u * TAU * 2.5) * 3 + u * 14;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  smallText(ctx, 'MANTLE', 521, 410, 8, '#FFC08A', 0.9);
  // Seismograph station where the portal's quake wave arrives.
  ctx.save();
  ctx.strokeStyle = rgba(MINT, 0.5 + 0.45 * s3);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const y = 300 + i * 3.4;
    const amp = i > 6 && i < 16 ? 8 : 2;
    const x = 52 + (i % 2 ? amp : -amp);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  vText(ctx, 'SEISMOGRAPH', 70, 336, 8, MINT, 0.7);

  // Quake belt: earthquakes crowd into a narrow band along the boundary.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba('#FF6A4A', 0.1 + 0.2 * s3);
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(140, 296);
  ctx.quadraticCurveTo(RIDGE_X, 150, 432, 296);
  ctx.stroke();
  ctx.setLineDash([2, 7]);
  ctx.strokeStyle = rgba('#FFB36A', 0.35 + 0.5 * s3);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.restore();
  const er = rng(23);
  for (let i = 0; i < 16; i++) {
    const u = er();
    const x = 140 + u * 292;
    const y = 296 - Math.sin(u * Math.PI) * 74 + (er() - 0.5) * 12;
    ctx.strokeStyle = rgba('#FF8A5A', 0.25 + 0.45 * s3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 2 + er() * 3, 0, TAU);
    ctx.stroke();
  }
  // Quakes also crowd in narrow lines along the other plate edges (ridge, trench, transform
  // lane), so the printed quake rings outline the plates instead of scattering at random.
  const edgeQuakes: [number, number, number, number][] = [[RIDGE_X, 430, 820, 9], [48, 420, 690, 7], [522, 470, 610, 5]];
  for (const [ex, ya, yb, side] of edgeQuakes) {
    for (let i = 0; i < 9; i++) {
      const y = ya + ((i + er() * 0.6) / 9) * (yb - ya);
      const x = (ex === RIDGE_X ? ridgeAt(y) : ex) + (i % 2 ? side : -side) + (er() - 0.5) * 4;
      ctx.strokeStyle = rgba('#FF8A5A', 0.18 + 0.42 * s3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 2 + er() * 2.5, 0, TAU);
      ctx.stroke();
    }
  }
  smallText(ctx, 'QUAKE BELT', RIDGE_X, 270, 8, '#FFB36A', 0.75);

  // The palace (rebuilds with the evidence) and the marquee.
  paintPalace(ctx, level);
  neonText(ctx, 'PANGAEA PUZZLE PALACE', 308, 41, 11, GOLD, 0.3 + 0.7 * Math.max(s1 * 0.5, stage(level, 1.5, 2.5)));

  // Drill line: core sites, ages rising with distance from the ridge.
  for (const d of DRILL) {
    const c = AGE[d.band];
    glowDot(ctx, d.x, DRILL_Y, 22, c, 0.18 + 0.5 * s2);
    ctx.strokeStyle = rgba(c, 0.55 + 0.4 * s2);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x, DRILL_Y, 15, 0, TAU);
    ctx.stroke();
  }
  smallText(ctx, '◄ OLDER   ·   YOUNGEST AT THE RIDGE   ·   OLDER ►', RIDGE_X, 724, 7.5, IVORY, 0.7);

  // Compass and a plate-speed reminder.
  ctx.save();
  ctx.translate(150, 760);
  ctx.strokeStyle = rgba(IVORY, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgba(GOLD, 0.75);
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(4, 0);
  ctx.lineTo(0, 4);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(IVORY, 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 17);
  ctx.lineTo(4, 0);
  ctx.lineTo(-4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  smallText(ctx, 'N', 150, 736, 8, GOLD, 0.8);
  smallText(ctx, 'Plates creep a few centimeters a year', RIDGE_X, 796, 7.5, IVORY, 0.5, 700);

  // Wonderlight wash.
  if (s4 > 0.01) {
    ctx.fillStyle = rgba(GOLD, 0.06 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    for (const pts of [SOUTH_AMERICA, AFRICA]) {
      ctx.save();
      polyPath(ctx, pts);
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 16 * s4;
      ctx.strokeStyle = rgba(GOLD, 0.7 * s4);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- 3D attraction set

function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!, w, h);
  const t = kit.track(new kit.THREE.CanvasTexture(c));
  t.colorSpace = kit.THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

interface Platform {
  mesh: THREE.Mesh;
  /** Table point -> world [X, Z] on this platform. */
  at(x: number, y: number): [number, number];
  top: number;
}

/** Extrude a continent outline into a raised platform with a painted top. */
function continent(kit: SetKit, pts: Pt[], scale: number, height: number, center: [number, number, number], paint: (ctx: CanvasRenderingContext2D, toC: (x: number, y: number) => [number, number], w: number, h: number) => void, cliff: string): Platform {
  const T = kit.THREE;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const shape = new T.Shape();
  pts.forEach(([x, y], i) => {
    const px = (x - cx) * scale;
    const py = -(y - cy) * scale;
    if (i) shape.lineTo(px, py);
    else shape.moveTo(px, py);
  });
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: 2, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const bw = bb.max.x - bb.min.x;
  const bd = bb.max.z - bb.min.z;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / bw, 1 - (pos.getZ(i) - bb.min.z) / bd);
  uv.needsUpdate = true;
  const W = 512;
  const H = Math.round((512 * bd) / bw);
  const toC = (x: number, y: number): [number, number] => [(((x - cx) * scale - bb.min.x) / bw) * W, (((y - cy) * scale - bb.min.z) / bd) * H];
  const tex = canvasTex(kit, W, H, (ctx) => paint(ctx, toC, W, H));
  const topMat = kit.track(new T.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.08 }));
  const sideMat = kit.track(new T.MeshStandardMaterial({ color: cliff, roughness: 0.9 }));
  const mesh = new T.Mesh(geo, [topMat, sideMat]);
  mesh.position.set(center[0], center[1], center[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  kit.add(mesh);
  return {
    mesh,
    at: (x, y) => [center[0] + (x - cx) * scale, center[2] + (y - cy) * scale],
    top: center[1] + height + 0.05,
  };
}

interface Tower {
  setLit(windows: number, roof: number): void;
}

function palaceTower(kit: SetKit, x: number, base: number, z: number, h: number, r: number, roof: 'dome' | 'cone', wallTex: THREE.Texture, winTex: THREE.Texture): Tower {
  const T = kit.THREE;
  const g = new T.Group();
  const body = new T.Mesh(new T.CylinderGeometry(r, r, h, 20), kit.mats.plastic(SANDSTONE));
  body.position.y = h / 2;
  body.castShadow = true;
  const winMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', map: wallTex, emissive: GOLD, emissiveMap: winTex, emissiveIntensity: 0.05, roughness: 0.6 }));
  const band = new T.Mesh(new T.CylinderGeometry(r * 1.012, r * 1.012, h * 0.62, 20, 1, true), winMat);
  band.position.y = h * 0.52;
  const ring = new T.Mesh(new T.TorusGeometry(r * 0.98, 0.035, 8, 28), kit.mats.brass());
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h;
  const isDome = roof === 'dome';
  const roofMat = kit.track(new T.MeshPhysicalMaterial({ color: isDome ? '#E8B04A' : CORAL, metalness: isDome ? 0.7 : 0.1, roughness: 0.3, clearcoat: 1, emissive: isDome ? GOLD : CORAL, emissiveIntensity: 0.02 }));
  const top = isDome
    ? new T.Mesh(new T.SphereGeometry(r * 1.04, 22, 12, 0, TAU, 0, Math.PI / 2), roofMat)
    : new T.Mesh(new T.ConeGeometry(r * 1.15, r * 1.7, 20), roofMat);
  top.position.y = isDome ? h : h + r * 0.85;
  const spire = new T.Mesh(new T.ConeGeometry(0.035, 0.42, 8), kit.mats.brass());
  spire.position.y = isDome ? h + r * 1.04 + 0.18 : h + r * 1.7 + 0.12;
  g.add(body, band, ring, top, spire);
  g.position.set(x, base, z);
  kit.add(g);
  return {
    setLit(w, rf) {
      winMat.emissiveIntensity = 0.05 + w * 2.6;
      roofMat.emissiveIntensity = 0.02 + rf * 0.9;
    },
  };
}

/** Mesosaurus skeleton (instanced bones) on a stone slab; returns a lit handle. */
function fossilSlab(kit: SetKit, x: number, y: number, z: number, rotY: number): { setLit(v: number): void } {
  const T = kit.THREE;
  const g = new T.Group();
  const slab = new T.Mesh(new T.BoxGeometry(1.0, 0.07, 0.42), kit.mats.plastic('#4b4038'));
  slab.position.y = 0.035;
  g.add(slab);
  const boneMat = kit.track(new T.MeshStandardMaterial({ color: '#EFE6D2', emissive: CORAL, emissiveIntensity: 0.04, roughness: 0.5 }));
  const bones: [number, number, number, number, number][] = [];
  bones.push([0.36, 0, 0.055, 0.03, 0.03], [0.44, 0, 0.06, 0.018, 0.018]);
  for (let i = 0; i < 16; i++) {
    const u = i / 15;
    bones.push([0.28 - u * 0.68, Math.sin(u * 3.2) * 0.04, 0.024 - u * 0.012, 0.022 - u * 0.011, 0.022 - u * 0.011]);
  }
  for (const [lx, side] of [[0.16, 1], [0.16, -1], [-0.1, 1], [-0.1, -1]] as [number, number][]) bones.push([lx, side * 0.08, 0.045, 0.012, 0.02]);
  const im = new T.InstancedMesh(new T.SphereGeometry(1, 10, 8), boneMat, bones.length);
  const m = new T.Matrix4();
  const q = new T.Quaternion();
  const s = new T.Vector3();
  const p = new T.Vector3();
  bones.forEach(([bx, bz, sx, sy, sz], i) => {
    p.set(bx, 0.09, bz);
    s.set(sx, sy, sz);
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
  });
  g.add(im);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  g.scale.setScalar(1.35);
  kit.add(g);
  return { setLit: (v) => (boneMat.emissiveIntensity = 0.04 + v * 1.4) };
}

/** A small Glossopteris plant: tongue-shaped leaves on a stem. */
function glossopteris(kit: SetKit, x: number, y: number, z: number): { setLit(v: number): void } {
  const T = kit.THREE;
  const g = new T.Group();
  const stem = new T.Mesh(new T.CylinderGeometry(0.025, 0.035, 0.42, 8), kit.mats.plastic('#5b4030'));
  stem.position.y = 0.21;
  g.add(stem);
  const leafMat = kit.track(new T.MeshStandardMaterial({ color: '#3f8a4a', emissive: MINT, emissiveIntensity: 0.03, roughness: 0.55 }));
  const n = 6;
  const im = new T.InstancedMesh(new T.SphereGeometry(1, 12, 8), leafMat, n);
  const o = new T.Object3D();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    o.position.set(Math.cos(a) * 0.12, 0.4, Math.sin(a) * 0.12);
    o.rotation.set(0, -a, 0);
    o.rotateZ(-0.65);
    o.scale.set(0.16, 0.012, 0.055);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  g.add(im);
  g.position.set(x, y, z);
  kit.add(g);
  return { setLit: (v) => (leafMat.emissiveIntensity = 0.03 + v * 0.9) };
}

const palaceSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  const GY = kit.regions.groundY;
  kit.sky('#12355F', '#02060D');

  // ---- Seafloor map under a shallow sea: age stripes symmetric about the ridge beneath the
  //      cabinet (the playfield is the young middle of the Atlantic).
  const SEA_EDGES = [0.9, 1.9, 2.9, 4.3, 5.6, 7.0, 8.6, 30];
  const floorTex = canvasTex(kit, 1024, 512, (ctx, w, h) => {
    const strips = 8;
    for (let j = 0; j < strips; j++) {
      const off = [0.2, -0.15, 0.1, 0, 0, -0.1, 0.25, -0.2][j];
      for (let px = 0; px < w; px++) {
        const X = -15 + (px / w) * 30 - off;
        const d = Math.abs(X);
        let k = SEA_EDGES.findIndex((e) => d < e);
        if (k < 0) k = AGE.length - 1;
        ctx.fillStyle = AGE[k];
        ctx.fillRect(px, (j * h) / strips, 1, h / strips + 1);
      }
    }
    const r = rng(5);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let j = 1; j < strips; j++) {
      ctx.beginPath();
      ctx.moveTo(0, (j * h) / strips);
      ctx.lineTo(w, (j * h) / strips);
      ctx.stroke();
    }
  });
  const floorMat = kit.track(new T.MeshStandardMaterial({ color: '#3d4b60', map: floorTex, emissive: '#ffffff', emissiveMap: floorTex, emissiveIntensity: 0.05, roughness: 0.95 }));
  const floor = new T.Mesh(new T.PlaneGeometry(30, 24), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, GY, -2);
  floor.receiveShadow = true;
  kit.add(floor);
  // Ridge seam continuing in front of and behind the cabinet.
  const seamMat = kit.track(new T.MeshBasicMaterial({ color: '#FF5A3C', transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false }));
  for (const [z, len] of [[9.5, 7], [-11, 9]] as [number, number][]) {
    const seam = new T.Mesh(new T.PlaneGeometry(0.22, len), seamMat);
    seam.rotation.x = -Math.PI / 2;
    seam.position.set(0, GY + 0.02, z);
    kit.add(seam);
  }
  // New seafloor: glowing bands born beside the ridge creep outward on both sides (mission 2+).
  const bandMat = kit.track(new T.MeshBasicMaterial({ color: '#FF9A5A', transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  const bands: THREE.Mesh[] = [];
  const bandGeo = new T.PlaneGeometry(0.16, 22);
  bandGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const band = new T.Mesh(bandGeo, bandMat.clone());
    kit.track(band.material as THREE.Material);
    band.position.set(0, GY + 0.03, -2);
    kit.add(band);
    bands.push(band);
  }
  kit.track(bandGeo);
  let bandLit = 0;
  const placeBands = (t: number) => {
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const u = (t * 0.035 + (i >> 1) * 0.5) % 1;
      band.position.x = (i % 2 ? 1 : -1) * (3.5 + u * 6.5);
      (band.material as THREE.MeshBasicMaterial).opacity = bandLit * 0.55 * Math.sin(u * Math.PI);
    }
  };
  placeBands(0);
  kit.animate((t) => placeBands(t));
  // Sea surface: gentle swell (vertex waves), translucent so the seafloor glows through.
  const waterGeo = new T.PlaneGeometry(30, 24, 36, 28);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = kit.track(new T.MeshPhysicalMaterial({ color: '#1F6A9A', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.46, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false }));
  const water = new T.Mesh(waterGeo, waterMat);
  water.position.set(0, GY + 0.17, -2);
  water.renderOrder = 1;
  kit.add(water);
  const wpos = waterGeo.attributes.position as THREE.BufferAttribute;
  const wnrm = waterGeo.attributes.normal as THREE.BufferAttribute;
  const wbase = Float32Array.from(wpos.array as Float32Array);
  kit.animate((t) => {
    // Height field y = f(x, z); its normals are written analytically (no per-frame allocation).
    for (let i = 0; i < wpos.count; i++) {
      const ax = wbase[i * 3] * 1.1 + t * 1.1;
      const az = wbase[i * 3 + 2] * 1.4 + t * 0.8;
      wpos.setY(i, Math.sin(ax) * 0.025 + Math.cos(az) * 0.02);
      const nx = -0.0275 * Math.cos(ax);
      const nz = 0.028 * Math.sin(az);
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      wnrm.setXYZ(i, nx * inv, inv, nz * inv);
    }
    wpos.needsUpdate = true;
    wnrm.needsUpdate = true;
  });

  // ---- Continent platforms (the palace stands on them). They breathe very slowly: plates creep.
  const sa = continent(kit, SOUTH_AMERICA, 0.024, 0.6, [-6.0, GY, -0.9], (ctx, toC, w, h) => {
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#2E7A45'], [0.5, '#4F9652'], [0.82, '#B49A5C'], [1, '#C9A867']]);
    ctx.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(20,50,20,0.18)' : 'rgba(255,240,200,0.10)';
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 1 + r() * 4, 0, TAU);
      ctx.fill();
    }
    // Andes highlands along the west coast.
    ctx.strokeStyle = 'rgba(120,90,60,0.85)';
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const a = toC(98, 452);
    const b2 = toC(112, 560);
    const c2 = toC(126, 612);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(b2[0], b2[1], c2[0], c2[1]);
    ctx.stroke();
    // Amazon river.
    ctx.strokeStyle = 'rgba(110,190,235,0.9)';
    ctx.lineWidth = 6;
    const r0 = toC(104, 466);
    const r1 = toC(150, 470);
    const r2 = toC(186, 444);
    ctx.beginPath();
    ctx.moveTo(r0[0], r0[1]);
    ctx.quadraticCurveTo(r1[0], r1[1], r2[0], r2[1]);
    ctx.stroke();
  }, '#6b5a43');
  const af = continent(kit, AFRICA, 0.023, 0.6, [6.0, GY, -1.0], (ctx, toC, w, h) => {
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#E2BE76'], [0.36, '#D0AF69'], [0.56, '#4C8E4E'], [0.8, '#8EA25A'], [1, '#BFA463']]);
    ctx.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(60,40,10,0.14)' : 'rgba(255,250,220,0.12)';
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 1 + r() * 4, 0, TAU);
      ctx.fill();
    }
    // Nile and the East African Rift (a young divergent boundary).
    ctx.strokeStyle = 'rgba(110,190,235,0.9)';
    ctx.lineWidth = 6;
    const n0 = toC(458, 500);
    const n1 = toC(476, 450);
    const n2 = toC(468, 398);
    ctx.beginPath();
    ctx.moveTo(n0[0], n0[1]);
    ctx.quadraticCurveTo(n1[0], n1[1], n2[0], n2[1]);
    ctx.stroke();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,100,70,0.85)';
    ctx.lineWidth = 7;
    const f0 = toC(488, 418);
    const f1 = toC(462, 522);
    ctx.beginPath();
    ctx.moveTo(f0[0], f0[1]);
    ctx.lineTo(f1[0], f1[1]);
    ctx.stroke();
  }, '#7a6244');
  const saBaseX = sa.mesh.position.x;
  const afBaseX = af.mesh.position.x;
  // Golden coastlines: the matching edges glow as the clues line up, and blaze at Wonderlight.
  const coastRim = (plat: Platform, pts: Pt[]) => {
    const tube = kit.neonTube(pts.map(([x, y]) => {
      const [X, Z] = plat.at(x, y);
      return [X, plat.top - 0.03, Z] as [number, number, number];
    }), GOLD, { radius: 0.03, closed: true });
    // Ride along with the slowly creeping platform.
    tube.position.copy(plat.mesh.position).multiplyScalar(-1);
    plat.mesh.add(tube);
    return tube;
  };
  const rims = [coastRim(sa, SOUTH_AMERICA), coastRim(af, AFRICA)];

  // ---- South America: Andes, a volcano fed by the plate sinking at the trench offshore.
  const andesN = kit.n(9);
  const andes = new T.InstancedMesh(new T.ConeGeometry(0.2, 0.55, 7), kit.mats.plastic('#7a5d45'), andesN);
  const snow = new T.InstancedMesh(new T.ConeGeometry(0.082, 0.2, 7), kit.mats.plastic('#f6f4ee'), andesN);
  const o3 = new T.Object3D();
  for (let i = 0; i < andesN; i++) {
    const u = andesN === 1 ? 0.5 : i / (andesN - 1);
    const [X, Z] = sa.at(98 + u * 26 + Math.sin(i * 2.1) * 3, 446 + u * 160);
    const sc = 0.8 + ((i * 37) % 10) / 18;
    o3.position.set(X, sa.top + 0.275 * sc, Z);
    o3.scale.setScalar(sc);
    o3.rotation.y = i;
    o3.updateMatrix();
    andes.setMatrixAt(i, o3.matrix);
    o3.position.y = sa.top + 0.45 * sc;
    o3.updateMatrix();
    snow.setMatrixAt(i, o3.matrix);
  }
  andes.castShadow = true;
  kit.add(andes);
  kit.add(snow);
  const [vX, vZ] = sa.at(112, 532);
  const volcanoMesh = new T.Mesh(new T.CylinderGeometry(0.13, 0.55, 0.95, 16), kit.mats.plastic('#5a4030'));
  volcanoMesh.position.set(vX, sa.top + 0.47, vZ);
  volcanoMesh.castShadow = true;
  kit.add(volcanoMesh);
  const lavaMat = kit.track(new T.MeshStandardMaterial({ color: '#2a0a04', emissive: LAVA, emissiveIntensity: 0.15 }));
  const crater = new T.Mesh(new T.CircleGeometry(0.12, 20), lavaMat);
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(vX, sa.top + 0.95, vZ);
  kit.add(crater);
  // Lava dome in the crater and glowing rivulets down the flanks (they wake with mission 3).
  const dome = new T.Mesh(new T.SphereGeometry(0.115, 16, 10, 0, TAU, 0, Math.PI / 2), lavaMat);
  dome.position.set(vX, sa.top + 0.93, vZ);
  kit.add(dome);
  const rivulets: (THREE.Mesh & { setLit(v: number): void })[] = [];
  for (const [a, wig] of [[0.5, 0.18], [1.75, -0.22], [2.9, 0.15]] as [number, number][]) {
    const pts: [number, number, number][] = [];
    for (const h of [0.93, 0.78, 0.6, 0.42, 0.24, 0.08]) {
      const rr = 0.13 + 0.42 * (1 - h / 0.95) + 0.012;
      const ang = a + wig * (1 - h);
      pts.push([vX + Math.cos(ang) * rr, sa.top + h, vZ + Math.sin(ang) * rr]);
    }
    rivulets.push(kit.neonTube(pts, LAVA, { radius: 0.026 }));
  }
  const embers = kit.motes({ x0: vX - 0.3, x1: vX + 0.3, y0: sa.top + 1.0, y1: sa.top + 2.6, z0: vZ - 0.3, z1: vZ + 0.3 }, 40, '#FFB35C', { speed: 0.4, size: 0.14 });
  // Trench offshore: the deep groove where the oceanic plate sinks.
  const trenchMat = kit.track(new T.MeshStandardMaterial({ color: '#02070f', emissive: CORAL, emissiveIntensity: 0.0, roughness: 1 }));
  const trench = new T.Mesh(new T.PlaneGeometry(0.34, 5.4), trenchMat);
  trench.rotation.x = -Math.PI / 2;
  trench.rotation.z = -0.08;
  const [trX, trZ] = sa.at(70, 520);
  trench.position.set(trX, GY + 0.012, trZ);
  kit.add(trench);
  // Fossil evidence on both continents: the same small shallow-water reptile and the same plant.
  const [sfX, sfZ] = sa.at(150, 556);
  const saFossil = fossilSlab(kit, sfX, sa.top, sfZ, 0.5);
  const [afX, afZ] = af.at(424, 566);
  const afFossil = fossilSlab(kit, afX, af.top, afZ, -0.5);
  const [sgX, sgZ] = sa.at(166, 470);
  const saPlant = glossopteris(kit, sgX, sa.top, sgZ);
  const [agX, agZ] = af.at(430, 512);
  const afPlant = glossopteris(kit, agX, af.top, agZ);

  // Rainforest canopy (Amazon, Congo) as instanced leafy clumps.
  const canopyMat = kit.mats.plastic('#2f6b3a');
  const avoid: Pt[] = [[130, 420], [178, 446], [166, 470], [150, 556], [112, 532], [446, 404], [398, 432], [430, 512], [424, 566]];
  const canopy = (plat: Platform, box: [number, number, number, number], count: number, seed: number) => {
    const r = rng(seed);
    const pts: Pt[] = [];
    for (let tries = 0; tries < count * 12 && pts.length < count; tries++) {
      const x = box[0] + r() * (box[2] - box[0]);
      const y = box[1] + r() * (box[3] - box[1]);
      if (avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < 15)) continue;
      if (pts.some(([px, py]) => Math.hypot(px - x, py - y) < 8)) continue;
      pts.push([x, y]);
    }
    const im = new T.InstancedMesh(new T.IcosahedronGeometry(0.13, 0), canopyMat, pts.length);
    const o = new T.Object3D();
    pts.forEach(([x, y], i) => {
      const [X, Z] = plat.at(x, y);
      const sc = 0.7 + r() * 0.7;
      o.position.set(X, plat.top + 0.08 * sc, Z);
      o.scale.set(sc, sc * 0.75, sc);
      o.rotation.set(r() * 3, r() * 3, 0);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = true;
    kit.add(im);
  };
  canopy(sa, [120, 440, 196, 512], kit.n(26), 41);
  canopy(af, [404, 474, 470, 540], kit.n(18), 43);
  const mesoSigns = [
    kit.neonSign('MESOSAURUS', [sfX, sa.top + 0.66, sfZ + 0.1], { height: 0.24, color: CORAL, backing: false, rotY: 0.2 }),
    kit.neonSign('MESOSAURUS', [afX, af.top + 0.66, afZ + 0.1], { height: 0.24, color: CORAL, backing: false, rotY: -0.2 }),
  ];
  for (const m of mesoSigns) m.rotation.x = -0.6;

  // ---- The palace: towers on both continents, walls between them.
  const arches = (ctx: CanvasRenderingContext2D, bg: string, fg: string, w: number, h: number) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 8; i++) {
        const x = 8 + i * 32;
        const y = 10 + row * 40;
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(x, y + 26);
        ctx.lineTo(x, y + 8);
        ctx.arc(x + 8, y + 8, 8, Math.PI, 0);
        ctx.lineTo(x + 16, y + 26);
        ctx.closePath();
        ctx.fill();
      }
    }
  };
  const wallTex = canvasTex(kit, 256, 128, (ctx, w, h) => arches(ctx, SANDSTONE, '#3a2a1c', w, h));
  const winTex = canvasTex(kit, 256, 128, (ctx, w, h) => arches(ctx, '#000000', '#ffe2a0', w, h));
  const towers: Tower[] = [];
  const [t1x, t1z] = sa.at(130, 420);
  towers.push(palaceTower(kit, t1x, sa.top, t1z, 2.3, 0.36, 'dome', wallTex, winTex));
  const [t2x, t2z] = sa.at(178, 446);
  towers.push(palaceTower(kit, t2x, sa.top, t2z, 1.5, 0.26, 'cone', wallTex, winTex));
  const [t3x, t3z] = af.at(446, 404);
  towers.push(palaceTower(kit, t3x, af.top, t3z, 2.3, 0.36, 'dome', wallTex, winTex));
  const [t4x, t4z] = af.at(398, 432);
  towers.push(palaceTower(kit, t4x, af.top, t4z, 1.5, 0.26, 'cone', wallTex, winTex));
  for (const [ax, az, bx, bz, top] of [[t1x, t1z, t2x, t2z, sa.top], [t3x, t3z, t4x, t4z, af.top]] as [number, number, number, number, number][]) {
    const len = Math.hypot(bx - ax, bz - az);
    const wall = new T.Mesh(new T.BoxGeometry(len, 0.5, 0.14), kit.mats.plastic('#d9c296'));
    wall.position.set((ax + bx) / 2, top + 0.25, (az + bz) / 2);
    wall.rotation.y = -Math.atan2(bz - az, bx - ax);
    wall.castShadow = true;
    kit.add(wall);
  }

  // ---- Left front: a slice of Earth showing the rigid lithosphere riding on hot, mostly solid mantle.
  const sliceX = -5.45;
  const sliceZ = 3.25;
  const mantleTex = canvasTex(kit, 512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#E07A3A');
    g.addColorStop(1, '#8A2E18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = r() < 0.55 ? 'rgba(60,16,6,0.35)' : 'rgba(255,210,140,0.25)';
      const s = 1 + r() * 5;
      ctx.fillRect(r() * w, r() * h, s, s * (0.5 + r()));
    }
  });
  const mantleMat = kit.track(new T.MeshStandardMaterial({ map: mantleTex, emissive: '#ffffff', emissiveMap: mantleTex, emissiveIntensity: 0.12, roughness: 0.85 }));
  const mantle = new T.Mesh(new T.BoxGeometry(1.8, 0.85, 0.7), mantleMat);
  mantle.position.set(sliceX, GY + 0.425, sliceZ);
  // One rigid slab = crust (green band) + the cool, stiff top of the mantle (brown band). Its cut
  // face carries one LITHOSPHERE label spanning both bands, so the label never implies that the
  // lithosphere is a layer separate from the crust.
  const lithoTex = canvasTex(kit, 1024, 256, (ctx, w, h) => {
    const crustH = Math.round(h * 0.27);
    ctx.fillStyle = '#6f9a55';
    ctx.fillRect(0, 0, w, crustH);
    ctx.fillStyle = '#5d4c40';
    ctx.fillRect(0, crustH, w, h - crustH);
    const r = rng(13);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,240,210,0.08)';
      ctx.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, crustH - 2, w, 4);
    ctx.font = '800 150px "Fraunces Variable", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(24,14,8,0.9)';
    ctx.strokeText('LITHOSPHERE', w / 2, h * 0.54, w * 0.94);
    ctx.fillStyle = IVORY;
    ctx.fillText('LITHOSPHERE', w / 2, h * 0.54, w * 0.94);
  });
  const lithoMat = kit.track(new T.MeshStandardMaterial({ map: lithoTex, emissive: '#ffffff', emissiveMap: lithoTex, emissiveIntensity: 0.1, roughness: 0.85 }));
  const lithoSide = kit.mats.plastic('#5d4c40');
  const litho = new T.Mesh(new T.BoxGeometry(1.8, 0.45, 0.7), [lithoSide, lithoSide, kit.mats.plastic('#6f9a55'), lithoSide, lithoMat, lithoSide]);
  litho.position.set(sliceX, GY + 0.85 + 0.225, sliceZ);
  for (const m of [mantle, litho]) {
    m.castShadow = true;
    kit.add(m);
  }
  // Slow convection loops drawn on the cut face; a bead creeps around each loop.
  const loops: THREE.Vector3[][] = [];
  const beads: THREE.Mesh[] = [];
  const beadMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: '#FFE0A0', emissiveIntensity: 0.4 }));
  const tubes: { setLit(v: number): void }[] = [];
  for (const [ox, dir] of [[-0.42, 1], [0.42, -1]] as [number, number][]) {
    const pts: [number, number, number][] = [];
    const vecs: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU * dir;
      const p: [number, number, number] = [sliceX + ox + Math.cos(a) * 0.36, GY + 0.47 + Math.sin(a) * 0.28, sliceZ + 0.36];
      pts.push(p);
      vecs.push(new T.Vector3(p[0], p[1], p[2]));
    }
    loops.push(vecs);
    tubes.push(kit.neonTube(pts, '#FFD08A', { radius: 0.014, closed: true }));
    const bead = new T.Mesh(new T.SphereGeometry(0.045, 12, 8), beadMat);
    bead.position.copy(vecs[0]);
    kit.add(bead);
    beads.push(bead);
  }
  kit.animate((t) => {
    for (let k = 0; k < loops.length; k++) {
      const pts = loops[k];
      const f = ((t * 0.06 + k * 0.5) % 1) * pts.length;
      const i = Math.floor(f);
      beads[k].position.lerpVectors(pts[i], pts[(i + 1) % pts.length], f - i);
    }
  });
  const mantlePanel = kit.panel('MANTLE: HOT, MOSTLY SOLID ROCK', [sliceX, GY + 0.16, sliceZ + 0.62], { w: 1.9, h: 0.26, bg: '#2a1c18', fg: '#FFC08A' });
  mantlePanel.rotation.x = -0.5;

  // ---- Seismograph: its pen swings when the quake belt wakes.
  const seis = new T.Group();
  const seisBase = new T.Mesh(new T.BoxGeometry(0.9, 0.35, 0.5), kit.mats.wood());
  seisBase.position.y = 0.175;
  const drumTex = canvasTex(kit, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a3550';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const quake = x > 180 && x < 320 ? Math.sin((x - 180) * 0.35) * 40 * Math.sin(((x - 180) / 140) * Math.PI) : 0;
      const y = h / 2 + quake + Math.sin(x * 0.7) * 2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
  drumTex.wrapS = T.RepeatWrapping;
  const drumMat = kit.track(new T.MeshStandardMaterial({ map: drumTex, emissive: '#ffffff', emissiveMap: drumTex, emissiveIntensity: 0.05, roughness: 0.6 }));
  const drum = new T.Mesh(new T.CylinderGeometry(0.17, 0.17, 0.7, 24), drumMat);
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 0.55;
  const pen = new T.Mesh(new T.BoxGeometry(0.03, 0.03, 0.42), kit.mats.brass());
  pen.position.set(0, 0.62, 0.3);
  const post = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 1.0, 10), kit.mats.brass());
  post.position.set(0.36, 0.85, -0.16);
  const arm = new T.Mesh(new T.BoxGeometry(0.62, 0.03, 0.03), kit.mats.brass());
  arm.position.set(0.06, 1.33, -0.16);
  const bob = new T.Group();
  bob.position.set(-0.22, 1.33, -0.16);
  const wire = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.42, 4), kit.mats.dark());
  wire.position.y = -0.21;
  const mass = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), kit.mats.brass());
  mass.position.y = -0.46;
  bob.add(wire, mass);
  seis.add(seisBase, drum, pen, post, arm, bob);
  seis.position.set(-4.65, GY, 1.75);
  seis.rotation.y = 0.35;
  kit.add(seis);
  const seisSign = kit.neonSign('SEISMOGRAPH', [-4.6, GY + 1.75, 1.6], { height: 0.21, color: MINT, rotY: 0.35, backing: false });
  seisSign.rotation.x = -0.6;
  let quakeT = 0;

  // ---- Right front: the drill ship that tested seafloor spreading, with its colour-coded cores.
  const ship = new T.Group();
  const hullShape = new T.Shape();
  hullShape.moveTo(-0.85, -0.22);
  hullShape.lineTo(0.55, -0.22);
  hullShape.quadraticCurveTo(0.95, -0.12, 1.05, 0);
  hullShape.quadraticCurveTo(0.95, 0.12, 0.55, 0.22);
  hullShape.lineTo(-0.85, 0.22);
  hullShape.closePath();
  const hullGeo = new T.ExtrudeGeometry(hullShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  hullGeo.rotateX(-Math.PI / 2);
  const hull = new T.Mesh(hullGeo, kit.mats.plastic('#E9EEF2'));
  hull.castShadow = true;
  const stripe = new T.Mesh(new T.BoxGeometry(1.7, 0.05, 0.47), kit.mats.plastic('#C8463C'));
  stripe.position.set(0.05, 0.02, 0);
  const cabinMat = kit.track(new T.MeshStandardMaterial({ color: '#f2f2f2', emissive: '#bfe9ff', emissiveIntensity: 0.05, roughness: 0.4 }));
  const cabin = new T.Mesh(new T.BoxGeometry(0.34, 0.3, 0.36), cabinMat);
  cabin.position.set(-0.62, 0.37, 0);
  const derrickMat = kit.track(new T.MeshStandardMaterial({ color: '#d8c49a', emissive: GOLD, emissiveIntensity: 0.05, wireframe: true }));
  const derrick = new T.Mesh(new T.CylinderGeometry(0.04, 0.22, 1.35, 4, 6, true), derrickMat);
  derrick.position.set(0.1, 0.9, 0);
  const pipe = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 1.2, 6), kit.mats.chrome());
  pipe.position.set(0.1, 0.05, 0);
  const beaconMat = kit.track(new T.MeshStandardMaterial({ color: '#200808', emissive: '#FF5A4A', emissiveIntensity: 0.1 }));
  const beacon = new T.Mesh(new T.SphereGeometry(0.05, 12, 8), beaconMat);
  beacon.position.set(0.1, 1.62, 0);
  ship.add(hull, stripe, cabin, derrick, pipe, beacon);
  const cores: THREE.MeshStandardMaterial[] = [];
  [4, 2, 0, 2, 4].forEach((band, i) => {
    const mat = kit.track(new T.MeshStandardMaterial({ color: AGE[band], emissive: AGE[band], emissiveIntensity: 0.05, roughness: 0.5 }));
    const core = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.3, 10), mat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0.18 + i * 0.1, 0.3, 0);
    ship.add(core);
    cores.push(mat);
  });
  ship.position.set(5.55, GY + 0.1, 3.05);
  ship.rotation.y = 0.35;
  kit.add(ship);
  // Floating on the water just in front of the ship, clear of Africa's cliff.
  const shipSign = kit.neonSign('DRILL SHIP', [5.55, GY + 0.5, 4.15], { height: 0.26, color: GOLD, rotY: -0.3, backing: false });
  shipSign.rotation.x = -0.6;
  kit.animate((t) => {
    ship.position.y = GY + 0.1 + Math.sin(t * 0.9) * 0.025;
    ship.rotation.z = Math.sin(t * 0.7) * 0.02;
  });

  // ---- Marquee signs above the palace towers, tilted back toward the player.
  const left = kit.neonSign('PANGAEA', [-1.55, 0.42, -6.62], { height: 0.38, color: GOLD });
  left.rotation.x = -1.15;
  const right = kit.neonSign('PUZZLE PALACE', [1.85, 0.44, -6.62], { height: 0.44, color: CORAL });
  right.rotation.x = -1.15;
  // Lanterns along the palace promenade.
  const lanternSpots: [number, number][] = [[-4.25, -3.4], [-4.25, -0.6], [-4.25, 2.0], [4.25, -3.4], [4.25, -0.6], [4.25, 2.0]];
  const lanterns = lanternSpots.map(([x, z]) => {
    kit.pole([x, 0, z], 0.32);
    return kit.lantern([x, 0.55, z], GOLD, 0.16);
  });
  // Wonderlight bridge: a golden arch joining the two halves of the palace behind the head.
  const bridge = kit.neonTube([
    [t1x, sa.top + 2.6, t1z], [-5.2, 4.4, -6.7], [0, 5.2, -7.6], [5.2, 4.4, -6.7], [t3x, af.top + 2.6, t3z],
  ], GOLD, { radius: 0.05 });

  const glints = kit.motes({ x0: -10, x1: 10, y0: GY + 0.2, y1: GY + 0.9, z0: -8, z1: 6 }, 90, MINT, { speed: 0.04, size: 0.07 });
  const gold = kit.motes({ x0: -9, x1: 9, y0: 0.5, y1: 6, z0: -9, z1: 5 }, 110, GOLD, { speed: 0.12, size: 0.09 });
  const fwL = kit.fireworks({ x0: -8.0, x1: -5.0, y0: 2.4, y1: 3.2, z: -2.6 }, [GOLD, CORAL, MINT, IVORY]);
  const fwR = kit.fireworks({ x0: 5.0, x1: 8.0, y0: 2.4, y1: 3.2, z: -2.6 }, [GOLD, MINT, CORAL, '#9fb4ff']);
  kit.spot([-3.6, 6.5, 3.5], [-6.3, 0, -0.8], '#FFD9A0', 28, 0.55);
  kit.spot([3.6, 6.5, 3.5], [6.3, 0, -0.5], '#A8E8FF', 26, 0.55);
  const magmaLight = kit.point([vX, sa.top + 1.3, vZ], MAGMA, 0, 4.5);

  kit.animate((t) => {
    // Plates creep: the continent platforms drift a hair and settle, far too slowly to notice.
    sa.mesh.position.x = saBaseX + Math.sin(t * 0.07) * 0.02;
    af.mesh.position.x = afBaseX - Math.sin(t * 0.07) * 0.02;
  });

  let celebrateBoost = 0;
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.2, 1);
      const s2 = kit.stage(level, 1.2, 2);
      const s3 = kit.stage(level, 2.2, 3);
      const s4 = kit.stage(level, 3.3, 4);
      // Under reduced motion every glow pulse settles to a calm, steady level.
      const w = kit.reducedMotion ? 0 : 1;
      const boost = celebrateBoost;
      celebrateBoost = Math.max(0, celebrateBoost - dt * 1.5);
      // Mission 1: the fossil clues glow on both shores. Labels stay readable while dormant.
      const clue = 0.1 + 0.9 * s1;
      saFossil.setLit(clue + boost);
      afFossil.setLit(clue + boost);
      saPlant.setLit(clue);
      afPlant.setLit(clue);
      const meso = 0.35 + 0.65 * s1;
      for (let i = 0; i < mesoSigns.length; i++) mesoSigns[i].setLit(meso);
      left.setLit(0.4 + 0.6 * Math.max(s0 * 0.3, s1));
      // Mission 2: the seafloor stripes and the drill ship light up.
      floorMat.emissiveIntensity = 0.04 + 0.17 * s2 + 0.05 * s4 + 0.04 * energy;
      seamMat.opacity = 0.15 + 0.6 * s2;
      bandLit = s2;
      if (kit.reducedMotion) placeBands(0);
      const rim = 0.06 + 0.3 * s1 + 0.3 * s4 * (0.85 + 0.15 * w * Math.sin(t * 2.2)) + boost * 0.4;
      for (let i = 0; i < rims.length; i++) rims[i].setLit(rim);
      for (let i = 0; i < cores.length; i++) cores[i].emissiveIntensity = 0.05 + (1.4 + 0.4 * w * Math.sin(t * 2 + i)) * s2;
      derrickMat.emissiveIntensity = 0.05 + 1.2 * s2;
      cabinMat.emissiveIntensity = 0.05 + 0.6 * s2;
      beaconMat.emissiveIntensity = 0.1 + 3 * s2 * (0.5 + 0.5 * w * Math.sin(t * 3));
      shipSign.setLit(0.35 + 0.65 * s2);
      right.setLit(0.4 + 0.6 * Math.max(s0 * 0.3, s2));
      // Mission 3: the boundaries wake: volcano, trench, mantle loops, seismograph.
      lavaMat.emissiveIntensity = 0.15 + 2.4 * s3 * (0.8 + 0.2 * w * Math.sin(t * 5)) + boost * 2;
      if (magmaLight) magmaLight.intensity = 0.2 + 5 * s3 + boost * 6;
      embers.setLit(0.05 + 0.9 * s3);
      for (let i = 0; i < rivulets.length; i++) rivulets[i].setLit(0.03 + 0.62 * s3 * (0.75 + 0.25 * w * Math.sin(t * 3 + i * 2)) + boost * 0.3);
      trenchMat.emissiveIntensity = 0.25 * s3;
      mantleMat.emissiveIntensity = 0.12 + 0.35 * s3;
      for (let i = 0; i < tubes.length; i++) tubes[i].setLit(0.1 + 0.6 * s3);
      beadMat.emissiveIntensity = 0.3 + 2.2 * s3;
      lithoMat.emissiveIntensity = 0.1 + 0.3 * s3;
      drumMat.emissiveIntensity = 0.04 + 0.14 * s3;
      seisSign.setLit(0.35 + 0.65 * s3);
      if (!kit.reducedMotion) {
        quakeT += dt * (0.08 + 0.4 * s3);
        drumTex.offset.x = quakeT;
        pen.rotation.y = Math.sin(t * 23) * 0.12 * (0.2 + energy) * s3;
        bob.rotation.z = Math.sin(t * 1.7) * 0.12 * (0.3 + 0.7 * s3);
      }
      // The palace rebuilds with each mission; the Wonderlight crowns it.
      const built = 0.06 + 0.32 * s1 + 0.3 * s2 + 0.3 * s3;
      for (let i = 0; i < towers.length; i++) towers[i].setLit(Math.min(1, built + 0.4 * s4 * (0.8 + 0.2 * w * Math.sin(t * 2 + i))), s4 + boost * 0.5);
      for (let i = 0; i < lanterns.length; i++) lanterns[i].setLit(Math.max(0.12, kit.stage(level, 0.2 + i * 0.4, 1 + i * 0.4)));
      bridge.setLit(s4);
      glints.setLit(0.25 + 0.5 * s2);
      gold.setLit(s4);
      fwL.setLit(kit.stage(level, 3.6, 4));
      fwR.setLit(kit.stage(level, 3.6, 4));
    },
    celebrate(p) {
      celebrateBoost = Math.sin(p * Math.PI);
      fwL.setLit(celebrateBoost);
      fwR.setLit(celebrateBoost);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const palaceRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  // Seen almost face-on: a seafloor age map on the back wall (youngest at the glowing ridge), South
  // America and Africa standing up like giant puzzle pieces with the same fossils on both, palace
  // towers on both shores, and the floor's cut front edge showing crust, rigid lithosphere and hot,
  // mostly solid mantle. As the room lights, the pieces slide back toward their Pangaea fit.
  const ageTex = canvasTex(kit, 512, 256, (ctx, w, h) => {
    for (let px = 0; px < w; px++) {
      const d = Math.abs(px - w / 2) / (w / 2);
      ctx.fillStyle = AGE[Math.min(AGE.length - 1, Math.floor(d * 7.2))];
      ctx.fillRect(px, 0, 1, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 2);
  });
  const ageMat = kit.track(new T.MeshStandardMaterial({ color: '#4a5a70', map: ageTex, emissive: '#ffffff', emissiveMap: ageTex, emissiveIntensity: 0.05, roughness: 0.7 }));
  const agePanel = new T.Mesh(new T.BoxGeometry(1.84, 0.9, 0.04), ageMat);
  agePanel.position.set(0, 0.76, -0.84);
  kit.add(agePanel);
  const ridgeMat = kit.track(new T.MeshStandardMaterial({ color: '#1a0804', emissive: '#FF5A3C', emissiveIntensity: 0.2 }));
  const ridge = new T.Mesh(new T.BoxGeometry(0.035, 0.9, 0.012), ridgeMat);
  ridge.position.set(0, 0.76, -0.815);
  kit.add(ridge);
  // Ocean-floor plinth whose front face is a cut through crust, lithosphere and mantle.
  const sliceTex = canvasTex(kit, 512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#5E9E5A';
    ctx.fillRect(0, 0, w, h * 0.12);
    ctx.fillStyle = '#5d4c40';
    ctx.fillRect(0, h * 0.12, w, h * 0.3);
    const g = ctx.createLinearGradient(0, h * 0.42, 0, h);
    g.addColorStop(0, '#E07A3A');
    g.addColorStop(1, '#8A2E18');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.42, w, h * 0.58);
    ctx.strokeStyle = 'rgba(255,224,160,0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(64 + i * 128, h * 0.71, 48, h * 0.18, 0, 0, TAU);
      ctx.stroke();
    }
  });
  const sliceMat = kit.track(new T.MeshStandardMaterial({ map: sliceTex, emissive: '#ffffff', emissiveMap: sliceTex, emissiveIntensity: 0.1, roughness: 0.8 }));
  const baseMat = kit.mats.plastic('#1d3f63');
  const base = new T.Mesh(new T.BoxGeometry(1.9, 0.16, 1.4), [baseMat, baseMat, baseMat, baseMat, sliceMat, baseMat]);
  base.position.set(0, 0.08, 0);
  kit.add(base);
  // Continent puzzle pieces standing on edge, leaning back a little toward the wall.
  const S = 0.0033;
  const rimMats: THREE.MeshStandardMaterial[] = [];
  const faceMats: THREE.MeshStandardMaterial[] = [];
  const piece = (pts: Pt[], color: string, marks: [number, number, string, number, number][]) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const hh = ((Math.max(...ys) - Math.min(...ys)) * S) / 2;
    const sh = new T.Shape();
    pts.forEach(([x, y], i) => (i ? sh.lineTo((x - cx) * S, -(y - cy) * S) : sh.moveTo((x - cx) * S, -(y - cy) * S)));
    sh.closePath();
    const g = new T.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 1 });
    const face = kit.track(new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.04, roughness: 0.6 }));
    const rim = kit.track(new T.MeshStandardMaterial({ color: '#8a6a40', emissive: GOLD, emissiveIntensity: 0.03, roughness: 0.5 }));
    const m = new T.Mesh(g, [face, rim]);
    m.rotation.x = -0.16;
    m.position.set(0, 0.17 + hh, -0.3);
    kit.add(m);
    // Matching clue marks painted on the face: the same fossils turn up on both pieces.
    for (const [x, y, c, sx, rot] of marks) {
      const mk = new T.Mesh(new T.CircleGeometry(1, 14), kit.track(new T.MeshBasicMaterial({ color: c })));
      mk.scale.set(sx, sx * 0.32, 1);
      mk.rotation.z = rot;
      mk.position.set((x - cx) * S, -(y - cy) * S, 0.072);
      m.add(mk);
    }
    faceMats.push(face);
    rimMats.push(rim);
    return { mesh: m, home: (cx - RIDGE_X) * S };
  };
  const saP = piece(SOUTH_AMERICA, '#4F9652', [[150, 584, CORAL, 0.07, 0.9], [168, 532, '#9BE6A8', 0.045, -0.6]]);
  const afP = piece(AFRICA, SAND, [[424, 580, CORAL, 0.07, -0.9], [424, 532, '#9BE6A8', 0.045, 0.6]]);
  // Palace towers on both shores with windows that glow as the evidence comes together.
  const towerWin: THREE.MeshStandardMaterial[] = [];
  for (const [x, h] of [[-0.8, 0.62], [0.8, 0.56]] as [number, number][]) {
    const winMat = kit.track(new T.MeshStandardMaterial({ color: SANDSTONE, emissive: GOLD, emissiveIntensity: 0.05 }));
    const tw = new T.Mesh(new T.CylinderGeometry(0.075, 0.085, h, 14), winMat);
    tw.position.set(x, 0.16 + h / 2, -0.18);
    kit.add(tw);
    const dome = new T.Mesh(new T.SphereGeometry(0.09, 14, 8, 0, TAU, 0, Math.PI / 2), kit.mats.brass());
    dome.position.set(x, 0.16 + h, -0.18);
    kit.add(dome);
    towerWin.push(winMat);
  }
  // A volcano on South America's shore, fed by the plate sinking offshore.
  const volc = new T.Mesh(new T.ConeGeometry(0.13, 0.24, 14), kit.mats.plastic('#5a4030'));
  volc.position.set(-0.78, 0.28, 0.28);
  kit.add(volc);
  const lavaMat = kit.track(new T.MeshStandardMaterial({ color: '#2a0a04', emissive: MAGMA, emissiveIntensity: 0.1 }));
  const lava = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), lavaMat);
  lava.position.set(-0.78, 0.4, 0.28);
  kit.add(lava);
  const sign = kit.neonSign('PANGAEA', [0, 1.34, -0.8], { height: 0.2, color: GOLD });
  return {
    update(t, lit) {
      // Apart on today's map when dark; slid back toward the Pangaea fit when lit.
      const pull = 0.27 * lit;
      const drift = kit.reducedMotion ? 0 : Math.sin(t * 0.4) * 0.008;
      saP.mesh.position.x = saP.home + pull + drift;
      afP.mesh.position.x = afP.home - pull - drift;
      ridgeMat.emissiveIntensity = 0.2 + 1.8 * lit;
      ageMat.emissiveIntensity = 0.05 + 0.26 * lit;
      sliceMat.emissiveIntensity = 0.1 + 0.35 * lit;
      for (let i = 0; i < faceMats.length; i++) faceMats[i].emissiveIntensity = 0.04 + 0.2 * lit;
      for (let i = 0; i < rimMats.length; i++) rimMats[i].emissiveIntensity = 0.03 + 1.6 * lit;
      for (let i = 0; i < towerWin.length; i++) towerWin[i].emissiveIntensity = 0.05 + 1.1 * lit;
      lavaMat.emissiveIntensity = 0.1 + 2 * lit * (kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 4));
      sign.setLit(lit);
    },
  };
};

// ---------------------------------------------------------------- table definition

const MESO = ['sa_meso', 'af_meso'];
const GLOSSO = ['sa_glosso', 'af_glosso'];
const FITS = ['sa_fit', 'af_fit'];

export const L16: TableDef = {
  lessonId: 'L16',
  signature: 'Puzzle-piece continents with matching fossil targets across a spreading mid-ocean ridge',
  ballRole: 'The Wonderball is a game token, not a piece of Earth. In the Mantle Portal it plays a quake wave crossing the mantle; real seismic waves are vibrations racing through mostly solid rock.',
  theme: {
    bg: ['#0F3A5F', '#071629'],
    rail: '#E6D2A6',
    railHighlight: '#FFFFFF',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#FF9A6B',
    bumperRing: '#3A2A50',
    flipper: '#FFD98A',
    ink: IVORY,
    ramp: 'rgba(113,227,207,0.16)',
    trail: '#9FE8FF',
  },
  lines: {
    intro: 'Welcome to the Pangaea Puzzle Palace! Its towers stand on continents that once fit together, so gather the clues and watch the palace rebuild itself.',
    quark: '"If continents drift, they must float on an ocean of melted rock, like crackers in soup," Professor Quark wonders aloud.',
    pipTip: "A gentle plunge rolls over the SKILL lane. Then shoot across the ocean: the right flipper finds South America's coast, the left finds Africa's.",
  },
  build,
  skillShot: 'seismo_lane',
  shots: [
    { id: 'andes', label: 'Andes Orbit', on: [{ type: 'shot', id: 'andes_sw' }], insert: 'ins_andes' },
    { id: 'transform', label: 'Transform Lane', on: [{ type: 'shot', id: 'transform_sw' }], insert: 'ins_transform' },
    { id: 'westRidge', label: 'West Spreading Lane', on: [{ type: 'shot', id: 'west_sw' }], insert: 'ins_west' },
    { id: 'eastRidge', label: 'East Spreading Lane', on: [{ type: 'shot', id: 'east_sw' }], insert: 'ins_east' },
    { id: 'ridge', label: 'a Spreading Lane', on: [{ type: 'shot', id: ['west_sw', 'east_sw'] }] },
    { id: 'portal', label: 'Mantle Portal', on: [{ type: 'portal', id: 'mantle_portal' }] },
    { id: 'pocket', label: 'Keystone Pocket', on: [{ type: 'saucer', id: 'keystone' }], insert: 'ins_pocket' },
    { id: 'saCoast', label: 'South America coast', on: [{ type: 'target', group: 'sa' }], insert: 'ins_sa' },
    { id: 'afCoast', label: 'Africa coast', on: [{ type: 'target', group: 'af' }], insert: 'ins_af' },
    { id: 'quakes', label: 'Quake Belt', on: [{ type: 'bumper', group: 'quakes' }], insert: 'ins_quakes' },
    { id: 'drill', label: 'Drill Line', on: [{ type: 'rollover', group: 'drill' }], insert: 'ins_drill' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Clues Across the Ocean',
      brief: 'Match fossil clues on both coasts, fit the coastlines together, then study the evidence in the Keystone Pocket.',
      objectiveIds: ['L16-O1'],
      stages: [
        { kind: 'collect', text: 'Fossil match: hit MESO on both coasts', match: { type: 'target', id: MESO }, count: 2, distinct: true, lamps: MESO, preview: ['saCoast', 'afCoast'] },
        { kind: 'collect', text: 'Plant match: hit GLOSSO on both coasts', match: { type: 'target', id: GLOSSO }, count: 2, distinct: true, lamps: GLOSSO, preview: ['saCoast', 'afCoast'] },
        { kind: 'collect', text: 'Shape match: hit FIT on both coasts', match: { type: 'target', id: FITS }, count: 2, distinct: true, lamps: FITS, preview: ['saCoast', 'afCoast'] },
        { kind: 'discover', text: 'Shoot the Keystone Pocket', pocket: 'keystone', questions: 1 },
      ],
      discovery: 'Matching fossils on both coasts and coastlines that fit point one way: these lands were once joined. One clue is not proof, and Wegener still could not explain what moved them.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Rewind the Atlantic',
      brief: 'Drill seafloor cores across the ridge, spread new seafloor on both sides, then rebuild the map in the Keystone Pocket.',
      objectiveIds: ['L16-O3', 'L16-O4'],
      stages: [
        { kind: 'collect', text: 'Drill all five seafloor sites', match: { type: 'rollover', group: 'drill' }, count: 5, distinct: true, lamps: ['drill_1', 'drill_2', 'drill_3', 'drill_4', 'drill_5'], preview: ['drill'] },
        { kind: 'shots', text: 'Spread new seafloor: both spreading lanes', shots: ['westRidge', 'eastRidge'], order: 'any' },
        { kind: 'discover', text: 'Shoot the Keystone Pocket to rewind the map', pocket: 'keystone', questions: 1, types: ['order', 'match', 'classify'] },
      ],
      discovery: 'Seafloor is youngest at the mid-ocean ridge and older farther away on both sides. New rock forms at the ridge and spreads outward on plates that ride over hot, mostly solid mantle.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Boundary Patrol',
      brief: 'Cross the convergent, divergent and transform gates, shake the quake belt, then sort what happens at each boundary.',
      objectiveIds: ['L16-O5', 'L16-O2'],
      stages: [
        { kind: 'shots', text: 'Cross all three boundary gates', shots: ['andes', 'ridge', 'transform'], order: 'any' },
        { kind: 'collect', text: 'Shake the Quake Belt 6 times', match: { type: 'bumper', group: 'quakes' }, count: 6, preview: ['quakes'] },
        { kind: 'discover', text: 'Shoot the Keystone Pocket to sort the boundaries', pocket: 'keystone', questions: 1, types: ['classify', 'match'] },
      ],
      discovery: 'Where plates move together, trenches, volcanoes or mountains can form. Where they pull apart, new lithosphere forms, as at mid-ocean ridges. Where they slide past, locked edges can slip suddenly in earthquakes.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Restore the Palace',
    brief: 'Cross every boundary, dive through the Mantle Portal, then set the final keystone.',
    stages: [
      { kind: 'shots', text: 'Andes, both spreading lanes, transform, portal', shots: ['andes', 'westRidge', 'eastRidge', 'transform', 'portal'], order: 'any' },
      { kind: 'discover', text: 'Set the final keystone in the pocket', pocket: 'keystone', questions: 2 },
    ],
    celebration: 'Fossils, rocks, quakes and seafloor all tell one story: the plates move. The Pangaea Puzzle Palace stands whole again!',
  },
  set: palaceSet,
  room: palaceRoom,
  icons: {
    quake(ctx, s) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s * 0.14;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const pts = [-0.95, 0, -0.62, 0, -0.46, -0.42, -0.26, 0.62, -0.04, -0.86, 0.18, 0.7, 0.38, -0.4, 0.56, 0.2, 0.68, 0, 0.95, 0];
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        if (i === 0) ctx.moveTo(pts[i] * s, pts[i + 1] * s);
        else ctx.lineTo(pts[i] * s, pts[i + 1] * s);
      }
      ctx.stroke();
    },
    keystone(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.75, -s * 0.6);
      ctx.lineTo(s * 0.75, -s * 0.6);
      ctx.lineTo(s * 0.45, s * 0.7);
      ctx.lineTo(-s * 0.45, s * 0.7);
      ctx.closePath();
      ctx.fill();
    },
  },
  scenery: {
    backdrop: paintBackdrop,
    ambient({ ctx, t, level, reduced }) {
      if (reduced) return;
      const s2 = stage(level, 1.2, 2);
      const s3 = stage(level, 2.2, 3);
      // New seafloor shimmering at the ridge.
      if (s2 > 0.01) {
        for (let i = 0; i < 6; i++) {
          const y = 420 + ((t * 18 + i * 53) % 320);
          glowDot(ctx, ridgeAt(y), y, 7, '#FF7A5A', 0.35 * s2 * (0.5 + 0.5 * Math.sin(t * 2 + i)));
        }
      }
      // Volcano embers on the Andes.
      if (s3 > 0.01) {
        for (let i = 0; i < 5; i++) {
          const ph = (t * 0.6 + i / 5) % 1;
          glowDot(ctx, 112 + Math.sin(i * 2.3 + t) * 5, 514 - ph * 40, 3, '#FFB35C', 0.7 * s3 * (1 - ph));
        }
      }
    },
    celebrate({ ctx, t }, p) {
      const a = Math.sin(p * Math.PI);
      ctx.save();
      ctx.globalAlpha = a * 0.5;
      const g = ctx.createRadialGradient(RIDGE_X, 598, 10, RIDGE_X, 598, 460);
      g.addColorStop(0, rgba(GOLD, 0.85));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // Ripples spreading from the ridge on both sides, like new seafloor.
      for (let k = 0; k < 4; k++) {
        const d = ((p * 1.6 + k / 4) % 1) * 220;
        for (const side of [-1, 1]) {
          ctx.strokeStyle = rgba(AGE[k * 2], (1 - d / 220) * a * 0.8);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(RIDGE_X + side * d, 380);
          ctx.lineTo(RIDGE_X + side * d, 760);
          ctx.stroke();
        }
      }
      for (let i = 0; i < 20; i++) {
        const ang = (i / 20) * TAU + t * 0.4;
        const d = 60 + p * 260;
        glowDot(ctx, RIDGE_X + Math.cos(ang) * d, 598 + Math.sin(ang) * d * 0.8, 9, [GOLD, CORAL, MINT][i % 3], 1 - p);
      }
    },
  },
};
export default L16;
