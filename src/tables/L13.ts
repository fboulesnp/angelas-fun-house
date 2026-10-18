// Lesson 13 — Atoms in Chemical Reactions — "Conservation Clockworks"
// A clockmaker's balance machine. Two equal drop-target pans hang from a painted balance beam:
// the REACTANT pan (left) and the PRODUCT pan (right), each holding the same atom tokens
// (H, O, O, H). A brass Ledger counts atoms by element on each pan: a counted atom pops back up
// while more of that element is still needed, and stays down once the element is complete
// (4 H + 4 O for 2H2O2 -> 2H2O + O2). A full pan waits for the other; when both balance, the
// machine chimes and both pans reset together. The Sealed Scale (Wonder Pocket) sits in a bell
// jar between the pans, a gear train of pop bumpers turns overhead, the BREAK-APART orbit with
// its BOND spinner runs up the left, and the JOIN ramp climbs the right while a steeper shot slips
// past its mouth into the SWAP orbit over the arch.
//
// 3D set: the Grand Balance (left) loads glowing atoms into its pans as the Ledger counts them and
// levels when the pans balance; the Sealed Jar (right) regroups the same eight atoms from 2H2O2
// into 2H2O + O2 while its fan scale never leaves 68 g; a gear tower and a carillon (front) and
// the Conservation Clock (top left) wake mission by mission, and the carillon plays the finale.

import { FRAME, type Pt, type TableBuilder } from '../game/table/builder.ts';
import { Insert, Mechanism, type DropBank, type Saucer } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { Ball } from '../game/physics/ball.ts';
import { MATERIALS, type Collider } from '../game/physics/types.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import { REGIONS, type RoomBuilder, type SetBuilder, type SetKit } from '../game/render3d/setKit.ts';
import { radialTexture } from '../game/render3d/textures.ts';
import { TAU, drift, glowDot, mix, neonText, rgba, rng, rrect, stage, vgrad } from '../game/render/art.ts';
import type * as THREE_NS from 'three';

const GOLD = '#FFC75B';
const BRASS = '#D9B26A';
const COPPER = '#C9834F';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const IVORY = '#FFF7E7';
const TEAL = '#123238';
const INK = '#0b1418';
const SANS = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
const SERIF = '"Fraunces Variable", Georgia, serif';

// ---------------------------------------------------------------- playfield geometry

const CX = FRAME.centerX;
/** Bell-jar dome centre and the Sealed Scale pocket inside it. */
const JAR = { x: CX, y: 410, r: 29 };
const POCKET: Pt = [CX, 440];
/** The bell jar works as a scoop: a ball rising inside it within this radius of the pocket settles in. */
const SCOOP_R = 16;
/** The two pans: four atom targets each, hanging level on either side of the jar. */
const PAN = { y: 470, size: 24, gap: 3, leftX: 147, rightX: 320 };
const PAN_W = 4 * PAN.size + 3 * PAN.gap;
const panCx = (side: 0 | 1) => (side === 0 ? PAN.leftX : PAN.rightX) + PAN_W / 2;
type El = 'H' | 'O';
const PAN_LABELS: El[] = ['H', 'O', 'O', 'H'];
/** Atoms of each element per side: 2H2O2 holds 4 H + 4 O, and so do 2H2O + O2. */
const NEED: Record<El, number> = { H: 4, O: 4 };
const PAN_CAP = NEED.H + NEED.O;
const SIDES = [0, 1] as const;
const ELEMENTS: El[] = ['H', 'O'];
const EMPTY: Record<El, number> = { H: 0, O: 0 };
/** A counted atom pops back up after this long while more of its element is still needed. */
const RAISE_DELAY = 0.45;
const TALLY_Y = 488;
/** Tally lamp x: four H lamps left of the pan centre, four O lamps right of it. */
const tallyX = (side: 0 | 1, el: El, i: number) => panCx(side) + (el === 'H' ? -44 + i * 11 : 11 + i * 11);
const GEARS: { id: string; x: number; y: number }[] = [
  { id: 'gear_1', x: 178, y: 270 },
  { id: 'gear_2', x: 286, y: 256 },
  { id: 'gear_3', x: 394, y: 274 },
];
/** Break-Apart orbit inner wall: its mouth sits on the right flipper's steepest shot line. */
const ORBIT_WALL: Pt[] = [[196, 704], [138, 606], [102, 520], [78, 430], [74, 372]];
/** JOIN ramp: its mouth tops the open right lane, on the left flipper's steepest shot line; it climbs
 *  the right side, curls over the top and drops the Wonderball into the gear train. */
const RAMP_PATH: Pt[] = [
  [491, 440], [504, 350], [506, 262], [490, 186], [438, 130], [376, 104], [326, 112], [292, 140],
];
/** The reaction dial painted below the pans (the BALANCED star sits at its twelve o'clock). */
const DIAL = { x: CX, y: 688, r: 64 };

/** The live Ledger (the 3D set reads its atom counts to load the Grand Balance). */
let liveLedger: Ledger | null = null;

/** A lamp the Ledger drives itself (the session's mission lamps leave it alone). */
class TallyLamp extends Insert {
  constructor(rt: TableRuntime, id: string, x: number, y: number, opts: ConstructorParameters<typeof Insert>[4]) {
    super(rt, id, x, y, opts);
    (this as unknown as { kind: string }).kind = 'tally';
  }
}

/**
 * The bell jar is the Sealed Scale's scoop. The pocket's own sensor is small (radius 11), so a
 * ball that rises into the jar slightly off-centre used to bounce off the dome and fall back out.
 * This wider sensor inside the jar hands any ball moving up into it to the pocket; balls the
 * pocket ejects travel downward and are ignored.
 */
class JarScoop extends Mechanism {
  kind = 'jarScoop' as const;
  private saucer: Saucer;
  constructor(rt: TableRuntime, id: string, saucer: Saucer, x: number, y: number, r: number) {
    super(rt, id);
    this.saucer = saucer;
    this.collider({ shape: { kind: 'circle', x, y, r }, sensor: true, material: MATERIALS.rail });
  }
  onSensorEnter(_c: Collider, ball: Ball) {
    const s = this.saucer;
    if (!s.enabled || ball.state !== 'live' || ball.vy > -40) return;
    if (Math.hypot(ball.vx, ball.vy) > s.captureMaxSpeed) return;
    s.capture(ball);
  }
}

/**
 * The Ledger counts atoms by element on each pan and drives the tally lamps. A counted atom pops
 * back up while its element still needs atoms; once an element is complete its targets stay down.
 * A full pan waits for the other; when both pans are full it fires the BALANCE shot and, after a
 * short chime, resets both pans together.
 */
class Ledger extends Mechanism {
  kind = 'ledger' as const;
  counts: [Record<El, number>, Record<El, number>] = [{ H: 0, O: 0 }, { H: 0, O: 0 }];
  /** Sides whose wanted atoms flash (a counting stage is active there). */
  focus: [boolean, boolean] = [false, false];
  /** Seconds the BALANCED star keeps glowing after a balance. */
  glow = 0;
  balances = 0;
  private banks: [DropBank, DropBank];
  private prev: boolean[][];
  private raiseAt: number[][];
  private balanceAt = -1;
  private lamps: Record<El, Insert[]>[] = [{ H: [], O: [] }, { H: [], O: [] }];
  private star: Insert | undefined;
  private lastBall: Ball | undefined;
  constructor(rt: TableRuntime, id: string, left: DropBank, right: DropBank) {
    super(rt, id);
    this.banks = [left, right];
    this.prev = [left.targets.map(() => false), right.targets.map(() => false)];
    this.raiseAt = [left.targets.map(() => -1), right.targets.map(() => -1)];
    liveLedger = this;
  }
  total(side: 0 | 1) {
    return this.counts[side].H + this.counts[side].O;
  }
  attachLamps(lamps: Record<El, Insert[]>[], star: Insert) {
    this.lamps = lamps;
    this.star = star;
  }
  private clearSide(side: 0 | 1) {
    this.counts[side].H = 0;
    this.counts[side].O = 0;
    this.raiseAt[side].fill(-1);
    this.banks[side].resetBank();
  }
  /** Fresh count on one side: zero its tally and raise its pan (a pending balance resets both). */
  resetSide(side: 0 | 1) {
    if (this.balanceAt >= 0) {
      this.balanceAt = -1;
      this.clearSide((1 - side) as 0 | 1);
    }
    this.clearSide(side);
  }
  update(dt: number) {
    super.update(dt);
    const t = this.rt.time;
    this.glow = Math.max(0, this.glow - dt);
    for (const side of SIDES) {
      const bank = this.banks[side];
      const c = this.counts[side];
      let locked = false;
      for (let i = 0; i < bank.targets.length; i++) {
        const tg = bank.targets[i];
        const el = PAN_LABELS[i];
        if (tg.down && !this.prev[side][i]) {
          if (c[el] < NEED[el]) c[el]++;
          for (const b of this.rt.world.balls) {
            if (b.state === 'live') {
              this.lastBall = b;
              break;
            }
          }
          this.raiseAt[side][i] = c[el] < NEED[el] ? t + RAISE_DELAY : -1;
        }
        // An element that is fully counted keeps its atoms down (no double counting).
        if (this.balanceAt < 0 && !tg.down && c[el] >= NEED[el]) {
          tg.down = true;
          tg.col.enabled = false;
          this.raiseAt[side][i] = -1;
          locked = true;
        }
        const at = this.raiseAt[side][i];
        if (at >= 0 && t >= at) {
          if (c[el] >= NEED[el] || tg.tryRaise()) this.raiseAt[side][i] = -1;
          else this.raiseAt[side][i] = t + 0.2;
        }
        this.prev[side][i] = tg.down;
        tg.lamp = !tg.down && this.balanceAt < 0 && this.focus[side] ? 'flash' : 'off';
      }
      if (locked && this.lastBall && bank.targets.every((tg) => tg.down)) bank.check(this.lastBall);
    }
    if (this.balanceAt < 0 && this.total(0) >= PAN_CAP && this.total(1) >= PAN_CAP) {
      this.balanceAt = t + 1.6;
      this.glow = 3;
      this.hitFlash = 1;
      this.balances++;
      this.rt.emit({ type: 'shot', id: this.id, group: 'balance', ball: this.lastBall, x: CX, y: PAN.y });
    }
    if (this.balanceAt >= 0 && t >= this.balanceAt) {
      this.balanceAt = -1;
      this.clearSide(0);
      this.clearSide(1);
    }
    // Tally lamps: counted atoms glow; while one pan is full the other pan's empty lamps pulse.
    for (const side of SIDES) {
      const waiting = this.total((1 - side) as 0 | 1) >= PAN_CAP && this.balanceAt < 0;
      for (const el of ELEMENTS) {
        const row = this.lamps[side][el];
        const n = this.counts[side][el];
        for (let i = 0; i < row.length; i++) row[i].lamp = this.glow > 0 ? 'pulse' : i < n ? 'on' : waiting ? 'pulse' : 'off';
      }
    }
    if (this.star) {
      const a = this.total(0);
      this.star.lamp = this.glow > 0 ? 'pulse' : a === this.total(1) && a > 0 ? 'on' : 'off';
    }
  }
}

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- BREAK-APART ORBIT (left): curved orbit channel, the BOND spinner and a one-way exit gate ---
  b.curve(ORBIT_WALL, { id: 'orbit_inner', r: 3 });
  b.post(ORBIT_WALL[0][0], ORBIT_WALL[0][1] + 2, 5);
  b.post(74, 368, 5);
  b.spinner('bond_spinner', [27, 500], [92, 500], { label: 'BOND' });
  b.shotSwitch('apart_sw', 50, 430, -90, { r: 20 });
  b.gate('orbit_deflect', [FRAME.left, 646], [54, 694], -90);

  // --- The scale: two pan bodies whose roofs slope away from the bell jar, the jar dome between.
  //     The jar mouth flares 5 units each side at the bottom to funnel shots into the Sealed Scale.
  const jl = JAR.x - JAR.r;
  const jr = JAR.x + JAR.r;
  b.wall([[145, 461], [jl - 5, 461], [jl, JAR.y], [145, 452]], { id: 'pan_left_body', r: 3, closed: true, style: 'glass' });
  b.wall([[CX * 2 - 145, 461], [jr + 5, 461], [jr, JAR.y], [CX * 2 - 145, 452]], { id: 'pan_right_body', r: 3, closed: true, style: 'glass' });
  b.arc(JAR.x, JAR.y, JAR.r, 180, 360, { id: 'jar_dome', r: 4, style: 'glass', segments: 14 });
  const left = b.dropBank('reactants', PAN.leftX, PAN.y, 0, 4, { size: PAN.size, gap: PAN.gap, group: 'reactants', labels: PAN_LABELS });
  const right = b.dropBank('products', PAN.rightX, PAN.y, 0, 4, { size: PAN.size, gap: PAN.gap, group: 'products', labels: PAN_LABELS });
  left.autoReset = false;
  right.autoReset = false;
  const scale = b.saucer('scale', POCKET[0], POCKET[1], { role: 'pocket', ejectDeg: 100, ejectSpeed: 760, captureMaxSpeed: 3200, label: 'SCALE', icon: 'scale' });
  b.rt.add(new JarScoop(b.rt, 'scale_scoop', scale, POCKET[0], POCKET[1], SCOOP_R));
  const ledger = b.rt.add(new Ledger(b.rt, 'balance', left, right));

  // --- Gear train: three gear pop bumpers under the clock face ---
  for (const g of GEARS) b.bumper(g.id, g.x, g.y, { r: 24, group: 'gears', icon: 'cog' });

  // --- JOIN RAMP (right): its mouth tops the open right lane, where the left flipper's steepest
  //     shots arrive; falling balls pass beneath its start and roll down the lane to the inlane.
  b.ramp('join_ramp', { path: RAMP_PATH, width: 40, peak: 80, label: 'JOIN RAMP' });
  b.wall([[FRAME.laneSep - 3, 650], [514, 698]], { id: 'lane_deflect', r: 3 });
  // SWAP ORBIT: a steep shot that slips past the ramp mouth orbits the arch to the far side.
  b.shotSwitch('swap_sw', 530, 365, -90, { r: 18 });
  b.rollover('wind', 522, 560, { r: 14, group: 'wind', label: 'WIND' });

  // --- Tally lamps under each pan (4 H, 4 O) and the BALANCED star ---
  const lamps: Record<El, Insert[]>[] = [{ H: [], O: [] }, { H: [], O: [] }];
  for (const side of [0, 1] as const) {
    for (const el of ['H', 'O'] as El[]) {
      for (let i = 0; i < NEED[el]; i++) {
        lamps[side][el].push(b.rt.add(new TallyLamp(b.rt, `tally_${side ? 'p' : 'r'}${el}${i + 1}`, tallyX(side, el, i), TALLY_Y, { shape: 'circle', size: 7, color: el === 'H' ? IVORY : CORAL })));
      }
    }
  }
  const star = b.rt.add(new TallyLamp(b.rt, 'ins_balance', CX, DIAL.y - DIAL.r - 18, { shape: 'star', size: 13, color: GOLD }));
  ledger.attachLamps(lamps, star);

  // --- Shot inserts ---
  b.insert('ins_apart', 118, 660, { deg: -114, label: 'APART', color: CORAL });
  b.insert('ins_reactants', panCx(0), 558, { deg: -90, label: 'REACTANTS', color: MINT });
  b.insert('ins_products', panCx(1), 558, { deg: -90, label: 'PRODUCTS', color: MINT });
  b.insert('ins_scale', CX, 552, { deg: -90, size: 14, color: GOLD });
  b.insert('ins_join', 474, 606, { deg: -74, label: 'JOIN', color: GOLD });
  b.insert('ins_swap', 524, 602, { deg: -90, size: 13, label: 'SWAP', color: MINT });
  b.insert('ins_gears', CX, 318, { shape: 'star', size: 12, color: BRASS });
}

// ---------------------------------------------------------------- printed playfield art

/** Ball-and-stick molecule models (table units, centred). Bond order 2 draws a double bond. */
type Mol = { atoms: [El, number, number][]; bonds: [number, number, 1 | 2][] };
const H2O2: Mol = { atoms: [['H', -16, -7], ['O', -6, 1], ['O', 6, -1], ['H', 16, 7]], bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1]] };
const H2O: Mol = { atoms: [['O', 0, -2], ['H', -9, 6], ['H', 9, 6]], bonds: [[0, 1, 1], [0, 2, 1]] };
const O2: Mol = { atoms: [['O', -6, 0], ['O', 6, 0]], bonds: [[0, 1, 2]] };

function atomDot(ctx: CanvasRenderingContext2D, x: number, y: number, el: El, lit: number, s = 1) {
  const r = (el === 'H' ? 4.4 : 6.4) * s;
  const col = el === 'H' ? IVORY : CORAL;
  if (lit > 0.05) glowDot(ctx, x, y, r * 2.6, col, 0.3 * lit);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  g.addColorStop(0, mix(col, '#ffffff', 0.35 + 0.4 * lit));
  g.addColorStop(1, mix(col, '#10161c', 0.55 - 0.35 * lit));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawMol(ctx: CanvasRenderingContext2D, m: Mol, x: number, y: number, lit: number, s = 1) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(mix('#6f6a5e', IVORY, lit), 0.55 + 0.4 * lit);
  ctx.lineWidth = 2.2 * s;
  for (const [a, b2, order] of m.bonds) {
    const [, x1, y1] = m.atoms[a];
    const [, x2, y2] = m.atoms[b2];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / len) * 2.2 * s;
    const ny = ((x2 - x1) / len) * 2.2 * s;
    const offs = order === 2 ? [-1, 1] : [0];
    for (const o of offs) {
      ctx.beginPath();
      ctx.moveTo(x + x1 * s + nx * o, y + y1 * s + ny * o);
      ctx.lineTo(x + x2 * s + nx * o, y + y2 * s + ny * o);
      ctx.stroke();
    }
  }
  ctx.restore();
  for (const [el, ax, ay] of m.atoms) atomDot(ctx, x + ax * s, y + ay * s, el, lit, s);
}

/** Toothed gear silhouette with spokes and a hub (no transparency cut-outs on the print). */
function drawGear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, angle: number, body: string, edge: string, glow = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (glow > 0.02) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 16 * glow;
  }
  ctx.beginPath();
  const tw = Math.PI / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    ctx.lineTo(Math.cos(a - tw * 0.55) * r * 0.84, Math.sin(a - tw * 0.55) * r * 0.84);
    ctx.lineTo(Math.cos(a - tw * 0.32) * r, Math.sin(a - tw * 0.32) * r);
    ctx.lineTo(Math.cos(a + tw * 0.32) * r, Math.sin(a + tw * 0.32) * r);
    ctx.lineTo(Math.cos(a + tw * 0.55) * r * 0.84, Math.sin(a + tw * 0.55) * r * 0.84);
  }
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Spoked web: dark windows between five spokes.
  ctx.fillStyle = 'rgba(6,14,18,0.55)';
  for (let k = 0; k < 5; k++) {
    const a0 = (k / 5) * TAU + 0.16;
    const a1 = ((k + 1) / 5) * TAU - 0.16;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.66, a0, a1);
    ctx.arc(0, 0, r * 0.32, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, TAU);
  ctx.fillStyle = edge;
  ctx.fill();
  ctx.restore();
}

function chain(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  for (let y = y0, k = 0; y < y1 - 3; y += 6, k++) {
    ctx.beginPath();
    if (k % 2) ctx.ellipse(x, y + 3, 1.2, 3, 0, 0, TAU);
    else ctx.ellipse(x, y + 3, 2.4, 3.2, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, font = SANS, weight = 800, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(4,10,14,0.8)';
  ctx.lineWidth = Math.max(2, size * 0.22);
  ctx.strokeText(s, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, deg: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, s * 0.5);
  ctx.lineTo(0, -s * 0.2);
  ctx.lineTo(s * 0.6, s * 0.5);
  ctx.stroke();
  ctx.restore();
}

function paintBackdrop(ctx: CanvasRenderingContext2D, level: number) {
  const s1 = stage(level, 0.15, 1); // pans, tallies and the equation
  const s2 = stage(level, 1.15, 2); // gear train and the three regroup lanes
  const s3 = stage(level, 2.15, 3); // sealed jar, reaction dial and mass readout
  const s4 = stage(level, 3.3, 4); // Wonderlight
  const brass = (lit: number) => mix('#5b4a32', BRASS, Math.min(1, lit));

  // Lacquered clock plate.
  ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, mix('#123a42', '#1d3d3a', s4)], [0.42, mix('#0f2c34', '#173634', s4)], [1, '#0a1820']]);
  ctx.fillRect(0, 0, 600, 1150);
  // Engraved guilloche rings and spokes radiating from the sealed jar.
  ctx.save();
  ctx.strokeStyle = rgba(BRASS, 0.045 + 0.04 * s3 + 0.05 * s4);
  ctx.lineWidth = 1;
  for (let r = 40; r < 760; r += 13) {
    ctx.beginPath();
    ctx.arc(CX, 420, r, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(BRASS, 0.03 + 0.03 * s4);
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * TAU;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * 60, 420 + Math.sin(a) * 60);
    ctx.lineTo(CX + Math.cos(a) * 760, 420 + Math.sin(a) * 760);
    ctx.stroke();
  }
  ctx.restore();

  // Clock-face band under the arch: hour ticks and numerals from X to II.
  ctx.save();
  const AC = { x: FRAME.archCx, y: FRAME.archCy };
  ctx.strokeStyle = rgba(BRASS, 0.18 + 0.3 * s2);
  ctx.lineWidth = 2;
  for (const rr of [262, 248]) {
    ctx.beginPath();
    ctx.arc(AC.x, AC.y, rr, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  for (let m = 0; m <= 48; m++) {
    const a = Math.PI * (1.08 + (0.84 * m) / 48);
    const big = m % 8 === 0;
    ctx.lineWidth = big ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(AC.x + Math.cos(a) * 262, AC.y + Math.sin(a) * 262);
    ctx.lineTo(AC.x + Math.cos(a) * (big ? 240 : 252), AC.y + Math.sin(a) * (big ? 240 : 252));
    ctx.stroke();
  }
  ['X', 'XI', 'XII', 'I', 'II'].forEach((n, i) => {
    const a = Math.PI * (7 / 6 + i / 6);
    text(ctx, n, AC.x + Math.cos(a) * 224, AC.y + Math.sin(a) * 224, 15, rgba(mix('#8b7650', GOLD, s2), 0.55 + 0.4 * s2), SERIF);
  });
  ctx.restore();


  // Gear train behind the pop bumpers (they sit on the big gears' hubs).
  const gb = mix('#3d3020', mix(BRASS, GOLD, s4), 0.25 + 0.6 * s2);
  const ge = mix('#6b5636', '#fff1c8', 0.3 + 0.5 * s2);
  const idle: [number, number, number, number, number][] = [
    [232, 262, 22, 9, 0.2], [340, 265, 22, 9, 0.5], [118, 196, 32, 11, 0.1], [452, 200, 28, 10, 0.4], [286, 178, 20, 8, 0.3],
  ];
  for (const [x, y, r, n, a] of idle) drawGear(ctx, x, y, r, n, a, gb, ge, s2 * 0.5);
  for (const g of GEARS) drawGear(ctx, g.x, g.y, 46, 15, g.x * 0.01, gb, ge, s2);

  // The balance beam, its needle gauge and the chains down to the pans.
  const beamY = 366;
  ctx.save();
  ctx.strokeStyle = rgba(GOLD, 0.25 + 0.5 * s1);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CX, beamY, 34, Math.PI * 1.3, Math.PI * 1.7);
  ctx.stroke();
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.1;
    ctx.lineWidth = k === 0 ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * 34, beamY + Math.sin(a) * 34);
    ctx.lineTo(CX + Math.cos(a) * (k === 0 ? 26 : 30), beamY + Math.sin(a) * (k === 0 ? 26 : 30));
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.lineCap = 'round';
  const bg = ctx.createLinearGradient(0, beamY - 4, 0, beamY + 4);
  bg.addColorStop(0, mix(brass(s1), '#fff1c8', 0.4));
  bg.addColorStop(1, mix(brass(s1), '#2a1c10', 0.4));
  ctx.strokeStyle = bg;
  ctx.lineWidth = 7;
  if (s1 > 0.05) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 10 * s1;
  }
  ctx.beginPath();
  ctx.moveTo(146, beamY);
  ctx.lineTo(426, beamY);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CX, beamY);
  ctx.lineTo(CX, beamY - 28);
  ctx.stroke();
  ctx.fillStyle = brass(s1);
  for (const x of [146, 426, CX]) {
    ctx.beginPath();
    ctx.arc(x, beamY, x === CX ? 7 : 6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  const chainCol = rgba(mix('#7d6a48', BRASS, s1), 0.85);
  for (const [x, y1] of [[156, 448], [242, 416], [CX * 2 - 156, 448], [CX * 2 - 242, 416]] as Pt[]) chain(ctx, x, beamY + 4, y1, chainCol);

  // Pan trays (inside the wooden pan bodies) with engraved names.
  for (const side of [0, 1] as const) {
    const m = (x: number) => (side === 0 ? x : CX * 2 - x);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(m(145), 461);
    ctx.lineTo(m(252), 461);
    ctx.lineTo(m(257), 410);
    ctx.lineTo(m(145), 452);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, 410, 0, 461);
    tg.addColorStop(0, mix(brass(s1), '#fff1c8', 0.25));
    tg.addColorStop(1, mix(brass(s1), '#2a1c10', 0.35));
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.restore();
    text(ctx, side === 0 ? 'REACTANTS' : 'PRODUCTS', m(192), 451, 9, mix('#2a1c10', INK, 0.5), SANS, 800);
  }

  // The sealed bell jar: glass, glow and its knob.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(252, 461);
  ctx.lineTo(257, 410);
  ctx.arc(JAR.x, JAR.y, JAR.r, Math.PI, TAU);
  ctx.lineTo(320, 461);
  ctx.closePath();
  const jg = ctx.createRadialGradient(CX, 438, 4, CX, 430, 52);
  jg.addColorStop(0, rgba(mix(MINT, GOLD, s4), 0.25 + 0.45 * s3));
  jg.addColorStop(1, rgba('#0a2a30', 0.85));
  ctx.fillStyle = jg;
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.2 + 0.25 * s3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(JAR.x, JAR.y, JAR.r - 7, Math.PI * 1.12, Math.PI * 1.42);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = brass(s3);
  ctx.beginPath();
  ctx.arc(CX, JAR.y - JAR.r - 4, 4.5, 0, TAU);
  ctx.fill();
  text(ctx, 'SEALED', CX, 398, 7.5, rgba(IVORY, 0.55 + 0.4 * s3));

  // Tally letters under the lamps, then the equation plaque.
  for (const side of [0, 1] as const) {
    text(ctx, 'H', panCx(side) - 27.5, TALLY_Y + 13, 9, rgba(IVORY, 0.6 + 0.4 * s1));
    text(ctx, 'O', panCx(side) + 27.5, TALLY_Y + 13, 9, rgba(CORAL, 0.6 + 0.4 * s1));
  }
  ctx.save();
  rrect(ctx, 136, 509, 300, 24, 9);
  ctx.fillStyle = rgba(INK, 0.78);
  ctx.fill();
  ctx.strokeStyle = rgba(mix('#7d6a48', GOLD, s1), 0.75);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  const eqCol = mix('#b9ab8e', IVORY, s1);
  text(ctx, '2H₂O₂', panCx(0), 521, 15, eqCol);
  text(ctx, '→', CX, 520, 18, mix('#b99a5a', GOLD, s1));
  text(ctx, '2H₂O + O₂', panCx(1), 521, 15, eqCol);
  if (s1 > 0.02) glowDot(ctx, CX, 520, 40, GOLD, 0.18 * s1);

  // The reaction dial: BEFORE (2 H2O2) over AFTER (2 H2O + O2), the same eight atoms.
  ctx.save();
  const fg = ctx.createRadialGradient(DIAL.x, DIAL.y - 20, 8, DIAL.x, DIAL.y, DIAL.r);
  fg.addColorStop(0, mix('#18414a', '#2a4a44', s3));
  fg.addColorStop(1, '#0a1c22');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(DIAL.x, DIAL.y, DIAL.r, 0, TAU);
  ctx.fill();
  if (s3 > 0.05) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 14 * s3;
  }
  ctx.strokeStyle = brass(0.35 + 0.65 * s3);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.6;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(DIAL.x + Math.cos(a) * (DIAL.r - 4), DIAL.y + Math.sin(a) * (DIAL.r - 4));
    ctx.lineTo(DIAL.x + Math.cos(a) * (DIAL.r - 10), DIAL.y + Math.sin(a) * (DIAL.r - 10));
    ctx.stroke();
  }
  ctx.restore();
  const molLit = 0.25 + 0.75 * Math.max(s2, s3 * 0.9);
  text(ctx, 'BEFORE', DIAL.x, DIAL.y - 43, 8, rgba(IVORY, 0.6 + 0.35 * s3));
  drawMol(ctx, H2O2, DIAL.x - 24, DIAL.y - 23, molLit, 1);
  drawMol(ctx, H2O2, DIAL.x + 24, DIAL.y - 23, molLit, 1);
  chevron(ctx, DIAL.x, DIAL.y + 1, 9, 180, rgba(GOLD, 0.5 + 0.5 * s3));
  drawMol(ctx, H2O, DIAL.x - 35, DIAL.y + 24, molLit, 1);
  drawMol(ctx, H2O, DIAL.x - 4, DIAL.y + 24, molLit, 1);
  drawMol(ctx, O2, DIAL.x + 32, DIAL.y + 22, molLit, 1);
  text(ctx, 'AFTER', DIAL.x, DIAL.y + 45, 8, rgba(IVORY, 0.6 + 0.35 * s3));
  // Sealed-jar mass readout (level 3).
  ctx.save();
  rrect(ctx, CX - 92, DIAL.y + DIAL.r + 8, 184, 22, 8);
  ctx.fillStyle = rgba(INK, 0.7);
  ctx.fill();
  ctx.strokeStyle = rgba(mix('#5b4a32', MINT, s3), 0.7);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  text(ctx, '68 g before  =  68 g after', CX, DIAL.y + DIAL.r + 19.5, 10.5, mix('#7f8f8a', MINT, s3));
  // Title plate above the slings.
  neonText(ctx, 'CONSERVATION CLOCKWORKS', CX, 806, 15, GOLD, 0.15 + 0.85 * s1);

  // BREAK-APART orbit: lane tint, up-chevrons, the BOND spinner plate and a breaking bond.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(26, 372);
  for (const [x, y] of [...ORBIT_WALL].reverse()) ctx.lineTo(x, y);
  ctx.lineTo(54, 694);
  ctx.lineTo(26, 646);
  ctx.closePath();
  ctx.fillStyle = rgba(INK, 0.32);
  ctx.fill();
  ctx.strokeStyle = rgba(CORAL, 0.15 + 0.45 * s2);
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.restore();
  for (const y of [560, 590, 620]) chevron(ctx, 44, y, 12, 0, rgba(CORAL, 0.25 + 0.6 * s2));
  text(ctx, 'BREAK APART', 78, 590, 11, rgba(mix('#c98a8c', CORAL, s2), 0.7 + 0.3 * s2), SANS, 800, -Math.PI / 2 + 0.33);
  text(ctx, 'BOND', 59, 520, 9, rgba(IVORY, 0.55 + 0.4 * s2));
  atomDot(ctx, 44, 536, 'O', 0.3 + 0.7 * s2, 0.8);
  atomDot(ctx, 74, 536, 'O', 0.3 + 0.7 * s2, 0.8);
  ctx.save();
  ctx.strokeStyle = rgba(IVORY, 0.4 + 0.4 * s2);
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(50, 536);
  ctx.lineTo(57, 536);
  ctx.moveTo(61, 536);
  ctx.lineTo(68, 536);
  ctx.stroke();
  ctx.restore();

  // JOIN ramp mouth and the SWAP lane, each with its regrouping pattern.
  atomDot(ctx, 480, 496, 'H', 0.3 + 0.7 * s2, 0.85);
  atomDot(ctx, 494, 496, 'H', 0.3 + 0.7 * s2, 0.85);
  text(ctx, '+', 505, 496, 9, rgba(IVORY, 0.7));
  atomDot(ctx, 516, 496, 'O', 0.3 + 0.7 * s2, 0.85);
  text(ctx, 'SWAP', 537, 452, 10, rgba(mix('#7fb7ad', MINT, s2), 0.75 + 0.25 * s2), SANS, 800, -Math.PI / 2);
  for (const y of [500, 528]) chevron(ctx, 537, y, 9, 0, rgba(MINT, 0.25 + 0.6 * s2));

  // Wonderlight: warm wash and rays from the sealed jar.
  if (s4 > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.5 * s4;
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * TAU;
      ctx.fillStyle = rgba(GOLD, 0.06);
      ctx.beginPath();
      ctx.moveTo(CX, 430);
      ctx.lineTo(CX + Math.cos(a - 0.05) * 800, 430 + Math.sin(a - 0.05) * 800);
      ctx.lineTo(CX + Math.cos(a + 0.05) * 800, 430 + Math.sin(a + 0.05) * 800);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    glowDot(ctx, CX, 430, 360, GOLD, 0.16 * s4);
    const r = rng(13);
    for (let i = 0; i < 70; i++) {
      const x = 40 + r() * 500;
      const y = 40 + r() * 760;
      glowDot(ctx, x, y, 3 + r() * 4, r() < 0.5 ? GOLD : IVORY, 0.35 * s4);
    }
  }
}

// ---------------------------------------------------------------- 3D attraction set

type V3 = [number, number, number];
type T3 = typeof THREE_NS;
const G = REGIONS.groundY;

/** Glowing material whose emissive intensity the set drives. */
function glowMat(kit: SetKit, color: string, base = 0.08, dark = '#0b0a12') {
  return kit.track(new kit.THREE.MeshStandardMaterial({ color: dark, emissive: color, emissiveIntensity: base, roughness: 0.3, metalness: 0.1 }));
}

/** Canvas texture helper (tracked for disposal). */
function canvasTex(kit: SetKit, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = kit.track(new kit.THREE.CanvasTexture(c));
  t.colorSpace = kit.THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Orient a unit-height mesh/instance along a segment (shared scratch objects, no allocation). */
function segmentMatrix(T: T3, out: THREE_NS.Matrix4, a: THREE_NS.Vector3, b: THREE_NS.Vector3, radius: number, scratch: { d: THREE_NS.Vector3; m: THREE_NS.Vector3; q: THREE_NS.Quaternion; s: THREE_NS.Vector3; up: THREE_NS.Vector3 }) {
  scratch.d.subVectors(b, a);
  const len = scratch.d.length();
  scratch.m.addVectors(a, b).multiplyScalar(0.5);
  if (len < 1e-5 || radius < 1e-4) {
    scratch.s.set(0, 0, 0);
    scratch.q.identity();
  } else {
    scratch.d.divideScalar(len);
    scratch.q.setFromUnitVectors(scratch.up, scratch.d);
    scratch.s.set(radius, len, radius);
  }
  void T;
  return out.compose(scratch.m, scratch.q, scratch.s);
}

const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Live atom counts for the Grand Balance (falls back to the awakening level outside play). */
const counted = { r: EMPTY, p: EMPTY, glow: 0 };
function balanceCounts(level: number) {
  const L = liveLedger;
  if (L && L.rt.time > 0) {
    counted.r = L.counts[0];
    counted.p = L.counts[1];
    counted.glow = L.glow;
  } else {
    counted.r = counted.p = level >= 1 ? NEED : EMPTY;
    counted.glow = 0;
  }
  return counted;
}

const clockworksSet: SetBuilder = (kit) => {
  const THREE = kit.THREE;
  kit.sky('#17343e', '#04080b');
  kit.boardwalk('#3a2a1d', 30);
  const glowSprite = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote');
  const scratch = { d: new THREE.Vector3(), m: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  const m4 = new THREE.Matrix4();
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const halo = (color: string, size: number) => {
    const mat = kit.track(new THREE.SpriteMaterial({ map: glowSprite, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    return { s, mat };
  };
  const pool = (x: number, z: number, radius: number, color: string) => {
    const mat = kit.track(new THREE.MeshBasicMaterial({ map: glowSprite, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), mat);
    mesh.position.set(x, G + 0.02, z);
    mesh.renderOrder = 1;
    kit.add(mesh);
    return mat;
  };
  const hMat = glowMat(kit, '#fff1d6', 0.15, '#cfc8ba');
  const oMat = glowMat(kit, '#ff6a72', 0.15, '#b8363f');
  hMat.roughness = oMat.roughness = 0.22;
  const hGeo = kit.track(new THREE.SphereGeometry(1, 20, 14));

  // ================= LEFT: the Grand Balance (loads atoms as the Ledger counts them) =================
  const bal = new THREE.Group();
  bal.position.set(-5.75, G, -1.7);
  bal.rotation.y = 0.32;
  kit.add(bal);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, 0.24, 36), kit.mats.wood());
  plinth.position.y = 0.12;
  const plinthTop = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.64, 0.12, 36), kit.mats.brass());
  plinthTop.position.y = 0.3;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 2.55, 18), kit.mats.brass());
  column.position.y = 0.36 + 1.27;
  bal.add(plinth, plinthTop, column);
  for (const m of [plinth, plinthTop, column]) m.castShadow = true;
  const colGear = kit.gear([0, 0, 0], 0.36, 14, COPPER, 0.07);
  bal.add(colGear);
  colGear.position.set(0, 1.25, 0.13);
  const TOP = 2.95;
  const pivot = new THREE.Group();
  pivot.position.y = TOP;
  bal.add(pivot);
  const BEAM = 1.3;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(BEAM * 2 + 0.1, 0.1, 0.1), kit.mats.brass());
  beam.castShadow = true;
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.62, 8), kit.mats.chrome());
  needle.position.y = 0.32;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), kit.mats.brass());
  pivot.add(beam, needle, finial);
  const gaugeMat = glowMat(kit, GOLD, 0.15);
  const gauge = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 6, 40, Math.PI * 0.4), gaugeMat);
  gauge.rotation.z = Math.PI * 0.3;
  gauge.position.set(0, TOP, -0.02);
  bal.add(gauge);
  /** One pan: bowl, three chains to its hanging point, its atoms and a name plate. */
  const makePan = (name: string, color: string) => {
    const hang = new THREE.Group();
    bal.add(hang);
    const prof = [new THREE.Vector2(0, -0.02), new THREE.Vector2(0.3, -0.02), new THREE.Vector2(0.46, 0.06), new THREE.Vector2(0.52, 0.14), new THREE.Vector2(0.53, 0.16)];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), kit.mats.brass());
    (bowl.material as THREE_NS.Material).side = THREE.DoubleSide;
    bowl.position.y = -1.0;
    bowl.castShadow = true;
    hang.add(bowl);
    const chainGeo = kit.track(new THREE.CylinderGeometry(1, 1, 1, 5));
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5;
      const c = new THREE.Mesh(chainGeo, kit.mats.chrome());
      va.set(Math.cos(a) * 0.5, -0.86, Math.sin(a) * 0.5);
      vb.set(0, 0, 0);
      segmentMatrix(THREE, m4, va, vb, 0.008, scratch);
      c.applyMatrix4(m4);
      hang.add(c);
    }
    const plate = kit.panel(name, [0, 0, 0], { w: 0.86, h: 0.22, bg: color, fg: '#10161c' });
    hang.add(plate);
    plate.position.set(0, -1.22, 0.42);
    plate.rotation.x = -0.35;
    // Four H and four O atom tokens resting in the bowl (instanced; scaled in when counted).
    const spots: Record<El, V3[]> = {
      O: [[-0.17, 0, -0.05], [0.17, 0, 0.05], [0.0, 0.0, 0.2], [0.02, 0.17, -0.02]],
      H: [[-0.3, -0.02, 0.18], [0.31, -0.02, -0.16], [-0.12, 0.0, -0.3], [0.13, 0.02, 0.3]],
    };
    const inst: Record<El, THREE_NS.InstancedMesh> = {
      H: new THREE.InstancedMesh(hGeo, hMat, 4),
      O: new THREE.InstancedMesh(hGeo, oMat, 4),
    };
    for (const el of ['H', 'O'] as El[]) {
      inst[el].position.y = -0.86;
      inst[el].frustumCulled = false;
      hang.add(inst[el]);
    }
    const shown: Record<El, number[]> = { H: [0, 0, 0, 0], O: [0, 0, 0, 0] };
    const q = new THREE.Quaternion();
    const set = (el: El, count: number, dt: number, bob: number) => {
      const r0 = el === 'H' ? 0.085 : 0.115;
      for (let i = 0; i < 4; i++) {
        const want = i < count ? 1 : 0;
        shown[el][i] += (want - shown[el][i]) * (kit.reducedMotion ? 1 : Math.min(1, dt * 7));
        const s = shown[el][i] * r0;
        const p = spots[el][i];
        va.set(p[0], p[1] + r0 + Math.sin(bob + i * 1.7) * 0.01 * shown[el][i], p[2]);
        vb.set(s, s, s);
        inst[el].setMatrixAt(i, m4.compose(va, q, vb));
      }
      inst[el].instanceMatrix.needsUpdate = true;
    };
    return { hang, set };
  };
  const pans = [makePan('REACTANTS', MINT), makePan('PRODUCTS', MINT)];
  const balHalo = halo(GOLD, 1.5);
  balHalo.s.position.set(0, TOP, 0);
  bal.add(balHalo.s);
  let beamAngle = 0;

  // ================= RIGHT: the Sealed Jar on a fan scale (same atoms, same 68 g) =================
  const jar = new THREE.Group();
  jar.position.set(5.85, G, -1.5);
  jar.rotation.y = -0.38;
  jar.scale.setScalar(1.18);
  kit.add(jar);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.46, 1.25), kit.mats.paintedMetal('#1f4c52'));
  base.position.y = 0.23;
  base.castShadow = true;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.81, 0.06, 1.31), kit.mats.brass());
  trim.position.y = 0.48;
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.7, 0.05, 40), kit.mats.brass());
  platter.position.y = 0.53;
  const fanPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 12), kit.mats.brass());
  fanPost.position.set(0.0, 0.5 + 0.8, -0.72);
  jar.add(base, trim, platter, fanPost);
  // Fan dial: 0-100 g, the needle parked at 68 g before, during and after.
  const dialTex = canvasTex(kit, 512, 512, (ctx) => {
    const g2 = ctx.createRadialGradient(256, 230, 30, 256, 256, 256);
    g2.addColorStop(0, '#fff7e7');
    g2.addColorStop(1, '#e6d3a8');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#8a6a32';
    ctx.stroke();
    ctx.strokeStyle = '#1a1030';
    ctx.fillStyle = '#1a1030';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= 100; v += 5) {
      const a = Math.PI * (0.8 + (1.4 * v) / 100);
      const big = v % 20 === 0;
      ctx.lineWidth = big ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 214, 256 + Math.sin(a) * 214);
      ctx.lineTo(256 + Math.cos(a) * (big ? 182 : 198), 256 + Math.sin(a) * (big ? 182 : 198));
      ctx.stroke();
      if (big) {
        ctx.font = `800 34px ${SANS}`;
        ctx.fillText(String(v), 256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150);
      }
    }
    const a68 = Math.PI * (0.8 + 1.4 * 0.68);
    ctx.strokeStyle = '#d2463f';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(256, 256, 226, a68 - 0.05, a68 + 0.05);
    ctx.stroke();
    ctx.font = `800 64px ${SANS}`;
    ctx.fillStyle = '#1f4c52';
    ctx.fillText('68 g', 256, 350);
    ctx.font = `800 30px ${SANS}`;
    ctx.fillText('SEALED JAR', 256, 412);
  });
  const fan = new THREE.Group();
  fan.position.set(0, 2.25, -0.72);
  fan.rotation.x = -0.3;
  jar.add(fan);
  const fanFace = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.5, emissive: '#ffffff', emissiveMap: dialTex, emissiveIntensity: 0.12 }));
  kit.track(fanFace.material as THREE_NS.Material);
  const fanRim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 48), kit.mats.brass());
  const fanNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.44, 0.012), kit.mats.paintedMetal('#d2463f'));
  fanNeedle.geometry.translate(0, 0.2, 0);
  fanNeedle.position.z = 0.02;
  // Needle angle for 68 g on a dial spanning 0.8pi..2.2pi (canvas y-down => mirror for 3D).
  fanNeedle.rotation.z = -(Math.PI * (0.8 + 1.4 * 0.68)) - Math.PI / 2;
  fan.add(fanFace, fanRim, fanNeedle);
  const fanMat = fanFace.material as THREE_NS.MeshStandardMaterial;
  // The bell jar itself.
  const JAR_Y = 0.555;
  const jp: THREE_NS.Vector2[] = [new THREE.Vector2(0.6, 0), new THREE.Vector2(0.6, 0.72)];
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    jp.push(new THREE.Vector2(Math.cos(a) * 0.6, 0.72 + Math.sin(a) * 0.6));
  }
  const glass = new THREE.Mesh(new THREE.LatheGeometry(jp, 40), kit.mats.clearPlastic('#d8f4ff', 0.2));
  glass.position.y = JAR_Y;
  glass.renderOrder = 2;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), kit.mats.brass());
  knob.position.y = JAR_Y + 1.36;
  const seal = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.03, 8, 48), kit.mats.brass());
  seal.rotation.x = Math.PI / 2;
  seal.position.y = JAR_Y + 0.02;
  jar.add(glass, knob, seal);
  // Eight atoms: 0 H, 1 O, 2 O, 3 H (first H2O2), 4 H, 5 O, 6 O, 7 H (second H2O2).
  const ELS: El[] = ['H', 'O', 'O', 'H', 'H', 'O', 'O', 'H'];
  const REACT: V3[] = [
    [-0.24, 0.3, 0.06], [-0.1, 0.22, 0], [0.1, 0.22, 0], [0.24, 0.13, -0.06],
    [-0.24, -0.06, -0.06], [-0.1, -0.14, 0], [0.1, -0.14, 0], [0.24, -0.23, 0.06],
  ];
  // After: water (O1 + H0 + H3), water (O5 + H4 + H7), oxygen gas (O2 = O6).
  const PROD: V3[] = [
    [-0.37, 0.29, 0.03], [-0.25, 0.2, 0], [0.14, 0.04, 0], [-0.13, 0.29, 0.03],
    [-0.37, -0.11, 0.03], [-0.25, -0.2, 0], [0.32, 0.04, 0], [-0.13, -0.11, 0.03],
  ];
  const R_BONDS: [number, number][] = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]];
  /** Spread of the jar's atom model (keeps the bond sticks visible between atoms). */
  const JK = 1.35;
  const P_BONDS: [number, number, number][] = [[0, 1, 0], [3, 1, 0], [4, 5, 0], [7, 5, 0], [2, 6, 0.035], [2, 6, -0.035]];
  const atomCenter = new THREE.Group();
  atomCenter.position.y = JAR_Y + 0.62;
  jar.add(atomCenter);
  const jhMat = glowMat(kit, '#fff1d6', 0.15, '#cfc8ba');
  const joMat = glowMat(kit, '#ff6a72', 0.15, '#b8363f');
  const atoms = ELS.map((el) => {
    const m = new THREE.Mesh(hGeo, el === 'H' ? jhMat : joMat);
    m.scale.setScalar(el === 'H' ? 0.058 : 0.08);
    atomCenter.add(m);
    return m;
  });
  const bondMat = glowMat(kit, '#fff1c8', 0.5, '#3a3020');
  const bonds = new THREE.InstancedMesh(kit.track(new THREE.CylinderGeometry(1, 1, 1, 6)), bondMat, R_BONDS.length + P_BONDS.length);
  bonds.frustumCulled = false;
  atomCenter.add(bonds);
  const beforeSign = kit.neonSign('BEFORE', [0, 0, 0], { height: 0.16, color: MINT, backing: false });
  const afterSign = kit.neonSign('AFTER', [0, 0, 0], { height: 0.16, color: GOLD, backing: false });
  jar.add(beforeSign, afterSign);
  beforeSign.position.set(-0.45, 0.25, 0.64);
  afterSign.position.set(0.45, 0.25, 0.64);
  const jarSign = kit.neonSign('SAME ATOMS, SAME MASS', [5.85, 2.98, -3.3], { height: 0.42, color: MINT, rotY: -0.38 });
  jarSign.rotation.x = -0.45;
  const jarHalo = halo(MINT, 1.3);
  jarHalo.s.position.set(0, JAR_Y + 0.62, 0);
  jar.add(jarHalo.s);
  const offset = new THREE.Vector3();
  let cycle = 0;
  /**
   * Place the eight atoms and twelve bond instances for reaction phase u (0..11 s loop): hold the
   * reactants, break their bonds, regroup the same atoms, form the products' bonds, hold, then a
   * quick dimmed replay glides every atom back (atoms never vanish, so the loop never suggests it).
   */
  const jarState = { before: 1, after: 0, replay: 0 };
  const placeJar = (u: number, wobble: number) => {
    const rewind = u >= 10.1 ? ease((u - 10.1) / 0.8) : 0;
    const breakR = u >= 10.1 ? ease((u - 10.6) / 0.35) : 1 - ease((u - 3.0) / 0.9);
    const move = u >= 10.1 ? 1 - rewind : ease((u - 4.0) / 2.0);
    const formP = u >= 10.1 ? 1 - ease((u - 10.1) / 0.25) : ease((u - 6.1) / 0.9);
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      const r0 = REACT[i];
      const p0 = PROD[i];
      const arc = u < 10.1 ? Math.sin(move * Math.PI) * 0.06 : 0;
      const jig = Math.sin(u * 9 + i) * wobble * (1 - breakR) * (1 - move);
      a.position.set(
        JK * (r0[0] + (p0[0] - r0[0]) * move) + jig,
        JK * (r0[1] + (p0[1] - r0[1]) * move) + (i % 2 ? arc : -arc),
        JK * (r0[2] + (p0[2] - r0[2]) * move),
      );
    }
    let n = 0;
    for (const [i, j] of R_BONDS) bonds.setMatrixAt(n++, segmentMatrix(THREE, m4, atoms[i].position, atoms[j].position, 0.024 * breakR, scratch));
    for (const [i, j, off] of P_BONDS) {
      va.copy(atoms[i].position);
      vb.copy(atoms[j].position);
      offset.set(0, off, 0);
      va.add(offset);
      vb.add(offset);
      bonds.setMatrixAt(n++, segmentMatrix(THREE, m4, va, vb, (off ? 0.016 : 0.024) * formP, scratch));
    }
    bonds.instanceMatrix.needsUpdate = true;
    jarState.before = u < 3.4 || u >= 10.7 ? 1 : 0;
    jarState.after = u >= 6.6 && u < 10.1 ? 1 : 0;
    jarState.replay = u >= 10.1 && u < 10.95 ? 1 : 0;
  };
  placeJar(0, 0);

  // ================= FRONT LEFT: the gear tower =================
  const tower = new THREE.Group();
  tower.position.set(-5.2, G, 3.05);
  tower.rotation.y = 0.55;
  kit.add(tower);
  const tBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.6), kit.mats.wood());
  tBase.position.y = 0.11;
  const postGeo = kit.track(new THREE.BoxGeometry(0.08, 2.1, 0.08));
  const tPostL = new THREE.Mesh(postGeo, kit.mats.brass());
  tPostL.position.set(-0.78, 1.17, -0.12);
  const tPostR = new THREE.Mesh(postGeo, kit.mats.brass());
  tPostR.position.set(0.78, 1.17, -0.12);
  const tBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.08), kit.mats.brass());
  tBar.position.set(0, 2.2, -0.12);
  tower.add(tBase, tPostL, tPostR, tBar);
  // Meshing gears: [x, y, radius, teeth, colour]; speeds follow the tooth ratios.
  const spec: [number, number, number, number, string][] = [
    [-0.32, 0.78, 0.5, 16, BRASS], [0.38, 1.12, 0.3, 10, COPPER], [0.42, 0.52, 0.22, 8, GOLD], [-0.2, 1.62, 0.36, 12, COPPER], [0.36, 1.82, 0.2, 7, BRASS],
  ];
  const towerGears = spec.map(([x, y, r, n, c], i) => {
    const g = kit.gear([0, 0, 0], r, n, c, 0.07);
    tower.add(g);
    g.position.set(x, y, i % 2 ? 0.02 : -0.04);
    return { g, ratio: (i % 2 ? -1 : 1) * (16 / n) };
  });
  const pend = new THREE.Group();
  pend.position.set(0, 2.16, 0.06);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.1, 6), kit.mats.chrome());
  rod.position.y = -0.55;
  const bobMat = glowMat(kit, GOLD, 0.2, '#3a2a10');
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), bobMat);
  bob.position.y = -1.1;
  pend.add(rod, bob);
  tower.add(pend);
  let gearAngle = 0;

  // ================= FRONT RIGHT: the carillon that plays the repaired machine's tune =================
  const car = new THREE.Group();
  car.position.set(5.25, G, 3.1);
  car.rotation.y = -0.55;
  kit.add(car);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 0.7), kit.mats.wood());
  cab.position.y = 0.31;
  cab.castShadow = true;
  const cabTop = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.05, 0.76), kit.mats.brass());
  cabTop.position.y = 0.64;
  const cPostL = new THREE.Mesh(postGeo, kit.mats.brass());
  cPostL.scale.y = 0.62;
  cPostL.position.set(-1.0, 0.66 + 0.65, 0);
  const cPostR = new THREE.Mesh(postGeo, kit.mats.brass());
  cPostR.scale.y = 0.62;
  cPostR.position.set(1.0, 0.66 + 0.65, 0);
  const cBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 0.07), kit.mats.brass());
  cBar.position.set(0, 1.98, 0);
  car.add(cab, cabTop, cPostL, cPostR, cBar);
  const bellProf: THREE_NS.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const v = i / 10;
    bellProf.push(new THREE.Vector2(0.06 + 0.94 * Math.pow(v, 2.2) * (1 - 0.12 * Math.sin(v * Math.PI)), -v));
  }
  bellProf.push(new THREE.Vector2(1.05, -1.02));
  const bellGeo = kit.track(new THREE.LatheGeometry(bellProf, 28));
  const BELLS = 6;
  const bellCols = [GOLD, '#FFD98A', BRASS, GOLD, '#FFD98A', BRASS];
  const bells = Array.from({ length: BELLS }, (_, i) => {
    const s = 0.2 - i * 0.017;
    const mat = kit.track(new THREE.MeshStandardMaterial({ color: '#6b4c1c', metalness: 0.9, roughness: 0.25, emissive: bellCols[i], emissiveIntensity: 0.05, side: THREE.DoubleSide }));
    const bell = new THREE.Mesh(bellGeo, mat);
    bell.scale.set(s, s * 1.15, s);
    const hangY = 1.94;
    const grp = new THREE.Group();
    grp.position.set(-0.82 + i * 0.33, hangY, 0);
    bell.position.y = 0;
    grp.add(bell);
    car.add(grp);
    const hammer = new THREE.Group();
    hammer.position.set(-0.82 + i * 0.33, 0.68, 0.28);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), kit.mats.chrome());
    shaft.position.y = 0.45;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), kit.mats.paintedMetal(CORAL));
    head.position.y = 0.92;
    hammer.add(shaft, head);
    hammer.rotation.x = -0.18;
    car.add(hammer);
    return { grp, mat, hammer, ring: 0, swing: 0 };
  });
  const carSign = kit.neonSign('THE CLOCKWORKS CHIME', [0, 2.35, 0.05], { height: 0.27, color: GOLD, backing: false });
  car.add(carSign);
  carSign.position.set(0, 2.32, 0.05);
  carSign.rotation.x = -0.35;
  const tune = [0, 2, 4, 5, 4, 2, 0, 3, 5, 1, 3, 5];
  let tuneStep = -1;
  const strike = (step: number) => {
    const b = bells[tune[((step % tune.length) + tune.length) % tune.length]];
    b.ring = 1;
    b.swing = 1;
  };

  // ================= MID LEFT: the Atom Ledger board (live counts from the pans) =================
  const ledgerCanvas = document.createElement('canvas');
  ledgerCanvas.width = 512;
  ledgerCanvas.height = 320;
  const ledgerTex = kit.track(new THREE.CanvasTexture(ledgerCanvas));
  ledgerTex.colorSpace = THREE.SRGBColorSpace;
  ledgerTex.anisotropy = 4;
  let ledgerKey = -1;
  const paintLedger = (r: Record<El, number>, p: Record<El, number>) => {
    const key = r.H * 1000 + r.O * 100 + p.H * 10 + p.O;
    if (key === ledgerKey) return;
    ledgerKey = key;
    const ctx = ledgerCanvas.getContext('2d')!;
    const bgG = ctx.createLinearGradient(0, 0, 0, 320);
    bgG.addColorStop(0, '#163a40');
    bgG.addColorStop(1, '#0b2226');
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = '#d9b26a';
    ctx.lineWidth = 6;
    ctx.strokeRect(9, 9, 494, 302);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 38px ${SERIF}`;
    ctx.fillStyle = '#ffc75b';
    ctx.fillText('ATOM LEDGER', 256, 46);
    ctx.fillStyle = '#d9b26a';
    ctx.fillRect(256, 78, 3, 190);
    const cols: [number, string, Record<El, number>][] = [[134, 'REACTANTS', r], [380, 'PRODUCTS', p]];
    for (const [x, name, c] of cols) {
      ctx.font = `800 26px ${SANS}`;
      ctx.fillStyle = '#71e3cf';
      ctx.fillText(name, x, 94);
      (['H', 'O'] as El[]).forEach((el, row) => {
        const y = 146 + row * 62;
        ctx.font = `800 30px ${SANS}`;
        ctx.fillStyle = el === 'H' ? '#fff7e7' : '#ff7f86';
        ctx.fillText(el, x - 92, y);
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(x - 48 + i * 36, y, el === 'H' ? 12 : 15, 0, TAU);
          if (i < c[el]) {
            ctx.fillStyle = el === 'H' ? '#fff7e7' : '#ff7f86';
            ctx.fill();
          } else {
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255,247,231,0.35)';
            ctx.stroke();
          }
        }
      });
      ctx.font = `800 24px ${SANS}`;
      ctx.fillStyle = '#fff7e7';
      ctx.fillText(`${c.H + c.O} of ${PAN_CAP} atoms`, x, 262);
    }
    const done = r.H + r.O >= PAN_CAP && p.H + p.O >= PAN_CAP;
    ctx.font = `800 26px ${SANS}`;
    ctx.fillStyle = done ? '#ffc75b' : 'rgba(255,247,231,0.6)';
    ctx.fillText(done ? 'BALANCED: 4 H + 4 O = 4 H + 4 O' : 'count every atom on both sides', 256, 294);
    ledgerTex.needsUpdate = true;
  };
  const easel = new THREE.Group();
  easel.position.set(-5.2, G, 0.85);
  easel.rotation.y = 0.5;
  kit.add(easel);
  const legGeo = kit.track(new THREE.BoxGeometry(0.06, 1.7, 0.06));
  for (const x of [-0.62, 0.62]) {
    const leg = new THREE.Mesh(legGeo, kit.mats.brass());
    leg.position.set(x, 0.85, -0.05);
    leg.rotation.x = -0.12;
    easel.add(leg);
  }
  const board = new THREE.Group();
  board.position.set(0, 1.1, 0.04);
  board.rotation.x = -0.28;
  easel.add(board);
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.04, 0.05), kit.mats.wood());
  const boardMat = kit.track(new THREE.MeshStandardMaterial({ map: ledgerTex, emissive: '#ffffff', emissiveMap: ledgerTex, emissiveIntensity: 0.25, roughness: 0.6 }));
  const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 0.95), boardMat);
  boardFace.position.z = 0.03;
  board.add(boardFrame, boardFace);
  paintLedger({ H: 0, O: 0 }, { H: 0, O: 0 });

  // ================= MID RIGHT: atoms into wanted products (the green-chemistry redesign) =================
  const chartTex = canvasTex(kit, 512, 400, (ctx) => {
    const bgG = ctx.createLinearGradient(0, 0, 0, 400);
    bgG.addColorStop(0, '#163a40');
    bgG.addColorStop(1, '#0b2226');
    ctx.fillStyle = bgG;
    ctx.fillRect(0, 0, 512, 400);
    ctx.strokeStyle = '#d9b26a';
    ctx.lineWidth = 6;
    ctx.strokeRect(9, 9, 494, 382);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 31px ${SERIF}`;
    ctx.fillStyle = '#ffc75b';
    ctx.fillText('EVERY ATOM COUNTS', 256, 44);
    ctx.font = `700 19px ${SANS}`;
    ctx.fillStyle = '#fff7e7';
    ctx.fillText('share of reactant mass in wanted products', 256, 78);
    ctx.fillText('(ibuprofen designs)', 256, 102);
    const bars: [number, string, string, string][] = [[100, '≈40%', '1960s', '6 steps'], [256, '≈77%', '1990s', '3 steps'], [412, '≈99%', '3 steps +', 'by-product used']];
    for (const [x, pct, a, b2] of bars) {
      ctx.font = `800 30px ${SANS}`;
      ctx.fillStyle = '#71e3cf';
      ctx.fillText(pct, x, 140);
      ctx.font = `700 21px ${SANS}`;
      ctx.fillStyle = '#fff7e7';
      ctx.fillText(a, x, 338);
      ctx.fillText(b2, x, 364);
    }
  });
  const chart = new THREE.Group();
  chart.position.set(6.05, G, 1.0);
  chart.rotation.y = -0.55;
  chart.scale.setScalar(0.85);
  kit.add(chart);
  const chartBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.62), kit.mats.wood());
  chartBase.position.y = 0.07;
  const chartBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.25), kit.track(new THREE.MeshStandardMaterial({ map: chartTex, emissive: '#ffffff', emissiveMap: chartTex, emissiveIntensity: 0.22, roughness: 0.6 })));
  chartBoard.position.set(0, 0.78, -0.22);
  chartBoard.rotation.x = -0.18;
  const chartBoardMat = chartBoard.material as THREE_NS.MeshStandardMaterial;
  chart.add(chartBase, chartBoard);
  const barGeo = kit.track(new THREE.BoxGeometry(0.26, 1, 0.22));
  barGeo.translate(0, 0.5, 0);
  const barMats = [glowMat(kit, COPPER, 0.2, '#3a2416'), glowMat(kit, GOLD, 0.2, '#3a2e14'), glowMat(kit, MINT, 0.2, '#103a34')];
  const barSpec = [0.4, 0.77, 0.99];
  const chartBars = barSpec.map((v, i) => {
    const bar = new THREE.Mesh(barGeo, barMats[i]);
    bar.position.set(-0.5 + i * 0.5, 0.14, 0.06);
    bar.castShadow = true;
    chart.add(bar);
    return bar;
  });

  // ================= TOP LEFT: the Conservation Clock =================
  const clock = new THREE.Group();
  clock.position.set(-5.35, 1.3, -4.7);
  clock.rotation.set(-0.42, 0.5, 0);
  clock.scale.setScalar(0.8);
  kit.add(clock);
  const faceTex = canvasTex(kit, 512, 512, (ctx) => {
    const g2 = ctx.createRadialGradient(256, 240, 20, 256, 256, 256);
    g2.addColorStop(0, '#20464e');
    g2.addColorStop(1, '#0c2228');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(256, 256, 252, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#d9b26a';
    ctx.lineWidth = 3;
    for (const r of [238, 206]) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe2a3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 40px ${SERIF}`;
    ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => {
      const a = -Math.PI / 2 + (i / 12) * TAU;
      ctx.fillText(n, 256 + Math.cos(a) * 172, 256 + Math.sin(a) * 172);
    });
    for (let m = 0; m < 60; m++) {
      const a = (m / 60) * TAU;
      ctx.lineWidth = m % 5 ? 2 : 5;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 236, 256 + Math.sin(a) * 236);
      ctx.lineTo(256 + Math.cos(a) * (m % 5 ? 224 : 212), 256 + Math.sin(a) * (m % 5 ? 224 : 212));
      ctx.stroke();
    }
    ctx.font = `800 26px ${SANS}`;
    ctx.fillStyle = '#71e3cf';
    ctx.fillText('ATOMS IN', 256, 320);
    ctx.fillText('= ATOMS OUT', 256, 352);
  });
  const faceMat = kit.track(new THREE.MeshStandardMaterial({ map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 0.1, roughness: 0.45 }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.05, 56), faceMat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.07, 10, 56), kit.mats.brass());
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.02), kit.mats.brass());
  hourHand.geometry.translate(0, 0.22, 0.03);
  const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.78, 0.02), kit.mats.brass());
  minHand.geometry.translate(0, 0.36, 0.05);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 16), kit.mats.brass());
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.05;
  clock.add(face, rim, hourHand, minHand, hub);
  const clockGears = [
    { g: kit.gear([0, 0, 0], 0.55, 16, COPPER, 0.08), x: 1.05, y: -0.55, ratio: 1 },
    { g: kit.gear([0, 0, 0], 0.34, 10, BRASS, 0.08), x: -1.0, y: 0.75, ratio: -1.6 },
  ];
  for (const cg of clockGears) {
    clock.add(cg.g);
    cg.g.position.set(cg.x, cg.y, -0.1);
  }
  let clockT = 0;

  // ================= Head marquee, poles, lights and atmosphere =================
  const marquee = kit.neonSign('CONSERVATION CLOCKWORKS', [0, 1.5, -7.3], { height: 0.62, color: GOLD });
  marquee.rotation.x = -0.7;
  for (const p of [[-8.6, -6.5], [8.6, -6.5], [-8.4, 0.6], [8.4, 0.6], [-7.4, 5.6], [7.4, 5.6]] as [number, number][]) {
    kit.pole([p[0], 0, p[1]], p[1] < -3 ? 4.4 : p[1] > 3 ? 2.6 : 3.4, '#8a6f45');
  }
  const lightsA = kit.stringLights([-8.6, 4.2, -6.5], [8.6, 4.2, -6.5], 0.7, kit.n(26), [GOLD, '#ffe2a3', MINT]);
  const lightsB = kit.stringLights([-8.4, 3.2, 0.6], [-7.4, 2.45, 5.6], 0.35, kit.n(12), [GOLD, CORAL]);
  const lightsC = kit.stringLights([8.4, 3.2, 0.6], [7.4, 2.45, 5.6], 0.35, kit.n(12), [GOLD, MINT]);
  const motes = kit.motes({ x0: -10, x1: 10, y0: -0.2, y1: 5, z0: -9, z1: 6 }, 110, GOLD, { speed: 0.1, size: 0.08 });
  const atomMotes = kit.motes({ x0: 4.6, x1: 7.2, y0: 0.4, y1: 3.6, z0: -2.6, z1: -0.4 }, 40, MINT, { speed: 0.18, size: 0.07 });
  const fwL = kit.fireworks({ x0: -9, x1: -6.6, y0: 2.6, y1: 3.6, z: -4.6 }, [GOLD, CORAL, IVORY]);
  const fwR = kit.fireworks({ x0: 6.6, x1: 9, y0: 2.6, y1: 3.6, z: -4.6 }, [GOLD, MINT, IVORY]);
  // Wonderlight columns rising from the two hero machines (level 4 and the celebration).
  const shaftTex = canvasTex(kit, 32, 256, (ctx) => {
    const g2 = ctx.createLinearGradient(0, 0, 0, 256);
    g2.addColorStop(0, 'rgba(255,255,255,0)');
    g2.addColorStop(0.55, 'rgba(255,255,255,0.35)');
    g2.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, 32, 256);
  });
  const shaft = (x: number, z: number, color: string, rTop: number, rBottom: number, h: number) => {
    const mat = kit.track(new THREE.MeshBasicMaterial({ map: shaftTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 32, 1, true), mat);
    m.position.set(x, G + h / 2, z);
    m.renderOrder = 4;
    kit.add(m);
    return mat;
  };
  const shaftL = shaft(-5.75, -1.7, GOLD, 1.15, 0.85, 6);
  // A short glow around the jar only, so the 68 g fan dial above it stays readable.
  const shaftR = shaft(5.85, -1.5, MINT, 0.95, 0.85, 2.3);
  const poolL = pool(-5.75, -1.7, 2.2, GOLD);
  const poolR = pool(5.85, -1.5, 2.2, MINT);
  const poolC = pool(5.25, 3.1, 1.8, GOLD);
  kit.spot([-3.6, 6.5, 2.5], [-5.75, 1.2, -1.7], GOLD, 38, 0.42);
  kit.spot([3.6, 6.5, 2.5], [5.85, 1.0, -1.5], MINT, 34, 0.42);
  const warm = kit.point([0, 2.2, 4.6], '#ffd59a', 3, 9);

  // ================= Motion (skipped under reduced motion) =================
  /** Reduced motion: the jar holds one calm state (reactants, then products once mission 2 is done). */
  let jarStill = -1;
  let lvl = 0;
  let celebrating = 0;
  let energyNow = 0;
  kit.animate((t, dt) => {
    const speed = 0.12 + 0.35 * kit.stage(lvl, 1, 2) + 0.4 * energyNow + 2.2 * celebrating;
    gearAngle += dt * speed;
    for (const tg of towerGears) tg.g.rotation.z = gearAngle * tg.ratio;
    colGear.rotation.z = -gearAngle * 0.8;
    for (const cg of clockGears) cg.g.rotation.z = gearAngle * cg.ratio * 0.7;
    pend.rotation.z = Math.sin(t * 2.4) * (0.08 + 0.22 * kit.stage(lvl, 0.5, 2));
    clockT += dt * (0.02 + 0.1 * kit.stage(lvl, 2, 3) + 1.5 * celebrating);
    for (const b of bells) {
      b.swing = Math.max(0, b.swing - dt * 1.6);
      b.grp.rotation.z = Math.sin(t * 14) * 0.12 * b.swing;
      b.hammer.rotation.x = -0.18 - 0.5 * Math.max(0, b.ring - 0.7) / 0.3;
    }
    cycle = (cycle + dt * (0.45 + 0.3 * kit.stage(lvl, 1, 3) + 0.6 * celebrating)) % 11;
    placeJar(cycle, 0.012);
  });

  return {
    update(t, dt, level, energy) {
      lvl = level;
      energyNow = energy;
      const s0 = 0.18 + 0.82 * kit.stage(level, 0, 1);
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      // Grand Balance: atoms appear as they are counted; the beam dips toward the fuller pan.
      const c = balanceCounts(level);
      const full = celebrating > 0 || level >= 3.9;
      const showR = full ? NEED : c.r;
      const showP = full ? NEED : c.p;
      pans[0].set('H', showR.H, dt, t * 2);
      pans[0].set('O', showR.O, dt, t * 2);
      pans[1].set('H', showP.H, dt, t * 2 + 1);
      pans[1].set('O', showP.O, dt, t * 2 + 1);
      const diff = showR.H + showR.O - showP.H - showP.O;
      const target = Math.max(-0.26, Math.min(0.26, diff * 0.035));
      beamAngle += (target - beamAngle) * (kit.reducedMotion ? 1 : Math.min(1, dt * 2.5));
      pivot.rotation.z = beamAngle;
      pans[0].hang.position.set(-BEAM * Math.cos(beamAngle), TOP - BEAM * Math.sin(beamAngle), 0);
      pans[1].hang.position.set(BEAM * Math.cos(beamAngle), TOP + BEAM * Math.sin(beamAngle), 0);
      const balanced = diff === 0 && showR.H + showR.O > 0;
      const bal1 = c.glow > 0 ? 1 : 0;
      hMat.emissiveIntensity = 0.12 + 0.4 * s0 + 0.35 * s4 + 0.9 * bal1;
      oMat.emissiveIntensity = 0.12 + 0.45 * s0 + 0.35 * s4 + 0.9 * bal1;
      gaugeMat.emissiveIntensity = 0.15 + (balanced ? 2.2 : 0.6) * s0 + 2 * bal1;
      balHalo.mat.opacity = 0.05 + 0.12 * s1 + (balanced ? 0.12 : 0) + 0.35 * bal1 + 0.12 * s4;
      poolL.opacity = 0.12 + 0.3 * s1 + 0.25 * s4;
      // Sealed jar: dial glows; BEFORE / AFTER lamps follow the regrouping loop.
      if (kit.reducedMotion) {
        const u = level >= 2 ? 8 : 0;
        if (u !== jarStill) {
          jarStill = u;
          placeJar(u, 0);
        }
      }
      fanMat.emissiveIntensity = 0.1 + 0.18 * s3;
      bondMat.emissiveIntensity = 0.4 + 1.6 * Math.max(s2, 0.4 * s0) + 1.4 * s4;
      beforeSign.setLit((0.15 + 0.85 * s1) * (0.25 + 0.75 * jarState.before));
      const jarGlow = (0.15 + 0.45 * Math.max(s2, 0.5 * s0) + 0.3 * s4) * (1 - 0.45 * jarState.replay);
      jhMat.emissiveIntensity = jarGlow;
      joMat.emissiveIntensity = jarGlow * 1.1;
      afterSign.setLit((0.15 + 0.85 * s1) * (0.25 + 0.75 * jarState.after));
      jarSign.setLit(0.15 + 0.85 * s3);
      jarHalo.mat.opacity = 0.04 + 0.14 * s2 + 0.1 * s4;
      atomMotes.setLit(0.1 + 0.5 * s2 + 0.4 * s4);
      poolR.opacity = 0.1 + 0.3 * s3 + 0.25 * s4;
      // Atom Ledger board mirrors the pans; the redesign chart grows its bars with mission 3.
      paintLedger(c.r, c.p);
      boardMat.emissiveIntensity = 0.18 + 0.3 * s0 + 0.25 * bal1;
      chartBoardMat.emissiveIntensity = 0.12 + 0.3 * s3;
      for (let i = 0; i < chartBars.length; i++) {
        chartBars[i].scale.y = Math.max(0.02, barSpec[i] * 1.05 * (0.15 + 0.85 * s3));
        barMats[i].emissiveIntensity = 0.12 + 0.55 * s3 + 0.2 * s4;
      }
      // Gear tower and clock wake with the second and third missions.
      bobMat.emissiveIntensity = 0.2 + 1.1 * s2;
      faceMat.emissiveIntensity = 0.1 + 0.5 * s3 + 0.3 * s4;
      minHand.rotation.z = -clockT * TAU;
      hourHand.rotation.z = -clockT * TAU / 12 - 1.2;
      // Carillon: bells glow with the Wonderlight, and an encore tune plays slowly at level 4.
      for (const b of bells) {
        b.ring = Math.max(0, b.ring - dt * 1.4);
        b.mat.emissiveIntensity = 0.05 + 0.35 * s4 + 2.6 * b.ring;
      }
      if (!kit.reducedMotion && s4 > 0.5 && celebrating <= 0) {
        const step = Math.floor(t * 1.2);
        if (step !== tuneStep) {
          tuneStep = step;
          strike(step);
        }
      }
      carSign.setLit(0.1 + 0.9 * Math.max(s4, celebrating));
      poolC.opacity = 0.06 + 0.2 * s4 + 0.3 * celebrating;
      shaftL.opacity = 0.22 * Math.max(s4, celebrating);
      shaftR.opacity = 0.16 * Math.max(s4, celebrating);
      if (warm) warm.intensity = 2.2 + 3 * s4 + 4 * celebrating;
      marquee.setLit(0.15 + 0.85 * s2);
      lightsA.setLit(0.2 + 0.8 * s2);
      lightsB.setLit(0.25 + 0.75 * s1);
      lightsC.setLit(0.25 + 0.75 * s1);
      motes.setLit(0.2 + 0.4 * s1 + 0.4 * s4);
      fwL.setLit(Math.max(s4 * 0.8, celebrating));
      fwR.setLit(Math.max(s4 * 0.8, celebrating));
      celebrating = Math.max(0, celebrating - dt * 0.5);
    },
    celebrate(p) {
      const q = Math.max(0, Math.min(1, p));
      celebrating = Math.max(celebrating, Math.sin(q * Math.PI) * 0.9 + 0.1);
      if (kit.reducedMotion) return;
      const step = Math.floor(Math.max(0, p) * 24);
      if (step !== tuneStep) {
        tuneStep = step;
        strike(step);
      }
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const clockworksRoom: RoomBuilder = ({ kit }) => {
  const THREE = kit.THREE;
  // A miniature sealed jar on a fan scale (2 H2O + O2 inside, parked at 68 g), with the
  // clockwork that the repaired machine turns on the back wall.
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.5), kit.mats.paintedMetal('#1f4c52'));
  base.position.set(0.15, 0.08, 0.05);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.03, 28), kit.mats.brass());
  plate.position.set(0.15, 0.175, 0.05);
  const prof: THREE_NS.Vector2[] = [new THREE.Vector2(0.22, 0), new THREE.Vector2(0.22, 0.26)];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    prof.push(new THREE.Vector2(Math.cos(a) * 0.22, 0.26 + Math.sin(a) * 0.22));
  }
  const dome = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), kit.mats.clearPlastic('#d8f4ff', 0.22));
  dome.position.set(0.15, 0.19, 0.05);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.6, 8), kit.mats.brass());
  post.position.set(0.15, 0.46, -0.18);
  const dialMat = kit.track(new THREE.MeshStandardMaterial({ map: kit.track(new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff7e7';
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#d2463f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + Math.cos(-0.35) * 48, 64 + Math.sin(-0.35) * 48);
    ctx.stroke();
    ctx.fillStyle = '#1f4c52';
    ctx.font = `800 30px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('68 g', 64, 104);
    return c;
  })())), emissive: '#ffffff', emissiveIntensity: 0.1, roughness: 0.5 }));
  (dialMat.map as THREE_NS.Texture).colorSpace = THREE.SRGBColorSpace;
  dialMat.emissiveMap = dialMat.map;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.14, 28), dialMat);
  dial.position.set(0.15, 0.86, -0.17);
  for (const m of [base, plate, dome, post, dial]) kit.add(m);
  // Two water molecules and one oxygen molecule: the same 4 H + 4 O as 2 H2O2.
  const atomsIn: [El, number, number, number][] = [
    ['O', 0.08, 0.3, 0.08], ['H', 0.03, 0.34, 0.1], ['H', 0.03, 0.26, 0.06],
    ['O', 0.12, 0.44, -0.02], ['H', 0.07, 0.48, 0.0], ['H', 0.07, 0.4, -0.04],
    ['O', 0.2, 0.33, 0.06], ['O', 0.27, 0.36, 0.06],
  ];
  const orbs = atomsIn.map(([el, x, y, z]) => kit.orb([x, y, z], el === 'H' ? 0.03 : 0.045, el === 'H' ? IVORY : CORAL));
  // The back-wall clockwork: two meshing gears and a small clock face.
  const g1 = kit.gear([-0.6, 1.0, -0.82], 0.3, 12, BRASS, 0.05);
  const g2 = kit.gear([-0.24, 1.27, -0.82], 0.18, 8, COPPER, 0.05);
  const faceMat = kit.track(new THREE.MeshStandardMaterial({ color: '#0d2a30', emissive: MINT, emissiveIntensity: 0.05, roughness: 0.4 }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), faceMat);
  face.position.set(0.62, 1.12, -0.84);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.02, 6, 32), kit.mats.brass());
  rim.position.copy(face.position);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.01), kit.mats.brass());
  hand.geometry.translate(0, 0.07, 0.01);
  hand.position.copy(face.position);
  kit.add(face);
  kit.add(rim);
  kit.add(hand);
  const sign = kit.neonSign('ATOMS IN = ATOMS OUT', [-0.5, 0.55, -0.8], { height: 0.2, color: GOLD, backing: false });
  return {
    update(t, lit) {
      orbs.forEach((o) => o.setLit(lit));
      sign.setLit(lit);
      faceMat.emissiveIntensity = 0.05 + 0.6 * lit;
      dialMat.emissiveIntensity = 0.1 + 0.4 * lit;
      const a = kit.reducedMotion ? 0 : t * (0.2 + 0.8 * lit);
      g1.rotation.z = a;
      g2.rotation.z = -a * (12 / 8);
      hand.rotation.z = -a * 0.5;
    },
  };
};

// ---------------------------------------------------------------- the table

/** Which pans start a fresh count when a stage begins (slot 3 = finale). */
function freshCount(slot: number, stageIdx: number): (0 | 1)[] {
  if (slot === 0 && stageIdx === 0) return [0, 1];
  if (slot === 0 && stageIdx === 1) return [1];
  if (slot === 3 && stageIdx === 0) return [0, 1];
  return [];
}
/** Which pans flash their wanted atoms during a stage. */
function focusFor(slot: number, stageIdx: number): [boolean, boolean] {
  if (slot === 0 && stageIdx === 0) return [true, false];
  if (slot === 0 && stageIdx === 1) return [false, true];
  if (slot === 3 && stageIdx === 0) return [true, true];
  return [false, false];
}

export const L13: TableDef = {
  lessonId: 'L13',
  signature: 'Twin Atom Pans that only reset when they balance: every atom counted on the reactant side must turn up on the product side',
  ballRole: 'The Wonderball is a game token, not an atom: real atoms are far too small to see with your eyes, and in a reaction they stay whole while their bonds break and form.',
  theme: {
    bg: [TEAL, '#0b1a22'],
    rail: BRASS,
    railHighlight: '#fff1c8',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: CORAL,
    accent2: MINT,
    bumperCap: '#e8c27a',
    bumperRing: '#4a2e1a',
    flipper: '#f3d08a',
    ink: IVORY,
    ramp: 'rgba(255,199,91,0.16)',
    trail: '#9fe8ff',
  },
  lines: {
    intro: 'Welcome to the Conservation Clockworks! This old machine only runs when every atom is accounted for, so let’s start counting.',
    quark: '"A rusting old car gets heavier... so is rust making brand-new atoms?" Professor Quark wonders, gears whirring.',
    pipTip: 'Aim just beside the bell jar for the atom pans. Flashing atoms still need counting.',
  },
  build,
  skillShot: 'wind',
  shots: [
    { id: 'reactants', label: 'Reactant pan', on: [{ type: 'dropBank', id: 'reactants' }], insert: 'ins_reactants' },
    { id: 'products', label: 'Product pan', on: [{ type: 'dropBank', id: 'products' }], insert: 'ins_products' },
    { id: 'balance', label: 'Balanced scale', on: [{ type: 'shot', id: 'balance' }] },
    { id: 'apart', label: 'Break-Apart Orbit', on: [{ type: 'shot', id: 'apart_sw' }], insert: 'ins_apart' },
    { id: 'join', label: 'Join Ramp', on: [{ type: 'ramp', id: 'join_ramp' }], insert: 'ins_join' },
    { id: 'swap', label: 'Swap Orbit', on: [{ type: 'shot', id: 'swap_sw' }], insert: 'ins_swap' },
    { id: 'scale', label: 'Sealed Scale', on: [{ type: 'saucer', id: 'scale' }], insert: 'ins_scale' },
    { id: 'gears', label: 'Gear train', on: [{ type: 'bumper', group: 'gears' }], insert: 'ins_gears' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Count Every Atom',
      brief: 'The Clockworks only run when the atoms balance. Count 2H₂O₂ on the reactant pan, then 2H₂O + O₂ on the product pan.',
      objectiveIds: ['L13-O1'],
      stages: [
        { kind: 'collect', text: 'Count 2H₂O₂: 4 H + 4 O on the reactant pan', match: { type: 'drop', group: 'reactants' }, count: 8, preview: ['reactants'] },
        { kind: 'collect', text: 'Count 2H₂O + O₂: 4 H + 4 O on the product pan', match: { type: 'drop', group: 'products' }, count: 8, preview: ['products'] },
        { kind: 'discover', text: 'Balanced! Weigh in at the Sealed Scale', pocket: 'scale', questions: 1 },
      ],
      discovery: 'Count atoms as coefficient × subscript. 2H₂O₂ holds 4 H and 4 O, and so do 2H₂O + O₂. The equation is balanced: no atom was gained or lost.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Same Atoms, New Partners',
      brief: 'Break bonds on the BOND spinner, then regroup the same whole atoms three ways: a substance breaks apart, substances join, or partners swap.',
      objectiveIds: ['L13-O2'],
      stages: [
        { kind: 'collect', text: 'Break bonds: whirl the BOND spinner 8 times', match: { type: 'spinner', id: 'bond_spinner' }, count: 8, preview: ['apart'] },
        { kind: 'shots', text: 'Regroup 3 ways: APART, JOIN and SWAP', shots: ['apart', 'join', 'swap'], order: 'any' },
        { kind: 'discover', text: 'Model the regrouping at the Sealed Scale', pocket: 'scale', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'Bonds break and new bonds form, but every atom stays whole and stays the same element. Substances can break apart, join together or swap partners.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Before and After',
      brief: 'Weigh the sealed jar, run the reaction inside it with the gear train, then weigh it again. Will the mass change?',
      objectiveIds: ['L13-O3', 'L13-O4'],
      stages: [
        { kind: 'shots', text: 'Weigh BEFORE: shoot the Sealed Scale', shots: ['scale'] },
        { kind: 'collect', text: 'React in the sealed jar: turn the gears 6 times', match: { type: 'bumper', group: 'gears' }, count: 6, preview: ['gears'] },
        { kind: 'discover', text: 'Weigh AFTER at the Sealed Scale', pocket: 'scale', questions: 1 },
      ],
      discovery: 'Sealed jar: 68 g of hydrogen peroxide becomes 36 g of water + 32 g of oxygen, still 68 g. Rusting iron gains mass because atoms from its surroundings, mainly oxygen from the air, join it.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Restart the Clockworks',
    brief: 'Balance both pans one last time, wind the clock with all three regroup shots, then bring the Wonderball to the Sealed Scale.',
    stages: [
      { kind: 'collect', text: 'Balance the pans: 8 atoms on each side', match: [{ type: 'drop', group: 'reactants' }, { type: 'drop', group: 'products' }], count: 16, preview: ['reactants', 'products'] },
      { kind: 'shots', text: 'Wind the clock: APART, JOIN and SWAP', shots: ['apart', 'join', 'swap'], order: 'any' },
      { kind: 'discover', text: 'Final weigh-in at the Sealed Scale', pocket: 'scale', questions: 2 },
    ],
    celebration: 'Every atom accounted for! The Clockworks chime their tune: same atoms, new partners, same mass. The Wonderlight is yours!',
  },
  onProgress(rt, { slot, stage: st }) {
    const ledger = rt.find<Ledger>('balance');
    if (!ledger) return;
    for (const side of freshCount(slot, st)) ledger.resetSide(side);
    ledger.focus = focusFor(slot, st);
  },
  set: clockworksSet,
  room: clockworksRoom,
  icons: {
    cog(ctx, s) {
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU;
        const r = i % 2 ? s * 0.72 : s * 0.92;
        ctx.lineTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r);
        ctx.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.32, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
    scale(ctx, s) {
      ctx.fillRect(-s * 0.06, -s * 0.7, s * 0.12, s * 1.3);
      ctx.fillRect(-s * 0.4, s * 0.6, s * 0.8, s * 0.14);
      ctx.fillRect(-s * 0.85, -s * 0.62, s * 1.7, s * 0.1);
      for (const x of [-0.62, 0.62]) {
        ctx.beginPath();
        ctx.arc(x * s, -s * 0.15, s * 0.28, 0, Math.PI);
        ctx.fill();
      }
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      paintBackdrop(ctx, level);
    },
    ambient({ ctx, t, level, reduced }) {
      // 2D view: drifting brass sparks once the gear train wakes, and a pulse when the pans balance.
      const s2 = stage(level, 1, 2);
      if (!reduced && s2 > 0) drift(ctx, 5, 16, t, GOLD, [40, 120, 540, 780], 9, 1.4, 0.3 * s2);
      const g = liveLedger?.glow ?? 0;
      if (g > 0) glowDot(ctx, CX, 470, 200, GOLD, 0.25 * Math.min(1, g));
    },
    celebrate({ ctx, t, reduced }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.55;
      const g = ctx.createRadialGradient(CX, 440, 10, CX, 440, 460);
      g.addColorStop(0, rgba(GOLD, 0.85));
      g.addColorStop(1, rgba(GOLD, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      // Eight atoms circle the sealed jar and regroup: the same atoms, new partners.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + (reduced ? 0 : t * 0.6);
        const d = reduced ? 140 : 70 + p * 180;
        atomDot(ctx, CX + Math.cos(a) * d, 440 + Math.sin(a) * d * 0.8, PAN_LABELS[i % 4], 1 - p * 0.5, 1.6);
      }
    },
  },
};
export default L13;
