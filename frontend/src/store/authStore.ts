import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '@/lib/api';
import { isRemembered, getToken, setToken } from '@/lib/auth';
import { useI18nStore, LOCALES, type Locale } from '@/store/i18nStore';

/**
 * The account's own saved language wins over whatever this browser happens to
 * have cached — otherwise two members signing in from the same computer see
 * whichever language the last one left behind (that's the actual bug this
 * closes: language was device-scoped, not account-scoped). Guarded against
 * anything but the three real locales, since the value crossed the network.
 */
function syncLocaleFromAccount(locale: unknown): void {
  if (typeof locale === 'string' && LOCALES.some((l) => l.id === locale)) {
    useI18nStore.getState().setLocale(locale as Locale);
  }
}

/**
 * Reads/writes wherever setAuth() last decided the session belongs — see the
 * note on isRemembered() in lib/auth.ts. Falls back to sessionStorage so an
 * unremembered session (the common "did not check the box" case) never
 * survives closing the browser, which is the whole point of the flag.
 */
const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const rememberAwareStorage = createJSONStorage(() =>
  typeof window === 'undefined'
    ? noopStorage
    : {
        getItem: (name: string) => (isRemembered() ? localStorage : sessionStorage).getItem(name),
        setItem: (name: string, value: string) => (isRemembered() ? localStorage : sessionStorage).setItem(name, value),
        removeItem: (name: string) => {
          localStorage.removeItem(name);
          sessionStorage.removeItem(name);
        },
      }
);

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
  /**
   * True only when the user uploaded their own photo.
   *
   * `avatar_url` always has a value — the API substitutes a generated
   * ui-avatars.com image — so it can never be used to ask "does this user have
   * a photo?". Optional because a client holding a user object cached from
   * before the field existed would otherwise be a type error.
   */
  has_avatar?: boolean;
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
  locale?: string;
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
  setAuth: (user: AuthUser, token: string, remember: boolean) => void;
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
      setAuth: (user, token, remember) => {
        // Order matters: setToken() writes the `auth_remember` flag that
        // rememberAwareStorage reads, and it must land before `set()` below
        // triggers persist's own storage write — otherwise the Zustand-persisted
        // user/token could land in the wrong storage for this login.
        setToken(token, remember);
        set({ user, token });
        syncLocaleFromAccount(user.locale);
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
        if (!getToken()) return;
        try {
          const { data } = await api.get('/auth/user');
          const fresh = data.data ?? data.user ?? null;
          if (fresh) {
            set({ user: fresh });
            syncLocaleFromAccount(fresh.locale);
          }
        } catch { /* keep whatever we have */ }
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_token');
        }
        set({ user: null, token: null });
      },
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      storage: rememberAwareStorage,
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
