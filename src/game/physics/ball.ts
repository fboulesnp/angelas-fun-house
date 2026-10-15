import { BALL_R, type BallLike, type BallState, type Layer } from './types.ts';

let nextBallId = 1;

export class Ball implements BallLike {
  id = nextBallId++;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  r = BALL_R;
  layer: Layer = 0;
  state: BallState = 'live';
  /** Ramp the ball is riding (rendering elevation), if any. */
  rampId: string | null = null;
  /** Rolling angle for rendering highlights. */
  spin = 0;
  /** Sensors currently overlapped (collider ids). */
  sensors = new Set<number>();
  /** One-way colliders this ball is currently passing through. */
  passing = new Set<number>();
  /** Solid colliders touched last substep (for contact-start debouncing). */
  touching = new Set<number>();
  touchingNow = new Set<number>();
  /** Last time (sim seconds) each collider started a contact. */
  lastContactStart = new Map<number, number>();
  /** Stuck detection anchor. */
  anchorX: number;
  anchorY: number;
  anchorTime = 0;
  stuckStage = 0;
  /** Wide anchor for the rescue window (catches balls bouncing in a small region). */
  wideX: number;
  wideY: number;
  wideTime = 0;
  /** Seconds the ball has spent resting on a raised flipper (legit cradle). */
  cradled = false;
  /** Trail of recent positions for rendering. */
  trail: { x: number; y: number }[] = [];
  /** Recent ball save / portal exit grace (sim time until which the drain returns it). */
  saveUntil = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.anchorX = x;
    this.anchorY = y;
    this.wideX = x;
    this.wideY = y;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  resetTracking(time: number) {
    this.sensors.clear();
    this.passing.clear();
    this.touching.clear();
    this.touchingNow.clear();
    this.anchorX = this.x;
    this.anchorY = this.y;
    this.anchorTime = time;
    this.wideX = this.x;
    this.wideY = this.y;
    this.wideTime = time;
    this.stuckStage = 0;
    this.trail.length = 0;
  }
}
