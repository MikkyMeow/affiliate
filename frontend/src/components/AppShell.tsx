"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function isCabinetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/partner") ||
    pathname.startsWith("/advertiser")
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { user } = useAuth();
  const cabinetMode = Boolean(user && isCabinetPath(pathname));

  return (
    <div
      className={
        cabinetMode ? "app-cabinet min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0" : "min-w-0"
      }
    >
      {children}
    </div>
  );
}
