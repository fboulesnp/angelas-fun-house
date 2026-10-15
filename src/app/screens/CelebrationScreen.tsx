import { useEffect, useState } from 'preact/hooks';
import { LESSONS, LESSON_BY_ID, type LessonId, type WingInfo } from '../../content/curriculum.ts';
import { audio } from '../../game/audio/audio.ts';
import { webglAvailable } from '../../game/render3d/stage.ts';
import { Angela, Pip, Quark } from '../components/Characters.tsx';
import { MansionView } from '../components/DollhouseMap.tsx';
import { prefersReducedMotion, useSave } from '../store.ts';

/** Wing celebration or the whole-house finale: a 3D parade of restored rooms. */
export function CelebrationScreen({ kind, wing, onDone }: { kind: 'wing' | 'finale'; wing?: WingInfo; onDone(): void }) {
  const save = useSave();
  const rooms = kind === 'finale' ? LESSONS : (wing?.lessons ?? []).map((id) => LESSON_BY_ID[id]);
  const [current, setCurrent] = useState<LessonId | null>(null);
  const [finished, setFinished] = useState(false);
  const tour = webglAvailable() && !prefersReducedMotion(save.settings);
  useEffect(() => {
    audio.setMusic('finale');
    audio.play('celebrate');
  }, []);
  const title = kind === 'finale' ? 'The whole Fun House is glowing!' : `${wing?.name} restored!`;
  const sub = kind === 'finale'
    ? 'All 29 Wonderlights shine again. Here comes the parade of every room you brought back to life.'
    : wing?.payoff;
  const cur = current ? LESSON_BY_ID[current] : null;
  return (
    <main class="screen celebration">
      {tour && (
        <div class="celebration-stage">
          <MansionView
            mode="map"
            parade={{ ids: rooms.map((r) => r.id), onRoom: (id) => { setCurrent(id); audio.play('phrase', (rooms.findIndex((r) => r.id === id) % 12) + 1); }, onDone: () => { setFinished(true); audio.play('resolve'); } }}
          />
          <div class="parade-caption" aria-live="polite">
            {cur && !finished && <><strong>{cur.attractionTitle}</strong><span>Lesson {cur.number}: {cur.lessonTitle}</span></>}
            {finished && <strong>{title}</strong>}
          </div>
        </div>
      )}
      <div class={`celebration-inner panel ${tour ? 'compact' : ''}`}>
        <div class="title-cast" aria-hidden="true"><Quark size={56} /><Angela size={76} mood="wow" /><Pip size={56} /></div>
        <h1>{title}</h1>
        <p>{sub}</p>
        {!tour && (
          <ol class="parade">
            {rooms.map((l, i) => <li style={{ animationDelay: `${i * 0.12}s` }}><strong>{l.attractionTitle}</strong> <span>{l.lessonTitle}</span></li>)}
          </ol>
        )}
        <button class="btn" autofocus onClick={onDone}>{tour && !finished ? 'Skip to the mansion' : 'Back to the mansion'}</button>
      </div>
    </main>
  );
}
