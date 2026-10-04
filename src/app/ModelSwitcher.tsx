import { DropdownMenu } from 'radix-ui';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useT } from '@/i18n';
import { switchModel } from '@/lib/switchModel';
import { getModel, modelsByCategory } from '@/models/registry';
import { selectSelectedItem, useProject } from '@/store/project';
import { cx } from '@/ui/primitives';
import { CATEGORY_KEYS } from './LibraryPanel';

/** "Change device" menu for the selected item: every model, grouped by category. */
export function ModelSwitcher() {
  const { t, tr } = useT();
  const item = useProject(selectSelectedItem);
  if (!item) return null;
  const current = getModel(item.modelId);
  const row = 'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-fg outline-none data-[highlighted]:bg-surface-4';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-lg bg-surface-2 px-3 text-left text-[13px] font-medium shadow-[0_0_0_1px_var(--line)_inset] transition-shadow hover:shadow-[0_0_0_1px_var(--line-strong)_inset]"
        >
          <span className="flex-1 truncate">{tr(current.name)}</span>
          <span className="text-[11.5px] font-normal text-fg-subtle">{t('switch.change')}</span>
          <ChevronsUpDown size={14} className="text-fg-subtle" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={6}
          align="end"
          className="z-50 max-h-[70vh] w-[260px] overflow-y-auto rounded-xl bg-surface-3 p-1 shadow-2xl ring-1 ring-line-strong animate-[fade-in_120ms_ease-out]"
        >
          {modelsByCategory().map(([cat, models]) => (
            <DropdownMenu.Group key={cat}>
              <DropdownMenu.Label className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
                {CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}
              </DropdownMenu.Label>
              {models.map((m) => (
                <DropdownMenu.Item key={m.id} className={cx(row, m.id === current.id && 'text-accent')} onSelect={() => void switchModel(item.id, m.id)}>
                  <span className="flex-1">{tr(m.name)}</span>
                  {m.id === current.id && <Check size={13} />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
