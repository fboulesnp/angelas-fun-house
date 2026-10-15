// Lazy loader for lesson content and question banks (one chunk per lesson).
// Only reviewed, structurally valid questions are returned for play.

import type { LessonId } from './curriculum.ts';
import type { LessonContent, Question, QuestionBank } from './schema.ts';
import { playableQuestions } from './validate.ts';

const lessonFiles = import.meta.glob<{ default: LessonContent }>('./lessons/L*.json');
const bankFiles = import.meta.glob<{ default: QuestionBank }>('./questions/L*.json');

export interface LoadedLesson {
  lesson: LessonContent;
  questions: Question[];
  /** Questions present in the file but excluded from play (not reviewed / invalid). */
  excluded: number;
}

const cache = new Map<LessonId, Promise<LoadedLesson | null>>();

export function hasLessonContent(id: LessonId): boolean {
  return !!lessonFiles[`./lessons/${id}.json`] && !!bankFiles[`./questions/${id}.json`];
}

export function loadLesson(id: LessonId): Promise<LoadedLesson | null> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const lf = lessonFiles[`./lessons/${id}.json`];
      const bf = bankFiles[`./questions/${id}.json`];
      if (!lf || !bf) return null;
      const [l, b] = await Promise.all([lf(), bf()]);
      const questions = playableQuestions(id, l.default, b.default);
      return { lesson: l.default, questions, excluded: b.default.questions.length - questions.length };
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
