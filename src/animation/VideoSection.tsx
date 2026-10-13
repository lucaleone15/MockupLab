import { ArrowDownToLine, Aperture, Clapperboard, Crop, Film, Focus, Move3d, MoveVertical, Play, RefreshCw, Rotate3d, ScanEye, Smartphone, Square, TrendingUp, Waves, ZoomIn } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { useAssets } from '@/store/assets';
import { useProject, type AnimationId, type VideoSettings } from '@/store/project';
import { useUi } from '@/store/ui';
import { Button, Field, Segmented, Slider, Switch, Tooltip, cx } from '@/ui/primitives';
import { exportVideo, togglePreview } from './actions';
import { animationsFor, hasScrollable } from './animations';
import { videoFps, videoSize } from './size';

const ICONS: Record<AnimationId, ReactNode> = {
  reveal: <Aperture size={18} />,
  dive: <ScanEye size={18} />,
  dutch: <Crop size={18} />,
  flip: <RefreshCw size={18} className="rotate-90" />,
  drop: <ArrowDownToLine size={18} />,
  crane: <TrendingUp size={18} />,
  vertigo: <Focus size={18} />,
  trailer: <Clapperboard size={18} />,
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

  // vertical, 1080 × 1920, 30 fps, 10 s, MP4: ready for Reels and TikTok
  const reel = () => {
    setExport({ ratio: 'story', video: { ...video, resolution: '1080', fps: 30, duration: 10, format: 'mp4' } });
  };
  return (
    <>
      {mode === 'scene' && (
        <Tooltip label={t('video.reelHint')}>
          <Button onClick={reel} className="w-full">
            <Smartphone size={15} />
            {t('video.reel')}
          </Button>
        </Tooltip>
      )}
      <Field label={t('video.animation')}>
        {(['cinematic', 'classic'] as const).map((g) => {
          const group = list.filter((a) => a.group === g);
          if (!group.length) return null;
          return (
            <div key={g} className="flex flex-col gap-1.5">
              {mode === 'scene' && <div className="text-[12px] font-medium text-fg-muted">{t(g === 'cinematic' ? 'video.group.cinematic' : 'video.group.classic')}</div>}
              <div className="grid grid-cols-3 gap-1.5">
                {group.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => set({ animation: a.id })}
                    className={cx(
                      'flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg px-1 text-center text-[11px] font-medium leading-tight transition-[background-color,color,box-shadow] duration-150',
                      current.id === a.id ? 'bg-surface-4 text-fg shadow-[0_0_0_1px_var(--accent)_inset]' : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
                    )}
                  >
                    <span className={current.id === a.id ? 'text-accent' : ''}>{ICONS[a.id]}</span>
                    {t(a.label)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="text-[11px] leading-snug text-fg-subtle">{t(current.hint)}</p>
        {current.id === 'scroll' && !hasScrollable() && <p className="text-[11px] leading-snug text-accent">{t('video.scrollNone')}</p>}
      </Field>
      {mode === 'scene' && (
        <Field label={t('video.quality')}>
          <Segmented
            value={video.quality}
            onChange={(quality) => set({ quality })}
            options={[
              { value: 'cinema', label: t('video.quality.cinema') },
              { value: 'fast', label: t('video.quality.fast') },
            ]}
          />
          <p className="text-[11px] leading-snug text-fg-subtle">{t(video.quality === 'cinema' ? 'video.quality.cinemaHint' : 'video.quality.fastHint')}</p>
        </Field>
      )}
      <Field label={t('video.duration')} value={`${video.duration} s`}>
        <Segmented
          size="sm"
          value={[6, 10, 15].includes(video.duration) ? String(video.duration) : ''}
          onChange={(d) => set({ duration: Number(d) })}
          options={[6, 10, 15].map((d) => ({ value: String(d), label: `${d} s` }))}
        />
        <Slider label={t('video.duration')} min={2} max={15} step={0.5} value={video.duration} onChange={(duration) => set({ duration })} />
      </Field>
      {!current.loop && (
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[12.5px]" title={t('video.loopHint')}>
          <span className="text-fg-muted">{t('video.loop')}</span>
          <Switch checked={!!video.loop} onChange={(loop) => set({ loop })} label={t('video.loop')} />
        </label>
      )}
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
        <span className="tabular-nums">
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
