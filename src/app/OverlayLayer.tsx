import { accentColor } from '@/ui/accent';
import { useEffect, useRef, useState } from 'react';
import { paintOverlays, prepareOverlays, type OverlayBox } from '@/lib/overlays';
import { useAssets } from '@/store/assets';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';

const SNAP = 0.012;

/**
 * Preview of the text / logo layers, painted by the exporter's own painter.
 * Pointer handling runs in the capture phase on the frame, so a press on a
 * layer selects / drags it instead of orbiting the camera.
 */
export function OverlayLayer({
  width,
  height,
  frame,
  events,
}: {
  width: number;
  height: number;
  frame: React.RefObject<HTMLDivElement | null>;
  /** Where presses are listened to (the scene area around the frame); positions stay relative to the frame. */
  events?: React.RefObject<HTMLElement | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlays = useProject((s) => s.overlays);
  const brand = useProject((s) => s.brand);
  const selectedId = useUi((s) => s.selectedOverlayId);
  const assets = useAssets((s) => s.assets);
  const boxes = useRef<OverlayBox[]>([]);
  const [guides, setGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width || !height) return;
    let alive = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    prepareOverlays(overlays, brand).then(() => {
      if (!alive) return;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      boxes.current = paintOverlays(ctx, overlays, c.width, c.height, brand).map((b) => ({ ...b, x: b.x / dpr, y: b.y / dpr, w: b.w / dpr, h: b.h / dpr }));
      const sel = boxes.current.find((b) => b.id === selectedId);
      if (sel) {
        ctx.save();
        ctx.strokeStyle = accentColor();
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([5 * dpr, 4 * dpr]);
        const pad = 6;
        ctx.strokeRect((sel.x - pad) * dpr, (sel.y - pad) * dpr, (sel.w + pad * 2) * dpr, (sel.h + pad * 2) * dpr);
        ctx.restore();
      }
    });
    return () => {
      alive = false;
    };
  }, [overlays, brand, selectedId, width, height, assets]);

  useEffect(() => {
    const el = frame.current;
    const target = events?.current ?? el;
    if (!el || !target) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const hit = [...boxes.current].reverse().find((b) => px >= b.x - 6 && px <= b.x + b.w + 6 && py >= b.y - 6 && py <= b.y + b.h + 6);
      if (!hit) {
        useUi.getState().selectOverlay(null);
        return;
      }
      // Ours: keep the camera still.
      e.stopPropagation();
      e.preventDefault();
      useUi.getState().selectOverlay(hit.id);
      const o = useProject.getState().overlays.find((x) => x.id === hit.id);
      if (!o) return;
      const start = { x: o.x, y: o.y, px, py };
      const move = (ev: PointerEvent) => {
        let x = start.x + (ev.clientX - r.left - start.px) / r.width;
        let y = start.y + (ev.clientY - r.top - start.py) / r.height;
        const sx = Math.abs(x - 0.5) < SNAP;
        const sy = Math.abs(y - 0.5) < SNAP;
        if (sx) x = 0.5;
        if (sy) y = 0.5;
        setGuides({ x: sx, y: sy });
        useProject.getState().updateOverlay(hit.id, { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
      };
      const up = () => {
        setGuides({ x: false, y: false });
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    target.addEventListener('pointerdown', onDown, { capture: true });
    return () => target.removeEventListener('pointerdown', onDown, { capture: true });
  }, [frame, events]);

  return (
    <>
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 z-10 h-full w-full" />
      {guides.x && <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px bg-accent/80" />}
      {guides.y && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-accent/80" />}
    </>
  );
}
