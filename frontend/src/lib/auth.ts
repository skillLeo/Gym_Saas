export const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

export const setToken = (token: string): void =>
  localStorage.setItem('auth_token', token);

/**
 * Wipe every trace of the signed-in session.
 *
 * There are FOUR places a session lives, and clearing only some of them left the
 * app in a state that looked signed in but could do nothing:
 *
 *   1. localStorage `auth_token`   — read by the axios interceptor
 *   2. localStorage `auth-storage` — the persisted Zustand user, which is what
 *                                    the sidebar, badges and role guards read
 *   3. cookie `auth_token`         — read by the Next.js middleware
 *   4. cookie `user_role`          — role hint for edge redirects
 *
 * The expired-token path used to clear only (1). The middleware still saw the
 * cookie, so sending someone to /auth/login bounced them straight back to
 * /dashboard, where every request failed — which is why a stale login appeared
 * to last for days until the member logged out by hand.
 */
export const clearSession = (): void => {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth-storage');

  document.cookie = 'auth_token=; path=/; max-age=0';
  document.cookie = 'user_role=; path=/; max-age=0';
};

/** @deprecated Use clearSession() — this left cookies and the store behind. */
export const removeToken = clearSession;

export const isAuthenticated = (): boolean => !!getToken();
