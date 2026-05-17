import { listClicks as listClicksModel } from '../../models/clicks.model.js';
import { listConversions as listConversionsModel } from '../../models/conversions.model.js';
import { getHourlyDashboardSeries } from '../../models/admin-dashboard.model.js';
import {
  getStatsSummary as getRawStatsSummary,
  getOfferBreakdown as getOfferBreakdownModel,
  getAffiliateBreakdown as getAffiliateBreakdownModel,
  getGoalBreakdown as getGoalBreakdownModel,
  getStatusBreakdown as getStatusBreakdownModel,
} from '../../models/stats-aggregator.model.js';
import { getAggregatedSummary as getRollupSummary } from './rollup.service.js';

const DEFAULT_DASHBOARD_BUCKET = 'hour';
const DEFAULT_DASHBOARD_TIMEZONE =
  process.env.TZ?.trim() ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  'UTC';

function normalizeSummaryPayload(metrics = {}, { includeLegacyClicksAlias = true } = {}) {
  const summary = {
    clicks: Number(metrics.clicks ?? 0),
    conversionsTotal: Number(metrics.conversionsTotal ?? 0),
    conversionsPending: Number(metrics.conversionsPending ?? 0),
    conversionsApproved: Number(metrics.conversionsApproved ?? 0),
    conversionsRejected: Number(metrics.conversionsRejected ?? 0),
    pendingRevenue: Number(metrics.pendingRevenue ?? 0),
    approvedRevenue: Number(metrics.approvedRevenue ?? 0),
    rejectedRevenue: Number(metrics.rejectedRevenue ?? 0),
    pendingPayout: Number(metrics.pendingPayout ?? 0),
    approvedPayout: Number(metrics.approvedPayout ?? 0),
    rejectedPayout: Number(metrics.rejectedPayout ?? 0),
  };

  if (includeLegacyClicksAlias) {
    summary.clicksTotal = summary.clicks;
  }

  return summary;
}

function normalizeBreakdownEntry(entry, { includeLegacyClicksAlias = true } = {}) {
  const normalized = {
    ...entry,
    clicks: Number(entry.clicks ?? 0),
    conversionsTotal: Number(entry.conversionsTotal ?? 0),
    conversionsPending: Number(entry.conversionsPending ?? 0),
    conversionsApproved: Number(entry.conversionsApproved ?? 0),
    conversionsRejected: Number(entry.conversionsRejected ?? 0),
    pendingRevenue: Number(entry.pendingRevenue ?? 0),
    approvedRevenue: Number(entry.approvedRevenue ?? 0),
    rejectedRevenue: Number(entry.rejectedRevenue ?? 0),
    pendingPayout: Number(entry.pendingPayout ?? 0),
    approvedPayout: Number(entry.approvedPayout ?? 0),
    rejectedPayout: Number(entry.rejectedPayout ?? 0),
  };

  if (includeLegacyClicksAlias) {
    normalized.clicksTotal = normalized.clicks;
  }

  return normalized;
}

function normalizeBreakdown(entries = [], options = {}) {
  return entries.map((entry) => normalizeBreakdownEntry(entry, options));
}

function roundMetric(value) {
  return Number(Number(value ?? 0).toFixed(2));
}

function calculateRatio(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return roundMetric((Number(numerator ?? 0) / Number(denominator)) * 100);
}

function calculatePerClick(amount, clicks) {
  if (!clicks) {
    return 0;
  }

  return roundMetric(Number(amount ?? 0) / Number(clicks));
}

function buildDashboardMetricSet({
  clicks,
  conversions,
  approvedConversions,
  revenue,
  payout,
}) {
  // Stage 11 definitions:
  // - revenue/payout use financially counted conversions only (approved in the current status model)
  // - profit is backend-calculated revenue - payout
  // - CR/EPC/approveRate must return 0 when the denominator is 0
  const normalizedClicks = Number(clicks ?? 0);
  const normalizedConversions = Number(conversions ?? 0);
  const normalizedApprovedConversions = Number(approvedConversions ?? 0);
  const normalizedRevenue = roundMetric(revenue);
  const normalizedPayout = roundMetric(payout);
  const profit = roundMetric(normalizedRevenue - normalizedPayout);

  return {
    clicks: normalizedClicks,
    transactions: normalizedClicks,
    conversions: normalizedConversions,
    approvedConversions: normalizedApprovedConversions,
    cr: calculateRatio(normalizedConversions, normalizedClicks),
    revenue: normalizedRevenue,
    payout: normalizedPayout,
    profit,
    epc: calculatePerClick(normalizedRevenue, normalizedClicks),
    approveRate: calculateRatio(
      normalizedApprovedConversions,
      normalizedConversions,
    ),
  };
}

function isValidTimeZone(value) {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveDashboardTimezone(rawTimezone) {
  if (typeof rawTimezone === 'string' && rawTimezone.trim() && isValidTimeZone(rawTimezone.trim())) {
    return rawTimezone.trim();
  }

  return DEFAULT_DASHBOARD_TIMEZONE;
}

function formatDateParts(parts) {
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function resolveCurrentDateInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatDateParts(formatter.formatToParts(new Date()));
}

function normalizeBucketStart(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export async function listClicks(filter, pagination) {
  return listClicksModel(filter, pagination);
}

export async function listConversions(filter, pagination) {
  return listConversionsModel(filter, pagination);
}

export async function getSummary(filter = {}, options = {}) {
  const metrics = await getRawStatsSummary(filter);
  return normalizeSummaryPayload(metrics, options);
}

export async function getStatsBreakdowns(filter = {}) {
  const [offers, affiliates, goals, statuses] = await Promise.all([
    getOfferBreakdownModel(filter),
    getAffiliateBreakdownModel(filter),
    getGoalBreakdownModel(filter),
    getStatusBreakdownModel(filter),
  ]);

  return {
    offers: normalizeBreakdown(offers),
    affiliates: normalizeBreakdown(affiliates),
    goals: normalizeBreakdown(goals),
    statuses: normalizeBreakdown(statuses),
  };
}

export async function getOfferStats(offerId, filter = {}) {
  if (!offerId) {
    throw new Error('offerId is required for offer stats');
  }

  const summaryFilter = { ...filter, offerId };
  const [summaryMetrics, goals, statuses] = await Promise.all([
    getRawStatsSummary(summaryFilter),
    getGoalBreakdownModel(summaryFilter),
    getStatusBreakdownModel(summaryFilter),
  ]);

  return {
    summary: normalizeSummaryPayload(summaryMetrics, {
      includeLegacyClicksAlias: false,
    }),
    goals: normalizeBreakdown(goals, { includeLegacyClicksAlias: false }),
    statuses: normalizeBreakdown(statuses, { includeLegacyClicksAlias: false }),
  };
}

export async function getAffiliateStats(affiliateId, filter = {}) {
  if (!affiliateId) {
    throw new Error('affiliateId is required for affiliate stats');
  }

  const resolvedFilter = { ...filter, affiliateId };
  const [summaryMetrics, offers, goals, statuses] = await Promise.all([
    getRawStatsSummary(resolvedFilter),
    getOfferBreakdownModel(resolvedFilter),
    getGoalBreakdownModel(resolvedFilter),
    getStatusBreakdownModel(resolvedFilter),
  ]);

  const summary = normalizeSummaryPayload(summaryMetrics);
  return {
    ...summary,
    breakdowns: {
      offers: normalizeBreakdown(offers),
      goals: normalizeBreakdown(goals),
      statuses: normalizeBreakdown(statuses),
    },
  };
}

export async function getDailyRollupSummary(filter = {}) {
  return getRollupSummary(filter);
}

export async function getAdminDashboardStats({
  date,
  timezone,
  bucket = DEFAULT_DASHBOARD_BUCKET,
} = {}) {
  const resolvedTimezone = resolveDashboardTimezone(timezone);
  const resolvedDate = date || resolveCurrentDateInTimezone(resolvedTimezone);
  const rows = await getHourlyDashboardSeries({
    date: resolvedDate,
    timezone: resolvedTimezone,
  });

  const series = rows.map((row) => {
    const metrics = buildDashboardMetricSet(row);

    return {
      bucketStart: normalizeBucketStart(row.bucketStart),
      label: row.label,
      ...metrics,
    };
  });

  const totals = buildDashboardMetricSet(
    series.reduce(
      (accumulator, entry) => ({
        clicks: accumulator.clicks + entry.clicks,
        conversions: accumulator.conversions + entry.conversions,
        approvedConversions:
          accumulator.approvedConversions + entry.approvedConversions,
        revenue: accumulator.revenue + entry.revenue,
        payout: accumulator.payout + entry.payout,
      }),
      {
        clicks: 0,
        conversions: 0,
        approvedConversions: 0,
        revenue: 0,
        payout: 0,
      },
    ),
  );

  return {
    date: resolvedDate,
    timezone: resolvedTimezone,
    bucket,
    totals,
    series,
  };
}
