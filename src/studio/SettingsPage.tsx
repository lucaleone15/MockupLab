import { useT } from '@/i18n';
import { DeviceSection, ImageSection } from '@/app/PropertiesPanel';
import { Placement } from '@/app/panels/CompositionSection';
import { selectSelectedItem, useProject } from '@/store/project';

/** Everything about the selected device: the design on its screen(s), the model and finish, its placement. */
export function SettingsPage() {
  const { t } = useT();
  const item = useProject(selectSelectedItem);
  if (!item) return <p className="px-5 py-4 text-[13px] leading-relaxed text-fg-muted">{t('settings.none')}</p>;
  return (
    <>
      <ImageSection />
      <DeviceSection />
      <Placement />
    </>
  );
}
