export const OFFER_STATUSES = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
});

// Временный статус, пока БД хранит inactive.
export const LEGACY_OFFER_STATUS_INACTIVE = 'inactive';

export const OFFER_VISIBILITY_MODES = Object.freeze({
  PUBLIC: 'public',
  ON_REQUEST: 'on_request',
  PRIVATE: 'private',
});

export const OFFER_ACCESS_TYPES = Object.freeze({
  ALLOWED: 'allowed',
  REJECTED: 'rejected',
  EXCLUDED: 'excluded',
});

export const OFFER_ACCESS_SOURCES = Object.freeze({
  MANUAL: 'manual',
  REQUEST_APPROVED: 'request_approved',
  REQUEST_REJECTED: 'request_rejected',
});

export const OFFER_REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

export const OFFER_GOAL_TYPES = Object.freeze({
  CPL: 'CPL',
  CPA: 'CPA',
  CPC: 'CPC',
});

export const OFFER_GEO_RULE_TYPES = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
});

export const OFFER_ACCESS_PRIORITY = Object.freeze([
  OFFER_ACCESS_TYPES.EXCLUDED,
  OFFER_ACCESS_TYPES.REJECTED,
  OFFER_ACCESS_TYPES.ALLOWED,
]);

export const OFFER_DEFAULT_TARGETING = Object.freeze({
  TARGETING_STRICT: false,
});
