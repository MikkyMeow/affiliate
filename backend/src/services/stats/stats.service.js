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
    approvedConversionsTotal = 0,
    rejectedConversionsTotal = 0,
    payoutTotalRub = 0,
  } = await getAggregatedSummary(filter);

  return {
    clicksTotal,
    conversionsTotal,
    approvedConversionsTotal,
    rejectedConversionsTotal,
    payoutTotal: payoutTotalRub,
  };
}

export async function getDailyRollupSummary(filter = {}) {
  return getAggregatedSummary(filter);
}
