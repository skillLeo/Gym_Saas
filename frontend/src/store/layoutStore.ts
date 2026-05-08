import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LayoutMode = 'topnav' | 'sidebar';

interface LayoutState {
  mode: LayoutMode;
  setMode: (m: LayoutMode) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({ mode: 'topnav', setMode: (mode) => set({ mode }) }),
    { name: 'mx-layout' }
  )
);
