import { useEffect } from 'preact/hooks';
import { LESSONS, LESSON_BY_ID, type WingInfo } from '../../content/curriculum.ts';
import { audio } from '../../game/audio/audio.ts';
import { Angela, Pip, Quark } from '../components/Characters.tsx';

export function CelebrationScreen({ kind, wing, onDone }: { kind: 'wing' | 'finale'; wing?: WingInfo; onDone(): void }) {
  useEffect(() => {
    audio.setMusic('finale');
    audio.play('celebrate');
  }, []);
  const rooms = kind === 'finale' ? LESSONS : (wing?.lessons ?? []).map((id) => LESSON_BY_ID[id]);
  return (
    <main class="screen celebration">
      <div class="celebration-inner panel">
        <div class="title-cast" aria-hidden="true"><Quark size={70} /><Angela size={96} mood="wow" /><Pip size={70} /></div>
        <h1>{kind === 'finale' ? 'The whole Fun House is glowing!' : `${wing?.name} restored!`}</h1>
        <p>{kind === 'finale' ? 'All 29 Wonderlights shine again. Here comes the parade of every room you brought back to life:' : wing?.payoff}</p>
        <ol class="parade">
          {rooms.map((l, i) => <li style={{ animationDelay: `${i * 0.12}s` }}><strong>{l.attractionTitle}</strong> <span>{l.lessonTitle}</span></li>)}
        </ol>
        <button class="btn" autofocus onClick={onDone}>Back to the mansion</button>
      </div>
    </main>
  );
}
