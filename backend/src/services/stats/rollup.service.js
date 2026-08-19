import pool from '../../db.js';
import {
  clearDailyStatsRange,
  getDailyStatsTotals,
  upsertConversionRollup,
  upsertClickRollup,
} from '../../models/daily-stats.model.js';
import { findConversionById } from '../../models/conversions.model.js';
import { findByClickId } from '../../models/clicks.model.js';
import { logAuditError, writeAuditEvent } from '../audit.service.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import {
  formatDateInTimeZone,
  getDefaultTimeZone,
  resolveTimeZone,
} from '../../lib/timezone.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultRollupDate() {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - 1);
  return formatDate(now);
}

function normalizeDateInput(value, field) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!DATE_REGEX.test(trimmed)) {
      throw new Error(`${field} must be in YYYY-MM-DD format`);
    }

    return trimmed;
  }

  throw new Error(`${field} must be a Date or YYYY-MM-DD string`);
}

function resolveDateRange({ date, startDate, endDate, dateFrom, dateTo } = {}) {
  const normalizedDate = normalizeDateInput(date, 'date');
  const normalizedStart = normalizeDateInput(
    startDate ?? dateFrom ?? normalizedDate,
    'startDate',
  );
  const normalizedEnd = normalizeDateInput(
    endDate ?? dateTo ?? normalizedDate,
    'endDate',
  );

  if (!normalizedStart && !normalizedEnd) {
    const fallback = defaultRollupDate();
    return { startDate: fallback, endDate: fallback };
  }

  if (!normalizedStart || !normalizedEnd) {
    throw new Error('Both startDate and endDate must be provided when one is set');
  }

  if (normalizedStart > normalizedEnd) {
    throw new Error('startDate cannot be after endDate');
  }

  return { startDate: normalizedStart, endDate: normalizedEnd };
}

function countDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function buildAuditEntityId({ dateFrom, dateTo, timezone }) {
  return `${timezone}:${dateFrom}:${dateTo}`;
}

export async function recalculateDailyStats(
  {
    dateFrom,
    dateTo,
    timezone,
    actor = null,
    requestId = null,
  },
  { client: providedClient = null } = {},
) {
  const { startDate, endDate } = resolveDateRange({ dateFrom, dateTo });
  const resolvedTimezone = resolveTimeZone(timezone);
  const shouldManageTransaction = !providedClient;
  const client = providedClient ?? (await pool.connect());

  try {
    if (shouldManageTransaction) {
      await client.query('BEGIN');
    }

    await clearDailyStatsRange(
      {
        startDate,
        endDate,
        timezone: resolvedTimezone,
      },
      { client },
    );

    const clickRollup = await upsertClickRollup(
      {
        startDate,
        endDate,
        timezone: resolvedTimezone,
      },
      { client },
    );
    const conversionRollup = await upsertConversionRollup(
      {
        startDate,
        endDate,
        timezone: resolvedTimezone,
      },
      { client },
    );

    const timestampResult = await client.query(
      'SELECT NOW() AS recalculated_at',
    );
    const recalculatedAt = timestampResult.rows[0]?.recalculated_at ?? new Date().toISOString();
    const daysRecalculated = countDaysInclusive(startDate, endDate);

    if (actor?.userId && actor?.role) {
      await writeAuditEvent({
        entityType: 'stats',
        entityId: buildAuditEntityId({
          dateFrom: startDate,
          dateTo: endDate,
          timezone: resolvedTimezone,
        }),
        action: 'stats.recalculated',
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId,
        client,
        metadata: {
          dateFrom: startDate,
          dateTo: endDate,
          timezone: resolvedTimezone,
          daysRecalculated,
          clicksRowsProcessed: Number(clickRollup.rowsProcessed ?? 0),
          conversionsRowsProcessed: Number(conversionRollup.rowsProcessed ?? 0),
        },
      });
    }

    if (shouldManageTransaction) {
      await client.query('COMMIT');
    }

    return {
      dateFrom: startDate,
      dateTo: endDate,
      timezone: resolvedTimezone,
      daysRecalculated,
      recalculatedAt,
      clicksRowsProcessed: Number(clickRollup.rowsProcessed ?? 0),
      conversionsRowsProcessed: Number(conversionRollup.rowsProcessed ?? 0),
      rowsProcessed:
        Number(clickRollup.rowsProcessed ?? 0) +
        Number(conversionRollup.rowsProcessed ?? 0),
    };
  } catch (error) {
    if (shouldManageTransaction) {
      await client.query('ROLLBACK');
    }
    if (actor?.userId && actor?.role) {
      await logAuditError({
        entityType: 'stats',
        entityId: buildAuditEntityId({
          dateFrom: startDate,
          dateTo: endDate,
          timezone: resolvedTimezone,
        }),
        action: 'stats.recalculate_failed',
        actorUserId: actor.userId,
        actorRole: actor.role,
        requestId,
        metadata: {
          dateFrom: startDate,
          dateTo: endDate,
          timezone: resolvedTimezone,
        },
        error,
      });
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      'Не удалось пересчитать статистику',
    );
  } finally {
    if (shouldManageTransaction) {
      client.release();
    }
  }
}

export async function runDailyStatsRollup(params = {}) {
  const { startDate, endDate } = resolveDateRange(params);
  const timezone = resolveTimeZone(params.timezone);
  const result = await recalculateDailyStats({
    dateFrom: startDate,
    dateTo: endDate,
    timezone,
  });

  return {
    startDate: result.dateFrom,
    endDate: result.dateTo,
    timezone: result.timezone,
    rowsProcessed: result.rowsProcessed,
    conversionsRowsProcessed: result.conversionsRowsProcessed,
    clicksRowsProcessed: result.clicksRowsProcessed,
    recalculatedAt: result.recalculatedAt,
  };
}

export async function getAggregatedSummary(filter = {}) {
  return getDailyStatsTotals(filter);
}

export async function updateConversionRollup(conversionId) {
  if (!conversionId) {
    throw new Error('conversionId is required for rollup update');
  }

  const conversion = await findConversionById(conversionId);

  if (!conversion) {
    throw new Error(`Conversion ${conversionId} not found`);
  }

  const timezone = getDefaultTimeZone();
  const rollupDate = formatDateInTimeZone(conversion.createdAt, timezone);

  await upsertConversionRollup({
    startDate: rollupDate,
    endDate: rollupDate,
    timezone,
  });

  return {
    conversionId,
    date: rollupDate,
    timezone,
    offerId: conversion.offerId,
    affiliateId: conversion.affiliateId,
    status: conversion.status,
  };
}

function normalizeClickJobPayload(click) {
  if (!click) {
    return null;
  }

  const normalized = {
    clickId: click.clickId ?? click.id ?? null,
    offerId: click.offerId ?? null,
    affiliateId: click.affiliateId ?? null,
    createdAt: click.createdAt ?? null,
  };

  if (
    !normalized.clickId ||
    !normalized.offerId ||
    !normalized.affiliateId ||
    !normalized.createdAt
  ) {
    return null;
  }

  return normalized;
}

export async function updateClickRollup(input) {
  const normalizedInput = normalizeClickJobPayload(
    typeof input === 'object' ? input : { clickId: input },
  );

  const clickId =
    normalizedInput?.clickId ??
    (typeof input === 'string' ? input : input?.clickId);

  if (!clickId) {
    throw new Error('clickId is required for rollup update');
  }

  let click = normalizedInput;

  if (!click) {
    const clickFromDb = await findByClickId(clickId);

    if (!clickFromDb) {
      throw new Error(`Click ${clickId} not found`);
    }

    click = {
      clickId: clickFromDb.clickId,
      offerId: clickFromDb.offerId,
      affiliateId: clickFromDb.affiliateId,
      createdAt: clickFromDb.createdAt,
    };
  }

  const timezone = getDefaultTimeZone();
  const rollupDate = formatDateInTimeZone(click.createdAt, timezone);

  await upsertClickRollup({
    startDate: rollupDate,
    endDate: rollupDate,
    timezone,
  });

  return {
    clickId: click.clickId ?? clickId,
    date: rollupDate,
    timezone,
    offerId: click.offerId,
    affiliateId: click.affiliateId,
  };
}

export { countDaysInclusive, resolveDateRange };
