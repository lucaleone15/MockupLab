import { Tooltip } from 'radix-ui';
import { LibraryPanel } from './LibraryPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { useGlobalInput } from './shortcuts';
import { Toaster } from './Toaster';
import { TopBar } from './TopBar';
import { Viewport } from './Viewport';

export function App() {
  useGlobalInput();
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <LibraryPanel />
          <Viewport />
          <PropertiesPanel />
        </div>
      </div>
      <Toaster />
    </Tooltip.Provider>
  );
}
