export const CLICK_REDIRECT_OUTCOMES = Object.freeze({
  ALLOWED_TARGET_REDIRECT: 'allowed_target_redirect',
  FALLBACK_REDIRECT: 'fallback_redirect',
  INTERNAL_UNAVAILABLE_REDIRECT: 'internal_unavailable_redirect',
});

export const CLICK_REDIRECT_OUTCOME_VALUES = Object.values(
  CLICK_REDIRECT_OUTCOMES,
);

export const CLICK_DESTINATION_TYPES = Object.freeze({
  TARGET: 'target',
  FALLBACK: 'fallback',
  INTERNAL_UNAVAILABLE: 'internal_unavailable',
});

export const CLICK_DESTINATION_TYPE_VALUES = Object.values(
  CLICK_DESTINATION_TYPES,
);
