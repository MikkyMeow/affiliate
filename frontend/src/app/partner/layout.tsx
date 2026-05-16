"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getHomePathByRole } from "@/lib/auth/routes";

const ALLOWED_WHILE_INCOMPLETE = new Set([
  "/partner/questionnaire",
  "/partner/profile",
]);

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, questionnaire, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      const next = encodeURIComponent(pathname ?? "/partner");
      router.replace(`/auth/login?next=${next}`);
      return;
    }

    if (user.role !== "affiliate") {
      router.replace(getHomePathByRole(user));
      return;
    }

    if (
      questionnaire?.completed === false &&
      !ALLOWED_WHILE_INCOMPLETE.has(pathname ?? "")
    ) {
      router.replace("/partner/questionnaire");
    }
  }, [loading, pathname, questionnaire?.completed, router, user]);

  const canRender =
    !loading &&
    user?.role === "affiliate" &&
    (questionnaire?.completed !== false ||
      ALLOWED_WHILE_INCOMPLETE.has(pathname ?? ""));

  if (!canRender) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6 text-sm text-zinc-500 dark:text-zinc-400">
        Проверяем доступ к кабинету партнёра…
      </div>
    );
  }

  return <>{children}</>;
}
