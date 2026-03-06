'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch } from '@/lib/api';

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login(credentials: { email: string; password: string }): Promise<void>;
  register(payload: {
    email: string;
    password: string;
    name?: string;
  }): Promise<void>;
  logout(): void;
  refreshProfile(): Promise<void>;
};

type ApiError = Error & { status?: number };

const ACCESS_TOKEN_KEY = 'affilate_access_token';
const REFRESH_TOKEN_KEY = 'affilate_refresh_token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistTokens = useCallback(
    (tokens: { access?: string | null; refresh?: string | null }) => {
      const { access = null, refresh = null } = tokens;
      setAccessToken(access);
      setRefreshToken(refresh);

      if (typeof window === 'undefined') {
        return;
      }

      if (access) {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
      } else {
        window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      }

      if (refresh) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
      } else {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    },
    [],
  );

  const refreshAccessToken = useCallback(
    async (tokenOverride?: string | null) => {
      const tokenToUse = tokenOverride ?? refreshToken;
      if (!tokenToUse) {
        throw new Error('Нет refresh токена');
      }

      const data = await apiFetch<{
        token: string;
        refreshToken: string;
        user: AuthUser;
      }>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokenToUse }),
      });

      persistTokens({ access: data.token, refresh: data.refreshToken });
      setUser(data.user);
      return data.token;
    },
    [persistTokens, refreshToken],
  );

  const fetchProfile = useCallback(
    async ({
      tokenOverride,
      retryOnUnauthorized = true,
    }: {
      tokenOverride?: string | null;
      retryOnUnauthorized?: boolean;
    } = {}) => {
      const tokenToUse = tokenOverride ?? accessToken;
      if (!tokenToUse) {
        setUser(null);
        return;
      }

      try {
        const data = await apiFetch<{ user: AuthUser }>('/api/auth/me', {
          token: tokenToUse,
        });
        setUser(data.user);
      } catch (error) {
        const status = (error as ApiError).status;

        if (status === 401 && retryOnUnauthorized && refreshToken) {
          try {
            const newToken = await refreshAccessToken();
            await fetchProfile({
              tokenOverride: newToken,
              retryOnUnauthorized: false,
            });
            return;
          } catch (refreshError) {
            console.warn('Refresh token invalid', refreshError);
          }
        }

        persistTokens({ access: null, refresh: null });
        setUser(null);
      }
    },
    [accessToken, refreshToken, persistTokens, refreshAccessToken],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    const storedAccess = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    persistTokens({
      access: storedAccess ?? null,
      refresh: storedRefresh ?? null,
    });

    if (storedAccess) {
      fetchProfile({ tokenOverride: storedAccess }).finally(() =>
        setLoading(false),
      );
    } else if (storedRefresh) {
      refreshAccessToken(storedRefresh)
        .then(() => fetchProfile({ retryOnUnauthorized: false }))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchProfile, persistTokens, refreshAccessToken]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const data = await apiFetch<{
        token: string;
        refreshToken: string;
        user: AuthUser;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      persistTokens({ access: data.token, refresh: data.refreshToken });
      setUser(data.user);
    },
    [persistTokens],
  );

  const register = useCallback(
    async (payload: { email: string; password: string; name?: string }) => {
      const data = await apiFetch<{
        token: string;
        refreshToken: string;
        user: AuthUser;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      persistTokens({ access: data.token, refresh: data.refreshToken });
      setUser(data.user);
    },
    [persistTokens],
  );

  const logout = useCallback(() => {
    const currentRefresh = refreshToken;
    persistTokens({ access: null, refresh: null });
    setUser(null);

    if (currentRefresh) {
      void apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: currentRefresh }),
      }).catch((error) => {
        console.warn('Failed to revoke refresh token', error);
      });
    }
  }, [persistTokens, refreshToken]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      loading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, accessToken, refreshToken, loading, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
