// Journal: progress, discoveries, glossary and personal bests, all local.

import { useEffect, useState } from 'preact/hooks';
import { LESSONS, LESSON_BY_ID, type LessonId } from '../../content/curriculum.ts';
import { hasLessonContent, loadLesson, type LoadedLesson } from '../../content/loader.ts';
import { loadTable } from '../../tables/index.ts';
import type { TableDef } from '../../game/table/tableDef.ts';
import type { Route } from '../App.tsx';
import { useSave } from '../store.ts';
import { formula } from '../components/Diagram.tsx';

export function JournalScreen({ lessonId, go }: { lessonId?: LessonId; go(r: Route): void }) {
  const save = useSave();
  const [content, setContent] = useState<LoadedLesson | null>(null);
  const [def, setDef] = useState<TableDef | null>(null);
  useEffect(() => {
    if (!lessonId) return;
    loadLesson(lessonId).then(setContent).catch(() => setContent(null));
    loadTable(lessonId).then(setDef);
  }, [lessonId]);

  if (lessonId) {
    const l = LESSON_BY_ID[lessonId];
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
            <h2>Discovery stickers</h2>
            <div class="stickers" role="list">
              {def.missions.map((m, i) => (
                <div role="listitem" class={pr.missions[i] ? 'sticker' : 'sticker empty'}>
                  {pr.missions[i] ? <><div>★ {m.title}</div><p class="small-note">{m.discovery}</p></> : <><div>{m.title}</div><p class="small-note">Not discovered yet</p></>}
                </div>
              ))}
              <div role="listitem" class={pr.wonderlight ? 'sticker' : 'sticker empty'}>
                {pr.wonderlight ? <><div>✦ Wonderlight</div><p class="small-note">{def.finale.celebration}</p></> : <><div>Wonderlight</div><p class="small-note">Finish the finale</p></>}
              </div>
            </div>
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
      <p class="lead">Discovery stickers collected: {LESSONS.reduce((n, l) => n + save.progress[l.id].missions.filter(Boolean).length, 0)} of 87 · Wonderlights: {LESSONS.filter((l) => save.progress[l.id].wonderlight).length} of 29</p>
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
