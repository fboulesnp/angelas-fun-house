// Original synthesized sound identity (Web Audio, no recorded assets):
//  * short, varied contact sounds with a voice limit,
//  * a musical phrase that climbs with consecutive good shots and resolves on missions,
//  * a generative score with a title motif and complementary wing themes.
// Starts only after an explicit user gesture; suspends cleanly when paused or hidden.

export type WingTheme = 'title' | 'spark' | 'motion' | 'planet' | 'tomorrow' | 'map' | 'finale';

const CAPTIONS: Record<string, string> = {
  launch: 'spring launch',
  drain: 'soft falling notes',
  saucer: 'pocket thoom',
  ramp: 'ramp whoosh and chime',
  orbit: 'orbit swirl',
  bank: 'target bank fanfare',
  multiball: 'multiball fanfare',
  celebrate: 'celebration music',
  pocketLit: 'twinkle: Wonder Pocket lit',
  skill: 'skill shot chime',
  kickback: 'kickback thump',
  correct: 'bright chime',
  incorrect: 'gentle two-note tone',
  resolve: 'phrase resolves',
  park: 'soft bell',
  portal: 'portal shimmer',
};

interface MusicTheme {
  bpm: number;
  root: number; // MIDI
  scale: number[];
  progression: number[][]; // chord tones as scale degrees
  lead: OscillatorType;
  pad: OscillatorType;
  swing: number;
}

const THEMES: Record<WingTheme, MusicTheme> = {
  title: { bpm: 92, root: 57, scale: [0, 2, 4, 5, 7, 9, 11], progression: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]], lead: 'triangle', pad: 'sine', swing: 0.08 },
  map: { bpm: 84, root: 55, scale: [0, 2, 4, 7, 9], progression: [[0, 2, 4], [3, 5, 7], [1, 3, 5], [4, 6, 8]], lead: 'sine', pad: 'triangle', swing: 0.1 },
  spark: { bpm: 112, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], progression: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]], lead: 'square', pad: 'sawtooth', swing: 0.12 },
  motion: { bpm: 120, root: 58, scale: [0, 2, 3, 5, 7, 8, 10], progression: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [6, 8, 10]], lead: 'sawtooth', pad: 'triangle', swing: 0.05 },
  planet: { bpm: 100, root: 62, scale: [0, 2, 4, 7, 9], progression: [[0, 2, 4], [1, 3, 5], [3, 5, 7], [2, 4, 6]], lead: 'triangle', pad: 'sine', swing: 0.15 },
  tomorrow: { bpm: 108, root: 59, scale: [0, 2, 4, 6, 7, 9, 11], progression: [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]], lead: 'triangle', pad: 'sawtooth', swing: 0.06 },
  finale: { bpm: 126, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], progression: [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]], lead: 'square', pad: 'sawtooth', swing: 0.04 },
};

const PHRASE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private voices = 0;
  private maxVoices = 18;
  musicVolume = 0.55;
  sfxVolume = 0.75;
  muted = false;
  onCaption?: (text: string) => void;
  captions = false;
  private theme: WingTheme | null = null;
  private seqTimer = 0;
  private nextBeat = 0;
  private beat = 0;
  /** 0..1 musical intensity (layers added with progress). */
  intensity = 0.3;
  private motifSeed = 0;
  private suspended = false;

  get started() {
    return !!this.ctx;
  }

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.ctx?.suspend();
      else if (!this.suspended) void this.ctx?.resume();
    });
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.42, t, 0.1);
  }

  /** Pause/resume all audio with the game. */
  setSuspended(s: boolean) {
    this.suspended = s;
    if (!this.ctx) return;
    if (s) this.musicBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15);
    else this.applyVolumes();
  }

  /** Duck the music while a question is open (keeps reading calm). */
  duck(on: boolean) {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(on ? this.musicVolume * 0.12 : this.musicVolume * 0.42, this.ctx.currentTime, 0.25);
  }

  // ------------------------------------------------------------------ synthesis primitives

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; attack?: number; slideTo?: number; when?: number; bus?: GainNode; filter?: number; detune?: number } = {}) {
    if (!this.ctx) return;
    if (this.voices >= this.maxVoices) return;
    const c = this.ctx;
    const t = c.currentTime + (opts.when ?? 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t + dur);
    const peak = opts.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts.bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.voices++;
    o.onended = () => {
      this.voices--;
      g.disconnect();
    };
  }

  private noiseBurst(dur: number, opts: { gain?: number; type?: BiquadFilterType; freq?: number; q?: number; when?: number; sweepTo?: number } = {}) {
    if (!this.ctx) return;
    if (this.voices >= this.maxVoices) return;
    const c = this.ctx;
    const t = c.currentTime + (opts.when ?? 0);
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(opts.gain ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.05);
    this.voices++;
    src.onended = () => {
      this.voices--;
      g.disconnect();
    };
  }

  private chord(notes: number[], dur: number, type: OscillatorType = 'triangle', gain = 0.1, stagger = 0) {
    notes.forEach((n, i) => this.tone(midi(n), dur, { type, gain, attack: 0.01, when: i * stagger }));
  }

  // ------------------------------------------------------------------ sound effects

  play(name: string, value?: number) {
    if (!this.ctx || this.muted) return;
    if (this.captions && CAPTIONS[name]) this.onCaption?.(CAPTIONS[name]);
    const pan = value !== undefined && value > 100 ? (value - 300) / 300 : 0;
    const vary = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'flipper':
        this.tone(95 * vary, 0.07, { type: 'sine', gain: 0.32, slideTo: 60 });
        this.noiseBurst(0.04, { freq: 600, gain: 0.12, type: 'lowpass' });
        break;
      case 'bumper':
        this.tone((520 + pan * 60) * vary, 0.16, { type: 'triangle', gain: 0.22, slideTo: 210 });
        this.noiseBurst(0.03, { freq: 3000, gain: 0.08 });
        break;
      case 'sling':
        this.tone(330 * vary, 0.08, { type: 'square', gain: 0.08, filter: 1600, slideTo: 200 });
        this.noiseBurst(0.04, { freq: 2200, gain: 0.08 });
        break;
      case 'rollover':
        this.tone(1046 * vary, 0.18, { type: 'triangle', gain: 0.08 });
        this.tone(1568 * vary, 0.14, { type: 'sine', gain: 0.05, when: 0.03 });
        break;
      case 'target':
        this.tone(760 * vary, 0.07, { type: 'sine', gain: 0.18, slideTo: 520 });
        this.noiseBurst(0.03, { freq: 1800, q: 6, gain: 0.1 });
        break;
      case 'drop':
        this.tone(180, 0.12, { type: 'triangle', gain: 0.2, slideTo: 90 });
        this.noiseBurst(0.05, { freq: 900, gain: 0.1 });
        break;
      case 'bank':
        this.chord([72, 76, 79, 84], 0.3, 'square', 0.06, 0.06);
        break;
      case 'spinner': {
        const n = Math.min(14, value ?? 4);
        for (let i = 0; i < n; i++) this.tone(1800 - i * 40, 0.03, { type: 'square', gain: 0.03, when: i * 0.045, filter: 3000 });
        break;
      }
      case 'saucer':
        this.tone(110, 0.35, { type: 'sine', gain: 0.25, slideTo: 70 });
        this.tone(1318, 0.3, { type: 'triangle', gain: 0.05, when: 0.08 });
        break;
      case 'rampEnter':
        this.noiseBurst(0.45, { freq: 400, sweepTo: 3000, gain: 0.07, q: 2 });
        break;
      case 'ramp':
        this.noiseBurst(0.3, { freq: 2500, sweepTo: 600, gain: 0.05, q: 2 });
        this.chord([76, 79, 83, 88], 0.45, 'triangle', 0.06, 0.05);
        break;
      case 'orbit':
        this.chord([72, 76, 79, 84, 88], 0.35, 'sine', 0.05, 0.04);
        break;
      case 'launch':
        this.tone(140, 0.25, { type: 'triangle', gain: 0.18, slideTo: 520 });
        this.noiseBurst(0.18, { freq: 800, sweepTo: 2400, gain: 0.05 });
        break;
      case 'drain':
        this.tone(midi(67), 0.25, { type: 'sine', gain: 0.1 });
        this.tone(midi(64), 0.25, { type: 'sine', gain: 0.1, when: 0.18 });
        this.tone(midi(60), 0.5, { type: 'sine', gain: 0.1, when: 0.36 });
        break;
      case 'outlane':
        this.tone(220, 0.3, { type: 'sine', gain: 0.08, slideTo: 160 });
        break;
      case 'phrase': {
        const th = THEMES[this.theme ?? 'spark'];
        const step = PHRASE[Math.min(PHRASE.length - 1, (value ?? 1) - 1)];
        const n = th.root + 12 + step;
        this.tone(midi(n), 0.4, { type: 'triangle', gain: 0.09 });
        this.tone(midi(n + 12), 0.25, { type: 'sine', gain: 0.04, when: 0.02 });
        break;
      }
      case 'resolve': {
        const r = THEMES[this.theme ?? 'spark'].root + 12;
        this.chord([r - 5, r - 1, r + 2], 0.35, 'triangle', 0.06);
        this.chord([r, r + 4, r + 7, r + 12], 0.8, 'triangle', 0.07, 0.03);
        break;
      }
      case 'progress':
        this.tone(midi(84 + ((value ?? 0) % 5) * 2), 0.2, { type: 'triangle', gain: 0.07 });
        break;
      case 'stage':
        this.chord([79, 83, 86], 0.4, 'triangle', 0.06, 0.05);
        break;
      case 'pocketLit':
        for (let i = 0; i < 6; i++) this.tone(midi(88 + (i % 3) * 3), 0.15, { type: 'sine', gain: 0.05, when: i * 0.07 });
        break;
      case 'park':
        this.tone(midi(76), 1.2, { type: 'sine', gain: 0.1, attack: 0.02 });
        this.tone(midi(83), 1.2, { type: 'sine', gain: 0.05, attack: 0.02, when: 0.05 });
        break;
      case 'celebrate':
      case 'multiball': {
        const r = THEMES[this.theme ?? 'spark'].root + 12;
        [[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19]].forEach((ch, i) =>
          ch.forEach((x) => {
            this.tone(midi(r + x), 0.45, { type: 'triangle', gain: 0.05, when: i * 0.22 });
            this.tone(midi(r + x), 0.3, { type: 'square', gain: 0.02, when: i * 0.22, filter: 2200 });
          }),
        );
        break;
      }
      case 'skill':
        this.chord([84, 88, 91, 96], 0.5, 'triangle', 0.07, 0.05);
        break;
      case 'kickback':
        this.tone(90, 0.2, { type: 'sine', gain: 0.3, slideTo: 300 });
        break;
      case 'nudge':
        this.noiseBurst(0.12, { freq: 300, gain: 0.12, type: 'lowpass' });
        break;
      case 'wall':
        this.noiseBurst(0.03, { freq: 2600, gain: Math.min(0.08, ((value ?? 900) / 3000) * 0.08), q: 3 });
        break;
      case 'portal':
        this.noiseBurst(0.6, { freq: 300, sweepTo: 4000, gain: 0.05, q: 4 });
        this.chord([79, 86, 91], 0.6, 'sine', 0.04, 0.08);
        break;
      case 'correct':
        this.chord([72, 76, 79], 0.5, 'triangle', 0.08, 0.06);
        this.tone(midi(88), 0.6, { type: 'sine', gain: 0.05, when: 0.18 });
        break;
      case 'incorrect':
        // Gentle, never harsh: a soft open fifth that invites another look.
        this.tone(midi(67), 0.45, { type: 'sine', gain: 0.07 });
        this.tone(midi(62), 0.6, { type: 'sine', gain: 0.06, when: 0.16 });
        break;
      case 'ui':
        this.tone(midi(84), 0.06, { type: 'sine', gain: 0.05 });
        break;
      case 'countdown':
        this.tone(midi(value === 0 ? 84 : 76), 0.12, { type: 'triangle', gain: 0.08 });
        break;
    }
  }

  // ------------------------------------------------------------------ music

  setMusic(theme: WingTheme | null, seed = 0) {
    this.theme = theme;
    this.motifSeed = seed;
    if (!this.ctx) return;
    window.clearInterval(this.seqTimer);
    if (!theme) return;
    this.beat = 0;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.schedule(), 30);
  }

  private schedule() {
    if (!this.ctx || !this.theme || this.suspended) return;
    const th = THEMES[this.theme];
    const spb = 60 / th.bpm / 2; // eighth notes
    while (this.nextBeat < this.ctx.currentTime + 0.12) {
      this.playBeat(th, this.beat, this.nextBeat - this.ctx.currentTime);
      this.beat++;
      const swing = this.beat % 2 === 1 ? th.swing * spb : -th.swing * spb;
      this.nextBeat += spb + swing;
    }
  }

  private note(th: MusicTheme, degree: number, octave = 0) {
    const n = th.scale.length;
    const o = Math.floor(degree / n);
    const d = ((degree % n) + n) % n;
    return th.root + th.scale[d] + 12 * (o + octave);
  }

  private playBeat(th: MusicTheme, beat: number, when: number) {
    const bar = Math.floor(beat / 8);
    const chord = th.progression[bar % th.progression.length];
    const b8 = beat % 8;
    const bus = this.musicBus;
    // Pad on the bar
    if (b8 === 0) for (const d of chord) this.tone(midi(this.note(th, d)), (60 / th.bpm) * 4, { type: th.pad, gain: 0.05, attack: 0.3, when, bus, filter: 1400 });
    // Bass on beats
    if (b8 % 4 === 0) this.tone(midi(this.note(th, chord[0], -1)), 0.5, { type: 'triangle', gain: 0.12, when, bus, filter: 600 });
    // Plucked arpeggio as intensity grows
    if (this.intensity > 0.35 && b8 % 2 === 1) this.tone(midi(this.note(th, chord[(b8 >> 1) % 3], 1)), 0.25, { type: 'triangle', gain: 0.035, when, bus });
    // Lead motif (seeded per attraction) at higher intensity
    if (this.intensity > 0.6) {
      const motif = [0, 2, 4, 2, 5, 4, 2, 1];
      const k = (b8 + this.motifSeed) % motif.length;
      if ((b8 + this.motifSeed) % 3 !== 2) this.tone(midi(this.note(th, chord[0] + motif[k], 1)), 0.22, { type: th.lead, gain: 0.025, when, bus, filter: 2400 });
    }
    // Soft percussion
    if (b8 % 4 === 2) this.noiseBurst(0.05, { freq: 6000, gain: 0.015 * (0.5 + this.intensity), when, type: 'highpass' });
  }

  stopMusic() {
    window.clearInterval(this.seqTimer);
    this.theme = null;
  }
}

export const audio = new AudioEngine();
