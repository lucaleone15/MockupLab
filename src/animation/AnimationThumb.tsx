import type { AnimationId } from '@/store/project';
import { cx } from '@/ui/primitives';

/*
 * A drawing of each animation: a phone on a backdrop, moved by a CSS animation
 * that mimics the camera or object move (keyframes `anim-<id>` in index.css).
 * It rests on its first frame and plays while `playing` (hover, focus or the
 * chosen one); reduced motion keeps it still.
 */
export function AnimationThumb({ id, playing }: { id: AnimationId; playing: boolean }) {
  return (
    <svg viewBox="0 0 72 44" className="h-[44px] w-full overflow-hidden rounded-md" aria-hidden>
      <rect width="72" height="44" className="fill-surface-4" />
      <rect y="34" width="72" height="10" className="fill-fg-subtle/15" />
      <g className={cx('anim-thumb', `anim-${id}`)} style={{ animationPlayState: playing ? 'running' : 'paused', transformBox: 'view-box', transformOrigin: '36px 24px' }}>
        <rect x="29" y="8" width="14" height="28" rx="3" className="fill-fg-muted" />
        <svg x="30.5" y="9.5" width="11" height="25" viewBox="0 0 11 25">
          <g className={id === 'scroll' ? 'anim-scroll-page' : undefined} style={{ animationPlayState: playing ? 'running' : 'paused' }}>
            <rect width="11" height="50" className="fill-surface-2" />
            {[3, 8, 13, 18, 23, 28, 33, 38, 43].map((y) => (
              <rect key={y} x="2" y={y} width={y % 10 === 3 ? 7 : 5} height="2" rx="1" className="fill-accent/70" />
            ))}
          </g>
        </svg>
      </g>
    </svg>
  );
}
