// Render a table's collision geometry to SVG (and PNG via ImageMagick when available).
// Usage: node scripts/table-preview.ts L01 [outDir]
// Red = playfield walls, orange = ramp layer, green = sensors, blue = flippers (rest + raised).

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TableRuntime } from '../src/game/table/runtime.ts';
import { TableBuilder } from '../src/game/table/builder.ts';
import { loadTable } from './lib/load-table.ts';
import type { LessonId } from '../src/content/curriculum.ts';

const id = (process.argv[2] ?? 'L01') as LessonId;
const outDir = process.argv[3] ?? 'screenshots/geometry';
const def = await loadTable(id);
if (!def) {
  console.error(`No table ${id}`);
  process.exit(1);
}
const rt = new TableRuntime();
def.build(new TableBuilder(rt));
rt.world.finalize();

const parts: string[] = [];
parts.push(`<rect x="0" y="0" width="600" height="1150" fill="#1b1430"/>`);
for (let y = 0; y <= 1150; y += 50) parts.push(`<line x1="0" y1="${y}" x2="600" y2="${y}" stroke="#2c2448" stroke-width="1"/><text x="2" y="${y - 2}" fill="#5a4f80" font-size="9">${y}</text>`);
for (let x = 0; x <= 600; x += 50) parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="1150" stroke="#2c2448" stroke-width="1"/><text x="${x + 2}" y="10" fill="#5a4f80" font-size="9">${x}</text>`);
for (const c of rt.world.colliders) {
  const color = c.sensor ? '#3ee08f' : c.layer === 1 ? '#ff9a3c' : '#ff4d6d';
  const s = c.shape;
  const op = c.sensor ? 0.5 : 0.9;
  if (s.kind === 'circle') parts.push(`<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="1.5"/>`);
  else parts.push(`<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${color}" stroke-opacity="${op}" stroke-width="${Math.max(1.5, s.r * 2)}" stroke-linecap="round"/>`);
}
for (const f of rt.flippers) {
  for (const a of [f.rest, f.up]) {
    const tx = f.px + Math.cos(a) * f.length;
    const ty = f.py + Math.sin(a) * f.length;
    parts.push(`<line x1="${f.px}" y1="${f.py}" x2="${tx}" y2="${ty}" stroke="#6aa8ff" stroke-opacity="${a === f.rest ? 0.9 : 0.4}" stroke-width="${f.r0 + f.r1}" stroke-linecap="round"/>`);
  }
}
for (const m of rt.order) {
  const anyM = m as unknown as { x?: number; y?: number; x1?: number; y1?: number; path?: [number, number][] };
  const x = anyM.x ?? anyM.x1 ?? anyM.path?.[0]?.[0];
  const y = anyM.y ?? anyM.y1 ?? anyM.path?.[0]?.[1];
  if (x === undefined || y === undefined || m.kind === 'wall' || m.kind === 'post') continue;
  parts.push(`<text x="${x + 6}" y="${y - 6}" fill="#fff7e7" font-size="10" font-family="monospace">${m.id}</text>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1150" viewBox="0 0 600 1150">${parts.join('')}</svg>`;
mkdirSync(outDir, { recursive: true });
const svgPath = join(outDir, `${id}.svg`);
writeFileSync(svgPath, svg);
try {
  execFileSync('magick', ['-font', '/System/Library/Fonts/Supplemental/Arial.ttf', svgPath, join(outDir, `${id}.png`)]);
  console.log(join(outDir, `${id}.png`));
} catch {
  console.log(svgPath);
}
