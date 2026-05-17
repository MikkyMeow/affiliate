export const MANUAL_ADJUSTMENT_TYPES = Object.freeze({
  CONVERSIONS: 'conversions',
  CLICKS: 'clicks',
});

export const MANUAL_ADJUSTMENT_TYPE_VALUES = Object.values(
  MANUAL_ADJUSTMENT_TYPES,
);

export const MANUAL_ADJUSTMENT_PARTNER_MODES = Object.freeze({
  SINGLE_PARTNER: 'single_partner',
  PER_ROW: 'per_row',
});

export const MANUAL_ADJUSTMENT_PARTNER_MODE_VALUES = Object.values(
  MANUAL_ADJUSTMENT_PARTNER_MODES,
);

export const MANUAL_ADJUSTMENT_BATCH_STATUSES = Object.freeze({
  PREVIEWED: 'previewed',
  APPLIED: 'applied',
  FAILED: 'failed',
});

export const MANUAL_ADJUSTMENT_BATCH_STATUS_VALUES = Object.values(
  MANUAL_ADJUSTMENT_BATCH_STATUSES,
);

export const RECORD_SOURCES = Object.freeze({
  TRACKING: 'tracking',
  MANUAL: 'manual',
});

export const MANUAL_ADJUSTMENT_LIMITS = Object.freeze({
  MAX_FILE_BYTES: 2 * 1024 * 1024,
  MAX_ROWS: 5000,
  MAX_PREVIEW_VALID_ROWS: 50,
  MAX_DETAIL_CREATED_ITEMS: 100,
});
