import { loadTable } from './lib/load-table.ts';
import { GameSession } from '../src/game/rules/session.ts';
const def = (await loadTable(process.argv[2] ?? 'L01'))!;
const side = (process.argv[3] ?? 'right') as 'left' | 'right';
for (let d = 500; d <= 1000; d += 20) {
  const evs: string[] = [];
  const s = new GameSession(def, { mode: 'chapter', practice: true, balls: 3, ballSaveSeconds: 0, triviaLevel: 0, nudgeEnabled: false, autoFlip: false, flipperWidth: 1, completedMissions: [], finaleDone: false }, { askQuestions: async () => [], onEvent: (e) => { if (e.type !== 'wall') evs.push(`${e.type}:${e.id}`); } });
  for (const b of [...s.rt.world.balls]) s.rt.world.removeBall(b);
  const b = s.rt.world.addBall(side === 'left' ? 83 : 489, 820); b.state = 'live';
  for (let i = 0; i < Math.round(d / 1000 * 120); i++) s.fixedStep();
  const at = `${b.x.toFixed(0)},${b.y.toFixed(0)}`;
  evs.length = 0;
  s.setFlipper(side, true);
  for (let i = 0; i < 12; i++) s.fixedStep();
  s.setFlipper(side, false);
  const path: string[] = [];
  for (let i = 0; i < 160; i++) { s.fixedStep(); if (i % 16 === 0) path.push(`${b.x.toFixed(0)},${b.y.toFixed(0)}`); }
  console.log(`d=${d} at(${at}) path ${path.join(' ')} | ${evs.slice(0, 4).join(' ')}`);
}
