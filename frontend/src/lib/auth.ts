/**
 * Where the token lives depends on whether "Keep me signed in" was checked at
 * login. A remembered session goes in localStorage, which survives closing the
 * browser; an unremembered one goes in sessionStorage, which the browser clears
 * itself the moment it fully closes — that's what makes "don't ask again" vs.
 * "ask again next time I open the browser" work without any expiry timer of
 * our own. `auth_remember` (localStorage, always) is just the flag recording
 * which one to use — it holds no credential, so it's fine for it to persist.
 */
export const isRemembered = (): boolean =>
  typeof window !== 'undefined' && localStorage.getItem('auth_remember') === '1';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('auth_token') ?? localStorage.getItem('auth_token');
};

export const setToken = (token: string, remember: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_remember', remember ? '1' : '0');
  if (remember) {
    localStorage.setItem('auth_token', token);
    sessionStorage.removeItem('auth_token');
  } else {
    sessionStorage.setItem('auth_token', token);
    localStorage.removeItem('auth_token');
  }
};

/**
 * Wipe every trace of the signed-in session.
 *
 * There are FIVE places a session lives, and clearing only some of them left the
 * app in a state that looked signed in but could do nothing:
 *
 *   1. localStorage/sessionStorage `auth_token` — read by the axios interceptor
 *   2. localStorage/sessionStorage `auth-storage` — the persisted Zustand user,
 *                                    which is what the sidebar, badges and role
 *                                    guards read
 *   3. localStorage `auth_remember` — which of the above two storages is live
 *   4. cookie `auth_token`         — read by the Next.js middleware
 *   5. cookie `user_role`          — role hint for edge redirects
 *
 * The expired-token path used to clear only (1). The middleware still saw the
 * cookie, so sending someone to /auth/login bounced them straight back to
 * /dashboard, where every request failed — which is why a stale login appeared
 * to last for days until the member logged out by hand.
 */
export const clearSession = (): void => {
  if (typeof window === 'undefined') return;

  for (const store of [localStorage, sessionStorage]) {
    store.removeItem('auth_token');
    store.removeItem('auth_user');
    store.removeItem('auth-storage');
  }
  localStorage.removeItem('auth_remember');

  document.cookie = 'auth_token=; path=/; max-age=0';
  document.cookie = 'user_role=; path=/; max-age=0';
};

/** @deprecated Use clearSession() — this left cookies and the store behind. */
export const removeToken = clearSession;

export const isAuthenticated = (): boolean => !!getToken();
