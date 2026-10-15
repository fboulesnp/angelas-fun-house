// Build docs/content-review.md (combined review record) and docs/validation-report.md
// (per-chapter status from real check outputs). node scripts/report.ts [--soak-minutes 20]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LESSONS } from '../src/content/curriculum.ts';
import type { LessonContent, QuestionBank } from '../src/content/schema.ts';
import { validateLesson } from '../src/content/validate.ts';
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
  sections.push(existsSync(md) ? readFileSync(md, 'utf8').replace(/^# /m, '## ') : `## ${l.id} — ${l.lessonTitle}\n\nNo review record yet.\n`);
}
parts.push(`\n**Reviewed questions in play: ${totalReviewed}** (requirement: at least 696, 24 per lesson).\n`);
writeFileSync(join(root, 'docs/content-review.md'), parts.join('\n') + '\n\n' + sections.join('\n\n'));

// ---------------------------------------------------------------- validation report
const rows: string[] = [];
const details: string[] = [];
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
  rows.push(`| ${l.number} | ${l.attractionTitle} | ${vr.reviewedCount} reviewed, ${cErr ? cErr + ' errors' : 'valid'} | ${tableResult} | ${def?.signature ?? '—'} |`);
  if (def) {
    details.push(`### ${l.number}. ${l.attractionTitle} — ${l.lessonTitle}

- **Source reviewed:** printed pp. ${l.printedStart}–${l.printedEnd} (PDF ${l.pdfStart}–${l.pdfEnd}); record in \`docs/content-review/${l.id}.md\`.
- **Questions:** ${vr.reviewedCount} reviewed in ${vr.families} families; types ${Object.entries(vr.types).map(([k, v]) => `${k} ${v}`).join(', ')}.
- **Unique mechanic:** ${def.signature}
- **Missions:** ${def.missions.map((m) => `${m.title} (${m.kind})`).join('; ')}
- **Finale:** ${def.finale.title} — ${def.finale.brief}
- **Learning route:** Wonder Pocket discoveries in each mission + finale; Science Explorer lesson page with ${lesson?.explorer.length ?? 0} explainer cards.
- **Automated checks:** content validator ${cErr ? 'FAIL' : 'PASS'}; table-check ${tableResult.startsWith('PASS') ? 'PASS' : tableResult}${soak ? ` (aiming-bot soaks, 3 × ${minutes} sim-min: ${soak})` : ''}.
`);
  }
}
const report = `# Validation report

_Generated ${today} by \`scripts/report.ts\`. Every line reflects an actual run; nothing here is assumed._

| # | Attraction | Content | Table check | Signature mechanism |
|---|---|---|---|---|
${rows.join('\n')}

## Per chapter

${details.join('\n')}
`;
writeFileSync(join(root, 'docs/validation-report.md'), report);
console.log(`wrote docs/content-review.md (${totalReviewed} reviewed) and docs/validation-report.md`);
