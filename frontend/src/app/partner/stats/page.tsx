'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import {
  PARTNER_STATS_CARDS,
  type PartnerStatsSummary,
} from '../stats-config';

export default function PartnerStatsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [stats, setStats] = useState<PartnerStatsSummary | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/partner/stats');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 2,
      }),
    [],
  );

  const loadStats = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoadingStats(true);
    setStatsError(null);
    try {
      const summary = await apiFetch<PartnerStatsSummary>('/partner/stats', {
        token: accessToken,
      });
      setStats(summary);
    } catch (error) {
      const apiError = error as ApiError;
      setStats(null);
      setStatsError(apiError.message ?? 'Не удалось загрузить статистику');
    } finally {
      setLoadingStats(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== 'affiliate') {
      return;
    }

    void loadStats();
  }, [accessToken, authLoading, loadStats, user?.role]);

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию…</p>
      </section>
    );
  }

  if (!user || !accessToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите или зарегистрируйтесь, чтобы увидеть свою статистику.
        </p>
        <div className="flex gap-3">
          <Link
            href={authLinks.login}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Войти
          </Link>
          <Link
            href={authLinks.register}
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    );
  }

  if (user.role !== 'affiliate') {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Кабинет только для партнёров
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Вы авторизованы как администратор. Перейдите в админ-панель.
        </p>
        <Link
          href="/dashboard/stats"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          В админку
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Partner Stats
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Ключевые показатели
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Видите актуальные клики, конверсии и выплаты из rollup.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats()}
          disabled={loadingStats}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {loadingStats ? 'Обновляем…' : 'Обновить данные'}
        </button>
      </div>

      {statsError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
          Не удалось загрузить статистику: {statsError}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Сводка
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Значения из ежедневного rollup по вашему affiliateId.
            </p>
          </div>
          {loadingStats && (
            <span className="text-xs text-zinc-500">Обновляем данные…</span>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PARTNER_STATS_CARDS.map((card) => {
            const value = stats ? stats[card.key] : 0;
            const displayValue = card.currency
              ? currencyFormatter.format(value)
              : numberFormatter.format(value);
            return (
              <div
                key={card.key}
                className={`rounded-2xl border border-zinc-100 bg-gradient-to-b ${card.accent} p-4 shadow-sm dark:border-zinc-800`}
              >
                <p className="text-sm uppercase tracking-wide text-zinc-500">
                  {card.label}
                </p>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {loadingStats && !stats ? '…' : displayValue}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {card.hint}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Нужны офферы и ссылки? Вернитесь в{' '}
          <Link href="/partner" className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-300">
            кабинет партнёра
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
