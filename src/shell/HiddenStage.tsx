import { Viewport } from '@/app/Viewport';

/**
 * The 3D engine, mounted off screen: Quick and Project render their
 * thumbnails with it (through the variants sandbox) without showing it.
 */
export function HiddenStage() {
  return (
    <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 flex h-[600px] w-[960px]" data-testid="hidden-stage">
      <Viewport />
    </div>
  );
}
