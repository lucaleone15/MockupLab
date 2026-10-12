import { Blend, Clapperboard, ImageUp, Images, Scan } from 'lucide-react';
import { useT } from '@/i18n';
import { VideoPage } from '@/studio/VideoPage';
import { Rail, RailPage, type RailItem } from '@/shell/Rail';
import { useProject } from '@/store/project';
import { useUi, type PhotoPage } from '@/store/ui';
import { BlendSection, DesignSection, GeometrySection, PhotoSection, ZonesSection } from './PhotoPanel';
import { PhotoLibraryPage } from './PhotoLibrary';
import { PhotoView } from './PhotoView';

export function PhotoScreen() {
  const { t } = useT();
  const page = useUi((s) => s.photoPage);
  const setPage = useUi((s) => s.setPhotoPage);
  const zone = useProject((s) => s.photo.zones.find((z) => z.id === s.photo.selectedZoneId));
  const hasPhoto = useProject((s) => !!s.photo.assetId);
  const items: RailItem<PhotoPage>[] = [
    { id: 'photos', label: t('page.photos'), icon: <Images size={20} /> },
    { id: 'zones', label: t('page.zones'), icon: <Scan size={20} /> },
    { id: 'design', label: t('page.design'), icon: <ImageUp size={20} /> },
    { id: 'render', label: t('page.render'), icon: <Blend size={20} /> },
    { id: 'video', label: t('page.video'), icon: <Clapperboard size={20} /> },
  ];
  const needsZone = page === 'design' || page === 'render';
  const empty = (key: 'photo.panel.empty' | 'photo.pickZone') => <p className="px-5 py-3 text-[13px] leading-relaxed text-fg-muted">{t(key)}</p>;
  return (
    <div className="flex min-h-0 flex-1 gap-2 p-2">
      <Rail items={items} value={page} onChange={setPage} testId="photo-rail" />
      <RailPage title={items.find((i) => i.id === page)?.label ?? ''}>
        {page === 'photos' && (
          <>
            <PhotoLibraryPage />
            {hasPhoto && <PhotoSection />}
          </>
        )}
        {page === 'zones' && (hasPhoto ? <ZonesSection /> : empty('photo.panel.empty'))}
        {needsZone && !hasPhoto && empty('photo.panel.empty')}
        {needsZone && hasPhoto && !zone && empty('photo.pickZone')}
        {page === 'design' && zone && <DesignSection zone={zone} />}
        {page === 'render' && zone && (
          <>
            <BlendSection zone={zone} />
            <GeometrySection zone={zone} />
          </>
        )}
        {page === 'video' && <VideoPage />}
      </RailPage>
      <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[14px]">
        <PhotoView />
      </div>
    </div>
  );
}
