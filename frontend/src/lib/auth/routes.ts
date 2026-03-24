import type { AuthUser, UserRole } from "@/context/AuthContext";

const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  admin: "/dashboard/stats",
  affiliate: "/partner",
  advertiser: "/advertiser",
};

export function getHomePathByRole(user: AuthUser | { role: UserRole } | null): string {
  if (!user) {
    return "/";
  }

  const role = user.role;
  return ROLE_HOME_ROUTES[role] ?? "/";
}
