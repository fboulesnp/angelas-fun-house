// Node-side table loader (scripts and tests cannot use Vite's import.meta.glob).
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TableDef } from '../../src/game/table/tableDef.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function loadTable(id: string): Promise<TableDef | null> {
  const p = join(root, 'src', 'tables', `${id}.ts`);
  if (!existsSync(p)) return null;
  const mod = (await import(p)) as { default?: TableDef };
  return mod.default ?? null;
}

export function tableIds(): string[] {
  return Array.from({ length: 29 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`).filter((id) => existsSync(join(root, 'src', 'tables', `${id}.ts`)));
}
