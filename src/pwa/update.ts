import { create } from 'zustand';

/*
 * New versions. The web app updates on its own, at a moment nobody notices:
 * right away when the page has just opened, otherwise the next time the tab is
 * hidden; never during an export or a render, and only after the project is
 * saved. The desktop app (Electron updater) still asks through the banner.
 */

interface UpdateState {
  available: boolean;
  dismissed: boolean;
  /** What "Update" does (reload into the new version, or install the desktop update). */
  apply: (() => void) | null;
}

export const useUpdate = create<UpdateState>(() => ({ available: false, dismissed: false, apply: null }));

declare global {
  interface Window {
    __BUILD_ID__?: string;
    __mockuplabUpdate?: { show: () => void };
  }
}

export function offerUpdate(apply: () => void) {
  useUpdate.setState({ available: true, dismissed: false, apply });
}

export async function startUpdates() {
  window.__BUILD_ID__ = __BUILD_ID__;
  window.__mockuplabUpdate = { show: () => useUpdate.setState({ dismissed: false }) };
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  // the plugin reloads only when the new version arrived while this page was open; one already waiting at
  // load would take over without reloading, so the page reloads itself when the new version takes control
  let reloading = false;
  const reloadInto = async () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    await updateSW(true);
  };
  const updateSW = registerSW({
    onNeedRefresh: () => applyWhenQuiet(reloadInto),
    onRegisteredSW: (_url, reg) => {
      // check for a new version every hour while the app stays open
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
}

const OPENED_AT = performance.now();
/** Just opened: nothing done yet, a reload goes unseen. */
const JUST_OPENED_MS = 15_000;

function applyWhenQuiet(reload: () => Promise<void>) {
  const tryNow = async () => {
    const [{ useUi }, { autosavePaused, flushSave }] = await Promise.all([import('@/store/ui'), import('@/store/persistence')]);
    if (useUi.getState().exporting || autosavePaused()) return false;
    await flushSave();
    await reload();
    return true;
  };
  void (async () => {
    if ((document.hidden || performance.now() - OPENED_AT < JUST_OPENED_MS) && (await tryNow())) return;
    const onHide = async () => {
      if (document.visibilityState === 'hidden' && (await tryNow())) document.removeEventListener('visibilitychange', onHide);
    };
    document.addEventListener('visibilitychange', onHide);
  })();
}
