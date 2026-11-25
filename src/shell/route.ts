import { useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useUi, type Screen } from '@/store/ui';
import { langFromPath, onLangChange, useLang, type Lang } from '@/i18n';

/*
 * The screen lives in the address (…/studio, …/rapide) so the browser's back
 * button works and a mode can be bookmarked. GitHub Pages serves 404.html (a
 * copy of index.html) for these paths; old …/#/studio links are redirected.
 */

const BASE = import.meta.env.BASE_URL;

export const SCREEN_PATH: Record<Screen, string> = {
  home: '',
  about: 'a-propos',
  quick: 'rapide',
  project: 'projet',
  studio: 'studio',
};

/** Where an English address differs (…/en/about, not …/en/a-propos). */
const EN_PATH: Partial<Record<Screen, string>> = { about: 'about' };

/** Address of a screen in a language (default: the current one), e.g. /studio, /en/studio, /en/, /a-propos, /en/about. */
export const urlOf = (screen: Screen, lang: Lang = useLang.getState().lang) =>
  BASE + (lang === 'en' ? 'en/' + (EN_PATH[screen] ?? SCREEN_PATH[screen]) : SCREEN_PATH[screen]);

/** Screens that can be opened in this version. */
export const AVAILABLE: Record<Screen, boolean> = { home: true, about: true, quick: true, project: true, studio: true };

/** Screens shown as a page to read (no editor, no project): the landing and the about page. */
export const isPage = (screen: Screen) => screen === 'home' || screen === 'about';

/** The modes, main one first: Studio · Rapide · Projet. */
export const MODE_ORDER: Screen[] = ['studio', 'quick', 'project'];

function screenFromSegment(segment: string): Screen | null {
  const found = (Object.keys(SCREEN_PATH) as Screen[]).find((s) => SCREEN_PATH[s] === segment || EN_PATH[s] === segment);
  return found && AVAILABLE[found] ? found : null;
}

/** The screen an address shows (unknown addresses show the home page). */
export function screenFromLocation(pathname: string, hash: string): Screen {
  // older links: …/#/studio
  if (hash.startsWith('#/')) return screenFromSegment(hash.slice(2).replace(/\/$/, '')) ?? 'home';
  let rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, '');
  rest = rest.replace(/^en(\/|$)/, '');
  return screenFromSegment(rest.replace(/\/$/, '')) ?? 'home';
}

/** Shows a screen; the change cross-fades (View Transitions) unless it is instant or motion is reduced. */
function apply(screen: Screen, instant = false) {
  const ui = useUi.getState();
  if (ui.screen === screen) return;
  if (instant || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return ui.setScreen(screen);
  // a newer change skips this one: its rejected promise is expected
  document.startViewTransition(() => flushSync(() => useUi.getState().setScreen(screen))).ready.catch(() => undefined);
}

/** Opens a screen (pushes a history entry); `instant` for keyboard actions, which never animate. */
export function navigate(screen: Screen, { instant = false } = {}) {
  const target = AVAILABLE[screen] ? screen : 'home';
  apply(target, instant);
  if (location.pathname !== urlOf(target) || location.hash) history.pushState(null, '', urlOf(target));
}

/** Keeps the store in step with the address. Call once, in App. */
export function useRouteSync() {
  useEffect(() => {
    const sync = () => {
      // the address decides the language (history moves can cross languages)
      const lang = langFromPath(location.pathname);
      if (lang && lang !== useLang.getState().lang) {
        document.documentElement.lang = lang;
        useLang.setState({ lang });
      }
      const screen = screenFromLocation(location.pathname, location.hash);
      // old #/ links and unknown addresses: show the clean address
      if (location.pathname !== urlOf(screen) || location.hash) history.replaceState(null, '', urlOf(screen));
      apply(screen);
    };
    sync();
    // a language change moves the address to that language (same screen)
    const offLang = onLangChange((lang) => history.replaceState(null, '', urlOf(useUi.getState().screen, lang)));
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      offLang();
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
}
