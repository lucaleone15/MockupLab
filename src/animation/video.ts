import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, getFirstEncodableVideoCodec, type VideoCodec } from 'mediabunny';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { t } from '@/i18n';
import { composeScene, download, formatBytes } from '@/export/exportImage';
import { prepareBackground } from '@/lib/background';
import { loadAmbience } from '@/scene/ambiences';
import { settle } from '@/scene/exporter';
import { loadMaterialMap } from '@/scene/realMaterials';
import { useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { inSandbox } from '@/variants/render';
import { ANIMATIONS, loops, rigFor, shutterTimes } from './animations';
import { videoFps, videoSize } from './size';

/*
 * Video export: every frame is rendered offline at its exact time (no screen
 * capture, so no dropped frames whatever the machine), then encoded with
 * WebCodecs into MP4 (H.264) or WebM (VP9), or quantised into a GIF.
 */

/** Loads what the scene needs (materials, light) and lets it draw. */
async function ready() {
  const { decor, background } = useProject.getState();
  const jobs: Promise<unknown>[] = [prepareBackground(background)];
  if (decor.kind === 'table' || decor.kind === 'surface' || (decor.kind === 'podium' && decor.podiumFinish === 'material'))
    for (const f of ['color', 'normal', 'rough'] as const) jobs.push(loadMaterialMap(decor.material, f));
  if (decor.kind === 'table') jobs.push(loadAmbience(decor.ambience));
  await Promise.all(jobs.map((j) => j.catch(() => undefined)));
  await settle(4);
}

interface Encoder {
  add(index: number): Promise<void>;
  finish(): Promise<Blob>;
}

async function videoEncoder(canvas: HTMLCanvasElement, format: 'mp4' | 'webm', fps: number): Promise<Encoder> {
  const { width, height } = canvas;
  const candidates: VideoCodec[] = format === 'mp4' ? ['avc', 'hevc'] : ['vp9', 'vp8', 'av1'];
  const codec = await getFirstEncodableVideoCodec(candidates, { width, height, bitrate: QUALITY_HIGH });
  if (!codec) throw new Error(t('video.unsupported', { format: format.toUpperCase() }));
  const output = new Output({ format: format === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  return {
    add: (i) => source.add(i / fps, 1 / fps),
    async finish() {
      await output.finalize();
      return new Blob([output.target.buffer!], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
    },
  };
}

function gifEncoder(canvas: HTMLCanvasElement, fps: number, loop: boolean): Encoder {
  const gif = GIFEncoder();
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return {
    async add() {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette, delay: Math.round(1000 / fps), repeat: loop ? 0 : -1 });
    },
    async finish() {
      gif.finish();
      return new Blob([gif.bytes().slice()], { type: 'image/gif' });
    },
  };
}

let cancelled = 0;

/** Renders the clip of the export settings and returns the encoded file. */
export async function renderVideo(onProgress?: (done: number, total: number) => void) {
  const token = ++cancelled;
  const p = useProject.getState();
  const v = p.export.video;
  const def = ANIMATIONS.find((a) => a.id === v.animation) ?? ANIMATIONS[0];
  const { width, height } = videoSize();
  const fps = videoFps();
  const frames = Math.max(2, Math.round(v.duration * fps));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: v.format === 'gif' })!;
  ctx.imageSmoothingQuality = 'high';
  const looping = loops(def, v);
  const encoder = v.format === 'gif' ? gifEncoder(canvas, fps, looping) : await videoEncoder(canvas, v.format, fps);
  const cinema = v.quality === 'cinema';

  await inSandbox(async () => {
    const rig = rigFor(def, v);
    await ready();
    // motion blur: each frame averages instants spread over half a frame interval (a 180° shutter)
    const step = looping ? 1 / frames : 1 / (frames - 1);
    const subAt = (t: number) => (cinema ? (rig.blur?.(t) ?? 6) : 1);
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const lctx = layer.getContext('2d')!;
    const instant = async (r: typeof rig, time: number) => {
      r.at(time);
      // moving devices: the view redraws once (contact shadows); camera moves need nothing
      if (r.moves) await settle(1);
      const dof = useProject.getState().camera.dof && useProject.getState().camera.aperture > 0;
      const { canvas: f } = await composeScene({ width, height, supersample: width * height > 2.5e6 ? 1 : 1.5, samples: dof ? (cinema ? 2 : 8) : 1, opaque: true });
      return f;
    };
    for (let i = 0; i < frames; i++) {
      if (token !== cancelled) throw new Error('cancelled');
      // a loop ends just before its start; a move goes from start to end
      const time = looping ? i / frames : i / (frames - 1);
      const layers = rig.layers ? rig.layers(time) : [{ rig, t: time, weight: 1, scale: 1 }];
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      const sub = subAt(time);
      for (const [li, l] of layers.entries()) {
        // average of the instants of this shot
        // shutter: half a frame interval, in the shot's own time
        for (const [k, tt] of shutterTimes(l.t, sub, step, l.scale, def.loop).entries()) {
          if (token !== cancelled) throw new Error('cancelled');
          const f = await instant(l.rig, tt);
          lctx.globalAlpha = 1 / (k + 1);
          lctx.drawImage(f, 0, 0);
        }
        // shots cross-fade (montage)
        ctx.globalAlpha = li === 0 ? 1 : Math.min(1, l.weight / (l.weight + layers[0].weight));
        ctx.drawImage(layer, 0, 0);
      }
      ctx.globalAlpha = 1;
      await encoder.add(i);
      onProgress?.(i + 1, frames);
    }
  });
  const blob = await encoder.finish();
  const ext = v.format === 'gif' ? 'gif' : v.format;
  return { blob, width, height, filename: `mockuplab-${def.id}-${width}x${height}-${v.duration}s.${ext}` };
}

/** Export button in video mode: renders with progress, then downloads. */
export async function exportVideo() {
  const ui = useUi.getState();
  if (ui.exporting) return;
  const label = () => t('video.rendering');
  ui.setExporting(label());
  ui.setCancelExport(() => {
    cancelled++;
  });
  try {
    const res = await renderVideo((done, total) => useUi.getState().setExporting(`${label()} ${Math.round((done / total) * 100)} %`));
    const p = useProject.getState();
    download(res.blob, res.filename, { kind: 'video', format: p.export.video.format, width: res.width, height: res.height, ratio: p.export.ratio, duration: p.export.video.duration, animation: p.export.video.animation });
    toast.success(t('video.done', { w: res.width, h: res.height, size: formatBytes(res.blob.size) }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'cancelled') toast.info(t('video.cancelled'));
    else toast.error(t('export.failed', { reason: msg }));
  } finally {
    useUi.getState().setExporting(null);
    useUi.getState().setCancelExport(null);
  }
}

/* ------------------------------------------------------------ preview */

let stopPreview: (() => void) | null = null;

/** Plays the animation live in the viewport until stopped (the scene is restored afterwards). */
export function togglePreview() {
  if (stopPreview) {
    stopPreview();
    return;
  }
  const p = useProject.getState();
  const v = p.export.video;
  const def = ANIMATIONS.find((a) => a.id === v.animation) ?? ANIMATIONS[0];
  useUi.getState().setPreviewing(true);
  void inSandbox(
    () =>
      new Promise<void>((resolve) => {
        const rig = rigFor(def, v);
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
          const s = (now - start) / 1000 / v.duration;
          // a move plays, holds a moment, and starts again
          const time = loops(def, v) ? s % 1 : Math.min(1, (s % 1.15) / 1);
          rig.at(time);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        stopPreview = () => {
          cancelAnimationFrame(raf);
          stopPreview = null;
          resolve();
        };
      }),
  ).finally(() => useUi.getState().setPreviewing(false));
}
