import { composeScene, encodeCanvas } from '@/export/exportImage';
import { outputSize, ratioValue } from '@/export/settings';
import { prepareBackground } from '@/lib/background';
import { loadAmbience } from '@/scene/ambiences';
import { cameraHandle } from '@/scene/camera';
import { settle } from '@/scene/exporter';
import { loadMaterialMap } from '@/scene/realMaterials';
import { pauseAutosave, snapshot } from '@/store/persistence';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { applyLook, type Look } from './looks';

/*
 * Rendering looks without touching the user's work: the project is changed
 * temporarily (out of the undo history and of the autosave), every look is
 * rendered from the live renderer, then the project and the view are put
 * back exactly as they were.
 */

let queue: Promise<unknown> = Promise.resolve();

/** Resolves once no sandbox is running (the project is the user's again). */
export const whenIdle = () => queue;

/** Runs `fn` on a temporary copy of the project; sandboxes run one after the other. */
export function inSandbox<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(() => sandbox(fn));
  queue = p.catch(() => undefined);
  return p;
}

async function sandbox<T>(fn: () => Promise<T>): Promise<T> {
  const saved = snapshot();
  const view = cameraHandle.save?.();
  const history = useProject.temporal.getState();
  history.pause();
  pauseAutosave(true);
  try {
    return await fn();
  } finally {
    useProject.setState({ ...saved });
    // the framing effect runs on the restored state, then the exact view comes back
    await settle(2);
    if (view) cameraHandle.restore?.(view);
    history.resume();
    pauseAutosave(false);
  }
}

/** Waits until what the current state needs is loaded and drawn. */
async function ready() {
  const { decor, background } = useProject.getState();
  const jobs: Promise<unknown>[] = [prepareBackground(background)];
  const material = decor.kind === 'table' || decor.kind === 'surface' || (decor.kind === 'podium' && decor.podiumFinish === 'material');
  if (material) for (const f of ['color', 'normal', 'rough'] as const) jobs.push(loadMaterialMap(decor.material, f));
  if (decor.kind === 'table') jobs.push(loadAmbience(decor.ambience));
  await Promise.all(jobs.map((j) => j.catch(() => undefined)));
  // framing, then the hooks that pick up loaded textures, then per-frame passes (shadows)
  useUi.getState().resetView();
  await settle(5);
}

/** Puts a look on the scene (inside a sandbox) and waits for it to be drawn. */
export async function showLook(look: Look) {
  applyLook(look);
  await ready();
}

/** Size of a thumbnail at the export ratio. */
export function thumbSize(longSide = 720) {
  const ratio = ratioValue(useProject.getState().export.ratio);
  return ratio >= 1 ? { width: longSide, height: Math.round(longSide / ratio) } : { width: Math.round(longSide * ratio), height: longSide };
}

/** Renders the current (sandboxed) state small, as an object URL. */
export async function renderThumb() {
  const { width, height } = thumbSize();
  const { canvas } = await composeScene({ width, height, supersample: 1.5, samples: 10 });
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.86));
  return URL.createObjectURL(blob);
}

/** Renders the current (sandboxed) state at the export settings. */
export async function renderFull(onProgress?: (done: number, total: number) => void) {
  const settings = useProject.getState().export;
  const { width, height } = outputSize(settings);
  const { canvas } = await composeScene({ width, height, opaque: settings.format === 'jpeg', onProgress });
  return { ...(await encodeCanvas(canvas)), width, height };
}
