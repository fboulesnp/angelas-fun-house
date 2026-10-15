// Run table-check on every table module in parallel batches and summarize.
// node scripts/check-all-tables.ts [--minutes 20] [--seeds 3]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tableIds } from './lib/load-table.ts';

const run = promisify(execFile);
const args = process.argv.slice(2);
const ids = tableIds();
const results: { id: string; pass: boolean; out: string }[] = [];
const queue = [...ids];
const workers = Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const id = queue.shift()!;
    try {
      const { stdout } = await run('node', ['scripts/table-check.ts', id, ...args], { maxBuffer: 1 << 24 });
      results.push({ id, pass: true, out: stdout });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      results.push({ id, pass: false, out: (err.stdout ?? '') + (err.stderr ?? '') });
    }
  }
});
await Promise.all(workers);
results.sort((a, b) => a.id.localeCompare(b.id));
for (const r of results) {
  const first = r.out.split('\n')[0];
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${first}`);
  if (!r.pass) console.log(r.out.split('\n').filter((l) => l.includes('ERROR')).slice(0, 6).map((l) => '   ' + l.trim()).join('\n'));
}
const missing = 29 - ids.length;
console.log(`\n${results.filter((r) => r.pass).length}/${ids.length} tables pass${missing ? `; ${missing} lessons have no table yet` : ''}`);
process.exit(results.every((r) => r.pass) && !missing ? 0 : 1);
