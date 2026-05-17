"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  advertiserApi,
  type AdvertiserOfferListResponse,
} from "@/lib/advertiser.api";
import { formatMoney, formatDateTime } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "active", label: "Активные" },
  { value: "paused", label: "На паузе" },
  { value: "archived", label: "Архив" },
  { value: "inactive", label: "Неактивные" },
];

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  paused: "На паузе",
  archived: "В архиве",
  inactive: "Неактивен",
};

export default function AdvertiserOffersPage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/offers");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") ?? "",
  );
  const [response, setResponse] =
    useState<AdvertiserOfferListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const page = useMemo(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }, [searchParams]);

  const status = searchParams.get("status") ?? "";
  const searchQuery = searchParams.get("search") ?? "";

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);

  const updateQuery = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.replace(
      queryString ? `${pathname}?${queryString}` : pathname,
      { scroll: false },
    );
  };

  const loadOffers = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await advertiserApi.getOffers(accessToken, {
        page,
        pageSize: PAGE_SIZE,
        status: status || null,
        search: searchQuery || null,
      });
      setResponse(data);
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setError((err as Error).message ?? "Не удалось загрузить офферы");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, handleApiError, page, searchQuery, status]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadOffers();
  }, [accessToken, authLoading, loadOffers, user?.role]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery({
      search: searchValue ? searchValue.trim() : null,
      page: "1",
    });
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    updateQuery({
      status: event.target.value || null,
      page: "1",
    });
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage === page) {
      return;
    }
    updateQuery({ page: String(nextPage) });
  };

  const pagination = response?.pagination ?? {
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  };

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-emerald-500">
          Офферы
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Просмотр офферов
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Можно только изучать состояние и метрики. Чтобы изменить условия,
          обратитесь к менеджеру.
        </p>
      </header>

      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 md:flex-row"
      >
        <label className="flex flex-1 flex-col text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Поиск по названию
          <input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Например, Dating RU"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <label className="flex w-full flex-col text-sm font-medium text-zinc-700 dark:text-zinc-300 md:w-60">
          Статус
          <select
            value={status}
            onChange={handleStatusChange}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-fit rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Найти
        </button>
      </form>

      {loading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Загружаем офферы…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : response && response.items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Создан</th>
                  <th className="px-4 py-3 text-right">Обновлён</th>
                  <th className="px-4 py-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {response.items.map((offer) => (
                  <tr key={offer.id} className="text-zinc-900 dark:text-zinc-100">
                    <td className="px-4 py-4">
                      <div className="font-medium">
                        {offer.name ?? "Без названия"}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        ID: {offer.id}
                      </div>
                    </td>
                    <td className="px-4 py-4 capitalize">
                      {STATUS_LABELS[offer.status ?? ""] ??
                        (offer.status ?? "—")}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {offer.revenueRub != null
                        ? formatMoney(offer.revenueRub)
                        : "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {formatDateTime(offer.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {formatDateTime(offer.updatedAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/advertiser/offers/${offer.id}`}
                        className="text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
                      >
                        Открыть →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Показано {response.items.length} из {pagination.total} офферов
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
          Офферов пока нет или они скрыты выбранными фильтрами.
        </div>
      )}
    </div>
  );
}
