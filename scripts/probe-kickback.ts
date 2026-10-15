// Probe: does an armed kickback return a ball that drops down the outlane to the playfield?
// node scripts/probe-kickback.ts L01 [left|right]
import { loadTable } from './lib/load-table.ts';
import { GameSession } from '../src/game/rules/session.ts';
const id = process.argv[2] ?? 'L01';
const def = (await loadTable(id))!;
const side = (process.argv[3] ?? 'left') as 'left' | 'right';
let saved = 0, trials = 0;
for (const vx0 of [-120, -40, 0, 40, 120]) {
  for (const vy0 of [200, 600, 1000]) {
    const evs: string[] = [];
    const s = new GameSession(def, { mode: 'chapter', practice: true, balls: 3, ballSaveSeconds: 0, triviaLevel: 0, nudgeEnabled: false, autoFlip: false, flipperWidth: 1, completedMissions: [], finaleDone: false }, { askQuestions: async () => [], onEvent: (e) => { if (e.type !== 'wall') evs.push(`${e.type}:${e.id}`); } });
    const kb = s.rt.find(`${side}_kickback`);
    if (!kb) { console.log('no kickback on', side); process.exit(0); }
    kb.lamp = 'on';
    for (const b of [...s.rt.world.balls]) s.rt.world.removeBall(b);
    const x = side === 'left' ? 43 : 529;
    const b = s.rt.world.addBall(x, 800); b.state = 'live'; b.vx = side === 'left' ? vx0 : -vx0; b.vy = vy0;
    let minY = 9999, fired = false, drained = false, backInPlay = false;
    const path: string[] = [];
    for (let i = 0; i < 120 * 4; i++) {
      s.fixedStep();
      if (evs.includes(`kickback:${side}_kickback`)) fired = true;
      if (fired) minY = Math.min(minY, b.y);
      if (fired && b.x > 90 && b.x < 482 && b.y < 960) backInPlay = true;
      if (!s.rt.world.balls.includes(b) || b.y > 1120) { drained = true; break; }
      if (i % 24 === 0) path.push(`${b.x.toFixed(0)},${b.y.toFixed(0)}`);
    }
    trials++;
    const ok = fired && backInPlay;
    if (ok) saved++;
    console.log(`v=(${vx0},${vy0}) fired=${fired} backInPlay=${backInPlay} minY=${minY.toFixed(0)} drained=${drained} | ${path.slice(0, 14).join(' ')}`);
  }
}
console.log(`${id} ${side}: ${saved}/${trials} kickbacks returned the ball to the playfield`);
