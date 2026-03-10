'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

type StatsSummary = {
  clicksTotal: number;
  conversionsTotal: number;
  approvedConversionsTotal: number;
  rejectedConversionsTotal: number;
  payoutTotal: number;
};

const CARD_LAYOUT: Array<{
  key: keyof StatsSummary;
  label: string;
  description: string;
  gradient: string;
  valueColor: string;
  isCurrency?: boolean;
}> = [
  {
    key: 'clicksTotal',
    label: 'Всего кликов',
    description: 'Все зафиксированные переходы',
    gradient: 'from-blue-500/10 to-blue-500/5',
    valueColor: 'text-blue-900 dark:text-blue-100',
  },
  {
    key: 'conversionsTotal',
    label: 'Всего конверсий',
    description: 'Любые заказы и события',
    gradient: 'from-indigo-500/10 to-indigo-500/5',
    valueColor: 'text-indigo-900 dark:text-indigo-100',
  },
  {
    key: 'approvedConversionsTotal',
    label: 'Одобренные',
    description: 'Конверсии в статусе Approved',
    gradient: 'from-emerald-500/10 to-emerald-500/5',
    valueColor: 'text-emerald-900 dark:text-emerald-100',
  },
  {
    key: 'rejectedConversionsTotal',
    label: 'Отклонённые',
    description: 'Конверсии в статусе Rejected',
    gradient: 'from-rose-500/10 to-rose-500/5',
    valueColor: 'text-rose-900 dark:text-rose-100',
  },
  {
    key: 'payoutTotal',
    label: 'Выплаты, ₽',
    description: 'Общая сумма выплат',
    gradient: 'from-amber-500/10 to-amber-500/5',
    valueColor: 'text-amber-900 dark:text-amber-100',
    isCurrency: true,
  },
];

export default function StatsDashboardPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/stats');
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

  const fetchSummary = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<StatsSummary>('/api/v1/stats/summary', {
        token: accessToken,
      });
      setSummary(data);
    } catch (requestError) {
      setError((requestError as Error).message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken) {
      return;
    }

    void fetchSummary();
  }, [accessToken, authLoading, fetchSummary]);

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию...</p>
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
          Войдите, чтобы увидеть статистику ядра платформы.
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

  if (user.role !== 'admin') {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Этот раздел предназначен только для администраторов.
        </p>
        <Link
          href="/partner"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          В кабинет партнера
        </Link>
      </section>
    );
  }

  const renderValue = (cardKey: keyof StatsSummary, isCurrency?: boolean) => {
    if (loading && !summary) {
      return 'Загружаем...';
    }

    if (!summary) {
      return '—';
    }

    const value = summary[cardKey];
    return isCurrency ? currencyFormatter.format(value) : numberFormatter.format(value);
  };

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Статистика ядра
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Проверяйте клики, конверсии и выплаты без прыжков между curl и БД.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchSummary()}
          disabled={loading}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {loading ? 'Обновляем…' : 'Обновить'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-100">
          Не удалось загрузить статистику: {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CARD_LAYOUT.map((card) => (
          <div
            key={card.key}
            className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} aria-hidden />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {card.label}
              </p>
              <h2 className={`mt-4 text-4xl font-semibold ${card.valueColor}`}>
                {renderValue(card.key, card.isCurrency)}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
