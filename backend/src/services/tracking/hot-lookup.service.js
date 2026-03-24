import { redisClient } from '../../lib/redis.js';
import { findOfferById } from '../../models/offers.model.js';
import { findAffiliateById } from '../../models/affiliateModel.js';
import {
  trackingCacheHitsCounter,
  trackingCacheMissesCounter,
} from '../../lib/metrics.js';

const DEFAULT_CACHE_TTL_SECONDS = 120;

function resolveCacheTtl(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_CACHE_TTL_SECONDS;
}

const ENTITY_CONFIG = {
  offer: {
    prefix: 'offer:',
    ttl: resolveCacheTtl(process.env.OFFER_CACHE_TTL),
    fetchById: findOfferById,
    project: (offer) => ({
      id: offer.id,
      status: offer.status,
      targetUrl: offer.targetUrl,
      targetingStrict: Boolean(offer.targetingStrict),
      fallbackUrl: offer.fallbackUrl ?? null,
      allowDuplicateClicks: Boolean(
        offer.allowDuplicateClicks ?? true,
      ),
      duplicateClickWindowSeconds: (() => {
        const raw = offer.duplicateClickWindowSeconds;
        if (raw === null || raw === undefined) {
          return null;
        }

        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
    }),
    warning:
      '⚠️ Offer lookup cache disabled because Redis is unavailable.',
  },
  affiliate: {
    prefix: 'affiliate:',
    ttl: resolveCacheTtl(
      process.env.AFFILIATE_CACHE_TTL ?? process.env.OFFER_CACHE_TTL,
    ),
    fetchById: findAffiliateById,
    project: (affiliate) => ({
      id: affiliate.id,
      status: affiliate.status,
    }),
    warning:
      '⚠️ Affiliate lookup cache disabled because Redis is unavailable.',
  },
};

const loggedCacheIssues = {
  offer: false,
  affiliate: false,
};

function canUseCache() {
  return Boolean(redisClient?.isOpen && redisClient?.isReady);
}

function logCacheIssue(entityType, error) {
  if (loggedCacheIssues[entityType]) {
    return;
  }

  const suffix = error ? ` Reason: ${error.message}` : '';
  console.warn(`${ENTITY_CONFIG[entityType].warning}${suffix}`);
  loggedCacheIssues[entityType] = true;
}

function getCacheKey(entityType, id) {
  return `${ENTITY_CONFIG[entityType].prefix}${id}`;
}

async function readFromCache(entityType, id) {
  if (!canUseCache()) {
    return null;
  }

  try {
    const raw = await redisClient.get(getCacheKey(entityType, id));
    if (!raw) {
      trackingCacheMissesCounter.inc({ entity: entityType });
      return null;
    }

    trackingCacheHitsCounter.inc({ entity: entityType });
    return JSON.parse(raw);
  } catch (error) {
    logCacheIssue(entityType, error);
    return null;
  }
}

async function writeToCache(entityType, entity) {
  if (!canUseCache()) {
    return;
  }

  if (!entity?.id) {
    return;
  }

  try {
    const key = getCacheKey(entityType, entity.id);
    await redisClient.setEx(
      key,
      ENTITY_CONFIG[entityType].ttl,
      JSON.stringify(entity),
    );
  } catch (error) {
    logCacheIssue(entityType, error);
  }
}

async function getEntityWithCache(entityType, id) {
  if (!id) {
    return null;
  }

  let entity = await readFromCache(entityType, id);

  if (entity) {
    return entity;
  }

  const config = ENTITY_CONFIG[entityType];
  const result = await config.fetchById(id);

  if (!result) {
    return null;
  }

  entity = config.project(result);
  await writeToCache(entityType, entity);
  return entity;
}

export function getOfferForTracking(offerId) {
  return getEntityWithCache('offer', offerId);
}

export function getAffiliateForTracking(affiliateId) {
  return getEntityWithCache('affiliate', affiliateId);
}
