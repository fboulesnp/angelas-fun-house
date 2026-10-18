// Lesson 12 — Identifying Chemical Reactions — "Reaction Revelry"
// A theatrical laboratory at curtain-up. Two tall glass sample cabinets stand in the wings of a
// wooden stage: BEFORE (the reactants) and AFTER (the products). The signature is the Reaction
// Bridge: every sample the BEFORE cabinet catches is fired up a glass bridge that arches over the
// stage and lands in the AFTER cabinet. Center stage, under the bridge, the REVEAL pocket (the
// Wonder Pocket) is where claims are made. Bubble bumpers churn in a giant printed flask whose neck
// holds the HEAT / COOL / MIX condition lanes, a tilted PHYSICAL bank (boil, melt, dissolve) faces
// four CLUE targets (color, solid, gas, odor), and the left loop runs through the Evidence spinner.
// The lesson's golden rule is printed on the apron: bubbles alone do not prove a reaction.

import * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import type { SceneryContext } from '../game/render/sceneryTypes.ts';
import { ICONS } from '../game/render/icons.ts';
import {
  TAU, drift, glowDot, mix, neonPath, neonText, plaque, rgba, rng, rrect, stage, vgrad,
} from '../game/render/art.ts';

// ---------------------------------------------------------------- palette

const VELVET = '#8a1634';
const VELVET_DK = '#3a0a1c';
const NIGHT = '#140818';
const PLANK = '#7a4428';
const GOLD = '#FFC75B';
const BRASS = '#D9A85B';
const MINT = '#71E3CF';
const AQUA = '#7FD8FF';
const CORAL = '#FF7F86';
const YELLOW = '#FFE14D';
const VIOLET = '#B48CFF';
const IVORY = '#FFF7E7';
const SHOW4 = [CORAL, GOLD, MINT, VIOLET];
const SHOW6 = [CORAL, GOLD, MINT, AQUA, VIOLET, YELLOW];

// ---------------------------------------------------------------- playfield geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'right' });

  // --- Left loop: the EVIDENCE lane, with the Evidence spinner ---
  b.wall([[80, 642], [80, 386]], { id: 'left_loop_inner', r: 3 });
  b.post(80, 382, 5);
  b.spinner('evidence_spinner', [29, 566], [75, 566], { label: 'EVIDENCE' });
  b.shotSwitch('left_loop_sw', 52, 466, -90);
  // One-way gates rather than walls: loop exits are still deflected into play, but upward
  // shots (and the right kickback) pass through them into the loop channels.
  b.gate('left_loop_deflect', [FRAME.left, 652], [58, 702], -90);

  // --- Right loop ---
  b.wall([[496, 404], [496, 640], [474, 684]], { id: 'right_loop_inner', r: 3 });
  b.post(496, 400, 5);
  b.shotSwitch('right_loop_sw', 522, 476, -90);
  b.gate('right_loop_deflect', [FRAME.laneSep, 652], [518, 702], -90);

  // --- Condition lanes at the top of the stage: HEAT / COOL / MIX ---
  const laneXs = [262, 310, 358];
  const laneLabels = ['HEAT', 'COOL', 'MIX'];
  laneXs.forEach((x, i) => b.rollover(`lane_${laneLabels[i].toLowerCase()}`, x, 120, { group: 'conditions', label: laneLabels[i] }));
  for (const gx of [238, 286, 334, 382]) {
    b.wall([[gx, 96], [gx, 136]], { r: 3 });
    b.post(gx, 94, 5);
  }

  // --- Bubble bumpers in a row under the lanes ---
  b.bumper('bubble_a', 214, 206, { group: 'bubbles', r: 23, icon: 'bubble' });
  b.bumper('bubble_b', 310, 200, { group: 'bubbles', r: 25, icon: 'bubble' });
  b.bumper('bubble_c', 406, 206, { group: 'bubbles', r: 23, icon: 'bubble' });

  // --- Sample cabinets: tall glass cases joined by the Reaction Bridge ---
  // Each case has a flared mouth on the side its flipper shoots from.
  const cabinet = (x: number, flare: 1 | -1) => {
    const lx = x - 26;
    const rx = x + 26;
    if (flare < 0) b.wall([[lx - 16, 492], [lx, 462], [lx, 366]], { r: 4 });
    else b.wall([[lx, 470], [lx, 366]], { r: 4 });
    if (flare > 0) b.wall([[rx, 366], [rx, 462], [rx + 16, 492]], { r: 4 });
    else b.wall([[rx, 366], [rx, 470]], { r: 4 });
    b.wall([[lx - 4, 366], [x, 346], [rx + 4, 366]], { r: 4 });
  };
  cabinet(156, 1);
  cabinet(416, -1);
  // BEFORE kicks every sample up onto the bridge; it rides over the stage into AFTER.
  b.saucer('before_cab', 156, 444, { group: 'cabinets', ejectDeg: -90, ejectSpeed: 1350, captureMaxSpeed: 3900, label: 'BEFORE', icon: 'cabinet' });
  b.ramp('reaction_bridge', {
    path: [[156, 442], [156, 384], [168, 346], [214, 322], [286, 314], [358, 322], [404, 346], [416, 384], [416, 418]],
    width: 34,
    peak: 56,
  });
  b.saucer('after_cab', 416, 446, { group: 'cabinets', ejectDeg: 108, ejectSpeed: 720, captureMaxSpeed: 3900, label: 'AFTER', icon: 'cabinet' });

  // --- REVEAL: the Wonder Pocket, center stage under the bridge, with a funnel mouth ---
  b.wall([[248, 512], [258, 494], [258, 474]], { r: 4 });
  b.arc(286, 474, 28, 180, 360, { r: 4, segments: 14 });
  b.wall([[314, 474], [314, 494], [324, 512]], { r: 4 });
  b.saucer('reveal', 286, 476, { role: 'pocket', ejectDeg: 82, ejectSpeed: 760, captureMaxSpeed: 3900, label: 'REVEAL POCKET', icon: 'curtain' });

  // --- PHYSICAL CHANGE drop bank: tilted toward the right flipper, on a solid plinth ---
  b.wall([[80, 500], [132, 527], [87, 605]], { id: 'physical_plinth', r: 3 });
  b.dropBank('physical_bank', 96, 610, -60, 3, { size: 26, gap: 6, group: 'physical', labels: ['BOIL', 'MELT', 'DISSOLVE'] });

  // --- Chemical clue standups against the right loop wall ---
  const clueLabels = ['COLOR', 'SOLID', 'GAS', 'ODOR'];
  clueLabels.forEach((l, i) => b.target(`clue_${l.toLowerCase()}`, [484, 492 + i * 32], [484, 516 + i * 32], { group: 'clues', label: l }));

  // --- Inserts ---
  b.insert('ins_left_loop', 52, 616, { deg: -90, label: 'LOOP' });
  b.insert('ins_right_loop', 522, 616, { deg: -90, label: 'LOOP' });
  b.insert('ins_before', 196, 548, { deg: -104 });
  b.insert('ins_after', 376, 548, { deg: -76 });
  b.insert('ins_reveal', 286, 566, { deg: -90 });
  b.insert('ins_physical', 136, 650, { deg: -118, label: 'PHYSICAL' });
  b.insert('ins_clues', 440, 650, { deg: -66, label: 'CLUES' });
  b.insert('ins_bubbles', 262, 158, { shape: 'star', size: 10 });
  b.insert('ins_lanes', 358, 158, { shape: 'circle', size: 8 });
}

// ---------------------------------------------------------------- printed playfield art

const ARCH: [number, number] = [310, 300];
/** The stage apron: a curved front edge from (86,520) through the center to (490,520). */
const APRON = { x0: 86, x1: 490, y: 520, cy: 664 };

function apronPoint(t: number): [number, number] {
  const u = 1 - t;
  return [u * u * APRON.x0 + 2 * u * t * 288 + t * t * APRON.x1, u * u * APRON.y + 2 * u * t * APRON.cy + t * t * APRON.y];
}

function damask(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.save();
  ctx.strokeStyle = rgba(GOLD, 0.045 + 0.04 * lit);
  ctx.fillStyle = rgba(GOLD, 0.05 + 0.05 * lit);
  ctx.lineWidth = 1;
  for (let y = 22, row = 0; y < 1150; y += 44, row++) {
    for (let x = (row % 2) * 22; x < 620; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.quadraticCurveTo(x + 6, y - 3, x + 7, y);
      ctx.quadraticCurveTo(x + 6, y + 3, x, y + 9);
      ctx.quadraticCurveTo(x - 6, y + 3, x - 7, y);
      ctx.quadraticCurveTo(x - 6, y - 3, x, y - 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 22, y, 1.4, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Velvet curtain folds in a vertical strip (stage wings painted in the loop lanes). */
function drape(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, lit: number) {
  const folds = Math.max(2, Math.round((x1 - x0) / 13));
  const fw = (x1 - x0) / folds;
  ctx.save();
  for (let i = 0; i < folds; i++) {
    const g = ctx.createLinearGradient(x0 + i * fw, 0, x0 + (i + 1) * fw, 0);
    g.addColorStop(0, mix(VELVET_DK, '#000000', 0.35));
    g.addColorStop(0.45, mix(VELVET_DK, VELVET, 0.35 + 0.45 * lit));
    g.addColorStop(1, mix(VELVET_DK, '#000000', 0.4));
    ctx.fillStyle = g;
    ctx.fillRect(x0 + i * fw, y0, fw + 0.6, y1 - y0);
  }
  // soft fade at both ends so the drape melts into the wallpaper
  const top = ctx.createLinearGradient(0, y0, 0, y0 + 60);
  top.addColorStop(0, rgba(NIGHT, 0.9));
  top.addColorStop(1, rgba(NIGHT, 0));
  ctx.fillStyle = top;
  ctx.fillRect(x0, y0, x1 - x0, 60);
  const bot = ctx.createLinearGradient(0, y1 - 70, 0, y1);
  bot.addColorStop(0, rgba(NIGHT, 0));
  bot.addColorStop(1, rgba(NIGHT, 0.85));
  ctx.fillStyle = bot;
  ctx.fillRect(x0, y1 - 70, x1 - x0, 70);
  ctx.restore();
}

/** Scalloped velvet valance with gold fringe hanging just inside the arch. */
function valance(ctx: CanvasRenderingContext2D, lit: number) {
  const [cx, cy] = ARCH;
  const R0 = 281;
  const n = 11;
  const a0 = (196 * Math.PI) / 180;
  const a1 = (344 * Math.PI) / 180;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const s = a0 + ((a1 - a0) * i) / n;
    const e = a0 + ((a1 - a0) * (i + 1)) / n;
    const m = (s + e) / 2;
    const P = (r: number, a: number): [number, number] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    const [sx, sy] = P(R0 - 2, s);
    const [ex, ey] = P(R0 - 2, e);
    const [mx, my] = P(R0 - 46, m);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(cx, cy, R0, s, e);
    ctx.quadraticCurveTo(mx, my, sx, sy);
    const g = ctx.createRadialGradient(cx, cy, R0 - 40, cx, cy, R0);
    g.addColorStop(0, mix(VELVET_DK, VELVET, 0.55 + 0.4 * lit));
    g.addColorStop(1, VELVET_DK);
    ctx.fillStyle = g;
    ctx.fill();
    // gold fringe along the sag
    ctx.strokeStyle = rgba(GOLD, 0.45 + 0.45 * lit);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.quadraticCurveTo(mx, my, sx, sy);
    ctx.stroke();
    // tassel
    const [tx, ty] = P(R0 - 6, e);
    ctx.fillStyle = rgba(GOLD, 0.55 + 0.4 * lit);
    ctx.beginPath();
    ctx.ellipse(tx, ty + 6, 2.4, 6, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function stageFloor(ctx: CanvasRenderingContext2D, lit: number, show: number) {
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(APRON.x0, 296);
    ctx.lineTo(APRON.x1, 296);
    ctx.lineTo(APRON.x1, APRON.y);
    ctx.quadraticCurveTo(288, APRON.cy, APRON.x0, APRON.y);
    ctx.closePath();
  };
  ctx.save();
  outline();
  ctx.clip();
  const r = rng(12);
  for (let y = 296, i = 0; y < 600; y += 14, i++) {
    ctx.fillStyle = mix('#2c140e', PLANK, 0.3 + 0.28 * lit + r() * 0.12);
    ctx.fillRect(APRON.x0, y, APRON.x1 - APRON.x0, 13);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(APRON.x0, y + 13, APRON.x1 - APRON.x0, 1);
    const off = (i * 53) % 96;
    for (let x = APRON.x0 + off; x < APRON.x1; x += 96) ctx.fillRect(x, y, 1.4, 13);
  }
  // back of the stage falls into shadow, front catches the footlights
  const sh = ctx.createLinearGradient(0, 296, 0, 600);
  sh.addColorStop(0, 'rgba(10,4,14,0.55)');
  sh.addColorStop(0.55, 'rgba(10,4,14,0.12)');
  sh.addColorStop(1, rgba(GOLD, 0.05 + 0.12 * lit));
  ctx.fillStyle = sh;
  ctx.fillRect(APRON.x0, 296, APRON.x1 - APRON.x0, 304);
  if (show > 0.01) {
    // Wonderlight: coloured light pools wash across the boards
    const pools: [number, number, string][] = [[170, 520, VIOLET], [286, 470, GOLD], [402, 520, AQUA], [230, 360, CORAL], [350, 360, MINT]];
    for (const [x, y, c] of pools) glowDot(ctx, x, y, 110, c, 0.22 * show);
  }
  ctx.restore();
  // gilded apron edge
  ctx.save();
  ctx.strokeStyle = rgba(GOLD, 0.35 + 0.45 * lit);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(APRON.x0, APRON.y);
  ctx.quadraticCurveTo(288, APRON.cy, APRON.x1, APRON.y);
  ctx.stroke();
  ctx.strokeStyle = rgba('#000000', 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(APRON.x0, APRON.y + 6);
  ctx.quadraticCurveTo(288, APRON.cy + 6, APRON.x1, APRON.y + 6);
  ctx.stroke();
  ctx.restore();
}

function footlights(ctx: CanvasRenderingContext2D, lit: number, t = 0, chase = 0) {
  for (let i = 0; i < 15; i++) {
    const [x, y] = apronPoint(0.16 + (i / 14) * 0.68);
    ctx.fillStyle = rgba(BRASS, 0.7);
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 6, 3, 0, 0, TAU);
    ctx.fill();
    const tw = chase > 0 ? 0.6 + 0.4 * Math.sin(t * 5 - i * 0.8) : 1;
    const l = lit * tw;
    ctx.fillStyle = l > 0.05 ? rgba('#FFE7B0', 0.4 + 0.6 * l) : 'rgba(70,52,60,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, Math.PI, TAU);
    ctx.fill();
    if (l > 0.05) glowDot(ctx, x, y - 2, 14, '#FFD27A', 0.5 * l);
  }
}

/** The big Erlenmeyer flask printed behind the bubble bumpers; the condition lanes sit in its neck. */
function flaskPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(228, 66);
  ctx.lineTo(228, 150);
  ctx.quadraticCurveTo(228, 166, 212, 176);
  ctx.lineTo(150, 236);
  ctx.quadraticCurveTo(136, 256, 160, 266);
  ctx.lineTo(460, 266);
  ctx.quadraticCurveTo(484, 256, 470, 236);
  ctx.lineTo(408, 176);
  ctx.quadraticCurveTo(392, 166, 392, 150);
  ctx.lineTo(392, 66);
}

function bubbleFlask(ctx: CanvasRenderingContext2D, s2: number, s4: number) {
  ctx.save();
  flaskPath(ctx);
  ctx.closePath();
  ctx.clip();
  // dark glass interior
  ctx.fillStyle = vgrad(ctx, 66, 266, [[0, 'rgba(20,30,52,0.55)'], [1, 'rgba(20,24,44,0.75)']]);
  ctx.fillRect(130, 60, 360, 210);
  // the liquid: dull before, glowing teal once mission 2 is solved, rainbow at the finale
  const liq = mix('#28344c', MINT, 0.15 + 0.6 * s2);
  ctx.fillStyle = vgrad(ctx, 180, 266, [[0, rgba(liq, 0.5 + 0.3 * s2)], [1, rgba(mix(liq, AQUA, 0.4), 0.75)]]);
  ctx.fillRect(130, 186, 360, 82);
  ctx.strokeStyle = rgba(IVORY, 0.25 + 0.4 * s2);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(140, 186);
  for (let x = 140; x <= 480; x += 10) ctx.lineTo(x, 186 + Math.sin(x / 13) * 2);
  ctx.stroke();
  // bubbles
  const r = rng(31);
  for (let i = 0; i < 46; i++) {
    const x = 150 + r() * 320;
    const y = 72 + r() * 190;
    const rr = 2 + r() * 5;
    ctx.strokeStyle = rgba(i % 5 === 0 ? YELLOW : IVORY, 0.12 + 0.45 * s2 + 0.2 * s4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.stroke();
  }
  if (s4 > 0.01) {
    const g = ctx.createLinearGradient(150, 0, 470, 0);
    [CORAL, GOLD, MINT, AQUA, VIOLET].forEach((c, i) => g.addColorStop(i / 4, rgba(c, 0.22 * s4)));
    ctx.fillStyle = g;
    ctx.fillRect(130, 186, 360, 82);
  }
  ctx.restore();
  // glass outline + highlights
  neonPath(ctx, () => flaskPath(ctx), AQUA, 0.12 + 0.6 * s2 + 0.3 * s4, 3);
  ctx.save();
  ctx.strokeStyle = rgba(IVORY, 0.18 + 0.25 * s2);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(166, 238);
  ctx.lineTo(206, 198);
  ctx.stroke();
  ctx.restore();
  // graduation ticks on the right shoulder
  ctx.save();
  ctx.strokeStyle = rgba(IVORY, 0.25 + 0.3 * s2);
  ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    const y = 200 + k * 14;
    const x = 418 + (y - 176) * 0.97;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x - 2, y);
    ctx.stroke();
  }
  ctx.restore();
}

function stirIcon(ctx: CanvasRenderingContext2D, s: number) {
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, s * 0.15, s * 0.7, 0.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.62, -s * 0.38);
  ctx.lineTo(s * 0.86, -s * 0.05);
  ctx.lineTo(s * 0.45, -s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.15, -s * 0.95);
  ctx.lineTo(s * 0.12, s * 0.4);
  ctx.stroke();
}

function conditionIcons(ctx: CanvasRenderingContext2D, s2: number) {
  const items: [number, string, (c: CanvasRenderingContext2D, s: number) => void][] = [
    [262, CORAL, ICONS.flame],
    [310, AQUA, ICONS.snow],
    [358, VIOLET, stirIcon],
  ];
  for (const [x, c, paint] of items) {
    const a = 0.35 + 0.6 * s2;
    if (s2 > 0.02) glowDot(ctx, x, 78, 22, c, 0.35 * s2);
    ctx.save();
    ctx.translate(x, 78);
    ctx.fillStyle = rgba(c, a);
    ctx.strokeStyle = rgba(c, a);
    paint(ctx, 9);
    ctx.restore();
  }
}

/** Glass display case printed around a sample cabinet; jars glow once the stage wakes. */
function caseArt(ctx: CanvasRenderingContext2D, x: number, products: boolean, lit: number, show: number) {
  const lx = x - 26;
  const rx = x + 26;
  const top = 366;
  const bot = 470;
  const tint = products ? YELLOW : AQUA;
  ctx.save();
  ctx.fillStyle = vgrad(ctx, top, bot, [[0, rgba(tint, 0.1 + 0.2 * lit + 0.1 * show)], [0.7, rgba(tint, 0.04 + 0.08 * lit)], [1, 'rgba(0,0,0,0.25)']]);
  ctx.fillRect(lx - 4, top, rx - lx + 8, bot - top);
  // pediment
  ctx.fillStyle = rgba(GOLD, 0.25 + 0.35 * lit);
  ctx.beginPath();
  ctx.moveTo(lx - 10, top + 2);
  ctx.lineTo(x, top - 26);
  ctx.lineTo(rx + 10, top + 2);
  ctx.closePath();
  ctx.fill();
  // shelves
  ctx.fillStyle = rgba(BRASS, 0.35 + 0.3 * lit);
  for (const sy of [396, 424]) ctx.fillRect(lx + 3, sy, rx - lx - 6, 2);
  // jars on the shelves (reactants: white powders and clear liquids; products: a yellow solid, new colours, bubbles)
  const jars = products
    ? [[YELLOW, 0.45, 'solid'], [VIOLET, 0.8, 'liquid'], [MINT, 0.7, 'gas']]
    : [[IVORY, 0.4, 'solid'], ['#cfe9ff', 0.75, 'liquid'], [IVORY, 0.45, 'solid']];
  for (let row = 0; row < 2; row++) {
    jars.forEach(([c, f, kind], i) => {
      const jx = lx + 9 + i * 17;
      const jy = (row ? 424 : 396) - 1;
      const h = 15;
      ctx.strokeStyle = rgba(IVORY, 0.35 + 0.3 * lit);
      ctx.lineWidth = 1;
      rrect(ctx, jx - 5, jy - h, 10, h, 2);
      ctx.stroke();
      const fh = h * (f as number) * (row ? 0.8 : 1);
      ctx.fillStyle = rgba(c as string, 0.25 + 0.6 * lit);
      if (kind === 'solid' && products) {
        // a solid settling to the bottom under a clear liquid
        ctx.fillStyle = rgba('#d8f0ff', 0.2 + 0.25 * lit);
        ctx.fillRect(jx - 4, jy - 12, 8, 11);
        ctx.fillStyle = rgba(YELLOW, 0.35 + 0.6 * lit);
        ctx.fillRect(jx - 4, jy - 4, 8, 3.5);
      } else {
        ctx.fillRect(jx - 4, jy - fh, 8, fh - 1);
      }
      if (kind === 'gas') {
        ctx.strokeStyle = rgba(IVORY, 0.3 + 0.5 * lit);
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(jx - 2 + k * 2, jy - 6 - k * 4, 1.3, 0, TAU);
          ctx.stroke();
        }
      }
    });
  }
  // gilt frame
  ctx.strokeStyle = rgba(GOLD, 0.4 + 0.45 * lit);
  ctx.lineWidth = 2;
  ctx.strokeRect(lx - 4, top, rx - lx + 8, bot - top);
  ctx.restore();
  plaque(ctx, products ? 'PRODUCTS' : 'REACTANTS', x, top - 36, products ? rgba(YELLOW, 0.6 + 0.4 * lit) : rgba(AQUA, 0.6 + 0.4 * lit), '#2a0c1c', 9);
}

/** Dark round tag behind a printed pictogram, so it reads over the boards and the apron edge. */
function iconTag(ctx: CanvasRenderingContext2D, x: number, y: number, ring: string, lit: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(22,8,18,0.82)';
  ctx.beginPath();
  ctx.arc(x, y, 11.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(ring, 0.35 + 0.4 * lit);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** Printed pictograms beside the PHYSICAL bank (boiling, melting, dissolving), in a row below the apron. */
function physicalIcons(ctx: CanvasRenderingContext2D, lit: number) {
  const ink = rgba(MINT, 0.55 + 0.4 * lit);
  const row = 606;
  const xs = [168, 196, 224];
  for (const x of xs) iconTag(ctx, x, row, MINT, lit);
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  // BOIL: a pot with steam curls (the vapor is still water)
  let x = xs[0];
  let y = row + 2;
  ctx.strokeRect(x - 6, y, 12, 6);
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * 4, y - 2);
    ctx.quadraticCurveTo(x + k * 4 + 3, y - 5, x + k * 4, y - 9);
    ctx.stroke();
  }
  // MELT: an ice cube with a drip
  x = xs[1];
  y = row - 1;
  ctx.strokeRect(x - 6, y - 5, 10, 10);
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 1);
  ctx.quadraticCurveTo(x + 9, y + 5, x + 6, y + 8);
  ctx.quadraticCurveTo(x + 3, y + 5, x + 6, y + 1);
  ctx.fill();
  // DISSOLVE: a cup with fading grains
  x = xs[2];
  y = row;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 6);
  ctx.lineTo(x - 4, y + 6);
  ctx.lineTo(x + 4, y + 6);
  ctx.lineTo(x + 6, y - 6);
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    ctx.globalAlpha = 0.3 + 0.14 * k;
    ctx.beginPath();
    ctx.arc(x - 4 + k * 2, y - 1 + (k % 2) * 3, 0.9, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // caption under the row: none of these makes a new substance
  ctx.font = '800 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(mix(MINT, IVORY, 0.3), 0.6 + 0.35 * lit);
  ctx.fillText('NO NEW SUBSTANCE', 196, 629);
  ctx.restore();
  // plinth plaque
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(80, 500);
  ctx.lineTo(132, 527);
  ctx.lineTo(87, 605);
  ctx.closePath();
  ctx.fillStyle = vgrad(ctx, 500, 605, [[0, rgba('#1c4a4a', 0.85)], [1, rgba('#0f2a30', 0.9)]]);
  ctx.fill();
  ctx.restore();
}

/** Pictograms beside the clue targets: new color, a solid forms, a gas forms, a new smell. */
function clueIcons(ctx: CanvasRenderingContext2D, lit: number) {
  const x = 458;
  const ys = [504, 536, 568, 600];
  for (const ty of ys) iconTag(ctx, x, ty, CORAL, lit);
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const a = 0.55 + 0.4 * lit;
  // COLOR: a swatch that changes hue
  let y = ys[0];
  ctx.fillStyle = rgba(AQUA, a);
  ctx.beginPath();
  ctx.arc(x, y, 7, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.fill();
  ctx.fillStyle = rgba(VIOLET, a);
  ctx.beginPath();
  ctx.arc(x, y, 7, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  // SOLID: a flask with a yellow solid settled at the bottom
  y = ys[1];
  ctx.strokeStyle = rgba(IVORY, a);
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 8);
  ctx.lineTo(x - 2, y - 3);
  ctx.lineTo(x - 8, y + 7);
  ctx.lineTo(x + 8, y + 7);
  ctx.lineTo(x + 2, y - 3);
  ctx.lineTo(x + 2, y - 8);
  ctx.stroke();
  ctx.fillStyle = rgba(YELLOW, a);
  ctx.fillRect(x - 6, y + 3, 12, 3.5);
  // GAS: rising bubbles
  y = ys[2];
  ctx.strokeStyle = rgba(MINT, a);
  for (const [dx, dy, rr] of [[-4, 4, 3], [3, 0, 2.4], [-1, -6, 2]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, rr, 0, TAU);
    ctx.stroke();
  }
  // ODOR: wavy scent lines
  y = ys[3];
  ctx.strokeStyle = rgba(CORAL, a);
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * 5, y + 7);
    ctx.bezierCurveTo(x + k * 5 - 4, y + 2, x + k * 5 + 4, y - 2, x + k * 5, y - 7);
    ctx.stroke();
  }
  ctx.restore();
  // caption in the right wing
  ctx.save();
  ctx.translate(522, 560);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '800 10px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(mix(CORAL, IVORY, 0.35), 0.6 + 0.35 * lit);
  ctx.fillText('CLUES OF CHANGE', 0, 0);
  ctx.restore();
}

/** The Evidence meter printed in the left wing: bars fill as the case gets stronger. */
function evidenceMeter(ctx: CanvasRenderingContext2D, lit: number, strength: number) {
  ctx.save();
  ctx.translate(52, 430);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '800 10px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(GOLD, 0.6 + 0.35 * lit);
  ctx.fillText('EVIDENCE', 0, 0);
  ctx.restore();
  const bars = 6;
  for (let i = 0; i < bars; i++) {
    const y = 540 - i * 9;
    const on = strength * bars > i + 0.2;
    const c = mix(CORAL, MINT, i / (bars - 1));
    ctx.fillStyle = on ? rgba(c, 0.85) : 'rgba(60,40,60,0.75)';
    rrect(ctx, 40, y, 24, 6, 2);
    ctx.fill();
    if (on) glowDot(ctx, 52, y + 3, 14, c, 0.35);
  }
}

/** The golden rule on a dark velvet plaque with a gilt rim: it stays readable under the Wonderlight bloom. */
function rulePlaque(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, lit: number) {
  const size = 11;
  ctx.save();
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 26;
  const h = size * 2.3;
  rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = '#24081a';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(GOLD, 0.55 + 0.35 * lit);
  ctx.stroke();
  ctx.fillStyle = mix('#E9D3A8', GOLD, lit);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

/** Printed under the glass bridge: its name and chevrons running from BEFORE to AFTER. */
function bridgeLabel(ctx: CanvasRenderingContext2D, lit: number) {
  ctx.save();
  ctx.font = '800 11px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(MINT, 0.45 + 0.5 * lit);
  ctx.fillText('REACTION BRIDGE', 286, 362);
  ctx.strokeStyle = rgba(MINT, 0.35 + 0.5 * lit);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const x of [200, 222, 350, 372]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, 356);
    ctx.lineTo(x + 3, 362);
    ctx.lineTo(x - 4, 368);
    ctx.stroke();
  }
  ctx.restore();
}

/** The house: a carpeted centre aisle and curved rows of velvet seats facing the stage. */
function orchestra(ctx: CanvasRenderingContext2D, lit: number, show: number) {
  const top = 784;
  ctx.save();
  ctx.fillStyle = vgrad(ctx, top, 1150, [[0, rgba(VELVET_DK, 0)], [0.1, rgba(mix(VELVET_DK, VELVET, 0.25 + 0.3 * lit), 0.5)], [1, rgba(VELVET_DK, 0.65)]]);
  ctx.fillRect(254, top, 64, 1150 - top);
  ctx.strokeStyle = vgrad(ctx, top, 1150, [[0, rgba(GOLD, 0)], [0.12, rgba(GOLD, 0.1 + 0.2 * lit)], [1, rgba(GOLD, 0.06 + 0.1 * lit)]]);
  ctx.lineWidth = 1.5;
  for (const x of [254, 318]) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, 1150);
    ctx.stroke();
  }
  const seat = rgba(mix(VELVET_DK, VELVET, 0.3 + 0.35 * lit), 0.42);
  const rim = rgba(mix(GOLD, CORAL, 0.3 * show), 0.08 + 0.16 * lit + 0.12 * show);
  const cx = 286;
  const cy = 488;
  for (let k = 0; k < 9; k++) {
    const R = 318 + k * 32;
    const step = 21 / R;
    for (let a = Math.PI / 2 - 1.3; a <= Math.PI / 2 + 1.3; a += step) {
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (x < 36 || x > 536 || y < 792 || y > 1104 || Math.abs(x - cx) < 42) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a - Math.PI / 2);
      rrect(ctx, -8, -4, 16, 9, 3);
      ctx.fillStyle = seat;
      ctx.fill();
      ctx.fillStyle = rim;
      ctx.fillRect(-7, -4, 14, 1.6);
      ctx.restore();
    }
  }
  ctx.restore();
}

function paintBackdrop({ ctx, level }: SceneryContext) {
  const s1 = stage(level, 0.2, 1.1); // footlights and cabinets wake
  const s2 = stage(level, 1.2, 2.1); // the bubble flask and the conditions
  const s3 = stage(level, 2.2, 3.1); // evidence meter and the marquee
  const s4 = stage(level, 3.4, 4); // Wonderlight: the light-and-color show

  // Velvet theatre wall
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#2a0b24'], [0.3, mix('#3a0f2c', '#5a1638', s1 * 0.5)], [0.62, '#2a0e2a'], [1, NIGHT]]);
  ctx.fillRect(0, 0, 600, 1150);
  damask(ctx, s1);
  orchestra(ctx, s1, s4);
  // Wings: velvet drapes in both loop lanes
  drape(ctx, 24, 80, 300, 720, s1);
  drape(ctx, 496, 548, 330, 720, s1);
  // Spotlight cone onto the REVEAL stage
  ctx.save();
  const cone = ctx.createLinearGradient(0, 30, 0, 520);
  cone.addColorStop(0, rgba('#FFF1C9', 0.02));
  cone.addColorStop(1, rgba('#FFF1C9', 0.05 + 0.12 * s1 + 0.1 * s4));
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(276, 30);
  ctx.lineTo(296, 30);
  ctx.lineTo(352, 520);
  ctx.lineTo(220, 520);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Stage boards, cabinets and the REVEAL spotlight pool
  stageFloor(ctx, s1, s4);
  glowDot(ctx, 286, 478, 70, GOLD, 0.12 + 0.25 * s1 + 0.2 * s4);
  caseArt(ctx, 156, false, s1, s4);
  caseArt(ctx, 416, true, s1, s4);
  // The Reaction Bridge's shadow line on the boards
  ctx.save();
  ctx.strokeStyle = rgba(MINT, 0.08 + 0.18 * s1);
  ctx.lineWidth = 30;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(156, 384);
  ctx.bezierCurveTo(160, 310, 412, 310, 416, 384);
  ctx.stroke();
  ctx.restore();
  bridgeLabel(ctx, s1);
  // The bubble flask behind the bumpers, with the condition lanes in its neck
  bubbleFlask(ctx, s2, s4);
  conditionIcons(ctx, s2);
  valance(ctx, s1);
  // Wings: evidence and clues
  evidenceMeter(ctx, s1, Math.max(0.17, 0.34 * s1 + 0.33 * s2 + 0.33 * s3));
  physicalIcons(ctx, s1);
  clueIcons(ctx, s1);
  footlights(ctx, s1);
  // Orchestra floor: the marquee title and the lesson's golden rule
  neonText(ctx, 'REACTION REVELRY', 286, 708, 27, GOLD, s3);
  rulePlaque(ctx, 'BUBBLES ALONE DO NOT PROVE A REACTION', 286, 754, s2);
  // Light-and-color show (Wonderlight)
  if (s4 > 0.01) {
    const beams: [number, number, string][] = [[30, 200, VIOLET], [130, 250, AQUA], [470, 330, CORAL], [570, 380, GOLD], [300, 286, MINT]];
    for (const [x0, x1, c] of beams) {
      const g = ctx.createLinearGradient(0, 0, 0, 560);
      g.addColorStop(0, rgba(c, 0.18 * s4));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0 - 8, 0);
      ctx.lineTo(x0 + 8, 0);
      ctx.lineTo(x1 + 60, 560);
      ctx.lineTo(x1 - 60, 560);
      ctx.closePath();
      ctx.fill();
    }
    const r = rng(77);
    for (let i = 0; i < 70; i++) {
      const c = [CORAL, GOLD, MINT, AQUA, VIOLET, YELLOW][i % 6];
      ctx.fillStyle = rgba(c, 0.55 * s4);
      ctx.save();
      ctx.translate(40 + r() * 500, 290 + r() * 480);
      ctx.rotate(r() * TAU);
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
    ctx.fillStyle = rgba(GOLD, 0.05 * s4);
    ctx.fillRect(0, 0, 600, 1150);
  }
}

// ---------------------------------------------------------------- 3D attraction set

type V3 = [number, number, number];

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

/** Normalized lathe profiles (radius, height) for lab glassware. */
const PROFILES: Record<'erlen' | 'beaker' | 'round', [number, number][]> = {
  erlen: [[0.001, 0], [0.4, 0], [0.43, 0.04], [0.17, 0.62], [0.11, 0.7], [0.11, 0.96], [0.13, 1]],
  beaker: [[0.001, 0], [0.3, 0], [0.31, 0.04], [0.31, 0.92], [0.34, 1]],
  round: [[0.001, 0], [0.18, 0.02], [0.31, 0.14], [0.36, 0.3], [0.31, 0.47], [0.15, 0.6], [0.1, 0.66], [0.1, 0.97], [0.12, 1]],
};

function latheFrom(profile: [number, number][], h: number, scaleR = 1, fill = 1, seg = 22): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i];
    if (y <= fill) pts.push(new THREE.Vector2(r * h * scaleR, y * h));
    else {
      const [r0, y0] = profile[i - 1];
      const u = (fill - y0) / (y - y0 || 1);
      pts.push(new THREE.Vector2((r0 + (r - r0) * u) * h * scaleR, fill * h));
      pts.push(new THREE.Vector2(0.001, fill * h));
      break;
    }
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** Velvet theatre curtain: a folded plane with gathered pleats. */
function curtainGeo(w: number, h: number, folds: number, depth: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h, folds * 8, 10);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const u = x / w + 0.5;
    const v = y / h + 0.5;
    p.setZ(i, Math.sin(u * folds * TAU) * depth * (0.55 + 0.45 * v));
  }
  g.computeVertexNormals();
  return g;
}

interface ShelfItem { kind: 'erlen' | 'beaker' | 'round'; x: number; y: number; z: number; h: number; color: string; fill: number }

/** A glass sample case (theatre prop): wood plinth, gilt frame, glass, shelves and glowing glassware. */
function sampleCase(kit: SetKit, pos: V3, rotY: number, tint: string, items: ShelfItem[]) {
  const g = new THREE.Group();
  const W = 2.2;
  const H = 2.3;
  const D = 0.8;
  const wood = kit.mats.wood();
  const gilt = kit.mats.brass();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.28, D + 0.2), wood);
  plinth.position.y = 0.14;
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(W + 0.26, 0.16, D + 0.26), gilt);
  cornice.position.y = H + 0.3;
  const ped = new THREE.Shape();
  ped.moveTo(-W / 2 - 0.1, 0);
  ped.lineTo(0, 0.5);
  ped.lineTo(W / 2 + 0.1, 0);
  ped.closePath();
  const pedMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 0.12, bevelEnabled: false }), kit.mats.paintedMetal('#c98a2e'));
  pedMesh.position.set(0, H + 0.38, D / 2 - 0.02);
  const backMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0c060c', emissive: tint, emissiveIntensity: 0.05, roughness: 0.6 }));
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.06, H - 0.1), backMat);
  back.position.set(0, 0.28 + H / 2, -D / 2 + 0.02);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), kit.mats.clearPlastic('#e8f6ff', 0.07));
  glass.position.y = 0.28 + H / 2;
  g.add(plinth, cornice, pedMesh, back, glass);
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, H, 10);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(postGeo, gilt);
      p.position.set((sx * W) / 2, 0.28 + H / 2, (sz * D) / 2);
      g.add(p);
    }
  }
  const shelfGeo = new THREE.BoxGeometry(W - 0.08, 0.03, D - 0.1);
  const shelfMat = kit.mats.brass();
  for (const sy of [0.95, 1.65]) {
    const s = new THREE.Mesh(shelfGeo, shelfMat);
    s.position.y = sy;
    g.add(s);
  }
  // Glassware: one instanced shell and one instanced glowing content per glass shape.
  const shells: Record<string, THREE.InstancedMesh> = {};
  const contents: Record<string, THREE.InstancedMesh> = {};
  const contentMats: THREE.MeshBasicMaterial[] = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (const kind of ['erlen', 'beaker', 'round'] as const) {
    const list = items.filter((it) => it.kind === kind);
    if (!list.length) continue;
    const shellGeo = latheFrom(PROFILES[kind], 1, 1, 1, 18);
    const shell = new THREE.InstancedMesh(shellGeo, kit.mats.clearPlastic('#eaf7ff', 0.3), list.length);
    const mat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
    contentMats.push(mat);
    // Contents share one fill level per shape; scale each instance to its own height.
    const fill = list[0].fill;
    const content = new THREE.InstancedMesh(latheFrom(PROFILES[kind], 1, 0.9, fill, 18), mat, list.length);
    list.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.scale.setScalar(it.h);
      dummy.updateMatrix();
      shell.setMatrixAt(i, dummy.matrix);
      content.setMatrixAt(i, dummy.matrix);
      content.setColorAt(i, col.set(it.color));
    });
    if (content.instanceColor) content.instanceColor.needsUpdate = true;
    shells[kind] = shell;
    contents[kind] = content;
    g.add(content, shell);
  }
  g.position.set(pos[0], kit.regions.groundY + pos[1], pos[2]);
  g.rotation.y = rotY;
  kit.add(g);
  return {
    group: g,
    setLit(v: number) {
      backMat.emissiveIntensity = 0.04 + v * 0.6;
      for (let k = 0; k < contentMats.length; k++) contentMats[k].color.setScalar(0.18 + 0.95 * v);
    },
  };
}

/** Theatre spotlight with a rotating colour wheel (the light-and-color show). */
function colorSpot(kit: SetKit, pos: V3, aim: V3) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.1, 24, 1, true), kit.mats.paintedMetal('#2b2238'));
  body.rotation.x = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), kit.mats.paintedMetal('#1a1424'));
  cap.position.z = -0.55;
  cap.rotation.y = Math.PI;
  const lensMat = kit.track(new THREE.MeshStandardMaterial({ color: '#100c08', emissive: '#FFF1C9', emissiveIntensity: 0.05 }));
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), lensMat);
  lens.position.z = 0.56;
  const wheel = new THREE.Group();
  const gelMats: THREE.MeshStandardMaterial[] = [];
  const gels = [CORAL, GOLD, MINT, AQUA, VIOLET, YELLOW];
  gels.forEach((c, i) => {
    const m = kit.track(new THREE.MeshStandardMaterial({ color: '#0c0810', emissive: c, emissiveIntensity: 0.06, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    gelMats.push(m);
    const seg = new THREE.Mesh(new THREE.CircleGeometry(0.62, 10, (i / gels.length) * TAU, TAU / gels.length - 0.04), m);
    wheel.add(seg);
  });
  wheel.position.set(0, 0.0, 0.62);
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 32, Math.PI), kit.mats.brass());
  yoke.rotation.z = Math.PI;
  g.add(body, cap, lens, wheel, yoke);
  g.position.set(...pos);
  g.lookAt(new THREE.Vector3(...aim));
  kit.add(g);
  return { g, wheel, lensMat, gelMats };
}

const revelrySet: SetBuilder = (kit) => {
  const gy = kit.regions.groundY;
  kit.sky('#2b0c2a', '#050208');
  kit.boardwalk('#4a2416', 30);

  // ---- Painted theatre backdrop behind the head: proscenium, curtain and marquee bulbs
  const panorama = kit.backdrop((ctx, w, h, level) => {
    const s3 = kit.stage(level, 2.3, 3);
    const s4 = kit.stage(level, 3.4, 4);
    // night sky glimpsed above the stage house
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#0c0414'], [0.5, '#2a0c2a'], [1, '#160812']]);
    ctx.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(255,247,231,${0.2 + r() * 0.6})`;
      ctx.fillRect(r() * w, r() * h * 0.35, 1.6, 1.6);
    }
    // the great curtain (parts a little at the Wonderlight)
    const open = 0.12 * s4;
    for (const side of [0, 1]) {
      const x0 = side ? w * (0.5 + open) : 0;
      const x1 = side ? w : w * (0.5 - open);
      const folds = 18;
      const fw = (x1 - x0) / folds;
      for (let i = 0; i < folds; i++) {
        const g = ctx.createLinearGradient(x0 + i * fw, 0, x0 + (i + 1) * fw, 0);
        g.addColorStop(0, '#2a0614');
        g.addColorStop(0.5, mix('#6a1028', '#a3203f', 0.3 + 0.5 * s3));
        g.addColorStop(1, '#2a0614');
        ctx.fillStyle = g;
        ctx.fillRect(x0 + i * fw, h * 0.22, fw + 1, h * 0.78);
      }
    }
    if (open > 0.001) {
      // through the gap: a rainbow of stage light
      const g = ctx.createLinearGradient(w * (0.5 - open), 0, w * (0.5 + open), 0);
      [CORAL, GOLD, MINT, AQUA, VIOLET].forEach((c, i) => g.addColorStop(i / 4, rgba(c, 0.85)));
      ctx.fillStyle = g;
      ctx.fillRect(w * (0.5 - open), h * 0.22, w * open * 2, h * 0.78);
    }
    // gilded proscenium arch with marquee bulbs
    ctx.strokeStyle = '#d9a85b';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h);
    ctx.lineTo(w * 0.04, h * 0.3);
    ctx.quadraticCurveTo(w * 0.5, h * 0.02, w * 0.96, h * 0.3);
    ctx.lineTo(w * 0.96, h);
    ctx.stroke();
    const bulbs = 46;
    for (let i = 0; i < bulbs; i++) {
      const u = i / (bulbs - 1);
      const t = u;
      const x = (1 - t) * (1 - t) * w * 0.04 + 2 * (1 - t) * t * w * 0.5 + t * t * w * 0.96;
      const y = (1 - t) * (1 - t) * h * 0.3 + 2 * (1 - t) * t * h * 0.02 + t * t * h * 0.3;
      const on = 0.2 + 0.8 * Math.max(s3, i % 2 ? s4 : s3 * 0.6);
      ctx.fillStyle = `rgba(255,${200 + Math.round(40 * on)},${120 + Math.round(60 * on)},${0.35 + 0.65 * on})`;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
    }
  }, { width: 30, height: 12, z: -16 });

  // ---- Velvet wings framing the stage (they swing open for the Wonderlight)
  const velvet = kit.track(new THREE.MeshPhysicalMaterial({ color: '#7a1430', roughness: 0.82, metalness: 0, sheen: 1, sheenColor: new THREE.Color('#ff86a3'), sheenRoughness: 0.42 }));
  const wingGeo = curtainGeo(3.2, 4.6, 6, 0.12);
  const wings = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 8.4, gy, -4.8);
    const m = new THREE.Mesh(wingGeo, velvet);
    m.position.set(-sx * 1.6, 2.3, 0);
    m.castShadow = true;
    pivot.add(m);
    pivot.rotation.y = sx * 0.55;
    kit.add(pivot);
    return pivot;
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 18, 10), kit.mats.brass());
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 4.65, -6.8);
  kit.add(rod);
  const valGeo = curtainGeo(18, 0.7, 30, 0.08);
  const val = new THREE.Mesh(valGeo, velvet);
  val.position.set(0, 4.3, -6.85);
  kit.add(val);
  const marquee = kit.neonSign('REACTION REVELRY', [0, 1.35, -7.2], { height: 0.72, color: GOLD });
  marquee.rotation.x = -0.75;

  // ---- Left: the BEFORE case (reactants: white powders and clear liquids)
  const beforeItems: ShelfItem[] = [
    { kind: 'beaker', x: -0.7, y: 0.32, z: 0.05, h: 0.5, color: '#f4f1ea', fill: 0.42 },
    { kind: 'beaker', x: 0.0, y: 0.32, z: 0.05, h: 0.46, color: '#f4f1ea', fill: 0.42 },
    { kind: 'beaker', x: 0.68, y: 0.32, z: 0.05, h: 0.52, color: '#f4f1ea', fill: 0.42 },
    { kind: 'erlen', x: -0.55, y: 0.99, z: 0.0, h: 0.62, color: '#cfe9ff', fill: 0.45 },
    { kind: 'erlen', x: 0.55, y: 0.99, z: 0.0, h: 0.6, color: '#cfe9ff', fill: 0.45 },
    { kind: 'round', x: -0.4, y: 1.69, z: 0.0, h: 0.62, color: '#e6f4ff', fill: 0.5 },
    { kind: 'round', x: 0.42, y: 1.69, z: 0.0, h: 0.58, color: '#e6f4ff', fill: 0.5 },
  ];
  const beforeCase = sampleCase(kit, [-5.7, 0, -1.4], 0.5, AQUA, beforeItems);
  const beforeSign = kit.neonSign('BEFORE', [-5.8, 3.42, -1.45], { height: 0.36, color: AQUA, rotY: 0.5 });
  beforeSign.rotation.x = -0.45;
  kit.panel('REACTANTS', [-5.15, 0.05, -0.38], { w: 1.5, h: 0.32, bg: AQUA, fg: '#1a0c20', rotY: 0.5 });

  // ---- Right: the AFTER case (products: a yellow solid, a new colour, bubbles, a new smell)
  const afterItems: ShelfItem[] = [
    { kind: 'beaker', x: -0.7, y: 0.32, z: 0.05, h: 0.5, color: YELLOW, fill: 0.2 },
    { kind: 'beaker', x: 0.0, y: 0.32, z: 0.05, h: 0.46, color: VIOLET, fill: 0.2 },
    { kind: 'beaker', x: 0.68, y: 0.32, z: 0.05, h: 0.52, color: '#ff9a5c', fill: 0.2 },
    { kind: 'erlen', x: -0.55, y: 0.99, z: 0.0, h: 0.62, color: MINT, fill: 0.5 },
    { kind: 'erlen', x: 0.55, y: 0.99, z: 0.0, h: 0.6, color: CORAL, fill: 0.5 },
    { kind: 'round', x: -0.4, y: 1.69, z: 0.0, h: 0.62, color: YELLOW, fill: 0.5 },
    { kind: 'round', x: 0.42, y: 1.69, z: 0.0, h: 0.58, color: AQUA, fill: 0.5 },
  ];
  const afterCase = sampleCase(kit, [5.7, 0, -1.4], -0.5, YELLOW, afterItems);
  const afterSign = kit.neonSign('AFTER', [5.8, 3.42, -1.45], { height: 0.36, color: YELLOW, rotY: -0.5 });
  afterSign.rotation.x = -0.45;
  kit.panel('PRODUCTS', [5.15, 0.05, -0.38], { w: 1.5, h: 0.32, bg: YELLOW, fg: '#1a0c20', rotY: -0.5 });
  // Gas bubbles rising out of the AFTER flasks
  const fizzN = kit.n(16);
  const fizz = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), kit.track(new THREE.MeshBasicMaterial({ color: '#dffcff', transparent: true, opacity: 0.8 })), fizzN);
  fizz.frustumCulled = false;
  afterCase.group.add(fizz);
  // A new smell: soft wisps curling up from a dish on top of the AFTER case
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.08, 20), kit.mats.brass());
  dish.position.set(0.72, 2.8, 0.1);
  afterCase.group.add(dish);
  const wispMat = kit.track(new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const wisps: THREE.Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const pts = Array.from({ length: 7 }, (_, i) => new THREE.Vector3(0.72 + Math.sin(i * 1.1 + k * 2) * 0.1, 2.84 + i * 0.1, 0.1 + (k - 1) * 0.06));
    const w = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 5), wispMat);
    afterCase.group.add(w);
    wisps.push(w);
  }

  // ---- Left front: the giant bubble flask on a brass stand ("are bubbles proof?")
  const flaskH = 2.5;
  const bigFlask = new THREE.Group();
  const flaskGlass = new THREE.Mesh(latheFrom(PROFILES.erlen, flaskH, 1, 1, 40), kit.mats.clearPlastic('#e8fbff', 0.26));
  const liquidMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0d2a2a', emissive: MINT, emissiveIntensity: 0.08, transparent: true, opacity: 0.86, roughness: 0.2 }));
  const liquid = new THREE.Mesh(latheFrom(PROFILES.erlen, flaskH, 0.94, 0.42, 40), liquidMat);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.18, 40), kit.mats.brass());
  stand.position.y = -0.09;
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.22, 20), kit.mats.wood());
  cork.position.y = flaskH + 0.08;
  bigFlask.add(stand, liquid, flaskGlass, cork);
  bigFlask.position.set(-5.35, gy + 0.18, 2.55);
  kit.add(bigFlask);
  const bubN = kit.n(30);
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), kit.track(new THREE.MeshBasicMaterial({ color: '#e9fffb', transparent: true, opacity: 0.75 })), bubN);
  bubbles.frustumCulled = false;
  bigFlask.add(bubbles);
  const bubSeed = rng(5);
  const bubInfo = Array.from({ length: bubN }, () => ({ a: bubSeed() * TAU, r: 0.15 + bubSeed() * 0.65, ph: bubSeed(), sz: 0.035 + bubSeed() * 0.07, sp: 0.6 + bubSeed() * 0.8 }));
  const proofBoard = kit.panel('BUBBLES ALONE ARE NOT PROOF', [-4.55, 0.18, 4.2], { w: 2.2, h: 0.4, bg: GOLD, fg: '#2a0c1c', rotY: 0.35 });
  proofBoard.rotation.x = -0.5;

  // ---- Right front: the three conditions that can start a reaction
  const condBase = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.62, 1.0), kit.mats.wood());
  condBase.position.set(5.25, gy + 0.31, 2.95);
  condBase.rotation.y = -0.25;
  kit.add(condBase);
  const condGroup = new THREE.Group();
  condGroup.position.set(5.25, gy + 0.62, 2.95);
  condGroup.rotation.y = -0.25;
  condGroup.scale.setScalar(0.9);
  kit.add(condGroup);
  // HEAT: a burner flame under a round flask on a ring stand
  const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.36, 16), kit.mats.chrome());
  burner.position.set(-1.15, 0.18, 0);
  const flameMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 14), flameMat);
  flame.position.set(-1.15, 0.54, 0);
  const coreFlame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 10), kit.track(new THREE.MeshBasicMaterial({ color: '#7fb4ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  coreFlame.position.set(-1.15, 0.46, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 24), kit.mats.chrome());
  ring.rotation.x = Math.PI / 2;
  ring.position.set(-1.15, 0.78, 0);
  const hotFlaskMat = kit.track(new THREE.MeshStandardMaterial({ color: '#2a0d06', emissive: '#ff8a4c', emissiveIntensity: 0.08, transparent: true, opacity: 0.88 }));
  const hotFlask = new THREE.Mesh(latheFrom(PROFILES.round, 0.8, 0.9, 0.5, 24), hotFlaskMat);
  hotFlask.position.set(-1.15, 0.72, 0);
  const hotGlass = new THREE.Mesh(latheFrom(PROFILES.round, 0.8, 1, 1, 24), kit.mats.clearPlastic('#fff1e8', 0.28));
  hotGlass.position.copy(hotFlask.position);
  // COOL: an ice bath with a beaker
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.6), kit.mats.clearPlastic('#d8f2ff', 0.35));
  tray.position.set(0, 0.13, 0);
  const iceN = kit.n(10);
  const iceMat = kit.track(new THREE.MeshStandardMaterial({ color: '#cfefff', emissive: AQUA, emissiveIntensity: 0.05, transparent: true, opacity: 0.8, roughness: 0.1 }));
  const ice = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), iceMat, iceN);
  const iceR = rng(9);
  const d0 = new THREE.Object3D();
  for (let i = 0; i < iceN; i++) {
    d0.position.set((iceR() - 0.5) * 0.62, 0.2 + iceR() * 0.08, (iceR() - 0.5) * 0.42);
    d0.rotation.set(iceR(), iceR(), iceR());
    d0.updateMatrix();
    ice.setMatrixAt(i, d0.matrix);
  }
  const coldMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0a1c2a', emissive: AQUA, emissiveIntensity: 0.08, transparent: true, opacity: 0.85 }));
  const coldBeaker = new THREE.Mesh(latheFrom(PROFILES.beaker, 0.55, 0.9, 0.55, 20), coldMat);
  coldBeaker.position.set(0, 0.06, 0);
  const coldGlass = new THREE.Mesh(latheFrom(PROFILES.beaker, 0.55, 1, 1, 20), kit.mats.clearPlastic('#eaf8ff', 0.3));
  coldGlass.position.copy(coldBeaker.position);
  // MIX: a stirring plate with a swirling vortex
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.52), kit.mats.paintedMetal('#e8e4f0'));
  plate.position.set(1.15, 0.07, 0);
  const mixMat = kit.track(new THREE.MeshStandardMaterial({ color: '#1a0c2a', emissive: VIOLET, emissiveIntensity: 0.08, transparent: true, opacity: 0.86 }));
  const mixBeaker = new THREE.Mesh(latheFrom(PROFILES.beaker, 0.6, 0.9, 0.6, 20), mixMat);
  mixBeaker.position.set(1.15, 0.14, 0);
  const mixGlass = new THREE.Mesh(latheFrom(PROFILES.beaker, 0.6, 1, 1, 20), kit.mats.clearPlastic('#f3ecff', 0.3));
  mixGlass.position.copy(mixBeaker.position);
  const vortex = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 18, 1, true), kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })));
  vortex.rotation.x = Math.PI;
  vortex.position.set(1.15, 0.38, 0);
  condGroup.add(burner, flame, coreFlame, ring, hotFlask, hotGlass, tray, ice, coldBeaker, coldGlass, plate, mixBeaker, mixGlass, vortex);
  const condSigns = [
    kit.neonSign('HEAT', [4.25, 1.66, 2.6], { height: 0.26, color: CORAL, rotY: -0.25, backing: false }),
    kit.neonSign('COOL', [5.25, 1.66, 2.85], { height: 0.26, color: AQUA, rotY: -0.25, backing: false }),
    kit.neonSign('MIX', [6.25, 1.66, 3.1], { height: 0.26, color: VIOLET, rotY: -0.25, backing: false }),
  ];
  condSigns.forEach((s) => (s.rotation.x = -0.5));

  // ---- Top corners: the Evidence-o-meter (left) and the colour-wheel spotlight (right)
  const dialTex = canvasTex(kit, 512, 512, (ctx) => {
    ctx.fillStyle = '#1a0c1c';
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 34;
    for (let i = 0; i < 24; i++) {
      const a0 = Math.PI * (0.8 + (1.4 * i) / 24);
      const a1 = Math.PI * (0.8 + (1.4 * (i + 1)) / 24) - 0.02;
      ctx.strokeStyle = mix(CORAL, MINT, i / 23);
      ctx.beginPath();
      ctx.arc(256, 256, 190, a0, a1);
      ctx.stroke();
    }
    ctx.fillStyle = IVORY;
    ctx.font = '800 46px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EVIDENCE', 256, 380);
    ctx.font = '700 30px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = CORAL;
    ctx.fillText('CLUE', 120, 300);
    ctx.fillStyle = MINT;
    ctx.fillText('STRONG', 392, 300);
    ctx.strokeStyle = '#d9a85b';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(256, 256, 246, 0, TAU);
    ctx.stroke();
  });
  const meter = new THREE.Group();
  const dialMat = kit.track(new THREE.MeshStandardMaterial({ map: dialTex, emissive: '#ffffff', emissiveMap: dialTex, emissiveIntensity: 0.1, roughness: 0.5 }));
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.95, 48), dialMat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.06, 10, 48), kit.mats.brass());
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.03), kit.track(new THREE.MeshStandardMaterial({ color: '#fff7e7', emissive: GOLD, emissiveIntensity: 0.4 })));
  needle.geometry.translate(0, 0.32, 0);
  needle.position.z = 0.04;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), kit.mats.brass());
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.05;
  meter.add(dial, rim, needle, hub);
  meter.position.set(-4.75, 1.45, -4.9);
  meter.rotation.set(-0.55, 0.35, 0);
  meter.scale.setScalar(0.78);
  kit.add(meter);
  kit.pole([-4.75, 0, -5.05], 0.75, BRASS);
  const spot = colorSpot(kit, [4.75, 1.55, -4.9], [1.5, 0.2, -1.5]);
  spot.g.scale.setScalar(0.8);
  kit.pole([4.75, 0, -4.9], 1.15, BRASS);

  // ---- Footlights along both sides of the cabinet
  const footN = kit.n(18);
  const footMat = kit.track(new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  const foot = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 12, 8), footMat, footN * 2);
  const footCol: THREE.Color[] = [];
  for (let i = 0; i < footN * 2; i++) {
    const sx = i < footN ? -1 : 1;
    const k = i % footN;
    d0.position.set(sx * 3.82, gy + 0.12, -5.2 + (10.2 * k) / Math.max(1, footN - 1));
    d0.rotation.set(0, 0, 0);
    d0.scale.setScalar(1);
    d0.updateMatrix();
    foot.setMatrixAt(i, d0.matrix);
    foot.setColorAt(i, new THREE.Color('#3a2a20'));
    footCol.push(new THREE.Color(k % 3 === 0 ? GOLD : k % 3 === 1 ? '#ffe6b8' : CORAL));
  }
  kit.add(foot);
  const footTrim = [-1, 1].map((sx) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 10.6), kit.mats.brass());
    m.position.set(sx * 3.82, gy + 0.04, 0);
    return kit.add(m);
  });
  void footTrim;

  // ---- Wonderlight light-and-color show: sweeping beams, confetti and fireworks
  const beamMats: THREE.MeshBasicMaterial[] = [];
  const beams: THREE.Mesh[] = [];
  const beamCols = [CORAL, GOLD, MINT, AQUA, VIOLET, YELLOW];
  const beamGeo = new THREE.CylinderGeometry(0.04, 0.5, 4.6, 24, 1, true);
  beamGeo.translate(0, -2.3, 0);
  // Soft light shaft: bright at the lamp, fading toward the floor and toward the edges.
  const shaftTex = canvasTex(kit, 64, 256, (ctx) => {
    for (let x = 0; x < 64; x++) {
      const edge = Math.sin((x / 63) * Math.PI);
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * edge})`);
      g.addColorStop(0.6, `rgba(255,255,255,${0.35 * edge})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 1, 256);
    }
  });
  for (let i = 0; i < 6; i++) {
    const sx = i < 3 ? -1 : 1;
    const m = kit.track(new THREE.MeshBasicMaterial({ map: shaftTex, color: beamCols[i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beamMats.push(m);
    const b = new THREE.Mesh(beamGeo, m);
    b.position.set(sx * (4.6 + (i % 3) * 0.9), 4.6, -4.6 + (i % 3) * 3.4);
    kit.add(b);
    beams.push(b);
  }
  // Coloured light pools that dance across the stage boards beside the cabinet
  const poolTex = canvasTex(kit, 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  const poolSpots: [number, number, number][] = [[-4.7, -3.6, 1.0], [-7.2, 0.6, 1.2], [-4.5, 4.4, 0.9], [4.7, -3.6, 1.0], [7.2, 0.6, 1.2], [4.5, 4.4, 0.9]];
  const poolMats = poolSpots.map(([x, z, r], i) => {
    const m = kit.track(new THREE.MeshBasicMaterial({ map: poolTex, color: beamCols[i], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 32), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, gy + 0.015, z);
    kit.add(mesh);
    return m;
  });
  const confettiA = kit.motes({ x0: -9, x1: -3.9, y0: 0, y1: 4.5, z0: -6, z1: 5 }, 90, YELLOW, { speed: 0.4, size: 0.16 });
  const confettiB = kit.motes({ x0: 3.9, x1: 9, y0: 0, y1: 4.5, z0: -6, z1: 5 }, 90, VIOLET, { speed: 0.4, size: 0.16 });
  const dust = kit.motes({ x0: -11, x1: 11, y0: 0.2, y1: 6, z0: -12, z1: 6 }, 90, '#ffe9c4', { speed: 0.06, size: 0.07 });
  // Bursts sit just inside the swung-open wings (the wings would hide them further out).
  const fw = kit.fireworks({ x0: -6.5, x1: -5.6, y0: 2.5, y1: 3.2, z: -3.6 }, [CORAL, GOLD, MINT, AQUA, VIOLET]);
  const fw2 = kit.fireworks({ x0: 5.6, x1: 6.5, y0: 2.5, y1: 3.2, z: -3.6 }, [VIOLET, YELLOW, AQUA, CORAL, MINT]);

  // ---- Lights (three at most)
  const spotL = kit.spot([-3.2, 6.5, 3.5], [-5.7, 1.0, -1.4], '#ffd9a8', 26, 0.45);
  const spotR = kit.spot([3.2, 6.5, 3.5], [5.7, 1.0, -1.4], '#fff0c8', 26, 0.45);
  const flaskLight = kit.point([-5.35, 1.0, 2.55], MINT, 0, 4.5);

  let wheelAngle = 0;
  let needleA = 2.2;
  let boost = 0;
  let wingOpen = 0;
  const tmp = new THREE.Color();
  const hsl = new THREE.Color();
  const dummy = new THREE.Object3D();
  return {
    update(t, dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.3, 1.1);
      const s2 = kit.stage(level, 1.3, 2.1);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      const b = boost;
      boost = Math.max(0, boost - dt * 0.7);
      const motion = !kit.reducedMotion;
      panorama.repaint(level);
      // Always alive: the marquee and the case backlights glow a little even when dormant
      marquee.setLit(0.2 + 0.8 * Math.max(s3, b));
      beforeCase.setLit(0.25 + 0.75 * s1 + 0.3 * Math.max(s4, b));
      afterCase.setLit(0.2 + 0.8 * s1 + 0.3 * Math.max(s4, b));
      beforeSign.setLit(0.25 + 0.75 * s1);
      afterSign.setLit(0.25 + 0.75 * s1);
      if (spotL) spotL.intensity = 14 + 16 * s0;
      if (spotR) spotR.intensity = 14 + 16 * s0;
      // Footlights: warm at level 1, chasing colours at the Wonderlight
      for (let i = 0; i < footN * 2; i++) {
        const k = i % footN;
        const chase = motion && s4 > 0.01 ? 0.5 + 0.5 * Math.sin(t * 6 - k * 0.7) : 1;
        const v = 0.12 + 0.88 * s1 * (s4 > 0.01 ? 0.4 + 0.6 * chase : 1);
        tmp.copy(footCol[i]).multiplyScalar(0.25 + 1.3 * v);
        if (s4 > 0.01) tmp.lerp(hsl.setHSL((k / footN + t * 0.1) % 1, 0.8, 0.6), 0.6 * s4);
        foot.setColorAt(i, tmp);
      }
      if (foot.instanceColor) foot.instanceColor.needsUpdate = true;
      // AFTER fizz and odor wisps (level 1)
      for (let i = 0; i < fizzN; i++) {
        const ph = motion ? (t * (0.4 + (i % 4) * 0.12) + i / fizzN) % 1 : i / fizzN;
        const base = i % 2 ? -0.55 : 0.55;
        dummy.position.set(base + Math.sin(i * 7.1) * 0.06, 0.99 + 0.12 + ph * 0.45 * (0.3 + s1), Math.cos(i * 3.7) * 0.06);
        dummy.scale.setScalar((0.4 + 0.6 * s1) * (1 - ph * 0.5));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        fizz.setMatrixAt(i, dummy.matrix);
      }
      fizz.instanceMatrix.needsUpdate = true;
      wispMat.opacity = 0.05 + 0.5 * s1 * (motion ? 0.7 + 0.3 * Math.sin(t * 1.3) : 1);
      if (motion) for (let k = 0; k < wisps.length; k++) wisps[k].rotation.y = Math.sin(t * 0.6 + k) * 0.3;
      // Level 2: the bubble flask boils over with light; the conditions glow
      liquidMat.emissiveIntensity = 0.12 + 0.95 * s2 + 0.35 * s4 + 0.4 * b;
      if (s4 > 0.01) liquidMat.emissive.setHSL((t * 0.05) % 1, 0.75, 0.55);
      else liquidMat.emissive.set(MINT);
      if (flaskLight) flaskLight.intensity = 2.2 * s2 + 1.5 * s4 + 3 * b;
      const vig = 0.25 + 0.75 * s2 + 0.5 * s4;
      for (let i = 0; i < bubN; i++) {
        const info = bubInfo[i];
        const ph = motion ? (info.ph + t * info.sp * (0.15 + 0.6 * vig)) % 1 : info.ph;
        const y = 0.05 + ph * flaskH * 0.42;
        const prof = Math.max(0.12, 0.4 - (y / flaskH) * 0.38);
        const rr = info.r * prof * flaskH * 0.85;
        dummy.position.set(Math.cos(info.a + ph * 2) * rr, y, Math.sin(info.a + ph * 2) * rr);
        dummy.scale.setScalar(info.sz * (0.5 + 0.5 * vig) * (ph > 0.94 ? 0.3 : 1));
        dummy.updateMatrix();
        bubbles.setMatrixAt(i, dummy.matrix);
      }
      bubbles.instanceMatrix.needsUpdate = true;
      hotFlaskMat.emissiveIntensity = 0.08 + 1.2 * s2;
      coldMat.emissiveIntensity = 0.08 + 0.6 * s2;
      iceMat.emissiveIntensity = 0.05 + 0.3 * s2;
      mixMat.emissiveIntensity = 0.08 + 1.2 * s2;
      flameMat.opacity = 0.15 + 0.75 * s2;
      flame.scale.set(1, (0.4 + 0.6 * s2) * (motion ? 0.88 + 0.12 * Math.sin(t * 17) + 0.06 * Math.sin(t * 29) : 1), 1);
      if (motion) vortex.rotation.y += dt * (1 + 7 * s2);
      for (let k = 0; k < condSigns.length; k++) condSigns[k].setLit(0.2 + 0.8 * s2);
      // Level 3: the Evidence-o-meter swings from CLUE to STRONG
      const target = 2.2 - 4.4 * Math.min(1, 0.15 + 0.25 * s1 + 0.25 * s2 + 0.35 * s3);
      needleA += (target - needleA) * Math.min(1, dt * 2);
      needle.rotation.z = needleA + (motion ? Math.sin(t * 3) * 0.02 * (1 + energy) : 0);
      dialMat.emissiveIntensity = 0.12 + 0.8 * Math.max(s1 * 0.4, s3);
      spot.lensMat.emissiveIntensity = 0.1 + 2.5 * s3 + 2 * b;
      for (let i = 0; i < spot.gelMats.length; i++) spot.gelMats[i].emissiveIntensity = 0.08 + (0.6 + 0.4 * Math.sin(t * 2 + i)) * (0.4 * s3 + 1.6 * s4 + b);
      if (motion) wheelAngle += dt * (0.1 + 0.4 * s3 + 1.6 * s4 + 2 * b);
      spot.wheel.rotation.z = wheelAngle;
      dust.setLit(0.25 + 0.5 * s1);
      // Level 4: wings swing open, beams sweep, confetti and fireworks
      const open = Math.max(s4, b * 0.5);
      wingOpen += (open - wingOpen) * Math.min(1, dt * 1.2);
      for (let i = 0; i < wings.length; i++) wings[i].rotation.y = (i ? 1 : -1) * (0.55 + 0.35 * wingOpen);
      for (let i = 0; i < beams.length; i++) {
        const bm = beams[i];
        const sx = i < 3 ? -1 : 1;
        beamMats[i].opacity = 0.42 * Math.max(s4, b);
        if (motion) {
          bm.rotation.z = sx * (0.35 + 0.22 * Math.sin(t * 0.8 + i * 1.3));
          bm.rotation.x = 0.25 * Math.sin(t * 0.6 + i);
        } else {
          bm.rotation.z = sx * 0.35;
        }
      }
      confettiA.setLit(0.85 * Math.max(s4, b));
      confettiB.setLit(0.85 * Math.max(s4, b));
      fw.setLit(Math.max(kit.stage(level, 3.6, 4), b));
      fw2.setLit(Math.max(kit.stage(level, 3.6, 4), b));
      for (let i = 0; i < poolMats.length; i++) {
        const m = poolMats[i];
        m.opacity = 0.55 * Math.max(s4, b * 0.8) * (motion ? 0.65 + 0.35 * Math.sin(t * 1.7 + i * 1.9) : 1);
        if (motion && s4 > 0.01) m.color.setHSL((t * 0.08 + i / 6) % 1, 0.85, 0.6);
      }
    },
    celebrate(p) {
      boost = Math.max(boost, Math.sin(Math.min(1, p) * Math.PI));
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const revelryRoom: RoomBuilder = ({ kit }) => {
  const velvet = kit.track(new THREE.MeshPhysicalMaterial({ color: '#7a1430', roughness: 0.8, sheen: 1, sheenColor: new THREE.Color('#ff86a3'), sheenRoughness: 0.45 }));
  const curtain = new THREE.Mesh(curtainGeo(2.0, 1.6, 7, 0.04), velvet);
  curtain.position.set(0, 0.8, -0.84);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 1.3), kit.mats.wood());
  floor.position.set(0, 0.04, -0.15);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 10, 40, Math.PI), kit.mats.brass());
  arch.position.set(0, 0.62, -0.62);
  kit.add(curtain);
  kit.add(floor);
  kit.add(arch);
  const caseMats: THREE.MeshStandardMaterial[] = [];
  for (const [x, c] of [[-0.55, AQUA], [0.55, YELLOW]] as [number, string][]) {
    const m = kit.track(new THREE.MeshStandardMaterial({ color: '#140a14', emissive: c, emissiveIntensity: 0.05, transparent: true, opacity: 0.85 }));
    caseMats.push(m);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.26), m);
    box.position.set(x, 0.34, -0.3);
    kit.add(box);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), kit.mats.brass());
    cap.position.set(x, 0.62, -0.3);
    kit.add(cap);
  }
  const bridgeMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0c1a18', emissive: MINT, emissiveIntensity: 0.05 }));
  const bridgePts = [[-0.55, 0.62], [-0.5, 0.86], [-0.25, 1.0], [0, 1.04], [0.25, 1.0], [0.5, 0.86], [0.55, 0.62]].map(([x, y]) => new THREE.Vector3(x, y, -0.3));
  const bridge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bridgePts), 40, 0.035, 8), bridgeMat);
  kit.add(bridge);
  const flaskMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0d2a2a', emissive: MINT, emissiveIntensity: 0.05, transparent: true, opacity: 0.9 }));
  const flaskLiquid = new THREE.Mesh(latheFrom(PROFILES.erlen, 0.42, 0.9, 0.45, 20), flaskMat);
  flaskLiquid.position.set(0, 0.08, 0.05);
  const flaskGlass = new THREE.Mesh(latheFrom(PROFILES.erlen, 0.42, 1, 1, 20), kit.mats.clearPlastic('#e8fbff', 0.3));
  flaskGlass.position.copy(flaskLiquid.position);
  kit.add(flaskLiquid);
  kit.add(flaskGlass);
  const sign = kit.neonSign('REVELRY', [0, 1.38, -0.7], { height: 0.22, color: GOLD });
  const lampMat = kit.track(new THREE.MeshBasicMaterial({ color: '#3a2a20' }));
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), lampMat, 9);
  const d = new THREE.Object3D();
  for (let i = 0; i < 9; i++) {
    d.position.set(-0.8 + i * 0.2, 0.1, 0.45);
    d.updateMatrix();
    lamps.setMatrixAt(i, d.matrix);
  }
  kit.add(lamps);
  const warm = new THREE.Color('#ffd27a');
  const dark = new THREE.Color('#3a2a20');
  return {
    update(t, lit) {
      for (let k = 0; k < caseMats.length; k++) caseMats[k].emissiveIntensity = 0.05 + lit * 1.1;
      bridgeMat.emissiveIntensity = 0.05 + lit * (2 + (kit.reducedMotion ? 0 : 0.4 * Math.sin(t * 2)));
      flaskMat.emissiveIntensity = 0.05 + lit * 1.6;
      sign.setLit(lit);
      lampMat.color.copy(dark).lerp(warm, lit);
    },
  };
};

// ---------------------------------------------------------------- the attraction

export const L12: TableDef = {
  lessonId: 'L12',
  signature: 'The Reaction Bridge: each BEFORE sample rides a glass bridge over the stage into the AFTER cabinet',
  ballRole: 'The Wonderball is a game token, not a chemical sample: in a real reaction nothing crosses a bridge; the reactants\' own atoms rearrange to form the products.',
  theme: {
    bg: ['#3a1030', '#140818'],
    rail: '#e9c99a',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#d6f6ff',
    bumperRing: '#5a1030',
    flipper: '#ffe0a0',
    ink: IVORY,
    ramp: 'rgba(113,227,207,0.2)',
    trail: MINT,
  },
  lines: {
    intro: 'Welcome to Reaction Revelry, the only theater where the stars are brand-new substances! Tonight we find out which changes truly make something new.',
    quark: '"That kettle is bubbling like a fountain! Is the boiling water turning into a brand-new substance?" Professor Quark wonders.',
    pipTip: 'Launch at about half power to drop into the HEAT, COOL and MIX lanes, then aim the right flipper at the BEFORE cabinet.',
  },
  build,
  skillShot: 'lane_cool',
  shots: [
    { id: 'evidence', label: 'Evidence loop', on: [{ type: 'shot', id: 'left_loop_sw' }], insert: 'ins_left_loop' },
    { id: 'rightLoop', label: 'Right loop', on: [{ type: 'shot', id: 'right_loop_sw' }], insert: 'ins_right_loop' },
    { id: 'before', label: 'BEFORE cabinet', on: [{ type: 'saucer', id: 'before_cab' }], insert: 'ins_before' },
    { id: 'after', label: 'AFTER cabinet', on: [{ type: 'saucer', id: 'after_cab' }], insert: 'ins_after' },
    { id: 'reveal', label: 'REVEAL pocket', on: [{ type: 'saucer', id: 'reveal' }], insert: 'ins_reveal' },
    { id: 'physical', label: 'PHYSICAL bank', on: [{ type: 'drop', group: 'physical' }], insert: 'ins_physical' },
    { id: 'clues', label: 'Clue targets', on: [{ type: 'target', group: 'clues' }], insert: 'ins_clues' },
    { id: 'bubbles', label: 'Bubble bumpers', on: [{ type: 'bumper', group: 'bubbles' }], insert: 'ins_bubbles' },
    { id: 'lanes', label: 'Condition lanes', on: [{ type: 'rollover', group: 'conditions' }], insert: 'ins_lanes' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Spot the Clues',
      brief: 'The BEFORE cabinet holds the reactants. Send a sample over the Reaction Bridge, spot four clues of change, then check the AFTER cabinet.',
      objectiveIds: ['L12-O1'],
      stages: [
        { kind: 'collect', text: 'Open the BEFORE cabinet: meet the reactants', match: { type: 'saucer', id: 'before_cab' }, count: 1, preview: ['before'] },
        { kind: 'collect', text: 'Spot 4 clues: COLOR, SOLID, GAS, ODOR', match: { type: 'target', group: 'clues' }, count: 4, distinct: true, lamps: ['clue_color', 'clue_solid', 'clue_gas', 'clue_odor'], preview: ['clues'] },
        { kind: 'collect', text: 'Check the AFTER cabinet for products', match: { type: 'saucer', id: 'after_cab' }, count: 1, preview: ['after'] },
        { kind: 'discover', text: 'Shoot the REVEAL pocket', pocket: 'reveal', questions: 1 },
      ],
      discovery: 'Reactants are the substances you start with; products are the new substances a reaction makes. A new color, a solid in a liquid, a gas or a new smell is an observation: a clue, not yet a conclusion.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Change or Reaction?',
      brief: 'Boiling water bubbles too! Pop the bubbles, try the conditions that start reactions, then knock down the physical changes to compare.',
      objectiveIds: ['L12-O2', 'L12-O3'],
      stages: [
        { kind: 'collect', text: 'Pop the bubble bumpers 6 times', match: { type: 'bumper', group: 'bubbles' }, count: 6, preview: ['bubbles'] },
        { kind: 'collect', text: 'Heat, cool or mix: roll the condition lanes twice', match: { type: 'rollover', group: 'conditions' }, count: 2, lamps: ['lane_heat', 'lane_cool', 'lane_mix'], preview: ['lanes'] },
        { kind: 'collect', text: 'Drop BOIL, MELT and DISSOLVE: physical changes', match: { type: 'drop', group: 'physical' }, count: 3, distinct: true, lamps: ['physical_bank_1', 'physical_bank_2', 'physical_bank_3'], preview: ['physical'] },
        { kind: 'discover', text: 'Shoot the REVEAL pocket to compare', pocket: 'reveal', questions: 1, types: ['classify', 'single', 'multi'] },
      ],
      discovery: 'Boiling water bubbles and melting ice cools a drink, yet nothing new forms: both are physical changes. A reaction makes new substances, and whether one starts depends on the substances and the conditions.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Prove It!',
      brief: 'A clue is not proof. Like testing aspirin against the salicylic acid it was made from, compare BEFORE and AFTER, run more tests, then make your claim.',
      objectiveIds: ['L12-O4', 'L12-O5'],
      stages: [
        { kind: 'shots', text: 'Compare: ride a BEFORE sample over to AFTER', shots: ['before', 'after'], order: 'sequence' },
        { kind: 'collect', text: 'Run 3 tests through the EVIDENCE spinner', match: { type: 'spinner', id: 'evidence_spinner' }, count: 3, preview: ['evidence'] },
        { kind: 'discover', text: 'Make your claim at the REVEAL pocket', pocket: 'reveal', questions: 1 },
      ],
      discovery: 'To show a new substance formed, compare before-and-after properties such as melting point and solubility. One changed measurement is a clue; several tests that agree make a strong case.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'The Grand Reveal',
    brief: 'Stage the light-and-color show: both loops, the Reaction Bridge and the condition lanes, then take a bow in the REVEAL pocket.',
    stages: [
      { kind: 'shots', text: 'Light the show: loops, bridge and lanes', shots: ['evidence', 'rightLoop', 'before', 'lanes'], order: 'any' },
      { kind: 'discover', text: 'Take a bow at the REVEAL pocket', pocket: 'reveal', questions: 2 },
    ],
    celebration: 'Lights up! Every color on this stage was earned with evidence, not guesses. The Reaction Revelry Wonderlight is yours!',
  },
  set: revelrySet,
  room: revelryRoom,
  icons: {
    bubble(ctx, s) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s * 0.13;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, TAU);
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.55, Math.PI * 1.08, Math.PI * 1.52);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s * 0.3, s * 0.28, s * 0.17, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.08, s * 0.5, s * 0.09, 0, TAU);
      ctx.fill();
    },
    cabinet(ctx, s) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s * 0.14;
      ctx.strokeRect(-s * 0.6, -s * 0.55, s * 1.2, s * 1.45);
      ctx.beginPath();
      ctx.moveTo(-s * 0.75, -s * 0.55);
      ctx.lineTo(0, -s * 0.95);
      ctx.lineTo(s * 0.75, -s * 0.55);
      ctx.stroke();
      ctx.fillRect(-s * 0.55, s * 0.05, s * 1.1, s * 0.1);
      ctx.fillRect(-s * 0.35, -s * 0.3, s * 0.2, s * 0.35);
      ctx.fillRect(s * 0.12, -s * 0.22, s * 0.22, s * 0.27);
    },
    curtain(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.95, -s * 0.9);
      ctx.lineTo(-s * 0.1, -s * 0.9);
      ctx.quadraticCurveTo(-s * 0.45, 0, -s * 0.75, s * 0.9);
      ctx.lineTo(-s * 0.95, s * 0.9);
      ctx.closePath();
      ctx.moveTo(s * 0.95, -s * 0.9);
      ctx.lineTo(s * 0.1, -s * 0.9);
      ctx.quadraticCurveTo(s * 0.45, 0, s * 0.75, s * 0.9);
      ctx.lineTo(s * 0.95, s * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * TAU;
        const r = i % 2 ? s * 0.13 : s * 0.3;
        ctx.lineTo(Math.cos(a) * r, s * 0.15 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    },
  },
  scenery: {
    backdrop(c) {
      paintBackdrop(c);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s1 = stage(level, 0.2, 1.1);
      const s2 = stage(level, 1.2, 2.1);
      const s4 = stage(level, 3.4, 4);
      if (!reduced && s1 > 0.02) footlights(ctx, s1 * (0.7 + 0.3 * energy), t, s4);
      if (!reduced) {
        // bubbles rise in the printed flask, faster once mission 2 is solved
        ctx.save();
        flaskPath(ctx);
        ctx.closePath();
        ctx.clip();
        drift(ctx, 17, 14 + Math.round(16 * s2), t, MINT, [150, 90, 470, 266], 14 + 26 * s2, 2.4, 0.25 + 0.45 * s2);
        ctx.restore();
      }
      if (!reduced && s4 > 0.01) {
        for (let i = 0; i < 4; i++) {
          const ph = (t * 0.3 + i / 4) % 1;
          const c = SHOW4[i];
          glowDot(ctx, 80 + i * 140 + Math.sin(t * 0.7 + i) * 30, 300 + ph * 420, 26, c, 0.3 * s4 * Math.sin(ph * Math.PI));
        }
      }
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.55;
      const g = ctx.createRadialGradient(286, 476, 10, 286, 476, 460);
      g.addColorStop(0, rgba(GOLD, 0.85));
      g.addColorStop(0.5, rgba(VIOLET, 0.25));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      const cols = SHOW6;
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU + t * 0.5;
        const d = 50 + p * 300;
        glowDot(ctx, 286 + Math.cos(a) * d, 476 + Math.sin(a) * d * 0.85, 11, cols[i % cols.length], 1 - p);
      }
    },
  },
};
export default L12;
