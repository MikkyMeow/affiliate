"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getHomePathByRole } from "@/lib/auth/routes";
import {
  canAccessAdminArea,
  getProfilePathForRole,
  isAdminRole,
} from "@/lib/auth/roles";
import { getQuestionnaireRouteByRole } from "@/lib/questionnaires";

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Главная" },
  { href: "/dashboard/clicks", label: "Транзакции" },
  { href: "/dashboard/conversions", label: "Конверсии" },
  { href: "/dashboard/advertisers", label: "Рекламодатели" },
  { href: "/dashboard/affiliates", label: "Партнёры" },
  { href: "/dashboard/offers", label: "Офферы" },
  { href: "/dashboard/questionnaires", label: "Анкеты", adminOnly: true },
  { href: "/dashboard/managers", label: "Менеджеры", adminOnly: true },
];

const AFFILIATE_LINKS = [
  { href: "/partner", label: "Кабинет партнера" },
  { href: "/partner/profile", label: "Профиль" },
  { href: "/partner/stats", label: "Статистика" },
  { href: "/partner/clicks", label: "Клики" },
  { href: "/partner/conversions", label: "Конверсии" },
];

const ADVERTISER_LINKS = [
  { href: "/advertiser", label: "Обзор" },
  { href: "/advertiser/offers", label: "Офферы" },
  { href: "/advertiser/stats", label: "Статистика" },
  { href: "/advertiser/postbacks", label: "Postbacks" },
  { href: "/advertiser/finance", label: "Финансы" },
  { href: "/advertiser/profile", label: "Профиль" },
];

const LINK_STYLES =
  "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white";

export function AppNavbar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, profile, questionnaire, loading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navLinks = useMemo(() => {
    if (!user) {
      return [];
    }

    if (canAccessAdminArea(user)) {
      return ADMIN_LINKS.filter((link) => !link.adminOnly || isAdminRole(user.role));
    }

    if (user.role === "affiliate") {
      if (questionnaire?.completed === false) {
        return [
          { href: "/partner/questionnaire", label: "Анкета" },
          { href: "/partner/profile", label: "Профиль" },
        ];
      }
      return AFFILIATE_LINKS;
    }

    if (user.role === "advertiser") {
      if (questionnaire?.completed === false) {
        return [
          { href: "/advertiser/questionnaire", label: "Анкета" },
          { href: "/advertiser/profile", label: "Профиль" },
        ];
      }
      return ADVERTISER_LINKS;
    }

    return [];
  }, [questionnaire?.completed, user]);

  const authLinks = useMemo(() => {
    const redirect = encodeURIComponent(pathname);
    return {
      login: `/auth/login?next=${redirect}`,
      register: `/auth/register?next=${redirect}`,
    };
  }, [pathname]);

  const profilePublicId = useMemo(() => {
    if (!user || !profile) {
      return null;
    }

    if (user.role === "affiliate" && profile.type === "affiliate") {
      return profile.publicId ?? null;
    }

    if (user.role === "advertiser" && profile.type === "advertiser") {
      return profile.publicId ?? null;
    }

    return null;
  }, [profile, user]);

  const profileHref = useMemo(() => getProfilePathForRole(user), [user]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await Promise.resolve(logout());
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (loading || !user || pathname !== "/") {
      return;
    }

    if (
      (user.role === "affiliate" || user.role === "advertiser") &&
      questionnaire?.completed === false
    ) {
      const questionnaireRoute = getQuestionnaireRouteByRole(user.role);

      if (questionnaireRoute) {
        router.replace(questionnaireRoute);
        return;
      }
    }

    const target = getHomePathByRole(user);

    if (target && target !== pathname) {
      router.replace(target);
    }
  }, [loading, pathname, questionnaire?.completed, router, user]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-900 transition hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
        >
          affiliate
        </Link>

        {loading ? (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Проверяем авторизацию…
          </span>
        ) : user ? (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
            <nav className="flex flex-wrap items-center gap-2">
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" &&
                    link.href !== "/dashboard" &&
                    pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${LINK_STYLES} ${
                      isActive
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="text-sm text-zinc-600 underline-offset-4 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {user.displayName ?? user.email}
                  </Link>
                ) : (
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {user.displayName ?? user.email}
                  </span>
                )}
                {profilePublicId ? (
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    {profilePublicId}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`${LINK_STYLES} border border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900`}
              >
                {isLoggingOut ? "Выходим…" : "Выйти"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={authLinks.login}
              className={`${LINK_STYLES} bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black`}
            >
              Войти
            </Link>
            <Link
              href={authLinks.register}
              className={`${LINK_STYLES} border border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900`}
            >
              Регистрация
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
