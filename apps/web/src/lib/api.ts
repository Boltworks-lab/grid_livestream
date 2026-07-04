import { createGridClient } from '@grid/api-client';

const REFRESH_KEY = 'grid.refreshToken';

let accessToken: string | null = null;

export const tokenStore = {
  getAccess: () => accessToken,
  setAccess(token: string | null) {
    accessToken = token;
  },
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh(token: string | null) {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = createGridClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  getAccessToken: tokenStore.getAccess,
});
