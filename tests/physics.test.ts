import { describe, expect, it } from 'vitest';
import { TableRuntime } from '../src/game/table/runtime.ts';
import { TableBuilder } from '../src/game/table/builder.ts';
import { MAX_SPEED } from '../src/game/physics/types.ts';
import { shapeDistance } from '../src/game/physics/world.ts';

function frame() {
  const rt = new TableRuntime();
  const b = new TableBuilder(rt);
  b.standardFrame();
  return { rt, b };
}

describe('collision robustness', () => {
  it('never tunnels through a thin wall at maximum speed, whatever the step phase or angle', () => {
    for (let k = 0; k < 32; k++) {
      for (const angleDeg of [90, 70, 110, 55]) {
        const { rt, b } = frame();
        b.wall([[60, 400], [500, 400]], { r: 1 });
        rt.world.finalize();
        rt.world.gravity = 0;
        rt.world.damping = 0;
        const a = (angleDeg * Math.PI) / 180;
        const ball = rt.world.addBall(280 - Math.cos(a) * 120, 250 + k);
        ball.vx = Math.cos(a) * MAX_SPEED;
        ball.vy = Math.sin(a) * MAX_SPEED;
        for (let i = 0; i < 20; i++) rt.step(1 / 120);
        expect(ball.y, `phase ${k} angle ${angleDeg}`).toBeLessThan(400);
      }
    }
  });

  it('keeps balls out of wall cores during long random motion', () => {
    const { rt, b } = frame();
    b.bumper('b1', 286, 300);
    b.bumper('b2', 230, 380);
    rt.world.finalize();
    const ball = rt.world.addBall(300, 200);
    ball.vx = 1500;
    ball.vy = -900;
    const solids = rt.world.colliders.filter((c) => !c.sensor && !c.oneWay);
    for (let i = 0; i < 120 * 20; i++) {
      rt.step(1 / 120);
      if (i % 4) continue;
      for (const c of solids) expect(shapeDistance(c.shape, ball.x, ball.y)).toBeGreaterThan(-1);
      if (ball.y > 1100) break;
    }
  });
});

describe('flippers', () => {
  function flipFrom(x: number) {
    const { rt } = frame();
    rt.world.finalize();
    const f = rt.flippers.find((ff) => ff.spec.side === 'left')!;
    // Place a ball resting on the flipper at fraction x of its length.
    const px = f.px + Math.cos(f.rest) * f.length * x;
    const py = f.py + Math.sin(f.rest) * f.length * x - (f.r0 + 12 + 0.5);
    const ball = rt.world.addBall(px, py);
    f.pressed = true;
    let max = 0;
    for (let i = 0; i < 30; i++) {
      rt.step(1 / 120);
      max = Math.max(max, Math.hypot(ball.vx, ball.vy));
    }
    return max;
  }

  it('tip contact launches faster than base contact (momentum transfer)', () => {
    expect(flipFrom(0.85)).toBeGreaterThan(flipFrom(0.25) * 1.4);
  });

  it('a held flipper cradles a ball rolling down the inlane', () => {
    const { rt } = frame();
    rt.world.finalize();
    const f = rt.flippers.find((ff) => ff.spec.side === 'left')!;
    f.pressed = true;
    const ball = rt.world.addBall(83, 840);
    for (let i = 0; i < 360; i++) rt.step(1 / 120);
    expect(Math.hypot(ball.vx, ball.vy)).toBeLessThan(30);
    expect(Math.hypot(ball.x - f.px, ball.y - f.py)).toBeLessThan(40);
  });

  it('flippers move independently and return when released', () => {
    const { rt } = frame();
    rt.world.finalize();
    const [l, r] = rt.flippers;
    l.pressed = true;
    for (let i = 0; i < 12; i++) rt.step(1 / 120);
    expect(l.raise).toBeGreaterThan(0.95);
    expect(r.raise).toBeLessThan(0.01);
    l.pressed = false;
    for (let i = 0; i < 24; i++) rt.step(1 / 120);
    expect(l.raise).toBeLessThan(0.05);
  });
});

describe('scoring contacts are debounced', () => {
  it('a ball wedged against a bumper cannot farm points', () => {
    const { rt, b } = frame();
    b.bumper('bump', 300, 400, { r: 24 });
    b.wall([[250, 440], [350, 440]], { r: 2 }); // a lid so close the ball keeps re-touching
    b.wall([[250, 440], [250, 380]], { r: 2 });
    b.wall([[350, 440], [350, 380]], { r: 2 });
    rt.world.finalize();
    rt.world.gravity = 2500;
    rt.world.addBall(300, 430);
    let hits = 0;
    for (let i = 0; i < 120; i++) {
      rt.step(1 / 120);
      hits += rt.drainEvents().filter((e) => e.type === 'bumper').length;
    }
    // One simulated second: the 0.09 s cooldown allows at most ~11 scoring kicks.
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThanOrEqual(12);
  });

  it('a ball jittering across a rollover edge scores at most once per cooldown', () => {
    const { rt, b } = frame();
    b.rollover('ro', 300, 500);
    rt.world.finalize();
    rt.world.gravity = 0;
    const ball = rt.world.addBall(300, 488);
    let n = 0;
    for (let i = 0; i < 120; i++) {
      // Wobble the centre in and out of the 13-unit switch radius every few frames.
      ball.y = 500 + (Math.floor(i / 3) % 2 ? 10 : 16);
      ball.vx = 0;
      ball.vy = 0;
      rt.step(1 / 120);
      n += rt.drainEvents().filter((e) => e.type === 'rollover').length;
    }
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(4);
  });
});
