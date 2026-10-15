// The one authoritative simulation loop: fixed 120 Hz steps with a capped catch-up so a stall
// never fast-forwards the table, decoupled from rendering. Lives outside UI re-renders.

import { STEP } from './physics/types.ts';
import type { GameSession } from './rules/session.ts';
import type { TableRenderer } from './render3d/renderer3d.ts';

export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  running = false;
  /** Assistance: slower simulation (0.6 .. 1). */
  timeScale = 1;
  onFrame?: (dt: number) => void;
  /** Measured frames per second (smoothed). */
  fps = 60;
  private session: GameSession;
  private renderer: TableRenderer;

  constructor(session: GameSession, renderer: TableRenderer) {
    this.session = session;
    this.renderer = renderer;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
      this.acc += dt * this.timeScale;
      let steps = 0;
      while (this.acc >= STEP && steps < 8) {
        this.session.fixedStep();
        this.acc -= STEP;
        steps++;
      }
      // After a stall, drop the backlog instead of fast-forwarding the table.
      if (steps === 8) this.acc = 0;
      this.onFrame?.(dt);
      this.renderer.render(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
