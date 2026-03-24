import { requireAdvertiserForUser } from '../advertisers.service.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { findOfferById, findOfferTitlesByIds } from '../../models/offers.model.js';

export async function resolveAdvertiserIdFromUser(user) {
  if (user?.advertiserId) {
    return user.advertiserId;
  }

  const userId = user?.userId ?? user?.id ?? null;
  if (!userId) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Не удалось определить рекламодателя',
    );
  }

  const advertiser = await requireAdvertiserForUser(userId);
  return advertiser.id;
}

export function ensureAdvertiserContext(advertiserId) {
  if (!advertiserId) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Не удалось определить рекламодателя',
    );
  }
}

export function buildAdvertiserFilter(advertiserId, filter = {}) {
  ensureAdvertiserContext(advertiserId);

  const resolved = { advertiserId };

  if (filter.dateFrom) {
    resolved.dateFrom = filter.dateFrom;
  }

  if (filter.dateTo) {
    resolved.dateTo = filter.dateTo;
  }

  if (filter.offerId) {
    resolved.offerId = filter.offerId;
  }

  return resolved;
}

export async function attachOfferTitles(entries = []) {
  const offerIds = entries
    .map((entry) => entry.offerId)
    .filter((offerId, index, self) => typeof offerId === 'string' && self.indexOf(offerId) === index);

  if (!offerIds.length) {
    return entries.map((entry) => ({ ...entry, title: null }));
  }

  const titleMap = await findOfferTitlesByIds(offerIds);
  return entries.map((entry) => ({
    ...entry,
    title: entry.offerId ? titleMap.get(entry.offerId) ?? null : null,
  }));
}

export async function assertOfferBelongsToAdvertiser({ advertiserId, offerId }) {
  if (!offerId) {
    return null;
  }

  const offer = await findOfferById(offerId);

  if (!offer || offer.advertiserId !== advertiserId) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId,
    });
  }

  return offer;
}
