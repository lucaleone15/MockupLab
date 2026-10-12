import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useToasts } from '@/store/toasts';
import { cx } from '@/ui/primitives';

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert };

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed top-16 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className="menu-surface pointer-events-auto flex max-w-[460px] items-center gap-2.5 rounded-[14px] py-2 pl-3.5 pr-1.5 text-[13px] text-fg animate-[toast-in_220ms_var(--ease-out-quart)]"
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
