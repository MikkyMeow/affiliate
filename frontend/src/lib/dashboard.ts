import { apiFetch } from './api';

export type DashboardBucket = 'hour';

export type DashboardTotals = {
  clicks: number;
  transactions: number;
  conversions: number;
  pendingConversions: number;
  approvedConversions: number;
  rejectedConversions: number;
  cancelledConversions: number;
  cr: number;
  pendingRevenue: number;
  pendingPayout: number;
  pendingProfit: number;
  revenue: number;
  payout: number;
  profit: number;
  epc: number;
  approveRate: number;
};

export type DashboardSeriesPoint = DashboardTotals & {
  bucketStart: string;
  label: string;
};

export type DashboardStatsResponse = {
  date: string;
  timezone: string;
  bucket: DashboardBucket;
  totals: DashboardTotals;
  series: DashboardSeriesPoint[];
};

export type DashboardMetricKey =
  | 'transactions'
  | 'conversions'
  | 'cr'
  | 'revenue'
  | 'payout'
  | 'profit'
  | 'epc'
  | 'approveRate';

export type DashboardStatsQuery = {
  date?: string;
  timezone?: string;
  bucket?: DashboardBucket;
};

const DASHBOARD_TOTALS_DEFAULT: DashboardTotals = {
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

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeTotals(payload?: Partial<DashboardTotals> | null): DashboardTotals {
  const normalized = { ...DASHBOARD_TOTALS_DEFAULT };

  (Object.keys(DASHBOARD_TOTALS_DEFAULT) as Array<keyof DashboardTotals>).forEach(
    (key) => {
      normalized[key] = toNumber(payload?.[key]);
    },
  );

  if (!payload || payload.transactions === undefined) {
    normalized.transactions = normalized.clicks;
  }

  if (!payload || payload.clicks === undefined) {
    normalized.clicks = normalized.transactions;
  }

  return normalized;
}

function buildDashboardQuery({
  date,
  timezone,
  bucket = 'hour',
}: DashboardStatsQuery = {}) {
  const params = new URLSearchParams();

  if (date) {
    params.set('date', date);
  }

  if (timezone) {
    params.set('timezone', timezone);
  }

  params.set('bucket', bucket);

  return params.toString();
}

export async function getDashboardStats(
  token: string,
  query: DashboardStatsQuery,
): Promise<DashboardStatsResponse> {
  const response = await apiFetch<Partial<DashboardStatsResponse>>(
    `/admin/stats/dashboard?${buildDashboardQuery(query)}`,
    { token },
  );

  return {
    date: typeof response.date === 'string' ? response.date : '',
    timezone:
      typeof response.timezone === 'string' && response.timezone.trim()
        ? response.timezone
        : 'UTC',
    bucket: response.bucket === 'hour' ? 'hour' : 'hour',
    totals: normalizeTotals(response.totals),
    series: Array.isArray(response.series)
      ? response.series.map((entry) => ({
          bucketStart:
            typeof entry?.bucketStart === 'string' ? entry.bucketStart : '',
          label: typeof entry?.label === 'string' ? entry.label : '',
          ...normalizeTotals(entry),
        }))
      : [],
  };
}

export function getPreferredTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getCalendarDateString(
  date: Date,
  timeZone = getPreferredTimeZone(),
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}
