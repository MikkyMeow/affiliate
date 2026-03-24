"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  advertiserApi,
  type AdvertiserFinanceBreakdowns,
  type AdvertiserFinanceSummary,
} from "@/lib/advertiser.api";
import { formatCount, formatMoney } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

export default function AdvertiserFinancePage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/finance");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState(() => ({
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    offerId: searchParams.get("offerId") ?? "",
  }));
  const [summary, setSummary] = useState<AdvertiserFinanceSummary | null>(null);
  const [breakdowns, setBreakdowns] =
    useState<AdvertiserFinanceBreakdowns | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => {
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";
    const offerId = searchParams.get("offerId") ?? "";
    return {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      offerId: offerId || undefined,
    };
  }, [searchParams]);

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery({
      dateFrom: form.dateFrom || null,
      dateTo: form.dateTo || null,
      offerId: form.offerId || null,
    });
  };

  const loadFinance = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [summaryData, breakdownData] = await Promise.all([
        advertiserApi.getFinanceSummary(accessToken, filters),
        advertiserApi.getFinanceBreakdowns(accessToken, filters),
      ]);
      setSummary(summaryData);
      setBreakdowns(breakdownData);
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setError((err as Error).message ?? "Не удалось загрузить финансы");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters, handleApiError]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadFinance();
  }, [accessToken, authLoading, loadFinance, user?.role]);

  const cards = useMemo(() => {
    return [
      {
        label: "Revenue (pending)",
        value: formatMoney(summary?.pendingRevenue ?? 0),
      },
      {
        label: "Revenue (approved)",
        value: formatMoney(summary?.approvedRevenue ?? 0),
      },
      {
        label: "Revenue (rejected)",
        value: formatMoney(summary?.rejectedRevenue ?? 0),
      },
      {
        label: "Payout (pending)",
        value: formatMoney(summary?.pendingPayout ?? 0),
      },
      {
        label: "Payout (approved)",
        value: formatMoney(summary?.approvedPayout ?? 0),
      },
      {
        label: "Payout (rejected)",
        value: formatMoney(summary?.rejectedPayout ?? 0),
      },
      {
        label: "Pending конверсии",
        value: formatCount(summary?.conversionsPending ?? 0),
      },
      {
        label: "Approved конверсии",
        value: formatCount(summary?.conversionsApproved ?? 0),
      },
      {
        label: "Rejected конверсии",
        value: formatCount(summary?.conversionsRejected ?? 0),
      },
    ];
  }, [summary]);

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-emerald-500">
          Финансы
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Финансовая сводка
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Показатели выплат и revenue. Только чтение, никаких кнопок.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 md:grid-cols-4"
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
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Обновить
          </button>
        </div>
      </form>

      {loading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Загружаем сводку…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Разрез по офферам
            </p>
            {breakdowns && breakdowns.offers.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                  <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Оффер</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Payout</th>
                      <th className="px-4 py-3 text-right">Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {breakdowns.offers.map((offer) => (
                      <tr key={offer.offerId ?? offer.title ?? "offer"}>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          <div className="font-medium">
                            {offer.title ?? "Без названия"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            ID: {offer.offerId ?? "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(offer.approvedRevenue ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(offer.approvedPayout ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatCount(offer.conversionsApproved ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Нет данных по текущим фильтрам.
              </p>
            )}
          </section>

          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Разрез по статусам
            </p>
            {breakdowns && breakdowns.statuses.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                  <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">Статус</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Payout</th>
                      <th className="px-4 py-3 text-right">Конверсии</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {breakdowns.statuses.map((status) => (
                      <tr key={status.status ?? "status"}>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {status.status ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(status.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(status.payout)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatCount(status.count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Пока нет транзакций.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
