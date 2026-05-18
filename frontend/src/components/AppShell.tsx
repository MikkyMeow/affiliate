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

  return (
    <div className={isCabinetPath(pathname) ? "lg:ml-64" : undefined}>
      {children}
    </div>
  );
}
