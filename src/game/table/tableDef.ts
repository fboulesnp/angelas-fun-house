// Declarative table definition: geometry (build), named shots, three science missions,
// a finale, theme and scenery. Tables are data + composition; rules live in the session.

import type { LessonId } from '../../content/curriculum.ts';
import type { QuestionType } from '../../content/schema.ts';
import type { TableBuilder } from './builder.ts';
import type { TableEventType, TableRuntime } from './runtime.ts';
import type { SceneryPainter } from '../render/sceneryTypes.ts';
import type { IconPainter } from '../render/icons.ts';
import type { RoomBuilder, SetBuilder } from '../render3d/setKit.ts';

export interface Match {
  type?: TableEventType | TableEventType[];
  id?: string | string[];
  group?: string;
}

export interface ShotDef {
  id: string;
  label: string;
  /** Events that count as making this shot. */
  on: Match[];
  /** Insert (arrow lamp) that previews this shot, if any. */
  insert?: string;
}

export type Stage =
  | {
      kind: 'collect';
      /** Short instruction shown in the HUD, e.g. "Light 3 element signs". */
      text: string;
      match: Match | Match[];
      count: number;
      /** Count each mechanism id only once. */
      distinct?: boolean;
      /** Mechanisms whose lamps show progress (lit when collected, flashing when needed). */
      lamps?: string[];
      /** Shots to preview with flashing inserts while this stage is active. */
      preview?: string[];
    }
  | {
      kind: 'shots';
      text: string;
      shots: string[];
      /** 'sequence' requires the listed order; 'any' needs `count` (default all, each distinct). */
      order?: 'any' | 'sequence';
      count?: number;
    }
  | {
      kind: 'discover';
      text: string;
      /** Saucer id with role 'pocket'. */
      pocket: string;
      /** Number of questions asked while the ball is parked (default 1). */
      questions?: number;
      objectiveIds?: string[];
      /** Preferred interaction types (e.g. ['order','classify'] for a model-building mission). */
      types?: QuestionType[];
    };

export type MissionReward = 'kickback' | 'ballsave' | 'multiball' | 'jackpot' | 'none';

export interface MissionDef {
  id: 'm1' | 'm2' | 'm3';
  kind: 'observe' | 'relate' | 'apply';
  title: string;
  /** One line: the hook in the fiction + what to do. */
  brief: string;
  /** Objectives this mission teaches (questions are drawn from these). */
  objectiveIds: string[];
  stages: Stage[];
  /** The "aha" line shown when the mission completes. Original, accurate, short. */
  discovery: string;
  reward: MissionReward;
  /** Scenery awakening level reached when this mission completes (1..3). */
  sceneryLevel: 1 | 2 | 3;
}

export interface FinaleDef {
  title: string;
  brief: string;
  stages: Stage[];
  /** Final line when the Wonderlight is earned. */
  celebration: string;
}

export interface TableTheme {
  /** Playfield base gradient. */
  bg: [string, string];
  /** Rails / guides. */
  rail: string;
  railHighlight: string;
  /** Lamp colours. */
  lampOn: string;
  lampOff: string;
  accent: string;
  accent2: string;
  /** Bumper cap and ring colours. */
  bumperCap: string;
  bumperRing: string;
  /** Flipper body colour. */
  flipper: string;
  /** Text colour drawn on the playfield. */
  ink: string;
  /** Ramp plastic tint (rgba). */
  ramp: string;
  /** Ball trail tint. */
  trail: string;
}

export interface CharacterLines {
  /** Angela's entrance line (one or two sentences). */
  intro: string;
  /** Professor Quark's playful observation or misconception to investigate. */
  quark: string;
  /** Pip's tip for the first shot. */
  pipTip: string;
}

export interface TableDef {
  lessonId: LessonId;
  /** Signature mechanism name for the attraction card ("Neon marquee bank"). */
  signature: string;
  theme: TableTheme;
  lines: CharacterLines;
  build(b: TableBuilder): void;
  shots: ShotDef[];
  missions: [MissionDef, MissionDef, MissionDef];
  finale: FinaleDef;
  /** Mechanism id lit for a skill shot right after plunging. */
  skillShot?: string;
  /** How the Wonderball is framed in this attraction (e.g. "a glowing atom token"). */
  ballRole?: string;
  scenery: SceneryPainter;
  /** Table-specific icons for bumper caps, targets and inserts. */
  icons?: Record<string, IconPainter>;
  /** 3D attraction diorama built around the cabinet (falls back to a generic set). */
  set?: SetBuilder;
  /** Miniature vignette for this attraction's room in the dollhouse map. */
  room?: RoomBuilder;
  /**
   * Optional table script, called at start and whenever the mission/stage changes: switch
   * diverters (`rt.get<Diverter>(id).set(0|1)`), enable portals/saucers, light lamps.
   * Moving parts must stay safe: Diverter only moves when no ball is in its sweep.
   */
  onProgress?(rt: TableRuntime, info: { slot: number; stage: number; level: number }): void;
}
