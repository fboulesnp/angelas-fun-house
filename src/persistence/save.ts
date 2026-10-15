// Local, anonymous save data with a versioned schema, migrations, validation, corruption
// recovery, export/import and confirmed reset. Nothing leaves the device.

import { LESSONS, WINGS, type LessonId, type WingId } from '../content/curriculum.ts';
import { DEFAULT_BINDINGS, type Bindings } from '../game/input/input.ts';

export const SAVE_KEY = 'angelas-fun-house.save';
export const SAVE_VERSION = 2;

export type MotionPref = 'system' | 'reduce' | 'full';

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  motion: MotionPref;
  lowEffects: boolean;
  trailLength: number;
  textScale: number;
  highContrast: boolean;
  soundCaptions: boolean;
  narration: boolean;
  longBallSave: boolean;
  simSpeed: number;
  wideFlippers: boolean;
  autoFlip: boolean;
  nudge: boolean;
  /** Free Play trivia: 0 off, 1 some, 2 lots. */
  freeTrivia: 0 | 1 | 2;
  bindings: Bindings;
  showDebug: boolean;
  /** Presentation: full 3D (default when WebGL2 exists) or the classic 2D view. */
  renderer: '3d' | '2d';
  /** 3D quality tier; 'auto' picks one and adapts to measured frame time. */
  quality: 'auto' | 'ultra' | 'high' | 'medium' | 'low';
  camera: 'cabinet' | 'overhead' | 'low';
  /** Optional answer-lane mode: deliver an already-chosen answer by shooting a lit lane. */
  answerLanes: boolean;
}

export interface LessonProgress {
  missions: [boolean, boolean, boolean];
  wonderlight: boolean;
  wonderlightAt?: string;
  visited: boolean;
  plays: number;
  /** Lesson badge awarded by the mastery rule (science evidence, not arcade play). */
  badge: boolean;
}

export interface ResponseRecord {
  qid: string;
  lessonId: LessonId;
  familyId: string;
  objectiveIds: string[];
  first: { correct: boolean; hinted: boolean; at: string; seq: number };
  attempts: number;
  last: { correct: boolean; hinted: boolean; at: string; seq: number };
}

export interface BestScore {
  score: number;
  at: string;
  mode: string;
  practice: boolean;
  continued: boolean;
  assists: string[];
}

export interface SaveData {
  version: number;
  createdAt: string;
  updatedAt: string;
  nickname: string;
  introSeen: boolean;
  settings: Settings;
  progress: Record<LessonId, LessonProgress>;
  wingsCelebrated: Record<WingId, boolean>;
  wingIntrosSeen: Record<WingId, boolean>;
  finaleSeen: boolean;
  learning: {
    /** Monotonic answer counter (spacing revisits). */
    seq: number;
    responses: Record<string, ResponseRecord>;
  };
  cosmetics: {
    trail: string;
    trim: string;
    stickers: string[];
  };
  bests: Partial<Record<LessonId, BestScore[]>>;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.55,
  sfxVolume: 0.75,
  muted: false,
  motion: 'system',
  lowEffects: false,
  trailLength: 0.6,
  textScale: 1,
  highContrast: false,
  soundCaptions: false,
  narration: false,
  longBallSave: false,
  simSpeed: 1,
  wideFlippers: false,
  autoFlip: false,
  nudge: true,
  freeTrivia: 1,
  bindings: DEFAULT_BINDINGS,
  showDebug: false,
  renderer: '3d',
  quality: 'auto',
  camera: 'cabinet',
  answerLanes: false,
};

const emptyProgress = (): LessonProgress => ({ missions: [false, false, false], wonderlight: false, visited: false, plays: 0, badge: false });

export function newSave(now = new Date().toISOString()): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    nickname: '',
    introSeen: false,
    settings: structuredClone(DEFAULT_SETTINGS),
    progress: Object.fromEntries(LESSONS.map((l) => [l.id, emptyProgress()])) as Record<LessonId, LessonProgress>,
    wingsCelebrated: Object.fromEntries(WINGS.map((w) => [w.id, false])) as Record<WingId, boolean>,
    wingIntrosSeen: Object.fromEntries(WINGS.map((w) => [w.id, false])) as Record<WingId, boolean>,
    finaleSeen: false,
    learning: { seq: 0, responses: {} },
    cosmetics: { trail: 'mint', trim: 'gold', stickers: [] },
    bests: {},
  };
}

type Migration = (d: Record<string, unknown>) => Record<string, unknown>;

/** Migrations from version N to N+1. */
export const MIGRATIONS: Record<number, Migration> = {
  // v1 had no lesson badges or wing intro flags.
  1: (d) => {
    const progress = (d.progress ?? {}) as Record<string, Record<string, unknown>>;
    for (const k of Object.keys(progress)) progress[k].badge = progress[k].badge ?? false;
    return { ...d, version: 2, progress, wingIntrosSeen: d.wingIntrosSeen ?? {} };
  },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate + repair a parsed save. Throws if the structure is unusable. */
export function normalize(raw: unknown): SaveData {
  if (!isObj(raw)) throw new Error('Save is not an object');
  let d = raw;
  let v = typeof d.version === 'number' ? d.version : 1;
  if (v > SAVE_VERSION) throw new Error(`Save is from a newer version (${v})`);
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from version ${v}`);
    d = m(d);
    v++;
  }
  const base = newSave(typeof d.createdAt === 'string' ? d.createdAt : undefined);
  const out: SaveData = { ...base, version: SAVE_VERSION };
  out.createdAt = typeof d.createdAt === 'string' ? d.createdAt : base.createdAt;
  out.updatedAt = typeof d.updatedAt === 'string' ? d.updatedAt : base.updatedAt;
  out.nickname = typeof d.nickname === 'string' ? d.nickname.slice(0, 24) : '';
  out.introSeen = d.introSeen === true;
  out.finaleSeen = d.finaleSeen === true;
  if (isObj(d.settings)) {
    const s = d.settings as Partial<Settings>;
    const num = (x: unknown, lo: number, hi: number, dflt: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : dflt);
    out.settings = {
      ...base.settings,
      musicVolume: num(s.musicVolume, 0, 1, base.settings.musicVolume),
      sfxVolume: num(s.sfxVolume, 0, 1, base.settings.sfxVolume),
      muted: s.muted === true,
      motion: s.motion === 'reduce' || s.motion === 'full' ? s.motion : 'system',
      lowEffects: s.lowEffects === true,
      trailLength: num(s.trailLength, 0, 1, base.settings.trailLength),
      textScale: num(s.textScale, 1, 1.6, 1),
      highContrast: s.highContrast === true,
      soundCaptions: s.soundCaptions === true,
      narration: s.narration === true,
      longBallSave: s.longBallSave === true,
      simSpeed: num(s.simSpeed, 0.6, 1, 1),
      wideFlippers: s.wideFlippers === true,
      autoFlip: s.autoFlip === true,
      nudge: s.nudge !== false,
      freeTrivia: s.freeTrivia === 0 || s.freeTrivia === 2 ? s.freeTrivia : 1,
      bindings: validBindings(s.bindings) ? s.bindings! : structuredClone(DEFAULT_BINDINGS),
      showDebug: s.showDebug === true,
      renderer: s.renderer === '2d' ? '2d' : '3d',
      quality: (['ultra', 'high', 'medium', 'low'] as const).includes(s.quality as 'high') ? (s.quality as Settings['quality']) : 'auto',
      camera: s.camera === 'overhead' || s.camera === 'low' ? s.camera : 'cabinet',
      answerLanes: s.answerLanes === true,
    };
  }
  if (isObj(d.progress)) {
    for (const l of LESSONS) {
      const p = (d.progress as Record<string, unknown>)[l.id];
      if (!isObj(p)) continue;
      const m = Array.isArray(p.missions) ? p.missions : [];
      out.progress[l.id] = {
        missions: [m[0] === true, m[1] === true, m[2] === true],
        wonderlight: p.wonderlight === true,
        wonderlightAt: typeof p.wonderlightAt === 'string' ? p.wonderlightAt : undefined,
        visited: p.visited === true,
        plays: typeof p.plays === 'number' ? p.plays : 0,
        badge: p.badge === true,
      };
    }
  }
  for (const key of ['wingsCelebrated', 'wingIntrosSeen'] as const) {
    if (isObj(d[key])) for (const w of WINGS) out[key][w.id] = (d[key] as Record<string, unknown>)[w.id] === true;
  }
  if (isObj(d.learning)) {
    const L = d.learning as Record<string, unknown>;
    out.learning.seq = typeof L.seq === 'number' ? L.seq : 0;
    if (isObj(L.responses)) {
      for (const [k, r] of Object.entries(L.responses)) {
        if (isObj(r) && typeof r.qid === 'string' && isObj(r.first) && isObj(r.last)) out.learning.responses[k] = r as unknown as ResponseRecord;
      }
    }
  }
  if (isObj(d.cosmetics)) {
    const c = d.cosmetics as Record<string, unknown>;
    out.cosmetics = {
      trail: typeof c.trail === 'string' ? c.trail : 'mint',
      trim: typeof c.trim === 'string' ? c.trim : 'gold',
      stickers: Array.isArray(c.stickers) ? c.stickers.filter((x): x is string => typeof x === 'string') : [],
    };
  }
  if (isObj(d.bests)) {
    for (const l of LESSONS) {
      const arr = (d.bests as Record<string, unknown>)[l.id];
      if (Array.isArray(arr)) out.bests[l.id] = arr.filter((b): b is BestScore => isObj(b) && typeof b.score === 'number').slice(0, 5);
    }
  }
  return out;
}

function validBindings(b: unknown): b is Bindings {
  if (!isObj(b)) return false;
  return (['left', 'right', 'plunger', 'pause', 'nudge'] as const).every((k) => Array.isArray(b[k]) && (b[k] as unknown[]).every((x) => typeof x === 'string'));
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface LoadResult {
  data: SaveData;
  /** Human-readable notice when something went wrong (shown once to the player). */
  notice?: string;
  storageAvailable: boolean;
}

export function safeStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__afh_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function loadSave(storage: StorageLike | null): LoadResult {
  if (!storage) return { data: newSave(), storageAvailable: false, notice: 'This browser is not letting the game save, so progress lasts only until you close the tab. You can still export your progress.' };
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { data: newSave(), storageAvailable: false, notice: 'Saved progress could not be read in this browser.' };
  }
  if (!raw) return { data: newSave(), storageAvailable: true };
  try {
    return { data: normalize(JSON.parse(raw)), storageAvailable: true };
  } catch (e) {
    // Keep the damaged copy so nothing is silently destroyed.
    try {
      storage.setItem(`${SAVE_KEY}.damaged`, raw);
    } catch {
      /* ignore */
    }
    return {
      data: newSave(),
      storageAvailable: true,
      notice: `Your saved progress was damaged (${(e as Error).message}). A backup copy was kept and a fresh save started.`,
    };
  }
}

export function writeSave(storage: StorageLike | null, data: SaveData): boolean {
  if (!storage) return false;
  data.updatedAt = new Date().toISOString();
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function exportSave(data: SaveData): string {
  return JSON.stringify({ app: "Angela's Fun House", exportedAt: new Date().toISOString(), save: data }, null, 2);
}

export function importSave(text: string): SaveData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not a valid save (it is not JSON).');
  }
  const inner = isObj(parsed) && isObj(parsed.save) ? parsed.save : parsed;
  return normalize(inner);
}
