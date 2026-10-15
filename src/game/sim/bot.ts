// Headless play-testing bot: runs a GameSession with a flipper policy that varies its timing,
// answers questions instantly, and records what happened. Used by tests and the soak script.

import { shapeDistance } from '../physics/world.ts';
import { GameSession, type SessionOptions } from '../rules/session.ts';
import type { TableDef } from '../table/tableDef.ts';
import { rng } from '../render/art.ts';
import { matches } from '../rules/missions.ts';
import type { ShotMap, ShotTrial } from './shotmap.ts';

export interface BotReport {
  table: string;
  simSeconds: number;
  events: Record<string, number>;
  shots: Record<string, number>;
  drains: number;
  saves: number;
  rescues: number;
  nudges: number;
  errors: string[];
  missionsCompleted: number;
  finale: boolean;
  questionsAsked: number;
  maxSpeed: number;
  insideWallSamples: number;
  insideDetails: string[];
  rescueSpots: string[];
  /** Sim seconds at which each mission (and the finale) completed. */
  missionTimes: number[];
  finaleTime: number;
  stateTransitions: number;
  ballsLaunched: number;
  multiballs: number;
}

export interface BotOptions {
  seconds: number;
  seed: number;
  /** Answer correctness probability. */
  correctRate?: number;
  practice?: boolean;
  /** Check every N steps that no live ball overlaps a solid wall core (tunneling check). */
  wallCheckEvery?: number;
  autoFlipAssist?: boolean;
  /** Print ball positions every N seconds. */
  trace?: number;
  /** Aim using a shot map (cradle, then drop-and-flip at learned timings). */
  aim?: ShotMap;
}

export async function runBot(def: TableDef, o: BotOptions): Promise<BotReport> {
  const R = rng(o.seed);
  const report: BotReport = {
    table: def.lessonId, simSeconds: 0, events: {}, shots: {}, drains: 0, saves: 0, rescues: 0, nudges: 0,
    errors: [], missionsCompleted: 0, finale: false, questionsAsked: 0, maxSpeed: 0, insideWallSamples: 0, insideDetails: [], rescueSpots: [], missionTimes: [], finaleTime: -1,
    stateTransitions: 0, ballsLaunched: 0, multiballs: 0,
  };
  const pending: { res: ((v: { questionId: string; correct: boolean; hinted: boolean }[]) => void) | null } = { res: null };
  let pendingCount = 0;
  const opts: SessionOptions = {
    mode: 'chapter', practice: o.practice ?? true, balls: 3, ballSaveSeconds: 10, triviaLevel: 1, nudgeEnabled: true,
    autoFlip: !!o.autoFlipAssist, flipperWidth: 1, completedMissions: [], finaleDone: false,
  };
  const s = new GameSession(def, opts, {
    askQuestions(req) {
      report.questionsAsked += req.count;
      pendingCount = req.count;
      return new Promise((res) => (pending.res = res));
    },
    onCallout(c) {
      if (c.text.startsWith('Ball saved')) report.saves++;
      if (c.text.startsWith('Pip rescued')) report.rescues++;
      if (c.text.startsWith('Pip nudges')) report.nudges++;
      if (c.text.startsWith('Wonder Multiball')) report.multiballs++;
    },
    onSound(name) {
      if (name === 'drain') report.drains++;
      if (name === 'launch') report.ballsLaunched++;
    },
    onState() {
      report.stateTransitions++;
    },
    onMissionComplete() {
      report.missionsCompleted++;
      report.missionTimes.push(Math.round(s.rt.time));
    },
    onWonderlight() {
      report.finale = true;
      report.finaleTime = Math.round(s.rt.time);
    },
    onRescue(x, y) {
      if (report.rescueSpots.length < 20) report.rescueSpots.push(`(${x.toFixed(0)},${y.toFixed(0)})`);
    },
    onEvent(e) {
      if (e.type === 'inlane') lastInlane[e.id.startsWith('left') ? 'left' : 'right'] = e.time;
      report.events[e.type] = (report.events[e.type] ?? 0) + 1;
      for (const id of s.shotFor(e)) report.shots[id] = (report.shots[id] ?? 0) + 1;
      const k = `${e.type}:${e.id}`;
      report.events[k] = (report.events[k] ?? 0) + 1;
    },
    onError(msg) {
      if (report.errors.length < 20) report.errors.push(msg);
    },
  });
  // Flipper policy: flip when a ball enters a window above a flipper, with a random delay.
  const flipUntil = new Map<string, number>();
  const plannedAt = new Map<string, number>();
  const steps = Math.round(o.seconds * 120);
  const wallEvery = o.wallCheckEvery ?? 6;
  const solids = s.rt.world.colliders.filter((c) => !c.sensor);
  let lastState = s.state;
  // ---- aiming policy: catch, cradle, then drop-and-flip at a learned delay ----
  type Side = 'left' | 'right';
  const mode: Record<Side, { phase: 'idle' | 'catch' | 'aim' | 'fire' | 'cool'; until: number; since: number; at: number }> = {
    left: { phase: 'idle', until: 0, since: 0, at: 0 },
    right: { phase: 'idle', until: 0, since: 0, at: 0 },
  };
  const lastInlane: Record<Side, number> = { left: -1, right: -1 };
  const lowerFlipper = (side: Side) => s.rt.flippers.find((f) => f.spec.side === side && f.spec.button === side && f.py > 900);
  const usefulTrials = (side: Side, kind: 'drop' | 'feed' = 'drop'): ShotTrial[] => {
    const map = o.aim!;
    const mine = map.trials.filter((tr) => tr.button === side && tr.mode === kind && tr.events.length);
    const st = s.runner.stage;
    let want: ShotTrial[] = [];
    if (st?.kind === 'discover') want = mine.filter((tr) => tr.events.some((e) => e.type === 'saucer' && e.id === st.pocket));
    else if (st?.kind === 'shots') {
      const useful = new Set(s.runner.usefulShots());
      want = mine.filter((tr) => tr.shots.some((x) => useful.has(x)));
    } else if (st?.kind === 'collect') {
      const ms = Array.isArray(st.match) ? st.match : [st.match];
      want = mine.filter((tr) => tr.events.some((e) => ms.some((m) => matches(m, { ...e, time: 0, x: 0, y: 0 } as never))));
    }
    return want.length ? want : mine.filter((tr) => tr.shots.length);
  };
  const aimPolicy = (t: number) => {
    for (const side of ['left', 'right'] as Side[]) {
      const f = lowerFlipper(side);
      if (!f) continue;
      const m = mode[side];
      const balls = s.rt.world.balls.filter((b) => b.state === 'live' && b.layer === f.layer);
      const near = balls.find((b) => Math.hypot(b.x - (f.px + f.tx) / 2, b.y - (f.py + f.ty) / 2) < f.length * 1.1 && b.y < f.py + 40);
      if (m.phase === 'idle') {
        // Inlane feed: time an aimed flip off the inlane switch.
        const fed = lastInlane[side];
        if (fed >= 0 && t - fed < 0.03) {
          lastInlane[side] = -1;
          const opts = usefulTrials(side, 'feed').filter((tr) => tr.shots.length || tr.events.some((e) => e.type === 'saucer'));
          const st = s.runner.stage;
          const good = opts.filter((tr) => st?.kind === 'discover' ? tr.events.some((e) => e.type === 'saucer' && e.id === st.pocket) : true);
          if (good.length && R() < 0.85) {
            const tr = good[Math.floor(R() * good.length)];
            m.phase = 'aim';
            m.at = fed + ((tr.afterInlaneMs ?? 0) + (R() - 0.5) * 6) / 1000;
            continue;
          }
        }
        if (near && near.vy > -100) {
          s.setFlipper(side, true);
          m.phase = 'catch';
          m.since = t;
        }
      } else if (m.phase === 'catch') {
        const cradled = balls.some((b) => s.isCradled(b) && Math.abs(b.x - f.px) < f.length);
        if (cradled && t - m.since > 0.3) {
          const opts = usefulTrials(side);
          if (opts.length) {
            const tr = opts[Math.floor(R() * opts.length)];
            s.setFlipper(side, false);
            m.phase = 'aim';
            m.at = t + (tr.delayMs + (R() - 0.5) * 6) / 1000;
          } else {
            s.setFlipper(side, false);
            m.phase = 'cool';
            m.until = t + 0.15;
          }
        } else if (!near || t - m.since > 2.5) {
          // Missed the catch (ball bounced away): reflex flip and reset.
          s.setFlipper(side, false);
          m.phase = 'cool';
          m.until = t + 0.1;
        }
      } else if (m.phase === 'aim') {
        if (t >= m.at) {
          s.setFlipper(side, true);
          m.phase = 'fire';
          m.until = t + 0.1;
        }
      } else if (m.phase === 'fire') {
        if (t >= m.until) {
          s.setFlipper(side, false);
          m.phase = 'cool';
          m.until = t + 0.35;
        }
      } else if (m.phase === 'cool' && t >= m.until) {
        m.phase = 'idle';
      }
    }
  };
  for (let i = 0; i < steps; i++) {
    const t = s.rt.time;
    const onTip = s.rt.plunger?.ballOnTip();
    if ((s.state === 'ready' || s.state === 'play') && onTip && onTip.state === 'shooter') {
      if (!s.rt.plunger!.pulling) {
        s.plungerPull(true);
        plannedAt.set('plunge', t + 0.15 + R() * 1.0);
      } else if (t >= (plannedAt.get('plunge') ?? 0)) s.plungerPull(false);
    }
    if (s.state === 'parked') {
      // Let the session's async question request reach us, answer it, then let it resume.
      for (let k = 0; k < 3 && !pending.res; k++) await Promise.resolve();
      if (pending.res) {
        const res = pending.res;
        pending.res = null;
        res(Array.from({ length: pendingCount }, (_, k) => ({ questionId: `q${k}`, correct: R() < (o.correctRate ?? 0.7), hinted: false })));
        for (let k = 0; k < 5; k++) await Promise.resolve();
      }
    }
    if (s.state === 'gameover') s.continueGame(false);
    if (!o.autoFlipAssist && o.aim) {
      aimPolicy(t);
    } else if (!o.autoFlipAssist) {
      for (const f of s.rt.flippers) {
        const key = f.id;
        const until = flipUntil.get(key) ?? 0;
        if (t < until) continue;
        let near = false;
        for (const b of s.rt.world.balls) {
          if (b.state !== 'live' || b.layer !== f.layer) continue;
          const d = Math.hypot(b.x - (f.px + f.tx) / 2, b.y - (f.py + f.ty) / 2);
          if (d < f.length * 0.75 && b.vy > -200) near = true;
        }
        const plan = plannedAt.get(key);
        if (near && plan === undefined) plannedAt.set(key, t + R() * 0.12);
        if (plan !== undefined && t >= plan) {
          plannedAt.delete(key);
          s.setFlipper(f.spec.button, true);
          flipUntil.set(key, t + 0.12 + R() * 0.25);
        } else if (t >= until && f.pressed && plan === undefined) {
          s.setFlipper(f.spec.button, false);
        }
      }
    }
    if (R() < 0.0008) s.nudge(R() < 0.5 ? -1 : 1);
    s.fixedStep();
    if (o.trace && i % (120 * o.trace) === 0) {
      const bs = s.rt.world.balls.map((b) => `${b.state}/L${b.layer}@(${b.x.toFixed(0)},${b.y.toFixed(0)}) v(${b.vx.toFixed(0)},${b.vy.toFixed(0)})`).join(' ');
      console.log(`t=${t.toFixed(1)} ${s.state} score=${s.score} ${bs}`);
    }
    if (s.state !== lastState) lastState = s.state;
    for (const b of s.rt.world.balls) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > report.maxSpeed) report.maxSpeed = sp;
      if (i % wallEvery === 0 && (b.state === 'live')) {
        for (const c of solids) {
          if (!c.enabled || c.layer !== b.layer || c.oneWay) continue;
          // Ball center may not sit inside a wall's core (would mean tunneling).
          if (shapeDistance(c.shape, b.x, b.y) < -1) {
            report.insideWallSamples++;
            if (report.insideDetails.length < 12) report.insideDetails.push(`${(c.owner as { id?: string } | undefined)?.id ?? c.id}${c.tag ? ':' + c.tag : ''} ball(${b.x.toFixed(1)},${b.y.toFixed(1)}) L${b.layer} v(${b.vx.toFixed(0)},${b.vy.toFixed(0)}) d=${shapeDistance(c.shape, b.x, b.y).toFixed(1)}`);
          }
        }
      }
    }
  }
  report.simSeconds = o.seconds;
  return report;
}

/** Record which events and shots the session produced (hook into session events). */
export function tallyShots(def: TableDef, events: { type: string; id: string; group?: string }[]) {
  const out: Record<string, number> = {};
  for (const e of events) {
    for (const sh of def.shots) {
      if (sh.on.some((m) => (!m.type || (Array.isArray(m.type) ? m.type : [m.type]).includes(e.type as never)) &&
        (!m.id || (Array.isArray(m.id) ? m.id : [m.id]).includes(e.id)) && (!m.group || m.group === e.group))) {
        out[sh.id] = (out[sh.id] ?? 0) + 1;
      }
    }
  }
  return out;
}
