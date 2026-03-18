import pool from '../db.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { getOfferById } from './offers.service.js';
import { getAffiliateById } from './affiliates.service.js';
import {
  deleteOfferAffiliateAccess,
  listOfferAffiliateAccess,
  upsertOfferAffiliateAccess,
} from '../models/offerAffiliateAccess.model.js';
import {
  OFFER_ACCESS_SOURCES,
  OFFER_ACCESS_TYPES,
  OFFER_REQUEST_STATUSES,
  OFFER_VISIBILITY_MODES,
} from '../constants/offers.js';
import {
  findPendingOfferRequest,
  updateOfferRequestReview,
} from '../models/offerRequests.model.js';

const supportedManualAccessTypes = new Set(Object.values(OFFER_ACCESS_TYPES));

const allowedManualAccessByVisibility = {
  [OFFER_VISIBILITY_MODES.PUBLIC]: new Set([OFFER_ACCESS_TYPES.EXCLUDED]),
  [OFFER_VISIBILITY_MODES.ON_REQUEST]: new Set([
    OFFER_ACCESS_TYPES.ALLOWED,
    OFFER_ACCESS_TYPES.REJECTED,
    OFFER_ACCESS_TYPES.EXCLUDED,
  ]),
  [OFFER_VISIBILITY_MODES.PRIVATE]: new Set([OFFER_ACCESS_TYPES.ALLOWED]),
};

function resolveVisibilityMode(offer) {
  return offer.visibilityMode ?? OFFER_VISIBILITY_MODES.PUBLIC;
}

function normalizeAccessType(accessType) {
  if (typeof accessType !== 'string') {
    return null;
  }

  const normalized = accessType.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function assertAccessTypeSupported(accessType) {
  if (!supportedManualAccessTypes.has(accessType)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'Недопустимый accessType',
      { accessType },
    );
  }
}

function assertAccessAllowed(visibilityMode, accessType) {
  const allowedSet = allowedManualAccessByVisibility[visibilityMode];

  if (!allowedSet || !allowedSet.has(accessType)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'Недопустимый manual access для текущего visibilityMode',
      { visibilityMode, accessType },
    );
  }
}

function resolvePendingRequestStatus(accessType) {
  if (accessType === OFFER_ACCESS_TYPES.ALLOWED) {
    return OFFER_REQUEST_STATUSES.APPROVED;
  }

  if (
    accessType === OFFER_ACCESS_TYPES.REJECTED ||
    accessType === OFFER_ACCESS_TYPES.EXCLUDED
  ) {
    return OFFER_REQUEST_STATUSES.REJECTED;
  }

  return null;
}

export async function setManualOfferAffiliateAccess({
  offerId,
  affiliateId,
  accessType,
  actorId,
}) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to set access');
  }

  if (!accessType) {
    throw new Error('accessType is required to set access');
  }

  if (!actorId) {
    throw new Error('actorId is required to set access');
  }

  const normalizedAccessType = normalizeAccessType(accessType);
  assertAccessTypeSupported(normalizedAccessType);

  const offer = await getOfferById(offerId);
  await getAffiliateById(affiliateId);

  const visibilityMode = resolveVisibilityMode(offer);
  assertAccessAllowed(visibilityMode, normalizedAccessType);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const access = await upsertOfferAffiliateAccess(
      {
        offerId,
        affiliateId,
        accessType: normalizedAccessType,
        source: OFFER_ACCESS_SOURCES.MANUAL,
      },
      { client },
    );

    const pendingRequest = await findPendingOfferRequest(
      offerId,
      affiliateId,
      { client, forUpdate: true },
    );

    if (pendingRequest) {
      const nextStatus = resolvePendingRequestStatus(normalizedAccessType);

      if (nextStatus) {
        await updateOfferRequestReview(
          pendingRequest.id,
          {
            status: nextStatus,
            reviewedBy: actorId,
            reviewedAt: new Date(),
          },
          { client },
        );
      }
    }

    await client.query('COMMIT');
    return access;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function removeManualOfferAffiliateAccess({ offerId, affiliateId }) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to remove access');
  }

  await getOfferById(offerId);
  await getAffiliateById(affiliateId);

  await deleteOfferAffiliateAccess(offerId, affiliateId);
}

export async function listOfferAffiliateAccessRecords(offerId) {
  if (!offerId) {
    throw new Error('offerId is required to list access records');
  }

  await getOfferById(offerId);
  return listOfferAffiliateAccess(offerId);
}
