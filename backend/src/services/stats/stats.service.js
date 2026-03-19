import { listClicks as listClicksModel } from '../../models/clicks.model.js';
import { listConversions as listConversionsModel } from '../../models/conversions.model.js';
import { getAggregatedSummary } from './rollup.service.js';

export async function listClicks(filter, pagination) {
  return listClicksModel(filter, pagination);
}

export async function listConversions(filter, pagination) {
  return listConversionsModel(filter, pagination);
}

export async function getSummary(filter = {}) {
  const {
    clicksTotal = 0,
    conversionsTotal = 0,
    pendingConversionsTotal = 0,
    approvedConversionsTotal = 0,
    rejectedConversionsTotal = 0,
    pendingPayoutTotalRub = 0,
    approvedPayoutTotalRub = 0,
    rejectedPayoutTotalRub = 0,
    pendingRevenueTotalRub = 0,
    approvedRevenueTotalRub = 0,
    rejectedRevenueTotalRub = 0,
  } = await getAggregatedSummary(filter);

  return {
    clicksTotal,
    conversionsTotal,
    conversionsPending: pendingConversionsTotal,
    conversionsApproved: approvedConversionsTotal,
    conversionsRejected: rejectedConversionsTotal,
    pendingPayout: pendingPayoutTotalRub,
    approvedPayout: approvedPayoutTotalRub,
    rejectedPayout: rejectedPayoutTotalRub,
    pendingRevenue: pendingRevenueTotalRub,
    approvedRevenue: approvedRevenueTotalRub,
    rejectedRevenue: rejectedRevenueTotalRub,
  };
}

export async function getDailyRollupSummary(filter = {}) {
  return getAggregatedSummary(filter);
}
