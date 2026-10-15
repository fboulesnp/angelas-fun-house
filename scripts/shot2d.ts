// 2D fallback renderer screenshot. node scripts/shot2d.ts [Lnn] [out.png]
import { chromium } from 'playwright-core';
const id = process.argv[2] ?? 'L01';
const out = process.argv[3] ?? `screenshots/tmp/${id.toLowerCase()}-2d.png`;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('angelas-fun-house.save', JSON.stringify({ version: 2, settings: { renderer: '2d' } })));
const page = await ctx.newPage();
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${process.env.AFH_URL ?? 'http://localhost:5199'}/?table=${id}&autostart&test`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.keyboard.down('Space'); await page.waitForTimeout(500); await page.keyboard.up('Space');
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log(await page.evaluate(() => document.querySelector('.game-screen')?.getAttribute('data-renderer')), errs.join(' | ') || 'no errors');
await browser.close();
