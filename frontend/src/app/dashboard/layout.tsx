'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { canAccessAdminArea } from '@/lib/auth/roles';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, accessToken, loading } = useAuth();

  if (loading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию...</p>
      </section>
    );
  }

  if (!user || !accessToken) {
    const next = encodeURIComponent(pathname ?? '/dashboard');

    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите, чтобы открыть административный раздел.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/auth/login?next=${next}`}
            className="ui-button rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Войти
          </Link>
          <Link
            href={`/auth/register?next=${next}`}
            className="ui-button rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    );
  }

  if (!canAccessAdminArea(user)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Административный раздел доступен только администраторам и менеджерам.
        </p>
        <Link
          href="/"
          className="ui-button rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          На главную
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
