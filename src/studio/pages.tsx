import { BackgroundSection, CameraSection, DecorSection, LightSection } from '@/app/panels/ScenePanel';
import { BrandPage, TextPage } from '@/app/panels/TextPanel';
import type { StudioPage } from '@/store/ui';

/** Body of the rail pages built from the existing panel sections. */
export function StudioPageBody({ page }: { page: StudioPage }) {
  switch (page) {
    case 'decor':
      return (
        <>
          <BackgroundSection />
          <DecorSection />
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
    default:
      return null;
  }
}
