// The living dollhouse map: a 3D cutaway mansion whose 29 rooms awaken as Wonderlights return.
// Rooms are also real <button>s positioned over the 3D scene, so the map is fully keyboard
// and screen-reader operable; the list view offers the same access without 3D.

import { useEffect, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { LESSONS, WINGS, type LessonId } from '../../content/curriculum.ts';
import { Materials } from '../../game/render3d/materials.ts';
import { SetKit } from '../../game/render3d/setKit.ts';
import { Stage, detectQuality } from '../../game/render3d/stage.ts';
import { labelTexture } from '../../game/render3d/textures.ts';
import { TABLES } from '../../tables/index.ts';
import { prefersReducedMotion, useSave } from '../store.ts';

interface Props {
  onOpen(id: LessonId): void;
  suggested: LessonId;
}

const ROOM_W = 2.1;
const ROOM_H = 1.7;
const ROOM_D = 1.8;
const FLOOR_GAP = 0.18;

interface RoomEntry {
  id: LessonId;
  group: THREE.Group;
  light: THREE.PointLight;
  wallMat: THREE.MeshStandardMaterial;
  update(t: number, lit: number): void;
  center: THREE.Vector3;
  lit: number;
}

export function DollhouseMap({ onOpen, suggested }: Props) {
  const save = useSave();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [buttons, setButtons] = useState<{ id: LessonId; x: number; y: number; w: number; h: number }[]>([]);
  const [hover, setHover] = useState<LessonId | null>(null);
  const hoverRef = useRef<LessonId | null>(null);
  const zoomRef = useRef<{ id: LessonId; t: number } | null>(null);
  const reduced = prefersReducedMotion(save.settings);

  useEffect(() => {
    hoverRef.current = hover;
  }, [hover]);

  useEffect(() => {
    if (!canvas.current || !wrap.current) return;
    const q = save.settings.quality === 'auto' ? detectQuality() : save.settings.quality;
    const stage = new Stage(canvas.current, q === 'ultra' ? 'high' : q);
    const scene = stage.scene;
    const mats = new Materials();
    scene.background = new THREE.Color('#0b0716');
    scene.fog = new THREE.Fog('#0b0716', 30, 70);
    scene.add(new THREE.HemisphereLight('#9fb4ff', '#1a1030', 0.6));
    const moon = new THREE.DirectionalLight('#cfd8ff', 1.2);
    moon.position.set(-6, 14, 12);
    moon.castShadow = stage.profile.shadows;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -4 });
    scene.add(moon);

    const kit = new SetKit(mats, {
      bg: ['#291B46', '#120c22'], rail: '#c9b8e8', railHighlight: '#ffffff', lampOn: '#FFC75B', lampOff: '#222', accent: '#FF7F86', accent2: '#71E3CF',
      bumperCap: '#ff9fb0', bumperRing: '#3b2466', flipper: '#ffd98a', ink: '#FFF7E7', ramp: '#71E3CF', trail: '#71E3CF',
    }, { detail: stage.profile.detail, reducedMotion: reduced });
    scene.add(kit.root);
    kit.sky('#1c1240', '#05030a');
    kit.ground('#120c22', 60);
    kit.motes({ x0: -16, x1: 16, y0: 0, y1: 14, z0: -6, z1: 6 }, 90, '#FFC75B', { speed: 0.15, size: 0.12 }).setLit(0.6);

    // Mansion shell: floors stacked bottom (Spark) to top (Tomorrow).
    const floors = WINGS.map((w) => w.lessons);
    const maxRooms = Math.max(...floors.map((f) => f.length));
    const totalW = maxRooms * ROOM_W;
    const house = new THREE.Group();
    scene.add(house);
    const wood = mats.wood();
    const trim = mats.paintedMetal('#c9b8e8');
    const rooms: RoomEntry[] = [];
    floors.forEach((ids, fi) => {
      const y = fi * (ROOM_H + FLOOR_GAP);
      const rowW = ids.length * ROOM_W;
      const x0 = -rowW / 2 + ROOM_W / 2;
      // floor slab
      const slab = new THREE.Mesh(new THREE.BoxGeometry(rowW + 0.3, FLOOR_GAP, ROOM_D + 0.3), wood);
      slab.position.set(0, y - FLOOR_GAP / 2, 0);
      slab.receiveShadow = true;
      slab.castShadow = true;
      house.add(slab);
      // wing banner
      const wing = WINGS[fi];
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(rowW * 0.6, 0.22),
        new THREE.MeshBasicMaterial({ map: labelTexture(wing.name, { fg: '#FFC75B', w: 1024, h: 96, size: 60 }), transparent: true }),
      );
      banner.position.set(0, y - FLOOR_GAP / 2, ROOM_D / 2 + 0.16);
      house.add(banner);
      ids.forEach((id, ri) => {
        const g = new THREE.Group();
        g.position.set(x0 + ri * ROOM_W, y, 0);
        house.add(g);
        const wallMat = new THREE.MeshStandardMaterial({ color: '#2a2240', emissive: '#ffb860', emissiveIntensity: 0, roughness: 0.8 });
        const back = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 0.06, ROOM_H, 0.06), wallMat);
        back.position.set(0, ROOM_H / 2, -ROOM_D / 2);
        back.receiveShadow = true;
        const sideGeo = new THREE.BoxGeometry(0.06, ROOM_H, ROOM_D);
        const left = new THREE.Mesh(sideGeo, trim);
        left.position.set(-ROOM_W / 2, ROOM_H / 2, 0);
        const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.04, ROOM_D), mats.plastic('#3a2a55'));
        floor.position.y = 0.02;
        floor.receiveShadow = true;
        g.add(back, left, floor);
        if (ri === ids.length - 1) {
          const right = new THREE.Mesh(sideGeo, trim);
          right.position.set(ROOM_W / 2, ROOM_H / 2, 0);
          g.add(right);
        }
        // nameplate
        const l = LESSONS.find((x) => x.id === id)!;
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(ROOM_W * 0.9, 0.2),
          new THREE.MeshBasicMaterial({ map: labelTexture(`${l.number}. ${l.attractionTitle}`, { fg: '#FFF7E7', bg: 'rgba(20,12,36,0.85)', w: 1024, h: 110, size: 54, radius: 30, font: '"Atkinson Hyperlegible Next", system-ui, sans-serif' }), transparent: true }),
        );
        plate.position.set(0, ROOM_H - 0.16, ROOM_D / 2 - 0.02);
        g.add(plate);
        const light = new THREE.PointLight('#ffcf80', 0, 3, 2);
        light.position.set(0, ROOM_H * 0.75, 0.2);
        g.add(light);
        // room vignette
        const inner = new THREE.Group();
        g.add(inner);
        const roomKit = new SetKit(mats, kit.theme, { detail: stage.profile.detail * 0.6, reducedMotion: reduced });
        inner.add(roomKit.root);
        const def = TABLES[id];
        let updater: (t: number, lit: number) => void;
        if (def?.room) {
          updater = def.room({ kit: roomKit, w: ROOM_W, h: ROOM_H, d: ROOM_D }).update;
        } else {
          const orb = roomKit.orb([0, 0.55, 0], 0.32, ['#FFC75B', '#71E3CF', '#FF7F86', '#9fb4ff'][WINGS.findIndex((w) => w.lessons.includes(id))]);
          const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.2, 20), mats.brass());
          ped.position.y = 0.12;
          roomKit.root.add(ped);
          updater = (t, lit) => {
            orb.setLit(lit);
            orb.position.y = 0.55 + (reduced ? 0 : Math.sin(t * 1.5 + ri) * 0.05);
          };
        }
        const entry: RoomEntry = {
          id, group: g, light, wallMat,
          update: (t, lit) => {
            roomKit.tick(t, 1 / 60);
            updater(t, lit);
          },
          center: new THREE.Vector3(),
          lit: 0,
        };
        g.updateMatrixWorld(true);
        entry.center.copy(g.localToWorld(new THREE.Vector3(0, ROOM_H / 2, ROOM_D / 2)));
        rooms.push(entry);
      });
    });
    // Roof with the beacon
    const topY = floors.length * (ROOM_H + FLOOR_GAP);
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-totalW / 2 - 0.4, 0);
    roofShape.lineTo(0, 2.6);
    roofShape.lineTo(totalW / 2 + 0.4, 0);
    roofShape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: ROOM_D + 0.4, bevelEnabled: false }), mats.plastic('#3b2466'));
    roof.position.set(0, topY - FLOOR_GAP, -ROOM_D / 2 - 0.2);
    roof.castShadow = true;
    house.add(roof);
    const beacon = kit.orb([0, topY + 2.9, 0], 0.45, '#FFC75B');
    const beaconLight = new THREE.PointLight('#FFC75B', 0, 12, 2);
    beaconLight.position.set(0, topY + 2.9, 0.6);
    scene.add(beaconLight);
    house.position.y = 0.2;
    // Rooms' world centers after positioning
    house.updateMatrixWorld(true);
    for (const r of rooms) r.center.copy(r.group.localToWorld(new THREE.Vector3(0, ROOM_H / 2, ROOM_D / 2)));

    // Camera framing
    const cam = stage.camera;
    cam.fov = 34;
    const houseH = topY + 3.4;
    const target = new THREE.Vector3(0, houseH / 2 - 0.4, 0);
    let dist = 20;
    const fit = () => {
      const aspect = stage.width / Math.max(1, stage.height);
      const vFov = THREE.MathUtils.degToRad(cam.fov);
      const needH = houseH / 2 + 0.8;
      const needW = totalW / 2 + 0.8;
      const dH = needH / Math.tan(vFov / 2);
      const dW = needW / (Math.tan(vFov / 2) * aspect);
      dist = Math.max(dH, dW) + ROOM_D;
    };

    const resize = () => {
      const r = wrap.current!.getBoundingClientRect();
      stage.resize(r.width, r.height);
      fit();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);

    // Picking
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const roomOf = (o: THREE.Object3D | null): RoomEntry | undefined => {
      while (o) {
        const r = rooms.find((x) => x.group === o);
        if (r) return r;
        o = o.parent;
      }
      return undefined;
    };
    const pick = (e: PointerEvent) => {
      const rect = canvas.current!.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, cam);
      const hit = ray.intersectObjects(rooms.map((r) => r.group), true)[0];
      return hit ? roomOf(hit.object) : undefined;
    };
    const onMove = (e: PointerEvent) => {
      const r = pick(e);
      setHover(r?.id ?? null);
      canvas.current!.style.cursor = r && TABLES[r.id] ? 'pointer' : 'default';
      parallax.set(pointer.x, pointer.y);
    };
    const onClick = (e: PointerEvent) => {
      const r = pick(e);
      if (r && TABLES[r.id]) zoomRef.current = { id: r.id, t: 0 };
    };
    const parallax = new THREE.Vector2();
    canvas.current.addEventListener('pointermove', onMove);
    canvas.current.addEventListener('click', onClick as EventListener);

    // Loop
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let lastButtons = 0;
    const camPos = new THREE.Vector3();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      const sv = (window as unknown as { __afhSave?: typeof save }).__afhSave ?? save;
      let litCount = 0;
      for (const r of rooms) {
        const want = sv.progress[r.id].wonderlight ? 1 : sv.progress[r.id].missions.filter(Boolean).length * 0.18;
        r.lit += (want - r.lit) * Math.min(1, dt * 2);
        if (sv.progress[r.id].wonderlight) litCount++;
        const isHover = hoverRef.current === r.id;
        r.light.intensity = r.lit * 2.2 + (isHover ? 1.2 : 0);
        r.wallMat.emissiveIntensity = r.lit * 0.35 + (isHover ? 0.15 : 0) + (r.id === suggested && r.lit < 0.5 ? 0.08 + 0.06 * Math.sin(t * 3) : 0);
        r.update(t, Math.max(r.lit, isHover ? 0.35 : 0));
      }
      beacon.setLit(litCount / 29);
      beaconLight.intensity = (litCount / 29) * 6;
      kit.tick(t, dt);
      // Camera: gentle sway + pointer parallax; zoom into a chosen room.
      const sway = reduced ? 0 : Math.sin(t * 0.25) * 0.6;
      camPos.set(sway + parallax.x * 0.8, target.y + 1.2 + parallax.y * 0.5, dist);
      cam.position.copy(camPos);
      cam.lookAt(target);
      const z = zoomRef.current;
      if (z) {
        z.t += dt / (reduced ? 0.01 : 0.9);
        const room = rooms.find((r) => r.id === z.id)!;
        const k = Math.min(1, z.t);
        const e = k * k * (3 - 2 * k);
        cam.position.lerp(room.center.clone().add(new THREE.Vector3(0, 0.1, 1.6)), e);
        cam.lookAt(target.clone().lerp(room.center.clone().add(new THREE.Vector3(0, 0, -1)), e));
        if (z.t >= 1) {
          zoomRef.current = null;
          onOpen(z.id);
          return;
        }
      }
      stage.render(dt);
      // Project room buttons for keyboard/screen-reader access (throttled).
      if (now - lastButtons > 250) {
        lastButtons = now;
        const rect = canvas.current!.getBoundingClientRect();
        const out = rooms.map((r) => {
          const c = r.center.clone().project(cam);
          const half = new THREE.Vector3(r.center.x + ROOM_W / 2, r.center.y + ROOM_H / 2, r.center.z).project(cam);
          return {
            id: r.id,
            x: ((c.x + 1) / 2) * rect.width,
            y: ((1 - c.y) / 2) * rect.height,
            w: Math.abs(half.x - c.x) * rect.width,
            h: Math.abs(half.y - c.y) * rect.height,
          };
        });
        setButtons(out);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.current?.removeEventListener('pointermove', onMove);
      kit.dispose();
      mats.dispose();
      stage.dispose();
    };
  }, []);

  // Keep the latest save visible to the render loop without restarting it.
  (window as unknown as { __afhSave?: typeof save }).__afhSave = save;

  return (
    <div class="dollhouse" ref={wrap}>
      <canvas ref={canvas} class="dollhouse-canvas" aria-hidden="true" />
      <div class="dollhouse-buttons" role="list" aria-label="Rooms of the Fun House">
        {buttons.map((b) => {
          const l = LESSONS.find((x) => x.id === b.id)!;
          const pr = save.progress[b.id];
          const built = !!TABLES[b.id];
          return (
            <div role="listitem" key={b.id}>
              <button
                class={`room-hotspot ${hover === b.id ? 'hover' : ''}`}
                style={{ left: `${b.x - b.w}px`, top: `${b.y - b.h}px`, width: `${b.w * 2}px`, height: `${b.h * 2}px` }}
                aria-label={`Room ${l.number}: ${l.attractionTitle}, lesson ${l.lessonTitle}. ${pr.wonderlight ? 'Wonderlight restored.' : `${pr.missions.filter(Boolean).length} of 3 missions done.`}${built ? '' : ' Under construction.'}`}
                disabled={!built}
                onFocus={() => setHover(b.id)}
                onBlur={() => setHover(null)}
                onClick={() => (zoomRef.current = { id: b.id, t: 0 })}
              />
            </div>
          );
        })}
      </div>
      {hover && (
        <div class="room-tooltip" aria-hidden="true">
          <strong>{LESSONS.find((x) => x.id === hover)!.attractionTitle}</strong>
          <span>Lesson {LESSONS.find((x) => x.id === hover)!.number}: {LESSONS.find((x) => x.id === hover)!.lessonTitle}</span>
        </div>
      )}
    </div>
  );
}
