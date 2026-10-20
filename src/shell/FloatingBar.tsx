import { ChevronDown, Check, Maximize2, Scan, Sparkles } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useT } from '@/i18n';
import { RATIOS, SOCIAL, socialOf } from '@/export/settings';
import { useProject, type RatioPreset } from '@/store/project';
import { useUi } from '@/store/ui';
import { variants } from '@/variants/store';
import { Tooltip, cx } from '@/ui/primitives';

const btn = 'flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg';

/** Output format, recenter, full-screen preview and Ideas, floating over the stage. */
export function FloatingBar({ onFullscreen }: { onFullscreen: () => void }) {
  const { t } = useT();
  return (
    <div className="menu-surface pointer-events-auto flex items-center gap-1 rounded-[14px] p-1" data-testid="floating-bar">
      <Formats />
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

const row = 'flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-fg transition-colors hover:bg-surface-3';

/** The output format, in one menu: plain proportions, then the exact sizes of the social networks. */
function Formats() {
  const { t, tr } = useT();
  const ratio = useProject((s) => s.export.ratio);
  const setExport = useProject((s) => s.setExport);
  const social = socialOf(ratio);
  const label = social ? tr(social.label) : (RATIOS.find((r) => r.id === ratio)?.label ?? ratio);
  const item = (id: RatioPreset, name: string, aside?: string) => (
    <button key={id} type="button" role="menuitemradio" aria-checked={ratio === id} onClick={() => setExport({ ratio: id })} className={row}>
      {name}
      {aside && <span className="ml-auto text-[11.5px] tabular-nums text-fg-subtle">{aside}</span>}
      <Check size={13} className={cx(!aside && 'ml-auto', ratio === id ? '' : 'opacity-0')} />
    </button>
  );
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`${t('format.title')} · ${label}`} data-testid="format-menu" className={cx(btn, 'text-fg')}>
          <span className="text-fg-muted">{t('format.title')}</span>
          <span className="tabular-nums">{label}</span>
          <ChevronDown size={13} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} role="menu" aria-label={t('format.title')} className="menu-surface z-50 flex max-h-[min(70vh,560px)] w-[270px] flex-col gap-0.5 overflow-y-auto rounded-[14px] p-1.5 animate-[fade-in_120ms_ease-out]">
          <div className="mx-2.5 mb-0.5 mt-1 text-[11.5px] font-medium text-fg-subtle">{t('format.ratios')}</div>
          {RATIOS.map((r) => item(r.id, r.label, r.hint))}
          <div className="mx-2.5 mb-0.5 mt-2 text-[11.5px] font-medium text-fg-subtle">{t('format.social')}</div>
          {/* the square post is the 1:1 proportion: not listed twice */}
          {SOCIAL.filter((f) => f.id !== 'ig-square').map((f) => item(f.id, tr(f.label), f.px.join(' × ')))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
