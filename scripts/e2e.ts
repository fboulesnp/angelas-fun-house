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

// 3b. Resizing mid-game re-fits the view without disturbing the simulation
type W = { __afh: { session(): { state: string; rt: { world: { balls: { x: number; y: number }[] } } } } };
const canvasW = () => page.evaluate(() => document.querySelector('.stage canvas')?.clientWidth ?? 0);
const w0 = await canvasW();
await page.setViewportSize({ width: 820, height: 1100 });
await page.waitForTimeout(600);
const w1 = await canvasW();
const sane = await page.evaluate(() => {
  const ss = (window as unknown as W).__afh.session();
  return ss.state !== 'gameover' && ss.rt.world.balls.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y));
});
await page.setViewportSize({ width: 1400, height: 900 });
await page.waitForTimeout(400);
check('resizing mid-game re-fits the view and keeps the simulation sane', w1 !== w0 && w1 > 0 && sane, `${w0} -> ${w1}`);

// 3c. Hiding the tab pauses the game (and the pause card offers settings)
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(250);
s = await session();
await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  document.dispatchEvent(new Event('visibilitychange'));
});
check('hiding the tab pauses the game', s?.state === 'paused', JSON.stringify(s));

// 3d. Changing the camera from Pause keeps the game paused and intact, then resumes
const balls0 = JSON.stringify((await session())?.balls);
await page.locator('.pause-card select').selectOption('overhead');
await page.waitForTimeout(300);
s = await session();
check('changing the camera from Pause keeps the paused game', s?.state === 'paused' && JSON.stringify(s.balls) === balls0);
await page.locator('.pause-card select').selectOption('cabinet');
await page.getByRole('button', { name: 'Resume' }).click();
await page.waitForTimeout(400);
s = await session();
check('Resume returns to play', s?.state === 'play' || s?.state === 'ready', JSON.stringify(s));
await page.locator('.stage').focus();

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
async function answerByKeyboard(p: Page) {
  for (let i = 0; i < 25; i++) {
    await p.keyboard.press('Tab');
    const info = await p.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null;
      return { tag: el?.tagName, type: el?.type, text: el?.innerText ?? '', role: el?.getAttribute('role'), disabled: (el as HTMLButtonElement | null)?.disabled };
    });
    if (info.tag === 'INPUT' && (info.type === 'radio' || info.type === 'checkbox')) await p.keyboard.press('Space');
    if (info.role === 'radio') await p.keyboard.press('Enter');
    if (info.tag === 'SELECT') await p.keyboard.press('ArrowDown');
    if (info.tag === 'INPUT' && info.type === 'text') await p.keyboard.type('1');
    if (info.text.includes('Check answer') && !info.disabled) {
      await p.keyboard.press('Enter');
      return true;
    }
  }
  return false;
}
const answered = await answerByKeyboard(page);
await page.waitForTimeout(400);
const fb = await page.locator('.feedback').count();
check('a question can be answered with the keyboard and shows feedback', answered && fb === 1);

// 6. A Wonder Pocket discovery during play: the ball parks, the question is answered by
// keyboard, the mission completes, and the save survives a reload.
await page.goto(base + '/?table=L01&autostart&test', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!(window as unknown as { __afh?: { session(): unknown } }).__afh?.session(), null, { timeout: 30000 });
await page.waitForTimeout(2600);
await page.locator('.stage').focus();
await page.keyboard.down('Space');
await page.waitForTimeout(500);
await page.keyboard.up('Space');
await page.waitForTimeout(800);
await page.evaluate(() => {
  type S = { rt: { emit(e: object): void; world: { balls: { state: string }[] }; get(id: string): { capture(b: unknown): void } } };
  const ss = (window as unknown as { __afh: { session(): S } }).__afh.session();
  for (let i = 0; i < 8; i++) ss.rt.emit({ type: 'bumper', id: 'bumper_he', group: 'elements', x: 0, y: 0 });
  ss.rt.emit({ type: 'target', id: 'matter_target', group: 'sort', x: 0, y: 0 });
  ss.rt.emit({ type: 'target', id: 'nonmatter_target', group: 'sort', x: 0, y: 0 });
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  type S = { rt: { world: { balls: { state: string }[] }; get(id: string): { capture(b: unknown): void } } };
  const ss = (window as unknown as { __afh: { session(): S } }).__afh.session();
  const ball = ss.rt.world.balls.find((b) => b.state === 'live');
  if (ball) ss.rt.get('microscope').capture(ball);
});
await page.waitForTimeout(1200);
s = await session();
const qOpen = (await page.getByRole('dialog').count()) === 1;
check('Wonder Pocket parks the ball and opens a discovery question', s?.state === 'parked' && qOpen, JSON.stringify(s));
const answeredInGame = await answerByKeyboard(page);
await page.waitForTimeout(400);
let continued = false;
for (let i = 0; i < 12 && !continued; i++) {
  await page.keyboard.press('Tab');
  const t = await page.evaluate(() => (document.activeElement as HTMLElement)?.innerText ?? '');
  if (/^(Continue|Next question)/.test(t.trim())) {
    await page.keyboard.press('Enter');
    continued = true;
  }
}
await page.waitForTimeout(800);
s = await session();
check('answering by keyboard resumes the game', answeredInGame && continued && (s?.state === 'celebrate' || s?.state === 'play'), JSON.stringify(s));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('angelas-fun-house.save') ?? '{}').progress?.L01?.missions?.[0] === true);
check('the completed mission is saved', await saved());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
check('the save survives a reload', await saved());

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${failures ? failures + ' FAILED' : 'ALL PASSED'}`);
await browser.close();
process.exit(failures ? 1 : 0);
