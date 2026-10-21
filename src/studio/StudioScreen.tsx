import { Armchair, Camera, Palette, SlidersHorizontal, Smartphone, Sun, Type } from 'lucide-react';
import { useT } from '@/i18n';
import { Viewport } from '@/app/Viewport';
import { Rail, RailPage, type RailItem } from '@/shell/Rail';
import { useFirstVisitTour } from '@/shell/Tour';
import { useEffect } from 'react';
import { askNameIfNew } from '@/library/NameDialog';
import { useLibrary } from '@/library/store';
import { useUi, type StudioPage } from '@/store/ui';
import { DevicesPage } from './DevicesPage';
import { SettingsPage } from './SettingsPage';
import { StudioPageBody } from './pages';

const ICON = 20;

/** The rail (68 px) and the page panel (312 px) with their margins: the frame is centred to their right. */
const PANELS_WIDTH = 8 + 68 + 8 + 312;

export function StudioScreen() {
  const { t } = useT();
  const page = useUi((s) => s.studioPage);
  const setPage = useUi((s) => s.setStudioPage);
  useFirstVisitTour();
  // a project never named is named first
  const loads = useLibrary((s) => s.loads);
  useEffect(() => askNameIfNew(), [loads]);
  const items: RailItem<StudioPage>[] = [
    { id: 'devices', label: t('page.devices'), icon: <Smartphone size={ICON} /> },
    { id: 'settings', label: t('page.settings'), icon: <SlidersHorizontal size={ICON} /> },
    { id: 'decor', label: t('page.decor'), icon: <Armchair size={ICON} /> },
    { id: 'light', label: t('page.light'), icon: <Sun size={ICON} /> },
    { id: 'camera', label: t('page.camera'), icon: <Camera size={ICON} /> },
    { id: 'text', label: t('page.text'), icon: <Type size={ICON} /> },
    { id: 'brand', label: t('page.brand'), icon: <Palette size={ICON} /> },
  ];
  const title = items.find((i) => i.id === page)?.label ?? '';
  return (
    // the scene fills the whole area; the rail and the page float over it
    <div className="relative min-h-0 flex-1">
      <Viewport insetLeft={PANELS_WIDTH} />
      <div className="pointer-events-none absolute inset-y-0 left-0 flex gap-2 p-2 [&>*]:pointer-events-auto">
        <Rail items={items} value={page} onChange={setPage} testId="studio-rail" />
        <RailPage title={title}>
          {page === 'devices' && <DevicesPage />}
          {page === 'settings' && <SettingsPage />}
          {page !== 'devices' && page !== 'settings' && <StudioPageBody page={page} />}
        </RailPage>
      </div>
    </div>
  );
}
