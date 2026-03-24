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
import {
  clickRateLimiter,
  postbackRateLimiter,
} from '../middleware/rateLimit.js';
import {
  trackingClickRequestsCounter,
  trackingClickErrorsCounter,
  trackingPostbackRequestsCounter,
  trackingPostbackErrorsCounter,
  trackingPostbackDuplicatesCounter,
  geoRedirectFallbackCounter,
} from '../lib/metrics.js';
import { detectRequestCountry } from '../lib/detectRequestCountry.js';
import { detectDevice } from '../lib/detectDevice.js';
import { logInfo } from '../lib/structuredLogger.js';

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

router.get('/click', clickRateLimiter, async (req, res, next) => {
  const startedAt = Date.now();
  trackingClickRequestsCounter.inc();
  const userAgent = req.get('user-agent') ?? null;
  const providedDevice = extractQueryParam(req.query.device);
  const clickPayload = {
    offerId: extractQueryParam(req.query.offerId),
    affiliateId: extractQueryParam(req.query.affiliateId),
    ip: getClientIp(req),
    userAgent,
    device: providedDevice ?? detectDevice(userAgent),
    referer: req.get('referer') ?? null,
  };

  for (const key of SUB_PARAM_KEYS) {
    clickPayload[key] = extractQueryParam(req.query[key]);
  }

  clickPayload.countryCode = detectRequestCountry(req);

  const logClickEvent = (status, extra = {}) => {
    const logEntry = {
      event: 'track_click',
      requestId: req.id ?? null,
      offerId: clickPayload.offerId ?? null,
      affiliateId: clickPayload.affiliateId ?? null,
      clickId: extra.clickId ?? null,
      status,
      durationMs: Date.now() - startedAt,
      country: extra.countryCode ?? clickPayload.countryCode ?? null,
      targetingStrict: extra.targetingStrict ?? null,
      redirectOutcome: extra.redirectOutcome ?? null,
      redirectReason: extra.redirectReason ?? null,
      destinationType: extra.destinationType ?? null,
    };

    logInfo('track_click', logEntry);
  };

  const validationResult = validateTrackingQuery(clickPayload);

  if (!validationResult.ok) {
    trackingClickErrorsCounter.inc({ type: 'validation_error' });
    logClickEvent('validation_error');
    return res.status(400).json({
      error: validationResult.message,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const internalFallbackUrl = `${req.baseUrl}/unavailable`;
    const {
      redirectUrl,
      clickId,
      redirectOutcome,
      redirectReason,
      destinationType,
      countryCode,
      targetingStrict,
    } = await registerClick(clickPayload, {
      internalFallbackUrl,
    });

    let finalRedirectUrl = redirectUrl;

    if (destinationType === 'internal_unavailable') {
      const params = new URLSearchParams();

      if (redirectReason) {
        params.set('reason', redirectReason);
      }

      if (clickPayload.offerId) {
        params.set('offerId', clickPayload.offerId);
      }

      if (clickId) {
        params.set('clickId', clickId);
      }

      if (clickPayload.affiliateId) {
        params.set('affiliateId', clickPayload.affiliateId);
      }

      const query = params.toString();
      finalRedirectUrl = query
        ? `${internalFallbackUrl}?${query}`
        : internalFallbackUrl;
    }

    logClickEvent('redirect', {
      clickId,
      redirectOutcome,
      redirectReason,
      destinationType,
      countryCode,
      targetingStrict,
    });

    if (
      destinationType === 'fallback' ||
      destinationType === 'internal_unavailable'
    ) {
      geoRedirectFallbackCounter.inc({ destination: destinationType });
    }

    return res.redirect(302, finalRedirectUrl);
  } catch (error) {
    if (error instanceof ApiError) {
      trackingClickErrorsCounter.inc({ type: 'api_error' });
      logClickEvent('api_error');
      return res.status(error.status ?? 500).json({
        error: error.message,
        code: error.code ?? ERROR_CODES.INTERNAL_ERROR,
        details: error.details ?? null,
      });
    }

    trackingClickErrorsCounter.inc({ type: 'unexpected_error' });
    logClickEvent('error');
    return next(error);
  }
});

router.post(
  '/postback',
  postbackRateLimiter,
  asyncHandler(async (req, res) => {
    trackingPostbackRequestsCounter.inc();
    const payload = resolvePostbackPayload(req.body);
    const rawClickId = extractPostbackClickId(payload);
    const { dto, errors } = validatePostbackParams(payload);

    if (errors.length) {
      await logPostbackValidationFailure({
        requestId: req.id ?? null,
        payload,
        clickId: rawClickId,
      });
      trackingPostbackErrorsCounter.inc({ type: 'validation_error' });

      throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
        errors,
      });
    }

    try {
      const conversion = await registerConversion(dto, {
        requestId: req.id ?? null,
        payload,
      });

      return sendSuccess(res, {
        clickId: conversion.clickId,
        status: conversion.status,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        const errorType =
          error.code === ERROR_CODES.DUPLICATE_CONVERSION
            ? 'duplicate'
            : 'api_error';

        trackingPostbackErrorsCounter.inc({ type: errorType });

        if (errorType === 'duplicate') {
          trackingPostbackDuplicatesCounter.inc();
        }
      } else {
        trackingPostbackErrorsCounter.inc({ type: 'unexpected_error' });
      }

      throw error;
    }
  }),
);

const FALLBACK_REASON_MESSAGES = {
  country_denied: 'Offer is unavailable in your country.',
  not_in_allow_list: 'This offer is limited to a different region.',
  unknown_country: 'We could not determine your location for this offer.',
};

router.get('/unavailable', (req, res) => {
  const rawReason =
    typeof req.query.reason === 'string'
      ? req.query.reason
      : 'country_denied';
  const reason = /^[a-z0-9_]+$/i.test(rawReason)
    ? rawReason
    : 'country_denied';
  const message =
    FALLBACK_REASON_MESSAGES[reason] ??
    'This offer is not available for your location.';

  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Offer unavailable</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; background: #fafafa; color: #111; }
      .container { max-width: 480px; margin: 0 auto; }
      h1 { font-size: 1.5rem; margin-bottom: 1rem; }
      p { line-height: 1.4; }
      small { color: #555; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Offer unavailable</h1>
      <p>${message}</p>
      <small>Reason code: ${reason}</small>
    </div>
  </body>
</html>`);
});

export default router;
