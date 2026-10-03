import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useToasts } from '@/store/toasts';
import { cx } from '@/ui/primitives';

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert };

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-[460px] items-center gap-2.5 rounded-xl bg-surface-3 py-2 pl-3 pr-1.5 text-[12.5px] shadow-[0_12px_40px_-8px_rgb(0_0_0/0.5),0_0_0_1px_var(--line-strong)_inset] animate-[toast-in_220ms_var(--ease-out-quart)]"
          >
            <Icon size={15} className={cx('shrink-0', toast.kind === 'success' && 'text-success', toast.kind === 'error' && 'text-danger', toast.kind === 'info' && 'text-fg-muted')} />
            <span className="leading-snug">{toast.message}</span>
            <button type="button" onClick={() => dismiss(toast.id)} className="grid size-6 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-surface-4 hover:text-fg" aria-label="Close">
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
