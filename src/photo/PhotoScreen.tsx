import { PropertiesPanel } from '@/app/PropertiesPanel';
import { PhotoLibrary } from './PhotoLibrary';
import { PhotoView } from './PhotoView';

export function PhotoScreen() {
  return (
    <div className="flex min-h-0 flex-1">
      <PhotoLibrary />
      <PhotoView />
      <PropertiesPanel />
    </div>
  );
}
