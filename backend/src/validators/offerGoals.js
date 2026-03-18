import { OFFER_GOAL_TYPES } from '../constants/offers.js';

const allowedGoalTypes = new Set(Object.values(OFFER_GOAL_TYPES));
const currencyCodeRegex = /^[A-Z]{3}$/;

function buildError(field, message) {
  return { field, message };
}

function normalizeName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMoney(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Number(value.toFixed(2));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return Number(parsed.toFixed(2));
  }

  return null;
}

function validateMoney(
  value,
  { allowMissing = true, field, min = 0 } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, `${field} обязателен`)],
        };
  }

  const normalized = normalizeMoney(value);
  if (normalized === null) {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть числом`)],
    };
  }

  if (normalized < min) {
    return {
      value: undefined,
      errors: [
        buildError(field, `${field} не может быть меньше ${min}`),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateGoalType(
  value,
  { allowMissing = true, field = 'type' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'type обязателен')],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'type должен быть строкой')],
    };
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized || !allowedGoalTypes.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          field,
          `type должен быть одним из: ${Array.from(allowedGoalTypes).join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateCurrency(
  value,
  { allowMissing = true, field = 'currency', defaultValue } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: defaultValue, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'currency обязателен')],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'currency должен быть строкой')],
    };
  }

  const normalized = value.trim().toUpperCase();

  if (!currencyCodeRegex.test(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(field, 'currency должен быть трёхбуквенным кодом ISO-4217'),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateBooleanField(value, { field, defaultValue } = {}) {
  if (value === undefined || value === null) {
    return { value: defaultValue, errors: [] };
  }

  if (typeof value !== 'boolean') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть булевым значением`)],
    };
  }

  return { value, errors: [] };
}

export function validateCreateOfferGoalPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  const name = normalizeName(source.name);
  if (!name) {
    errors.push(
      buildError('name', 'name обязателен и не может быть пустым'),
    );
  } else {
    dto.name = name;
  }

  const { value: type, errors: typeErrors } = validateGoalType(source.type, {
    allowMissing: false,
  });
  errors.push(...typeErrors);
  if (type) {
    dto.type = type;
  }

  const { value: revenue, errors: revenueErrors } = validateMoney(
    source.revenue,
    { allowMissing: false, field: 'revenue', min: 0 },
  );
  errors.push(...revenueErrors);
  if (typeof revenue === 'number') {
    dto.revenue = revenue;
  }

  const { value: payout, errors: payoutErrors } = validateMoney(
    source.payout,
    { allowMissing: false, field: 'payout', min: 0 },
  );
  errors.push(...payoutErrors);
  if (typeof payout === 'number') {
    dto.payout = payout;
  }

  const { value: currency, errors: currencyErrors } = validateCurrency(
    source.currency,
    { defaultValue: 'RUB' },
  );
  errors.push(...currencyErrors);
  if (currency) {
    dto.currency = currency;
  }

  const { value: isDefault, errors: defaultErrors } = validateBooleanField(
    source.isDefault,
    { field: 'isDefault', defaultValue: false },
  );
  errors.push(...defaultErrors);
  if (typeof isDefault === 'boolean') {
    dto.isDefault = isDefault;
  }

  const { value: isActive, errors: activeErrors } = validateBooleanField(
    source.isActive,
    { field: 'isActive', defaultValue: true },
  );
  errors.push(...activeErrors);
  if (typeof isActive === 'boolean') {
    dto.isActive = isActive;
  }

  return { dto, errors };
}

export function validateUpdateOfferGoalPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      dto: {},
      errors: [buildError(null, 'Payload должен быть объектом')],
    };
  }

  const errors = [];
  const dto = {};
  let hasUpdates = false;

  if (Object.hasOwn(payload, 'name')) {
    const name = normalizeName(payload.name);
    hasUpdates = true;
    if (!name) {
      errors.push(
        buildError('name', 'name обязателен и не может быть пустым'),
      );
    } else {
      dto.name = name;
    }
  }

  if (Object.hasOwn(payload, 'type')) {
    const { value: type, errors: typeErrors } = validateGoalType(payload.type, {
      allowMissing: false,
    });
    hasUpdates = true;
    errors.push(...typeErrors);
    if (type) {
      dto.type = type;
    }
  }

  if (Object.hasOwn(payload, 'revenue')) {
    const { value: revenue, errors: revenueErrors } = validateMoney(
      payload.revenue,
      { allowMissing: false, field: 'revenue', min: 0 },
    );
    hasUpdates = true;
    errors.push(...revenueErrors);
    if (typeof revenue === 'number') {
      dto.revenue = revenue;
    }
  }

  if (Object.hasOwn(payload, 'payout')) {
    const { value: payout, errors: payoutErrors } = validateMoney(
      payload.payout,
      { allowMissing: false, field: 'payout', min: 0 },
    );
    hasUpdates = true;
    errors.push(...payoutErrors);
    if (typeof payout === 'number') {
      dto.payout = payout;
    }
  }

  if (Object.hasOwn(payload, 'currency')) {
    const { value: currency, errors: currencyErrors } = validateCurrency(
      payload.currency,
      { allowMissing: false },
    );
    hasUpdates = true;
    errors.push(...currencyErrors);
    if (currency) {
      dto.currency = currency;
    }
  }

  if (Object.hasOwn(payload, 'isDefault')) {
    const { value: isDefault, errors: defaultErrors } = validateBooleanField(
      payload.isDefault,
      { field: 'isDefault' },
    );
    hasUpdates = true;
    errors.push(...defaultErrors);
    if (typeof isDefault === 'boolean') {
      dto.isDefault = isDefault;
    }
  }

  if (Object.hasOwn(payload, 'isActive')) {
    const { value: isActive, errors: activeErrors } = validateBooleanField(
      payload.isActive,
      { field: 'isActive' },
    );
    hasUpdates = true;
    errors.push(...activeErrors);
    if (typeof isActive === 'boolean') {
      dto.isActive = isActive;
    }
  }

  if (!hasUpdates) {
    errors.push(buildError(null, 'Нужно указать поля для обновления'));
  }

  return { dto, errors };
}
