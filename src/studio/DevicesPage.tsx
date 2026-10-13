import { useState } from 'react';
import { useT } from '@/i18n';
import { CATEGORY_KEYS, ModelCard, UserModels } from '@/app/LibraryPanel';
import { SceneItems } from '@/app/panels/CompositionSection';
import { DeviceParams } from '@/app/PropertiesPanel';
import { getModel, modelsByCategory } from '@/models/registry';
import type { DeviceCategory } from '@/models/types';
import { selectSelectedItem, useProject } from '@/store/project';
import { Chip, Section } from '@/ui/primitives';

/** What is in the scene, then the library (one category at a time) and the .glb import. */
export function DevicesPage() {
  const { t, tr } = useT();
  const groups = modelsByCategory().filter(([c]) => c !== 'custom');
  const [cat, setCat] = useState<DeviceCategory>(groups[0]?.[0] ?? 'phone');
  const models = groups.find(([c]) => c === cat)?.[1] ?? [];
  const selected = useProject(selectSelectedItem);
  // a print's size is chosen right here, where it was picked
  const sized = selected && getModel(selected.modelId).paperSize ? selected : null;
  return (
    <>
      <SceneItems />
      {sized && (
        <Section title={tr(getModel(sized.modelId).name)}>
          <DeviceParams item={sized} only={['fit', 'format']} />
        </Section>
      )}
      <Section title={t('devices.library')}>
        <div className="flex flex-wrap gap-1.5" data-testid="library-tabs">
          {groups.map(([c]) => (
            <Chip key={c} active={c === cat} onClick={() => setCat(c)}>
              {CATEGORY_KEYS[c] ? t(CATEGORY_KEYS[c]) : c}
            </Chip>
          ))}
          <Chip active={cat === 'custom'} onClick={() => setCat('custom')}>
            {t('library.custom')}
          </Chip>
        </div>
        {cat === 'custom' ? (
          <UserModels />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {models.map((m) => (
              <ModelCard key={m.id} model={m} />
            ))}
          </div>
        )}
        <p className="text-[12px] leading-snug text-fg-muted">{t('devices.hint')}</p>
      </Section>
    </>
  );
}
