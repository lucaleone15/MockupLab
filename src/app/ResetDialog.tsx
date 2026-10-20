import { Dialog } from 'radix-ui';
import { Eraser, RotateCcw, X } from 'lucide-react';
import { useT } from '@/i18n';
import { useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { useUi } from '@/store/ui';
import { MOD } from './shortcuts';

/** Top-bar reset: scene only (keeps devices and images) or everything. Both are undoable. */
export function ResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useT();
  const run = (fn: () => void) => {
    fn();
    useUi.getState().selectOverlay(null);
    useUi.getState().setActiveSlot(null);
    useUi.getState().resetView();
    onOpenChange(false);
    toast.success(t('reset.done', { key: `${MOD}Z` }));
  };
  const choice = 'flex w-full items-start gap-3 rounded-xl bg-surface-2 p-3 text-left shadow-[0_0_0_1px_var(--line)_inset] transition-[box-shadow,background-color] hover:bg-surface-3 hover:shadow-[0_0_0_1px_var(--line-strong)_inset]';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content className="menu-surface fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-[18px] p-6 animate-[toast-in_200ms_var(--ease-out-quart)]">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-display text-[20px] font-bold">{t('reset.title')}</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label={t('cancel')}>
              <X size={15} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t('reset.title')}</Dialog.Description>
          <div className="flex flex-col gap-2">
            <button type="button" className={choice} onClick={() => run(() => useProject.getState().resetScene())}>
              <RotateCcw size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>
                <span className="block text-[13px] font-semibold">{t('reset.scene')}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">{t('reset.sceneHint')}</span>
              </span>
            </button>
            <button type="button" className={choice} onClick={() => run(() => useProject.getState().resetAll())}>
              <Eraser size={16} className="mt-0.5 shrink-0 text-danger" />
              <span>
                <span className="block text-[13px] font-semibold">{t('reset.all')}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-fg-muted">{t('reset.allHint')}</span>
              </span>
            </button>
          </div>
          <p className="mt-3 text-[11.5px] text-fg-subtle">{t('reset.undo', { key: `${MOD}Z` })}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
