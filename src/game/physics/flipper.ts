import type { Layer } from './types.ts';

export interface FlipperSpec {
  id: string;
  side: 'left' | 'right';
  /** Pivot position. */
  x: number;
  y: number;
  length: number;
  /** Base and tip radii (tapered capsule). */
  r0?: number;
  r1?: number;
  /** Rest angle in degrees, measured from +x with y downward (clockwise visually). */
  restDeg: number;
  /** Raised angle in degrees. */
  upDeg: number;
  layer?: Layer;
  /** Which input drives it. Upper flippers usually share the lower flipper's button. */
  button: 'left' | 'right';
}

export const FLIPPER_TUNING = {
  /** Peak angular speed (rad/s). */
  maxOmega: 30,
  /** Angular acceleration while energised (rad/s^2). */
  accel: 2400,
  /** Return acceleration when released (rad/s^2). */
  returnAccel: 1500,
  returnOmega: 18,
  restitution: 0.42,
  friction: 0.18,
};

export class Flipper {
  readonly spec: FlipperSpec;
  readonly id: string;
  px: number;
  py: number;
  length: number;
  r0: number;
  r1: number;
  rest: number;
  up: number;
  /** +1 if pressing increases the angle, -1 if it decreases it. */
  dir: number;
  angle: number;
  omega = 0;
  pressed = false;
  enabled = true;
  layer: Layer;
  /** Width multiplier from assistance settings (applied to radii). */
  widthScale = 1;
  /** Tip/base cached each substep. */
  tx = 0;
  ty = 0;

  constructor(spec: FlipperSpec) {
    this.spec = spec;
    this.id = spec.id;
    this.px = spec.x;
    this.py = spec.y;
    this.length = spec.length;
    this.r0 = spec.r0 ?? 11;
    this.r1 = spec.r1 ?? 6.5;
    this.rest = (spec.restDeg * Math.PI) / 180;
    this.up = (spec.upDeg * Math.PI) / 180;
    this.dir = this.up > this.rest ? 1 : -1;
    this.angle = this.rest;
    this.layer = spec.layer ?? 0;
    this.updateTip();
  }

  updateTip() {
    this.tx = this.px + Math.cos(this.angle) * this.length;
    this.ty = this.py + Math.sin(this.angle) * this.length;
  }

  /** Fraction of travel from rest (0) to raised (1). */
  get raise(): number {
    return (this.angle - this.rest) / (this.up - this.rest);
  }

  get isRaisedAndHeld(): boolean {
    return this.pressed && this.raise > 0.97;
  }

  step(h: number) {
    const t = FLIPPER_TUNING;
    const active = this.pressed && this.enabled;
    if (active) {
      this.omega += this.dir * t.accel * h;
      if (Math.abs(this.omega) > t.maxOmega) this.omega = this.dir * t.maxOmega;
      if (this.omega * this.dir < 0) this.omega += this.dir * t.accel * h; // reverse quickly
    } else {
      this.omega -= this.dir * t.returnAccel * h;
      if (Math.abs(this.omega) > t.returnOmega && this.omega * this.dir < 0) this.omega = -this.dir * t.returnOmega;
    }
    this.angle += this.omega * h;
    // End stops
    const lo = Math.min(this.rest, this.up);
    const hi = Math.max(this.rest, this.up);
    if (this.angle < lo) {
      this.angle = lo;
      this.omega = 0;
    } else if (this.angle > hi) {
      this.angle = hi;
      this.omega = 0;
    }
    this.updateTip();
  }

  /** Surface velocity of a point on the flipper. */
  pointVelocity(x: number, y: number): [number, number] {
    return [-this.omega * (y - this.py), this.omega * (x - this.px)];
  }
}
