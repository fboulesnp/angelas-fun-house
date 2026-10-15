// Layered Canvas 2D renderer: cached backdrop + static rails, then lamps, toys, flippers,
// balls (playfield layer), translucent ramps, ramp-layer balls, and short-lived effects.
// Readability rule: nothing is ever drawn over a live ball except the ball's own glow.

import { Flipper } from '../physics/flipper.ts';
import { BALL_R, TABLE_H, TABLE_W } from '../physics/types.ts';
import type { Ball } from '../physics/ball.ts';
import {
  Bumper, Diverter, DropTarget, FlipperMech, Gate, Insert, Kickback, Plunger, Portal, Post, Ramp, Rollover,
  Saucer, ShotSwitch, Slingshot, Spinner, Target, Wall, offsetPath, type Mechanism,
} from '../table/mechanisms.ts';
import type { TableDef, TableTheme } from '../table/tableDef.ts';
import type { GameSession } from '../rules/session.ts';
import { drawIcon, type IconPainter } from './icons.ts';
import type { SceneryContext } from './sceneryTypes.ts';

const TAU = Math.PI * 2;

export interface RenderSettings {
  reducedMotion: boolean;
  lowEffects: boolean;
  trailLength: number; // 0..1
  debug: boolean;
  highContrast: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
}

export class Renderer {
  dispose() {
    this.particles.length = 0;
    this.staticLayer = null;
  }

  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private session: GameSession;
  private def: TableDef;
  private theme: TableTheme;
  private staticLayer: HTMLCanvasElement | null = null;
  private staticKey = '';
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  /** Pixel scale from table units to canvas pixels and letterbox offset. */
  scale = 1;
  ox = 0;
  oy = 0;
  dpr = 1;
  t = 0;
  settings: RenderSettings;
  icons?: Record<string, IconPainter>;

  constructor(canvas: HTMLCanvasElement, session: GameSession, settings: RenderSettings) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;
    this.session = session;
    this.def = session.def;
    this.theme = session.def.theme;
    this.settings = settings;
    this.icons = (session.def as TableDef & { icons?: Record<string, IconPainter> }).icons;
  }

  /** Match the canvas backing store to its CSS size. */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const maxDpr = this.settings.lowEffects ? 1.25 : 2;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scale = Math.min(w / TABLE_W, h / TABLE_H);
    this.ox = (w - TABLE_W * this.scale) / 2;
    this.oy = (h - TABLE_H * this.scale) / 2;
    this.staticKey = '';
  }

  /** Convert a client (CSS px) point to table units. */
  toTable(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) * this.dpr - this.ox) / this.scale;
    const y = ((clientY - r.top) * this.dpr - this.oy) / this.scale;
    return [x, y];
  }

  fx(kind: string, x: number, y: number, value?: number) {
    if (kind === 'score' && value) {
      this.popups.push({ x, y, text: value.toLocaleString(), life: 1.1 });
      if (this.popups.length > 8) this.popups.shift();
    }
    if (this.settings.lowEffects) return;
    const n = kind === 'burst' ? 26 : kind === 'score' ? 10 : 6;
    const colors = [this.theme.lampOn, this.theme.accent, this.theme.accent2, '#FFF7E7'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.4;
      const sp = 80 + Math.random() * (kind === 'burst' ? 360 : 180);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, max: 1, color: colors[i % colors.length], size: 2 + Math.random() * 3 });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  private sceneryCtx(ctx: CanvasRenderingContext2D): SceneryContext {
    return {
      ctx,
      t: this.t,
      level: this.session.sceneryLevel,
      energy: this.session.energy,
      reduced: this.settings.reducedMotion,
      lowFx: this.settings.lowEffects,
      theme: this.theme,
    };
  }

  // ------------------------------------------------------------------ frame

  render(dt: number) {
    const s = this.session;
    if (s.state !== 'paused' && s.state !== 'parked') this.t += dt;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120c22';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const levelKey = `${Math.round(s.sceneryLevel * 8)}|${this.canvas.width}x${this.canvas.height}|${this.settings.highContrast}`;
    if (levelKey !== this.staticKey) this.buildStatic(levelKey);
    if (this.staticLayer) ctx.drawImage(this.staticLayer, 0, 0);

    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    // playfield clip
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, TABLE_W, TABLE_H);
    ctx.clip();
    if (this.def.scenery.ambient && !this.settings.lowEffects) {
      ctx.save();
      this.def.scenery.ambient(this.sceneryCtx(ctx));
      ctx.restore();
    } else if (this.def.scenery.ambient && this.settings.lowEffects) {
      ctx.save();
      this.def.scenery.ambient({ ...this.sceneryCtx(ctx), lowFx: true });
      ctx.restore();
    }
    if (s.state === 'celebrate' && this.def.scenery.celebrate) {
      ctx.save();
      this.def.scenery.celebrate(this.sceneryCtx(ctx), s.celebrateProgress);
      ctx.restore();
    }

    const mechs = s.rt.order;
    // floor features
    for (const m of mechs) {
      if (m instanceof Insert) this.drawInsert(m);
      else if (m instanceof Rollover) this.drawRollover(m);
      else if (m instanceof Saucer) this.drawSaucer(m);
      else if (m instanceof Portal) this.drawPortal(m);
      else if (m instanceof Kickback) this.drawKickback(m);
      else if (m instanceof ShotSwitch && this.settings.debug) this.drawShotSwitch(m);
    }
    // toys
    for (const m of mechs) {
      if (m instanceof Slingshot) this.drawSling(m);
      else if (m instanceof Bumper) this.drawBumper(m);
      else if (m instanceof Target) this.drawTarget(m);
      else if (m instanceof DropTarget) this.drawDrop(m);
      else if (m instanceof Spinner) this.drawSpinner(m);
      else if (m instanceof Gate) this.drawGate(m);
      else if (m instanceof Diverter) this.drawDiverter(m);
      else if (m instanceof Post && m.hitFlash > 0) this.drawPostFlash(m);
      else if (m instanceof Plunger) this.drawPlunger(m);
    }
    for (const m of mechs) if (m instanceof FlipperMech && m.flipper.layer === 0) this.drawFlipper(m.flipper);
    // playfield-layer balls
    for (const b of s.rt.world.balls) if (b.layer === 0 && b.state !== 'transit') this.drawBall(b);
    // ramps above, then ramp-layer balls and upper-layer flippers
    for (const m of mechs) if (m instanceof Ramp) this.drawRamp(m);
    for (const m of mechs) if (m instanceof Wall && m.layer === 1) this.drawWall(ctx, m);
    for (const m of mechs) if (m instanceof FlipperMech && m.flipper.layer === 1) this.drawFlipper(m.flipper);
    for (const b of s.rt.world.balls) if (b.layer === 1 && b.state !== 'transit') this.drawBall(b);
    this.drawEffects(dt);
    if (this.settings.debug) this.drawDebug();
    ctx.restore();
  }

  // ------------------------------------------------------------------ static layer

  private buildStatic(key: string) {
    this.staticKey = key;
    const c = this.staticLayer ?? document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    // Lacquered playfield
    const g = ctx.createLinearGradient(0, 0, 0, TABLE_H);
    g.addColorStop(0, this.theme.bg[0]);
    g.addColorStop(1, this.theme.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, TABLE_W, TABLE_H);
    ctx.clip();
    this.def.scenery.backdrop(this.sceneryCtx(ctx));
    ctx.restore();
    // Lacquer sheen
    const sheen = ctx.createLinearGradient(0, 0, TABLE_W, TABLE_H * 0.6);
    sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);
    // Apron
    this.drawApron(ctx);
    // Rails and posts
    for (const m of this.session.rt.order) {
      if (m instanceof Wall && m.layer === 0) this.drawWall(ctx, m);
      else if (m instanceof Post) this.drawPost(ctx, m);
    }
    // Vignette
    const v = ctx.createRadialGradient(TABLE_W / 2, TABLE_H * 0.45, TABLE_H * 0.3, TABLE_W / 2, TABLE_H * 0.5, TABLE_H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);
    this.staticLayer = c;
  }

  private drawApron(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 1050, 0, TABLE_H);
    g.addColorStop(0, 'rgba(20,12,36,0)');
    g.addColorStop(0.3, 'rgba(20,12,36,0.85)');
    g.addColorStop(1, '#140c24');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(24, 1060);
    ctx.lineTo(200, 1112);
    ctx.lineTo(372, 1112);
    ctx.lineTo(548, 1060);
    ctx.lineTo(548, TABLE_H);
    ctx.lineTo(24, TABLE_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = this.theme.accent;
    ctx.globalAlpha = 0.55;
    ctx.font = '600 15px "Fraunces Variable", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText("ANGELA'S FUN HOUSE", 286, 1134);
    ctx.restore();
    // shooter lane floor
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(551, 330, 42, 810);
    ctx.restore();
  }

  drawWall(ctx: CanvasRenderingContext2D, w: Wall) {
    if (w.style === 'invisible') return;
    const pts = w.closed ? [...w.points, w.points[0]] : w.points;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const width = Math.max(3, w.r * 2);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    };
    if (w.style === 'rubber') {
      path();
      ctx.strokeStyle = '#1b1324';
      ctx.lineWidth = width + 2;
      ctx.stroke();
      path();
      ctx.strokeStyle = this.theme.accent2;
      ctx.lineWidth = width - 1;
      ctx.stroke();
    } else if (w.style === 'glass') {
      path();
      ctx.strokeStyle = 'rgba(200,240,255,0.35)';
      ctx.lineWidth = width + 3;
      ctx.stroke();
      path();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (w.style === 'wood') {
      path();
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = width + 3;
      ctx.stroke();
      path();
      ctx.strokeStyle = '#8a5a34';
      ctx.lineWidth = width;
      ctx.stroke();
    } else {
      path();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = width + 4;
      ctx.translate(2, 3);
      ctx.stroke();
      ctx.translate(-2, -3);
      path();
      ctx.strokeStyle = this.theme.rail;
      ctx.lineWidth = width + 1;
      ctx.stroke();
      path();
      ctx.strokeStyle = this.theme.railHighlight;
      ctx.lineWidth = Math.max(1, width * 0.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPost(ctx: CanvasRenderingContext2D, p: Post) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 3, p.r + 1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = this.theme.accent2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------------ mechanisms

  private lampAlpha(m: Mechanism): number {
    const reduced = this.settings.reducedMotion;
    switch (m.lamp) {
      case 'on':
        return 1;
      case 'flash':
        // Gentle 1.6 Hz pulse (never rapid flashing); reduced motion holds steady.
        return reduced ? 0.95 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 10));
      case 'pulse':
        return reduced ? 0.8 : 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 4));
      default:
        return 0;
    }
  }

  private glow(x: number, y: number, r: number, color: string, alpha: number) {
    if (alpha <= 0.01) return;
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawInsert(m: Insert) {
    const ctx = this.ctx;
    const a = this.lampAlpha(m);
    const color = m.lampColor ?? this.theme.lampOn;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle + Math.PI / 2);
    const s = m.size;
    ctx.beginPath();
    if (m.shape === 'arrow') {
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.75, s * 0.15);
      ctx.lineTo(s * 0.3, s * 0.15);
      ctx.lineTo(s * 0.3, s * 0.9);
      ctx.lineTo(-s * 0.3, s * 0.9);
      ctx.lineTo(-s * 0.3, s * 0.15);
      ctx.lineTo(-s * 0.75, s * 0.15);
      ctx.closePath();
    } else if (m.shape === 'star') {
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i / 10) * TAU;
        const r = i % 2 === 0 ? s : s * 0.45;
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
    } else {
      ctx.arc(0, 0, s * 0.6, 0, TAU);
    }
    ctx.fillStyle = this.theme.lampOff;
    ctx.fill();
    if (a > 0) {
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    if (a > 0) this.glow(m.x, m.y, s * 2.2, color, a * 0.5);
    if (m.label) {
      ctx.save();
      ctx.fillStyle = this.theme.ink;
      ctx.globalAlpha = 0.85;
      ctx.font = '700 10px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y + m.size + 12);
      ctx.restore();
    }
  }

  private drawRollover(m: Rollover) {
    const ctx = this.ctx;
    const a = Math.max(this.lampAlpha(m), m.hitFlash * 2);
    ctx.save();
    ctx.fillStyle = this.theme.lampOff;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, 7, 11, 0, 0, TAU);
    ctx.fill();
    if (a > 0) {
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = m.lampColor ?? this.theme.lampOn;
      ctx.fill();
      ctx.globalAlpha = 1;
      this.glow(m.x, m.y, 26, m.lampColor ?? this.theme.lampOn, Math.min(1, a) * 0.5);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 6);
    ctx.lineTo(m.x, m.y + 6);
    ctx.stroke();
    if (m.label) {
      ctx.fillStyle = this.theme.ink;
      ctx.font = '700 11px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y - 16);
    }
    ctx.restore();
  }

  private drawSaucer(m: Saucer) {
    const ctx = this.ctx;
    const a = this.lampAlpha(m);
    const pocket = m.role === 'pocket';
    ctx.save();
    // ring
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r + 4, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.r + 4);
    g.addColorStop(0, '#000');
    g.addColorStop(1, pocket ? this.theme.accent : this.theme.rail);
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    ctx.stroke();
    if (pocket) {
      const t = this.settings.reducedMotion ? 0 : this.t;
      ctx.strokeStyle = this.theme.lampOn;
      ctx.globalAlpha = 0.35 + a * 0.65;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r + 10, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      this.glow(m.x, m.y, 46, this.theme.lampOn, 0.15 + a * 0.55);
    } else if (a > 0) {
      this.glow(m.x, m.y, 36, this.theme.lampOn, a * 0.6);
    }
    if (m.label) {
      ctx.fillStyle = this.theme.ink;
      ctx.font = `700 ${pocket ? 12 : 11}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y + m.r + (pocket ? 26 : 18));
    }
    ctx.restore();
  }

  private drawPortal(m: Portal) {
    const ctx = this.ctx;
    const t = this.settings.reducedMotion ? 0 : this.t;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i % 2 ? this.theme.accent : this.theme.accent2;
      ctx.globalAlpha = 0.7 - i * 0.18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 10 + i * 6, t * (1 + i) + i, t * (1 + i) + i + 4.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.glow(m.x, m.y, 34, this.theme.accent, 0.3 + m.hitFlash);
    // exit marker
    ctx.strokeStyle = this.theme.accent;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(m.exitX, m.exitY, 14, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawKickback(m: Kickback) {
    const a = this.lampAlpha(m);
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = this.theme.lampOff;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 12);
    ctx.lineTo(m.x + 9, m.y + 6);
    ctx.lineTo(m.x - 9, m.y + 6);
    ctx.closePath();
    ctx.fill();
    if (a > 0) {
      ctx.fillStyle = '#7CF29A';
      ctx.globalAlpha = a;
      ctx.fill();
      this.glow(m.x, m.y, 24, '#7CF29A', a * 0.5);
    }
    ctx.restore();
  }

  private drawShotSwitch(m: ShotSwitch) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,200,0.6)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x + m.dx * 20, m.y + m.dy * 20);
    ctx.stroke();
    ctx.restore();
  }

  private drawSling(m: Slingshot) {
    const ctx = this.ctx;
    const [a, b, c] = [m.a, m.b, m.c];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(a[0] + 3, a[1] + 4);
    ctx.lineTo(b[0] + 3, b[1] + 4);
    ctx.lineTo(c[0] + 3, c[1] + 4);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(a[0], a[1], c[0], c[1]);
    g.addColorStop(0, this.theme.accent);
    g.addColorStop(1, this.theme.accent2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
    ctx.fill();
    // rubber face, bulging when kicked
    const mx = (a[0] + c[0]) / 2;
    const my = (a[1] + c[1]) / 2;
    const nx = -(c[1] - a[1]);
    const ny = c[0] - a[0];
    const nl = Math.hypot(nx, ny);
    const side = (b[0] - mx) * nx + (b[1] - my) * ny > 0 ? -1 : 1;
    const bulge = m.squash * 7 * side;
    ctx.strokeStyle = '#FFF7E7';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(mx + (nx / nl) * bulge, my + (ny / nl) * bulge, c[0], c[1]);
    ctx.stroke();
    ctx.restore();
    if (m.hitFlash > 0) this.glow(mx, my, 40, this.theme.lampOn, m.hitFlash * 3);
  }

  private drawBumper(m: Bumper) {
    const ctx = this.ctx;
    const sq = m.squash;
    const lit = Math.max(this.lampAlpha(m), m.hitFlash * 4);
    ctx.save();
    ctx.translate(m.x, m.y);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(4, 6, m.r + 2, 0, TAU);
    ctx.fill();
    // skirt ring
    ctx.fillStyle = this.theme.bumperRing;
    ctx.beginPath();
    ctx.arc(0, 0, m.r + 1 - sq * 2, 0, TAU);
    ctx.fill();
    // cap
    const r = m.r * 0.78;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#FFF7E7');
    g.addColorStop(0.35, this.theme.bumperCap);
    g.addColorStop(1, shade(this.theme.bumperCap, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -sq * 2, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = this.theme.ink;
    if (m.icon && drawIcon(ctx, m.icon, r * 0.6, this.icons)) {
      // icon drawn
    } else if (m.label) {
      ctx.fillStyle = '#1a1030';
      ctx.font = `700 ${Math.round(r * 0.8)}px "Fraunces Variable", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.label, 0, -sq * 2 + 1);
    }
    ctx.restore();
    if (lit > 0) this.glow(m.x, m.y, m.r * 2.4, this.theme.lampOn, Math.min(1, lit) * 0.6);
  }

  private drawTarget(m: Target) {
    const ctx = this.ctx;
    const a = Math.max(this.lampAlpha(m), m.hitFlash * 3);
    const mx = (m.x1 + m.x2) / 2;
    const my = (m.y1 + m.y2) / 2;
    ctx.save();
    const w = m.wobble * 1.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(m.x1 + 2, m.y1 + 3);
    ctx.lineTo(m.x2 + 2, m.y2 + 3);
    ctx.stroke();
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(m.x1 + w, m.y1);
    ctx.lineTo(m.x2 + w, m.y2);
    ctx.stroke();
    ctx.strokeStyle = a > 0 ? this.theme.lampOn : this.theme.lampOff;
    ctx.globalAlpha = a > 0 ? Math.min(1, a) : 1;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(m.x1 + w, m.y1);
    ctx.lineTo(m.x2 + w, m.y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (m.icon || m.label) {
      ctx.translate(mx, my);
      // place label on the open side (toward the playfield center)
      const nx = -(m.y2 - m.y1);
      const ny = m.x2 - m.x1;
      const nl = Math.hypot(nx, ny) || 1;
      const sgn = (286 - mx) * nx + (600 - my) * ny > 0 ? 1 : -1;
      ctx.translate((nx / nl) * 16 * sgn, (ny / nl) * 16 * sgn);
      ctx.fillStyle = this.theme.ink;
      if (!drawIcon(ctx, m.icon, 7, this.icons) && m.label) {
        ctx.font = '700 11px "Atkinson Hyperlegible Next", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.label, 0, 0);
      }
    }
    ctx.restore();
    if (a > 0) this.glow(mx, my, 30, this.theme.lampOn, Math.min(1, a) * 0.45);
  }

  private drawDrop(m: DropTarget) {
    const ctx = this.ctx;
    const a = this.lampAlpha(m);
    const mx = (m.x1 + m.x2) / 2;
    const my = (m.y1 + m.y2) / 2;
    ctx.save();
    ctx.lineCap = 'butt';
    // slot
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(m.x2, m.y2);
    ctx.stroke();
    if (m.sink < 0.98) {
      ctx.globalAlpha = 1 - m.sink;
      ctx.strokeStyle = this.theme.accent2;
      ctx.lineWidth = 10 * (1 - m.sink * 0.6);
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (m.label) {
        ctx.fillStyle = '#1a1030';
        ctx.font = '700 9px "Atkinson Hyperlegible Next", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m.label, mx, my);
      }
    }
    ctx.restore();
    if (a > 0 && !m.down) this.glow(mx, my, 26, this.theme.lampOn, a * 0.5);
  }

  private drawSpinner(m: Spinner) {
    const ctx = this.ctx;
    const mx = (m.x1 + m.x2) / 2;
    const my = (m.y1 + m.y2) / 2;
    const f = Math.abs(Math.cos(m.angle));
    ctx.save();
    ctx.strokeStyle = this.theme.rail;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(m.x2, m.y2);
    ctx.stroke();
    ctx.translate(mx, my);
    ctx.rotate(Math.atan2(m.y2 - m.y1, m.x2 - m.x1));
    const len = Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
    ctx.fillStyle = this.theme.accent;
    ctx.fillRect(-len / 2 + 2, -4 * f, len - 4, 8 * f + 1);
    ctx.restore();
  }

  private drawGate(m: Gate) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.theme.railHighlight;
    ctx.globalAlpha = 0.85 - m.swing * 0.4;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m.x1, m.y1);
    ctx.lineTo(m.x2, m.y2);
    ctx.stroke();
    ctx.restore();
  }

  private drawDiverter(m: Diverter) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(m.px, m.py);
    ctx.lineTo(m.px + Math.cos(m.angle) * m.length, m.py + Math.sin(m.angle) * m.length);
    ctx.stroke();
    ctx.fillStyle = this.theme.railHighlight;
    ctx.beginPath();
    ctx.arc(m.px, m.py, 5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawPostFlash(m: Post) {
    this.glow(m.x, m.y, 22, this.theme.lampOn, m.hitFlash * 3);
  }

  private drawPlunger(p: Plunger) {
    const ctx = this.ctx;
    const y = p.tipY - p.fire * 10;
    ctx.save();
    const g = ctx.createLinearGradient(p.x - 8, 0, p.x + 8, 0);
    g.addColorStop(0, '#6b5a7e');
    g.addColorStop(0.5, '#e6dcf2');
    g.addColorStop(1, '#6b5a7e');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 5, y + 4, 10, TABLE_H - y);
    // spring coils
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 2;
    const coils = 7;
    const top = y + 14;
    const bottom = TABLE_H - 6;
    ctx.beginPath();
    for (let i = 0; i <= coils * 2; i++) {
      const yy = top + ((bottom - top) * i) / (coils * 2);
      ctx.lineTo(p.x + (i % 2 ? 9 : -9), yy);
    }
    ctx.stroke();
    ctx.fillStyle = this.theme.accent2;
    ctx.fillRect(p.x - p.laneHalf + 4, y - 3, (p.laneHalf - 4) * 2, 9);
    ctx.restore();
    if (p.pulling) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - 18, 960, 36, 8);
      ctx.fillStyle = this.theme.lampOn;
      ctx.fillRect(p.x - 18, 960, 36 * p.pull, 8);
      ctx.restore();
    }
  }

  drawFlipper(f: Flipper) {
    const ctx = this.ctx;
    const ws = f.widthScale;
    const r0 = f.r0 * ws;
    const r1 = f.r1 * ws;
    const ang = f.angle;
    const len = f.length;
    ctx.save();
    ctx.translate(f.px, f.py);
    ctx.rotate(ang);
    const shape = () => {
      ctx.beginPath();
      ctx.arc(0, 0, r0, Math.PI / 2, -Math.PI / 2);
      ctx.lineTo(len, -r1);
      ctx.arc(len, 0, r1, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
    };
    ctx.translate(3, 4);
    shape();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.translate(-3, -4);
    shape();
    const g = ctx.createLinearGradient(0, -r0, 0, r0);
    g.addColorStop(0, '#FFF7E7');
    g.addColorStop(0.45, this.theme.flipper);
    g.addColorStop(1, shade(this.theme.flipper, -0.4));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.theme.accent2;
    ctx.stroke();
    ctx.fillStyle = '#FFF7E7';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawRamp(m: Ramp) {
    const ctx = this.ctx;
    const left = offsetPath(m.path, m.width / 2 + 3);
    const right = offsetPath(m.path, -m.width / 2 - 3);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fillStyle = this.theme.ramp;
    ctx.fill();
    const a = Math.max(this.lampAlpha(m), m.hitFlash);
    ctx.lineWidth = 3;
    ctx.strokeStyle = a > 0 ? this.theme.lampOn : 'rgba(255,255,255,0.55)';
    ctx.globalAlpha = a > 0 ? 0.5 + a * 0.5 : 1;
    for (const side of [left, right]) {
      ctx.beginPath();
      ctx.moveTo(side[0][0], side[0][1]);
      for (const p of side) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Chevron flow marks
    const t = this.settings.reducedMotion ? 0 : this.t;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    for (let i = 1; i < m.path.length - 1; i++) {
      const p = m.path[i];
      const q = m.path[i + 1];
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const k = (t * 1.5 + i * 0.3) % 1;
      const x = p[0] + (q[0] - p[0]) * k;
      const y = p[1] + (q[1] - p[1]) * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-5, -8);
      ctx.lineTo(3, 0);
      ctx.lineTo(-5, 8);
      ctx.stroke();
      ctx.restore();
    }
    if (m.label) {
      const p = m.path[0];
      ctx.fillStyle = this.theme.ink;
      ctx.font = '700 11px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, p[0], p[1] + m.width / 2 + 14);
    }
    ctx.restore();
  }

  drawBall(b: Ball) {
    const ctx = this.ctx;
    const r = b.r;
    // trail
    const tl = this.settings.trailLength;
    if (tl > 0 && b.trail.length > 1 && !this.settings.reducedMotion) {
      const n = Math.max(2, Math.round(b.trail.length * tl));
      const pts = b.trail.slice(-n);
      for (let i = 0; i < pts.length; i++) {
        const k = (i + 1) / pts.length;
        ctx.save();
        ctx.globalAlpha = k * 0.28;
        ctx.fillStyle = this.theme.trail;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, r * (0.4 + 0.5 * k), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    if (b.state === 'held' && !this.settings.reducedMotion) this.glow(b.x, b.y, r * 4, this.theme.lampOn, 0.4 + 0.2 * Math.sin(this.t * 3));
    // halo for visibility on any background
    this.glow(b.x, b.y, r * 2.4, '#FFF7E7', 0.28);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(b.x + 3, b.y + 4, r, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.35, '#FFF7E7');
    g.addColorStop(0.75, '#9EEFE0');
    g.addColorStop(1, '#3F8FA0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.fill();
    // dark outline keeps the silhouette on bright scenery
    ctx.strokeStyle = 'rgba(20,10,40,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // inner sparkle that turns with the roll
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spin);
    ctx.fillStyle = 'rgba(255,199,91,0.85)';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU;
      const rr = i % 2 === 0 ? r * 0.38 : r * 0.14;
      ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawEffects(dt: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2;
      p.vy = p.vy * (1 - dt * 2) + 200 * dt;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.font = '800 16px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.popups.splice(i, 1);
        continue;
      }
      const y = p.y - (1.1 - p.life) * 40 - 24;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,10,40,0.85)';
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = this.theme.lampOn;
      ctx.fillText(p.text, p.x, y);
    }
    ctx.restore();
  }

  private drawDebug() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;
    for (const c of this.session.rt.world.colliders) {
      ctx.strokeStyle = c.sensor ? 'rgba(0,255,180,0.6)' : c.layer === 1 ? 'rgba(255,140,0,0.8)' : 'rgba(255,60,90,0.8)';
      if (!c.enabled) ctx.strokeStyle = 'rgba(120,120,120,0.4)';
      const s = c.shape;
      ctx.beginPath();
      if (s.kind === 'circle') ctx.arc(s.x, s.y, s.r, 0, TAU);
      else {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      }
      ctx.stroke();
    }
    for (const b of this.session.rt.world.balls) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(`${b.id} L${b.layer} ${b.state} ${Math.round(b.speed)}`, b.x + 14, b.y);
    }
    ctx.restore();
  }
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export { BALL_R };
