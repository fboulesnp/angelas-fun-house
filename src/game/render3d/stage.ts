// WebGL stage: renderer, HDR post-processing chain, environment lighting and quality tiers.
// Quality adapts automatically when frame time stays high, and never changes the physics.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export type Quality = 'ultra' | 'high' | 'medium' | 'low';

export interface QualityProfile {
  maxDpr: number;
  shadows: boolean;
  shadowSize: number;
  msaa: number;
  bloom: boolean;
  bloomRes: number;
  ao: boolean;
  fxaa: boolean;
  particles: number;
  /** Detail multiplier for scenery sets (instance counts, segments). */
  detail: number;
}

export const QUALITY: Record<Quality, QualityProfile> = {
  ultra: { maxDpr: 2, shadows: true, shadowSize: 4096, msaa: 4, bloom: true, bloomRes: 0.5, ao: true, fxaa: false, particles: 400, detail: 1 },
  high: { maxDpr: 1.75, shadows: true, shadowSize: 2048, msaa: 4, bloom: true, bloomRes: 0.5, ao: false, fxaa: false, particles: 260, detail: 0.85 },
  medium: { maxDpr: 1.5, shadows: true, shadowSize: 1024, msaa: 0, bloom: true, bloomRes: 0.35, ao: false, fxaa: true, particles: 140, detail: 0.6 },
  low: { maxDpr: 1, shadows: false, shadowSize: 512, msaa: 0, bloom: false, bloomRes: 0.25, ao: false, fxaa: true, particles: 60, detail: 0.4 },
};

export const QUALITY_ORDER: Quality[] = ['low', 'medium', 'high', 'ultra'];

/** Final display-space grade: gentle contrast/saturation and a soft vignette for focus. */
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 }, saturation: { value: 1.08 }, contrast: { value: 1.05 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform float saturation; uniform float contrast; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.0)));
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }`,
};

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/** Conservative first guess; the stage then adapts to measured frame times. */
export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  if (mobile) return mem >= 6 ? 'medium' : 'low';
  if (cores >= 8 && mem >= 8) return 'high';
  return 'medium';
}

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  composer!: EffectComposer;
  private renderPass!: RenderPass;
  bloom?: UnrealBloomPass;
  private ao?: GTAOPass;
  private fxaa?: FXAAPass;
  grade?: ShaderPass;
  quality: Quality;
  profile: QualityProfile;
  width = 1;
  height = 1;
  private envRT?: THREE.WebGLRenderTarget;
  /** Frame-time watchdog for adaptive quality. */
  private slowFrames = 0;
  private fastFrames = 0;
  adaptive = true;
  onQualityChange?: (q: Quality) => void;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
    this.quality = quality;
    this.profile = QUALITY[quality];
    this.setEnvironment('#FFC75B', '#71E3CF', '#FF7F86');
    this.buildComposer();
  }

  /**
   * Moody studio environment for reflections: a dark dome, a warm overhead softbox and two
   * theme-coloured rim strips. Gives chrome and lacquer rich highlights without washing out.
   */
  setEnvironment(warm: string, rimA: string, rimB: string) {
    const env = new THREE.Scene();
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { top: { value: new THREE.Color('#2a2040') }, bottom: { value: new THREE.Color('#05030a') } },
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.2, 0.9, vP.y)), 1.0); }',
      }),
    );
    env.add(dome);
    const box = (w: number, h: number, color: string, intensity: number, pos: [number, number, number], rot: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.rotation.set(...rot);
      env.add(m);
    };
    box(10, 6, '#fff3e0', 3.2, [0, 12, 2], [Math.PI / 2, 0, 0]);
    box(2, 14, rimA, 2.2, [-14, 5, 0], [0, Math.PI / 2, 0]);
    box(2, 14, rimB, 2.2, [14, 5, 0], [0, -Math.PI / 2, 0]);
    box(12, 1.2, warm, 1.4, [0, 4, -16], [0, 0, 0]);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT?.dispose();
    this.envRT = pmrem.fromScene(env, 0.03);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 1;
    pmrem.dispose();
    env.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    });
  }

  private buildComposer() {
    const p = this.profile;
    this.composer?.dispose();
    this.renderer.shadowMap.enabled = p.shadows;
    const rt = new THREE.WebGLRenderTarget(this.width, this.height, { type: THREE.HalfFloatType, samples: p.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.ao = undefined;
    if (p.ao) {
      this.ao = new GTAOPass(this.scene, this.camera, this.width, this.height);
      this.ao.blendIntensity = 0.75;
      this.composer.addPass(this.ao);
    }
    this.bloom = undefined;
    if (p.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width * p.bloomRes, this.height * p.bloomRes), 0.7, 0.45, 1.0);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GRADE_SHADER);
    this.composer.addPass(this.grade);
    this.fxaa = undefined;
    if (p.fxaa) {
      this.fxaa = new FXAAPass();
      this.composer.addPass(this.fxaa);
    }
    this.applySize();
  }

  setQuality(q: Quality) {
    if (q === this.quality) return;
    this.quality = q;
    this.profile = QUALITY[q];
    this.buildComposer();
    this.onQualityChange?.(q);
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, Math.floor(w));
    this.height = Math.max(1, Math.floor(h));
    this.applySize();
  }

  private applySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.profile.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.width, this.height);
    if (this.bloom) this.bloom.resolution.set(this.width * this.profile.bloomRes, this.height * this.profile.bloomRes);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** Render a frame; adapt quality if frames are consistently slow or fast. */
  render(dt: number) {
    this.composer.render(dt);
    if (!this.adaptive || dt <= 0) return;
    if (dt > 1 / 42) {
      this.slowFrames++;
      this.fastFrames = 0;
    } else if (dt < 1 / 58) {
      this.fastFrames++;
      this.slowFrames = Math.max(0, this.slowFrames - 1);
    }
    if (this.slowFrames > 150) {
      this.slowFrames = 0;
      const i = QUALITY_ORDER.indexOf(this.quality);
      if (i > 0) this.setQuality(QUALITY_ORDER[i - 1]);
    }
  }

  dispose() {
    this.composer.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();
  }
}
