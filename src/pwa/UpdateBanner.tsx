import { RefreshCw } from 'lucide-react';
import { useT } from '@/i18n';
import { Button } from '@/ui/primitives';
import { useUpdate } from './update';

/** "A new version is available": update now, or later. */
export function UpdateBanner() {
  const { t } = useT();
  const { available, dismissed, apply } = useUpdate();
  if (!available || dismissed || !apply) return null;
  return (
    <div role="status" data-testid="update-banner" className="menu-surface fixed bottom-4 left-4 z-50 flex max-w-[420px] items-center gap-3 rounded-[16px] py-3 pl-4 pr-3 text-[13px] animate-[toast-in_220ms_var(--ease-out-quart)]">
      <RefreshCw size={16} className="shrink-0 text-accent" />
      <span className="flex-1 leading-snug">{t('update.available')}</span>
      <Button variant="ghost" size="sm" onClick={() => useUpdate.setState({ dismissed: true })}>
        {t('update.later')}
      </Button>
      <Button variant="primary" size="sm" onClick={apply}>
        {t('update.apply')}
      </Button>
    </div>
  );
}
