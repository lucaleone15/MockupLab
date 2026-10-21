import type { KeyboardEvent } from 'react';
import { useT, type I18nKey } from '@/i18n';
import { useUi } from '@/store/ui';
import { Tooltip, cx } from '@/ui/primitives';
import { AVAILABLE, MODE_ORDER, navigate } from './route';

/** Studio · Rapide · Projet · Photo — a pill segmented control; each mode says what it is for on hover, unbuilt modes say "Soon". */
export function ModeSwitch() {
  const { t } = useT();
  const screen = useUi((s) => s.screen);
  // radio group keyboard pattern: arrows move between the available modes
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const open = MODE_ORDER.filter((m) => AVAILABLE[m]);
    const i = Math.max(0, open.indexOf(screen));
    const target = open[(i + step + open.length) % open.length];
    navigate(target, { instant: true });
    (e.currentTarget.querySelector(`[data-mode="${target}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={t('screen.home')} data-testid="mode-switch" className="flex rounded-full bg-surface-3 p-[3px]" onKeyDown={onKeyDown}>
      {MODE_ORDER.map((m) => {
        const active = m === screen;
        const available = AVAILABLE[m];
        const button = (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-mode={m}
            disabled={!available}
            title={available ? undefined : t('screen.soon')}
            onClick={() => navigate(m)}
            className={cx(
              'h-7 rounded-full px-4 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
              active ? 'bg-white text-fg shadow-[0_1px_3px_rgb(0_0_0/0.14)] dark:bg-white/18' : 'text-fg-muted hover:text-fg',
              !available && 'opacity-40',
            )}
          >
            {t(`screen.${m}` as I18nKey)}
          </button>
        );
        return available ? (
          <Tooltip key={m} label={t(`mode.${m}.role` as I18nKey)}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </div>
  );
}
