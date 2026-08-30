import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
  bio?: string;
  nickname?: string | null;
  alternate_names?: { name: string; type: 'maiden' | 'previous' | 'alternate' }[];
  date_of_birth?: string;
  gender?: string;
  height_cm?: number;
  current_weight_kg?: number;
  goal_weight_kg?: number;
  activity_level?: string;
  primary_goal?: string;
  daily_calorie_goal?: number;
  daily_protein_goal_g?: number;
  daily_carbs_goal_g?: number;
  daily_fat_goal_g?: number;
  daily_water_goal_glasses: number;
  email_notifications?: boolean;
  billboard?: { text?: string; font?: string; color?: string; background?: string } | null;
  subscription_status: string;
  is_on_trial: boolean;
  trial_days_remaining: number;
  trial_ends_at?: string;
  onboarding_completed: boolean;
  member_since: string;
  is_admin: boolean;
  email_verified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser) => void;
  /** Re-read the signed-in user from the server. */
  refreshUser: () => Promise<void>;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') localStorage.setItem('auth_token', token);
        set({ user, token });
      },
      setUser: (user) => set({ user }),
      /**
       * The user record is persisted to localStorage and was only ever written
       * at sign-in. Anything the server changed afterwards — subscribing, most
       * visibly — never reached the browser, so a member who had just paid for a
       * year was still shown "19d left" on their dashboard until they logged out
       * and back in. The API was already returning is_on_trial: false.
       *
       * Fails silently: a stale badge is bad, but breaking the page because a
       * refresh call did not land would be worse.
       */
      refreshUser: async () => {
        if (typeof window === 'undefined') return;
        if (!localStorage.getItem('auth_token')) return;
        try {
          const { data } = await api.get('/auth/user');
          const fresh = data.data ?? data.user ?? null;
          if (fresh) set({ user: fresh });
        } catch { /* keep whatever we have */ }
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        set({ user: null, token: null });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
