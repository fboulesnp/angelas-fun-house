// Structural and pedagogical validation for lesson content and question banks.
// Shared by scripts/validate-content.ts, the test suite and the runtime loader.

import { LESSON_BY_ID, PRINTED_TO_PDF_OFFSET, type LessonId } from './curriculum.ts';
import type {
  Diagram, Evidence, LessonContent, PageRef, Question, QuestionBank,
} from './schema.ts';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export const MIN_REVIEWED_PER_LESSON = 24;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(s: string, n = 3): Set<string> {
  const w = normalizeText(s).split(' ').filter(Boolean);
  const out = new Set<string>();
  if (w.length < n) {
    out.add(w.join(' '));
    return out;
  }
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Text that identifies a question's substance: prompt plus its keyed answer. */
export function questionSignature(q: Question): string {
  switch (q.type) {
    case 'single':
      return `${q.prompt} ${q.choices.find((c) => c.id === q.answer)?.text ?? ''}`;
    case 'multi':
      return `${q.prompt} ${q.choices.filter((c) => q.answer.includes(c.id)).map((c) => c.text).join(' ')}`;
    case 'order':
      return `${q.prompt} ${q.answer.map((id) => q.items.find((i) => i.id === id)?.text ?? '').join(' ')}`;
    case 'classify':
      return `${q.prompt} ${q.items.map((i) => i.text).join(' ')}`;
    case 'match':
      return `${q.prompt} ${q.left.map((i) => i.text).join(' ')}`;
    case 'numeric':
      return `${q.prompt} ${q.answer} ${q.unit}`;
  }
}

function checkPages(issues: Issue[], where: string, pages: PageRef | undefined, lessonId: LessonId, loose = false) {
  if (!pages || !Array.isArray(pages.printed) || !Array.isArray(pages.pdf)) {
    issues.push({ level: 'error', where, message: 'missing pages {printed[], pdf[]}' });
    return;
  }
  if (pages.printed.length === 0) issues.push({ level: 'error', where, message: 'no printed pages cited' });
  if (pages.printed.length !== pages.pdf.length) {
    issues.push({ level: 'error', where, message: 'printed[] and pdf[] lengths differ' });
  }
  const l = LESSON_BY_ID[lessonId];
  pages.printed.forEach((p, i) => {
    if (!loose && (p < l.printedStart || p > l.printedEnd)) {
      issues.push({ level: 'error', where, message: `printed page ${p} outside lesson range ${l.printedStart}-${l.printedEnd}` });
    }
    if (pages.pdf[i] !== p + PRINTED_TO_PDF_OFFSET) {
      issues.push({ level: 'error', where, message: `pdf page ${pages.pdf[i]} != printed ${p} + ${PRINTED_TO_PDF_OFFSET}` });
    }
  });
}

function checkEvidence(issues: Issue[], where: string, ev: Evidence[] | undefined, lessonId: LessonId) {
  if (!Array.isArray(ev) || ev.length === 0) {
    issues.push({ level: 'error', where, message: 'no evidence records' });
    return;
  }
  let textbook = 0;
  ev.forEach((e, i) => {
    const w = `${where}.evidence[${i}]`;
    if (e.type === 'textbook') {
      textbook++;
      if (e.documentId !== 'BSA7-SE') issues.push({ level: 'error', where: w, message: 'documentId must be BSA7-SE' });
      checkPages(issues, w, { printed: e.printedPages, pdf: e.pdfPages }, lessonId, true);
      if (!e.locator || !e.supports) issues.push({ level: 'error', where: w, message: 'textbook evidence needs locator + supports' });
    } else if (e.type === 'external') {
      if (!/^https:\/\//.test(e.url ?? '')) issues.push({ level: 'error', where: w, message: 'external evidence needs an https URL' });
      if (!ISO_DATE.test(e.accessed ?? '')) issues.push({ level: 'error', where: w, message: 'external evidence needs accessed YYYY-MM-DD' });
      if (!e.title || !e.publisher || !e.supports) issues.push({ level: 'error', where: w, message: 'external evidence needs title, publisher, supports' });
      if ('printedPages' in (e as object) || 'pdfPages' in (e as object)) {
        issues.push({ level: 'error', where: w, message: 'external evidence must not carry textbook page numbers' });
      }
    } else {
      issues.push({ level: 'error', where: w, message: `unknown evidence type` });
    }
  });
  if (textbook === 0) issues.push({ level: 'warning', where, message: 'no textbook evidence record (external-only)' });
}

export function checkDiagram(issues: Issue[], where: string, d: Diagram) {
  if (!d.caption) issues.push({ level: 'error', where, message: 'diagram needs caption' });
  if (!d.alt || d.alt.length < 40) issues.push({ level: 'error', where, message: 'diagram alt text missing or too short' });
  switch (d.kind) {
    case 'table':
      if (!d.columns?.length || !d.rows?.length) issues.push({ level: 'error', where, message: 'table needs columns and rows' });
      d.rows?.forEach((r, i) => {
        if (r.length !== d.columns.length) issues.push({ level: 'error', where, message: `table row ${i} width mismatch` });
      });
      break;
    case 'layers':
      if (!d.layers?.length) issues.push({ level: 'error', where, message: 'layers diagram needs layers' });
      d.features?.forEach((f) => f.affects.forEach((id) => {
        if (!d.layers.some((l) => l.id === id)) issues.push({ level: 'error', where, message: `feature affects unknown layer ${id}` });
      }));
      break;
    case 'network': {
      const ids = new Set(d.nodes?.map((n) => n.id));
      if (!d.nodes?.length) issues.push({ level: 'error', where, message: 'network needs nodes' });
      d.edges?.forEach((e) => {
        if (!ids.has(e.from) || !ids.has(e.to)) issues.push({ level: 'error', where, message: `edge ${e.from}->${e.to} references unknown node` });
      });
      break;
    }
    case 'molecule': {
      const ids = new Set(d.atoms?.map((a) => a.id));
      d.bonds?.forEach((b) => {
        if (!ids.has(b.a) || !ids.has(b.b)) issues.push({ level: 'error', where, message: `bond ${b.a}-${b.b} references unknown atom` });
      });
      d.atoms?.forEach((a) => {
        if (a.x < 0 || a.x > 10 || a.y < 0 || a.y > 10) issues.push({ level: 'error', where, message: `atom ${a.id} outside 0-10 grid` });
      });
      break;
    }
    case 'lattice':
      if (!d.elements?.length || d.rows < 2 || d.cols < 2) issues.push({ level: 'error', where, message: 'lattice needs elements and >=2x2 grid' });
      break;
    case 'curve':
      if (!d.series?.length) issues.push({ level: 'error', where, message: 'curve needs series' });
      d.series?.forEach((s) => s.points.forEach((p) => {
        if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) issues.push({ level: 'error', where, message: 'non-finite curve point' });
      }));
      break;
    case 'bars':
      if (!d.bars?.length) issues.push({ level: 'error', where, message: 'bars diagram needs bars' });
      break;
    case 'particles':
      if (!d.panels?.length) issues.push({ level: 'error', where, message: 'particles diagram needs panels' });
      break;
    case 'equation':
      if (!d.reactants?.length || !d.products?.length) issues.push({ level: 'error', where, message: 'equation needs reactants and products' });
      break;
    default:
      issues.push({ level: 'error', where, message: `unknown diagram kind ${(d as { kind: string }).kind}` });
  }
}

const BANNED_CHOICES = /\b(all|none) of the above\b|\bboth a and b\b/i;

function checkQuestion(issues: Issue[], q: Question, lesson: LessonContent | undefined, lessonId: LessonId) {
  const w = q.id ?? '(no id)';
  const idRe = new RegExp(`^${lessonId}-Q\\d{2,3}$`);
  if (!idRe.test(q.id)) issues.push({ level: 'error', where: w, message: `id must match ${lessonId}-Qnn` });
  if (q.lessonId !== lessonId) issues.push({ level: 'error', where: w, message: 'lessonId mismatch' });
  if (!new RegExp(`^${lessonId}-F\\d{2}$`).test(q.familyId)) issues.push({ level: 'error', where: w, message: 'familyId must match Lnn-Fnn' });
  if (!['foundational', 'relationship', 'application'].includes(q.category)) issues.push({ level: 'error', where: w, message: 'bad category' });
  if (![1, 2, 3].includes(q.difficulty)) issues.push({ level: 'error', where: w, message: 'difficulty must be 1-3' });
  for (const k of ['prompt', 'accessiblePrompt', 'explanation', 'misconception', 'hint'] as const) {
    if (typeof q[k] !== 'string' || q[k].trim().length < 8) issues.push({ level: 'error', where: w, message: `${k} missing/too short` });
  }
  if (q.prompt && q.prompt.length > 420) issues.push({ level: 'warning', where: w, message: `prompt long (${q.prompt.length} chars)` });
  if (!q.objectiveIds?.length) issues.push({ level: 'error', where: w, message: 'no objectiveIds' });
  if (lesson) {
    q.objectiveIds?.forEach((o) => {
      if (!lesson.objectives.some((x) => x.id === o)) issues.push({ level: 'error', where: w, message: `unknown objective ${o}` });
    });
  }
  if (!q.conceptTags?.length) issues.push({ level: 'error', where: w, message: 'no conceptTags' });
  if (!q.scope || q.scope.lessonId !== lessonId || !q.scope.section) issues.push({ level: 'error', where: w, message: 'scope needs lessonId + section' });
  else checkPages(issues, `${w}.scope`, q.scope.pages, lessonId);
  checkEvidence(issues, w, q.evidence, lessonId);
  if (q.diagram) checkDiagram(issues, `${w}.diagram`, q.diagram);
  if (!q.review || !['reviewed', 'needs-review', 'rejected'].includes(q.review.status)) {
    issues.push({ level: 'error', where: w, message: 'review.status missing' });
  } else if (q.review.status === 'reviewed' && (!q.review.passes || q.review.passes.length < 2)) {
    issues.push({ level: 'error', where: w, message: 'reviewed questions need at least two recorded passes' });
  }

  const uniq = (ids: string[], what: string) => {
    if (new Set(ids).size !== ids.length) issues.push({ level: 'error', where: w, message: `duplicate ${what} ids` });
  };
  switch (q.type) {
    case 'single':
    case 'multi': {
      const ids = q.choices?.map((c) => c.id) ?? [];
      uniq(ids, 'choice');
      if (ids.length < 3 || ids.length > 6) issues.push({ level: 'error', where: w, message: 'needs 3-6 choices' });
      const texts = q.choices?.map((c) => normalizeText(c.text)) ?? [];
      if (new Set(texts).size !== texts.length) issues.push({ level: 'error', where: w, message: 'duplicate choice text' });
      q.choices?.forEach((c) => {
        if (!c.rationale || c.rationale.length < 8) issues.push({ level: 'error', where: w, message: `choice ${c.id} missing rationale` });
        if (BANNED_CHOICES.test(c.text)) issues.push({ level: 'error', where: w, message: `choice ${c.id} uses all/none of the above` });
      });
      if (q.type === 'single') {
        if (!ids.includes(q.answer)) issues.push({ level: 'error', where: w, message: 'answer not among choices' });
      } else {
        if (!Array.isArray(q.answer) || q.answer.length < 1) issues.push({ level: 'error', where: w, message: 'multi needs answer[]' });
        q.answer?.forEach((a) => { if (!ids.includes(a)) issues.push({ level: 'error', where: w, message: `answer ${a} not among choices` }); });
        if (q.answer?.length === ids.length) issues.push({ level: 'error', where: w, message: 'every choice correct' });
        if (!/select all that apply/i.test(q.prompt)) issues.push({ level: 'error', where: w, message: 'multi prompt must say "Select all that apply."' });
      }
      break;
    }
    case 'order': {
      const ids = q.items?.map((i) => i.id) ?? [];
      uniq(ids, 'item');
      if (ids.length < 3 || ids.length > 6) issues.push({ level: 'error', where: w, message: 'order needs 3-6 items' });
      if (!q.answer || q.answer.length !== ids.length || q.answer.some((a) => !ids.includes(a)) || new Set(q.answer).size !== ids.length) {
        issues.push({ level: 'error', where: w, message: 'order answer must be a permutation of item ids' });
      }
      if (q.answer && ids.length && q.answer.every((a, i) => a === ids[i])) {
        issues.push({ level: 'warning', where: w, message: 'items already listed in answer order (display shuffles, but check)' });
      }
      if (!Array.isArray(q.ends) || q.ends.length !== 2) issues.push({ level: 'error', where: w, message: 'order needs ends [first, last] labels' });
      q.items?.forEach((i) => { if (!i.rationale) issues.push({ level: 'error', where: w, message: `item ${i.id} missing rationale` }); });
      break;
    }
    case 'classify': {
      const ids = q.items?.map((i) => i.id) ?? [];
      const bins = q.bins?.map((b) => b.id) ?? [];
      uniq(ids, 'item');
      uniq(bins, 'bin');
      if (ids.length < 3 || ids.length > 8) issues.push({ level: 'error', where: w, message: 'classify needs 3-8 items' });
      if (bins.length < 2 || bins.length > 4) issues.push({ level: 'error', where: w, message: 'classify needs 2-4 bins' });
      ids.forEach((id) => {
        if (!q.answer || !bins.includes(q.answer[id])) issues.push({ level: 'error', where: w, message: `item ${id} not mapped to a bin` });
      });
      bins.forEach((b) => {
        if (!Object.values(q.answer ?? {}).includes(b)) issues.push({ level: 'warning', where: w, message: `bin ${b} unused` });
      });
      q.items?.forEach((i) => { if (!i.rationale) issues.push({ level: 'error', where: w, message: `item ${i.id} missing rationale` }); });
      break;
    }
    case 'match': {
      const l = q.left?.map((i) => i.id) ?? [];
      const r = q.right?.map((i) => i.id) ?? [];
      uniq(l, 'left');
      uniq(r, 'right');
      if (l.length < 3 || l.length > 6) issues.push({ level: 'error', where: w, message: 'match needs 3-6 pairs' });
      const used = new Set<string>();
      l.forEach((id) => {
        const t = q.answer?.[id];
        if (!t || !r.includes(t)) issues.push({ level: 'error', where: w, message: `left ${id} not matched` });
        else if (used.has(t)) issues.push({ level: 'error', where: w, message: `right ${t} matched twice` });
        else used.add(t);
      });
      q.left?.forEach((i) => { if (!i.rationale) issues.push({ level: 'error', where: w, message: `left ${i.id} missing rationale` }); });
      break;
    }
    case 'numeric':
      if (!Number.isFinite(q.answer)) issues.push({ level: 'error', where: w, message: 'numeric answer not finite' });
      if (!(q.tolerance >= 0)) issues.push({ level: 'error', where: w, message: 'tolerance must be >= 0' });
      if (typeof q.unit !== 'string') issues.push({ level: 'error', where: w, message: 'numeric needs unit (may be "")' });
      if (!q.workedSolution) issues.push({ level: 'error', where: w, message: 'numeric needs workedSolution' });
      break;
    default:
      issues.push({ level: 'error', where: w, message: `unknown type ${(q as { type: string }).type}` });
  }
}

export interface LessonReport {
  lessonId: LessonId;
  issues: Issue[];
  reviewedCount: number;
  totalCount: number;
  families: number;
  types: Record<string, number>;
  categories: Record<string, number>;
  objectiveCoverage: Record<string, { questions: number; families: number }>;
}

export function validateLesson(lessonId: LessonId, lesson: LessonContent | undefined, bank: QuestionBank | undefined): LessonReport {
  const issues: Issue[] = [];
  const report: LessonReport = {
    lessonId, issues, reviewedCount: 0, totalCount: 0, families: 0, types: {}, categories: {}, objectiveCoverage: {},
  };
  if (!lesson) issues.push({ level: 'error', where: lessonId, message: 'lesson content file missing' });
  if (!bank) issues.push({ level: 'error', where: lessonId, message: 'question bank file missing' });

  if (lesson) {
    if (lesson.lessonId !== lessonId) issues.push({ level: 'error', where: lessonId, message: 'lesson.lessonId mismatch' });
    if (!lesson.guidingQuestion || !lesson.hook) issues.push({ level: 'error', where: lessonId, message: 'guidingQuestion and hook required' });
    if (!lesson.sections?.length) issues.push({ level: 'error', where: lessonId, message: 'sections required' });
    lesson.sections?.forEach((s, i) => checkPages(issues, `${lessonId}.sections[${i}]`, s.pages, lessonId));
    if (!lesson.objectives || lesson.objectives.length < 3) issues.push({ level: 'error', where: lessonId, message: 'at least 3 objectives required' });
    const kinds = new Set(lesson.objectives?.map((o) => o.kind));
    for (const k of ['observe', 'relate', 'apply']) {
      if (!kinds.has(k as 'observe')) issues.push({ level: 'error', where: lessonId, message: `no objective of kind ${k}` });
    }
    lesson.objectives?.forEach((o) => {
      if (!new RegExp(`^${lessonId}-O\\d$`).test(o.id)) issues.push({ level: 'error', where: o.id, message: 'objective id must be Lnn-On' });
      checkPages(issues, o.id, o.pages, lessonId);
      if (!lesson.explorer?.some((c) => c.objectiveId === o.id)) issues.push({ level: 'error', where: o.id, message: 'no Science Explorer card for objective' });
    });
    if (!lesson.keyIdeas || lesson.keyIdeas.length < 3) issues.push({ level: 'error', where: lessonId, message: 'at least 3 keyIdeas' });
    if (!lesson.glossary || lesson.glossary.length < 4) issues.push({ level: 'error', where: lessonId, message: 'at least 4 glossary entries' });
    lesson.glossary?.forEach((g, i) => checkPages(issues, `${lessonId}.glossary[${i}]`, g.pages, lessonId));
    lesson.explorer?.forEach((c, i) => {
      const w = `${lessonId}.explorer[${i}]`;
      if (!c.paragraphs || c.paragraphs.length < 2) issues.push({ level: 'error', where: w, message: 'explorer card needs >=2 paragraphs' });
      checkPages(issues, w, c.pages, lessonId);
      if (c.diagram) checkDiagram(issues, `${w}.diagram`, c.diagram);
    });
    lesson.reviewFlags?.forEach((f, i) => {
      checkPages(issues, `${lessonId}.reviewFlags[${i}]`, f.pages, lessonId, true);
      if (!f.resolution) issues.push({ level: 'error', where: `${lessonId}.reviewFlags[${i}]`, message: 'flag needs resolution' });
    });
  }

  if (bank) {
    if (bank.lessonId !== lessonId) issues.push({ level: 'error', where: lessonId, message: 'bank.lessonId mismatch' });
    const qs = bank.questions ?? [];
    report.totalCount = qs.length;
    const ids = new Set<string>();
    for (const q of qs) {
      if (ids.has(q.id)) issues.push({ level: 'error', where: q.id, message: 'duplicate question id' });
      ids.add(q.id);
      checkQuestion(issues, q, lesson, lessonId);
    }
    const byId = new Map(qs.map((q) => [q.id, q]));
    for (const q of qs) {
      const f = byId.get(q.followUpId);
      if (!f) issues.push({ level: 'error', where: q.id, message: `followUpId ${q.followUpId} not found` });
      else if (f.familyId === q.familyId) issues.push({ level: 'error', where: q.id, message: 'followUp must be from another family' });
    }
    const reviewed = qs.filter((q) => q.review?.status === 'reviewed');
    report.reviewedCount = reviewed.length;
    report.families = new Set(reviewed.map((q) => q.familyId)).size;
    for (const q of reviewed) {
      report.types[q.type] = (report.types[q.type] ?? 0) + 1;
      report.categories[q.category] = (report.categories[q.category] ?? 0) + 1;
    }
    if (reviewed.length < MIN_REVIEWED_PER_LESSON) {
      issues.push({ level: 'error', where: lessonId, message: `only ${reviewed.length} reviewed questions (< ${MIN_REVIEWED_PER_LESSON})` });
    }
    for (const c of ['foundational', 'relationship', 'application']) {
      if ((report.categories[c] ?? 0) < 6) issues.push({ level: 'warning', where: lessonId, message: `only ${report.categories[c] ?? 0} ${c} questions` });
    }
    if (Object.keys(report.types).length < 3) issues.push({ level: 'warning', where: lessonId, message: 'fewer than 3 interaction types' });
    if (report.families < 8) issues.push({ level: 'error', where: lessonId, message: `only ${report.families} question families (need >= 8)` });
    lesson?.objectives.forEach((o) => {
      const oq = reviewed.filter((q) => q.objectiveIds.includes(o.id));
      const fam = new Set(oq.map((q) => q.familyId)).size;
      report.objectiveCoverage[o.id] = { questions: oq.length, families: fam };
      if (fam < 2) issues.push({ level: 'error', where: o.id, message: `objective covered by ${fam} families (need >= 2)` });
      if (oq.length < 4) issues.push({ level: 'error', where: o.id, message: `objective covered by ${oq.length} questions (need >= 4)` });
    });
    // duplicates and near-duplicates inside the lesson
    for (let i = 0; i < qs.length; i++) {
      for (let j = i + 1; j < qs.length; j++) {
        const a = qs[i];
        const b = qs[j];
        if (normalizeText(a.prompt) === normalizeText(b.prompt)) {
          issues.push({ level: 'error', where: `${a.id}/${b.id}`, message: 'identical prompts' });
          continue;
        }
        const s = similarity(questionSignature(a), questionSignature(b));
        if (s >= 0.6) issues.push({ level: 'error', where: `${a.id}/${b.id}`, message: `near-duplicate (similarity ${s.toFixed(2)})` });
        else if (s >= 0.4) issues.push({ level: 'warning', where: `${a.id}/${b.id}`, message: `similar (similarity ${s.toFixed(2)})` });
      }
    }
  }
  return report;
}

/** Cross-lesson exact and near duplicate detection. */
export function crossLessonDuplicates(banks: QuestionBank[]): Issue[] {
  const issues: Issue[] = [];
  const all = banks.flatMap((b) => b.questions);
  const sig = all.map((q) => questionSignature(q));
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].lessonId === all[j].lessonId) continue;
      const s = similarity(sig[i], sig[j]);
      if (s >= 0.6) issues.push({ level: 'warning', where: `${all[i].id}/${all[j].id}`, message: `cross-lesson near-duplicate (${s.toFixed(2)})` });
    }
  }
  return issues;
}

/** Only reviewed, structurally valid questions may enter normal play. */
export function playableQuestions(lessonId: LessonId, lesson: LessonContent | undefined, bank: QuestionBank | undefined): Question[] {
  if (!bank) return [];
  return bank.questions.filter((q) => {
    if (q.review?.status !== 'reviewed') return false;
    const issues: Issue[] = [];
    checkQuestion(issues, q, lesson, lessonId);
    return !issues.some((i) => i.level === 'error');
  });
}
