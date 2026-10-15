// Procedural icon library drawn on bumper caps, targets and inserts. Icons are centered at 0,0
// and sized to fit a circle of radius s. Colour comes from ctx.fillStyle/strokeStyle set by caller.

export type IconPainter = (ctx: CanvasRenderingContext2D, s: number) => void;

const TAU = Math.PI * 2;

export const ICONS: Record<string, IconPainter> = {
  atom(ctx, s) {
    // Nucleus inside a soft electron cloud (not a planetary "solar system" model).
    const g = ctx.createRadialGradient(0, 0, s * 0.1, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, TAU);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996;
      const r = s * (0.35 + 0.55 * ((i * 37) % 11) / 11);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, s * 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.24, 0, TAU);
    ctx.fill();
  },
  molecule(ctx, s) {
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 0.35);
    ctx.lineTo(0, -s * 0.1);
    ctx.lineTo(s * 0.55, s * 0.35);
    ctx.stroke();
    for (const [x, y, r] of [[0, -0.1, 0.38], [-0.55, 0.35, 0.26], [0.55, 0.35, 0.26]]) {
      ctx.beginPath();
      ctx.arc(x * s, y * s, r * s, 0, TAU);
      ctx.fill();
    }
  },
  leaf(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.9, s * 0.2, -s * 0.5, -s * 0.8, 0, -s * 0.9);
    ctx.bezierCurveTo(s * 0.5, -s * 0.8, s * 0.9, s * 0.2, 0, s * 0.9);
    ctx.fill();
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85);
    ctx.lineTo(0, -s * 0.6);
    ctx.stroke();
  },
  sun(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.42, 0, TAU);
    ctx.fill();
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.6);
      ctx.lineTo(Math.cos(a) * s * 0.92, Math.sin(a) * s * 0.92);
      ctx.stroke();
    }
  },
  drop(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.bezierCurveTo(s * 0.2, -s * 0.5, s * 0.75, 0, s * 0.62, s * 0.35);
    ctx.arc(0, s * 0.35, s * 0.62, 0, Math.PI);
    ctx.bezierCurveTo(-s * 0.75, 0, -s * 0.2, -s * 0.5, 0, -s * 0.95);
    ctx.fill();
  },
  flame(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.6, s * 0.9, 0, s * 0.9);
    ctx.bezierCurveTo(-s * 0.6, s * 0.9, -s * 0.9, -s * 0.1, -s * 0.15, -s * 0.35);
    ctx.bezierCurveTo(-s * 0.1, 0, 0, -s * 0.5, 0, -s * 0.95);
    ctx.fill();
  },
  snow(ctx, s) {
    ctx.lineWidth = s * 0.13;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * TAU);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.9);
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(-s * 0.22, -s * 0.75);
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(s * 0.22, -s * 0.75);
      ctx.stroke();
      ctx.restore();
    }
  },
  gear(ctx, s) {
    ctx.beginPath();
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * TAU;
      const r = i % 2 === 0 ? s * 0.95 : s * 0.72;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.3, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
  flask(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.9);
    ctx.lineTo(s * 0.22, -s * 0.9);
    ctx.lineTo(s * 0.22, -s * 0.3);
    ctx.lineTo(s * 0.8, s * 0.75);
    ctx.quadraticCurveTo(s * 0.85, s * 0.92, s * 0.6, s * 0.92);
    ctx.lineTo(-s * 0.6, s * 0.92);
    ctx.quadraticCurveTo(-s * 0.85, s * 0.92, -s * 0.8, s * 0.75);
    ctx.lineTo(-s * 0.22, -s * 0.3);
    ctx.closePath();
    ctx.fill();
  },
  mountain(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, s * 0.75);
    ctx.lineTo(-s * 0.25, -s * 0.6);
    ctx.lineTo(s * 0.1, 0);
    ctx.lineTo(s * 0.4, -s * 0.35);
    ctx.lineTo(s * 0.95, s * 0.75);
    ctx.closePath();
    ctx.fill();
  },
  wave(ctx, s) {
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    for (const y of [-0.35, 0.1, 0.55]) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = -0.9 + (1.8 * i) / 12;
        ctx.lineTo(x * s, (y + Math.sin(i * 0.9) * 0.12) * s);
      }
      ctx.stroke();
    }
  },
  fossil(ctx, s) {
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const a = i * 0.25;
      const r = s * 0.06 * a;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
  },
  star(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const r = i % 2 === 0 ? s * 0.95 : s * 0.4;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  },
  lantern(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(0, s * 0.05, s * 0.6, s * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-s * 0.25, -s * 0.95, s * 0.5, s * 0.22);
    ctx.fillRect(-s * 0.25, s * 0.78, s * 0.5, s * 0.18);
  },
  bee(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(0, s * 0.1, s * 0.55, s * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha *= 0.6;
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.45, s * 0.3, s * 0.2, -0.5, 0, TAU);
    ctx.ellipse(s * 0.3, -s * 0.45, s * 0.3, s * 0.2, 0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha /= 0.6;
  },
  fish(ctx, s) {
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, 0, s * 0.6, s * 0.35, 0, 0, TAU);
    ctx.moveTo(s * 0.45, 0);
    ctx.lineTo(s * 0.95, -s * 0.38);
    ctx.lineTo(s * 0.95, s * 0.38);
    ctx.closePath();
    ctx.fill();
  },
  tree(ctx, s) {
    ctx.beginPath();
    ctx.arc(0, -s * 0.25, s * 0.6, 0, TAU);
    ctx.fill();
    ctx.fillRect(-s * 0.12, s * 0.2, s * 0.24, s * 0.7);
  },
  rock(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, s * 0.5);
    ctx.lineTo(-s * 0.6, -s * 0.3);
    ctx.lineTo(-s * 0.1, -s * 0.7);
    ctx.lineTo(s * 0.6, -s * 0.45);
    ctx.lineTo(s * 0.85, s * 0.3);
    ctx.lineTo(s * 0.3, s * 0.7);
    ctx.closePath();
    ctx.fill();
  },
  bolt(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 0.95);
    ctx.lineTo(-s * 0.55, s * 0.1);
    ctx.lineTo(-s * 0.05, s * 0.1);
    ctx.lineTo(-s * 0.25, s * 0.95);
    ctx.lineTo(s * 0.55, -s * 0.15);
    ctx.lineTo(s * 0.05, -s * 0.15);
    ctx.closePath();
    ctx.fill();
  },
  cloud(ctx, s) {
    ctx.beginPath();
    ctx.arc(-s * 0.35, s * 0.1, s * 0.38, 0, TAU);
    ctx.arc(s * 0.1, -s * 0.15, s * 0.48, 0, TAU);
    ctx.arc(s * 0.5, s * 0.15, s * 0.35, 0, TAU);
    ctx.rect(-s * 0.7, s * 0.1, s * 1.35, s * 0.38);
    ctx.fill();
  },
  heart(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.5, -s * 0.95, 0, -s * 0.35);
    ctx.bezierCurveTo(s * 0.5, -s * 0.95, s * 1.2, -s * 0.1, 0, s * 0.85);
    ctx.fill();
  },
  clock(ctx, s) {
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.8, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s * 0.55);
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.4, s * 0.1);
    ctx.stroke();
  },
  eye(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, 0);
    ctx.quadraticCurveTo(0, -s * 0.8, s * 0.95, 0);
    ctx.quadraticCurveTo(0, s * 0.8, -s * 0.95, 0);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.28, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
  question(ctx, s) {
    ctx.font = `700 ${s * 1.6}px Fraunces Variable, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, s * 0.08);
  },
};

export function drawIcon(ctx: CanvasRenderingContext2D, key: string | undefined, s: number, extra?: Record<string, IconPainter>) {
  if (!key) return false;
  const p = extra?.[key] ?? ICONS[key];
  if (!p) return false;
  ctx.save();
  p(ctx, s);
  ctx.restore();
  return true;
}
