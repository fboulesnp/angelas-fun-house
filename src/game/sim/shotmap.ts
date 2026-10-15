// Shot map: controlled experiments that find which flip timings, from a cradled ball, make
// which shots. A skilled player cradles, drops the flipper, and re-flips at a chosen moment;
// varying that moment slides the contact point along the flipper and aims the ball.

import { GameSession, type SessionOptions } from '../rules/session.ts';
import type { TableDef } from '../table/tableDef.ts';
import type { TableEvent } from '../table/runtime.ts';
import { matches } from '../rules/missions.ts';

export interface ShotTrial {
  flipper: string;
  button: 'left' | 'right';
  /** 'drop' = from a cradle, drop then flip; 'feed' = ball rolling down the inlane. */
  mode: 'drop' | 'feed';
  delayMs: number;
  /** For feed trials: flip this long after the inlane switch fires. */
  afterInlaneMs?: number;
  events: { type: string; id: string; group?: string }[];
  shots: string[];
}

export interface ShotMap {
  trials: ShotTrial[];
  /** shot id -> trials that made it */
  byShot: Record<string, ShotTrial[]>;
  /** flippers where a cradle could be established */
  cradles: string[];
}

const OPTS: SessionOptions = {
  mode: 'chapter', practice: true, balls: 3, ballSaveSeconds: 0, triviaLevel: 0, nudgeEnabled: false,
  autoFlip: false, flipperWidth: 1, completedMissions: [], finaleDone: false,
};

function freshSession(def: TableDef, onEvent: (e: TableEvent) => void): GameSession {
  return new GameSession(def, OPTS, { askQuestions: async () => [], onEvent });
}

/** Cradle a ball on the given lower flipper by dropping it down the matching inlane. */
function cradle(s: GameSession, side: 'left' | 'right'): boolean {
  const rt = s.rt;
  // remove the shooter ball
  for (const b of [...rt.world.balls]) rt.world.removeBall(b);
  const f = rt.flippers.find((x) => x.spec.side === side && x.spec.button === side && x.py > 900);
  if (!f) return false;
  const x = side === 'left' ? 83 : 489;
  const b = rt.world.addBall(x, 820);
  b.state = 'live';
  s.setFlipper(side, true);
  for (let i = 0; i < 240; i++) s.fixedStep();
  return s.isCradled(b);
}

export function buildShotMap(def: TableDef, opts: { stepMs?: number; maxDelayMs?: number; watchSeconds?: number } = {}): ShotMap {
  const stepMs = opts.stepMs ?? 8;
  const maxDelay = opts.maxDelayMs ?? 760;
  const watch = opts.watchSeconds ?? 3.2;
  const trials: ShotTrial[] = [];
  const cradles: string[] = [];
  for (const side of ['left', 'right'] as const) {
    let events: TableEvent[] = [];
    const probe = freshSession(def, (e) => events.push(e));
    if (!cradle(probe, side)) continue;
    cradles.push(side);
    for (let d = 0; d <= maxDelay; d += stepMs) {
      events = [];
      const s = freshSession(def, (e) => events.push(e));
      if (!cradle(s, side)) continue;
      events = [];
      s.setFlipper(side, false);
      const steps = Math.round((d / 1000) * 120);
      for (let i = 0; i < steps; i++) s.fixedStep();
      s.setFlipper(side, true);
      for (let i = 0; i < 12; i++) s.fixedStep();
      s.setFlipper(side, false);
      for (let i = 0; i < watch * 120; i++) {
        s.fixedStep();
        if (s.state === 'parked' || s.state === 'drained') break;
      }
      const evs = events.filter((e) => e.type !== 'wall' && e.type !== 'launch');
      const shots = new Set<string>();
      for (const e of evs) for (const sh of def.shots) if (sh.on.some((m) => matches(m, e))) shots.add(sh.id);
      trials.push({
        flipper: side, button: side, mode: 'drop', delayMs: d,
        events: evs.map((e) => ({ type: e.type, id: e.id, group: e.group })),
        shots: [...shots],
      });
    }
  }
  // Inlane feed trials: the ball rolls down the inlane onto the lowered flipper.
  for (const side of cradles as ('left' | 'right')[]) {
    for (let d = 300; d <= 1100; d += stepMs) {
      let events: TableEvent[] = [];
      let inlaneAt = -1;
      const s = freshSession(def, (e) => {
        events.push(e);
        if (e.type === 'inlane' && inlaneAt < 0) inlaneAt = e.time;
      });
      for (const b of [...s.rt.world.balls]) s.rt.world.removeBall(b);
      const b = s.rt.world.addBall(side === 'left' ? 83 : 489, 820);
      b.state = 'live';
      const t0 = s.rt.time;
      const steps = Math.round((d / 1000) * 120);
      for (let i = 0; i < steps; i++) s.fixedStep();
      if (inlaneAt < 0) continue;
      const pre = events.length;
      s.setFlipper(side, true);
      for (let i = 0; i < 12; i++) s.fixedStep();
      s.setFlipper(side, false);
      for (let i = 0; i < watch * 120; i++) {
        s.fixedStep();
        if (s.state === 'parked' || s.state === 'drained') break;
      }
      events = events.slice(pre);
      const evs = events.filter((e) => e.type !== 'wall' && e.type !== 'launch');
      const shots = new Set<string>();
      for (const e of evs) for (const sh of def.shots) if (sh.on.some((m) => matches(m, e))) shots.add(sh.id);
      trials.push({
        flipper: side, button: side, mode: 'feed', delayMs: d, afterInlaneMs: Math.round((t0 + d / 1000 - inlaneAt) * 1000),
        events: evs.map((e) => ({ type: e.type, id: e.id, group: e.group })),
        shots: [...shots],
      });
    }
  }
  const byShot: Record<string, ShotTrial[]> = {};
  for (const t of trials) for (const sh of t.shots) (byShot[sh] ??= []).push(t);
  return { trials, byShot, cradles };
}
