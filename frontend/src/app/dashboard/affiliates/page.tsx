'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

type Affiliate = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export default function AffiliatesPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/affiliates');
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
    setLoading(true);
    setError(null);

    apiFetch<{ affiliates: Affiliate[] }>('/api/v1/affiliates', {
      token: accessToken,
    })
      .then(({ affiliates: fetched }) => {
        if (!active) {
          return;
        }
        setAffiliates(fetched);
      })
      .catch((fetchError: Error) => {
        if (!active) {
          return;
        }
        setError(fetchError.message);
        setAffiliates([]);
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

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

  const highlightId = searchParams?.get('highlight') ?? null;

  const highlightedAffiliate = useMemo(() => {
    if (!highlightId) {
      return null;
    }
    return affiliates.find((affiliate) => affiliate.id === highlightId) ?? null;
  }, [affiliates, highlightId]);

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
          Войдите, чтобы увидеть список аффилиатов.
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
            Аффилиаты
          </h1>
        </div>
        <Link
          href="/dashboard/affiliates/create"
          className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black"
        >
          Создать аффилиата
        </Link>
      </div>

      {highlightId && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
          {highlightedAffiliate ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Аффилиат «{highlightedAffiliate.name}» создан.
                </p>
                <p className="text-amber-800 dark:text-amber-200">
                  Email: {highlightedAffiliate.email} · Статус:{' '}
                  {highlightedAffiliate.status === 'active' ? 'Активен' : 'Неактивен'}
                </p>
              </div>
              <Link
                href="/dashboard/affiliates"
                className="text-xs font-semibold uppercase tracking-wide text-amber-700 underline-offset-4 hover:underline dark:text-amber-200"
              >
                Скрыть уведомление
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span>Созданный аффилиат ещё подгружается…</span>
              <Link
                href="/dashboard/affiliates"
                className="text-xs font-semibold uppercase tracking-wide text-amber-700 underline-offset-4 hover:underline dark:text-amber-200"
              >
                Обновить
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Список
          </h2>
          {loading ? (
            <span className="text-sm text-zinc-500">Загружаем...</span>
          ) : (
            <span className="text-sm text-zinc-500">{affiliates.length} шт.</span>
          )}
        </div>

        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-600 dark:text-red-400">
            Не удалось загрузить данные: {error}
          </div>
        ) : affiliates.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Пока нет аффилиатов.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Название</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Статус</th>
                  <th className="px-6 py-3 font-medium">Создан</th>
                  <th className="px-6 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {affiliates.map((affiliate) => {
                  const isHighlighted = affiliate.id === highlightId;
                  return (
                    <tr
                      key={affiliate.id}
                      className={`text-zinc-900 transition dark:text-zinc-100 ${
                        isHighlighted
                          ? 'bg-amber-50/70 dark:bg-amber-500/10'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                      }`}
                    >
                    <td className="px-6 py-4">
                      <div className="font-medium">{affiliate.name}</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {affiliate.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          affiliate.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {affiliate.status === 'active' ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {formatter.format(new Date(affiliate.createdAt))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/affiliates/${affiliate.id}/edit`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        title="Редактировать"
                        aria-label="Редактировать"
                      >
                        ✎
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
