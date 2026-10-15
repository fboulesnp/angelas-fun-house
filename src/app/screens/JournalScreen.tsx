// Journal: progress, discoveries, glossary and personal bests, all local.

import { useEffect, useState } from 'preact/hooks';
import { LESSONS, LESSON_BY_ID, type LessonId } from '../../content/curriculum.ts';
import { hasLessonContent, loadLesson, type LoadedLesson } from '../../content/loader.ts';
import { TABLES } from '../../tables/index.ts';
import type { Route } from '../App.tsx';
import { useSave } from '../store.ts';
import { formula } from '../components/Diagram.tsx';

export function JournalScreen({ lessonId, go }: { lessonId?: LessonId; go(r: Route): void }) {
  const save = useSave();
  const [content, setContent] = useState<LoadedLesson | null>(null);
  useEffect(() => {
    if (lessonId) loadLesson(lessonId).then(setContent).catch(() => setContent(null));
  }, [lessonId]);

  if (lessonId) {
    const l = LESSON_BY_ID[lessonId];
    const def = TABLES[lessonId];
    const pr = save.progress[lessonId];
    const bests = save.bests[lessonId] ?? [];
    return (
      <main class="screen journal">
        <header class="screen-header">
          <button class="btn ghost small" onClick={() => go({ name: 'journal' })}>← Journal</button>
          <h1>{l.attractionTitle}</h1>
        </header>
        <p class="lead">Lesson {l.number}: {l.lessonTitle}</p>
        {def && (
          <section class="panel">
            <h2>Discoveries</h2>
            <ul>
              {def.missions.map((m, i) => (
                <li>{pr.missions[i] ? <><strong>{m.title}:</strong> {m.discovery}</> : <em>{m.title} — not discovered yet</em>}</li>
              ))}
            </ul>
          </section>
        )}
        {content && (
          <section class="panel">
            <h2>Glossary</h2>
            <dl class="glossary">
              {content.lesson.glossary.map((g) => (<><dt>{g.term}</dt><dd>{formula(g.definition)}</dd></>))}
            </dl>
          </section>
        )}
        <section class="panel">
          <h2>Personal bests</h2>
          {bests.length ? (
            <ol>{bests.map((b) => <li><strong>{b.score.toLocaleString()}</strong> · {b.mode}{b.practice ? ', practice' : ''}{b.continued ? ', continued run' : ''}{b.assists.length ? `, assists: ${b.assists.join(', ')}` : ''} · {new Date(b.at).toLocaleDateString()}</li>)}</ol>
          ) : <p>No scores yet.</p>}
        </section>
      </main>
    );
  }

  return (
    <main class="screen journal">
      <header class="screen-header">
        <button class="btn ghost small" onClick={() => go({ name: 'title' })}>← Title</button>
        <h1>Journal</h1>
      </header>
      <ul class="room-list">
        {LESSONS.map((l) => {
          const pr = save.progress[l.id];
          return (
            <li>
              <button class={`room ${pr.wonderlight ? 'lit' : ''}`} onClick={() => go({ name: 'journal', lessonId: l.id })}>
                <span class="room-num">{l.number}</span>
                <span class="room-text"><span class="room-attraction">{l.attractionTitle}</span><span class="room-lesson">{l.lessonTitle}</span></span>
                <span class="room-status">
                  <span class="chip">{pr.missions.filter(Boolean).length}/3 discoveries</span>
                  {pr.badge && <span class="chip star">Science Star</span>}
                  {!hasLessonContent(l.id) && <span class="chip">Glossary in review</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
