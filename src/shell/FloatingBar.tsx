import { ChevronDown, Check, GalleryHorizontal, Maximize2, Minus, PanelsTopLeft, Plus, Scan, Sparkles } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useT } from '@/i18n';
import { RATIOS, SOCIAL, carouselOf, socialOf } from '@/export/settings';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { variants } from '@/variants/store';
import { Tooltip, cx } from '@/ui/primitives';

const btn = 'flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg';

/** Output format, recenter, full-screen preview and Ideas, floating over the stage. */
export function FloatingBar({ onFullscreen }: { onFullscreen: () => void }) {
  const { t, tr } = useT();
  const ratio = useProject((s) => s.export.ratio);
  const setExport = useProject((s) => s.setExport);
  const social = socialOf(ratio);
  const carousel = carouselOf(ratio);
  const shape = ratio.endsWith('1x1') ? '1x1' : '4x5';
  const slidesTo = (n: number, sh = shape) => setExport({ ratio: `c${Math.max(2, Math.min(10, n))}-${sh}` as typeof ratio });
  const safeZones = useUi((s) => s.safeZones);
  return (
    <div className="menu-surface pointer-events-auto flex items-center gap-1 rounded-[14px] p-1" data-testid="floating-bar">
      <div role="radiogroup" aria-label={t('props.ratio')} className="flex">
        {RATIOS.map((r) => (
          <Tooltip key={r.id} label={r.hint ?? r.label}>
            <button
              type="button"
              role="radio"
              aria-checked={ratio === r.id}
              aria-label={r.label}
              onClick={() => setExport({ ratio: r.id })}
              className={cx('h-8 rounded-[10px] px-2.5 text-[12.5px] font-medium tabular-nums transition-colors', ratio === r.id ? 'bg-fg text-bg' : 'text-fg-muted hover:bg-surface-3 hover:text-fg')}
            >
              {r.label}
            </button>
          </Tooltip>
        ))}
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={social ? `${t('social.menu')} · ${tr(social.label)}` : carousel ? `${t('social.menu')} · ${t('social.carousel')}` : t('social.menu')}
            className={cx(btn, (social || carousel) && 'bg-fg text-bg hover:bg-fg hover:text-bg')}
          >
            {social ? tr(social.label) : carousel ? t('social.carousel') : t('social.menu')}
            <ChevronDown size={13} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" sideOffset={8} className="menu-surface z-50 min-w-[230px] rounded-[14px] p-1.5 animate-[fade-in_120ms_ease-out]">
            <DropdownMenu.RadioGroup value={social?.id ?? (carousel ? 'carousel' : '')} onValueChange={(v) => (v === 'carousel' ? slidesTo(3, '4x5') : setExport({ ratio: v as typeof ratio }))}>
              {SOCIAL.map((f) => (
                <DropdownMenu.RadioItem key={f.id} value={f.id} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-fg outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg">
                  {tr(f.label)}
                  <span className="ml-auto text-[11.5px] tabular-nums opacity-60">
                    {f.px[0]} × {f.px[1]}
                  </span>
                  <Check size={13} className={social?.id === f.id ? '' : 'opacity-0'} />
                </DropdownMenu.RadioItem>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.RadioItem value="carousel" className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-fg outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg">
                <GalleryHorizontal size={14} />
                {t('social.carousel')}
                <span className="ml-auto text-[11.5px] tabular-nums opacity-60">2–10 × 1080 × 1350</span>
                <Check size={13} className={carousel ? '' : 'opacity-0'} />
              </DropdownMenu.RadioItem>
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {carousel && (
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label={t('social.removeSlide')} disabled={carousel.slides <= 2} className={cx(btn, 'px-1.5 disabled:opacity-30')} onClick={() => slidesTo(carousel.slides - 1)}>
            <Minus size={14} />
          </button>
          <span className="min-w-[56px] text-center text-[12.5px] font-medium tabular-nums text-fg">{t('social.slides', { n: carousel.slides })}</span>
          <button type="button" aria-label={t('social.addSlide')} disabled={carousel.slides >= 10} className={cx(btn, 'px-1.5 disabled:opacity-30')} onClick={() => slidesTo(carousel.slides + 1)}>
            <Plus size={14} />
          </button>
          <div role="radiogroup" aria-label={t('props.ratio')} className="ml-1 flex">
            {(['4x5', '1x1'] as const).map((sh) => (
              <button key={sh} type="button" role="radio" aria-checked={shape === sh} onClick={() => slidesTo(carousel.slides, sh)} className={cx('h-8 rounded-[10px] px-2 text-[12px] font-medium', shape === sh ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg')}>
                {sh === '4x5' ? '4:5' : '1:1'}
              </button>
            ))}
          </div>
        </div>
      )}
      {social?.safe && (
        <Tooltip label={t('social.safeHint')}>
          <button type="button" aria-pressed={safeZones} aria-label={t('social.safe')} className={cx(btn, safeZones && 'text-fg')} onClick={() => useUi.getState().setSafeZones(!safeZones)}>
            <PanelsTopLeft size={15} />
          </button>
        </Tooltip>
      )}
      <span className="mx-1 h-5 w-px bg-line-strong" />
      <Tooltip label={t('stage.resetView')} shortcut="F">
        <button type="button" className={btn} aria-label={t('stage.resetView')} onClick={() => useUi.getState().resetView()}>
          <Scan size={15} />
        </button>
      </Tooltip>
      <Tooltip label={t('stage.fullscreen')}>
        <button type="button" className={btn} aria-label={t('stage.fullscreen')} onClick={onFullscreen}>
          <Maximize2 size={15} />
        </button>
      </Tooltip>
      <span className="mx-1 h-5 w-px bg-line-strong" />
      <Tooltip label={t('stage.ideasHint')}>
        <button type="button" className={cx(btn, 'text-fg')} onClick={() => variants.open()} data-testid="open-variants">
          <Sparkles size={15} />
          {t('stage.ideas')}
        </button>
      </Tooltip>
    </div>
  );
}
