// Table acceptance check: structure, references, geometry lint and long bot soaks.
// Usage: node scripts/table-check.ts L05 [--minutes 20] [--seeds 3] [--json]
// Exit 1 on any error. Warnings are printed but do not fail.

import { TableRuntime } from '../src/game/table/runtime.ts';
import { TableBuilder } from '../src/game/table/builder.ts';
import { FlipperMech, Insert, Portal, Ramp, Saucer, type Mechanism } from '../src/game/table/mechanisms.ts';
import { shapeDistance } from '../src/game/physics/world.ts';
import { BALL_R } from '../src/game/physics/types.ts';
import { runBot } from '../src/game/sim/bot.ts';
import { buildShotMap } from '../src/game/sim/shotmap.ts';
import type { Match, Stage } from '../src/game/table/tableDef.ts';
import { loadTable } from './lib/load-table.ts';

const args = process.argv.slice(2);
const id = args[0];
const minutes = Number(args.includes('--minutes') ? args[args.indexOf('--minutes') + 1] : 20);
const seeds = Number(args.includes('--seeds') ? args[args.indexOf('--seeds') + 1] : 3);
const asJson = args.includes('--json');
const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);
const warn = (m: string) => warnings.push(m);

const def = await loadTable(id);
if (!def) {
  console.error(`No table module src/tables/${id}.ts (it must export default its TableDef).`);
  process.exit(1);
}
if (def.lessonId !== id) err(`lessonId ${def.lessonId} does not match file ${id}`);

// ---------------------------------------------------------------- build
const rt = new TableRuntime();
try {
  def.build(new TableBuilder(rt));
  rt.world.finalize();
} catch (e) {
  err(`build() threw: ${(e as Error).message}`);
}
const mech = (mid: string) => rt.mechs.get(mid);
const groups = new Set(rt.order.map((m) => m.group).filter(Boolean));

// ---------------------------------------------------------------- references
const kinds = new Set(def.missions.map((m) => m.kind));
for (const k of ['observe', 'relate', 'apply']) if (!kinds.has(k as 'observe')) err(`no mission of kind ${k}`);
if (def.missions.length !== 3) err('exactly 3 missions required');
const checkMatch = (where: string, m: Match) => {
  const ids = m.id ? (Array.isArray(m.id) ? m.id : [m.id]) : [];
  for (const x of ids) if (!mech(x)) err(`${where}: unknown mechanism id "${x}"`);
  if (m.group && !groups.has(m.group)) err(`${where}: unknown group "${m.group}"`);
  if (!m.type && !m.id && !m.group) err(`${where}: empty match`);
};
for (const sh of def.shots) {
  sh.on.forEach((m) => checkMatch(`shot ${sh.id}`, m));
  if (sh.insert && !(mech(sh.insert) instanceof Insert)) err(`shot ${sh.id}: insert "${sh.insert}" is not an Insert`);
}
const shotIds = new Set(def.shots.map((s) => s.id));
const usedShots = new Set<string>();
const checkStages = (where: string, stages: Stage[]) => {
  if (!stages.length) err(`${where}: no stages`);
  const last = stages[stages.length - 1];
  if (last?.kind !== 'discover') err(`${where}: last stage must be "discover"`);
  stages.forEach((st, i) => {
    const w = `${where} stage ${i + 1}`;
    if (!st.text || st.text.length > 60) warn(`${w}: HUD text should be 1-60 chars (${st.text?.length})`);
    if (st.kind === 'collect') {
      (Array.isArray(st.match) ? st.match : [st.match]).forEach((m) => checkMatch(w, m));
      st.lamps?.forEach((l) => { if (!mech(l)) err(`${w}: lamp "${l}" unknown`); });
      st.preview?.forEach((p) => { if (!shotIds.has(p)) err(`${w}: preview shot "${p}" unknown`); else usedShots.add(p); });
      if (st.count < 1) err(`${w}: count < 1`);
      if (st.distinct && st.lamps && st.count > st.lamps.length) warn(`${w}: distinct count exceeds lamp list`);
    } else if (st.kind === 'shots') {
      st.shots.forEach((s) => { if (!shotIds.has(s)) err(`${w}: shot "${s}" unknown`); else usedShots.add(s); });
    } else if (st.kind === 'discover') {
      const p = mech(st.pocket);
      if (!(p instanceof Saucer) || p.role !== 'pocket') err(`${w}: pocket "${st.pocket}" must be a Saucer with role "pocket"`);
    }
  });
};
def.missions.forEach((m, i) => {
  checkStages(`mission ${i + 1} (${m.title})`, m.stages);
  if (!m.discovery || m.discovery.length > 220) warn(`mission ${i + 1}: discovery line should be 1-220 chars`);
  if (!m.brief || m.brief.length > 160) warn(`mission ${i + 1}: brief should be 1-160 chars`);
});
checkStages('finale', def.finale.stages);
if (def.skillShot && !mech(def.skillShot)) err(`skillShot "${def.skillShot}" unknown`);
if (!def.set) warn('no 3D set (falls back to the generic set)');
if (!def.room) warn('no dollhouse room vignette');
for (const k of ['intro', 'quark', 'pipTip'] as const) if (!def.lines[k]) err(`lines.${k} missing`);

// ---------------------------------------------------------------- geometry lint
const solids = rt.world.colliders.filter((c) => !c.sensor);
for (const c of rt.world.colliders) {
  const s = c.shape;
  const pts = s.kind === 'circle' ? [[s.x, s.y]] : [[s.x1, s.y1], [s.x2, s.y2]];
  for (const [x, y] of pts) if (x < 0 || x > 600 || y < 0 || y > 1150 || !Number.isFinite(x + y)) err(`collider ${(c.owner as Mechanism | undefined)?.id ?? c.id} outside the table (${x},${y})`);
}
// Flipper sweeps must be clear (except walls deliberately meeting the pivot).
for (const fm of rt.order.filter((m): m is FlipperMech => m instanceof FlipperMech)) {
  const f = fm.flipper;
  for (let a = 0; a <= 12; a++) {
    const ang = f.rest + ((f.up - f.rest) * a) / 12;
    for (let k = 1; k <= 10; k++) {
      const u = k / 10;
      const x = f.px + Math.cos(ang) * f.length * u;
      const y = f.py + Math.sin(ang) * f.length * u;
      const rr = f.r0 + (f.r1 - f.r0) * u;
      for (const c of solids) {
        if (c.layer !== f.layer || c.dynamic) continue;
        // Guides that deliberately meet the flipper pivot (inlanes) are part of the design.
        if (shapeDistance(c.shape, f.px, f.py) < f.r0 + 6) continue;
        const d = shapeDistance(c.shape, x, y);
        if (d < rr - 0.5 && Math.hypot(x - f.px, y - f.py) > f.r0 + 6) {
          err(`flipper ${f.id} sweep hits ${(c.owner as Mechanism | undefined)?.id ?? c.id} near (${x.toFixed(0)},${y.toFixed(0)})`);
          k = 99;
          a = 99;
          break;
        }
      }
    }
  }
}
const clearAt = (x: number, y: number, layer: 0 | 1, pad = 1) =>
  solids.filter((c) => c.layer === layer && c.enabled && !c.oneWay).every((c) => shapeDistance(c.shape, x, y) > BALL_R + pad);
for (const m of rt.order) {
  if (m instanceof Ramp) {
    const end = m.path[m.path.length - 1];
    if (!clearAt(end[0], end[1], 0, 1)) err(`ramp ${m.id}: exit (${end[0].toFixed(0)},${end[1].toFixed(0)}) overlaps a playfield wall`);
  }
  if (m instanceof Saucer) {
    for (let d = 18; d <= 60; d += 6) {
      const x = m.x + m.ejectDx * d;
      const y = m.y + m.ejectDy * d;
      if (!clearAt(x, y, 0, 0)) {
        err(`saucer ${m.id}: eject path blocked ${d} units out`);
        break;
      }
    }
  }
  if (m instanceof Portal && !clearAt(m.exitX, m.exitY, 0, 2)) err(`portal ${m.id}: exit overlaps a wall`);
}
if (!rt.order.some((m) => m instanceof Saucer && m.role === 'pocket')) err('no Wonder Pocket (Saucer role "pocket")');

// ---------------------------------------------------------------- bot soaks
const soaks = [];
const mapSummary: Record<string, string> = {};
if (!errors.length) {
  const map = buildShotMap(def);
  if (map.cradles.length < 2) err(`cradle could not be established on: ${['left', 'right'].filter((x) => !map.cradles.includes(x)).join(', ')}`);
  for (const sh of def.shots) {
    const tr = map.byShot[sh.id] ?? [];
    const feed = tr.filter((x) => x.mode === 'feed');
    const drop = tr.filter((x) => x.mode === 'drop');
    mapSummary[sh.id] = tr.length
      ? [feed.length && `inlane-feed ${[...new Set(feed.map((x) => x.button))].join('+')} (${feed.length} timings)`, drop.length && `cradle-drop ${[...new Set(drop.map((x) => x.button))].join('+')} (${drop.length} timings)`].filter(Boolean).join(', ')
      : 'not reachable from a cradle or inlane feed (only from live play)';
  }
  for (let i = 0; i < seeds; i++) soaks.push(await runBot(def, { seconds: minutes * 60, seed: 101 + i * 7, aim: map }));
  const shotsHit: Record<string, number> = {};
  for (const r of soaks) for (const [k, v] of Object.entries(r.shots)) shotsHit[k] = (shotsHit[k] ?? 0) + v;
  for (const sh of def.shots) {
    if (!shotsHit[sh.id]) (usedShots.has(sh.id) ? err : warn)(`shot "${sh.id}" never made by the bot in ${seeds}x${minutes} min`);
  }
  for (const r of soaks) {
    if (r.errors.length) err(`soak errors: ${r.errors.slice(0, 3).join(' | ')}`);
    if (r.insideWallSamples) err(`ball inside a wall ${r.insideWallSamples}x: ${r.insideDetails.slice(0, 3).join(' | ')}`);
    const perTen = (r.rescues / minutes) * 10;
    if (perTen > 2) err(`stuck-ball rescues ${r.rescues} in ${minutes} min at ${r.rescueSpots.join(' ')}`);
    else if (r.rescues) warn(`rescues ${r.rescues} at ${r.rescueSpots.join(' ')}`);
    const avgBall = (minutes * 60) / Math.max(1, r.drains - r.saves);
    if (avgBall < 10) warn(`average ball time ${avgBall.toFixed(1)} s with a random bot (very drain-prone?)`);
  }
  if (!soaks.some((r) => r.finale)) err(`the bot never completed the finale in ${seeds}x${minutes} min (missions completed per seed: ${soaks.map((r) => r.missionsCompleted).join(', ')})`);
}

const summary = {
  table: id,
  errors,
  warnings,
  shotMap: mapSummary,
  soaks: soaks.map((r) => ({ drains: r.drains, saves: r.saves, rescues: r.rescues, missions: r.missionTimes, finale: r.finaleTime, maxSpeed: Math.round(r.maxSpeed), shots: r.shots })),
};
if (asJson) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`${id}: ${errors.length ? 'FAIL' : 'PASS'}  errors ${errors.length}  warnings ${warnings.length}`);
  for (const e of errors) console.log('  ERROR', e);
  for (const w of warnings) console.log('  warn ', w);
  for (const [k, v] of Object.entries(summary.shotMap)) console.log(`  shot map ${k}: ${v}`);
  for (const [i, s] of summary.soaks.entries()) console.log(`  soak ${i + 1}: missions at ${s.missions.join('/') || '-'} s, finale ${s.finale >= 0 ? s.finale + ' s' : 'no'}, drains ${s.drains} (saved ${s.saves}), rescues ${s.rescues}, shots ${JSON.stringify(s.shots)}`);
}
process.exit(errors.length ? 1 : 0);
