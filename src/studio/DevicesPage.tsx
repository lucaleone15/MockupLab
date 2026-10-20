import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useT } from '@/i18n';
import { SceneItems } from '@/app/panels/CompositionSection';
import { DeviceParams } from '@/app/PropertiesPanel';
import { getModel } from '@/models/registry';
import { selectSelectedItem, useProject } from '@/store/project';
import { Button, Section } from '@/ui/primitives';
import { Catalogue } from './Catalogue';

/** The devices of the scene, and a button that opens the catalogue to add one. */
export function DevicesPage() {
  const { t, tr } = useT();
  // closed, adding a device, or changing the device of that id
  const [catalogue, setCatalogue] = useState<{ replaceId: string | null } | null>(null);
  const selected = useProject(selectSelectedItem);
  // a print's size is chosen right here, where it was picked
  const sized = selected && getModel(selected.modelId).paperSize ? selected : null;
  return (
    <>
      <SceneItems onChange={(id) => setCatalogue({ replaceId: id })} />
      {sized && (
        <Section title={tr(getModel(sized.modelId).name)}>
          <DeviceParams item={sized} only={['fit', 'format']} />
        </Section>
      )}
      <div className="px-5 pt-1">
        <Button variant="primary" size="lg" className="w-full" onClick={() => setCatalogue({ replaceId: null })} data-testid="add-device">
          <Plus size={16} strokeWidth={2.2} />
          {t('stage.addDevice')}
        </Button>
      </div>
      <Catalogue open={!!catalogue} onOpenChange={(v) => !v && setCatalogue(null)} replaceId={catalogue?.replaceId} />
    </>
  );
}
