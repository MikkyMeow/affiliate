import {
  listClicks as listClicksModel,
  listAdminClicks as listAdminClicksModel,
} from '../../models/clicks.model.js';
import {
  listConversions as listConversionsModel,
  listAdminConversions as listAdminConversionsModel,
} from '../../models/conversions.model.js';
import { getHourlyDashboardSeries } from '../../models/admin-dashboard.model.js';
import {
  getStatsSummary as getRawStatsSummary,
  getOfferBreakdown as getOfferBreakdownModel,
  getAffiliateBreakdown as getAffiliateBreakdownModel,
  getGoalBreakdown as getGoalBreakdownModel,
  getStatusBreakdown as getStatusBreakdownModel,
} from '../../models/stats-aggregator.model.js';
import {
  getAdminSummaryGroups as getAdminSummaryGroupsModel,
  getAdminSummaryTotals as getAdminSummaryTotalsModel,
} from '../../models/admin-stats-summary.model.js';
import {
  getDailyStatsGroups,
  getDailyStatsSummary,
} from '../../models/daily-stats.model.js';
import { getDefaultTimeZone, resolveTimeZone } from '../../lib/timezone.js';
import { getAggregatedSummary as getRollupSummary } from './rollup.service.js';

const DEFAULT_DASHBOARD_BUCKET = 'hour';
const DEFAULT_DASHBOARD_TIMEZONE = getDefaultTimeZone();

function normalizeSummaryPayload(metrics = {}, { includeLegacyClicksAlias = true } = {}) {
  const summary = {
    clicks: Number(metrics.clicks ?? 0),
    conversionsTotal: Number(metrics.conversionsTotal ?? 0),
    conversionsPending: Number(metrics.conversionsPending ?? 0),
    conversionsApproved: Number(metrics.conversionsApproved ?? 0),
    conversionsRejected: Number(metrics.conversionsRejected ?? 0),
    conversionsCancelled: Number(metrics.conversionsCancelled ?? 0),
    pendingRevenue: Number(metrics.pendingRevenue ?? 0),
    pendingProfit: roundMetric(
      Number(metrics.pendingRevenue ?? 0) - Number(metrics.pendingPayout ?? 0),
    ),
    approvedRevenue: Number(metrics.approvedRevenue ?? 0),
    rejectedRevenue: Number(metrics.rejectedRevenue ?? 0),
    cancelledRevenue: Number(metrics.cancelledRevenue ?? 0),
    pendingPayout: Number(metrics.pendingPayout ?? 0),
    approvedPayout: Number(metrics.approvedPayout ?? 0),
    rejectedPayout: Number(metrics.rejectedPayout ?? 0),
    cancelledPayout: Number(metrics.cancelledPayout ?? 0),
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
    conversionsCancelled: Number(entry.conversionsCancelled ?? 0),
    pendingRevenue: Number(entry.pendingRevenue ?? 0),
    pendingProfit: roundMetric(
      Number(entry.pendingRevenue ?? 0) - Number(entry.pendingPayout ?? 0),
    ),
    approvedRevenue: Number(entry.approvedRevenue ?? 0),
    rejectedRevenue: Number(entry.rejectedRevenue ?? 0),
    cancelledRevenue: Number(entry.cancelledRevenue ?? 0),
    pendingPayout: Number(entry.pendingPayout ?? 0),
    approvedPayout: Number(entry.approvedPayout ?? 0),
    rejectedPayout: Number(entry.rejectedPayout ?? 0),
    cancelledPayout: Number(entry.cancelledPayout ?? 0),
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
  pendingConversions,
  approvedConversions,
  rejectedConversions,
  cancelledConversions,
  pendingRevenue,
  pendingPayout,
  revenue,
  payout,
}) {
  // Stage 15 definitions:
  // - revenue/payout use confirmed approved conversions only
  // - pendingRevenue/pendingPayout use unconfirmed pending conversions only
  // - profit is backend-calculated revenue - payout
  // - CR/EPC/approveRate must return 0 when the denominator is 0
  const normalizedClicks = Number(clicks ?? 0);
  const normalizedConversions = Number(conversions ?? 0);
  const normalizedPendingConversions = Number(pendingConversions ?? 0);
  const normalizedApprovedConversions = Number(approvedConversions ?? 0);
  const normalizedRejectedConversions = Number(rejectedConversions ?? 0);
  const normalizedCancelledConversions = Number(cancelledConversions ?? 0);
  const normalizedPendingRevenue = roundMetric(pendingRevenue);
  const normalizedPendingPayout = roundMetric(pendingPayout);
  const normalizedRevenue = roundMetric(revenue);
  const normalizedPayout = roundMetric(payout);
  const pendingProfit = roundMetric(
    normalizedPendingRevenue - normalizedPendingPayout,
  );
  const profit = roundMetric(normalizedRevenue - normalizedPayout);

  return {
    clicks: normalizedClicks,
    transactions: normalizedClicks,
    conversions: normalizedConversions,
    pendingConversions: normalizedPendingConversions,
    approvedConversions: normalizedApprovedConversions,
    rejectedConversions: normalizedRejectedConversions,
    cancelledConversions: normalizedCancelledConversions,
    cr: calculateRatio(normalizedConversions, normalizedClicks),
    pendingRevenue: normalizedPendingRevenue,
    pendingPayout: normalizedPendingPayout,
    pendingProfit,
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

function buildDashboardMetricSetFromSummary(summary = {}) {
  return buildDashboardMetricSet({
    clicks: summary.clicks,
    conversions: summary.conversionsTotal,
    pendingConversions: summary.pendingConversions,
    approvedConversions: summary.approvedConversions,
    rejectedConversions: summary.rejectedConversions,
    cancelledConversions: summary.cancelledConversions,
    pendingRevenue: summary.pendingRevenue,
    pendingPayout: summary.pendingPayout,
    revenue: summary.approvedRevenue,
    payout: summary.approvedPayout,
  });
}

function hasStoredDailyStats(summary = {}) {
  return Number(summary.rowCount ?? 0) > 0;
}

function resolveDashboardTimezone(rawTimezone) {
  return resolveTimeZone(rawTimezone, DEFAULT_DASHBOARD_TIMEZONE);
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

export async function listAdminClicks(filter, pagination) {
  return listAdminClicksModel(filter, pagination);
}

export async function listAdminConversions(filter, pagination) {
  return listAdminConversionsModel(filter, pagination);
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
  const [rows, storedSummary] = await Promise.all([
    getHourlyDashboardSeries({
      date: resolvedDate,
      timezone: resolvedTimezone,
    }),
    getDailyStatsSummary({
      dateFrom: resolvedDate,
      dateTo: resolvedDate,
      timezone: resolvedTimezone,
    }),
  ]);

  const series = rows.map((row) => {
    const metrics = buildDashboardMetricSet(row);

    return {
      bucketStart: normalizeBucketStart(row.bucketStart),
      label: row.label,
      ...metrics,
    };
  });

  const rawTotals = buildDashboardMetricSet(
    series.reduce(
      (accumulator, entry) => ({
        clicks: accumulator.clicks + entry.clicks,
        conversions: accumulator.conversions + entry.conversions,
        pendingConversions:
          accumulator.pendingConversions + entry.pendingConversions,
        approvedConversions:
          accumulator.approvedConversions + entry.approvedConversions,
        rejectedConversions:
          accumulator.rejectedConversions + entry.rejectedConversions,
        cancelledConversions:
          accumulator.cancelledConversions + entry.cancelledConversions,
        pendingRevenue: accumulator.pendingRevenue + entry.pendingRevenue,
        pendingPayout: accumulator.pendingPayout + entry.pendingPayout,
        revenue: accumulator.revenue + entry.revenue,
        payout: accumulator.payout + entry.payout,
      }),
      {
        clicks: 0,
        conversions: 0,
        pendingConversions: 0,
        approvedConversions: 0,
        rejectedConversions: 0,
        cancelledConversions: 0,
        pendingRevenue: 0,
        pendingPayout: 0,
        revenue: 0,
        payout: 0,
      },
    ),
  );
  const totals = hasStoredDailyStats(storedSummary)
    ? buildDashboardMetricSetFromSummary(storedSummary)
    : rawTotals;

  return {
    date: resolvedDate,
    timezone: resolvedTimezone,
    bucket,
    totals,
    series,
    statsUpdatedAt: hasStoredDailyStats(storedSummary)
      ? storedSummary.statsUpdatedAt
      : null,
  };
}

export async function getAdminFilteredSummary({
  dateFrom,
  dateTo,
  timezone,
  offerId,
  affiliateId,
  advertiserId,
  groupBy,
  responseFilters = null,
} = {}) {
  const filter = {
    dateFrom,
    dateTo,
    timezone,
    offerId,
    affiliateId,
    advertiserId,
  };
  const storedSummary = await getDailyStatsSummary(filter);
  const useStoredSummary = hasStoredDailyStats(storedSummary);

  const totalsMetrics = useStoredSummary
    ? buildDashboardMetricSetFromSummary(storedSummary)
    : buildDashboardMetricSet(await getAdminSummaryTotalsModel(filter));
  const groups = groupBy
    ? (
        useStoredSummary
          ? await getDailyStatsGroups(filter, groupBy)
          : await getAdminSummaryGroupsModel(filter, groupBy)
      ).map((entry) => ({
        key: entry.key,
        type: entry.type,
        ...('partner' in entry ? { partner: entry.partner } : {}),
        ...('offer' in entry ? { offer: entry.offer } : {}),
        ...('advertiser' in entry ? { advertiser: entry.advertiser } : {}),
        metrics: buildDashboardMetricSet(entry.metrics),
      }))
    : [];

  return {
    filters:
      responseFilters ?? {
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        offerId:
          typeof offerId === 'string' ? offerId : offerId?.value ?? null,
        affiliateId:
          typeof affiliateId === 'string'
            ? affiliateId
            : affiliateId?.value ?? null,
        advertiserId:
          typeof advertiserId === 'string'
            ? advertiserId
            : advertiserId?.value ?? null,
        groupBy: groupBy ?? null,
      },
    totals: totalsMetrics,
    groups,
    statsUpdatedAt: useStoredSummary ? storedSummary.statsUpdatedAt : null,
  };
}
