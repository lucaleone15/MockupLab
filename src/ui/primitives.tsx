import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Dialog, Slider as RSlider, Tooltip as RTooltip } from 'radix-ui';
import { X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* -------------------------------------------------------------- Button */

type Variant = 'primary' | 'secondary' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_1px_2px_rgb(0_0_0/0.12)]',
  secondary: 'bg-surface-2 text-fg hover:bg-surface-3 shadow-[0_0_0_1px_var(--line)_inset]',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-3',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 font-medium select-none whitespace-nowrap',
        'transition-[background-color,color,transform,box-shadow,opacity] duration-150 ease-out active:scale-[0.97]',
        'disabled:opacity-35 disabled:saturate-0 disabled:pointer-events-none',
        size === 'sm' && 'h-7 rounded-full px-3 text-[12px]',
        size === 'md' && 'h-8 rounded-full px-3.5 text-[13px]',
        size === 'lg' && 'h-10 rounded-full px-5 text-[13.5px]',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function IconButton({
  label,
  shortcut,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string }) {
  return (
    <Tooltip label={label} shortcut={shortcut}>
      <button
        type="button"
        aria-label={label}
        className={cx(
          'inline-grid place-items-center size-8 rounded-[10px] text-fg-muted hover:text-fg hover:bg-surface-3',
          'transition-[background-color,color,transform] duration-150 active:scale-[0.94] disabled:opacity-30 disabled:pointer-events-none',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/* ------------------------------------------------------------- Tooltip */

export function Tooltip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          sideOffset={6}
          className="menu-surface z-50 flex items-center gap-2 rounded-lg px-2.5 py-1 text-[12px] font-medium text-fg animate-[fade-in_120ms_ease-out]"
        >
          {label}
          {shortcut && <Kbd inverted>{shortcut}</Kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export function Kbd({ children, inverted }: { children: ReactNode; inverted?: boolean }) {
  return (
    <kbd
      className={cx(
        'rounded-md px-1.5 text-[11.5px] font-medium leading-[18px]',
        inverted ? 'bg-black/10 text-current/80 dark:bg-black/15' : 'bg-surface-3 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset]',
      )}
    >
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------- Section */

/** Title of a group inside a rail page: plain text, never collapsible. */
export function GroupTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[13px] font-semibold text-fg">{children}</h3>
      {aside}
    </div>
  );
}

/**
 * A group of controls in a rail page. Kept under its historical name so every
 * panel picks up the new look; `defaultOpen` is ignored (nothing collapses).
 */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <section className="flex flex-col gap-3.5 border-t border-line px-5 py-5 first:border-t-0">
      <GroupTitle aside={aside}>{title}</GroupTitle>
      {children}
    </section>
  );
}

export function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="text-fg-muted">{label}</span>
        {value !== undefined && <span className="text-[11px] tabular-nums text-fg-subtle">{value}</span>}
      </div>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      className="relative flex rounded-[10px] bg-surface-3 p-[3px]"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative flex-1 rounded-[8px] px-2 font-medium transition-[background-color,color,box-shadow] duration-150',
              size === 'md' ? 'h-7 text-[12.5px]' : 'h-6 text-[12px]',
              active
                ? 'bg-white text-fg shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_var(--line-strong)] dark:bg-white/18'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Slider */

export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <RSlider.Root
      className="group relative flex h-5 w-full touch-none select-none items-center"
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
      aria-label={label}
    >
      <RSlider.Track className="relative h-1 grow overflow-hidden rounded-full bg-surface-4">
        <RSlider.Range className="absolute h-full rounded-full bg-accent transition-colors" />
      </RSlider.Track>
      <RSlider.Thumb
        aria-label={label}
        className="block size-[18px] rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.25),0_0_0_0.5px_rgb(0_0_0/0.12)] transition-transform duration-150 hover:scale-110 active:scale-115 focus-visible:outline-2 focus-visible:outline-accent"
      />
    </RSlider.Root>
  );
}

/* ---------------------------------------------------------- ColorField */

export function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex h-8 cursor-pointer items-center gap-2 rounded-[10px] bg-surface-2 pl-1 pr-2.5 shadow-[0_0_0_1px_var(--line)_inset] hover:shadow-[0_0_0_1px_var(--line-strong)_inset]">
      <span className="relative size-6 overflow-hidden rounded-md shadow-[0_0_0_1px_var(--line-strong)_inset]" style={{ background: value }}>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </span>
      <span className="text-[11.5px] uppercase tabular-nums text-fg-muted">{value}</span>
    </label>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-current border-r-transparent animate-[spin_0.7s_linear_infinite]"
      style={{ width: size, height: size }}
    />
  );
}

/* -------------------------------------------------------------- Switch */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-[#34c759]' : 'bg-surface-4 shadow-[0_0_0_1px_var(--line-strong)_inset]',
      )}
    >
      <span
        className={cx(
          'absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-spring)]',
          checked && 'translate-x-[16px]',
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------ Advanced */

/** Fine-tuning controls, always visible under a small heading (no more hidden "More options"). */
export function Advanced({ children, more }: { children: ReactNode; more: string; less?: string }) {
  return (
    <div className="flex flex-col gap-3.5 pt-1">
      <div className="text-[12px] font-medium text-fg-subtle">{more}</div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- Chip */

export function Chip({
  active,
  onClick,
  children,
  disabled,
  title,
  ...rest
}: { active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean; title?: string; 'data-testid'?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
        active ? 'bg-fg text-bg' : 'bg-surface-3 text-fg-muted hover:text-fg',
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- Sheet */

/** A centred dialog with a title, a scrolling body and an optional footer. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  testId,
  size = 'md',
}: {
  size?: 'md' | 'lg';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[3px] animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content
          data-testid={testId}
          className={cx('menu-surface fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] max-w-[94vw]', size === 'lg' ? 'w-[880px]' : 'w-[440px]', ' -translate-x-1/2 -translate-y-1/2 flex-col rounded-[18px] text-fg animate-[toast-in_220ms_var(--ease-out-quart)]')}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <div>
              <Dialog.Title className="font-display text-[20px] font-bold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[13px] text-fg-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="grid size-8 place-items-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label="Fermer">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="scroll-thin flex flex-col gap-4 overflow-y-auto overscroll-contain px-6 py-3">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
