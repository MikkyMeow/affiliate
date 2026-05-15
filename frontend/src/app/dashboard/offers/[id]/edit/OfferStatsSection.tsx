"use client";

import { useCallback, useEffect, useState } from 'react';
import type { ApiError } from '@/lib/api';
import { formatCount, formatMoney } from '@/lib/format';
import {
  type OfferStats,
  type StatsSummary,
  fetchOfferStats,
} from '@/lib/stats';

type OfferStatsSectionProps = {
  offerId: string;
  token: string;
};

type SummaryCardConfig = {
  key: keyof StatsSummary;
  label: string;
  hint: string;
  mode: 'count' | 'money';
  gradient: string;
};

const SUMMARY_CARDS: SummaryCardConfig[] = [
  {
    key: 'clicks',
    label: 'Транзакции',
    hint: 'Все зафиксированные переходы',
    mode: 'count',
    gradient: 'from-blue-500/10 to-blue-500/5',
  },
  {
    key: 'conversionsTotal',
    label: 'Всего конверсий',
    hint: 'Сумма approved + pending + rejected',
    mode: 'count',
    gradient: 'from-indigo-500/10 to-indigo-500/5',
  },
  {
    key: 'conversionsApproved',
    label: 'Approved conversions',
    hint: 'Конверсии в статусе Approved',
    mode: 'count',
    gradient: 'from-emerald-500/10 to-emerald-500/5',
  },
  {
    key: 'conversionsPending',
    label: 'Pending conversions',
    hint: 'Конверсии в статусе Pending',
    mode: 'count',
    gradient: 'from-amber-500/10 to-amber-500/5',
  },
  {
    key: 'conversionsRejected',
    label: 'Rejected conversions',
    hint: 'Конверсии в статусе Rejected',
    mode: 'count',
    gradient: 'from-rose-500/10 to-rose-500/5',
  },
  {
    key: 'approvedRevenue',
    label: 'Approved revenue, ₽',
    hint: 'Revenue из approved конверсий',
    mode: 'money',
    gradient: 'from-indigo-500/10 to-indigo-500/5',
  },
  {
    key: 'approvedPayout',
    label: 'Approved payout, ₽',
    hint: 'Выплаты по Approved',
    mode: 'money',
    gradient: 'from-emerald-500/10 to-emerald-500/5',
  },
  {
    key: 'pendingPayout',
    label: 'Pending payout, ₽',
    hint: 'Что ещё ждёт проверки',
    mode: 'money',
    gradient: 'from-amber-500/10 to-amber-500/5',
  },
];

export function OfferStatsSection({ offerId, token }: OfferStatsSectionProps) {
  const [stats, setStats] = useState<OfferStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!offerId || !token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchOfferStats(token, offerId);
      setStats(data);
    } catch (requestError) {
      const apiError = requestError as ApiError;
      setError(apiError.message ?? 'Не удалось загрузить статистику оффера');
    } finally {
      setLoading(false);
    }
  }, [offerId, token]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const summary = stats?.summary ?? null;
  const goalRows = stats?.goals ?? [];

  const renderSummaryValue = (card: SummaryCardConfig) => {
    if (!summary) {
      return loading ? '…' : '—';
    }

    const value = summary[card.key];
    return card.mode === 'money' ? formatMoney(value) : formatCount(value);
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">Offer stats</p>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Статистика по офферу
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Approved/Pending/Rejected отдельно, чтобы ничего не смешивалось.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats()}
          disabled={loading}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {loading ? 'Обновляем…' : 'Обновить'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {!summary && loading ? (
        <p className="text-sm text-zinc-500">Загружаем статистику…</p>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SUMMARY_CARDS.map((card) => (
            <div
              key={card.key}
              className={`rounded-2xl border border-zinc-100 bg-gradient-to-b ${card.gradient} p-4 shadow-sm dark:border-zinc-800`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {card.label}
              </p>
              <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                {renderSummaryValue(card)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.hint}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">По этому офферу пока нет статистики.</p>
      )}

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-500">Breakdown</p>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              По целям (goals)
            </h3>
          </div>
          {loading && summary && (
            <span className="text-xs text-zinc-500">
              Обновляем данные…
            </span>
          )}
        </div>
        {loading && goalRows.length === 0 ? (
          <p className="text-sm text-zinc-500">Загружаем разбивку по целям…</p>
        ) : goalRows.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Пока нет данных по целям. Как только появятся конверсии, блок оживёт.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Goal</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Всего</th>
                  <th className="px-4 py-3 text-left font-medium">Approved</th>
                  <th className="px-4 py-3 text-left font-medium">Pending</th>
                  <th className="px-4 py-3 text-left font-medium">Rejected</th>
                  <th className="px-4 py-3 text-left font-medium">Approved payout</th>
                  <th className="px-4 py-3 text-left font-medium">Approved revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {goalRows.map((goal, index) => (
                  <tr key={goal.goalId ?? goal.goalName ?? `goal-${index}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">
                        {goal.goalName ?? 'Без названия'}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {goal.goalId ?? 'ID неизвестен'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {goal.goalType?.toUpperCase() ?? '—'}
                    </td>
                    <td className="px-4 py-3">{formatCount(goal.conversionsTotal)}</td>
                    <td className="px-4 py-3 text-emerald-600 dark:text-emerald-300">
                      {formatCount(goal.conversionsApproved)}
                    </td>
                    <td className="px-4 py-3 text-amber-600 dark:text-amber-300">
                      {formatCount(goal.conversionsPending)}
                    </td>
                    <td className="px-4 py-3 text-rose-600 dark:text-rose-300">
                      {formatCount(goal.conversionsRejected)}
                    </td>
                    <td className="px-4 py-3">{formatMoney(goal.approvedPayout)}</td>
                    <td className="px-4 py-3">{formatMoney(goal.approvedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
