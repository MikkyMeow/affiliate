import {
  LEGACY_OFFER_STATUS_INACTIVE,
  OFFER_ACCESS_TYPES,
  OFFER_STATUSES,
  OFFER_VISIBILITY_MODES,
} from '../../constants/offers.js';

export const AFFILIATE_OFFER_ACCESS_LEVELS = Object.freeze({
  NONE: 'none',
  RESTRICTED: 'restricted',
  FULL: 'full',
});

export const AFFILIATE_OFFER_DENY_REASONS = Object.freeze({
  EXCLUDED: 'excluded',
  PRIVATE: 'private',
  REJECTED: 'rejected',
  STATUS: 'status',
});

function hasActiveStatus(offer) {
  if (!offer?.status) {
    return false;
  }

  if (offer.status === OFFER_STATUSES.ACTIVE) {
    return true;
  }

  // TODO: удалить после миграции legacy-статусов.
  if (offer.status === LEGACY_OFFER_STATUS_INACTIVE) {
    return false;
  }

  return false;
}

export function resolveAffiliateOfferAccess(offer, accessRecord) {
  const result = {
    isVisible: false,
    accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.NONE,
    canRequestAccess: false,
    denyReason: null,
  };

  if (!offer || !hasActiveStatus(offer)) {
    return {
      ...result,
      denyReason: AFFILIATE_OFFER_DENY_REASONS.STATUS,
    };
  }

  const visibilityMode =
    offer.visibilityMode ?? OFFER_VISIBILITY_MODES.PUBLIC;
  const accessType = accessRecord?.accessType ?? null;

  if (accessType === OFFER_ACCESS_TYPES.EXCLUDED) {
    return {
      ...result,
      denyReason: AFFILIATE_OFFER_DENY_REASONS.EXCLUDED,
    };
  }

  if (visibilityMode === OFFER_VISIBILITY_MODES.PUBLIC) {
    if (accessType === OFFER_ACCESS_TYPES.REJECTED) {
      return {
        ...result,
        denyReason: AFFILIATE_OFFER_DENY_REASONS.REJECTED,
      };
    }

    return {
      ...result,
      isVisible: true,
      accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.FULL,
    };
  }

  if (visibilityMode === OFFER_VISIBILITY_MODES.PRIVATE) {
    if (accessType === OFFER_ACCESS_TYPES.ALLOWED) {
      return {
        ...result,
        isVisible: true,
        accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.FULL,
      };
    }

    return {
      ...result,
      denyReason: AFFILIATE_OFFER_DENY_REASONS.PRIVATE,
    };
  }

  // on_request flow.
  if (accessType === OFFER_ACCESS_TYPES.ALLOWED) {
    return {
      ...result,
      isVisible: true,
      accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.FULL,
    };
  }

  if (accessType === OFFER_ACCESS_TYPES.REJECTED) {
    return {
      ...result,
      isVisible: true,
      accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.RESTRICTED,
      canRequestAccess: false,
      // В этом релизе придерживаемся варианта A: rejected видит restricted,
      // но повторно запросить доступ нельзя.
      denyReason: AFFILIATE_OFFER_DENY_REASONS.REJECTED,
    };
  }

  return {
    ...result,
    isVisible: true,
    accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.RESTRICTED,
    canRequestAccess: true,
  };
}
