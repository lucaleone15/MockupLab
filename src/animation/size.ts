import { ratioValue } from '@/export/settings';
import { photoOutputSize } from '@/photo/exportPhoto';
import { useProject } from '@/store/project';

const SHORT = { '720': 720, '1080': 1080, '4k': 2160 } as const;
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
/** GIFs stay light: 640 px on the long side, 20 frames per second at most. */
const GIF_LONG = 640;
const GIF_FPS = 20;

/** Pixel size of the video for the current settings (even numbers, as encoders need). */
export function videoSize() {
  const p = useProject.getState();
  const v = p.export.video;
  let ratio = ratioValue(p.export.ratio);
  if (p.mode === 'photo') {
    const s = photoOutputSize();
    ratio = s.width && s.height ? s.width / s.height : 1.5;
  }
  if (v.format === 'gif') return ratio >= 1 ? { width: GIF_LONG, height: even(GIF_LONG / ratio) } : { width: even(GIF_LONG * ratio), height: GIF_LONG };
  const short = SHORT[v.resolution];
  return ratio >= 1 ? { width: even(short * ratio), height: short } : { width: short, height: even(short / ratio) };
}

export const videoFps = () => {
  const v = useProject.getState().export.video;
  return v.format === 'gif' ? Math.min(GIF_FPS, v.fps) : v.fps;
};
