import {
  upsertConversionRollup,
  getDailyStatsTotals,
  incrementConversionRollup,
} from '../../models/daily-stats.model.js';
import { findConversionById } from '../../models/conversions.model.js';

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

  const rollupResult = await upsertConversionRollup({ startDate, endDate });
  return {
    ...rollupResult,
    type: 'conversions',
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
  });

  return {
    conversionId,
    date: conversion.createdAt,
    offerId: conversion.offerId,
    affiliateId: conversion.affiliateId,
    status: conversion.status,
  };
}

export { resolveDateRange };
