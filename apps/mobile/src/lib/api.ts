import { createGridClient } from '@grid/api-client';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'grid.refreshToken';

let accessToken: string | null = null;

export const tokenStore = {
  getAccess: () => accessToken,
  setAccess(token: string | null) {
    accessToken = token;
  },
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
  async setRefresh(token: string | null) {
    if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
    else await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

/**
 * In Expo Go the API runs on the same machine as Metro — derive its LAN address
 * from the bundler host so a physical phone reaches it. Override with
 * EXPO_PUBLIC_API_URL when the API lives elsewhere.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3001`;
}

export const API_BASE = resolveBaseUrl();

export const api = createGridClient({
  baseUrl: API_BASE,
  getAccessToken: tokenStore.getAccess,
});
