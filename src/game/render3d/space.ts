// Mapping between table units (x right, y toward the drain) and world space
// (X right, Y up, Z toward the player). 100 table units = 1 world unit.

import * as THREE from 'three';
import { TABLE_H, TABLE_W } from '../physics/types.ts';

export const K = 0.01;
export const TW = TABLE_W * K;
export const TH = TABLE_H * K;
export const wx = (x: number) => (x - TABLE_W / 2) * K;
export const wz = (y: number) => (y - TABLE_H / 2) * K;
export const wy = (h: number) => h * K;

export function v3(x: number, y: number, h = 0): THREE.Vector3 {
  return new THREE.Vector3(wx(x), wy(h), wz(y));
}

/** A THREE.Shape in the X/-Z plane from table points (use with rotateX(-PI/2) geometry). */
export function shapeFrom(points: [number, number][], ox = 0, oy = 0): THREE.Shape {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => {
    const px = (x - ox) * K;
    const py = -(y - oy) * K;
    if (i === 0) s.moveTo(px, py);
    else s.lineTo(px, py);
  });
  s.closePath();
  return s;
}

/** Extrude a shape upward (Y) by `height` world units, base at y0. */
export function extrudeUp(shape: THREE.Shape, height: number, bevel = 0.01, curveSegments = 12): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}
