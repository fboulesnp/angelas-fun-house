// Registry of attraction tables. Every src/tables/Lnn.ts module exports `default` (its TableDef);
// Vite collects them here, so tables never edit a shared file.

import type { LessonId } from '../content/curriculum.ts';
import type { TableDef } from '../game/table/tableDef.ts';

const mods = import.meta.glob<{ default: TableDef }>('./L[0-9][0-9].ts', { eager: true });

export const TABLES: Partial<Record<LessonId, TableDef>> = {};
for (const [path, mod] of Object.entries(mods)) {
  const def = mod.default;
  if (!def) continue;
  const id = path.slice(2, 5) as LessonId;
  if (def.lessonId !== id) {
    console.error(`Table file ${path} declares ${def.lessonId}; skipped.`);
    continue;
  }
  TABLES[id] = def;
}
