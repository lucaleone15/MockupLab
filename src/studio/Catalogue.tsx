import { useEffect, useState } from 'react';
import { useT } from '@/i18n';
import { CATEGORY_KEYS, ModelCard, UserModels } from '@/app/LibraryPanel';
import { CompositionCards } from '@/app/panels/CompositionSection';
import { getModel, modelsByCategory } from '@/models/registry';
import { useProject } from '@/store/project';
import type { DeviceCategory } from '@/models/types';
import { Sheet, cx } from '@/ui/primitives';

type Family = DeviceCategory | 'several';

/**
 * Every device, one family at a time. A click adds it to the scene, or — when
 * `replaceId` names a device of the scene — puts it in that device's place
 * (its images follow); then the window closes.
 */
export function Catalogue({ open, onOpenChange, replaceId }: { open: boolean; onOpenChange: (v: boolean) => void; replaceId?: string | null }) {
  const { t, tr } = useT();
  const groups = modelsByCategory().filter(([c]) => c !== 'custom');
  const replaced = useProject((s) => s.items.find((it) => it.id === replaceId) ?? null);
  const [family, setFamily] = useState<Family>(groups[0]?.[0] ?? 'phone');
  // changing a device opens on its own family
  useEffect(() => {
    if (open && replaced) setFamily(getModel(replaced.modelId).category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replaceId]);
  const models = groups.find(([c]) => c === family)?.[1] ?? [];
  const close = () => onOpenChange(false);
  const families: { id: Family; label: string }[] = [
    ...groups.map(([c]) => ({ id: c as Family, label: CATEGORY_KEYS[c] ? t(CATEGORY_KEYS[c]) : c })),
    { id: 'custom', label: t('library.custom') },
    // a ready-made scene replaces the whole scene, not one device
    ...(replaced ? [] : [{ id: 'several' as Family, label: t('catalogue.several') }]),
  ];
  const name = replaced ? tr(getModel(replaced.modelId).name) : '';
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={replaced ? t('catalogue.changeTitle', { name }) : t('stage.addDevice')}
      description={replaced ? t('catalogue.changeHint', { name }) : t('catalogue.addHint')}
      size="lg"
      testId="catalogue"
    >
      <div className="grid min-h-[420px] grid-cols-[180px_1fr] gap-5">
        <nav className="flex flex-col gap-0.5" aria-label={t('catalogue.families')}>
          {families.map((f) => (
            <button
              key={f.id}
              type="button"
              data-testid={`catalogue-family-${f.id}`}
              aria-pressed={family === f.id}
              onClick={() => setFamily(f.id)}
              className={cx(
                'rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                family === f.id ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {f.label}
            </button>
          ))}
        </nav>
        <div>
          {family === 'custom' ? (
            <UserModels onAdded={close} replaceId={replaced?.id} />
          ) : family === 'several' ? (
            <>
              <p className="mb-3 text-[12.5px] leading-snug text-fg-muted">{t('devices.compositionsHint')}</p>
              <CompositionCards onPicked={close} />
            </>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {models.map((m) => (
                <ModelCard key={m.id} model={m} onAdded={close} replaceId={replaced?.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
