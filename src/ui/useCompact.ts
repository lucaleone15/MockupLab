import { useSyncExternalStore } from 'react';

/** Below this width the editor takes its phone layout. */
const QUERY = '(max-width: 767px)';

const media = typeof window !== 'undefined' ? window.matchMedia(QUERY) : null;
const subscribe = (cb: () => void) => {
  media?.addEventListener('change', cb);
  return () => media?.removeEventListener('change', cb);
};

/** True on a phone-sized screen: the editor stacks its panels instead of setting them side by side. */
export function useCompact() {
  return useSyncExternalStore(subscribe, () => !!media?.matches, () => false);
}

/** A touch screen without hover: actions shown on hover are shown outright. */
export const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
