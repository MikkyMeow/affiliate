import { listClicks as listClicksModel, getClickTotals } from '../../models/clicks.model.js';
import {
  listConversions as listConversionsModel,
  getConversionTotals,
} from '../../models/conversions.model.js';

export async function listClicks(filter, pagination) {
  return listClicksModel(filter, pagination);
}

export async function listConversions(filter, pagination) {
  return listConversionsModel(filter, pagination);
}

export async function getSummary(filter = {}) {
  const [clicks, conversions] = await Promise.all([
    getClickTotals(filter),
    getConversionTotals(filter),
  ]);

  return {
    clicksTotal: clicks.total ?? 0,
    conversionsTotal: conversions.total ?? 0,
    approvedConversionsTotal: conversions.approved ?? 0,
    rejectedConversionsTotal: conversions.rejected ?? 0,
    payoutTotal: conversions.totalPayoutRub ?? 0,
  };
}
