import crypto from 'crypto';
import { findOfferForPostbackByToken } from '../../models/offers.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { dispatchAsyncJob } from '../async-jobs.service.js';
import { ASYNC_JOB_NAMES, queueConfig } from '../../queue/index.js';
import { queueJobEnqueueFailedCounter } from '../../lib/metrics.js';
import { createConversionWithResolvedGoal } from '../offer-goals.service.js';
import { logError, logInfo, logWarn } from '../../lib/structuredLogger.js';
import { canPartnerAccessOffer } from '../offers/affiliate-visibility.js';
import { getPartnerOfferVisibilityState } from '../offer-visibility.service.js';
import { getClickByClickId } from '../tracking/clicks.service.js';
import {
  createPostbackLog,
  updatePostbackLogResult,
} from '../../models/postback-logs.model.js';
import {
  CONVERSION_STATUS_VALUES,
  CONVERSION_STATUSES,
} from '../../constants/conversions.js';

async function publishConversionCreatedJob(conversion) {
  const jobType = 'conversion_created';
  const payload = {
    type: jobType,
    conversionId: conversion.id,
    clickId: conversion.clickId,
    offerId: conversion.offerId,
    affiliateId: conversion.affiliateId,
    goalId: conversion.goalId ?? null,
  };

  try {
    await dispatchAsyncJob(ASYNC_JOB_NAMES.POSTBACK_EVENT, payload);
  } catch (error) {
    queueJobEnqueueFailedCounter.inc({
      queue_name: queueConfig.name,
      job_type: jobType,
    });
    logError('queue_enqueue_failed', {
      queue: queueConfig.name,
      jobType,
      conversionId: conversion.id,
      reason: error.message,
    });
  }
}

function maskSensitiveValue(value) {
  if (typeof value === 'string' && value.length <= 3) {
    return '*'.repeat(value.length);
  }

  return '***';
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    if (payload === undefined) {
      return {};
    }

    return { raw: payload };
  }

  const allowedKeys = [
    'clickId',
    'click_id',
    'status',
    'payoutRub',
    'payout_rub',
    'payout',
    'signature',
    'sig',
    'goalId',
    'goal_id',
    'externalTransactionId',
    'externalTransactionID',
    'externalId',
    'external_id',
    'transactionId',
    'transaction_id',
    'revenue',
    'profit',
  ];

  const sanitized = {};

  for (const key of allowedKeys) {
    if (Object.hasOwn(payload, key)) {
      sanitized[key] = payload[key];
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (typeof key === 'string' && key.toLowerCase().includes('token')) {
      sanitized[key] = maskSensitiveValue(value);
    }
  }

  return sanitized;
}

function buildLogPayload(payload) {
  return {
    body: sanitizePayload(payload),
  };
}

function assertClickId(clickId) {
  if (!clickId || typeof clickId !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'clickId обязателен');
  }
}

function assertToken(token) {
  if (!token || typeof token !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'token обязателен');
  }
}

function ensureOfferExists(offer, { clickId }) {
  if (offer) {
    return offer;
  }

  throw new ApiError(
    ERROR_CODES.INVALID_POSTBACK_TOKEN,
    403,
    'Некорректный postback token',
    {
      clickId,
    },
  );
}

function assertOfferMatchesClick({ offer, click }) {
  if (offer.id === click.offerId) {
    return;
  }

  throw new ApiError(
    ERROR_CODES.INVALID_POSTBACK_TOKEN,
    403,
    'Некорректный postback token',
    {
      offerId: offer.id,
      clickId: click.clickId,
      clickOfferId: click.offerId,
    },
  );
}

function assertPartnerCanConvertOffer(
  visibilityState,
  { clickId, offerId, affiliateId },
) {
  if (canPartnerAccessOffer(visibilityState)) {
    return;
  }

  throw new ApiError(ERROR_CODES.FORBIDDEN, 403, 'Оффер недоступен для этого партнёра', {
    clickId,
    offerId,
    affiliateId,
    denyReason: visibilityState?.denyReason ?? null,
  });
}

function buildSignaturePayload({ clickId, status, payoutRub }) {
  const payout = typeof payoutRub === 'number' ? payoutRub.toString(10) : '';
  return `${clickId}|${status}|${payout}`;
}

function calculateSignature({ payload, secret }) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifySignature({ signature, secret, clickId, status, payoutRub }) {
  if (!signature || typeof signature !== 'string') {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, 401, 'Подпись обязательна');
  }

  const normalizedSignature = signature.trim().toLowerCase();

  if (!/^[0-9a-f]+$/.test(normalizedSignature) || normalizedSignature.length % 2 !== 0) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, 401, 'Некорректная подпись');
  }

  const payload = buildSignaturePayload({ clickId, status, payoutRub });
  const expected = calculateSignature({ payload, secret }).toLowerCase();
  const providedBuffer = Buffer.from(normalizedSignature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, 401, 'Подпись не прошла проверку');
  }
}

async function createPostbackLifecycleLog({ requestId, clickId, payload }) {
  try {
    return await createPostbackLog({
      requestId,
      clickId,
      status: 'received',
      payloadJson: buildLogPayload(payload ?? null),
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'postback_log_error',
        action: 'create',
        request_id: requestId ?? null,
        reason: error.message,
      }),
    );
    return null;
  }
}

async function updatePostbackLifecycleLog(logEntry, patch) {
  if (!logEntry) {
    return;
  }

  try {
    await updatePostbackLogResult({
      id: logEntry.id,
      ...patch,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'postback_log_error',
        action: 'update',
        log_id: logEntry.id,
        reason: error.message,
      }),
    );
  }
}

function ensureValidStatus(status) {
  if (!CONVERSION_STATUS_VALUES.includes(status)) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Недопустимый статус', {
      status,
      allowed: CONVERSION_STATUS_VALUES,
    });
  }

  return status;
}

function resolveStatusForError(code) {
  if (code === ERROR_CODES.DUPLICATE_CONVERSION) {
    return 'duplicate';
  }

  if (
    code === ERROR_CODES.INVALID_POSTBACK_TOKEN ||
    code === ERROR_CODES.NOT_FOUND ||
    code === ERROR_CODES.GOAL_REQUIRED ||
    code === ERROR_CODES.GOAL_NOT_FOUND_FOR_OFFER ||
    code === ERROR_CODES.GOAL_LIMIT_REACHED ||
    code === ERROR_CODES.VALIDATION_ERROR ||
    code === ERROR_CODES.UNAUTHORIZED ||
    code === ERROR_CODES.FORBIDDEN
  ) {
    return 'rejected';
  }

  if (code === ERROR_CODES.INTERNAL_ERROR) {
    return 'failed';
  }

  return 'rejected';
}

export async function logPostbackValidationFailure({
  requestId = null,
  clickId = null,
  payload = null,
  errorCode = ERROR_CODES.VALIDATION_ERROR,
}) {
  logWarn('postback_validation_failed', {
    requestId,
    clickId,
    payload: buildLogPayload(payload).body,
  });

  const logEntry = await createPostbackLifecycleLog({
    requestId,
    clickId,
    payload,
  });

  await updatePostbackLifecycleLog(logEntry, {
    status: 'rejected',
    errorCode,
    clickId: clickId ?? null,
  });
}

export async function registerConversion(
  {
    token,
    clickId,
    signature,
    status = CONVERSION_STATUSES.PENDING,
    payoutRub,
    goalId = null,
    externalTransactionId = null,
  },
  { requestId = null, payload = null } = {},
) {
  const postbackLog = await createPostbackLifecycleLog({
    requestId,
    clickId: clickId ?? null,
    payload,
  });
  const logContext = {
    offerId: null,
    affiliateId: null,
    resolvedGoalId: null,
    resolvedGoalName: null,
  };
  logInfo('postback_received', {
    requestId,
    clickId,
    payload: buildLogPayload(payload).body,
  });

  try {
    assertToken(token);
    assertClickId(clickId);

    const offer = ensureOfferExists(
      await findOfferForPostbackByToken(token),
      { clickId },
    );
    logContext.offerId = offer.id;

    const click = await getClickByClickId(clickId);
    assertOfferMatchesClick({ offer, click });
    logContext.affiliateId = click.affiliateId;
    await updatePostbackLifecycleLog(postbackLog, {
      offerId: logContext.offerId,
      affiliateId: logContext.affiliateId,
    });

    const normalizedStatus = ensureValidStatus(status);

    verifySignature({
      signature,
      secret: offer.postbackToken,
      clickId,
      status: normalizedStatus,
      payoutRub,
    });

    const visibilityState = await getPartnerOfferVisibilityState(
      click.affiliateId,
      offer.id,
      { offer },
    );
    assertPartnerCanConvertOffer(visibilityState, {
      clickId,
      offerId: offer.id,
      affiliateId: click.affiliateId,
    });

    let resolvedGoalSnapshot = null;

    try {
      const { conversion, goalSnapshot } = await createConversionWithResolvedGoal(
        {
          clickId,
          offerId: click.offerId,
          affiliateId: click.affiliateId,
          status: normalizedStatus,
          goalId,
          externalTransactionId,
        },
        {
          requestId,
        },
      );
      resolvedGoalSnapshot = goalSnapshot;
      logContext.resolvedGoalId = goalSnapshot.id ?? logContext.resolvedGoalId;
      logContext.resolvedGoalName = goalSnapshot.name ?? logContext.resolvedGoalName;

      await updatePostbackLifecycleLog(postbackLog, {
        offerId: logContext.offerId,
        affiliateId: logContext.affiliateId,
        resolvedGoalId: goalSnapshot.id ?? null,
        resolvedGoalName: goalSnapshot.name ?? null,
        goalError: null,
      });

      logInfo('postback_goal_resolved', {
        requestId,
        clickId,
        offerId: logContext.offerId,
        affiliateId: logContext.affiliateId,
        goalId: goalSnapshot.id ?? null,
        goalName: goalSnapshot.name ?? null,
        goalRateSource: goalSnapshot.source ?? 'base',
      });

      await updatePostbackLifecycleLog(postbackLog, {
        status: 'processed',
        errorCode: null,
        offerId: conversion.offerId,
        affiliateId: conversion.affiliateId,
        clickId: conversion.clickId,
        resolvedGoalId: conversion.goalId ?? null,
        resolvedGoalName: conversion.goalName ?? null,
        goalError: null,
      });

      await publishConversionCreatedJob(conversion);

      logInfo('conversion_created', {
        requestId,
        clickId: conversion.clickId,
        conversionId: conversion.id,
        offerId: conversion.offerId,
        affiliateId: conversion.affiliateId,
        goalId: conversion.goalId ?? null,
        externalTransactionId: conversion.externalTransactionId ?? null,
        status: conversion.status,
      });

      return {
        conversion,
        goalSnapshot,
      };
    } catch (error) {
      if (error?.code === '23505') {
        const duplicateGoalId = resolvedGoalSnapshot?.id ?? goalId ?? null;
        const duplicateGoalName = resolvedGoalSnapshot?.name ?? null;

        await updatePostbackLifecycleLog(postbackLog, {
          status: 'duplicate',
          errorCode: ERROR_CODES.DUPLICATE_CONVERSION,
          offerId: logContext.offerId,
          affiliateId: logContext.affiliateId,
          clickId,
          resolvedGoalId: duplicateGoalId,
          resolvedGoalName: duplicateGoalName,
          goalError: null,
        });

        logWarn('postback_duplicate', {
          requestId,
          clickId,
          offerId: logContext.offerId,
          affiliateId: logContext.affiliateId,
          goalId: duplicateGoalId,
          externalTransactionId,
        });

        throw new ApiError(
          ERROR_CODES.DUPLICATE_CONVERSION,
          409,
          'Конверсия уже существует',
          {
            clickId,
            offerId: offer.id,
            affiliateId: click.affiliateId,
            goalId: duplicateGoalId,
            externalTransactionId,
          },
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof ApiError) {
      const status = resolveStatusForError(error.code);
      const errorCode = error.code ?? ERROR_CODES.INTERNAL_ERROR;
      const patch = {
        status,
        errorCode,
        clickId,
      };

      if (logContext.offerId) {
        patch.offerId = logContext.offerId;
      }

      if (logContext.affiliateId) {
        patch.affiliateId = logContext.affiliateId;
      }

      if (logContext.resolvedGoalId) {
        patch.resolvedGoalId = logContext.resolvedGoalId;
      } else if (error.details?.goalId) {
        patch.resolvedGoalId = error.details.goalId;
      }

      if (logContext.resolvedGoalName) {
        patch.resolvedGoalName = logContext.resolvedGoalName;
      }

      if (error.details?.goalError) {
        patch.goalError = error.details.goalError;
      }

      await updatePostbackLifecycleLog(postbackLog, patch);

      logError('postback_failed', {
        requestId,
        clickId,
        offerId: logContext.offerId,
        affiliateId: logContext.affiliateId,
        status: patch.status,
        errorCode: patch.errorCode,
        reason: error.message,
      });
    } else {
      const patch = {
        status: 'failed',
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        clickId,
      };

      if (logContext.offerId) {
        patch.offerId = logContext.offerId;
      }

      if (logContext.affiliateId) {
        patch.affiliateId = logContext.affiliateId;
      }

      if (logContext.resolvedGoalId) {
        patch.resolvedGoalId = logContext.resolvedGoalId;
      }

      if (logContext.resolvedGoalName) {
        patch.resolvedGoalName = logContext.resolvedGoalName;
      }

      await updatePostbackLifecycleLog(postbackLog, patch);
      logError('postback_failed', {
        requestId,
        clickId,
        offerId: logContext.offerId,
        affiliateId: logContext.affiliateId,
        status: patch.status,
        errorCode: patch.errorCode,
        reason: error.message,
      });
    }

    throw error;
  }
}
