"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  advertiserApi,
  type AdvertiserPostbackListResponse,
} from "@/lib/advertiser.api";
import { formatDateTime } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "received", label: "Получен" },
  { value: "processed", label: "Отправлен" },
  { value: "rejected", label: "Отклонён" },
  { value: "duplicate", label: "Дубликат" },
  { value: "failed", label: "Ошибка" },
];

export default function AdvertiserPostbacksPage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/postbacks");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState(() => ({
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    offerId: searchParams.get("offerId") ?? "",
  }));
  const [response, setResponse] =
    useState<AdvertiserPostbackListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get("page") ?? "1");
  const currentPage = Number.isFinite(page) && page > 0 ? page : 1;
  const status = searchParams.get("status") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const offerId = searchParams.get("offerId") ?? "";

  const updateQuery = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery({
      dateFrom: form.dateFrom || null,
      dateTo: form.dateTo || null,
      offerId: form.offerId || null,
      page: "1",
    });
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateQuery({
      status: event.target.value || null,
      page: "1",
    });
  };

  const loadPostbacks = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await advertiserApi.getPostbacks(accessToken, {
        page: currentPage,
        pageSize: PAGE_SIZE,
        status: status || null,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        offerId: offerId || undefined,
      });
      setResponse(data);
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setError(
          (err as Error).message ?? "Не удалось загрузить postback-логи",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    currentPage,
    dateFrom,
    dateTo,
    handleApiError,
    offerId,
    status,
  ]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadPostbacks();
  }, [accessToken, authLoading, loadPostbacks, user?.role]);

  const pagination = response?.pagination ?? {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage === currentPage) {
      return;
    }
    updateQuery({ page: String(nextPage) });
  };

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-emerald-500">
          Postbacks
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Логи postback
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Только просмотр истории отправки. Фильтры помогают сужать выборку.
        </p>
      </header>

      <form
        onSubmit={handleFilterSubmit}
        className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 md:grid-cols-4"
      >
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Дата от
          <input
            type="date"
            value={form.dateFrom}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, dateFrom: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Дата до
          <input
            type="date"
            value={form.dateTo}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, dateTo: event.target.value }))
            }
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Offer ID
          <input
            type="text"
            value={form.offerId}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, offerId: event.target.value }))
            }
            placeholder="UUID оффера"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <div className="flex items-end gap-3">
          <select
            value={status}
            onChange={handleStatusChange}
            className="h-fit w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Применить
          </button>
        </div>
      </form>

      {loading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Загружаем логи…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : response && response.items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Создан</th>
                  <th className="px-4 py-3">Offer</th>
                  <th className="px-4 py-3">Conversion</th>
                  <th className="px-4 py-3">Click</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">HTTP</th>
                  <th className="px-4 py-3 text-right">Подробнее</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {response.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {item.offerId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {item.conversionId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {item.clickId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                      {item.status ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                      {item.responseStatusCode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/advertiser/postbacks/${item.id}`}
                        className="text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Показано {response.items.length} из {pagination.total} записей
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded-full border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Назад
              </button>
              <span>
                Страница {pagination.page} из {Math.max(pagination.totalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => goToPage(pagination.page + 1)}
                disabled={
                  pagination.totalPages > 0 &&
                  pagination.page >= pagination.totalPages
                }
                className="rounded-full border border-zinc-300 px-4 py-2 font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Вперёд
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Логов postback за выбранный период нет.
        </div>
      )}
    </div>
  );
}
