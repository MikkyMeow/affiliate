import {
  upsertConversionRollup,
  upsertClickRollup,
  getDailyStatsTotals,
  incrementConversionRollup,
  incrementClickRollup,
} from '../../models/daily-stats.model.js';
import { findConversionById } from '../../models/conversions.model.js';
import { findByClickId } from '../../models/clicks.model.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date) {
  const iso = date.toISOString();
  return iso.slice(0, 10);
}

function defaultRollupDate() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - 1);
  return formatDate(now);
}

function normalizeDateInput(value, field) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
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

function resolveDateRange({ date, startDate, endDate } = {}) {
  const normalizedDate = normalizeDateInput(date, 'date');
  const normalizedStart = normalizeDateInput(startDate ?? normalizedDate, 'startDate');
  const normalizedEnd = normalizeDateInput(endDate ?? normalizedDate, 'endDate');

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

export async function runDailyStatsRollup(params = {}) {
  const { startDate, endDate } = resolveDateRange(params);

  const [conversionRollup, clickRollup] = await Promise.all([
    upsertConversionRollup({ startDate, endDate }),
    upsertClickRollup({ startDate, endDate }),
  ]);

  return {
    startDate,
    endDate,
    rowsProcessed:
      Number(conversionRollup.rowsProcessed ?? 0) + Number(clickRollup.rowsProcessed ?? 0),
    conversionsRowsProcessed: Number(conversionRollup.rowsProcessed ?? 0),
    clicksRowsProcessed: Number(clickRollup.rowsProcessed ?? 0),
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

  await incrementConversionRollup({
    date: conversion.createdAt,
    offerId: conversion.offerId,
    affiliateId: conversion.affiliateId,
    status: conversion.status,
    payoutRub: conversion.payoutRub,
    revenueAmount: conversion.revenueAmount,
  });

  return {
    conversionId,
    date: conversion.createdAt,
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

  if (!normalized.clickId || !normalized.offerId || !normalized.affiliateId || !normalized.createdAt) {
    return null;
  }

  return normalized;
}

export async function updateClickRollup(input) {
  const normalizedInput = normalizeClickJobPayload(
    typeof input === 'object' ? input : { clickId: input },
  );

  const clickId = normalizedInput?.clickId ?? (typeof input === 'string' ? input : input?.clickId);

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

  await incrementClickRollup({
    date: click.createdAt,
    offerId: click.offerId,
    affiliateId: click.affiliateId,
  });

  return {
    clickId: click.clickId ?? clickId,
    date: click.createdAt,
    offerId: click.offerId,
    affiliateId: click.affiliateId,
  };
}

export { resolveDateRange };
