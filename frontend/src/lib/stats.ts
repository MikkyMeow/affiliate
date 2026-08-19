import { apiFetch } from './api';

export type StatsSummary = {
  clicks: number;
  clicksTotal: number;
  conversionsTotal: number;
  conversionsPending: number;
  conversionsApproved: number;
  conversionsRejected: number;
  conversionsCancelled: number;
  pendingRevenue: number;
  pendingPayout: number;
  pendingProfit: number;
  approvedRevenue: number;
  approvedPayout: number;
  rejectedRevenue: number;
  rejectedPayout: number;
  cancelledRevenue: number;
  cancelledPayout: number;
};

export type BreakdownMetrics = {
  clicks: number;
  conversionsTotal: number;
  conversionsPending: number;
  conversionsApproved: number;
  conversionsRejected: number;
  conversionsCancelled: number;
  pendingRevenue: number;
  pendingPayout: number;
  pendingProfit: number;
  approvedRevenue: number;
  approvedPayout: number;
  rejectedRevenue: number;
  rejectedPayout: number;
  cancelledRevenue: number;
  cancelledPayout: number;
};

export type GoalBreakdownEntry = BreakdownMetrics & {
  goalId: string | null;
  goalName: string | null;
  goalType: string | null;
};

export type StatusBreakdownEntry = BreakdownMetrics & {
  status: string | null;
};

export type OfferStats = {
  summary: StatsSummary;
  goals: GoalBreakdownEntry[];
  statuses: StatusBreakdownEntry[];
};

export type PartnerOfferBreakdown = BreakdownMetrics & {
  offerId: string | null;
};

export type PartnerStats = StatsSummary & {
  breakdowns: {
    offers: PartnerOfferBreakdown[];
    goals: GoalBreakdownEntry[];
    statuses: StatusBreakdownEntry[];
  };
};

export type OfferStatsFilters = {
  dateFrom?: string;
  dateTo?: string;
  affiliateId?: string;
  goalId?: string;
  status?: string;
};

type RawOfferStatsResponse = {
  summary?: Partial<StatsSummary> | null;
  goals?: Array<Partial<GoalBreakdownEntry>> | null;
  statuses?: Array<Partial<StatusBreakdownEntry>> | null;
};

type RawPartnerStatsResponse = Partial<StatsSummary> & {
  breakdowns?: {
    offers?: Array<Partial<PartnerOfferBreakdown>> | null;
    goals?: Array<Partial<GoalBreakdownEntry>> | null;
    statuses?: Array<Partial<StatusBreakdownEntry>> | null;
  };
};

const STATS_SUMMARY_DEFAULT: StatsSummary = {
  clicks: 0,
  clicksTotal: 0,
  conversionsTotal: 0,
  conversionsPending: 0,
  conversionsApproved: 0,
  conversionsRejected: 0,
  conversionsCancelled: 0,
  pendingRevenue: 0,
  pendingPayout: 0,
  pendingProfit: 0,
  approvedRevenue: 0,
  approvedPayout: 0,
  rejectedRevenue: 0,
  rejectedPayout: 0,
  cancelledRevenue: 0,
  cancelledPayout: 0,
};

const BREAKDOWN_METRICS_DEFAULT: BreakdownMetrics = {
  clicks: 0,
  conversionsTotal: 0,
  conversionsPending: 0,
  conversionsApproved: 0,
  conversionsRejected: 0,
  conversionsCancelled: 0,
  pendingRevenue: 0,
  pendingPayout: 0,
  pendingProfit: 0,
  approvedRevenue: 0,
  approvedPayout: 0,
  rejectedRevenue: 0,
  rejectedPayout: 0,
  cancelledRevenue: 0,
  cancelledPayout: 0,
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

function normalizeStatsSummary(summary?: Partial<StatsSummary> | null): StatsSummary {
  const normalized: StatsSummary = { ...STATS_SUMMARY_DEFAULT };

  (Object.keys(STATS_SUMMARY_DEFAULT) as Array<keyof StatsSummary>).forEach((key) => {
    normalized[key] = toNumber(summary?.[key]);
  });

  if (!summary || summary.clicks === undefined) {
    normalized.clicks = normalized.clicksTotal;
  }

  if (!summary || summary.clicksTotal === undefined) {
    normalized.clicksTotal = normalized.clicks;
  }

  if (normalized.clicksTotal === 0 && normalized.clicks > 0) {
    normalized.clicksTotal = normalized.clicks;
  }

  if (normalized.clicks === 0 && normalized.clicksTotal > 0) {
    normalized.clicks = normalized.clicksTotal;
  }

  return normalized;
}

function normalizeBreakdownMetrics(
  metrics?: Partial<BreakdownMetrics> | null,
): BreakdownMetrics {
  const normalized: BreakdownMetrics = { ...BREAKDOWN_METRICS_DEFAULT };

  (Object.keys(BREAKDOWN_METRICS_DEFAULT) as Array<keyof BreakdownMetrics>).forEach(
    (key) => {
      if (key === 'clicks') {
        normalized.clicks = toNumber(metrics?.clicks ?? (metrics as { clicksTotal?: number })?.clicksTotal);
        return;
      }
      normalized[key] = toNumber(metrics?.[key]);
    },
  );

  return normalized;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeGoalBreakdown(
  goals?: Array<Partial<GoalBreakdownEntry>> | null,
): GoalBreakdownEntry[] {
  return (goals ?? []).map((goal) => {
    const metrics = normalizeBreakdownMetrics(goal);
    return {
      goalId: normalizeString(goal?.goalId) ?? null,
      goalName: normalizeString(goal?.goalName),
      goalType: normalizeString(goal?.goalType),
      ...metrics,
    };
  });
}

function normalizeStatusBreakdown(
  statuses?: Array<Partial<StatusBreakdownEntry>> | null,
): StatusBreakdownEntry[] {
  return (statuses ?? []).map((status) => {
    const metrics = normalizeBreakdownMetrics(status);
    return {
      status: normalizeString(status?.status),
      ...metrics,
    };
  });
}

function normalizeOfferBreakdown(
  offers?: Array<Partial<PartnerOfferBreakdown>> | null,
): PartnerOfferBreakdown[] {
  return (offers ?? []).map((offer) => {
    const metrics = normalizeBreakdownMetrics(offer);
    return {
      offerId: normalizeString(offer?.offerId),
      ...metrics,
    };
  });
}

function buildStatsQuery(filters?: OfferStatsFilters | null) {
  if (!filters) {
    return '';
  }

  const params = new URLSearchParams();
  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom);
  }
  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo);
  }
  if (filters.affiliateId) {
    params.set('affiliateId', filters.affiliateId);
  }
  if (filters.goalId) {
    params.set('goalId', filters.goalId);
  }
  if (filters.status) {
    params.set('status', filters.status);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchOfferStats(
  token: string,
  offerId: string,
  filters?: OfferStatsFilters,
): Promise<OfferStats> {
  const query = buildStatsQuery(filters);
  const response = await apiFetch<RawOfferStatsResponse>(`/stats/offers/${offerId}${query}`, {
    token,
  });

  return {
    summary: normalizeStatsSummary(response.summary),
    goals: normalizeGoalBreakdown(response.goals),
    statuses: normalizeStatusBreakdown(response.statuses),
  };
}

export async function fetchPartnerStats(token: string): Promise<PartnerStats> {
  const response = await apiFetch<RawPartnerStatsResponse>('/partner/stats', {
    token,
  });

  return {
    ...normalizeStatsSummary(response),
    breakdowns: {
      offers: normalizeOfferBreakdown(response.breakdowns?.offers),
      goals: normalizeGoalBreakdown(response.breakdowns?.goals),
      statuses: normalizeStatusBreakdown(response.breakdowns?.statuses),
    },
  };
}
