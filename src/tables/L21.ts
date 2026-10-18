// Lesson 21 — Interactions Among Organisms — "Wild Alliance Ballroom"
// A moonlit woodland masquerade. Every guest wears a mask, and every dance has two partners.
// Signature: Alliance Pairs, linked standup targets that always light together, because an
// interaction has two participants and is rated by its effect on each: ANT and APHID under the Great Oak's branches
// (mutualism, + +) and SQUIRREL and JAY on the lips of the two chase funnels, rivals for the
// oak's acorns (competition, − −). The Chase alternates the MOOSE RUN (prey, left orbit) and
// the WOLF TRAIL (predator, right orbit); one-way Ballroom Doors turn every run and every full
// plunge into the masquerade bumpers (OWL carnivore, DEER herbivore, RACCOON omnivore). The
// wolf trail feeds the left flipper for the ELK herd bank, so the Yellowstone ripple is a real
// combo. The Wonder Pocket is the Oak Hollow, and the top lanes are a dance card of the four
// ways an interaction can rate: + +, + 0, + −, − −.

import type * as THREE from 'three';
import { FRAME, type TableBuilder, type Pt } from '../game/table/builder.ts';
import { Target } from '../game/table/mechanisms.ts';
import type { Ball } from '../game/physics/ball.ts';
import type { Collider, ContactInfo } from '../game/physics/types.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { Lit, RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import {
  TAU, drift, glowDot, leafShape, mix, neonPath, neonText, plaque, rgba, rng, rrect, stage, stars, vgrad,
} from '../game/render/art.ts';

const MOON = '#FFD27A';
const ROSE = '#FF8FA3';
const LEAF = '#A8E07A';
const IVORY = '#FFF7E7';
const PLUS = '#7EE0A4';
const MINUS = '#FF7F86';
const ZERO = '#CBC3EA';
const FIREFLY = '#D8F27A';
const AMBER = '#FFB35C';
const DUSK = '#9FB4FF';
const BARK = '#6A452F';
const BARK_DK = '#2E1C14';
const CANOPY = '#3F7A4E';
const NIGHT = '#140C20';
const GOLD = '#FFC75B';

// ---------------------------------------------------------------- signature mechanism

/**
 * A standup target that belongs to an interaction pair. Hitting either partner lights both,
 * since an interaction always involves two participants (each rated +, − or 0). Only the outer face scores, so a ball
 * rattling behind it never trips it.
 */
class PartnerTarget extends Target {
  partner: PartnerTarget | null = null;
  readonly fx: number;
  readonly fy: number;
  constructor(rt: TableRuntime, id: string, a: Pt, b: Pt, face: Pt, opts: { group: string; label: string }) {
    super(rt, id, a[0], a[1], b[0], b[1], opts);
    const l = Math.hypot(face[0], face[1]) || 1;
    this.fx = face[0] / l;
    this.fy = face[1] / l;
  }
  get mx() {
    return (this.x1 + this.x2) / 2;
  }
  get my() {
    return (this.y1 + this.y2) / 2;
  }
  onContact(_c: Collider, ball: Ball, info: ContactInfo) {
    if ((ball.x - this.mx) * this.fx + (ball.y - this.my) * this.fy < 0) return;
    if (info.impact < 90 || !this.ready(ball, 0.2)) return;
    this.hitFlash = 0.3;
    this.wobble = 1;
    this.rt.emit({ type: 'target', id: this.id, group: this.group, ball, x: this.mx, y: this.my });
    const p = this.partner;
    if (p) {
      p.hitFlash = 0.5;
      p.wobble = 0.7;
      this.rt.emit({ type: 'target', id: p.id, group: p.group, ball, x: p.mx, y: p.my });
    }
  }
}

interface PartnerSpec {
  id: string;
  label: string;
  seg: [Pt, Pt];
  face: Pt;
}

function pair(b: TableBuilder, group: string, a: PartnerSpec, c: PartnerSpec) {
  const t1 = b.rt.add(new PartnerTarget(b.rt, a.id, a.seg[0], a.seg[1], a.face, { group, label: a.label }));
  const t2 = b.rt.add(new PartnerTarget(b.rt, c.id, c.seg[0], c.seg[1], c.face, { group, label: c.label }));
  t1.partner = t2;
  t2.partner = t1;
}

// ---------------------------------------------------------------- playfield geometry

/** Great Oak: hollow slot (Wonder Pocket), roots, trunk and two branches (ally targets below). */
const OAK = {
  slotL: 262,
  slotR: 310,
  slotTop: 410,
  slotBottom: 508,
  pocket: [286, 474] as Pt,
  // Branch undersides, trunk-side end first: ANT (left) and APHID (right).
  ant: [[248, 458], [194, 436]] as [Pt, Pt],
  aphid: [[378, 436], [324, 458]] as [Pt, Pt],
};
/** Solid body of the oak (for the printed bark) and its hollow. */
const OAK_BODY: Pt[] = [
  [262, 508], [238, 544], [248, 502], [248, 458], [194, 436], [184, 424], [228, 396], [250, 368], [286, 354],
  [322, 368], [344, 396], [388, 424], [378, 436], [324, 458], [324, 502], [334, 544], [310, 508], [310, 410],
  [286, 396], [262, 410],
];
const HOLLOW: Pt[] = [[262, 508], [262, 410], [286, 396], [310, 410], [310, 508]];
/** Chase funnels: inner walls that turn steep flipper shots up the side orbits. */
const MOOSE_FUNNEL: Pt[] = [[150, 486], [128, 396], [108, 316], [98, 256]];
const WOLF_FUNNEL: Pt[] = MOOSE_FUNNEL.map(([x, y]) => [572 - x, y] as Pt);
/** Funnel lips: the rival pair, SQUIRREL (left) and JAY (right), facing the flippers. */
const SQUIRREL_SEG: [Pt, Pt] = [[150, 486], [176, 496]];
const JAY_SEG: [Pt, Pt] = [[396, 496], [422, 486]];
const ELK_X = 537;
const ELK_Y = 522;
const LANES_X = [220, 264, 308, 352];
const LANE_Y = 136;
const SIGNS = ['+ +', '+ 0', '+ −', '− −'];
const MASKS = { owl: [196, 254] as Pt, deer: [286, 222] as Pt, raccoon: [376, 254] as Pt };

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- The Chase, prey side: MOOSE RUN (left orbit). A wide funnel mouth turns steep shots
  // from the right flipper up the side and over the top. ---
  b.wall(MOOSE_FUNNEL, { id: 'moose_funnel', r: 3 });
  b.post(98, 252, 5, { id: 'moose_post' });
  b.shotSwitch('moose_sw', 58, 300, -90);
  b.spinner('moose_spinner', [27, 352], [110, 352], { label: 'MOOSE' });
  // One-way flap low on the left: failed runs are thrown to the inlane, the kickback fires through.
  b.gate('moose_flap', [FRAME.left, 654], [70, 714], -90);
  // Ballroom Doors: one-way gates over both chase channels. A run passes up and over the top;
  // a ball coming back down (or a full plunge) is turned into the masquerade instead.
  b.gate('moose_door', [44, 202], [94, 250], -90);

  // --- The Chase, predator side: WOLF TRAIL (right orbit) ---
  b.wall(WOLF_FUNNEL, { id: 'wolf_funnel', r: 3 });
  b.post(474, 252, 5, { id: 'wolf_post' });
  b.shotSwitch('wolf_sw', 514, 300, -90);
  b.spinner('wolf_spinner', [462, 352], [545, 352], { label: 'WOLF' });
  b.wall([[FRAME.laneSep, 654], [502, 716]], { id: 'wolf_deflect', r: 3 });
  b.gate('wolf_door', [478, 250], [576, 202], -90);
  // HOWL: the skill-shot switch where a soft plunge drops onto the wolf trail.
  b.rollover('howl', 458, 450, { label: 'HOWL', group: 'trail', r: 16 });

  // --- Alliance pair 2, competition (− −): SQUIRREL and JAY on the funnel lips ---
  pair(b, 'rivals',
    { id: 'squirrel', label: 'SQUIRREL −', seg: SQUIRREL_SEG, face: [-0.36, 0.93] },
    { id: 'jay', label: 'JAY −', seg: JAY_SEG, face: [0.36, 0.93] });

  // --- The Great Oak with the Oak Hollow (Wonder Pocket) ---
  const { slotL, slotR, slotTop, slotBottom } = OAK;
  b.wall([[slotL, slotBottom], [slotL, slotTop], [286, slotTop - 14], [slotR, slotTop], [slotR, slotBottom]], { id: 'oak_hollow_wall', r: 3 });
  // Roots flare out to funnel shots into the hollow, then the trunk and branches.
  b.wall([[slotL, slotBottom], [238, 544], [248, 502], OAK.ant[0]], { id: 'oak_left', r: 3, style: 'wood' });
  b.wall([OAK.ant[1], [184, 424], [228, 396], [250, 368], [286, 354], [322, 368], [344, 396], [388, 424], OAK.aphid[0]], { id: 'oak_crown', r: 3, style: 'wood' });
  b.wall([OAK.aphid[1], [324, 502], [334, 544], [slotR, slotBottom]], { id: 'oak_right', r: 3, style: 'wood' });
  b.saucer('oak_hollow', OAK.pocket[0], OAK.pocket[1], { role: 'pocket', ejectDeg: 98, ejectSpeed: 900, captureMaxSpeed: 2400, label: 'HOLLOW', icon: 'acorn' });

  // --- Alliance pair 1, mutualism (+ +): ANT and APHID tend each other on the oak's branches ---
  pair(b, 'allies',
    { id: 'ant', label: 'ANT +', seg: OAK.ant, face: [-0.377, 0.926] },
    { id: 'aphid', label: 'APHID +', seg: OAK.aphid, face: [0.377, 0.926] });

  // --- Masquerade bumpers: the three kinds of predator, by what they mainly eat ---
  b.bumper('mask_owl', MASKS.owl[0], MASKS.owl[1], { group: 'masks', label: 'OWL', icon: 'maskOwl', r: 24 });
  b.bumper('mask_deer', MASKS.deer[0], MASKS.deer[1], { group: 'masks', label: 'DEER', icon: 'maskDeer', r: 24 });
  b.bumper('mask_raccoon', MASKS.raccoon[0], MASKS.raccoon[1], { group: 'masks', label: 'RACCOON', icon: 'maskRaccoon', r: 24 });

  // --- Dance card lanes: the four ways an interaction can rate ---
  LANES_X.forEach((x, i) => b.rollover(`card_${i + 1}`, x, LANE_Y, { group: 'card', label: SIGNS[i] }));
  for (const gx of [198, 242, 286, 330, 374]) {
    b.wall([[gx, 112], [gx, 160]], { r: 3 });
    b.post(gx, 110, 5);
  }

  // --- ELK herd: three drop targets along the right wall, below the Wolf Trail ---
  b.dropBank('elk', ELK_X, ELK_Y, 90, 3, { size: 26, gap: 6, group: 'elk', labels: ['ELK', 'ELK', 'ELK'] });

  // --- Inserts ---
  b.insert('ins_moose', 94, 522, { deg: -104, label: 'MOOSE RUN', color: AMBER });
  b.insert('ins_wolf', 478, 522, { deg: -76, label: 'WOLF TRAIL', color: DUSK });
  b.insert('ins_pocket', 286, 572, { deg: -90 });
  b.insert('ins_elk', 486, 612, { deg: -8, label: 'ELK', color: LEAF });
  b.insert('ins_allies', 222, 484, { shape: 'star', size: 10, color: PLUS });
  b.insert('ins_rivals', 160, 528, { shape: 'star', size: 10, color: MINUS });
  b.insert('ins_masks', 286, 292, { shape: 'star', size: 10, color: ROSE });
  b.insert('ins_card', 286, 180, { shape: 'star', size: 9, color: MOON });
}

// ---------------------------------------------------------------- printed playfield art

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Night-dimmed colour that wakes as the attraction is restored. */
function dim(c: string, level: number, amt = 0.62) {
  return mix(c, NIGHT, amt * (1 - 0.75 * stage(level, 0, 3.6)));
}

/** Cubic point helper for threads. */
function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** A glowing partner thread with sign beads (+, −) along it. */
function thread(ctx: CanvasRenderingContext2D, p: [Pt, Pt, Pt, Pt], color: string, sign: string, lit: number) {
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    ctx.bezierCurveTo(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]);
  }, color, lit, 2.5);
  ctx.save();
  ctx.font = '800 11px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of [0.14, 0.86]) {
    const [x, y] = bez(p[0], p[1], p[2], p[3], t);
    glowDot(ctx, x, y, 12, color, 0.25 + 0.5 * lit);
    ctx.fillStyle = 'rgba(20,12,30,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 7.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(color, 0.45 + 0.55 * lit);
    ctx.fillText(sign, x, y + 0.5);
  }
  ctx.restore();
}

function hoof(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * s * 0.27, 0, s * 0.2, s * 0.5, sx * 0.12, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function paw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.18, s * 0.34, s * 0.28, 0, 0, TAU);
  ctx.fill();
  for (const [tx, ty] of [[-0.36, -0.18], [-0.13, -0.42], [0.13, -0.42], [0.36, -0.18]]) {
    ctx.beginPath();
    ctx.ellipse(tx * s, ty * s, s * 0.12, s * 0.16, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function acornGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, nut: string, cap: string, glow: number) {
  if (glow > 0.01) glowDot(ctx, x, y, s * 2.2, GOLD, 0.45 * glow);
  ctx.fillStyle = nut;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.25, s * 0.55, s * 0.7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.25, s * 0.68, s * 0.36, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - s * 0.06, y - s * 0.8, s * 0.12, s * 0.3);
}

/** A willow: drooping strands that are browsed short when dormant and lush when restored. */
function willow(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, lush: number, seed: number) {
  const r = rng(seed);
  const len = h * (0.35 + 0.65 * lush);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = mix('#3b2a1e', '#5a4030', lush);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 2, y - len * 0.55);
  ctx.stroke();
  const top: Pt = [x + 2, y - len * 0.55];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.4;
    const ex = top[0] + Math.cos(a) * len * 0.35;
    const ey = top[1] + Math.sin(a) * len * 0.2;
    ctx.strokeStyle = rgba(mix('#4b6b3a', LEAF, lush * (0.5 + 0.5 * r())), 0.5 + 0.4 * lush);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(top[0], top[1]);
    ctx.quadraticCurveTo(ex, ey - 10, ex + (r() - 0.5) * 6, ey + len * (0.25 + 0.35 * r()));
    ctx.stroke();
  }
  ctx.restore();
}

function paintOak(ctx: CanvasRenderingContext2D, level: number) {
  const wake = stage(level, 0, 3);
  // Canopy: leafy masses behind and above the crown.
  ctx.save();
  glowDot(ctx, 286, 380, 170, CANOPY, 0.25 + 0.15 * wake);
  const r = rng(21);
  for (let i = 0; i < 150; i++) {
    const a = Math.PI + 0.05 + r() * (Math.PI - 0.1);
    const d = 0.3 + 0.7 * Math.sqrt(r());
    const x = 286 + Math.cos(a) * 140 * d;
    const y = 410 + Math.sin(a) * 96 * d;
    leafShape(ctx, x, y, 14 + r() * 12, r() * TAU, dim(mix(CANOPY, LEAF, 0.1 + r() * 0.5), level, 0.45));
  }
  ctx.restore();
  // Bark body with grain, roots and branches.
  ctx.save();
  poly(ctx, OAK_BODY);
  const g = ctx.createLinearGradient(184, 0, 388, 0);
  g.addColorStop(0, dim(BARK_DK, level, 0.35));
  g.addColorStop(0.5, dim(BARK, level, 0.35));
  g.addColorStop(1, dim(BARK_DK, level, 0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(18,10,6,0.4)';
  ctx.lineWidth = 1.2;
  for (let x = 180; x < 392; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 350);
    ctx.bezierCurveTo(x + 5, 410, x - 5, 470, x + 2, 548);
    ctx.stroke();
  }
  ctx.restore();
  // The hollow: dark, with a warm lantern glow deep inside.
  poly(ctx, HOLLOW);
  ctx.fillStyle = '#100806';
  ctx.fill();
  glowDot(ctx, 286, 470, 40, MOON, 0.22 + 0.5 * wake);
  // Acorns: the prize the rivals compete for (they glow once the pairs are read).
  const lit = stage(level, 0.6, 1.4);
  for (const [x, y] of [[214, 412], [246, 382], [326, 382], [358, 412], [286, 368]] as Pt[]) {
    acornGlyph(ctx, x, y, 6, dim('#C58B4E', level, 0.4), dim('#6B4A2E', level, 0.4), lit);
  }
  // The oak's name carved into the bark above its hollow.
  ctx.save();
  ctx.font = '800 8px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba('#FFE2A6', 0.55 + 0.4 * wake);
  ctx.fillText('GREAT OAK', 286, 385);
  ctx.restore();
}

/** The predator-prey field chart: prey waves first, predator waves a step behind. */
function chaseChart(ctx: CanvasRenderingContext2D, level: number) {
  const x0 = 34;
  const y0 = 556;
  const w = 112;
  const h = 78;
  const lit = stage(level, 1.2, 2.1);
  ctx.save();
  rrect(ctx, x0, y0, w, h, 8);
  ctx.fillStyle = rgba('#F3E6CF', 0.08 + 0.1 * lit);
  ctx.fill();
  ctx.strokeStyle = rgba('#F3E6CF', 0.25 + 0.4 * lit);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.font = '700 8px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = rgba(IVORY, 0.45 + 0.45 * lit);
  ctx.fillText('NUMBERS OVER TIME', x0 + 7, y0 + 12);
  // axes
  ctx.strokeStyle = rgba(IVORY, 0.3 + 0.3 * lit);
  ctx.beginPath();
  ctx.moveTo(x0 + 8, y0 + 18);
  ctx.lineTo(x0 + 8, y0 + h - 14);
  ctx.lineTo(x0 + w - 6, y0 + h - 14);
  ctx.stroke();
  const wave = (phase: number, amp: number, base: number, color: string) => {
    neonPath(ctx, () => {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const x = x0 + 10 + u * (w - 18);
        const y = y0 + base - Math.sin(u * TAU * 1.6 - phase) * amp;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    }, color, lit, 2);
  };
  // The predator line stays below the prey line: there are always far fewer wolves than moose.
  wave(0, 15, 36, AMBER);
  wave(1.15, 6, 56, DUSK);
  ctx.font = '700 7.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  ctx.fillStyle = rgba(AMBER, 0.5 + 0.5 * lit);
  ctx.fillText('moose (prey)', x0 + 10, y0 + h - 4);
  ctx.fillStyle = rgba(DUSK, 0.5 + 0.5 * lit);
  ctx.fillText('wolves', x0 + 72, y0 + h - 4);
  ctx.restore();
}

/** Dance card legend on the lower floor: the four ways an interaction can rate. */
function danceCard(ctx: CanvasRenderingContext2D, level: number) {
  const rows: [string, string, string, string][] = [
    ['+ +', 'mutualism', 'both partners gain', PLUS],
    ['+ 0', 'commensalism', 'one gains, one unaffected', ZERO],
    ['+ −', 'predation · parasitism', 'one gains, one is harmed', AMBER],
    ['− −', 'competition', 'both get less', MINUS],
  ];
  ctx.save();
  // Measure the columns so the longest name and note always fit inside the frame.
  ctx.font = '700 10.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  const nameW = Math.max(...rows.map((r) => ctx.measureText(r[1]).width));
  ctx.font = '400 9.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
  const noteW = Math.max(...rows.map((r) => ctx.measureText(r[2]).width));
  const noteX = 46 + nameW + 10;
  const w = Math.max(260, noteX + noteW + 12);
  const x0 = 286 - w / 2;
  const y0 = 682;
  const h = 104;
  const lit = 0.35 + 0.65 * stage(level, 0.3, 1.2);
  rrect(ctx, x0, y0, w, h, 12);
  ctx.fillStyle = rgba('#F3E6CF', 0.1 + 0.08 * lit);
  ctx.fill();
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = rgba(MOON, 0.35 + 0.45 * lit);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = '800 11px "Fraunces Variable", Georgia, serif';
  ctx.fillStyle = rgba(MOON, 0.55 + 0.45 * lit);
  ctx.fillText('THE DANCE CARD · rate each partner', x0 + w / 2, y0 + 14);
  rows.forEach(([sym, name, note, c], i) => {
    const y = y0 + 34 + i * 19;
    ctx.textAlign = 'center';
    ctx.font = '800 13px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = rgba(c, 0.55 + 0.45 * lit);
    ctx.fillText(sym, x0 + 24, y);
    ctx.textAlign = 'left';
    ctx.font = '700 10.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = rgba(IVORY, 0.55 + 0.4 * lit);
    ctx.fillText(name, x0 + 46, y);
    ctx.font = '400 9.5px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.fillStyle = rgba(IVORY, 0.4 + 0.4 * lit);
    ctx.fillText(note, x0 + noteX, y);
  });
  ctx.restore();
}

function verticalLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, alpha: number, deg: number, size = 11) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function paintBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s0 = stage(level, 0, 0.8);
  const s1 = stage(level, 0.4, 1.2);
  const s2 = stage(level, 1.3, 2.2);
  const s3 = stage(level, 2.3, 3.1);
  const s4 = stage(level, 3.4, 4);
  // Night sky over the glade, deepening to forest floor.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#1c1030'], [0.2, '#2b1940'], [0.46, '#2a1a3a'], [0.7, '#162a2c'], [1, '#0c1a1c']]);
  ctx.fillRect(0, 0, 600, 1150);
  stars(ctx, 21, 80, [40, 22, 560, 240], IVORY);
  // The moon over the Wolf Trail.
  glowDot(ctx, 452, 120, 110, MOON, 0.12 + 0.25 * s0);
  ctx.fillStyle = mix('#8b7a5a', '#fff1c8', 0.35 + 0.65 * s0);
  ctx.beginPath();
  ctx.arc(452, 120, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,100,70,0.25)';
  for (const [cx, cy, cr] of [[440, 110, 7], [462, 132, 9], [458, 104, 4], [444, 136, 4]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, TAU);
    ctx.fill();
  }

  // Forest edges: dark trunks and ivy along both chase channels.
  const fr = rng(33);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = side < 0 ? 30 + i * 18 : 542 - i * 18;
      const top = 160 + fr() * 120;
      ctx.fillStyle = rgba('#0a0f10', 0.35 + 0.15 * fr());
      ctx.fillRect(x - 5, top, 9 + fr() * 6, 1150 - top);
    }
  }
  for (const [x, y] of [[60, 190], [110, 150], [520, 200], [470, 170]] as Pt[]) {
    for (let k = 0; k < 14; k++) leafShape(ctx, x + (fr() - 0.5) * 70, y + (fr() - 0.5) * 60, 14 + fr() * 10, fr() * TAU, dim(CANOPY, level, 0.65));
  }

  // Upper ballroom: a moonlit parquet under the masquerade.
  ctx.save();
  const pr = 150;
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * TAU;
    const a1 = ((i + 1) / 24) * TAU;
    ctx.beginPath();
    ctx.moveTo(286, 236);
    ctx.arc(286, 236, pr, a0, a1);
    ctx.closePath();
    ctx.fillStyle = rgba(i % 2 ? '#B98A5A' : '#8A5E3C', 0.1 + 0.12 * s1);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(MOON, 0.15 + 0.35 * s1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(286, 236, pr, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    glowDot(ctx, 286 + Math.cos(a) * (pr + 8), 236 + Math.sin(a) * (pr + 8), 7, [MOON, ROSE, FIREFLY][i % 3], 0.15 + 0.6 * s1);
  }
  ctx.restore();

  // Dance card frame behind the four rating lanes.
  ctx.save();
  rrect(ctx, 188, 98, 196, 72, 12);
  ctx.fillStyle = rgba('#F3E6CF', 0.07 + 0.08 * s1);
  ctx.fill();
  ctx.strokeStyle = rgba(MOON, 0.3 + 0.4 * s1);
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Masquerade guests: each mask is a predator, sorted by what it mainly eats.
  // Dark pills with light ink, so the lit bumpers' light pools can't wash the words out.
  plaque(ctx, 'OWL · carnivore', MASKS.owl[0], 294, rgba('#1e1028', 0.9), mix(ROSE, '#ffffff', 0.45), 9.5);
  plaque(ctx, 'DEER · herbivore', MASKS.deer[0], 262, rgba('#1e1028', 0.9), mix(LEAF, '#ffffff', 0.4), 9.5);
  plaque(ctx, 'RACCOON · omnivore', MASKS.raccoon[0], 294, rgba('#1e1028', 0.9), mix(MOON, '#ffffff', 0.4), 9.5);

  // The Great Oak, the Oak Hollow and the acorns.
  paintOak(ctx, level);

  // Alliance threads: partners light together, each with its sign.
  thread(ctx, [[221, 452], [214, 300], [358, 300], [351, 452]], PLUS, '+', 0.25 + 0.75 * s1);
  thread(ctx, [[163, 497], [178, 640], [394, 640], [409, 497]], MINUS, '−', 0.25 + 0.75 * s1);
  plaque(ctx, '+ +  MUTUALISM · ants guard aphids, aphids feed ants', 286, 319, rgba(PLUS, 0.9), '#10261a', 9.5);
  plaque(ctx, '− −  COMPETITION', 286, 612, rgba(MINUS, 0.85), '#2a0f14', 10);
  plaque(ctx, 'squirrels and jays eat the same acorns', 286, 636, rgba('#F3E6CF', 0.8), '#2a1830', 8.5);

  // The Chase: hoofprints up the Moose Run, pawprints up the Wolf Trail.
  for (let i = 0; i < 7; i++) {
    const y = 470 - i * 30;
    const k = (i % 2 ? 1 : -1) * 7;
    hoof(ctx, 58 + k + (470 - y) * -0.04, y, 11, -0.08, rgba(AMBER, 0.22 + 0.5 * s2));
    paw(ctx, 514 - k + (470 - y) * 0.04, y - 14, 12, 0.08, rgba(DUSK, 0.22 + 0.5 * s2));
  }
  // Trail names sit below the spinner plaques (and clear of the elk bank on the right).
  verticalLabel(ctx, 'MOOSE RUN · PREY', 40, 446, AMBER, 0.55 + 0.4 * s2, -90, 10.5);
  plaque(ctx, 'MOOSE COUNT', 68, 371, rgba(AMBER, 0.8), '#2a1608', 7.5);
  plaque(ctx, 'RADIO COLLAR', 504, 371, rgba(DUSK, 0.8), '#141a33', 7.5);
  verticalLabel(ctx, 'WOLF TRAIL · PREDATOR', 534, 446, DUSK, 0.55 + 0.4 * s2, 90, 10);
  chaseChart(ctx, level);

  // Willow meadow by the elk herd: browsed short until the wolves return.
  const lush = 0.15 + 0.85 * s3;
  for (const [x, y, hh, sd] of [[452, 600, 70, 3], [486, 660, 62, 5], [512, 580, 58, 7], [470, 532, 48, 9]] as [number, number, number, number][]) {
    willow(ctx, x, y, hh, lush, sd);
  }
  plaque(ctx, 'WILLOWS', 468, 674, rgba(LEAF, 0.55 + 0.4 * s3), '#132414', 8);

  // Lower floor: the dance card legend, with the chase graph's lesson underneath.
  danceCard(ctx, level);

  // Fireflies wake with every mission; the Wonderlight washes the glade in gold.
  const ff = rng(77);
  const n = Math.round(10 + 50 * stage(level, 0.2, 4));
  for (let i = 0; i < n; i++) glowDot(ctx, 40 + ff() * 500, 200 + ff() * 600, 5, FIREFLY, 0.3 + 0.5 * ff());
  if (s4 > 0.01) {
    ctx.fillStyle = rgba(GOLD, 0.07 * s4);
    ctx.fillRect(0, 0, 600, 1150);
    neonText(ctx, 'WILD ALLIANCE BALLROOM', 290, 58, 16, GOLD, s4);
  } else {
    neonText(ctx, 'WILD ALLIANCE BALLROOM', 290, 58, 16, MOON, 0.15 + 0.6 * s2);
  }
}

// ---------------------------------------------------------------- 3D attraction set

const GY = -0.42;

function canvasTex(kit: SetKit, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = kit.track(new kit.THREE.CanvasTexture(c));
  tex.colorSpace = kit.THREE.SRGBColorSpace;
  return tex;
}

type Drawer = (ctx: CanvasRenderingContext2D) => void;

/** Silhouettes for the theatre cutouts (256 x 160 canvas, facing right). */
const SIL: Record<string, Drawer> = {
  wolf(ctx) {
    ctx.beginPath();
    ctx.ellipse(118, 80, 62, 22, -0.04, 0, TAU);
    ctx.moveTo(158, 62);
    ctx.lineTo(194, 42);
    ctx.lineTo(206, 70);
    ctx.lineTo(176, 96);
    ctx.closePath();
    ctx.moveTo(227, 47);
    ctx.ellipse(205, 48, 22, 15, -0.1, 0, TAU);
    ctx.moveTo(214, 40);
    ctx.lineTo(248, 54);
    ctx.lineTo(242, 62);
    ctx.lineTo(212, 62);
    ctx.closePath();
    ctx.moveTo(195, 38);
    ctx.lineTo(199, 14);
    ctx.lineTo(209, 36);
    ctx.closePath();
    ctx.moveTo(206, 36);
    ctx.lineTo(214, 14);
    ctx.lineTo(220, 38);
    ctx.closePath();
    ctx.moveTo(64, 64);
    ctx.quadraticCurveTo(30, 66, 8, 94);
    ctx.quadraticCurveTo(36, 92, 66, 86);
    ctx.closePath();
    for (const leg of [
      [[168, 88], [196, 116], [206, 140], [194, 143], [182, 122], [156, 100]],
      [[152, 94], [148, 128], [160, 146], [148, 148], [138, 128], [140, 96]],
      [[84, 90], [62, 122], [42, 138], [36, 131], [54, 115], [68, 86]],
      [[100, 94], [106, 128], [98, 148], [88, 146], [92, 128], [86, 98]],
    ] as Pt[][]) {
      ctx.moveTo(leg[0][0], leg[0][1]);
      for (const p of leg.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
    }
    ctx.fill('nonzero');
  },
  moose(ctx) {
    ctx.beginPath();
    ctx.ellipse(112, 78, 62, 28, 0, 0, TAU);
    ctx.moveTo(180, 52);
    ctx.ellipse(150, 58, 30, 24, -0.2, 0, TAU);
    ctx.moveTo(166, 52);
    ctx.lineTo(200, 54);
    ctx.lineTo(238, 76);
    ctx.lineTo(242, 94);
    ctx.lineTo(222, 98);
    ctx.lineTo(196, 82);
    ctx.lineTo(170, 80);
    ctx.closePath();
    ctx.moveTo(204, 88);
    ctx.lineTo(212, 110);
    ctx.lineTo(220, 92);
    ctx.closePath();
    // palmate antlers
    ctx.moveTo(224, 34);
    ctx.ellipse(196, 34, 28, 9, -0.25, 0, TAU);
    for (let i = 0; i < 5; i++) {
      const x = 176 + i * 10;
      ctx.moveTo(x, 34 - i * 2);
      ctx.lineTo(x + 3, 12 - i * 1.5);
      ctx.lineTo(x + 8, 32 - i * 2);
      ctx.closePath();
    }
    for (const [x, a] of [[74, 0.12], [94, -0.05], [148, 0.1], [170, -0.1]] as [number, number][]) {
      ctx.save();
      ctx.translate(x, 96);
      ctx.rotate(a);
      ctx.rect(-5, 0, 10, 58);
      ctx.restore();
    }
    ctx.fill('nonzero');
  },
  elk(ctx) {
    ctx.beginPath();
    ctx.ellipse(116, 80, 58, 24, 0, 0, TAU);
    ctx.moveTo(160, 64);
    ctx.lineTo(190, 34);
    ctx.lineTo(206, 44);
    ctx.lineTo(182, 86);
    ctx.closePath();
    ctx.moveTo(220, 46);
    ctx.ellipse(202, 44, 18, 11, 0.35, 0, TAU);
    for (const [x, a] of [[78, 0.08], [98, -0.06], [148, 0.08], [166, -0.08]] as [number, number][]) {
      ctx.save();
      ctx.translate(x, 96);
      ctx.rotate(a);
      ctx.rect(-4, 0, 8, 56);
      ctx.restore();
    }
    ctx.fill('nonzero');
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = ctx.fillStyle as string;
    ctx.beginPath();
    ctx.moveTo(196, 36);
    ctx.quadraticCurveTo(170, 18, 160, 2);
    for (const [x, y] of [[182, 26], [172, 16], [165, 8]]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y - 12);
    }
    ctx.stroke();
  },
  squirrel(ctx) {
    ctx.beginPath();
    ctx.ellipse(150, 104, 32, 28, -0.3, 0, TAU);
    ctx.moveTo(196, 70);
    ctx.ellipse(178, 70, 18, 15, 0, 0, TAU);
    ctx.moveTo(176, 58);
    ctx.lineTo(180, 40);
    ctx.lineTo(188, 58);
    ctx.closePath();
    // bushy tail curling up behind
    ctx.moveTo(126, 120);
    ctx.bezierCurveTo(60, 120, 50, 30, 100, 20);
    ctx.bezierCurveTo(130, 14, 132, 50, 112, 56);
    ctx.bezierCurveTo(100, 60, 100, 96, 136, 100);
    ctx.closePath();
    ctx.moveTo(200, 96);
    ctx.ellipse(192, 96, 8, 10, 0, 0, TAU);
    ctx.fill('nonzero');
  },
  jay(ctx) {
    ctx.beginPath();
    ctx.ellipse(118, 88, 46, 26, -0.2, 0, TAU);
    ctx.moveTo(180, 62);
    ctx.ellipse(162, 62, 20, 18, 0, 0, TAU);
    ctx.moveTo(150, 48);
    ctx.lineTo(140, 24);
    ctx.lineTo(166, 46);
    ctx.closePath();
    ctx.moveTo(178, 58);
    ctx.lineTo(204, 64);
    ctx.lineTo(178, 70);
    ctx.closePath();
    ctx.moveTo(80, 92);
    ctx.lineTo(20, 120);
    ctx.lineTo(30, 130);
    ctx.lineTo(86, 104);
    ctx.closePath();
    ctx.moveTo(120, 112);
    ctx.lineTo(116, 140);
    ctx.lineTo(124, 140);
    ctx.lineTo(130, 112);
    ctx.closePath();
    ctx.fill('nonzero');
  },
  owl(ctx) {
    ctx.beginPath();
    ctx.ellipse(128, 96, 44, 56, 0, 0, TAU);
    ctx.moveTo(92, 56);
    ctx.lineTo(96, 24);
    ctx.lineTo(116, 48);
    ctx.closePath();
    ctx.moveTo(164, 56);
    ctx.lineTo(160, 24);
    ctx.lineTo(140, 48);
    ctx.closePath();
    ctx.fill('nonzero');
    ctx.fillStyle = '#fff1c8';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(128 + sx * 17, 76, 12, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#1a1030';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(128 + sx * 17, 76, 5, 0, TAU);
      ctx.fill();
    }
  },
};

/** A theatre flat: a painted silhouette with a glowing rim, lit by level. */
function cutout(kit: SetKit, kind: string, color: string, rim: string, w = 1.3): THREE.Mesh & Lit {
  const T = kit.THREE;
  const tex = canvasTex(kit, 256, 160, (ctx) => {
    ctx.save();
    ctx.shadowColor = rim;
    ctx.shadowBlur = 10;
    ctx.fillStyle = rim;
    SIL[kind](ctx);
    ctx.restore();
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(128, 80);
    ctx.scale(0.94, 0.94);
    ctx.translate(-128, -80);
    SIL[kind](ctx);
    ctx.restore();
  });
  const mat = kit.track(new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.1, transparent: true, alphaTest: 0.35, side: T.DoubleSide, roughness: 0.8 }));
  const m = new T.Mesh(new T.PlaneGeometry(w, (w * 160) / 256), mat) as unknown as THREE.Mesh & Lit;
  m.setLit = (v) => (mat.emissiveIntensity = 0.1 + v * 0.9);
  return kit.add(m);
}

/** Masquerade mask outline (1.6 wide) with two eye holes. */
function maskShape(T: typeof THREE): THREE.Shape {
  const s = new T.Shape();
  s.moveTo(-0.8, 0.12);
  s.bezierCurveTo(-0.72, 0.44, -0.3, 0.38, 0, 0.22);
  s.bezierCurveTo(0.3, 0.38, 0.72, 0.44, 0.8, 0.12);
  s.bezierCurveTo(0.74, -0.22, 0.42, -0.38, 0.14, -0.22);
  s.quadraticCurveTo(0, -0.12, -0.14, -0.22);
  s.bezierCurveTo(-0.42, -0.38, -0.74, -0.22, -0.8, 0.12);
  for (const sx of [-1, 1]) {
    const h = new T.Path();
    h.absellipse(sx * 0.34, 0.06, 0.17, 0.1, 0, Math.PI * 2, false, sx * 0.22);
    s.holes.push(h);
  }
  return s;
}

/** A giant masquerade mask held up on a gilded stick: owl (carnivore), deer (herbivore) or raccoon (omnivore). */
function bigMask(kit: SetKit, kind: 'owl' | 'deer' | 'raccoon', pos: [number, number, number], rotY: number, face: string, trim: string, plumes: string[]): THREE.Group & Lit {
  const T = kit.THREE;
  const g = new T.Group() as THREE.Group & Lit;
  const shape = maskShape(T);
  const faceMat = kit.track(new T.MeshPhysicalMaterial({ color: face, roughness: 0.35, metalness: 0.15, clearcoat: 1, emissive: trim, emissiveIntensity: 0.02 }));
  const body = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), faceMat);
  body.castShadow = true;
  g.add(body);
  const rimPts = shape.getPoints(24).map((p) => new T.Vector3(p.x, p.y, 0.08));
  const rimMat = kit.track(new T.MeshStandardMaterial({ color: '#1a1020', emissive: trim, emissiveIntensity: 0.05, roughness: 0.3 }));
  g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(rimPts, true), 96, 0.026, 6, true), rimMat));
  const accent = kit.mats.paintedMetal(trim);
  if (kind === 'owl') {
    for (const sx of [-1, 1]) {
      const tuft = new T.Mesh(new T.ConeGeometry(0.13, 0.5, 10), accent);
      tuft.position.set(sx * 0.6, 0.5, 0.02);
      tuft.rotation.z = -sx * 0.5;
      g.add(tuft);
    }
    const beak = new T.Mesh(new T.ConeGeometry(0.08, 0.28, 8), kit.mats.brass());
    beak.position.set(0, -0.22, 0.1);
    beak.rotation.x = Math.PI;
    g.add(beak);
  } else if (kind === 'deer') {
    const antlerMat = kit.mats.paintedMetal('#e6d2a8');
    for (const sx of [-1, 1]) {
      const beam = [[0.3, 0.28], [0.46, 0.62], [0.4, 0.92], [0.5, 1.12]].map(([x, y]) => new T.Vector3(sx * x, y, 0.02));
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(beam), 30, 0.035, 6), antlerMat));
      for (const [x0, y0, x1, y1] of [[0.45, 0.6, 0.78, 0.82], [0.42, 0.88, 0.7, 1.08]]) {
        const tine = [new T.Vector3(sx * x0, y0, 0.02), new T.Vector3(sx * (x0 + x1) * 0.52, (y0 + y1) * 0.5 + 0.04, 0.02), new T.Vector3(sx * x1, y1, 0.02)];
        g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(tine), 12, 0.025, 6), antlerMat));
      }
      const ear = new T.Mesh(new T.ConeGeometry(0.1, 0.3, 8), accent);
      ear.position.set(sx * 0.74, 0.3, 0);
      ear.rotation.z = -sx * 1.1;
      g.add(ear);
    }
  } else {
    const band = new T.Mesh(new T.BoxGeometry(1.5, 0.16, 0.02), kit.mats.plastic('#1c1824'));
    band.position.set(0, 0.06, 0.075);
    g.add(band);
    for (const sx of [-1, 1]) {
      const ear = new T.Mesh(new T.SphereGeometry(0.17, 14, 10), accent);
      ear.scale.set(1, 1, 0.35);
      ear.position.set(sx * 0.56, 0.4, 0);
      g.add(ear);
    }
  }
  // A fan of plumes on one side, as on a carnival masquerade mask.
  plumes.forEach((c, i) => {
    const f = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), kit.mats.plastic(c));
    f.scale.set(0.55, 3.2, 0.25);
    const a = -0.9 + i * 0.32;
    f.position.set(0.78 + Math.sin(a) * 0.22, 0.32 + Math.cos(a) * 0.22, -0.02);
    f.rotation.z = -a;
    g.add(f);
  });
  // The gilded stick it is held up by.
  const stickLen = pos[1] - GY - 0.1;
  const stick = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, stickLen, 10), kit.mats.brass());
  stick.position.set(-0.62, -0.12 - stickLen / 2, -0.04);
  stick.rotation.z = -0.08;
  g.add(stick);
  g.position.set(pos[0], pos[1], pos[2]);
  g.rotation.set(-0.35, rotY, 0);
  g.scale.setScalar(0.78);
  kit.add(g);
  g.setLit = (v) => {
    rimMat.emissiveIntensity = 0.05 + v * 2.1;
    faceMat.emissiveIntensity = 0.02 + v * 0.2;
  };
  return g;
}

function parquetTex(kit: SetKit, a: string, b: string, rim: string): THREE.CanvasTexture {
  return canvasTex(kit, 512, 512, (ctx) => {
    for (let i = 0; i < 32; i++) {
      ctx.beginPath();
      ctx.moveTo(256, 256);
      ctx.arc(256, 256, 256, (i / 32) * TAU, ((i + 1) / 32) * TAU);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fill();
    }
    for (const r of [80, 160]) {
      ctx.strokeStyle = 'rgba(30,16,10,0.6)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = rim;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(256, 256, 246, 0, TAU);
    ctx.stroke();
  });
}

/** Mossy forest floor with leaf litter and tiny flowers. */
function mossTex(kit: SetKit): THREE.CanvasTexture {
  const tex = canvasTex(kit, 512, 512, (ctx) => {
    ctx.fillStyle = '#2b3d2a';
    ctx.fillRect(0, 0, 512, 512);
    const r = rng(41);
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = rgba(['#36502f', '#22331f', '#3e5a33', '#2f4426'][i % 4], 0.5);
      ctx.beginPath();
      ctx.ellipse(r() * 512, r() * 512, 8 + r() * 30, 6 + r() * 20, r() * 3, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 70; i++) leafShape(ctx, r() * 512, r() * 512, 10 + r() * 12, r() * TAU, ['#7a5a2f', '#8f4a2a', '#a8873a', '#5b6b2f'][i % 4]);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = ['#ffd27a', '#ff8fa3', '#cbc3ea', '#fff7e7'][i % 4];
      ctx.beginPath();
      ctx.arc(r() * 512, r() * 512, 1.6, 0, TAU);
      ctx.fill();
    }
  });
  tex.wrapS = tex.wrapT = kit.THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  tex.anisotropy = 8;
  return tex;
}

const ballroomSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  kit.sky('#2c1a4c', '#07050e');
  const groundMat = kit.track(new T.MeshStandardMaterial({ map: mossTex(kit), roughness: 0.95, emissive: '#16241a', emissiveIntensity: 0.35 }));
  const ground = kit.add(new T.Mesh(new T.CircleGeometry(30, 64).rotateX(-Math.PI / 2), groundMat));
  ground.position.y = GY - 0.002;
  ground.receiveShadow = true;
  kit.motes({ x0: -10, x1: 10, y0: 0, y1: 5, z0: -10, z1: 6 }, 80, FIREFLY, { speed: 0.08, size: 0.09 });
  const fireflies = kit.motes({ x0: -9, x1: 9, y0: -0.2, y1: 2.6, z0: -6, z1: 5 }, 150, FIREFLY, { speed: 0.05, size: 0.13 });

  // Painted woodland flat behind the head (seen on the fly-in).
  const flat = kit.backdrop((ctx, w, h, level) => {
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#1c1030'], [0.6, '#2a1a3a'], [1, '#0c1a1c']]);
    ctx.fillRect(0, 0, w, h);
    stars(ctx, 4, 120, [0, 0, w, h * 0.6], IVORY);
    glowDot(ctx, w * 0.72, h * 0.28, 140, MOON, 0.25 + 0.2 * Math.min(1, level));
    ctx.fillStyle = '#fff1c8';
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.28, 46, 0, TAU);
    ctx.fill();
    const r = rng(9);
    for (let i = 0; i < 30; i++) {
      const x = r() * w;
      const th = h * (0.35 + r() * 0.3);
      ctx.fillStyle = mix('#0b1612', '#1d3a2a', r() * 0.6);
      ctx.beginPath();
      ctx.moveTo(x - 40, h);
      ctx.lineTo(x, h - th);
      ctx.lineTo(x + 40, h);
      ctx.closePath();
      ctx.fill();
    }
    neonText(ctx, 'WILD ALLIANCE BALLROOM', w / 2, h * 0.15, 54, MOON, Math.min(1, 0.3 + level * 0.25));
  });

  // ---- The moon rises in the top-left corner, behind the Great Oak.
  const moon = kit.orb([-5.2, 1.95, -4.4], 0.5, '#ffe7b0');
  const haloTex = canvasTex(kit, 256, 256, (ctx) => glowDot(ctx, 128, 128, 128, '#ffe2a0', 1));
  const haloMat = kit.track(new T.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.3 }));
  const halo = kit.add(new T.Sprite(haloMat));
  halo.position.set(-5.2, 1.95, -4.5);
  halo.scale.setScalar(3.0);

  // ---- Woodland ring and the Great Oak: instanced trunks and leafy crowns.
  const treeSpots: [number, number, number][] = [
    [-9.4, -6.6, 3.4], [-10.0, -2.6, 3.2], [-9.6, 1.6, 2.8], [-9.0, 5.0, 2.6],
    [9.4, -6.6, 3.4], [10.0, -2.6, 3.2], [9.6, 1.6, 2.8], [9.0, 5.0, 2.6],
    [-4.8, -9.0, 3.6], [4.8, -9.0, 3.6], [0, -10.6, 4.0], [8.4, -4.6, 2.6],
  ];
  const trunkGeo = new T.CylinderGeometry(0.12, 0.2, 1, 9);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new T.IcosahedronGeometry(1, 1);
  const crownsPer = 5;
  const OAK_AT: [number, number] = [-7.2, -2.7];
  const oakBlobs: [number, number, number, number][] = [
    [0, 2.45, 0, 1.0], [-0.85, 2.2, 0.3, 0.75], [0.9, 2.15, 0.2, 0.75], [-0.35, 2.9, -0.2, 0.7], [0.45, 2.85, 0.1, 0.65],
    [-1.4, 1.85, 0.1, 0.55], [1.4, 1.8, 0.3, 0.55], [0.1, 1.9, 0.75, 0.6], [0, 2.1, -0.8, 0.7],
  ];
  const trunks = kit.add(new T.InstancedMesh(trunkGeo, kit.mats.plastic('#4a3023'), treeSpots.length));
  const crownMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, emissive: '#183824', emissiveIntensity: 0.25 }));
  const crowns = kit.add(new T.InstancedMesh(crownGeo, crownMat, treeSpots.length * crownsPer + oakBlobs.length));
  const dummy = new T.Object3D();
  const col = new T.Color();
  const tr = rng(12);
  treeSpots.forEach(([x, z, h], i) => {
    dummy.position.set(x, GY, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, h * 0.62, 1);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < crownsPer; k++) {
      const s = h * (0.2 + tr() * 0.12);
      dummy.position.set(x + (tr() - 0.5) * h * 0.4, GY + h * (0.62 + tr() * 0.32), z + (tr() - 0.5) * h * 0.4);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      crowns.setMatrixAt(i * crownsPer + k, dummy.matrix);
      crowns.setColorAt(i * crownsPer + k, col.set(['#2f6b45', '#3d7d4c', '#285c3e', '#5b7d3a', '#7a5a2f'][Math.floor(tr() * 5)]));
    }
  });
  oakBlobs.forEach(([x, y, z, s], k) => {
    dummy.position.set(OAK_AT[0] + x, GY + y, OAK_AT[1] + z);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    const idx = treeSpots.length * crownsPer + k;
    crowns.setMatrixAt(idx, dummy.matrix);
    crowns.setColorAt(idx, col.set(['#3f7a4e', '#4f8a4a', '#356b42'][k % 3]));
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  // The Great Oak's trunk and limbs, with its glowing hollow and an owl at home in it.
  const oakBark = kit.mats.plastic('#5a3b2a');
  const oakTrunk = kit.add(new T.Mesh(new T.CylinderGeometry(0.3, 0.52, 2.1, 14), oakBark));
  oakTrunk.position.set(OAK_AT[0], GY + 1.05, OAK_AT[1]);
  oakTrunk.castShadow = true;
  for (const [dx, dy, dz] of [[-1.2, 1.8, 0.2], [1.2, 1.75, 0.3], [0.1, 2.0, 0.85]]) {
    const limb = [new T.Vector3(OAK_AT[0], GY + 1.3, OAK_AT[1]), new T.Vector3(OAK_AT[0] + dx * 0.5, GY + dy - 0.3, OAK_AT[1] + dz * 0.5), new T.Vector3(OAK_AT[0] + dx, GY + dy, OAK_AT[1] + dz)];
    kit.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(limb), 12, 0.12, 8), oakBark));
  }
  const oakHollow = kit.orb([OAK_AT[0] + 0.1, GY + 0.85, OAK_AT[1] + 0.47], 0.16, MOON);
  // Commensalism (+ 0): the owl gains a nest site; the oak is not helped or harmed.
  const owlRoost = cutout(kit, 'owl', '#8a7aa0', MOON, 1.0);
  owlRoost.position.set(OAK_AT[0] + 0.25, GY + 2.3, OAK_AT[1] + 1.1);
  owlRoost.rotation.set(-0.35, 0.35, 0);
  const signCom = kit.neonSign('+ 0  COMMENSALISM', [-5.95, 2.5, -1.45], { height: 0.3, color: ZERO, rotY: 0.4 });
  signCom.rotation.x = -0.6;
  const signComSub = kit.neonSign('AN OWL NESTS IN THE OAK', [-5.95, 2.16, -1.33], { height: 0.21, color: IVORY, rotY: 0.4 });
  signComSub.rotation.x = -0.6;

  // ---- Lantern strands draped from tree to tree (one instanced mesh of bulbs).
  const strands: [[number, number, number], [number, number, number], number][] = [
    [[-9.6, 2.2, 1.6], [-7.2, 2.2, -2.7], 0.4],
    [[-7.2, 2.2, -2.7], [-4.8, 2.6, -9.0], 0.4],
    [[-9.6, 2.0, 1.6], [-9.0, 1.8, 5.0], 0.3],
    [[9.4, 2.4, -6.6], [8.4, 1.8, -4.6], 0.3],
    [[8.4, 1.8, -4.6], [9.6, 2.0, 1.6], 0.4],
    [[9.6, 2.0, 1.6], [9.0, 1.8, 5.0], 0.3],
    [[-4.8, 2.6, -9.0], [4.8, 2.6, -9.0], 0.7],
  ];
  const bulbsPer = kit.n(12);
  const oakBulbs = kit.n(16);
  const bulbMat = kit.track(new T.MeshBasicMaterial({ color: '#ffffff' }));
  const bulbs = kit.add(new T.InstancedMesh(new T.SphereGeometry(0.055, 8, 6), bulbMat, strands.length * bulbsPer + oakBulbs));
  const wireMat = kit.mats.dark();
  const bulbColors = [MOON, ROSE, FIREFLY, DUSK];
  strands.forEach(([a, b, sag], si) => {
    const A = new T.Vector3(...a);
    const B = new T.Vector3(...b);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const p = A.clone().lerp(B, u);
      p.y -= Math.sin(u * Math.PI) * sag;
      pts.push(p);
    }
    kit.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 32, 0.008, 4), wireMat));
    for (let i = 0; i < bulbsPer; i++) {
      const u = (i + 0.5) / bulbsPer;
      const p = A.clone().lerp(B, u);
      p.y -= Math.sin(u * Math.PI) * sag + 0.06;
      dummy.position.copy(p);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      bulbs.setMatrixAt(si * bulbsPer + i, dummy.matrix);
      bulbs.setColorAt(si * bulbsPer + i, col.set(bulbColors[(i + si) % bulbColors.length]));
    }
  });
  // Fairy lights tucked into the Great Oak's crown.
  const ob = rng(3);
  for (let i = 0; i < oakBulbs; i++) {
    const a = ob() * TAU;
    const rr = 1.1 + ob() * 0.5;
    dummy.position.set(OAK_AT[0] + Math.cos(a) * rr, GY + 1.8 + ob() * 1.1, OAK_AT[1] + Math.sin(a) * rr * 0.8 + 0.3);
    dummy.scale.setScalar(1.2);
    dummy.updateMatrix();
    bulbs.setMatrixAt(strands.length * bulbsPer + i, dummy.matrix);
    bulbs.setColorAt(strands.length * bulbsPer + i, col.set(i % 2 ? MOON : FIREFLY));
  }

  // ---- Head: the marquee over the glade (seen on the fly-in and at the top of the screen).
  const marquee = kit.neonSign('WILD ALLIANCE BALLROOM', [0, 1.5, -7.1], { height: 0.62, color: MOON });
  marquee.rotation.x = -0.7;

  // ---- LEFT: the mutualism bandstand, the ant-and-aphid leaf and the waltzing couples.
  const bandstand = new T.Group();
  const deck = new T.Mesh(new T.CylinderGeometry(1.15, 1.25, 0.22, 28), kit.mats.wood());
  deck.position.y = 0.11;
  deck.receiveShadow = true;
  const cols = new T.InstancedMesh(new T.CylinderGeometry(0.045, 0.055, 1.45, 10), kit.mats.paintedMetal('#efe2c8'), 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    dummy.position.set(Math.cos(a) * 1.0, 0.94, Math.sin(a) * 1.0);
    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    cols.setMatrixAt(i, dummy.matrix);
  }
  const roof = new T.Mesh(new T.ConeGeometry(1.4, 0.75, 6), kit.mats.paintedMetal('#7a3566'));
  roof.position.y = 2.02;
  roof.castShadow = true;
  const finial = new T.Mesh(new T.SphereGeometry(0.1, 14, 10), kit.mats.brass());
  finial.position.y = 2.46;
  bandstand.add(deck, cols, roof, finial);
  bandstand.position.set(-6.5, GY, 0.1);
  kit.add(bandstand);
  const bandLamp = kit.orb([-6.5, GY + 1.2, 0.1], 0.2, MOON);
  const signMut = kit.neonSign('+ +  MUTUALISM', [-5.75, 2.5, 0.95], { height: 0.38, color: PLUS, rotY: 0.4 });
  signMut.rotation.x = -0.55;

  // Ant and aphid share a giant leaf: the aphids give sugary droplets, the ants stand guard.
  const leafTex = canvasTex(kit, 256, 256, (ctx) => {
    leafShape(ctx, 18, 128, 220, 0, '#5c9c4c');
    ctx.strokeStyle = 'rgba(20,40,16,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(18, 128);
    ctx.lineTo(236, 128);
    ctx.stroke();
  });
  const leafMat = kit.track(new T.MeshStandardMaterial({ map: leafTex, transparent: true, alphaTest: 0.4, side: T.DoubleSide, roughness: 0.6, emissive: '#2f5a28', emissiveIntensity: 0.25 }));
  const bigLeaf = kit.add(new T.Mesh(new T.PlaneGeometry(2.0, 2.0), leafMat));
  bigLeaf.position.set(-8.1, GY + 0.22, 2.9);
  bigLeaf.rotation.set(-Math.PI / 2 + 0.3, 0, 0.55);
  const antBug = kit.add(new T.Mesh(new T.CapsuleGeometry(0.08, 0.22, 4, 8), kit.mats.plastic('#2a1a14')));
  antBug.position.set(-7.85, GY + 0.42, 2.8);
  antBug.rotation.z = Math.PI / 2;
  const aphidBug = kit.add(new T.Mesh(new T.SphereGeometry(0.12, 14, 10), kit.mats.plastic('#9be070')));
  aphidBug.position.set(-8.35, GY + 0.4, 3.05);
  const dew = kit.orb([-8.1, GY + 0.62, 2.95], 0.07, '#e8fff0');

  // Dance floor ringed by glowing mushrooms, with masked couples waltzing on it.
  const FLOOR: [number, number] = [-5.3, 2.75];
  const floorTex = parquetTex(kit, '#b8854f', '#8a5a36', '#ffd27a');
  const floorMat = kit.track(new T.MeshStandardMaterial({ map: floorTex, roughness: 0.45, emissive: '#5a3418', emissiveIntensity: 0.2 }));
  const floorL = kit.add(new T.Mesh(new T.CircleGeometry(1.35, 48), floorMat));
  floorL.rotation.x = -Math.PI / 2;
  floorL.position.set(FLOOR[0], GY + 0.02, FLOOR[1]);
  const shroomN = 22;
  const stems = kit.add(new T.InstancedMesh(new T.CylinderGeometry(0.03, 0.04, 0.16, 6), kit.mats.plastic('#efe6d6'), shroomN));
  const capGlow = kit.track(new T.MeshBasicMaterial({ color: '#ffffff' }));
  const shroomCaps = kit.add(new T.InstancedMesh(new T.SphereGeometry(0.08, 10, 6, 0, TAU, 0, Math.PI / 2), capGlow, shroomN));
  for (let i = 0; i < shroomN; i++) {
    const a = (i / shroomN) * TAU;
    const rr = 1.47 + (i % 3) * 0.06;
    const x = FLOOR[0] + Math.cos(a) * rr;
    const z = FLOOR[1] + Math.sin(a) * rr;
    const s = 0.8 + (i % 4) * 0.15;
    dummy.position.set(x, GY + 0.08 * s, z);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, GY + 0.15 * s, z);
    dummy.updateMatrix();
    shroomCaps.setMatrixAt(i, dummy.matrix);
    shroomCaps.setColorAt(i, col.set([ROSE, MOON, PLUS, DUSK][i % 4]));
  }
  const COUPLES: { r: number; a0: number; colors: [string, string] }[] = [
    { r: 0.78, a0: 0, colors: [PLUS, '#3a7a5a'] },
    { r: 0.78, a0: 2.1, colors: [ROSE, '#7a3a6a'] },
    { r: 0.78, a0: 4.2, colors: [MOON, '#4a4a8a'] },
  ];
  const dancerCount = COUPLES.length * 2;
  const bell: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    bell.push(new T.Vector2(0.03 + 0.22 * Math.pow(1 - u, 1.6), u * 0.62));
  }
  const gownGeo = new T.LatheGeometry(bell, 16);
  const gownMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.06 }));
  const gowns = kit.add(new T.InstancedMesh(gownGeo, gownMat, dancerCount));
  const headMat = kit.track(new T.MeshStandardMaterial({ color: '#f2dcc0', roughness: 0.5, emissive: '#ffe2a0', emissiveIntensity: 0.05 }));
  const heads = kit.add(new T.InstancedMesh(new T.SphereGeometry(0.085, 12, 9), headMat, dancerCount));
  const maskBand = kit.add(new T.InstancedMesh(new T.BoxGeometry(0.15, 0.045, 0.03), kit.mats.brass(), dancerCount));
  // Partners hold hands: one arm bar per couple at shoulder height.
  const armGeo = new T.CylinderGeometry(0.018, 0.018, 0.4, 6);
  armGeo.rotateZ(Math.PI / 2);
  const arms = kit.add(new T.InstancedMesh(armGeo, headMat, COUPLES.length));
  for (let i = 0; i < dancerCount; i++) gowns.setColorAt(i, col.set(COUPLES[i >> 1].colors[i & 1]));
  const dance = { speed: 0.2, boost: 0 };
  let danceT = 0;
  const placeDancers = () => {
    for (let k = 0; k < COUPLES.length; k++) {
      const cp = COUPLES[k];
      const orbit = cp.a0 + danceT * 0.25;
      const cx = FLOOR[0] + Math.cos(orbit) * cp.r;
      const cz = FLOOR[1] + Math.sin(orbit) * cp.r * 0.85;
      const spin = danceT * 2.2 + k;
      dummy.position.set(cx, GY + 0.58 + Math.abs(Math.sin(danceT * 3 + k)) * 0.03, cz);
      dummy.rotation.set(0, -spin, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      arms.setMatrixAt(k, dummy.matrix);
      for (let j = 0; j < 2; j++) {
        const a = spin + j * Math.PI;
        const x = cx + Math.cos(a) * 0.2;
        const z = cz + Math.sin(a) * 0.2;
        const bob = Math.abs(Math.sin(danceT * 3 + k)) * 0.03;
        dummy.position.set(x, GY + 0.04 + bob, z);
        dummy.rotation.set(0, -a + Math.PI / 2, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        gowns.setMatrixAt(k * 2 + j, dummy.matrix);
        dummy.position.set(x, GY + 0.76 + bob, z);
        dummy.updateMatrix();
        heads.setMatrixAt(k * 2 + j, dummy.matrix);
        // The mask faces the partner.
        dummy.position.set(x - Math.cos(a) * 0.07, GY + 0.78 + bob, z - Math.sin(a) * 0.07);
        dummy.updateMatrix();
        maskBand.setMatrixAt(k * 2 + j, dummy.matrix);
      }
    }
    gowns.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    maskBand.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
  };
  placeDancers();

  // Masquerade masks on gilded sticks: the three diets.
  const maskOwl = bigMask(kit, 'owl', [-4.1, 1.45, 4.75], 0.3, '#f4efe6', MOON, [ROSE, GOLD, PLUS]);
  const maskDeer = bigMask(kit, 'deer', [-4.35, 1.5, -2.0], 0.3, '#c9945e', ROSE, [MOON, ROSE]);
  const maskRaccoon = bigMask(kit, 'raccoon', [4.15, 1.45, 5.45], -0.3, '#8a8494', DUSK, [DUSK, ZERO, MOON]);

  // ---- RIGHT: the predator-prey chase carousel, its population waves and the willow meadow.
  const carousel = new T.Group();
  const trackTex = parquetTex(kit, '#5b6a8a', '#3d4766', '#9fb4ff');
  const trackMat = kit.track(new T.MeshStandardMaterial({ map: trackTex, roughness: 0.5, emissive: '#1a2240', emissiveIntensity: 0.25 }));
  const trackDisc = new T.Mesh(new T.CylinderGeometry(1.45, 1.5, 0.16, 40), trackMat);
  trackDisc.position.y = 0.08;
  const mast = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.0, 10), kit.mats.brass());
  mast.position.y = 1.0;
  const canopyMat = kit.track(new T.MeshStandardMaterial({ color: '#3a4a7a', roughness: 0.4, metalness: 0.3, emissive: DUSK, emissiveIntensity: 0.05 }));
  const canopyTop = new T.Mesh(new T.ConeGeometry(0.62, 0.42, 8), canopyMat);
  canopyTop.position.y = 2.1;
  carousel.add(trackDisc, mast, canopyTop);
  carousel.position.set(5.8, GY, 0.7);
  kit.add(carousel);
  const rotor = new T.Group();
  carousel.add(rotor);
  const runners: { m: THREE.Mesh & Lit; prey: boolean }[] = [];
  for (let i = 0; i < 4; i++) {
    const prey = i % 2 === 0;
    const m = cutout(kit, prey ? 'moose' : 'wolf', prey ? '#8a5530' : '#55688f', prey ? AMBER : DUSK, prey ? 1.05 : 0.95);
    const a = (i / 4) * TAU;
    m.position.set(Math.cos(a) * 1.05, 0.6, Math.sin(a) * 1.05);
    m.rotation.y = -a + Math.PI;
    rotor.add(m);
    runners.push({ m, prey });
  }
  // The chase sign with its population waves: prey peaks first, predator peaks follow.
  const signChase = kit.neonSign('+ −  PREDATOR · PREY', [6.1, 2.95, -1.75], { height: 0.36, color: DUSK, rotY: -0.4 });
  signChase.rotation.x = -0.55;
  const waveGroup = new T.Group();
  waveGroup.add(new T.Mesh(new T.BoxGeometry(1.9, 0.8, 0.05), kit.mats.plastic('#1a1228')));
  const wavePts = (phase: number, amp: number, base: number) => Array.from({ length: 24 }, (_, i) => {
    const u = i / 23;
    return [-0.82 + u * 1.64, base + Math.sin(u * TAU * 1.5 - phase) * amp, 0.04] as [number, number, number];
  });
  // Predator line below the prey line (far fewer wolves than moose), peaking a little later.
  const preyWave = kit.neonTube(wavePts(0, 0.2, 0.07), AMBER, { radius: 0.022 });
  const predWave = kit.neonTube(wavePts(1.2, 0.08, -0.2), DUSK, { radius: 0.022 });
  waveGroup.add(preyWave, predWave);
  waveGroup.position.set(6.1, 2.25, -1.55);
  waveGroup.rotation.set(-0.55, -0.4, 0);
  kit.add(waveGroup);
  kit.pole([6.1, 0, -1.7], 1.85, '#7a6a8a');

  // Willow meadow where the elk browse: willows regrow once the wolves are back (level 3).
  const meadow = new T.Group();
  meadow.position.set(6.3, GY, -3.6);
  kit.add(meadow);
  const willowSpots: [number, number][] = [[0, 0], [1.3, -0.5], [-1.1, -0.7]];
  const wTrunks = new T.InstancedMesh(trunkGeo, kit.mats.plastic('#5a4030'), willowSpots.length);
  const frondGeo = new T.ConeGeometry(0.05, 1.15, 5);
  frondGeo.rotateX(Math.PI);
  frondGeo.translate(0, -0.575, 0);
  const frondMat = kit.track(new T.MeshStandardMaterial({ color: '#8fbf5a', roughness: 0.7, emissive: '#3a6a28', emissiveIntensity: 0.1 }));
  const frondDry = new T.Color('#7a8f4a');
  const frondLush = new T.Color('#a6d86e');
  const frondsPer = 18;
  const fronds = new T.InstancedMesh(frondGeo, frondMat, willowSpots.length * frondsPer);
  const domes = new T.InstancedMesh(new T.SphereGeometry(0.5, 12, 8, 0, TAU, 0, Math.PI / 2), frondMat, willowSpots.length);
  willowSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.8, 1.65, 0.8);
    dummy.updateMatrix();
    wTrunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 1.6, z);
    dummy.scale.set(1, 0.7, 1);
    dummy.updateMatrix();
    domes.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < frondsPer; k++) {
      const a = (k / frondsPer) * TAU;
      const rr = 0.25 + (k % 3) * 0.1;
      dummy.position.set(x + Math.cos(a) * rr, 1.68, z + Math.sin(a) * rr);
      // Hang down and splay gently outward, like weeping willow strands.
      dummy.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      dummy.scale.set(1, 0.85 + ((k * 7) % 5) * 0.07, 1);
      dummy.updateMatrix();
      fronds.setMatrixAt(i * frondsPer + k, dummy.matrix);
    }
  });
  meadow.add(wTrunks, fronds, domes);
  const elkA = cutout(kit, 'elk', '#7a5434', LEAF, 1.1);
  elkA.position.set(5.0, 0.3, -2.3);
  elkA.rotation.y = -0.25;
  const elkB = cutout(kit, 'elk', '#6a4a30', LEAF, 0.95);
  elkB.position.set(7.3, 0.26, -2.0);
  elkB.rotation.y = -0.7;
  const signRipple = kit.neonSign('WOLVES · ELK · WILLOWS', [5.75, 1.85, -3.85], { height: 0.36, color: LEAF, rotY: -0.3 });
  signRipple.rotation.x = -0.6;

  // Rivals: a squirrel and a jay eye the same pile of acorns.
  const acornN = 9;
  const nuts = kit.add(new T.InstancedMesh(new T.SphereGeometry(0.1, 12, 9), kit.mats.plastic('#c58b4e'), acornN));
  const caps = kit.add(new T.InstancedMesh(new T.SphereGeometry(0.105, 12, 6, 0, TAU, 0, Math.PI / 2), kit.mats.plastic('#6b4a2e'), acornN));
  const ar = rng(5);
  for (let i = 0; i < acornN; i++) {
    const x = 6.0 + (ar() - 0.5) * 0.7;
    const z = 3.15 + (ar() - 0.5) * 0.5;
    dummy.position.set(x, GY + 0.1 + (i > 5 ? 0.16 : 0), z);
    dummy.rotation.set((ar() - 0.5) * 0.8, ar() * TAU, (ar() - 0.5) * 0.8);
    dummy.scale.set(1, 1.25, 1);
    dummy.updateMatrix();
    nuts.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.06;
    dummy.updateMatrix();
    caps.setMatrixAt(i, dummy.matrix);
  }
  const acornGlow = kit.orb([6.0, GY + 0.05, 3.15], 0.05, GOLD);
  const squirrel = cutout(kit, 'squirrel', '#9a6a44', MINUS, 1.1);
  squirrel.position.set(5.25, 0.12, 3.45);
  squirrel.rotation.y = -0.25;
  const jay = cutout(kit, 'jay', '#4a6ac0', MINUS, 0.85);
  jay.position.set(6.8, 0.2, 3.1);
  jay.rotation.y = Math.PI - 0.35;
  const signComp = kit.neonSign('− −  COMPETITION', [5.6, 0.8, 4.5], { height: 0.28, color: MINUS, rotY: -0.3 });
  signComp.rotation.x = -0.6;

  // ---- Lights and the Wonderlight fireworks over each wing.
  kit.spot([-5, 6.5, 4], [-6, 0, 0.5], '#ffdcae', 48, 0.62);
  kit.spot([5, 6.5, 4], [6, 0, 0], '#c2cbff', 44, 0.62);
  kit.point([-7.1, 1.2, -2.6], MOON, 6, 7);
  const fwL = kit.fireworks({ x0: -8.4, x1: -6.0, y0: 1.5, y1: 2.4, z: 0.4 }, [MOON, ROSE, PLUS]);
  const fwR = kit.fireworks({ x0: 6.0, x1: 8.4, y0: 1.5, y1: 2.4, z: 0.4 }, [DUSK, ZERO, AMBER]);

  // ---- Wonderlight: paper lanterns drift up from both wings (dark until level 4).
  const lanternsL = kit.motes({ x0: -8.6, x1: -4.2, y0: 0, y1: 3.2, z0: -4, z1: 4.5 }, 40, MOON, { speed: 0.22, size: 0.42 });
  const lanternsR = kit.motes({ x0: 4.2, x1: 8.6, y0: 0, y1: 3.2, z0: -4, z1: 4.5 }, 40, ROSE, { speed: 0.22, size: 0.42 });
  // Neon rings around the dance floor, the bandstand roof and the chase track.
  const ring = (cx: number, y: number, cz: number, r: number): [number, number, number][] => Array.from({ length: 24 }, (_, i) => [cx + Math.cos((i / 24) * TAU) * r, y, cz + Math.sin((i / 24) * TAU) * r]);
  const floorRing = kit.neonTube(ring(FLOOR[0], GY + 0.05, FLOOR[1], 1.36), MOON, { radius: 0.03, closed: true });
  const roofRing = kit.neonTube(ring(-6.5, GY + 1.66, 0.1, 1.36), ROSE, { radius: 0.03, closed: true });
  const trackRing = kit.neonTube(ring(5.8, GY + 0.18, 0.7, 1.5), DUSK, { radius: 0.03, closed: true });

  // ---- Motion: waltzing couples, the chase carousel and its bobbing runners.
  const chase = { speed: 0.1 };
  kit.animate((t, dt) => {
    danceT += dt * (dance.speed + dance.boost);
    placeDancers();
    rotor.rotation.y -= dt * (0.12 + 0.9 * chase.speed);
    for (let i = 0; i < runners.length; i++) {
      // Prey bob first; predators follow a beat later (the lag on the population graph).
      const r = runners[i];
      const ph = t * (0.8 + chase.speed) + (r.prey ? 0 : -1.2) + i * 0.05;
      r.m.position.y = 0.6 + Math.max(0, Math.sin(ph)) * 0.18 * chase.speed;
    }
    meadow.rotation.y = Math.sin(t * 0.3) * 0.02;
  });

  return {
    update(_t, _dt, level, energy) {
      const s0 = kit.stage(level, 0, 0.6);
      const s1 = kit.stage(level, 0.4, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      flat.repaint(level);
      moon.setLit(0.45 + 0.55 * s0);
      haloMat.opacity = 0.22 + 0.25 * s0 + 0.2 * s4;
      // The glade floor stays dusky so the Wonderlight neon and fireworks read against it.
      groundMat.emissiveIntensity = 0.3 + 0.2 * s1 - 0.12 * s4;
      bulbMat.color.setScalar(0.15 + 0.85 * s0 * (0.85 + 0.15 * energy));
      crownMat.emissiveIntensity = 0.22 + 0.2 * s3 + 0.08 * s4;
      marquee.setLit(0.15 + 0.45 * s1 + 0.4 * s4);
      // Mission 1: the masks, the partner signs and the commensal owl wake.
      signMut.setLit(0.15 + 0.85 * s1);
      signComp.setLit(0.15 + 0.85 * s1);
      signCom.setLit(0.15 + 0.85 * s1);
      signComSub.setLit(0.15 + 0.85 * s1);
      maskOwl.setLit(0.12 + 0.88 * s1);
      maskDeer.setLit(0.12 + 0.88 * s1);
      maskRaccoon.setLit(0.12 + 0.88 * s1);
      bandLamp.setLit(0.25 + 0.75 * s1);
      oakHollow.setLit(0.3 + 0.7 * s1);
      dew.setLit(0.2 + 0.8 * s1);
      acornGlow.setLit(0.2 + 0.8 * s1);
      owlRoost.setLit(0.25 + 0.75 * s1);
      squirrel.setLit(0.25 + 0.75 * s1);
      jay.setLit(0.25 + 0.75 * s1);
      capGlow.color.setScalar(0.2 + 0.5 * s1 + 0.3 * s4);
      floorMat.emissiveIntensity = 0.15 + 0.3 * s1 + 0.25 * s4;
      gownMat.emissiveIntensity = 0.05 + 0.1 * s1 + 0.06 * s4;
      headMat.emissiveIntensity = 0.05 + 0.1 * s4;
      dance.speed = 0.15 + 0.35 * s1 + 0.6 * s4;
      // Mission 2: the chase runs and the population waves light.
      signChase.setLit(0.15 + 0.85 * s2);
      preyWave.setLit(0.1 + 0.6 * s2);
      predWave.setLit(0.1 + 0.6 * s2);
      trackMat.emissiveIntensity = 0.2 + 0.5 * s2;
      canopyMat.emissiveIntensity = 0.05 + 0.6 * s2;
      for (let i = 0; i < runners.length; i++) runners[i].m.setLit(0.2 + 0.8 * s2);
      chase.speed = 0.08 + 0.92 * s2;
      // Mission 3: the wolves are back, the elk are held in check, the willows regrow.
      meadow.scale.set(1, 0.45 + 0.55 * s3, 1);
      frondMat.emissiveIntensity = 0.08 + 0.5 * s3;
      frondMat.color.copy(frondDry).lerp(frondLush, s3);
      elkA.setLit(0.2 + 0.8 * s3);
      elkB.setLit(0.2 + 0.8 * s3);
      signRipple.setLit(0.12 + 0.88 * s3);
      // Wonderlight: fireworks over both wings, a firefly swarm, every couple on the floor.
      fireflies.setLit(0.2 + 0.3 * s1 + 0.5 * s4);
      fwL.setLit(s4);
      fwR.setLit(s4);
      lanternsL.setLit(-0.15 + 1.15 * s4);
      lanternsR.setLit(-0.15 + 1.15 * s4);
      // The rings are big loops on the ground: kept below full neon so their bloom
      // doesn't haze the whole glade at the Wonderlight.
      floorRing.setLit(0.05 + 0.25 * s1 + 0.35 * s4);
      roofRing.setLit(0.03 + 0.6 * s4);
      trackRing.setLit(0.05 + 0.25 * s2 + 0.35 * s4);
    },
    celebrate(p) {
      const k = Math.sin(p * Math.PI);
      fwL.setLit(k);
      fwR.setLit(k);
      marquee.setLit(0.6 + 0.4 * k);
      dance.boost = 1.2 * k;
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const ballroomRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const floorTex = parquetTex(kit, '#a8754a', '#7a4f31', '#ffd27a');
  const floorMat = kit.track(new T.MeshStandardMaterial({ map: floorTex, roughness: 0.5, emissive: '#3a2412', emissiveIntensity: 0.05 }));
  const floor = kit.add(new T.Mesh(new T.CircleGeometry(0.62, 32), floorMat));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.25, 0.01, -0.05);
  // A little oak with its glowing hollow.
  const trunk = kit.add(new T.Mesh(new T.CylinderGeometry(0.06, 0.1, 0.6, 10), kit.mats.plastic('#5a3b2a')));
  trunk.position.set(-0.74, 0.3, -0.5);
  const leaf = kit.mats.plastic('#3f7a4e');
  for (const [x, y, z, s] of [[-0.74, 0.74, -0.5, 0.22], [-0.9, 0.64, -0.42, 0.15], [-0.58, 0.66, -0.6, 0.17]]) {
    const b = kit.add(new T.Mesh(new T.IcosahedronGeometry(s, 1), leaf));
    b.position.set(x, y, z);
  }
  const hollow = kit.orb([-0.74, 0.2, -0.42], 0.04, MOON);
  const moon = kit.orb([0.6, 1.3, -0.8], 0.16, '#ffe7b0');
  // A waltzing couple in masks.
  const gownGeo = new T.ConeGeometry(0.07, 0.22, 12);
  const couple: THREE.Group = new T.Group();
  const gA = new T.Mesh(gownGeo, kit.mats.plastic(PLUS));
  const gB = new T.Mesh(gownGeo, kit.mats.plastic(ROSE));
  const hA = new T.Mesh(new T.SphereGeometry(0.035, 10, 8), kit.mats.plastic('#f2dcc0'));
  const hB = hA.clone();
  gA.position.set(-0.08, 0.11, 0);
  gB.position.set(0.08, 0.11, 0);
  hA.position.set(-0.08, 0.26, 0);
  hB.position.set(0.08, 0.26, 0);
  couple.add(gA, gB, hA, hB);
  couple.position.set(0.25, 0.02, -0.05);
  couple.scale.setScalar(1.35);
  kit.add(couple);
  // A masquerade mask on the back wall.
  const maskMat = kit.track(new T.MeshStandardMaterial({ color: '#f4efe6', emissive: MOON, emissiveIntensity: 0.05, roughness: 0.4 }));
  const mask = kit.add(new T.Mesh(new T.ShapeGeometry(maskShape(T)), maskMat));
  mask.scale.setScalar(0.32);
  mask.position.set(0.1, 1.15, -0.86);
  const ff = kit.cloudOfPoints([0, 0.8, 0], 0.7, 50, FIREFLY);
  return {
    update(t, lit) {
      hollow.setLit(lit);
      moon.setLit(0.3 + 0.7 * lit);
      floorMat.emissiveIntensity = 0.05 + 0.3 * lit;
      maskMat.emissiveIntensity = 0.05 + 0.5 * lit;
      ff.setLit(lit * 0.9);
      if (!kit.reducedMotion) couple.rotation.y = t * 0.8 * (0.2 + lit);
    },
  };
};

// ---------------------------------------------------------------- the attraction

export const L21: TableDef = {
  lessonId: 'L21',
  signature: 'Alliance Pairs: linked partner targets that always light together, beside a predator-prey chase',
  ballRole: 'The Wonderball is just a game token: it runs the chase for whichever animal a lane names, but real moose and wolf numbers rise and fall over years, not seconds.',
  theme: {
    bg: ['#2e1a3d', '#0f1f24'],
    rail: '#dccaa8',
    railHighlight: '#ffffff',
    lampOn: MOON,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: ROSE,
    accent2: LEAF,
    bumperCap: '#f6e7d0',
    bumperRing: '#3b2350',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(216,242,122,0.16)',
    trail: FIREFLY,
  },
  lines: {
    intro: 'Welcome to the Wild Alliance Ballroom, where every guest wears a mask and every dance has two partners. Let’s find out who helps, who harms, and who just shares the floor.',
    quark: '"Wolves are the villains of this forest. Send every wolf away and the woods would be better off, surely?" Professor Quark wonders aloud.',
    pipTip: 'Pull the plunger a third of the way back to drop down the Wolf Trail through HOWL for a skill shot. The oak’s roots funnel shots into its hollow.',
  },
  build,
  skillShot: 'howl',
  shots: [
    { id: 'prey', label: 'Moose Run', on: [{ type: 'shot', id: 'moose_sw' }], insert: 'ins_moose' },
    { id: 'predator', label: 'Wolf Trail', on: [{ type: 'shot', id: 'wolf_sw' }], insert: 'ins_wolf' },
    { id: 'pocket', label: 'Oak Hollow', on: [{ type: 'saucer', id: 'oak_hollow' }], insert: 'ins_pocket' },
    { id: 'elk', label: 'Elk Herd', on: [{ type: 'dropBank', id: 'elk' }], insert: 'ins_elk' },
    { id: 'allies', label: 'Ant and Aphid', on: [{ type: 'target', group: 'allies' }], insert: 'ins_allies' },
    { id: 'rivals', label: 'Squirrel and Jay', on: [{ type: 'target', group: 'rivals' }], insert: 'ins_rivals' },
    { id: 'masks', label: 'Masked guests', on: [{ type: 'bumper', group: 'masks' }], insert: 'ins_masks' },
    { id: 'card', label: 'Dance card', on: [{ type: 'rollover', group: 'card' }], insert: 'ins_card' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Read the Masks',
      brief: 'Meet three masked predators (this lesson counts plant eaters too), then light both Alliance Pairs and read each partner’s sign.',
      objectiveIds: ['L21-O1', 'L21-O2'],
      stages: [
        { kind: 'collect', text: 'Meet carnivore, herbivore, omnivore: 9 mask hits', match: { type: 'bumper', group: 'masks' }, count: 9, lamps: ['mask_owl', 'mask_deer', 'mask_raccoon'], preview: ['masks'] },
        { kind: 'collect', text: 'Allies (+ +): light ANT and APHID', match: { type: 'target', group: 'allies' }, count: 2, distinct: true, lamps: ['ant', 'aphid'] },
        { kind: 'collect', text: 'Rivals (− −): light SQUIRREL and JAY', match: { type: 'target', group: 'rivals' }, count: 2, distinct: true, lamps: ['squirrel', 'jay'] },
        { kind: 'discover', text: 'Shoot the Oak Hollow to sort the dances', pocket: 'oak_hollow', questions: 1, types: ['classify', 'match'] },
      ],
      discovery: 'Rate an interaction by its effect on each partner: + helped, − harmed, 0 no effect. Mutualism is + +, competition is − −, and predation is + −.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'The Chase',
      brief: 'Run the moose (prey) and then the wolves (predators), twice, and watch predator numbers follow prey numbers.',
      objectiveIds: ['L21-O3'],
      stages: [
        { kind: 'shots', text: 'Prey boom: MOOSE RUN, then the WOLF TRAIL', shots: ['prey', 'predator'], order: 'sequence' },
        { kind: 'shots', text: 'Cycle two: moose rise, then wolves follow', shots: ['prey', 'predator'], order: 'sequence' },
        { kind: 'discover', text: 'Shoot the Oak Hollow to read the population graph', pocket: 'oak_hollow', questions: 1 },
      ],
      discovery: 'Plenty of prey feeds more predators; more predators then push prey numbers down, and hungry predators decline. On a graph, predator peaks often come a little after prey peaks.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Ripple Effect',
      brief: 'Bring the wolves home along the Wolf Trail, predict how the elk and willows respond, and judge how radio collars can track the pack.',
      objectiveIds: ['L21-O4', 'L21-O5'],
      stages: [
        { kind: 'shots', text: 'Wolves return: run the WOLF TRAIL', shots: ['predator'], order: 'any' },
        { kind: 'collect', text: 'Elk held in check: drop all 3 ELK', match: { type: 'drop', group: 'elk' }, count: 3, distinct: true, lamps: ['elk_1', 'elk_2', 'elk_3'] },
        { kind: 'discover', text: 'Oak Hollow: predict the ripple, plan the tracking', pocket: 'oak_hollow', questions: 1 },
      ],
      discovery: 'In a simple model, returning wolves hold elk numbers in check, so willows face less browsing. Real ecosystems add weather, other predators and hunting.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Grand Alliance Waltz',
    brief: 'Every partner takes the floor: run the chase, light both Alliance Pairs and the elk herd, then bring the Wonderball home.',
    stages: [
      { kind: 'shots', text: 'Waltz: moose, wolf, allies, rivals and elk', shots: ['prey', 'predator', 'allies', 'rivals', 'elk'], order: 'any' },
      { kind: 'discover', text: 'Final bow at the Oak Hollow', pocket: 'oak_hollow', questions: 2 },
    ],
    celebration: 'The whole glade dances: helpers, rivals, hunters and hunted, all linked by how they affect one another. The Wild Alliance Wonderlight is yours!',
  },
  set: ballroomSet,
  room: ballroomRoom,
  icons: {
    maskOwl(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.95, -s * 0.1);
      ctx.quadraticCurveTo(-s * 0.95, -s * 0.7, -s * 0.6, -s * 0.98);
      ctx.lineTo(-s * 0.32, -s * 0.52);
      ctx.quadraticCurveTo(0, -s * 0.66, s * 0.32, -s * 0.52);
      ctx.lineTo(s * 0.6, -s * 0.98);
      ctx.quadraticCurveTo(s * 0.95, -s * 0.7, s * 0.95, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.86, s * 0.48, s * 0.18, s * 0.42);
      ctx.lineTo(0, s * 0.9);
      ctx.lineTo(-s * 0.18, s * 0.42);
      ctx.quadraticCurveTo(-s * 0.86, s * 0.48, -s * 0.95, -s * 0.1);
      ctx.closePath();
      for (const sx of [-1, 1]) {
        ctx.moveTo(sx * s * 0.4 + s * 0.24, -s * 0.06);
        ctx.arc(sx * s * 0.4, -s * 0.06, s * 0.24, 0, Math.PI * 2);
      }
      ctx.fill('evenodd');
    },
    maskDeer(ctx, s) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.92, s * 0.05);
      ctx.bezierCurveTo(-s * 0.8, -s * 0.42, -s * 0.3, -s * 0.36, 0, -s * 0.18);
      ctx.bezierCurveTo(s * 0.3, -s * 0.36, s * 0.8, -s * 0.42, s * 0.92, s * 0.05);
      ctx.bezierCurveTo(s * 0.8, s * 0.42, s * 0.36, s * 0.46, 0, s * 0.3);
      ctx.bezierCurveTo(-s * 0.36, s * 0.46, -s * 0.8, s * 0.42, -s * 0.92, s * 0.05);
      ctx.closePath();
      for (const sx of [-1, 1]) {
        ctx.moveTo(sx * s * 0.42 + s * 0.2, s * 0.04);
        ctx.ellipse(sx * s * 0.42, s * 0.04, s * 0.2, s * 0.13, 0, 0, Math.PI * 2);
      }
      ctx.fill('evenodd');
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.3, -s * 0.3);
        ctx.quadraticCurveTo(sx * s * 0.42, -s * 0.72, sx * s * 0.3, -s * 0.98);
        ctx.moveTo(sx * s * 0.39, -s * 0.6);
        ctx.lineTo(sx * s * 0.7, -s * 0.84);
        ctx.moveTo(sx * s * 0.36, -s * 0.44);
        ctx.lineTo(sx * s * 0.62, -s * 0.52);
        ctx.stroke();
      }
    },
    maskRaccoon(ctx, s) {
      ctx.beginPath();
      // round ears
      for (const sx of [-1, 1]) {
        ctx.moveTo(sx * s * 0.58 + s * 0.24, -s * 0.62);
        ctx.arc(sx * s * 0.58, -s * 0.62, s * 0.24, 0, Math.PI * 2);
      }
      ctx.fill();
      // the bandit band with its eye holes
      ctx.beginPath();
      ctx.moveTo(-s * 0.98, -s * 0.12);
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.48, 0, -s * 0.26);
      ctx.quadraticCurveTo(s * 0.6, -s * 0.48, s * 0.98, -s * 0.12);
      ctx.quadraticCurveTo(s * 0.7, s * 0.4, 0, s * 0.18);
      ctx.quadraticCurveTo(-s * 0.7, s * 0.4, -s * 0.98, -s * 0.12);
      ctx.closePath();
      for (const sx of [-1, 1]) {
        ctx.moveTo(sx * s * 0.4 + s * 0.16, -s * 0.08);
        ctx.arc(sx * s * 0.4, -s * 0.08, s * 0.16, 0, Math.PI * 2);
      }
      ctx.fill('evenodd');
      // nose
      ctx.beginPath();
      ctx.ellipse(0, s * 0.56, s * 0.16, s * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    },
    acorn(ctx, s) {
      ctx.beginPath();
      ctx.ellipse(0, s * 0.2, s * 0.5, s * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.3, s * 0.66, s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-s * 0.07, -s * 0.9, s * 0.14, s * 0.4);
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s1 = stage(level, 0.4, 1.2);
      if (!reduced) drift(ctx, 13, 22, t, FIREFLY, [40, 200, 560, 800], 8, 1.8, (0.2 + 0.4 * s1) * (0.7 + 0.3 * energy));
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(286, 474, 10, 286, 474, 440);
      g.addColorStop(0, rgba(MOON, 0.8));
      g.addColorStop(1, rgba(MOON, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // Couples waltz outward from the Oak Hollow, each partner beside its partner.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.5;
        const d = 60 + p * 250;
        const cx = 286 + Math.cos(a) * d;
        const cy = 474 + Math.sin(a) * d * 0.8;
        const sp = t * 3 + i;
        const c = [PLUS, MINUS, MOON, ZERO][i % 4];
        glowDot(ctx, cx + Math.cos(sp) * 9, cy + Math.sin(sp) * 9, 9, c, 1 - p);
        glowDot(ctx, cx - Math.cos(sp) * 9, cy - Math.sin(sp) * 9, 9, c, 1 - p);
      }
    },
  },
};
export default L21;
