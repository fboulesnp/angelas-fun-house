// Soak/bot test: node scripts/soak.ts L01 [seconds] [seed]
import { loadTable } from './lib/load-table.ts';
import { runBot } from '../src/game/sim/bot.ts';
import type { LessonId } from '../src/content/curriculum.ts';
const ids = (process.argv[2] ?? 'L01').split(',') as LessonId[];
const seconds = Number(process.argv[3] ?? 600);
const seed = Number(process.argv[4] ?? 1);
for (const id of ids) {
  const def = await loadTable(id);
  if (!def) { console.log(id, 'missing'); continue; }
  const t0 = performance.now();
  const r = await runBot(def, { seconds, seed });
  const ms = performance.now() - t0;
  const ev = Object.entries(r.events).filter(([k]) => k.includes(':')).sort().map(([k, v]) => `${k}=${v}`).join('  ');
  console.log(`${id}: ${seconds}s sim in ${(ms/1000).toFixed(1)}s | drains ${r.drains} saves ${r.saves} rescues ${r.rescues} nudges ${r.nudges} | missions ${r.missionsCompleted} finale ${r.finale} q ${r.questionsAsked} | maxSpeed ${r.maxSpeed.toFixed(0)} insideWall ${r.insideWallSamples} errors ${r.errors.length}`);
  console.log('  shots:', JSON.stringify(r.shots));
  console.log('  events:', ev);
  if (r.errors.length) console.log('  errors:', r.errors.slice(0, 5));
  if (r.insideDetails.length) console.log('  inside:', r.insideDetails.join('\n          '));
}
