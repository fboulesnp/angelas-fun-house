// SetKit: building blocks for each attraction's 3D diorama around the cabinet.
// World layout: the playfield spans X in [-3, 3], Z in [-5.75, 5.75] at Y = 0 (rails to ±3.35,
// head to Z = -6.05). Scenery lives in REGIONS so it never covers the playfield from the camera.

import * as THREE from 'three';
import type { TableTheme } from '../table/tableDef.ts';
import { rng } from '../render/art.ts';
import { Materials } from './materials.ts';
import { labelTexture, radialTexture } from './textures.ts';

export interface Region {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Maximum sensible height for objects here. */
  maxH: number;
}

export const REGIONS = {
  /** Behind the head of the table: tall set pieces welcome. */
  head: { x0: -9, x1: 9, z0: -16, z1: -6.4, maxH: 9 } as Region,
  left: { x0: -11, x1: -3.7, z0: -12, z1: 6.5, maxH: 3 } as Region,
  right: { x0: 3.7, x1: 11, z0: -12, z1: 6.5, maxH: 3 } as Region,
  /** Ground level around the cabinet. */
  groundY: -0.42,
};

export interface Lit {
  /** 0 = dark, 1 = fully lit. */
  setLit(v: number): void;
}

export interface SetHandle {
  update(t: number, dt: number, level: number, energy: number): void;
  /** Celebration progress 0..1 while balls are parked. */
  celebrate?(p: number, t: number): void;
  dispose?(): void;
}

export type SetBuilder = (kit: SetKit) => SetHandle;

export interface RoomContext {
  kit: SetKit;
  /** Room interior box: x in [-w/2, w/2], y in [0, h], z in [-d/2, d/2] (open toward +z). */
  w: number;
  h: number;
  d: number;
}

/** Miniature vignette shown in this attraction's room on the dollhouse map. */
export type RoomBuilder = (ctx: RoomContext) => { update(t: number, lit: number): void };

type V3 = [number, number, number];
const vec = (p: V3) => new THREE.Vector3(p[0], p[1], p[2]);

export class SetKit {
  readonly THREE = THREE;
  readonly root = new THREE.Group();
  readonly mats: Materials;
  readonly theme: TableTheme;
  readonly regions = REGIONS;
  readonly detail: number;
  readonly reducedMotion: boolean;
  private lights = 0;
  private disposables: { dispose(): void }[] = [];
  private animated: ((t: number, dt: number) => void)[] = [];

  constructor(mats: Materials, theme: TableTheme, opts: { detail: number; reducedMotion: boolean }) {
    this.mats = mats;
    this.theme = theme;
    this.detail = opts.detail;
    this.reducedMotion = opts.reducedMotion;
  }

  rand(seed: number) {
    return rng(seed);
  }

  /** Detail-scaled count (never below 1). */
  n(count: number) {
    return Math.max(1, Math.round(count * this.detail));
  }

  add<T extends THREE.Object3D>(o: T): T {
    this.root.add(o);
    return o;
  }

  track<T extends { dispose(): void }>(d: T): T {
    this.disposables.push(d);
    return d;
  }

  /** Register a per-frame animation (skipped automatically under reduced motion when `motion`). */
  animate(fn: (t: number, dt: number) => void, motion = true) {
    if (motion && this.reducedMotion) return;
    this.animated.push(fn);
  }

  tick(t: number, dt: number) {
    for (const f of this.animated) f(t, dt);
  }

  // ------------------------------------------------------------------ environment

  /** Ground plane around the cabinet with a soft radial falloff. */
  ground(color: string, radius = 30): THREE.Mesh {
    const g = new THREE.CircleGeometry(radius, 64);
    g.rotateX(-Math.PI / 2);
    const m = this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));
    const mesh = new THREE.Mesh(g, m);
    mesh.position.y = REGIONS.groundY;
    mesh.receiveShadow = true;
    return this.add(mesh);
  }

  /** Gradient sky dome. */
  sky(top: string, bottom: string): THREE.Mesh {
    const geo = new THREE.SphereGeometry(80, 32, 16);
    const mat = this.track(new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, smoothstep(0.35,1.0,h)),1.0); }',
    }));
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -10;
    return this.add(m);
  }

  /** Large painted backdrop flat (theatre scenery) behind the head; repaint by level. */
  backdrop(paint: (ctx: CanvasRenderingContext2D, w: number, h: number, level: number) => void, opts: { width?: number; height?: number; z?: number; y?: number } = {}) {
    const W = opts.width ?? 26;
    const H = opts.height ?? 11;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = Math.round((1024 * H) / W);
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.track(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.9 }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    mesh.position.set(0, (opts.y ?? H / 2 - 1.2), opts.z ?? -15);
    this.add(mesh);
    let last = -1;
    const repaint = (level: number) => {
      const k = Math.round(level * 6);
      if (k === last) return;
      last = k;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      paint(ctx, c.width, c.height, level);
      tex.needsUpdate = true;
      mat.emissiveIntensity = 0.25 + 0.12 * Math.min(4, level);
    };
    return { mesh, repaint };
  }

  // ------------------------------------------------------------------ lights

  /** Coloured spotlight aimed at a point (max 3 per set). */
  spot(pos: V3, target: V3, color: string, intensity = 30, angle = 0.5): THREE.SpotLight | null {
    if (this.lights >= 3) return null;
    this.lights++;
    const s = new THREE.SpotLight(color, intensity, 40, angle, 0.6, 1.6);
    s.position.copy(vec(pos));
    s.target.position.copy(vec(target));
    this.add(s);
    this.add(s.target);
    return s;
  }

  point(pos: V3, color: string, intensity = 6, distance = 8): THREE.PointLight | null {
    if (this.lights >= 3) return null;
    this.lights++;
    const p = new THREE.PointLight(color, intensity, distance, 2);
    p.position.copy(vec(pos));
    return this.add(p);
  }

  // ------------------------------------------------------------------ neon & signage

  neonTube(points: V3[], color: string, opts: { radius?: number; closed?: boolean } = {}): THREE.Mesh & Lit {
    const curve = new THREE.CatmullRomCurve3(points.map(vec), opts.closed ?? false);
    const geo = new THREE.TubeGeometry(curve, Math.max(24, points.length * 12), opts.radius ?? 0.05, 8, opts.closed ?? false);
    const mat = this.track(new THREE.MeshStandardMaterial({ color: '#111018', emissive: color, emissiveIntensity: 0.05, roughness: 0.3 }));
    const mesh = new THREE.Mesh(geo, mat) as unknown as THREE.Mesh & Lit;
    mesh.setLit = (v) => (mat.emissiveIntensity = 0.04 + v * 3.2);
    return this.add(mesh);
  }

  /** Neon text on a dark backing (canvas texture, emissive), facing +Z (the player). */
  neonSign(text: string, pos: V3, opts: { height?: number; color?: string; backing?: boolean; rotY?: number; font?: string } = {}): THREE.Group & Lit {
    const h = opts.height ?? 0.9;
    const color = opts.color ?? this.theme.lampOn;
    const tex = labelTexture(text, { fg: '#ffffff', w: 1024, h: 256, size: 190, font: opts.font ?? '"Fraunces Variable", Georgia, serif', weight: 800 });
    const aspect = 4;
    const g = new THREE.Group() as THREE.Group & Lit;
    const glyphMat = this.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveMap: tex, emissiveIntensity: 0.06, alphaMap: tex, transparent: true, depthWrite: false }));
    const glyph = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), glyphMat);
    glyph.position.z = 0.05;
    glyph.renderOrder = 3;
    g.add(glyph);
    if (opts.backing !== false) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(h * aspect * 0.92, h * 1.05, 0.06), this.mats.plastic('#1a1228'));
      g.add(back);
    }
    g.position.copy(vec(pos));
    g.rotation.y = opts.rotY ?? 0;
    g.setLit = (v) => (glyphMat.emissiveIntensity = 0.06 + v * 3);
    return this.add(g);
  }

  /** Wooden or painted panel with a printed label. */
  panel(text: string, pos: V3, opts: { w?: number; h?: number; bg?: string; fg?: string; rotY?: number } = {}): THREE.Mesh {
    const w = opts.w ?? 2.4;
    const h = opts.h ?? 0.7;
    const tex = labelTexture(text, { bg: opts.bg ?? this.theme.accent, fg: opts.fg ?? '#1a1030', w: 1024, h: Math.round((1024 * h) / w), radius: 40, font: '"Fraunces Variable", Georgia, serif' });
    const front = this.track(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.4, clearcoat: 0.6 }));
    const side = this.mats.wood();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [side, side, side, side, front, side]);
    mesh.position.copy(vec(pos));
    mesh.rotation.y = opts.rotY ?? 0;
    mesh.castShadow = true;
    return this.add(mesh);
  }

  /** Strand of bulbs on a sagging wire. */
  stringLights(from: V3, to: V3, sag: number, count: number, colors: string[]): THREE.Group & Lit {
    const g = new THREE.Group() as THREE.Group & Lit;
    const a = vec(from);
    const b = vec(to);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const p = a.clone().lerp(b, u);
      p.y -= Math.sin(u * Math.PI) * sag;
      pts.push(p);
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.008, 4), this.mats.dark()));
    const bulbs: THREE.MeshStandardMaterial[] = colors.map((c) => this.track(new THREE.MeshStandardMaterial({ color: '#221a2a', emissive: c, emissiveIntensity: 0.05 })));
    const geo = this.track(new THREE.SphereGeometry(0.05, 10, 8));
    // One instanced mesh per bulb colour keeps a long strand to a handful of draw calls.
    const m4 = new THREE.Matrix4();
    bulbs.forEach((mat, k) => {
      const n = Math.ceil((count - k) / bulbs.length);
      if (n <= 0) return;
      const inst = new THREE.InstancedMesh(geo, mat, n);
      let j = 0;
      for (let i = k; i < count; i += bulbs.length) {
        const u = (i + 0.5) / count;
        const p = a.clone().lerp(b, u);
        p.y -= Math.sin(u * Math.PI) * sag + 0.06;
        inst.setMatrixAt(j++, m4.makeTranslation(p.x, p.y, p.z));
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      g.add(inst);
    });
    g.setLit = (v) => bulbs.forEach((m) => (m.emissiveIntensity = 0.05 + v * 3.5));
    return this.add(g);
  }

  // ------------------------------------------------------------------ props

  lantern(pos: V3, color: string, size = 0.35): THREE.Group & Lit {
    const g = new THREE.Group() as THREE.Group & Lit;
    const mat = this.track(new THREE.MeshPhysicalMaterial({ color: '#2a1c18', emissive: color, emissiveIntensity: 0.1, roughness: 0.5, transmission: 0, transparent: true, opacity: 0.95 }));
    const body = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), mat);
    body.scale.y = 1.25;
    const capGeo = new THREE.CylinderGeometry(size * 0.45, size * 0.45, size * 0.18, 16);
    const top = new THREE.Mesh(capGeo, this.mats.brass());
    top.position.y = size * 1.3;
    const bottom = new THREE.Mesh(capGeo, this.mats.brass());
    bottom.position.y = -size * 1.3;
    g.add(body, top, bottom);
    g.position.copy(vec(pos));
    g.setLit = (v) => (mat.emissiveIntensity = 0.1 + v * 2.6);
    return this.add(g);
  }

  crystal(pos: V3, size: number, color: string, seed = 1): THREE.Mesh & Lit {
    const geo = new THREE.OctahedronGeometry(size, 0);
    geo.scale(0.6, 1.6, 0.6);
    const mat = this.track(new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transmission: 0.6, thickness: 0.5, emissive: color, emissiveIntensity: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 }));
    const m = new THREE.Mesh(geo, mat) as unknown as THREE.Mesh & Lit;
    const r = rng(seed);
    m.position.copy(vec(pos));
    m.rotation.set((r() - 0.5) * 0.4, r() * Math.PI, (r() - 0.5) * 0.4);
    m.castShadow = true;
    m.setLit = (v) => (mat.emissiveIntensity = 0.05 + v * 1.6);
    return this.add(m);
  }

  rock(pos: V3, size: number, color: string, seed = 1): THREE.Mesh {
    const geo = new THREE.IcosahedronGeometry(size, 2);
    const r = rng(seed);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(0.8 + r() * 0.35);
      v.y *= 0.7;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.mats.paintedMetal(color));
    (m.material as THREE.MeshPhysicalMaterial).metalness = 0;
    m.position.copy(vec(pos));
    m.castShadow = true;
    m.receiveShadow = true;
    return this.add(m);
  }

  /** Stylised tree: trunk + clustered foliage spheres. */
  tree(pos: V3, height: number, leaf: string, seed = 1, trunk = '#5b3a24'): THREE.Group {
    const g = new THREE.Group();
    const r = rng(seed);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.05, height * 0.08, height * 0.6, 8), this.mats.plastic(trunk));
    t.position.y = height * 0.3;
    t.castShadow = true;
    g.add(t);
    const leafMat = this.mats.plastic(leaf);
    for (let i = 0; i < this.n(6); i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(height * (0.18 + r() * 0.12), 1), leafMat);
      s.position.set((r() - 0.5) * height * 0.45, height * (0.6 + r() * 0.35), (r() - 0.5) * height * 0.45);
      s.castShadow = true;
      g.add(s);
    }
    g.position.copy(vec(pos));
    return this.add(g);
  }

  cloud(pos: V3, size: number, color = '#ffffff'): THREE.Group {
    const g = new THREE.Group();
    const mat = this.mats.plastic(color);
    const r = rng(Math.round(pos[0] * 100 + pos[2]));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(size * (0.35 + r() * 0.25), 16, 12), mat);
      s.position.set((i - 2) * size * 0.35, (r() - 0.3) * size * 0.25, (r() - 0.5) * size * 0.2);
      g.add(s);
    }
    g.position.copy(vec(pos));
    return this.add(g);
  }

  gear(pos: V3, radius: number, teeth: number, color: string, thickness = 0.12): THREE.Mesh {
    const s = new THREE.Shape();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? radius : radius * 0.82;
      const x1 = Math.cos(a - 0.08) * rr;
      const y1 = Math.sin(a - 0.08) * rr;
      const x2 = Math.cos(a + 0.08) * rr;
      const y2 = Math.sin(a + 0.08) * rr;
      if (i === 0) s.moveTo(x1, y1);
      else s.lineTo(x1, y1);
      s.lineTo(x2, y2);
    }
    s.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius * 0.3, 0, Math.PI * 2, true);
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
    geo.translate(0, 0, -thickness / 2);
    const m = new THREE.Mesh(geo, this.mats.paintedMetal(color));
    m.position.copy(vec(pos));
    m.castShadow = true;
    return this.add(m);
  }

  /** Animated water surface (vertex waves), e.g. pools and harbours beside the cabinet. */
  water(pos: V3, w: number, d: number, color: string): THREE.Mesh & { level(v: number): void } {
    const geo = new THREE.PlaneGeometry(w, d, 48, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = this.track(new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0.1, transmission: 0.3, transparent: true, opacity: 0.88, clearcoat: 1 }));
    const m = new THREE.Mesh(geo, mat) as unknown as THREE.Mesh & { level(v: number): void };
    m.position.copy(vec(pos));
    m.receiveShadow = true;
    const base = (geo.attributes.position as THREE.BufferAttribute).clone();
    this.animate((t) => {
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = base.getX(i);
        const z = base.getZ(i);
        p.setY(i, Math.sin(x * 1.3 + t * 1.4) * 0.04 + Math.cos(z * 1.7 + t * 1.1) * 0.03);
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    });
    m.level = (v) => (m.scale.y = Math.max(0.01, v));
    return this.add(m);
  }

  /** Drifting glowing motes in a box (pollen, sparks, snow, bubbles). */
  motes(box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, count: number, color: string, opts: { speed?: number; size?: number; rise?: boolean } = {}): THREE.Points & Lit {
    const n = this.n(count);
    const pos = new Float32Array(n * 3);
    const r = rng(n * 13 + count);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = box.x0 + r() * (box.x1 - box.x0);
      pos[i * 3 + 1] = box.y0 + r() * (box.y1 - box.y0);
      pos[i * 3 + 2] = box.z0 + r() * (box.z1 - box.z0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = this.track(new THREE.PointsMaterial({ color, size: opts.size ?? 0.12, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2 }));
    const pts = new THREE.Points(geo, mat) as unknown as THREE.Points & Lit;
    pts.setLit = (v) => (mat.opacity = 0.15 + v * 0.85);
    const speed = opts.speed ?? 0.3;
    const dir = opts.rise === false ? -1 : 1;
    this.animate((t, dt) => {
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        let y = p.getY(i) + dir * speed * dt * (0.5 + ((i * 37) % 10) / 10);
        if (y > box.y1) y = box.y0;
        if (y < box.y0) y = box.y1;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t + i) * 0.002);
      }
      p.needsUpdate = true;
    });
    return this.add(pts);
  }

  /** Simple tent / pavilion. */
  tent(pos: V3, size: number, color: string, stripe = '#FFF7E7'): THREE.Group {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(size, size * 0.9, 12, 1), this.mats.plastic(color));
    cone.position.y = size * 1.05;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.95, size * 0.95, size * 0.6, 12, 1, true), this.mats.plastic(stripe));
    base.position.y = size * 0.3;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(size * 0.08, size * 0.3, 4), this.mats.plastic(this.theme.accent));
    flag.position.y = size * 1.65;
    for (const c of [cone, base]) c.castShadow = true;
    g.add(cone, base, flag);
    g.position.copy(vec(pos));
    return this.add(g);
  }

  /** Glowing orb on a stand (atoms, lamps, planets). */
  orb(pos: V3, radius: number, color: string): THREE.Mesh & Lit {
    const mat = this.track(new THREE.MeshPhysicalMaterial({ color: '#0d0a14', emissive: color, emissiveIntensity: 0.08, roughness: 0.15, clearcoat: 1 }));
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), mat) as unknown as THREE.Mesh & Lit;
    m.position.copy(vec(pos));
    m.setLit = (v) => (mat.emissiveIntensity = 0.08 + v * 2.4);
    return this.add(m);
  }

  /** Cloud of small glowing points around a centre (electron-cloud style, not orbits). */
  cloudOfPoints(center: V3, radius: number, count: number, color: string): THREE.Points & Lit {
    const n = this.n(count);
    const pos = new Float32Array(n * 3);
    const r = rng(count * 7 + Math.round(center[0] * 10));
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = radius * Math.cbrt(r());
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = center[0] + rad * s * Math.cos(th);
      pos[i * 3 + 1] = center[1] + rad * u;
      pos[i * 3 + 2] = center[2] + rad * s * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = this.track(new THREE.PointsMaterial({ color, size: 0.07, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.15 }));
    const pts = new THREE.Points(geo, mat) as unknown as THREE.Points & Lit;
    pts.setLit = (v) => (mat.opacity = 0.1 + v * 0.9);
    return this.add(pts);
  }

  /** Boardwalk / planked floor around the cabinet. */
  boardwalk(tint = '#4a3324', radius = 26): THREE.Mesh {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    const r = rng(5);
    for (let i = 0; i < 16; i++) {
      const shade = 0.75 + r() * 0.35;
      const col = new THREE.Color(tint).multiplyScalar(shade);
      ctx.fillStyle = `#${col.getHexString()}`;
      ctx.fillRect(0, i * 32, 512, 30);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, i * 32 + 30, 512, 2);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(r() * 512, i * 32 + 15, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(radius / 2, radius / 2);
    tex.anisotropy = 8;
    const mat = this.track(new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 64).rotateX(-Math.PI / 2), mat);
    mesh.position.y = REGIONS.groundY;
    mesh.receiveShadow = true;
    return this.add(mesh);
  }

  /** Striped carnival booth with an awning and a counter. Facing +Z unless rotated. */
  booth(pos: V3, w: number, colors: [string, string], rotY = 0): THREE.Group {
    const g = new THREE.Group();
    const h = 2.2;
    const d = 1.4;
    const post = new THREE.CylinderGeometry(0.06, 0.06, h, 10);
    for (const x of [-w / 2, w / 2]) {
      for (const z of [-d / 2, d / 2]) {
        const p = new THREE.Mesh(post, this.mats.paintedMetal('#c9b8e8'));
        p.position.set(x, h / 2, z);
        g.add(p);
      }
    }
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w / stripes, 0.06, d + 0.5), this.mats.plastic(colors[i % 2]));
      seg.position.set(-w / 2 + (i + 0.5) * (w / stripes), h + 0.08, 0.1);
      seg.rotation.x = -0.25;
      seg.castShadow = true;
      g.add(seg);
      const flap = new THREE.Mesh(new THREE.CylinderGeometry(w / stripes / 2, w / stripes / 2, 0.04, 12, 1, false, 0, Math.PI), this.mats.plastic(colors[i % 2]));
      flap.rotation.set(Math.PI / 2, 0, 0);
      flap.position.set(-w / 2 + (i + 0.5) * (w / stripes), h - 0.05, d / 2 + 0.38);
      g.add(flap);
    }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.5), this.mats.wood());
    counter.position.set(0, 0.45, d / 2 - 0.2);
    counter.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), this.mats.plastic('#2a1c40'));
    back.position.set(0, h / 2, -d / 2);
    g.add(counter, back);
    g.position.copy(vec(pos));
    g.position.y += REGIONS.groundY;
    g.rotation.y = rotY;
    return this.add(g);
  }

  /** Floating balloon on a string. */
  balloon(pos: V3, color: string, size = 0.32): THREE.Group {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 18), this.mats.plastic(color));
    b.scale.y = 1.18;
    b.castShadow = true;
    const knot = new THREE.Mesh(new THREE.ConeGeometry(size * 0.12, size * 0.2, 8), this.mats.plastic(color));
    knot.position.y = -size * 1.22;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.4, 4), this.mats.dark());
    line.position.y = -size * 1.2 - 0.7;
    g.add(b, knot, line);
    g.position.copy(vec(pos));
    const ph = pos[0] * 3 + pos[2];
    this.animate((t) => {
      g.rotation.z = Math.sin(t * 0.9 + ph) * 0.08;
      g.position.y = pos[1] + Math.sin(t * 1.3 + ph) * 0.05;
    });
    return this.add(g);
  }

  /** Glass discharge tube filled with a glowing gas, with a small label plate. */
  gasTube(pos: V3, color: string, label: string, height = 1.1): THREE.Group & Lit {
    const g = new THREE.Group() as THREE.Group & Lit;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, height, 20, 1, true), this.mats.clearPlastic('#e8f6ff', 0.25));
    glass.position.y = height / 2 + 0.1;
    const coreMat = this.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: 0.05 }));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, height * 0.92, 14), coreMat);
    core.position.y = height / 2 + 0.1;
    const capGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16);
    const c1 = new THREE.Mesh(capGeo, this.mats.brass());
    c1.position.y = 0.08;
    const c2 = new THREE.Mesh(capGeo, this.mats.brass());
    c2.position.y = height + 0.12;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: labelTexture(label, { fg: '#1a1030', bg: '#FFF7E7', w: 128, h: 64, size: 44, radius: 10 }) }));
    plate.position.set(0, 0.25, 0.14);
    g.add(glass, core, c1, c2, plate);
    g.position.copy(vec(pos));
    g.setLit = (v) => (coreMat.emissiveIntensity = 0.05 + v * 4.5);
    return this.add(g);
  }

  /** A big wheel with glowing gondolas (carnival ride); returns a handle with the rotor. */
  wheel(pos: V3, radius: number, gondolas: { label: string; color: string }[], rotY = 0): THREE.Group & Lit & { rotor: THREE.Group } {
    const g = new THREE.Group() as THREE.Group & Lit & { rotor: THREE.Group };
    const rotor = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 8, 64), this.mats.paintedMetal('#c9b8e8'));
    rotor.add(rim);
    const rimMat = this.track(new THREE.MeshStandardMaterial({ color: '#000000', emissive: this.theme.lampOn, emissiveIntensity: 0.05 }));
    const glowRim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.98, 0.02, 6, 96), rimMat);
    rotor.add(glowRim);
    const pods: { m: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
    gondolas.forEach((gd, i) => {
      const a = (i / gondolas.length) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, radius, 6), this.mats.paintedMetal('#c9b8e8'));
      spoke.position.set((Math.cos(a) * radius) / 2, (Math.sin(a) * radius) / 2, 0);
      spoke.rotation.z = a - Math.PI / 2;
      rotor.add(spoke);
      const tex = labelTexture(gd.label, { fg: '#ffffff', w: 128, h: 128, size: 80 });
      const mat = this.track(new THREE.MeshStandardMaterial({ color: '#1a1030', emissive: gd.color, emissiveMap: tex, emissiveIntensity: 0.1, map: tex }));
      const pod = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.13, 20, 14), mat);
      pod.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.05);
      rotor.add(pod);
      pods.push({ m: pod, mat });
    });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16), this.mats.brass());
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    g.add(rotor);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, radius * 1.35, 8), this.mats.paintedMetal('#8a7aa8'));
      leg.position.set(sx * radius * 0.35, -radius * 0.6, -0.15);
      leg.rotation.z = sx * 0.28;
      g.add(leg);
    }
    g.position.copy(vec(pos));
    g.rotation.y = rotY;
    g.rotor = rotor;
    // Keep the gondola labels upright while the wheel turns.
    this.animate(() => pods.forEach((p) => (p.m.rotation.z = -rotor.rotation.z)), false);
    g.setLit = (v) => {
      rimMat.emissiveIntensity = 0.05 + v * 3;
      pods.forEach((p) => (p.mat.emissiveIntensity = 0.1 + v * 2.2));
    };
    return this.add(g);
  }

  /** Wall of tiles in a grid (e.g. a periodic-table marquee); light tiles by fraction. */
  tileWall(pos: V3, cols: number, rows: number, tile: number, mask: number[][], colorOf: (col: number, row: number) => string): THREE.Group & { light(fraction: number, t: number): void } {
    const g = new THREE.Group() as THREE.Group & { light(fraction: number, t: number): void };
    const geo = new THREE.BoxGeometry(tile * 0.9, tile * 0.9, 0.06);
    const tiles: { mat: THREE.MeshStandardMaterial; order: number }[] = [];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!mask[r]?.[c]) continue;
        const mat = this.track(new THREE.MeshStandardMaterial({ color: '#1a1228', emissive: colorOf(c, r), emissiveIntensity: 0.02, roughness: 0.4 }));
        const m = new THREE.Mesh(geo, mat);
        m.position.set((c - (cols - 1) / 2) * tile, (rows - 1 - r) * tile, 0);
        g.add(m);
        tiles.push({ mat, order: k++ });
      }
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(cols * tile + 0.3, rows * tile + 0.3, 0.05), this.mats.plastic('#120c22'));
    frame.position.set(0, ((rows - 1) * tile) / 2, -0.06);
    g.add(frame);
    g.position.copy(vec(pos));
    g.light = (fraction, t) => {
      const n = tiles.length;
      tiles.forEach((tl) => {
        const on = tl.order / n < fraction;
        tl.mat.emissiveIntensity = on ? 1.4 + (this.reducedMotion ? 0 : 0.4 * Math.sin(t * 2 + tl.order * 0.7)) : 0.03;
      });
    };
    return this.add(g);
  }

  /** Firework bursts in the sky region (only animates while lit). */
  fireworks(area: { x0: number; x1: number; y0: number; y1: number; z: number }, colors: string[]): Lit {
    const n = this.n(160);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = this.track(new THREE.PointsMaterial({ size: 0.18, vertexColors: true, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'mote'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.add(new THREE.Points(geo, mat));
    const bursts = 4;
    const per = Math.floor(n / bursts);
    const r = rng(77);
    // Parsed once: the animate loop below runs every frame and must not allocate.
    const palette = colors.map((c) => new THREE.Color(c));
    const dirs = Array.from({ length: n }, () => {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return [s * Math.cos(th), u, s * Math.sin(th)];
    });
    let lit = 0;
    this.animate((t) => {
      if (lit <= 0.01) return;
      for (let b = 0; b < bursts; b++) {
        const cyc = (t * 0.4 + b / bursts) % 1;
        const seed = Math.floor(t * 0.4 + b / bursts) * 13 + b;
        const cx = area.x0 + ((seed * 0.37) % 1) * (area.x1 - area.x0);
        const cy = area.y0 + ((seed * 0.61) % 1) * (area.y1 - area.y0);
        const c = palette[(seed + b) % palette.length];
        for (let i = b * per; i < (b + 1) * per; i++) {
          const d = dirs[i];
          const rad = cyc * 2.2;
          pos[i * 3] = cx + d[0] * rad;
          pos[i * 3 + 1] = cy + d[1] * rad - cyc * cyc * 0.8;
          pos[i * 3 + 2] = area.z + d[2] * rad * 0.3;
          const fade = (1 - cyc) * lit;
          col[i * 3] = c.r * fade;
          col[i * 3 + 1] = c.g * fade;
          col[i * 3 + 2] = c.b * fade;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    });
    return { setLit: (v) => { lit = v; mat.opacity = v; } };
  }

  /** Painted metal pole standing on the ground up to height h (string-light anchors, sign posts). */
  pole(pos: V3, h: number, color = '#c9b8e8'): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h - REGIONS.groundY, 10), this.mats.paintedMetal(color));
    m.position.set(pos[0], REGIONS.groundY + (h - REGIONS.groundY) / 2, pos[2]);
    m.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), this.mats.brass());
    cap.position.y = (h - REGIONS.groundY) / 2;
    m.add(cap);
    return this.add(m);
  }

  /** Easing helper: smooth 0..1 between level thresholds. */
  stage(level: number, lo: number, hi = lo + 1) {
    const t = Math.max(0, Math.min(1, (level - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const d of this.disposables) d.dispose();
  }
}

/** Generic attraction set used by tables that don't define their own. */
export const defaultSet: SetBuilder = (kit) => {
  const T = kit.theme;
  kit.sky(T.bg[0], '#05030a');
  kit.ground('#140d22');
  const signs = [
    kit.lantern([-5, 1.2, -4], T.accent),
    kit.lantern([5, 1.2, -4], T.accent2),
    kit.lantern([-5.5, 1.2, 2], T.lampOn),
    kit.lantern([5.5, 1.2, 2], T.lampOn),
  ];
  const lights = kit.stringLights([-8, 3.5, -9], [8, 3.5, -9], 0.8, kit.n(24), [T.lampOn, T.accent, T.accent2]);
  return {
    update(_t, _dt, level) {
      signs.forEach((s, i) => s.setLit(kit.stage(level, i * 0.8, i * 0.8 + 1)));
      lights.setLit(kit.stage(level, 0.2, 1.5));
    },
  };
};
