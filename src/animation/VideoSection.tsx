import { useState } from 'react';
import { Clapperboard, Film, Play, Square } from 'lucide-react';
import { useT } from '@/i18n';
import { useAssets } from '@/store/assets';
import { useProject, type VideoSettings } from '@/store/project';
import { useUi } from '@/store/ui';
import { Advanced, Button, Field, Segmented, Slider, Switch, cx } from '@/ui/primitives';
import { exportVideo, togglePreview } from './actions';

/** The Export window steps aside while the preview plays, and comes back when it stops. */
function previewFromExport() {
  if (useUi.getState().previewing) return togglePreview();
  useUi.getState().setExportOpen(false);
  useUi.getState().setReopenExport(true);
  return togglePreview();
}
import { ANIMATIONS, hasScrollable } from './animations';
import { AnimationThumb } from './AnimationThumb';
import { videoFps, videoSize } from './size';


/** A titled group of the video tab. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

const hint = 'text-[12px] leading-snug text-fg-muted';

/** Video tab of the Export window: the movement, its length, the file; then preview and export. */
export function VideoSection() {
  const { t } = useT();
  const video = useProject((s) => s.export.video);
  const setExport = useProject((s) => s.setExport);
  const exporting = useUi((s) => s.exporting);
  const previewing = useUi((s) => s.previewing);
  const [hovered, setHovered] = useState<string | null>(null);
  // sizes and the scroll hint follow the images
  useProject((s) => s.export.ratio);
  useProject((s) => s.selectedId);
  useAssets((s) => s.assets);
  const list = ANIMATIONS;
  const current = list.find((a) => a.id === video.animation) ?? list[0];
  const set = (patch: Partial<VideoSettings>) => setExport({ video: { ...video, ...patch } });
  const { width, height } = videoSize();
  const fps = videoFps();
  return (
    <div className="flex flex-col gap-4">
      <Group title={t('video.step.movement')}>
        {(['cinematic', 'classic'] as const).map((g) => {
          const group = list.filter((a) => a.group === g);
          if (!group.length) return null;
          return (
            <div key={g} className="flex flex-col gap-1.5">
              <div className="text-[12px] font-medium text-fg-muted">{t(g === 'cinematic' ? 'video.group.cinematic' : 'video.group.classic')}</div>
              <div className="grid grid-cols-3 gap-2">
                {group.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    data-testid="anim-tile"
                    aria-pressed={current.id === a.id}
                    onClick={() => set({ animation: a.id })}
                    onPointerEnter={() => setHovered(a.id)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(a.id)}
                    onBlur={() => setHovered(null)}
                    className={cx(
                      'flex flex-col items-stretch gap-1.5 rounded-[10px] p-1 pb-2 text-center text-[12px] font-medium leading-tight transition-[background-color,color,box-shadow] duration-150',
                      current.id === a.id ? 'bg-surface-4 text-fg shadow-[0_0_0_1.5px_var(--accent)_inset]' : 'bg-surface-2 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:text-fg',
                    )}
                  >
                    <AnimationThumb id={a.id} playing={hovered === a.id} />
                    {t(a.label)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className={hint}>{t(current.hint)}</p>
        {current.id === 'scroll' && !hasScrollable() && <p className="text-[12px] leading-snug text-accent">{t('video.scrollNone')}</p>}
      </Group>

      <Group title={t('video.step.length')}>
        <Segmented
          value={[6, 10, 15].includes(video.duration) ? String(video.duration) : ''}
          onChange={(d) => set({ duration: Number(d) })}
          options={[6, 10, 15].map((d) => ({ value: String(d), label: `${d} s` }))}
        />
        {!current.loop && (
          <label className="flex cursor-pointer items-center justify-between gap-3 text-[12.5px]">
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-fg">{t('video.loop')}</span>
              <span className={hint}>{t('video.loopHint')}</span>
            </span>
            <Switch checked={!!video.loop} onChange={(loop) => set({ loop })} label={t('video.loop')} />
          </label>
        )}
      </Group>

      <Group title={t('video.step.file')}>
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
          {video.format === 'gif' && <p className={hint}>{t(current.loop ? 'video.gifLoop' : 'video.gif')}</p>}
        </Field>
        {video.format !== 'gif' && (
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
        )}
        <Field label={t('video.quality')}>
          <Segmented
            value={video.quality}
            onChange={(quality) => set({ quality })}
            options={[
              { value: 'cinema', label: t('video.quality.cinema') },
              { value: 'fast', label: t('video.quality.fast') },
            ]}
          />
          <p className={hint}>{t(video.quality === 'cinema' ? 'video.quality.cinemaHint' : 'video.quality.fastHint')}</p>
        </Field>
        <Advanced more={t('ui.more')}>
          <Field label={t('video.exactDuration')} value={`${video.duration} s`}>
            <Slider label={t('video.duration')} min={2} max={15} step={0.5} value={video.duration} onChange={(duration) => set({ duration })} />
          </Field>
          {video.format !== 'gif' && (
            <Field label={t('video.fps')}>
              <Segmented value={String(video.fps)} onChange={(v) => set({ fps: Number(v) as VideoSettings['fps'] })} options={['24', '30', '60'].map((v) => ({ value: v, label: v }))} />
            </Field>
          )}
        </Advanced>
      </Group>

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="text-fg-muted">{t('props.output')}</span>
          <span className="font-medium tabular-nums text-fg" data-testid="video-output">
            {width} × {height} · {fps} {t('video.fpsShort')} · {video.duration} s · {video.format.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button size="lg" onClick={() => void previewFromExport()} disabled={!!exporting} data-testid="video-preview">
            {previewing ? <Square size={14} /> : <Play size={15} />}
            {previewing ? t('video.stop') : t('video.preview')}
          </Button>
          <Button variant="primary" size="lg" onClick={() => void exportVideo()} disabled={!!exporting || previewing} data-testid="video-export">
            {video.format === 'gif' ? <Film size={16} /> : <Clapperboard size={16} />}
            {t('video.export')}
          </Button>
        </div>
      </div>
    </div>
  );
}
