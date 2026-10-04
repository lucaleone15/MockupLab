import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { useT, type I18nKey } from '@/i18n';
import { useUi } from '@/store/ui';
import { Kbd } from '@/ui/primitives';
import { SHORTCUTS } from './shortcuts';

export function HelpDialog() {
  const { t } = useT();
  const open = useUi((s) => s.helpOpen);
  const setOpen = useUi((s) => s.setHelpOpen);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 shadow-2xl ring-1 ring-line-strong animate-[toast-in_200ms_var(--ease-out-quart)]">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-semibold">{t('help.title')}</Dialog.Title>
            <Dialog.Close className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label="Close">
              <X size={15} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t('help.title')}</Dialog.Description>
          <ul className="flex flex-col divide-y divide-line">
            {SHORTCUTS.map(([keys, label]) => (
              <li key={label} className="flex items-center justify-between py-2 text-[12.5px]">
                <span className="text-fg-muted">{t(label as I18nKey)}</span>
                <Kbd>{keys}</Kbd>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] leading-relaxed text-fg-subtle">{t('comp.dragHint')}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
