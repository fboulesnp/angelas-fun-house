import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LESSONS, WINGS } from '../src/content/curriculum.ts';
import { validateLesson } from '../src/content/validate.ts';
import type { LessonContent, QuestionBank } from '../src/content/schema.ts';
import { MissionRunner } from '../src/game/rules/missions.ts';
import { L01 } from '../src/tables/L01.ts';

const root = join(__dirname, '..');
const read = <T,>(p: string): T | undefined => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : undefined);

describe('curriculum manifest', () => {
  it('has exactly 29 lessons in textbook order with PDF = printed + 36', () => {
    expect(LESSONS).toHaveLength(29);
    LESSONS.forEach((l, i) => {
      expect(l.number).toBe(i + 1);
      expect(l.id).toBe(`L${String(i + 1).padStart(2, '0')}`);
      expect(l.pdfStart).toBe(l.printedStart + 36);
    });
    expect(LESSONS[0].lessonTitle).toBe('Atoms and Elements');
    expect(LESSONS[28].lessonTitle).toBe('Engineering Solutions for Protecting Ecosystems');
    expect(WINGS.flatMap((w) => w.lessons)).toEqual(LESSONS.map((l) => l.id));
  });
});

describe('question banks', () => {
  const present = LESSONS.filter((l) => existsSync(join(root, 'src/content/questions', `${l.id}.json`)));
  it.each(present.map((l) => [l.id]))('%s validates with no errors', (id) => {
    const lesson = read<LessonContent>(join(root, 'src/content/lessons', `${id}.json`));
    const bank = read<QuestionBank>(join(root, 'src/content/questions', `${id}.json`));
    const r = validateLesson(id as never, lesson, bank);
    const errors = r.issues.filter((i) => i.level === 'error');
    expect(errors, JSON.stringify(errors.slice(0, 5))).toHaveLength(0);
    expect(r.reviewedCount).toBeGreaterThanOrEqual(24);
  });

  it('answers survive shuffling (keys are stable option ids, not positions)', () => {
    for (const l of present) {
      const bank = read<QuestionBank>(join(root, 'src/content/questions', `${l.id}.json`))!;
      for (const q of bank.questions) {
        if (q.type === 'single') expect(q.choices.map((c) => c.id)).toContain(q.answer);
        if (q.type === 'multi') for (const a of q.answer) expect(q.choices.map((c) => c.id)).toContain(a);
      }
    }
  });

  it('every reviewed question id is unique across the whole game', () => {
    const seen = new Set<string>();
    for (const l of present) {
      const bank = read<QuestionBank>(join(root, 'src/content/questions', `${l.id}.json`))!;
      for (const q of bank.questions) {
        expect(seen.has(q.id)).toBe(false);
        seen.add(q.id);
      }
    }
  });
});

describe('mission runner', () => {
  const ev = (type: string, id: string, group?: string) => ({ type, id, group, x: 0, y: 0, time: 0 }) as never;

  it('resumes at the first incomplete mission and reaches the finale', () => {
    const r = new MissionRunner(L01, [true, true, false]);
    expect(r.slot).toBe(2);
    r.handle(ev('dropBank', 'group_bank'));
    for (const id of ['lane_1', 'lane_2', 'lane_3', 'lane_4']) r.handle(ev('rollover', id, 'neon'));
    expect(r.stage?.kind).toBe('discover');
    expect(r.completeDiscover()).toBe('mission');
    expect(r.slot).toBe(3);
  });

  it('distinct collect stages ignore repeated hits on the same target', () => {
    const r = new MissionRunner(L01);
    for (let i = 0; i < 8; i++) r.handle(ev('bumper', 'bumper_c', 'elements'));
    r.handle(ev('target', 'matter_target', 'sort'));
    r.handle(ev('target', 'matter_target', 'sort'));
    expect(r.progress().done).toBe(1);
    r.handle(ev('target', 'nonmatter_target', 'sort'));
    expect(r.stage?.kind).toBe('discover');
  });

  it('a finished table replays missions as an encore without losing the Wonderlight', () => {
    const r = new MissionRunner(L01, [true, true, true], true);
    expect(r.encore).toBe(true);
    expect(r.level).toBe(4);
    expect(r.slot).toBe(0);
  });
});
