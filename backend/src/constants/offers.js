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

export const OFFER_GOAL_LIMIT_TYPES = Object.freeze({
  CONVERSIONS_COUNT: 'conversions_count',
});

export const OFFER_GOAL_CURRENCY = 'RUB';

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

export const OFFER_CATEGORY_SLUGS = Object.freeze({
  FINANCE_AND_MFO: 'finance_mfo',
  SERVICES: 'services',
  FINANCE: 'finance',
  SPORTS_BETTING: 'sports_betting',
  EDUCATION: 'education',
  SURVEYS: 'surveys',
  HR: 'hr_jobs',
  AUTOMOTIVE: 'automotive',
  B2B: 'b2b',
  TRAVEL: 'travel',
  OTHER: 'other',
  GAMES: 'games',
  ECOMMERCE: 'ecommerce',
  REAL_ESTATE: 'real_estate',
});

export const OFFER_CATEGORY_LABELS = Object.freeze({
  [OFFER_CATEGORY_SLUGS.FINANCE_AND_MFO]: 'Финансы и МФО',
  [OFFER_CATEGORY_SLUGS.SERVICES]: 'Сервисы и услуги',
  [OFFER_CATEGORY_SLUGS.FINANCE]: 'Финансы',
  [OFFER_CATEGORY_SLUGS.SPORTS_BETTING]: 'Ставки на спорт',
  [OFFER_CATEGORY_SLUGS.EDUCATION]: 'Образование',
  [OFFER_CATEGORY_SLUGS.SURVEYS]: 'Опросы',
  [OFFER_CATEGORY_SLUGS.HR]: 'Работа (HR, подбор персонала)',
  [OFFER_CATEGORY_SLUGS.AUTOMOTIVE]: 'Автомобильная тематика',
  [OFFER_CATEGORY_SLUGS.B2B]: 'B2B',
  [OFFER_CATEGORY_SLUGS.TRAVEL]: 'Путешествия',
  [OFFER_CATEGORY_SLUGS.OTHER]: 'Другое',
  [OFFER_CATEGORY_SLUGS.GAMES]: 'Игры',
  [OFFER_CATEGORY_SLUGS.ECOMMERCE]: 'E-Commerce',
  [OFFER_CATEGORY_SLUGS.REAL_ESTATE]: 'Недвижимость',
});

export const OFFER_CATEGORY_VALUES = Object.freeze(
  Object.values(OFFER_CATEGORY_SLUGS),
);
