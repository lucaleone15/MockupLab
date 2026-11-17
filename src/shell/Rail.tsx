import type { KeyboardEvent, ReactNode } from 'react';
import { Tooltip, cx } from '@/ui/primitives';

export type RailItem<P extends string> = { id: P; label: string; icon: ReactNode };

/** Column of page buttons: icons, their names in a tooltip and for screen readers. One page open at a time. */
export function Rail<P extends string>({ items, value, onChange, testId, horizontal = false }: { items: RailItem<P>[]; value: P; onChange: (p: P) => void; testId?: string; horizontal?: boolean }) {
  // tablist keyboard pattern: arrows move between pages, Home/End jump to the ends
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.page;
    const i = items.findIndex((it) => it.id === (focused ?? value));
    const next = (horizontal ? { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: items.length - 1 } : { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 })[e.key as 'Home'];
    if (next === undefined) return;
    e.preventDefault();
    const target = items[(next + items.length) % items.length];
    onChange(target.id);
    (e.currentTarget.querySelector(`[data-page="${target.id}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <nav
      className={cx('glass flex shrink-0 items-center', horizontal ? 'h-14 w-full justify-around rounded-[28px] px-1.5' : 'w-[56px] flex-col gap-1.5 overflow-y-auto rounded-[28px] py-2')}
      role="tablist"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      data-testid={testId}
      onKeyDown={onKeyDown}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <Tooltip key={it.id} label={it.label} side={horizontal ? 'top' : 'right'}>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={it.label}
              tabIndex={active ? 0 : -1}
              data-page={it.id}
              onClick={() => onChange(it.id)}
              className={cx(
                'grid size-10 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-[0.95]',
                active ? 'bg-[var(--card)] text-accent shadow-[inset_0_0_0_1px_var(--card-edge),0_2px_8px_rgb(20_30_70/0.12)]' : 'text-fg-muted hover:bg-surface-3 hover:text-fg',
              )}
            >
              {it.icon}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}

/** The open page: a title in Archivo Expanded and its flat content, scrolling on its own. */
export function RailPage({ title, children, testId = 'rail-page', height }: { title: string; children: ReactNode; testId?: string; height?: number }) {
  return (
    // `height`: on a phone the page is a panel across the bottom, of that height
    <aside style={height ? { height } : undefined} className={cx('glass flex shrink-0 flex-col overflow-hidden rounded-[20px]', height ? 'w-full animate-[rise_220ms_var(--ease-out)]' : 'w-[312px]')} data-testid={testId} role="tabpanel" aria-label={title}>
      <h2 className={cx('font-display shrink-0 font-bold', height ? 'px-5 pb-0.5 pt-4 text-[18px]' : 'px-5 pb-1 pt-5 text-[20px]')}>{title}</h2>
      <div key={title} className="scroll-thin flex-1 overflow-y-auto overscroll-contain pb-4 animate-[page-in_180ms_var(--ease-out-quart)]">
        {children}
      </div>
    </aside>
  );
}
