import {
  MANUAL_ADJUSTMENT_BATCH_STATUS_VALUES,
  MANUAL_ADJUSTMENT_PARTNER_MODE_VALUES,
  MANUAL_ADJUSTMENT_TYPE_VALUES,
} from '../constants/adjustments.js';
import { CLICK_REDIRECT_OUTCOME_VALUES } from '../constants/clicks.js';
import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function buildError(field, message) {
  return { field, message };
}

function getValue(source, ...keys) {
  for (const key of keys) {
    if (!Object.hasOwn(source ?? {}, key)) {
      continue;
    }

    return source[key];
  }

  return undefined;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function validateRequiredEnum(value, field, allowedValues) {
  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} обязателен`)],
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!allowedValues.includes(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(field, `${field} должен быть одним из: ${allowedValues.join(', ')}`),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateOptionalEnum(value, field, allowedValues) {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined) {
    return { value: undefined, errors: [] };
  }

  const lowerCased = normalized.toLowerCase();
  if (!allowedValues.includes(lowerCased)) {
    return {
      value: undefined,
      errors: [
        buildError(field, `${field} должен быть одним из: ${allowedValues.join(', ')}`),
      ],
    };
  }

  return { value: lowerCased, errors: [] };
}

function validateOptionalIdentifier(value, field) {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined) {
    return { value: undefined, errors: [] };
  }

  return { value: normalized, errors: [] };
}

function validateOptionalUuid(value, field) {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined) {
    return { value: undefined, errors: [] };
  }

  if (!UUID_REGEX.test(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Некорректный UUID')],
    };
  }

  return { value: normalized, errors: [] };
}

function validateCsvText(value) {
  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('csvText', 'csvText обязателен')],
    };
  }

  const normalized = value.replace(/^\uFEFF/, '');
  if (!normalized.trim()) {
    return {
      value: undefined,
      errors: [buildError('csvText', 'CSV файл пуст')],
    };
  }

  return { value: normalized, errors: [] };
}

function parseInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized, 10);
}

function validateLimit(value) {
  if (value === undefined || value === null || value === '') {
    return { value: DEFAULT_LIMIT, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('limit', 'limit должен быть целым числом')],
    };
  }

  if (parsed <= 0 || parsed > MAX_LIMIT) {
    return {
      value: undefined,
      errors: [buildError('limit', `limit должен быть от 1 до ${MAX_LIMIT}`)],
    };
  }

  return { value: parsed, errors: [] };
}

function validatePage(value) {
  if (value === undefined || value === null || value === '') {
    return { value: 1, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null || parsed <= 0) {
    return {
      value: undefined,
      errors: [buildError('page', 'page должен быть целым числом больше 0')],
    };
  }

  return { value: parsed, errors: [] };
}

function validateDate(value, field) {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined) {
    return { value: undefined, errors: [] };
  }

  if (!DATE_REGEX.test(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Дата должна быть в формате YYYY-MM-DD')],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateAdjustmentPreviewPayload(payload = {}) {
  const errors = [];

  const { value: type, errors: typeErrors } = validateRequiredEnum(
    getValue(payload, 'type'),
    'type',
    MANUAL_ADJUSTMENT_TYPE_VALUES,
  );
  errors.push(...typeErrors);

  const { value: partnerMode, errors: partnerModeErrors } = validateRequiredEnum(
    getValue(payload, 'partnerMode', 'partner_mode'),
    'partnerMode',
    MANUAL_ADJUSTMENT_PARTNER_MODE_VALUES,
  );
  errors.push(...partnerModeErrors);

  const { value: affiliateId } = validateOptionalIdentifier(
    getValue(payload, 'affiliateId', 'affiliate_id'),
    'affiliateId',
  );
  const { value: offerId } = validateOptionalIdentifier(
    getValue(payload, 'offerId', 'offer_id'),
    'offerId',
  );
  const { value: goalId } = validateOptionalIdentifier(
    getValue(payload, 'goalId', 'goal_id'),
    'goalId',
  );

  const defaultStatusAllowedValues =
    type === 'clicks'
      ? CLICK_REDIRECT_OUTCOME_VALUES
      : CONVERSION_STATUS_VALUES;
  const defaultStatusField = type === 'clicks' ? 'defaultStatus' : 'defaultStatus';
  const {
    value: defaultStatus,
    errors: defaultStatusErrors,
  } = validateOptionalEnum(
    getValue(payload, 'defaultStatus', 'default_status'),
    defaultStatusField,
    defaultStatusAllowedValues,
  );
  errors.push(...defaultStatusErrors);

  const {
    value: csvText,
    errors: csvTextErrors,
  } = validateCsvText(getValue(payload, 'csvText', 'csv_text'));
  errors.push(...csvTextErrors);

  const originalFilename = normalizeOptionalString(
    getValue(payload, 'originalFilename', 'original_filename'),
  );

  if (
    partnerMode === 'single_partner' &&
    affiliateId === undefined
  ) {
    errors.push(
      buildError('affiliateId', 'affiliateId обязателен для single_partner режима'),
    );
  }

  return {
    dto: errors.length
      ? null
      : {
          type,
          partnerMode,
          affiliateId: affiliateId ?? null,
          offerId: offerId ?? null,
          goalId: goalId ?? null,
          defaultStatus: defaultStatus ?? null,
          csvText,
          originalFilename: originalFilename ?? null,
        },
    errors,
  };
}

export function validateAdjustmentBatchesQuery(query = {}) {
  const errors = [];

  const { value: type, errors: typeErrors } = validateOptionalEnum(
    getValue(query, 'type'),
    'type',
    MANUAL_ADJUSTMENT_TYPE_VALUES,
  );
  errors.push(...typeErrors);

  const { value: status, errors: statusErrors } = validateOptionalEnum(
    getValue(query, 'status'),
    'status',
    MANUAL_ADJUSTMENT_BATCH_STATUS_VALUES,
  );
  errors.push(...statusErrors);

  const { value: createdById, errors: createdByErrors } = validateOptionalUuid(
    getValue(query, 'createdBy', 'created_by'),
    'createdBy',
  );
  errors.push(...createdByErrors);

  const { value: dateFrom, errors: dateFromErrors } = validateDate(
    getValue(query, 'dateFrom', 'date_from'),
    'dateFrom',
  );
  errors.push(...dateFromErrors);

  const { value: dateTo, errors: dateToErrors } = validateDate(
    getValue(query, 'dateTo', 'date_to'),
    'dateTo',
  );
  errors.push(...dateToErrors);

  const { value: limit, errors: limitErrors } = validateLimit(getValue(query, 'limit'));
  errors.push(...limitErrors);
  const { value: page, errors: pageErrors } = validatePage(getValue(query, 'page'));
  errors.push(...pageErrors);

  return {
    query: errors.length
      ? null
      : {
          type: type ?? undefined,
          status: status ?? undefined,
          createdById: createdById ?? undefined,
          dateFrom: dateFrom ?? undefined,
          dateTo: dateTo ?? undefined,
        },
    pagination: errors.length
      ? null
      : {
          limit,
          page,
          offset: (page - 1) * limit,
        },
    errors,
  };
}
