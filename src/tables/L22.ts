// Lesson 22 — Changing Ecosystems — "Comeback Garden"
// A valley seen from above at twilight, the season after an eruption buried it in lava.
// Signature: the Succession Plot, one patch of ground where only one community stands at a
// time (MOSS -> GRASS -> SHRUB -> TREES): knock a community down and the next, later one rises
// in its place. As the valley recovers, gates change the routes: beavers dam Beaver Creek (its
// orbit becomes a dead end whose spill waters the Ripple Meadow), and the Levee Gate opens the
// Delta. Every mission ends at the Field Station (the Wonder Pocket).

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Diverter, DropTarget, Mechanism } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { RoomBuilder, SetBuilder, SetKit } from '../game/render3d/setKit.ts';
import { TAU, drift, glowDot, mix, neonPath, neonText, plaque, rgba, rng, stage, stars, vgrad } from '../game/render/art.ts';

type Pt = [number, number];

const NIGHT = '#17152e';
const DUSK = '#2e2a52';
const BASALT = '#2b2931';
const LAVA = '#FF6A2A';
const MOSS = '#A9C95A';
const GRASS = '#6FA352';
const SHRUB = '#3E7448';
const FOREST = '#2C5A3C';
const WATER = '#2F8FB0';
const WATER_HI = '#8FE0EE';
const SAND = '#D7BE86';
const SOIL = '#5B4532';
const GOLD = '#FFC75B';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const LILAC = '#B9A2FF';
const FIREFLY = '#DDFF8A';

// ---------------------------------------------------------------- the Succession Plot

/** One community on the plot: a drop target the plot raises and lowers in turn. */
class PlotTarget extends DropTarget {}

/**
 * The Succession Plot: one patch of ground, four communities. Only one stage target stands at
 * a time; knocking it down lets the next, later community rise in the same place
 * (MOSS -> GRASS -> SHRUB -> TREES). After TREES falls the plot reports a completed
 * succession (a `dropBank` event) and, after a pause, starts again from the pioneers.
 * Targets only rise when no ball overlaps them, so nothing can be trapped.
 */
class SuccessionPlot extends Mechanism {
  kind = 'successionPlot' as const;
  stages: PlotTarget[] = [];
  current = 0;
  private raiseAt = -1;
  private raiseIdx = 0;
  constructor(rt: TableRuntime, id: string) {
    super(rt, id);
    this.group = 'succession';
  }
  /** Lower every stage except the pioneers. */
  init() {
    this.stages.forEach((t, i) => {
      if (i === 0) return;
      t.down = true;
      t.col.enabled = false;
      t.sink = 1;
    });
  }
  update(dt: number) {
    super.update(dt);
    const cur = this.stages[this.current];
    if (this.raiseAt < 0 && cur.down) {
      if (this.current === this.stages.length - 1) {
        // A full succession: report it like a cleared bank, then begin again from bare ground.
        this.hitFlash = 1;
        this.rt.emit({ type: 'dropBank', id: this.id, group: this.group, x: (cur.x1 + cur.x2) / 2, y: (cur.y1 + cur.y2) / 2 });
        this.raiseIdx = 0;
        this.raiseAt = this.rt.time + 1.6;
      } else {
        this.raiseIdx = this.current + 1;
        this.raiseAt = this.rt.time + 0.45;
      }
    }
    if (this.raiseAt >= 0 && this.rt.time >= this.raiseAt) {
      if (this.stages[this.raiseIdx].tryRaise()) {
        this.current = this.raiseIdx;
        this.raiseAt = -1;
      } else this.raiseAt = this.rt.time + 0.2;
    }
  }
}

const PLOT_LABELS = ['MOSS', 'GRASS', 'SHRUB', 'TREES'];
const PLOT = { x1: 212, x2: 248, y: 484 };

function successionPlot(b: TableBuilder) {
  const rt = b.rt;
  const plot = rt.add(new SuccessionPlot(rt, 'succession'));
  PLOT_LABELS.forEach((label, i) => {
    const t = rt.add(new PlotTarget(rt, `succ_${i + 1}`, PLOT.x1, PLOT.y, PLOT.x2, PLOT.y, { group: 'succession', label }));
    plot.stages.push(t);
  });
  plot.init();
}

/** The Delta cup and its mouth: the Levee Gate only moves while no ball is in this box. */
const DELTA_BOX = { x0: 70, x1: 150, y0: 450, y1: 590 };

/** Moves the Levee Gate only while nothing is inside or at the mouth of the Delta cup. */
class LeveeKeeper extends Mechanism {
  kind = 'leveeKeeper' as const;
  /** Diverter position wanted: 1 = closed (default), 0 = open. */
  want: 0 | 1 = 1;
  private div: Diverter;
  constructor(rt: TableRuntime, id: string, div: Diverter) {
    super(rt, id);
    this.div = div;
  }
  update(dt: number) {
    super.update(dt);
    if (this.div.position === this.want && this.div.pending === null) return;
    if (this.div.pending === this.want) return;
    for (const b of this.rt.world.balls) {
      if (b.state === 'drained' || b.layer !== 0) continue;
      if (b.x > DELTA_BOX.x0 && b.x < DELTA_BOX.x1 && b.y > DELTA_BOX.y0 && b.y < DELTA_BOX.y1) return;
    }
    this.div.set(this.want);
  }
}

// ---------------------------------------------------------------- geometry

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- Wind Lane: the left orbit; the Seed Spinner counts the seeds the wind carries in ---
  b.wall([[76, 606], [76, 388]], { id: 'wind_inner', r: 3 });
  b.post(76, 384, 5);
  b.post(76, 608, 4);
  b.spinner('seed_spinner', [29, 590], [71, 590], { label: 'SEEDS' });
  b.shotSwitch('wind_sw', 50, 470, -90);
  // A one-way gate deflects returning balls into play but lets the kickback fire up through it.
  b.gate('wind_gate', [FRAME.left, 646], [54, 694], -90);

  // --- The Delta: a scoop in a cup on the Wind Lane wall, behind the Levee Gate ---
  b.wall([[136, 552], [136, 500], [76, 470]], { id: 'delta_cup', r: 4 });
  b.saucer('delta', 100, 520, { role: 'scoop', ejectDeg: 64, ejectSpeed: 720, captureMaxSpeed: 1900, label: 'DELTA' });
  // position 0 = open (flush with the cup wall), 1 = closed across the cup mouth. The keeper
  // closes it as soon as play starts; it opens only when the Recovery Report needs the Delta.
  const levee = b.diverter('levee_gate', [136, 554], 54, -90, 180);
  b.rt.add(new LeveeKeeper(b.rt, 'levee_keeper', levee));
  b.shotSwitch('delta_sw', 110, 574, -100);

  // --- Beaver Creek: the right orbit. The Beaver Dam closes its top once beavers return. ---
  b.wall([[496, 606], [496, 400]], { id: 'creek_inner', r: 3 });
  b.post(496, 396, 5);
  b.post(496, 608, 4);
  b.shotSwitch('creek_sw', 522, 486, -90);
  b.wall([[FRAME.laneSep, 646], [518, 694]], { id: 'creek_deflect', r: 3 });
  // position 0 = no dam (blade along the bank), 1 = dam across the creek's top
  b.diverter('beaver_dam', [496, 396], 69, 90, -41.5);

  // --- Succession Plot: a raised bed on the left flipper's straight-up line ---
  b.wall([[204, 498], [204, 468], [230, 450], [256, 468], [256, 498]], { id: 'plot_bed', r: 3, style: 'wood' });
  b.wall([[204, 468], [256, 468]], { id: 'plot_back', r: 3, style: 'wood' });
  successionPlot(b);

  // --- Field Station: the Wonder Pocket, on the right flipper's straight-up line ---
  b.wall([[312, 494], [312, 444], [339, 426], [366, 444], [366, 494]], { id: 'station_cup', r: 4, style: 'wood' });
  b.saucer('field_station', 339, 472, { role: 'pocket', ejectDeg: 110, ejectSpeed: 760, captureMaxSpeed: 2400, label: 'FIELD STATION', icon: 'journal' });

  // --- Prairie dog town: burrow bumpers under the top lanes ---
  b.bumper('burrow_1', 196, 262, { group: 'burrows', r: 24, icon: 'burrow' });
  b.bumper('burrow_2', 286, 232, { group: 'burrows', r: 24, icon: 'burrow' });
  b.bumper('burrow_3', 376, 262, { group: 'burrows', r: 24, icon: 'burrow' });

  // --- Top lanes: three nonliving conditions every community depends on ---
  ['SUN', 'RAIN', 'SOIL'].forEach((l, i) => b.rollover(`lane_${l.toLowerCase()}`, 238 + i * 48, 150, { group: 'conditions', label: l }));
  for (const gx of [214, 262, 310, 358]) {
    b.wall([[gx, 124], [gx, 174]], { r: 3 });
    b.post(gx, 122, 5);
  }

  // --- Ripple Meadow: species tied to the prairie dogs (left flipper cross shot, dam spill) ---
  b.target('ripple_owl', [414, 410], [440, 426], { group: 'ripples', label: 'OWL' });
  b.target('ripple_ferret', [412, 478], [438, 494], { group: 'ripples', label: 'FERRET' });
  b.target('ripple_bison', [396, 552], [422, 568], { group: 'ripples', label: 'BISON' });

  // --- Evidence plots: a study plot without beavers and one with them ---
  b.target('plot_without', [146, 376], [168, 352], { group: 'evidence', label: 'WITHOUT' });
  b.target('plot_with', [404, 352], [426, 376], { group: 'evidence', label: 'WITH' });

  // --- Inserts that preview shots ---
  // No insert label here: a label below y ≈ 650 sits behind the wind gate blade in 3D and
  // gets clipped; the printed SEEDS and WIND LANE name this shot instead.
  b.insert('ins_wind', 50, 636, { deg: -90 });
  b.insert('ins_creek', 522, 604, { deg: -90, label: 'CREEK' });
  b.insert('ins_delta', 132, 616, { deg: -110 });
  b.insert('ins_plot', 230, 540, { deg: -90 });
  b.insert('ins_station', 339, 540, { deg: -90 });
  b.insert('ins_town', 286, 300, { shape: 'star', size: 11 });
  b.insert('ins_ripples', 400, 604, { deg: -60, size: 13 });
}

// ---------------------------------------------------------------- printed playfield helpers

/** Smooth open path through points (quadratic midpoints). */
function smooth(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Irregular rounded blob (moss cushion, shrub, pond). */
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, color: string, squash = 1) {
  const rr = rng(seed);
  const n = 9;
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const d = r * (0.72 + rr() * 0.42);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * squash]);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const q = pts[(k + 1) % n];
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    if (k === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p[0], p[1], mx, my);
  }
  const p0 = pts[0];
  const q0 = pts[1];
  ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2);
  ctx.closePath();
  ctx.fill();
}

/** A tuft of grass blades. */
function tuft(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, alpha: number) {
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const dx of [-3, 0, 3]) {
    ctx.moveTo(x + dx * 0.4, y);
    ctx.quadraticCurveTo(x + dx * 0.6, y - h * 0.6, x + dx * 1.3, y - h);
  }
  ctx.stroke();
}

/** A tree crown seen from above: dark rim, leafy body, light catching the top-left. */
function crown(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  blob(ctx, x + 2, y + 3, r, seed, 'rgba(8,14,10,0.45)');
  blob(ctx, x, y, r, seed, color);
  blob(ctx, x - r * 0.25, y - r * 0.25, r * 0.5, seed + 3, mix(color, '#b8d890', 0.16));
  ctx.restore();
}

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  ctx.fillStyle = rgba(color, alpha);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgba(GOLD, alpha);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, TAU);
  ctx.fill();
}

/** A dandelion seed with its parachute: the wind's passengers. */
function seedFluff(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save();
  ctx.strokeStyle = rgba(IVORY, alpha);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + s * 1.4);
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.32;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
  }
  ctx.stroke();
  ctx.fillStyle = rgba('#c8a070', alpha);
  ctx.beginPath();
  ctx.ellipse(x, y + s * 1.55, s * 0.18, s * 0.32, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Side-view animal silhouettes, small, as printed field-guide stamps. */
function prairieDog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.32, s * 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - s * 0.68, s * 0.26, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.62, s * 0.55, s * 0.16, 0, 0, TAU);
  ctx.fill();
}

function bison(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-s * 0.9, s * 0.1);
  ctx.quadraticCurveTo(-s * 0.85, -s * 0.45, -s * 0.2, -s * 0.5);
  ctx.quadraticCurveTo(s * 0.35, -s * 0.85, s * 0.62, -s * 0.35);
  ctx.quadraticCurveTo(s * 1.0, -s * 0.2, s * 0.95, s * 0.2);
  ctx.lineTo(s * 0.62, s * 0.25);
  ctx.lineTo(s * 0.55, s * 0.62);
  ctx.lineTo(s * 0.4, s * 0.62);
  ctx.lineTo(s * 0.35, s * 0.3);
  ctx.lineTo(-s * 0.55, s * 0.3);
  ctx.lineTo(-s * 0.6, s * 0.62);
  ctx.lineTo(-s * 0.75, s * 0.62);
  ctx.lineTo(-s * 0.8, s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function owl(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, eye: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.45, s * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = eye;
  for (const dx of [-0.17, 0.17]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y - s * 0.25, s * 0.12, 0, TAU);
    ctx.fill();
  }
}

function ferret(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.32;
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.1);
  ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.45, x + s * 0.6, y);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + s * 0.72, y - s * 0.05, s * 0.2, 0, TAU);
  ctx.fill();
}

/** Text running up a lane (reads bottom to top). */
function laneText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number) {
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

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number) {
  ctx.save();
  ctx.font = `800 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12,10,20,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = rgba(color, alpha);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Where the river runs once water returns: from Beaver Creek's mouth across the valley to the Delta. */
const RIVER: Pt[] = [[522, 612], [510, 664], [466, 704], [384, 724], [300, 726], [226, 704], [180, 664], [150, 620], [122, 576], [104, 540]];
/** The cooled lava flow from the crater down into the valley. */
const LAVA_FLOW: Pt[] = [[122, 120], [140, 170], [132, 222], [150, 290], [128, 360], [170, 420], [214, 440]];

/** Basalt plate centres: a jittered grid used for the cracked lava field and its colonists. */
function basaltGrid(): Pt[][] {
  const r = rng(220);
  const rows: Pt[][] = [];
  for (let gy = 0; gy < 15; gy++) {
    const row: Pt[] = [];
    for (let gx = 0; gx < 12; gx++) row.push([60 + gx * 42 + (r() - 0.5) * 22, 200 + gy * 42 + (r() - 0.5) * 22]);
    rows.push(row);
  }
  return rows;
}
const GRID = basaltGrid();

/** Soft-edged habitat field: a smooth closed shape filled with a blurred wash. */
function zone(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, alpha: number, blur = 10) {
  if (alpha <= 0.01) return;
  ctx.save();
  // Blur is measured in canvas pixels, so scale it with the print resolution.
  const k = Math.abs(ctx.getTransform().a) || 1;
  ctx.filter = `blur(${(blur * k).toFixed(1)}px)`;
  ctx.fillStyle = rgba(color, alpha);
  smooth(ctx, [...pts, pts[0], pts[1]]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Habitat zones of the valley (table units). */
const Z_PIONEER: Pt[] = [[34, 252], [110, 236], [200, 258], [252, 330], [262, 430], [214, 448], [150, 430], [92, 400], [40, 340]];
const Z_PRAIRIE: Pt[] = [[150, 196], [300, 186], [450, 192], [548, 236], [548, 312], [460, 336], [330, 344], [200, 330], [150, 300]];
const Z_MEADOW: Pt[] = [[150, 470], [230, 420], [330, 400], [400, 430], [420, 560], [400, 680], [300, 740], [190, 720], [140, 620]];
const Z_RIPPLE: Pt[] = [[384, 380], [492, 372], [494, 620], [430, 640], [380, 560]];
const Z_WET: Pt[] = [[30, 452], [140, 452], [200, 560], [180, 650], [100, 680], [30, 640]];
const Z_FOREST: Pt[] = [[30, 650], [110, 700], [200, 760], [300, 790], [420, 770], [500, 700], [548, 650], [548, 800], [30, 800]];

function paintValley(ctx: CanvasRenderingContext2D, level: number) {
  const sMoss = stage(level, 0.05, 1.1);
  const sGrass = stage(level, 0.8, 2.1);
  const sShrub = stage(level, 1.6, 3);
  const sTree = stage(level, 2.3, 3.6);
  const sBloom = stage(level, 3.3, 4);
  const sWater = stage(level, 0.7, 2);
  const sDelta = stage(level, 2, 3.3);
  const green = stage(level, 0.4, 3.6);

  // Valley floor: dark basalt that slowly turns to living ground, lighter where the ball runs.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, NIGHT], [0.2, mix(BASALT, '#25362c', green * 0.8)], [0.72, mix('#24212a', '#1d2e27', green * 0.8)], [1, '#121820']]);
  ctx.fillRect(0, 0, 600, 1150);
  const pool = ctx.createRadialGradient(290, 520, 40, 290, 520, 380);
  pool.addColorStop(0, rgba(mix('#4a4552', '#4a6a4a', green), 0.35));
  pool.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 150, 600, 800);

  // Twilight sky inside the arch; it warms toward dawn as the valley recovers.
  ctx.fillStyle = vgrad(ctx, 0, 250, [[0, NIGHT], [0.6, mix(DUSK, '#55406a', sBloom)], [1, mix('#3a2f4e', '#7a5560', sBloom * 0.7)]]);
  ctx.fillRect(0, 0, 600, 250);
  stars(ctx, 22, 70, [60, 20, 560, 170], IVORY);

  // Prairie hills on the right, the volcano on the left.
  ctx.fillStyle = mix('#2a2638', '#2e4632', green * 0.9);
  smooth(ctx, [[300, 262], [330, 200], [390, 168], [450, 176], [500, 150], [560, 190], [600, 230], [600, 262]]);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mix('#332d40', '#3d5a36', green * 0.8);
  smooth(ctx, [[340, 262], [380, 226], [440, 212], [510, 222], [600, 250], [600, 262]]);
  ctx.closePath();
  ctx.fill();
  const cone: Pt[] = [[20, 268], [64, 196], [98, 138], [112, 116], [134, 114], [150, 132], [196, 196], [262, 262]];
  ctx.fillStyle = mix('#2d2836', '#2f3f33', stage(level, 1.5, 4) * 0.7);
  poly(ctx, cone);
  ctx.fill();
  // ridges on the cone catch the last light
  ctx.strokeStyle = rgba('#5a4f6a', 0.5);
  ctx.lineWidth = 1.5;
  for (const [x0, x1] of [[112, 70], [123, 120], [134, 186]] as Pt[]) {
    ctx.beginPath();
    ctx.moveTo(x0, 122);
    ctx.quadraticCurveTo((x0 + x1) / 2 + 6, 190, x1, 262);
    ctx.stroke();
  }
  if (green > 0.02) {
    ctx.save();
    poly(ctx, cone);
    ctx.clip();
    ctx.fillStyle = rgba(GRASS, 0.45 * green);
    smooth(ctx, [[0, 268], [40, 236 - 40 * green], [120, 250 - 70 * green], [200, 234 - 30 * green], [280, 268]]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Crater: still warm, never fierce.
  glowDot(ctx, 123, 116, 44, LAVA, 0.5 - 0.3 * stage(level, 0, 2.5));
  ctx.fillStyle = '#1a1420';
  ctx.beginPath();
  ctx.ellipse(123, 117, 13, 4, 0, 0, TAU);
  ctx.fill();

  // Cracked basalt plates of the lava field; soil and roots soften them as life returns.
  const ember = 1 - stage(level, 0, 1.6);
  const r = rng(77);
  ctx.save();
  ctx.lineCap = 'round';
  for (let gy = 0; gy < GRID.length - 1; gy++) {
    for (let gx = 0; gx < GRID[gy].length - 1; gx++) {
      const a = GRID[gy][gx];
      const b2 = GRID[gy][gx + 1];
      const c = GRID[gy + 1][gx + 1];
      const d = GRID[gy + 1][gx];
      const shade = r();
      ctx.fillStyle = rgba(shade > 0.5 ? '#3d3943' : '#1b1920', 0.2 * (1 - green * 0.75));
      poly(ctx, [a, b2, c, d]);
      ctx.fill();
      ctx.strokeStyle = rgba('#08060c', 0.45 * (1 - green * 0.7));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b2[0], b2[1]);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.stroke();
      if (ember > 0.02 && shade < 0.14) {
        ctx.strokeStyle = rgba(LAVA, 0.35 * ember);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b2[0], b2[1]);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Habitat fields fill in, each in its turn: pioneers on the lava, then meadow and prairie,
  // the wetland once the river is diverted to it, and a forest edge last.
  zone(ctx, Z_PIONEER, '#7f9a45', 0.42 * sMoss * (1 - 0.35 * sShrub));
  zone(ctx, Z_PIONEER, '#3c6a40', 0.5 * sShrub);
  zone(ctx, Z_PRAIRIE, '#8a8540', 0.42 * sGrass);
  zone(ctx, Z_MEADOW, '#4a7a44', 0.5 * sGrass);
  zone(ctx, Z_RIPPLE, '#5d8a4a', 0.45 * stage(level, 1.2, 2.2));
  zone(ctx, Z_WET, '#2f6a5e', 0.5 * sDelta);
  zone(ctx, Z_FOREST, '#24452f', 0.65 * sTree);

  // The cooled lava flow: a dark tongue with a glowing rim that cools and is colonised.
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  smooth(ctx, LAVA_FLOW);
  ctx.strokeStyle = rgba('#120e16', 0.7);
  ctx.lineWidth = 20;
  ctx.stroke();
  smooth(ctx, LAVA_FLOW);
  ctx.strokeStyle = rgba(LAVA, 0.1 + 0.4 * ember);
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 9]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Pioneers: moss cushions settle along the flow and on the bare slope first.
  if (sMoss > 0.01) {
    const rm = rng(91);
    const a = 0.75 * sMoss * (1 - 0.45 * sTree);
    for (let i = 0; i < 34; i++) {
      const k = rm() * (LAVA_FLOW.length - 1);
      const j = Math.floor(k);
      const f = k - j;
      const p = LAVA_FLOW[j];
      const q = LAVA_FLOW[Math.min(LAVA_FLOW.length - 1, j + 1)];
      const x = p[0] + (q[0] - p[0]) * f + (rm() - 0.5) * 30;
      const y = p[1] + (q[1] - p[1]) * f + (rm() - 0.5) * 20;
      blob(ctx, x, y, 3 + rm() * 4 * (0.6 + sMoss), 300 + i, rgba(i % 3 ? MOSS : '#c9dc7a', a), 0.8);
    }
  }

  // Riverbed: dry gravel at first; water returns after the first mission.
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  smooth(ctx, RIVER);
  ctx.strokeStyle = rgba('#4d4840', 0.35 + 0.35 * sWater);
  ctx.lineWidth = 19;
  ctx.stroke();
  if (sWater > 0.01) {
    smooth(ctx, RIVER);
    ctx.strokeStyle = rgba(WATER, 0.8 * sWater);
    ctx.lineWidth = 13;
    ctx.stroke();
    smooth(ctx, RIVER);
    ctx.strokeStyle = rgba(WATER_HI, 0.35 * sWater);
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 16]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  // Creek channel bed and water (behind the creek rails).
  ctx.fillStyle = rgba('#17151c', 0.55 * (1 - sWater));
  ctx.fillRect(500, 300, 46, 320);
  if (sWater > 0.01) {
    ctx.fillStyle = vgrad(ctx, 300, 620, [[0, rgba(WATER, 0.5 * sWater)], [1, rgba('#2b6f8f', 0.65 * sWater)]]);
    ctx.fillRect(502, 300, 42, 320);
  }

  // Grasses: sparse tufts in the meadow and the prairie.
  if (sGrass > 0.01) {
    const rg = rng(17);
    for (let i = 0; i < 170; i++) {
      const x = 130 + rg() * 380;
      const y = 200 + rg() * 560;
      tuft(ctx, x, y, 4 + rg() * 5, i % 3 ? '#79a55a' : '#a4b860', 0.45 * sGrass);
    }
  }
  // Shrubs gather at the margins.
  if (sShrub > 0.01) {
    const rs = rng(55);
    const spots: Pt[] = [[96, 700], [150, 760], [40, 760], [470, 760], [520, 730], [176, 410], [384, 312], [462, 316], [176, 214], [400, 200], [252, 660], [330, 690]];
    spots.forEach(([x, y], i) => {
      const s = (8 + rs() * 6) * (0.4 + 0.6 * sShrub);
      blob(ctx, x + 2, y + 3, s, i * 7 + 1, rgba('#0c140f', 0.35 * sShrub));
      blob(ctx, x, y, s, i * 7 + 1, rgba(SHRUB, 0.85 * sShrub));
      blob(ctx, x - s * 0.25, y - s * 0.25, s * 0.5, i * 7 + 2, rgba('#6fa860', 0.3 * sShrub));
    });
  }
  // Trees close the canopy last: along the volcano's foot and the valley's lower edge.
  if (sTree > 0.01) {
    const trees: [number, number, number][] = [[46, 286, 15], [74, 332, 12], [96, 248, 10], [100, 760, 16], [56, 792, 13], [146, 786, 12], [196, 778, 10], [384, 782, 10], [440, 790, 12], [486, 770, 15], [528, 742, 12], [430, 642, 10], [360, 300, 8]];
    trees.forEach(([x, y, s], i) => crown(ctx, x, y, s * (0.35 + 0.65 * sTree), i * 13 + 5, i % 2 ? FOREST : '#3d6e46', 0.95 * sTree));
  }
  // Wildflowers at the Wonderlight, in drifts rather than confetti.
  if (sBloom > 0.01) {
    const rf = rng(303);
    const cols = [CORAL, GOLD, LILAC, IVORY];
    const drifts: Pt[] = [[170, 640], [300, 690], [410, 470], [250, 380], [130, 420], [470, 680]];
    drifts.forEach(([cx, cy], di) => {
      for (let i = 0; i < 8; i++) flower(ctx, cx + (rf() - 0.5) * 50, cy + (rf() - 0.5) * 34, 1.9 + rf() * 1.2, cols[(di + i) % cols.length], 0.85 * sBloom);
    });
  }

  // Beaver pond above the dam at the creek's head (the dam goes up after the first mission).
  const sPond = stage(level, 0.6, 1.6);
  if (sPond > 0.01) {
    ctx.save();
    ctx.globalAlpha = sPond;
    blob(ctx, 522, 330, 30, 41, rgba(WATER, 0.75), 0.9);
    blob(ctx, 516, 330, 18, 43, rgba(WATER_HI, 0.25), 0.8);
    // log dam along the dam's line
    ctx.strokeStyle = '#7a5134';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(498 + k * 2, 392 - k * 4);
      ctx.lineTo(540 + k * 2, 354 - k * 4);
      ctx.stroke();
    }
    // lodge
    blob(ctx, 528, 312, 9, 47, '#5d3c26');
    ctx.restore();
  }

  // The Delta: a fan of new land at the river mouth, built from the river's sediment.
  ctx.save();
  ctx.beginPath();
  ctx.rect(78, 472, 56, 82);
  ctx.clip();
  ctx.fillStyle = rgba('#3a3530', 0.6);
  ctx.fillRect(78, 472, 56, 82);
  if (sDelta > 0.01) {
    const fan = 20 + 42 * sDelta;
    ctx.fillStyle = rgba(SAND, 0.75 * sDelta);
    ctx.beginPath();
    ctx.moveTo(118, 560);
    ctx.arc(118, 560, fan, Math.PI * 1.02, Math.PI * 1.62);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(WATER, 0.8 * sDelta);
    ctx.lineWidth = 2;
    for (const a of [1.12, 1.27, 1.42, 1.55]) {
      ctx.beginPath();
      ctx.moveTo(118, 560);
      ctx.quadraticCurveTo(118 + Math.cos(Math.PI * a) * fan * 0.5 + 4, 560 + Math.sin(Math.PI * a) * fan * 0.5, 118 + Math.cos(Math.PI * a) * fan, 560 + Math.sin(Math.PI * a) * fan);
      ctx.stroke();
    }
    for (let i = 0; i < 16; i++) tuft(ctx, 86 + (i * 37) % 44, 490 + (i * 23) % 56, 6, '#8cbf5f', 0.7 * stage(level, 2.8, 3.8));
  }
  ctx.restore();

  // Prairie dog mounds around the town.
  const town = stage(level, 0.5, 1.5);
  const mounds: Pt[] = [[150, 300], [244, 296], [330, 300], [420, 292], [236, 196], [340, 196]];
  mounds.forEach(([x, y], i) => {
    blob(ctx, x, y, 10, 60 + i, rgba('#7a5a3e', 0.55), 0.6);
    ctx.fillStyle = 'rgba(10,8,8,0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 3.5, 2.2, 0, 0, TAU);
    ctx.fill();
    if (town > 0.01 && i % 2 === 0) prairieDog(ctx, x + 7, y - 7, 7, rgba('#d8a86a', 0.9 * town));
  });

  // Ripple Meadow residents arrive as the prairie dogs return.
  const meadow = stage(level, 1.2, 2.2);
  if (meadow > 0.01) {
    owl(ctx, 456, 404, 10, rgba('#a07e58', meadow), rgba(GOLD, meadow));
    ferret(ctx, 462, 470, 9, rgba('#d6b27a', meadow));
    bison(ctx, 462, 540, 13, rgba('#4a3324', meadow), -1);
    bison(ctx, 352, 640, 11, rgba('#4a3324', 0.8 * meadow));
  }

  // Evidence plots: staked squares, one dry, one beside a beaver pond.
  const ev = 0.4 + 0.6 * stage(level, 1.6, 2.6);
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(IVORY, 0.35 * ev);
  ctx.strokeRect(118, 326, 72, 70);
  ctx.strokeRect(384, 326, 72, 70);
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = rgba('#7a6650', 0.35);
  ctx.fillRect(120, 328, 68, 66);
  blob(ctx, 432, 382, 16, 501, rgba(WATER, 0.55 * ev), 0.6);
  for (let i = 0; i < 10; i++) tuft(ctx, 390 + (i * 29) % 62, 334 + (i * 17) % 56, 7, '#8cbf5f', 0.7 * ev);
  for (const [x, y] of [[130, 340], [160, 386], [176, 340]] as Pt[]) {
    ctx.strokeStyle = 'rgba(20,14,10,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 4, y + 3);
    ctx.lineTo(x + 7, y - 4);
    ctx.stroke();
  }

  // Raised bed for the Succession Plot and the deck of the Field Station.
  ctx.fillStyle = rgba(SOIL, 0.85);
  ctx.fillRect(196, 442, 68, 64);
  ctx.strokeStyle = rgba('#a8784a', 0.8);
  ctx.lineWidth = 3;
  ctx.strokeRect(196, 442, 68, 64);
  ctx.fillStyle = rgba('#6b4a30', 0.85);
  ctx.fillRect(302, 418, 74, 88);
  ctx.strokeStyle = rgba('#c49464', 0.7);
  ctx.lineWidth = 1;
  for (let y = 424; y < 506; y += 8) {
    ctx.beginPath();
    ctx.moveTo(302, y);
    ctx.lineTo(376, y);
    ctx.stroke();
  }

  // Succession strip: one path through time, lit stage by stage.
  const steps = ['MOSS', 'GRASS', 'SHRUB', 'TREES'];
  const stepColors = [MOSS, GRASS, SHRUB, '#4f9a5e'];
  steps.forEach((s, i) => {
    const x = 170 + i * 40;
    const lit = stage(level, i * 0.9 - 0.4, i * 0.9 + 0.4);
    ctx.fillStyle = rgba('#0f0d16', 0.6);
    ctx.beginPath();
    ctx.arc(x, 584, 11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(stepColors[i], 0.35 + 0.65 * lit);
    ctx.lineWidth = 2;
    ctx.stroke();
    if (i === 0) blob(ctx, x, 586, 6, 9, rgba(MOSS, 0.4 + 0.6 * lit), 0.7);
    if (i === 1) tuft(ctx, x, 591, 11, GRASS, 0.4 + 0.6 * lit);
    if (i === 2) blob(ctx, x, 585, 7, 13, rgba(SHRUB, 0.5 + 0.5 * lit));
    if (i === 3) {
      ctx.fillStyle = rgba('#4f9a5e', 0.4 + 0.6 * lit);
      ctx.beginPath();
      ctx.moveTo(x, 575);
      ctx.lineTo(x + 7, 590);
      ctx.lineTo(x - 7, 590);
      ctx.closePath();
      ctx.fill();
    }
    if (i < 3) label(ctx, '›', x + 20, 584, 12, IVORY, 0.5);
    label(ctx, s, x, 604, 7, IVORY, 0.45 + 0.5 * lit);
  });

  // Seeds riding the wind down the Wind Lane.
  const rsd = rng(8);
  for (let i = 0; i < 9; i++) seedFluff(ctx, 34 + rsd() * 32, 400 + i * 22 + rsd() * 8, 4.5, 0.25 + 0.4 * stage(level, 0, 2));

  // Lower valley: a marsh coast that greens, then the bay below the flippers.
  ctx.fillStyle = vgrad(ctx, 790, 1150, [[0, rgba('#1c2b26', 0.0)], [0.35, rgba(mix('#2a2a2a', '#1f3a30', green), 0.55)], [0.75, rgba('#173444', 0.75)], [1, '#0f2232']]);
  ctx.fillRect(0, 790, 600, 360);
  ctx.strokeStyle = rgba(WATER_HI, 0.08 + 0.12 * sWater);
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    for (let x = 0; x <= 600; x += 10) {
      const y = 1062 + k * 14 + Math.sin(x / 26 + k) * 2.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const rr2 = rng(404);
  for (let i = 0; i < 46; i++) {
    const x = 20 + rr2() * 560;
    const y = 960 + rr2() * 80;
    if (x > 150 && x < 430 && y > 940) continue;
    tuft(ctx, x, y, 8 + rr2() * 6, '#7da36a', 0.25 + 0.45 * green);
  }

  // Labels (names the 3D view doesn't print). In 3D a wall hides print just behind it (toward
  // the head), so each name sits in front of its feature: SEEDS below the spinner blade,
  // SUCCESSION PLOT below the bed (level with the engine's FIELD STATION floor label, which
  // names the pocket in both views), LEVEE GATE below the gate across the Delta's mouth.
  laneText(ctx, 'WIND LANE', 50, 430, 10, IVORY, 0.55);
  label(ctx, 'SEEDS', 50, 607, 8, IVORY, 0.7);
  laneText(ctx, 'BEAVER CREEK', 522, 548, 9, IVORY, 0.55);
  laneText(ctx, 'RIPPLE MEADOW', 474, 500, 9, IVORY, 0.5);
  label(ctx, 'SUCCESSION PLOT', 230, 515, 8, IVORY, 0.8);
  label(ctx, 'NO BEAVERS', 154, 318, 7, IVORY, 0.55);
  label(ctx, 'BEAVERS', 420, 318, 7, IVORY, 0.55);
  label(ctx, 'LEVEE GATE', 108, 588, 7, IVORY, 0.7);
  plaque(ctx, 'PRAIRIE DOG TOWN', 286, 330, rgba(GOLD, 0.25 + 0.6 * town), '#1a1030', 8);
  if (sPond > 0.2) label(ctx, 'DAM', 522, 372, 7, IVORY, 0.6 * sPond);

  // Apron: the path of succession, step by step, and the honest footnote.
  const apron = ['BARE ROCK', 'MOSS', 'GRASS', 'SHRUBS', 'TREES'];
  apron.forEach((w, i) => {
    const x = 132 + i * 77;
    const lit = i === 0 ? 1 : stage(level, i - 1.2, i - 0.2);
    label(ctx, w, x, 1080, 10, i === 0 ? '#c9c2d2' : stepColors[Math.min(3, i - 1)], 0.35 + 0.65 * lit);
    if (i < 4) label(ctx, '›', x + 38, 1080, 11, IVORY, 0.4);
  });
  label(ctx, 'Slow, step by step, and not always back to what was there before', 286, 1098, 8, IVORY, 0.25 + 0.5 * stage(level, 2.5, 4));

  // Marquee lettering under the arch, set well behind the top-lane posts so they don't cut it.
  neonText(ctx, 'COMEBACK GARDEN', 286, 62, 22, GOLD, stage(level, 1.2, 2.2));
  // A recovering valley's own glow at the Wonderlight.
  if (sBloom > 0.01) {
    const g = ctx.createRadialGradient(300, 520, 40, 300, 520, 560);
    g.addColorStop(0, rgba(GOLD, 0.1 * sBloom));
    g.addColorStop(1, rgba(GOLD, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 1150);
  }
}

// ---------------------------------------------------------------- 3D attraction set

const GROUND = -0.42;

/** Position-based jitter so shared seam vertices move together (no cracks). */
function craggy(geo: THREE.BufferGeometry, amp: number, keepBelow = -Infinity) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    if (y <= keepBelow) continue;
    const n = Math.sin(x * 5.1 + y * 3.7) * Math.cos(z * 4.3 - y * 2.1) + Math.sin((x + z) * 7.7) * 0.5;
    const k = 1 + n * amp;
    p.setXYZ(i, x * k, y + n * amp * 0.25, z * k);
  }
  geo.computeVertexNormals();
}

interface Item {
  x: number;
  y: number;
  z: number;
  s: number;
  ry?: number;
  sy?: number;
}

/** An instanced patch of identical props that can grow from nothing to full size. */
function grower(kit: SetKit, geo: THREE.BufferGeometry, mat: THREE.Material, items: Item[]) {
  const T = kit.THREE;
  const mesh = new T.InstancedMesh(geo, mat, items.length);
  mesh.castShadow = true;
  const dummy = new T.Object3D();
  let last = -1;
  const grow = (k: number) => {
    const q = Math.round(k * 60) / 60;
    if (q === last) return;
    last = q;
    mesh.visible = q > 0.01;
    // Plain loop: this runs every frame while the scenery level is animating.
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const s = Math.max(0.001, it.s * q);
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(0, it.ry ?? 0, 0);
      dummy.scale.set(s, s * (it.sy ?? 1), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  grow(1);
  kit.add(mesh);
  return { mesh, grow };
}

/** Scatter n items over a rectangle on the ground (deterministic). */
function scatterItems(seed: number, n: number, x0: number, x1: number, z0: number, z1: number, y: number, s0: number, s1: number, sy = 1): Item[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ x: x0 + r() * (x1 - x0), y, z: z0 + r() * (z1 - z0), s: s0 + r() * (s1 - s0), ry: r() * TAU, sy }));
}

function matte(kit: SetKit, color: string, opts: { emissive?: string; flat?: boolean; rough?: number } = {}) {
  return kit.track(new kit.THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.92, metalness: 0, flatShading: opts.flat ?? false, emissive: opts.emissive ?? '#000000', emissiveIntensity: opts.emissive ? 0.05 : 0 }));
}

/** Painted horizon behind the head: the far valley wakes with the near one. */
function paintHorizon(ctx: CanvasRenderingContext2D, w: number, h: number, level: number) {
  const dawn = stage(level, 2.5, 4);
  const green = stage(level, 0.5, 3.5);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#120f28');
  sky.addColorStop(0.55, mix('#2b2550', '#6a4a72', dawn));
  sky.addColorStop(1, mix('#3a2e4a', '#e8a070', dawn * 0.8));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,247,231,${(0.2 + r() * 0.6) * (1 - dawn * 0.7)})`;
    ctx.fillRect(r() * w, r() * h * 0.5, 1.6, 1.6);
  }
  // far volcano with a wisp of steam
  ctx.fillStyle = '#231d30';
  ctx.beginPath();
  ctx.moveTo(w * 0.02, h * 0.82);
  ctx.lineTo(w * 0.2, h * 0.38);
  ctx.lineTo(w * 0.26, h * 0.37);
  ctx.lineTo(w * 0.46, h * 0.82);
  ctx.fill();
  ctx.fillStyle = `rgba(255,140,80,${0.25 - 0.15 * dawn})`;
  ctx.beginPath();
  ctx.ellipse(w * 0.23, h * 0.375, w * 0.03, h * 0.012, 0, 0, TAU);
  ctx.fill();
  // ranges that green with the valley
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = mix(['#2a2340', '#2c2a3c', '#24202e'][k], ['#2e4a46', '#2f5a40', '#2a4a34'][k], green * (0.6 + k * 0.15));
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.62 + k * 0.1) + Math.sin(x / (60 + k * 30) + k * 2) * h * 0.05 + Math.sin(x / 23 + k) * h * 0.012);
    ctx.lineTo(w, h);
    ctx.fill();
  }
  // a river glinting into the distance once water returns
  if (level > 0.6) {
    ctx.strokeStyle = `rgba(143,224,238,${0.5 * stage(level, 0.6, 2)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h);
    ctx.quadraticCurveTo(w * 0.58, h * 0.88, w * 0.66, h * 0.8);
    ctx.stroke();
  }
  if (dawn > 0.01) {
    const g = ctx.createRadialGradient(w * 0.7, h * 0.72, 10, w * 0.7, h * 0.72, h * 0.6);
    g.addColorStop(0, `rgba(255,199,91,${0.55 * dawn})`);
    g.addColorStop(1, 'rgba(255,199,91,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

/** A flat ribbon that follows a path over the ground or a slope (lava flows, streams). */
function ribbon(kit: SetKit, pts: [number, number][], width: (u: number) => number, heightAt: (x: number, z: number) => number, seg = 56) {
  const T = kit.THREE;
  const curve = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)));
  const P = curve.getSpacedPoints(seg);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(seg, i + 1)];
    let tx = b.x - a.x;
    let tz = b.z - a.z;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const w = width(i / seg) / 2;
    for (const s of [-1, 1]) {
      const x = P[i].x - tz * w * s;
      const z = P[i].z + tx * w * s;
      pos.push(x, heightAt(x, z), z);
      uv.push(s < 0 ? 0 : 1, i / seg);
    }
    if (i < seg) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Canvas texture: hot core across a ribbon's width with darker crust streaks along it. */
function lavaTexture(kit: SetKit) {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.3, '#6a1a04');
  g.addColorStop(0.5, '#ffb070');
  g.addColorStop(0.7, '#6a1a04');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const r = rng(19);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  for (let i = 0; i < 70; i++) ctx.fillRect(r() * 64, r() * 256, 4 + r() * 14, 2 + r() * 6);
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** Ash-and-crack ground texture; the material colour tints it from ash to green. */
function groundTexture(kit: SetKit) {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(23);
  for (let i = 0; i < 900; i++) {
    const v = 150 + Math.floor(r() * 90);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(r() * 256, r() * 256, 2 + r() * 3, 2 + r() * 3);
  }
  ctx.strokeStyle = 'rgba(60,60,60,0.28)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 18; i++) {
    let x = r() * 256;
    let y = r() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.5) * 34;
      y += (r() - 0.5) * 34;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(18, 18);
  return t;
}

const gardenSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  kit.sky('#1a1840', '#06050d');
  const groundMat = kit.track(new T.MeshStandardMaterial({ color: '#56525e', map: groundTexture(kit), roughness: 0.95 }));
  const ground = new T.Mesh(new T.CircleGeometry(30, 64).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = GROUND;
  ground.receiveShadow = true;
  kit.add(ground);
  const ashColor = new T.Color('#56525e');
  const greenColor = new T.Color('#4f8052');
  const horizon = kit.backdrop(paintHorizon, { width: 30, height: 11, z: -15 });

  // ---------------- LEFT: the volcano and the Succession Steps ----------------
  const V = { x: -6.75, z: -3.35, r0: 0.34, r1: 1.6, h: 2.15 };
  const coneGeo = new T.CylinderGeometry(V.r0, V.r1, V.h, 28, 6);
  craggy(coneGeo, 0.07, -V.h / 2 + 0.01);
  const volcanoMat = matte(kit, '#3a3442', { flat: true, rough: 0.96 });
  const volcano = new T.Mesh(coneGeo, volcanoMat);
  volcano.position.set(V.x, GROUND + V.h / 2, V.z);
  volcano.castShadow = true;
  volcano.receiveShadow = true;
  kit.add(volcano);
  const volcanoBase = new T.Color('#3a3442');
  const volcanoGreen = new T.Color('#3d5a40');
  const craterMat = kit.track(new T.MeshStandardMaterial({ color: '#1a0e0a', emissive: LAVA, emissiveIntensity: 1.2, roughness: 0.6 }));
  const crater = new T.Mesh(new T.CircleGeometry(V.r0 * 0.62, 20), craterMat);
  crater.rotation.x = -Math.PI / 2;
  crater.position.set(V.x, GROUND + V.h + 0.005, V.z);
  kit.add(crater);
  const coneY = (x: number, z: number) => {
    const d = Math.hypot(x - V.x, z - V.z);
    return GROUND + V.h * Math.max(0, Math.min(1, 1 - (d - V.r0) / (V.r1 - V.r0)));
  };
  // The lava flow: a ribbon from the crater down the front slope into the valley. It glows
  // when the mission starts and cools to dark rock as the valley recovers.
  const lavaPath: [number, number][] = [[V.x + 0.12, V.z + 0.22], [V.x + 0.45, V.z + 0.75], [V.x + 0.7, V.z + 1.3], [V.x + 1.05, V.z + 1.9], [V.x + 1.45, V.z + 2.35], [V.x + 1.75, V.z + 2.6]];
  const lavaMat = kit.track(new T.MeshStandardMaterial({ color: '#211a1e', emissive: LAVA, emissiveMap: lavaTexture(kit), emissiveIntensity: 1.2, roughness: 0.75, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  const lava = new T.Mesh(ribbon(kit, lavaPath, (u) => 0.16 + 0.22 * u, (x, z) => Math.max(GROUND + 0.02, coneY(x, z)) + 0.07), lavaMat);
  lava.receiveShadow = true;
  kit.add(lava);
  // Pioneers colonise the cooled flow: moss cushions along it.
  const lavaCurve = new T.CatmullRomCurve3(lavaPath.map(([x, z]) => new T.Vector3(x, 0, z)));
  const rMoss = rng(12);
  const lavaMoss: Item[] = Array.from({ length: kit.n(16) }, (_, i) => {
    const p = lavaCurve.getPoint(0.15 + (i / 16) * 0.85);
    const x = p.x + (rMoss() - 0.5) * 0.36;
    const z = p.z + (rMoss() - 0.5) * 0.36;
    return { x, y: Math.max(GROUND, coneY(x, z)) + 0.07, z, s: 0.06 + rMoss() * 0.06, sy: 0.45 };
  });
  const mossMat = matte(kit, MOSS, { flat: true });
  const mossGeo = new T.IcosahedronGeometry(1, 0);
  const lavaMossG = grower(kit, mossGeo, mossMat, lavaMoss);
  const steam = kit.motes({ x0: V.x - 0.3, x1: V.x + 0.3, y0: GROUND + V.h, y1: GROUND + V.h + 1.4, z0: V.z - 0.3, z1: V.z + 0.3 }, 26, '#d8d0e8', { speed: 0.22, size: 0.16 });

  // The Succession Steps: one patch of ground at four moments in time, stepping down from the
  // pioneers at the foot of the lava to a young forest at the front.
  const bedX = -5.25;
  const bedZ = [-0.95, 0.45, 1.85, 3.25];
  const bedTop = [0.5, 0.38, 0.26, 0.14];
  const stoneMat = matte(kit, '#6c6672', { flat: true, rough: 0.9 });
  const bedMat = matte(kit, '#3a3640', { rough: 0.95 });
  const bedBase = new T.Color('#3a3640');
  const bedSoil = new T.Color('#5a4430');
  bedZ.forEach((z, i) => {
    const h = bedTop[i];
    const bed = new T.Mesh(new T.BoxGeometry(1.8, h, 1.1), [stoneMat, stoneMat, bedMat, stoneMat, stoneMat, stoneMat]);
    bed.position.set(bedX, GROUND + h / 2, z);
    bed.castShadow = true;
    bed.receiveShadow = true;
    kit.add(bed);
  });
  const topOf = (i: number) => GROUND + bedTop[i];
  const bedMoss = grower(kit, mossGeo, mossMat, scatterItems(31, kit.n(14), bedX - 0.78, bedX + 0.78, bedZ[0] - 0.42, bedZ[0] + 0.42, topOf(0), 0.07, 0.14, 0.45));
  const grassGeo = new T.ConeGeometry(0.035, 0.26, 4);
  grassGeo.translate(0, 0.13, 0);
  const grassMat = matte(kit, GRASS, { flat: true });
  const bedGrass = grower(kit, grassGeo, grassMat, scatterItems(32, kit.n(36), bedX - 0.8, bedX + 0.8, bedZ[1] - 0.45, bedZ[1] + 0.45, topOf(1), 0.8, 1.3));
  const shrubGeo = new T.IcosahedronGeometry(1, 1);
  const shrubMat = matte(kit, SHRUB, { flat: true });
  const bedShrub = grower(kit, shrubGeo, shrubMat, scatterItems(33, kit.n(7), bedX - 0.65, bedX + 0.65, bedZ[2] - 0.32, bedZ[2] + 0.32, topOf(2) + 0.1, 0.14, 0.22, 0.8));
  const trunkGeo = new T.CylinderGeometry(0.04, 0.06, 0.6, 6);
  trunkGeo.translate(0, 0.3, 0);
  const trunkMat = matte(kit, '#5a3a26');
  const crownGeo = new T.ConeGeometry(0.34, 0.8, 7);
  crownGeo.translate(0, 0.72, 0);
  const crownTopGeo = new T.ConeGeometry(0.25, 0.6, 7);
  crownTopGeo.translate(0, 1.12, 0);
  const crownMat = matte(kit, '#3f7f4c', { flat: true });
  const treeSpots: Item[] = [
    { x: bedX - 0.5, y: topOf(3), z: bedZ[3] - 0.2, s: 1.1 },
    { x: bedX + 0.12, y: topOf(3), z: bedZ[3] + 0.18, s: 1.3 },
    { x: bedX + 0.62, y: topOf(3), z: bedZ[3] - 0.15, s: 0.95 },
  ];
  const trunks = grower(kit, trunkGeo, trunkMat, treeSpots);
  const crowns = grower(kit, crownGeo, crownMat, treeSpots);
  const crownTops = grower(kit, crownTopGeo, crownMat, treeSpots);
  // Wonderlight blossoms that open on the young forest.
  const blossomGeo = new T.SphereGeometry(0.04, 8, 6);
  const blossomMat = kit.track(new T.MeshStandardMaterial({ color: '#ffe0e6', emissive: CORAL, emissiveIntensity: 1.4, roughness: 0.5 }));
  const rBl = rng(57);
  const blossomItems: Item[] = [];
  for (const t of treeSpots) {
    for (let k = 0; k < 8; k++) {
      const a = rBl() * TAU;
      const hgt = 0.4 + rBl() * 0.95;
      const rad = (hgt < 0.82 ? 0.34 * (1 - (hgt - 0.32) / 0.8) : 0.25 * (1 - (hgt - 0.82) / 0.6)) * t.s + 0.03;
      blossomItems.push({ x: t.x + Math.cos(a) * rad, y: t.y + hgt * t.s, z: t.z + Math.sin(a) * rad, s: 1 });
    }
  }
  const blossoms = grower(kit, blossomGeo, blossomMat, blossomItems);
  // Bare basalt chunks stay on every bed: the rock underneath never leaves.
  const chunkMat = matte(kit, '#4a4552', { flat: true });
  const chunks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), chunkMat, 12);
  {
    const d = new T.Object3D();
    const r = rng(44);
    for (let i = 0; i < 12; i++) {
      const b2 = i % 4;
      d.position.set(bedX + (r() - 0.5) * 1.5, topOf(b2) + 0.02, bedZ[b2] + (r() - 0.5) * 0.8);
      d.rotation.set(r() * 3, r() * 3, r() * 3);
      const s = 0.06 + r() * 0.06;
      d.scale.set(s, s * 0.7, s);
      d.updateMatrix();
      chunks.setMatrixAt(i, d.matrix);
    }
    chunks.instanceMatrix.needsUpdate = true;
    chunks.computeBoundingSphere();
    kit.add(chunks);
  }
  const stageNames = ['1 MOSS', '2 GRASS', '3 SHRUBS', '4 TREES'];
  const stageCols = [MOSS, '#8fd46a', '#5fbf78', '#4fd0a0'];
  const bedSigns = stageNames.map((nm, i) => {
    const s = kit.neonSign(nm, [-4.25, topOf(i) + 0.32, bedZ[i] + 0.38], { height: 0.24, color: stageCols[i], rotY: 0.55 });
    s.rotation.x = -0.6;
    return s;
  });
  const timeArrow = kit.neonTube([[-6.32, GROUND + 0.62, bedZ[0] - 0.3], [-6.36, GROUND + 0.5, bedZ[1]], [-6.36, GROUND + 0.38, bedZ[2]], [-6.32, GROUND + 0.26, bedZ[3] + 0.45]], MINT, { radius: 0.018 });
  const arrowHead = kit.neonTube([[-6.5, GROUND + 0.27, bedZ[3] + 0.22], [-6.32, GROUND + 0.26, bedZ[3] + 0.5], [-6.14, GROUND + 0.27, bedZ[3] + 0.22]], MINT, { radius: 0.018 });
  const successionSign = kit.neonSign('SUCCESSION', [-5.1, 1.55, -2.05], { height: 0.36, color: MINT, rotY: 0.5 });
  successionSign.rotation.x = -0.55;
  kit.pole([-5.1, 0, -2.05], 1.35);

  // ---------------- RIGHT: Beaver pond, the Levee Gate and the prairie dog town ----------------
  // The pond sits in a stone basin; the beavers' dam on its front lip holds the water back.
  const P = { x: 5.55, z: -2.65, r: 1.35, h: 0.46 };
  const basinGeo = new T.CylinderGeometry(P.r, P.r + 0.2, P.h, 32, 2, true);
  craggy(basinGeo, 0.05);
  const basinMat = kit.track(new T.MeshStandardMaterial({ color: '#5e5866', roughness: 0.92, flatShading: true, side: T.DoubleSide }));
  const basin = new T.Mesh(basinGeo, basinMat);
  basin.position.set(P.x, GROUND + P.h / 2, P.z);
  basin.castShadow = true;
  basin.receiveShadow = true;
  kit.add(basin);
  const mud = new T.Mesh(new T.CircleGeometry(P.r, 32), matte(kit, '#3b3026'));
  mud.rotation.x = -Math.PI / 2;
  mud.position.set(P.x, GROUND + 0.05, P.z);
  kit.add(mud);
  const pondMat = kit.track(new T.MeshPhysicalMaterial({ color: '#2b7fa0', roughness: 0.06, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9, emissive: WATER, emissiveIntensity: 0.08 }));
  const pond = new T.Mesh(new T.CircleGeometry(P.r - 0.03, 40), pondMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(P.x, GROUND + 0.12, P.z);
  pond.receiveShadow = true;
  kit.add(pond);
  const logGeo = new T.CylinderGeometry(0.055, 0.055, 0.62, 7);
  logGeo.rotateZ(Math.PI / 2);
  const logMat = matte(kit, '#6b4528');
  const damItems: Item[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * 0.5 + ((i % 5) - 2) * 0.24;
    const row = i >= 5 ? 1 : 0;
    damItems.push({ x: P.x + Math.cos(a) * (P.r + 0.02), y: GROUND + P.h - 0.02 + row * 0.09, z: P.z + Math.sin(a) * (P.r + 0.02), s: 1, ry: -(a - Math.PI * 0.5) + (row ? 0.12 : 0) });
  }
  const dam = grower(kit, logGeo, logMat, damItems);
  const lodgeGeo = new T.SphereGeometry(0.4, 14, 8, 0, TAU, 0, Math.PI / 2);
  craggy(lodgeGeo, 0.12);
  const lodge = new T.Mesh(lodgeGeo, matte(kit, '#4b3220', { flat: true }));
  lodge.position.set(P.x + 0.55, GROUND + 0.1, P.z - 0.4);
  lodge.castShadow = true;
  kit.add(lodge);
  // A cascade where the dam spills, and the stream that runs on toward the Levee Gate.
  const waterRibbonMat = kit.track(new T.MeshStandardMaterial({ color: '#2a7fa0', emissive: WATER, emissiveIntensity: 0.18, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  const cascade = new T.Mesh(new T.PlaneGeometry(0.38, P.h), waterRibbonMat);
  cascade.position.set(P.x - 0.05, GROUND + P.h / 2, P.z + P.r + 0.24);
  cascade.rotation.x = -0.2;
  kit.add(cascade);
  const streamPath: [number, number][] = [[P.x - 0.05, P.z + P.r + 0.3], [P.x + 0.1, -0.7], [P.x + 0.35, 0.05], [P.x + 0.45, 0.55]];
  const stream = new T.Mesh(ribbon(kit, streamPath, () => 0.32, () => GROUND + 0.03, 30), waterRibbonMat);
  kit.add(stream);
  // Cattails ring the pond once it settles.
  const stemGeo = new T.CylinderGeometry(0.01, 0.012, 0.5, 4);
  stemGeo.translate(0, 0.25, 0);
  const headGeo = new T.CapsuleGeometry(0.03, 0.09, 2, 6);
  headGeo.translate(0, 0.46, 0);
  const cattailSpots: Item[] = [];
  const rc = rng(71);
  for (let i = 0; i < kit.n(14); i++) {
    const a = Math.PI * 0.9 + rc() * Math.PI * 1.1;
    const d = P.r - 0.12 - rc() * 0.15;
    cattailSpots.push({ x: P.x + Math.cos(a) * d, y: GROUND + 0.1, z: P.z + Math.sin(a) * d, s: 0.8 + rc() * 0.5 });
  }
  const stems = grower(kit, stemGeo, matte(kit, '#5f8a48'), cattailSpots);
  const heads = grower(kit, headGeo, matte(kit, '#6a4026'), cattailSpots);
  // Ripples spreading over the pond: one change, rings going out.
  const rings = [0, 1, 2].map(() => kit.neonTube(Array.from({ length: 12 }, (_, k) => [Math.cos((k / 12) * TAU) * 0.3, 0, Math.sin((k / 12) * TAU) * 0.3] as [number, number, number]), MINT, { radius: 0.012, closed: true }));
  for (let i = 0; i < rings.length; i++) rings[i].scale.set(0.6 + i * 0.8, 1, 0.6 + i * 0.8);
  let ringLit = 0;
  const lightRings = (t: number) => {
    for (let i = 0; i < rings.length; i++) {
      const ph = kit.reducedMotion ? 0.3 + i * 0.25 : (t * 0.3 + i / 3) % 1;
      if (!kit.reducedMotion) {
        const s = 0.4 + ph * 2.9;
        rings[i].scale.set(s, 1, s);
      }
      rings[i].position.set(P.x - 0.25, pond.position.y + 0.02, P.z + 0.1);
      rings[i].setLit(ringLit * (1 - ph) * 0.7);
    }
  };
  // A beaver at work on the dam.
  const beaver = new T.Group();
  const beaverMat = matte(kit, '#7a5032');
  const bBody = new T.Mesh(new T.CapsuleGeometry(0.09, 0.16, 3, 8), beaverMat);
  bBody.rotation.z = Math.PI / 2;
  const bTail = new T.Mesh(new T.BoxGeometry(0.16, 0.025, 0.1), matte(kit, '#3a2618'));
  bTail.position.set(-0.24, -0.05, 0);
  beaver.add(bBody, bTail);
  beaver.position.set(P.x + 0.6, GROUND + P.h + 0.14, P.z + P.r - 0.1);
  beaver.rotation.y = 0.5;
  kit.add(beaver);
  const pondSign = kit.neonSign('BEAVER POND', [7.05, 1.2, -0.95], { height: 0.32, color: '#8FE0EE', rotY: -0.5 });
  pondSign.rotation.x = -0.55;
  kit.pole([7.05, 0, -0.95], 1.05);

  // The Levee Gate: two pillars and a gate that rises to send river water into the delta.
  const G = { x: P.x + 0.4, z: 0.65 };
  const pillarMat = matte(kit, '#c2bcb0');
  for (const dx of [-0.3, 0.3]) {
    const p = new T.Mesh(new T.BoxGeometry(0.16, 0.62, 0.32), pillarMat);
    p.position.set(G.x + dx, GROUND + 0.31, G.z);
    p.castShadow = true;
    kit.add(p);
  }
  const beam = new T.Mesh(new T.BoxGeometry(0.78, 0.1, 0.34), pillarMat);
  beam.position.set(G.x, GROUND + 0.66, G.z);
  kit.add(beam);
  const gate = new T.Mesh(new T.BoxGeometry(0.44, 0.34, 0.06), kit.mats.paintedMetal('#6f8796'));
  gate.position.set(G.x, GROUND + 0.18, G.z);
  gate.castShadow = true;
  kit.add(gate);
  const berm = new T.Mesh(new T.CapsuleGeometry(0.16, 2.0, 4, 10), matte(kit, '#54703f'));
  berm.rotation.z = Math.PI / 2;
  berm.scale.set(0.5, 1, 1.5);
  berm.position.set(G.x + 1.42, GROUND + 0.06, G.z);
  kit.add(berm);
  const outflowPath: [number, number][] = [[G.x, G.z + 0.1], [G.x - 0.05, G.z + 0.5], [G.x - 0.1, G.z + 0.85]];
  const outflow = new T.Mesh(ribbon(kit, outflowPath, (u) => 0.3 + 0.5 * u, () => GROUND + 0.035, 12), waterRibbonMat);
  kit.add(outflow);
  const deltaGeo = new T.CircleGeometry(1.0, 28, Math.PI * 0.2, Math.PI * 0.6);
  deltaGeo.rotateX(-Math.PI / 2);
  const delta = new T.Mesh(deltaGeo, matte(kit, SAND));
  delta.position.set(G.x - 0.1, GROUND + 0.025, G.z + 0.55);
  delta.rotation.y = Math.PI;
  delta.receiveShadow = true;
  kit.add(delta);
  const reedGeo = new T.CylinderGeometry(0.008, 0.012, 0.32, 4);
  reedGeo.translate(0, 0.16, 0);
  const reeds = grower(kit, reedGeo, matte(kit, '#8fbf5a'), scatterItems(81, kit.n(20), G.x - 0.75, G.x + 0.55, G.z + 0.85, G.z + 1.45, GROUND + 0.03, 0.8, 1.3));
  const leveeSign = kit.panel('LEVEE GATE', [G.x - 0.95, 0.42, G.z + 0.2], { w: 0.95, h: 0.24, bg: '#e8d7a8', fg: '#2a1c18', rotY: -0.25 });
  leveeSign.rotation.x = -0.5;

  // Prairie dog town on the right front.
  const moundGeo = new T.CylinderGeometry(0.09, 0.3, 0.18, 12);
  moundGeo.translate(0, 0.09, 0);
  const holeGeo = new T.CircleGeometry(0.075, 12);
  holeGeo.rotateX(-Math.PI / 2);
  holeGeo.translate(0, 0.185, 0);
  const moundSpots: Item[] = [
    { x: 4.6, y: GROUND, z: 2.55, s: 1 }, { x: 5.55, y: GROUND, z: 2.3, s: 1.1 }, { x: 6.6, y: GROUND, z: 2.75, s: 0.95 },
    { x: 5.0, y: GROUND, z: 3.6, s: 1 }, { x: 6.05, y: GROUND, z: 3.8, s: 1.05 }, { x: 7.05, y: GROUND, z: 3.55, s: 0.9 },
  ];
  const mounds = grower(kit, moundGeo, matte(kit, '#7a6450', { flat: true }), moundSpots);
  const holes = grower(kit, holeGeo, kit.mats.dark(), moundSpots);
  const dogGeo = new T.CapsuleGeometry(0.05, 0.12, 3, 8);
  dogGeo.translate(0, 0.1, 0);
  const dogs = new T.InstancedMesh(dogGeo, matte(kit, '#d2a46a'), moundSpots.length);
  dogs.castShadow = true;
  dogs.frustumCulled = false;
  kit.add(dogs);
  const dogDummy = new T.Object3D();
  let dogLit = 0;
  let dogsShown = -1;
  const placeDogs = (t: number) => {
    if (dogLit < 0.01 && dogsShown === 0) return;
    dogsShown = dogLit < 0.01 ? 0 : 1;
    for (let i = 0; i < moundSpots.length; i++) {
      const m = moundSpots[i];
      const pop = kit.reducedMotion ? 1 : Math.max(0, Math.min(1, Math.sin(t * 0.9 + i * 1.7) * 2.2 + 0.6));
      const s = Math.max(0.001, dogLit * (0.25 + 0.75 * pop));
      dogDummy.position.set(m.x, GROUND + 0.12 * m.s, m.z);
      dogDummy.rotation.set(0, i, 0);
      dogDummy.scale.set(s, s, s);
      dogDummy.updateMatrix();
      dogs.setMatrixAt(i, dogDummy.matrix);
    }
    dogs.instanceMatrix.needsUpdate = true;
  };
  // A burrowing owl moves into an empty burrow.
  const owl3 = new T.Group();
  const owlBody = new T.Mesh(new T.SphereGeometry(0.09, 12, 10), matte(kit, '#9a7a56'));
  owlBody.scale.set(1, 1.3, 1);
  const owlEyesMat = kit.track(new T.MeshStandardMaterial({ color: '#000000', emissive: GOLD, emissiveIntensity: 0.05 }));
  const owlEyes = new T.Mesh(new T.BoxGeometry(0.1, 0.03, 0.02), owlEyesMat);
  owlEyes.position.set(0, 0.05, 0.085);
  owl3.add(owlBody, owlEyes);
  owl3.position.set(7.05, GROUND + 0.3, 3.55);
  owl3.rotation.y = -0.4;
  kit.add(owl3);
  // Bison graze the fresh, nutritious regrowth that prairie dogs' clipping keeps coming.
  const bisonMat = matte(kit, '#3e2a1d');
  const bisonGroups: THREE.Group[] = [];
  for (const [x, z, ry, s] of [[7.3, 1.75, -0.6, 1], [7.7, 4.45, 0.4, 0.9]] as [number, number, number, number][]) {
    const g = new T.Group();
    const body = new T.Mesh(new T.CapsuleGeometry(0.17, 0.32, 3, 8), bisonMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.32;
    const hump = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), bisonMat);
    hump.position.set(0.18, 0.4, 0);
    const head = new T.Mesh(new T.BoxGeometry(0.16, 0.18, 0.16), bisonMat);
    head.position.set(0.38, 0.28, 0);
    g.add(body, hump, head);
    g.position.set(x, GROUND, z);
    g.rotation.y = ry;
    g.scale.setScalar(s);
    g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    kit.add(g);
    bisonGroups.push(g);
  }
  const prairieGrass = grower(kit, grassGeo, grassMat, scatterItems(64, kit.n(36), 4.2, 8.0, 1.9, 4.8, GROUND, 0.7, 1.2));
  const rippleSign = kit.neonSign('RIPPLE EFFECT', [4.6, 1.6, 4.55], { height: 0.34, color: GOLD, rotY: -0.3 });
  rippleSign.rotation.x = -0.6;
  kit.pole([4.6, 0, 4.55], 1.4);

  // ---------------- HEAD: marquee (seen on the fly-in) ----------------
  const marquee = kit.neonSign('COMEBACK GARDEN', [0, 1.45, -7.3], { height: 0.7, color: GOLD });
  marquee.rotation.x = -0.75;

  // ---------------- garden lights, birds, flowers, fireflies ----------------
  kit.pole([-6.75, 0, 4.1], 2.3);
  kit.pole([-8.6, 0, 0.6], 2.8);
  kit.pole([8.1, 0, 0.3], 2.8);
  const lightsL = kit.stringLights([-6.75, 2.2, 4.1], [-8.6, 2.7, 0.6], 0.3, kit.n(12), [GOLD, CORAL, MINT]);
  const lightsR = kit.stringLights([4.6, 1.35, 4.55], [8.1, 2.7, 0.3], 0.3, kit.n(14), [GOLD, MINT, CORAL]);
  const flowerGeo = new T.SphereGeometry(0.05, 8, 6);
  const flowerCols = [CORAL, GOLD, LILAC];
  const flowerMats = flowerCols.map((c) => kit.track(new T.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.6 })));
  const flowers = flowerCols.map((_c, i) => grower(kit, flowerGeo, flowerMats[i], [
    ...scatterItems(90 + i, kit.n(7), -8.4, -6.5, 1.5, 4.6, GROUND + 0.05, 0.8, 1.4),
    ...scatterItems(95 + i, kit.n(8), 4.3, 7.9, 1.8, 4.8, GROUND + 0.05, 0.8, 1.4),
    ...scatterItems(99 + i, kit.n(3), bedX - 0.8, bedX + 0.8, bedZ[2] - 0.45, bedZ[2] + 0.45, topOf(2) + 0.04, 0.8, 1.2),
  ]));
  // Birds returning: little V-wings circling over the valley.
  const birdGeo = new T.BufferGeometry();
  birdGeo.setAttribute('position', new T.Float32BufferAttribute([-0.16, 0.04, -0.05, 0, 0, 0.05, 0, 0, -0.04, 0.16, 0.04, -0.05, 0, 0, 0.05, 0, 0, -0.04], 3));
  birdGeo.computeVertexNormals();
  const birdMat = kit.track(new T.MeshStandardMaterial({ color: '#1c1830', emissive: '#3a3060', emissiveIntensity: 0.4, side: T.DoubleSide }));
  const birdCount = kit.n(7);
  const birds = new T.InstancedMesh(birdGeo, birdMat, birdCount);
  birds.frustumCulled = false;
  kit.add(birds);
  const birdDummy = new T.Object3D();
  let birdLit = 0;
  const flyBirds = (t: number) => {
    for (let i = 0; i < birdCount; i++) {
      const side = i % 2 ? 1 : -1;
      const cx = side * 6.3;
      const cz = side > 0 ? -1.2 : 0.2;
      const a = (kit.reducedMotion ? 0 : t * (0.28 + i * 0.02)) + i * 1.9;
      const rad = 1.2 + (i % 3) * 0.35;
      const s = Math.max(0.001, birdLit);
      birdDummy.position.set(cx + Math.cos(a) * rad, 2.3 + (i % 3) * 0.3 + (kit.reducedMotion ? 0 : Math.sin(t * 2 + i) * 0.06), cz + Math.sin(a) * rad * 0.8);
      birdDummy.rotation.set(0, -a, kit.reducedMotion ? 0 : Math.sin(t * 6 + i) * 0.25);
      birdDummy.scale.set(s, s * (kit.reducedMotion ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(t * 7 + i))), s);
      birdDummy.updateMatrix();
      birds.setMatrixAt(i, birdDummy.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
  };
  const fireflies = kit.motes({ x0: -9.5, x1: 9.5, y0: -0.25, y1: 2.6, z0: -6, z1: 5.5 }, 120, FIREFLY, { speed: 0.05, size: 0.11 });
  const seeds = kit.motes({ x0: -9.5, x1: -4, y0: -0.3, y1: 3.4, z0: -5, z1: 5 }, 46, IVORY, { speed: 0.16, size: 0.07 });
  const fwL = kit.fireworks({ x0: -8.2, x1: -6.4, y0: 2.6, y1: 3.8, z: -2.5 }, [GOLD, CORAL, MINT, FIREFLY]);
  const fwR = kit.fireworks({ x0: 6.4, x1: 8.2, y0: 2.6, y1: 3.8, z: -2.5 }, [GOLD, CORAL, MINT, FIREFLY]);
  // Garden lanterns: dark at the start, glowing warmly as the valley comes back.
  kit.pole([-4.2, 0, -1.7], 1.25);
  kit.pole([4.2, 0, -0.75], 1.25);
  const lanterns = [kit.lantern([-4.2, 1.42, -1.7], GOLD, 0.13), kit.lantern([4.2, 1.42, -0.75], GOLD, 0.13)];
  const spotL = kit.spot([-5, 6.5, 4], [-5.6, 0, 0.6], GOLD, 26, 0.55);
  const spotR = kit.spot([5, 6.5, 4], [6.2, 0, 0.2], '#a8eaf2', 24, 0.55);
  const ember = kit.point([V.x + 0.2, GROUND + V.h + 0.7, V.z + 0.5], LAVA, 3, 5);

  let lastLevel = -1;
  let celebrating = 0;
  return {
    update(t, dt, level, energy) {
      const sMoss = kit.stage(level, 0.05, 1.0);
      const sGrass = kit.stage(level, 0.8, 1.9);
      const sShrub = kit.stage(level, 1.6, 2.7);
      const sTree = kit.stage(level, 2.3, 3.5);
      const sBloom = kit.stage(level, 3.3, 4);
      const sPond = kit.stage(level, 0.6, 1.6);
      const sTown = kit.stage(level, 0.5, 1.5);
      const sMeadow = kit.stage(level, 1.2, 2.2);
      const sDelta = kit.stage(level, 2.4, 3.4);
      const green = kit.stage(level, 0.3, 3.6);
      if (Math.abs(level - lastLevel) > 0.004) {
        lastLevel = level;
        horizon.repaint(level);
        groundMat.color.lerpColors(ashColor, greenColor, green * 0.85);
        volcanoMat.color.lerpColors(volcanoBase, volcanoGreen, kit.stage(level, 1.5, 4) * 0.7);
        bedMat.color.lerpColors(bedBase, bedSoil, green);
        lavaMossG.grow(0.3 + 0.7 * sMoss);
        bedMoss.grow(0.3 + 0.7 * sMoss);
        bedGrass.grow(sGrass);
        bedShrub.grow(sShrub);
        trunks.grow(sTree);
        crowns.grow(sTree);
        crownTops.grow(sTree);
        blossoms.grow(sBloom);
        dam.grow(sPond);
        stems.grow(kit.stage(level, 1, 2));
        heads.grow(kit.stage(level, 1, 2));
        prairieGrass.grow(kit.stage(level, 0.9, 2));
        mounds.grow(1);
        holes.grow(1);
        reeds.grow(kit.stage(level, 2.8, 3.8));
        for (const f of flowers) f.grow(sBloom);
        pond.position.y = GROUND + 0.1 + (P.h - 0.16) * sPond;
        pond.scale.setScalar(0.55 + 0.45 * sPond);
        cascade.visible = stream.visible = sPond > 0.5;
        beaver.visible = sPond > 0.5;
        owl3.visible = sMeadow > 0.3;
        for (let i = 0; i < bisonGroups.length; i++) bisonGroups[i].visible = sMeadow > 0.4 + i * 0.3;
        gate.position.y = GROUND + 0.18 + 0.3 * sDelta;
        outflow.visible = sDelta > 0.05;
        delta.scale.setScalar(0.2 + 0.8 * sDelta);
        lavaMat.emissiveIntensity = 0.08 + 1.1 * (1 - kit.stage(level, 0, 1.6));
        craterMat.emissiveIntensity = 0.3 + 0.45 * (1 - kit.stage(level, 0, 2.5));
        pondMat.emissiveIntensity = 0.08 + 0.3 * sBloom;
        basinMat.color.lerpColors(volcanoBase, volcanoGreen, green * 0.5);
      }
      dogLit = sTown;
      birdLit = kit.stage(level, 2.4, 3.4);
      ringLit = Math.max(kit.stage(level, 1.2, 2.2) * (0.7 + 0.3 * energy), celebrating);
      placeDogs(t);
      lightRings(t);
      flyBirds(t);
      for (let i = 0; i < bedSigns.length; i++) bedSigns[i].setLit(0.12 + 0.88 * kit.stage(level, i * 0.9 - 0.4, i * 0.9 + 0.4));
      timeArrow.setLit(0.05 + 0.12 * sMoss + 0.08 * sBloom);
      arrowHead.setLit(0.05 + 0.12 * sTree + 0.08 * sBloom);
      successionSign.setLit(0.2 + 0.8 * sMoss);
      pondSign.setLit(0.1 + 0.9 * sPond);
      rippleSign.setLit(0.1 + 0.9 * sMeadow);
      marquee.setLit(0.15 + 0.85 * kit.stage(level, 1.2, 2.4));
      owlEyesMat.emissiveIntensity = 0.05 + 1.6 * sMeadow;
      blossomMat.emissiveIntensity = 0.6 + 1.2 * sBloom + 1.5 * celebrating;
      for (let i = 0; i < flowerMats.length; i++) flowerMats[i].emissiveIntensity = 0.25 + 0.5 * sBloom + 1.5 * celebrating;
      lightsL.setLit(0.12 + 0.88 * kit.stage(level, 1.5, 2.6));
      lightsR.setLit(0.12 + 0.88 * kit.stage(level, 1.5, 2.6));
      fireflies.setLit(0.05 + 0.75 * kit.stage(level, 1, 3.8) + 0.2 * energy);
      seeds.setLit(0.3 + 0.4 * (1 - sTree));
      steam.setLit(0.15 + 0.35 * (1 - kit.stage(level, 0, 3)));
      const fw = Math.max(kit.stage(level, 3.6, 4) * 0.8, celebrating);
      fwL.setLit(fw);
      fwR.setLit(fw);
      if (spotL) spotL.intensity = 20 + 14 * kit.stage(level, 0, 3) + 12 * sBloom;
      if (spotR) spotR.intensity = 18 + 14 * kit.stage(level, 0.5, 3) + 12 * sBloom;
      for (let i = 0; i < lanterns.length; i++) lanterns[i].setLit(0.1 + 0.6 * kit.stage(level, 0.8, 2.5) + 0.3 * sBloom);
      if (ember) ember.intensity = 1.2 + 2.2 * (1 - kit.stage(level, 0, 2.5)) + (kit.reducedMotion ? 0 : 0.3 * Math.sin(t * 2.3));
      celebrating = Math.max(0, celebrating - dt * 0.5);
    },
    celebrate(p) {
      celebrating = Math.sin(p * Math.PI);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const gardenRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  // Left: cooled lava rock with the first moss; right: a young garden and a beaver pond.
  const rockMat = kit.track(new T.MeshStandardMaterial({ color: '#2e2a35', roughness: 0.95, flatShading: true }));
  const rockGeo = new T.DodecahedronGeometry(0.3, 0);
  craggy(rockGeo, 0.12);
  const rock = new T.Mesh(rockGeo, rockMat);
  rock.position.set(-0.6, 0.18, -0.25);
  rock.scale.set(1.2, 0.7, 1);
  const crackMat = kit.track(new T.MeshStandardMaterial({ color: '#1a0e0a', emissive: LAVA, emissiveIntensity: 0.4 }));
  const crack = new T.Mesh(new T.BoxGeometry(0.26, 0.02, 0.03), crackMat);
  crack.position.set(-0.62, 0.32, -0.2);
  crack.rotation.y = 0.4;
  const mossMat = kit.track(new T.MeshStandardMaterial({ color: MOSS, roughness: 0.9, flatShading: true }));
  const moss = new T.Mesh(new T.IcosahedronGeometry(0.12, 0), mossMat);
  moss.position.set(-0.45, 0.32, -0.15);
  moss.scale.set(1, 0.4, 1);
  const soil = new T.Mesh(new T.CylinderGeometry(0.48, 0.52, 0.06, 20), kit.track(new T.MeshStandardMaterial({ color: '#4a3828', roughness: 0.95 })));
  soil.position.set(0.45, 0.05, -0.22);
  const trunk = new T.Mesh(new T.CylinderGeometry(0.03, 0.05, 0.42, 6), kit.track(new T.MeshStandardMaterial({ color: '#5a3a26' })));
  trunk.position.set(0.5, 0.29, -0.3);
  const crownMat = kit.track(new T.MeshStandardMaterial({ color: FOREST, roughness: 0.85, flatShading: true, emissive: GRASS, emissiveIntensity: 0.05 }));
  const crownMesh = new T.Mesh(new T.ConeGeometry(0.2, 0.5, 7), crownMat);
  crownMesh.position.set(0.5, 0.68, -0.3);
  const shrubMat = kit.track(new T.MeshStandardMaterial({ color: SHRUB, roughness: 0.9, flatShading: true }));
  const shrub = new T.Mesh(new T.IcosahedronGeometry(0.12, 1), shrubMat);
  shrub.position.set(0.15, 0.14, -0.35);
  const grass = new T.InstancedMesh(new T.ConeGeometry(0.02, 0.16, 4), kit.track(new T.MeshStandardMaterial({ color: GRASS, flatShading: true })), 10);
  {
    const d = new T.Object3D();
    const r = rng(3);
    for (let i = 0; i < 10; i++) {
      d.position.set(0.1 + r() * 0.7, 0.15, -0.5 + r() * 0.5);
      d.updateMatrix();
      grass.setMatrixAt(i, d.matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
  }
  const pondMat = kit.track(new T.MeshStandardMaterial({ color: '#1f5f7a', emissive: WATER, emissiveIntensity: 0.1, roughness: 0.1, metalness: 0.2 }));
  const pondDisc = new T.Mesh(new T.CircleGeometry(0.28, 24), pondMat);
  pondDisc.rotation.x = -Math.PI / 2;
  pondDisc.position.set(-0.12, 0.035, 0.5);
  const logs = new T.InstancedMesh(new T.CylinderGeometry(0.025, 0.025, 0.3, 6), kit.track(new T.MeshStandardMaterial({ color: '#6b4528' })), 4);
  {
    const d = new T.Object3D();
    for (let i = 0; i < 4; i++) {
      d.position.set(0.16 + (i % 2) * 0.04, 0.06 + Math.floor(i / 2) * 0.045, 0.38 + (i % 2) * 0.05 + Math.floor(i / 2) * 0.02);
      d.rotation.set(Math.PI / 2, 0, 0.9);
      d.updateMatrix();
      logs.setMatrixAt(i, d.matrix);
    }
    logs.instanceMatrix.needsUpdate = true;
  }
  const flowerMat = kit.track(new T.MeshStandardMaterial({ color: CORAL, emissive: CORAL, emissiveIntensity: 0.05 }));
  const flowers = new T.InstancedMesh(new T.SphereGeometry(0.03, 8, 6), flowerMat, 6);
  {
    const d = new T.Object3D();
    const r = rng(9);
    for (let i = 0; i < 6; i++) {
      d.position.set(0.12 + r() * 0.65, 0.1, -0.45 + r() * 0.45);
      d.updateMatrix();
      flowers.setMatrixAt(i, d.matrix);
    }
    flowers.instanceMatrix.needsUpdate = true;
  }
  kit.add(rock);
  kit.add(crack);
  kit.add(moss);
  kit.add(soil);
  kit.add(trunk);
  kit.add(crownMesh);
  kit.add(shrub);
  kit.add(grass);
  kit.add(pondDisc);
  kit.add(logs);
  kit.add(flowers);
  const seedOrb = kit.orb([0, 1.0, 0.1], 0.08, MINT);
  const fluff = kit.cloudOfPoints([0, 1.0, 0.1], 0.32, 40, IVORY);
  const sign = kit.neonSign('COMEBACK', [0, 1.38, -0.82], { height: 0.24, color: GOLD });
  return {
    update(t, lit) {
      const grow = 0.35 + 0.65 * lit;
      crownMesh.scale.setScalar(grow);
      crownMesh.position.y = 0.43 + 0.25 * grow;
      shrub.scale.setScalar(0.5 + 0.5 * lit);
      moss.scale.set(0.6 + 0.6 * lit, 0.4, 0.6 + 0.6 * lit);
      crownMat.emissiveIntensity = 0.05 + 0.4 * lit;
      flowerMat.emissiveIntensity = 0.05 + 1.2 * lit;
      flowers.visible = lit > 0.3;
      crackMat.emissiveIntensity = 0.5 - 0.35 * lit;
      pondMat.emissiveIntensity = 0.1 + 0.5 * lit;
      seedOrb.setLit(lit);
      fluff.setLit(lit * 0.8);
      sign.setLit(lit);
      if (!kit.reducedMotion) {
        seedOrb.position.y = 1.0 + Math.sin(t * 1.4) * 0.05;
        fluff.rotation.y = t * 0.25;
      }
    },
  };
};

// ---------------------------------------------------------------- the attraction

export const L22: TableDef = {
  lessonId: 'L22',
  signature: 'A Succession Plot where each fallen community makes room for the next, while gates reroute the valley as it recovers',
  ballRole: 'The Wonderball is a game token, not a seed or an animal: real seeds drift in on the wind or ride along with animals, and a real valley takes many years to recover, not a few bounces.',
  theme: {
    bg: ['#24302f', '#141a20'],
    rail: '#d6e4c8',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: '#A9E07A',
    bumperCap: '#E3C39A',
    bumperRing: '#4A3424',
    flipper: '#FFD98A',
    ink: IVORY,
    ramp: 'rgba(143,224,238,0.16)',
    trail: MINT,
  },
  lines: {
    intro: 'Welcome to the Comeback Garden, where an eruption buried the whole valley and life is staging a slow, stubborn comeback. Let\'s find out who returns first!',
    quark: '"After a disaster, surely the old forest just springs right back, exactly as it was. Nature keeps a backup copy, doesn\'t it?" Professor Quark wonders aloud.',
    pipTip: 'Plunge hard to send the ball over the top and through the Seed Spinner. Then cradle on the left flipper: a straight shot up hits the Succession Plot.',
  },
  build,
  skillShot: 'lane_soil',
  shots: [
    { id: 'windLane', label: 'Wind Lane', on: [{ type: 'shot', id: 'wind_sw' }], insert: 'ins_wind' },
    { id: 'creek', label: 'Beaver Creek', on: [{ type: 'shot', id: 'creek_sw' }], insert: 'ins_creek' },
    { id: 'delta', label: 'Delta', on: [{ type: 'saucer', id: 'delta' }, { type: 'shot', id: 'delta_sw' }], insert: 'ins_delta' },
    { id: 'plot', label: 'Succession Plot', on: [{ type: 'drop', group: 'succession' }], insert: 'ins_plot' },
    { id: 'station', label: 'Field Station', on: [{ type: 'saucer', id: 'field_station' }], insert: 'ins_station' },
    { id: 'town', label: 'Prairie dog town', on: [{ type: 'bumper', group: 'burrows' }], insert: 'ins_town' },
    { id: 'ripples', label: 'Ripple Meadow', on: [{ type: 'target', group: 'ripples' }], insert: 'ins_ripples' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'After the Eruption',
      brief: 'A sudden eruption buried the valley in lava. Watch who returns first: blow seeds in, then grow the Succession Plot.',
      objectiveIds: ['L22-O1'],
      stages: [
        { kind: 'collect', text: 'Blow in seeds: spin the Seed Spinner 3 times', match: { type: 'spinner', id: 'seed_spinner' }, count: 3, preview: ['windLane'] },
        { kind: 'collect', text: 'Grow the plot: MOSS, then GRASS, SHRUB, TREES', match: { type: 'drop', group: 'succession' }, count: 4, distinct: true, lamps: ['succ_1', 'succ_2', 'succ_3', 'succ_4'], preview: ['plot'] },
        { kind: 'discover', text: 'Log what grew at the Field Station', pocket: 'field_station', questions: 1, types: ['order', 'single'] },
      ],
      discovery: 'Succession is slow: hardy pioneers such as mosses settle on bare rock and build soil, so grasses, shrubs and then trees can move in over many years.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Ripple Effect',
      brief: 'Prairie dogs are back, and beavers have dammed the creek. Wake the town, then follow the ripples to the species linked to it.',
      objectiveIds: ['L22-O2'],
      stages: [
        { kind: 'collect', text: 'Wake the prairie dog town: 6 burrow hits', match: { type: 'bumper', group: 'burrows' }, count: 6, preview: ['town'] },
        { kind: 'collect', text: 'Follow the ripples: OWL, FERRET, BISON', match: { type: 'target', group: 'ripples' }, count: 3, distinct: true, lamps: ['ripple_owl', 'ripple_ferret', 'ripple_bison'], preview: ['ripples'] },
        { kind: 'discover', text: 'Predict the next ripple at the Field Station', pocket: 'field_station', questions: 1, types: ['match', 'classify', 'single'] },
      ],
      discovery: 'Burrowing owls shelter in prairie dog burrows, black-footed ferrets hunt prairie dogs, and bison graze the fresh regrowth on their towns. Change one population and many others rise or fall.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Recovery Report',
      brief: 'Is the valley really recovering? Compare plots with and without beavers, then open the Levee Gate so river sediment can rebuild the Delta.',
      objectiveIds: ['L22-O3', 'L22-O4'],
      stages: [
        { kind: 'collect', text: 'Compare plots: hit WITH and WITHOUT beavers', match: { type: 'target', group: 'evidence' }, count: 2, distinct: true, lamps: ['plot_with', 'plot_without'] },
        { kind: 'collect', text: 'Levee Gate open: carry sediment to the Delta 2x', match: { type: 'shot', id: 'delta_sw' }, count: 2, preview: ['delta'] },
        { kind: 'discover', text: 'Weigh the evidence at the Field Station', pocket: 'field_station', questions: 1, types: ['classify', 'single'] },
      ],
      discovery: 'Strong evidence compares many places with and without a change. Recovery after a big disturbance usually takes many years, and the ecosystem that returns may differ from the one before.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Comeback Garden in Bloom',
    brief: 'Keep the comeback going: light four of the valley\'s routes, then file the final recovery report at the Field Station.',
    stages: [
      { kind: 'shots', text: 'Light 4: Wind Lane, Creek, Delta, Plot or Town', shots: ['windLane', 'creek', 'delta', 'plot', 'town'], order: 'any', count: 4 },
      { kind: 'discover', text: 'File the final report at the Field Station', pocket: 'field_station', questions: 2 },
    ],
    celebration: 'Moss, meadow, beavers and a brand-new delta: the valley came back step by step, and not quite as it was. The Wonderlight is yours!',
  },
  onProgress(rt, { slot, stage: st, level }) {
    // Beavers return once the pioneers have rebuilt the soil (after the first mission).
    rt.get<Diverter>('beaver_dam').set(level >= 1 || slot >= 1 ? 1 : 0);
    // The Levee Gate opens when the Recovery Report needs the Delta, and stays open after.
    const open = level >= 3 || slot === 3 || (slot === 2 && st >= 1);
    rt.get<LeveeKeeper>('levee_keeper').want = open ? 0 : 1;
  },
  set: gardenSet,
  room: gardenRoom,
  icons: {
    burrow(ctx, s) {
      // A prairie dog standing up out of its burrow mound.
      ctx.beginPath();
      ctx.ellipse(0, s * 0.62, s * 0.95, s * 0.34, 0, Math.PI, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, s * 0.06, s * 0.26, s * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -s * 0.5, s * 0.22, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.16, -s * 0.68, s * 0.07, 0, TAU);
      ctx.arc(s * 0.16, -s * 0.68, s * 0.07, 0, TAU);
      ctx.fill();
    },
    journal(ctx, s) {
      // An open field journal.
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.quadraticCurveTo(-s * 0.45, -s * 0.72, -s * 0.9, -s * 0.55);
      ctx.lineTo(-s * 0.9, s * 0.6);
      ctx.quadraticCurveTo(-s * 0.45, s * 0.42, 0, s * 0.66);
      ctx.quadraticCurveTo(s * 0.45, s * 0.42, s * 0.9, s * 0.6);
      ctx.lineTo(s * 0.9, -s * 0.55);
      ctx.quadraticCurveTo(s * 0.45, -s * 0.72, 0, -s * 0.5);
      ctx.fill();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintValley(ctx, level);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      if (reduced) return;
      // Seeds blowing down the Wind Lane, fireflies over the meadow, glints on the river.
      drift(ctx, 6, 7, t, IVORY, [30, 400, 70, 640], 14, 1.6, 0.35);
      const ff = stage(level, 1.5, 4);
      if (ff > 0.01) drift(ctx, 12, 22, t * 0.6, FIREFLY, [60, 220, 540, 780], 6, 2.2, (0.3 + 0.3 * energy) * ff);
      const w = stage(level, 0.7, 2);
      if (w > 0.01) {
        for (let i = 0; i < 6; i++) {
          const u = ((t * 0.08 + i / 6) % 1) * (RIVER.length - 1);
          const k = Math.floor(u);
          const f = u - k;
          const a = RIVER[k];
          const b2 = RIVER[Math.min(RIVER.length - 1, k + 1)];
          glowDot(ctx, a[0] + (b2[0] - a[0]) * f, a[1] + (b2[1] - a[1]) * f, 5, WATER_HI, 0.5 * w);
        }
      }
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.45;
      const g = ctx.createRadialGradient(339, 472, 10, 339, 472, 460);
      g.addColorStop(0, rgba(GOLD, 0.8));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      const cols = [CORAL, GOLD, MINT, LILAC];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU + t * 0.3;
        const d = 50 + p * 280;
        glowDot(ctx, 339 + Math.cos(a) * d, 472 + Math.sin(a) * d * 0.85, 9, cols[i % cols.length], 1 - p);
      }
      neonPath(ctx, () => {
        ctx.beginPath();
        ctx.arc(339, 472, 30 + p * 140, 0, TAU);
      }, MINT, (1 - p) * 0.8, 3);
    },
  },
};
export default L22;
