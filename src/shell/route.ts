import { useEffect } from 'react';
import { useProject } from '@/store/project';
import { useUi, type Screen } from '@/store/ui';
import { sandbox } from '@/store/sandboxFlag';

/*
 * The screen lives in the URL hash so the browser's back button works and a
 * mode can be bookmarked. The project's own mode follows the screen:
 * studio ⇔ 'scene', photo ⇔ 'photo'. Quick and project are not built yet.
 */

export const SCREEN_HASH: Record<Screen, string> = {
  home: '#/',
  quick: '#/rapide',
  project: '#/projet',
  studio: '#/studio',
  photo: '#/photo',
};

/** Screens that can be opened in this version. */
export const AVAILABLE: Record<Screen, boolean> = { home: true, quick: true, project: true, studio: true, photo: true };

export function screenFromHash(hash: string): Screen {
  const found = (Object.keys(SCREEN_HASH) as Screen[]).find((s) => SCREEN_HASH[s] === hash);
  return found && AVAILABLE[found] ? found : 'home';
}

function apply(screen: Screen) {
  const ui = useUi.getState();
  if (screen === 'studio' || screen === 'photo') {
    const mode = screen === 'studio' ? 'scene' : 'photo';
    if (useProject.getState().mode !== mode) {
      // opening a screen is navigation, not an edit: keep it out of the undo history
      const history = useProject.temporal.getState();
      history.pause();
      useProject.getState().setMode(mode);
      history.resume();
      ui.setPhotoTool('select');
    }
  }
  if (ui.screen !== screen) ui.setScreen(screen);
}

/** Opens a screen (pushes a history entry). */
export function navigate(screen: Screen) {
  const target = AVAILABLE[screen] ? screen : 'home';
  // apply now (hashchange comes later, as a task): callers can rely on the new mode right away
  apply(target);
  if (location.hash !== SCREEN_HASH[target]) location.hash = SCREEN_HASH[target];
}

/** Keeps the store in step with the hash. Call once, in App. */
export function useRouteSync() {
  useEffect(() => {
    const sync = () => {
      const screen = screenFromHash(location.hash);
      // unknown or unavailable hash: normalise the address bar
      if (location.hash && location.hash !== SCREEN_HASH[screen]) history.replaceState(null, '', SCREEN_HASH[screen]);
      apply(screen);
    };
    sync();
    window.addEventListener('hashchange', sync);
    // the project's mode can change without the route (new project, opened file, undo): the screen follows
    const unsub = useProject.subscribe((s, prev) => {
      if (s.mode === prev.mode) return;
      const screen = useUi.getState().screen;
      if (screen !== 'studio' && screen !== 'photo') return;
      // a render sandbox putting the project back: keep the screen, restore its mode
      if (sandbox.restoring) {
        queueMicrotask(() => apply(useUi.getState().screen));
        return;
      }
      const target: Screen = s.mode === 'photo' ? 'photo' : 'studio';
      if (screen === target) return;
      history.replaceState(null, '', SCREEN_HASH[target]);
      useUi.getState().setScreen(target);
    });
    return () => {
      window.removeEventListener('hashchange', sync);
      unsub();
    };
  }, []);
}
