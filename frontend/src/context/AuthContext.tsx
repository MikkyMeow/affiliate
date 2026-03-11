'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch, type ApiError } from '@/lib/api';

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt?: string;
  role: 'admin' | 'affiliate';
  affiliateId?: string | null;
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
    name: string;
  }): Promise<void>;
  logout(): void;
  refreshProfile(): Promise<void>;
};

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
      }>('/auth/refresh', {
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

      const attemptFetch = async (token: string, allowRetry: boolean) => {
        try {
          const data = await apiFetch<{ user: AuthUser }>('/auth/me', {
            token,
          });
          setUser(data.user);
        } catch (error) {
          const status = (error as ApiError).status;

          if (status === 401 && allowRetry && refreshToken) {
            try {
              const newToken = await refreshAccessToken();
              await attemptFetch(newToken, false);
              return;
            } catch (refreshError) {
              console.warn('Refresh token invalid', refreshError);
            }
          }

          persistTokens({ access: null, refresh: null });
          setUser(null);
        }
      };

      await attemptFetch(tokenToUse, retryOnUnauthorized);
    },
    [accessToken, refreshToken, persistTokens, refreshAccessToken],
  );

  useEffect(() => {
    let cancelled = false;

    const settleLoading = () => {
      if (!cancelled) {
        setLoading(false);
      }
    };

    const initialize = async () => {
      await Promise.resolve();

      if (typeof window === 'undefined') {
        settleLoading();
        return;
      }

      const storedAccess = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      const storedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY);
      persistTokens({
        access: storedAccess ?? null,
        refresh: storedRefresh ?? null,
      });

      if (storedAccess) {
        try {
          await fetchProfile({ tokenOverride: storedAccess });
        } finally {
          settleLoading();
        }
        return;
      }

      if (storedRefresh) {
        try {
          await refreshAccessToken(storedRefresh);
          await fetchProfile({ retryOnUnauthorized: false });
        } finally {
          settleLoading();
        }
        return;
      }

      settleLoading();
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [fetchProfile, persistTokens, refreshAccessToken]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const data = await apiFetch<{
        token: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      persistTokens({ access: data.token, refresh: data.refreshToken });
      setUser(data.user);
    },
    [persistTokens],
  );

  const register = useCallback(
    async (payload: { email: string; password: string; name: string }) => {
      const data = await apiFetch<{
        token: string;
        refreshToken: string;
        user: AuthUser;
      }>('/auth/register', {
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
      void apiFetch('/auth/logout', {
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
