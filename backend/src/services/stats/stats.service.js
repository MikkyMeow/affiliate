import { listClicks as listClicksModel } from '../../models/clicks.model.js';
import { listConversions as listConversionsModel } from '../../models/conversions.model.js';
import {
  getStatsSummary as getRawStatsSummary,
  getOfferBreakdown as getOfferBreakdownModel,
  getAffiliateBreakdown as getAffiliateBreakdownModel,
  getGoalBreakdown as getGoalBreakdownModel,
  getStatusBreakdown as getStatusBreakdownModel,
} from '../../models/stats-aggregator.model.js';
import { getAggregatedSummary as getRollupSummary } from './rollup.service.js';

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
