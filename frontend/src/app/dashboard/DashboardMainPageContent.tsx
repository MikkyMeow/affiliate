'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { canAccessAdminArea } from '@/lib/auth/roles';
import {
  getCalendarDateString,
  getDashboardStats,
  getPreferredTimeZone,
  type DashboardMetricKey,
  type DashboardStatsResponse,
  type DashboardTotals,
} from '@/lib/dashboard';
import { formatCount, formatMoney, formatPercent } from '@/lib/format';
import { DashboardMetricCard } from './DashboardMetricCard';
import { DashboardMetricChart } from './DashboardMetricChart';

type MetricDefinition = {
  key: DashboardMetricKey;
  label: string;
  description: string;
  chartDescription: string;
  accentClassName: string;
  stroke: string;
  fill: string;
  formatValue: (value: number) => string;
};

const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: 'transactions',
    label: 'Транзакции',
    description: 'Все click-события за выбранный календарный день.',
    chartDescription: 'Почасовое распределение транзакций.',
    accentClassName: 'text-sky-700 dark:text-sky-300',
    stroke: '#0284c7',
    fill: '#38bdf8',
    formatValue: (value) => formatCount(value),
  },
  {
    key: 'conversions',
    label: 'Конверсии',
    description: 'Все нетестовые конверсии за выбранный день.',
    chartDescription: 'Почасовая динамика конверсий.',
    accentClassName: 'text-violet-700 dark:text-violet-300',
    stroke: '#7c3aed',
    fill: '#a78bfa',
    formatValue: (value) => formatCount(value),
  },
  {
    key: 'cr',
    label: 'CR',
    description: 'Conversions / clicks * 100, рассчитывается на backend.',
    chartDescription: 'Почасовой conversion rate.',
    accentClassName: 'text-cyan-700 dark:text-cyan-300',
    stroke: '#0891b2',
    fill: '#22d3ee',
    formatValue: (value) => formatPercent(value),
  },
  {
    key: 'revenue',
    label: 'Revenue',
    description: 'Сумма revenue по финансово учитываемым конверсиям.',
    chartDescription: 'Почасовой revenue в RUB.',
    accentClassName: 'text-emerald-700 dark:text-emerald-300',
    stroke: '#059669',
    fill: '#34d399',
    formatValue: (value) => formatMoney(value),
  },
  {
    key: 'payout',
    label: 'Payout',
    description: 'Сумма payout по финансово учитываемым конверсиям.',
    chartDescription: 'Почасовой payout в RUB.',
    accentClassName: 'text-amber-700 dark:text-amber-300',
    stroke: '#d97706',
    fill: '#fbbf24',
    formatValue: (value) => formatMoney(value),
  },
  {
    key: 'profit',
    label: 'Profit',
    description: 'Revenue - payout, рассчитывается на backend.',
    chartDescription: 'Почасовой profit в RUB.',
    accentClassName: 'text-teal-700 dark:text-teal-300',
    stroke: '#0f766e',
    fill: '#2dd4bf',
    formatValue: (value) => formatMoney(value),
  },
  {
    key: 'epc',
    label: 'EPC',
    description: 'Revenue / clicks, рассчитывается на backend.',
    chartDescription: 'Почасовой earnings per click.',
    accentClassName: 'text-fuchsia-700 dark:text-fuchsia-300',
    stroke: '#c026d3',
    fill: '#e879f9',
    formatValue: (value) => formatMoney(value),
  },
  {
    key: 'approveRate',
    label: 'Approve Rate',
    description: 'Approved conversions / total conversions * 100.',
    chartDescription: 'Почасовой approve rate.',
    accentClassName: 'text-rose-700 dark:text-rose-300',
    stroke: '#e11d48',
    fill: '#fb7185',
    formatValue: (value) => formatPercent(value),
  },
];

const EMPTY_TOTALS: DashboardTotals = {
  clicks: 0,
  transactions: 0,
  conversions: 0,
  approvedConversions: 0,
  cr: 0,
  revenue: 0,
  payout: 0,
  profit: 0,
  epc: 0,
  approveRate: 0,
};

export function DashboardMainPageContent() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const canAccess = canAccessAdminArea(user);
  const [timezone, setTimezone] = useState('UTC');
  const [selectedDate, setSelectedDate] = useState('');
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const preferredTimeZone = getPreferredTimeZone();
    setTimezone(preferredTimeZone);
    setSelectedDate((currentDate) => {
      if (currentDate) {
        return currentDate;
      }

      return getCalendarDateString(new Date(), preferredTimeZone);
    });
  }, []);

  useEffect(() => {
    if (
      authLoading ||
      !accessToken ||
      !user ||
      !canAccess ||
      !selectedDate ||
      !timezone
    ) {
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getDashboardStats(accessToken, {
          date: selectedDate,
          timezone,
          bucket: 'hour',
        });

        if (cancelled) {
          return;
        }

        setStats(response);
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setStats(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось загрузить главную страницу',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, canAccess, selectedDate, timezone, user]);

  if (authLoading || !user || !accessToken || !canAccess) {
    return null;
  }

  const totals = stats?.totals ?? EMPTY_TOTALS;
  const series = stats?.series ?? [];
  const hasLoadedStats = stats !== null;

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-emerald-50/60 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:text-emerald-400">
              Admin Main
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              Главная
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Админский срез за календарный день: транзакции, конверсии,
              CR, деньги и approve rate без клиентского пересчёта сырого
              трафика.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_auto]">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Дата
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            <div className="flex items-end">
              <div className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <span className="block text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Timezone
                </span>
                <span className="mt-1 block font-medium text-zinc-900 dark:text-zinc-100">
                  {timezone}
                </span>
              </div>
            </div>
          </div>
        </div>

        {loading && !hasLoadedStats ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-5 py-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-zinc-300">
            Загружаем агрегированную статистику за выбранный день...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            Не удалось загрузить дашборд: {error}
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {METRIC_DEFINITIONS.map((metric) => (
          <DashboardMetricCard
            key={metric.key}
            label={metric.label}
            description={metric.description}
            value={metric.formatValue(totals[metric.key])}
            accentClassName={metric.accentClassName}
          />
        ))}
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        {METRIC_DEFINITIONS.map((metric) => (
          <DashboardMetricChart
            key={metric.key}
            title={`${metric.label} по часам`}
            description={metric.chartDescription}
            metricKey={metric.key}
            data={series}
            stroke={metric.stroke}
            fill={metric.fill}
            formatValue={metric.formatValue}
          />
        ))}
      </div>

      {!loading && !error && hasLoadedStats && series.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 px-5 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Backend вернул пустую серию. Ожидалось 24 почасовых бакета.
        </div>
      ) : null}
    </section>
  );
}
