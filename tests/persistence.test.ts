import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, exportSave, importSave, loadSave, newSave, normalize, writeSave, type StorageLike } from '../src/persistence/save.ts';

function mem(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] };
}

describe('saves', () => {
  it('round-trips through storage', () => {
    const st = mem();
    const s = newSave();
    s.progress.L05.missions = [true, false, true];
    s.progress.L05.wonderlight = false;
    s.learning.responses['L05-Q01'] = { qid: 'L05-Q01', lessonId: 'L05', familyId: 'L05-F01', objectiveIds: ['L05-O1'], first: { correct: true, hinted: false, at: 'x', seq: 1 }, attempts: 1, last: { correct: true, hinted: false, at: 'x', seq: 1 } };
    writeSave(st, s);
    const back = loadSave(st);
    expect(back.notice).toBeUndefined();
    expect(back.data.progress.L05.missions).toEqual([true, false, true]);
    expect(back.data.learning.responses['L05-Q01'].first.correct).toBe(true);
  });

  it('migrates a version-1 save', () => {
    const v1 = { version: 1, progress: { L01: { missions: [true, true, false], wonderlight: false, visited: true, plays: 2 } } };
    const out = normalize(v1);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.progress.L01.missions).toEqual([true, true, false]);
    expect(out.progress.L01.badge).toBe(false);
  });

  it('keeps a backup of a corrupt save and starts fresh with a notice', () => {
    const st = mem();
    st.data[SAVE_KEY] = '{not json';
    const r = loadSave(st);
    expect(r.notice).toMatch(/damaged/);
    expect(st.data[`${SAVE_KEY}.damaged`]).toBe('{not json');
    expect(r.data.progress.L01.missions).toEqual([false, false, false]);
  });

  it('clamps invalid settings and ignores unknown junk', () => {
    const out = normalize({ version: 2, settings: { musicVolume: 9, simSpeed: 0.1, textScale: 'big', motion: 'wild', bindings: { left: 5 } }, progress: 'nope' });
    expect(out.settings.musicVolume).toBe(1);
    expect(out.settings.simSpeed).toBe(0.6);
    expect(out.settings.textScale).toBe(1);
    expect(out.settings.motion).toBe('system');
    expect(out.settings.bindings.left).toContain('ArrowLeft');
  });

  it('exports and imports', () => {
    const s = newSave();
    s.progress.L29.wonderlight = true;
    const back = importSave(exportSave(s));
    expect(back.progress.L29.wonderlight).toBe(true);
    expect(() => importSave('nope')).toThrow(/not a valid save/);
  });

  it('refuses saves from a newer version', () => {
    expect(() => normalize({ version: SAVE_VERSION + 5 })).toThrow(/newer/);
  });

  it('works without storage (private mode)', () => {
    const r = loadSave(null);
    expect(r.storageAvailable).toBe(false);
    expect(r.notice).toBeTruthy();
  });
});
