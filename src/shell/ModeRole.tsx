import { useT, type I18nKey } from '@/i18n';
import type { Screen } from '@/store/ui';
import { cx } from '@/ui/primitives';

/** One line that says what a mode is for, shown where the mode is still empty. */
export function ModeRole({ screen, className }: { screen: Exclude<Screen, 'home'>; className?: string }) {
  const { t } = useT();
  return (
    <p data-testid="mode-role" className={cx('text-[13px] leading-snug text-fg-muted', className)}>
      {t(`mode.${screen}.role` as I18nKey)}
    </p>
  );
}
