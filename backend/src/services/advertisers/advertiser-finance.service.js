import {
  getStatsSummary,
  getOfferBreakdown,
  getStatusBreakdown,
} from '../../models/stats-aggregator.model.js';
import {
  attachOfferTitles,
  assertOfferBelongsToAdvertiser,
  buildAdvertiserFilter,
  ensureAdvertiserContext,
} from './advertiser-context.service.js';
import { CONVERSION_STATUSES } from '../../constants/conversions.js';

function mapSummaryToFinance(summary = {}) {
  return {
    pendingRevenue: summary.pendingRevenue ?? 0,
    approvedRevenue: summary.approvedRevenue ?? 0,
    rejectedRevenue: summary.rejectedRevenue ?? 0,
    cancelledRevenue: summary.cancelledRevenue ?? 0,
    pendingPayout: summary.pendingPayout ?? 0,
    approvedPayout: summary.approvedPayout ?? 0,
    rejectedPayout: summary.rejectedPayout ?? 0,
    cancelledPayout: summary.cancelledPayout ?? 0,
    conversionsPending: summary.conversionsPending ?? 0,
    conversionsApproved: summary.conversionsApproved ?? 0,
    conversionsRejected: summary.conversionsRejected ?? 0,
    conversionsCancelled: summary.conversionsCancelled ?? 0,
  };
}

function mapOfferBreakdownEntries(entries = []) {
  return entries.map((entry) => ({
    offerId: entry.offerId ?? null,
    title: entry.title ?? null,
    approvedRevenue: entry.approvedRevenue ?? 0,
    approvedPayout: entry.approvedPayout ?? 0,
    conversionsApproved: entry.conversionsApproved ?? 0,
  }));
}

function mapStatuses(entries = []) {
  return entries.map((entry) => {
    const status = entry.status ?? null;

    if (status === CONVERSION_STATUSES.APPROVED) {
      return {
        status,
        revenue: entry.approvedRevenue ?? 0,
        payout: entry.approvedPayout ?? 0,
        count: entry.conversionsApproved ?? entry.conversionsTotal ?? 0,
      };
    }

    if (status === CONVERSION_STATUSES.PENDING) {
      return {
        status,
        revenue: entry.pendingRevenue ?? 0,
        payout: entry.pendingPayout ?? 0,
        count: entry.conversionsPending ?? entry.conversionsTotal ?? 0,
      };
    }

    if (status === CONVERSION_STATUSES.REJECTED) {
      return {
        status,
        revenue: entry.rejectedRevenue ?? 0,
        payout: entry.rejectedPayout ?? 0,
        count: entry.conversionsRejected ?? entry.conversionsTotal ?? 0,
      };
    }

    if (status === CONVERSION_STATUSES.CANCELLED) {
      return {
        status,
        revenue: entry.cancelledRevenue ?? 0,
        payout: entry.cancelledPayout ?? 0,
        count: entry.conversionsCancelled ?? entry.conversionsTotal ?? 0,
      };
    }

    return {
      status,
      revenue:
        (entry.pendingRevenue ?? 0) +
        (entry.approvedRevenue ?? 0) +
        (entry.rejectedRevenue ?? 0) +
        (entry.cancelledRevenue ?? 0),
      payout:
        (entry.pendingPayout ?? 0) +
        (entry.approvedPayout ?? 0) +
        (entry.rejectedPayout ?? 0) +
        (entry.cancelledPayout ?? 0),
      count: entry.conversionsTotal ?? 0,
    };
  });
}

export async function getAdvertiserFinanceSummary({ advertiserId, filter = {} }) {
  ensureAdvertiserContext(advertiserId);

  if (filter.offerId) {
    await assertOfferBelongsToAdvertiser({ advertiserId, offerId: filter.offerId });
  }

  const resolvedFilter = buildAdvertiserFilter(advertiserId, filter);
  const summary = await getStatsSummary(resolvedFilter);
  return mapSummaryToFinance(summary);
}

export async function getAdvertiserFinanceBreakdown({ advertiserId, filter = {} }) {
  ensureAdvertiserContext(advertiserId);

  if (filter.offerId) {
    await assertOfferBelongsToAdvertiser({ advertiserId, offerId: filter.offerId });
  }

  const resolvedFilter = buildAdvertiserFilter(advertiserId, filter);
  const [offerRows, statusRows] = await Promise.all([
    getOfferBreakdown(resolvedFilter),
    getStatusBreakdown(resolvedFilter),
  ]);

  const offersWithTitles = await attachOfferTitles(offerRows);

  return {
    offers: mapOfferBreakdownEntries(offersWithTitles),
    statuses: mapStatuses(statusRows),
  };
}
