// Shared procedural art toolkit for table scenery. Everything is drawn in table units
// (600 x 1150). Helpers are deterministic (seeded) so cached backdrops never shimmer.

export const TAU = Math.PI * 2;
export const W = 600;
export const H = 1150;

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function clamp01(t: number) {
  return Math.max(0, Math.min(1, t));
}

/** Smooth 0..1 ramp of `level` between lo and hi (for staged awakenings). */
export function stage(level: number, lo: number, hi = lo + 1) {
  const t = clamp01((level - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
}

export function rgba(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(h1: string, h2: string, t: number) {
  const p = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = p(h1);
  const b = p(h2);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return `#${((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, '0')}`;
}

export function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function stars(ctx: CanvasRenderingContext2D, seed: number, n: number, area: [number, number, number, number], color = '#FFF7E7', twinkleT?: number) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * (area[2] - area[0]);
    const y = area[1] + r() * (area[3] - area[1]);
    const s = 0.6 + r() * 1.6;
    const tw = twinkleT === undefined ? 1 : 0.5 + 0.5 * Math.sin(twinkleT * (1 + r() * 2) + i);
    ctx.fillStyle = rgba(color, 0.35 + 0.6 * tw * r());
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
  }
}

/** Neon tube stroke: dark unlit tube that brightens with `lit` (0..1). */
export function neonPath(ctx: CanvasRenderingContext2D, draw: () => void, color: string, lit: number, width = 4) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw();
  ctx.strokeStyle = 'rgba(20,12,30,0.8)';
  ctx.lineWidth = width + 3;
  ctx.stroke();
  if (lit > 0.01) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 * lit;
    draw();
    ctx.strokeStyle = rgba(color, 0.25 + 0.75 * lit);
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.shadowBlur = 0;
    draw();
    ctx.strokeStyle = rgba('#FFFFFF', 0.6 * lit);
    ctx.lineWidth = Math.max(1, width * 0.35);
    ctx.stroke();
  } else {
    draw();
    ctx.strokeStyle = rgba(color, 0.18);
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

export function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, lit: number, font = '"Fraunces Variable", Georgia, serif') {
  ctx.save();
  ctx.font = `800 ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,12,30,0.85)';
  ctx.lineWidth = 5;
  ctx.strokeText(text, x, y);
  if (lit > 0.01) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 20 * lit;
  }
  ctx.fillStyle = lit > 0.01 ? rgba(color, 0.3 + 0.7 * lit) : rgba(color, 0.2);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Strand of bulbs along a sagging curve. */
export function stringLights(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, sag: number, n: number, colors: string[], lit: number, t = 0) {
  ctx.save();
  ctx.strokeStyle = 'rgba(30,20,40,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const pt = (u: number) => [lerp(x0, x1, u), lerp(y0, y1, u) + Math.sin(u * Math.PI) * sag];
  for (let i = 0; i <= 24; i++) {
    const [x, y] = pt(i / 24);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const [x, y] = pt(u);
    const c = colors[i % colors.length];
    const tw = lit * (0.75 + 0.25 * Math.sin(t * 3 + i * 1.7));
    ctx.fillStyle = tw > 0.05 ? rgba(c, 0.35 + 0.65 * tw) : 'rgba(60,50,70,0.8)';
    ctx.beginPath();
    ctx.arc(x, y + 3, 3, 0, TAU);
    ctx.fill();
    if (tw > 0.05) glowDot(ctx, x, y + 3, 10, c, 0.5 * tw);
  }
  ctx.restore();
}

/** Layered rolling hills silhouette. */
export function hills(ctx: CanvasRenderingContext2D, seed: number, baseY: number, amp: number, color: string, bumps = 5) {
  const r = rng(seed);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, baseY);
  const phases = Array.from({ length: bumps }, () => r() * TAU);
  for (let x = 0; x <= W; x += 10) {
    let y = baseY;
    phases.forEach((p, i) => (y += Math.sin((x / W) * TAU * (i + 1) * 0.5 + p) * (amp / (i + 1))));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

export function gear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * TAU;
    const rr = i % 2 === 0 ? r : r * 0.82;
    ctx.lineTo(Math.cos(a - 0.08) * rr, Math.sin(a - 0.08) * rr);
    ctx.lineTo(Math.cos(a + 0.08) * rr, Math.sin(a + 0.08) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function leafShape(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  ctx.fill();
  ctx.restore();
}

/** Simple branching vine/tree drawn recursively (deterministic). */
export function branch(ctx: CanvasRenderingContext2D, seed: number, x: number, y: number, len: number, angle: number, depth: number, color: string, leaf?: string) {
  const r = rng(seed);
  const go = (x0: number, y0: number, l: number, a: number, d: number) => {
    const x1 = x0 + Math.cos(a) * l;
    const y1 = y0 + Math.sin(a) * l;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, d * 1.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (d <= 1) {
      if (leaf) leafShape(ctx, x1, y1, 10 + r() * 8, a + (r() - 0.5), leaf);
      return;
    }
    go(x1, y1, l * (0.65 + r() * 0.15), a - 0.35 - r() * 0.3, d - 1);
    go(x1, y1, l * (0.65 + r() * 0.15), a + 0.35 + r() * 0.3, d - 1);
  };
  go(x, y, len, angle, depth);
}

export function waves(ctx: CanvasRenderingContext2D, y: number, amp: number, len: number, phase: number, color: string, fillTo = H) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, fillTo);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + Math.sin(x / len + phase) * amp);
  ctx.lineTo(W, fillTo);
  ctx.closePath();
  ctx.fill();
}

export function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.6, 0, TAU);
  ctx.arc(x + s * 0.6, y - s * 0.25, s * 0.7, 0, TAU);
  ctx.arc(x + s * 1.3, y, s * 0.55, 0, TAU);
  ctx.rect(x, y, s * 1.3, s * 0.55);
  ctx.fill();
}

/** Rounded rectangle path. */
export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Small banner label painted on the playfield. */
export function plaque(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, ink = '#1a1030', size = 11) {
  ctx.save();
  ctx.font = `700 ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 14;
  rrect(ctx, x - w / 2, y - size, w, size * 2, size * 0.6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

/** Floating particle field for ambient layers (cheap). */
export function drift(ctx: CanvasRenderingContext2D, seed: number, n: number, t: number, color: string, area: [number, number, number, number], speed = 12, size = 2, alpha = 0.5) {
  const r = rng(seed);
  const [x0, y0, x1, y1] = area;
  for (let i = 0; i < n; i++) {
    const bx = x0 + r() * (x1 - x0);
    const by = y0 + r() * (y1 - y0);
    const sp = speed * (0.5 + r());
    const ph = r() * TAU;
    const x = bx + Math.sin(t * 0.5 + ph) * 12;
    let y = by - ((t * sp) % (y1 - y0));
    if (y < y0) y += y1 - y0;
    ctx.fillStyle = rgba(color, alpha * (0.4 + 0.6 * Math.abs(Math.sin(t + ph))));
    ctx.beginPath();
    ctx.arc(x, y, size * (0.6 + r()), 0, TAU);
    ctx.fill();
  }
}
