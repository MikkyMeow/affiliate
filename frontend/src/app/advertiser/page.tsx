"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  advertiserApi,
  type AdvertiserStatsBreakdowns,
} from "@/lib/advertiser.api";
import type { StatsSummary } from "@/lib/stats";
import { formatCount, formatMoney } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

type SummaryCard = {
  label: string;
  value: string;
  hint?: string;
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Зачтено",
  pending: "В ожидании",
  rejected: "Отклонено",
};

export default function AdvertiserOverviewPage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser");
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [breakdowns, setBreakdowns] =
    useState<AdvertiserStatsBreakdowns | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [summaryData, breakdownData] = await Promise.all([
        advertiserApi.getStatsSummary(accessToken),
        advertiserApi.getStatsBreakdowns(accessToken),
      ]);
      setSummary(summaryData);
      setBreakdowns(breakdownData);
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setError((err as Error).message ?? "Не удалось загрузить данные");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, handleApiError]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadOverview();
  }, [accessToken, authLoading, loadOverview, user?.role]);

  const summaryCards: SummaryCard[] = useMemo(() => {
    return [
      {
        label: "Клики",
        value: formatCount(summary?.clicks ?? 0),
        hint: "Всё, что пришло от партнёров",
      },
      {
        label: "Лиды",
        value: formatCount(summary?.conversionsTotal ?? 0),
        hint: "Общее число конверсий",
      },
      {
        label: "Зачтено",
        value: formatCount(summary?.conversionsApproved ?? 0),
        hint: "Approved конверсии",
      },
      {
        label: "В рассмотрении",
        value: formatCount(summary?.conversionsPending ?? 0),
        hint: "Pending конверсии",
      },
      {
        label: "Отклонено",
        value: formatCount(summary?.conversionsRejected ?? 0),
        hint: "Rejected конверсии",
      },
      {
        label: "Revenue (approved)",
        value: formatMoney(summary?.approvedRevenue ?? 0),
        hint: "Сумма подтверждённых лидов",
      },
      {
        label: "Payout (approved)",
        value: formatMoney(summary?.approvedPayout ?? 0),
        hint: "К выплате партнёрам",
      },
    ];
  }, [summary]);

  const offers = breakdowns?.offers.slice(0, 5) ?? [];
  const statuses = breakdowns?.statuses ?? [];

  return (
    <div className="space-y-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-emerald-500">
          Read-only раздел
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Обзор рекламодателя
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Карточки ниже показывают чисто аналитические данные. Управляющих
          действий здесь нет.
        </p>
      </header>

      <section>
        {loading ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Собираем статистику за последние дни…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {card.value}
                </p>
                {card.hint ? (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {card.hint}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Разрезы по данным
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              ТОП офферы и статусы конверсий за базовый период.
            </p>
          </div>
          <Link
            href="/advertiser/stats"
            className="text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
          >
            Перейти в полноценный отчёт →
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Офферы
              </p>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {offers.length
                  ? `Всего ${offers.length} в срезе`
                  : "Нет данных"}
              </span>
            </div>
            {offers.length === 0 ? (
              <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                В отчетном периоде не было кликов и лидов по офферам.
              </p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="py-2">Оффер</th>
                    <th className="py-2 text-right">Клики</th>
                    <th className="py-2 text-right">Лиды</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <tr
                      key={`${offer.offerId ?? "unknown"}-${offer.title ?? ""}`}
                      className="border-t border-zinc-100 last:border-b dark:border-zinc-800"
                    >
                      <td className="py-3 pr-4 text-zinc-800 dark:text-zinc-100">
                        <div className="font-medium">
                          {offer.title ?? "Без названия"}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          ID: {offer.offerId ?? "—"}
                        </div>
                      </td>
                      <td className="py-3 text-right text-zinc-800 dark:text-zinc-100">
                        {formatCount(offer.clicks)}
                      </td>
                      <td className="py-3 text-right text-zinc-800 dark:text-zinc-100">
                        {formatCount(offer.conversionsTotal)}
                      </td>
                      <td className="py-3 text-right text-zinc-800 dark:text-zinc-100">
                        {formatMoney(offer.approvedRevenue ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Статусы лидов
              </p>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Обновляется автоматически
              </span>
            </div>
            {statuses.length === 0 ? (
              <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                Пока нет конверсий для отображения.
              </p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="py-2">Статус</th>
                    <th className="py-2 text-right">Конверсии</th>
                    <th className="py-2 text-right">Revenue</th>
                    <th className="py-2 text-right">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {statuses.map((status) => (
                    <tr
                      key={status.status ?? "unknown"}
                      className="border-t border-zinc-100 last:border-b dark:border-zinc-800"
                    >
                      <td className="py-3 text-zinc-800 dark:text-zinc-100">
                        {STATUS_LABELS[status.status ?? ""] ??
                          (status.status ?? "—")}
                      </td>
                      <td className="py-3 text-right text-zinc-800 dark:text-zinc-100">
                        {formatCount(status.conversionsTotal)}
                      </td>
                      <td className="py-3 text-right text-zinc-800 dark:text-zinc-100">
                        {formatMoney(status.approvedRevenue ?? 0)}
                      </td>
                      <td className="py-3 text-right text-zinc-800 dark:text-zinc-100">
                        {formatMoney(status.approvedPayout ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
