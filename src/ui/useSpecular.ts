import { useEffect } from 'react';

const SURFACES = '.glass, .glass-float, .menu-surface';

/**
 * The glass catches the light where the pointer is: sets --mx / --my (px) on
 * the frosted surface under the pointer, once per frame at most. A pointer
 * listener, not a scroll one; nothing under reduced motion.
 */
export function useSpecular() {
  useEffect(() => {
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let last: { el: HTMLElement; x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (still.matches || e.pointerType === 'touch') return;
      const el = (e.target as Element | null)?.closest?.(SURFACES) as HTMLElement | null;
      if (!el) return;
      last = { el, x: e.clientX, y: e.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!last) return;
        const r = last.el.getBoundingClientRect();
        last.el.style.setProperty('--mx', `${Math.round(last.x - r.left)}px`);
        last.el.style.setProperty('--my', `${Math.round(last.y - r.top)}px`);
      });
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
}
