// Scene composition (meshes, shadow casters, lights, passes) for perf tuning. node scripts/scene-stats.ts L01
import { chromium } from 'playwright-core';
const table = process.argv[2] ?? 'L01';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await page.goto(`${process.env.AFH_URL ?? 'http://localhost:5199'}/?table=${table}&autostart&test`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!(window as any).__afh?.renderer(), null, { timeout: 30000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(() => {
  const st = (window as any).__afh.renderer().stage;
  const scene = st.scene;
  let meshes = 0, casters = 0, transparent = 0, points = 0, lines = 0, instanced = 0;
  const byParent: Record<string, number> = {};
  scene.traverseVisible((o: any) => {
    if (o.isMesh) { meshes++; if (o.castShadow) casters++; if (o.material?.transparent) transparent++; if (o.isInstancedMesh) instanced++; }
    if (o.isPoints) points++;
    if (o.isLine) lines++;
    let p = o; let depth = 0; while (p.parent && p.parent !== scene && depth < 20) { p = p.parent; depth++; }
    const k = p.name || p.type; if (o.isMesh) byParent[k] = (byParent[k] ?? 0) + 1;
  });
  const lights: string[] = [];
  scene.traverse((o: any) => { if (o.isLight) lights.push(`${o.type}${o.castShadow ? '(shadow)' : ''}`); });
  return { meshes, casters, transparent, instanced, points, lines, byParent, lights, passes: st.composer?.passes?.map((p: any) => p.constructor.name) };
});
console.log(table, JSON.stringify(r));
await browser.close();
