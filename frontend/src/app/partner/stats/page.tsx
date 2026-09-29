'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpLink } from '@/features/docs/HelpLink';
import { docsHelpLinks } from '@/features/docs/docs-help-links';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { formatCount, formatMoney } from '@/lib/format';
import { fetchPartnerStats, type PartnerStats } from '@/lib/stats';
import { PARTNER_STATS_CARDS } from '../stats-config';
import { PartnerOfferBreakdownTable } from '../PartnerOfferBreakdownTable';

type PartnerOfferListItem = {
  id: string;
  title: string;
};

export default function PartnerStatsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [offerNames, setOfferNames] = useState<Record<string, string>>({});
  const [offersError, setOffersError] = useState<string | null>(null);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/partner/stats');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const resolveOfferName = useCallback(
    (offerId: string | null) => {
      if (!offerId) {
        return '—';
      }
      return offerNames[offerId] ?? `Оффер ${offerId}`;
    },
    [offerNames],
  );

  const loadStats = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoadingStats(true);
    setStatsError(null);
    try {
      const summary = await fetchPartnerStats(accessToken);
      setStats(summary);
    } catch (error) {
      const apiError = error as ApiError;
      setStats(null);
      setStatsError(apiError.message ?? 'Не удалось загрузить статистику');
    } finally {
      setLoadingStats(false);
    }
  }, [accessToken]);

  const loadOffers = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoadingOffers(true);
    setOffersError(null);
    try {
      const list = await apiFetch<PartnerOfferListItem[]>('/partner/offers', {
        token: accessToken,
      });
      const names: Record<string, string> = {};
      list.forEach((offer) => {
        names[offer.id] = offer.title;
      });
      setOfferNames(names);
    } catch (error) {
      const apiError = error as ApiError;
      setOffersError(apiError.message ?? 'Не удалось загрузить офферы');
      setOfferNames({});
    } finally {
      setLoadingOffers(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== 'affiliate') {
      return;
    }

    void loadStats();
    void loadOffers();
  }, [accessToken, authLoading, loadOffers, loadStats, user?.role]);

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
        <h1 className="min-w-0 break-words text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите или зарегистрируйтесь, чтобы увидеть свою статистику.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={authLinks.login}
            className="ui-button rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Войти
          </Link>
          <Link
            href={authLinks.register}
            className="ui-button rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
        <h1 className="min-w-0 break-words text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Кабинет только для партнёров
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Этот раздел доступен только партнёрам.
        </p>
        <Link
          href="/dashboard"
          className="ui-button rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          В панель управления
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Кабинет партнёра
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
              Ключевые показатели
            </h1>
            <HelpLink href={docsHelpLinks.partnerStats} />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Клики, статусы конверсий и выплаты по вашим офферам.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loadingStats}
            className="ui-button rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {loadingStats ? 'Обновляем…' : 'Обновить статистику'}
          </button>
          <button
            type="button"
            onClick={() => void loadOffers()}
            disabled={loadingOffers}
            className="ui-button rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {loadingOffers ? 'Обновляем офферы…' : 'Обновить офферы'}
          </button>
        </div>
      </div>

      {statsError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
          {statsError}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Сводка
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Конверсии и выплаты за всё время.
            </p>
          </div>
          {(loadingStats || loadingOffers) && (
            <span className="break-words text-xs text-zinc-500">Обновляем данные…</span>
          )}
        </div>
        <div className="min-w-0 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PARTNER_STATS_CARDS.map((card) => {
            const value = stats ? stats[card.key] : 0;
            const displayValue = card.currency
              ? formatMoney(value)
              : formatCount(value);
            return (
              <div
                key={card.key}
                className={`rounded-2xl border border-zinc-100 bg-gradient-to-b ${card.accent} p-4 shadow-sm dark:border-zinc-800`}
              >
                <p className="text-sm uppercase tracking-wide text-zinc-500">
                  {card.label}
                </p>
                <p className="text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
                  {!stats ? (loadingStats ? '…' : '—') : displayValue}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {card.hint}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <div className="mb-3">
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Детализация
            </p>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              По офферам
            </h3>
            {offersError && (
              <p className="text-xs text-red-600 dark:text-red-300">
                {offersError}
              </p>
            )}
          </div>
          <PartnerOfferBreakdownTable
            rows={stats?.breakdowns?.offers ?? []}
            loading={loadingStats || loadingOffers}
            resolveOfferName={resolveOfferName}
            emptyMessage="Пока нет статистики по офферам."
          />
        </div>
      </div>

      <div className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Нужны офферы и ссылки? Вернитесь в{' '}
          <Link
            href="/partner"
            className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-300"
          >
            кабинет партнёра
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
