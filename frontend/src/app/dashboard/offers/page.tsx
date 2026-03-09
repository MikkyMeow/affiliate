'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

type Offer = {
  id: string;
  title: string;
  advertiserId: string | null;
  targetUrl: string;
  payoutRub: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

type OffersMeta = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
} | null;

const PAGE_SIZE = 10;

export default function OffersPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const pageParam = searchParams?.get('page') ?? '1';
  const pageFromQuery = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/offers');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !accessToken) {
      return;
    }

    let active = true;

    const fetchOffers = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, meta } = await apiFetch<Offer[], OffersMeta>(
          `/api/v1/offers?limit=${PAGE_SIZE}&offset=${offset}`,
          {
            token: accessToken,
            withMeta: true,
          },
        );

        if (!active) {
          return;
        }

        setOffers(data);
        const resolvedTotal =
          meta && typeof meta === 'object' && typeof meta.total === 'number'
            ? meta.total
            : data.length;
        const resolvedLimit =
          meta && typeof meta === 'object' && typeof meta.limit === 'number'
            ? meta.limit
            : PAGE_SIZE;

        setTotal(resolvedTotal);
        setLimit(resolvedLimit);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError((fetchError as Error).message);
        setOffers([]);
        setTotal(0);
      } finally {
        if (!active) {
          return;
        }
        setLoading(false);
      }
    };

    fetchOffers();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, offset]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage === page) {
        return;
      }

      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (nextPage === 1) {
        params.delete('page');
      } else {
        params.set('page', String(nextPage));
      }

      const qs = params.toString();
      const targetPath = pathname ?? '/dashboard/offers';
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [page, pathname, router, searchParams],
  );

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  const payoutFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 2,
      }),
    [],
  );

  const currentLimit = limit > 0 ? limit : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((total || 0) / currentLimit));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const listStart = total === 0 ? 0 : offset + 1;
  const listEnd = Math.min(total, offset + offers.length);

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
          Войдите, чтобы увидеть список офферов.
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

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Офферы
          </h1>
        </div>
        <Link
          href="/dashboard/offers/create"
          className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black"
        >
          Создать оффер
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Список
            </h2>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Всего: {loading ? '...' : total}
            </p>
          </div>
          {total > 0 && (
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Показаны {listStart}-{listEnd}
            </p>
          )}
        </div>

        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-600 dark:text-red-400">
            Не удалось загрузить данные: {error}
          </div>
        ) : loading && offers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Загружаем офферы...
          </div>
        ) : offers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Пока нет офферов.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                  <tr>
                    <th className="px-6 py-3 font-medium">Название</th>
                    <th className="px-6 py-3 font-medium">Рекламодатель</th>
                    <th className="px-6 py-3 font-medium">Выплата</th>
                    <th className="px-6 py-3 font-medium">Статус</th>
                    <th className="px-6 py-3 font-medium">Создан</th>
                    <th className="px-6 py-3 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {offers.map((offer) => (
                    <tr
                      key={offer.id}
                      className="text-zinc-900 transition dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium">{offer.title}</div>
                        <p className="text-xs text-zinc-500">#{offer.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                        {offer.advertiserId ? (
                          <span className="font-mono text-xs text-zinc-500">
                            {offer.advertiserId}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                        {payoutFormatter.format(offer.payoutRub)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            offer.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {offer.status === 'active' ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                        {formatter.format(new Date(offer.createdAt))}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/offers/${offer.id}/edit`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          title="Редактировать"
                          aria-label="Редактировать"
                        >
                          ✎
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-zinc-200 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Страница {page} из {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!canGoPrev}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition enabled:hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:enabled:hover:bg-zinc-800"
                >
                  ← Назад
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!canGoNext}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition enabled:hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:enabled:hover:bg-zinc-800"
                >
                  Вперёд →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
