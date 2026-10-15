// The luminous glass Wonderball: transmissive glass shell, a turning golden core, a contact
// shadow, a short additive trail, and a soft light that it casts onto the playfield.

import * as THREE from 'three';
import type { Ball } from '../physics/ball.ts';
import { K, wx, wz } from './space.ts';
import { radialTexture } from './textures.ts';

const TRAIL = 12;

interface BallMesh {
  group: THREE.Group;
  shell: THREE.Mesh;
  core: THREE.Mesh;
  shadow: THREE.Mesh;
  light?: THREE.PointLight;
  trail: THREE.Points;
  trailPos: Float32Array;
  trailAlpha: Float32Array;
  history: THREE.Vector3[];
}

export class BallView {
  readonly root = new THREE.Group();
  private meshes = new Map<number, BallMesh>();
  private shellMat: THREE.MeshPhysicalMaterial;
  private coreMat: THREE.MeshStandardMaterial;
  private shadowMat: THREE.MeshBasicMaterial;
  private trailMat: THREE.ShaderMaterial;
  private geo: THREE.SphereGeometry;
  private coreGeo: THREE.IcosahedronGeometry;
  private lightsLeft: number;
  trailLength = 0.6;
  reducedMotion = false;
  holdGlowColor: THREE.Color;

  private prism = false;

  constructor(opts: { transmission: boolean; trailColor: string; glowColor: string; maxLights: number; prism?: boolean }) {
    this.prism = !!opts.prism;
    this.geo = new THREE.SphereGeometry(12 * K, 48, 32);
    this.coreGeo = new THREE.IcosahedronGeometry(12 * K * 0.42, 1);
    this.shellMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.04,
      transmission: opts.transmission ? 1 : 0,
      thickness: 0.18,
      ior: 1.5,
      iridescence: 0.55,
      iridescenceIOR: 1.3,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.6,
      emissive: '#bff7ec',
      emissiveIntensity: opts.transmission ? 0.06 : 0.22,
      transparent: !opts.transmission,
      opacity: opts.transmission ? 1 : 0.92,
    });
    this.coreMat = new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#FFC75B', emissiveIntensity: 3.2 });
    this.shadowMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)', 'ballshadow'), transparent: true, depthWrite: false });
    this.trailMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(opts.trailColor) }, size: { value: 70 } },
      vertexShader: `attribute float alpha; varying float vA; uniform float size;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * alpha / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(color * (1.0 - d * 2.0) * vA, 1.0); }`,
    });
    this.lightsLeft = opts.maxLights;
    this.holdGlowColor = new THREE.Color(opts.glowColor);
  }

  private make(id: number): BallMesh {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(this.geo, this.shellMat);
    shell.castShadow = true;
    const core = new THREE.Mesh(this.coreGeo, this.coreMat);
    group.add(shell, core);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    let light: THREE.PointLight | undefined;
    if (this.lightsLeft > 0) {
      this.lightsLeft--;
      light = new THREE.PointLight('#bff7ec', 0.9, 1.6, 2);
      group.add(light);
    }
    const trailPos = new Float32Array(TRAIL * 3);
    const trailAlpha = new Float32Array(TRAIL);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    tg.setAttribute('alpha', new THREE.BufferAttribute(trailAlpha, 1));
    const trail = new THREE.Points(tg, this.trailMat);
    trail.frustumCulled = false;
    this.root.add(group, shadow, trail);
    const m: BallMesh = { group, shell, core, shadow, light, trail, trailPos, trailAlpha, history: [] };
    this.meshes.set(id, m);
    return m;
  }

  update(balls: Ball[], heightOf: (b: Ball) => number, t: number) {
    if (this.prism && !this.reducedMotion) (this.trailMat.uniforms.color.value as THREE.Color).setHSL((t * 0.15) % 1, 0.8, 0.65);
    const seen = new Set<number>();
    for (const b of balls) {
      if (b.state === 'drained') continue;
      seen.add(b.id);
      const m = this.meshes.get(b.id) ?? this.make(b.id);
      const h = heightOf(b);
      const visible = b.state !== 'transit';
      m.group.visible = visible;
      m.shadow.visible = visible;
      m.trail.visible = visible && !this.reducedMotion && this.trailLength > 0;
      const x = wx(b.x);
      const z = wz(b.y);
      const y = h + 12 * K;
      m.group.position.set(x, y, z);
      // Rolling: rotate around the axis perpendicular to motion
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 1) {
        const axis = new THREE.Vector3(b.vy, 0, -b.vx).normalize();
        m.shell.rotateOnWorldAxis(axis, (sp / 120) * K * 6);
      }
      m.core.rotation.set(t * 1.3, t * 0.9, 0);
      const held = b.state === 'held';
      this.coreMat.emissiveIntensity = 3.2;
      if (m.light) {
        m.light.intensity = held ? 1.6 + 0.4 * Math.sin(t * 4) : 0.9;
        m.light.color.copy(held ? this.holdGlowColor : new THREE.Color('#bff7ec'));
      }
      m.shadow.position.set(x + h * 0.15, h + 0.003, z + h * 0.1);
      const sc = 1 + h * 1.5;
      m.shadow.scale.setScalar(sc);
      (m.shadow.material as THREE.MeshBasicMaterial).opacity = 1 / sc;
      // Trail
      m.history.unshift(new THREE.Vector3(x, y, z));
      if (m.history.length > TRAIL) m.history.pop();
      const n = Math.max(2, Math.round(TRAIL * this.trailLength));
      for (let i = 0; i < TRAIL; i++) {
        const p = m.history[Math.min(i, m.history.length - 1)];
        m.trailPos[i * 3] = p.x;
        m.trailPos[i * 3 + 1] = p.y;
        m.trailPos[i * 3 + 2] = p.z;
        m.trailAlpha[i] = i < n && i > 0 ? (1 - i / n) * Math.min(1, sp / 900) : 0;
      }
      (m.trail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (m.trail.geometry.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    }
    for (const [id, m] of this.meshes) {
      if (seen.has(id)) continue;
      this.root.remove(m.group, m.shadow, m.trail);
      m.shadow.geometry.dispose();
      m.trail.geometry.dispose();
      if (m.light) this.lightsLeft++;
      this.meshes.delete(id);
    }
  }

  /** World position of the first live ball (camera/lighting focus). */
  focus(): THREE.Vector3 | null {
    for (const m of this.meshes.values()) if (m.group.visible) return m.group.position;
    return null;
  }

  dispose() {
    this.geo.dispose();
    this.coreGeo.dispose();
    this.shellMat.dispose();
    this.coreMat.dispose();
    this.shadowMat.dispose();
    this.trailMat.dispose();
    for (const m of this.meshes.values()) {
      m.shadow.geometry.dispose();
      m.trail.geometry.dispose();
    }
  }
}
