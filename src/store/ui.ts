import { create } from 'zustand';

export type Theme = 'dark' | 'light';
/** What the user picked: follow the system, or force one theme. */
export type ThemePref = 'auto' | 'light' | 'dark';
export type Screen = 'home' | 'quick' | 'project' | 'studio' | 'photo';
export type StudioPage = 'devices' | 'settings' | 'ambiance' | 'decor' | 'light' | 'camera' | 'text' | 'brand' | 'video';
export type PhotoPage = 'photos' | 'zones' | 'design' | 'render' | 'video';

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
  photoPage: PhotoPage;
  setPhotoPage: (p: PhotoPage) => void;
  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;
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
  /** Photo mode preview zoom (1 = none). */
  previewZoom: number;
  setPreviewZoom: (v: number) => void;
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
  /** Last successful autosave (ms), null before the first one. */
  savedAt: number | null;
  setSavedAt: (t: number) => void;
  /** Photo mode: editing zones, or clicking the four corners of a new one. */
  photoTool: 'select' | 'place';
  setPhotoTool: (tool: 'select' | 'place') => void;
  /** Photo mode: corner of the selected zone moved by the arrow keys (0..3). */
  activeCorner: number | null;
  setActiveCorner: (i: number | null) => void;
  /** Photo mode: the suggestions of the last detection, shown on the photo to pick from. */
  suggestions: { zoneId: string; candidates: [number, number][][]; index: number } | null;
  setSuggestions: (s: UiState['suggestions']) => void;
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
  photoPage: 'photos',
  setPhotoPage: (photoPage) => set({ photoPage }),
  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
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
  setPreviewing: (previewing) => set({ previewing }),
  previewZoom: 1,
  setPreviewZoom: (previewZoom) => set({ previewZoom }),
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
  selectedOverlayId: null,
  selectOverlay: (selectedOverlayId) => set({ selectedOverlayId }),
  activeSlot: null,
  setActiveSlot: (activeSlot) => set({ activeSlot }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  savedAt: null,
  setSavedAt: (savedAt) => set({ savedAt }),
  photoTool: 'select',
  setPhotoTool: (photoTool) => set({ photoTool }),
  activeCorner: null,
  setActiveCorner: (activeCorner) => set({ activeCorner }),
  suggestions: null,
  setSuggestions: (suggestions) => set({ suggestions }),
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
