import type { Route } from '../App.tsx';
import { Angela, Pip, Quark } from '../components/Characters.tsx';
import { MansionView } from '../components/DollhouseMap.tsx';
import { audio } from '../../game/audio/audio.ts';
import { useSave } from '../store.ts';
import { LESSONS } from '../../content/curriculum.ts';
import { webglAvailable } from '../../game/render3d/stage.ts';

export function TitleScreen({ go }: { go(r: Route): void }) {
  const save = useSave();
  const lit = LESSONS.filter((l) => save.progress[l.id].wonderlight).length;
  const begin = (r: Route) => {
    audio.start();
    audio.setMusic('map');
    go(r);
  };
  return (
    <main class="title-screen">
      {webglAvailable() && <MansionView mode="title" />}
      <div class="title-overlay">
        <div class="marquee" role="img" aria-label="Angela's Fun House: Where curiosity lights up the world">
          <div class="marquee-bulbs" aria-hidden="true" />
          <h1 class="marquee-title" aria-hidden="true">Angela's <span>Fun House</span></h1>
          <p class="marquee-sub" aria-hidden="true">Where curiosity lights up the world.</p>
        </div>
        <div class="title-cast" aria-hidden="true">
          <Quark size={72} />
          <Angela size={100} />
          <Pip size={72} />
        </div>
        <nav class="title-menu" aria-label="Main menu">
          <button class="btn" onClick={() => begin({ name: 'mansion', mode: 'story' })}>Story Adventure</button>
          <button class="btn secondary" onClick={() => begin({ name: 'mansion', mode: 'chapter', view: 'list' })}>Choose a Chapter</button>
          <button class="btn secondary" onClick={() => begin({ name: 'mansion', mode: 'free', view: 'list' })}>Free Play</button>
          <button class="btn secondary" onClick={() => begin({ name: 'explorer' })}>Science Explorer</button>
          <div class="title-row">
            <button class="btn ghost small" onClick={() => go({ name: 'journal' })}>Journal</button>
            <button class="btn ghost small" onClick={() => go({ name: 'settings', back: { name: 'title' } })}>Settings</button>
          </div>
        </nav>
        <p class="title-progress">{lit} of 29 Wonderlights restored</p>
      </div>
    </main>
  );
}
