import { apiFetch } from './api';
import type { DashboardTotals } from './dashboard';

export type AdminSummaryGroupBy = 'partner' | 'offer' | 'advertiser';

export type AdminSummaryFilters = {
  dateFrom?: string;
  dateTo?: string;
  offerId?: string;
  affiliateId?: string;
  advertiserId?: string;
  groupBy?: AdminSummaryGroupBy;
};

export type AdminSummaryLookup = {
  id: string;
  publicId: string | null;
  name: string | null;
};

export type AdminSummaryGroup = {
  key: string;
  type: AdminSummaryGroupBy;
  partner?: AdminSummaryLookup;
  offer?: AdminSummaryLookup;
  advertiser?: AdminSummaryLookup;
  metrics: DashboardTotals;
};

export type AdminSummaryResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    offerId: string | null;
    affiliateId: string | null;
    advertiserId: string | null;
    groupBy: AdminSummaryGroupBy | null;
  };
  totals: DashboardTotals;
  groups: AdminSummaryGroup[];
};

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
  const normalized = { ...EMPTY_TOTALS };

  (Object.keys(EMPTY_TOTALS) as Array<keyof DashboardTotals>).forEach((key) => {
    normalized[key] = toNumber(payload?.[key]);
  });

  if (!payload || payload.transactions === undefined) {
    normalized.transactions = normalized.clicks;
  }

  if (!payload || payload.clicks === undefined) {
    normalized.clicks = normalized.transactions;
  }

  return normalized;
}

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (!value) {
    return;
  }

  const normalized = value.trim();
  if (!normalized) {
    return;
  }

  params.set(key, normalized);
}

export function buildAdminSummaryQuery(filters: AdminSummaryFilters = {}) {
  const params = new URLSearchParams();

  appendQueryParam(params, 'dateFrom', filters.dateFrom);
  appendQueryParam(params, 'dateTo', filters.dateTo);
  appendQueryParam(params, 'offerId', filters.offerId);
  appendQueryParam(params, 'affiliateId', filters.affiliateId);
  appendQueryParam(params, 'advertiserId', filters.advertiserId);
  appendQueryParam(params, 'groupBy', filters.groupBy);

  return params.toString();
}

export async function getAdminSummary(
  token: string,
  filters: AdminSummaryFilters = {},
): Promise<AdminSummaryResponse> {
  const query = buildAdminSummaryQuery(filters);
  const response = await apiFetch<Partial<AdminSummaryResponse>>(
    `/admin/stats/summary${query ? `?${query}` : ''}`,
    { token },
  );

  return {
    filters: {
      dateFrom:
        typeof response.filters?.dateFrom === 'string'
          ? response.filters.dateFrom
          : null,
      dateTo:
        typeof response.filters?.dateTo === 'string'
          ? response.filters.dateTo
          : null,
      offerId:
        typeof response.filters?.offerId === 'string'
          ? response.filters.offerId
          : null,
      affiliateId:
        typeof response.filters?.affiliateId === 'string'
          ? response.filters.affiliateId
          : null,
      advertiserId:
        typeof response.filters?.advertiserId === 'string'
          ? response.filters.advertiserId
          : null,
      groupBy:
        response.filters?.groupBy === 'partner' ||
        response.filters?.groupBy === 'offer' ||
        response.filters?.groupBy === 'advertiser'
          ? response.filters.groupBy
          : null,
    },
    totals: normalizeTotals(response.totals),
    groups: Array.isArray(response.groups)
      ? response.groups.map((entry) => ({
          key: typeof entry?.key === 'string' ? entry.key : '',
          type:
            entry?.type === 'partner' ||
            entry?.type === 'offer' ||
            entry?.type === 'advertiser'
              ? entry.type
              : 'partner',
          partner: entry?.partner ?? undefined,
          offer: entry?.offer ?? undefined,
          advertiser: entry?.advertiser ?? undefined,
          metrics: normalizeTotals(entry?.metrics),
        }))
      : [],
  };
}
