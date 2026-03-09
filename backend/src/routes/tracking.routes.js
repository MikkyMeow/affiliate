import express from 'express';
import { registerClick } from '../services/tracking/clicks.service.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { validatePostbackParams } from '../validators/postback.js';
import {
  SUB_PARAM_KEYS,
  validateTrackingQuery,
} from '../validators/tracking.js';
import {
  registerConversion,
  logPostbackValidationFailure,
} from '../services/postback/conversions.service.js';
import { getClientIp } from '../lib/getClientIp.js';

const router = express.Router();

function extractQueryParam(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const singleValue = Array.isArray(value) ? value[0] : value;
  const stringValue = String(singleValue).trim();

  return stringValue === '' ? undefined : stringValue;
}

function resolvePostbackPayload(body) {
  if (body && typeof body === 'object') {
    return body;
  }

  if (body === undefined) {
    return {};
  }

  return { raw: body };
}

function extractPostbackClickId(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (typeof payload.clickId === 'string') {
    return payload.clickId;
  }

  if (typeof payload.click_id === 'string') {
    return payload.click_id;
  }

  return null;
}

router.get('/click', async (req, res, next) => {
  const startedAt = Date.now();
  const clickPayload = {
    offerId: extractQueryParam(req.query.offerId),
    affiliateId: extractQueryParam(req.query.affiliateId),
    ip: getClientIp(req),
    userAgent: req.get('user-agent') ?? null,
    referer: req.get('referer') ?? null,
  };

  for (const key of SUB_PARAM_KEYS) {
    clickPayload[key] = extractQueryParam(req.query[key]);
  }

  const logClickEvent = (status, extra = {}) => {
    const logEntry = {
      event: 'track_click',
      request_id: req.id ?? null,
      offerId: clickPayload.offerId ?? null,
      affiliateId: clickPayload.affiliateId ?? null,
      clickId: extra.clickId ?? null,
      status,
      duration_ms: Date.now() - startedAt,
    };

    console.log(JSON.stringify(logEntry));
  };

  const validationResult = validateTrackingQuery(clickPayload);

  if (!validationResult.ok) {
    logClickEvent('validation_error');
    return res.status(400).json({
      error: validationResult.message,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const { redirectUrl, clickId } = await registerClick(clickPayload);
    logClickEvent('redirect', { clickId });

    return res.redirect(302, redirectUrl);
  } catch (error) {
    if (error instanceof ApiError) {
      logClickEvent('api_error');
      return res.status(error.status ?? 500).json({
        error: error.message,
        code: error.code ?? ERROR_CODES.INTERNAL_ERROR,
        details: error.details ?? null,
      });
    }

    logClickEvent('error');
    return next(error);
  }
});

router.post(
  '/postback',
  asyncHandler(async (req, res) => {
    const payload = resolvePostbackPayload(req.body);
    const rawClickId = extractPostbackClickId(payload);
    const { dto, errors } = validatePostbackParams(payload);

    if (errors.length) {
      await logPostbackValidationFailure({
        requestId: req.id ?? null,
        payload,
        clickId: rawClickId,
      });

      throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
        errors,
      });
    }

    const conversion = await registerConversion(dto, {
      requestId: req.id ?? null,
      payload,
    });

    return sendSuccess(res, {
      clickId: conversion.clickId,
      status: conversion.status,
    });
  }),
);

export default router;
