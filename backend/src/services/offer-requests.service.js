import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { getOfferById } from './offers.service.js';
import { findAffiliateAccessForOffer } from '../models/offerAffiliateAccess.model.js';
import {
  OFFER_ACCESS_TYPES,
  OFFER_VISIBILITY_MODES,
} from '../constants/offers.js';
import { resolveAffiliateOfferAccess } from './offers/affiliate-visibility.js';
import {
  createOfferRequest,
  findPendingOfferRequest,
} from '../models/offerRequests.model.js';

const PENDING_UNIQUE_CONSTRAINT = 'offer_requests_pending_unique';

// Business rules for creating offer requests:
// - offer must exist, be active, and visible to affiliate in restricted view
// - visibility_mode must be on_request
// - affiliate must have canRequestAccess=true (no allowed/rejected/excluded access)
// - there must be no other pending request for the same offer/affiliate pair

function throwOfferNotFound(offerId) {
  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
    offerId,
  });
}

function throwPendingConflict(existingRequest) {
  throw new ApiError(
    ERROR_CODES.CONFLICT,
    409,
    'Заявка уже создана и ожидает рассмотрения',
    existingRequest
      ? { requestId: existingRequest.id, status: existingRequest.status }
      : null,
  );
}

export async function requestOfferAccess({ offerId, affiliateId, message }) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to request access');
  }

  const offer = await getOfferById(offerId);
  const accessRecord = await findAffiliateAccessForOffer(offerId, affiliateId);
  const accessResolution = resolveAffiliateOfferAccess(offer, accessRecord);

  if (!accessResolution.isVisible) {
    throwOfferNotFound(offerId);
  }

  const visibilityMode =
    offer.visibilityMode ?? OFFER_VISIBILITY_MODES.PUBLIC;

  if (visibilityMode === OFFER_VISIBILITY_MODES.PUBLIC) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'Этот оффер доступен без заявки',
      { offerId },
    );
  }

  if (visibilityMode === OFFER_VISIBILITY_MODES.PRIVATE) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Заявка недоступна для приватного оффера',
      { offerId },
    );
  }

  if (
    visibilityMode !== OFFER_VISIBILITY_MODES.ON_REQUEST &&
    visibilityMode !== OFFER_VISIBILITY_MODES.PUBLIC &&
    visibilityMode !== OFFER_VISIBILITY_MODES.PRIVATE
  ) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'Оффер не поддерживает запрос доступа',
      { offerId, visibilityMode },
    );
  }

  if (!accessResolution.canRequestAccess) {
    if (accessRecord?.accessType === OFFER_ACCESS_TYPES.ALLOWED) {
      throw new ApiError(
        ERROR_CODES.FORBIDDEN,
        403,
        'Доступ уже открыт, заявка не требуется',
        { offerId },
      );
    }

    if (accessRecord?.accessType === OFFER_ACCESS_TYPES.REJECTED) {
      throw new ApiError(
        ERROR_CODES.FORBIDDEN,
        403,
        'Предыдущая заявка отклонена, повторный запрос невозможен',
        { offerId },
      );
    }

    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Заявка на доступ к этому офферу недоступна',
      { offerId },
    );
  }

  const pendingRequest = await findPendingOfferRequest(offerId, affiliateId);

  if (pendingRequest) {
    throwPendingConflict(pendingRequest);
  }

  try {
    const request = await createOfferRequest({
      offerId,
      affiliateId,
      message: message ?? null,
    });

    return request;
  } catch (error) {
    if (
      error?.code === '23505' &&
      error?.constraint === PENDING_UNIQUE_CONSTRAINT
    ) {
      throwPendingConflict();
    }

    throw error;
  }
}
