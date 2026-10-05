import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Slider as RSlider, Tooltip as RTooltip } from 'radix-ui';
import { ChevronDown } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* -------------------------------------------------------------- Button */

type Variant = 'primary' | 'secondary' | 'ghost';
const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg hover:bg-accent-hover shadow-[0_1px_0_rgb(255_255_255/0.25)_inset,0_6px_20px_-6px_var(--accent)]',
  secondary: 'bg-surface-3 text-fg hover:bg-surface-4 shadow-[0_0_0_1px_var(--line)_inset]',
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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium select-none whitespace-nowrap',
        'transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97]',
        'disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' && 'h-7 px-2.5 text-[12px]',
        size === 'md' && 'h-8 px-3 text-[12.5px]',
        size === 'lg' && 'h-10 px-4 text-[13px]',
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
          'inline-grid place-items-center size-8 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3',
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
          className="z-50 flex items-center gap-2 rounded-md bg-fg px-2 py-1 text-[11.5px] font-medium text-bg shadow-lg animate-[fade-in_120ms_ease-out]"
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
        'rounded px-1 font-mono text-[10.5px] leading-[16px]',
        inverted ? 'bg-bg/15 text-bg/80' : 'bg-surface-3 text-fg-muted shadow-[0_0_0_1px_var(--line)_inset]',
      )}
    >
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------- Section */

export function Section({
  title,
  aside,
  children,
  defaultOpen = true,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <div className="flex h-10 items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted hover:text-fg"
          aria-expanded={open}
        >
          <ChevronDown
            size={13}
            className={cx('transition-transform duration-200 ease-[var(--ease-out-quart)]', !open && '-rotate-90')}
          />
          {title}
        </button>
        {aside}
      </div>
      <div
        className={cx(
          'grid transition-[grid-template-rows,opacity] duration-250 ease-[var(--ease-out-quart)]',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3.5 px-4 pb-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-fg-muted">{label}</span>
        {value !== undefined && <span className="font-mono text-[11px] tabular-nums text-fg-subtle">{value}</span>}
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
      className="relative flex rounded-lg bg-surface-2 p-0.5 shadow-[0_0_0_1px_var(--line)_inset]"
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
              'relative flex-1 rounded-md px-2 font-medium transition-[background-color,color,box-shadow] duration-150',
              size === 'md' ? 'h-7 text-[12px]' : 'h-6 text-[11.5px]',
              active
                ? 'bg-surface-4 text-fg shadow-[0_1px_2px_rgb(0_0_0/0.25),0_0_0_1px_var(--line-strong)_inset]'
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
      <RSlider.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-surface-4">
        <RSlider.Range className="absolute h-full rounded-full bg-fg-muted group-hover:bg-fg transition-colors" />
      </RSlider.Track>
      <RSlider.Thumb
        aria-label={label}
        className="block size-3.5 rounded-full bg-fg shadow-[0_1px_4px_rgb(0_0_0/0.4)] transition-transform duration-150 hover:scale-115 active:scale-125 focus-visible:outline-2 focus-visible:outline-accent"
      />
    </RSlider.Root>
  );
}

/* ---------------------------------------------------------- ColorField */

export function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg bg-surface-2 pl-1 pr-2.5 shadow-[0_0_0_1px_var(--line)_inset] hover:shadow-[0_0_0_1px_var(--line-strong)_inset]">
      <span className="relative size-6 overflow-hidden rounded-md shadow-[0_0_0_1px_var(--line-strong)_inset]" style={{ background: value }}>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </span>
      <span className="font-mono text-[11.5px] uppercase tabular-nums text-fg-muted">{value}</span>
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
        'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-surface-4 shadow-[0_0_0_1px_var(--line-strong)_inset]',
      )}
    >
      <span
        className={cx(
          'absolute top-[2px] left-[2px] size-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-spring)]',
          checked && 'translate-x-[12px]',
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------ Advanced */

/** "More options" disclosure: keeps sections short, details one click away. */
export function Advanced({ children, more, less }: { children: ReactNode; more: string; less: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 self-start rounded-md text-[11.5px] font-medium text-fg-muted transition-colors hover:text-fg"
      >
        <ChevronDown size={13} className={cx('transition-transform duration-200', !open && '-rotate-90')} />
        {open ? less : more}
      </button>
      {open && <div className="flex flex-col gap-3.5 border-l border-line pl-3 animate-[fade-in_160ms_ease-out]">{children}</div>}
    </div>
  );
}
