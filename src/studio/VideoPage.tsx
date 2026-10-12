import { useEffect } from 'react';
import { VideoSection } from '@/animation/VideoSection';
import { useProject } from '@/store/project';

/** Switches what "export" means while the Video page is open, outside the undo history. */
function setKind(kind: 'image' | 'video') {
  if (useProject.getState().export.kind === kind) return;
  const history = useProject.temporal.getState();
  history.pause();
  useProject.getState().setExport({ kind });
  history.resume();
}

/** Video lives in its own page; while it is open, exports are videos. */
export function VideoPage() {
  useEffect(() => {
    setKind('video');
    return () => setKind('image');
  }, []);
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3">
      <VideoSection />
    </div>
  );
}
