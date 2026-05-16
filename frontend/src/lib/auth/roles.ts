import type { AuthUser, UserRole } from "@/context/AuthContext";

const ADMIN_AREA_ROLES: UserRole[] = ["admin", "manager"];

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

export function canAccessAdminArea(
  user: AuthUser | { role: UserRole } | null | undefined,
): boolean {
  return user ? ADMIN_AREA_ROLES.includes(user.role) : false;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case "admin":
      return "Администратор";
    case "manager":
      return "Менеджер";
    case "affiliate":
      return "Аффилиат";
    case "advertiser":
      return "Рекламодатель";
    default:
      return role;
  }
}

export function getProfilePathForRole(
  user: AuthUser | { role: UserRole } | null,
): string | null {
  if (!user) {
    return null;
  }

  if (canAccessAdminArea(user)) {
    return "/dashboard/profile";
  }

  if (user.role === "advertiser") {
    return "/advertiser/profile";
  }

  if (user.role === "affiliate") {
    return "/partner/profile";
  }

  return null;
}
