// Screenshot a table at a forced quality tier: node scripts/shotq.ts L01 low out.png
import { chromium } from 'playwright-core';
const [id = 'L01', q = 'low', out = 'screenshots/tmp/q.png'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((qq) => localStorage.setItem('angelas-fun-house.save', JSON.stringify({ version: 2, settings: { quality: qq } })), q);
const page = await ctx.newPage();
await page.goto(`http://localhost:5199/?table=${id}&autostart&test`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
await page.evaluate(() => ((window as unknown as { __afh: { session(): { sceneryLevel: number } } }).__afh.session().sceneryLevel = 4));
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
