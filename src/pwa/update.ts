import { create } from 'zustand';

/*
 * New versions: the web app (service worker) and the desktop app (Electron
 * updater) both report here, and one banner asks the user. Nothing reloads
 * or installs without their click.
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
    mockuplabDesktop?: {
      platform: string;
      onUpdate: (cb: (info: { state: 'available' | 'downloaded'; version: string }) => void) => void;
      installUpdate: () => void;
    };
  }
}

export function offerUpdate(apply: () => void) {
  useUpdate.setState({ available: true, dismissed: false, apply });
}

export async function startUpdates() {
  window.__BUILD_ID__ = __BUILD_ID__;
  window.__mockuplabUpdate = { show: () => useUpdate.setState({ dismissed: false }) };
  const desktop = window.mockuplabDesktop;
  if (desktop) {
    desktop.onUpdate(() => offerUpdate(() => desktop.installUpdate()));
    return;
  }
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  const updateSW = registerSW({
    onNeedRefresh: () => offerUpdate(() => void updateSW(true)),
    onRegisteredSW: (_url, reg) => {
      // check for a new version every hour while the app stays open
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
}
