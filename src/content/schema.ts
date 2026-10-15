// Content schema for lessons, objectives, glossary, Science Explorer cards and questions.
// Content is data: the game, the learning engine and the validator all read these shapes.
// Runtime validation lives in src/content/validate.ts and is shared by scripts and tests.

import type { LessonId } from './curriculum.ts';

/** Printed/physical page coordinates. Physical PDF page = printed + 36 in lesson pages. */
export interface PageRef {
  printed: number[];
  pdf: number[];
}

export type ObjectiveKind = 'observe' | 'relate' | 'apply';

export interface Objective {
  /** e.g. "L01-O1" */
  id: string;
  /** Learner-facing, original wording ("Explain why ..."). */
  text: string;
  /** Which mission family this objective mainly feeds. */
  kind: ObjectiveKind;
  /** Textbook subsections that teach it. */
  sections: string[];
  pages: PageRef;
}

export interface LessonSection {
  /** e.g. "1. Atoms" exactly as numbered in the lesson. */
  title: string;
  pages: PageRef;
}

export interface GlossaryEntry {
  term: string;
  /** Original learner-friendly definition, not copied textbook wording. */
  definition: string;
  pages: PageRef;
}

export interface ExplorerCard {
  objectiveId: string;
  title: string;
  /** 2-5 short original paragraphs. Formulas use Unicode subscripts (H₂O). */
  paragraphs: string[];
  diagram?: Diagram;
  /** A model limitation or common mix-up worth naming. */
  watchOut?: string;
  pages: PageRef;
}

export interface ContentReviewFlag {
  /** Short ID, e.g. "L06-RF1" (distinct from question family IDs). */
  id: string;
  /** What looked wrong, oversimplified or dated in the source/OCR. */
  issue: string;
  pages: PageRef;
  resolution: string;
  evidence: Evidence[];
}

export interface LessonContent {
  lessonId: LessonId;
  /** The lesson's guiding question, as a short original paraphrase or a brief quoted question. */
  guidingQuestion: string;
  /** One-sentence original phenomenon hook used when entering the attraction. */
  hook: string;
  sections: LessonSection[];
  objectives: Objective[];
  /** Original short summary bullets of the lesson's big ideas (Science Explorer + journal). */
  keyIdeas: string[];
  glossary: GlossaryEntry[];
  explorer: ExplorerCard[];
  reviewFlags: ContentReviewFlag[];
}

// ---------------------------------------------------------------- evidence

export interface TextbookEvidence {
  type: 'textbook';
  documentId: 'BSA7-SE';
  printedPages: number[];
  pdfPages: number[];
  /** Section name or figure/spread caption. */
  locator: string;
  /** The claim this page supports (paraphrased). */
  supports: string;
}

export interface ExternalEvidence {
  type: 'external';
  title: string;
  publisher: string;
  url: string;
  /** ISO date the source was actually read, e.g. "2026-10-14". */
  accessed: string;
  supports: string;
}

export type Evidence = TextbookEvidence | ExternalEvidence;

// ---------------------------------------------------------------- diagrams

export interface DiagramBase {
  /** Visible caption. */
  caption: string;
  /** Full text alternative: everything needed to answer must be stated here. */
  alt: string;
}

export interface TableDiagram extends DiagramBase {
  kind: 'table';
  columns: string[];
  rows: (string | number)[][];
}

export type RockTexture =
  | 'sandstone' | 'shale' | 'limestone' | 'conglomerate' | 'coal'
  | 'igneous' | 'metamorphic' | 'soil' | 'volcanic-ash' | 'basalt';

export interface LayersDiagram extends DiagramBase {
  kind: 'layers';
  /** Listed top to bottom. */
  layers: { id: string; label: string; texture: RockTexture; fossils?: string[] }[];
  features?: { kind: 'fault' | 'intrusion' | 'erosion-surface' | 'tilt'; label: string; affects: string[] }[];
}

export interface NetworkDiagram extends DiagramBase {
  kind: 'network';
  layout: 'web' | 'cycle' | 'chain' | 'pyramid';
  nodes: { id: string; label: string; group?: string }[];
  /** Arrows point from -> to. */
  edges: { from: string; to: string; label?: string }[];
}

export interface MoleculeDiagram extends DiagramBase {
  kind: 'molecule';
  /** Coordinates on a 0-10 grid. Element symbols such as "H", "O", "C", "Na". */
  atoms: { id: string; element: string; x: number; y: number }[];
  bonds: { a: string; b: string; order?: 1 | 2 | 3 }[];
}

export interface LatticeDiagram extends DiagramBase {
  kind: 'lattice';
  /** Two-element repeating grid, e.g. ["Na", "Cl"], or one element, e.g. ["C"]. */
  elements: string[];
  rows: number;
  cols: number;
}

export interface CurveDiagram extends DiagramBase {
  kind: 'curve';
  xLabel: string;
  yLabel: string;
  series: { label: string; points: [number, number][] }[];
  annotations?: { x: number; y: number; text: string }[];
}

export interface BarsDiagram extends DiagramBase {
  kind: 'bars';
  yLabel: string;
  bars: { label: string; value: number }[];
}

export interface ParticlesDiagram extends DiagramBase {
  kind: 'particles';
  panels: { label: string; state: 'solid' | 'liquid' | 'gas'; energy: 'low' | 'medium' | 'high' }[];
}

export interface EquationDiagram extends DiagramBase {
  kind: 'equation';
  /** Formulas in plain ASCII ("C6H12O6"); the renderer subscripts digits. */
  reactants: { formula: string; coefficient?: number; label?: string }[];
  products: { formula: string; coefficient?: number; label?: string }[];
  /** Optional energy note shown over the arrow, e.g. "light energy". */
  arrowNote?: string;
}

export type Diagram =
  | TableDiagram | LayersDiagram | NetworkDiagram | MoleculeDiagram | LatticeDiagram
  | CurveDiagram | BarsDiagram | ParticlesDiagram | EquationDiagram;

// ---------------------------------------------------------------- questions

export type QuestionType = 'single' | 'multi' | 'order' | 'classify' | 'match' | 'numeric';
export type QuestionCategory = 'foundational' | 'relationship' | 'application';
export type ReviewStatus = 'reviewed' | 'needs-review' | 'rejected';

export interface Choice {
  /** Stable option ID: "a", "b", "c", "d" ... (never re-used for different text). */
  id: string;
  text: string;
  /** Why this choice is right, or the specific reason it is wrong. */
  rationale: string;
}

export interface SortItem {
  id: string;
  text: string;
  /** Why it belongs where it belongs / why it sits at this position. */
  rationale: string;
}

export interface QuestionBase {
  /** "L01-Q01" ... stable and unique. */
  id: string;
  lessonId: LessonId;
  objectiveIds: string[];
  conceptTags: string[];
  /** Questions in one family probe the same idea in different ways: "L01-F03". */
  familyId: string;
  category: QuestionCategory;
  difficulty: 1 | 2 | 3;
  prompt: string;
  /** Plain-language version for screen readers/read-aloud: spells symbols, avoids layout cues. */
  accessiblePrompt: string;
  explanation: string;
  /** The misconception this item targets, phrased as the mistaken idea. */
  misconception: string;
  hint: string;
  /** A question ID from a different family in the same lesson. */
  followUpId: string;
  scope: { lessonId: LessonId; section: string; pages: PageRef };
  evidence: Evidence[];
  diagram?: Diagram;
  units?: string;
  conditions?: string;
  limitations?: string;
  review: {
    status: ReviewStatus;
    notes: string;
    passes: { by: string; date: string; result: string }[];
  };
}

export interface SingleQuestion extends QuestionBase {
  type: 'single';
  choices: Choice[];
  answer: string;
}

export interface MultiQuestion extends QuestionBase {
  type: 'multi';
  choices: Choice[];
  /** All correct option IDs. Prompt must say "Select all that apply." */
  answer: string[];
}

export interface OrderQuestion extends QuestionBase {
  type: 'order';
  items: SortItem[];
  /** Item IDs in the one defensible order. */
  answer: string[];
  /** Labels for the ends of the sequence, e.g. ["Oldest (bottom)", "Youngest (top)"]. */
  ends: [string, string];
}

export interface ClassifyQuestion extends QuestionBase {
  type: 'classify';
  items: SortItem[];
  bins: { id: string; label: string }[];
  /** itemId -> binId */
  answer: Record<string, string>;
}

export interface MatchQuestion extends QuestionBase {
  type: 'match';
  left: SortItem[];
  right: { id: string; text: string }[];
  /** leftId -> rightId, one-to-one. */
  answer: Record<string, string>;
}

export interface NumericQuestion extends QuestionBase {
  type: 'numeric';
  answer: number;
  /** Accepted absolute tolerance. */
  tolerance: number;
  unit: string;
  /** Explanation of the worked solution with units. */
  workedSolution: string;
}

export type Question =
  | SingleQuestion | MultiQuestion | OrderQuestion | ClassifyQuestion | MatchQuestion | NumericQuestion;

export interface QuestionBank {
  lessonId: LessonId;
  questions: Question[];
}
