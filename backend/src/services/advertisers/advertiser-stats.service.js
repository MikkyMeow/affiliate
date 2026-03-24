import { getStatsSummary, getOfferBreakdown, getStatusBreakdown, getGoalBreakdown } from '../../models/stats-aggregator.model.js';
import { findOfferById } from '../../models/offers.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import {
  attachOfferTitles,
  buildAdvertiserFilter,
  ensureAdvertiserContext,
} from './advertiser-context.service.js';

export async function getAdvertiserStatsSummary({ advertiserId, filter = {} }) {
  const resolvedFilter = buildAdvertiserFilter(advertiserId, filter);
  const summary = await getStatsSummary(resolvedFilter);
  return summary;
}

export async function getAdvertiserStatsBreakdowns({ advertiserId, filter = {} }) {
  const resolvedFilter = buildAdvertiserFilter(advertiserId, filter);
  const [offers, statuses] = await Promise.all([
    getOfferBreakdown(resolvedFilter),
    getStatusBreakdown(resolvedFilter),
  ]);

  const offersWithTitles = await attachOfferTitles(offers);

  return {
    offers: offersWithTitles,
    statuses,
  };
}

export async function getAdvertiserOfferStats({ advertiserId, offerId, filter = {} }) {
  ensureAdvertiserContext(advertiserId);

  if (!offerId) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'offerId обязателен');
  }

  const offer = await findOfferById(offerId);

  if (!offer || offer.advertiserId !== advertiserId) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId,
    });
  }

  const resolvedFilter = {
    ...buildAdvertiserFilter(advertiserId, filter),
    offerId,
  };

  const [summary, goals, statuses] = await Promise.all([
    getStatsSummary(resolvedFilter),
    getGoalBreakdown(resolvedFilter),
    getStatusBreakdown(resolvedFilter),
  ]);

  return {
    offer: {
      id: offer.id,
      title: offer.title ?? null,
    },
    summary,
    goals,
    statuses,
  };
}
