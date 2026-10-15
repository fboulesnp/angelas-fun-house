// Core physics types. Table units: the playfield is TABLE_W x TABLE_H, y grows downward
// (toward the drain). One table unit renders as one CSS pixel at scale 1.

export const TABLE_W = 600;
export const TABLE_H = 1150;
export const BALL_R = 12;

/** Fixed simulation step and substeps (8 x 120 Hz = 960 Hz collision checks). */
export const STEP = 1 / 120;
export const SUBSTEPS = 8;
export const MAX_SPEED = 3900;

export type MaterialName = 'rail' | 'rubber' | 'plastic' | 'wood' | 'metal' | 'post' | 'target';

export interface Material {
  restitution: number;
  friction: number;
  /** Impacts slower than this (normal speed) do not bounce, so balls can settle. */
  restSpeed: number;
}

export const MATERIALS: Record<MaterialName, Material> = {
  rail: { restitution: 0.35, friction: 0.02, restSpeed: 60 },
  metal: { restitution: 0.4, friction: 0.02, restSpeed: 60 },
  wood: { restitution: 0.3, friction: 0.05, restSpeed: 60 },
  plastic: { restitution: 0.45, friction: 0.04, restSpeed: 60 },
  rubber: { restitution: 0.72, friction: 0.12, restSpeed: 50 },
  post: { restitution: 0.6, friction: 0.1, restSpeed: 50 },
  target: { restitution: 0.4, friction: 0.05, restSpeed: 60 },
};

export interface SegShape {
  kind: 'seg';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Half thickness: the wall is a capsule of this radius. */
  r: number;
}

export interface CircleShape {
  kind: 'circle';
  x: number;
  y: number;
  r: number;
}

export type Shape = SegShape | CircleShape;

/** Physics layers: 0 = playfield, 1 = raised ramps/habitrails. */
export type Layer = 0 | 1;

export interface Collider {
  id: number;
  /** Owning mechanism, if any (receives contact/sensor callbacks). */
  owner?: ColliderOwner;
  /** Free-form tag the owner can use to tell its colliders apart. */
  tag?: string;
  shape: Shape;
  layer: Layer;
  material: Material;
  enabled: boolean;
  /** Sensors detect overlap of the ball CENTER within shape distance; they never push. */
  sensor: boolean;
  /**
   * One-way wall: blocks only balls whose center is on the side the normal points to.
   * Balls coming from the other side pass through (gates, lane flaps).
   */
  oneWay?: { nx: number; ny: number };
  /** Dynamic colliders can move/toggle and are not stored in the static grid. */
  dynamic?: boolean;
  /** Visual-only hint for debug draw. */
  debugColor?: string;
}

export interface ContactInfo {
  /** Normal pointing from the surface toward the ball center. */
  nx: number;
  ny: number;
  /** Positive impact speed along the normal before the bounce. */
  impact: number;
}

export interface ColliderOwner {
  onContact?(c: Collider, ball: BallLike, info: ContactInfo): void;
  onSensorEnter?(c: Collider, ball: BallLike): void;
  onSensorExit?(c: Collider, ball: BallLike): void;
}

export type BallState = 'shooter' | 'live' | 'held' | 'transit' | 'drained';

export interface BallLike {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  layer: Layer;
  state: BallState;
}
