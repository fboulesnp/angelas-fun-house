// Frame-time measurement in system Chrome. node scripts/perf.ts [table] [quality...]
import { chromium } from 'playwright-core';
const table = process.argv[2] ?? 'L01';
const qualities = process.argv.slice(3).length ? process.argv.slice(3) : ['ultra', 'high', 'medium', 'low'];
const base = process.env.AFH_URL ?? 'http://localhost:5199';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
for (const q of qualities) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript((qq) => {
    const raw = localStorage.getItem('angelas-fun-house.save');
    const save = raw ? JSON.parse(raw) : { version: 2 };
    save.settings = { ...(save.settings ?? {}), quality: qq, autoFlip: true };
    localStorage.setItem('angelas-fun-house.save', JSON.stringify(save));
  }, q);
  const page = await ctx.newPage();
  await page.goto(`${base}/?table=${table}&autostart&test`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.keyboard.down('Space');
  await page.waitForTimeout(500);
  await page.keyboard.up('Space');
  const r = await page.evaluate(async () => {
    const times: number[] = [];
    let last = performance.now();
    await new Promise<void>((res) => {
      const f = (now: number) => {
        times.push(now - last);
        last = now;
        if (times.length < 400) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const stage = (window as unknown as { __afh: { renderer(): { stage?: { quality: string; renderer: { info: { render: { calls: number; triangles: number } } } } } } }).__afh.renderer().stage;
    return { avgMs: avg, p95: times[Math.floor(times.length * 0.95)], quality: stage?.quality, calls: stage?.renderer.info.render.calls, tris: stage?.renderer.info.render.triangles };
  });
  console.log(`${table} ${q}: avg ${r.avgMs.toFixed(1)} ms (${(1000 / r.avgMs).toFixed(0)} fps), p95 ${r.p95.toFixed(1)} ms, active tier ${r.quality}, draw calls ${r.calls}, triangles ${r.tris}`);
  await ctx.close();
}
await browser.close();
