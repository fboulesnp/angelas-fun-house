// The Fun House mansion in 3D: an exterior establishing shot for the title screen and a
// dollhouse whose façade swings open for the map. Rooms awaken (glow + animate) as
// Wonderlights return. Procedural geometry only.

import * as THREE from 'three';
import { LESSONS, WINGS, type LessonId } from '../../content/curriculum.ts';
import { Materials } from '../../game/render3d/materials.ts';
import { SetKit } from '../../game/render3d/setKit.ts';
import { Stage, detectQuality, type Quality } from '../../game/render3d/stage.ts';
import { labelTexture } from '../../game/render3d/textures.ts';
import type { SaveData } from '../../persistence/save.ts';
import { TABLE_IDS, loadTable } from '../../tables/index.ts';
import type { TableDef } from '../../game/table/tableDef.ts';

export const ROOM_W = 2.1;
export const ROOM_H = 1.7;
export const ROOM_D = 1.8;
const GAP = 0.18;
const FLOOR_H = ROOM_H + GAP;
const HOUSE_W = 9 * ROOM_W + 0.6;
const WING_WALL = ['#3a2a5c', '#2a3a5c', '#2f4a3a', '#4a2f3e'];
const WING_GLOW = ['#FFC75B', '#71E3CF', '#9fe08a', '#FF7F86'];

export interface RoomInfo {
  id: LessonId;
  group: THREE.Group;
  wallMat: THREE.MeshStandardMaterial;
  windowMat: THREE.MeshStandardMaterial;
  center: THREE.Vector3;
  lit: number;
  update(t: number, lit: number): void;
}

export type SceneMode = 'title' | 'map';

function shingles(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3b2466';
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 9; col++) {
      const x = col * 32 - (row % 2) * 16;
      const y = row * 16;
      ctx.fillStyle = ['#432a72', '#3a2466', '#4a2f7c'][(row * 7 + col) % 3];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 30, y);
      ctx.lineTo(x + 30, y + 12);
      ctx.quadraticCurveTo(x + 15, y + 18, x, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.35, 0.35);
  return t;
}

export class MansionScene {
  readonly stage: Stage;
  readonly rooms: RoomInfo[] = [];
  private mats = new Materials();
  private kit: SetKit;
  private facade = new THREE.Group();
  private facadeHinge = new THREE.Group();
  private facadeOpen = 0;
  mode: SceneMode = 'title';
  private t = 0;
  private reduced: boolean;
  private marqueeBulbs: THREE.MeshStandardMaterial[] = [];
  private beacon: THREE.Mesh & { setLit(v: number): void };
  private fireworks: { setLit(v: number): void };
  private houseCenter = new THREE.Vector3(0, FLOOR_H * 2, 0);
  hover: LessonId | null = null;
  focusRoom: LessonId | null = null;
  private zoom: { id: LessonId; k: number; done: () => void } | null = null;
  private parallax = new THREE.Vector2();
  private save: SaveData;
  private roomLights: THREE.PointLight[] = [];
  private foliage = new THREE.MeshStandardMaterial({ color: '#2c5a40', roughness: 0.92, flatShading: true });

  constructor(canvas: HTMLCanvasElement, save: SaveData, opts: { reducedMotion: boolean; quality?: Quality }) {
    this.save = save;
    this.reduced = opts.reducedMotion;
    const q = opts.quality ?? detectQuality();
    this.stage = new Stage(canvas, q === 'ultra' ? 'high' : q);
    this.stage.setEnvironment('#FFC75B', '#71E3CF', '#FF7F86');
    const scene = this.stage.scene;
    scene.background = new THREE.Color('#0b0716');
    scene.fog = new THREE.Fog('#120a24', 28, 75);
    scene.add(new THREE.HemisphereLight('#8fa2ff', '#120a1e', 0.45));
    const moon = new THREE.DirectionalLight('#c9d4ff', 1.3);
    moon.position.set(-14, 22, 18);
    moon.castShadow = this.stage.profile.shadows;
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -6, near: 1, far: 70 });
    moon.shadow.bias = -0.0005;
    scene.add(moon);
    const rim = new THREE.DirectionalLight('#6f7dff', 1.1);
    rim.position.set(10, 12, -20);
    scene.add(rim);
    const warm = new THREE.SpotLight('#ffcf8a', 26, 60, 0.75, 0.9, 1.2);
    warm.position.set(-4, 2, 22);
    warm.target.position.set(0, 4, 0);
    scene.add(warm, warm.target);

    this.kit = new SetKit(this.mats, {
      bg: ['#291B46', '#120c22'], rail: '#c9b8e8', railHighlight: '#ffffff', lampOn: '#FFC75B', lampOff: '#222', accent: '#FF7F86', accent2: '#71E3CF',
      bumperCap: '#ff9fb0', bumperRing: '#3b2466', flipper: '#ffd98a', ink: '#FFF7E7', ramp: '#71E3CF', trail: '#71E3CF',
    }, { detail: this.stage.profile.detail, reducedMotion: this.reduced });
    scene.add(this.kit.root);
    this.kit.sky('#25184d', '#05030a');
    this.buildGrounds();
    this.buildHouse();
    this.buildFacade();
    this.beacon = this.kit.orb([0, FLOOR_H * 4 + 5.6, 0.6], 0.5, '#FFC75B');
    this.fireworks = this.kit.fireworks({ x0: -12, x1: 12, y0: 11, y1: 15, z: -6 }, ['#FFC75B', '#FF7F86', '#71E3CF', '#9fb4ff']);
    this.kit.motes({ x0: -16, x1: 16, y0: 0, y1: 10, z0: -4, z1: 14 }, 110, '#ffe39a', { speed: 0.12, size: 0.14 }).setLit(0.7);
  }

  // ------------------------------------------------------------------ build

  private exterior = new THREE.Group();

  private buildGrounds() {
    const k = this.kit;
    const before = new Set(this.kit.root.children);
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(60, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#16241e', roughness: 0.95 }));
    lawn.position.y = -0.02;
    lawn.receiveShadow = true;
    this.kit.add(lawn);
    // Path to the porch
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3, 16).rotateX(-Math.PI / 2), this.mats.plastic('#5a4a3a'));
    path.position.set(0, 0, 9.5);
    path.receiveShadow = true;
    k.add(path);
    for (let i = 0; i < k.n(6); i++) {
      for (const sx of [-1, 1]) {
        const lamp = k.lantern([sx * 2.2, 0.9, 3.6 + i * 2.2], '#FFC75B', 0.18);
        lamp.setLit(0.9);
        k.pole([sx * 2.2, 0, 3.6 + i * 2.2], 0.72, '#2a2238');
      }
    }
    for (let i = 0; i < k.n(10); i++) {
      const side = i % 2 ? 1 : -1;
      k.tree([side * (12 + (i % 3) * 2.4), 0, -3 + (i * 1.9) % 10], 3.2 + (i % 3), ['#2f6b4a', '#3d7a52', '#284f3a'][i % 3], i + 3);
    }
    for (let i = 0; i < k.n(14); i++) {
      const x = -10 + i * 1.5;
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), this.foliage);
      bush.position.set(x, 0.35, ROOM_D / 2 + 1.2);
      bush.scale.y = 0.75;
      bush.castShadow = true;
      if (Math.abs(x) > 1.8) k.add(bush);
    }
    // Everything added above except the lawn becomes the front garden (hidden when the house opens).
    for (const o of [...this.kit.root.children]) {
      if (before.has(o) || o === lawn) continue;
      this.exterior.add(o);
    }
    this.kit.root.add(this.exterior);
  }

  private buildHouse() {
    const wood = this.mats.wood();
    const trim = this.mats.paintedMetal('#d8c8f0');
    const floors = WINGS.map((w) => w.lessons);
    floors.forEach((ids, fi) => {
      const y = fi * FLOOR_H;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W, GAP, ROOM_D + 0.4), wood);
      slab.position.set(0, y - GAP / 2, 0);
      slab.receiveShadow = true;
      slab.castShadow = true;
      this.kit.add(slab);
      // Back wall (wallpaper colour per wing) behind the whole floor
      const back = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W, ROOM_H, 0.1), this.mats.plastic(WING_WALL[fi]));
      back.position.set(0, y + ROOM_H / 2, -ROOM_D / 2 - 0.05);
      back.receiveShadow = true;
      this.kit.add(back);
      // Wing banner on the floor edge
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(6.5, 0.2),
        new THREE.MeshBasicMaterial({ map: labelTexture(WINGS[fi].name, { fg: WING_GLOW[fi], w: 1024, h: 80, size: 54 }), transparent: true }),
      );
      banner.position.set(0, y - GAP / 2, ROOM_D / 2 + 0.21);
      this.kit.add(banner);
      // Decorative string lights along each floor edge
      this.kit.stringLights([-HOUSE_W / 2, y + ROOM_H + 0.02, ROOM_D / 2 + 0.25], [HOUSE_W / 2, y + ROOM_H + 0.02, ROOM_D / 2 + 0.25], 0.12, this.kit.n(36), [WING_GLOW[fi], '#FFF7E7']).setLit(0.55);
      const rowW = ids.length * ROOM_W;
      const x0 = -rowW / 2 + ROOM_W / 2;
      // Side alcoves for shorter floors: velvet curtains
      if (rowW < HOUSE_W - 1) {
        for (const sx of [-1, 1]) {
          const w = (HOUSE_W - rowW) / 2;
          const curtain = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, ROOM_H, 0.2), this.mats.plastic('#5a1f3a'));
          curtain.position.set(sx * (rowW / 2 + w / 2), y + ROOM_H / 2, -ROOM_D / 2 + 0.3);
          this.kit.add(curtain);
        }
      }
      ids.forEach((id, ri) => this.buildRoom(id, fi, x0 + ri * ROOM_W, y));
      // Columns between rooms
      for (let i = 0; i <= ids.length; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, ROOM_H, 12), trim);
        col.position.set(-rowW / 2 + i * ROOM_W, y + ROOM_H / 2, ROOM_D / 2 - 0.05);
        col.castShadow = true;
        this.kit.add(col);
      }
    });
    // Roof, towers, chimneys
    const topY = floors.length * FLOOR_H - GAP;
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-HOUSE_W / 2 - 0.6, 0);
    roofShape.lineTo(-3, 3.2);
    roofShape.lineTo(3, 3.2);
    roofShape.lineTo(HOUSE_W / 2 + 0.6, 0);
    roofShape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: ROOM_D + 1.0, bevelEnabled: false }), new THREE.MeshStandardMaterial({ map: shingles(), color: '#ffffff', roughness: 0.8 }));
    roof.position.set(0, topY, -ROOM_D / 2 - 0.5);
    roof.castShadow = true;
    this.kit.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, ROOM_D + 1.1), this.mats.brass());
    ridge.position.set(0, topY + 3.22, 0);
    this.kit.add(ridge);
    // Front gable that carries the marquee sign
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-3.6, 0);
    gableShape.lineTo(0, 2.9);
    gableShape.lineTo(3.6, 0);
    gableShape.closePath();
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, { depth: 0.5, bevelEnabled: false }), this.mats.plastic('#432c66'));
    gable.position.set(0, topY - 0.05, ROOM_D / 2 + 0.55);
    gable.castShadow = true;
    this.kit.add(gable);
    const roundWin = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), this.mats.glow('#ffcf80', 1.4));
    roundWin.position.set(0, topY + 1.85, ROOM_D / 2 + 1.07);
    this.kit.add(roundWin);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W + 1.4, 0.22, 0.4), this.mats.paintedMetal('#d8b86a'));
    cornice.position.set(0, topY - 0.02, ROOM_D / 2 + 0.55);
    this.kit.add(cornice);
    for (const sx of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, topY + 2.4, 20), this.mats.plastic('#33224f'));
      tower.position.set(sx * (HOUSE_W / 2 + 0.6), (topY + 2.4) / 2, 0.2);
      tower.castShadow = true;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.8, 20), this.mats.plastic('#5a2f6b'));
      cone.position.set(sx * (HOUSE_W / 2 + 0.6), topY + 2.4 + 1.4, 0.2);
      cone.castShadow = true;
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 4), this.mats.glow(sx < 0 ? '#71E3CF' : '#FF7F86', 1.5));
      flag.position.set(sx * (HOUSE_W / 2 + 0.6), topY + 2.4 + 3.1, 0.2);
      this.kit.add(tower);
      this.kit.add(cone);
      this.kit.add(flag);
      for (let w = 0; w < 4; w++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.7), this.mats.glow('#ffcf80', 0.9));
        win.position.set(sx * (HOUSE_W / 2 + 0.6), 1.2 + w * FLOOR_H, 1.32);
        this.kit.add(win);
      }
    }
    // Marquee sign on the roof with chaser bulbs
    const signY = topY + 3.9;
    const signZ = ROOM_D / 2 + 1.0;
    const sign = this.kit.neonSign("ANGELA'S FUN HOUSE", [0, signY, signZ], { height: 1.05, color: '#FFC75B' });
    sign.setLit(1);
    const bulbGeo = new THREE.SphereGeometry(0.07, 10, 8);
    for (let i = 0; i < 44; i++) {
      const u = i / 44;
      const per = 2 * (4.2 + 1.2);
      let x: number;
      let yy: number;
      const d = u * per;
      if (d < 4.2) {
        x = -2.1 + d;
        yy = 0.62;
      } else if (d < 5.4) {
        x = 2.1;
        yy = 0.62 - (d - 4.2);
      } else if (d < 9.6) {
        x = 2.1 - (d - 5.4);
        yy = -0.58;
      } else {
        x = -2.1;
        yy = -0.58 + (d - 9.6);
      }
      const m = new THREE.MeshStandardMaterial({ color: '#221a2a', emissive: '#fff3c4', emissiveIntensity: 2 });
      this.marqueeBulbs.push(m);
      const b = new THREE.Mesh(bulbGeo, m);
      b.position.set(x, signY + yy, signZ + 0.08);
      this.kit.add(b);
    }
  }

  private buildRoom(id: LessonId, fi: number, x: number, y: number) {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    this.kit.add(g);
    const wallMat = new THREE.MeshStandardMaterial({ color: WING_WALL[fi], emissive: WING_GLOW[fi], emissiveIntensity: 0, roughness: 0.85 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 0.08, ROOM_H - 0.02, 0.04), wallMat);
    back.position.set(0, ROOM_H / 2, -ROOM_D / 2 + 0.02);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 0.04, 0.03, ROOM_D), this.mats.plastic('#2a1f3a'));
    floor.position.y = 0.015;
    floor.receiveShadow = true;
    g.add(back, floor);
    const l = LESSONS.find((z) => z.id === id)!;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W * 0.92, 0.2),
      new THREE.MeshBasicMaterial({ map: labelTexture(`${l.number}. ${l.attractionTitle}`, { fg: '#FFF7E7', bg: 'rgba(20,12,36,0.88)', w: 1024, h: 100, size: 50, radius: 28, font: '"Atkinson Hyperlegible Next", system-ui, sans-serif' }), transparent: true }),
    );
    plate.position.set(0, ROOM_H - 0.15, ROOM_D / 2 - 0.02);
    g.add(plate);
    const roomKit = new SetKit(this.mats, this.kit.theme, { detail: this.stage.profile.detail * 0.6, reducedMotion: this.reduced });
    g.add(roomKit.root);
    // Default vignette until the attraction's own miniature loads.
    const orb = roomKit.orb([0, 0.55, 0], 0.3, WING_GLOW[fi]);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.2, 18), this.mats.brass());
    ped.position.y = 0.12;
    roomKit.root.add(ped);
    let updater: (t: number, lit: number) => void = (t, lit) => {
      orb.setLit(lit);
      orb.position.y = 0.55 + (this.reduced ? 0 : Math.sin(t * 1.5 + x) * 0.05);
    };
    let activeKit = roomKit;
    const attach = (def: TableDef | null) => {
      if (!def?.room || this.disposed) return;
      const k2 = new SetKit(this.mats, this.kit.theme, { detail: this.stage.profile.detail * 0.6, reducedMotion: this.reduced });
      try {
        const u = def.room({ kit: k2, w: ROOM_W, h: ROOM_H, d: ROOM_D }).update;
        g.remove(roomKit.root);
        g.add(k2.root);
        activeKit = k2;
        updater = u;
      } catch (e) {
        console.warn(`room vignette ${id} failed`, e);
        k2.dispose();
      }
    };
    if (TABLE_IDS.has(id)) void loadTable(id).then(attach);
    // Window on the façade for this room (lights with progress)
    const windowMat = new THREE.MeshStandardMaterial({ color: '#100a1c', emissive: '#ffcf80', emissiveIntensity: 0.05, roughness: 0.3 });
    const room: RoomInfo = {
      id, group: g, wallMat, windowMat,
      center: new THREE.Vector3(x, y + ROOM_H / 2, ROOM_D / 2),
      lit: 0,
      update: (t, lit) => {
        activeKit.tick(t, 1 / 60);
        updater(t, lit);
      },
    };
    this.rooms.push(room);
  }

  /** Façade with a window per room, hinged on the left so it swings open like a dollhouse. */
  private buildFacade() {
    const H = 4 * FLOOR_H;
    this.facadeHinge.position.set(-HOUSE_W / 2, 0, ROOM_D / 2 + 0.32);
    this.kit.add(this.facadeHinge);
    this.facade.position.set(HOUSE_W / 2, 0, 0);
    this.facadeHinge.add(this.facade);
    const wallMat = this.mats.plastic('#3a2858');
    const wall = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W, H, 0.12), wallMat);
    wall.position.set(0, H / 2 - GAP, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.facade.add(wall);
    // Clapboard lines
    for (let i = 1; i < 28; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W, 0.015, 0.02), this.mats.plastic('#2c1f45'));
      line.position.set(0, i * (H / 28) - GAP, 0.07);
      this.facade.add(line);
    }
    const frameMat = this.mats.paintedMetal('#e8dcf8');
    const gold = this.mats.paintedMetal('#d8b86a');
    for (let f = 1; f < 4; f++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(HOUSE_W + 0.2, 0.14, 0.18), gold);
      band.position.set(0, f * FLOOR_H - GAP, 0.1);
      band.castShadow = true;
      this.facade.add(band);
    }
    for (const px of [-HOUSE_W / 2, -HOUSE_W / 6, HOUSE_W / 6, HOUSE_W / 2]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, 0.22), frameMat);
      pil.position.set(px, H / 2 - GAP, 0.1);
      pil.castShadow = true;
      this.facade.add(pil);
    }
    const shutterMats = ['#5a2f6b', '#2f5a6b', '#3f6b3a', '#6b2f45'].map((c) => this.mats.plastic(c));
    for (const r of this.rooms) {
      const fi = Math.round((r.center.y - ROOM_H / 2) / FLOOR_H);
      for (const sx of [-1, 1]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.0, 0.05), shutterMats[fi]);
        sh.position.set(r.center.x + sx * 0.7, r.center.y - GAP / 2 + 0.05, 0.08);
        this.facade.add(sh);
      }
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.22), this.mats.wood());
      box.position.set(r.center.x, r.center.y - GAP / 2 - 0.5, 0.16);
      this.facade.add(box);
      for (let k = 0; k < 5; k++) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.mats.glow(['#FF7F86', '#FFC75B', '#9fb4ff'][k % 3], 0.5));
        fl.position.set(r.center.x - 0.4 + k * 0.2, r.center.y - GAP / 2 - 0.4, 0.2);
        this.facade.add(fl);
      }
    }
    for (const r of this.rooms) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.95), r.windowMat);
      win.position.set(r.center.x, r.center.y - GAP / 2 + 0.05, 0.08);
      this.facade.add(win);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.12, 1.07, 0.04), frameMat);
      fr.position.set(r.center.x, r.center.y - GAP / 2 + 0.05, 0.05);
      this.facade.add(fr);
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.95, 0.03), frameMat);
      mull.position.set(r.center.x, r.center.y - GAP / 2 + 0.05, 0.09);
      const mull2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.03), frameMat);
      mull2.position.copy(mull.position);
      this.facade.add(mull, mull2);
    }
    // Front door + porch
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.1), this.mats.wood());
    door.position.set(0, 1.1 - GAP, 0.12);
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), this.mats.glow('#FFC75B', 1.2));
    doorGlow.position.set(0, 2.35 - GAP, 0.12);
    this.facade.add(door, doorGlow);
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 14), frameMat);
      col.position.set(sx * 1.2, 1.3 - GAP, 0.9);
      col.castShadow = true;
      this.facade.add(col);
    }
    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.3), this.mats.plastic('#5a2f6b'));
    porchRoof.position.set(0, 2.62 - GAP, 0.62);
    this.facade.add(porchRoof);
  }

  // ------------------------------------------------------------------ interaction

  setSave(s: SaveData) {
    this.save = s;
  }

  setMode(m: SceneMode) {
    this.mode = m;
  }

  setPointer(x: number, y: number) {
    this.parallax.set(x, y);
  }

  /** Room under a canvas-relative NDC point (map mode only). */
  pick(ndcX: number, ndcY: number): LessonId | null {
    if (this.mode !== 'map' || this.facadeOpen < 0.9) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.stage.camera);
    const hit = ray.intersectObjects(this.rooms.map((r) => r.group), true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o) {
      const r = this.rooms.find((x) => x.group === o);
      if (r) return r.id;
      o = o.parent;
    }
    return null;
  }

  zoomInto(id: LessonId, done: () => void) {
    this.zoom = { id, k: 0, done };
  }

  /** Screen rectangles of rooms (for accessible overlay buttons). */
  roomRects(width: number, height: number) {
    const cam = this.stage.camera;
    return this.rooms.map((r) => {
      const c = r.center.clone().project(cam);
      const e = new THREE.Vector3(r.center.x + ROOM_W / 2, r.center.y + ROOM_H / 2, r.center.z).project(cam);
      return { id: r.id, x: ((c.x + 1) / 2) * width, y: ((1 - c.y) / 2) * height, w: Math.abs(e.x - c.x) * width, h: Math.abs(e.y - c.y) * height };
    });
  }

  // ------------------------------------------------------------------ frame

  render(dt: number) {
    this.t += dt;
    const t = this.t;
    const cam = this.stage.camera;
    // Façade swing
    const wantOpen = this.mode === 'map' ? 1 : 0;
    this.facadeOpen += (wantOpen - this.facadeOpen) * Math.min(1, dt * (this.reduced ? 20 : 1.6));
    this.facadeHinge.rotation.y = -this.facadeOpen * 1.92;
    this.exterior.visible = this.facadeOpen < 0.5;
    // Rooms
    let litCount = 0;
    for (const r of this.rooms) {
      const pr = this.save.progress[r.id];
      const want = pr.wonderlight ? 1 : pr.missions.filter(Boolean).length * 0.2;
      r.lit += (want - r.lit) * Math.min(1, dt * 2);
      if (pr.wonderlight) litCount++;
      const hovered = this.hover === r.id || this.focusRoom === r.id;
      r.wallMat.emissiveIntensity = r.lit * 0.32 + (hovered ? 0.18 : 0);
      // Dormant windows keep a faint candle glow so the house never looks dead.
      const flicker = this.reduced ? 0 : 0.04 * Math.sin(t * 3 + r.center.x * 2);
      r.windowMat.emissiveIntensity = 0.22 + flicker + r.lit * 2.3 + (hovered ? 0.6 : 0);
      r.update(t, Math.max(r.lit, hovered ? 0.4 : 0.08));
    }
    this.beacon.setLit(0.15 + (litCount / 29) * 0.85);
    this.fireworks.setLit(litCount >= 29 ? 1 : 0);
    this.marqueeBulbs.forEach((m, i) => (m.emissiveIntensity = this.reduced ? 2 : 0.6 + 2.2 * (((i + Math.floor(t * 8)) % 4 === 0) ? 1 : 0.25)));
    this.kit.tick(t, dt);
    // Camera
    const aspect = this.stage.width / Math.max(1, this.stage.height);
    const target = this.houseCenter.clone();
    if (this.mode === 'title') {
      const a = this.reduced ? 0.3 : 0.3 + Math.sin(t * 0.07) * 0.22;
      const dist = aspect < 0.8 ? 46 : 38;
      cam.fov = 36;
      cam.position.set(Math.sin(a) * dist - (aspect < 0.8 ? 0 : 6), 5 + Math.sin(t * 0.13) * (this.reduced ? 0 : 0.5), Math.cos(a) * dist);
      target.set(aspect < 0.8 ? 0 : -7, FLOOR_H * 2.4, 0);
    } else {
      cam.fov = 34;
      const vFov = THREE.MathUtils.degToRad(cam.fov);
      const needH = (4 * FLOOR_H + 3.2) / 2;
      const needW = HOUSE_W / 2 + 1.6;
      const dist = Math.max(needH / Math.tan(vFov / 2), needW / (Math.tan(vFov / 2) * aspect)) + ROOM_D;
      cam.position.set(this.parallax.x * 0.8 + (this.reduced ? 0 : Math.sin(t * 0.2) * 0.4), FLOOR_H * 2.6 + this.parallax.y * 0.5, dist);
      target.set(0, FLOOR_H * 2.45, 0);
    }
    cam.updateProjectionMatrix();
    cam.lookAt(target);
    if (this.zoom) {
      const z = this.zoom;
      z.k += dt / (this.reduced ? 0.05 : 0.9);
      const room = this.rooms.find((r) => r.id === z.id)!;
      const k = Math.min(1, z.k);
      const e = k * k * (3 - 2 * k);
      cam.position.lerp(room.center.clone().add(new THREE.Vector3(0, 0.1, 1.5)), e);
      cam.lookAt(target.lerp(room.center.clone().add(new THREE.Vector3(0, 0, -1)), e));
      if (z.k >= 1) {
        this.zoom = null;
        z.done();
      }
    }
    this.stage.render(dt);
  }

  resize(w: number, h: number) {
    this.stage.resize(w, h);
  }

  private disposed = false;

  dispose() {
    this.disposed = true;
    for (const l of this.roomLights) l.dispose();
    this.kit.dispose();
    this.mats.dispose();
    this.stage.dispose();
  }
}

