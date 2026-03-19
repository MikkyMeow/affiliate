"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, type ApiError } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt?: string;
  role: "admin" | "affiliate";
  affiliateId?: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
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

const ACCESS_TOKEN_KEY = "affiliate_access_token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistAccessToken = useCallback((token: string | null) => {
    setAccessToken(token);

    if (typeof window === "undefined") {
      return;
    }

    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const data = await apiFetch<{ token: string; user: AuthUser }>(
      "/auth/refresh",
      {
        method: "POST",
        credentials: "include",
      },
    );

    persistAccessToken(data.token);
    setUser(data.user);
    return data.token;
  }, [persistAccessToken]);

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
          const data = await apiFetch<{ user: AuthUser }>("/auth/me", {
            token,
          });
          setUser(data.user);
        } catch (error) {
          const status = (error as ApiError).status;

          if (status === 401 && allowRetry) {
            try {
              const newToken = await refreshAccessToken();
              await attemptFetch(newToken, false);
              return;
            } catch (refreshError) {
              console.warn("Unable to refresh access token", refreshError);
            }
          }

          if (status === 401) {
            persistAccessToken(null);
            setUser(null);
          }

          throw error;
        }
      };

      await attemptFetch(tokenToUse, retryOnUnauthorized);
    },
    [accessToken, persistAccessToken, refreshAccessToken],
  );

  useEffect(() => {
    let cancelled = false;

    const settleLoading = () => {
      if (!cancelled) {
        setLoading(false);
      }
    };

    const initialize = async () => {
      if (typeof window === "undefined") {
        settleLoading();
        return;
      }

      const storedAccess = window.localStorage.getItem(ACCESS_TOKEN_KEY);

      if (storedAccess) {
        persistAccessToken(storedAccess);
        try {
          await fetchProfile({ tokenOverride: storedAccess });
          settleLoading();
          return;
        } catch (error) {
          console.warn("Stored access token invalid", error);
          persistAccessToken(null);
        }
      }

      try {
        await refreshAccessToken();
        await fetchProfile({ retryOnUnauthorized: false });
      } catch (error) {
        console.warn("Failed to refresh session on init", error);
        persistAccessToken(null);
        setUser(null);
      } finally {
        settleLoading();
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [fetchProfile, persistAccessToken, refreshAccessToken]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const data = await apiFetch<{ token: string; user: AuthUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(credentials),
          credentials: "include",
        },
      );

      persistAccessToken(data.token);
      setUser(data.user);
    },
    [persistAccessToken],
  );

  const register = useCallback(
    async (payload: { email: string; password: string; name: string }) => {
      const data = await apiFetch<{ token: string; user: AuthUser }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(payload),
          credentials: "include",
        },
      );

      persistAccessToken(data.token);
      setUser(data.user);
    },
    [persistAccessToken],
  );

  const logout = useCallback(() => {
    persistAccessToken(null);
    setUser(null);

    void apiFetch("/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch((error) => {
      console.warn("Failed to revoke session", error);
    });
  }, [persistAccessToken]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, accessToken, loading, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
