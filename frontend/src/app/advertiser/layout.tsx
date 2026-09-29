"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getHomePathByRole } from "@/lib/auth/routes";

const ALLOWED_WHILE_INCOMPLETE = new Set([
  "/advertiser/questionnaire",
  "/advertiser/profile",
]);

export default function AdvertiserLayout({
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
      const next = encodeURIComponent(pathname ?? "/advertiser");
      router.replace(`/auth/login?next=${next}`);
      return;
    }

    if (user.role !== "advertiser") {
      router.replace(getHomePathByRole(user));
      return;
    }

    if (
      questionnaire?.completed === false &&
      !ALLOWED_WHILE_INCOMPLETE.has(pathname ?? "")
    ) {
      router.replace("/advertiser/questionnaire");
    }
  }, [loading, pathname, questionnaire?.completed, router, user]);

  const canRender =
    !loading &&
    user?.role === "advertiser" &&
    (questionnaire?.completed !== false ||
      ALLOWED_WHILE_INCOMPLETE.has(pathname ?? ""));

  if (!canRender) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6 text-sm text-zinc-500 dark:text-zinc-400">
        Проверяем доступ к кабинету рекламодателя…
      </div>
    );
  }

  return <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>;
}
