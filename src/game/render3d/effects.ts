// Pooled additive particles and floating score sprites.

import * as THREE from 'three';
import { K, wx, wz } from './space.ts';

export class Effects {
  readonly root = new THREE.Group();
  private max: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private points: THREE.Points;
  private next = 0;
  private popups: { sprite: THREE.Sprite; life: number; tex: THREE.CanvasTexture }[] = [];
  private palette: THREE.Color[];

  constructor(max: number, palette: string[]) {
    this.max = Math.max(16, max);
    this.pos = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.col = new Float32Array(this.max * 3);
    this.size = new Float32Array(this.max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 color; attribute float psize; varying vec3 vC;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * 60.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vC*(1.0-d*2.0)*2.2,1.0); }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.root.add(this.points);
    this.palette = palette.map((c) => new THREE.Color(c));
  }

  burst(x: number, y: number, h: number, n: number, speed = 1.6, colorIndex = -1) {
    for (let i = 0; i < n; i++) {
      const k = this.next++ % this.max;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 1.2;
      const sp = speed * (0.4 + Math.random());
      this.pos.set([wx(x), h * K + 0.15, wz(y)], k * 3);
      this.vel.set([Math.cos(a) * sp, up * sp, Math.sin(a) * sp], k * 3);
      this.life[k] = 0.6 + Math.random() * 0.6;
      const c = this.palette[colorIndex >= 0 ? colorIndex % this.palette.length : (i % this.palette.length)];
      this.col.set([c.r, c.g, c.b], k * 3);
      this.size[k] = 0.6 + Math.random() * 1.2;
    }
  }

  popup(x: number, y: number, text: string, color: string) {
    if (this.popups.length > 7) {
      const old = this.popups.shift()!;
      this.root.remove(old.sprite);
      old.tex.dispose();
      old.sprite.material.dispose();
    }
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 80;
    const ctx = c.getContext('2d')!;
    ctx.font = '800 54px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(20,10,40,0.9)';
    ctx.strokeText(text, 128, 42);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 42);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(0.9, 0.28, 1);
    sprite.position.set(wx(x), 0.6, wz(y));
    sprite.renderOrder = 10;
    this.root.add(sprite);
    this.popups.push({ sprite, life: 1.1, tex });
  }

  update(dt: number) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) {
        this.size[k] = 0;
        continue;
      }
      this.life[k] -= dt;
      const i = k * 3;
      this.vel[i + 1] -= 3.2 * dt;
      this.pos[i] += this.vel[i] * dt;
      this.pos[i + 1] = Math.max(0.02, this.pos[i + 1] + this.vel[i + 1] * dt);
      this.pos[i + 2] += this.vel[i + 2] * dt;
      if (this.life[k] < 0.3) this.size[k] *= 0.9;
    }
    const g = this.points.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.psize as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.life -= dt;
      p.sprite.position.y += dt * 0.45;
      p.sprite.material.opacity = Math.min(1, p.life * 2);
      if (p.life <= 0) {
        this.root.remove(p.sprite);
        p.tex.dispose();
        p.sprite.material.dispose();
        this.popups.splice(i, 1);
      }
    }
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    for (const p of this.popups) {
      p.tex.dispose();
      p.sprite.material.dispose();
    }
  }
}
