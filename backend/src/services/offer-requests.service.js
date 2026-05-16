import pool from '../db.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { getOfferById } from './offers.service.js';
import {
  findAffiliateAccessForOffer,
  upsertOfferAffiliateAccess,
} from '../models/offerAffiliateAccess.model.js';
import {
  OFFER_ACCESS_TYPES,
  OFFER_ACCESS_SOURCES,
  OFFER_REQUEST_STATUSES,
  OFFER_VISIBILITY_MODES,
} from '../constants/offers.js';
import {
  createOfferRequest,
  findOfferRequestById,
  findPendingOfferRequest,
  updateOfferRequestReview,
  listOfferRequestsForOffer,
} from '../models/offerRequests.model.js';
import { writeAuditEvent } from './audit.service.js';
import { offerRequestDecisionCounter } from '../lib/metrics.js';
import { getPartnerOfferVisibilityState } from './offer-visibility.service.js';

const PENDING_UNIQUE_CONSTRAINT = 'offer_requests_pending_unique';

// Business rules for creating offer requests:
// - offer must exist and use on_request visibility
// - affiliate must not be hidden from the offer
// - affiliate must not already have allowed/rejected/excluded access or a pending request
// - there must be no other pending request for the same offer/affiliate pair

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
  const accessResolution = await getPartnerOfferVisibilityState(
    affiliateId,
    offerId,
    { offer },
  );

  const visibilityMode =
    offer.availability ?? offer.visibilityMode ?? OFFER_VISIBILITY_MODES.PUBLIC;

  if (accessResolution.isHidden) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Доступ к этому офферу запрещён',
      { offerId },
    );
  }

  if (visibilityMode === OFFER_VISIBILITY_MODES.PUBLIC) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      422,
      'Заявки доступны только для офферов on_request',
      { offerId },
    );
  }

  if (visibilityMode === OFFER_VISIBILITY_MODES.PRIVATE) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Заявка недоступна для этого оффера',
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
      422,
      'Заявки доступны только для офферов on_request',
      { offerId, visibilityMode },
    );
  }

  if (!accessResolution.canRequestAccess) {
    if (accessResolution.accessStatus === OFFER_ACCESS_TYPES.ALLOWED) {
      throw new ApiError(
        ERROR_CODES.CONFLICT,
        409,
        'Доступ уже открыт, заявка не требуется',
        { offerId },
      );
    }

    if (accessResolution.requestStatus === OFFER_REQUEST_STATUSES.PENDING) {
      throwPendingConflict({
        id: null,
        status: OFFER_REQUEST_STATUSES.PENDING,
      });
    }

    if (accessResolution.accessStatus === OFFER_ACCESS_TYPES.REJECTED) {
      throw new ApiError(
        ERROR_CODES.FORBIDDEN,
        403,
        'Предыдущая заявка отклонена, повторный запрос невозможен',
        { offerId },
      );
    }

    if (accessResolution.accessStatus === OFFER_ACCESS_TYPES.EXCLUDED) {
      throw new ApiError(
        ERROR_CODES.FORBIDDEN,
        403,
        'Заявка на доступ к этому офферу недоступна',
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

function assertDecisionAllowed(decision) {
  const normalized =
    typeof decision === 'string' ? decision.trim().toLowerCase() : '';

  if (
    normalized !== OFFER_REQUEST_STATUSES.APPROVED &&
    normalized !== OFFER_REQUEST_STATUSES.REJECTED
  ) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'decision должен быть approved или rejected',
      {
        decision,
      },
    );
  }

  return normalized;
}

function assertPendingRequest(request) {
  if (!request) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Заявка не найдена');
  }

  if (request.status !== OFFER_REQUEST_STATUSES.PENDING) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Заявка уже обработана',
      { requestId: request.id, status: request.status },
    );
  }
}

function assertNotExcluded(accessRecord, { requestId }) {
  if (accessRecord?.accessType === OFFER_ACCESS_TYPES.EXCLUDED) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Affiliate исключен из оффера, обработка заявки запрещена',
      {
        requestId,
        accessType: accessRecord.accessType,
      },
    );
  }
}

function resolveDecisionEffects(decision) {
  if (decision === OFFER_REQUEST_STATUSES.APPROVED) {
    return {
      requestStatus: OFFER_REQUEST_STATUSES.APPROVED,
      accessType: OFFER_ACCESS_TYPES.ALLOWED,
      accessSource: OFFER_ACCESS_SOURCES.REQUEST_APPROVED,
    };
  }

  return {
    requestStatus: OFFER_REQUEST_STATUSES.REJECTED,
    accessType: OFFER_ACCESS_TYPES.REJECTED,
    accessSource: OFFER_ACCESS_SOURCES.REQUEST_REJECTED,
  };
}

export async function reviewOfferRequest({
  requestId,
  reviewerId,
  decision,
  reviewerRole = null,
  requestContext = null,
}) {
  if (!requestId) {
    throw new Error('requestId is required to review offer request');
  }

  if (!reviewerId) {
    throw new Error('reviewerId is required to review offer request');
  }

  const normalizedDecision = assertDecisionAllowed(decision);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const request = await findOfferRequestById(requestId, {
      client,
      forUpdate: true,
    });
    assertPendingRequest(request);

    const accessRecord = await findAffiliateAccessForOffer(
      request.offerId,
      request.affiliateId,
      {
        client,
        forUpdate: true,
      },
    );
    assertNotExcluded(accessRecord, { requestId: request.id });

    // Разрешаем обработать pending-заявку даже если оффер успел
    // сменить видимость, чтобы не застревали старые заявки.

    const { requestStatus, accessType, accessSource } =
      resolveDecisionEffects(normalizedDecision);
    const reviewedAt = new Date();

    const updatedRequest = await updateOfferRequestReview(
      request.id,
      {
        status: requestStatus,
        reviewedBy: reviewerId,
        reviewedAt,
      },
      { client },
    );

    const previousAccess = accessRecord ?? null;
    const access = await upsertOfferAffiliateAccess(
      {
        offerId: request.offerId,
        affiliateId: request.affiliateId,
        accessType,
        source: accessSource,
      },
      { client },
    );

    await client.query('COMMIT');

    const auditAction =
      requestStatus === OFFER_REQUEST_STATUSES.APPROVED
        ? 'approved'
        : 'rejected';

    offerRequestDecisionCounter.inc({
      decision: auditAction,
    });

    await writeAuditEvent({
      entityType: 'offer_request',
      entityId: request.id,
      action: auditAction,
      actorUserId: reviewerId,
      actorRole: reviewerRole,
      requestId: requestContext?.requestId ?? null,
      context: {
        offerId: request.offerId,
        affiliateId: request.affiliateId,
        previousStatus: request.status,
        newStatus: updatedRequest.status,
        resultingAccess: {
          accessType: access.accessType,
          source: access.source,
          previousType: previousAccess?.accessType ?? null,
          previousSource: previousAccess?.source ?? null,
        },
      },
    });

    return { request: updatedRequest, access };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listPendingOfferRequestsForOffer(offerId) {
  if (!offerId) {
    throw new Error('offerId is required to list offer requests');
  }

  await getOfferById(offerId);
  return listOfferRequestsForOffer(offerId, {
    status: OFFER_REQUEST_STATUSES.PENDING,
  });
}
