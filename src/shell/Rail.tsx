import type { ReactNode } from 'react';
import { cx } from '@/ui/primitives';

export type RailItem<P extends string> = { id: P; label: string; icon: ReactNode };

/** Column of page buttons (icon + label). One page open at a time. */
export function Rail<P extends string>({ items, value, onChange, testId }: { items: RailItem<P>[]; value: P; onChange: (p: P) => void; testId?: string }) {
  return (
    <nav className="glass flex w-[68px] shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-[14px] py-2" role="tablist" aria-orientation="vertical" data-testid={testId}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={cx(
              'flex w-[58px] shrink-0 flex-col items-center gap-1 rounded-[10px] py-2 text-[11px] font-medium leading-none transition-[background-color,color,transform] duration-150 active:scale-[0.95]',
              active ? 'bg-accent-soft text-fg [&>svg]:text-accent' : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
            )}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

/** The open page: a title in Syne and its flat content, scrolling on its own. */
export function RailPage({ title, children, testId = 'rail-page' }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <aside className="glass flex w-[312px] shrink-0 flex-col overflow-hidden rounded-[14px]" data-testid={testId} role="tabpanel" aria-label={title}>
      <h2 className="font-display shrink-0 px-5 pb-1 pt-5 text-[20px] font-bold">{title}</h2>
      <div key={title} className="scroll-thin flex-1 overflow-y-auto pb-4 animate-[page-in_180ms_var(--ease-out-quart)]">
        {children}
      </div>
    </aside>
  );
}
