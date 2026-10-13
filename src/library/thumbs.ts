import { hasRenderer } from '@/scene/exporter';
import { sandboxRunning } from '@/variants/render';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { storeThumb, useLibrary } from './store';

/*
 * Project thumbnails for the home page: a small render taken a few seconds
 * after the user stops changing things (at most every 30 s), and right after
 * an export. Never while a render or an animation preview is running.
 */

const W = 480;
let timer: ReturnType<typeof setTimeout> | undefined;
/** When each project last got a thumbnail (a new project gets its first one quickly). */
const last = new Map<string, number>();
let busy = false;

async function render(): Promise<Blob | null> {
  const p = useProject.getState();
  let source: HTMLCanvasElement;
  if (p.mode === 'photo') {
    if (!p.photo.assetId) return null;
    const { composePhoto } = await import('@/photo/exportPhoto');
    source = (await composePhoto()).canvas;
  } else {
    if (!hasRenderer()) return null;
    const { composeScene } = await import('@/export/exportImage');
    source = (await composeScene({ width: W, height: Math.round(W * 9 / 16), supersample: 1, samples: 1 })).canvas;
  }
  const out = document.createElement('canvas');
  out.width = W;
  out.height = Math.round((W * source.height) / source.width);
  out.getContext('2d')!.drawImage(source, 0, 0, out.width, out.height);
  return new Promise((res) => out.toBlob((b) => res(b), 'image/jpeg', 0.82));
}

/** Takes the current project's thumbnail now (if the editor can render it). */
/** A thumbnail can be taken now (no export, preview or render sandbox running). */
export function canCapture() {
  const ui = useUi.getState();
  return !busy && !ui.exporting && !ui.previewing && !sandboxRunning() && (ui.screen === 'studio' || ui.screen === 'photo');
}

export async function captureThumb() {
  const id = useLibrary.getState().currentId;
  if (!id || !canCapture()) {
    // busy editor: try again a little later (not from other screens, nothing to capture there)
    const screen = useUi.getState().screen;
    if (id && (screen === 'studio' || screen === 'photo')) scheduleThumb(4000);
    return;
  }
  busy = true;
  try {
    const blob = await render();
    if (blob && useLibrary.getState().currentId === id) {
      await storeThumb(id, blob);
      last.set(id, Date.now());
    }
  } catch {
    /* a missing thumbnail is not worth an error */
  } finally {
    busy = false;
  }
}

/** Asks for a thumbnail `delay` ms from now (later calls push it back). */
export function scheduleThumb(delay = 4000) {
  clearTimeout(timer);
  const id = useLibrary.getState().currentId;
  const before = id ? last.get(id) : undefined;
  const wait = before ? Math.max(delay, 30000 - (Date.now() - before)) : delay;
  timer = setTimeout(() => void captureThumb(), wait);
}

/** Keeps thumbnails fresh while the user edits. */
export function startThumbs() {
  useProject.subscribe(() => scheduleThumb());
}
