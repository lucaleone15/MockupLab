import { BackgroundSection, CameraSection, DecorSection, GroundSection, LightSection } from '@/app/panels/ScenePanel';
import { BrandPage, TextPage } from '@/app/panels/TextPanel';
import type { StudioPage } from '@/store/ui';
import { VideoPage } from './VideoPage';

/** Body of the rail pages built from the existing panel sections. */
export function StudioPageBody({ page }: { page: StudioPage }) {
  switch (page) {
    case 'decor':
      return (
        <>
          <BackgroundSection />
          <DecorSection />
          <GroundSection />
        </>
      );
    case 'light':
      return <LightSection />;
    case 'camera':
      return <CameraSection />;
    case 'text':
      return <TextPage />;
    case 'brand':
      return <BrandPage />;
    case 'video':
      return <VideoPage />;
    default:
      return null;
  }
}
