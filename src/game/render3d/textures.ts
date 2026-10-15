// Procedural textures (no downloaded assets): wood grain, brushed metal, label decals and
// noise. All are generated once on canvases and cached.

import * as THREE from 'three';
import { rng } from '../render/art.ts';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function woodTexture(base = '#6b3f22', dark = '#3a2010', key = 'wood'): THREE.Texture {
  const k = `${key}:${base}:${dark}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const [c, ctx] = canvas(512, 512);
  const r = rng(7);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    const y = r() * 512;
    const amp = 2 + r() * 6;
    const freq = 0.004 + r() * 0.01;
    ctx.strokeStyle = `rgba(${r() < 0.5 ? '20,10,4' : '255,220,170'},${0.05 + r() * 0.12})`;
    ctx.lineWidth = 0.6 + r() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 8) ctx.lineTo(x, y + Math.sin(x * freq + i) * amp);
    ctx.stroke();
  }
  // knots
  for (let i = 0; i < 4; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const g = ctx.createRadialGradient(x, y, 1, x, y, 18 + r() * 14);
    g.addColorStop(0, dark);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, y - 40, 80, 80);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(k, t);
  return t;
}

/** Brushed-metal roughness map (grayscale streaks). */
export function brushedRoughness(): THREE.Texture {
  const hit = cache.get('brushed');
  if (hit) return hit;
  const [c, ctx] = canvas(256, 256);
  const r = rng(3);
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const y = r() * 256;
    const v = 70 + Math.floor(r() * 90);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 0.6 + r());
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set('brushed', t);
  return t;
}

/** Fine noise used as a bump map for lacquer/plastics so reflections break up subtly. */
export function noiseTexture(): THREE.Texture {
  const hit = cache.get('noise');
  if (hit) return hit;
  const [c, ctx] = canvas(256, 256);
  const img = ctx.createImageData(256, 256);
  const r = rng(99);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(r() * 40);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  cache.set('noise', t);
  return t;
}

export interface LabelOptions {
  fg?: string;
  bg?: string;
  font?: string;
  weight?: number;
  size?: number;
  w?: number;
  h?: number;
  radius?: number;
  stroke?: string;
}

/** Text decal on a canvas texture (labels for bumper caps, targets, signs). */
export function labelTexture(text: string, o: LabelOptions = {}): THREE.CanvasTexture {
  const w = o.w ?? 256;
  const h = o.h ?? 128;
  const k = `label:${text}:${JSON.stringify(o)}`;
  const hit = cache.get(k) as THREE.CanvasTexture | undefined;
  if (hit) return hit;
  const [c, ctx] = canvas(w, h);
  if (o.bg) {
    ctx.fillStyle = o.bg;
    const r = o.radius ?? 0;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, r);
    ctx.fill();
  }
  ctx.fillStyle = o.fg ?? '#1a1030';
  const size = o.size ?? Math.round(h * 0.62);
  ctx.font = `${o.weight ?? 800} ${size}px ${o.font ?? '"Fraunces Variable", Georgia, serif'}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // shrink to fit
  let s = size;
  while (ctx.measureText(text).width > w * 0.9 && s > 8) {
    s -= 2;
    ctx.font = `${o.weight ?? 800} ${s}px ${o.font ?? '"Fraunces Variable", Georgia, serif'}`;
  }
  if (o.stroke) {
    ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.strokeStyle = o.stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, w / 2, h / 2 + s * 0.04);
  }
  ctx.fillText(text, w / 2, h / 2 + s * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}

/** Soft radial sprite (glows, contact shadows, particles). */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', key = 'radial'): THREE.Texture {
  const k = `${key}:${inner}:${outer}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(k, t);
  return t;
}

export function disposeTextureCache() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
