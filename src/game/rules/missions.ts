// Mission state machine: m1 -> m2 -> m3 -> finale -> done. Pure logic, driven by table events.

import type { TableEvent } from '../table/runtime.ts';
import type { Match, MissionDef, ShotDef, Stage, TableDef } from '../table/tableDef.ts';

export type MissionSlot = 0 | 1 | 2 | 3; // 3 = finale

export function matches(m: Match, e: TableEvent): boolean {
  if (m.type) {
    const types = Array.isArray(m.type) ? m.type : [m.type];
    if (!types.includes(e.type)) return false;
  }
  if (m.id) {
    const ids = Array.isArray(m.id) ? m.id : [m.id];
    if (!ids.includes(e.id)) return false;
  }
  if (m.group && m.group !== e.group) return false;
  return !!(m.type || m.id || m.group);
}

export function shotMade(s: ShotDef, e: TableEvent): boolean {
  return s.on.some((m) => matches(m, e));
}

export interface StageProgress {
  done: number;
  need: number;
  collected: string[];
}

export interface MissionProgressEvent {
  kind: 'progress' | 'stageComplete' | 'discoverReady';
  slot: MissionSlot;
  stage: Stage;
  progress: StageProgress;
}

export class MissionRunner {
  readonly def: TableDef;
  /** Missions already completed (persisted adventure progress). */
  completed: [boolean, boolean, boolean];
  finaleDone: boolean;
  slot: MissionSlot | 4 = 0;
  stageIdx = 0;
  private count = 0;
  private collected = new Set<string>();
  private seq = 0;
  /** True when replaying a table whose Wonderlight is already earned. */
  encore = false;

  constructor(def: TableDef, completed: boolean[] = [], finaleDone = false) {
    this.def = def;
    this.completed = [!!completed[0], !!completed[1], !!completed[2]];
    this.finaleDone = finaleDone;
    this.pickStart();
  }

  private pickStart() {
    if (this.finaleDone) {
      this.encore = true;
      this.slot = 0;
    } else {
      const i = this.completed.findIndex((c) => !c);
      this.slot = (i === -1 ? 3 : i) as MissionSlot;
    }
    this.resetStage(0);
  }

  get mission(): MissionDef | undefined {
    return this.slot < 3 ? this.def.missions[this.slot as 0 | 1 | 2] : undefined;
  }

  get stages(): Stage[] {
    if (this.slot === 4) return [];
    return this.slot === 3 ? this.def.finale.stages : this.def.missions[this.slot].stages;
  }

  get stage(): Stage | undefined {
    return this.stages[this.stageIdx];
  }

  get title(): string {
    if (this.slot === 4) return 'Encore';
    return this.slot === 3 ? this.def.finale.title : this.def.missions[this.slot].title;
  }

  get brief(): string {
    if (this.slot === 4) return '';
    return this.slot === 3 ? this.def.finale.brief : this.def.missions[this.slot].brief;
  }

  private resetStage(i: number) {
    this.stageIdx = i;
    this.count = 0;
    this.seq = 0;
    this.collected.clear();
  }

  progress(): StageProgress {
    const s = this.stage;
    if (!s) return { done: 0, need: 0, collected: [] };
    if (s.kind === 'collect') return { done: this.count, need: s.count, collected: [...this.collected] };
    if (s.kind === 'shots') {
      const need = s.order === 'sequence' ? s.shots.length : s.count ?? s.shots.length;
      return { done: s.order === 'sequence' ? this.seq : this.collected.size, need, collected: [...this.collected] };
    }
    return { done: 0, need: 1, collected: [] };
  }

  /** Shot ids worth previewing right now. */
  usefulShots(): string[] {
    const s = this.stage;
    if (!s) return [];
    if (s.kind === 'collect') return s.preview ?? [];
    if (s.kind === 'shots') {
      if (s.order === 'sequence') return [s.shots[this.seq]].filter(Boolean);
      return s.shots.filter((id) => !this.collected.has(id));
    }
    return [];
  }

  /** Mechanism lamps to show: lit = collected, flash = still wanted. */
  lampPlan(): { on: string[]; flash: string[] } {
    const s = this.stage;
    if (!s) return { on: [], flash: [] };
    if (s.kind === 'collect' && s.lamps) {
      return { on: s.lamps.filter((id) => this.collected.has(id)), flash: s.lamps.filter((id) => !this.collected.has(id)) };
    }
    if (s.kind === 'discover') return { on: [], flash: [s.pocket] };
    return { on: [], flash: [] };
  }

  /** Feed an event; returns progress notifications. */
  handle(e: TableEvent): MissionProgressEvent[] {
    const s = this.stage;
    if (!s || this.slot === 4) return [];
    const slot = this.slot as MissionSlot;
    const out: MissionProgressEvent[] = [];
    if (s.kind === 'collect') {
      const ms = Array.isArray(s.match) ? s.match : [s.match];
      if (!ms.some((m) => matches(m, e))) return out;
      if (s.distinct) {
        if (this.collected.has(e.id)) return out;
        this.collected.add(e.id);
        this.count = this.collected.size;
      } else {
        this.count++;
        this.collected.add(e.id);
      }
      out.push({ kind: 'progress', slot, stage: s, progress: this.progress() });
      if (this.count >= s.count) out.push(...this.advance());
    } else if (s.kind === 'shots') {
      const shots = this.def.shots;
      if (s.order === 'sequence') {
        const want = shots.find((x) => x.id === s.shots[this.seq]);
        if (want && shotMade(want, e)) {
          this.seq++;
          this.collected.add(want.id);
          out.push({ kind: 'progress', slot, stage: s, progress: this.progress() });
          if (this.seq >= s.shots.length) out.push(...this.advance());
        }
      } else {
        for (const id of s.shots) {
          if (this.collected.has(id)) continue;
          const sh = shots.find((x) => x.id === id);
          if (sh && shotMade(sh, e)) {
            this.collected.add(id);
            out.push({ kind: 'progress', slot, stage: s, progress: this.progress() });
            break;
          }
        }
        if (this.collected.size >= (s.count ?? s.shots.length)) out.push(...this.advance());
      }
    }
    return out;
  }

  private advance(): MissionProgressEvent[] {
    const slot = this.slot as MissionSlot;
    const done = this.stage!;
    const out: MissionProgressEvent[] = [{ kind: 'stageComplete', slot, stage: done, progress: this.progress() }];
    if (this.stageIdx + 1 < this.stages.length) {
      this.resetStage(this.stageIdx + 1);
      if (this.stage!.kind === 'discover') out.push({ kind: 'discoverReady', slot, stage: this.stage!, progress: this.progress() });
    }
    return out;
  }

  /** The discover stage was answered: finish it. Returns 'mission' | 'finale' | 'stage'. */
  completeDiscover(): 'stage' | 'mission' | 'finale' {
    if (this.stageIdx + 1 < this.stages.length) {
      this.resetStage(this.stageIdx + 1);
      return 'stage';
    }
    return this.finishSlot();
  }

  private finishSlot(): 'mission' | 'finale' {
    if (this.slot === 3) {
      this.finaleDone = true;
      this.encore = true;
      this.slot = 0;
      this.resetStage(0);
      return 'finale';
    }
    const i = this.slot as 0 | 1 | 2;
    this.completed[i] = true;
    if (this.encore) {
      this.slot = ((i + 1) % 3) as MissionSlot;
    } else {
      const next = this.completed.findIndex((c) => !c);
      this.slot = (next === -1 ? 3 : next) as MissionSlot;
    }
    this.resetStage(0);
    return 'mission';
  }

  /** Awakening level for scenery: number of completed missions, 4 with the Wonderlight. */
  get level(): number {
    if (this.finaleDone) return 4;
    return this.completed.filter(Boolean).length;
  }
}
