// GameSession: one play of one table. Owns the explicit game state machine, ball accounting,
// scoring, ball save, multiball, tilt, stuck-ball rescue, missions and question parking.
// It never touches the DOM; the UI and audio subscribe through hooks.

import type { QuestionType } from '../../content/schema.ts';
import type { Ball } from '../physics/ball.ts';
import { BALL_R, STEP } from '../physics/types.ts';
import { shapeDistance } from '../physics/world.ts';
import { TableBuilder } from '../table/builder.ts';
import { Kickback, Ramp, Saucer, type Mechanism } from '../table/mechanisms.ts';
import { TableRuntime, type TableEvent } from '../table/runtime.ts';
import type { MissionDef, Stage, TableDef } from '../table/tableDef.ts';
import { MissionRunner, shotMade } from './missions.ts';

export type GameState = 'ready' | 'play' | 'parked' | 'celebrate' | 'drained' | 'gameover' | 'paused';

const TRANSITIONS: Record<GameState, GameState[]> = {
  ready: ['play', 'paused', 'gameover'],
  play: ['parked', 'celebrate', 'drained', 'paused', 'ready', 'gameover'],
  parked: ['play', 'celebrate', 'paused'],
  celebrate: ['play', 'parked', 'paused'],
  drained: ['ready', 'gameover', 'paused'],
  gameover: ['ready'],
  paused: ['ready', 'play', 'parked', 'celebrate', 'drained', 'gameover'],
};

export type PlayMode = 'story' | 'chapter' | 'free' | 'explorer';

export interface SessionOptions {
  mode: PlayMode;
  /** Unlimited balls. */
  practice: boolean;
  balls: number;
  ballSaveSeconds: number;
  /** 0 = no questions (Free Play off), 1 = one per discovery, 2 = two per discovery. */
  triviaLevel: 0 | 1 | 2;
  nudgeEnabled: boolean;
  /** Auto-flip assistance: flippers fire automatically when a ball reaches them. */
  autoFlip: boolean;
  flipperWidth: number;
  completedMissions: boolean[];
  finaleDone: boolean;
}

export interface QuestionRequest {
  lessonId: string;
  missionTitle: string;
  /** Mission kind, used to find objectives when a table names none that exist. */
  kind: 'observe' | 'relate' | 'apply' | 'finale';
  objectiveIds: string[];
  count: number;
  preferTypes?: QuestionType[];
  /** 'mission' | 'finale' */
  context: 'mission' | 'finale';
}

export interface QuestionOutcome {
  questionId: string;
  correct: boolean;
  hinted: boolean;
}

export type CalloutTone = 'info' | 'good' | 'big' | 'save' | 'gentle' | 'warn';

export interface Callout {
  text: string;
  sub?: string;
  tone: CalloutTone;
  /** Who says it: Angela, Pip or Quark (for portrait), or none. */
  speaker?: 'angela' | 'pip' | 'quark';
  seconds?: number;
}

export interface SessionHooks {
  askQuestions(req: QuestionRequest): Promise<QuestionOutcome[]>;
  onCallout?(c: Callout): void;
  onSound?(name: string, value?: number): void;
  onState?(s: GameState, prev: GameState): void;
  onMissionComplete?(slot: 0 | 1 | 2, m: MissionDef): void;
  onWonderlight?(): void;
  onGameOver?(score: number): void;
  onScore?(score: number): void;
  /** Visual effects: burst at table coordinates. */
  onFx?(kind: string, x: number, y: number, value?: number): void;
  onError?(msg: string): void;
  /** A stuck ball was rescued at (x, y) (tests use this to locate stuck spots). */
  onRescue?(x: number, y: number): void;
  /** Every table event, after scoring (tests, analytics-free debugging). */
  onEvent?(e: TableEvent): void;
}

export const SCORES = {
  bumper: 100,
  sling: 30,
  rollover: 250,
  inlane: 500,
  outlane: 1000,
  target: 500,
  drop: 750,
  dropBank: 5000,
  spinner: 60,
  saucer: 2500,
  ramp: 5000,
  shot: 3000,
  portal: 2000,
  skillShot: 25000,
  missionProgress: 2500,
  missionComplete: 50000,
  brightIdea: 25000,
  jackpot: 100000,
  finale: 250000,
};

export class GameSession {
  readonly def: TableDef;
  readonly rt: TableRuntime;
  readonly runner: MissionRunner;
  readonly opts: SessionOptions;
  readonly hooks: SessionHooks;
  state: GameState = 'ready';
  private pausedFrom: GameState = 'ready';
  score = 0;
  /** Run counter: increments when the player continues after game over. */
  run = 1;
  continued = false;
  ballNumber = 1;
  ballSaveUntil = 0;
  saveLabelUntil = 0;
  multiball = false;
  private serveQueue: { strength: number; save: number }[] = [];
  private serveCooldown = 0;
  private combo = 0;
  private comboUntil = 0;
  private phrase = 0;
  skillShotUntil = 0;
  tiltMeter = 0;
  tiltWarnings = 0;
  tilted = false;
  private celebrateUntil = 0;
  private celebrateNext: GameState = 'play';
  private pendingDiscover: { saucer: Saucer; stage: Extract<Stage, { kind: 'discover' }> } | null = null;
  energy = 0;
  /** Resume countdown (seconds) after pause/question with live balls. */
  countdown = 0;
  /** Scenery level animated toward runner.level. */
  sceneryLevel = 0;
  celebrateProgress = 0;
  private drainedAt = 0;
  readonly startedAt = Date.now();

  constructor(def: TableDef, opts: SessionOptions, hooks: SessionHooks) {
    this.def = def;
    this.opts = opts;
    this.hooks = hooks;
    this.rt = new TableRuntime();
    const b = new TableBuilder(this.rt);
    def.build(b);
    this.rt.world.finalize();
    for (const f of this.rt.flippers) f.widthScale = opts.flipperWidth;
    this.runner = new MissionRunner(def, opts.completedMissions, opts.finaleDone);
    this.sceneryLevel = this.runner.level;
    this.serveBall();
    this.refreshLamps();
  }

  // ------------------------------------------------------------------ state machine

  private go(next: GameState) {
    if (next === this.state) return;
    if (!TRANSITIONS[this.state].includes(next)) {
      this.hooks.onError?.(`Invalid game transition ${this.state} -> ${next}`);
      return;
    }
    const prev = this.state;
    this.state = next;
    this.hooks.onState?.(next, prev);
  }

  pause() {
    if (this.state === 'paused' || this.state === 'gameover') return;
    this.pausedFrom = this.state;
    this.releaseInputs();
    this.go('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    const back = this.pausedFrom;
    this.go(back);
    if (back === 'play' && this.rt.world.balls.some((b) => b.state === 'live')) this.countdown = 3;
  }

  skipCountdown() {
    this.countdown = 0;
  }

  get isRunning() {
    return this.state === 'play' || this.state === 'ready' || this.state === 'drained';
  }

  // ------------------------------------------------------------------ input

  setFlipper(button: 'left' | 'right', down: boolean) {
    for (const f of this.rt.flippers) {
      if (f.spec.button === button) f.pressed = down && !this.tilted;
    }
    if (down && this.isRunning && !this.tilted) this.hooks.onSound?.('flipper', button === 'left' ? -1 : 1);
  }

  releaseInputs() {
    for (const f of this.rt.flippers) f.pressed = false;
    const p = this.rt.plunger;
    if (p) {
      p.pulling = false;
      p.pull = 0;
    }
  }

  plungerPull(down: boolean) {
    const p = this.rt.plunger;
    if (!p || this.countdown > 0) return;
    if (down) {
      if (this.state === 'ready' || this.state === 'play') p.pulling = true;
    } else if (p.pulling) {
      const strength = p.pull;
      const b = p.release();
      if (b) this.onLaunched(b, strength);
    }
  }

  /** Tap-to-launch for touch players and assistance: a medium-strong plunge. */
  autoPlunge(strength = 0.78) {
    const p = this.rt.plunger;
    if (!p) return;
    const b = p.launch(strength);
    if (b) {
      p.fire = 1;
      this.onLaunched(b, strength);
    }
  }

  nudge(dir: -1 | 1) {
    if (!this.opts.nudgeEnabled || this.state !== 'play' || this.tilted || this.countdown > 0) return;
    for (const b of this.rt.world.balls) {
      if (b.state !== 'live') continue;
      b.vx += dir * 140;
      b.vy -= 90;
    }
    this.tiltMeter += 0.36;
    this.hooks.onSound?.('nudge');
    if (this.tiltMeter > 1) {
      this.tiltMeter = 0.6;
      this.tiltWarnings++;
      if (this.tiltWarnings >= 3) {
        this.tilted = true;
        this.releaseInputs();
        for (const f of this.rt.flippers) f.enabled = false;
        this.callout({ text: 'TILT', sub: 'Flippers rest until this ball drains. Missions and learning are safe.', tone: 'warn', seconds: 3 });
      } else {
        this.callout({ text: 'Careful!', sub: `Tilt warning ${this.tiltWarnings} of 2`, tone: 'warn' });
      }
    }
  }

  // ------------------------------------------------------------------ balls

  private ballsInPlay(): Ball[] {
    return this.rt.world.balls.filter((b) => b.state !== 'drained');
  }

  private serveBall() {
    const s = this.rt.shooterSpawn;
    const b = this.rt.world.addBall(s.x, s.y);
    b.state = 'shooter';
    b.resetTracking(this.rt.time);
    return b;
  }

  private shooterOccupied(): boolean {
    const s = this.rt.shooterSpawn;
    return this.rt.world.balls.some((b) => b.state !== 'drained' && Math.abs(b.x - s.x) < 26 && b.y > s.y - 120);
  }

  private onLaunched(b: Ball, strength: number) {
    const firstLaunch = b.state === 'shooter';
    b.state = 'live';
    b.anchorTime = this.rt.time;
    if (this.state === 'ready') this.go('play');
    this.hooks.onSound?.('launch', strength);
    if (firstLaunch && this.ballSaveUntil < this.rt.time + 1) {
      this.ballSaveUntil = this.rt.time + this.opts.ballSaveSeconds;
    }
    if (firstLaunch && this.def.skillShot && !this.multiball) {
      this.skillShotUntil = this.rt.time + 4;
      const m = this.rt.find(this.def.skillShot);
      if (m) m.lamp = 'flash';
    }
  }

  startMultiball(extra: number) {
    this.multiball = true;
    for (let i = 0; i < extra; i++) this.serveQueue.push({ strength: 0.72 + i * 0.06, save: 10 });
    this.ballSaveUntil = Math.max(this.ballSaveUntil, this.rt.time + 12);
    this.callout({ text: 'Wonder Multiball!', sub: 'Extra Wonderballs join the show', tone: 'big', speaker: 'pip' });
    this.hooks.onSound?.('multiball');
  }

  private handleDrain(b: Ball) {
    const t = this.rt.time;
    const saved = !this.tilted && (t < this.ballSaveUntil || t < b.saveUntil);
    b.state = 'drained';
    this.rt.world.removeBall(b);
    this.hooks.onSound?.('drain');
    if (saved) {
      this.serveQueue.push({ strength: 0.75, save: 0 });
      this.callout({ text: 'Ball saved!', sub: 'Pip catches the Wonderball', tone: 'save', speaker: 'pip' });
      return;
    }
    const remaining = this.ballsInPlay().length + this.serveQueue.length;
    if (remaining === 1 && this.multiball) {
      this.multiball = false;
      this.callout({ text: 'Multiball complete', tone: 'info' });
    }
    if (remaining === 0) this.endOfBall();
  }

  private endOfBall() {
    this.multiball = false;
    this.drainedAt = this.rt.time;
    this.go('drained');
    const practice = this.opts.practice;
    if (!practice && this.ballNumber >= this.opts.balls) {
      this.callout({ text: 'Last ball drained', sub: 'Your missions and discoveries are saved.', tone: 'gentle', seconds: 2.5 });
    } else {
      this.callout({ text: practice ? 'Practice ball' : `Ball ${this.ballNumber + 1}`, sub: this.tilted ? 'Tilt cleared' : 'Missions keep their progress', tone: 'gentle' });
    }
  }

  private afterDrainPause() {
    if (!this.opts.practice && this.ballNumber >= this.opts.balls) {
      this.go('gameover');
      this.hooks.onGameOver?.(this.score);
      return;
    }
    if (!this.opts.practice) this.ballNumber++;
    this.tilted = false;
    this.tiltWarnings = 0;
    this.tiltMeter = 0;
    for (const f of this.rt.flippers) f.enabled = true;
    this.serveBall();
    this.go('ready');
  }

  /** Continue after game over: keep missions and learning; label the score run honestly. */
  continueGame(keepScore: boolean) {
    if (this.state !== 'gameover') return;
    this.run++;
    if (keepScore) this.continued = true;
    else {
      this.score = 0;
      this.continued = false;
    }
    this.ballNumber = 1;
    this.tilted = false;
    this.tiltWarnings = 0;
    for (const f of this.rt.flippers) f.enabled = true;
    this.serveBall();
    this.go('ready');
  }

  // ------------------------------------------------------------------ scoring

  private add(points: number, x?: number, y?: number) {
    if (this.tilted) return;
    this.score += points;
    this.hooks.onScore?.(this.score);
    if (x !== undefined && y !== undefined && points >= 2500) this.hooks.onFx?.('score', x, y, points);
  }

  private callout(c: Callout) {
    this.hooks.onCallout?.(c);
  }

  private majorShot(e: TableEvent) {
    const t = this.rt.time;
    this.combo = t < this.comboUntil ? this.combo + 1 : 1;
    this.comboUntil = t + 4;
    this.phrase = Math.min(this.phrase + 1, 12);
    this.hooks.onSound?.('phrase', this.phrase);
    if (this.combo >= 2) {
      this.add(1500 * this.combo, e.x, e.y);
      if (this.combo === 3) this.callout({ text: 'Combo x3!', tone: 'good' });
    }
  }

  /** Sim time of each ball's most recent scoring contact (feeds stuck detection). */
  private lastScoreBall = new Map<number, number>();

  private scoreEvent(e: TableEvent) {
    if (e.ball && e.type !== 'wall' && e.type !== 'launch') this.lastScoreBall.set(e.ball.id, this.rt.time);
    switch (e.type) {
      case 'bumper':
        this.add(SCORES.bumper);
        this.energy = Math.min(1, this.energy + 0.15);
        this.hooks.onSound?.('bumper', e.x);
        break;
      case 'sling':
        this.add(SCORES.sling);
        this.hooks.onSound?.('sling', e.x);
        break;
      case 'rollover':
        this.add(SCORES.rollover);
        this.hooks.onSound?.('rollover', e.x);
        break;
      case 'inlane':
        this.add(SCORES.inlane);
        this.hooks.onSound?.('rollover', e.x);
        break;
      case 'outlane':
        this.add(SCORES.outlane);
        this.hooks.onSound?.('outlane');
        break;
      case 'target':
        this.add(SCORES.target);
        this.hooks.onSound?.('target', e.x);
        break;
      case 'drop':
        this.add(SCORES.drop);
        this.hooks.onSound?.('drop', e.x);
        break;
      case 'dropBank':
        this.add(SCORES.dropBank, e.x, e.y);
        this.majorShot(e);
        this.hooks.onSound?.('bank');
        break;
      case 'spinner':
        this.add(SCORES.spinner * (e.value ?? 1));
        this.hooks.onSound?.('spinner', e.value);
        break;
      case 'saucer':
        this.add(SCORES.saucer, e.x, e.y);
        this.majorShot(e);
        this.hooks.onSound?.('saucer');
        break;
      case 'rampEnter':
        this.hooks.onSound?.('rampEnter');
        break;
      case 'ramp':
        this.add(SCORES.ramp, e.x, e.y);
        this.majorShot(e);
        this.hooks.onSound?.('ramp');
        break;
      case 'shot':
        this.add(SCORES.shot, e.x, e.y);
        this.majorShot(e);
        this.hooks.onSound?.('orbit');
        break;
      case 'portal':
        this.add(SCORES.portal, e.x, e.y);
        this.hooks.onSound?.('portal');
        break;
      case 'kickback':
        this.callout({ text: 'Kickback!', tone: 'save', speaker: 'pip' });
        this.hooks.onSound?.('kickback');
        break;
      case 'wall':
        this.hooks.onSound?.('wall', e.value);
        break;
      case 'launch':
      case 'drain':
      case 'gate':
      case 'flipperHit':
        break;
    }
    // Skill shot: the designated switch within a few seconds of plunging.
    if (this.def.skillShot && e.id === this.def.skillShot && this.rt.time < this.skillShotUntil) {
      this.skillShotUntil = 0;
      this.add(SCORES.skillShot, e.x, e.y);
      this.callout({ text: 'Skill shot!', sub: '+25,000', tone: 'big', speaker: 'pip' });
      this.hooks.onSound?.('skill');
    }
  }

  // ------------------------------------------------------------------ missions + lamps

  refreshLamps() {
    const r = this.runner;
    // reset all lamps the mission system controls
    for (const m of this.rt.order) {
      if (m.kind === 'insert') m.lamp = 'off';
    }
    const useful = new Set(r.usefulShots());
    for (const s of this.def.shots) {
      if (!s.insert) continue;
      const ins = this.rt.find(s.insert);
      if (ins) ins.lamp = useful.has(s.id) ? 'flash' : 'off';
    }
    const plan = r.lampPlan();
    for (const id of plan.on) {
      const m = this.rt.find(id);
      if (m) m.lamp = 'on';
    }
    for (const id of plan.flash) {
      const m = this.rt.find(id);
      if (m) m.lamp = 'flash';
    }
    // pocket insert when a discovery is ready
    const st = r.stage;
    if (st?.kind === 'discover') {
      for (const s of this.def.shots) {
        if (s.insert && s.on.some((m) => m.id === st.pocket || (Array.isArray(m.id) && m.id.includes(st.pocket)))) {
          const ins = this.rt.find(s.insert);
          if (ins) ins.lamp = 'flash';
        }
      }
    }
  }

  /** Mechanism ids currently flashing (for the shot preview and Pip). */
  nextUsefulTargets(): Mechanism[] {
    return this.rt.order.filter((m) => m.lamp === 'flash' && m.kind !== 'kickback');
  }

  private missionEvent(e: TableEvent) {
    const notes = this.runner.handle(e);
    for (const n of notes) {
      if (n.kind === 'progress') {
        this.add(SCORES.missionProgress, e.x, e.y);
        const p = n.progress;
        this.hooks.onSound?.('progress', p.done);
        if (p.need > 1) this.callout({ text: `${p.done} / ${p.need}`, sub: (n.stage as { text: string }).text, tone: 'info', seconds: 1.4 });
        this.energy = 1;
      } else if (n.kind === 'stageComplete') {
        this.hooks.onSound?.('stage');
      } else if (n.kind === 'discoverReady') {
        this.callout({ text: 'Wonder Pocket lit!', sub: (n.stage as { text: string }).text, tone: 'good', speaker: 'pip', seconds: 2.6 });
        this.hooks.onSound?.('pocketLit');
      }
    }
    if (notes.length) this.refreshLamps();
  }

  private onSaucer(e: TableEvent) {
    const st = this.runner.stage;
    const saucer = this.rt.find<Saucer>(e.id);
    if (!saucer) return;
    if (st?.kind === 'discover' && st.pocket === e.id && !this.pendingDiscover) {
      saucer.hold();
      this.pendingDiscover = { saucer, stage: st };
      this.beginDiscovery();
    }
  }

  private async beginDiscovery() {
    const pd = this.pendingDiscover;
    if (!pd) return;
    const slot = this.runner.slot;
    const isFinale = slot === 3;
    const mission = this.runner.mission;
    const count = this.opts.triviaLevel === 0 ? 0 : Math.max(1, (pd.stage.questions ?? 1) + (this.opts.triviaLevel === 2 ? 1 : 0));
    this.releaseInputs();
    this.go('parked');
    this.hooks.onSound?.('park');
    let outcomes: QuestionOutcome[] = [];
    if (count > 0) {
      const objectiveIds = pd.stage.objectiveIds ?? mission?.objectiveIds ?? this.def.missions.flatMap((m) => m.objectiveIds);
      try {
        outcomes = await this.hooks.askQuestions({
          lessonId: this.def.lessonId,
          missionTitle: this.runner.title,
          kind: isFinale ? 'finale' : mission?.kind ?? 'apply',
          objectiveIds,
          count,
          preferTypes: pd.stage.types,
          context: isFinale ? 'finale' : 'mission',
        });
      } catch (err) {
        this.hooks.onError?.(`Question panel failed: ${(err as Error).message}`);
      }
    }
    // The session may have been torn down while the panel was open.
    if (this.state !== 'parked' && this.state !== 'paused') return;
    if (this.state === 'paused') this.pausedFrom = 'parked';
    const correct = outcomes.filter((o) => o.correct).length;
    if (correct > 0) {
      this.add(SCORES.brightIdea * correct, pd.saucer.x, pd.saucer.y);
      const kb = this.rt.order.find((m) => m.kind === 'kickback' && m.lamp === 'off') as Kickback | undefined;
      if (kb) kb.lamp = 'on';
      this.ballSaveUntil = Math.max(this.ballSaveUntil, this.rt.time + 8);
    }
    const result = this.runner.completeDiscover();
    this.pendingDiscover = null;
    if (result === 'mission' && mission) {
      const idx = this.def.missions.indexOf(mission) as 0 | 1 | 2;
      this.add(SCORES.missionComplete, pd.saucer.x, pd.saucer.y);
      this.hooks.onMissionComplete?.(idx, mission);
      this.celebrate(4, { text: mission.title + ' complete!', sub: mission.discovery, tone: 'big', speaker: 'angela', seconds: 5 });
      this.applyReward(mission.reward);
    } else if (result === 'finale') {
      this.add(SCORES.finale, pd.saucer.x, pd.saucer.y);
      this.hooks.onWonderlight?.();
      this.celebrate(6, { text: 'Wonderlight restored!', sub: this.def.finale.celebration, tone: 'big', speaker: 'angela', seconds: 6.5 });
    } else {
      this.resumeFromPocket(pd.saucer);
    }
    this.phrase = 0;
    this.hooks.onSound?.('resolve');
    this.refreshLamps();
    // Release the pocket ball once play resumes.
    this.pocketToRelease = pd.saucer;
  }

  private pocketToRelease: Saucer | null = null;

  private resumeFromPocket(saucer: Saucer) {
    this.go('play');
    saucer.eject(0.8);
    for (const b of this.rt.world.balls) b.saveUntil = Math.max(b.saveUntil, this.rt.time + 4);
    if (this.rt.world.balls.some((b) => b.state === 'live')) this.countdown = 3;
  }

  private celebrate(seconds: number, c: Callout) {
    this.celebrateUntil = this.rt.time + seconds;
    this.celebrateNext = 'play';
    this.celebrateProgress = 0;
    this.go('celebrate');
    this.callout(c);
    this.hooks.onSound?.('celebrate');
  }

  private applyReward(r: MissionDef['reward']) {
    switch (r) {
      case 'kickback':
        for (const m of this.rt.order) if (m.kind === 'kickback') m.lamp = 'on';
        this.callout({ text: 'Kickbacks lit', tone: 'save', speaker: 'pip' });
        break;
      case 'ballsave':
        this.ballSaveUntil = Math.max(this.ballSaveUntil, this.rt.time + 20);
        break;
      case 'multiball':
        this.pendingMultiball = 1;
        break;
      case 'jackpot':
        this.add(SCORES.jackpot);
        break;
      case 'none':
        break;
    }
  }

  private pendingMultiball = 0;

  // ------------------------------------------------------------------ main step

  /** Advance one fixed step (call at 120 Hz). */
  fixedStep() {
    const dt = STEP;
    if (this.state === 'paused' || this.state === 'gameover' || this.state === 'parked') return;
    if (this.countdown > 0) {
      this.countdown = Math.max(0, this.countdown - dt);
      return;
    }
    if (this.state === 'celebrate') {
      // Celebration animates scenery while every ball is safely held still.
      this.celebrateProgress = 1 - Math.max(0, this.celebrateUntil - this.rt.time) / 5;
      this.rt.world.time += dt;
      this.sceneryLevel += (this.runner.level - this.sceneryLevel) * Math.min(1, dt * 1.2);
      if (this.rt.time >= this.celebrateUntil) {
        this.sceneryLevel = this.runner.level;
        this.go(this.celebrateNext);
        if (this.pocketToRelease) {
          this.pocketToRelease.eject(0.6);
          this.pocketToRelease = null;
        }
        for (const b of this.rt.world.balls) b.saveUntil = Math.max(b.saveUntil, this.rt.time + 4);
        if (this.rt.world.balls.some((b) => b.state === 'live')) this.countdown = 2;
        if (this.pendingMultiball) {
          this.startMultiball(this.pendingMultiball);
          this.pendingMultiball = 0;
        }
      }
      return;
    }
    if (this.state === 'drained') {
      this.rt.world.time += dt;
      if (this.rt.time - this.drainedAt > 1.8) this.afterDrainPause();
      return;
    }

    if (this.opts.autoFlip) this.autoFlip();
    this.rt.step(dt);
    this.energy = Math.max(0, this.energy - dt * 0.6);
    this.tiltMeter = Math.max(0, this.tiltMeter - dt * 0.12);
    if (this.rt.time > this.comboUntil) this.combo = 0;
    if (this.skillShotUntil && this.rt.time > this.skillShotUntil && this.def.skillShot) {
      this.skillShotUntil = 0;
      const m = this.rt.find(this.def.skillShot);
      if (m && m.lamp === 'flash') m.lamp = 'off';
      this.refreshLamps();
    }

    for (const e of this.rt.drainEvents()) {
      if (e.type === 'drain') {
        if (e.ball && this.state === 'play') this.handleDrain(e.ball);
        continue;
      }
      this.scoreEvent(e);
      this.missionEvent(e);
      this.hooks.onEvent?.(e);
      if (e.type === 'saucer') this.onSaucer(e);
      if ((this.state as GameState) === 'parked') break;
    }
    this.serveQueued(dt);
    this.watchBalls();
  }

  private serveQueued(dt: number) {
    this.serveCooldown = Math.max(0, this.serveCooldown - dt);
    if (!this.serveQueue.length || this.serveCooldown > 0 || this.shooterOccupied()) return;
    const s = this.serveQueue.shift()!;
    const b = this.serveBall();
    this.serveCooldown = 0.9;
    // Auto-plunge after the ball settles on the plunger.
    const t0 = this.rt.time;
    this.pendingAutoPlunges.push({ at: t0 + 0.45, ball: b, strength: s.strength });
  }

  private pendingAutoPlunges: { at: number; ball: Ball; strength: number }[] = [];

  private watchBalls() {
    const t = this.rt.time;
    for (let i = this.pendingAutoPlunges.length - 1; i >= 0; i--) {
      const p = this.pendingAutoPlunges[i];
      if (t < p.at) continue;
      this.pendingAutoPlunges.splice(i, 1);
      if (p.ball.state !== 'shooter') continue;
      const launched = this.rt.plunger?.launch(p.strength);
      if (launched) {
        this.rt.plunger!.fire = 1;
        launched.state = 'live';
        launched.saveUntil = t + 6;
        this.hooks.onSound?.('launch', p.strength);
      } else {
        this.pendingAutoPlunges.push({ at: t + 0.3, ball: p.ball, strength: p.strength });
      }
    }
    if (this.state === 'play' && this.rt.world.balls.length === 0 && this.serveQueue.length === 0) {
      // Defensive: nothing left anywhere (should be handled by drain), end the ball.
      this.endOfBall();
      return;
    }
    const bnd = this.rt.bounds;
    for (const b of this.rt.world.balls) {
      if (b.state === 'held' || b.state === 'transit' || b.state === 'drained') continue;
      if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy) ||
        b.x < bnd.x0 || b.x > bnd.x1 || b.y < bnd.y0 || b.y > bnd.y1) {
        this.hooks.onError?.(`Ball escaped or became invalid at (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) state ${b.state} L${b.layer}; trail ${b.trail.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ')}; balls ${this.rt.world.balls.map((o) => `${o.id}:${o.state}@${o.x.toFixed(0)},${o.y.toFixed(0)}`).join(' ')}; rescued.`);
        this.rescue(b);
        continue;
      }
      // A ball on the ramp layer must stay inside a ramp corridor; if it ever leaves one it
      // drops back to the playfield (as a real ball flying off a ramp would).
      if (b.layer === 1) {
        const ramp = b.rampId ? this.rt.find<Ramp>(b.rampId) : undefined;
        if (!(ramp instanceof Ramp) || ramp.distanceTo(b.x, b.y) > ramp.width / 2 + 8) {
          b.layer = 0;
          b.rampId = null;
          b.touching.clear();
          const solid = this.rt.world.colliders.some((c) => !c.sensor && c.enabled && c.layer === 0 && !c.oneWay && shapeDistance(c.shape, b.x, b.y) < b.r);
          if (solid) {
            this.hooks.onError?.(`Ball left ramp ${ramp?.id ?? '?'} over a wall at (${b.x.toFixed(0)},${b.y.toFixed(0)}); rescued.`);
            this.rescue(b);
            continue;
          }
        }
      }
      // A weak plunge that falls back onto the plunger becomes launchable again.
      if (b.state === 'live' && b.speed < 40 && this.rt.plunger?.ballOnTip() === b) {
        b.state = 'shooter';
      }
      // Trail
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 10) b.trail.shift();
      // Stuck detection (ignores the shooter lane, holders and legitimate cradles).
      // Narrow window: still for 3.5 s -> gentle nudge. Wide window: confined to a small
      // region with no scoring for 10 s -> clearly signposted rescue to the launch lane.
      if (b.state === 'shooter' || this.isCradled(b)) {
        b.anchorX = b.wideX = b.x;
        b.anchorY = b.wideY = b.y;
        b.anchorTime = b.wideTime = t;
        b.stuckStage = 0;
        continue;
      }
      if (Math.hypot(b.x - b.wideX, b.y - b.wideY) > 110 || this.lastScoreBall.get(b.id)! > b.wideTime) {
        b.wideX = b.x;
        b.wideY = b.y;
        b.wideTime = t;
        b.stuckStage = 0;
      }
      if (Math.hypot(b.x - b.anchorX, b.y - b.anchorY) > 14) {
        b.anchorX = b.x;
        b.anchorY = b.y;
        b.anchorTime = t;
      }
      if (t - b.anchorTime > 3.5 && b.stuckStage === 0) {
        b.stuckStage = 1;
        b.anchorTime = t;
        b.vy -= 520;
        b.vx += (b.x < 286 ? 1 : -1) * 260;
        this.callout({ text: 'Pip nudges the Wonderball', tone: 'info', speaker: 'pip', seconds: 1.5 });
      } else if (t - b.wideTime > 10) {
        this.rescue(b);
        this.callout({ text: 'Pip rescued a stuck Wonderball!', sub: 'It returns to the launch lane', tone: 'save', speaker: 'pip' });
      }
    }
  }

  /** True when a ball rests against a raised, held flipper (a legitimate cradle). */
  isCradled(b: Ball): boolean {
    if (b.speed > 60) return false;
    for (const f of this.rt.flippers) {
      if (!f.isRaisedAndHeld || f.layer !== b.layer) continue;
      const dx = f.tx - f.px;
      const dy = f.ty - f.py;
      let u = ((b.x - f.px) * dx + (b.y - f.py) * dy) / (dx * dx + dy * dy);
      u = Math.max(0, Math.min(1, u));
      const d = Math.hypot(b.x - (f.px + dx * u), b.y - (f.py + dy * u));
      if (d < f.r0 * f.widthScale + BALL_R + 4) return true;
    }
    return false;
  }

  /** Clearly signposted rescue: the ball returns to the launch lane and is re-served. */
  private rescue(b: Ball) {
    this.hooks.onRescue?.(b.x, b.y);
    b.state = 'drained';
    this.rt.world.removeBall(b);
    this.serveQueue.push({ strength: 0.75, save: 4 });
  }

  // ------------------------------------------------------------------ auto-flip assistance

  private autoFlip() {
    for (const f of this.rt.flippers) {
      let want = false;
      for (const b of this.rt.world.balls) {
        if (b.state !== 'live' || b.layer !== f.layer) continue;
        const dx = b.x - f.px;
        const dy = b.y - f.py;
        const along = (dx * Math.cos(f.rest) + dy * Math.sin(f.rest)) / f.length;
        const dist = Math.hypot(dx, dy);
        if (dist < f.length + 26 && along > 0.25 && b.vy > -50 && b.y < f.py + 60) want = true;
      }
      f.pressed = want && !this.tilted;
    }
  }

  /** Public view for HUD/missions. */
  missionView() {
    const r = this.runner;
    return {
      slot: r.slot,
      title: r.title,
      brief: r.brief,
      stage: r.stage,
      progress: r.progress(),
      completed: [...r.completed],
      finaleDone: r.finaleDone,
      encore: r.encore,
    };
  }

  /** For tests: whether a shot id is satisfied by an event. */
  shotFor(e: TableEvent): string[] {
    return this.def.shots.filter((s) => shotMade(s, e)).map((s) => s.id);
  }
}
