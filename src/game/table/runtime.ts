// Table runtime: owns the physics world, the mechanisms that live on it, and the event queue
// that rules (scoring, missions, ball accounting) consume once per fixed step.

import type { Ball } from '../physics/ball.ts';
import type { Flipper } from '../physics/flipper.ts';
import { World } from '../physics/world.ts';
import type { Mechanism } from './mechanisms.ts';
import type { Plunger } from './mechanisms.ts';

export type TableEventType =
  | 'bumper' | 'sling' | 'rollover' | 'target' | 'drop' | 'dropBank' | 'spinner'
  | 'saucer' | 'rampEnter' | 'ramp' | 'shot' | 'gate' | 'portal' | 'drain'
  | 'launch' | 'kickback' | 'outlane' | 'inlane' | 'wall' | 'flipperHit';

export interface TableEvent {
  type: TableEventType;
  id: string;
  group?: string;
  ball?: Ball;
  value?: number;
  x: number;
  y: number;
  time: number;
}

export class TableRuntime {
  readonly world = new World();
  readonly mechs = new Map<string, Mechanism>();
  readonly order: Mechanism[] = [];
  readonly events: TableEvent[] = [];
  flippers: Flipper[] = [];
  plunger?: Plunger;
  /** Ball spawn point resting on the plunger. */
  shooterSpawn = { x: 572, y: 1060 };
  /** Bounds a live ball must stay within (escape detection). */
  bounds = { x0: -40, y0: -60, x1: 640, y1: 1220 };

  get time() {
    return this.world.time;
  }

  add<M extends Mechanism>(m: M): M {
    if (this.mechs.has(m.id)) throw new Error(`Duplicate mechanism id "${m.id}"`);
    this.mechs.set(m.id, m);
    this.order.push(m);
    return m;
  }

  get<M extends Mechanism = Mechanism>(id: string): M {
    const m = this.mechs.get(id);
    if (!m) throw new Error(`Unknown mechanism "${id}"`);
    return m as M;
  }

  find<M extends Mechanism = Mechanism>(id: string): M | undefined {
    return this.mechs.get(id) as M | undefined;
  }

  byGroup(group: string): Mechanism[] {
    return this.order.filter((m) => m.group === group);
  }

  emit(e: Omit<TableEvent, 'time'>) {
    this.events.push({ ...e, time: this.world.time });
  }

  /** Advance one fixed step: physics then mechanism timers. */
  step(dt: number) {
    this.world.step();
    for (const m of this.order) m.update(dt);
  }

  drainEvents(): TableEvent[] {
    return this.events.splice(0, this.events.length);
  }

  liveBalls(): Ball[] {
    return this.world.balls.filter((b) => b.state === 'live' || b.state === 'shooter');
  }
}
