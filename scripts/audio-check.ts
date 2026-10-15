// Verify the audio engine starts after a user gesture, schedules music and plays effects without errors.
import { chromium } from 'playwright-core';
const base = process.env.AFH_URL ?? 'http://localhost:5199';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/?table=L01&test`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.getByText('Enter the attraction').click(); // a real user gesture starts audio
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const a = (window as unknown as { __afh: { audio: { started: boolean; play(n: string, v?: number): void; ctx?: AudioContext } } }).__afh.audio;
  const ctx = (a as unknown as { ctx: AudioContext }).ctx;
  for (const n of ['flipper', 'bumper', 'sling', 'rollover', 'target', 'drop', 'bank', 'spinner', 'saucer', 'rampEnter', 'ramp', 'orbit', 'launch', 'drain', 'phrase', 'resolve', 'progress', 'stage', 'pocketLit', 'park', 'celebrate', 'multiball', 'skill', 'kickback', 'nudge', 'wall', 'portal', 'correct', 'incorrect', 'ui', 'countdown']) a.play(n, 3);
  await new Promise((res) => setTimeout(res, 300));
  return { started: a.started, state: ctx?.state, sampleRate: ctx?.sampleRate, time: ctx?.currentTime };
});
console.log(JSON.stringify(r), errors.length ? 'errors: ' + errors.join(' | ') : 'no errors');
await browser.close();
process.exit(r.started && r.state === 'running' && !errors.length ? 0 : 1);
