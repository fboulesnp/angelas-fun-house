// Tiny observable store for save data + settings. The game loop never re-renders through it;
// UI components subscribe with useSave().

import { useEffect, useState } from 'preact/hooks';
import { loadSave, safeStorage, writeSave, type SaveData, type Settings } from '../persistence/save.ts';

const storage = safeStorage();
const loaded = loadSave(storage);
let data: SaveData = loaded.data;
export const startupNotice: string | undefined = loaded.notice;
export const storageAvailable = loaded.storageAvailable;
const listeners = new Set<() => void>();
let writeTimer = 0;

export function getSave(): SaveData {
  return data;
}

/** Mutate save data and persist at a sensible checkpoint (debounced). */
export function updateSave(fn: (d: SaveData) => void, immediate = false) {
  fn(data);
  data = { ...data };
  for (const l of listeners) l();
  window.clearTimeout(writeTimer);
  if (immediate) writeSave(storage, data);
  else writeTimer = window.setTimeout(() => writeSave(storage, data), 250);
}

export function replaceSave(next: SaveData) {
  data = next;
  writeSave(storage, data);
  for (const l of listeners) l();
}

export function flushSave() {
  window.clearTimeout(writeTimer);
  writeSave(storage, data);
}

export function useSave(): SaveData {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return data;
}

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  updateSave((d) => {
    d.settings = { ...d.settings, [k]: v };
  });
}

/** Effective reduced-motion preference (setting or OS). */
export function prefersReducedMotion(s: Settings): boolean {
  if (s.motion === 'reduce') return true;
  if (s.motion === 'full') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

window.addEventListener('pagehide', flushSave);
