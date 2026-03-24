'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export function AuthStatus() {
  const { user, profile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white/70 p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        Проверяем авторизацию...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Вы не авторизованы.
        </p>
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <Link
            href="/auth/login"
            className="rounded-full bg-black px-5 py-2 text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Войти
          </Link>
          <Link
            href="/auth/register"
            className="rounded-full border border-zinc-300 px-5 py-2 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Зарегистрироваться
          </Link>
        </div>
      </div>
    );
  }

  const roleLabel =
    user.role === 'admin'
      ? 'Администратор'
      : user.role === 'affiliate'
        ? 'Аффилиат'
        : 'Рекламодатель';

  const profileName =
    user.role === 'affiliate' && profile && profile.type === 'affiliate'
      ? profile.name
      : user.role === 'advertiser' && profile && profile.type === 'advertiser'
        ? profile.name
        : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-900/40 dark:text-emerald-100">
      <div>
        <p className="text-base font-semibold">
          Привет, {user.displayName ?? user.email}!
        </p>
        <p className="text-emerald-700 dark:text-emerald-200">
          Статус: авторизован
        </p>
        <p className="text-emerald-700 dark:text-emerald-200">
          Роль: {roleLabel}
        </p>
        {profileName ? (
          <p className="text-emerald-700 dark:text-emerald-200">
            Профиль: {profileName}
          </p>
        ) : null}
        {user.role === 'affiliate' && (
          <p className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-200">
            <Link href="/partner">Перейти в кабинет партнера →</Link>
          </p>
        )}
        {user.role === 'advertiser' && (
          <p className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-200">
            <Link href="/advertiser">Перейти в кабинет рекламодателя →</Link>
          </p>
        )}
      </div>
      <button
        onClick={logout}
        className="self-start rounded-full border border-emerald-400 px-5 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-400/70 dark:text-emerald-50 dark:hover:bg-emerald-800/50"
      >
        Выйти
      </button>
    </div>
  );
}
