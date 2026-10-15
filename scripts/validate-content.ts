// Validate lesson content + question banks.
// Usage: node scripts/validate-content.ts [--lesson L01] [--quiet] [--json] [--allow-missing]
// Exit code 1 when any error is found.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS, type LessonId } from '../src/content/curriculum.ts';
import type { LessonContent, QuestionBank } from '../src/content/schema.ts';
import { crossLessonDuplicates, normalizeText, validateLesson, type Issue } from '../src/content/validate.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--lesson') ? args[args.indexOf('--lesson') + 1] : undefined;
const quiet = args.includes('--quiet');
const asJson = args.includes('--json');
const allowMissing = args.includes('--allow-missing');
// OCR text of the textbook lives outside the game project and is never shipped.
const sourceDir = join(root, '..', 'tmp', 'lessons');

function readJson<T>(p: string): T | undefined {
  if (!existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch (e) {
    throw new Error(`${p}: invalid JSON: ${(e as Error).message}`);
  }
}

/** Flag long verbatim runs copied from the textbook OCR text. */
function verbatimIssues(lessonId: LessonId, lesson?: LessonContent, bank?: QuestionBank): Issue[] {
  const p = join(sourceDir, `${lessonId}.txt`);
  if (!existsSync(p)) return [];
  const words = normalizeText(readFileSync(p, 'utf8')).split(' ');
  const N = 9;
  const grams = new Set<string>();
  for (let i = 0; i + N <= words.length; i++) grams.add(words.slice(i, i + N).join(' '));
  const issues: Issue[] = [];
  const check = (where: string, text: string | undefined) => {
    if (!text) return;
    const w = normalizeText(text).split(' ');
    let run = 0;
    let best = 0;
    for (let i = 0; i + N <= w.length; i++) {
      if (grams.has(w.slice(i, i + N).join(' '))) {
        run++;
        best = Math.max(best, run + N - 1);
      } else run = 0;
    }
    if (best >= 14) issues.push({ level: 'error', where, message: `copies ${best} consecutive words from the textbook` });
    else if (best >= N) issues.push({ level: 'warning', where, message: `shares ${best} consecutive words with the textbook` });
  };
  lesson?.keyIdeas.forEach((k, i) => check(`${lessonId}.keyIdeas[${i}]`, k));
  lesson?.glossary.forEach((g) => check(`${lessonId}.glossary.${g.term}`, g.definition));
  lesson?.explorer.forEach((c, i) => c.paragraphs.forEach((t, j) => check(`${lessonId}.explorer[${i}].p${j}`, t)));
  bank?.questions.forEach((q) => {
    check(`${q.id}.prompt`, q.prompt);
    check(`${q.id}.explanation`, q.explanation);
    if ('choices' in q) q.choices.forEach((c) => check(`${q.id}.${c.id}`, c.text));
  });
  return issues;
}

const lessons = LESSONS.filter((l) => !only || l.id === only);
const reports = [];
const banks: QuestionBank[] = [];
let errors = 0;
let warnings = 0;
let reviewedTotal = 0;

for (const l of lessons) {
  const lesson = readJson<LessonContent>(join(root, 'src/content/lessons', `${l.id}.json`));
  const bank = readJson<QuestionBank>(join(root, 'src/content/questions', `${l.id}.json`));
  if (!lesson && !bank && allowMissing) continue;
  const r = validateLesson(l.id, lesson, bank);
  r.issues.push(...verbatimIssues(l.id, lesson, bank));
  if (bank) banks.push(bank);
  reports.push(r);
  reviewedTotal += r.reviewedCount;
  const e = r.issues.filter((i) => i.level === 'error');
  const w = r.issues.filter((i) => i.level === 'warning');
  errors += e.length;
  warnings += w.length;
  if (!asJson) {
    const types = Object.entries(r.types).map(([k, v]) => `${k}:${v}`).join(' ');
    const cats = Object.entries(r.categories).map(([k, v]) => `${k.slice(0, 5)}:${v}`).join(' ');
    console.log(`${l.id} ${l.lessonTitle.padEnd(48)} reviewed ${String(r.reviewedCount).padStart(2)}/${String(r.totalCount).padStart(2)} fam ${String(r.families).padStart(2)}  ${types}  ${cats}  ${e.length ? `ERR ${e.length}` : 'ok'}${w.length ? ` warn ${w.length}` : ''}`);
    for (const i of quiet ? e : [...e, ...w]) console.log(`   ${i.level === 'error' ? 'ERROR' : 'warn '} ${i.where}: ${i.message}`);
  }
}

const cross = only ? [] : crossLessonDuplicates(banks);
warnings += cross.length;
if (asJson) {
  console.log(JSON.stringify({ errors, warnings, reviewedTotal, reports, cross }, null, 2));
} else {
  if (!quiet) for (const i of cross) console.log(`   warn  ${i.where}: ${i.message}`);
  console.log(`\nReviewed questions: ${reviewedTotal}   errors: ${errors}   warnings: ${warnings}`);
}
process.exit(errors > 0 ? 1 : 0);
