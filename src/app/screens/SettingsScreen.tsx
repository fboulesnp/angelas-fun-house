// Settings: sound, comfort, accessibility, assistance, graphics, controls remapping, and
// save management (export / import / confirmed reset).

import { useState } from 'preact/hooks';
import { ACTION_LABELS, DEFAULT_BINDINGS, keyLabel, type Action } from '../../game/input/input.ts';
import { audio } from '../../game/audio/audio.ts';
import { exportSave, importSave, newSave } from '../../persistence/save.ts';
import { getSave, replaceSave, setSetting, storageAvailable, updateSave, useSave } from '../store.ts';
import { webglAvailable } from '../../game/render3d/stage.ts';

export function SettingsScreen({ back }: { back(): void }) {
  const save = useSave();
  const s = save.settings;
  const [listening, setListening] = useState<Action | null>(null);
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const capture = (a: Action) => {
    setListening(a);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      window.removeEventListener('keydown', onKey, true);
      setListening(null);
      if (e.code === 'Tab') return;
      updateSave((d) => {
        const b = { ...d.settings.bindings };
        for (const k of Object.keys(b) as Action[]) b[k] = b[k].filter((c) => c !== e.code);
        b[a] = [e.code, ...b[a].filter((c) => c !== e.code)].slice(0, 2);
        d.settings = { ...d.settings, bindings: b };
      });
      setMsg(`${ACTION_LABELS[a]} is now ${keyLabel(e.code)}.`);
    };
    window.addEventListener('keydown', onKey, true);
  };

  const doExport = () => {
    const blob = new Blob([exportSave(getSave())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `angelas-fun-house-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Progress exported to a file on this device.');
  };

  const doImport = (file: File) => {
    file.text().then((txt) => {
      try {
        replaceSave(importSave(txt));
        setMsg('Progress imported.');
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  };

  const vol = (k: 'musicVolume' | 'sfxVolume', label: string) => (
    <label class="field">
      {label}: {Math.round(s[k] * 100)}%
      <input type="range" min="0" max="1" step="0.05" value={s[k]} onInput={(e) => {
        const v = Number((e.target as HTMLInputElement).value);
        setSetting(k, v);
        audio[k] = v;
        audio.applyVolumes();
      }} />
    </label>
  );
  const toggle = (k: keyof typeof s, label: string, note?: string) => (
    <label class="toggle">
      <span>{label}{note && <small class="field-note">{note}</small>}</span>
      <input type="checkbox" checked={!!s[k]} onChange={() => setSetting(k, !s[k] as never)} />
    </label>
  );

  return (
    <main class="screen settings">
      <header class="screen-header">
        <button class="btn ghost small" onClick={back}>← Back</button>
        <h1>Settings</h1>
      </header>
      <p class="sr-status" role="status" aria-live="polite">{msg}</p>
      <div class="settings-grid">
        <section class="panel">
          <h2>Sound</h2>
          {toggle('muted', 'Mute everything')}
          {vol('musicVolume', 'Music')}
          {vol('sfxVolume', 'Sound effects')}
          {toggle('soundCaptions', 'Sound captions', 'Shows a short text caption for meaningful sounds.')}
          {toggle('narration', 'Read questions aloud', "Uses your device's built-in voice (no internet service).")}
        </section>
        <section class="panel">
          <h2>Comfort and reading</h2>
          <label class="field">Motion
            <select value={s.motion} onChange={(e) => setSetting('motion', (e.target as HTMLSelectElement).value as 'system')}>
              <option value="system">Follow my device</option>
              <option value="reduce">Reduced motion (calm changes, no camera moves or shaking)</option>
              <option value="full">Full motion</option>
            </select>
          </label>
          <label class="field">Text size: {Math.round(s.textScale * 100)}%
            <input type="range" min="1" max="1.6" step="0.1" value={s.textScale} onInput={(e) => setSetting('textScale', Number((e.target as HTMLInputElement).value))} />
          </label>
          {toggle('highContrast', 'High contrast panels')}
          <label class="field">Ball trail: {Math.round(s.trailLength * 100)}%
            <input type="range" min="0" max="1" step="0.1" value={s.trailLength} onInput={(e) => setSetting('trailLength', Number((e.target as HTMLInputElement).value))} />
          </label>
        </section>
        <section class="panel">
          <h2>Assistance</h2>
          <p class="field-note">Assistance never blocks learning or story progress. Scores record which assists were on.</p>
          {toggle('autoFlip', 'Auto-flippers', 'Flippers fire by themselves when the ball arrives.')}
          {toggle('wideFlippers', 'Wider flippers')}
          {toggle('longBallSave', 'Longer ball save')}
          <label class="field">Simulation speed: {Math.round(s.simSpeed * 100)}%
            <input type="range" min="0.6" max="1" step="0.05" value={s.simSpeed} onInput={(e) => setSetting('simSpeed', Number((e.target as HTMLInputElement).value))} />
          </label>
          {toggle('nudge', 'Allow nudging', 'Optional; it never affects missions or questions.')}
          <label class="field">Free Play questions
            <select value={String(s.freeTrivia)} onChange={(e) => setSetting('freeTrivia', Number((e.target as HTMLSelectElement).value) as 0)}>
              <option value="0">Off</option>
              <option value="1">Some (one per discovery)</option>
              <option value="2">Lots (two per discovery)</option>
            </select>
          </label>
        </section>
        <section class="panel">
          <h2>Graphics</h2>
          <label class="field">View
            <select value={s.renderer} onChange={(e) => setSetting('renderer', (e.target as HTMLSelectElement).value as '3d')}>
              <option value="3d" disabled={!webglAvailable()}>Full 3D{webglAvailable() ? '' : ' (not supported here)'}</option>
              <option value="2d">Classic 2D (lightest)</option>
            </select>
          </label>
          <label class="field">3D quality
            <select value={s.quality} onChange={(e) => setSetting('quality', (e.target as HTMLSelectElement).value as 'auto')}>
              <option value="auto">Automatic (adapts to your device)</option>
              <option value="ultra">Ultra (ambient occlusion, 4K shadows)</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low (fastest)</option>
            </select>
          </label>
          <label class="field">Camera
            <select value={s.camera} onChange={(e) => setSetting('camera', (e.target as HTMLSelectElement).value as 'cabinet')}>
              <option value="cabinet">Cabinet</option>
              <option value="overhead">Overhead (easiest to read)</option>
              <option value="low">Low and dramatic</option>
            </select>
          </label>
          {toggle('showDebug', 'Show collision debug (2D view)')}
        </section>
        <section class="panel">
          <h2>Controls</h2>
          <p class="field-note">Choose an action, then press the key you want. Gamepads: bumpers or triggers flip, A launches, Start pauses.</p>
          <ul class="bindings">
            {(Object.keys(ACTION_LABELS) as Action[]).map((a) => (
              <li>
                <span>{ACTION_LABELS[a]}</span>
                <span>{s.bindings[a].map((c) => <span class="kbd">{keyLabel(c)}</span>)}</span>
                <button class="btn small secondary" onClick={() => capture(a)}>{listening === a ? 'Press a key…' : 'Change'}</button>
              </li>
            ))}
          </ul>
          <button class="btn small ghost" onClick={() => { setSetting('bindings', structuredClone(DEFAULT_BINDINGS)); setMsg('Controls reset to defaults.'); }}>Reset controls</button>
        </section>
        <section class="panel">
          <h2>Progress and saving</h2>
          <p class="field-note">
            Everything stays on this device. No account, no tracking, nothing sent anywhere.
            {!storageAvailable && ' This browser is not keeping saves, so export before closing.'}
          </p>
          <label class="field">Nickname (optional, stays on this device)
            <input type="text" maxLength={24} value={save.nickname} onInput={(e) => updateSave((d) => void (d.nickname = (e.target as HTMLInputElement).value))} />
          </label>
          <div class="intro-actions">
            <button class="btn small secondary" onClick={doExport}>Export progress</button>
            <label class="btn small secondary">
              Import progress
              <input type="file" accept="application/json,.json" class="visually-hidden" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) doImport(f); }} />
            </label>
            {!confirmReset ? (
              <button class="btn small ghost" onClick={() => setConfirmReset(true)}>Reset all progress…</button>
            ) : (
              <span class="confirm">
                <strong>Erase all missions, Wonderlights and learning records?</strong>
                <button class="btn small" onClick={() => { replaceSave(newSave()); setConfirmReset(false); setMsg('All progress was reset.'); }}>Yes, erase</button>
                <button class="btn small ghost" onClick={() => setConfirmReset(false)}>Keep my progress</button>
              </span>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
