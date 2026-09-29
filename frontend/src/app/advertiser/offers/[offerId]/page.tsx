"use client";

import Link from "next/link";
import { conversionStatusLabel, offerStatusLabel } from "../../ui-labels";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DateInput } from "@/components/DateInput";
import { HelpLink } from "@/features/docs/HelpLink";
import { docsHelpLinks } from "@/features/docs/docs-help-links";
import { useAuth } from "@/context/AuthContext";
import {
  advertiserApi,
  type AdvertiserOfferDetails,
  type AdvertiserOfferStats,
} from "@/lib/advertiser.api";
import { formatCount, formatMoney, formatDateTime } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

export default function AdvertiserOfferDetailsPage() {
  const params = useParams<{ offerId: string }>();
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/offers");
  const offerId = Array.isArray(params?.offerId)
    ? params?.offerId[0]
    : params?.offerId;
  const [offer, setOffer] = useState<AdvertiserOfferDetails | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [stats, setStats] = useState<AdvertiserOfferStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    dateFrom?: string;
    dateTo?: string;
  }>({});
  const [formFilters, setFormFilters] = useState({
    dateFrom: "",
    dateTo: "",
  });

  const loadOfferDetails = useCallback(async () => {
    if (!accessToken || !offerId) {
      return;
    }

    setOfferLoading(true);
    setOfferError(null);
    setNotFound(false);
    try {
      const response = await advertiserApi.getOfferById(accessToken, offerId);
      setOffer(response.offer);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 404) {
        setNotFound(true);
        return;
      }
      if (!handleApiError(apiError)) {
        setOfferError(apiError.message ?? "Не удалось загрузить оффер");
      }
    } finally {
      setOfferLoading(false);
    }
  }, [accessToken, handleApiError, offerId]);

  const loadOfferStats = useCallback(async () => {
    if (!accessToken || !offerId) {
      return;
    }

    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await advertiserApi.getOfferStats(
        accessToken,
        offerId,
        activeFilters,
      );
      setStats(data);
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setStatsError(
          (err as Error).message ?? "Не удалось загрузить статистику",
        );
      }
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken, activeFilters, handleApiError, offerId]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadOfferDetails();
  }, [accessToken, authLoading, loadOfferDetails, user?.role]);

  useEffect(() => {
    if (
      authLoading ||
      !accessToken ||
      user?.role !== "advertiser" ||
      !offerId
    ) {
      return;
    }

    void loadOfferStats();
  }, [
    accessToken,
    authLoading,
    loadOfferStats,
    offerId,
    user?.role,
  ]);

  const handleStatsSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFilters = {
      dateFrom: formFilters.dateFrom || undefined,
      dateTo: formFilters.dateTo || undefined,
    };
    setActiveFilters(nextFilters);
  };

  if (!offerId) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-red-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-red-300">
        Некорректный идентификатор оффера.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-2">
        <Link href="/advertiser/offers" className="mb-3 inline-flex text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
          ← К офферам
        </Link>
        <p className="text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Оффер
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
            {offer?.name ?? "Карточка оффера"}
          </h1>
          <HelpLink href={docsHelpLinks.advertiserOfferDetail} />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Условия оффера и результаты привлечённого трафика.
        </p>
      </header>

      {offerLoading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Загружаем оффер…
        </div>
      ) : notFound ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-100">
          Оффер не найден или недоступен.
        </div>
      ) : offerError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {offerError}
        </div>
      ) : offer ? (
        <div className="min-w-0 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              ID
            </p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-900 dark:text-zinc-100">
              {offer.id}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Статус
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {offerStatusLabel(offer.status)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Категория
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {offer.category ?? "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Начисления
            </p>
            <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {offer.revenueRub != null ? formatMoney(offer.revenueRub) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Создан
            </p>
            <p className="mt-2 break-words text-sm text-zinc-900 dark:text-zinc-100">
              {formatDateTime(offer.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Обновлён
            </p>
            <p className="mt-2 break-words text-sm text-zinc-900 dark:text-zinc-100">
              {formatDateTime(offer.updatedAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Превью / лендинг
            </p>
            {offer.previewUrl ? (
              <a
                href={offer.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50"
              >
                Открыть превью →
              </a>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Превью не указано.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <header>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Показатели по офферу
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Период можно уточнить по датам.
          </p>
        </header>
        <form
          onSubmit={handleStatsSubmit}
          className="grid gap-4 md:grid-cols-3"
        >
          <label className="min-w-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Дата начала
            <DateInput
              value={formFilters.dateFrom}
              onChange={(value) =>
                setFormFilters((prev) => ({
                  ...prev,
                  dateFrom: value,
                }))
              }
              className="ui-input mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <label className="min-w-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Дата окончания
            <DateInput
              value={formFilters.dateTo}
              onChange={(value) =>
                setFormFilters((prev) => ({
                  ...prev,
                  dateTo: value,
                }))
              }
              className="ui-input mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="ui-button w-full rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Применить
            </button>
          </div>
        </form>
        {statsLoading ? (
          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Обновляем статистику…
          </div>
        ) : statsError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {statsError}
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="min-w-0 grid gap-4 md:grid-cols-3">
              <Metric label="Клики" value={formatCount(stats.summary.clicks)} />
              <Metric
                label="Конверсии"
                value={formatCount(stats.summary.conversionsTotal)}
              />
              <Metric
                label="Подтверждено"
                value={formatCount(stats.summary.conversionsApproved)}
              />
              <Metric
                label="Начисления"
                value={formatMoney(stats.summary.approvedRevenue)}
              />
              <Metric
                label="Выплаты"
                value={formatMoney(stats.summary.approvedPayout)}
              />
              <Metric
                label="На проверке"
                value={formatCount(stats.summary.conversionsPending)}
              />
            </div>
            <div className="min-w-0 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Статусы
                </p>
                {stats.statuses.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    Не найдено событий по выбранному периоду.
                  </p>
                ) : (
                  <div className="ui-table-wrap mt-3 overflow-x-auto">
                  <table className="min-w-[280px] w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      <tr>
                        <th className="whitespace-nowrap py-2">Статус</th>
                        <th className="whitespace-nowrap py-2 text-right">Конверсии</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.statuses.map((status) => (
                        <tr key={status.status ?? "unknown"}>
                          <td className="py-2 text-zinc-800 dark:text-zinc-100">
                            {conversionStatusLabel(status.status)}
                          </td>
                          <td className="py-2 text-right text-zinc-800 dark:text-zinc-100">
                            {formatCount(status.conversionsTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  По целям
                </p>
                {stats.goals.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    За выбранный период конверсий по целям нет.
                  </p>
                ) : (
                  <div className="ui-table-wrap mt-3 overflow-x-auto">
                  <table className="min-w-[280px] w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      <tr>
                        <th className="whitespace-nowrap py-2">Цель</th>
                        <th className="whitespace-nowrap py-2 text-right">Конверсии</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.goals.map((goal) => (
                        <tr key={goal.goalId ?? goal.goalName ?? "goal"}>
                          <td className="py-2 text-zinc-800 dark:text-zinc-100">
                            {goal.goalName ?? goal.goalId ?? "—"}
                          </td>
                          <td className="py-2 text-right text-zinc-800 dark:text-zinc-100">
                            {formatCount(goal.conversionsTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Нет данных для отображения.
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}
