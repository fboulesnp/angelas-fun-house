// App shell: screen routing, global preferences on <html>, and adventure-level events
// (wing celebrations, whole-house finale).

import { useEffect, useErrorBoundary, useState } from 'preact/hooks';
import { LESSONS, WINGS, wingOf, type LessonId, type WingId } from '../content/curriculum.ts';
import type { PlayMode } from '../game/rules/session.ts';
import { audio } from '../game/audio/audio.ts';
import { prefersReducedMotion, startupNotice, updateSave, useSave } from './store.ts';
import { GameScreen } from './screens/GameScreen.tsx';
import { TitleScreen } from './screens/TitleScreen.tsx';
import { MansionScreen } from './screens/MansionScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { ExplorerScreen } from './screens/ExplorerScreen.tsx';
import { JournalScreen } from './screens/JournalScreen.tsx';
import { CelebrationScreen } from './screens/CelebrationScreen.tsx';

export type Route =
  | { name: 'title' }
  | { name: 'mansion'; mode: PlayMode; view?: 'map' | 'list' }
  | { name: 'play'; lessonId: LessonId; mode: PlayMode; practice: boolean }
  | { name: 'explorer'; lessonId?: LessonId }
  | { name: 'journal'; lessonId?: LessonId }
  | { name: 'settings'; back: Route }
  | { name: 'celebrate'; kind: 'wing' | 'finale'; wing?: WingId; back: Route };

function initialRoute(): Route {
  const q = new URLSearchParams(location.search);
  const t = q.get('table') as LessonId | null;
  if (t && LESSONS.some((l) => l.id === t)) return { name: 'play', lessonId: t, mode: 'chapter', practice: q.has('practice') };
  const c = q.get('celebrate');
  if (c === 'finale') return { name: 'celebrate', kind: 'finale', back: { name: 'title' } };
  if (c && WINGS.some((w) => w.id === c)) return { name: 'celebrate', kind: 'wing', wing: c as WingId, back: { name: 'title' } };
  return { name: 'title' };
}

/** Friendly recovery instead of a blank screen if any screen throws. */
function Recovery({ error, reset }: { error: Error; reset(): void }) {
  return (
    <main class="screen">
      <div class="panel" role="alert" style={{ maxWidth: '640px', margin: '10vh auto' }}>
        <h1>Oops — a Wonderlight flickered</h1>
        <p>Something went wrong while showing this screen. Your saved missions and discoveries are safe.</p>
        <p class="small-note">Details: {error.message}</p>
        <div class="intro-actions">
          <button class="btn" onClick={reset}>Back to the title</button>
          <button class="btn ghost" onClick={() => location.reload()}>Reload the game</button>
        </div>
      </div>
    </main>
  );
}

export function App() {
  const [error, resetError] = useErrorBoundary((e) => console.error('[AFH] screen error', e));
  const save = useSave();
  const [route, setRoute] = useState<Route>(initialRoute);
  const [notice, setNotice] = useState(startupNotice);
  const s = save.settings;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--text-scale', String(s.textScale));
    root.dataset.contrast = s.highContrast ? 'high' : 'normal';
    root.dataset.motion = prefersReducedMotion(s) ? 'reduce' : 'full';
    audio.muted = s.muted;
    audio.musicVolume = s.musicVolume;
    audio.sfxVolume = s.sfxVolume;
    audio.captions = s.soundCaptions;
    audio.applyVolumes();
  }, [s]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (route.name === 'title') audio.setMusic('title');
    else if (route.name === 'mansion' || route.name === 'journal' || route.name === 'explorer') audio.setMusic('map');
  }, [route.name]);

  /** After a Wonderlight: wing celebration when a wing completes, finale when all 29 are lit. */
  const afterWonderlight = (lessonId: LessonId) => {
    const d = save;
    const wing = wingOf(lessonId);
    const back: Route = { name: 'mansion', mode: 'story' };
    const allLit = LESSONS.every((l) => d.progress[l.id].wonderlight);
    const wingDone = wing.lessons.every((id) => d.progress[id].wonderlight);
    if (allLit && !d.finaleSeen) {
      if (wingDone && !d.wingsCelebrated[wing.id]) updateSave((x) => void (x.wingsCelebrated[wing.id] = true));
      setRoute({ name: 'celebrate', kind: 'finale', back });
    } else if (wingDone && !d.wingsCelebrated[wing.id]) {
      setRoute({ name: 'celebrate', kind: 'wing', wing: wing.id, back });
    } else setRoute(back);
  };

  let screen;
  switch (route.name) {
    case 'title':
      screen = <TitleScreen go={setRoute} />;
      break;
    case 'mansion':
      screen = <MansionScreen mode={route.mode} initialView={route.view} go={setRoute} />;
      break;
    case 'play':
      screen = (
        <GameScreen
          key={`${route.lessonId}-${route.mode}`}
          lessonId={route.lessonId}
          mode={route.mode}
          practice={route.practice}
          onExit={() => setRoute({ name: 'mansion', mode: route.mode === 'free' ? 'free' : route.mode })}
          onWonderlight={afterWonderlight}
        />
      );
      break;
    case 'explorer':
      screen = <ExplorerScreen lessonId={route.lessonId} go={setRoute} />;
      break;
    case 'journal':
      screen = <JournalScreen lessonId={route.lessonId} go={setRoute} />;
      break;
    case 'settings':
      screen = <SettingsScreen back={() => setRoute(route.back)} />;
      break;
    case 'celebrate':
      screen = (
        <CelebrationScreen
          kind={route.kind}
          wing={route.wing ? WINGS.find((w) => w.id === route.wing) : undefined}
          onDone={() => {
            updateSave((d) => {
              if (route.kind === 'wing' && route.wing) d.wingsCelebrated[route.wing] = true;
              if (route.kind === 'finale') d.finaleSeen = true;
            }, true);
            setRoute(route.back);
          }}
        />
      );
      break;
  }

  if (error) {
    return <Recovery error={error as Error} reset={() => { setRoute({ name: 'title' }); resetError(); }} />;
  }
  return (
    <>
      {screen}
      {notice && (
        <div class="notice-toast" role="alert">
          <p>{notice}</p>
          <button class="btn small" onClick={() => setNotice(undefined)}>OK</button>
        </div>
      )}
    </>
  );
}
