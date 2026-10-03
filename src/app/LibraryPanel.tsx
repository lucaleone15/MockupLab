import { useT } from '@/i18n';
import { modelsByCategory } from '@/models/registry';
import type { DeviceCategory, DeviceModule } from '@/models/types';
import { selectSelectedItem, useProject } from '@/store/project';
import { cx } from '@/ui/primitives';

const CATEGORY_KEYS: Partial<Record<DeviceCategory, 'library.phones'>> = { phone: 'library.phones' };

/** Line-art silhouette, generated from the model's real proportions. */
function Silhouette({ model }: { model: DeviceModule }) {
  const [w, h] = model.size;
  const k = 64 / Math.max(w, h);
  const sw = w * k;
  const sh = h * k;
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" aria-hidden>
      <rect x={40 - sw / 2} y={40 - sh / 2} width={sw} height={sh} rx={sw * 0.19} className="fill-surface-4 stroke-fg-subtle" strokeWidth={1.2} />
      <rect x={40 - sw / 2 + 2.2} y={40 - sh / 2 + 2.2} width={sw - 4.4} height={sh - 4.4} rx={sw * 0.15} className="fill-surface-2" />
      <rect x={40 - 4.5} y={40 - sh / 2 + 4.6} width={9} height={2.6} rx={1.3} className="fill-fg-subtle" />
    </svg>
  );
}

export function LibraryPanel() {
  const { t, tr } = useT();
  const selected = useProject(selectSelectedItem);
  const replaceModel = useProject((s) => s.replaceModel);

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {t('library.title')}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-4">
        {modelsByCategory().map(([cat, models]) => (
          <div key={cat} className="mb-4">
            <div className="mb-2 px-1 text-[12px] font-medium text-fg">{CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat}</div>
            <div className="grid grid-cols-2 gap-2">
              {models.map((m) => {
                const active = selected?.modelId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selected && replaceModel(selected.id, m.id, m.defaultFinish, m.size)}
                    className={cx(
                      'group flex flex-col items-center gap-1 rounded-xl bg-surface-2 p-2 pb-2.5 text-[11.5px] transition-[box-shadow,background-color,transform] duration-150 active:scale-[0.97]',
                      active
                        ? 'text-fg shadow-[0_0_0_1.5px_var(--accent)_inset]'
                        : 'text-fg-muted shadow-[0_0_0_1px_var(--line)_inset] hover:bg-surface-3 hover:text-fg',
                    )}
                  >
                    <Silhouette model={m} />
                    {tr(m.name)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="mx-1 rounded-lg border border-dashed border-line-strong p-3 text-[11.5px] leading-relaxed text-fg-subtle">
          {t('library.more')}
        </p>
      </div>
    </aside>
  );
}
