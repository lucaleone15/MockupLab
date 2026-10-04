import { Tooltip } from 'radix-ui';
import { LibraryPanel } from './LibraryPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { useGlobalInput } from './shortcuts';
import { HelpDialog } from './HelpDialog';
import { Toaster } from './Toaster';
import { TopBar } from './TopBar';
import { PreviewOverlay, Viewport } from './Viewport';
import { useProject } from '@/store/project';
import { PhotoLibrary } from '@/photo/PhotoLibrary';
import { PhotoView } from '@/photo/PhotoView';
import { VariantsDialog } from '@/variants/VariantsDialog';
import { BatchDialog } from '@/variants/BatchDialog';

export function App() {
  useGlobalInput();
  const photo = useProject((s) => s.mode === 'photo');
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          {photo ? <PhotoLibrary /> : <LibraryPanel />}
          {photo ? <PhotoView /> : <Viewport />}
          <PropertiesPanel />
        </div>
      </div>
      <Toaster />
      <HelpDialog />
      <VariantsDialog />
      <PreviewOverlay />
      <BatchDialog />
    </Tooltip.Provider>
  );
}
