"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getHomePathByRole } from "@/lib/auth/routes";

const ALLOWED_WHILE_INCOMPLETE = new Set([
  "/advertiser/questionnaire",
  "/advertiser/profile",
]);

const NAV_LINKS = [
  { href: "/advertiser", label: "Обзор" },
  { href: "/advertiser/stats", label: "Статистика" },
  { href: "/advertiser/offers", label: "Офферы" },
  { href: "/advertiser/postbacks", label: "Postback логи" },
  { href: "/advertiser/finance", label: "Финансы" },
  { href: "/advertiser/profile", label: "Профиль" },
];

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

  const navLinks =
    questionnaire?.completed === false
      ? [
          { href: "/advertiser/questionnaire", label: "Анкета" },
          { href: "/advertiser/profile", label: "Профиль" },
        ]
      : NAV_LINKS;

  if (!canRender) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6 text-sm text-zinc-500 dark:text-zinc-400">
        Проверяем доступ к кабинету рекламодателя…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-10">
      <aside className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-24 lg:h-fit lg:w-64">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-emerald-500">
            Advertiser
          </p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Наблюдательный режим
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Здесь показываем аналитику, офферы и события. Управляющие действия
            недоступны.
          </p>
        </div>
        <nav className="mt-6 flex flex-col gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/advertiser" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 rounded-xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <p className="font-semibold text-zinc-700 dark:text-zinc-200">
            {questionnaire?.completed === false
              ? "Доступ ограничен"
              : "Нужны изменения?"}
          </p>
          <p>
            {questionnaire?.completed === false
              ? "Сначала заполните обязательную анкету. После отправки откроются остальные разделы кабинета."
              : "Свяжитесь с менеджером или саппортом, если нужно обновить настройки офферов."}
          </p>
          <p className="mt-3 font-semibold text-zinc-700 dark:text-zinc-100">
            support@mikilead.io
          </p>
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
