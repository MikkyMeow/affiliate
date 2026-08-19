import {
  LEGACY_OFFER_STATUS_INACTIVE,
  OFFER_ACCESS_TYPES,
  OFFER_REQUEST_STATUSES,
  OFFER_STATUSES,
  OFFER_VISIBILITY_MODES,
} from '../../constants/offers.js';

export const AFFILIATE_OFFER_ACCESS_LEVELS = Object.freeze({
  NONE: 'none',
  RESTRICTED: 'restricted',
  FULL: 'full',
});

export const AFFILIATE_OFFER_DENY_REASONS = Object.freeze({
  HIDDEN: 'hidden',
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

function normalizeVisibilityMode(offer) {
  return (
    offer?.availability ??
    offer?.visibilityMode ??
    OFFER_VISIBILITY_MODES.PUBLIC
  );
}

function normalizeRequestStatus(pendingRequest) {
  if (!pendingRequest?.status) {
    return null;
  }

  return pendingRequest.status;
}

function normalizeAccessStatus(accessRecord, pendingRequest) {
  if (accessRecord?.accessType) {
    return accessRecord.accessType;
  }

  if (pendingRequest?.status === OFFER_REQUEST_STATUSES.PENDING) {
    return OFFER_REQUEST_STATUSES.PENDING;
  }

  return 'not_requested';
}

export function resolveAffiliateOfferAccess(
  offer,
  {
    accessRecord = null,
    hiddenRecord = null,
    pendingRequest = null,
  } = {},
) {
  const result = {
    isVisible: false,
    isAccessible: false,
    isHidden: false,
    accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.NONE,
    canRequestAccess: false,
    denyReason: null,
    accessStatus: normalizeAccessStatus(accessRecord, pendingRequest),
    requestStatus: normalizeRequestStatus(pendingRequest),
  };

  if (!offer || !hasActiveStatus(offer)) {
    return {
      ...result,
      denyReason: AFFILIATE_OFFER_DENY_REASONS.STATUS,
    };
  }

  if (hiddenRecord) {
    return {
      ...result,
      isHidden: true,
      denyReason: AFFILIATE_OFFER_DENY_REASONS.HIDDEN,
    };
  }

  const visibilityMode = normalizeVisibilityMode(offer);
  const accessType = accessRecord?.accessType ?? null;
  const hasAllowedAccess = accessType === OFFER_ACCESS_TYPES.ALLOWED;
  const hasRejectedAccess = accessType === OFFER_ACCESS_TYPES.REJECTED;
  const hasExcludedAccess = accessType === OFFER_ACCESS_TYPES.EXCLUDED;
  const hasPendingRequest =
    pendingRequest?.status === OFFER_REQUEST_STATUSES.PENDING;

  if (visibilityMode === OFFER_VISIBILITY_MODES.PUBLIC) {
    return {
      ...result,
      isVisible: true,
      isAccessible: true,
      accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.FULL,
      accessStatus: hasAllowedAccess ? OFFER_ACCESS_TYPES.ALLOWED : 'allowed',
    };
  }

  if (visibilityMode === OFFER_VISIBILITY_MODES.PRIVATE) {
    if (hasAllowedAccess) {
      return {
        ...result,
        isVisible: true,
        isAccessible: true,
        accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.FULL,
      };
    }

    return {
      ...result,
      denyReason: AFFILIATE_OFFER_DENY_REASONS.PRIVATE,
    };
  }

  if (hasAllowedAccess) {
    return {
      ...result,
      isVisible: true,
      isAccessible: true,
      accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.FULL,
    };
  }

  const denyReason = hasRejectedAccess
    ? AFFILIATE_OFFER_DENY_REASONS.REJECTED
    : hasExcludedAccess
      ? AFFILIATE_OFFER_DENY_REASONS.EXCLUDED
      : null;

  return {
    ...result,
    isVisible: true,
    accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.RESTRICTED,
    canRequestAccess: !hasRejectedAccess && !hasExcludedAccess && !hasPendingRequest,
    denyReason,
  };
}

export function canPartnerSeeOffer(resolution) {
  return Boolean(resolution?.isVisible);
}

export function canPartnerAccessOffer(resolution) {
  return Boolean(
    resolution?.isVisible &&
      resolution?.accessLevel === AFFILIATE_OFFER_ACCESS_LEVELS.FULL &&
      resolution?.isAccessible,
  );
}

export function getPartnerVisibilityStateSummary(resolution) {
  if (!resolution) {
    return {
      isVisible: false,
      isAccessible: false,
      accessLevel: AFFILIATE_OFFER_ACCESS_LEVELS.NONE,
      canRequestAccess: false,
      accessStatus: 'not_requested',
      requestStatus: null,
      denyReason: null,
    };
  }

  return {
    isVisible: resolution.isVisible,
    isAccessible: resolution.isAccessible,
    accessLevel: resolution.accessLevel,
    canRequestAccess: resolution.canRequestAccess,
    accessStatus: resolution.accessStatus,
    requestStatus: resolution.requestStatus,
    denyReason: resolution.denyReason,
  };
}
