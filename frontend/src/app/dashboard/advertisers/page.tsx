'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { InlineAlert } from '@/components/InlineAlert';
import { HelpLink } from '@/features/docs/HelpLink';
import { docsHelpLinks } from '@/features/docs/docs-help-links';
import { canAccessAdminArea, isAdminRole } from '@/lib/auth/roles';

type Advertiser = {
  id: string;
  publicId: string | null;
  publicIdNumber: number | null;
  name: string;
  email: string | null;
  telegram: string | null;
  status: 'active' | 'inactive';
  managerUserId: string | null;
  manager: {
    id: string;
    displayName: string | null;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type ManagerOption = {
  id: string;
  displayName: string | null;
  email: string | null;
};

type ListMeta = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
  page?: number | null;
  totalPages?: number | null;
} | null;

type AdvertiserFilterForm = {
  search: string;
  managerUserId: string;
  status: string;
  sort: string;
  order: string;
  limit: string;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A-Z' },
  { value: 'email:asc', label: 'Email A-Z' },
];

function parsePositiveInteger(
  value: string | null | undefined,
  fallback: number,
) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildFormFromSearchParams(
  searchParams: ReadonlyURLSearchParams | null,
): AdvertiserFilterForm {
  return {
    search: searchParams?.get('search') ?? '',
    managerUserId: searchParams?.get('managerUserId') ?? '',
    status: searchParams?.get('status') ?? '',
    sort: searchParams?.get('sort') ?? 'createdAt',
    order: searchParams?.get('order') ?? 'desc',
    limit: String(
      parsePositiveInteger(searchParams?.get('limit'), DEFAULT_LIMIT),
    ),
  };
}

function buildQueryParamsFromForm(
  form: AdvertiserFilterForm,
  { page }: { page?: number } = {},
) {
  const params = new URLSearchParams();
  const normalizedLimit = parsePositiveInteger(form.limit, DEFAULT_LIMIT);

  if (page && page > 1) {
    params.set('page', String(page));
  }

  if (normalizedLimit !== DEFAULT_LIMIT) {
    params.set('limit', String(normalizedLimit));
  }

  const entries = [
    ['search', form.search],
    ['managerUserId', form.managerUserId],
    ['status', form.status],
    ['sort', form.sort],
    ['order', form.order],
  ] as const;

  for (const [key, value] of entries) {
    const normalized = value.trim();
    if (normalized) {
      params.set(key, normalized);
    }
  }

  return params;
}

export default function AdvertisersPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AdvertiserFilterForm>(() =>
    buildFormFromSearchParams(searchParams),
  );
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [meta, setMeta] = useState({
    total: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
    page: DEFAULT_PAGE,
    totalPages: 0,
  });

  useEffect(() => {
    setFilters(buildFormFromSearchParams(searchParams));
  }, [searchParams]);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/advertisers');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const page = useMemo(
    () => parsePositiveInteger(searchParams?.get('page'), DEFAULT_PAGE),
    [searchParams],
  );

  const limit = useMemo(
    () => parsePositiveInteger(searchParams?.get('limit'), DEFAULT_LIMIT),
    [searchParams],
  );

  const navigateWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      const targetPath = pathname ?? '/dashboard/advertisers';
      router.push(query ? `${targetPath}?${query}` : targetPath);
    },
    [pathname, router],
  );

  const handleApplyFilters = useCallback(() => {
    navigateWithParams(buildQueryParamsFromForm(filters));
  }, [filters, navigateWithParams]);

  const handleResetFilters = useCallback(() => {
    setFilters(buildFormFromSearchParams(null));
    navigateWithParams(new URLSearchParams());
  }, [navigateWithParams]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage === meta.page) {
        return;
      }

      navigateWithParams(buildQueryParamsFromForm(filters, { page: nextPage }));
    },
    [filters, meta.page, navigateWithParams],
  );

  const handleLimitChange = useCallback(
    (nextLimit: string) => {
      const nextFilters = { ...filters, limit: nextLimit };
      setFilters(nextFilters);
      navigateWithParams(buildQueryParamsFromForm(nextFilters));
    },
    [filters, navigateWithParams],
  );

  useEffect(() => {
    if (authLoading || !accessToken) {
      return;
    }

    let cancelled = false;
    setLookupsLoading(true);
    setLookupsError(null);

    apiFetch<{ items: ManagerOption[] }>('/admin/managers/lookup?limit=100', {
      token: accessToken,
    })
      .then((response) => {
        if (!cancelled) {
          setManagers(response.items);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setManagers([]);
          setLookupsError(
            (fetchError as ApiError).message ?? 'Не удалось загрузить менеджеров',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLookupsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading]);

  useEffect(() => {
    if (authLoading || !accessToken || !canAccessAdminArea(user)) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = buildQueryParamsFromForm(filters, { page });

    apiFetch<Advertiser[], ListMeta>(`/advertisers?${params.toString()}`, {
      token: accessToken,
      withMeta: true,
    })
      .then(({ data, meta: responseMeta }) => {
        if (cancelled) {
          return;
        }

        setAdvertisers(data);
        setMeta({
          total:
            typeof responseMeta?.total === 'number' ? responseMeta.total : data.length,
          limit:
            typeof responseMeta?.limit === 'number' ? responseMeta.limit : limit,
          offset:
            typeof responseMeta?.offset === 'number'
              ? responseMeta.offset
              : Math.max(page - 1, 0) * limit,
          page: typeof responseMeta?.page === 'number' ? responseMeta.page : page,
          totalPages:
            typeof responseMeta?.totalPages === 'number'
              ? responseMeta.totalPages
              : 0,
        });
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        const apiError = fetchError as ApiError;
        setError(apiError.message ?? 'Не удалось загрузить рекламодателей');
        setAdvertisers([]);
        setMeta({
          total: 0,
          limit,
          offset: Math.max(page - 1, 0) * limit,
          page,
          totalPages: 0,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, filters, limit, page, user]);

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

  const listStart = meta.total === 0 ? 0 : meta.offset + 1;
  const listEnd = Math.min(meta.total, meta.offset + advertisers.length);

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
          Войдите, чтобы увидеть список рекламодателей.
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

  if (!canAccessAdminArea(user)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Этот раздел доступен только администраторам и менеджерам.
        </p>
        <Link
          href="/"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          На главную
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Dashboard
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              Рекламодатели
            </h1>
            <HelpLink href={docsHelpLinks.adminAdvertisers} />
          </div>
        </div>
        {isAdminRole(user.role) ? (
          <Link
            href="/dashboard/advertisers/create"
            className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Создать рекламодателя
          </Link>
        ) : null}
      </div>

      <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Фильтры
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Поиск, сортировка и пагинация выполняются на бэкенде.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Сбросить
            </button>
          </div>
        </div>

        {lookupsError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{lookupsError}</InlineAlert>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 md:col-span-2">
            Search
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Name, company, email, public ID, Telegram"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              <option value="active">Активен</option>
              <option value="inactive">Неактивен</option>
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Manager
            <select
              value={filters.managerUserId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  managerUserId: event.target.value,
                }))
              }
              disabled={lookupsLoading}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.displayName ?? manager.email ?? manager.id}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Sorting
            <select
              value={`${filters.sort}:${filters.order}`}
              onChange={(event) => {
                const [sort, order] = event.target.value.split(':');
                setFilters((current) => ({
                  ...current,
                  sort,
                  order,
                }));
              }}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Rows per page
            <select
              value={filters.limit}
              onChange={(event) => handleLimitChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              {PAGE_SIZE_OPTIONS.map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Список
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {meta.total > 0
                ? `${listStart}-${listEnd} из ${meta.total}`
                : '0 результатов'}
            </p>
          </div>
          {loading ? <span className="text-sm text-zinc-500">Загружаем...</span> : null}
        </div>

        {error ? (
          <div className="px-6 py-6">
            <InlineAlert variant="error" title="Не удалось загрузить рекламодателей">
              {error}
            </InlineAlert>
          </div>
        ) : advertisers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            {filters.search || filters.status || filters.managerUserId
              ? 'По текущим фильтрам ничего не найдено.'
              : 'Пока нет рекламодателей.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Название</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Telegram</th>
                  <th className="px-6 py-3 font-medium">Менеджер</th>
                  <th className="px-6 py-3 font-medium">Статус</th>
                  <th className="px-6 py-3 font-medium">Создан</th>
                  <th className="px-6 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {advertisers.map((advertiser) => (
                  <tr key={advertiser.id} className="text-zinc-900 dark:text-zinc-100">
                    <td className="px-6 py-4 font-medium">
                      {advertiser.publicId
                        ? `${advertiser.publicId} · ${advertiser.name}`
                        : advertiser.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {advertiser.email ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {advertiser.telegram ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {advertiser.manager
                        ? `${advertiser.manager.displayName ?? 'Без имени'}${advertiser.manager.email ? ` · ${advertiser.manager.email}` : ''}`
                        : 'Not assigned'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          advertiser.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {advertiser.status === 'active' ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {formatter.format(new Date(advertiser.createdAt))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/advertisers/${advertiser.id}/edit`}
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
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <span>
            Страница {meta.page} из {Math.max(meta.totalPages, 1)}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              className="rounded-full border border-zinc-200 px-4 py-2 font-medium text-zinc-700 transition enabled:hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:enabled:hover:bg-zinc-800"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.totalPages === 0 || meta.page >= meta.totalPages}
              className="rounded-full border border-zinc-200 px-4 py-2 font-medium text-zinc-700 transition enabled:hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:enabled:hover:bg-zinc-800"
            >
              Вперёд
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
