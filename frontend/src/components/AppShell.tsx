"use client";

import { usePathname } from "next/navigation";

function isCabinetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/partner") ||
    pathname.startsWith("/advertiser")
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const cabinetMode = isCabinetPath(pathname);

  return (
    <div
      className={
        cabinetMode ? "pb-20 lg:ml-64 lg:pb-0" : undefined
      }
    >
      {children}
    </div>
  );
}
