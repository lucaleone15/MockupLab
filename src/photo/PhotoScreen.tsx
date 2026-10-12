import { PhotoLibrary } from './PhotoLibrary';
import { PhotoPanel } from './PhotoPanel';
import { PhotoView } from './PhotoView';

export function PhotoScreen() {
  return (
    <div className="flex min-h-0 flex-1">
      <PhotoLibrary />
      <PhotoView />
      <aside className="scroll-thin w-[300px] shrink-0 overflow-y-auto border-l border-line bg-surface">
        <PhotoPanel />
      </aside>
    </div>
  );
}
