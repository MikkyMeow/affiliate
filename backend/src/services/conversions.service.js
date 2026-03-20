import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import { findConversionById, updateConversionStatus as updateModelStatus } from '../models/conversions.model.js';
import { upsertConversionRollup } from '../models/daily-stats.model.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { writeAuditEvent } from './audit.service.js';

function normalizeDateForRollup(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
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

export async function updateConversionStatus({
  conversionId,
  status,
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

  const existing = await findConversionById(conversionId);

  if (!existing) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Конверсия не найдена', {
      conversionId,
    });
  }

  if (existing.status === status) {
    return existing;
  }

  const updated = await updateModelStatus({
    id: conversionId,
    status,
  });

  const rollupDate = normalizeDateForRollup(updated?.createdAt);

  if (rollupDate) {
    await upsertConversionRollup({ startDate: rollupDate, endDate: rollupDate });
  }

  if (updated) {
    const { actorUserId, actorRole } = resolveActorMeta(actor);
    await writeAuditEvent({
      entityType: 'conversion',
      entityId: updated.id,
      action: 'status_changed',
      actorUserId,
      actorRole,
      requestId,
      context: {
        oldStatus: existing.status,
        newStatus: updated.status,
        offerId: updated.offerId,
        affiliateId: updated.affiliateId,
        goalId: updated.goalId ?? null,
        payoutAmount: updated.payoutAmount ?? null,
        revenueAmount: updated.revenueAmount ?? null,
      },
    });
  }

  return updated;
}
