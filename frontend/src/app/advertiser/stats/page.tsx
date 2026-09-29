"use client";

import { conversionStatusLabel } from "../ui-labels";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DateInput } from "@/components/DateInput";
import { HelpLink } from "@/features/docs/HelpLink";
import { docsHelpLinks } from "@/features/docs/docs-help-links";
import { useAuth } from "@/context/AuthContext";
import {
  advertiserApi,
  type AdvertiserStatsBreakdowns,
} from "@/lib/advertiser.api";
import type { StatsSummary } from "@/lib/stats";
import { formatCount, formatMoney } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

export default function AdvertiserStatsPage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/stats");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState(() => ({
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
  }));
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [breakdowns, setBreakdowns] =
    useState<AdvertiserStatsBreakdowns | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(() => {
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo = searchParams.get("dateTo") ?? "";
    return {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
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
    });
  };

  const loadStatsData = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [summaryData, breakdownData] = await Promise.all([
        advertiserApi.getStatsSummary(accessToken, filters),
        advertiserApi.getStatsBreakdowns(accessToken, filters),
      ]);
      setSummary(summaryData);
      setBreakdowns(breakdownData);
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setError((err as Error).message ?? "Не удалось загрузить статистику");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters, handleApiError]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadStatsData();
  }, [accessToken, authLoading, loadStatsData, user?.role]);

  const cards = useMemo(() => {
    return [
      {
        label: "Клики",
        value: formatCount(summary?.clicks ?? 0),
      },
      {
        label: "Конверсии (все)",
        value: formatCount(summary?.conversionsTotal ?? 0),
      },
      {
        label: "Подтверждено",
        value: formatCount(summary?.conversionsApproved ?? 0),
      },
      {
        label: "На проверке",
        value: formatCount(summary?.conversionsPending ?? 0),
      },
      {
        label: "Отклонено",
        value: formatCount(summary?.conversionsRejected ?? 0),
      },
      {
        label: "Начисления · на проверке",
        value: formatMoney(summary?.pendingRevenue ?? 0),
      },
      {
        label: "Начисления · подтверждено",
        value: formatMoney(summary?.approvedRevenue ?? 0),
      },
      {
        label: "Выплаты · на проверке",
        value: formatMoney(summary?.pendingPayout ?? 0),
      },
      {
        label: "Выплаты · подтверждено",
        value: formatMoney(summary?.approvedPayout ?? 0),
      },
    ];
  }, [summary]);

  const offers = breakdowns?.offers ?? [];
  const statuses = breakdowns?.statuses ?? [];

  return (
    <div className="min-w-0 space-y-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Статистика
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
            Детальный отчёт
          </h1>
          <HelpLink href={docsHelpLinks.advertiserStats} />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Клики, конверсии и начисления за выбранный период.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 md:grid-cols-3"
      >
        <label className="min-w-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Дата начала
          <DateInput
            value={form.dateFrom}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, dateFrom: value }))
            }
            className="ui-input mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <label className="min-w-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Дата окончания
          <DateInput
            value={form.dateTo}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, dateTo: value }))
            }
            className="ui-input mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="ui-button w-full rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Применить фильтры
          </button>
        </div>
      </form>

      {loading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Загружаем отчёт…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : (
        <>
          <div className="min-w-0 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  По офферам
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Показатели каждого оффера за выбранный период.
                </p>
              </div>
            </div>
            {offers.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Нет данных по выбранным фильтрам.
              </p>
            ) : (
              <div className="ui-table-wrap overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                  <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">Оффер</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Клики</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Конверсии</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Начисления</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Выплаты</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {offers.map((offer) => (
                      <tr key={offer.offerId ?? offer.title ?? "offer"}>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          <div className="font-medium">
                            {offer.title ?? "Без названия"}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            ID: {offer.offerId ?? "—"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatCount(offer.clicks)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatCount(offer.conversionsTotal)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(offer.approvedRevenue ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(offer.approvedPayout ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              По статусам
            </p>
            {statuses.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Нет данных.
              </p>
            ) : (
              <div className="ui-table-wrap overflow-x-auto rounded-xl border border-zinc-100 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                  <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3">Статус</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Конверсии</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Начисления</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right">Выплаты</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {statuses.map((status) => (
                      <tr key={status.status ?? "status"}>
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                          {conversionStatusLabel(status.status)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatCount(status.conversionsTotal)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(
                            (status.approvedRevenue ?? 0) +
                              (status.pendingRevenue ?? 0) +
                              (status.rejectedRevenue ?? 0),
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-zinc-900 dark:text-zinc-50">
                          {formatMoney(
                            (status.approvedPayout ?? 0) +
                              (status.pendingPayout ?? 0) +
                              (status.rejectedPayout ?? 0),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
