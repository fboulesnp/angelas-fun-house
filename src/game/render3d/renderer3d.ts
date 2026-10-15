// Renderer3D: the high-end presentation. Same contract as the 2D renderer (render, resize, fx),
// driven by the same GameSession, so physics and rules are identical in both views.

import * as THREE from 'three';
import type { GameSession } from '../rules/session.ts';
import type { TableDef } from '../table/tableDef.ts';
import { BallView } from './ballView.ts';
import { CameraRig, type CameraPreset } from './camera.ts';
import { Effects } from './effects.ts';
import { defaultSet, SetKit, type SetHandle } from './setKit.ts';
import { QUALITY, Stage, type Quality } from './stage.ts';
import { TableView } from './tableView.ts';
import { TH, TW, wx, wz } from './space.ts';

export interface Render3DSettings {
  quality: Quality;
  adaptiveQuality: boolean;
  reducedMotion: boolean;
  trailLength: number;
  camera: CameraPreset;
}

export interface TableRenderer {
  render(dt: number): void;
  resize(): void;
  fx(kind: string, x: number, y: number, value?: number): void;
  dispose(): void;
}

export class Renderer3D implements TableRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly stage: Stage;
  private session: GameSession;
  private def: TableDef;
  private table: TableView;
  private balls: BallView;
  private effects: Effects;
  private rig: CameraRig;
  private kit: SetKit;
  private set: SetHandle;
  private key: THREE.DirectionalLight;
  private t = 0;
  private lastLevel = -1;
  private wasCelebrating = false;

  constructor(canvas: HTMLCanvasElement, session: GameSession, settings: Render3DSettings) {
    this.canvas = canvas;
    this.session = session;
    this.def = session.def;
    this.stage = new Stage(canvas, settings.quality);
    this.stage.adaptive = settings.adaptiveQuality;
    this.stage.setEnvironment(session.def.theme.lampOn, session.def.theme.accent2, session.def.theme.accent);
    const q = QUALITY[settings.quality];
    const scene = this.stage.scene;
    const theme = this.def.theme;
    scene.background = new THREE.Color('#07040d');
    scene.fog = new THREE.Fog(new THREE.Color(theme.bg[1]).multiplyScalar(0.5), 22, 70);

    // Lighting: warm key with shadows, theme-tinted fill, coloured rim spots.
    const hemi = new THREE.HemisphereLight(new THREE.Color(theme.accent2).lerp(new THREE.Color('#ffffff'), 0.5), '#0a0612', 0.35);
    scene.add(hemi);
    this.key = new THREE.DirectionalLight('#fff1dc', 2.0);
    this.key.position.set(-3.5, 13, 7);
    this.key.target.position.set(0, 0, -0.5);
    this.key.castShadow = q.shadows;
    this.key.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    const sc = this.key.shadow.camera;
    sc.left = -5;
    sc.right = 5;
    sc.top = 7.5;
    sc.bottom = -7.5;
    sc.near = 2;
    sc.far = 30;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 3;
    scene.add(this.key, this.key.target);
    for (const [x, color] of [[-7, theme.accent], [7, theme.accent2]] as [number, string][]) {
      const s = new THREE.SpotLight(color, 26, 30, 0.55, 0.7, 1.5);
      s.position.set(x, 6, 3);
      s.target.position.set(0, 0, -1);
      scene.add(s, s.target);
    }

    this.table = new TableView(this.def, session.rt, { reducedMotion: settings.reducedMotion, detail: q.detail, shadows: q.shadows });
    scene.add(this.table.root);
    this.balls = new BallView({ transmission: settings.quality === 'ultra', trailColor: theme.trail, glowColor: theme.lampOn, maxLights: settings.quality === 'low' ? 0 : 2 });
    this.balls.trailLength = settings.trailLength;
    this.balls.reducedMotion = settings.reducedMotion;
    scene.add(this.balls.root);
    this.effects = new Effects(q.particles, [theme.lampOn, theme.accent, theme.accent2, '#FFF7E7']);
    scene.add(this.effects.root);

    this.kit = new SetKit(this.table.mats, theme, { detail: q.detail, reducedMotion: settings.reducedMotion });
    this.set = (this.def.set ?? defaultSet)(this.kit);
    scene.add(this.kit.root);

    this.rig = new CameraRig(this.stage.camera);
    this.rig.preset = settings.camera;
    this.rig.reducedMotion = settings.reducedMotion;
    this.resize();
  }

  setCamera(p: CameraPreset) {
    this.rig.preset = p;
    this.rig.frame();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.stage.resize(r.width, r.height);
    // Wider screens show more of the attraction set around the cabinet.
    this.rig.margin = r.width / Math.max(1, r.height) > 0.9 ? 0.05 : 0;
    this.rig.frame();
  }

  fx(kind: string, x: number, y: number, value?: number) {
    if (kind === 'score' && value) {
      this.effects.popup(x, y, value.toLocaleString(), this.def.theme.lampOn);
      this.effects.burst(x, y, 10, 14);
    } else if (kind === 'burst') {
      this.effects.burst(x, y, 10, 40, 2.4);
      this.rig.kick(0.4);
    } else if (kind === 'hit') {
      this.effects.burst(x, y, 10, 5, 1.1);
      this.rig.kick(0.08);
    }
  }

  render(dt: number) {
    const s = this.session;
    const frozen = s.state === 'paused' || s.state === 'parked';
    if (!frozen) this.t += dt;
    const t = this.t;
    const level = s.sceneryLevel;
    if (Math.abs(level - this.lastLevel) > 0.02) {
      this.table.paintPrint(level, t);
      this.lastLevel = level;
    }
    this.table.update(t, dt);
    this.balls.update(s.rt.world.balls, (b) => this.table.ballHeight(b.rampId, b.x, b.y), t);
    this.effects.update(frozen ? 0 : dt);
    this.kit.tick(t, frozen ? 0 : dt);
    this.set.update(t, dt, level, s.energy);
    const celebrating = s.state === 'celebrate';
    if (celebrating) this.set.celebrate?.(s.celebrateProgress, t);
    if (celebrating !== this.wasCelebrating) {
      this.wasCelebrating = celebrating;
      this.rig.cinematic(celebrating, new THREE.Vector3(0, 0.5, -TH / 2 - 2));
      if (celebrating) this.effects.burst(286, 400, 20, 80, 3);
    }
    this.rig.update(dt, t);
    this.stage.render(dt);
  }

  dispose() {
    this.set.dispose?.();
    this.kit.dispose();
    this.table.dispose();
    this.balls.dispose();
    this.effects.dispose();
    this.stage.dispose();
  }
}

export { TW, TH, wx, wz };
