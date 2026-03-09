'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { InlineAlert } from '@/components/InlineAlert';

type Click = {
  clickId: string;
  offerId: string | null;
  affiliateId: string | null;
  sub1: string | null;
  createdAt: string;
  ip: string | null;
};

type ClicksMeta = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
} | null;

const PAGE_SIZE = 20;

export default function ClicksPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clicks, setClicks] = useState<Click[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const pageParam = searchParams?.get('page') ?? '1';
  const parsed = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/clicks');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [],
  );

  useEffect(() => {
    if (authLoading || !accessToken) {
      return;
    }

    let cancelled = false;

    const fetchClicks = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, meta } = await apiFetch<Click[], ClicksMeta>(
          `/api/v1/clicks?limit=${PAGE_SIZE}&offset=${offset}`,
          {
            token: accessToken,
            withMeta: true,
          },
        );

        if (cancelled) {
          return;
        }

        setClicks(data);
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
        if (cancelled) {
          return;
        }
        const apiError = fetchError as ApiError;
        setError(apiError.message ?? 'Не удалось загрузить клики');
        setClicks([]);
        setTotal(0);
      } finally {
        if (cancelled) {
          return;
        }
        setLoading(false);
      }
    };

    void fetchClicks();

    return () => {
      cancelled = true;
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
      const targetPath = pathname ?? '/dashboard/clicks';
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [page, pathname, router, searchParams],
  );

  const currentLimit = limit > 0 ? limit : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((total || 0) / currentLimit));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const listStart = total === 0 ? 0 : offset + 1;
  const listEnd = Math.min(total, offset + clicks.length);

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
          Войдите, чтобы увидеть список кликов.
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
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Клики
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Последние события ядра: clickId и основные параметры для дебага.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 px-6 py-4 text-sm text-zinc-500 dark:border-zinc-800">
          <span>{loading ? 'Загружаем…' : `Всего: ${total}`}</span>
          <span>
            {listStart}-{listEnd} / {total}
          </span>
        </div>

        {error ? (
          <div className="px-6 py-6">
            <InlineAlert variant="error" title="Не удалось загрузить клики">
              {error}
            </InlineAlert>
          </div>
        ) : clicks.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Пока нет кликов.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-6 py-3 font-medium">clickId</th>
                  <th className="px-6 py-3 font-medium">offerId</th>
                  <th className="px-6 py-3 font-medium">affiliateId</th>
                  <th className="px-6 py-3 font-medium">sub1</th>
                  <th className="px-6 py-3 font-medium">createdAt</th>
                  <th className="px-6 py-3 font-medium">ip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {clicks.map((click) => (
                  <tr
                    key={click.clickId}
                    className="text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {click.clickId}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {click.offerId ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {click.affiliateId ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {click.sub1 ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {formatter.format(new Date(click.createdAt))}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {click.ip ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <span>
          Страница {page} из {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={!canGoPrev || loading}
            className="rounded-full border border-zinc-300 px-4 py-2 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={!canGoNext || loading}
            className="rounded-full border border-zinc-300 px-4 py-2 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Вперёд
          </button>
        </div>
      </div>
    </section>
  );
}
