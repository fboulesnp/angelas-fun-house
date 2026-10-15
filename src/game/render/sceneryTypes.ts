import type { TableTheme } from '../table/tableDef.ts';

export interface SceneryContext {
  /** Context already transformed into table units (600 x 1150). */
  ctx: CanvasRenderingContext2D;
  /** Seconds since the table opened (frozen while paused). */
  t: number;
  /**
   * Awakening level: 0 = dormant, 1/2/3 after each mission, 4 = Wonderlight earned.
   * Fractional while a transformation animates.
   */
  level: number;
  /** Recent excitement 0..1 (decays), for subtle reactive lighting. */
  energy: number;
  reduced: boolean;
  lowFx: boolean;
  theme: TableTheme;
}

export interface SceneryPainter {
  /** Static backdrop for the current level. Cached and redrawn only when the level changes. */
  backdrop(c: SceneryContext): void;
  /** Cheap animated layer drawn every frame beneath the playfield parts. */
  ambient?(c: SceneryContext): void;
  /** Big transformation shown while every ball is safely parked (p: 0..1). */
  celebrate?(c: SceneryContext, p: number): void;
}
