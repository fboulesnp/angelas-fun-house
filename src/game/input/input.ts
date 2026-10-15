// Input: keyboard (remappable), multi-touch zones with pointer capture, and gamepad polling.
// Inputs are released on blur, visibility change, pointer cancel and orientation change.

export type Action = 'left' | 'right' | 'plunger' | 'pause' | 'nudge';

export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Bindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  plunger: ['Space', 'ArrowDown'],
  pause: ['KeyP', 'Escape'],
  nudge: ['KeyN'],
};

export const ACTION_LABELS: Record<Action, string> = {
  left: 'Left flipper',
  right: 'Right flipper',
  plunger: 'Plunger (hold, release)',
  pause: 'Pause',
  nudge: 'Nudge (optional)',
};

export function keyLabel(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Escape: 'Esc',
    ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', Enter: 'Enter', Slash: '/',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

export interface InputSink {
  flipper(side: 'left' | 'right', down: boolean): void;
  plunger(down: boolean): void;
  /** Quick tap on the touch plunger: auto-launch. */
  plungerTap(): void;
  pause(): void;
  nudge(): void;
  /** Called on any input while a resume countdown runs (to skip it). */
  any?(): void;
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (el as HTMLElement).isContentEditable;
}

export class InputController {
  private sink: InputSink;
  bindings: Bindings;
  /** When false (menus/modals open) keys are left alone entirely. */
  active = false;
  private held = new Set<Action>();
  private pointers = new Map<number, 'left' | 'right' | 'plunger'>();
  private plungerDownAt = 0;
  private pads: boolean[] = [];
  private cleanup: (() => void)[] = [];

  constructor(sink: InputSink, bindings: Bindings) {
    this.sink = sink;
    this.bindings = bindings;
    const kd = (e: KeyboardEvent) => this.onKey(e, true);
    const ku = (e: KeyboardEvent) => this.onKey(e, false);
    const blur = () => this.releaseAll();
    // Only release inputs here: the game screen owns pausing on hide (a second toggle here
    // would immediately un-pause it).
    const vis = () => {
      if (document.hidden) this.releaseAll();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('orientationchange', blur);
    this.cleanup.push(() => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('orientationchange', blur);
    });
  }

  private actionFor(code: string): Action | undefined {
    for (const a of Object.keys(this.bindings) as Action[]) if (this.bindings[a].includes(code)) return a;
    return undefined;
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (!this.active || isTypingTarget(document.activeElement)) return;
    const a = this.actionFor(e.code);
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    if (down) this.sink.any?.();
    this.apply(a, down);
  }

  private apply(a: Action, down: boolean) {
    if (down) {
      if (this.held.has(a)) return;
      this.held.add(a);
    } else {
      if (!this.held.has(a)) return;
      this.held.delete(a);
    }
    switch (a) {
      case 'left':
      case 'right':
        this.sink.flipper(a, down);
        break;
      case 'plunger':
        this.sink.plunger(down);
        break;
      case 'pause':
        if (down) this.sink.pause();
        break;
      case 'nudge':
        if (down) this.sink.nudge();
        break;
    }
  }

  releaseAll() {
    for (const a of [...this.held]) this.apply(a, false);
    for (const [id] of this.pointers) this.pointerUp(id);
    this.pointers.clear();
  }

  /** Bind a touch/pointer zone element. */
  bindZone(el: HTMLElement, zone: 'left' | 'right' | 'plunger') {
    const down = (e: PointerEvent) => {
      if (!this.active) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture may be unavailable */
      }
      this.pointers.set(e.pointerId, zone);
      this.sink.any?.();
      if (zone === 'plunger') {
        this.plungerDownAt = performance.now();
        this.sink.plunger(true);
      } else this.sink.flipper(zone, true);
      el.classList.add('pressed');
    };
    const up = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      e.preventDefault();
      this.pointerUp(e.pointerId);
      el.classList.remove('pressed');
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.cleanup.push(() => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('lostpointercapture', up);
    });
  }

  private pointerUp(id: number) {
    const zone = this.pointers.get(id);
    if (!zone) return;
    this.pointers.delete(id);
    // another pointer may still hold the same zone
    if ([...this.pointers.values()].includes(zone)) return;
    if (zone === 'plunger') {
      const quick = performance.now() - this.plungerDownAt < 180;
      this.sink.plunger(false);
      if (quick) this.sink.plungerTap();
    } else this.sink.flipper(zone, false);
  }

  /** Poll gamepads once per frame. */
  pollGamepads() {
    if (!this.active || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return;
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const state = {
      left: b(4) || b(6) || b(14),
      right: b(5) || b(7) || b(15),
      plunger: b(0) || b(13),
      pause: b(9),
      nudge: b(3),
    };
    const order: Action[] = ['left', 'right', 'plunger', 'pause', 'nudge'];
    order.forEach((a, i) => {
      const now = state[a];
      if (now !== !!this.pads[i]) {
        this.pads[i] = now;
        this.apply(a, now);
      }
    });
  }

  dispose() {
    this.releaseAll();
    for (const c of this.cleanup) c();
    this.cleanup = [];
  }
}
