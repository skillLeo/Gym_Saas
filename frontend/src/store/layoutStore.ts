import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LayoutMode = 'topnav' | 'sidebar';

interface LayoutState {
  mode: LayoutMode;
  setMode: (m: LayoutMode) => void;
  accentColor: string;
  setAccentColor: (c: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      mode: 'sidebar', setMode: (mode) => set({ mode }),
      accentColor: '#F87404', setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: 'mx-layout', skipHydration: true }
  )
);
