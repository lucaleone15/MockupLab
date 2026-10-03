import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  /** Incremented to ask the camera rig to return to the default view. */
  viewResetToken: number;
  resetView: () => void;
  /** Label of the running export, null when idle. */
  exporting: string | null;
  setExporting: (label: string | null) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
}

const initialTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export const useUi = create<UiState>((set) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('mockuplab:theme', theme);
    } catch {
      /* storage unavailable */
    }
    set({ theme });
  },
  viewResetToken: 0,
  resetView: () => set((s) => ({ viewResetToken: s.viewResetToken + 1 })),
  exporting: null,
  setExporting: (exporting) => set({ exporting }),
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
}));
