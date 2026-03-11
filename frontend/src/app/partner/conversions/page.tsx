'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { InlineAlert } from '@/components/InlineAlert';
import {
  fetchPartnerConversions,
  type PartnerConversion,
  type PartnerListMeta,
} from '@/lib/partner';

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ['approved', 'rejected'];
const STATUS_STYLES: Record<string, string> = {
  approved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
};

export default function PartnerConversionsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversions, setConversions] = useState<PartnerConversion[]>([]);
  const [meta, setMeta] = useState<PartnerListMeta>({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/partner/conversions');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const pageParam = searchParams?.get('page') ?? '1';
  const parsedPage = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const statusParam = searchParams?.get('status') ?? '';
  const statusFilter = STATUS_OPTIONS.includes(statusParam) ? statusParam : '';

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
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

  const loadConversions = useCallback(
    async ({ signal }: { signal?: AbortSignal } = {}) => {
      if (!accessToken) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { items, meta: fetchedMeta } = await fetchPartnerConversions(accessToken, {
          limit: PAGE_SIZE,
          offset,
          status: statusFilter || undefined,
        });

        if (signal?.aborted) {
          return;
        }

        setConversions(items);
        setMeta(fetchedMeta);
      } catch (loadError) {
        if (signal?.aborted) {
          return;
        }
        const message = (loadError as Error).message ?? 'Не удалось загрузить конверсии';
        setError(message);
        setConversions([]);
        setMeta({ total: 0, limit: PAGE_SIZE, offset });
      } finally {
        if (signal?.aborted) {
          return;
        }
        setLoading(false);
      }
    },
    [accessToken, offset, statusFilter],
  );

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== 'affiliate') {
      return;
    }

    const controller = new AbortController();
    void loadConversions({ signal: controller.signal });
    return () => controller.abort();
  }, [accessToken, authLoading, loadConversions, user?.role]);

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

      const targetPath = pathname ?? '/partner/conversions';
      const qs = params.toString();
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [page, pathname, router, searchParams],
  );

  const handleStatusChange = useCallback(
    (nextStatus: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (!nextStatus) {
        params.delete('status');
      } else {
        params.set('status', nextStatus);
      }
      params.delete('page');
      const targetPath = pathname ?? '/partner/conversions';
      const qs = params.toString();
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [pathname, router, searchParams],
  );

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || PAGE_SIZE)));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const listStart = meta.total === 0 ? 0 : meta.offset + 1;
  const listEnd = Math.min(meta.total, meta.offset + conversions.length);

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
          Войдите или зарегистрируйтесь, чтобы увидеть конверсии.
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
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">Partner Conversions</p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            История конверсий
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Следите за статусами и выплатами по своим кликам.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => handleStatusChange(event.target.value)}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="">Все статусы</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === 'approved' ? 'Approved' : 'Rejected'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadConversions()}
            disabled={loading}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {loading ? 'Обновляем…' : 'Обновить данные'}
          </button>
        </div>
      </div>

      {error && <InlineAlert tone="error">{error}</InlineAlert>}

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
                <th className="px-4 py-3">Click ID</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Выплата</th>
                <th className="px-4 py-3">Создана</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {conversions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {loading ? 'Загружаем конверсии…' : 'Пока нет данных.'}
                  </td>
                </tr>
              ) : (
                conversions.map((conversion) => (
                  <tr key={`${conversion.clickId}-${conversion.createdAt}`} className="text-zinc-900 dark:text-zinc-100">
                    <td className="px-4 py-3 font-mоно text-xs">{conversion.clickId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[conversion.status] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {conversion.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {currencyFormatter.format(conversion.payoutRub ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {dateFormatter.format(new Date(conversion.createdAt))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span>
            Показано {listStart}-{listEnd} из {meta.total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={!canGoPrev}
              className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Назад
            </button>
            <span>
              Стр. {page} из {totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={!canGoNext}
              className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Вперёд
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Хотите посмотреть клики? Перейдите на{' '}
          <Link href="/partner/clicks" className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-300">
            страницу кликов
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
