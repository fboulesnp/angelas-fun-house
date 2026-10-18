// Probe: does a saucer eject feed straight back into a saucer (an uncontrolled points loop)?
// node scripts/probe-saucer.ts L17 [seconds]
import { loadTable } from './lib/load-table.ts';
import { GameSession } from '../src/game/rules/session.ts';
import type { Saucer } from '../src/game/table/mechanisms.ts';
const id = process.argv[2] ?? 'L17';
const seconds = Number(process.argv[3] ?? 12);
const def = (await loadTable(id))!;
const s = new GameSession(def, { mode: 'chapter', practice: true, balls: 3, ballSaveSeconds: 0, triviaLevel: 0, nudgeEnabled: false, autoFlip: false, flipperWidth: 1, completedMissions: [], finaleDone: false }, { askQuestions: async () => [] });
const saucers = s.rt.order.filter((m) => m.kind === 'saucer') as Saucer[];
for (const sc of saucers) {
  for (const b of [...s.rt.world.balls]) s.rt.world.removeBall(b);
  const counts: Record<string, number> = {};
  const ball = s.rt.world.addBall(sc.x, sc.y);
  ball.state = 'live';
  sc.capture(ball);
  const hook = s.hooks.onEvent;
  s.hooks.onEvent = (e) => { if (e.type === 'saucer') counts[e.id] = (counts[e.id] ?? 0) + 1; hook?.(e); };
  for (let i = 0; i < 120 * seconds; i++) s.fixedStep();
  s.hooks.onEvent = hook;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`${id} ${sc.id} (${sc.role}): ${total} saucer capture(s) in ${seconds} s after one eject, with no flipping -> ${JSON.stringify(counts)}${total >= 3 ? '  <-- LOOP?' : ''}`);
}
