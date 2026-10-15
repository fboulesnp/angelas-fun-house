// Science Explorer: the calm, reflex-free path through every lesson's objectives, using the
// same reviewed questions, diagrams and explanations as the attractions.

import { useEffect, useState } from 'preact/hooks';
import { LESSONS, LESSON_BY_ID, WINGS, type LessonId } from '../../content/curriculum.ts';
import { hasLessonContent, loadLesson, type LoadedLesson } from '../../content/loader.ts';
import { lessonBadgeEarned, objectiveMastery, recordResponse, selectQuestions } from '../../learning/engine.ts';
import type { Question } from '../../content/schema.ts';
import type { Route } from '../App.tsx';
import { getSave, updateSave, useSave } from '../store.ts';
import { Diagram, formula } from '../components/Diagram.tsx';
import { QuestionPanel } from '../components/QuestionPanel.tsx';
import { audio } from '../../game/audio/audio.ts';

export function ExplorerScreen({ lessonId, go }: { lessonId?: LessonId; go(r: Route): void }) {
  const save = useSave();
  const [content, setContent] = useState<LoadedLesson | null | undefined>(undefined);
  const [practice, setPractice] = useState<{ objectiveId: string; questions: Question[] } | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    setContent(undefined);
    loadLesson(lessonId).then(setContent).catch(() => setContent(null));
  }, [lessonId]);

  if (!lessonId) {
    return (
      <main class="screen explorer">
        <header class="screen-header">
          <button class="btn ghost small" onClick={() => go({ name: 'title' })}>← Title</button>
          <h1>Science Explorer</h1>
        </header>
        <p class="lead">A calm path through every lesson: read short explanations, look at diagrams, and check your understanding. No flippers needed. It earns the same Science Stars as the attractions.</p>
        {WINGS.map((w) => (
          <section class="panel wing" aria-labelledby={`xw-${w.id}`}>
            <h2 id={`xw-${w.id}`}>{w.segment}</h2>
            <ul class="room-list">
              {w.lessons.map((id) => {
                const l = LESSON_BY_ID[id];
                return (
                  <li>
                    <button class="room" onClick={() => go({ name: 'explorer', lessonId: id })} disabled={!hasLessonContent(id)}>
                      <span class="room-num">{l.number}</span>
                      <span class="room-text"><span class="room-attraction">{l.lessonTitle}</span><span class="room-lesson">{l.attractionTitle}</span></span>
                      <span class="room-status">{save.progress[id].badge ? <span class="chip star">Science Star</span> : !hasLessonContent(id) && <span class="chip">In review</span>}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    );
  }

  const l = LESSON_BY_ID[lessonId];
  const idx = LESSONS.findIndex((x) => x.id === lessonId);
  if (content === undefined) return <main class="screen"><p role="status">Loading {l.lessonTitle}…</p></main>;
  if (content === null) {
    return (
      <main class="screen">
        <div class="panel"><h2>{l.lessonTitle}</h2><p>This lesson's content is still being reviewed.</p><button class="btn" onClick={() => go({ name: 'explorer' })}>Back</button></div>
      </main>
    );
  }
  const mastery = objectiveMastery(save, content.lesson, content.questions);
  const badge = lessonBadgeEarned(save, content.lesson, content.questions);

  return (
    <main class="screen explorer">
      <header class="screen-header">
        <button class="btn ghost small" onClick={() => go({ name: 'explorer' })}>← All lessons</button>
        <h1>Lesson {l.number}: {l.lessonTitle}</h1>
        {badge && <span class="chip star">Science Star</span>}
      </header>
      <p class="lead"><em>{content.lesson.guidingQuestion}</em></p>
      <section class="panel">
        <h2>Big ideas</h2>
        <ul>{content.lesson.keyIdeas.map((k) => <li>{formula(k)}</li>)}</ul>
      </section>
      {content.lesson.objectives.map((o) => {
        const card = content.lesson.explorer.find((c) => c.objectiveId === o.id);
        const m = mastery.find((x) => x.objectiveId === o.id)!;
        return (
          <section class="panel explorer-card" aria-labelledby={`obj-${o.id}`}>
            <div class="obj-head">
              <h2 id={`obj-${o.id}`}>{card?.title ?? o.text}</h2>
              <span class={m.met ? 'chip lit' : 'chip'}>{m.met ? 'Understanding shown' : `${m.familiesWithEvidence}/${m.needed} idea checks`}</span>
            </div>
            <p class="obj-text"><strong>Goal:</strong> {o.text}</p>
            {card?.paragraphs.map((p) => <p>{formula(p)}</p>)}
            {card?.diagram && <Diagram d={card.diagram} />}
            {card?.watchOut && <p class="watch-out"><strong>Watch out:</strong> {formula(card.watchOut)}</p>}
            <p class="source-note">Textbook pages {o.pages.printed.join(', ')} (PDF {o.pages.pdf.join(', ')})</p>
            <button class="btn secondary" onClick={() => {
              audio.start();
              const qs = selectQuestions(getSave(), lessonId, content.questions, { objectiveIds: [o.id], count: 3 });
              if (qs.length) setPractice({ objectiveId: o.id, questions: qs });
            }}>Check my understanding</button>
          </section>
        );
      })}
      <section class="panel">
        <h2>How Science Stars work</h2>
        <p>Only your first answer to each question counts, so repeating a question can't add evidence. Questions are grouped into idea families; a family counts once you answer one of its questions correctly without a hint. A Science Star needs that kind of evidence in at least two families for every goal in the lesson. Hinted answers are saved separately and come back later as a fresh question. This is a game's way of tracking practice, not a standardized test.</p>
      </section>
      <nav class="explorer-nav">
        {idx > 0 && <button class="btn ghost" onClick={() => go({ name: 'explorer', lessonId: LESSONS[idx - 1].id })}>← Lesson {idx}</button>}
        {idx < LESSONS.length - 1 && <button class="btn ghost" onClick={() => go({ name: 'explorer', lessonId: LESSONS[idx + 1].id })}>Lesson {idx + 2} →</button>}
      </nav>
      {practice && (
        <QuestionPanel
          modal
          title="Science Explorer check"
          subtitle={content.lesson.objectives.find((o) => o.id === practice.objectiveId)?.text}
          questions={practice.questions}
          narration={save.settings.narration}
          seed={Date.now() % 100000}
          onAnswer={(r) => {
            audio.play(r.correct ? 'correct' : 'incorrect');
            updateSave((d) => void recordResponse(d, r.question, r.correct, r.hinted), true);
          }}
          onDone={() => {
            setPractice(null);
            if (lessonBadgeEarned(getSave(), content.lesson, content.questions)) updateSave((d) => void (d.progress[lessonId].badge = true), true);
          }}
          onExit={() => setPractice(null)}
        />
      )}
    </main>
  );
}
