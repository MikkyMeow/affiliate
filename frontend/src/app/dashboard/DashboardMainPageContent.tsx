'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { canAccessAdminArea } from '@/lib/auth/roles';
import {
  getAdminSummary,
  type AdminSummaryGroup,
  type AdminSummaryGroupBy,
  type AdminSummaryResponse,
} from '@/lib/admin-stats';
import { apiFetch } from '@/lib/api';
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

type SupplementalMetricDefinition = {
  key: 'pendingRevenue' | 'pendingPayout' | 'pendingProfit';
  label: string;
  description: string;
  accentClassName: string;
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
    label: 'Confirmed Revenue',
    description: 'Подтверждённый revenue только по approved конверсиям.',
    chartDescription: 'Почасовой confirmed revenue в RUB.',
    accentClassName: 'text-emerald-700 dark:text-emerald-300',
    stroke: '#059669',
    fill: '#34d399',
    formatValue: (value) => formatMoney(value),
  },
  {
    key: 'payout',
    label: 'Confirmed Payout',
    description: 'Подтверждённый payout только по approved конверсиям.',
    chartDescription: 'Почасовой confirmed payout в RUB.',
    accentClassName: 'text-amber-700 dark:text-amber-300',
    stroke: '#d97706',
    fill: '#fbbf24',
    formatValue: (value) => formatMoney(value),
  },
  {
    key: 'profit',
    label: 'Confirmed Profit',
    description: 'Confirmed revenue - confirmed payout, рассчитывается на backend.',
    chartDescription: 'Почасовой confirmed profit в RUB.',
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
  pendingConversions: 0,
  approvedConversions: 0,
  rejectedConversions: 0,
  cancelledConversions: 0,
  cr: 0,
  pendingRevenue: 0,
  pendingPayout: 0,
  pendingProfit: 0,
  revenue: 0,
  payout: 0,
  profit: 0,
  epc: 0,
  approveRate: 0,
};

const SUPPLEMENTAL_METRICS: SupplementalMetricDefinition[] = [
  {
    key: 'pendingRevenue',
    label: 'Pending revenue',
    description: 'Pending conversions only.',
    accentClassName: 'text-sky-700 dark:text-sky-300',
  },
  {
    key: 'pendingPayout',
    label: 'Pending payout',
    description: 'Pending conversions only.',
    accentClassName: 'text-indigo-700 dark:text-indigo-300',
  },
  {
    key: 'pendingProfit',
    label: 'Pending profit',
    description: 'Pending revenue - pending payout.',
    accentClassName: 'text-fuchsia-700 dark:text-fuchsia-300',
  },
];

type OfferLookupResponse = {
  id: string;
  publicId: string | null;
  title: string;
};

type NamedLookupResponse = {
  id: string;
  publicId: string | null;
  name: string;
};

type LookupOption = {
  id: string;
  publicId: string | null;
  name: string;
};

type SummaryFilterState = {
  dateFrom: string;
  dateTo: string;
  offerId: string;
  affiliateId: string;
  advertiserId: string;
  groupBy: '' | AdminSummaryGroupBy;
};

const EMPTY_SUMMARY_FILTERS: SummaryFilterState = {
  dateFrom: '',
  dateTo: '',
  offerId: '',
  affiliateId: '',
  advertiserId: '',
  groupBy: '',
};

const GROUP_BY_OPTIONS: Array<{
  value: '' | AdminSummaryGroupBy;
  label: string;
}> = [
  { value: '', label: 'Без группировки' },
  { value: 'partner', label: 'По партнёру' },
  { value: 'offer', label: 'По офферу' },
  { value: 'advertiser', label: 'По рекламодателю' },
];

function mapOfferLookup(item: OfferLookupResponse): LookupOption {
  return {
    id: item.id,
    publicId: item.publicId ?? null,
    name: item.title,
  };
}

function mapNamedLookup(item: NamedLookupResponse): LookupOption {
  return {
    id: item.id,
    publicId: item.publicId ?? null,
    name: item.name,
  };
}

function formatLookupLabel(item: LookupOption) {
  return item.publicId ? `${item.publicId} · ${item.name}` : item.name;
}

function formatSummaryGroupLabel(group: AdminSummaryGroup) {
  const entity = group.partner ?? group.offer ?? group.advertiser ?? null;

  if (!entity) {
    return group.key;
  }

  if (entity.publicId && entity.name) {
    return `${entity.publicId} · ${entity.name}`;
  }

  return entity.publicId ?? entity.name ?? group.key;
}

export function DashboardMainPageContent() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const canAccess = canAccessAdminArea(user);
  const [timezone, setTimezone] = useState('UTC');
  const [selectedDate, setSelectedDate] = useState('');
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [summaryFilters, setSummaryFilters] =
    useState<SummaryFilterState>(EMPTY_SUMMARY_FILTERS);
  const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
  const [offers, setOffers] = useState<LookupOption[]>([]);
  const [affiliates, setAffiliates] = useState<LookupOption[]>([]);
  const [advertisers, setAdvertisers] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

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
    if (!selectedDate) {
      return;
    }

    setSummaryFilters((currentFilters) => {
      if (currentFilters.dateFrom || currentFilters.dateTo) {
        return currentFilters;
      }

      return {
        ...currentFilters,
        dateFrom: selectedDate,
        dateTo: selectedDate,
      };
    });
  }, [selectedDate]);

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

  useEffect(() => {
    if (authLoading || !accessToken || !user || !canAccess) {
      return;
    }

    let cancelled = false;
    setLookupsLoading(true);
    setLookupsError(null);

    Promise.allSettled([
      apiFetch<OfferLookupResponse[]>('/offers?limit=100&offset=0', {
        token: accessToken,
      }),
      apiFetch<NamedLookupResponse[]>('/affiliates?limit=100&offset=0', {
        token: accessToken,
      }),
      apiFetch<NamedLookupResponse[]>('/advertisers?limit=100&offset=0', {
        token: accessToken,
      }),
    ])
      .then(([offersResult, affiliatesResult, advertisersResult]) => {
        if (cancelled) {
          return;
        }

        if (offersResult.status === 'fulfilled') {
          setOffers(offersResult.value.map(mapOfferLookup));
        }

        if (affiliatesResult.status === 'fulfilled') {
          setAffiliates(affiliatesResult.value.map(mapNamedLookup));
        }

        if (advertisersResult.status === 'fulfilled') {
          setAdvertisers(advertisersResult.value.map(mapNamedLookup));
        }

        const rejected = [
          offersResult,
          affiliatesResult,
          advertisersResult,
        ].filter((result) => result.status === 'rejected');

        if (rejected.length > 0) {
          setLookupsError('Не удалось загрузить один или несколько справочников.');
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
  }, [accessToken, authLoading, canAccess, user]);

  useEffect(() => {
    if (authLoading || !accessToken || !user || !canAccess) {
      return;
    }

    let cancelled = false;

    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError(null);

      try {
        const response = await getAdminSummary(accessToken, {
          dateFrom: summaryFilters.dateFrom || undefined,
          dateTo: summaryFilters.dateTo || undefined,
          offerId: summaryFilters.offerId || undefined,
          affiliateId: summaryFilters.affiliateId || undefined,
          advertiserId: summaryFilters.advertiserId || undefined,
          groupBy: summaryFilters.groupBy || undefined,
        });

        if (cancelled) {
          return;
        }

        setSummary(response);
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setSummary(null);
        setSummaryError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось загрузить агрегированную сводку',
        );
      } finally {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      }
    };

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, canAccess, summaryFilters, user]);

  if (authLoading || !user || !accessToken || !canAccess) {
    return null;
  }

  const totals = stats?.totals ?? EMPTY_TOTALS;
  const series = stats?.series ?? [];
  const hasLoadedStats = stats !== null;
  const summaryTotals = summary?.totals ?? EMPTY_TOTALS;
  const summaryGroups = summary?.groups ?? [];
  const hasSummaryData = summary !== null;
  const isSummaryEmpty = Object.values(summaryTotals).every((value) => value === 0);

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

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SUPPLEMENTAL_METRICS.map((metric) => (
          <DashboardMetricCard
            key={`dashboard-money-${metric.key}`}
            label={metric.label}
            description={metric.description}
            value={formatMoney(totals[metric.key])}
            accentClassName={metric.accentClassName}
          />
        ))}
      </div>

      <section className="mt-10 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600 dark:text-sky-400">
              Filtered Summary
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Сводка по партнёру, офферу и рекламодателю
            </h2>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Этот блок запрашивает уже агрегированные метрики с backend и не
              пересчитывает clicks или conversions на клиенте.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setSummaryFilters({
                ...EMPTY_SUMMARY_FILTERS,
                dateFrom: selectedDate,
                dateTo: selectedDate,
              })
            }
            className="rounded-2xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-zinc-50"
          >
            Сбросить
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Дата от
            <input
              type="date"
              value={summaryFilters.dateFrom}
              onChange={(event) =>
                setSummaryFilters((currentFilters) => ({
                  ...currentFilters,
                  dateFrom: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Дата до
            <input
              type="date"
              value={summaryFilters.dateTo}
              onChange={(event) =>
                setSummaryFilters((currentFilters) => ({
                  ...currentFilters,
                  dateTo: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Партнёр
            <select
              value={summaryFilters.affiliateId}
              onChange={(event) =>
                setSummaryFilters((currentFilters) => ({
                  ...currentFilters,
                  affiliateId: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Все партнёры</option>
              {affiliates.map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {formatLookupLabel(affiliate)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Оффер
            <select
              value={summaryFilters.offerId}
              onChange={(event) =>
                setSummaryFilters((currentFilters) => ({
                  ...currentFilters,
                  offerId: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Все офферы</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {formatLookupLabel(offer)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Рекламодатель
            <select
              value={summaryFilters.advertiserId}
              onChange={(event) =>
                setSummaryFilters((currentFilters) => ({
                  ...currentFilters,
                  advertiserId: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="">Все рекламодатели</option>
              {advertisers.map((advertiser) => (
                <option key={advertiser.id} value={advertiser.id}>
                  {formatLookupLabel(advertiser)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Группировка
            <select
              value={summaryFilters.groupBy}
              onChange={(event) =>
                setSummaryFilters((currentFilters) => ({
                  ...currentFilters,
                  groupBy: event.target.value as SummaryFilterState['groupBy'],
                }))
              }
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {lookupsLoading ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Загружаем справочники фильтров...
          </div>
        ) : null}

        {lookupsError ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {lookupsError}
          </div>
        ) : null}

        {summaryLoading && !hasSummaryData ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            Загружаем агрегированную сводку...
          </div>
        ) : null}

        {summaryError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            Не удалось загрузить сводку: {summaryError}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {METRIC_DEFINITIONS.map((metric) => (
            <DashboardMetricCard
              key={`summary-${metric.key}`}
              label={metric.label}
              description={metric.description}
              value={metric.formatValue(summaryTotals[metric.key])}
              accentClassName={metric.accentClassName}
            />
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SUPPLEMENTAL_METRICS.map((metric) => (
            <DashboardMetricCard
              key={`summary-money-${metric.key}`}
              label={metric.label}
              description={metric.description}
              value={formatMoney(summaryTotals[metric.key])}
              accentClassName={metric.accentClassName}
            />
          ))}
        </div>

        {!summaryLoading && !summaryError && hasSummaryData && isSummaryEmpty ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Нет данных по выбранным фильтрам.
          </div>
        ) : null}

        {summaryFilters.groupBy && summaryGroups.length > 0 ? (
          <div className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <th className="px-4 py-3 font-medium">Группа</th>
                    <th className="px-4 py-3 font-medium">Транзакции</th>
                    <th className="px-4 py-3 font-medium">Конверсии</th>
                    <th className="px-4 py-3 font-medium">CR</th>
                    <th className="px-4 py-3 font-medium">Confirmed revenue</th>
                    <th className="px-4 py-3 font-medium">Confirmed payout</th>
                    <th className="px-4 py-3 font-medium">Confirmed profit</th>
                    <th className="px-4 py-3 font-medium">EPC</th>
                    <th className="px-4 py-3 font-medium">Approve Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
                  {summaryGroups.map((group) => (
                    <tr key={group.key}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {formatSummaryGroupLabel(group)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatCount(group.metrics.transactions)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatCount(group.metrics.conversions)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatPercent(group.metrics.cr)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatMoney(group.metrics.revenue)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatMoney(group.metrics.payout)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatMoney(group.metrics.profit)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatMoney(group.metrics.epc)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {formatPercent(group.metrics.approveRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

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
