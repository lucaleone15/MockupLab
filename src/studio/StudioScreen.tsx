import { Armchair, Camera, Palette, SlidersHorizontal, Smartphone, Sun, Type } from 'lucide-react';
import { useT } from '@/i18n';
import { TOP_BAR } from '@/shell/TopBar';
import { Viewport } from '@/app/Viewport';
import { Rail, RailPage, type RailItem } from '@/shell/Rail';
import { useFirstVisitTour } from '@/shell/Tour';
import { useEffect, useState } from 'react';
import { useCompact } from '@/ui/useCompact';
import { askNameIfNew } from '@/library/NameDialog';
import { useLibrary } from '@/library/store';
import { useUi, type StudioPage } from '@/store/ui';
import { DevicesPage } from './DevicesPage';
import { SettingsPage } from './SettingsPage';
import { StudioPageBody } from './pages';

const ICON = 20;

/** The rail (68 px) and the page panel (312 px) with their margins: the frame is centred to their right. */
const PANELS_WIDTH = 12 + 56 + 8 + 312;

/** On a phone: the tab bar (56 px) and its margin, and the page panel above it (a share of the height). */
const TABS = 56 + 8;
const panelHeight = (vh: number) => Math.round(Math.min(380, vh * 0.42));

function useViewportHeight() {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const on = () => setH(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}

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
  const body = (
    <>
      {page === 'devices' && <DevicesPage />}
      {page === 'settings' && <SettingsPage />}
      {page !== 'devices' && page !== 'settings' && <StudioPageBody page={page} />}
    </>
  );
  const compact = useCompact();
  // on a phone the page panel folds away: tapping the open tab gives the whole height to the scene
  const [unfolded, setUnfolded] = useState(true);
  // the guide lights the page panel: it is unfolded while the guide runs
  const touring = useUi((s) => s.tourStep !== null);
  useEffect(() => {
    if (touring) setUnfolded(true);
  }, [touring]);
  const vh = useViewportHeight();
  if (compact) {
    const panel = panelHeight(vh);
    return (
      <div className="relative min-h-0 flex-1">
        <Viewport insetTop={TOP_BAR} insetBottom={TABS + 8 + (unfolded ? panel + 8 : 0)} compact />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 px-2 pb-2 [&>*]:pointer-events-auto">
          {unfolded && (
            <RailPage title={title} height={panel}>
              {body}
            </RailPage>
          )}
          <Rail
            horizontal
            items={items}
            value={page}
            onChange={(p) => {
              setUnfolded(p !== page || !unfolded);
              setPage(p);
            }}
            testId="studio-rail"
          />
        </div>
      </div>
    );
  }
  return (
    // the scene fills the whole area; the rail and the page float over it
    <div className="relative min-h-0 flex-1">
      <Viewport insetLeft={PANELS_WIDTH} insetTop={TOP_BAR} />
      <div className="pointer-events-none absolute bottom-0 left-0 flex gap-2 px-3 pb-3 [&>*]:pointer-events-auto" style={{ top: TOP_BAR }}>
        <Rail items={items} value={page} onChange={setPage} testId="studio-rail" />
        <RailPage title={title}>{body}</RailPage>
      </div>
    </div>
  );
}
