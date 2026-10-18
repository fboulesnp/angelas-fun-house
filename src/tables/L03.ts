// Lesson 3 — Substances and Their Properties — "Mystery Material Manor"
// A detective mansion seen from above: a Hallway that splits at a revolving bookcase into two
// test wings (DENSITY, SOLUBILITY), a Furnace (MELTING POINT), the Magnifier lane, size-clue
// bumpers in the attic, and the Secret Lab door (the Wonder Pocket). Looks never solve a case:
// every mystery here is cracked by measured properties.

import type * as THREE from 'three';
import { FRAME, type TableBuilder } from '../game/table/builder.ts';
import { Diverter, Mechanism } from '../game/table/mechanisms.ts';
import type { TableRuntime } from '../game/table/runtime.ts';
import type { TableDef } from '../game/table/tableDef.ts';
import type { SetBuilder, RoomBuilder, SetKit } from '../game/render3d/setKit.ts';
import {
  TAU, glowDot, neonPath, neonText, rgba, rng, stage, vgrad, rrect, plaque, drift,
} from '../game/render/art.ts';

const EMERALD = '#16352F';
const BRASS = '#E2B866';
const CANDLE = '#FFC75B';
const CRIMSON = '#E2574C';
const TEAL = '#5FD3C6';
const IVORY = '#FFF3DC';
const VIOLET = '#9F8CFF';
const EMBER = '#FF8A3D';
const LAMP_GREEN = '#8DF0B0';
const BOOKS = ['#8E2F2A', '#2F5E4E', '#C98B3A', '#3A4E86', '#6B3E6E', '#B7A57A', '#1F4F5C'];

type Pt = [number, number];

// ---------------------------------------------------------------- the revolving bookcase

/**
 * Applies the route chosen by onProgress only while no ball is inside the house (hallway or
 * either wing), so a ball can never be sealed into a wing by the bookcase swinging shut.
 * (The Diverter itself only checks its own short sweep radius.)
 */
class BookcaseKeeper extends Mechanism {
  kind = 'bookcaseKeeper' as const;
  want: 0 | 1 = 0;
  private div: Diverter;
  constructor(rt: TableRuntime, id: string, div: Diverter) {
    super(rt, id);
    this.div = div;
  }
  private inHouse(x: number, y: number) {
    return x > 190 && x < 382 && y > 370 && y < 690;
  }
  update(dt: number) {
    super.update(dt);
    const target = this.want;
    if (this.div.position === target && this.div.pending === null) return;
    if (this.div.pending === target) return;
    for (const b of this.rt.world.balls) {
      if (b.state === 'drained' || b.layer !== 0) continue;
      if (this.inHouse(b.x, b.y)) return;
    }
    this.div.set(target);
  }
}

/** Bookcase positions: 0 turns Hallway balls into the west (DENSITY) wing, 1 into the east (SOLUBILITY) wing. */
const ROUTE_DENSITY = 0;
const ROUTE_SOLUBILITY = 1;

function build(b: TableBuilder) {
  b.standardFrame({ kickback: 'both', centerPost: true });

  // --- Magnifier Lane: left orbit channel with a spinner and an exit deflector ---
  b.wall([[78, 650], [78, 378]], { id: 'mag_inner', r: 3 });
  b.post(78, 374, 5);
  b.spinner('magnifier', [30, 566], [72, 566], { label: 'MAGNIFIER' });
  b.shotSwitch('magnifier_sw', 51, 470, -90);
  // A one-way gate, not a wall: orbit exits are still deflected into play, while the left
  // kickback fires straight up through it (a wall here sent kickbacks back into the outlane).
  b.gate('mag_deflect', [FRAME.left, 656], [72, 720], -90);

  // --- The Manor House: Hallway, revolving bookcase, two test wings, peaked roof ---
  // The lower Hallway leans 16° toward the left flipper, so a ball coming back down from a
  // test station drops onto the left flipper instead of straight down the middle.
  b.wall([[230, 690], [238, 664], [262, 580], [262, 512], [200, 450], [234, 416]], { id: 'house_west', r: 3, style: 'wood' });
  b.wall([[294, 690], [286, 664], [310, 580], [310, 512], [372, 450], [338, 416]], { id: 'house_east', r: 3, style: 'wood' });
  b.wall([[234, 416], [286, 378], [338, 416], [286, 468]], { id: 'house_roof', r: 3, closed: true, style: 'wood' });
  b.post(230, 692, 5);
  b.post(294, 692, 5);
  b.shotSwitch('hallway_sw', 286, 548, -90);
  // Test stations at the ends of the wings; the wing-end rails behind them block stray hits.
  b.target('station_density', [206.4, 456.4], [240.4, 422.4], { group: 'stations', label: 'DENSITY' });
  b.target('station_solubility', [365.6, 456.4], [331.6, 422.4], { group: 'stations', label: 'SOLUBILITY' });
  const div = b.diverter('bookcase', [286, 468], 34, 62, 118);
  b.rt.add(new BookcaseKeeper(b.rt, 'bookcase_keeper', div));

  // --- The Furnace: a stove against the east wall; its MELTING door faces the left flipper ---
  b.wall([[466, 476], [546, 522], [546, 396]], { id: 'furnace', r: 3, closed: true, style: 'wood' });
  b.target('station_melting', [466.5, 483.2], [504.6, 505.2], { group: 'stations', label: 'MELTING' });
  // One-way gate so the right kickback can fire up the column (and off the furnace) into play.
  b.gate('right_deflect', [FRAME.laneSep, 646], [518, 694], -90);

  // --- Secret Lab door (Wonder Pocket) under a doorway arch in the east corridor ---
  b.arc(400, 560, 26, 200, 340, { id: 'lab_door', r: 4, style: 'wood', segments: 10 });
  b.saucer('secret_lab', 400, 560, { role: 'pocket', ejectDeg: 93, ejectSpeed: 700, captureMaxSpeed: 2400, label: 'SECRET LAB', icon: 'key' });

  // --- Attic: the three size-clue bumpers (mass, volume, shape) and the Library flask ---
  b.bumper('clue_mass', 300, 300, { group: 'sizeClues', icon: 'weight', label: 'M', r: 24 });
  b.bumper('clue_volume', 382, 248, { group: 'sizeClues', icon: 'cylinder', label: 'V', r: 24 });
  b.bumper('clue_shape', 402, 336, { group: 'sizeClues', icon: 'shapes', label: 'S', r: 24 });
  b.bumper('library_flask', 172, 262, { group: 'flasks', icon: 'flask', r: 22 });
  // Skill shot: a soft plunge drops through the attic keyhole.
  b.rollover('keyhole', 470, 196, { label: 'KEY', icon: 'key' });

  // --- Inserts that preview shots ---
  b.insert('ins_magnifier', 51, 618, { deg: -90, label: 'LENS' });
  b.insert('ins_hallway', 256, 728, { deg: -74, label: 'HALLWAY' });
  b.insert('ins_density', 200, 712, { deg: -120, size: 13 });
  b.insert('ins_solubility', 318, 722, { deg: -60, size: 13 });
  b.insert('ins_melting', 446, 650, { deg: -64, label: 'FURNACE' });
  b.insert('ins_lab', 368, 640, { deg: -62 });
  b.insert('ins_clues', 352, 300, { shape: 'star', size: 11 });
}

// ---------------------------------------------------------------- printed playfield helpers

function poly(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Four-petal damask motif repeated as wallpaper. */
function damask(ctx: CanvasRenderingContext2D, area: [number, number, number, number], color: string, alpha: number) {
  ctx.save();
  ctx.fillStyle = rgba(color, alpha);
  let row = 0;
  for (let y = area[1]; y < area[3]; y += 44, row++) {
    for (let x = area[0] + (row % 2) * 22; x < area[2]; x += 44) {
      ctx.save();
      ctx.translate(x, y);
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, -7, 3, 6.5, 0, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Plank floor with staggered joints. */
function planks(ctx: CanvasRenderingContext2D, y0: number, y1: number, alpha: number) {
  const r = rng(31);
  ctx.save();
  for (let y = y0, i = 0; y < y1; y += 18, i++) {
    ctx.fillStyle = rgba(i % 2 ? '#3b2416' : '#2e1b10', alpha);
    ctx.fillRect(0, y, 600, 17);
    ctx.fillStyle = rgba('#000000', alpha * 0.6);
    ctx.fillRect(0, y + 17, 600, 1);
    for (let x = r() * 90; x < 600; x += 70 + r() * 60) ctx.fillRect(x, y, 1, 17);
  }
  ctx.restore();
}

/** A front-view bookcase printed on the floor plan. */
function bookcase(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, lit: number) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = rgba('#2a140c', 0.85);
  rrect(ctx, x - 3, y - 3, w + 6, h + 6, 3);
  ctx.fill();
  const rows = Math.floor(h / 24);
  for (let i = 0; i < rows; i++) {
    const sy = y + i * 24;
    let bx = x + 2;
    while (bx < x + w - 5) {
      const bw = 3.5 + r() * 4.5;
      const bh = 13 + r() * 7;
      ctx.fillStyle = rgba(BOOKS[Math.floor(r() * BOOKS.length)], 0.5 + 0.4 * lit);
      ctx.fillRect(bx, sy + 21 - bh, bw, bh);
      bx += bw + 1;
    }
    ctx.fillStyle = rgba(BRASS, 0.25 + 0.3 * lit);
    ctx.fillRect(x - 2, sy + 21, w + 4, 2);
  }
  ctx.restore();
}

function footprint(ctx: CanvasRenderingContext2D, x: number, y: number, deg: number, color: string, a: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.fillStyle = rgba(color, a);
  ctx.beginPath();
  ctx.ellipse(0, -4, 4.2, 6.5, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 6.5, 3.4, 3.6, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Printed magnifying glass. */
function magnifierArt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number) {
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
  }, TEAL, lit, 3);
  neonPath(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.72, y + s * 0.72);
    ctx.lineTo(x + s * 1.6, y + s * 1.6);
  }, BRASS, lit, 5);
  if (lit > 0.01) glowDot(ctx, x - s * 0.3, y - s * 0.3, s * 0.5, '#FFFFFF', 0.35 * lit);
}

/** Printed balance scale with two equal-size blocks (one heavier). */
function scaleArt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: number) {
  ctx.save();
  ctx.strokeStyle = rgba(BRASS, 0.45 + 0.5 * lit);
  ctx.fillStyle = rgba(BRASS, 0.45 + 0.5 * lit);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.lineTo(x, y - s * 0.6);
  ctx.stroke();
  ctx.fillRect(x - s * 0.4, y + s - 2, s * 0.8, 3);
  const tilt = 0.22;
  const dx = Math.cos(tilt) * s;
  const dy = Math.sin(tilt) * s;
  ctx.beginPath();
  ctx.moveTo(x - dx, y - s * 0.6 - dy);
  ctx.lineTo(x + dx, y - s * 0.6 + dy);
  ctx.stroke();
  for (const [px, py, c] of [[x - dx, y - s * 0.6 - dy, '#C9CED6'], [x + dx, y - s * 0.6 + dy, '#8B93A3']] as [number, number, string][]) {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - s * 0.25, py + s * 0.45);
    ctx.moveTo(px, py);
    ctx.lineTo(px + s * 0.25, py + s * 0.45);
    ctx.stroke();
    ctx.fillRect(px - s * 0.32, py + s * 0.45, s * 0.64, 2);
    ctx.fillStyle = rgba(c, 0.6 + 0.4 * lit);
    ctx.fillRect(px - s * 0.14, py + s * 0.45 - s * 0.28, s * 0.28, s * 0.28);
    ctx.fillStyle = rgba(BRASS, 0.45 + 0.5 * lit);
  }
  ctx.restore();
}

/** Printed beaker with liquid; `dissolved` draws an even tint, otherwise floating clumps. */
function beakerArt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dissolved: boolean, lit: number) {
  ctx.save();
  ctx.strokeStyle = rgba(IVORY, 0.4 + 0.5 * lit);
  ctx.lineWidth = 1.6;
  ctx.fillStyle = rgba(TEAL, dissolved ? 0.18 + 0.4 * lit : 0.12 + 0.2 * lit);
  ctx.fillRect(x - s * 0.5, y - s * 0.2, s, s * 0.9);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55, y - s * 0.75);
  ctx.lineTo(x - s * 0.5, y + s * 0.7);
  ctx.lineTo(x + s * 0.5, y + s * 0.7);
  ctx.lineTo(x + s * 0.55, y - s * 0.75);
  ctx.stroke();
  if (!dissolved) {
    ctx.fillStyle = rgba(IVORY, 0.55 + 0.4 * lit);
    for (const [cx, cy] of [[-0.2, 0.3], [0.15, 0.45], [0.05, 0.1], [-0.05, 0.55]]) {
      ctx.beginPath();
      ctx.arc(x + cx * s, y + cy * s, s * 0.09, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- 3D helpers (built on kit.THREE)

function boxMesh(kit: SetKit, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const m = new kit.THREE.Mesh(new kit.THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function glowMaterial(kit: SetKit, color: string, base = 0.05): THREE.MeshStandardMaterial {
  return kit.track(new kit.THREE.MeshStandardMaterial({ color: '#0b0806', emissive: color, emissiveIntensity: base, roughness: 0.35 }));
}

/** Neon lettering mounted on the front face of a prop group (local coordinates). */
function placard(kit: SetKit, parent: THREE.Object3D, text: string, color: string, x: number, y: number, z: number, h: number) {
  const sign = kit.neonSign(text, [0, 0, 0], { height: h, color, backing: false });
  kit.root.remove(sign);
  sign.position.set(x, y, z);
  parent.add(sign);
  return sign;
}

/** Triangular gable roof (prism), ridge along X. */
function gableRoof(kit: SetKit, w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const T = kit.THREE;
  const s = new T.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.closePath();
  const geo = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new T.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

/** A bookcase: back, sides and shelves plus one instanced mesh of coloured book spines. */
function bookcase3d(kit: SetKit, x: number, z: number, ry: number, seed: number, bookMat: THREE.Material): THREE.Group {
  const T = kit.THREE;
  const G = kit.regions.groundY;
  const g = new T.Group();
  const frame = kit.mats.plastic('#2a150d');
  const W = 2.2;
  const H = 2.7;
  const D = 0.42;
  g.add(boxMesh(kit, W, H, 0.08, frame, 0, H / 2, -D / 2));
  for (const sx of [-1, 1]) g.add(boxMesh(kit, 0.08, H, D, frame, (sx * W) / 2, H / 2, 0));
  const shelves = 4;
  for (let i = 0; i <= shelves; i++) g.add(boxMesh(kit, W, 0.06, D, frame, 0, 0.1 + (i * (H - 0.2)) / shelves, 0));
  const r = rng(seed);
  const count = kit.n(64);
  const books = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), bookMat, count);
  const m4 = new T.Matrix4();
  const q = new T.Quaternion();
  const pos = new T.Vector3();
  const scl = new T.Vector3();
  const col = new T.Color();
  const perShelf = Math.ceil(count / shelves);
  for (let i = 0; i < count; i++) {
    const shelf = Math.floor(i / perShelf);
    const k = i % perShelf;
    const bw = (W - 0.2) / perShelf;
    const bh = 0.38 + r() * 0.16;
    pos.set(-W / 2 + 0.1 + (k + 0.5) * bw, 0.13 + (shelf * (H - 0.2)) / shelves + bh / 2, 0.02);
    q.setFromAxisAngle(new T.Vector3(0, 0, 1), r() < 0.12 ? 0.18 : 0);
    scl.set(bw * 0.86, bh, D * 0.8);
    m4.compose(pos, q, scl);
    books.setMatrixAt(i, m4);
    books.setColorAt(i, col.set(BOOKS[Math.floor(r() * BOOKS.length)]));
  }
  books.castShadow = true;
  g.add(books);
  g.position.set(x, G, z);
  g.rotation.y = ry;
  return kit.add(g);
}

/** Glass flask with a glowing liquid; returns the liquid material for awakening. */
function flask3d(kit: SetKit, parent: THREE.Object3D, x: number, y: number, z: number, color: string, size = 0.2): THREE.MeshStandardMaterial {
  const T = kit.THREE;
  const glass = kit.mats.clearPlastic('#e6fbf6', 0.28);
  const bulb = new T.Mesh(new T.SphereGeometry(size, 20, 14), glass);
  bulb.position.set(x, y + size, z);
  const neck = new T.Mesh(new T.CylinderGeometry(size * 0.28, size * 0.32, size * 1.3, 14, 1, true), glass);
  neck.position.set(x, y + size * 2.4, z);
  const liquidMat = glowMaterial(kit, color, 0.15);
  const liquid = new T.Mesh(new T.SphereGeometry(size * 0.8, 18, 12, 0, TAU, Math.PI * 0.35, Math.PI * 0.65), liquidMat);
  liquid.position.set(x, y + size, z);
  parent.add(bulb, neck, liquid);
  return liquidMat;
}

// ---------------------------------------------------------------- 3D attraction set

const manorSet: SetBuilder = (kit) => {
  const T = kit.THREE;
  const G = kit.regions.groundY;
  kit.sky('#12333a', '#020607');
  kit.boardwalk('#3a2416', 30);

  const facade = kit.mats.plastic('#1d4038');
  const facadeTrim = kit.mats.paintedMetal('#d9b36c');
  const slate = kit.mats.plastic('#3a1a28');
  const darkWood = kit.mats.plastic('#2a150d');
  const brass = kit.mats.brass();

  // ---- The manor facade behind the head (seen as the camera swoops in): hall, wings, tower
  kit.add(boxMesh(kit, 7.4, 3.2, 1.4, facade, 0, G + 1.6, -10.4));
  for (const sx of [-1, 1]) {
    kit.add(boxMesh(kit, 3.4, 2.5, 1.3, facade, sx * 5.4, G + 1.25, -10.1));
    const wr = gableRoof(kit, 3.9, 1.15, 1.6, slate);
    wr.position.set(sx * 5.4, G + 2.5, -10.1);
    kit.add(wr);
  }
  const hallRoof = gableRoof(kit, 7.9, 1.5, 1.7, slate);
  hallRoof.position.set(0, G + 3.2, -10.4);
  kit.add(hallRoof);
  kit.add(boxMesh(kit, 7.6, 0.12, 0.12, facadeTrim, 0, G + 3.2, -9.68));
  kit.add(boxMesh(kit, 1.9, 7.0, 1.6, facade, 0, G + 3.5, -11.3));
  const spire = new T.Mesh(new T.ConeGeometry(1.5, 2.0, 4), slate);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, G + 8.0, -11.3);
  kit.add(spire);
  const eyeRing = new T.Mesh(new T.TorusGeometry(0.62, 0.08, 12, 40), brass);
  eyeRing.position.set(0, G + 5.6, -10.46);
  kit.add(eyeRing);
  const eyeMat = glowMaterial(kit, TEAL, 0.1);
  const eye = new T.Mesh(new T.CircleGeometry(0.58, 40), eyeMat);
  eye.position.set(0, G + 5.6, -10.48);
  kit.add(eye);
  const hallMask = [
    [1, 1, 0, 1, 1, 1, 0, 1, 1],
    [1, 1, 0, 1, 1, 1, 0, 1, 1],
    [1, 1, 0, 1, 0, 1, 0, 1, 1],
  ];
  const hallWindows = kit.tileWall([0, G + 0.45, -9.66], 9, 3, 0.66, hallMask, (c) => (c < 3 ? CANDLE : c > 5 ? TEAL : IVORY));
  const doorMat = glowMaterial(kit, CRIMSON, 0.3);
  kit.add(boxMesh(kit, 0.62, 1.05, 0.08, doorMat, 0, G + 0.53, -9.62));
  const marquee = kit.neonSign('MYSTERY MATERIAL MANOR', [0, 1.45, -7.3], { height: 0.6, color: CANDLE });
  marquee.rotation.x = -0.72;

  // ---- West: the Library. Back: bookcases. Middle: the DENSITY balance. Front: the Magnifier.
  // Book spines share one material whose gold glow wakes at Wonderlight.
  const bookMat = kit.track(new T.MeshStandardMaterial({ roughness: 0.55, emissive: CANDLE, emissiveIntensity: 0 }));
  bookcase3d(kit, -7.0, -3.4, 0.62, 3, bookMat);
  bookcase3d(kit, -5.1, -5.7, 0.32, 9, bookMat);
  const libSign = kit.neonSign('THE LIBRARY', [-6.75, 2.95, -3.0], { height: 0.36, color: LAMP_GREEN, rotY: 0.62 });
  libSign.rotation.x = -0.3;
  // Balance: two blocks of the same size; the denser one rides lower.
  const scaleG = new T.Group();
  scaleG.position.set(-5.5, G, -0.5);
  scaleG.rotation.y = 0.45;
  kit.add(scaleG);
  scaleG.add(boxMesh(kit, 1.1, 0.7, 0.7, kit.mats.wood(), 0, 0.35, 0));
  const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 1.3, 12), brass);
  post.position.y = 1.35;
  scaleG.add(post);
  const beamPivot = new T.Group();
  beamPivot.position.y = 1.98;
  scaleG.add(beamPivot);
  beamPivot.add(boxMesh(kit, 1.5, 0.06, 0.08, brass, 0, 0, 0));
  const pans: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const pan = new T.Group();
    pan.position.set(sx * 0.7, 0, 0);
    const dish = new T.Mesh(new T.CylinderGeometry(0.26, 0.2, 0.05, 20), brass);
    dish.position.y = -0.45;
    const ingot = boxMesh(kit, 0.22, 0.2, 0.22, kit.mats.paintedMetal(sx < 0 ? '#c9ced6' : '#6f7787'), 0, -0.32, 0);
    pan.add(dish, ingot);
    beamPivot.add(pan);
    pans.push(pan);
  }
  const densSign = placard(kit, scaleG, 'DENSITY', CANDLE, 0, 0.4, 0.37, 0.3);
  // The giant magnifying glass and a globe on a stand.
  const glassMat = kit.track(new T.MeshPhysicalMaterial({ color: '#dff7f2', roughness: 0.05, transmission: 0.6, thickness: 0.2, transparent: true, opacity: 0.35, emissive: TEAL, emissiveIntensity: 0.05 }));
  const mag = new T.Group();
  const magRing = new T.Mesh(new T.TorusGeometry(0.62, 0.07, 14, 48), brass);
  const magLens = new T.Mesh(new T.CircleGeometry(0.6, 40), glassMat);
  const magHandle = new T.Mesh(new T.CylinderGeometry(0.075, 0.09, 1.15, 14), kit.mats.wood());
  magHandle.position.set(0, -1.18, 0);
  mag.add(magRing, magLens, magHandle);
  mag.position.set(-4.75, 1.55, 2.6);
  mag.rotation.set(-0.55, 0.35, -0.35);
  kit.add(mag);
  const globe = new T.Mesh(new T.SphereGeometry(0.34, 28, 18), kit.mats.plastic('#2f6b63'));
  globe.position.set(-6.3, G + 1.2, 1.1);
  const meridian = new T.Mesh(new T.TorusGeometry(0.4, 0.025, 8, 40), brass);
  meridian.position.copy(globe.position);
  meridian.rotation.y = 0.6;
  kit.add(globe);
  kit.add(meridian);
  kit.add(boxMesh(kit, 0.08, 0.85, 0.08, brass, -6.3, G + 0.43, 1.1));
  kit.pole([-4.45, 0, -2.6], 2.0);
  const lamp = kit.lantern([-4.45, 2.25, -2.6], LAMP_GREEN, 0.2);

  // ---- East: the Laboratory. Back: specimen cabinet + bench of flasks. Middle: SOLUBILITY
  // beakers (sugar dissolves, flour clumps). Front: the MELTING POINT furnace and thermometer.
  const cabinet = new T.Group();
  cabinet.position.set(5.2, G, -5.7);
  cabinet.rotation.y = -0.32;
  kit.add(cabinet);
  cabinet.add(boxMesh(kit, 2.2, 2.6, 0.45, darkWood, 0, 1.3, -0.05));
  const jarMat = kit.track(new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#3a6f66', emissiveIntensity: 0.1, roughness: 0.15, metalness: 0.1 }));
  const jarCount = kit.n(15);
  const jars = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.1, 0.26, 12), jarMat, jarCount);
  const jm = new T.Matrix4();
  const jc = new T.Color();
  const jarColors = [TEAL, CANDLE, VIOLET, '#9fe8ff', CRIMSON];
  for (let i = 0; i < jarCount; i++) {
    jm.makeTranslation(-0.8 + (i % 5) * 0.4, 0.5 + Math.floor(i / 5) * 0.75, 0.22);
    jars.setMatrixAt(i, jm);
    jars.setColorAt(i, jc.set(jarColors[(i * 3) % jarColors.length]).multiplyScalar(0.55));
  }
  for (let i = 0; i < 3; i++) cabinet.add(boxMesh(kit, 2.1, 0.05, 0.42, kit.mats.brass(), 0, 0.36 + i * 0.75, 0.05));
  cabinet.add(jars);
  const bench = new T.Group();
  bench.position.set(6.7, G, -2.6);
  bench.rotation.y = -0.6;
  kit.add(bench);
  bench.add(boxMesh(kit, 2.6, 0.9, 1.0, kit.mats.wood(), 0, 0.45, 0));
  const liquids = [
    flask3d(kit, bench, -0.85, 0.9, 0.05, CANDLE, 0.2),
    flask3d(kit, bench, -0.25, 0.9, -0.15, TEAL, 0.24),
    flask3d(kit, bench, 0.3, 0.9, 0.1, VIOLET, 0.18),
    flask3d(kit, bench, 0.85, 0.9, -0.1, CRIMSON, 0.22),
  ];
  const bubbles = kit.motes({ x0: 5.6, x1: 7.8, y0: 0.7, y1: 2.6, z0: -3.4, z1: -1.8 }, 36, TEAL, { speed: 0.22, size: 0.07 });
  const labSign = kit.neonSign('THE LABORATORY', [6.75, 2.95, -3.0], { height: 0.36, color: TEAL, rotY: -0.62 });
  labSign.rotation.x = -0.3;
  const caseSign = kit.neonSign('CASE CLOSED!', [6.75, 2.95, -3.0], { height: 0.42, color: CRIMSON, rotY: -0.62 });
  caseSign.rotation.x = -0.3;
  caseSign.visible = false;
  // Solubility stand.
  const stand = new T.Group();
  stand.position.set(5.0, G, -0.2);
  stand.rotation.y = -0.4;
  kit.add(stand);
  stand.add(boxMesh(kit, 1.1, 0.8, 0.7, kit.mats.wood(), 0, 0.4, 0));
  const beakerGlass = kit.mats.clearPlastic('#f2fffb', 0.25);
  const sugarMat = glowMaterial(kit, TEAL, 0.1);
  for (const [bx, dissolved] of [[-0.25, true], [0.25, false]] as [number, boolean][]) {
    const glassCyl = new T.Mesh(new T.CylinderGeometry(0.17, 0.15, 0.46, 18, 1, true), beakerGlass);
    glassCyl.position.set(bx, 1.03, 0);
    const water = new T.Mesh(new T.CylinderGeometry(0.15, 0.14, 0.3, 18), dissolved ? sugarMat : kit.mats.clearPlastic('#9fe8ff', 0.45));
    water.position.set(bx, 0.96, 0);
    stand.add(glassCyl, water);
  }
  const clumps = new T.InstancedMesh(new T.SphereGeometry(0.04, 8, 6), kit.mats.plastic('#f4ead8'), 5);
  const cm = new T.Matrix4();
  [[0.04, 0.88, 0.03], [-0.05, 0.93, -0.02], [0.02, 1.0, -0.05], [-0.03, 0.85, 0.06], [0.07, 0.97, 0.04]].forEach(([x, y, z], i) => {
    cm.makeTranslation(0.25 + x, y, z);
    clumps.setMatrixAt(i, cm);
  });
  stand.add(clumps);
  const solSign = placard(kit, stand, 'SOLUBILITY', TEAL, 0, 0.48, 0.37, 0.27);
  // Furnace (melting point).
  const furnace = new T.Group();
  furnace.position.set(5.6, G, 2.6);
  furnace.rotation.y = -0.45;
  kit.add(furnace);
  furnace.add(boxMesh(kit, 1.35, 1.25, 1.15, kit.mats.plastic('#5a2a20'), 0, 0.62, 0));
  const mouthMat = glowMaterial(kit, EMBER, 0.3);
  furnace.add(boxMesh(kit, 0.7, 0.48, 0.05, mouthMat, 0, 0.5, 0.58));
  const chimney = new T.Mesh(new T.CylinderGeometry(0.17, 0.2, 2.0, 16), kit.mats.paintedMetal('#2b2524'));
  chimney.position.set(0.42, 2.2, -0.35);
  furnace.add(chimney);
  const embers = kit.motes({ x0: 5.6, x1: 6.3, y0: 2.4, y1: 4.4, z0: 2.0, z1: 2.6 }, 26, EMBER, { speed: 0.35, size: 0.08 });
  const thermoGlass = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 1.7, 14), kit.mats.clearPlastic('#ffffff', 0.3));
  thermoGlass.position.set(-0.95, 1.05, 0.2);
  const columnMat = glowMaterial(kit, CRIMSON, 0.5);
  const column = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 1.6, 10), columnMat);
  column.geometry.translate(0, 0.8, 0);
  column.position.set(-0.95, 0.22, 0.2);
  const bulb = new T.Mesh(new T.SphereGeometry(0.1, 14, 10), columnMat);
  bulb.position.set(-0.95, 0.2, 0.2);
  furnace.add(thermoGlass, column, bulb);
  const meltSign = placard(kit, furnace, 'MELTING POINT', EMBER, 0, 0.98, 0.6, 0.31);

  // ---- Sky and spectacle: moon, eaves bulbs, dust, gold motes and side fireworks at level 4
  const moonMat = glowMaterial(kit, IVORY, 1.2);
  const moon = new T.Mesh(new T.SphereGeometry(0.9, 28, 18), moonMat);
  moon.position.set(-7.2, 7.2, -14);
  const shadowMoon = new T.Mesh(new T.SphereGeometry(0.86, 28, 18), kit.track(new T.MeshBasicMaterial({ color: '#0a1d22' })));
  shadowMoon.position.set(-6.82, 7.42, -13.5);
  kit.add(moon);
  kit.add(shadowMoon);
  const eaves = kit.stringLights([-7.1, G + 2.75, -9.35], [7.1, G + 2.75, -9.35], 0.25, kit.n(14), [CANDLE, '#FFE2A8']);
  const dust = kit.motes({ x0: -10, x1: 10, y0: 0, y1: 6, z0: -11, z1: 6 }, 80, IVORY, { speed: 0.05, size: 0.07 });
  const goldL = kit.motes({ x0: -8.4, x1: -4.0, y0: 0.1, y1: 3.6, z0: -5, z1: 4 }, 70, CANDLE, { speed: 0.35, size: 0.13 });
  const goldR = kit.motes({ x0: 4.0, x1: 8.4, y0: 0.1, y1: 3.6, z0: -5, z1: 4 }, 70, CANDLE, { speed: 0.35, size: 0.13 });
  // Side fireworks sit low and forward so they burst inside the visible side regions.
  const fwL = kit.fireworks({ x0: -7.8, x1: -5.8, y0: 1.7, y1: 2.5, z: -2.0 }, [CANDLE, LAMP_GREEN, IVORY]);
  const fwR = kit.fireworks({ x0: 5.8, x1: 7.8, y0: 1.7, y1: 2.5, z: -2.0 }, [TEAL, CRIMSON, CANDLE]);
  // Wonderlight pillars rise over each test station once the case is closed.
  const fade = document.createElement('canvas');
  fade.width = 4;
  fade.height = 64;
  const fctx = fade.getContext('2d')!;
  const fg = fctx.createLinearGradient(0, 0, 0, 64);
  fg.addColorStop(0, '#000000');
  fg.addColorStop(0.55, '#5a5a5a');
  fg.addColorStop(1, '#ffffff');
  fctx.fillStyle = fg;
  fctx.fillRect(0, 0, 4, 64);
  const fadeTex = kit.track(new T.CanvasTexture(fade));
  const pillarMat = kit.track(new T.MeshBasicMaterial({ color: CANDLE, alphaMap: fadeTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  const pillarGeo = new T.CylinderGeometry(0.75, 0.5, 4, 28, 1, true);
  pillarGeo.translate(0, 2 + G, 0);
  const pillars = ([[-5.5, -0.5], [5.0, -0.2], [5.6, 2.6]] as [number, number][]).map(([x, z]) => {
    const m = new T.Mesh(pillarGeo, pillarMat);
    m.position.set(x, 0, z);
    m.visible = false;
    return kit.add(m);
  });
  kit.spot([-5.5, 6.5, 3], [-6, 0, -1.5], LAMP_GREEN, 30, 0.5);
  kit.spot([5.5, 6.5, 3], [6, 0, -0.5], EMBER, 30, 0.5);
  kit.point([0, 4.5, -8.6], CANDLE, 5, 9);

  let tilt = 0.32;
  return {
    update(t, dt, level, energy) {
      const s1 = kit.stage(level, 0.3, 1.2);
      const s2 = kit.stage(level, 1.3, 2.2);
      const s3 = kit.stage(level, 2.3, 3.1);
      const s4 = kit.stage(level, 3.4, 4);
      // The manor is never a black void: candle-dim at rest, blazing when the case is closed.
      hallWindows.light(0.12 + 0.88 * Math.min(1, level / 3.2), t);
      marquee.setLit(0.15 + 0.85 * s2);
      libSign.setLit(0.2 + 0.8 * s1);
      labSign.setLit(0.2 + 0.8 * s3);
      labSign.visible = s4 < 0.5;
      caseSign.visible = s4 >= 0.5;
      caseSign.setLit(s4 * (kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 3)));
      solSign.setLit(0.12 + 0.88 * s1);
      densSign.setLit(0.12 + 0.88 * s2);
      meltSign.setLit(0.12 + 0.88 * s3);
      lamp.setLit(0.3 + 0.7 * s1);
      glassMat.emissiveIntensity = 0.05 + 0.6 * s1 + 1.2 * s4;
      jarMat.emissiveIntensity = 0.08 + 0.5 * s3 + 0.4 * s4;
      bookMat.emissiveIntensity = 0.12 * s4;
      for (let i = 0; i < liquids.length; i++) liquids[i].emissiveIntensity = 0.15 + 2.2 * kit.stage(level, 1.2 + i * 0.25, 2.2 + i * 0.25) + 0.3 * energy;
      sugarMat.emissiveIntensity = 0.1 + 1.6 * s1;
      const flicker = kit.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 3.7);
      mouthMat.emissiveIntensity = (0.35 + 2.6 * s3 + 0.6 * energy) * flicker;
      columnMat.emissiveIntensity = 0.5 + 1.5 * s3;
      column.scale.y = 0.18 + 0.82 * s3;
      eyeMat.emissiveIntensity = 0.12 + 1.2 * s3 + 2.2 * s4;
      doorMat.emissiveIntensity = 0.3 + 2.4 * s4;
      eaves.setLit(0.25 + 0.75 * s2);
      bubbles.setLit(0.2 + 0.7 * s2);
      embers.setLit(0.15 + 0.85 * s3);
      dust.setLit(0.3 + 0.4 * s1);
      goldL.setLit(s4);
      goldR.setLit(s4);
      goldL.visible = goldR.visible = s4 > 0.01;
      pillarMat.opacity = 0.16 * s4 * (kit.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 1.6));
      for (let i = 0; i < pillars.length; i++) pillars[i].visible = s4 > 0.01;
      const fw = kit.stage(level, 3.6, 4);
      fwL.setLit(fw);
      fwR.setLit(fw);
      if (!kit.reducedMotion) {
        mag.rotation.y = 0.35 + Math.sin(t * 0.5) * 0.18;
        tilt += (0.32 - 0.04 * Math.sin(t * 1.4) - tilt) * Math.min(1, dt * 2);
      }
      // The denser block's pan rides lower.
      beamPivot.rotation.z = -tilt * (0.6 + 0.4 * s2);
      for (let i = 0; i < pans.length; i++) pans[i].rotation.z = -beamPivot.rotation.z;
    },
    celebrate(p, t) {
      const k = Math.sin(p * Math.PI);
      fwL.setLit(k);
      fwR.setLit(k);
      goldL.visible = goldR.visible = true;
      goldL.setLit(k);
      goldR.setLit(k);
      hallWindows.light(1, t * 3);
      eyeMat.emissiveIntensity = 1 + 3 * k;
      bookMat.emissiveIntensity = Math.max(bookMat.emissiveIntensity, 0.12 * k);
    },
  };
};

// ---------------------------------------------------------------- dollhouse room

const manorRoom: RoomBuilder = ({ kit }) => {
  const T = kit.THREE;
  const frame = kit.mats.plastic('#2a150d');
  const brass = kit.mats.brass();
  // Back wall bookcase with an instanced row of book spines.
  kit.add(boxMesh(kit, 1.5, 1.1, 0.08, frame, -0.2, 0.62, -0.84));
  kit.add(boxMesh(kit, 1.5, 0.05, 0.25, frame, -0.2, 0.62, -0.74));
  const books = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), kit.track(new T.MeshStandardMaterial({ roughness: 0.6 })), 18);
  const m4 = new T.Matrix4();
  const col = new T.Color();
  const r = rng(12);
  for (let i = 0; i < 18; i++) {
    const h = 0.2 + r() * 0.1;
    m4.makeScale(0.06, h, 0.18);
    m4.setPosition(-0.9 + i * 0.08, 0.65 + h / 2, -0.75);
    books.setMatrixAt(i, m4);
    books.setColorAt(i, col.set(BOOKS[i % BOOKS.length]));
  }
  kit.add(books);
  // Detective's desk with a magnifier, a glowing beaker and a tiny balance.
  kit.add(boxMesh(kit, 1.1, 0.5, 0.55, kit.mats.wood(), 0.3, 0.25, 0.1));
  const ring = new T.Mesh(new T.TorusGeometry(0.11, 0.018, 8, 24), brass);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0.05, 0.52, 0.18);
  const handle = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.2, 8), kit.mats.wood());
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.24, 0.52, 0.22);
  kit.add(ring);
  kit.add(handle);
  const liquidMat = glowMaterial(kit, TEAL, 0.1);
  const beaker = new T.Mesh(new T.CylinderGeometry(0.07, 0.065, 0.18, 14, 1, true), kit.mats.clearPlastic('#f2fffb', 0.3));
  beaker.position.set(0.55, 0.59, 0.05);
  const liquid = new T.Mesh(new T.CylinderGeometry(0.062, 0.058, 0.11, 14), liquidMat);
  liquid.position.set(0.55, 0.56, 0.05);
  kit.add(beaker);
  kit.add(liquid);
  const post = new T.Mesh(new T.CylinderGeometry(0.012, 0.015, 0.26, 8), brass);
  post.position.set(0.72, 0.63, -0.08);
  const beam = boxMesh(kit, 0.3, 0.015, 0.02, brass, 0.72, 0.76, -0.08);
  beam.rotation.z = -0.2;
  kit.add(post);
  kit.add(beam);
  for (const [px, py] of [[0.58, 0.74], [0.86, 0.67]] as Pt[]) {
    const pan = new T.Mesh(new T.CylinderGeometry(0.05, 0.04, 0.012, 14), brass);
    pan.position.set(px, py, -0.08);
    kit.add(pan);
  }
  // Banker's lamp and the secret lab door on the right wall.
  const lamp = kit.lantern([-0.65, 0.42, 0.2], LAMP_GREEN, 0.13);
  // The secret lab door on the right wall: light leaks around its frame.
  const leakMat = glowMaterial(kit, TEAL, 0.1);
  kit.add(boxMesh(kit, 0.03, 1.0, 0.5, leakMat, 1.02, 0.5, -0.2));
  kit.add(boxMesh(kit, 0.05, 0.92, 0.42, kit.mats.plastic('#4a2318'), 1.0, 0.47, -0.2));
  const knob = new T.Mesh(new T.SphereGeometry(0.025, 10, 8), brass);
  knob.position.set(0.965, 0.47, -0.04);
  kit.add(knob);
  const sign = kit.neonSign('?', [-0.2, 1.42, -0.8], { height: 0.3, color: CANDLE, backing: false });
  return {
    update(t, lit) {
      lamp.setLit(0.15 + 0.35 * lit);
      sign.setLit(lit);
      liquidMat.emissiveIntensity = 0.1 + 1.6 * lit;
      leakMat.emissiveIntensity = 0.1 + 1.8 * lit * (kit.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 2));
    },
  };
};

// ---------------------------------------------------------------- the table

export const L03: TableDef = {
  lessonId: 'L03',
  signature: 'A revolving bookcase that routes the Hallway to whichever test station the case needs',
  ballRole: 'The Wonderball is a game token that carries pretend samples between test stations; real samples are measured with lab tools, not rolled around a mansion.',
  theme: {
    bg: ['#1d3a33', '#0c1a18'],
    rail: '#d9b36c',
    railHighlight: '#fff3dc',
    lampOn: CANDLE,
    lampOff: 'rgba(255,243,220,0.12)',
    accent: CRIMSON,
    accent2: TEAL,
    bumperCap: '#f3e3c0',
    bumperRing: '#5a2e1f',
    flipper: '#f3e3c0',
    ink: IVORY,
    ramp: 'rgba(95,211,198,0.16)',
    trail: '#9ff2e4',
  },
  lines: {
    intro: 'Welcome to Mystery Material Manor, where every room hides an unknown substance. Bring a sharp eye and better tests than looks alone.',
    quark: '"These two shiny gray metals look exactly alike. Doesn\'t that make them the same substance?" Professor Quark wonders, polishing his monocle.',
    pipTip: 'A full plunge spins the Magnifier. Then aim up the Hallway: the bookcase swings toward the test the case needs.',
  },
  build,
  skillShot: 'keyhole',
  shots: [
    { id: 'magnifier', label: 'Magnifier Lane', on: [{ type: 'spinner', id: 'magnifier' }], insert: 'ins_magnifier' },
    { id: 'hallway', label: 'Hallway', on: [{ type: 'shot', id: 'hallway_sw' }], insert: 'ins_hallway' },
    { id: 'density', label: 'Density station', on: [{ type: 'target', id: 'station_density' }], insert: 'ins_density' },
    { id: 'solubility', label: 'Solubility station', on: [{ type: 'target', id: 'station_solubility' }], insert: 'ins_solubility' },
    { id: 'melting', label: 'Furnace (melting point)', on: [{ type: 'target', id: 'station_melting' }], insert: 'ins_melting' },
    { id: 'lab', label: 'Secret Lab', on: [{ type: 'saucer', id: 'secret_lab' }], insert: 'ins_lab' },
    { id: 'clues', label: 'Size bumpers', on: [{ type: 'bumper', group: 'sizeClues' }], insert: 'ins_clues' },
  ],
  missions: [
    {
      id: 'm1',
      kind: 'observe',
      title: 'Two White Powders',
      brief: 'Two jars of white powder look identical. Study them under the Magnifier, then let the Solubility station tell them apart.',
      objectiveIds: ['L03-O2', 'L03-O4'],
      stages: [
        { kind: 'collect', text: 'Study both powders: spin the Magnifier 3 times', match: { type: 'spinner', id: 'magnifier' }, count: 3, preview: ['magnifier'] },
        { kind: 'collect', text: 'They look alike! Test SOLUBILITY twice', match: { type: 'target', id: 'station_solubility' }, count: 2, preview: ['hallway', 'solubility'] },
        { kind: 'discover', text: 'Open the Secret Lab door to compare results', pocket: 'secret_lab', questions: 1 },
      ],
      discovery: 'Sugar and flour are both white powders, but sugar dissolves in water and flour does not. A property test told them apart when color could not.',
      reward: 'kickback',
      sceneryLevel: 1,
    },
    {
      id: 'm2',
      kind: 'relate',
      title: 'Block or Bead?',
      brief: 'A big copper block and a tiny copper bead: pop the size bumpers, then find mass ÷ volume for both at the DENSITY station.',
      objectiveIds: ['L03-O3', 'L03-O2'],
      stages: [
        { kind: 'collect', text: 'Pop MASS, VOLUME and SHAPE: they describe the object', match: { type: 'bumper', group: 'sizeClues' }, count: 3, distinct: true, lamps: ['clue_mass', 'clue_volume', 'clue_shape'], preview: ['clues'] },
        { kind: 'collect', text: 'Find mass ÷ volume for both at DENSITY', match: { type: 'target', id: 'station_density' }, count: 2, preview: ['hallway', 'density'] },
        { kind: 'discover', text: 'Open the Secret Lab door to build the model', pocket: 'secret_lab', questions: 1, types: ['order', 'classify', 'match'] },
      ],
      discovery: 'Mass, volume and shape describe one particular object, so they differ between a big block and a tiny bead. Density, mass ÷ volume, does not: pure copper has the same density in both, under the same conditions.',
      reward: 'multiball',
      sceneryLevel: 2,
    },
    {
      id: 'm3',
      kind: 'apply',
      title: 'Name the Mystery Metal',
      brief: 'A shiny gray ingot with no label. Run several tests, then match the results to a table of known metals.',
      objectiveIds: ['L03-O5', 'L03-O3'],
      stages: [
        { kind: 'collect', text: 'Test 1: look closely, spin the Magnifier twice', match: { type: 'spinner', id: 'magnifier' }, count: 2, preview: ['magnifier'] },
        { kind: 'collect', text: 'Test 2: measure its DENSITY (mass ÷ volume)', match: { type: 'target', id: 'station_density' }, count: 1, preview: ['hallway', 'density'] },
        { kind: 'collect', text: 'Test 3: find its MELTING point in the Furnace', match: { type: 'target', id: 'station_melting' }, count: 1, preview: ['melting'] },
        { kind: 'discover', text: 'Match your results in the Secret Lab', pocket: 'secret_lab', questions: 1 },
      ],
      discovery: 'One test is rarely enough. A gray metal with a density of 2.7 g/cm³ that melts near 660 °C matches aluminum in a table of known substances.',
      reward: 'jackpot',
      sceneryLevel: 3,
    },
  ],
  finale: {
    title: 'Case Closed',
    brief: 'Final case: the manor\'s inventor needs ink that washes off with plain water. Recheck every station, then present your findings in the Secret Lab.',
    stages: [
      { kind: 'shots', text: 'Recheck the clues: Magnifier and DENSITY', shots: ['magnifier', 'density'], order: 'any' },
      { kind: 'shots', text: 'Final tests: SOLUBILITY and the Furnace', shots: ['solubility', 'melting'], order: 'any' },
      { kind: 'discover', text: 'Present your findings in the Secret Lab', pocket: 'secret_lab', questions: 2, objectiveIds: ['L03-O5', 'L03-O4', 'L03-O1'] },
    ],
    celebration: 'Case closed! Measured properties, not looks, unmasked each mystery material and matched the right one to each job. The manor’s Wonderlight is yours!',
  },
  onProgress(rt, { slot, stage }) {
    // Point the Hallway at whichever wing the current stage needs (applied once the house is empty).
    let route: 0 | 1 = ROUTE_DENSITY;
    if (slot === 0 || (slot === 3 && stage === 1)) route = ROUTE_SOLUBILITY;
    rt.get<BookcaseKeeper>('bookcase_keeper').want = route;
  },
  set: manorSet,
  room: manorRoom,
  icons: {
    weight(ctx, s) {
      // A kettlebell-style mass.
      ctx.beginPath();
      ctx.moveTo(-s * 0.62, s * 0.78);
      ctx.lineTo(s * 0.62, s * 0.78);
      ctx.lineTo(s * 0.44, -s * 0.18);
      ctx.lineTo(-s * 0.44, -s * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = s * 0.17;
      ctx.beginPath();
      ctx.arc(0, -s * 0.36, s * 0.34, Math.PI * 0.92, Math.PI * 2.08);
      ctx.stroke();
    },
    cylinder(ctx, s) {
      // A graduated cylinder for volume.
      ctx.lineWidth = s * 0.12;
      ctx.strokeRect(-s * 0.28, -s * 0.88, s * 0.56, s * 1.5);
      ctx.fillRect(-s * 0.28, -s * 0.05, s * 0.56, s * 0.67);
      ctx.fillRect(-s * 0.6, s * 0.62, s * 1.2, s * 0.2);
      for (let i = 0; i < 4; i++) ctx.fillRect(-s * 0.28, -s * 0.72 + i * s * 0.2, s * 0.24, s * 0.06);
    },
    shapes(ctx, s) {
      // A cube, a ball and a cone: the same substance can take any shape.
      ctx.fillRect(-s * 0.9, -s * 0.1, s * 0.62, s * 0.62);
      ctx.beginPath();
      ctx.arc(s * 0.02, -s * 0.48, s * 0.34, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.55, -s * 0.15);
      ctx.lineTo(s * 0.92, s * 0.55);
      ctx.lineTo(s * 0.18, s * 0.55);
      ctx.closePath();
      ctx.fill();
    },
    key(ctx, s) {
      ctx.lineWidth = s * 0.18;
      ctx.beginPath();
      ctx.arc(-s * 0.45, 0, s * 0.33, 0, TAU);
      ctx.stroke();
      ctx.fillRect(-s * 0.14, -s * 0.09, s * 1.0, s * 0.18);
      ctx.fillRect(s * 0.55, 0, s * 0.14, s * 0.36);
      ctx.fillRect(s * 0.28, 0, s * 0.12, s * 0.28);
    },
  },
  scenery: {
    backdrop({ ctx, level }) {
      const s1 = stage(level, 0.2, 1);
      const s2 = stage(level, 1.2, 2);
      const s3 = stage(level, 2.2, 3);
      const s4 = stage(level, 3.3, 4);
      // Emerald wallpaper hall, darkening toward the flippers.
      ctx.fillStyle = vgrad(ctx, 0, 1150, [[0, '#173a33'], [0.45, EMERALD], [1, '#0a1614']]);
      ctx.fillRect(0, 0, 600, 1150);
      damask(ctx, [40, 40, 560, 700], BRASS, 0.05 + 0.04 * s1);
      planks(ctx, 700, 1150, 0.55);

      // Attic: beams fanning from the top, a round window with a moon (awakens with mission 2).
      ctx.save();
      ctx.strokeStyle = rgba('#2a150d', 0.55);
      ctx.lineWidth = 7;
      for (const a of [-150, -125, -100, -80, -55, -30]) {
        const r0 = (a * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(310 + Math.cos(r0) * 60, 300 + Math.sin(r0) * 60);
        ctx.lineTo(310 + Math.cos(r0) * 280, 300 + Math.sin(r0) * 280);
        ctx.stroke();
      }
      ctx.restore();
      // (The window sits 12 units lower than its drawing coordinates, clear of the title.)
      ctx.save();
      ctx.translate(0, 12);
      ctx.save();
      ctx.beginPath();
      ctx.arc(236, 150, 46, 0, TAU);
      ctx.fillStyle = vgrad(ctx, 104, 196, [[0, rgba('#1d3f6e', 0.5 + 0.4 * s2)], [1, rgba('#0b1a2e', 0.7)]]);
      ctx.fill();
      ctx.clip();
      const sr = rng(5);
      for (let i = 0; i < 26; i++) glowDot(ctx, 190 + sr() * 92, 104 + sr() * 92, 2.2, IVORY, 0.25 + 0.6 * s2 * sr());
      glowDot(ctx, 252, 134, 26, IVORY, 0.15 + 0.5 * s2);
      ctx.fillStyle = rgba(IVORY, 0.35 + 0.6 * s2);
      ctx.beginPath();
      ctx.arc(252, 134, 13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#132a48';
      ctx.beginPath();
      ctx.arc(258, 130, 12, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = rgba(BRASS, 0.55 + 0.4 * s2);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(236, 150, 46, 0, TAU);
      ctx.moveTo(190, 150);
      ctx.lineTo(282, 150);
      ctx.moveTo(236, 104);
      ctx.lineTo(236, 196);
      ctx.stroke();
      ctx.restore();
      ctx.restore();

      // The Library (west): bookcases, a reading rug, a balance scale and the density rule.
      bookcase(ctx, 88, 300, 92, 72, 3, s1);
      bookcase(ctx, 92, 640, 60, 48, 8, s1);
      ctx.save();
      ctx.fillStyle = rgba(CRIMSON, 0.18 + 0.12 * s1);
      ctx.beginPath();
      ctx.ellipse(160, 548, 62, 40, -0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(BRASS, 0.3 + 0.3 * s1);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      scaleArt(ctx, 160, 540, 26, s2);
      plaque(ctx, 'density = mass ÷ volume', 162, 600, rgba(BRASS, 0.7 + 0.3 * s2), '#1a1010', 9);
      for (const [x, y] of [[104, 290], [166, 296]] as Pt[]) {
        glowDot(ctx, x, y, 26, LAMP_GREEN, 0.12 + 0.4 * s1);
        glowDot(ctx, x, y, 6, LAMP_GREEN, 0.35 + 0.6 * s1);
      }
      magnifierArt(ctx, 49, 410, 13, s1);
      neonText(ctx, 'LIBRARY', 140, 404, 13, LAMP_GREEN, s1);

      // The Manor House: crimson runner up the Hallway, tiled wings, shingled roof.
      // The runner follows the Hallway: straight up top, leaning toward the left flipper below y 580.
      const lean = (y: number) => (y > 580 ? (580 - y) * (24 / 84) : 0);
      ctx.save();
      poly(ctx, [[268, 470], [304, 470], [304, 580], [304 + lean(708), 708], [268 + lean(708), 708], [268, 580]]);
      ctx.fillStyle = rgba('#5a1d1a', 0.85);
      ctx.fill();
      poly(ctx, [[271, 470], [301, 470], [301, 580], [301 + lean(706), 706], [271 + lean(706), 706], [271, 580]]);
      ctx.strokeStyle = rgba(BRASS, 0.55 + 0.35 * s1 + 0.1 * s4);
      ctx.lineWidth = 2;
      ctx.stroke();
      const runner = rng(14);
      for (let y = 486; y < 704; y += 22) {
        const cx = 286 + lean(y);
        ctx.fillStyle = rgba(s4 > 0.1 ? CANDLE : BRASS, 0.18 + 0.15 * runner() + 0.35 * s4);
        ctx.beginPath();
        ctx.moveTo(cx, y - 6);
        ctx.lineTo(cx + 7, y);
        ctx.lineTo(cx, y + 6);
        ctx.lineTo(cx - 7, y);
        ctx.closePath();
        ctx.fill();
      }
      // West wing floor (density): warm parquet glow.
      poly(ctx, [[200, 450], [234, 416], [286, 468], [262, 512]]);
      ctx.fillStyle = rgba('#7a4a22', 0.45 + 0.4 * s2);
      ctx.fill();
      // East wing floor (solubility): blue tiles.
      poly(ctx, [[372, 450], [338, 416], [286, 468], [310, 512]]);
      ctx.fillStyle = rgba('#2a6f8a', 0.45 + 0.4 * s1);
      ctx.fill();
      // Roof shingles.
      poly(ctx, [[234, 416], [286, 378], [338, 416], [286, 468]]);
      ctx.fillStyle = rgba('#3a1a28', 0.95);
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = rgba('#000000', 0.35);
      ctx.lineWidth = 1;
      for (let y = 380; y < 470; y += 7) {
        ctx.beginPath();
        ctx.moveTo(220, y);
        ctx.lineTo(352, y);
        ctx.stroke();
      }
      ctx.restore();
      glowDot(ctx, 223, 439, 30, CANDLE, 0.08 + 0.45 * s2);
      glowDot(ctx, 349, 439, 30, TEAL, 0.08 + 0.45 * s1);
      // A stained-glass "?" in the roof (the manor's riddle).
      neonText(ctx, '?', 286, 424, 30, CANDLE, 0.25 + 0.75 * s4);
      // Wonderlight: the whole house outline is traced in gold once the case is closed.
      if (s4 > 0.01) {
        neonPath(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(238, 664);
          ctx.lineTo(262, 580);
          ctx.lineTo(262, 512);
          ctx.lineTo(200, 450);
          ctx.lineTo(234, 416);
          ctx.lineTo(286, 378);
          ctx.lineTo(338, 416);
          ctx.lineTo(372, 450);
          ctx.lineTo(310, 512);
          ctx.lineTo(310, 580);
          ctx.lineTo(286, 664);
        }, CANDLE, s4, 3);
      }

      // Station illustrations beside the house.
      beakerArt(ctx, 396, 412, 18, true, s1);
      beakerArt(ctx, 428, 420, 18, false, s1);
      plaque(ctx, 'dissolves?', 412, 446, rgba(TEAL, 0.65 + 0.35 * s1), '#08201c', 9);
      plaque(ctx, 'g/cm³', 200, 492, rgba(CANDLE, 0.65 + 0.35 * s2), '#1a1010', 9);

      // East corridor laboratory floor: checkered tiles.
      ctx.save();
      poly(ctx, [[316, 520], [470, 520], [546, 560], [546, 700], [298, 700], [292, 664], [316, 580]]);
      ctx.clip();
      for (let y = 520; y < 700; y += 20) {
        for (let x = 322; x < 546; x += 20) {
          ctx.fillStyle = ((x - 322) / 20 + (y - 520) / 20) % 2 ? rgba(IVORY, 0.07 + 0.08 * s3) : rgba('#06100f', 0.25);
          ctx.fillRect(x, y, 20, 20);
        }
      }
      ctx.restore();
      // The Secret Lab door (always faintly glowing; gold when the case is closed).
      ctx.save();
      rrect(ctx, 378, 534, 44, 52, 18);
      ctx.fillStyle = rgba('#2a0f0e', 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba(s4 > 0.1 ? CANDLE : TEAL, 0.5 + 0.5 * Math.max(s1, s4));
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
      glowDot(ctx, 400, 560, 60, s4 > 0.1 ? CANDLE : TEAL, 0.1 + 0.25 * s1 + 0.3 * s4);

      // The Furnace: brickwork with glowing coals (awakens with mission 3).
      ctx.save();
      poly(ctx, [[466, 476], [546, 522], [546, 396]]);
      ctx.fillStyle = rgba('#4d1f16', 0.95);
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = rgba('#000000', 0.4);
      ctx.lineWidth = 1;
      for (let y = 396; y < 524; y += 9) {
        ctx.beginPath();
        ctx.moveTo(466, y);
        ctx.lineTo(546, y);
        ctx.stroke();
      }
      glowDot(ctx, 522, 468, 40, EMBER, 0.15 + 0.7 * s3);
      ctx.restore();
      glowDot(ctx, 490, 520, 46, EMBER, 0.06 + 0.3 * s3);
      plaque(ctx, '°C', 520, 548, rgba(EMBER, 0.6 + 0.4 * s3), '#1a0a06', 9);

      // Attic clue plaques.
      plaque(ctx, 'DESCRIBE THE OBJECT', 476, 240, rgba(BRASS, 0.6 + 0.3 * s2), '#1a1008', 10);

      // Detective footprints leading from the flippers to the Hallway (awaken with mission 1).
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const x = 206 + (250 - 206) * t + (i % 2 ? 7 : -7);
        const y = 846 - 124 * t;
        footprint(ctx, x, y, 20, IVORY, 0.1 + 0.3 * stage(level, 0.2 + t * 0.6, 0.6 + t * 0.6));
      }

      // Title and the case motto.
      neonText(ctx, 'MYSTERY MATERIAL MANOR', 310, 92, 18, CANDLE, 0.25 + 0.75 * s2);
      plaque(ctx, 'COLOR ALONE CAN’T IDENTIFY A SUBSTANCE', 286, 884, '#c9ab72', '#1a1008', 10);

      // Wonderlight: warm gold wash and a CASE CLOSED stamp.
      if (s4 > 0.01) {
        ctx.fillStyle = rgba(CANDLE, 0.07 * s4);
        ctx.fillRect(0, 0, 600, 1150);
        ctx.save();
        ctx.translate(140, 452);
        ctx.rotate(-0.22);
        ctx.globalAlpha = 0.8 * s4;
        ctx.strokeStyle = CRIMSON;
        ctx.lineWidth = 3;
        rrect(ctx, -54, -15, 108, 30, 5);
        ctx.stroke();
        ctx.fillStyle = CRIMSON;
        ctx.font = '800 15px "Atkinson Hyperlegible Next", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CASE CLOSED', 0, 1);
        ctx.restore();
      }
    },
    ambient({ ctx, t, level, reduced, energy }) {
      const s1 = stage(level, 0.2, 1);
      // Candle flicker on the library lamps and the furnace.
      const f = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 7.3) * Math.sin(t * 2.9);
      glowDot(ctx, 104, 290, 16, LAMP_GREEN, 0.25 * s1 * f);
      glowDot(ctx, 166, 296, 16, LAMP_GREEN, 0.25 * s1 * f);
      glowDot(ctx, 520, 470, 24, EMBER, (0.08 + 0.3 * stage(level, 2.2, 3) + 0.2 * energy) * f);
      if (!reduced && s1 > 0) drift(ctx, 7, 14, t, IVORY, [60, 120, 540, 760], 6, 1.4, 0.25 * s1);
    },
    celebrate({ ctx, t }, p) {
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.5;
      const g = ctx.createRadialGradient(400, 560, 10, 400, 560, 460);
      g.addColorStop(0, rgba(CANDLE, 0.85));
      g.addColorStop(1, rgba(CANDLE, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 600, 1150);
      ctx.restore();
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + t * 0.5;
        const d = 50 + p * 280;
        glowDot(ctx, 400 + Math.cos(a) * d, 560 + Math.sin(a) * d * 0.85, 9, [CANDLE, TEAL, CRIMSON][i % 3], 1 - p);
      }
    },
  },
};
export default L03;
