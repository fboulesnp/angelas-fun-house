// Accessibility audit with axe-core in system Chrome. node scripts/a11y.ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium, type Page } from 'playwright-core';

const require = createRequire(import.meta.url);
const axeSrc = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const base = process.env.AFH_URL ?? 'http://localhost:5199';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

async function audit(name: string, setup: (p: Page) => Promise<void>) {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await setup(page);
  await page.waitForTimeout(800);
  await page.addScriptTag({ content: axeSrc });
  const res = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run(o?: object): Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[]; help: string }[] }> } }).axe.run({ resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }));
  });
  console.log(`\n${name}: ${res.length ? res.length + ' violation types' : 'no violations'}`);
  for (const v of res) console.log(`  [${v.impact}] ${v.id} x${v.n}: ${v.help} -> ${v.sample.join(' | ')}`);
  return res.length;
}

let total = 0;
total += await audit('Title', async () => {});
total += await audit('Mansion list view', async (p) => { await p.getByText('Choose a Chapter').click(); });
total += await audit('Settings', async (p) => { await p.getByText('Settings', { exact: true }).click(); });
total += await audit('Science Explorer index', async (p) => { await p.getByText('Science Explorer').click(); });
total += await audit('Science Explorer lesson', async (p) => { await p.getByText('Science Explorer').click(); await p.getByText('Atoms and Elements').first().click(); await p.waitForTimeout(800); });
total += await audit('Explorer question panel', async (p) => { await p.getByText('Science Explorer').click(); await p.getByText('Atoms and Elements').first().click(); await p.waitForTimeout(800); await p.getByText('Check my understanding').first().click(); });
total += await audit('Journal', async (p) => { await p.getByText('Journal', { exact: true }).click(); });
total += await audit('Game intro card', async (p) => { await p.goto(base + '/?table=L01', { waitUntil: 'networkidle' }); await p.waitForTimeout(800); });
console.log(`\nTotal violation types: ${total}`);
await browser.close();
process.exit(total ? 1 : 0);
