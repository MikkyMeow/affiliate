import { redisClient } from '../../lib/redis.js';
import {
  trackingCacheInvalidationsCounter,
  trackingCacheInvalidationFailuresCounter,
} from '../../lib/metrics.js';

const OFFER_CACHE_PREFIX = 'offer:';
const AFFILIATE_CACHE_PREFIX = 'affiliate:';

function canUseCache() {
  return Boolean(redisClient?.isOpen && redisClient?.isReady);
}

function logCacheInvalidationIssue(entityType, reason) {
  const suffix = reason ? ` Reason: ${reason}` : '';
  console.warn(`⚠️ Failed to invalidate ${entityType} cache.${suffix}`);
  trackingCacheInvalidationFailuresCounter.inc({ entity: entityType });
}

async function invalidateEntityCache(entityType, prefix, id) {
  if (!id) {
    return;
  }

  if (!canUseCache()) {
    logCacheInvalidationIssue(entityType, 'Redis connection is not ready');
    return;
  }

  try {
    await redisClient.del(`${prefix}${id}`);
    trackingCacheInvalidationsCounter.inc({ entity: entityType });
  } catch (error) {
    logCacheInvalidationIssue(entityType, error.message);
  }
}

export function invalidateOfferCache(offerId) {
  return invalidateEntityCache('offer', OFFER_CACHE_PREFIX, offerId);
}

export function invalidateAffiliateCache(affiliateId) {
  return invalidateEntityCache('affiliate', AFFILIATE_CACHE_PREFIX, affiliateId);
}
