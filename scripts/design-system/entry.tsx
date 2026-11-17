/*
 * The design system's component bundle (scripts/build-design-system.mjs): the app's real interface primitives
 * and its mark, exposed as window.MockupLab for the design system's live previews.
 */
import { DropdownMenu, Tooltip as RTooltip } from 'radix-ui';
import { Check, ChevronDown, CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cx } from '@/ui/primitives';
import type { ReactNode } from 'react';
import { LogoMark } from '@/shell/Logo';

export { Button, IconButton, Tooltip, Kbd, GroupTitle, Section, Field, Segmented, Slider, ColorField, Spinner, Switch, Advanced, Chip, Sheet } from '@/ui/primitives';
export { LogoMark };

/** Tooltips need this around them (the app puts one at its root). */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </RTooltip.Provider>
  );
}

/** The lockup: the mark and « MockupLab » in Gabarito 700, in the colour of the text around it. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2" data-testid="logo">
      <LogoMark size={size} />
      <span className="font-display font-bold leading-none" style={{ fontSize: Math.round(size * 0.66) }}>
        MockupLab
      </span>
    </span>
  );
}

// —— the app's frames: rail, page panel, mode switch, menus, toasts, floating bar, top bar ——
export { Rail, RailPage } from '@/shell/Rail';

/** The mode switch, as the app draws it (src/shell/ModeSwitch.tsx): pills on a computer, a menu on a phone. */
export function ModeSwitch({ value, onChange, compact = false, modes = ['Studio', 'Rapide', 'Projet'] }: { value: string; onChange: (v: string) => void; compact?: boolean; modes?: string[] }) {
  if (compact)
    return (
      <Menu
        trigger={
          <button type="button" className="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold text-fg">
            {value}
            <ChevronDown size={15} className="text-fg-muted" />
          </button>
        }
        items={modes.map((m) => ({ label: m, checked: m === value, onSelect: () => onChange(m) }))}
      />
    );
  return (
    <div role="radiogroup" className="flex rounded-full bg-surface-3 p-[3px]">
      {modes.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={m === value}
          onClick={() => onChange(m)}
          className={cx('h-7 rounded-full px-4 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150', m === value ? 'bg-white text-fg shadow-[0_1px_3px_rgb(0_0_0/0.14)] dark:bg-white/18' : 'text-fg-muted hover:text-fg')}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

export type MenuItem = { label: string; icon?: ReactNode; checked?: boolean; onSelect?: () => void } | 'separator';

/** A dropdown menu as the app's (src/shell/MoreMenu.tsx): frosted, 14px corners, the highlighted row in the accent. */
export function Menu({ trigger, items, align = 'start' }: { trigger: ReactNode; items: MenuItem[]; align?: 'start' | 'center' | 'end' }) {
  const row = 'flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-fg outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={8} align={align} className="menu-surface menu-pop z-50 min-w-[220px] rounded-[14px] p-1.5">
          {items.map((it, i) =>
            it === 'separator' ? (
              <DropdownMenu.Separator key={i} className="mx-2 my-1 h-px bg-line" />
            ) : (
              <DropdownMenu.Item key={i} className={row} onSelect={it.onSelect}>
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {it.checked !== undefined && <Check size={14} className={it.checked ? '' : 'opacity-0'} />}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const TOAST_ICONS = { info: Info, success: CircleCheck, error: CircleAlert };

/** A toast, as the app's (src/app/Toaster.tsx): a floating pill that says what happened. */
export function Toast({ kind = 'info', children, onClose }: { kind?: 'info' | 'success' | 'error'; children: ReactNode; onClose?: () => void }) {
  const Icon = TOAST_ICONS[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className="glass-float flex max-w-[460px] items-center gap-2.5 rounded-[14px] py-2 pl-3.5 pr-1.5 text-[13px] text-fg">
      <Icon size={15} className={cx('shrink-0', kind === 'success' && 'text-success', kind === 'error' && 'text-danger', kind === 'info' && 'text-fg-muted')} />
      <span className="leading-snug">{children}</span>
      <button type="button" onClick={onClose} className="grid size-6 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-surface-4 hover:text-fg" aria-label="Fermer">
        <X size={13} />
      </button>
    </div>
  );
}

/** A floating bar over the scene (src/shell/FloatingBar.tsx): a frosted pill of quiet buttons, split by hairlines. */
export function FloatingBar({ children }: { children: ReactNode }) {
  return <div className="glass-float flex items-center gap-1 rounded-full p-1">{children}</div>;
}
/** A quiet button inside a FloatingBar. */
export function BarButton({ children, label, strong = false, onClick }: { children: ReactNode; label?: string; strong?: boolean; onClick?: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={cx('flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-medium transition-colors hover:bg-surface-3 hover:text-fg', strong ? 'text-fg' : 'text-fg-muted')}>
      {children}
    </button>
  );
}
/** The hairline between groups of a FloatingBar. */
export function BarDivider() {
  return <span className="mx-1 h-5 w-px bg-line-strong" />;
}

/** The top bar (src/shell/TopBar.tsx): three frosted capsules — brand and project · modes · actions. */
export function TopBar({ left, center, right }: { left: ReactNode; center: ReactNode; right: ReactNode }) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 max-md:gap-1.5 max-md:px-2" style={{ height: 60 }}>
      <div className="glass-float flex h-11 min-w-0 items-center gap-3 justify-self-start rounded-full pl-3.5 pr-1.5 max-md:gap-0.5 max-md:pl-3">{left}</div>
      <div className="glass-float rounded-full p-1">{center}</div>
      <div className="glass-float flex h-11 items-center justify-end gap-1 justify-self-end rounded-full px-1.5">{right}</div>
    </header>
  );
}
