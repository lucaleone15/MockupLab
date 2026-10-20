import { create } from 'zustand';

export type Theme = 'dark' | 'light';
/** What the user picked: follow the system, or force one theme. */
export type ThemePref = 'auto' | 'light' | 'dark';
export type Screen = 'home' | 'quick' | 'project' | 'studio';
export type StudioPage = 'devices' | 'settings' | 'decor' | 'light' | 'camera' | 'text' | 'brand';

interface UiState {
  /** The theme in use (resolved from the preference and the system). */
  theme: Theme;
  themePref: ThemePref;
  setThemePref: (p: ThemePref) => void;
  /** Which screen is shown (mirrors the URL hash, see src/shell/route.ts). */
  screen: Screen;
  setScreen: (s: Screen) => void;
  studioPage: StudioPage;
  setStudioPage: (p: StudioPage) => void;
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
  /** Tab of the Export window (the last one used opens again). */
  exportTab: 'image' | 'video';
  setExportTab: (tab: 'image' | 'video') => void;
  /** The Export window stepped aside for a preview and comes back when it ends. */
  reopenExport: boolean;
  setReopenExport: (v: boolean) => void;
  allProjectsOpen: boolean;
  setAllProjectsOpen: (v: boolean) => void;
  /** Incremented to ask the camera rig to return to the default view. */
  viewResetToken: number;
  /** Shows where a social network's interface covers the frame (never exported). */
  safeZones: boolean;
  setSafeZones: (on: boolean) => void;
  resetView: () => void;
  /** Label of the running export, null when idle. */
  exporting: string | null;
  setExporting: (label: string | null) => void;
  /** Stops the running export (videos), when it can be stopped. */
  cancelExport: (() => void) | null;
  setCancelExport: (fn: (() => void) | null) => void;
  /** An animation preview is playing in the viewport. */
  previewing: boolean;
  setPreviewing: (v: boolean) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  /** Selected text / logo layer (null: the selected device has focus). */
  selectedOverlayId: string | null;
  selectOverlay: (id: string | null) => void;
  /** Surface slot that receives imported images (null: the first empty one). */
  activeSlot: string | null;
  setActiveSlot: (slot: string | null) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  /** Step of the first-visit guide being shown, null when closed. */
  tourStep: number | null;
  setTourStep: (step: number | null) => void;
  /** Last successful autosave (ms), null before the first one. */
  savedAt: number | null;
  setSavedAt: (t: number) => void;
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem('mockuplab:theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

const resolve = (p: ThemePref): Theme => (p === 'auto' ? (systemDark() ? 'dark' : 'light') : p);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export const useUi = create<UiState>((set) => ({
  theme: resolve(readPref()),
  themePref: readPref(),
  setThemePref: (themePref) => {
    try {
      if (themePref === 'auto') localStorage.removeItem('mockuplab:theme');
      else localStorage.setItem('mockuplab:theme', themePref);
    } catch {
      /* storage unavailable */
    }
    const theme = resolve(themePref);
    applyTheme(theme);
    set({ themePref, theme });
  },
  screen: 'home',
  setScreen: (screen) => set({ screen }),
  studioPage: 'devices',
  setStudioPage: (studioPage) => set({ studioPage }),
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  exportTab: 'image',
  setExportTab: (exportTab) => set({ exportTab }),
  reopenExport: false,
  setReopenExport: (reopenExport) => set({ reopenExport }),
  allProjectsOpen: false,
  setAllProjectsOpen: (allProjectsOpen) => set({ allProjectsOpen }),
  viewResetToken: 0,
  safeZones: false,
  setSafeZones: (safeZones) => set({ safeZones }),
  resetView: () => set((s) => ({ viewResetToken: s.viewResetToken + 1 })),
  exporting: null,
  setExporting: (exporting) => set({ exporting }),
  cancelExport: null,
  setCancelExport: (cancelExport) => set({ cancelExport }),
  previewing: false,
  // a preview started from the Export window gives it back when it ends
  setPreviewing: (previewing) => set((s) => (!previewing && s.reopenExport ? { previewing, reopenExport: false, exportOpen: true, exportTab: 'video' } : { previewing })),
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
  selectedOverlayId: null,
  selectOverlay: (selectedOverlayId) => set({ selectedOverlayId }),
  activeSlot: null,
  setActiveSlot: (activeSlot) => set({ activeSlot }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  tourStep: null,
  setTourStep: (tourStep) => set({ tourStep }),
  savedAt: null,
  setSavedAt: (savedAt) => set({ savedAt }),
}));

// Auto: follow the system theme live.
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { themePref } = useUi.getState();
    if (themePref !== 'auto') return;
    const theme = resolve('auto');
    applyTheme(theme);
    useUi.setState({ theme });
  });
}
