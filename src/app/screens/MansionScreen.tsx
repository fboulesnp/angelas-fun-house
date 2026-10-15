// The mansion: the living dollhouse map (3D) and an accessible list view with identical access.

import { useEffect, useState } from 'preact/hooks';
import { LESSONS, WINGS, type LessonId } from '../../content/curriculum.ts';
import type { PlayMode } from '../../game/rules/session.ts';
import { TABLES } from '../../tables/index.ts';
import type { Route } from '../App.tsx';
import { updateSave, useSave } from '../store.ts';
import { DollhouseMap } from '../components/DollhouseMap.tsx';
import { webglAvailable } from '../../game/render3d/stage.ts';

interface Props {
  mode: PlayMode;
  initialView?: 'map' | 'list';
  go(r: Route): void;
}

const MODE_LABEL: Record<PlayMode, string> = {
  story: 'Story Adventure',
  chapter: 'Choose a Chapter',
  free: 'Free Play',
  explorer: 'Science Explorer',
};

export function MansionScreen({ mode, initialView, go }: Props) {
  const save = useSave();
  const canMap = webglAvailable();
  const [view, setView] = useState<'map' | 'list'>(initialView ?? (canMap ? 'map' : 'list'));
  const [practice, setPractice] = useState(false);
  const lit = LESSONS.filter((l) => save.progress[l.id].wonderlight).length;
  const suggested = LESSONS.find((l) => !save.progress[l.id].wonderlight)?.id ?? 'L01';

  useEffect(() => {
    if (mode !== 'story') return;
    const wing = WINGS.find((w) => w.lessons.includes(suggested));
    if (wing && !save.wingIntrosSeen[wing.id]) setIntro(wing.id);
  }, []);
  const [intro, setIntro] = useState<string | null>(null);

  const open = (id: LessonId) => go({ name: 'play', lessonId: id, mode, practice });

  return (
    <main class="screen mansion">
      <header class="screen-header">
        <button class="btn ghost small" onClick={() => go({ name: 'title' })}>← Title</button>
        <h1>{MODE_LABEL[mode]}</h1>
        <span class="chip" aria-label={`${lit} of 29 Wonderlights restored`}>★ {lit}/29</span>
      </header>
      <div class="mansion-tools">
        <div class="seg" role="group" aria-label="View">
          <button class={view === 'map' ? 'seg-btn on' : 'seg-btn'} aria-pressed={view === 'map'} disabled={!canMap} onClick={() => setView('map')}>Dollhouse map</button>
          <button class={view === 'list' ? 'seg-btn on' : 'seg-btn'} aria-pressed={view === 'list'} onClick={() => setView('list')}>List view</button>
        </div>
        {mode !== 'free' && (
          <label class="toggle compact">
            <input type="checkbox" checked={practice} onChange={() => setPractice(!practice)} /> Practice (unlimited balls)
          </label>
        )}
        {mode === 'story' && <p class="mansion-hint">Suggested next room: <strong>{LESSONS.find((l) => l.id === suggested)!.attractionTitle}</strong>. Every room is open — explore in any order.</p>}
        {mode === 'free' && <p class="mansion-hint">Free Play is for pinball fun. Questions follow your Free Play trivia setting; adventure progress is not changed.</p>}
      </div>

      {view === 'map' && canMap ? (
        <DollhouseMap onOpen={open} suggested={suggested} />
      ) : (
        <div class="wing-list">
          {WINGS.map((w) => {
            const wl = w.lessons.filter((id) => save.progress[id].wonderlight).length;
            return (
              <section class="wing panel" aria-labelledby={`wing-${w.id}`}>
                <h2 id={`wing-${w.id}`}>{w.name}</h2>
                <p class="wing-seg">Segment {w.segmentNumber}: {w.segment} · {wl}/{w.lessons.length} restored</p>
                <ul class="room-list">
                  {w.lessons.map((id) => {
                    const l = LESSONS.find((x) => x.id === id)!;
                    const pr = save.progress[id];
                    const built = !!TABLES[id];
                    const done = pr.missions.filter(Boolean).length;
                    return (
                      <li>
                        <button class={`room ${pr.wonderlight ? 'lit' : ''} ${id === suggested && mode === 'story' ? 'suggested' : ''}`} onClick={() => open(id)} disabled={!built}>
                          <span class="room-num">{l.number}</span>
                          <span class="room-text">
                            <span class="room-attraction">{l.attractionTitle}</span>
                            <span class="room-lesson">{l.lessonTitle}</span>
                          </span>
                          <span class="room-status">
                            {pr.wonderlight ? <span class="chip lit">★ Wonderlight</span> : <span class="chip">{done}/3 missions</span>}
                            {pr.badge && <span class="chip star">Science Star</span>}
                            {!built && <span class="chip">Under construction</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {intro && (
        <div class="modal-backdrop">
          <div class="modal panel" role="dialog" aria-modal="true" aria-labelledby="wing-intro">
            {(() => {
              const w = WINGS.find((x) => x.id === intro)!;
              return (
                <>
                  <h2 id="wing-intro">{w.name}</h2>
                  <p><strong>Segment {w.segmentNumber}: {w.segment}</strong></p>
                  <p>The rooms of this wing have lost their Wonderlights. {w.payoff}</p>
                  <button class="btn" autofocus onClick={() => { updateSave((d) => void (d.wingIntrosSeen[w.id] = true)); setIntro(null); }}>Let's go</button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
