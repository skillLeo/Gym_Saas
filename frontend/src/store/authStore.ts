import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
  bio?: string;
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
  subscription_status: string;
  is_on_trial: boolean;
  trial_days_remaining: number;
  trial_ends_at?: string;
  onboarding_completed: boolean;
  member_since: string;
  is_admin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser) => void;
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
