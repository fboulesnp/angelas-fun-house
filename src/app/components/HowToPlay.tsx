// Replayable controls tutorial + the first-visit opening story.

import { useEffect, useRef } from 'preact/hooks';
import { keyLabel } from '../../game/input/input.ts';
import { useSave } from '../store.ts';
import { Angela, Pip, Quark } from './Characters.tsx';

function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('h2')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  return ref;
}

export function HowToPlay({ onClose }: { onClose(): void }) {
  const save = useSave();
  const b = save.settings.bindings;
  const ref = useDialogFocus(onClose);
  const k = (codes: string[]) => codes.map((c) => <span class="kbd">{keyLabel(c)}</span>);
  return (
    <div class="modal-backdrop">
      <div class="modal panel howto" role="dialog" aria-modal="true" aria-labelledby="howto-title" ref={ref}>
        <h2 id="howto-title" tabIndex={-1}>How to play</h2>
        <div class="howto-grid">
          <section>
            <h3>Controls</h3>
            <ul>
              <li>Flippers: {k(b.left)} and {k(b.right)}</li>
              <li>Launch: hold {k(b.plunger)} to pull the plunger, let go to fire. A longer pull launches harder.</li>
              <li>Pause: {k(b.pause)} · Nudge (optional): {k(b.nudge)}</li>
              <li>Touch: tap or hold the left/right side of the table (or the ◀ ▶ buttons). Tap Launch for a quick launch, hold it for power.</li>
              <li>Gamepad: bumpers or triggers flip, A launches, Start pauses.</li>
            </ul>
          </section>
          <section>
            <h3>Your goal</h3>
            <ul>
              <li>Each room is an attraction with <strong>three missions</strong>. The mission card shows what to hit next, and flashing arrows on the table point to useful shots.</li>
              <li>When the <strong>Wonder Pocket</strong> lights, shoot the ball into it. Everything freezes while you read a discovery question — no timer, take your time.</li>
              <li>Finish all three missions and the finale to restore the room's <strong>Wonderlight</strong>.</li>
              <li>Wrong answers never cost balls or progress. You get the key idea, and a fresh question on it comes back later.</li>
            </ul>
          </section>
          <section>
            <h3>Pinball tips</h3>
            <ul>
              <li><strong>Cradle:</strong> hold a flipper up as the ball arrives so it rests there. Then let go and flip again to aim.</li>
              <li>Hitting the ball near the flipper tip sends it faster; flipping later aims it more across the table.</li>
              <li>A soft plunge can drop into the top lanes for a skill shot.</li>
              <li>After three balls you can keep going — your missions and learning stay saved.</li>
            </ul>
          </section>
          <section>
            <h3>Need a hand?</h3>
            <ul>
              <li>Settings has auto-flippers, wider flippers, a longer ball save, a slower simulation, practice with unlimited balls, reduced motion, bigger text and sound captions.</li>
              <li><strong>Science Explorer</strong> covers every lesson with no flippers at all.</li>
            </ul>
          </section>
        </div>
        <button class="btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

export function OpeningStory({ onClose }: { onClose(): void }) {
  const ref = useDialogFocus(onClose);
  return (
    <div class="modal-backdrop">
      <div class="modal panel opening" role="dialog" aria-modal="true" aria-labelledby="open-title" ref={ref}>
        <div class="title-cast" aria-hidden="true">
          <Quark size={64} />
          <Angela size={92} mood="wow" />
          <Pip size={64} />
        </div>
        <h2 id="open-title" tabIndex={-1}>The Wonderlights have gone out!</h2>
        <p>
          Welcome to my Fun House! Every room in here is a miniature attraction: a carnival of atoms, a
          conservatory that runs on sunlight, a harbor, a canyon, a whole garden of tomorrow. Each one
          glowed with a <strong>Wonderlight</strong>, and last night every single one went dark.
        </p>
        <p>
          The lights come back when we figure out the science that makes each room work. Pip will point out
          the useful shots, and Professor Quark… well, Quark has <em>theories</em>. Let's test them.
        </p>
        <p class="small-note">You can visit the rooms in any order. Your progress saves on this device.</p>
        <div class="intro-actions">
          <button class="btn" onClick={onClose}>Let's light them up</button>
        </div>
      </div>
    </div>
  );
}
