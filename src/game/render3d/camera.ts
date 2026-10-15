// Camera rig: framing presets that always keep the whole table (ball + flippers) in view,
// plus gentle cinematic moves used only while every ball is safely parked.

import * as THREE from 'three';
import { TH, TW } from './space.ts';

export type CameraPreset = 'cabinet' | 'overhead' | 'low';

const PRESETS: Record<CameraPreset, { elevationDeg: number; fov: number; lookZ: number }> = {
  // Elevation is the camera's angle above the playfield plane.
  cabinet: { elevationDeg: 52, fov: 30, lookZ: 0.15 },
  overhead: { elevationDeg: 78, fov: 28, lookZ: 0 },
  low: { elevationDeg: 40, fov: 34, lookZ: 0.4 },
};

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  preset: CameraPreset = 'cabinet';
  private base = new THREE.Vector3();
  private look = new THREE.Vector3();
  private shake = 0;
  /** Cinematic offset 0..1 toward a focus point (celebrations only). */
  private cine = 0;
  private cineTarget = 0;
  private cineFocus = new THREE.Vector3();
  reducedMotion = false;
  /** Extra margin around the table (world units) e.g. to show scenery on wide screens. */
  margin = 0.25;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  /** Fit the table's corners (with cabinet rails) inside the view for the current aspect. */
  frame() {
    const p = PRESETS[this.preset];
    const cam = this.camera;
    cam.fov = p.fov;
    cam.updateProjectionMatrix();
    // Tall portrait screens are width-limited: view the table more face-on to fill the height.
    const portrait = cam.aspect < 0.75;
    const elevation = portrait && this.preset !== 'overhead' ? Math.max(p.elevationDeg, 66) : p.elevationDeg;
    const el = THREE.MathUtils.degToRad(elevation);
    this.look.set(0, 0, p.lookZ);
    const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const hw = TW / 2 + 0.36 + this.margin;
    const hh = TH / 2 + 0.3 + this.margin;
    const corners = [
      new THREE.Vector3(-hw, 0.45, -hh), new THREE.Vector3(hw, 0.45, -hh),
      new THREE.Vector3(-hw, 0.45, hh), new THREE.Vector3(hw, 0.45, hh),
      new THREE.Vector3(-hw, 0, -hh), new THREE.Vector3(hw, 0, -hh),
    ];
    // Binary search the distance that fits every corner with a small safety margin.
    let lo = 2;
    let hi = 80;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      cam.position.copy(this.look).addScaledVector(dir, mid);
      cam.lookAt(this.look);
      cam.updateMatrixWorld();
      const fits = corners.every((c) => {
        const v = c.clone().project(cam);
        return Math.abs(v.x) < 0.985 && Math.abs(v.y) < 0.985 && v.z < 1;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    // Recentre vertically: shift the look point so the table sits centred on screen.
    cam.position.copy(this.look).addScaledVector(dir, hi);
    cam.lookAt(this.look);
    cam.updateMatrixWorld();
    const top = new THREE.Vector3(0, 0.45, -hh).project(cam).y;
    const bottom = new THREE.Vector3(0, 0.45, hh).project(cam).y;
    const offset = (top + bottom) / 2;
    if (Math.abs(offset) > 0.01) {
      const worldPerNdc = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * hi) / 2;
      const up = new THREE.Vector3(0, Math.cos(el), -Math.sin(el));
      this.look.addScaledVector(up, offset * worldPerNdc);
      cam.position.copy(this.look).addScaledVector(dir, hi);
    }
    this.base.copy(cam.position);
    cam.lookAt(this.look);
  }

  /** Opening fly-in: start high above the set and settle onto the cabinet framing. */
  private intro = 0;
  private introDur = 0;
  introFly(seconds = 2.2) {
    if (this.reducedMotion) return;
    this.intro = seconds;
    this.introDur = seconds;
  }

  kick(amount: number) {
    if (!this.reducedMotion) this.shake = Math.min(1, this.shake + amount);
  }

  /** Begin/end a cinematic push toward a point (only while balls are parked). */
  cinematic(on: boolean, focus?: THREE.Vector3) {
    this.cineTarget = on && !this.reducedMotion ? 1 : 0;
    if (focus) this.cineFocus.copy(focus);
  }

  // Scratch vectors so the per-frame update never allocates.
  private tmpLook = new THREE.Vector3();
  private tmpFrom = new THREE.Vector3();
  private tmpV = new THREE.Vector3();
  private static readonly INTRO_LOOK = new THREE.Vector3(0, 0, -7);

  update(dt: number, t: number) {
    const cam = this.camera;
    this.cine += (this.cineTarget - this.cine) * Math.min(1, dt * 1.6);
    cam.position.copy(this.base);
    const look = this.tmpLook.copy(this.look);
    if (this.intro > 0) {
      this.intro = Math.max(0, this.intro - dt);
      const k = 1 - this.intro / this.introDur;
      const e = 1 - Math.pow(1 - k, 3);
      const from = this.tmpFrom.copy(this.base).add(this.tmpV.set(Math.sin(t * 0.2) * 2, 9, -2));
      cam.position.lerpVectors(from, this.base, e);
      look.lerpVectors(CameraRig.INTRO_LOOK, this.look, e);
    }
    if (this.cine > 0.001) {
      // Celebration reveal: rise, pull back and drift sideways so the awakened set on both
      // sides of the cabinet comes into view, while still facing the table.
      const k = this.cine * this.cine * (3 - 2 * this.cine);
      const away = this.tmpV.copy(this.base).sub(this.look).multiplyScalar(0.32 * k);
      cam.position.add(away);
      cam.position.x += Math.sin(t * 0.35) * 2.2 * k;
      cam.position.y += 0.8 * k;
      look.lerp(this.cineFocus, 0.12 * k);
    }
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.04;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.03;
      this.shake = Math.max(0, this.shake - dt * 4);
    }
    cam.lookAt(look);
  }
}
