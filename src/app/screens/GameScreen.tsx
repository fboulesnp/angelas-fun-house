// GameScreen: hosts one attraction. The simulation loop lives in refs, outside Preact renders;
// the HUD samples it a few times per second.

import { useEffect, useRef, useState } from 'preact/hooks';
import { LESSON_BY_ID, wingOf, type LessonId } from '../../content/curriculum.ts';
import { loadLesson, type LoadedLesson } from '../../content/loader.ts';
import { audio } from '../../game/audio/audio.ts';
import { InputController, keyLabel } from '../../game/input/input.ts';
import { GameLoop } from '../../game/loop.ts';
import { Renderer } from '../../game/render/renderer.ts';
import { Renderer3D, type TableRenderer } from '../../game/render3d/renderer3d.ts';
import { detectQuality, webglAvailable, type Quality } from '../../game/render3d/stage.ts';
import { GameSession, type Callout, type GameState, type PlayMode, type QuestionOutcome, type QuestionRequest } from '../../game/rules/session.ts';
import { lessonBadgeEarned, recordResponse, selectQuestions } from '../../learning/engine.ts';
import { loadTable } from '../../tables/index.ts';
import type { TableDef } from '../../game/table/tableDef.ts';
import { getSave, prefersReducedMotion, setSetting, updateSave, useSave } from '../store.ts';
import { Angela, Quark, Speaker } from '../components/Characters.tsx';
import { QuestionPanel, type PanelResult } from '../components/QuestionPanel.tsx';
import { HowToPlay } from '../components/HowToPlay.tsx';
import { trailFor, trimFor } from '../cosmetics.ts';
import type { Question } from '../../content/schema.ts';

interface Props {
  lessonId: LessonId;
  mode: PlayMode;
  practice: boolean;
  onExit(): void;
  onWonderlight(lessonId: LessonId): void;
}

interface HudState {
  score: number;
  ball: number;
  balls: number;
  state: GameState;
  missionTitle: string;
  stageText: string;
  progress: string;
  slot: number;
  completed: boolean[];
  finaleDone: boolean;
  countdown: number;
  saveActive: boolean;
  tilt: number;
  ballInLane: boolean;
  multiball: boolean;
  /** A live ball is in the top of the table (callouts fade so they never hide it). */
  ballNearTop: boolean;
  run: number;
  continued: boolean;
}

interface Ask {
  req: QuestionRequest;
  questions: Question[];
  resolve(o: QuestionOutcome[]): void;
}

let calloutId = 0;

export function GameScreen(p: Props) {
  const save = useSave();
  const settings = save.settings;
  const lesson = LESSON_BY_ID[p.lessonId];
  const [def, setDef] = useState<TableDef | null | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const leftZone = useRef<HTMLDivElement>(null);
  const rightZone = useRef<HTMLDivElement>(null);
  const plungerBtn = useRef<HTMLButtonElement>(null);
  const leftBtn = useRef<HTMLButtonElement>(null);
  const rightBtn = useRef<HTMLButtonElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const rendererRef = useRef<TableRenderer | null>(null);
  const loopRef = useRef<GameLoop | null>(null);
  const inputRef = useRef<InputController | null>(null);
  const shownRef = useRef<string[]>([]);
  const [content, setContent] = useState<LoadedLesson | null | undefined>(undefined);
  const [phase, setPhase] = useState<'intro' | 'playing'>('intro');
  const [hud, setHud] = useState<HudState | null>(null);
  const [callouts, setCallouts] = useState<(Callout & { id: number })[]>([]);
  const [caption, setCaption] = useState('');
  const [ask, setAsk] = useState<Ask | null>(null);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [wonder, setWonder] = useState(false);
  const [howto, setHowto] = useState(false);
  const [error, setError] = useState('');
  const [rendererKind, setRendererKind] = useState<'3d' | '2d'>('3d');
  const [quality, setQuality] = useState<Quality>('high');
  const reduced = prefersReducedMotion(settings);
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    let alive = true;
    loadLesson(p.lessonId).then((c) => alive && setContent(c)).catch(() => alive && setContent(null));
    loadTable(p.lessonId).then((d) => alive && setDef(d));
    updateSave((d) => {
      d.progress[p.lessonId].visited = true;
    });
    return () => {
      alive = false;
    };
  }, [p.lessonId]);

  const pushCallout = (c: Callout) => {
    const id = ++calloutId;
    setCallouts((cs) => [...cs.slice(-2), { ...c, id }]);
    window.setTimeout(() => setCallouts((cs) => cs.filter((x) => x.id !== id)), (c.seconds ?? 2.4) * 1000);
  };

  // ------------------------------------------------------------------ start the attraction

  const start = () => {
    if (!def || !canvasRef.current) return;
    audio.start();
    audio.muted = settings.muted;
    audio.musicVolume = settings.musicVolume;
    audio.sfxVolume = settings.sfxVolume;
    audio.captions = settings.soundCaptions;
    audio.onCaption = (t) => {
      setCaption(t);
      window.setTimeout(() => setCaption((c) => (c === t ? '' : c)), 1600);
    };
    audio.applyVolumes();
    audio.setMusic(wingOf(p.lessonId).id, lesson.number);
    const prog = getSave().progress[p.lessonId];
    const isFree = p.mode === 'free';
    const session = new GameSession(def, {
      mode: p.mode,
      practice: p.practice,
      balls: 3,
      ballSaveSeconds: settings.longBallSave ? 25 : 12,
      triviaLevel: isFree ? settings.freeTrivia : content ? 1 : 0,
      nudgeEnabled: settings.nudge,
      autoFlip: settings.autoFlip,
      flipperWidth: settings.wideFlippers ? 1.35 : 1,
      completedMissions: isFree ? [] : prog.missions,
      answerLanes: settings.answerLanes,
      finaleDone: isFree ? false : prog.wonderlight,
    }, {
      askQuestions: (req) =>
        new Promise<QuestionOutcome[]>((resolve) => {
          const bank = content?.questions ?? [];
          // Use the table's objectives when they exist in this lesson; otherwise objectives of the
          // mission's kind; the finale draws from every objective.
          const all = content?.lesson.objectives ?? [];
          let objectiveIds = req.objectiveIds.filter((id) => all.some((o) => o.id === id));
          if (!objectiveIds.length && req.kind !== 'finale') objectiveIds = all.filter((o) => o.kind === req.kind).map((o) => o.id);
          if (!objectiveIds.length || req.kind === 'finale') objectiveIds = req.kind === 'finale' ? all.map((o) => o.id) : objectiveIds;
          const qs = selectQuestions(getSave(), p.lessonId, bank, { objectiveIds, count: req.count, preferTypes: req.preferTypes, avoid: shownRef.current });
          if (!qs.length) {
            resolve([]);
            return;
          }
          shownRef.current.push(...qs.map((q) => q.id));
          inputRef.current && (inputRef.current.active = false);
          inputRef.current?.releaseAll();
          audio.duck(true);
          setAsk({ req, questions: qs, resolve });
        }),
      onCallout: pushCallout,
      onSound: (name, value) => audio.play(name, value),
      onMissionComplete: (slot) => {
        if (isFree) return;
        updateSave((d) => {
          d.progress[p.lessonId].missions[slot] = true;
        }, true);
        audio.intensity = Math.min(1, 0.35 + 0.2 * (slot + 1));
      },
      onWonderlight: () => {
        if (isFree) return;
        updateSave((d) => {
          const pr = d.progress[p.lessonId];
          pr.wonderlight = true;
          pr.wonderlightAt = pr.wonderlightAt ?? new Date().toISOString();
          pr.missions = [true, true, true];
        }, true);
        window.setTimeout(() => setWonder(true), 6500);
        audio.setMusic('finale', lesson.number);
      },
      onGameOver: (score) => {
        recordBest(score, session);
        setGameOver(true);
        inputRef.current && (inputRef.current.active = false);
      },
      onFx: (kind, x, y, v) => rendererRef.current?.fx(kind, x, y, v),
      onEvent: (e) => {
        if (e.type === 'bumper' || e.type === 'sling' || e.type === 'target') rendererRef.current?.fx('hit', e.x, e.y);
        if (e.type === 'dropBank' || e.type === 'ramp') rendererRef.current?.fx('burst', e.x, e.y);
      },
      onError: (m) => console.warn('[AFH]', m),
    });
    sessionRef.current = session;
    let renderer: TableRenderer;
    const want3d = settings.renderer === '3d' && webglAvailable();
    const q: Quality = settings.quality === 'auto' ? detectQuality() : settings.quality;
    try {
      if (!want3d) throw new Error('2d');
      renderer = new Renderer3D(canvasRef.current, session, {
        quality: q,
        adaptiveQuality: settings.quality === 'auto',
        reducedMotion: reduced,
        trailLength: settings.trailLength,
        camera: settings.camera,
        trailColor: trailFor(getSave()).color,
        prismTrail: !!trailFor(getSave()).prism,
        woodFinish: trimFor(getSave()),
      });
      (renderer as Renderer3D).stage.onQualityChange = (nq) => setQuality(nq);
      setRendererKind('3d');
      setQuality(q);
    } catch (e) {
      if ((e as Error).message !== '2d') console.warn('3D renderer unavailable, using 2D', e);
      renderer = new Renderer(canvasRef.current, session, {
        reducedMotion: reduced, lowEffects: settings.lowEffects, trailLength: settings.trailLength, debug: settings.showDebug, highContrast: settings.highContrast,
      });
      setRendererKind('2d');
    }
    rendererRef.current = renderer;
    renderer.resize();
    const loop = new GameLoop(session, renderer);
    loop.timeScale = settings.simSpeed;
    let lastHud = 0;
    loop.onFrame = () => {
      inputRef.current?.pollGamepads();
      const now = performance.now();
      if (now - lastHud > 120) {
        lastHud = now;
        setHud(snapshot(session));
      }
    };
    loopRef.current = loop;
    const input = new InputController({
      flipper: (side, down) => session.setFlipper(side, down),
      plunger: (down) => session.plungerPull(down),
      plungerTap: () => session.autoPlunge(),
      pause: () => togglePause(),
      nudge: () => session.nudge(Math.random() < 0.5 ? -1 : 1),
      any: () => session.countdown > 0 && session.skipCountdown(),
    }, settings.bindings);
    inputRef.current = input;
    for (const [el, zone] of [[leftZone.current, 'left'], [rightZone.current, 'right'], [plungerBtn.current, 'plunger'], [leftBtn.current, 'left'], [rightBtn.current, 'right']] as const) {
      if (el) input.bindZone(el, zone);
    }
    input.active = true;
    loop.start();
    setPhase('playing');
    pushCallout({ text: def.lines.pipTip, tone: 'info', speaker: 'pip', seconds: 5 });
    stageRef.current?.focus();
    updateSave((d) => {
      d.progress[p.lessonId].plays++;
    });
  };

  const recordBest = (score: number, session: GameSession) => {
    const s = getSave().settings;
    const assists = [s.autoFlip && 'auto-flip', s.wideFlippers && 'wide flippers', s.longBallSave && 'long ball save', s.simSpeed < 1 && 'slower simulation'].filter(Boolean) as string[];
    updateSave((d) => {
      const arr = d.bests[p.lessonId] ?? [];
      arr.push({ score, at: new Date().toISOString(), mode: p.mode, practice: p.practice, continued: session.continued, assists });
      arr.sort((a, b) => b.score - a.score);
      d.bests[p.lessonId] = arr.slice(0, 5);
    });
  };

  const togglePause = () => {
    const s = sessionRef.current;
    if (!s || s.state === 'gameover') return;
    if (s.state === 'paused') {
      s.resume();
      setPaused(false);
      audio.setSuspended(false);
      if (inputRef.current) inputRef.current.active = true;
      stageRef.current?.focus();
    } else {
      s.pause();
      setPaused(true);
      audio.setSuspended(true);
      if (inputRef.current) inputRef.current.active = true; // P/Esc still resumes
    }
  };

  // Test hooks: ?autostart skips the intro card; ?test exposes the session for scripted checks.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has('autostart') && phase === 'intro' && content !== undefined && def) start();
  }, [content, def]);
  useEffect(() => {
    if (new URLSearchParams(location.search).has('test')) (window as unknown as { __afh: unknown }).__afh = { session: () => sessionRef.current, renderer: () => rendererRef.current, loop: () => loopRef.current, audio };
  });

  // Resize + teardown
  useEffect(() => {
    const ro = new ResizeObserver(() => rendererRef.current?.resize());
    if (stageRef.current) ro.observe(stageRef.current);
    const onVis = () => {
      if (document.hidden && sessionRef.current && sessionRef.current.state !== 'paused' && sessionRef.current.state !== 'gameover') {
        sessionRef.current.pause();
        setPaused(true);
        audio.setSuspended(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      loopRef.current?.stop();
      inputRef.current?.dispose();
      rendererRef.current?.dispose();
      audio.setMusic('map');
      const s = sessionRef.current;
      if (s && s.score > 0 && s.state !== 'gameover') recordBest(s.score, s);
    };
  }, []);

  const finishAsk = (results: PanelResult[]) => {
    const a = ask;
    if (!a) return;
    setAsk(null);
    audio.duck(false);
    if (content) {
      const earned = lessonBadgeEarned(getSave(), content.lesson, content.questions);
      if (earned && !getSave().progress[p.lessonId].badge) {
        updateSave((d) => {
          d.progress[p.lessonId].badge = true;
        }, true);
        pushCallout({ text: 'Science Star earned!', sub: 'You showed understanding across every objective in this lesson.', tone: 'big', speaker: 'angela', seconds: 4 });
      }
    }
    if (inputRef.current) inputRef.current.active = true;
    stageRef.current?.focus();
    a.resolve(results.map((r) => ({ questionId: r.question.id, correct: r.correct, hinted: r.hinted })));
  };

  const onAnswer = (r: PanelResult) => {
    audio.play(r.correct ? 'correct' : 'incorrect');
    updateSave((d) => {
      recordResponse(d, r.question, r.correct, r.hinted);
    }, true);
  };

  if (def === undefined) {
    return <main class="screen"><p role="status">Opening {lesson.attractionTitle}…</p></main>;
  }
  if (!def) {
    return (
      <div class="screen">
        <div class="panel"><h2>{lesson.lessonTitle}</h2><p>This attraction is still under construction.</p><button class="btn" onClick={p.onExit}>Back</button></div>
      </div>
    );
  }

  const h = hud;
  const mission = h && h.slot < 3 ? def.missions[h.slot] : null;
  return (
    <main class={`game-screen ${coarse ? 'touch' : ''}`} data-renderer={rendererKind}>
      <header class="game-hud" aria-label="Game status">
        <button class="icon-btn" aria-label="Pause" onClick={togglePause} disabled={phase !== 'playing'}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        </button>
        <div class="hud-title">
          <span class="hud-attraction">{lesson.attractionTitle}</span>
          <span class="hud-lesson">Lesson {lesson.number}: {lesson.lessonTitle}</span>
        </div>
        <div class="hud-score" aria-live="off">
          <span class="hud-label">{p.practice ? 'Practice score' : h?.continued ? `Score (continued run ${h.run})` : 'Score'}</span>
          <span class="hud-value">{(h?.score ?? 0).toLocaleString()}</span>
        </div>
        <div class="hud-ball">
          <span class="hud-label">Ball</span>
          <span class="hud-value">{p.practice ? '∞' : `${h?.ball ?? 1}/3`}</span>
        </div>
        <button class="icon-btn" aria-label={settings.muted ? 'Unmute' : 'Mute'} onClick={() => { setSetting('muted', !settings.muted); audio.muted = !settings.muted; audio.applyVolumes(); }}>
          {settings.muted ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16 8a5 5 0 010 8M18.5 5.5a8.5 8.5 0 010 13" stroke="currentColor" stroke-width="2" fill="none" /></svg>
          )}
        </button>
      </header>

      <aside class="mission-card panel" aria-label="Current mission">
        {h && (
          <>
            <div class="mission-steps" aria-hidden="true">
              {[0, 1, 2].map((i) => <span class={h.completed[i] ? 'step done' : h.slot === i ? 'step now' : 'step'}>{i + 1}</span>)}
              <span class={h.finaleDone ? 'step done star' : h.slot === 3 ? 'step now star' : 'step star'}>★</span>
            </div>
            <div class="mission-kicker">{h.finaleDone && h.slot !== 3 ? 'Encore' : h.slot === 3 ? 'Finale' : `Mission ${h.slot + 1}`}</div>
            <h2 class="mission-title">{h.missionTitle}</h2>
            <p class="mission-stage"><strong>{h.stageText}</strong> {h.progress && <span class="chip">{h.progress}</span>}</p>
            {mission && <p class="mission-brief">{mission.brief}</p>}
            {h.saveActive && <span class="chip save-chip">Ball save on</span>}
            {h.multiball && <span class="chip">Multiball</span>}
            {h.ballInLane && h.state !== 'parked' && (
              <p class="launch-tip">{coarse ? 'Tap Launch, or hold it and let go for a stronger plunge.' : <>Hold <span class="kbd">{keyLabel(settings.bindings.plunger[0])}</span> then release to launch.</>}</p>
            )}
          </>
        )}
      </aside>
      <div class={`callouts ${h?.ballNearTop ? 'faded' : ''}`} aria-live="polite">
          {callouts.map((c) => (
            <div class={`callout ${c.tone}`} key={c.id}>
              {c.speaker && <Speaker who={c.speaker} size={44} />}
              <div>
                <div class="callout-text">{c.text}</div>
                {c.sub && <div class="callout-sub">{c.sub}</div>}
              </div>
            </div>
          ))}
        </div>

      <div class="stage" ref={stageRef} tabIndex={0} role="application" aria-roledescription="pinball table" aria-label={`${lesson.attractionTitle} pinball table. Use ${keyLabel(settings.bindings.left[0])} and ${keyLabel(settings.bindings.right[0])} for flippers, hold ${keyLabel(settings.bindings.plunger[0])} to launch.`}>
        <canvas ref={canvasRef} class="table-canvas" />
        <div class="touch-zone left" ref={leftZone} aria-hidden="true" />
        <div class="touch-zone right" ref={rightZone} aria-hidden="true" />
        {h && h.countdown > 0 && (
          <div class="countdown" aria-live="assertive">
            <span>{Math.ceil(h.countdown)}</span>
            <small>Press any control to skip</small>
          </div>
        )}
        {caption && <div class="sound-caption" aria-hidden="true">[{caption}]</div>}
      </div>

      <div class="touch-controls" aria-label="Touch controls">
        <button class="touch-btn" ref={leftBtn} aria-label="Left flipper">◀</button>
        <button class="touch-btn launch" ref={plungerBtn} aria-label="Launch (hold and release, or tap)">Launch</button>
        <button class="touch-btn" ref={rightBtn} aria-label="Right flipper">▶</button>
      </div>

      {phase === 'intro' && (
        <div class="modal-backdrop">
          <div class="modal panel intro-card" role="dialog" aria-modal="true" aria-labelledby="intro-title">
            <div class="intro-kicker">{wingOf(p.lessonId).name} · Lesson {lesson.number}</div>
            <h1 id="intro-title">{lesson.attractionTitle}</h1>
            <p class="intro-lesson">{lesson.lessonTitle}</p>
            {content?.lesson.hook && <p class="intro-hook">{content.lesson.hook}</p>}
            <div class="intro-cast">
              <Angela size={64} />
              <p>{def.lines.intro}</p>
            </div>
            <div class="intro-cast quark">
              <Quark size={56} />
              <p>{def.lines.quark}</p>
            </div>
            <ul class="intro-missions">
              {def.missions.map((m, i) => (
                <li class={save.progress[p.lessonId].missions[i] ? 'done' : ''}>
                  <strong>{m.title}</strong> — {m.brief}
                </li>
              ))}
            </ul>
            {def.ballRole && <p class="intro-note">{def.ballRole}</p>}
            {content === null && <p class="intro-note warn">This lesson's questions are still being reviewed, so missions will complete without questions for now.</p>}
            {content && content.excluded > 0 && <p class="intro-note">{content.questions.length} reviewed questions ready ({content.excluded} still in review are kept out of play).</p>}
            <p class="intro-controls">
              Flippers: <span class="kbd">{keyLabel(settings.bindings.left[0])}</span> <span class="kbd">{keyLabel(settings.bindings.right[0])}</span> (or A/D) · Launch: hold and release <span class="kbd">{keyLabel(settings.bindings.plunger[0])}</span> · Pause: <span class="kbd">P</span>
              {coarse && <> · On touch: tap the left or right side, or use the buttons</>}
            </p>
            <div class="intro-actions">
              <button class="btn" onClick={start} disabled={content === undefined} autofocus>
                {content === undefined ? 'Loading…' : 'Enter the attraction'}
              </button>
              <button class="btn ghost" onClick={p.onExit}>Back to the mansion</button>
            </div>
          </div>
        </div>
      )}

      {ask && content && (
        <QuestionPanel
          modal
          title={ask.req.context === 'finale' ? 'Finale discovery' : 'Wonder Pocket discovery'}
          subtitle={ask.req.missionTitle}
          questions={ask.questions}
          narration={settings.narration}
          seed={Date.now() % 100000}
          onAnswer={onAnswer}
          onDone={finishAsk}
        />
      )}

      {paused && (
        <div class="modal-backdrop">
          <div class="modal panel pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title">
            <h2 id="pause-title">Paused</h2>
            <p>The table is frozen: physics, missions and ball save timers wait for you.</p>
            <div class="pause-grid">
              <label class="toggle">Sound<input type="checkbox" checked={!settings.muted} onChange={() => { setSetting('muted', !settings.muted); audio.muted = !settings.muted; audio.applyVolumes(); }} /></label>
              <label class="toggle">Reduced motion<input type="checkbox" checked={reduced} onChange={() => setSetting('motion', reduced ? 'full' : 'reduce')} /></label>
              {rendererKind === '3d' && (
                <label class="field">Camera view
                  <select value={settings.camera} onChange={(e) => { const v = (e.target as HTMLSelectElement).value as 'cabinet'; setSetting('camera', v); (rendererRef.current as Renderer3D).setCamera(v); }}>
                    <option value="cabinet">Cabinet (default)</option>
                    <option value="overhead">Overhead (flattest, easiest to read)</option>
                    <option value="low">Low and dramatic</option>
                  </select>
                </label>
              )}
              {rendererKind === '3d' && <p class="small-note">Graphics quality: {quality}{settings.quality === 'auto' ? ' (adapts automatically)' : ''}.</p>}
            </div>
            <div class="intro-actions">
              <button class="btn" onClick={togglePause} autofocus>Resume</button>
              <button class="btn ghost" onClick={() => { if (inputRef.current) inputRef.current.active = false; setHowto(true); }}>How to play</button>
              <button class="btn ghost" onClick={p.onExit}>Exit to the mansion</button>
            </div>
            <p class="small-note">Your missions and discoveries are saved as you go.</p>
          </div>
        </div>
      )}

      {gameOver && (
        <div class="modal-backdrop">
          <div class="modal panel" role="dialog" aria-modal="true" aria-labelledby="go-title">
            <h2 id="go-title">The Wonderballs are resting</h2>
            <p>Final score <strong>{(h?.score ?? 0).toLocaleString()}</strong>{h?.continued ? ` (continued run ${h.run})` : ''}.</p>
            <p>Every mission you completed and everything you discovered is saved.</p>
            <div class="intro-actions">
              <button class="btn" autofocus onClick={() => { sessionRef.current?.continueGame(false); setGameOver(false); if (inputRef.current) inputRef.current.active = true; stageRef.current?.focus(); }}>Keep playing (new score run)</button>
              <button class="btn secondary" onClick={() => { sessionRef.current?.continueGame(true); setGameOver(false); if (inputRef.current) inputRef.current.active = true; stageRef.current?.focus(); }}>Continue this score (marked “continued”)</button>
              <button class="btn ghost" onClick={p.onExit}>Back to the mansion</button>
            </div>
          </div>
        </div>
      )}

      {wonder && (
        <div class="modal-backdrop">
          <div class="modal panel wonder-card" role="dialog" aria-modal="true" aria-labelledby="w-title">
            <div class="wonderlight-orb" aria-hidden="true" />
            <h2 id="w-title">Wonderlight restored!</h2>
            <p>{def.finale.celebration}</p>
            <div class="intro-actions">
              <button class="btn" autofocus onClick={() => { setWonder(false); p.onWonderlight(p.lessonId); }}>Return to the mansion</button>
              <button class="btn ghost" onClick={() => { setWonder(false); stageRef.current?.focus(); }}>Keep playing (encore)</button>
            </div>
          </div>
        </div>
      )}
      {howto && <HowToPlay onClose={() => { setHowto(false); if (inputRef.current) inputRef.current.active = true; }} />}
      {error && <div class="error-toast" role="alert">{error}<button class="btn small" onClick={() => setError('')}>OK</button></div>}
    </main>
  );
}

function snapshot(s: GameSession): HudState {
  const mv = s.missionView();
  const stage = mv.stage;
  const p = mv.progress;
  const t = s.rt.time;
  return {
    score: s.score,
    ball: s.ballNumber,
    balls: s.opts.balls,
    state: s.state,
    missionTitle: mv.title,
    stageText: stage ? stage.text : '',
    progress: stage && stage.kind !== 'discover' && p.need > 1 ? `${p.done}/${p.need}` : '',
    slot: mv.slot,
    completed: mv.completed,
    finaleDone: mv.finaleDone,
    countdown: s.countdown,
    saveActive: s.ballSaveUntil > t,
    tilt: s.tiltMeter,
    ballInLane: s.rt.world.balls.some((b) => b.state === 'shooter'),
    multiball: s.multiball,
    ballNearTop: s.rt.world.balls.some((b) => b.state === 'live' && b.y < 330),
    run: s.run,
    continued: s.continued,
  };
}
