import { LibraryPanel } from '@/app/LibraryPanel';
import { PropertiesPanel } from '@/app/PropertiesPanel';
import { Viewport } from '@/app/Viewport';

export function StudioScreen() {
  return (
    <div className="flex min-h-0 flex-1">
      <LibraryPanel />
      <Viewport />
      <PropertiesPanel />
    </div>
  );
}
