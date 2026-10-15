// TableBuilder: the vocabulary tables use to compose geometry from tested mechanisms.
// The standard frame (outer walls, arch, shooter lane, slings, in/outlanes, flippers, drain)
// is shared so every table has fair, verified lower-playfield geometry.

import type { Layer, MaterialName } from '../physics/types.ts';
import {
  Bumper, Diverter, Drain, DropBank, DropTarget, FlipperMech, Gate, Insert, Kickback, Plunger, Portal, Post,
  Ramp, Rollover, Saucer, ShotSwitch, Slingshot, Spinner, Target, Wall, offsetPath,
  type SaucerRole, type WallStyle,
} from './mechanisms.ts';
import type { TableRuntime } from './runtime.ts';

export type Pt = [number, number];

export const FRAME = {
  left: 24,
  right: 596,
  laneSep: 548,
  laneX: 572,
  top: 14,
  archCx: 310,
  archCy: 300,
  centerX: 286,
  bottom: 1140,
  drainY: 1112,
  flipperY: 996,
  leftPivotX: 186,
  rightPivotX: 386,
  flipperLen: 86,
  slingTop: 812,
  /** Upper playfield usable area for table-specific features (keep clear of the lower frame). */
  upper: { x0: 30, y0: 30, x1: 542, y1: 790 },
};

export interface FrameOptions {
  kickback?: 'none' | 'left' | 'right' | 'both';
  /** Extra rubber post between flippers (easier, kinder drains). */
  centerPost?: boolean;
  /** Arch segments; more = smoother. */
  archSegments?: number;
  /** Omit the default full arch to let a table shape its own top. */
  customTop?: boolean;
  /** Close the gap above the shooter-lane separator with a wall from (laneSep, y) instead. */
  laneGateY?: number;
}

let autoId = 0;

export class TableBuilder {
  readonly rt: TableRuntime;
  constructor(rt: TableRuntime) {
    this.rt = rt;
  }

  private auto(prefix: string) {
    autoId++;
    return `${prefix}_${autoId}`;
  }

  // ---------------------------------------------------------------- primitives

  wall(points: Pt[], opts: { id?: string; r?: number; material?: MaterialName; layer?: Layer; style?: WallStyle; closed?: boolean } = {}): Wall {
    return this.rt.add(new Wall(this.rt, opts.id ?? this.auto('wall'), points, opts));
  }

  /** Circular arc as a polyline. Angles in degrees, y-down (0 = +x, 90 = down). */
  arcPoints(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, segments = 16): Pt[] {
    const pts: Pt[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = ((fromDeg + ((toDeg - fromDeg) * i) / segments) * Math.PI) / 180;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }

  arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, opts: { id?: string; segments?: number; r?: number; material?: MaterialName; layer?: Layer; style?: WallStyle } = {}): Wall {
    return this.wall(this.arcPoints(cx, cy, r, fromDeg, toDeg, opts.segments ?? 16), opts);
  }

  /** Smooth curve through control points (Catmull-Rom), as a wall. */
  curvePoints(points: Pt[], segmentsPerSpan = 6): Pt[] {
    if (points.length < 3) return points;
    const out: Pt[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      for (let s = 0; s < segmentsPerSpan; s++) {
        const t = s / segmentsPerSpan;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  curve(points: Pt[], opts: { id?: string; r?: number; material?: MaterialName; layer?: Layer; style?: WallStyle; segmentsPerSpan?: number } = {}): Wall {
    return this.wall(this.curvePoints(points, opts.segmentsPerSpan ?? 6), opts);
  }

  post(x: number, y: number, r = 7, opts: { id?: string; layer?: Layer } = {}): Post {
    return this.rt.add(new Post(this.rt, opts.id ?? this.auto('post'), x, y, r, opts.layer ?? 0));
  }

  bumper(id: string, x: number, y: number, opts: { r?: number; kick?: number; group?: string; label?: string; icon?: string } = {}): Bumper {
    return this.rt.add(new Bumper(this.rt, id, x, y, opts));
  }

  sling(id: string, a: Pt, b: Pt, c: Pt, opts: { kick?: number } = {}): Slingshot {
    return this.rt.add(new Slingshot(this.rt, id, a, b, c, opts));
  }

  rollover(id: string, x: number, y: number, opts: { r?: number; group?: string; label?: string; icon?: string; role?: Rollover['role']; layer?: Layer } = {}): Rollover {
    return this.rt.add(new Rollover(this.rt, id, x, y, opts));
  }

  target(id: string, a: Pt, b: Pt, opts: { group?: string; label?: string; icon?: string; layer?: Layer } = {}): Target {
    return this.rt.add(new Target(this.rt, id, a[0], a[1], b[0], b[1], opts));
  }

  /** A bank of drop targets laid along a line from (x, y) at `deg`, each `size` wide. */
  dropBank(id: string, x: number, y: number, deg: number, count: number, opts: { size?: number; gap?: number; group?: string; labels?: string[]; icons?: string[] } = {}): DropBank {
    const bank = this.rt.add(new DropBank(this.rt, id, { group: opts.group ?? id }));
    const size = opts.size ?? 26;
    const gap = opts.gap ?? 6;
    const dx = Math.cos((deg * Math.PI) / 180);
    const dy = Math.sin((deg * Math.PI) / 180);
    for (let i = 0; i < count; i++) {
      const s = i * (size + gap);
      const t = this.rt.add(new DropTarget(this.rt, `${id}_${i + 1}`, x + dx * s, y + dy * s, x + dx * (s + size), y + dy * (s + size), {
        group: opts.group ?? id, label: opts.labels?.[i], icon: opts.icons?.[i],
      }));
      t.bank = bank;
      bank.targets.push(t);
    }
    return bank;
  }

  spinner(id: string, a: Pt, b: Pt, opts: { group?: string; label?: string; layer?: Layer } = {}): Spinner {
    return this.rt.add(new Spinner(this.rt, id, a[0], a[1], b[0], b[1], opts));
  }

  shotSwitch(id: string, x: number, y: number, dirDeg: number, opts: { r?: number; group?: string; layer?: Layer } = {}): ShotSwitch {
    return this.rt.add(new ShotSwitch(this.rt, id, x, y, dirDeg, opts));
  }

  saucer(id: string, x: number, y: number, opts: { role?: SaucerRole; ejectDeg: number; ejectSpeed?: number; captureMaxSpeed?: number; group?: string; label?: string; icon?: string }): Saucer {
    return this.rt.add(new Saucer(this.rt, id, x, y, opts));
  }

  gate(id: string, a: Pt, b: Pt, passDeg: number, opts: { layer?: Layer } = {}): Gate {
    return this.rt.add(new Gate(this.rt, id, a[0], a[1], b[0], b[1], passDeg, opts));
  }

  diverter(id: string, pivot: Pt, length: number, degA: number, degB: number, opts: { layer?: Layer } = {}): Diverter {
    return this.rt.add(new Diverter(this.rt, id, pivot[0], pivot[1], length, degA, degB, opts));
  }

  /**
   * Raised ramp. `footprintTo` (path index) adds playfield-layer side walls and an end cap
   * under the climbing part, so balls on the playfield bounce off the ramp body instead of
   * rolling "under" it; a ball too slow to climb rolls back out of the mouth.
   */
  ramp(id: string, opts: { path: Pt[]; width?: number; group?: string; label?: string; icon?: string; footprintTo?: number; peak?: number }): Ramp {
    const ramp = this.rt.add(new Ramp(this.rt, id, opts));
    const k = opts.footprintTo ?? 0;
    if (k > 0) {
      const w = (opts.width ?? 34) / 2;
      const base = opts.path.slice(0, k + 1);
      const l = offsetPath(base, w + 2);
      const r = offsetPath(base, -w - 2);
      this.wall(l, { id: `${id}_base_l`, r: 3, style: 'invisible' });
      this.wall(r, { id: `${id}_base_r`, r: 3, style: 'invisible' });
      this.wall([l[l.length - 1], r[r.length - 1]], { id: `${id}_base_cap`, r: 3, style: 'invisible' });
    }
    return ramp;
  }

  portal(id: string, entry: Pt, exit: { x: number; y: number; deg: number; speed?: number }, opts: { group?: string; label?: string } = {}): Portal {
    return this.rt.add(new Portal(this.rt, id, entry[0], entry[1], exit, opts));
  }

  insert(id: string, x: number, y: number, opts: { deg?: number; shape?: Insert['shape']; size?: number; label?: string; group?: string; color?: string } = {}): Insert {
    return this.rt.add(new Insert(this.rt, id, x, y, opts));
  }

  flipper(id: string, x: number, y: number, side: 'left' | 'right', opts: { length?: number; restDeg?: number; upDeg?: number; button?: 'left' | 'right'; layer?: Layer; r0?: number; r1?: number } = {}): FlipperMech {
    const rest = opts.restDeg ?? (side === 'left' ? 28 : 152);
    const up = opts.upDeg ?? (side === 'left' ? -28 : 208);
    return this.rt.add(new FlipperMech(this.rt, {
      id, side, x, y, length: opts.length ?? FRAME.flipperLen, restDeg: rest, upDeg: up,
      button: opts.button ?? side, layer: opts.layer, r0: opts.r0, r1: opts.r1,
    }));
  }

  // ---------------------------------------------------------------- standard frame

  /** Outer cabinet walls, top arch, shooter lane + plunger, lower playfield and drain. */
  standardFrame(opts: FrameOptions = {}) {
    const F = FRAME;
    const archR = F.archCx - F.left;
    // Outer left wall and arch over to the right outer wall.
    if (!opts.customTop) {
      this.wall([[F.left, F.bottom], [F.left, F.archCy]], { id: 'frame_left', r: 4 });
      this.arc(F.archCx, F.archCy, archR, 180, 360, { id: 'frame_arch', segments: opts.archSegments ?? 28, r: 4 });
      this.wall([[F.right, F.archCy], [F.right, F.bottom]], { id: 'frame_right', r: 4 });
    } else {
      this.wall([[F.left, F.bottom], [F.left, F.archCy]], { id: 'frame_left', r: 4 });
      this.wall([[F.right, F.archCy], [F.right, F.bottom]], { id: 'frame_right', r: 4 });
    }
    this.wall([[F.left, F.bottom], [F.right, F.bottom]], { id: 'frame_bottom', r: 4, style: 'invisible' });
    // Shooter lane separator and the one-way exit gate.
    const gateY = opts.laneGateY ?? 330;
    this.wall([[F.laneSep, F.bottom], [F.laneSep, gateY]], { id: 'lane_sep', r: 3 });
    this.post(F.laneSep, gateY, 4, { id: 'lane_sep_cap' });
    this.gate('lane_gate', [F.laneSep + 4, gateY - 4], [F.right - 4, gateY - 34], -90);
    const plunger = this.rt.add(new Plunger(this.rt, 'plunger', F.laneX, 1086, 21));
    this.rt.plunger = plunger;
    this.rt.shooterSpawn = { x: F.laneX, y: 1086 - 13 };

    this.lowerPlayfield(opts);
    this.rt.add(new Drain(this.rt, 'drain', F.drainY, F.left + 4, F.laneSep - 4));
  }

  private lowerPlayfield(opts: FrameOptions) {
    const F = FRAME;
    const mirror = (p: Pt): Pt => [F.centerX * 2 - p[0], p[1]];
    for (const side of ['left', 'right'] as const) {
      const m = side === 'left' ? (p: Pt) => p : mirror;
      // In/outlane divider with a rubber cap, and the inlane guide down to the flipper.
      this.wall([m([62, 846]), m([62, 922]), m([189, 990])], { id: `${side}_inlane_guide`, r: 4 });
      this.post(...m([62, 842]), 6, { id: `${side}_divider_post` });
      // Slingshot
      this.sling(`${side}_sling`, m([104, 812]), m([104, 900]), m([158, 930]));
      // Lane switches
      this.rollover(`${side}_inlane`, ...m([83, 872]), { role: 'inlane', group: 'inlanes' });
      this.rollover(`${side}_outlane`, ...m([43, 872]), { role: 'outlane', group: 'outlanes' });
      const k = opts.kickback ?? 'none';
      if (k === 'both' || k === side) {
        this.rt.add(new Kickback(this.rt, `${side}_kickback`, ...m([43, 1010])));
      }
    }
    this.flipper('flipper_left', F.leftPivotX, F.flipperY, 'left');
    this.flipper('flipper_right', F.rightPivotX, F.flipperY, 'right');
    if (opts.centerPost) this.post(F.centerX, 1066, 6, { id: 'center_post' });
  }
}
