import axios from 'axios';
import { clearSession } from './auth';

/**
 * Origin the API answers on, without a trailing slash.
 *
 * Inlined at BUILD time, not read at runtime — rebuilding is what changes it.
 * Falling back to '' rather than letting the value be `undefined` matters: the
 * old `process.env.NEXT_PUBLIC_API_URL + '/api'` compiled to the literal string
 * "undefined/api" whenever the variable was missing at build time, so every
 * request went to a nonsense path and the whole app looked dead with no clue
 * why. Empty means same-origin `/api`, which is exactly right for the
 * production deployment where the site and the API share one domain.
 */
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_ORIGIN + '/api',
  withCredentials: false,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const onAuthPage = window.location.pathname.startsWith('/auth');
      if (!onAuthPage) {
        // Clear EVERYTHING. Removing only the localStorage token left the
        // auth_token cookie in place, so the Next.js middleware treated the
        // visitor as signed in and bounced them from /auth/login straight back
        // to /dashboard — where every request failed again. A member whose
        // token had expired appeared to stay logged in indefinitely.
        clearSession();
        window.location.href = '/auth/login?expired=1';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
