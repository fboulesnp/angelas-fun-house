// MansionView hosts the 3D mansion: an establishing shot behind the title screen, and the
// living dollhouse map whose façade swings open. In map mode every room is also a real
// <button> positioned over the 3D room, so the map is fully keyboard and screen-reader usable.

import { useEffect, useRef, useState } from 'preact/hooks';
import { LESSONS, type LessonId } from '../../content/curriculum.ts';
import { MansionScene, type SceneMode } from '../scene/MansionScene.ts';
import { hasTable } from '../../tables/index.ts';
import { prefersReducedMotion, useSave } from '../store.ts';

interface Props {
  mode: SceneMode;
  onOpen?(id: LessonId): void;
  suggested?: LessonId;
  /** Celebration tour of these rooms. */
  parade?: { ids: LessonId[]; onRoom(id: LessonId, i: number): void; onDone(): void };
}

export function MansionView({ mode, onOpen, suggested, parade }: Props) {
  const save = useSave();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MansionScene | null>(null);
  const [rects, setRects] = useState<{ id: LessonId; x: number; y: number; w: number; h: number }[]>([]);
  const [hover, setHover] = useState<LessonId | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvas.current || !wrap.current) return;
    let scene: MansionScene;
    try {
      scene = new MansionScene(canvas.current, save, {
        reducedMotion: prefersReducedMotion(save.settings),
        quality: save.settings.quality === 'auto' ? undefined : save.settings.quality,
      });
    } catch (e) {
      console.warn('Mansion scene unavailable', e);
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    scene.setMode(mode);
    if (parade) scene.startParade(parade.ids, parade.onRoom, parade.onDone);
    const resize = () => {
      const r = wrap.current!.getBoundingClientRect();
      scene.resize(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);
    let raf = 0;
    let last = performance.now();
    let lastRects = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      scene.render(dt);
      if (mode === 'map' && now - lastRects > 200) {
        lastRects = now;
        const r = canvas.current!.getBoundingClientRect();
        setRects(scene.roomRects(r.width, r.height));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const toNdc = (e: PointerEvent): [number, number] => {
      const r = canvas.current!.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = toNdc(e);
      scene.setPointer(x, y);
      if (mode !== 'map') return;
      const id = scene.pick(x, y);
      scene.hover = id;
      setHover(id);
      canvas.current!.style.cursor = id && hasTable(id) ? 'pointer' : 'default';
    };
    const onClick = (e: MouseEvent) => {
      if (mode !== 'map') return;
      const [x, y] = toNdc(e as PointerEvent);
      const id = scene.pick(x, y);
      if (id && hasTable(id) && onOpen) scene.zoomInto(id, () => onOpen(id));
    };
    canvas.current.addEventListener('pointermove', onMove);
    canvas.current.addEventListener('click', onClick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.current?.removeEventListener('pointermove', onMove);
      canvas.current?.removeEventListener('click', onClick);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    sceneRef.current?.setSave(save);
  }, [save]);

  if (failed) return null;
  return (
    <div class={`mansion-view ${mode}`} ref={wrap}>
      <canvas ref={canvas} class="mansion-canvas" aria-hidden="true" />
      {mode === 'map' && !parade && (
        <>
          <div class="dollhouse-buttons" role="list" aria-label="Rooms of the Fun House">
            {rects.map((b) => {
              const l = LESSONS.find((x) => x.id === b.id)!;
              const pr = save.progress[b.id];
              const built = hasTable(b.id);
              return (
                <div role="listitem" key={b.id}>
                  <button
                    class={`room-hotspot ${hover === b.id ? 'hover' : ''}`}
                    style={{ left: `${b.x - b.w}px`, top: `${b.y - b.h}px`, width: `${b.w * 2}px`, height: `${b.h * 2}px` }}
                    aria-label={`Room ${l.number}: ${l.attractionTitle}, lesson ${l.lessonTitle}. ${pr.wonderlight ? 'Wonderlight restored.' : `${pr.missions.filter(Boolean).length} of 3 missions done.`}${b.id === suggested ? ' Suggested next.' : ''}${built ? '' : ' Under construction.'}`}
                    disabled={!built}
                    onFocus={() => {
                      setHover(b.id);
                      if (sceneRef.current) sceneRef.current.focusRoom = b.id;
                    }}
                    onBlur={() => {
                      setHover(null);
                      if (sceneRef.current) sceneRef.current.focusRoom = null;
                    }}
                    onClick={() => onOpen && sceneRef.current?.zoomInto(b.id, () => onOpen(b.id))}
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
        </>
      )}
    </div>
  );
}

/** Back-compat name used by the mansion screen. */
export function DollhouseMap({ onOpen, suggested }: { onOpen(id: LessonId): void; suggested: LessonId }) {
  return <MansionView mode="map" onOpen={onOpen} suggested={suggested} />;
}
