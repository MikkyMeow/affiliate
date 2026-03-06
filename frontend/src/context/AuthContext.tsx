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
  token: string | null;
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

const STORAGE_KEY = 'affilate_auth_token';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistToken = useCallback((value: string | null) => {
    setToken(value);
    if (typeof window === 'undefined') {
      return;
    }
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const fetchProfile = useCallback(
    async (authToken: string | null) => {
      if (!authToken) {
        setUser(null);
        return;
      }

      try {
        const data = await apiFetch<{ user: AuthUser }>('/api/auth/me', {
          token: authToken,
        });
        setUser(data.user);
      } catch (error) {
        console.warn('Failed to fetch profile', error);
        persistToken(null);
        setUser(null);
      }
    },
    [persistToken],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      persistToken(stored);
      fetchProfile(stored).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchProfile, persistToken]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const data = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(credentials),
        },
      );
      persistToken(data.token);
      setUser(data.user);
    },
    [persistToken],
  );

  const register = useCallback(
    async (payload: { email: string; password: string; name?: string }) => {
      const data = await apiFetch<{ token: string; user: AuthUser }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      persistToken(data.token);
      setUser(data.user);
    },
    [persistToken],
  );

  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
  }, [persistToken]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(token);
  }, [fetchProfile, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, token, loading, login, register, logout, refreshProfile],
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
