// Build docs/content-review.md (combined review record) and docs/validation-report.md
// (per-chapter status from real check outputs). node scripts/report.ts [--soak-minutes 20]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LESSONS } from '../src/content/curriculum.ts';
import type { LessonContent, QuestionBank } from '../src/content/schema.ts';
import { crossLessonDuplicates, questionSignature, similarity, validateLesson } from '../src/content/validate.ts';
import { loadTable } from './lib/load-table.ts';

const root = join(import.meta.dirname, '..');
const minutes = process.argv.includes('--soak-minutes') ? process.argv[process.argv.indexOf('--soak-minutes') + 1] : '20';
const read = <T,>(p: string): T | undefined => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : undefined);
const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- content review record
const parts: string[] = [];
parts.push(`# Content review record\n\n_Generated ${today} by \`scripts/report.ts\` from \`docs/content-review/Lnn.md\` and the question banks._\n`);
parts.push(`Review was performed by independent AI agents (an author, a science/source reviewer, a pedagogy reviewer, a reviser and a final verifier per lesson) against the textbook pages and the cited external sources. Only questions marked \`reviewed\` by the final verifier enter play. **Teacher review is still recommended** before classroom use.\n`);
parts.push('| Lesson | Reviewed | Needs review | Rejected | Families | Review flags |\n|---|---|---|---|---|---|');
let totalReviewed = 0;
const sections: string[] = [];
for (const l of LESSONS) {
  const bank = read<QuestionBank>(join(root, 'src/content/questions', `${l.id}.json`));
  const lesson = read<LessonContent>(join(root, 'src/content/lessons', `${l.id}.json`));
  const qs = bank?.questions ?? [];
  const rev = qs.filter((q) => q.review.status === 'reviewed');
  totalReviewed += rev.length;
  parts.push(`| ${l.id} ${l.lessonTitle} | ${rev.length} | ${qs.filter((q) => q.review.status === 'needs-review').length} | ${qs.filter((q) => q.review.status === 'rejected').length} | ${new Set(rev.map((q) => q.familyId)).size} | ${lesson?.reviewFlags.length ?? 0} |`);
  const md = join(root, 'docs/content-review', `${l.id}.md`);
  sections.push(existsSync(md) ? readFileSync(md, 'utf8').replace(/^(#{1,5}) /gm, '#$1 ') : `## ${l.id} — ${l.lessonTitle}\n\nNo review record yet.\n`);
}
parts.push(`\n**Reviewed questions in play: ${totalReviewed}** (requirement: at least 696, 24 per lesson).\n`);

// Objective coverage, duplicate scans and source flags, computed from the banks themselves.
const banks: QuestionBank[] = [];
const coverage: string[] = ['| Lesson | Objective coverage (reviewed questions / families) | Validator |', '|---|---|---|'];
const dupes: string[] = [];
const flags: string[] = ['| Flag | Pages | Issue | Resolution |', '|---|---|---|---|'];
for (const l of LESSONS) {
  const bank = read<QuestionBank>(join(root, 'src/content/questions', `${l.id}.json`));
  const lesson = read<LessonContent>(join(root, 'src/content/lessons', `${l.id}.json`));
  if (bank) banks.push(bank);
  const vr = validateLesson(l.id, lesson, bank);
  const errs = vr.issues.filter((i) => i.level === 'error');
  const warns = vr.issues.filter((i) => i.level === 'warning');
  coverage.push(`| ${l.id} | ${Object.entries(vr.objectiveCoverage).map(([o, c]) => `${o.replace(`${l.id}-`, '')} ${c.questions}/${c.families}`).join(', ')} | ${errs.length} errors, ${warns.length} warnings |`);
  for (const i of vr.issues) if (/duplicate|identical|similar/.test(i.message)) dupes.push(`- ${l.id} ${i.where}: ${i.message} (${i.level})`);
  for (const f of lesson?.reviewFlags ?? []) {
    const cell = (t: string) => t.replace(/\|/g, '/').replace(/\s+/g, ' ');
    flags.push(`| ${f.id} | p. ${f.pages.printed.join(', ')} | ${cell(f.issue)} | ${cell(f.resolution)} |`);
  }
}
const cross = crossLessonDuplicates(banks);
for (const i of cross) dupes.push(`- cross-lesson ${i.where}: ${i.message}`);
// The closest cross-lesson pairs below the warning line, for a human spot check.
const reviewedAll = banks.flatMap((b) => b.questions.filter((q) => q.review.status === 'reviewed'));
const sigs = reviewedAll.map((q) => questionSignature(q));
const close: { a: string; b: string; s: number }[] = [];
for (let i = 0; i < reviewedAll.length; i++) {
  for (let j = i + 1; j < reviewedAll.length; j++) {
    if (reviewedAll[i].lessonId === reviewedAll[j].lessonId) continue;
    const sim = similarity(sigs[i], sigs[j]);
    if (sim >= 0.4 && sim < 0.6) close.push({ a: reviewedAll[i].id, b: reviewedAll[j].id, s: sim });
  }
}
close.sort((x, y) => y.s - x.s);
parts.push('## Objective coverage\n', coverage.join('\n'), '');
parts.push(`## Duplicate and near-duplicate scan\n\nWithin each lesson, identical prompts and pairs with signature similarity ≥ 0.60 are validator errors and pairs ≥ 0.40 are warnings. Across lessons, pairs ≥ 0.60 are flagged. Similarity compares prompt + answer wording, so a flagged pair can still test different ideas.\n`);
parts.push(dupes.length ? dupes.join('\n') : '- No identical prompts or near-duplicates found.');
parts.push(`\nClosest cross-lesson pairs below the flag line (for a human spot check): ${close.slice(0, 12).map((c) => `${c.a}/${c.b} (${c.s.toFixed(2)})`).join(', ') || 'none ≥ 0.40'}.\n`);
parts.push(`## Source review flags\n\nPlaces where the textbook (or its OCR) looked wrong, oversimplified or dated, and how the game's content handles each. Every flag is resolved in the content; sources are listed in each lesson file.\n`);
parts.push(flags.join('\n'), '');
writeFileSync(join(root, 'docs/content-review.md'), parts.join('\n') + '\n\n# Per-lesson review records\n\n' + sections.join('\n\n'));

// ---------------------------------------------------------------- validation report
const rows: string[] = [];
const details: string[] = [];
// Notes from hands-on browser sessions (docs/manual-review.json), written by whoever played the table.
const manual = read<Record<string, string>>(join(root, 'docs/manual-review.json')) ?? {};
for (const l of LESSONS) {
  const lesson = read<LessonContent>(join(root, 'src/content/lessons', `${l.id}.json`));
  const bank = read<QuestionBank>(join(root, 'src/content/questions', `${l.id}.json`));
  const vr = validateLesson(l.id, lesson, bank);
  const cErr = vr.issues.filter((i) => i.level === 'error').length;
  const def = await loadTable(l.id);
  let tableResult = 'no table';
  let soak = '';
  if (def) {
    try {
      const out = execFileSync('node', ['scripts/table-check.ts', l.id, '--minutes', minutes, '--seeds', '3', '--json'], { cwd: root, maxBuffer: 1 << 24 }).toString();
      const j = JSON.parse(out);
      tableResult = 'PASS';
      soak = j.soaks.map((s: { finale: number; missions: number[] }) => (s.finale >= 0 ? `finale ${s.finale}s` : `${s.missions.length} missions`)).join(', ');
    } catch (e) {
      const out = (e as { stdout?: Buffer }).stdout?.toString() ?? '';
      try {
        const j = JSON.parse(out);
        tableResult = `FAIL: ${j.errors.slice(0, 2).join('; ')}`;
      } catch {
        tableResult = 'FAIL';
      }
    }
  }
  rows.push(`| ${l.number} | ${l.attractionTitle} | ${vr.reviewedCount} reviewed, ${cErr ? cErr + ' errors' : 'valid'} | ${tableResult} | ${manual[l.id] ? 'yes' : 'not yet'} | ${def?.signature ?? '—'} |`);
  if (def) {
    details.push(`### ${l.number}. ${l.attractionTitle} — ${l.lessonTitle}

- **Source reviewed:** printed pp. ${l.printedStart}–${l.printedEnd} (PDF ${l.pdfStart}–${l.pdfEnd}); record in \`docs/content-review/${l.id}.md\`.
- **Questions:** ${vr.reviewedCount} reviewed in ${vr.families} families; types ${Object.entries(vr.types).map(([k, v]) => `${k} ${v}`).join(', ')}.
- **Unique mechanic:** ${def.signature}
- **Missions:** ${def.missions.map((m) => `${m.title} (${m.kind})`).join('; ')}
- **Finale:** ${def.finale.title} — ${def.finale.brief}
- **Learning route:** Wonder Pocket discoveries in each mission + finale; Science Explorer lesson page with ${lesson?.explorer.length ?? 0} explainer cards.
- **Automated checks:** content validator ${cErr ? 'FAIL' : 'PASS'}; table-check ${tableResult.startsWith('PASS') ? 'PASS' : tableResult}${soak ? ` (aiming-bot soaks, 3 × ${minutes} sim-min: ${soak})` : ''}.
- **Manual review:** ${manual[l.id] ?? 'not yet reviewed by hand'}
`);
  }
}
const report = `# Validation report

_Generated ${today} by \`scripts/report.ts\`. Every line reflects an actual run; nothing here is assumed._

| # | Attraction | Content | Table check | Hands-on review | Signature mechanism |
|---|---|---|---|---|---|
${rows.join('\n')}

## Per chapter

${details.join('\n')}
`;
writeFileSync(join(root, 'docs/validation-report.md'), report);
console.log(`wrote docs/content-review.md (${totalReviewed} reviewed) and docs/validation-report.md`);
