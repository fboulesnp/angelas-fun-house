// Hands-on "first minute" sessions in system Chrome with real keyboard input: launch, flip
// reactively for N seconds, then record what a player would have seen. Writes one entry per
// table into docs/manual-review.json (labelled as an AI-driven browser session, never as a
// human playtest). node scripts/first-minute.ts [L01 L02 ...] [--seconds 75]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { LESSON_BY_ID, type LessonId } from '../src/content/curriculum.ts';
import { tableIds } from './lib/load-table.ts';

const argv = process.argv.slice(2);
const secIdx = argv.indexOf('--seconds');
const seconds = secIdx >= 0 ? Number(argv[secIdx + 1]) : 75;
const ids = (argv.filter((a) => /^L\d\d$/.test(a)).length ? argv.filter((a) => /^L\d\d$/.test(a)) : tableIds()) as LessonId[];
const base = process.env.AFH_URL ?? 'http://localhost:5199';
const out = 'docs/manual-review.json';
const notes: Record<string, string> = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};

type Snap = {
  state: string; score: number; ball: number; slot: number; stage: number; level: number;
  missions: boolean[]; balls: { x: number; y: number; vy: number; state: string }[]; flippers: [number, number];
  events: Record<string, number>; callouts: string[];
};
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

for (const id of ids) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/?table=${id}&autostart&test`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!(window as unknown as { __afh?: { session(): unknown } }).__afh?.session(), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  // Count table events and callouts from inside the page for the whole session.
  await page.evaluate(() => {
    type S = { hooks: { onEvent?: (e: { type: string }) => void; onCallout?: (c: { text: string }) => void } };
    const w = window as unknown as { __afh: { session(): S }; __fm: { events: Record<string, number>; callouts: string[] } };
    w.__fm = { events: {}, callouts: [] };
    const s = w.__afh.session();
    const prevE = s.hooks.onEvent;
    s.hooks.onEvent = (e) => { w.__fm.events[e.type] = (w.__fm.events[e.type] ?? 0) + 1; prevE?.(e); };
    const prevC = s.hooks.onCallout;
    s.hooks.onCallout = (c) => { w.__fm.callouts.push(c.text); prevC?.(c); };
  });
  await page.locator('.stage').focus();
  const snap = (): Promise<Snap> => page.evaluate(() => {
    type S = { state: string; score: number; ballNumber: number; sceneryLevel: number; runner: { slot: number; stageIdx: number; completed: boolean[] }; rt: { world: { balls: { x: number; y: number; vy: number; state: string }[] }; flippers: { raise: number }[] } };
    const w = window as unknown as { __afh: { session(): S }; __fm: { events: Record<string, number>; callouts: string[] } };
    const s = w.__afh.session();
    return { state: s.state, score: s.score, ball: s.ballNumber, slot: s.runner.slot, stage: s.runner.stageIdx, level: s.sceneryLevel, missions: s.runner.completed.slice(0, 3), balls: s.rt.world.balls.map((b) => ({ x: b.x, y: b.y, vy: b.vy, state: b.state })), flippers: [s.rt.flippers[0]?.raise ?? 0, s.rt.flippers[1]?.raise ?? 0], events: w.__fm.events, callouts: w.__fm.callouts };
  });

  // Launch at about three-quarter power, then flip whenever a live ball nears a flipper.
  const press = async (key: string, ms: number) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  await press('Space', 650);
  const t0 = Date.now();
  let launches = 1;
  let questionsSeen = 0;
  let maxScore = 0;
  let drains = 0;
  let lastBall = 1;
  const lastFlip = { left: 0, right: 0 };
  while (Date.now() - t0 < seconds * 1000) {
    const s = await snap();
    maxScore = Math.max(maxScore, s.score);
    if (s.ball !== lastBall) { drains++; lastBall = s.ball; }
    if (s.state === 'parked') {
      // A discovery question: answer it by keyboard like the e2e does, then continue.
      questionsSeen++;
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        const info = await page.evaluate(() => { const el = document.activeElement as HTMLInputElement | null; return { tag: el?.tagName, type: el?.type, text: el?.innerText ?? '', role: el?.getAttribute('role'), disabled: (el as HTMLButtonElement | null)?.disabled }; });
        if (info.tag === 'INPUT' && (info.type === 'radio' || info.type === 'checkbox')) await page.keyboard.press('Space');
        if (info.role === 'radio') await page.keyboard.press('Enter');
        if (info.tag === 'SELECT') await page.keyboard.press('ArrowDown');
        if (info.tag === 'INPUT' && info.type === 'text') await page.keyboard.type('1');
        if (/Check answer/.test(info.text) && !info.disabled) { await page.keyboard.press('Enter'); break; }
      }
      await page.waitForTimeout(500);
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const t = await page.evaluate(() => (document.activeElement as HTMLElement)?.innerText ?? '');
        if (/^(Continue|Next question)/.test(t.trim())) { await page.keyboard.press('Enter'); break; }
      }
      await page.waitForTimeout(800);
      await page.locator('.stage').focus();
      continue;
    }
    if (s.state === 'gameover') break;
    if (s.state === 'ready' || (s.balls.length && s.balls.every((b) => b.state === 'shooter'))) {
      await page.waitForTimeout(400);
      await press('Space', 450 + (launches % 3) * 150);
      launches++;
      continue;
    }
    // Flip like a player: only at a ball falling into the flipper zone, one flip per approach.
    const live = s.balls.filter((b) => b.state === 'live');
    const falling = (b: { y: number; vy: number }) => b.y > 920 && b.y < 1030 && b.vy > 60;
    const now = Date.now();
    const leftSide = live.some((b) => falling(b) && b.x < 300) && now - lastFlip.left > 350;
    const rightSide = live.some((b) => falling(b) && b.x >= 300) && now - lastFlip.right > 350;
    if (leftSide || rightSide) {
      const keys = [leftSide && 'ArrowLeft', rightSide && 'ArrowRight'].filter(Boolean) as string[];
      if (leftSide) lastFlip.left = now;
      if (rightSide) lastFlip.right = now;
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(110);
      for (const k of keys) await page.keyboard.up(k);
    } else {
      await page.waitForTimeout(25);
    }
  }
  const end = await snap();
  await page.screenshot({ path: `screenshots/tmp/${id}-first-minute.png` });
  const l = LESSON_BY_ID[id];
  const ev = Object.entries(end.events).filter(([k]) => !['wall', 'drain'].includes(k)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ');
  const firstCallouts = end.callouts.slice(0, 4).map((c) => `"${c}"`).join(', ');
  const stageText = end.missions.filter(Boolean).length ? `${end.missions.filter(Boolean).length} mission(s) completed` : `reached mission ${end.slot + 1}, stage ${end.stage + 1}`;
  notes[id] = `AI-driven browser session (${seconds} s of real keyboard play in Chrome, ${new Date().toISOString().slice(0, 10)}), not a human playtest. ${l.attractionTitle}: ${launches} launch(es), ${drains} ball(s) lost, score ${maxScore.toLocaleString()}, ${stageText}, ${questionsSeen} question(s) answered; scenery level ${end.level.toFixed(1)}. Contacts: ${ev || 'none'}. First callouts: ${firstCallouts || 'none'}. ${errors.length ? 'PAGE ERRORS: ' + errors.slice(0, 2).join(' | ') : 'No page errors.'}`;
  console.log(`${id}: ${notes[id]}`);
  await ctx.close();
}
writeFileSync(out, JSON.stringify(notes, null, 2) + '\n');
await browser.close();
