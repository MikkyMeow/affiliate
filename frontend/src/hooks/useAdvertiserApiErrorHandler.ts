"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import type { ApiError } from "@/lib/api";
import { getHomePathByRole } from "@/lib/auth/routes";

export function useAdvertiserApiErrorHandler(
  fallbackPath = "/advertiser",
) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return useCallback(
    (error: ApiError | Error) => {
      const status = (error as ApiError | undefined)?.status;

      if (status === 401) {
        logout();
        const next = encodeURIComponent(pathname ?? fallbackPath);
        router.replace(`/auth/login?next=${next}`);
        return true;
      }

      if (status === 403) {
        const home = getHomePathByRole(user);
        router.replace(home);
        return true;
      }

      return false;
    },
    [fallbackPath, logout, pathname, router, user],
  );
}
