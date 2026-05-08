export const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

export const setToken = (token: string): void =>
  localStorage.setItem('auth_token', token);

export const removeToken = (): void => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
};

export const isAuthenticated = (): boolean => !!getToken();
