import type { AuthTokens, AuthUser, LoginInput, RegisterInput } from '@grid/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, tokenStore } from '../lib/api';

interface AuthState {
  user: AuthUser | null;
  /** true while the stored session is being restored on first load */
  restoring: boolean;
  login: (input: LoginInput) => Promise<string | null>;
  register: (input: RegisterInput) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function acceptSession(tokens: AuthTokens) {
  tokenStore.setAccess(tokens.accessToken);
  tokenStore.setRefresh(tokens.refreshToken);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(() => tokenStore.getRefresh() !== null);

  useEffect(() => {
    const stored = tokenStore.getRefresh();
    if (!stored) return;
    void api
      .POST('/auth/refresh', { body: { refreshToken: stored } })
      .then(({ data }) => {
        if (data) {
          acceptSession(data);
          setUser(data.user);
        } else {
          tokenStore.setRefresh(null);
        }
      })
      .finally(() => setRestoring(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { data, error } = await api.POST('/auth/login', { body: input });
    if (!data) return error?.message ?? 'Sign-in failed';
    acceptSession(data);
    setUser(data.user);
    return null;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { data, error } = await api.POST('/auth/register', { body: input });
    if (!data) return error?.message ?? 'Registration failed';
    acceptSession(data);
    setUser(data.user);
    return null;
  }, []);

  const logout = useCallback(async () => {
    const stored = tokenStore.getRefresh();
    if (stored) await api.POST('/auth/logout', { body: { refreshToken: stored } });
    tokenStore.setAccess(null);
    tokenStore.setRefresh(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.GET('/users/me');
    if (data) setUser(data);
  }, []);

  const value = useMemo(
    () => ({ user, restoring, login, register, logout, refreshUser }),
    [user, restoring, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
