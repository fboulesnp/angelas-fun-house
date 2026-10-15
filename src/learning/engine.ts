// Learning engine: answer evaluation, question selection and the mastery rule.
//
// Mastery rule (explained in-game; not a standardized assessment):
//  * Only a learner's FIRST response to a question counts as evidence, so repeating an item
//    cannot inflate mastery.
//  * Evidence is counted per question FAMILY (a family probes one idea several ways). A family
//    counts once it has an independent (no hint) correct first response.
//  * Hinted correct answers are recorded separately and schedule an independent check: a
//    different question from the same family, offered later.
//  * A missed family is revisited later through a different question, after other material.
//  * The lesson badge needs evidence in at least two families for every objective (or every
//    family the objective has, if it has fewer than two).

import type { LessonContent, Question } from '../content/schema.ts';
import type { LessonId } from '../content/curriculum.ts';
import type { ResponseRecord, SaveData } from '../persistence/save.ts';

export type Answer =
  | { type: 'single'; choice: string }
  | { type: 'multi'; choices: string[] }
  | { type: 'order'; order: string[] }
  | { type: 'classify'; bins: Record<string, string> }
  | { type: 'match'; pairs: Record<string, string> }
  | { type: 'numeric'; value: number };

export interface Evaluation {
  correct: boolean;
  /** Item-level correctness for feedback (choice/item id -> correct?). */
  parts: Record<string, boolean>;
}

export function evaluate(q: Question, a: Answer): Evaluation {
  const parts: Record<string, boolean> = {};
  switch (q.type) {
    case 'single': {
      const ok = a.type === 'single' && a.choice === q.answer;
      if (a.type === 'single') parts[a.choice] = ok;
      return { correct: ok, parts };
    }
    case 'multi': {
      if (a.type !== 'multi') return { correct: false, parts };
      const want = new Set(q.answer);
      for (const c of q.choices) parts[c.id] = want.has(c.id) === a.choices.includes(c.id);
      return { correct: Object.values(parts).every(Boolean), parts };
    }
    case 'order': {
      if (a.type !== 'order') return { correct: false, parts };
      q.answer.forEach((id, i) => (parts[id] = a.order[i] === id));
      return { correct: a.order.length === q.answer.length && Object.values(parts).every(Boolean), parts };
    }
    case 'classify': {
      if (a.type !== 'classify') return { correct: false, parts };
      for (const it of q.items) parts[it.id] = a.bins[it.id] === q.answer[it.id];
      return { correct: Object.values(parts).every(Boolean), parts };
    }
    case 'match': {
      if (a.type !== 'match') return { correct: false, parts };
      for (const it of q.left) parts[it.id] = a.pairs[it.id] === q.answer[it.id];
      return { correct: Object.values(parts).every(Boolean), parts };
    }
    case 'numeric': {
      if (a.type !== 'numeric' || !Number.isFinite(a.value)) return { correct: false, parts };
      return { correct: Math.abs(a.value - q.answer) <= q.tolerance + 1e-9, parts };
    }
  }
}

/** Record a response. Only the first response to a question becomes evidence. */
export function recordResponse(save: SaveData, q: Question, correct: boolean, hinted: boolean, now = new Date().toISOString()): ResponseRecord {
  save.learning.seq++;
  const seq = save.learning.seq;
  const prev = save.learning.responses[q.id];
  if (prev) {
    prev.attempts++;
    prev.last = { correct, hinted, at: now, seq };
    return prev;
  }
  const rec: ResponseRecord = {
    qid: q.id,
    lessonId: q.lessonId,
    familyId: q.familyId,
    objectiveIds: q.objectiveIds,
    first: { correct, hinted, at: now, seq },
    attempts: 1,
    last: { correct, hinted, at: now, seq },
  };
  save.learning.responses[q.id] = rec;
  return rec;
}

export interface FamilyStatus {
  familyId: string;
  objectiveIds: string[];
  /** Independent correct first response on some question in the family. */
  evidence: boolean;
  /** A hinted-correct first response awaiting an independent check. */
  needsIndependentCheck: boolean;
  /** A missed first response not yet followed by independent success. */
  needsRevisit: boolean;
  lastSeq: number;
  seenQuestions: number;
}

export function familyStatus(save: SaveData, bank: Question[]): Map<string, FamilyStatus> {
  const out = new Map<string, FamilyStatus>();
  for (const q of bank) {
    let f = out.get(q.familyId);
    if (!f) {
      f = { familyId: q.familyId, objectiveIds: [...q.objectiveIds], evidence: false, needsIndependentCheck: false, needsRevisit: false, lastSeq: -1, seenQuestions: 0 };
      out.set(q.familyId, f);
    }
    for (const o of q.objectiveIds) if (!f.objectiveIds.includes(o)) f.objectiveIds.push(o);
    const r = save.learning.responses[q.id];
    if (!r) continue;
    f.seenQuestions++;
    f.lastSeq = Math.max(f.lastSeq, r.last.seq);
    if (r.first.correct && !r.first.hinted) f.evidence = true;
    else if (r.first.correct && r.first.hinted) f.needsIndependentCheck = true;
    else f.needsRevisit = true;
  }
  for (const f of out.values()) {
    if (f.evidence) {
      f.needsIndependentCheck = false;
      f.needsRevisit = false;
    }
  }
  return out;
}

export interface ObjectiveMastery {
  objectiveId: string;
  familiesTotal: number;
  familiesWithEvidence: number;
  needed: number;
  met: boolean;
  attempted: boolean;
}

export function objectiveMastery(save: SaveData, lesson: LessonContent, bank: Question[]): ObjectiveMastery[] {
  const fams = familyStatus(save, bank);
  return lesson.objectives.map((o) => {
    const own = [...fams.values()].filter((f) => f.objectiveIds.includes(o.id));
    const withEv = own.filter((f) => f.evidence).length;
    const needed = Math.min(2, own.length);
    return {
      objectiveId: o.id,
      familiesTotal: own.length,
      familiesWithEvidence: withEv,
      needed,
      met: own.length > 0 && withEv >= needed,
      attempted: own.some((f) => f.seenQuestions > 0),
    };
  });
}

export function lessonBadgeEarned(save: SaveData, lesson: LessonContent, bank: Question[]): boolean {
  const om = objectiveMastery(save, lesson, bank);
  return om.length > 0 && om.every((o) => o.met);
}

export interface SelectOptions {
  objectiveIds?: string[];
  count: number;
  preferTypes?: string[];
  /** Question ids to avoid (shown this session). */
  avoid?: string[];
  /** Deterministic tiebreak seed. */
  seed?: number;
}

/**
 * Choose questions: prefer unseen items on objectives without evidence, revisit missed or
 * hinted families through a DIFFERENT question after intervening material, avoid immediate
 * repeats, and never pick two from the same family in one request.
 */
export function selectQuestions(save: SaveData, lessonId: LessonId, bank: Question[], o: SelectOptions): Question[] {
  const fams = familyStatus(save, bank);
  const seq = save.learning.seq;
  const avoid = new Set(o.avoid ?? []);
  const recent = new Set(
    Object.values(save.learning.responses)
      .filter((r) => r.lessonId === lessonId && seq - r.last.seq < 4)
      .map((r) => r.qid),
  );
  const objectiveEvidence = new Map<string, number>();
  for (const f of fams.values()) for (const ob of f.objectiveIds) objectiveEvidence.set(ob, (objectiveEvidence.get(ob) ?? 0) + (f.evidence ? 1 : 0));
  let seed = o.seed ?? seq * 7919 + 17;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const wanted = o.objectiveIds && o.objectiveIds.length ? new Set(o.objectiveIds) : null;
  const scored = bank
    .filter((q) => !avoid.has(q.id))
    .map((q) => {
      const f = fams.get(q.familyId)!;
      const seen = !!save.learning.responses[q.id];
      let s = 0;
      if (wanted) s += q.objectiveIds.some((x) => wanted.has(x)) ? 200 : -400;
      s += seen ? -80 : 100;
      if (recent.has(q.id)) s -= 500;
      const minEv = Math.min(...q.objectiveIds.map((x) => objectiveEvidence.get(x) ?? 0));
      s += minEv === 0 ? 50 : minEv === 1 ? 25 : 0;
      const spaced = seq - f.lastSeq >= 2;
      if (f.needsRevisit && !seen && spaced) s += 70;
      if (f.needsIndependentCheck && !seen && spaced) s += 60;
      if (f.evidence) s -= 30;
      if (o.preferTypes?.includes(q.type)) s += 35;
      s += rand() * 20;
      return { q, s };
    })
    .sort((a, b) => b.s - a.s);
  const out: Question[] = [];
  const usedFam = new Set<string>();
  for (const { q } of scored) {
    if (out.length >= o.count) break;
    if (usedFam.has(q.familyId)) continue;
    usedFam.add(q.familyId);
    out.push(q);
  }
  // Fall back to any family if the bank is small.
  for (const { q } of scored) {
    if (out.length >= o.count) break;
    if (!out.includes(q)) out.push(q);
  }
  return out;
}

/** Deterministic shuffle used for display order (answers are stored by stable id). */
export function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
