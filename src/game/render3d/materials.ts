// Shared PBR material factory. Materials are cached per (kind, colour) so hundreds of rail
// segments and toys share GPU programs and uniforms.

import * as THREE from 'three';
import { brushedRoughness, noiseTexture, woodTexture } from './textures.ts';

export class Materials {
  private cache = new Map<string, THREE.Material>();
  /** Glow materials whose intensity animates with lamp state. */
  readonly animated: THREE.MeshStandardMaterial[] = [];

  private get<T extends THREE.Material>(key: string, make: () => T): T {
    const hit = this.cache.get(key);
    if (hit) return hit as T;
    const m = make();
    this.cache.set(key, m);
    return m;
  }

  chrome(): THREE.MeshPhysicalMaterial {
    return this.get('chrome', () => new THREE.MeshPhysicalMaterial({ color: 0xdfe3f0, metalness: 1, roughness: 0.22, roughnessMap: brushedRoughness(), envMapIntensity: 1 }));
  }

  brass(): THREE.MeshPhysicalMaterial {
    return this.get('brass', () => new THREE.MeshPhysicalMaterial({ color: 0xe8b860, metalness: 1, roughness: 0.28, envMapIntensity: 1.1 }));
  }

  /** Painted metal (guides) in a theme colour. */
  paintedMetal(color: string): THREE.MeshPhysicalMaterial {
    return this.get(`painted:${color}`, () => new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  }

  plastic(color: string, opts: { emissive?: string; transparent?: boolean; opacity?: number } = {}): THREE.MeshPhysicalMaterial {
    return this.get(`plastic:${color}:${JSON.stringify(opts)}`, () => new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08,
      emissive: opts.emissive ?? '#000000', transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
      bumpMap: noiseTexture(), bumpScale: 0.002,
    }));
  }

  /** Clear tinted ramp plastic. */
  clearPlastic(tint: string, opacity = 0.32): THREE.MeshPhysicalMaterial {
    return this.get(`clear:${tint}:${opacity}`, () => new THREE.MeshPhysicalMaterial({
      color: tint, metalness: 0, roughness: 0.08, transparent: true, opacity, clearcoat: 1, clearcoatRoughness: 0.04,
      side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.7,
    }));
  }

  rubber(color = '#f4efe6'): THREE.MeshStandardMaterial {
    return this.get(`rubber:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 }));
  }

  wood(): THREE.MeshPhysicalMaterial {
    return this.get('wood', () => new THREE.MeshPhysicalMaterial({ map: woodTexture(), roughness: 0.42, clearcoat: 0.9, clearcoatRoughness: 0.12 }));
  }

  dark(): THREE.MeshStandardMaterial {
    return this.get('dark', () => new THREE.MeshStandardMaterial({ color: 0x0c0814, roughness: 0.9 }));
  }

  /** Emissive glow (neon, lamps). Intensity is driven per frame by lamp states. */
  glow(color: string, intensity = 2.2, unique = false): THREE.MeshStandardMaterial {
    const make = () => {
      const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0, toneMapped: true });
      if (unique) this.animated.push(m);
      return m;
    };
    return unique ? make() : this.get(`glow:${color}:${intensity}`, make);
  }

  /** Unlit insert plastic that is lit by setting emissiveIntensity. */
  insert(color: string): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color).multiplyScalar(0.25), emissive: color, emissiveIntensity: 0.05,
      roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.92,
    });
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    for (const m of this.animated) m.dispose();
    this.cache.clear();
    this.animated.length = 0;
  }
}
