import crypto from 'crypto';
import { createConversion, findByClickId } from '../../models/conversions.model.js';
import { findOfferForPostback } from '../../models/offers.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { dispatchAsyncJob } from '../async-jobs.service.js';
import { ASYNC_JOB_NAMES, queueConfig } from '../../queue/index.js';
import { queueJobEnqueueFailedCounter } from '../../lib/metrics.js';
import { resolveOfferGoalForPostback } from './offer-goals.service.js';

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
    console.error(
      JSON.stringify({
        event: 'queue_enqueue_failed',
        queue: queueConfig.name,
        job_type: jobType,
        conversion_id: conversion.id,
        reason: error.message,
      }),
    );
  }
}
import { getClickByClickId } from '../tracking/clicks.service.js';
import {
  createPostbackLog,
  updatePostbackLogResult,
} from '../../models/postback-logs.model.js';

export const CONVERSION_STATUSES = ['approved', 'rejected'];

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

function ensureOfferExists(offer, { offerId, clickId }) {
  if (offer) {
    return offer;
  }

  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер для клика не найден', {
    offerId,
    clickId,
  });
}

function assertTokenMatches({ provided, actual, offerId, clickId }) {
  if (typeof actual !== 'string' || !actual.length) {
    throw new ApiError(ERROR_CODES.INTERNAL_ERROR, 500, 'У оффера отсутствует token', {
      offerId,
    });
  }

  const providedBuffer = Buffer.from(provided);
  const actualBuffer = Buffer.from(actual);

  if (
    providedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, actualBuffer)
  ) {
    throw new ApiError(
      ERROR_CODES.INVALID_POSTBACK_TOKEN,
      403,
      'Некорректный postback token',
      {
        offerId,
        clickId,
      },
    );
  }
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

function resolveStatusForError(code) {
  if (code === ERROR_CODES.DUPLICATE_CONVERSION) {
    return 'duplicate';
  }

  if (
    code === ERROR_CODES.INVALID_POSTBACK_TOKEN ||
    code === ERROR_CODES.NOT_FOUND ||
    code === ERROR_CODES.VALIDATION_ERROR ||
    code === ERROR_CODES.UNAUTHORIZED
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
}) {
  const logEntry = await createPostbackLifecycleLog({
    requestId,
    clickId,
    payload,
  });

  await updatePostbackLifecycleLog(logEntry, {
    status: 'rejected',
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    clickId: clickId ?? null,
  });
}

export async function registerConversion(
  { token, clickId, signature, status = 'approved', payoutRub, goalId = null },
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
  };

  try {
    assertToken(token);
    assertClickId(clickId);

    const click = await getClickByClickId(clickId);
    logContext.offerId = click.offerId;
    logContext.affiliateId = click.affiliateId;
    await updatePostbackLifecycleLog(postbackLog, {
      offerId: logContext.offerId,
      affiliateId: logContext.affiliateId,
    });

    const offer = ensureOfferExists(await findOfferForPostback(click.offerId), {
      offerId: click.offerId,
      clickId,
    });

    assertTokenMatches({
      provided: token,
      actual: offer.postbackToken,
      offerId: offer.id,
      clickId,
    });

    verifySignature({
      signature,
      secret: offer.postbackToken,
      clickId,
      status,
      payoutRub,
    });

    const existing = await findByClickId(clickId);

    if (existing) {
      logContext.offerId = existing.offerId ?? logContext.offerId;
      logContext.affiliateId = existing.affiliateId ?? logContext.affiliateId;
      logContext.resolvedGoalId = existing.goalId ?? logContext.resolvedGoalId;

      await updatePostbackLifecycleLog(postbackLog, {
        status: 'duplicate',
        errorCode: ERROR_CODES.DUPLICATE_CONVERSION,
        offerId: logContext.offerId,
        affiliateId: logContext.affiliateId,
        clickId,
        resolvedGoalId: existing.goalId ?? null,
        resolvedGoalName: existing.goalName ?? null,
        goalError: null,
      });

      throw new ApiError(
        ERROR_CODES.DUPLICATE_CONVERSION,
        409,
        'Конверсия уже существует',
        {
          clickId,
          offerId: existing.offerId,
          affiliateId: existing.affiliateId,
          conversionId: existing.id,
        },
      );
    }

    const goalSnapshot = await resolveOfferGoalForPostback({
      offerId: click.offerId,
      goalId,
    });
    logContext.resolvedGoalId = goalSnapshot.id ?? logContext.resolvedGoalId;

    await updatePostbackLifecycleLog(postbackLog, {
      offerId: logContext.offerId,
      affiliateId: logContext.affiliateId,
      resolvedGoalId: goalSnapshot.id ?? null,
      resolvedGoalName: goalSnapshot.name ?? null,
      goalError: null,
    });

    const payoutAmount = goalSnapshot.payout ?? 0;
    const revenueAmount = goalSnapshot.revenue ?? 0;
    const resolvedPayout = status === 'rejected' ? 0 : payoutAmount;

    try {
      const conversion = await createConversion({
        clickId,
        offerId: click.offerId,
        affiliateId: click.affiliateId,
        status,
        payoutRub: resolvedPayout,
        goalId: goalSnapshot.id ?? null,
        goalName: goalSnapshot.name ?? null,
        goalType: goalSnapshot.type ?? null,
        revenueAmount,
        payoutAmount,
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

      return conversion;
    } catch (error) {
      if (error?.code === '23505') {
        await updatePostbackLifecycleLog(postbackLog, {
          status: 'duplicate',
          errorCode: ERROR_CODES.DUPLICATE_CONVERSION,
          offerId: logContext.offerId,
          affiliateId: logContext.affiliateId,
          clickId,
          resolvedGoalId: logContext.resolvedGoalId ?? null,
          resolvedGoalName: goalSnapshot?.name ?? null,
          goalError: null,
        });

        throw new ApiError(
          ERROR_CODES.DUPLICATE_CONVERSION,
          409,
          'Конверсия уже существует',
          {
            clickId,
            offerId: click.offerId,
            affiliateId: click.affiliateId,
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
      }

      if (error.details?.goalError) {
        patch.goalError = error.details.goalError;
      }

      await updatePostbackLifecycleLog(postbackLog, patch);
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

      await updatePostbackLifecycleLog(postbackLog, patch);
    }

    throw error;
  }
}
