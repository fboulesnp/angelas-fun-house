// Builds the 3D cabinet + playfield from a TableRuntime and keeps it in sync every frame.
// Geometry comes from the same mechanisms the physics uses, so what you see is what you hit.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Flipper } from '../physics/flipper.ts';
import { BALL_R, TABLE_H, TABLE_W } from '../physics/types.ts';
import {
  Bumper, Diverter, DropTarget, FlipperMech, Gate, Insert, Kickback, Plunger, Portal, Post, Ramp, Rollover,
  Saucer, Slingshot, Spinner, Target, Wall, offsetPath, type Mechanism,
} from '../table/mechanisms.ts';
import type { TableRuntime } from '../table/runtime.ts';
import type { TableDef, TableTheme } from '../table/tableDef.ts';
import type { SceneryContext } from '../render/sceneryTypes.ts';
import { drawIcon } from '../render/icons.ts';
import { Materials } from './materials.ts';
import { K, TH, TW, extrudeUp, shapeFrom, wx, wy, wz } from './space.ts';
import { labelTexture, radialTexture } from './textures.ts';

const WALL_H = 0.3;
const FRAME_H = 0.46;
const TAU = Math.PI * 2;

interface Synced {
  m: Mechanism;
  update(t: number, dt: number): void;
}

export interface TableViewOptions {
  reducedMotion: boolean;
  detail: number;
  shadows: boolean;
}

export class TableView {
  readonly root = new THREE.Group();
  readonly mats = new Materials();
  private synced: Synced[] = [];
  private flippers: { f: Flipper; g: THREE.Group }[] = [];
  private ramps = new Map<string, Ramp>();
  private printCanvas: HTMLCanvasElement;
  private printTex: THREE.CanvasTexture;
  playfield!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
  private printLevel = -1;
  readonly theme: TableTheme;
  private rt: TableRuntime;
  private def: TableDef;
  private opts: TableViewOptions;

  constructor(def: TableDef, rt: TableRuntime, opts: TableViewOptions) {
    this.def = def;
    this.rt = rt;
    this.theme = def.theme;
    this.opts = opts;
    const pw = 1024;
    const ph = Math.round((pw * TABLE_H) / TABLE_W);
    this.printCanvas = document.createElement('canvas');
    this.printCanvas.width = pw;
    this.printCanvas.height = ph;
    this.printTex = new THREE.CanvasTexture(this.printCanvas);
    this.printTex.colorSpace = THREE.SRGBColorSpace;
    this.printTex.anisotropy = 8;
    this.buildPlayfield();
    this.buildCabinet();
    this.buildGI();
    for (const m of rt.order) this.buildMechanism(m);
  }

  // ------------------------------------------------------------------ playfield print

  private buildPlayfield() {
    const geo = new THREE.PlaneGeometry(TW, TH);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({
      map: this.printTex,
      emissiveMap: this.printTex,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.34,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      envMapIntensity: 0.8,
    });
    this.playfield = new THREE.Mesh(geo, mat);
    this.playfield.receiveShadow = true;
    this.root.add(this.playfield);
  }

  /** Repaint the printed playfield art for a scenery level (cheap enough for transitions). */
  paintPrint(level: number, t: number) {
    const key = Math.round(level * 6);
    if (key === this.printLevel) return;
    this.printLevel = key;
    const c = this.printCanvas;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(c.width / TABLE_W, 0, 0, c.height / TABLE_H, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, TABLE_H);
    g.addColorStop(0, this.theme.bg[0]);
    g.addColorStop(1, this.theme.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);
    const sc: SceneryContext = { ctx, t, level, energy: 0, reduced: true, lowFx: false, theme: this.theme };
    ctx.save();
    this.def.scenery.backdrop(sc);
    ctx.restore();
    // Printed decorations: lane outlines, shooter lane, apron title
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(551, 330, 42, 820);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = this.theme.accent;
    ctx.lineWidth = 2;
    for (const m of this.rt.order) {
      if (m instanceof Saucer) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r + 18, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.printTex.needsUpdate = true;
    this.playfield.material.emissiveIntensity = 0.3 + 0.07 * Math.min(4, level);
  }

  // ------------------------------------------------------------------ cabinet

  private buildCabinet() {
    const wood = this.mats.wood();
    const chrome = this.mats.chrome();
    // Side rails (outside the playfield edges)
    const railGeo = new THREE.BoxGeometry(0.34, 0.62, TH + 0.6);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, wood);
      rail.position.set(side * (TW / 2 + 0.17), 0.12, 0);
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.root.add(rail);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, TH + 0.62), chrome);
      cap.position.set(side * (TW / 2 + 0.05), 0.445, 0);
      this.root.add(cap);
    }
    // Head (top) wall and front lockdown bar
    const head = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.68, 0.62, 0.3), wood);
    head.position.set(0, 0.12, -TH / 2 - 0.15);
    head.receiveShadow = true;
    this.root.add(head);
    const front = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.68, 0.5, 0.3), wood);
    front.position.set(0, 0.06, TH / 2 + 0.15);
    this.root.add(front);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, TW + 0.68, 24), this.mats.paintedMetal('#2a2238'));
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.36, TH / 2 + 0.2);
    this.root.add(bar);
    // Under-playfield base so the edges never show the void
    const base = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.7, 0.4, TH + 0.62), this.mats.dark());
    base.position.set(0, -0.21, 0);
    this.root.add(base);
    // Apron (printed plastic covering the drain)
    const apronPts: [number, number][] = [[24, 1072], [196, 1104], [376, 1104], [548, 1072], [548, 1150], [24, 1150]];
    const apron = new THREE.Mesh(extrudeUp(shapeFrom(apronPts), 0.08, 0.008), this.mats.plastic(this.theme.bg[1]));
    apron.position.set(wx(0), 0, wz(0));
    apron.receiveShadow = true;
    this.root.add(apron);
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.32),
      new THREE.MeshStandardMaterial({ map: labelTexture("ANGELA'S FUN HOUSE", { fg: this.theme.lampOn, w: 1024, h: 128, size: 78 }), transparent: true, emissive: this.theme.lampOn, emissiveIntensity: 0.6, emissiveMap: labelTexture("ANGELA'S FUN HOUSE", { fg: this.theme.lampOn, w: 1024, h: 128, size: 78 }) }),
    );
    title.rotation.x = -Math.PI / 2;
    title.position.set(wx(286), 0.086, wz(1128));
    this.root.add(title);
  }

  // ------------------------------------------------------------------ mechanisms

  private buildMechanism(m: Mechanism) {
    if (m instanceof Wall) this.buildWall(m);
    else if (m instanceof Post) this.buildPost(m);
    else if (m instanceof Bumper) this.buildBumper(m);
    else if (m instanceof Slingshot) this.buildSling(m);
    else if (m instanceof FlipperMech) this.buildFlipper(m.flipper);
    else if (m instanceof Target) this.buildTarget(m);
    else if (m instanceof DropTarget) this.buildDrop(m);
    else if (m instanceof Rollover) this.buildRollover(m);
    else if (m instanceof Saucer) this.buildSaucer(m);
    else if (m instanceof Spinner) this.buildSpinner(m);
    else if (m instanceof Gate) this.buildGate(m);
    else if (m instanceof Diverter) this.buildDiverter(m);
    else if (m instanceof Ramp) this.buildRamp(m);
    else if (m instanceof Insert) this.buildInsert(m);
    else if (m instanceof Kickback) this.buildKickback(m);
    else if (m instanceof Portal) this.buildPortal(m);
    else if (m instanceof Plunger) this.buildPlunger(m);
  }

  /** Additive glow decal on the playfield that makes a lamp appear to light the lacquer. */
  private pool(x: number, y: number, radius: number, color: string, h = 0.006): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 'pool'),
      color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const g = new THREE.PlaneGeometry(radius * 2 * K, radius * 2 * K);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(wx(x), h, wz(y));
    m.renderOrder = 1;
    this.root.add(m);
    return mat;
  }

  /** Warm general illumination under the plastics (skipped on the lowest tier). */
  private buildGI() {
    if (this.opts.detail < 0.5) return;
    const spots: [number, number, number][] = [[140, 260, 1.1], [440, 260, 1.1], [120, 760, 0.9], [452, 760, 0.9], [286, 560, 1.0]];
    for (const [x, y, h] of spots) {
      const l = new THREE.PointLight('#ffd7a3', 1.1, 4.5, 2);
      l.position.set(wx(x), h, wz(y));
      this.root.add(l);
    }
  }

  private lampLevel(m: Mechanism, t: number): number {
    switch (m.lamp) {
      case 'on':
        return 1;
      case 'flash':
        return this.opts.reducedMotion ? 0.9 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 10));
      case 'pulse':
        return this.opts.reducedMotion ? 0.8 : 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * 4));
      default:
        return 0;
    }
  }

  private buildWall(w: Wall) {
    if (w.style === 'invisible') return;
    const isFrame = w.id.startsWith('frame_');
    const h = isFrame ? FRAME_H : w.layer === 1 ? 0.12 : WALL_H;
    const thick = Math.max(0.05, w.r * 2 * K + (isFrame ? 0.06 : 0.02));
    const pts = w.closed ? [...w.points, w.points[0]] : w.points;
    const geos: THREE.BufferGeometry[] = [];
    const caps: THREE.BufferGeometry[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1) * K;
      if (len < 1e-4) continue;
      const g = new THREE.BoxGeometry(len, h, thick);
      g.rotateY(-Math.atan2(y2 - y1, x2 - x1));
      g.translate(wx((x1 + x2) / 2), h / 2, wz((y1 + y2) / 2));
      geos.push(g);
      const cap = new THREE.CylinderGeometry(thick / 2, thick / 2, h, 12);
      cap.translate(wx(x2), h / 2, wz(y2));
      caps.push(cap);
      if (i === 0) {
        const c0 = new THREE.CylinderGeometry(thick / 2, thick / 2, h, 12);
        c0.translate(wx(x1), h / 2, wz(y1));
        caps.push(c0);
      }
    }
    if (!geos.length) return;
    const merged = mergeGeometries([...geos, ...caps]);
    const mat =
      w.style === 'rubber' ? this.mats.rubber() :
      w.style === 'glass' ? this.mats.clearPlastic('#d8f4ff', 0.28) :
      w.style === 'wood' || isFrame ? this.mats.wood() :
      this.mats.paintedMetal(this.theme.rail);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = this.opts.shadows && !isFrame;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    // Chrome top trim on guides
    if (!isFrame && w.style !== 'rubber' && w.style !== 'glass' && w.layer === 0) {
      const trims: THREE.BufferGeometry[] = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const len = Math.hypot(x2 - x1, y2 - y1) * K;
        if (len < 1e-4) continue;
        const g = new THREE.BoxGeometry(len + thick * 0.4, 0.02, thick * 1.15);
        g.rotateY(-Math.atan2(y2 - y1, x2 - x1));
        g.translate(wx((x1 + x2) / 2), h + 0.01, wz((y1 + y2) / 2));
        trims.push(g);
      }
      const trim = new THREE.Mesh(mergeGeometries(trims), this.mats.chrome());
      this.root.add(trim);
    }
    for (const g of [...geos, ...caps]) g.dispose();
  }

  private buildPost(p: Post) {
    const g = new THREE.Group();
    const r = p.r * K;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.6, 0.32, 16), this.mats.chrome());
    body.position.y = 0.16;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, r * 0.32, 10, 24), this.mats.rubber(this.theme.accent2));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    const top = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 16, 10), this.mats.plastic(this.theme.accent));
    top.position.y = 0.33;
    g.add(body, ring, top);
    for (const c of [body, ring, top]) c.castShadow = this.opts.shadows;
    g.position.set(wx(p.x), wy(0), wz(p.y));
    this.root.add(g);
    const glow = this.mats.glow(this.theme.lampOn, 0, true);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.12, 6, 20), glow);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.14;
    g.add(halo);
    halo.visible = false;
    this.synced.push({ m: p, update: () => {
      glow.emissiveIntensity = p.hitFlash * 18;
      halo.visible = p.hitFlash > 0.001;
    } });
  }

  private buildBumper(b: Bumper) {
    const g = new THREE.Group();
    const r = b.r * K;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.15, 0.04, 32), this.mats.chrome());
    skirt.position.y = 0.02;
    const bodyMat = this.mats.plastic(this.theme.bumperRing, { transparent: true, opacity: 0.94 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.86, 0.26, 32), bodyMat);
    body.position.y = 0.17;
    const lampMat = this.mats.glow(this.theme.lampOn, 0.2, true);
    const lampBand = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.06, 32, 1, true), lampMat);
    lampBand.position.y = 0.2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, 0.028, 12, 40), this.mats.rubber('#f7f1e6'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    const capTex = this.capTexture(b);
    const capMats = [
      this.mats.plastic(this.theme.bumperCap),
      new THREE.MeshPhysicalMaterial({ map: capTex, roughness: 0.2, clearcoat: 1, emissive: '#ffffff', emissiveMap: capTex, emissiveIntensity: 0.15 }),
      this.mats.plastic(this.theme.bumperCap),
    ];
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.07, 40), capMats);
    cap.position.y = 0.335;
    g.add(skirt, body, lampBand, ring, cap);
    for (const c of [skirt, body, cap, ring]) {
      c.castShadow = this.opts.shadows;
      c.receiveShadow = true;
    }
    g.position.set(wx(b.x), 0, wz(b.y));
    this.root.add(g);
    const bpool = this.pool(b.x, b.y, b.r * 2.6, this.theme.lampOn);
    this.synced.push({
      m: b,
      update: (t) => {
        const lit = Math.max(this.lampLevel(b, t), b.hitFlash * 5);
        bpool.opacity = 0.12 + Math.min(1, lit) * 0.55;
        lampMat.emissiveIntensity = 0.25 + lit * 5;
        (capMats[1] as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.15 + Math.min(1, lit) * 0.9;
        const sq = b.squash;
        cap.position.y = 0.335 - sq * 0.05;
        ring.scale.setScalar(1 - sq * 0.06);
      },
    });
  }

  private capTexture(b: Bumper): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(100, 90, 10, 128, 128, 128);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.5, this.theme.bumperCap);
    grd.addColorStop(1, this.theme.bumperCap);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#1a1030';
    ctx.translate(128, 128);
    // Cylinder cap UVs run u -> +Z and v -> +X; rotate so the label reads from the player's seat.
    ctx.rotate(-Math.PI / 2);
    if (!(b.icon && drawIcon(ctx, b.icon, 70, this.def.icons)) && b.label) {
      ctx.font = '800 120px "Fraunces Variable", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, 0, 8);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    // Rotate so the text reads from the player's seat (texture v runs toward -Z on cylinder tops).
    t.center.set(0.5, 0.5);
    return t;
  }

  private buildSling(s: Slingshot) {
    const pts: [number, number][] = [s.a, s.b, s.c];
    const body = new THREE.Mesh(extrudeUp(shapeFrom(pts), 0.22, 0.012), this.mats.plastic(this.theme.accent));
    body.position.set(wx(0), 0.02, wz(0));
    body.castShadow = this.opts.shadows;
    body.receiveShadow = true;
    this.root.add(body);
    // kicker band on the face
    const band = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(s.c[0] - s.a[0], s.c[1] - s.a[1]) * K, 0.07, 0.03), this.mats.rubber('#fffaf0'));
    const ang = -Math.atan2(s.c[1] - s.a[1], s.c[0] - s.a[0]);
    band.rotation.y = ang;
    const mx = (s.a[0] + s.c[0]) / 2;
    const my = (s.a[1] + s.c[1]) / 2;
    // push the band slightly toward the open side
    const nx = -(s.c[1] - s.a[1]);
    const ny = s.c[0] - s.a[0];
    const nl = Math.hypot(nx, ny);
    const side = (s.b[0] - mx) * nx + (s.b[1] - my) * ny > 0 ? -1 : 1;
    const ox = (nx / nl) * 4 * side;
    const oy = (ny / nl) * 4 * side;
    band.position.set(wx(mx + ox), 0.12, wz(my + oy));
    this.root.add(band);
    for (const p of pts) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.3, 14), this.mats.chrome());
      post.position.set(wx(p[0]), 0.15, wz(p[1]));
      this.root.add(post);
    }
    const flash = this.mats.glow(this.theme.lampOn, 0, true);
    const flashMesh = new THREE.Mesh(extrudeUp(shapeFrom(pts), 0.01, 0), flash);
    flashMesh.position.set(wx(0), 0.245, wz(0));
    flashMesh.visible = false;
    this.root.add(flashMesh);
    this.synced.push({
      m: s,
      update: () => {
        band.position.set(wx(mx + ox * (1 + s.squash * 2)), 0.12, wz(my + oy * (1 + s.squash * 2)));
        flash.emissiveIntensity = s.hitFlash * 14;
        flashMesh.visible = s.hitFlash > 0.001;
      },
    });
  }

  private buildFlipper(f: Flipper) {
    const g = new THREE.Group();
    const r0 = f.r0 * f.widthScale;
    const r1 = f.r1 * f.widthScale;
    const L = f.length;
    // Tapered capsule outline in local table units (pivot at 0,0, pointing +x)
    const outline: [number, number][] = [];
    const seg = 14;
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI / 2 + (i / seg) * Math.PI;
      outline.push([Math.cos(a) * r0, Math.sin(a) * r0]);
    }
    for (let i = 0; i <= seg; i++) {
      const a = -Math.PI / 2 + (i / seg) * Math.PI;
      outline.push([L + Math.cos(a) * r1, Math.sin(a) * r1]);
    }
    const body = new THREE.Mesh(extrudeUp(shapeFrom(outline), 0.18, 0.015), this.mats.plastic(this.theme.flipper));
    body.position.y = 0.03;
    body.castShadow = this.opts.shadows;
    body.receiveShadow = true;
    const rubberPts = outline.map(([x, y]) => new THREE.Vector3(x * K, 0.1, y * K));
    const rubber = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rubberPts, true), 80, 0.03, 8, true), this.mats.rubber(this.theme.accent2));
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 16), this.mats.chrome());
    pin.position.y = 0.12;
    g.add(body, rubber, pin);
    g.position.set(wx(f.px), 0, wz(f.py));
    if (f.layer === 1) g.position.y = wy(60);
    this.root.add(g);
    this.flippers.push({ f, g });
  }

  private buildTarget(t: Target) {
    const len = Math.hypot(t.x2 - t.x1, t.y2 - t.y1) * K;
    const ang = -Math.atan2(t.y2 - t.y1, t.x2 - t.x1);
    const g = new THREE.Group();
    const face = labelTexture(t.label ?? '', { bg: this.theme.accent, fg: '#1a1030', w: 256, h: 96, size: 54, weight: 800, font: '"Atkinson Hyperlegible Next", system-ui, sans-serif' });
    const faceMat = new THREE.MeshPhysicalMaterial({ map: face, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.1, roughness: 0.3, clearcoat: 1 });
    const sideMat = this.mats.plastic(this.theme.accent);
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, 0.24, 0.06), [sideMat, sideMat, sideMat, sideMat, faceMat, faceMat]);
    box.position.y = 0.14;
    box.castShadow = this.opts.shadows;
    const post = new THREE.Mesh(new THREE.BoxGeometry(len * 0.4, 0.14, 0.05), this.mats.chrome());
    post.position.set(0, 0.07, -0.05);
    g.add(box, post);
    g.rotation.y = ang;
    g.position.set(wx((t.x1 + t.x2) / 2), 0, wz((t.y1 + t.y2) / 2));
    this.root.add(g);
    const tpool = this.pool((t.x1 + t.x2) / 2, (t.y1 + t.y2) / 2, 34, this.theme.lampOn);
    this.synced.push({
      m: t,
      update: (time) => {
        const lit = Math.max(this.lampLevel(t, time), t.hitFlash * 3);
        tpool.opacity = Math.min(1, lit) * 0.45;
        faceMat.emissiveIntensity = 0.1 + Math.min(1.5, lit) * 1.4;
        box.position.z = Math.sin(time * 60) * t.wobble * 0.01;
      },
    });
  }

  private buildDrop(d: DropTarget) {
    const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) * K;
    const ang = -Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
    const g = new THREE.Group();
    const face = labelTexture(d.label ?? '', { bg: this.theme.accent2, fg: '#1a1030', w: 128, h: 128, size: 70, font: '"Atkinson Hyperlegible Next", system-ui, sans-serif' });
    const faceMat = new THREE.MeshPhysicalMaterial({ map: face, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.12, roughness: 0.3, clearcoat: 1 });
    const side = this.mats.plastic(this.theme.accent2);
    const box = new THREE.Mesh(new THREE.BoxGeometry(len * 0.94, 0.26, 0.08), [side, side, side, side, faceMat, faceMat]);
    box.castShadow = this.opts.shadows;
    g.add(box);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.1), this.mats.dark());
    slot.rotation.x = -Math.PI / 2;
    slot.position.y = 0.002;
    g.add(slot);
    g.rotation.y = ang;
    g.position.set(wx((d.x1 + d.x2) / 2), 0, wz((d.y1 + d.y2) / 2));
    this.root.add(g);
    this.synced.push({
      m: d,
      update: (t) => {
        box.position.y = 0.13 - d.sink * 0.27;
        box.visible = d.sink < 0.97;
        faceMat.emissiveIntensity = 0.12 + this.lampLevel(d, t) * 1.2 + d.hitFlash * 3;
      },
    });
  }

  private insertMesh(shape: 'arrow' | 'circle' | 'star' | 'label' | 'oval', size: number, color: string) {
    const s = new THREE.Shape();
    const k = K;
    if (shape === 'arrow') {
      const p: [number, number][] = [[0, -size], [size * 0.75, size * 0.15], [size * 0.3, size * 0.15], [size * 0.3, size * 0.9], [-size * 0.3, size * 0.9], [-size * 0.3, size * 0.15], [-size * 0.75, size * 0.15]];
      p.forEach(([x, y], i) => (i ? s.lineTo(x * k, -y * k) : s.moveTo(x * k, -y * k)));
    } else if (shape === 'star') {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * TAU;
        const r = (i % 2 ? size * 0.45 : size) * k;
        const x = Math.cos(a) * r;
        const y = -Math.sin(a) * r;
        if (i) s.lineTo(x, y);
        else s.moveTo(x, y);
      }
    } else if (shape === 'oval') {
      s.absellipse(0, 0, size * 0.55 * k, size * k, 0, TAU, false, 0);
    } else {
      s.absarc(0, 0, size * 0.6 * k, 0, TAU, false);
    }
    s.closePath();
    const geo = new THREE.ShapeGeometry(s, 12);
    geo.rotateX(-Math.PI / 2);
    const mat = this.mats.insert(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.004;
    // dark socket ring
    const ring = new THREE.Mesh(geo.clone().scale(1.25, 1, 1.25), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 }));
    ring.position.y = 0.003;
    const g = new THREE.Group();
    g.add(ring, mesh);
    return { g, mat };
  }

  private buildInsert(m: Insert) {
    const { g, mat } = this.insertMesh(m.shape === 'label' ? 'circle' : m.shape, m.size, m.lampColor ?? this.theme.lampOn);
    g.rotation.y = -(m.angle + Math.PI / 2);
    g.position.set(wx(m.x), 0, wz(m.y));
    this.root.add(g);
    if (m.label) {
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.18), new THREE.MeshBasicMaterial({ map: labelTexture(m.label, { fg: this.theme.ink, w: 512, h: 96, size: 56, font: '"Atkinson Hyperlegible Next", system-ui, sans-serif', weight: 800 }), transparent: true, depthWrite: false }));
      lbl.rotation.x = -Math.PI / 2;
      lbl.position.set(wx(m.x), 0.005, wz(m.y + m.size + 14));
      this.root.add(lbl);
    }
    const pool = this.pool(m.x, m.y, m.size * 3.2, m.lampColor ?? this.theme.lampOn);
    this.synced.push({ m, update: (t) => {
      const l = this.lampLevel(m, t);
      mat.emissiveIntensity = 0.04 + l * 4.5;
      pool.opacity = l * 0.55;
    } });
  }

  private buildRollover(r: Rollover) {
    const { g, mat } = this.insertMesh('oval', 11, r.lampColor ?? this.theme.lampOn);
    g.position.set(wx(r.x), 0, wz(r.y));
    if (r.layer === 1) g.visible = false;
    this.root.add(g);
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 20, Math.PI), this.mats.chrome());
    wire.position.set(wx(r.x), 0.0, wz(r.y));
    wire.rotation.y = Math.PI / 2;
    this.root.add(wire);
    if (r.label) {
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ map: labelTexture(r.label, { fg: this.theme.ink, w: 128, h: 72, size: 56 }), transparent: true, depthWrite: false }));
      lbl.rotation.x = -Math.PI / 2;
      lbl.position.set(wx(r.x), 0.005, wz(r.y - 22));
      this.root.add(lbl);
    }
    const pool = this.pool(r.x, r.y, 34, r.lampColor ?? this.theme.lampOn);
    this.synced.push({ m: r, update: (t) => {
      const l = Math.max(this.lampLevel(r, t), r.hitFlash * 3);
      mat.emissiveIntensity = 0.05 + l * 4;
      pool.opacity = Math.min(1, l) * 0.5;
    } });
  }

  private buildSaucer(s: Saucer) {
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.CircleGeometry((s.r + 3) * K, 32), new THREE.MeshBasicMaterial({ color: 0x050308 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.004;
    const rim = new THREE.Mesh(new THREE.TorusGeometry((s.r + 4) * K, 0.022, 10, 40), this.mats.chrome());
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.012;
    g.add(hole, rim);
    const pocket = s.role === 'pocket';
    const ringMat = this.mats.glow(pocket ? this.theme.lampOn : this.theme.accent, 0.4, true);
    const ring = new THREE.Mesh(new THREE.TorusGeometry((s.r + 13) * K, pocket ? 0.018 : 0.01, 8, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    g.add(ring);
    let halo: THREE.Mesh | undefined;
    if (pocket) {
      // Holographic "Wonder Pocket" column, faint until lit
      const haloMat = new THREE.MeshBasicMaterial({ color: this.theme.lampOn, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      halo = new THREE.Mesh(new THREE.CylinderGeometry((s.r + 10) * K, (s.r + 14) * K, 0.5, 40, 1, true), haloMat);
      halo.position.y = 0.25;
      g.add(halo);
    }
    if (s.label) {
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.18), new THREE.MeshBasicMaterial({ map: labelTexture(s.label, { fg: this.theme.ink, w: 768, h: 96, size: 56, font: '"Atkinson Hyperlegible Next", system-ui, sans-serif' }), transparent: true, depthWrite: false }));
      lbl.rotation.x = -Math.PI / 2;
      lbl.position.set(0, 0.005, (s.r + 30) * K);
      g.add(lbl);
    }
    g.position.set(wx(s.x), 0, wz(s.y));
    this.root.add(g);
    const spool = this.pool(s.x, s.y, pocket ? 70 : 40, pocket ? this.theme.lampOn : this.theme.accent);
    this.synced.push({
      m: s,
      update: (t) => {
        const lit = this.lampLevel(s, t);
        spool.opacity = (pocket ? 0.18 : 0.05) + lit * 0.5 + (s.held.length ? 0.3 : 0);
        ringMat.emissiveIntensity = (pocket ? 0.8 : 0.2) + lit * 5 + s.hitFlash * 4;
        ring.rotation.z = this.opts.reducedMotion ? 0 : t * 0.6;
        if (halo) {
          (halo.material as THREE.MeshBasicMaterial).opacity = 0.06 + lit * 0.22 + (s.held.length ? 0.25 : 0);
          halo.scale.y = 1 + (s.held.length ? 0.4 : 0);
        }
      },
    });
  }

  private buildSpinner(sp: Spinner) {
    const len = Math.hypot(sp.x2 - sp.x1, sp.y2 - sp.y1) * K;
    const g = new THREE.Group();
    for (const sgn of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 10), this.mats.chrome());
      post.position.set((sgn * len) / 2, 0.17, 0);
      g.add(post);
    }
    const axle = new THREE.Group();
    axle.position.y = 0.3;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.2, 0.012), this.mats.plastic(this.theme.accent));
    plate.position.y = -0.1;
    axle.add(plate);
    g.add(axle);
    g.rotation.y = -Math.atan2(sp.y2 - sp.y1, sp.x2 - sp.x1);
    g.position.set(wx((sp.x1 + sp.x2) / 2), 0, wz((sp.y1 + sp.y2) / 2));
    this.root.add(g);
    this.synced.push({ m: sp, update: () => (axle.rotation.x = sp.angle) });
  }

  private buildGate(gt: Gate) {
    const len = Math.hypot(gt.x2 - gt.x1, gt.y2 - gt.y1) * K;
    const g = new THREE.Group();
    const flap = new THREE.Group();
    flap.position.y = 0.22;
    const wire = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.012), this.mats.chrome());
    wire.position.y = -0.09;
    flap.add(wire);
    g.add(flap);
    g.rotation.y = -Math.atan2(gt.y2 - gt.y1, gt.x2 - gt.x1);
    g.position.set(wx((gt.x1 + gt.x2) / 2), 0, wz((gt.y1 + gt.y2) / 2));
    if (gt.layer === 1) g.position.y = wy(60);
    this.root.add(g);
    this.synced.push({ m: gt, update: () => (flap.rotation.x = gt.swing * 1.2) });
  }

  private buildDiverter(d: Diverter) {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(d.length * K, 0.22, 0.04), this.mats.chrome());
    blade.position.set((d.length * K) / 2, 0.11, 0);
    g.add(blade);
    g.position.set(wx(d.px), 0, wz(d.py));
    this.root.add(g);
    this.synced.push({ m: d, update: () => (g.rotation.y = -d.angle) });
  }

  private buildRamp(r: Ramp) {
    this.ramps.set(r.id, r);
    const path = r.path;
    const n = path.length;
    const hw = r.width / 2 + 3;
    const left = offsetPath(path, hw);
    const right = offsetPath(path, -hw);
    const s: number[] = [];
    let acc = 0;
    path.forEach((p, i) => {
      if (i) acc += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]);
      s.push(acc);
    });
    const total = acc || 1;
    const hAt = (i: number) => r.heightAt(s[i] / total);
    // Floor ribbon
    const floorPos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const h = wy(hAt(i)) + 0.004;
      floorPos.push(wx(left[i][0]), h, wz(left[i][1]), wx(right[i][0]), h, wz(right[i][1]));
      if (i + 1 < n) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const floor = new THREE.BufferGeometry();
    floor.setAttribute('position', new THREE.Float32BufferAttribute(floorPos, 3));
    floor.setIndex(idx);
    floor.computeVertexNormals();
    const tint = this.theme.ramp.startsWith('rgba') ? rgbaToHex(this.theme.ramp) : this.theme.ramp;
    const plasticMat = this.mats.clearPlastic(tint, 0.24);
    const floorMesh = new THREE.Mesh(floor, plasticMat);
    floorMesh.renderOrder = 2;
    this.root.add(floorMesh);
    // Side walls
    for (const side of [left, right]) {
      const pos: number[] = [];
      const ix: number[] = [];
      for (let i = 0; i < n; i++) {
        const h = wy(hAt(i));
        pos.push(wx(side[i][0]), h, wz(side[i][1]), wx(side[i][0]), h + 0.16, wz(side[i][1]));
        if (i + 1 < n) {
          const a = i * 2;
          ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(ix);
      geo.computeVertexNormals();
      const wall = new THREE.Mesh(geo, plasticMat);
      wall.renderOrder = 2;
      this.root.add(wall);
      // chrome lip
      const pts = side.map((p, i) => new THREE.Vector3(wx(p[0]), wy(hAt(i)) + 0.165, wz(p[1])));
      const lip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(16, n * 2), 0.014, 6, false), this.mats.chrome());
      this.root.add(lip);
    }
    // Support posts where the ramp is high
    let lastPost = -999;
    for (let i = 0; i < n; i++) {
      const h = hAt(i);
      if (h < 25 || s[i] - lastPost < 140) continue;
      lastPost = s[i];
      for (const side of [left, right]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, wy(h), 8), this.mats.chrome());
        post.position.set(wx(side[i][0]), wy(h) / 2, wz(side[i][1]));
        post.castShadow = this.opts.shadows;
        this.root.add(post);
      }
    }
    // Glow strip that lights when the ramp is a useful shot
    const stripMat = this.mats.glow(this.theme.lampOn, 0, true);
    const stripPts = path.map((p, i) => new THREE.Vector3(wx(p[0]), wy(hAt(i)) + 0.01, wz(p[1])));
    const strip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripPts), Math.max(16, n * 2), 0.01, 5, false), stripMat);
    this.root.add(strip);
    this.synced.push({ m: r, update: (t) => (stripMat.emissiveIntensity = Math.max(this.lampLevel(r, t), r.hitFlash) * 4) });
  }

  private buildKickback(k: Kickback) {
    const { g, mat } = this.insertMesh('arrow', 12, '#7CF29A');
    g.position.set(wx(k.x), 0, wz(k.y));
    this.root.add(g);
    this.synced.push({ m: k, update: (t) => (mat.emissiveIntensity = 0.05 + this.lampLevel(k, t) * 4 + k.hitFlash * 4) });
  }

  private buildPortal(p: Portal) {
    const g = new THREE.Group();
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14 + i * 0.05, 0.012, 6, 48, Math.PI * 1.4), this.mats.glow(i % 2 ? this.theme.accent : this.theme.accent2, 2.4));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02 + i * 0.01;
      g.add(ring);
      rings.push(ring);
    }
    g.position.set(wx(p.x), 0, wz(p.y));
    this.root.add(g);
    const exit = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.01, 6, 40), this.mats.glow(this.theme.accent, 1.2));
    exit.rotation.x = Math.PI / 2;
    exit.position.set(wx(p.exitX), 0.01, wz(p.exitY));
    this.root.add(exit);
    this.synced.push({
      m: p,
      update: (t) => rings.forEach((r, i) => (r.rotation.z = this.opts.reducedMotion ? i : t * (1 + i) * (i % 2 ? -1 : 1))),
    });
  }

  private buildPlunger(p: Plunger) {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 16), this.mats.chrome());
    rod.rotation.x = Math.PI / 2;
    rod.position.set(0, 0.14, 0.45);
    const tip = new THREE.Mesh(new THREE.BoxGeometry((p.laneHalf * 2 - 8) * K, 0.16, 0.08), this.mats.plastic(this.theme.accent2));
    tip.position.y = 0.12;
    const spring = new THREE.Mesh(this.springGeo(0.4), this.mats.chrome());
    spring.position.set(0, 0.14, 0.05);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), this.mats.plastic(this.theme.accent));
    knob.position.set(0, 0.14, 0.95);
    g.add(rod, tip, spring, knob);
    this.root.add(g);
    this.synced.push({
      m: p,
      update: () => {
        const y = p.tipY - p.fire * 10;
        g.position.set(wx(p.x), 0, wz(y));
        spring.scale.z = 1 - p.pull * 0.6;
      },
    });
  }

  private springGeo(len: number): THREE.BufferGeometry {
    const pts: THREE.Vector3[] = [];
    const turns = 9;
    for (let i = 0; i <= turns * 16; i++) {
      const a = (i / 16) * TAU;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.07, Math.sin(a) * 0.07, (i / (turns * 16)) * len));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.009, 6, false);
  }

  // ------------------------------------------------------------------ per frame

  /** Elevation (world) of a ball given its ramp state. */
  ballHeight(rampId: string | null, x: number, y: number): number {
    if (!rampId) return 0;
    const r = this.ramps.get(rampId);
    if (!r) return 0;
    return wy(r.heightAt(r.project(x, y)));
  }

  update(t: number, dt: number) {
    for (const { f, g } of this.flippers) g.rotation.y = -f.angle;
    for (const s of this.synced) s.update(t, dt);
  }

  dispose() {
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.mats.dispose();
    this.printTex.dispose();
  }
}

function rgbaToHex(rgba: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgba);
  if (!m) return '#88ccff';
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

export { BALL_R };
