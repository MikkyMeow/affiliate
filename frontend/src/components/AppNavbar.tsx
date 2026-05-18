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
  { href: "/dashboard/adjustments", label: "Корректировки" },
  { href: "/dashboard/advertisers", label: "Рекламодатели" },
  { href: "/dashboard/affiliates", label: "Партнёры" },
  { href: "/dashboard/offers", label: "Офферы" },
  { href: "/dashboard/audit-logs", label: "Логи" },
  { href: "/dashboard/questionnaires", label: "Анкеты", adminOnly: true },
  { href: "/dashboard/managers", label: "Менеджеры", adminOnly: true },
];

const AFFILIATE_LINKS = [
  { href: "/partner", label: "Офферы" },
  { href: "/partner/stats", label: "Статистика" },
  { href: "/partner/clicks", label: "Клики" },
  { href: "/partner/conversions", label: "Конверсии" },
  { href: "/partner/profile", label: "Профиль" },
];

const ADVERTISER_LINKS = [
  { href: "/advertiser", label: "Обзор" },
  { href: "/advertiser/offers", label: "Офферы" },
  { href: "/advertiser/stats", label: "Статистика" },
  { href: "/advertiser/postbacks", label: "Postbacks" },
  { href: "/advertiser/finance", label: "Финансы" },
  { href: "/advertiser/profile", label: "Профиль" },
];

const TOP_BUTTON_STYLES =
  "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:focus-visible:outline-white";
const THEME_STORAGE_KEY = "affiliate_theme";

function isCabinetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/partner") ||
    pathname.startsWith("/advertiser")
  );
}

function getRoleBadge(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "affiliate":
      return "Partner";
    case "advertiser":
      return "Advertiser";
    default:
      return role;
  }
}

export function AppNavbar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, profile, questionnaire, loading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = useMemo(() => {
    if (!user) {
      return [];
    }

    if (canAccessAdminArea(user)) {
      return ADMIN_LINKS.filter(
        (link) => !link.adminOnly || isAdminRole(user.role),
      );
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
  const cabinetMode = Boolean(user && isCabinetPath(pathname));
  const activeNavLabel = useMemo(() => {
    const activeLink =
      navLinks.find(
        (link) =>
          pathname === link.href ||
          (link.href !== "/" &&
            link.href !== "/dashboard" &&
            pathname.startsWith(link.href)),
      ) ?? null;

    return activeLink?.label ?? "Навигация";
  }, [navLinks, pathname]);

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

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);

    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const resolvedTheme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    setTheme(resolvedTheme);
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const cabinetUser = user && cabinetMode ? user : null;

  if (cabinetUser) {
    return (
      <>
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-zinc-200 bg-white lg:flex lg:flex-col dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <Link
              href={getHomePathByRole(cabinetUser)}
              className="text-lg font-semibold text-zinc-900 transition hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
            >
              affiliate
            </Link>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {getRoleBadge(cabinetUser.role)}
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
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
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
            <div className="flex flex-col gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
              <button
                type="button"
                onClick={handleThemeToggle}
                aria-label={
                  theme === "dark"
                    ? "Переключить на светлую тему"
                    : "Переключить на тёмную тему"
                }
                title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:outline-white"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {theme === "dark" ? "☀" : "☾"}
                </span>
              </button>
              {profileHref ? (
                <Link
                  href={profileHref}
                  className="flex items-center gap-3 rounded-xl transition hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                    {(cabinetUser.displayName ?? cabinetUser.email)
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {cabinetUser.displayName ?? cabinetUser.email}
                    </span>
                    {profilePublicId ? (
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-500">
                        {profilePublicId}
                      </span>
                    ) : null}
                  </span>
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                    {(cabinetUser.displayName ?? cabinetUser.email)
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {cabinetUser.displayName ?? cabinetUser.email}
                    </span>
                    {profilePublicId ? (
                      <span className="block truncate text-xs text-zinc-500 dark:text-zinc-500">
                        {profilePublicId}
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`${TOP_BUTTON_STYLES} border border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`}
              >
                {isLoggingOut ? "Выходим…" : "Выйти"}
              </button>
            </div>
          </div>
        </aside>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0 pr-4">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {activeNavLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((current) => !current)}
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:outline-white"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                {isMobileMenuOpen ? "×" : "☰"}
              </span>
            </button>
          </div>
        </div>

        <div
          className={`fixed inset-0 z-50 lg:hidden ${
            isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`absolute inset-0 bg-black/30 transition-opacity ${
              isMobileMenuOpen ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute inset-x-0 bottom-0 flex max-h-[50vh] flex-col overflow-hidden rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-950 ${
              isMobileMenuOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {activeNavLabel}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  {getRoleBadge(cabinetUser.role)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Закрыть меню"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:outline-white"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <nav className="flex flex-col gap-1">
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
                      className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                        isActive
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={handleThemeToggle}
                  aria-label={
                    theme === "dark"
                      ? "Переключить на светлую тему"
                      : "Переключить на тёмную тему"
                  }
                  title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:outline-white"
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {theme === "dark" ? "☀" : "☾"}
                  </span>
                </button>
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="flex items-center gap-3 rounded-xl transition hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                      {(cabinetUser.displayName ?? cabinetUser.email)
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {cabinetUser.displayName ?? cabinetUser.email}
                      </span>
                      {profilePublicId ? (
                        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-500">
                          {profilePublicId}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                      {(cabinetUser.displayName ?? cabinetUser.email)
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {cabinetUser.displayName ?? cabinetUser.email}
                      </span>
                      {profilePublicId ? (
                        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-500">
                          {profilePublicId}
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={`${TOP_BUTTON_STYLES} border border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800`}
                >
                  {isLoggingOut ? "Выходим…" : "Выйти"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

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
          <div className="flex items-center gap-3">
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
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`${TOP_BUTTON_STYLES} border border-zinc-300 bg-transparent text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900`}
            >
              {isLoggingOut ? "Выходим…" : "Выйти"}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={authLinks.login}
              className={`${TOP_BUTTON_STYLES} bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black`}
            >
              Войти
            </Link>
            <Link
              href={authLinks.register}
              className={`${TOP_BUTTON_STYLES} border border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900`}
            >
              Регистрация
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
