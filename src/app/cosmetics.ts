// Cosmetic collectibles earned through play. Purely visual: no purchases, no advantages.

import { LESSONS } from '../content/curriculum.ts';
import type { SaveData } from '../persistence/save.ts';

export interface Trail {
  id: string;
  name: string;
  color: string;
  /** Wonderlights needed to unlock. */
  need: number;
  prism?: boolean;
}

export const TRAILS: Trail[] = [
  { id: 'mint', name: 'Mint glow', color: '#71E3CF', need: 0 },
  { id: 'gold', name: 'Lantern gold', color: '#FFC75B', need: 3 },
  { id: 'coral', name: 'Carnival coral', color: '#FF7F86', need: 6 },
  { id: 'violet', name: 'Twilight violet', color: '#b388ff', need: 10 },
  { id: 'ivory', name: 'Starlight', color: '#FFF7E7', need: 15 },
  { id: 'prism', name: "Pip's prism", color: '#71E3CF', need: 22, prism: true },
  { id: 'wonder', name: 'Wonderlight', color: '#ffe39a', need: 29 },
];

export interface Trim {
  id: string;
  name: string;
  base: string;
  dark: string;
  /** Missions completed (across all rooms) needed to unlock. */
  need: number;
}

export const TRIMS: Trim[] = [
  { id: 'walnut', name: 'Walnut', base: '#6b3f22', dark: '#3a2010', need: 0 },
  { id: 'cherry', name: 'Cherry', base: '#8a3a2a', dark: '#4a1a10', need: 6 },
  { id: 'maple', name: 'Maple', base: '#b07a45', dark: '#6a4220', need: 18 },
  { id: 'ebony', name: 'Ebony', base: '#2c2230', dark: '#120c18', need: 36 },
  { id: 'gilded', name: 'Gilded plum', base: '#4a2f6b', dark: '#d8b86a', need: 87 },
];

export function wonderlights(s: SaveData) {
  return LESSONS.filter((l) => s.progress[l.id].wonderlight).length;
}

export function missionsDone(s: SaveData) {
  return LESSONS.reduce((n, l) => n + s.progress[l.id].missions.filter(Boolean).length, 0);
}

export function trailFor(s: SaveData): Trail {
  const t = TRAILS.find((x) => x.id === s.cosmetics.trail);
  return t && wonderlights(s) >= t.need ? t : TRAILS[0];
}

export function trimFor(s: SaveData): Trim {
  const t = TRIMS.find((x) => x.id === s.cosmetics.trim);
  return t && missionsDone(s) >= t.need ? t : TRIMS[0];
}
