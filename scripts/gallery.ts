// Capture the handoff screenshot gallery into screenshots/. node scripts/gallery.ts [L05 L07 ...]
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const base = process.env.AFH_URL ?? 'http://localhost:5199';
const tables = process.argv.slice(2).length ? process.argv.slice(2) : ['L01', 'L04', 'L07', 'L13', 'L18', 'L24', 'L29'];
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function ctxPage(w: number, h: number, mobile = false, save?: object) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
  if (save) await ctx.addInitScript((s) => localStorage.setItem('angelas-fun-house.save', JSON.stringify(s)), save);
  return ctx.newPage();
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `screenshots/${name}.png` });
  console.log(`screenshots/${name}.png`);
}
const progressSave = {
  version: 2, introSeen: true,
  wingIntrosSeen: { spark: true, motion: true, planet: true, tomorrow: true },
  progress: Object.fromEntries(Array.from({ length: 29 }, (_, i) => {
    const id = `L${String(i + 1).padStart(2, '0')}`;
    const lit = [1, 2, 3, 4, 6, 9, 10, 13, 16, 18, 21, 25].includes(i + 1);
    return [id, { missions: lit ? [true, true, true] : [i % 3 === 0, false, false], wonderlight: lit, visited: true, plays: 1, badge: lit }];
  })),
};

// Title + map (with some progress so rooms glow)
let p = await ctxPage(1600, 1000, false, progressSave);
await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(3500);
await shot(p, '01-title');
await p.getByText('Story Adventure').click();
await p.waitForTimeout(4000);
await shot(p, '02-mansion-dollhouse-map');
await p.getByText('List view').click();
await p.waitForTimeout(600);
await shot(p, '03-mansion-list-view');
await p.close();

// Tables at dormant and awakened levels
for (const id of tables) {
  for (const lvl of [0, 4]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        p = await ctxPage(1600, 1000);
        await p.goto(`${base}/?table=${id}&autostart&test`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(4200);
        await p.evaluate((l) => ((window as unknown as { __afh: { session(): { sceneryLevel: number } } }).__afh.session().sceneryLevel = l), lvl);
        if (lvl === 4) {
          await p.keyboard.down('Space');
          await p.waitForTimeout(450);
          await p.keyboard.up('Space');
        }
        await p.waitForTimeout(lvl === 4 ? 900 : 600);
        await shot(p, `table-${id}-${lvl === 0 ? 'dormant' : 'awakened'}`);
        await p.close();
        break;
      } catch (e) {
        console.log(`retry ${id} ${lvl}: ${(e as Error).message.split('\n')[0]}`);
        await p.close().catch(() => {});
      }
    }
  }
}

// Question panel (Explorer) + mobile layout + celebration
p = await ctxPage(1400, 1000);
await p.goto(base + '/', { waitUntil: 'networkidle' });
await p.getByText('Science Explorer').click();
await p.getByText('Atoms in Chemical Reactions').first().click();
await p.waitForTimeout(1200);
await p.getByText('Check my understanding').first().click();
await p.waitForTimeout(900);
await shot(p, '04-question-panel');
await p.close();

p = await ctxPage(390, 844, true);
await p.goto(`${base}/?table=L01&autostart&test`, { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);
await shot(p, '05-mobile-portrait');
await p.close();

p = await ctxPage(1600, 1000, false, progressSave);
await p.goto(`${base}/?celebrate=spark`, { waitUntil: 'networkidle' });
await p.waitForTimeout(7000);
await shot(p, '06-wing-celebration-parade');
await p.close();

await browser.close();
