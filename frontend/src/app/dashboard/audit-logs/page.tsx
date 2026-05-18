'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuditLogTable } from '@/components/AuditLogTable';
import { InlineAlert } from '@/components/InlineAlert';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAuditLogs,
  type AuditLogItem,
  type AuditLogsQuery,
} from '@/lib/audit-logs';
import { type ApiError } from '@/lib/api';
import { canAccessAdminArea } from '@/lib/auth/roles';

const DEFAULT_LIMIT = 20;

type FilterState = {
  search: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
  errorOnly: boolean;
};

const INITIAL_FILTERS: FilterState = {
  search: '',
  action: '',
  entityType: '',
  entityId: '',
  actorId: '',
  dateFrom: '',
  dateTo: '',
  errorOnly: false,
};

function buildRequestKey(query: AuditLogsQuery) {
  return JSON.stringify(query);
}

function AuditLogsResults({
  accessToken,
  query,
}: {
  accessToken: string;
  query: AuditLogsQuery;
}) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchAuditLogs(accessToken, query)
      .then((response) => {
        if (!active) {
          return;
        }

        setItems(response.items);
        setTotal(response.total);
        setTotalPages(response.totalPages);
        setError(null);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }

        setItems([]);
        setTotal(0);
        setTotalPages(0);
        setError(
          (requestError as ApiError).message ?? 'Не удалось загрузить audit log',
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, query]);

  return (
    <>
      {error ? (
        <div className="mb-4">
          <InlineAlert variant="error">{error}</InlineAlert>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span>{loading ? 'Загружаем…' : `Всего записей: ${total}`}</span>
        <span>
          Страница {query.page ?? 1} из {Math.max(totalPages, 1)}
        </span>
      </div>

      <AuditLogTable
        items={items}
        loading={loading}
        error={null}
        emptyMessage="По выбранным фильтрам логи не найдены."
      />
    </>
  );
}

export default function AuditLogsPage() {
  const pathname = usePathname();
  const { user, accessToken, loading: authLoading } = useAuth();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_LIMIT);

  useEffect(() => {
    document.title = 'Audit logs';
  }, []);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/audit-logs');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const query = useMemo<AuditLogsQuery>(
    () => ({
      page,
      limit,
      search: appliedFilters.search,
      action: appliedFilters.action,
      entityType: appliedFilters.entityType,
      entityId: appliedFilters.entityId,
      actorId: appliedFilters.actorId,
      dateFrom: appliedFilters.dateFrom,
      dateTo: appliedFilters.dateTo,
      errorOnly: appliedFilters.errorOnly,
    }),
    [appliedFilters, limit, page],
  );

  const requestKey = useMemo(() => buildRequestKey(query), [query]);

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
          Войдите, чтобы открыть audit log.
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
          Audit log доступен только администраторам и менеджерам.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Audit logs
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Только просмотр. Из интерфейса записи audit log не редактируются и не удаляются.
        </p>
      </div>

      <section className="mb-6 grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Search
          <input
            type="text"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Action
          <input
            type="text"
            value={filters.action}
            onChange={(event) =>
              setFilters((current) => ({ ...current, action: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Entity type
          <input
            type="text"
            value={filters.entityType}
            onChange={(event) =>
              setFilters((current) => ({ ...current, entityType: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Entity ID
          <input
            type="text"
            value={filters.entityId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, entityId: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Actor ID
          <input
            type="text"
            value={filters.actorId}
            onChange={(event) =>
              setFilters((current) => ({ ...current, actorId: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Date from
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((current) => ({ ...current, dateFrom: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white"
          />
        </label>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Date to
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((current) => ({ ...current, dateTo: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-white"
          />
        </label>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={filters.errorOnly}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  errorOnly: event.target.checked,
                }))
              }
            />
            Только ошибки
          </label>
        </div>
        <div className="flex items-end gap-3 lg:col-span-4">
          <button
            type="button"
            onClick={() => {
              setAppliedFilters(filters);
              setPage(1);
            }}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Применить
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(INITIAL_FILTERS);
              setAppliedFilters(INITIAL_FILTERS);
              setPage(1);
            }}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Сбросить
          </button>
        </div>
      </section>

      <AuditLogsResults
        key={requestKey}
        accessToken={accessToken}
        query={query}
      />

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(current - 1, 1))}
          disabled={page <= 1}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Назад
        </button>
        <button
          type="button"
          onClick={() => setPage((current) => current + 1)}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Вперёд
        </button>
      </div>
    </section>
  );
}
