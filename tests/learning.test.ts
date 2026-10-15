import { describe, expect, it } from 'vitest';
import { evaluate, familyStatus, lessonBadgeEarned, objectiveMastery, recordResponse, selectQuestions } from '../src/learning/engine.ts';
import { newSave } from '../src/persistence/save.ts';
import type { LessonContent, Question } from '../src/content/schema.ts';

const base = {
  lessonId: 'L01' as const, conceptTags: ['x'], category: 'foundational' as const, difficulty: 1 as const,
  prompt: 'p', accessiblePrompt: 'p', explanation: 'e', misconception: 'm', hint: 'h', followUpId: 'L01-Q02',
  scope: { lessonId: 'L01' as const, section: 's', pages: { printed: [9], pdf: [45] } },
  evidence: [], review: { status: 'reviewed' as const, notes: '', passes: [] },
};
const mk = (id: string, fam: string, obj: string): Question => ({
  ...base, id, familyId: fam, objectiveIds: [obj], type: 'single',
  choices: [{ id: 'a', text: 'A', rationale: 'r' }, { id: 'b', text: 'B', rationale: 'r' }, { id: 'c', text: 'C', rationale: 'r' }], answer: 'b',
});
const bank: Question[] = [
  mk('L01-Q01', 'L01-F01', 'L01-O1'), mk('L01-Q02', 'L01-F01', 'L01-O1'),
  mk('L01-Q03', 'L01-F02', 'L01-O1'), mk('L01-Q04', 'L01-F02', 'L01-O1'),
  mk('L01-Q05', 'L01-F03', 'L01-O2'), mk('L01-Q06', 'L01-F04', 'L01-O2'),
];
const lesson = { objectives: [{ id: 'L01-O1' }, { id: 'L01-O2' }] } as unknown as LessonContent;

describe('evaluation', () => {
  it('scores every interaction type independent of display order', () => {
    expect(evaluate(bank[0], { type: 'single', choice: 'b' }).correct).toBe(true);
    const multi = { ...bank[0], type: 'multi', answer: ['a', 'c'] } as unknown as Question;
    expect(evaluate(multi, { type: 'multi', choices: ['c', 'a'] }).correct).toBe(true);
    expect(evaluate(multi, { type: 'multi', choices: ['a'] }).correct).toBe(false);
    const order = { ...bank[0], type: 'order', items: [{ id: 'x' }, { id: 'y' }, { id: 'z' }], answer: ['z', 'x', 'y'] } as unknown as Question;
    expect(evaluate(order, { type: 'order', order: ['z', 'x', 'y'] }).correct).toBe(true);
    expect(evaluate(order, { type: 'order', order: ['x', 'z', 'y'] }).correct).toBe(false);
    const cls = { ...bank[0], type: 'classify', items: [{ id: 'i1' }, { id: 'i2' }], bins: [{ id: 'b1' }, { id: 'b2' }], answer: { i1: 'b2', i2: 'b1' } } as unknown as Question;
    expect(evaluate(cls, { type: 'classify', bins: { i1: 'b2', i2: 'b1' } }).correct).toBe(true);
    const num = { ...bank[0], type: 'numeric', answer: 2.5, tolerance: 0.05, unit: 'g/cm³' } as unknown as Question;
    expect(evaluate(num, { type: 'numeric', value: 2.52 }).correct).toBe(true);
    expect(evaluate(num, { type: 'numeric', value: 2.7 }).correct).toBe(false);
  });
});

describe('mastery rule', () => {
  it('repeating the same item cannot inflate mastery', () => {
    const save = newSave();
    recordResponse(save, bank[0], false, false);
    for (let i = 0; i < 10; i++) recordResponse(save, bank[0], true, false);
    expect(familyStatus(save, bank).get('L01-F01')!.evidence).toBe(false);
    expect(save.learning.responses['L01-Q01'].attempts).toBe(11);
  });

  it('a different question in a missed family can provide evidence later', () => {
    const save = newSave();
    recordResponse(save, bank[0], false, false);
    recordResponse(save, bank[1], true, false);
    expect(familyStatus(save, bank).get('L01-F01')!.evidence).toBe(true);
  });

  it('hinted answers are recorded separately and need an independent check', () => {
    const save = newSave();
    recordResponse(save, bank[2], true, true);
    const f = familyStatus(save, bank).get('L01-F02')!;
    expect(f.evidence).toBe(false);
    expect(f.needsIndependentCheck).toBe(true);
  });

  it('the badge needs evidence across every objective', () => {
    const save = newSave();
    recordResponse(save, bank[0], true, false);
    recordResponse(save, bank[2], true, false);
    expect(lessonBadgeEarned(save, lesson, bank)).toBe(false);
    recordResponse(save, bank[4], true, false);
    recordResponse(save, bank[5], true, false);
    expect(objectiveMastery(save, lesson, bank).every((o) => o.met)).toBe(true);
    expect(lessonBadgeEarned(save, lesson, bank)).toBe(true);
  });
});

describe('selection', () => {
  it('never picks two questions from the same family in one request and avoids immediate repeats', () => {
    const save = newSave();
    const qs = selectQuestions(save, 'L01', bank, { count: 3 });
    expect(new Set(qs.map((q) => q.familyId)).size).toBe(3);
    recordResponse(save, qs[0], true, false);
    const next = selectQuestions(save, 'L01', bank, { count: 1 });
    expect(next[0].id).not.toBe(qs[0].id);
  });

  it('revisits a missed family through a different question after other material', () => {
    const save = newSave();
    recordResponse(save, bank[0], false, false); // miss F01 via Q01
    recordResponse(save, bank[4], true, false); // intervening material
    recordResponse(save, bank[5], true, false);
    const pick = selectQuestions(save, 'L01', bank, { count: 1, objectiveIds: ['L01-O1'], seed: 3 });
    expect(pick[0].id).toBe('L01-Q02');
  });

  it('prefers the requested objectives', () => {
    const save = newSave();
    const pick = selectQuestions(save, 'L01', bank, { count: 2, objectiveIds: ['L01-O2'] });
    expect(pick.every((q) => q.objectiveIds.includes('L01-O2'))).toBe(true);
  });
});
