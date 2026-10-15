// Registry of attraction tables. Every src/tables/Lnn.ts module exports `default` (its TableDef).
// Tables load lazily, one chunk each, and a table that fails to load is isolated: the rest of
// the game keeps working and the room shows as under construction.

import type { LessonId } from '../content/curriculum.ts';
import type { TableDef } from '../game/table/tableDef.ts';

const loaders = import.meta.glob<{ default: TableDef }>('./L[0-9][0-9].ts');

/** Lessons that have a table module. */
export const TABLE_IDS = new Set<LessonId>(Object.keys(loaders).map((p) => p.slice(2, 5) as LessonId));

const cache = new Map<LessonId, Promise<TableDef | null>>();

export function loadTable(id: LessonId): Promise<TableDef | null> {
  let p = cache.get(id);
  if (!p) {
    const loader = loaders[`./${id}.ts`];
    p = loader
      ? loader()
          .then((m) => {
            if (m.default?.lessonId !== id) throw new Error(`table module ${id} declares ${m.default?.lessonId}`);
            return m.default;
          })
          .catch((e) => {
            console.error(`Attraction ${id} failed to load`, e);
            return null;
          })
      : Promise.resolve(null);
    cache.set(id, p);
  }
  return p;
}

export function hasTable(id: LessonId): boolean {
  return TABLE_IDS.has(id);
}
