import type { UserRole } from "@/context/AuthContext";

const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  admin: "/dashboard/stats",
  affiliate: "/partner",
  advertiser: "/advertiser",
};

export function getRoleHomeRoute(role: UserRole): string {
  return ROLE_HOME_ROUTES[role] ?? "/";
}
