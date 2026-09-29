'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HelpLink } from '@/features/docs/HelpLink';
import { docsHelpLinks } from '@/features/docs/docs-help-links';
import { useAuth } from '@/context/AuthContext';
import { InlineAlert } from '@/components/InlineAlert';
import {
  fetchPartnerClicks,
  type PartnerClick,
  type PartnerListMeta,
} from '@/lib/partner';

const PAGE_SIZE = 20;

export default function PartnerClicksPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clicks, setClicks] = useState<PartnerClick[]>([]);
  const [meta, setMeta] = useState<PartnerListMeta>({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/partner/clicks');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const pageParam = searchParams?.get('page') ?? '1';
  const parsed = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const offset = (page - 1) * PAGE_SIZE;

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

  const loadClicks = useCallback(
    async ({ signal }: { signal?: AbortSignal } = {}) => {
      if (!accessToken) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { items, meta: fetchedMeta } = await fetchPartnerClicks(accessToken, {
          limit: PAGE_SIZE,
          offset,
        });

        if (signal?.aborted) {
          return;
        }

        setClicks(items);
        setMeta(fetchedMeta);
      } catch (loadError) {
        if (signal?.aborted) {
          return;
        }
        const message = (loadError as Error).message;
        setError(message ?? 'Не удалось загрузить клики');
        setClicks([]);
        setMeta({ total: 0, limit: PAGE_SIZE, offset });
      } finally {
        if (signal?.aborted) {
          return;
        }
        setLoading(false);
      }
    },
    [accessToken, offset],
  );

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== 'affiliate') {
      return;
    }

    const controller = new AbortController();

    void loadClicks({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [accessToken, authLoading, loadClicks, user?.role]);

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
      const targetPath = pathname ?? '/partner/clicks';
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [page, pathname, router, searchParams],
  );

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || PAGE_SIZE)));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const listStart = meta.total === 0 ? 0 : meta.offset + 1;
  const listEnd = Math.min(meta.total, meta.offset + clicks.length);

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
          Войдите или зарегистрируйтесь, чтобы увидеть клики.
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
          <p className="text-sm uppercase tracking-wide text-zinc-500">Кабинет партнёра</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 break-words text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
              История кликов
            </h1>
            <HelpLink href={docsHelpLinks.partnerClicks} />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Переходы по вашим партнёрским ссылкам.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadClicks()}
          disabled={loading}
          className="ui-button rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {loading ? 'Обновляем…' : 'Обновить данные'}
        </button>
      </div>

      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="ui-table-wrap overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/50 dark:text-zinc-400">
                <th className="whitespace-nowrap px-4 py-3">ID клика</th>
                <th className="whitespace-nowrap px-4 py-3">ID оффера</th>
                <th className="whitespace-nowrap px-4 py-3">Метка Sub1</th>
                <th className="whitespace-nowrap px-4 py-3">Устройство</th>
                <th className="whitespace-nowrap px-4 py-3">Создан</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {clicks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {loading ? 'Загружаем клики…' : 'Клики появятся после первых переходов по вашим ссылкам.'}
                  </td>
                </tr>
              ) : (
                clicks.map((click) => (
                  <tr key={click.clickId} className="text-zinc-900 dark:text-zinc-100">
                    <td className="px-4 py-3 font-mono text-xs">{click.clickId}</td>
                    <td className="px-4 py-3 font-mono text-xs">{click.offerId ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {click.sub1 ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {click.device ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {dateFormatter.format(new Date(click.createdAt))}
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={!canGoPrev}
              className="ui-button rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
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
              className="ui-button rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Вперёд
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Нужны сводные показатели? Откройте{' '}
          <Link href="/partner/stats" className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-300">
            страницу статистики
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
