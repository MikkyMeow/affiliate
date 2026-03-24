import pool from '../../db.js';
import { createClick, findByClickId } from '../../models/clicks.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { generateClickId } from '../../lib/generateClickId.js';
import { buildRedirectUrl } from '../../lib/buildRedirectUrl.js';
import {
  getAffiliateForTracking,
  getOfferForTracking,
} from './hot-lookup.service.js';
import { dispatchAsyncJob } from '../async-jobs.service.js';
import { ASYNC_JOB_NAMES, queueConfig } from '../../queue/index.js';
import { queueJobEnqueueFailedCounter } from '../../lib/metrics.js';
import { getOfferGeoRuleSets } from '../../models/offerGeoRules.model.js';
import {
  resolveOfferGeoAccess,
  GEO_DENY_REASONS,
} from '../../lib/resolveOfferGeoAccess.js';
import { normalizeCountryCode } from '../../lib/detectRequestCountry.js';
import { logError } from '../../lib/structuredLogger.js';
import { insertDedupEntry } from '../../models/clickDedupRegistry.model.js';
import { buildClickDedupFingerprint } from '../../lib/buildClickDedupFingerprint.js';
import {
  isDuplicateClickProtectionEnabled,
  resolveDuplicateClick,
} from './click-dedup.service.js';

const DESTINATION_TYPES = {
  TARGET: 'target',
  FALLBACK: 'fallback',
  INTERNAL: 'internal_unavailable',
};

const REDIRECT_OUTCOMES = {
  TARGET: 'allowed_target_redirect',
  FALLBACK: 'fallback_redirect',
  INTERNAL: 'internal_unavailable_redirect',
};

const DEFAULT_INTERNAL_FALLBACK_URL =
  process.env.TRACKING_INTERNAL_FALLBACK_URL?.trim() || '/track/unavailable';

function assertTrackingInput({ offerId, affiliateId }) {
  if (!offerId || typeof offerId !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'offerId обязателен');
  }

  if (!affiliateId || typeof affiliateId !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'affiliateId обязателен');
  }
}

export async function getClickByClickId(clickId) {
  if (!clickId) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'clickId обязателен');
  }

  const click = await findByClickId(clickId);

  if (!click) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Клик не найден', { clickId });
  }

  return click;
}

async function findActiveOffer(offerId) {
  const offer = await getOfferForTracking(offerId);

  if (!offer) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', { offerId });
  }

  if (offer.status !== 'active') {
    throw new ApiError(ERROR_CODES.CONFLICT, 409, 'Оффер не активен', {
      offerId,
      status: offer.status,
    });
  }

  return offer;
}

async function findActiveAffiliate(affiliateId) {
  const affiliate = await getAffiliateForTracking(affiliateId);

  if (!affiliate) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Партнёр не найден', {
      affiliateId,
    });
  }

  if (affiliate.status !== 'active') {
    throw new ApiError(ERROR_CODES.CONFLICT, 409, 'Партнёр не активен', {
      affiliateId,
      status: affiliate.status,
    });
  }

  return affiliate;
}

function sanitizeUrlCandidate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveRedirectDecision({
  offer,
  targetRedirectUrl,
  geoAccess,
  internalFallbackUrl,
}) {
  const strict = Boolean(offer?.targetingStrict);

  if (!strict || geoAccess.isAllowed) {
    return {
      redirectUrl: targetRedirectUrl,
      destinationType: DESTINATION_TYPES.TARGET,
      outcome: REDIRECT_OUTCOMES.TARGET,
      reason: null,
    };
  }

  const denyReason = geoAccess.denyReason ?? GEO_DENY_REASONS.UNKNOWN_COUNTRY;
  const fallbackUrl = sanitizeUrlCandidate(offer?.fallbackUrl);

  if (fallbackUrl) {
    return {
      redirectUrl: fallbackUrl,
      destinationType: DESTINATION_TYPES.FALLBACK,
      outcome: REDIRECT_OUTCOMES.FALLBACK,
      reason: denyReason,
    };
  }

  const resolvedInternalFallback =
    sanitizeUrlCandidate(internalFallbackUrl) ?? DEFAULT_INTERNAL_FALLBACK_URL;

  return {
    redirectUrl: resolvedInternalFallback,
    destinationType: DESTINATION_TYPES.INTERNAL,
    outcome: REDIRECT_OUTCOMES.INTERNAL,
    reason: denyReason,
  };
}

export async function prepareClick(input, options = {}) {
  assertTrackingInput(input);

  const [offer, affiliate, geoRuleSets] = await Promise.all([
    findActiveOffer(input.offerId),
    findActiveAffiliate(input.affiliateId),
    getOfferGeoRuleSets(input.offerId),
  ]);

  const clickId = input.clickId ?? generateClickId();
  let redirectUrl;
  const normalizedCountry = normalizeCountryCode(input.countryCode ?? null);

  try {
    redirectUrl = buildRedirectUrl(offer.targetUrl, clickId);
  } catch (error) {
    throw new ApiError(ERROR_CODES.INTERNAL_ERROR, 500, 'Не удалось собрать redirectUrl', {
      offerId: offer.id,
      reason: error.message,
    });
  }

  const geoAccess = resolveOfferGeoAccess({
    targetingStrict: Boolean(offer.targetingStrict),
    countryCode: normalizedCountry ?? null,
    allowCountries: geoRuleSets.allowCountries,
    denyCountries: geoRuleSets.denyCountries,
  });

  const redirectMeta = resolveRedirectDecision({
    offer,
    targetRedirectUrl: redirectUrl,
    geoAccess,
    internalFallbackUrl: options.internalFallbackUrl,
  });

  return {
    offer,
    clickId,
    offerId: offer.id,
    affiliateId: affiliate.id,
    redirectUrl: redirectMeta.redirectUrl,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    device: input.device ?? null,
    referer: input.referer ?? null,
    sub1: input.sub1 ?? null,
    sub2: input.sub2 ?? null,
    sub3: input.sub3 ?? null,
    sub4: input.sub4 ?? null,
    sub5: input.sub5 ?? null,
    countryCode: normalizedCountry ?? null,
    targetingStrict: Boolean(offer.targetingStrict),
    redirectOutcome: redirectMeta.outcome,
    redirectReason: redirectMeta.reason,
    destinationType: redirectMeta.destinationType,
  };
}

async function publishClickCreatedJob(click) {
  if (!click) {
    return;
  }

  const jobType = 'click_created';
  const payload = {
    type: jobType,
    clickId: click.clickId,
    offerId: click.offerId,
    affiliateId: click.affiliateId,
    createdAt:
      click.createdAt instanceof Date ? click.createdAt.toISOString() : click.createdAt ?? null,
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
      clickId: click.clickId,
      reason: error.message,
    });
  }
}

export async function registerClick(input, options = {}) {
  const prepared = await prepareClick(input, options);
  const { redirectUrl: preparedRedirectUrl, offer, ...clickPayload } = prepared;
  const dedupeFingerprint = buildClickDedupFingerprint({
    offerId: clickPayload.offerId,
    affiliateId: clickPayload.affiliateId,
    ip: clickPayload.ip,
    userAgent: clickPayload.userAgent,
    device: clickPayload.device,
    referer: clickPayload.referer,
    sub1: clickPayload.sub1,
    sub2: clickPayload.sub2,
    sub3: clickPayload.sub3,
    sub4: clickPayload.sub4,
    sub5: clickPayload.sub5,
  });

  const dedupProtectionEnabled = isDuplicateClickProtectionEnabled(offer);
  let savedClick = null;
  let deduplicated = false;
  let canonicalClick = null;

  const baseInsertPayload = {
    ...clickPayload,
    dedupeFingerprint,
    canonicalClickId: clickPayload.clickId,
    isDuplicate: false,
    duplicateOfClickId: null,
  };

  if (!dedupProtectionEnabled) {
    try {
      savedClick = await createClick(baseInsertPayload);
      canonicalClick = savedClick;
    } catch (error) {
      if (error?.code === '23505') {
        throw new ApiError(ERROR_CODES.CONFLICT, 409, 'click_id уже используется', {
          clickId: clickPayload.clickId,
        });
      }

      throw error;
    }
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const resolution = await resolveDuplicateClick(
        {
          offer,
          offerId: clickPayload.offerId,
          affiliateId: clickPayload.affiliateId,
          ip: clickPayload.ip,
          userAgent: clickPayload.userAgent,
          device: clickPayload.device,
          referer: clickPayload.referer,
          sub1: clickPayload.sub1,
          sub2: clickPayload.sub2,
          sub3: clickPayload.sub3,
          sub4: clickPayload.sub4,
          sub5: clickPayload.sub5,
          fingerprint: dedupeFingerprint,
        },
        { client },
      );

      if (resolution.reused) {
        deduplicated = true;
        canonicalClick = await findByClickId(resolution.clickId, { client });

        if (!canonicalClick) {
          throw new ApiError(
            ERROR_CODES.INTERNAL_ERROR,
            500,
            'Канонический клик для повторного запроса не найден',
            { clickId: resolution.clickId },
          );
        }

        const canonicalId = canonicalClick.canonicalClickId ?? canonicalClick.clickId;

        const duplicatePayload = {
          ...baseInsertPayload,
          canonicalClickId: canonicalId,
          isDuplicate: true,
          duplicateOfClickId: canonicalId,
          redirectOutcome: canonicalClick.redirectOutcome,
          redirectReason: canonicalClick.redirectReason,
          destinationType: canonicalClick.destinationType,
          countryCode: canonicalClick.countryCode,
          targetingStrict: canonicalClick.targetingStrict,
        };

        savedClick = await createClick(duplicatePayload, { client });
      } else {
        savedClick = await createClick(baseInsertPayload, { client });
        canonicalClick = savedClick;
        await insertDedupEntry(
          {
            fingerprint: resolution.dedupeFingerprint,
            offerId: savedClick.offerId,
            affiliateId: savedClick.affiliateId,
            clickId: savedClick.clickId,
            expiresAt: resolution.expiresAt,
          },
          { client },
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error?.code === '23505') {
        throw new ApiError(ERROR_CODES.CONFLICT, 409, 'click_id уже используется', {
          clickId: clickPayload.clickId,
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  if (!savedClick || (!canonicalClick && deduplicated)) {
    throw new ApiError(
      ERROR_CODES.INTERNAL_ERROR,
      500,
      'Не удалось обработать клик',
    );
  }

  if (savedClick && !savedClick.isDuplicate) {
    await publishClickCreatedJob(savedClick);
  }

  const responseClick = deduplicated ? canonicalClick : savedClick;
  let redirectUrl = preparedRedirectUrl;

  if (deduplicated) {
    if (responseClick.destinationType === DESTINATION_TYPES.TARGET) {
      redirectUrl = buildRedirectUrl(offer.targetUrl, responseClick.clickId);
    } else if (responseClick.destinationType === DESTINATION_TYPES.FALLBACK) {
      redirectUrl = sanitizeUrlCandidate(offer.fallbackUrl) ?? preparedRedirectUrl;
    }
  }

  return {
    redirectUrl,
    clickId: responseClick.clickId,
    redirectOutcome: responseClick.redirectOutcome,
    redirectReason: responseClick.redirectReason,
    destinationType: responseClick.destinationType,
    countryCode: responseClick.countryCode,
    targetingStrict: responseClick.targetingStrict,
    deduplicated,
  };
}
