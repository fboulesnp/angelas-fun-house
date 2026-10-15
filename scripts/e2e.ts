// Keyboard-only end-to-end checks in system Chrome against a running server.
// node scripts/e2e.ts   (AFH_URL defaults to http://localhost:5199)
import { chromium, type Page } from 'playwright-core';

const base = process.env.AFH_URL ?? 'http://localhost:5199';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

async function tabTo(p: Page, text: string, max = 40) {
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab');
    const label = await p.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return (el?.innerText || el?.getAttribute('aria-label') || '').trim();
    });
    if (label.includes(text)) return true;
  }
  return false;
}

const session = () => page.evaluate(() => {
  const s = (window as unknown as { __afh?: { session(): { state: string; score: number; rt: { world: { balls: { state: string }[] } } } | null } }).__afh?.session();
  return s ? { state: s.state, score: s.score, balls: s.rt.world.balls.map((b) => b.state) } : null;
});

// 1. Title -> Choose a Chapter by keyboard
await page.goto(base + '/?test', { waitUntil: 'networkidle' });
check('title menu reachable by Tab', await tabTo(page, 'Choose a Chapter'));
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
check('chapter list shows 29 rooms', (await page.locator('.room').count()) === 29);
check('room 1 reachable by Tab', await tabTo(page, 'Neon Atom Midway'));
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
const focusText = await page.evaluate(() => (document.activeElement as HTMLElement)?.innerText ?? '');
check('intro card focuses the enter button', /Enter the attraction/.test(focusText), focusText);
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
let s = await session();
check('game starts in ready state with a ball in the lane', s?.state === 'ready' && s.balls.includes('shooter'), JSON.stringify(s));

// 2. Launch with Space, flip, pause/resume
await page.keyboard.down('Space');
await page.waitForTimeout(700);
await page.keyboard.up('Space');
await page.waitForTimeout(400);
s = await session();
check('Space launches the ball', s?.state === 'play' && s.balls.includes('live'), JSON.stringify(s));
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(150);
const raised = await page.evaluate(() => (window as unknown as { __afh: { session(): { rt: { flippers: { raise: number }[] } } } }).__afh.session().rt.flippers[0].raise);
await page.keyboard.up('ArrowLeft');
check('left arrow raises the left flipper', raised > 0.9, String(raised));
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
s = await session();
check('P pauses', s?.state === 'paused' && (await page.getByRole('dialog', { name: 'Paused' }).count()) === 1);
const tA = await page.evaluate(() => (window as unknown as { __afh: { session(): { rt: { time: number } } } }).__afh.session().rt.time);
await page.waitForTimeout(500);
const tB = await page.evaluate(() => (window as unknown as { __afh: { session(): { rt: { time: number } } } }).__afh.session().rt.time);
check('physics frozen while paused', tA === tB);
await page.keyboard.press('KeyP');
await page.waitForTimeout(300);
s = await session();
check('P resumes (with countdown)', s?.state === 'play');

// 3. Blur releases inputs and pauses safely
await page.keyboard.down('ArrowRight');
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
await page.waitForTimeout(100);
const rightPressed = await page.evaluate(() => (window as unknown as { __afh: { session(): { rt: { flippers: { pressed: boolean }[] } } } }).__afh.session().rt.flippers[1].pressed);
await page.keyboard.up('ArrowRight');
check('window blur releases held flippers', rightPressed === false);

// 4. Escape opens pause; exit to mansion by keyboard
const before = await session();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const after = await session();
check('Escape pauses', after?.state === 'paused', `before ${JSON.stringify(before)} after ${JSON.stringify(after)} focus ${await page.evaluate(() => document.activeElement?.className)}`);
check('exit button reachable', await tabTo(page, 'Exit to the mansion', 12));
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
check('back at the mansion', (await page.locator('.room').count()) === 29);

// 5. Science Explorer question by keyboard
await page.goto(base + '/', { waitUntil: 'networkidle' });
check('explorer reachable', await tabTo(page, 'Science Explorer'));
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
check('lesson 1 reachable', await tabTo(page, 'Atoms and Elements'));
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
check('check-understanding reachable', await tabTo(page, 'Check my understanding', 60));
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const dialogOpen = (await page.getByRole('dialog').count()) === 1;
check('question dialog opens with focus on the prompt', dialogOpen && (await page.evaluate(() => document.activeElement?.id)) === 'q-title');
// Answer whatever control type appears using only the keyboard.
let answered = false;
for (let i = 0; i < 25 && !answered; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement | null;
    return { tag: el?.tagName, type: el?.type, text: el?.innerText ?? '', role: el?.getAttribute('role'), disabled: (el as HTMLButtonElement | null)?.disabled };
  });
  if (info.tag === 'INPUT' && (info.type === 'radio' || info.type === 'checkbox')) await page.keyboard.press('Space');
  if (info.role === 'radio') await page.keyboard.press('Enter');
  if (info.tag === 'SELECT') {
    await page.keyboard.press('ArrowDown');
  }
  if (info.tag === 'INPUT' && info.type === 'text') await page.keyboard.type('1');
  if (info.text.includes('Check answer') && !info.disabled) {
    await page.keyboard.press('Enter');
    answered = true;
  }
}
await page.waitForTimeout(400);
const fb = await page.locator('.feedback').count();
check('a question can be answered with the keyboard and shows feedback', answered && fb === 1);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${failures ? failures + ' FAILED' : 'ALL PASSED'}`);
await browser.close();
process.exit(failures ? 1 : 0);
