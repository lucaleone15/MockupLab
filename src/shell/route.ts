import { useEffect } from 'react';
import { useUi, type Screen } from '@/store/ui';

/*
 * The screen lives in the address (…/studio, …/rapide) so the browser's back
 * button works and a mode can be bookmarked. GitHub Pages serves 404.html (a
 * copy of index.html) for these paths; old …/#/studio links are redirected.
 */

const BASE = import.meta.env.BASE_URL;

export const SCREEN_PATH: Record<Screen, string> = {
  home: '',
  quick: 'rapide',
  project: 'projet',
  studio: 'studio',
};

/** Address of a screen, e.g. /MockupLab/studio. */
export const urlOf = (screen: Screen) => BASE + SCREEN_PATH[screen];

/** Screens that can be opened in this version. */
export const AVAILABLE: Record<Screen, boolean> = { home: true, quick: true, project: true, studio: true };

/** The modes, main one first: Studio · Rapide · Projet. */
export const MODE_ORDER: Screen[] = ['studio', 'quick', 'project'];

function screenFromSegment(segment: string): Screen | null {
  const found = (Object.keys(SCREEN_PATH) as Screen[]).find((s) => SCREEN_PATH[s] === segment);
  return found && AVAILABLE[found] ? found : null;
}

/** The screen an address shows (unknown addresses show the home page). */
export function screenFromLocation(pathname: string, hash: string): Screen {
  // older links: …/#/studio
  if (hash.startsWith('#/')) return screenFromSegment(hash.slice(2).replace(/\/$/, '')) ?? 'home';
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '');
  return screenFromSegment(rest.replace(/\/$/, '')) ?? 'home';
}

function apply(screen: Screen) {
  const ui = useUi.getState();
  if (ui.screen !== screen) ui.setScreen(screen);
}

/** Opens a screen (pushes a history entry). */
export function navigate(screen: Screen) {
  const target = AVAILABLE[screen] ? screen : 'home';
  apply(target);
  if (location.pathname !== urlOf(target) || location.hash) history.pushState(null, '', urlOf(target));
}

/** Keeps the store in step with the address. Call once, in App. */
export function useRouteSync() {
  useEffect(() => {
    const sync = () => {
      const screen = screenFromLocation(location.pathname, location.hash);
      // old #/ links and unknown addresses: show the clean address
      if (location.pathname !== urlOf(screen) || location.hash) history.replaceState(null, '', urlOf(screen));
      apply(screen);
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
}
