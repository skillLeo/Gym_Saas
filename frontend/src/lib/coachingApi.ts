import axios from 'axios';
import { API_ORIGIN } from './api';

/**
 * Entirely separate client from `api.ts`. A physician's Sanctum token is
 * issued against the `physician` provider (config/auth.php) and must never be
 * sent as a member's Authorization header or vice versa — two different
 * localStorage keys keep that impossible by construction, not convention.
 */
const coachingApi = axios.create({
  baseURL: API_ORIGIN + '/api/coaching',
  withCredentials: false,
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
});

coachingApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('physician_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

coachingApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const onLogin = window.location.pathname.startsWith('/coaching-portal/login');
      if (!onLogin) {
        localStorage.removeItem('physician_token');
        localStorage.removeItem('physician_user');
        window.location.href = '/coaching-portal/login';
      }
    }
    return Promise.reject(error);
  }
);

export default coachingApi;
