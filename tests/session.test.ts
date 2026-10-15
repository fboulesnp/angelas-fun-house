import { describe, expect, it } from 'vitest';
import { GameSession, type SessionOptions } from '../src/game/rules/session.ts';
import { L01 } from '../src/tables/L01.ts';

const OPTS: SessionOptions = {
  mode: 'chapter', practice: false, balls: 3, ballSaveSeconds: 10, triviaLevel: 1, nudgeEnabled: true,
  autoFlip: false, flipperWidth: 1, completedMissions: [], finaleDone: false,
};

function session(over: Partial<SessionOptions> = {}, answer = true) {
  const asked: number[] = [];
  const s = new GameSession(L01, { ...OPTS, ...over }, {
    askQuestions: async (req) => {
      asked.push(req.count);
      return Array.from({ length: req.count }, (_, i) => ({ questionId: `q${i}`, correct: answer, hinted: false }));
    },
  });
  return { s, asked };
}

const step = (s: GameSession, n: number) => {
  for (let i = 0; i < n; i++) s.fixedStep();
};

function launch(s: GameSession) {
  s.plungerPull(true);
  step(s, 60);
  s.plungerPull(false);
  step(s, 2);
}

function drainLive(s: GameSession) {
  const b = s.rt.world.balls.find((x) => x.state === 'live');
  if (!b) return;
  b.x = 286;
  b.y = 1108;
  b.vx = 0;
  b.vy = 400;
  step(s, 4);
}

describe('ball accounting', () => {
  it('a drain during ball save returns the ball instead of costing it', () => {
    const { s } = session();
    launch(s);
    expect(s.state).toBe('play');
    drainLive(s);
    expect(s.ballNumber).toBe(1);
    step(s, 200);
    expect(s.rt.world.balls.length).toBe(1);
  });

  it('after the save expires a drain ends the ball; three balls end the game', () => {
    const { s } = session({ ballSaveSeconds: 0 });
    for (let k = 0; k < 3; k++) {
      launch(s);
      s.ballSaveUntil = 0;
      for (const b of s.rt.world.balls) b.saveUntil = 0;
      drainLive(s);
      expect(['drained', 'gameover']).toContain(s.state);
      step(s, 240);
    }
    expect(s.state).toBe('gameover');
    expect(s.ballNumber).toBe(3);
  });

  it('multiball never produces negative balls or a premature game over', () => {
    const { s } = session({ ballSaveSeconds: 0 });
    launch(s);
    s.startMultiball(2);
    step(s, 600);
    const live = () => s.rt.world.balls.filter((b) => b.state === 'live').length;
    expect(live()).toBeGreaterThanOrEqual(2);
    s.ballSaveUntil = 0;
    for (const b of s.rt.world.balls) b.saveUntil = 0;
    while (live() > 1) {
      drainLive(s);
      expect(s.state).toBe('play');
    }
    expect(s.multiball).toBe(false);
    drainLive(s);
    expect(s.state).toBe('drained');
    expect(s.rt.world.balls.length).toBe(0);
  });

  it('continuing after game over keeps missions and labels the run', () => {
    const { s } = session({ ballSaveSeconds: 0, completedMissions: [true, false, false] });
    for (let k = 0; k < 3; k++) {
      launch(s);
      s.ballSaveUntil = 0;
      for (const b of s.rt.world.balls) b.saveUntil = 0;
      drainLive(s);
      step(s, 240);
    }
    expect(s.state).toBe('gameover');
    s.continueGame(true);
    expect(s.state).toBe('ready');
    expect(s.continued).toBe(true);
    expect(s.run).toBe(2);
    expect(s.runner.completed[0]).toBe(true);
  });
});

describe('pause and question parking', () => {
  it('pause freezes physics, timers and missions', () => {
    const { s } = session();
    launch(s);
    const b = s.rt.world.balls[0];
    const t0 = s.rt.time;
    const y0 = b.y;
    s.pause();
    step(s, 120);
    expect(s.rt.time).toBe(t0);
    expect(b.y).toBe(y0);
    s.resume();
    expect(s.state).toBe('play');
    expect(s.countdown).toBeGreaterThan(0);
  });

  it('discovery parks every ball, asks questions, then resumes with a save', async () => {
    const { s, asked } = session();
    launch(s);
    s.startMultiball(1);
    step(s, 300);
    // Complete mission 1's collect stages with synthetic events.
    for (let i = 0; i < 8; i++) s.rt.emit({ type: 'bumper', id: 'bumper_he', group: 'elements', x: 0, y: 0 });
    s.rt.emit({ type: 'target', id: 'matter_target', group: 'sort', x: 0, y: 0 });
    s.rt.emit({ type: 'target', id: 'nonmatter_target', group: 'sort', x: 0, y: 0 });
    step(s, 1);
    expect(s.runner.stage?.kind).toBe('discover');
    const ball = s.rt.world.balls.find((b) => b.state === 'live')!;
    s.rt.get<import('../src/game/table/mechanisms.ts').Saucer>('microscope').capture(ball);
    step(s, 1);
    expect(s.state).toBe('parked');
    const frozen = s.rt.world.balls.map((b) => [b.x, b.y]);
    step(s, 120);
    expect(s.rt.world.balls.map((b) => [b.x, b.y])).toEqual(frozen);
    await new Promise((r) => setTimeout(r, 0));
    expect(asked).toEqual([1]);
    expect(s.state).toBe('celebrate');
    expect(s.runner.completed[0]).toBe(true);
    step(s, 120 * 6);
    expect(s.state).toBe('play');
    expect(s.rt.world.balls.every((b) => b.saveUntil > s.rt.time - 0.5 || b.state !== 'live')).toBe(true);
  });

  it('wrong answers still complete the mission and never cost balls', async () => {
    const { s } = session({}, false);
    launch(s);
    const ballsBefore = s.ballNumber;
    for (let i = 0; i < 8; i++) s.rt.emit({ type: 'bumper', id: 'bumper_he', group: 'elements', x: 0, y: 0 });
    s.rt.emit({ type: 'target', id: 'matter_target', group: 'sort', x: 0, y: 0 });
    s.rt.emit({ type: 'target', id: 'nonmatter_target', group: 'sort', x: 0, y: 0 });
    step(s, 1);
    s.rt.get<import('../src/game/table/mechanisms.ts').Saucer>('microscope').capture(s.rt.world.balls[0]);
    step(s, 1);
    await new Promise((r) => setTimeout(r, 0));
    expect(s.runner.completed[0]).toBe(true);
    expect(s.ballNumber).toBe(ballsBefore);
  });
});

describe('stuck-ball rescue', () => {
  it('a ball trapped motionless is nudged, then rescued to the launch lane', () => {
    const { s } = session();
    launch(s);
    const b = s.rt.world.balls[0];
    // Pin the ball in mid-air every step (simulating a jam the physics cannot clear).
    let rescued = false;
    for (let i = 0; i < 120 * 14; i++) {
      if (s.rt.world.balls.includes(b)) {
        b.x = 300;
        b.y = 600;
        b.vx = 0;
        b.vy = 0;
      } else rescued = true;
      s.fixedStep();
    }
    expect(rescued).toBe(true);
    expect(s.rt.world.balls.length).toBeGreaterThan(0);
  });
});
