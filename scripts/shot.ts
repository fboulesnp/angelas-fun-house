// Full-resolution screenshots with the system Chrome (headless).
// node scripts/shot.ts <url-path> <out.png> [width] [height] [waitSec] [script]
// script: comma list of actions: "space:600" (hold ms), "left:200", "right:200", "wait:1000", "mobile"
import { chromium } from 'playwright-core';

const [path = '/?table=L01&autostart&test', out = 'screenshots/tmp/shot.png', w = '1600', h = '1000', waitSec = '4', script = ''] = process.argv.slice(2);
const base = process.env.AFH_URL ?? 'http://localhost:5199';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const mobile = script.includes('mobile');
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const logs: string[] = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(base + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(waitSec) * 1000);
for (const step of script.split(',').filter(Boolean)) {
  const [k, v] = step.split(':');
  const ms = Number(v ?? 200);
  if (k === 'wait') await page.waitForTimeout(ms);
  else if (k === 'space') { await page.keyboard.down('Space'); await page.waitForTimeout(ms); await page.keyboard.up('Space'); }
  else if (k === 'left') { await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(ms); await page.keyboard.up('ArrowLeft'); }
  else if (k === 'right') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(ms); await page.keyboard.up('ArrowRight'); }
  else if (k === 'click') { await page.getByText(v, { exact: false }).first().click(); }
  else if (k === 'eval') { await page.evaluate(decodeURIComponent(v)); }
}
await page.screenshot({ path: out });
const fps = await page.evaluate(() => {
  const r = (window as unknown as { __afh?: { renderer(): { stage?: { quality: string } } } }).__afh?.renderer();
  return r?.stage?.quality ?? null;
});
console.log(out, 'quality:', fps);
if (logs.length) console.log(logs.slice(0, 15).join('\n'));
await browser.close();
