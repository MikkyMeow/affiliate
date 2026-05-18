import pool from '../db.js';
import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import {
  findAdminConversionById,
  findConversionById,
  serializeConversionRecord,
  updateConversionStatus as updateModelStatus,
} from '../models/conversions.model.js';
import {
  insertConversionStatusHistory,
  listConversionStatusHistory,
} from '../models/conversionStatusHistory.model.js';
import { upsertConversionRollup } from '../models/daily-stats.model.js';
import { formatDateInTimeZone, getDefaultTimeZone } from '../lib/timezone.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { writeAuditEvent } from './audit.service.js';

function normalizeDateForRollup(value) {
  if (!value) {
    return null;
  }

  try {
    return formatDateInTimeZone(value, getDefaultTimeZone());
  } catch {
    return null;
  }
}

function resolveActorMeta(actor) {
  if (!actor) {
    return { actorUserId: null, actorRole: null };
  }

  return {
    actorUserId: actor.userId ?? null,
    actorRole: actor.role ?? null,
  };
}

function normalizeReason(reason) {
  if (reason === undefined || reason === null) {
    return null;
  }

  if (typeof reason !== 'string') {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'reason должен быть строкой',
    );
  }

  const normalized = reason.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildStatusChangeMetadata(conversion) {
  return {
    source: conversion.source ?? 'tracking',
    isTest: Boolean(conversion.isTest),
    manualAdjustmentBatchId: conversion.manualAdjustmentBatchId ?? null,
    offerId: conversion.offerId,
    affiliateId: conversion.affiliateId,
    goalId: conversion.goalId ?? null,
  };
}

function serializeHistoryEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    fromStatus: entry.fromStatus ?? null,
    toStatus: entry.toStatus,
    reason: entry.reason ?? null,
    changedAt: entry.changedAt,
    metadata: entry.metadata ?? null,
  };
}

export async function updateConversionStatus({
  conversionId,
  status,
  reason = null,
  actor = null,
  requestId = null,
}) {
  if (!conversionId) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'conversionId обязателен');
  }

  if (!CONVERSION_STATUS_VALUES.includes(status)) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Недопустимый статус', {
      status,
      allowed: CONVERSION_STATUS_VALUES,
    });
  }

  const normalizedReason = normalizeReason(reason);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await findConversionById(conversionId, {
      client,
      forUpdate: true,
    });

    if (!existing) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Конверсия не найдена', {
        conversionId,
      });
    }

    if (existing.status === status) {
      const conversion = await findAdminConversionById(conversionId, { client });
      await client.query('COMMIT');
      return {
        conversion: conversion ?? serializeConversionRecord(existing),
        historyEntry: null,
      };
    }

    const updated = await updateModelStatus(
      {
        id: conversionId,
        status,
      },
      { client },
    );

    const metadata = buildStatusChangeMetadata(updated);
    const historyEntry = await insertConversionStatusHistory(
      {
        conversionId: updated.id,
        fromStatus: existing.status,
        toStatus: updated.status,
        reason: normalizedReason,
        changedBy: actor?.userId ?? null,
        metadata,
      },
      { client },
    );

    const { actorUserId, actorRole } = resolveActorMeta(actor);
    await writeAuditEvent({
      entityType: 'conversion',
      entityId: updated.id,
      action: 'conversion.status_changed',
      actorUserId,
      actorRole,
      requestId,
      context: {
        oldValue: existing.status,
        newValue: updated.status,
        reason: normalizedReason,
        metadata,
      },
      client,
    });

    const rollupDate = normalizeDateForRollup(updated?.createdAt);
    if (rollupDate) {
      await upsertConversionRollup(
        {
          startDate: rollupDate,
          endDate: rollupDate,
          timezone: getDefaultTimeZone(),
        },
        { client },
      );
    }

    const conversion = await findAdminConversionById(updated.id, { client });

    await client.query('COMMIT');

    return {
      conversion: conversion ?? serializeConversionRecord(updated),
      historyEntry: serializeHistoryEntry(historyEntry),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getConversionStatusHistory(conversionId) {
  if (!conversionId) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'conversionId обязателен');
  }

  const conversion = await findConversionById(conversionId);

  if (!conversion) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Конверсия не найдена', {
      conversionId,
    });
  }

  return listConversionStatusHistory(conversionId);
}
