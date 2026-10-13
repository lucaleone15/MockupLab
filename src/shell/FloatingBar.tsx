import { Maximize2, Scan, Sparkles } from 'lucide-react';
import { useT } from '@/i18n';
import { RATIOS } from '@/export/settings';
import { useProject } from '@/store/project';
import { useUi } from '@/store/ui';
import { variants } from '@/variants/store';
import { Tooltip, cx } from '@/ui/primitives';

const btn = 'flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg';

/** Output format, recenter, full-screen preview and Ideas, floating over the stage. */
export function FloatingBar({ onFullscreen }: { onFullscreen: () => void }) {
  const { t } = useT();
  const ratio = useProject((s) => s.export.ratio);
  const setExport = useProject((s) => s.setExport);
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
