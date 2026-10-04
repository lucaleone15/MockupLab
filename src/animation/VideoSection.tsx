import { Clapperboard, Film, Move3d, MoveVertical, Play, RefreshCw, Rotate3d, Square, Waves, ZoomIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { useAssets } from '@/store/assets';
import { useProject, type AnimationId, type VideoSettings } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Field, Segmented, Slider, cx } from '@/ui/primitives';
import { exportVideo, togglePreview } from './actions';
import { animationsFor, hasScrollable } from './animations';
import { videoFps, videoSize } from './size';

const ICONS: Record<AnimationId, ReactNode> = {
  turntable: <Rotate3d size={18} />,
  swing: <RefreshCw size={18} />,
  orbit: <Move3d size={18} />,
  scroll: <MoveVertical size={18} />,
  float: <Waves size={18} />,
  zoom: <ZoomIn size={18} />,
};

/** Export tab, video mode: animation, timing, size, format, preview and export. */
export function VideoSection() {
  const { t } = useT();
  const mode = useProject((s) => s.mode);
  const video = useProject((s) => s.export.video);
  const setExport = useProject((s) => s.setExport);
  const exporting = useUi((s) => s.exporting);
  const previewing = useUi((s) => s.previewing);
  // sizes and the scroll hint follow the images and the photo
  useProject((s) => s.export.ratio);
  useProject((s) => `${s.photo.assetId}:${s.selectedId}`);
  useAssets((s) => s.assets);
  const list = animationsFor(mode);
  const current = list.find((a) => a.id === video.animation) ?? list[0];
  const set = (patch: Partial<VideoSettings>) => setExport({ video: { ...video, ...patch } });
  const { width, height } = videoSize();
  const fps = videoFps();

  return (
    <>
      <Field label={t('video.animation')}>
        <div className="grid grid-cols-3 gap-1.5">
          {list.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => set({ animation: a.id })}
              className={cx(
                'flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-[background-color,color,box-shadow] duration-150',
                current.id === a.id ? 'bg-surface-4 text-fg shadow-[0_0_0_1px_var(--accent)_inset]' : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
              )}
            >
              <span className={current.id === a.id ? 'text-accent' : ''}>{ICONS[a.id]}</span>
              {t(a.label)}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-fg-subtle">{t(current.hint)}</p>
        {current.id === 'scroll' && !hasScrollable() && <p className="text-[11px] leading-snug text-accent">{t('video.scrollNone')}</p>}
      </Field>
      <Field label={t('video.duration')} value={`${video.duration} s`}>
        <Slider label={t('video.duration')} min={2} max={12} step={0.5} value={video.duration} onChange={(duration) => set({ duration })} />
      </Field>
      <Field label={t('video.format')}>
        <Segmented
          value={video.format}
          onChange={(format) => set({ format })}
          options={[
            { value: 'mp4', label: 'MP4' },
            { value: 'webm', label: 'WebM' },
            { value: 'gif', label: 'GIF' },
          ]}
        />
      </Field>
      {video.format !== 'gif' ? (
        <>
          <Field label={t('video.size')}>
            <Segmented
              value={video.resolution}
              onChange={(resolution) => set({ resolution })}
              options={[
                { value: '720', label: '720p' },
                { value: '1080', label: '1080p' },
                { value: '4k', label: '4K' },
              ]}
            />
          </Field>
          <Field label={t('video.fps')}>
            <Segmented value={String(video.fps)} onChange={(v) => set({ fps: Number(v) as VideoSettings['fps'] })} options={['24', '30', '60'].map((v) => ({ value: v, label: v }))} />
          </Field>
        </>
      ) : (
        <p className="text-[11.5px] leading-snug text-fg-subtle">{t(current.loop ? 'video.gifLoop' : 'video.gif')}</p>
      )}
      <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[12px] shadow-[0_0_0_1px_var(--line)_inset]">
        <span className="text-fg-muted">{t('props.output')}</span>
        <span className="font-mono tabular-nums">
          {width} × {height}
          <span className="text-fg-subtle">
            {' '}
            · {fps} {t('video.fpsShort')} · {video.duration} s
          </span>
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button size="lg" onClick={() => void togglePreview()} disabled={!!exporting} data-testid="video-preview">
          {previewing ? <Square size={14} /> : <Play size={15} />}
          {previewing ? t('video.stop') : t('video.preview')}
        </Button>
        <Button variant="primary" size="lg" onClick={() => void exportVideo()} disabled={!!exporting || previewing} data-testid="video-export">
          {video.format === 'gif' ? <Film size={16} /> : <Clapperboard size={16} />}
          {t('video.export')}
        </Button>
      </div>
    </>
  );
}
