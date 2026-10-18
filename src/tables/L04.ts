// Lesson 4 — Capturing the Sun's Energy — "Sunbeam Conservatory"
// A dark glasshouse at night that fills with living light. Three S-U-N sunbeam lanes, a
// chloroplast bumper cluster, a carbon-dioxide drop bank, the Water Channel ramp and the
// Leaf Lane spinner all feed one leaf: the Leaf Pocket. Two Ingenhousz jar targets (LIGHT and
// DARK) stage the classic light-and-dark experiment. Sunlight is energy, not matter: the
// matter comes from carbon dioxide and water.

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { SetBuilder, RoomBuilder, SetKit } from '../game/render3d/setKit.ts';
import {
  TAU, branch, glowDot, leafShape, mix, neonPath, neonText, rgba, rng, stage, vgrad, drift, rrect,
} from '../game/render/art.ts';

const NIGHT = '#0b2420';
const MOSS = '#10261f';
const GOLD = '#FFC75B';
const SUN = '#FFD86E';
const CORAL = '#FF7F86';
const MINT = '#71E3CF';
const LEAF = '#8FD86A';
const LEAF_DEEP = '#1f6b3f';
const WATER = '#5FC4FF';
const IVORY = '#FFF7E7';

// Key playfield landmarks (table units), shared by the geometry and the printed art.
const POCKET: [number, number] = [286, 452];
const LANE_X = [260, 310, 360];
const RAMP_PATH: [number, number][] = [[392, 650], [400, 560], [414, 460], [432, 380], [456, 326], [494, 306], [522, 330], [528, 400], [527, 520], [522, 650], [508, 740], [489, 806]];

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'left' });

  // --- S-U-N sunbeam lanes: guides fan slightly, like rays converging on the leaf ---
  const guides: [number, number, number, number][] = [[230, 104, 238, 166], [284, 100, 286, 166], [336, 100, 334, 166], [390, 104, 382, 166]];
  for (const [x0, y0, x1, y1] of guides) {
    b.wall([[x0, y0], [x1, y1]], { r: 3 });
    b.post(x0, y0 - 2, 5);
  }
  ['S', 'U', 'N'].forEach((l, i) => b.rollover(`sun_${i + 1}`, LANE_X[i], 140, { group: 'sun', label: l }));

  // --- Chloroplast cluster: three pop bumpers in the upper left (chlorophyll catches light) ---
  b.bumper('chloro_1', 130, 262, { group: 'chloro', icon: 'chloroplast', r: 24 });
  b.bumper('chloro_2', 205, 200, { group: 'chloro', icon: 'chloroplast', r: 24 });
  b.bumper('chloro_3', 215, 312, { group: 'chloro', icon: 'chloroplast', r: 24 });

  // --- Leaf Lane: left orbit with a flared mouth, the leaf spinner and an exit deflector ---
  b.wall([[80, 380], [80, 566], [118, 640]], { id: 'leaf_lane_inner', r: 3 });
  b.post(80, 376, 5);
  b.post(118, 642, 5);
  b.spinner('leaf_spinner', [27, 520], [77, 520], { label: 'LEAF SPINNER' });
  b.shotSwitch('leaf_lane_sw', 52, 440, -90);
  // One-way gate, not a wall: balls coming down the lane are still deflected into play, but the
  // left kickback can fire up through it (a wall here blocked two kickbacks in three).
  b.gate('leaf_lane_deflect', [FRAME.left, 654], [56, 700], -90);

  // --- Right return channel deflector (balls from the arch drop to the right inlane) ---
  b.wall([[FRAME.laneSep, 646], [518, 694]], { id: 'right_deflect', r: 3 });

  // --- Carbon-dioxide drop bank (angled toward the flippers) with a close backstop ---
  b.dropBank('co2_bank', 150, 470, -60, 3, { size: 26, gap: 6, group: 'co2', labels: ['CO₂', 'CO₂', 'CO₂'] });
  b.wall([[137.3, 471.9], [190.3, 380]], { id: 'co2_backstop', r: 3 });

  // --- Leaf Wonder Pocket in a leaf-shaped cup (wide mouth, saucer near the leaf tip) ---
  b.curve([[246, 518], [247, 472], [259, 437], [286, 412]], { r: 4, id: 'leaf_cup_l' });
  b.curve([[326, 518], [325, 472], [313, 437], [286, 412]], { r: 4, id: 'leaf_cup_r' });
  b.saucer('leaf_pocket', POCKET[0], POCKET[1], { role: 'pocket', ejectDeg: 104, ejectSpeed: 720, label: 'LEAF POCKET', icon: 'leaf' });

  // --- Water Channel ramp: climbs the right-center, hairpins, returns to the right inlane ---
  b.wall([[375, 652], [352, 706]], { r: 3, id: 'water_flare_l' });
  b.wall([[409, 652], [440, 704]], { r: 3, id: 'water_flare_r' });
  b.ramp('water_ramp', { path: RAMP_PATH, width: 34, footprintTo: 4, label: 'WATER CHANNEL' });

  // --- Ingenhousz jar targets: LIGHT on the sunny lane wall, DARK in the ramp's shade ---
  b.target('jar_light', [88, 546], [88, 500], { group: 'jars', label: 'LIGHT' });
  b.target('jar_dark', [372, 566], [380, 524], { group: 'jars', label: 'DARK' });

  // --- Inserts that preview shots ---
  b.insert('ins_leaf_lane', 60, 600, { deg: -100, label: 'LEAF' });
  b.insert('ins_bank', 212, 512, { deg: -120, label: 'CO₂' });
  b.insert('ins_pocket', 286, 548, { deg: -90 });
  b.insert('ins_ramp', 394, 734, { deg: -92, label: 'WATER' });
  b.insert('ins_sun', 310, 198, { shape: 'star', size: 12 });
  b.insert('ins_chloro', 180, 262, { shape: 'star', size: 10 });
}

// ---------------------------------------------------------------- 3D helpers (three via kit)

type V3 = [number, number, number];

interface LeafSpec {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: number;
  /** Level at which this leaf unfurls (< 0 = always present). */
  born: number;
}

/** A soft leaf: pointed oval in XY (base at origin, tip at +Y), folded along the midrib. */
function leafGeometry(kit: SetKit, len = 1, wid = 0.36): THREE.BufferGeometry {
  const T = kit.THREE;
  const s = new T.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(wid * 1.1, len * 0.18, wid * 0.9, len * 0.72, 0, len);
  s.bezierCurveTo(-wid * 0.9, len * 0.72, -wid * 1.1, len * 0.18, 0, 0);
  const g = new T.ShapeGeometry(s, 10);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, Math.abs(x) * 0.45 - (y / len) * (y / len) * len * 0.22);
    uv.setXY(i, x / (2 * wid) + 0.5, y / len);
  }
  g.computeVertexNormals();
  return g;
}

/** Vein texture used as map + emissiveMap so the veins glow brighter than the blade. */
function leafTexture(kit: SetKit): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, '#5a5a5a');
  g.addColorStop(0.5, '#9a9a9a');
  g.addColorStop(1, '#5a5a5a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(64, 256);
  ctx.lineTo(64, 6);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  for (let i = 1; i < 9; i++) {
    const y = 256 - i * 27;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.quadraticCurveTo(64 + sx * 28, y - 14, 64 + sx * 54, y - 34);
      ctx.stroke();
    }
  }
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** Soft radial glow sprite texture. */
function glowTexture(kit: SetKit, inner: string, outer: string): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** Orientation for a leaf pointing along `dir` with its face toward `normal`. */
function leafQuat(kit: SetKit, dir: THREE.Vector3, normal: THREE.Vector3): THREE.Quaternion {
  const T = kit.THREE;
  const y = dir.clone().normalize();
  const z = normal.clone().sub(y.clone().multiplyScalar(normal.dot(y))).normalize();
  const x = new T.Vector3().crossVectors(y, z);
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
}

/** Instanced leaves that unfurl (scale in) as the attraction awakens. */
function leafField(kit: SetKit, geo: THREE.BufferGeometry, mat: THREE.Material, specs: LeafSpec[], parent?: THREE.Object3D) {
  const T = kit.THREE;
  const mesh = new T.InstancedMesh(geo, mat, Math.max(1, specs.length));
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const m4 = new T.Matrix4();
  const sc = new T.Vector3();
  let last = -99;
  const apply = (level: number) => {
    specs.forEach((sp, i) => {
      const g = sp.born < 0 ? 1 : kit.stage(level, sp.born, sp.born + 0.7);
      const k = sp.s * Math.max(0.0005, g);
      sc.set(k, k, k);
      m4.compose(sp.p, sp.q, sc);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  apply(0);
  if (parent) parent.add(mesh);
  else kit.add(mesh);
  return {
    mesh,
    update(level: number) {
      if (Math.abs(level - last) < 0.004) return;
      last = level;
      apply(level);
    },
  };
}

/** A tree fern: tapered trunk with arching fronds of leaflets (instanced). */
function treeFern(kit: SetKit, base: V3, height: number, fronds: number, born: number[], seed: number, leafGeo: THREE.BufferGeometry, mat: THREE.Material) {
  const T = kit.THREE;
  const g = new T.Group();
  g.position.set(base[0], base[1], base[2]);
  kit.add(g);
  const trunk = new T.Mesh(new T.CylinderGeometry(0.09, 0.16, height, 10), kit.mats.plastic('#3a2a1e'));
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const r = rng(seed);
  const up = new T.Vector3(0, 1, 0);
  const specs: LeafSpec[] = [];
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + r() * 0.4;
    const L = 1.5 + r() * 0.6;
    const rise = 0.55 + r() * 0.3;
    const droop = 0.9 + r() * 0.3;
    const at = (u: number) => new T.Vector3(Math.cos(a) * L * u, height + rise * u - droop * u * u, Math.sin(a) * L * u);
    for (let k = 1; k <= 9; k++) {
      const u = k / 10;
      const p = at(u);
      const tan = at(u + 0.02).sub(p).normalize();
      const side = new T.Vector3().crossVectors(tan, up).normalize();
      for (const sgn of [-1, 1]) {
        const dir = side.clone().multiplyScalar(sgn).addScaledVector(tan, 0.55).normalize();
        specs.push({ p, q: leafQuat(kit, dir, up), s: 0.42 * (1 - 0.55 * u) + 0.08, born: born[f % born.length] });
      }
    }
  }
  const field = leafField(kit, leafGeo, mat, specs, g);
  return { group: g, field };
}

/** A broad-leaf plant: big leaves on long stalks fanning out of a pot. */
function broadPlant(kit: SetKit, base: V3, count: number, size: number, born: (i: number) => number, seed: number, leafGeo: THREE.BufferGeometry, mat: THREE.Material) {
  const T = kit.THREE;
  const g = new T.Group();
  g.position.set(base[0], base[1], base[2]);
  kit.add(g);
  const r = rng(seed);
  const specs: LeafSpec[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + r() * 0.5;
    const h = size * (0.5 + r() * 1.0);
    const out = size * (0.15 + r() * 0.4);
    const p = new T.Vector3(Math.cos(a) * out, h, Math.sin(a) * out);
    const dir = new T.Vector3(Math.cos(a), 0.55 + r() * 0.5, Math.sin(a)).normalize();
    const nrm = new T.Vector3(-Math.cos(a) * 0.4, 1, -Math.sin(a) * 0.4);
    specs.push({ p, q: leafQuat(kit, dir, nrm), s: size * (0.75 + r() * 0.45), born: born(i) });
  }
  const field = leafField(kit, leafGeo, mat, specs, g);
  // Stalks from the pot to each leaf; they grow with their leaf.
  const stalkGeo = new T.CylinderGeometry(0.5, 0.7, 1, 5).translate(0, 0.5, 0);
  const stalks = new T.InstancedMesh(stalkGeo, stalkMat(kit), Math.max(1, specs.length));
  stalks.frustumCulled = false;
  g.add(stalks);
  const m4 = new T.Matrix4();
  const q = new T.Quaternion();
  const sc = new T.Vector3();
  const yUp = new T.Vector3(0, 1, 0);
  const dir = new T.Vector3();
  const origin = new T.Vector3();
  let last = -99;
  const grow = (level: number) => {
    if (Math.abs(level - last) < 0.004) return;
    last = level;
    field.update(level);
    specs.forEach((sp, i) => {
      const k = sp.born < 0 ? 1 : Math.max(0.0005, kit.stage(level, sp.born, sp.born + 0.7));
      dir.copy(sp.p).sub(origin);
      const len = dir.length() * Math.min(1, 0.25 + k);
      q.setFromUnitVectors(yUp, dir.normalize());
      const w = 0.016 * size * 2.2 * (k > 0.01 ? 1 : 0);
      m4.compose(origin, q, sc.set(w, len, w));
      stalks.setMatrixAt(i, m4);
    });
    stalks.instanceMatrix.needsUpdate = true;
  };
  grow(0);
  return { group: g, field: { mesh: field.mesh, update: grow } };
}

const stalkMats = new WeakMap<SetKit, THREE.Material>();
function stalkMat(kit: SetKit): THREE.Material {
  let m = stalkMats.get(kit);
  if (!m) {
    m = kit.track(new kit.THREE.MeshStandardMaterial({ color: '#2f5a32', emissive: '#3fae5a', emissiveIntensity: 0.15, roughness: 0.7 }));
    stalkMats.set(kit, m);
  }
  return m;
}

/** Instanced boxes from [x, y, z, sx, sy, sz, rotY]. */
function boxes(kit: SetKit, mat: THREE.Material, list: number[][]): THREE.InstancedMesh {
  const T = kit.THREE;
  const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), mat, list.length);
  const m4 = new T.Matrix4();
  const q = new T.Quaternion();
  const e = new T.Euler();
  for (let i = 0; i < list.length; i++) {
    const [x, y, z, sx, sy, sz, ry = 0] = list[i];
    q.setFromEuler(e.set(0, ry, 0));
    m4.compose(new T.Vector3(x, y, z), q, new T.Vector3(sx, sy, sz));
    mesh.setMatrixAt(i, m4);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return kit.add(mesh);
}

/** Additive plane with a vertical fade (light shafts, waterfalls). */
function fadeTexture(kit: SetKit, stops: [number, string][], stripes = 0): THREE.CanvasTexture {
  const T = kit.THREE;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  // soft side falloff
  const h = ctx.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.3, 'rgba(0,0,0,0)');
  h.addColorStop(0.7, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 64, 256);
  ctx.globalCompositeOperation = 'source-over';
  if (stripes) {
    const r = rng(stripes);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`;
      ctx.fillRect(8 + r() * 48, r() * 256, 1.5 + r() * 2, 20 + r() * 50);
    }
  }
  const t = kit.track(new T.CanvasTexture(c));
  t.colorSpace = T.SRGBColorSpace;
  t.wrapT = T.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------- 3D attraction set

const conservatorySet: SetBuilder = (kit) => {
  const T = kit.THREE;
  const GY = kit.regions.groundY;
  kit.sky('#123a36', '#020807');

  // --- Greenhouse floor: dark slate tiles with moss in the grout ---
  {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    const r = rng(41);
    ctx.fillStyle = '#04100c';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const sh = 0.8 + r() * 0.35;
        ctx.fillStyle = `rgb(${Math.round(22 * sh)},${Math.round(40 * sh)},${Math.round(36 * sh)})`;
        ctx.fillRect(i * 128 + 4, j * 128 + 4, 120, 120);
        for (let k = 0; k < 10; k++) {
          ctx.fillStyle = `rgba(80,140,90,${0.08 + r() * 0.12})`;
          ctx.beginPath();
          ctx.arc(i * 128 + (r() < 0.5 ? 4 : 124), j * 128 + r() * 128, 2 + r() * 4, 0, TAU);
          ctx.fill();
        }
      }
    }
    const tex = kit.track(new T.CanvasTexture(c));
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.anisotropy = 8;
    const mat = kit.track(new T.MeshPhysicalMaterial({ map: tex, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
    const floor = new T.Mesh(new T.CircleGeometry(28, 64).rotateX(-Math.PI / 2), mat);
    floor.position.y = GY;
    floor.receiveShadow = true;
    kit.add(floor);
  }

  // --- Shared materials ---
  const leafTex = leafTexture(kit);
  const leafGeo = leafGeometry(kit);
  const leafMat = kit.track(new T.MeshStandardMaterial({ color: '#2f7d4a', map: leafTex, emissive: '#3fe08a', emissiveMap: leafTex, emissiveIntensity: 0.06, roughness: 0.55, side: T.DoubleSide }));
  const sunLeafMat = kit.track(new T.MeshStandardMaterial({ color: '#5f8f2a', map: leafTex, emissive: '#d9f56a', emissiveMap: leafTex, emissiveIntensity: 0.04, roughness: 0.5, side: T.DoubleSide }));
  const canopyMat = kit.track(new T.MeshStandardMaterial({ color: '#1d5a3a', map: leafTex, emissive: MINT, emissiveMap: leafTex, emissiveIntensity: 0.0, roughness: 0.5, side: T.DoubleSide, transparent: true, opacity: 0.95 }));
  const ironMat = kit.mats.paintedMetal('#6f9a88');
  const stoneMat = kit.track(new T.MeshStandardMaterial({ color: '#3b4a46', roughness: 0.85 }));
  const potMat = kit.mats.plastic('#a8583a');
  const woodMat = kit.track(new T.MeshStandardMaterial({ color: '#5a3a26', roughness: 0.82, metalness: 0 }));
  const glassMat = kit.track(new T.MeshPhysicalMaterial({ color: '#d8fff2', roughness: 0.3, transparent: true, opacity: 0.22, clearcoat: 0.3, side: T.DoubleSide, depthWrite: false }));

  // --- Glasshouse: curved iron ribs and glass roofs on both sides (never over the table) ---
  const profile = new T.CatmullRomCurve3([
    new T.Vector3(-8.9, GY, 0), new T.Vector3(-8.75, 1.5, 0), new T.Vector3(-8.1, 2.85, 0),
    new T.Vector3(-6.6, 3.65, 0), new T.Vector3(-4.6, 3.9, 0),
  ]);
  const ribGeo = new T.TubeGeometry(profile, 40, 0.05, 6, false);
  const ribZ = [-6.2, -3.6, -1.0, 1.6, 4.2];
  const ribs = new T.InstancedMesh(ribGeo, ironMat, ribZ.length * 2);
  {
    const m4 = new T.Matrix4();
    const q = new T.Quaternion();
    let i = 0;
    for (const side of [-1, 1]) {
      q.setFromAxisAngle(new T.Vector3(0, 1, 0), side < 0 ? 0 : Math.PI);
      for (const z of ribZ) {
        m4.compose(new T.Vector3(0, 0, z), q, new T.Vector3(1, 1, 1));
        ribs.setMatrixAt(i++, m4);
      }
    }
    ribs.castShadow = true;
    kit.add(ribs);
  }
  // Purlins running along each glass roof.
  {
    const pts = profile.getPoints(4);
    const purlinGeo = new T.CylinderGeometry(0.03, 0.03, 1, 6).rotateX(Math.PI / 2);
    const len = ribZ[ribZ.length - 1] - ribZ[0];
    const zc = (ribZ[0] + ribZ[ribZ.length - 1]) / 2;
    const purl = new T.InstancedMesh(purlinGeo, ironMat, 8);
    const m4 = new T.Matrix4();
    const one = new T.Quaternion();
    const scl = new T.Vector3(1, 1, len);
    let i = 0;
    for (const side of [-1, 1]) {
      for (const k of [1, 2, 3, 4]) {
        // The profile is drawn on the left (negative x); the right side mirrors it.
        m4.compose(new T.Vector3(side < 0 ? pts[k].x : -pts[k].x, pts[k].y, zc), one, scl);
        purl.setMatrixAt(i++, m4);
      }
    }
    kit.add(purl);
  }
  // Glass roof sheets swept along the ribs (faint, catches dawn light by level).
  const glassGlow = kit.track(new T.MeshPhysicalMaterial({ color: '#bff5e4', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.07, emissive: GOLD, emissiveIntensity: 0, side: T.DoubleSide, depthWrite: false, clearcoat: 1 }));
  for (const side of [-1, 1]) {
    const prof = profile.getPoints(14);
    const nz = 6;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= nz; j++) {
      const z = ribZ[0] + ((ribZ[ribZ.length - 1] - ribZ[0]) * j) / nz;
      for (const p of prof) pos.push(side < 0 ? p.x : -p.x, p.y, z);
    }
    const w = prof.length;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i;
        idx.push(a, a + 1, a + w, a + 1, a + w + 1, a + w);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const sheet = new T.Mesh(g, glassGlow);
    sheet.renderOrder = 2;
    kit.add(sheet);
  }

  // --- Sunrise in the top-left corner: the sun climbs over a hedge as missions complete ---
  const SUN_POS: V3 = [-6.7, 1.0, -5.7];
  const sun = kit.orb(SUN_POS, 0.55, SUN);
  const sunHalo = new T.Sprite(kit.track(new T.SpriteMaterial({ map: glowTexture(kit, 'rgba(255,240,190,1)', 'rgba(255,190,80,0.45)'), color: '#ffffff', transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false })));
  sunHalo.scale.set(4.2, 4.2, 1);
  kit.add(sunHalo);
  const rayTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.translate(128, 128);
    for (let i = 0; i < 24; i++) {
      ctx.rotate(TAU / 24);
      const g = ctx.createLinearGradient(0, 0, 0, -128);
      g.addColorStop(0, 'rgba(255,220,140,0.9)');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-3 - (i % 2) * 3, 0);
      ctx.lineTo(0, -128 + (i % 2) * 34);
      ctx.lineTo(3 + (i % 2) * 3, 0);
      ctx.fill();
    }
    const t = kit.track(new T.CanvasTexture(c));
    t.colorSpace = T.SRGBColorSpace;
    return t;
  })();
  const rayMat = kit.track(new T.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
  const rays = new T.Mesh(new T.PlaneGeometry(5.2, 5.2), rayMat);
  rays.rotation.x = -0.6;
  kit.add(rays);
  // Hedge planter the sun rises behind.
  boxes(kit, stoneMat, [[-6.5, GY + 0.36, -4.9, 3.0, 0.72, 0.7, 0.12]]);
  const hedge = broadPlant(kit, [-6.5, GY + 0.62, -4.9], 18, 0.55, (i) => (i < 10 ? -1 : 0.3 + i * 0.12), 7, leafGeo, leafMat);
  hedge.group.scale.set(2.4, 0.9, 0.7);
  hedge.group.rotation.y = 0.12;

  // --- Light shafts through the glass (left side only, never over the cabinet) ---
  const shaftTex = fadeTexture(kit, [[0, 'rgba(255,226,150,0.95)'], [0.6, 'rgba(255,226,150,0.35)'], [1, 'rgba(255,226,150,0)']]);
  const shaftMat = kit.track(new T.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const shafts: THREE.Mesh[] = [];
  for (const [x, z, w, tilt] of [[-6.2, -3.6, 1.1, 0.32], [-7.2, -1.2, 0.8, 0.36], [-5.9, 1.4, 0.9, 0.28]] as number[][]) {
    const m = new T.Mesh(new T.PlaneGeometry(w, 5.2), shaftMat);
    m.position.set(x, 1.9, z);
    m.rotation.set(-0.5, 0.35, tilt);
    shafts.push(kit.add(m));
  }

  // --- Plants: tree ferns and broad-leaf plants that unfurl by level ---
  const plants = [
    treeFern(kit, [-8.0, GY, -2.3], 2.1, 9, [-1, -1, 0.5, -1, 1.4, -1, 2.4, 3.3, 3.7], 3, leafGeo, leafMat),
    treeFern(kit, [7.4, GY, -4.4], 2.4, 9, [-1, 0.8, -1, 1.8, -1, 2.8, -1, 3.5, 3.8], 5, leafGeo, leafMat),
    broadPlant(kit, [-6.9, GY + 0.62, 2.6], 9, 0.9, (i) => (i < 3 ? -1 : 0.4 + i * 0.4), 11, leafGeo, sunLeafMat),
    broadPlant(kit, [-4.8, GY + 0.5, 4.0], 7, 0.7, (i) => (i < 2 ? -1 : 0.8 + i * 0.45), 13, leafGeo, leafMat),
    broadPlant(kit, [7.2, GY + 0.62, 3.4], 9, 0.9, (i) => (i < 3 ? -1 : 0.6 + i * 0.38), 17, leafGeo, sunLeafMat),
    broadPlant(kit, [4.7, GY + 0.5, 4.6], 6, 0.6, (i) => (i < 2 ? -1 : 1 + i * 0.5), 19, leafGeo, leafMat),
  ];
  // Terracotta pots for the broad-leaf plants.
  {
    const potGeo = new T.CylinderGeometry(0.42, 0.3, 0.64, 18);
    const pots = new T.InstancedMesh(potGeo, potMat, 4);
    const m4 = new T.Matrix4();
    [[-6.9, 2.6, 1], [-4.8, 4.0, 0.8], [7.2, 3.4, 1], [4.7, 4.6, 0.75]].forEach(([x, z, s], i) => {
      m4.compose(new T.Vector3(x, GY + 0.32 * s, z), new T.Quaternion(), new T.Vector3(s, s, s));
      pots.setMatrixAt(i, m4);
    });
    pots.castShadow = true;
    kit.add(pots);
  }

  // --- Ingenhousz's jar bench (left): leaves in jars of water; the LIGHT jar bubbles, the
  // DARK jar stays still. Bubbles only form on leaves under water, so both jars hold water.
  const BENCH = { x: -5.05, z: 0.05, rot: 0.3 };
  const bc = Math.cos(BENCH.rot);
  const bs = Math.sin(BENCH.rot);
  /** Bench-local (lx along the bench, lz toward its front) to world [x, z]. */
  const onBench = (lx: number, lz: number): [number, number] => [BENCH.x + lx * bc + lz * bs, BENCH.z - lx * bs + lz * bc];
  const benchList: number[][] = [[BENCH.x, GY + 0.86, BENCH.z, 2.1, 0.08, 0.8, BENCH.rot]];
  for (const [lx, lz] of [[-0.95, -0.32], [0.95, -0.32], [-0.95, 0.32], [0.95, 0.32]]) {
    const [x, z] = onBench(lx, lz);
    benchList.push([x, GY + 0.42, z, 0.08, 0.84, 0.08, BENCH.rot]);
  }
  boxes(kit, woodMat, benchList);
  const [jlx, jlz] = onBench(-0.5, 0.02);
  const [jdx, jdz] = onBench(0.52, -0.06);
  const jarGeo = (() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) pts.push(new T.Vector2(0.3, i * 0.06));
    for (let i = 1; i <= 8; i++) {
      const a = (i / 8) * (Math.PI / 2);
      pts.push(new T.Vector2(Math.cos(a) * 0.3, 0.6 + Math.sin(a) * 0.3));
    }
    return new T.LatheGeometry(pts, 28);
  })();
  const darkGlass = kit.track(new T.MeshPhysicalMaterial({ color: '#4a4470', roughness: 0.3, transparent: true, opacity: 0.32, clearcoat: 0.3, side: T.DoubleSide, depthWrite: false }));
  const jarL = new T.Mesh(jarGeo, glassMat);
  jarL.position.set(jlx, GY + 0.9, jlz);
  const jarD = new T.Mesh(jarGeo, darkGlass);
  jarD.position.set(jdx, GY + 0.9, jdz);
  kit.add(jarL);
  kit.add(jarD);
  // Water inside both jars (the leaves sit under it).
  const jarWaterMat = kit.track(new T.MeshPhysicalMaterial({ color: '#7fd4ff', roughness: 0.1, transparent: true, opacity: 0.3, emissive: '#2a9fe0', emissiveIntensity: 0.1, depthWrite: false }));
  const jarWaterGeo = new T.CylinderGeometry(0.27, 0.27, 0.56, 24);
  for (const [x, z] of [[jlx, jlz], [jdx, jdz]]) {
    const w = new T.Mesh(jarWaterGeo, jarWaterMat);
    w.position.set(x, GY + 1.2, z);
    w.renderOrder = 1;
    kit.add(w);
  }
  const sprigs = [
    broadPlant(kit, [jlx, GY + 0.92, jlz], 6, 0.24, () => -1, 23, leafGeo, sunLeafMat),
    broadPlant(kit, [jdx, GY + 0.92, jdz], 6, 0.24, () => -1, 29, leafGeo, leafMat),
  ];
  const bubbles = kit.motes({ x0: jlx - 0.16, x1: jlx + 0.16, y0: GY + 1.0, y1: GY + 1.45, z0: jlz - 0.14, z1: jlz + 0.14 }, 26, '#e9fffb', { speed: 0.22, size: 0.09 });
  // Name plaques hang on the bench's front apron, in front of the legs.
  const [plx, plz] = onBench(-0.5, 0.46);
  const [pdx, pdz] = onBench(0.52, 0.46);
  const lightPlaque = kit.panel('LIGHT', [plx, GY + 0.76, plz], { w: 0.7, h: 0.24, bg: GOLD, rotY: BENCH.rot });
  const darkPlaque = kit.panel('DARK', [pdx, GY + 0.76, pdz], { w: 0.7, h: 0.24, bg: '#3a3456', fg: IVORY, rotY: BENCH.rot });
  lightPlaque.rotation.x = -0.25;
  darkPlaque.rotation.x = -0.25;

  // --- Water Channel aqueduct and pool (right) ---
  const poolC: V3 = [6.4, GY, 0.9];
  boxes(kit, stoneMat, [
    [poolC[0], GY + 0.16, poolC[2] - 1.15, 2.9, 0.32, 0.22], [poolC[0], GY + 0.16, poolC[2] + 1.15, 2.9, 0.32, 0.22],
    [poolC[0] - 1.4, GY + 0.16, poolC[2], 0.22, 0.32, 2.5], [poolC[0] + 1.4, GY + 0.16, poolC[2], 0.22, 0.32, 2.5],
    // aqueduct piers
    [7.55, GY + 0.75, -2.6, 0.32, 1.5, 0.32], [7.05, GY + 0.55, -1.35, 0.3, 1.1, 0.3],
  ]);
  const pool = kit.water([poolC[0], GY + 0.22, poolC[2]], 2.6, 2.1, '#15496e');
  const poolMat = pool.material as THREE.MeshPhysicalMaterial;
  poolMat.emissive.set('#2aa6e8');
  // Trough: a tilted channel from the back toward the pool, with flowing water inside.
  const troughA = new T.Vector3(7.75, GY + 1.75, -3.9);
  const troughB = new T.Vector3(6.75, GY + 0.95, -0.55);
  const tLen = troughA.distanceTo(troughB);
  const trough = new T.Group();
  trough.position.copy(troughA).add(troughB).multiplyScalar(0.5);
  trough.lookAt(troughB);
  kit.add(trough);
  for (const [x, y, w, h] of [[0, -0.09, 0.42, 0.05], [-0.2, 0, 0.05, 0.22], [0.2, 0, 0.05, 0.22]]) {
    const piece = new T.Mesh(new T.BoxGeometry(w, h, tLen), stoneMat);
    piece.position.set(x, y, 0);
    piece.castShadow = true;
    trough.add(piece);
  }
  const flowTex = fadeTexture(kit, [[0, 'rgba(120,210,255,0.9)'], [1, 'rgba(120,210,255,0.9)']], 7);
  flowTex.repeat.set(1, 3);
  const flowMat = kit.track(new T.MeshBasicMaterial({ map: flowTex, color: '#9fe0ff', transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }));
  const flow = new T.Mesh(new T.PlaneGeometry(0.34, tLen), flowMat);
  flow.rotation.x = -Math.PI / 2;
  flow.position.y = -0.04;
  trough.add(flow);
  const fallTex = fadeTexture(kit, [[0, 'rgba(160,225,255,0.95)'], [1, 'rgba(160,225,255,0.15)']], 9);
  const fallMat = kit.track(new T.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const fall = new T.Mesh(new T.PlaneGeometry(0.34, 0.8), fallMat);
  fall.position.set(troughB.x - 0.05, troughB.y - 0.45, troughB.z + 0.1);
  fall.rotation.y = -0.45;
  kit.add(fall);
  const spray = kit.motes({ x0: 5.4, x1: 7.4, y0: GY + 0.25, y1: GY + 1.4, z0: 0.0, z1: 1.8 }, 40, '#c8f3ff', { speed: 0.22, size: 0.09 });

  // --- Molecule models (right front): CO₂ + H₂O → sugar + O₂, ball-and-stick ---
  // Atoms are placed in local molecule frames; the models turn slowly on a brass plinth.
  type Atom = [number, number, number, 'C' | 'O' | 'H'];
  const sugarRing: Atom[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 6;
    sugarRing.push([Math.cos(a) * 0.2, 0.05 * (i % 2 ? 1 : -1), Math.sin(a) * 0.2, i === 0 ? 'O' : 'C']);
  }
  const mols: { c: V3; atoms: Atom[]; bonds: [number, number][]; born: number }[] = [
    { c: [4.3, 0.95, 2.33], atoms: [[0, 0, 0, 'C'], [-0.24, 0, 0, 'O'], [0.24, 0, 0, 'O']], bonds: [[0, 1], [0, 2]], born: -1 },
    { c: [4.92, 0.95, 2.56], atoms: [[0, 0, 0, 'O'], [-0.15, -0.12, 0, 'H'], [0.15, -0.12, 0, 'H']], bonds: [[0, 1], [0, 2]], born: -1 },
    { c: [5.63, 1.0, 2.82], atoms: sugarRing, bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]], born: 1.2 },
    { c: [6.29, 0.95, 3.06], atoms: [[-0.11, 0, 0, 'O'], [0.11, 0, 0, 'O']], bonds: [[0, 1]], born: 1.4 },
  ];
  const atomCol: Record<string, string> = { C: '#3c4248', O: '#ff6b6b', H: '#f4f1ea' };
  const atomR: Record<string, number> = { C: 0.085, O: 0.08, H: 0.055 };
  const nAtoms = mols.reduce((s, m) => s + m.atoms.length, 0);
  const nBonds = mols.reduce((s, m) => s + m.bonds.length, 0);
  const atomMat = kit.track(new T.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, clearcoat: 1, emissive: '#ffffff', emissiveIntensity: 0.02 }));
  const atomMesh = new T.InstancedMesh(new T.SphereGeometry(1, 18, 12), atomMat, nAtoms);
  const bondMesh = new T.InstancedMesh(new T.CylinderGeometry(0.018, 0.018, 1, 6), kit.mats.chrome(), nBonds);
  atomMesh.frustumCulled = false;
  bondMesh.frustumCulled = false;
  kit.add(atomMesh);
  kit.add(bondMesh);
  {
    let i = 0;
    const col = new T.Color();
    for (const m of mols) for (const a of m.atoms) atomMesh.setColorAt(i++, col.set(atomCol[a[3]]));
    if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true;
  }
  const mm = new T.Matrix4();
  const mq = new T.Quaternion();
  const mv = new T.Vector3();
  const mv2 = new T.Vector3();
  const ms = new T.Vector3();
  const yAxis = new T.Vector3(0, 1, 0);
  const local = new T.Vector3();
  // Allocation-free per frame: plain loops and scratch vectors only.
  let molCa = 1;
  let molSa = 0;
  let molK = 1;
  const atomWorld = (c: V3, a: Atom, out: THREE.Vector3) =>
    out.set(c[0] + (a[0] * molCa + a[2] * molSa) * molK, c[1] + a[1] * molK, c[2] + (-a[0] * molSa + a[2] * molCa) * molK);
  const placeMolecules = (t: number, level: number) => {
    let ai = 0;
    let bi = 0;
    for (let mi = 0; mi < mols.length; mi++) {
      const m = mols[mi];
      molK = Math.max(0.001, m.born < 0 ? 1 : kit.stage(level, m.born, m.born + 0.6));
      const ang = kit.reducedMotion ? 0.4 : t * 0.35 + mi;
      molCa = Math.cos(ang);
      molSa = Math.sin(ang);
      for (let j = 0; j < m.atoms.length; j++) {
        const a = m.atoms[j];
        atomWorld(m.c, a, mv);
        const r = atomR[a[3]] * molK;
        mm.compose(mv, mq.identity(), ms.set(r, r, r));
        atomMesh.setMatrixAt(ai++, mm);
      }
      for (let j = 0; j < m.bonds.length; j++) {
        atomWorld(m.c, m.atoms[m.bonds[j][0]], mv);
        atomWorld(m.c, m.atoms[m.bonds[j][1]], mv2);
        const len = mv.distanceTo(mv2);
        local.subVectors(mv2, mv).normalize();
        mq.setFromUnitVectors(yAxis, local);
        mv.add(mv2).multiplyScalar(0.5);
        mm.compose(mv, mq, ms.set(molK, len, molK));
        bondMesh.setMatrixAt(bi++, mm);
      }
    }
    atomMesh.instanceMatrix.needsUpdate = true;
    bondMesh.instanceMatrix.needsUpdate = true;
  };
  placeMolecules(0, 0);
  boxes(kit, kit.mats.brass(), [[5.3, GY + 0.58, 2.7, 2.8, 0.08, 0.6, -0.35]]);
  boxes(kit, woodMat, [[5.3, GY + 0.27, 2.7, 2.6, 0.54, 0.5, -0.35]]);
  // Equation plaque on the plinth front (lit term by term as missions complete).
  const eqCanvas = document.createElement('canvas');
  eqCanvas.width = 1024;
  eqCanvas.height = 160;
  const eqTex = kit.track(new T.CanvasTexture(eqCanvas));
  eqTex.colorSpace = T.SRGBColorSpace;
  const eqMat = kit.track(new T.MeshStandardMaterial({ color: '#0d1512', map: eqTex, emissive: '#ffffff', emissiveMap: eqTex, emissiveIntensity: 0.9, roughness: 0.4 }));
  const eq = new T.Mesh(new T.PlaneGeometry(2.5, 0.39), eqMat);
  eq.position.set(5.22, GY + 0.86, 3.12);
  eq.rotation.set(-0.7, -0.35, 0, 'YXZ');
  kit.add(eq);
  let eqKey = -1;
  const paintEq = (level: number) => {
    const key = Math.round(level * 4);
    if (key === eqKey) return;
    eqKey = key;
    const ctx = eqCanvas.getContext('2d')!;
    ctx.fillStyle = '#0a1210';
    ctx.fillRect(0, 0, 1024, 160);
    ctx.strokeStyle = rgba(GOLD, 0.7);
    ctx.lineWidth = 6;
    rrect(ctx, 6, 6, 1012, 148, 26);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = '700 30px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba(IVORY, 0.55 + 0.45 * stage(level, 0.2, 1));
    ctx.fillText('PHOTOSYNTHESIS', 512, 38);
    const parts: [string, string, number][] = [
      ['6CO₂', '#cfd8e0', 0.3], [' + ', IVORY, 0.3], ['6H₂O', WATER, 0.3], [' + ', IVORY, 0.3], ['light energy', SUN, 0.3],
      ['  →  ', IVORY, 1.3], ['C₆H₁₂O₆', LEAF, 1.3], [' + ', IVORY, 1.3], ['6O₂', CORAL, 1.3],
    ];
    // Fit the whole equation inside the plaque border (at 50 px it ran off both ends).
    ctx.font = '800 50px "Atkinson Hyperlegible Next", system-ui, sans-serif';
    const wide = parts.reduce((s, [txt]) => s + ctx.measureText(txt).width, 0);
    const px = Math.min(50, Math.floor((50 * 940) / wide));
    ctx.font = `800 ${px}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
    const total = parts.reduce((s, [txt]) => s + ctx.measureText(txt).width, 0);
    let x = 512 - total / 2;
    ctx.textAlign = 'left';
    for (const [txt, c, lo] of parts) {
      const lit = stage(level, lo, lo + 0.7);
      ctx.fillStyle = lit > 0.02 ? rgba(c, 0.35 + 0.65 * lit) : 'rgba(255,247,231,0.18)';
      ctx.fillText(txt, x, 104);
      x += ctx.measureText(txt).width;
    }
    eqTex.needsUpdate = true;
  };
  paintEq(0);

  // --- Neon signs: energy vs matter, and the attraction title ---
  const energySign = kit.neonSign('ENERGY: LIGHT', [-6.3, 2.05, -1.7], { height: 0.4, color: SUN, rotY: 0.36 });
  const matterSign = kit.neonSign('MATTER: CO₂ + H₂O', [6.3, 2.05, -1.7], { height: 0.4, color: WATER, rotY: -0.36 });
  const titleSign = kit.neonSign('SUNBEAM CONSERVATORY', [0, 0.5, -6.62], { height: 0.6, color: GOLD, backing: false });
  for (const s of [energySign, matterSign]) s.rotation.x = -0.6;
  titleSign.rotation.x = -0.95;

  // --- Lanterns and fairy lights ---
  kit.pole([-4.4, 0, 4.7], 2.3);
  kit.pole([4.4, 0, 4.7], 2.3);
  const lanternL = kit.lantern([-4.4, 2.0, 4.7], GOLD, 0.24);
  const lanternR = kit.lantern([4.4, 2.0, 4.7], MINT, 0.24);
  const fairyL = kit.stringLights([-4.75, 3.85, -6.2], [-4.75, 3.85, 4.2], 0.35, kit.n(13), [GOLD, '#b8f27a', MINT]);
  const fairyR = kit.stringLights([4.75, 3.85, -6.2], [4.75, 3.85, 4.2], 0.35, kit.n(13), [MINT, GOLD, '#b8f27a']);

  // --- Luminous canopy (level 4): glowing leaves hang along both glass roofs ---
  const canopySpecs: LeafSpec[] = [];
  {
    const r = rng(61);
    const down = new T.Vector3(0, -1, 0);
    for (const side of [-1, 1]) {
      for (let i = 0; i < kit.n(26); i++) {
        const u = 0.45 + r() * 0.55;
        const p = profile.getPoint(u);
        let z = ribZ[0] + r() * (ribZ[ribZ.length - 1] - ribZ[0]);
        // Keep the hanging leaves clear of the ENERGY / MATTER signs.
        if (z > -4.6 && z < 0.2) z = z < -2.2 ? z - 1.6 : z + 4.0;
        const pos = new T.Vector3(side < 0 ? p.x : -p.x, p.y - 0.05, z);
        const dir = new T.Vector3((r() - 0.5) * 0.8, -1, (r() - 0.5) * 0.8).normalize();
        const nrm = new T.Vector3(-side, 0.3, 0.6);
        canopySpecs.push({ p: pos, q: leafQuat(kit, dir.lerp(down, 0.3), nrm), s: 0.55 + r() * 0.5, born: 3.0 + r() * 0.9 });
      }
    }
  }
  const canopy = leafField(kit, leafGeo, canopyMat, canopySpecs);

  // --- Floating light: pollen motes (left) and fireflies (right); light blossoms at level 4 ---
  const pollen = kit.motes({ x0: -8.6, x1: -4.0, y0: 0, y1: 3.6, z0: -6.5, z1: 4.5 }, 70, GOLD, { speed: 0.1, size: 0.1 });
  const fireflies = kit.motes({ x0: 4.0, x1: 8.6, y0: 0.3, y1: 3.6, z0: -6.5, z1: 4.5 }, 60, '#c9ff8a', { speed: 0.08, size: 0.11 });
  const blossomsL = kit.fireworks({ x0: -8.4, x1: -6.3, y0: 2.6, y1: 3.4, z: -3.2 }, [GOLD, '#b8f27a', MINT, IVORY]);
  const blossomsR = kit.fireworks({ x0: 6.3, x1: 8.4, y0: 2.6, y1: 3.4, z: -2.4 }, [MINT, GOLD, '#b8f27a', CORAL]);

  // --- Lights (three max): sunrise key, water fill, molecule spot ---
  const sunSpot = kit.spot([-7.5, 6.5, -5.5], [-7.2, 0, -1.2], '#ffd27a', 10, 0.6);
  const waterSpot = kit.spot([7.5, 6, 2.5], [6.2, 0, 1.0], '#7fd8ff', 8, 0.5);
  const molLight = kit.point([5.3, 1.5, 3.0], '#fff2cc', 1, 3);

  let flowOff = 0;
  let bloom = 0;
  return {
    update(t, dt, level, energy) {
      const s1 = kit.stage(level, 0.2, 1);
      const s2 = kit.stage(level, 1.2, 2);
      const s3 = kit.stage(level, 2.2, 3);
      const s4 = kit.stage(level, 3.3, 4);
      const dawn = kit.stage(level, 0, 4);
      // The sun climbs over the hedge and brightens with every discovery.
      const sy = SUN_POS[1] + 0.75 * dawn;
      sun.position.y = sy;
      sunHalo.position.set(SUN_POS[0], sy, SUN_POS[2] + 0.1);
      rays.position.set(SUN_POS[0], sy, SUN_POS[2] - 0.2);
      sun.setLit(0.03 + 0.97 * kit.stage(level, 0.1, 2));
      (sunHalo.material as THREE.SpriteMaterial).opacity = 0.06 + 0.6 * dawn + 0.12 * energy;
      sunHalo.scale.setScalar(2.2 + 3.2 * dawn);
      rayMat.opacity = 0.5 * kit.stage(level, 1, 4);
      if (!kit.reducedMotion) rays.rotation.z = t * 0.04;
      shaftMat.opacity = 0.02 + 0.3 * s1 + 0.12 * s4;
      if (sunSpot) sunSpot.intensity = 3 + 30 * dawn;
      if (waterSpot) waterSpot.intensity = 5 + 22 * s1;
      if (molLight) molLight.intensity = 0.4 + 2.6 * s2 + 1.2 * s4;
      // Foliage grows and glows.
      for (let i = 0; i < plants.length; i++) plants[i].field.update(level);
      for (let i = 0; i < sprigs.length; i++) sprigs[i].field.update(level);
      hedge.field.update(level);
      canopy.update(level);
      leafMat.emissiveIntensity = 0.1 + 0.35 * s1 + 0.3 * s3 + 0.35 * s4 + 0.12 * energy;
      sunLeafMat.emissiveIntensity = 0.06 + 0.3 * s1 + 0.3 * s2 + 0.4 * s4;
      canopyMat.emissiveIntensity = 0.2 + 1.3 * s4;
      glassGlow.emissiveIntensity = 0.02 + 0.18 * s2 + 0.2 * s4;
      glassGlow.opacity = 0.06 + 0.06 * s4;
      // Water flows faster and brighter once water is brought in (mission 1).
      if (!kit.reducedMotion) flowOff -= dt * (0.25 + 0.9 * s1);
      flowTex.offset.y = flowOff;
      fallTex.offset.y = flowOff * 1.6;
      flowMat.opacity = 0.18 + 0.55 * s1;
      fallMat.opacity = 0.12 + 0.55 * s1;
      pool.level(0.6 + 0.4 * s1);
      poolMat.emissiveIntensity = 0.04 + 0.3 * s1 + 0.2 * s4;
      spray.setLit(0.1 + 0.6 * s1);
      // Jar test (mission 3): bubbles rise only in the LIGHT jar.
      bubbles.setLit(0.05 + 0.9 * s3);
      jarWaterMat.emissiveIntensity = 0.08 + 0.3 * s3;
      // Molecules: products assemble during the Atom Shuffle (mission 2).
      placeMolecules(t, level);
      atomMat.emissiveIntensity = 0.02 + 0.12 * s2;
      paintEq(level);
      energySign.setLit(0.2 + 0.8 * s1);
      matterSign.setLit(0.2 + 0.8 * s1);
      titleSign.setLit(0.15 + 0.45 * s1 + 0.4 * s3);
      lanternL.setLit(0.25 + 0.3 * s1);
      lanternR.setLit(0.25 + 0.3 * s2);
      fairyL.setLit(0.1 + 0.5 * s2 + 0.4 * s4);
      fairyR.setLit(0.1 + 0.5 * s3 + 0.4 * s4);
      pollen.setLit(0.15 + 0.45 * s1 + 0.4 * s4);
      fireflies.setLit(0.15 + 0.5 * s2 + 0.35 * s4);
      bloom = s4 * 0.9;
      blossomsL.setLit(bloom);
      blossomsR.setLit(bloom);
      // Gentle sway (skipped for reduced motion).
      if (!kit.reducedMotion) {
        for (let i = 0; i < plants.length; i++) {
          plants[i].group.rotation.z = Math.sin(t * 0.5 + i * 1.7) * 0.025;
          plants[i].group.rotation.x = Math.cos(t * 0.4 + i) * 0.015;
        }
      }
    },
    celebrate(p) {
      const k = Math.sin(p * Math.PI);
      blossomsL.setLit(Math.max(bloom, 0.8 * k));
      blossomsR.setLit(Math.max(bloom, 0.8 * k));
      canopyMat.emissiveIntensity += 0.8 * k;
      shaftMat.opacity += 0.3 * k;
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const conservatoryRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const leafGeo = leafGeometry(kit, 1, 0.38);
  const leafTex = leafTexture(kit);
  const leafMat = kit.track(new T.MeshStandardMaterial({ color: '#2f7d4a', map: leafTex, emissive: '#3fe08a', emissiveMap: leafTex, emissiveIntensity: 0.1, roughness: 0.55, side: T.DoubleSide }));
  // Pot and plant
  const pot = new T.Mesh(new T.CylinderGeometry(0.17, 0.12, 0.24, 20), kit.mats.plastic('#a8583a'));
  pot.position.set(-0.25, 0.12, 0.1);
  kit.add(pot);
  const soil = new T.Mesh(new T.CircleGeometry(0.15, 20).rotateX(-Math.PI / 2), kit.mats.rubber('#2a1c14'));
  soil.position.set(-0.25, 0.225, 0.1);
  kit.add(soil);
  const plant = broadPlant(kit, [-0.25, 0.22, 0.1], 9, 0.3, () => -1, 31, leafGeo, leafMat);
  // Bell jar with a sprig and bubbles
  const jarPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) jarPts.push(new T.Vector2(0.15, i * 0.04));
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    jarPts.push(new T.Vector2(Math.cos(a) * 0.15, 0.24 + Math.sin(a) * 0.15));
  }
  const jar = new T.Mesh(new T.LatheGeometry(jarPts, 24), kit.mats.clearPlastic('#d8fff2', 0.25));
  jar.position.set(0.55, 0.0, 0.2);
  kit.add(jar);
  // The sprig sits under water: oxygen bubbles only form on leaves in water.
  const jarWater = new T.Mesh(new T.CylinderGeometry(0.135, 0.135, 0.26, 20), kit.track(new T.MeshPhysicalMaterial({ color: '#7fd4ff', roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false })));
  jarWater.position.set(0.55, 0.14, 0.2);
  kit.add(jarWater);
  const sprig = broadPlant(kit, [0.55, 0.02, 0.2], 5, 0.12, () => -1, 37, leafGeo, leafMat);
  const bubbles = kit.motes({ x0: 0.47, x1: 0.63, y0: 0.08, y1: 0.26, z0: 0.12, z1: 0.28 }, 14, '#e9fffb', { speed: 0.12, size: 0.04 });
  // Sun lamp with rays and a light beam toward the leaves
  const sun = kit.orb([-0.72, 1.12, -0.55], 0.13, SUN);
  const halo = new T.Sprite(kit.track(new T.SpriteMaterial({ map: glowTexture(kit, 'rgba(255,240,190,1)', 'rgba(255,190,80,0.4)'), transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false })));
  halo.position.set(-0.72, 1.12, -0.55);
  halo.scale.set(0.9, 0.9, 1);
  kit.add(halo);
  const beamMat = kit.track(new T.MeshBasicMaterial({ map: fadeTexture(kit, [[0, 'rgba(255,226,150,0.9)'], [1, 'rgba(255,226,150,0)']]), transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const beam = new T.Mesh(new T.PlaneGeometry(0.35, 1.3), beamMat);
  beam.position.set(-0.5, 0.7, -0.25);
  beam.rotation.set(0, 0.2, 0.6);
  kit.add(beam);
  const sign = kit.neonSign('LIGHT', [0.4, 0.98, -0.82], { height: 0.22, color: SUN });
  const glass = new T.Mesh(new T.PlaneGeometry(2.0, 1.2), kit.track(new T.MeshPhysicalMaterial({ color: '#bff5e4', transparent: true, opacity: 0.08, roughness: 0.05, side: T.DoubleSide, depthWrite: false })));
  glass.position.set(0, 1.0, -0.86);
  kit.add(glass);
  return {
    update(t, lit) {
      leafMat.emissiveIntensity = 0.08 + lit * 0.9;
      plant.field.update(4);
      sprig.field.update(4);
      sun.setLit(0.2 + lit * 0.8);
      (halo.material as THREE.SpriteMaterial).opacity = 0.1 + lit * 0.6;
      beamMat.opacity = lit * 0.4;
      bubbles.setLit(lit);
      sign.setLit(lit);
      plant.group.rotation.z = kit.reducedMotion ? 0 : Math.sin(t * 0.8) * 0.04;
    },
  };
};

// ---------------------------------------------------------------- printed playfield helpers

function leafPath(ctx: CanvasRenderingContext2D, cx: number, tipY: number, baseY: number, half: number) {
  const h = baseY - tipY;
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.bezierCurveTo(cx + half * 1.05, tipY + h * 0.25, cx + half * 1.0, tipY + h * 0.78, cx, baseY);
  ctx.bezierCurveTo(cx - half * 1.0, tipY + h * 0.78, cx - half * 1.05, tipY + h * 0.25, cx, tipY);
  ctx.closePath();
}

function co2Molecule(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ang: number, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = rgba(IVORY, 0.25 + 0.4 * lit);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s * 1.3, 0);
  ctx.lineTo(s * 1.3, 0);
  ctx.stroke();
  for (const [dx, col, r] of [[-1.3, '#d9635c', 0.62], [0, '#596570', 0.75], [1.3, '#d9635c', 0.62]] as [number, string, number][]) {
    ctx.fillStyle = mix(mix(col, '#0b1a16', 0.55), col, lit);
    ctx.beginPath();
    ctx.arc(dx * s, 0, r * s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function jarIcon(ctx: CanvasRenderingContext2D, x: number, y: number, lightOn: boolean, lit: number) {
  ctx.save();
  ctx.translate(x, y);
  // bell jar filled with water (bubbles only form on leaves under water)
  const jarPath = () => {
    ctx.beginPath();
    ctx.moveTo(-16, 22);
    ctx.lineTo(-16, -6);
    ctx.arc(0, -6, 16, Math.PI, 0);
    ctx.lineTo(16, 22);
    ctx.closePath();
  };
  jarPath();
  ctx.fillStyle = lightOn ? rgba(SUN, 0.06 + 0.12 * lit) : 'rgba(10,8,24,0.45)';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(WATER, lightOn ? 0.14 + 0.16 * lit : 0.08 + 0.08 * lit);
  ctx.fillRect(-16, -15, 32, 37);
  ctx.strokeStyle = rgba('#c8f0ff', 0.2 + 0.35 * lit);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-16, -15);
  ctx.lineTo(16, -15);
  ctx.stroke();
  ctx.restore();
  jarPath();
  ctx.strokeStyle = rgba(IVORY, 0.25 + 0.35 * lit);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // sprig
  leafShape(ctx, 0, 18, 14, -1.9, rgba(LEAF, 0.4 + 0.4 * lit));
  leafShape(ctx, 0, 12, 12, -1.0, rgba(LEAF, 0.4 + 0.4 * lit));
  // bubbles only in light
  if (lightOn) for (const [bx, by] of [[4, -2], [-3, -10], [5, -16]]) glowDot(ctx, bx, by, 3.5, '#e9fffb', 0.25 + 0.6 * lit);
  // badge: sun or moon
  if (lightOn) glowDot(ctx, 20, -22, 8, SUN, 0.35 + 0.5 * lit);
  else {
    ctx.fillStyle = rgba('#b7b8e8', 0.35 + 0.3 * lit);
    ctx.beginPath();
    ctx.arc(20, -22, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,8,24,0.9)';
    ctx.beginPath();
    ctx.arc(23, -24, 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the table

export const L04: TableDef = {
  lessonId: 'L04',
  signature: 'Sun lanes, a water channel and a CO₂ bank feed one living leaf',
  ballRole: 'The Wonderball is a game token, not a piece of sunlight: light carries energy but is not matter, so it adds no atoms to a plant.',
  theme: {
    bg: [MOSS, '#06120e'],
    rail: '#a9cdb6',
    railHighlight: '#ffffff',
    lampOn: GOLD,
    lampOff: 'rgba(255,247,231,0.12)',
    accent: LEAF,
    accent2: MINT,
    bumperCap: '#a6ea7e',
    bumperRing: '#1d4a33',
    flipper: '#ffd98a',
    ink: IVORY,
    ramp: 'rgba(110,190,255,0.2)',
    trail: GOLD,
  },
  lines: {
    intro: 'Welcome to the Sunbeam Conservatory, where every leaf is waiting for sunrise. Help them turn carbon dioxide and water into sugar, and the whole glasshouse will glow!',
    quark: '"A giant tree is so heavy. It must be built mostly out of the soil it grows in!" Professor Quark wonders aloud.',
    pipTip: 'Pull the plunger just under halfway to drop into the S-U-N lanes. Then aim the left flipper up the right side for the Water Channel.',
  },
  build,
  skillShot: 'sun_2',
  shots: [
    { id: 'leafLane', label: 'Leaf Lane', on: [{ type: 'shot', id: 'leaf_lane_sw' }], insert: 'ins_leaf_lane' },
    { id: 'waterRamp', label: 'Water Channel', on: [{ type: 'ramp', id: 'water_ramp' }], insert: 'ins_ramp' },
    { id: 'co2Bank', label: 'CO₂ Bank', on: [{ type: 'dropBank', id: 'co2_bank' }], insert: 'ins_bank' },
    { id: 'pocket', label: 'Leaf Pocket', on: [{ type: 'saucer', id: 'leaf_pocket' }], insert: 'ins_pocket' },
    { id: 'sunLanes', label: 'Sun lanes', on: [{ type: 'rollover', group: 'sun' }], insert: 'ins_sun' },
    { id: 'chloroplasts', label: 'Chloroplasts', on: [{ type: 'bumper', group: 'chloro' }], insert: 'ins_chloro' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'What Does a Leaf Need?',
      brief: 'A leaf needs three inputs. Catch light with the chloroplasts, bring in water and carbon dioxide, then test the Leaf Pocket.',
      objectiveIds: ['L04-O1'],
      stages: [
        { kind: 'collect', text: 'Catch light: hit the chloroplast bumpers 6 times', match: { type: 'bumper', group: 'chloro' }, count: 6, preview: ['chloroplasts'] },
        { kind: 'shots', text: 'Bring in matter: Water Channel and CO₂ bank', shots: ['waterRamp', 'co2Bank'], order: 'any' },
        { kind: 'discover', text: 'Shoot the Leaf Pocket', pocket: 'leaf_pocket', questions: 1 },
      ],
      discovery: 'Photosynthesis needs light, water and carbon dioxide. Light brings the energy; carbon dioxide and water bring the matter, so most of a plant\'s matter comes from them, not from soil.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Atom Shuffle',
      brief: 'Model the recipe: load carbon dioxide, add water and light energy, then rearrange the atoms in the Leaf Pocket.',
      objectiveIds: ['L04-O2'],
      stages: [
        { kind: 'collect', text: 'Load 6 CO₂: knock down carbon-dioxide targets', match: { type: 'drop', group: 'co2' }, count: 6, preview: ['co2Bank'] },
        { kind: 'shots', text: 'Add water and light: Water Channel + a sun lane', shots: ['waterRamp', 'sunLanes'], order: 'any' },
        { kind: 'discover', text: 'Shoot the Leaf Pocket to rearrange the atoms', pocket: 'leaf_pocket', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'The atoms of carbon dioxide and water are rearranged into sugar and oxygen. No atoms are made or lost, and the light energy ends up stored as chemical energy in the sugar.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'The Jar Test',
      brief: "Rerun Jan Ingenhousz's test: leaves in jars of water, one in light and one in the dark. Count the oxygen bubbles, then predict what darkness does.",
      objectiveIds: ['L04-O3'],
      stages: [
        { kind: 'collect', text: 'Set up both jars: hit LIGHT and DARK', match: { type: 'target', group: 'jars' }, count: 2, distinct: true, lamps: ['jar_light', 'jar_dark'] },
        { kind: 'collect', text: 'Count oxygen bubbles: spin the Leaf Spinner 3 times', match: { type: 'spinner', id: 'leaf_spinner' }, count: 3, preview: ['leafLane'] },
        { kind: 'discover', text: 'Shoot the Leaf Pocket to make your prediction', pocket: 'leaf_pocket', questions: 1 },
      ],
      discovery: 'In Ingenhousz\'s tests, leaves in water gave off oxygen bubbles in light but hardly any in the dark. Without light energy, photosynthesis stops, so no new sugar or oxygen is made.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Grow the Luminous Canopy',
    brief: 'Feed the whole glasshouse at once: sunlight, water, carbon dioxide and the Leaf Lane, then bring the Wonderball home.',
    stages: [
      { kind: 'shots', text: 'Feed the canopy: sun, water, CO₂ and the Leaf Lane', shots: ['sunLanes', 'waterRamp', 'co2Bank', 'leafLane'], order: 'any' },
      { kind: 'discover', text: 'Bring the Wonderball home to the Leaf Pocket', pocket: 'leaf_pocket', questions: 2 },
    ],
    celebration: 'Powered by light, carbon dioxide and water became sugar and oxygen, and the conservatory blazes with living leaves. The plants made their own food. The Wonderlight is yours!',
  },
  set: conservatorySet,
  room: conservatoryRoom,
  icons: {
    chloroplast(ctx, s) {
      // A chloroplast: an oval body with stacked discs inside (where chlorophyll sits).
      ctx.save();
      ctx.rotate(-0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.95, s * 0.58, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c8f5a8';
      for (const gx of [-0.52, 0, 0.52]) {
        for (let k = 0; k < 3; k++) ctx.fillRect(gx * s - s * 0.15, (-0.27 + k * 0.19) * s, s * 0.3, s * 0.12);
      }
      ctx.restore();
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      const s1 = stage(level, 0.2, 1);
      const s2 = stage(level, 1.2, 2);
      const s3 = stage(level, 2.2, 3);
      const s4 = stage(level, 3.3, 4);
      const dawn = stage(level, 0, 4);
      // Night greenhouse floor that warms toward dawn
      ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, mix(NIGHT, '#2c3a1e', 0.7 * dawn)], [0.45, MOSS], [1, '#06120e']]);
      ctx.fillRect(0, 0, 600, 1150);
      const glow = ctx.createRadialGradient(310, 30, 10, 310, 30, 560);
      glow.addColorStop(0, rgba(SUN, 0.04 + 0.26 * dawn));
      glow.addColorStop(1, rgba(SUN, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 600, 700);
      // Floor tiles for depth (lower field)
      ctx.save();
      ctx.globalAlpha = 0.045;
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 8; j++) {
          if ((i + j) % 2) continue;
          ctx.fillStyle = '#9fd3b4';
          ctx.fillRect(j * 75, 700 + i * 38, 75, 38);
        }
      }
      ctx.restore();
      // Fan window glazing under the arch: concentric frames and radial bars
      ctx.save();
      ctx.beginPath();
      ctx.arc(310, 300, 282, Math.PI, TAU);
      ctx.lineTo(592, 380);
      ctx.lineTo(28, 380);
      ctx.closePath();
      ctx.clip();
      const pr = rng(12);
      const rings = [100, 175, 235, 282];
      for (let ri = 0; ri < rings.length; ri++) {
        const r0 = ri ? rings[ri - 1] : 30;
        const r1 = rings[ri];
        const n = 6 + ri * 4;
        for (let k = 0; k < n; k++) {
          const a0 = Math.PI + (k / n) * Math.PI;
          const a1 = Math.PI + ((k + 1) / n) * Math.PI;
          ctx.beginPath();
          ctx.arc(310, 300, r1, a0, a1);
          ctx.arc(310, 300, r0, a1, a0, true);
          ctx.closePath();
          const pane = pr();
          ctx.fillStyle = pane < 0.5
            ? rgba(mix('#2a5d55', SUN, dawn * 0.8), 0.08 + 0.18 * dawn * pane)
            : rgba(mix('#1d4642', MINT, s2), 0.06 + 0.12 * s2 * pane);
          ctx.fill();
        }
      }
      ctx.strokeStyle = rgba('#6fa592', 0.32 + 0.2 * s1);
      ctx.lineWidth = 2;
      for (const r of rings) {
        ctx.beginPath();
        ctx.arc(310, 300, r, Math.PI, TAU);
        ctx.stroke();
      }
      for (let k = 1; k < 18; k++) {
        const a = Math.PI + (k / 18) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(310 + Math.cos(a) * 30, 300 + Math.sin(a) * 30);
        ctx.lineTo(310 + Math.cos(a) * 282, 300 + Math.sin(a) * 282);
        ctx.stroke();
      }
      ctx.restore();
      // Sunbeams falling through the S-U-N lanes onto the leaf
      const beamA = 0.03 + 0.17 * s1 + 0.08 * s4;
      for (const x of LANE_X) {
        const g = ctx.createLinearGradient(0, 110, 0, POCKET[1]);
        g.addColorStop(0, rgba(SUN, beamA));
        g.addColorStop(1, rgba(SUN, beamA * 0.25));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 18, 110);
        ctx.lineTo(x + 18, 110);
        ctx.lineTo(POCKET[0] + (x - 310) * 0.35 + 28, POCKET[1] - 30);
        ctx.lineTo(POCKET[0] + (x - 310) * 0.35 - 28, POCKET[1] - 30);
        ctx.closePath();
        ctx.fill();
      }
      neonText(ctx, 'LIGHT IS ENERGY', 310, 228, 12, SUN, stage(level, 0.1, 0.9), '"Atkinson Hyperlegible Next", system-ui, sans-serif');
      // The great leaf around the Leaf Pocket
      const leafLit = 0.25 + 0.75 * s1;
      leafPath(ctx, POCKET[0], 330, 650, 112);
      const lg = ctx.createLinearGradient(170, 0, 400, 0);
      lg.addColorStop(0, mix('#0f2d1f', LEAF_DEEP, leafLit));
      lg.addColorStop(0.5, mix('#163b28', '#2f8a4c', leafLit));
      lg.addColorStop(1, mix('#0f2d1f', LEAF_DEEP, leafLit));
      ctx.fillStyle = lg;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(LEAF, 0.25 + 0.45 * s1);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Veins
      ctx.strokeStyle = rgba('#d8f7b0', 0.12 + 0.3 * s1);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(POCKET[0], 650);
      ctx.lineTo(POCKET[0], 350);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const y = 620 - i * 46;
        const w = 70 + Math.sin(((y - 330) / 320) * Math.PI) * 30;
        for (const sx of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(POCKET[0], y);
          ctx.quadraticCurveTo(POCKET[0] + sx * w * 0.5, y - 18, POCKET[0] + sx * w, y - 52);
          ctx.stroke();
        }
      }
      // Chloroplasts glowing inside the leaf (light captured)
      if (s1 > 0.01) {
        const cr = rng(5);
        for (let i = 0; i < 46; i++) {
          const y = 360 + cr() * 270;
          const t = (y - 330) / 320;
          const half = 104 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 0.9;
          const x = POCKET[0] + (cr() * 2 - 1) * half;
          if (Math.abs(x - POCKET[0]) < 8) continue;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(cr() * TAU);
          ctx.fillStyle = rgba('#7df07a', 0.25 + 0.45 * s1);
          ctx.beginPath();
          ctx.ellipse(0, 0, 5, 3, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
          if (i % 3 === 0) glowDot(ctx, x, y, 9, '#9cff8a', 0.18 * s1 + 0.2 * s4);
        }
      }
      // Leaf stalk to the lower field
      ctx.strokeStyle = rgba(mix('#1d4a33', LEAF, s1), 0.7);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(POCKET[0], 648);
      ctx.quadraticCurveTo(POCKET[0] - 6, 700, POCKET[0] + 10, 742);
      ctx.stroke();
      // Products drifting from the leaf (mission 2+): sugar for the plant, oxygen to the air
      if (s2 > 0.01) {
        const pr2 = rng(8);
        for (let i = 0; i < 10; i++) {
          const x = POCKET[0] + (pr2() - 0.5) * 300;
          const y = 300 + pr2() * 300;
          if (Math.abs(x - POCKET[0]) < 120 && y > 330 && y < 640) continue;
          glowDot(ctx, x, y, 5, CORAL, 0.35 * s2);
          glowDot(ctx, x + 7, y, 5, CORAL, 0.35 * s2);
        }
      }
      // Water channel printed under the ramp, with ripples
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      RAMP_PATH.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = rgba(mix('#123c52', WATER, 0.3 + 0.5 * s1), 0.35 + 0.25 * s1);
      ctx.lineWidth = 46;
      ctx.stroke();
      ctx.setLineDash([10, 14]);
      ctx.strokeStyle = rgba('#c8f0ff', 0.12 + 0.35 * s1);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      // Roots drawing water up from below the right inlane
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.3 * s1;
      branch(ctx, 21, 470, 790, 46, -Math.PI / 2 - 0.25, 4, mix('#3c2a1c', '#c9a46a', s1));
      ctx.restore();
      // Carbon dioxide drifting in from the air around the CO₂ bank
      const cl = stage(level, 0.1, 1.6);
      co2Molecule(ctx, 112, 420, 6, -0.6, cl);
      co2Molecule(ctx, 220, 548, 7, 0.4, cl);
      co2Molecule(ctx, 110, 330, 5.5, 1.1, cl);
      co2Molecule(ctx, 236, 400, 5, -1.2, cl);
      ctx.save();
      ctx.strokeStyle = rgba('#b7d0e0', 0.08 + 0.18 * cl);
      ctx.lineWidth = 2;
      for (const [x, y, r] of [[160, 560, 26], [196, 600, 18], [120, 470, 16]] as number[][]) {
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.restore();
      // Ingenhousz's jars beside their targets
      const jl = stage(level, 0.2, 3);
      jarIcon(ctx, 128, 560, true, jl);
      jarIcon(ctx, 342, 606, false, jl);
      // Vines climbing the Leaf Lane: more leaves and light with every mission
      const vineLeaf = mix('#1f4a2e', '#7fe08a', s1);
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.45 * s1;
      branch(ctx, 3, 40, 760, 64, -Math.PI / 2 + 0.05, 4 + (level > 1.5 ? 1 : 0), mix('#2a3b22', '#6fbf6a', s2), vineLeaf);
      branch(ctx, 9, 560, 300, 40, Math.PI / 2 + 0.6, 3 + (level > 2.5 ? 1 : 0), mix('#2a3b22', '#6fbf6a', s3), vineLeaf);
      ctx.restore();
      // Printed names: the 3D view shows target faces edge-on and draws no ramp or spinner
      // labels, so the jars, the Leaf Spinner and the Water Channel are named on the art.
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 12px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.shadowColor = 'rgba(2,10,8,0.85)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = rgba(SUN, 0.5 + 0.45 * jl);
      ctx.fillText('LIGHT', 141, 598);
      ctx.fillStyle = rgba('#cfcaf5', 0.5 + 0.45 * jl);
      ctx.fillText('DARK', 342, 643);
      const lab = 0.42 + 0.5 * stage(level, 0.1, 1.2);
      ctx.save();
      ctx.translate(52, 446);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = rgba(mix('#b8f27a', IVORY, 0.3), lab);
      ctx.fillText('LEAF SPINNER', 0, 0);
      ctx.restore();
      ctx.save();
      ctx.translate(463, 562);
      ctx.rotate(-Math.PI / 2);
      ctx.font = '800 13px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      ctx.fillStyle = rgba('#bfeaff', lab);
      ctx.fillText('WATER CHANNEL', 0, 0);
      ctx.restore();
      ctx.restore();
      // Equation band above the slings
      const eqY = 778;
      ctx.save();
      const parts: [string, string, number][] = [
        ['6CO₂', '#cfd8e0', 0.3], [' + ', IVORY, 0.3], ['6H₂O', WATER, 0.3], [' + ', IVORY, 0.3], ['light energy', SUN, 0.3],
        [' → ', IVORY, 1.3], ['C₆H₁₂O₆', LEAF, 1.3], [' + ', IVORY, 1.3], ['6O₂', CORAL, 1.3],
      ];
      // Keep the band between the sling-top lamps (x ≈ 130–442) so both ends stay readable.
      ctx.font = '800 15px "Atkinson Hyperlegible Next", system-ui, sans-serif';
      const wide = parts.reduce((s, [t]) => s + ctx.measureText(t).width, 0);
      ctx.font = `800 ${Math.min(15, Math.floor((15 * 282) / wide * 10) / 10)}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
      const total = parts.reduce((s, [t]) => s + ctx.measureText(t).width, 0);
      rrect(ctx, 286 - total / 2 - 12, eqY - 13, total + 24, 26, 13);
      ctx.fillStyle = 'rgba(4,14,10,0.55)';
      ctx.fill();
      ctx.strokeStyle = rgba(GOLD, 0.2 + 0.4 * s2);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      let x = 286 - total / 2;
      ctx.textBaseline = 'middle';
      for (const [t, c, lo] of parts) {
        const lit = stage(level, lo, lo + 0.7);
        ctx.fillStyle = lit > 0.02 ? rgba(c, 0.4 + 0.6 * lit) : 'rgba(255,247,231,0.22)';
        ctx.fillText(t, x, eqY + 1);
        x += ctx.measureText(t).width;
      }
      ctx.restore();
      // Attraction title under the glass
      neonText(ctx, 'SUNBEAM CONSERVATORY', 310, 47, 15, GOLD, stage(level, 1.2, 2.4));
      // Lantern glow along the side rails (mission 3+)
      for (const [lx, ly] of [[44, 300], [44, 780], [528, 260]] as number[][]) glowDot(ctx, lx, ly, 22, GOLD, 0.08 + 0.3 * s3);
      // Wonderlight: warm wash and pollen
      if (s4 > 0.01) {
        ctx.fillStyle = rgba(SUN, 0.06 * s4);
        ctx.fillRect(0, 0, 600, 1150);
        const wr = rng(33);
        for (let i = 0; i < 40; i++) glowDot(ctx, 30 + wr() * 520, 40 + wr() * 740, 4 + wr() * 4, i % 2 ? SUN : '#b8f27a', 0.5 * s4);
      }
      neonPath(ctx, () => {
        ctx.beginPath();
        leafPath(ctx, POCKET[0], 330, 650, 112);
      }, LEAF, s3 * 0.8 + 0.2 * s4, 2.5);
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s1 = stage(level, 0.2, 1);
      if (!reduced && s1 > 0) drift(ctx, 14, 16, t, SUN, [40, 320, 540, 760], 8, 1.6, 0.3 * s1 * (0.7 + 0.3 * energy));
      if (!reduced && level >= 2) drift(ctx, 27, 10, t, '#e9fffb', [36, 420, 76, 640], 14, 1.8, 0.4 * stage(level, 2.2, 3));
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.55;
      const g = ctx.createRadialGradient(POCKET[0], POCKET[1], 10, POCKET[0], POCKET[1], 440);
      g.addColorStop(0, rgba(SUN, 0.85));
      g.addColorStop(0.5, rgba('#9cff8a', 0.25));
      g.addColorStop(1, rgba(SUN, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + t * 0.3;
        const d = 50 + p * 280;
        leafShape(ctx, POCKET[0] + Math.cos(a) * d, POCKET[1] + Math.sin(a) * d * 0.85, 16, a, rgba(i % 2 ? '#9cff8a' : SUN, 1 - p));
      }
    },
  },
};
export default L04;
