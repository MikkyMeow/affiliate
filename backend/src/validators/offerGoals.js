import {
  OFFER_GOAL_CURRENCY,
  OFFER_GOAL_LIMIT_TYPES,
  OFFER_GOAL_TYPES,
} from '../constants/offers.js';

const allowedGoalTypes = new Set(Object.values(OFFER_GOAL_TYPES));
const allowedLimitTypes = new Set(Object.values(OFFER_GOAL_LIMIT_TYPES));

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

function parsePositiveInteger(value) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function validateForbiddenFields(source, errors) {
  const forbiddenMessages = {
    profit: 'profit рассчитывается только на backend',
    isActive: 'goal status удалён и больше не поддерживается',
    status: 'goal status удалён и больше не поддерживается',
    percentage: 'Процентные ставки не поддерживаются',
    rateType: 'Поддерживаются только фиксированные ставки',
    ratePercent: 'Процентные ставки не поддерживаются',
  };

  for (const [field, message] of Object.entries(forbiddenMessages)) {
    if (Object.hasOwn(source, field)) {
      errors.push(buildError(field, message));
    }
  }
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
      errors: [buildError(field, `${field} не может быть меньше ${min}`)],
    };
  }

  return { value: normalized, errors: [] };
}

function validateCurrency(
  value,
  { allowMissing = true, field = 'currency' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: OFFER_GOAL_CURRENCY, errors: [] }
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
  if (normalized !== OFFER_GOAL_CURRENCY) {
    return {
      value: undefined,
      errors: [buildError(field, `Поддерживается только ${OFFER_GOAL_CURRENCY}`)],
    };
  }

  return { value: normalized, errors: [] };
}

function validateBooleanField(value, { field, allowMissing = true } = {}) {
  if (value === undefined || value === null) {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, `${field} обязателен`)],
        };
  }

  if (typeof value !== 'boolean') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть булевым значением`)],
    };
  }

  return { value, errors: [] };
}

function validateLimitType(value, { allowMissing = true, field = 'limitType' } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, `${field} обязателен`)],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim();
  if (!allowedLimitTypes.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          field,
          `${field} должен быть одним из: ${Array.from(allowedLimitTypes).join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateLimitValue(
  value,
  { allowMissing = true, field = 'limitValue' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, `${field} обязателен`)],
        };
  }

  const parsed = parsePositiveInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть положительным целым числом`)],
    };
  }

  return { value: parsed, errors: [] };
}

function validateMoneyRelationship(dto, errors) {
  if (typeof dto.revenue === 'number' && typeof dto.payout === 'number' && dto.payout > dto.revenue) {
    errors.push(buildError('payout', 'payout не может быть больше revenue'));
  }
}

function validateLimitConfiguration(dto, errors) {
  if (dto.limitEnabled === true) {
    if (!dto.limitType) {
      errors.push(buildError('limitType', 'limitType обязателен при включённом лимите'));
    }

    if (!Number.isInteger(dto.limitValue) || dto.limitValue <= 0) {
      errors.push(buildError('limitValue', 'limitValue обязателен при включённом лимите'));
    }

    return;
  }

  if (dto.limitEnabled === false) {
    dto.limitType = null;
    dto.limitValue = null;
  }
}

export function validateCreateOfferGoalPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  validateForbiddenFields(source, errors);

  const name = normalizeName(source.name);
  if (!name) {
    errors.push(buildError('name', 'name обязателен и не может быть пустым'));
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

  const { value: revenue, errors: revenueErrors } = validateMoney(source.revenue, {
    allowMissing: false,
    field: 'revenue',
    min: 0,
  });
  errors.push(...revenueErrors);
  if (typeof revenue === 'number') {
    dto.revenue = revenue;
  }

  const { value: payout, errors: payoutErrors } = validateMoney(source.payout, {
    allowMissing: false,
    field: 'payout',
    min: 0,
  });
  errors.push(...payoutErrors);
  if (typeof payout === 'number') {
    dto.payout = payout;
  }

  const { value: currency, errors: currencyErrors } = validateCurrency(source.currency);
  errors.push(...currencyErrors);
  if (currency) {
    dto.currency = currency;
  }

  const { value: isDefault, errors: isDefaultErrors } = validateBooleanField(
    source.isDefault,
    { field: 'isDefault' },
  );
  errors.push(...isDefaultErrors);
  dto.isDefault = typeof isDefault === 'boolean' ? isDefault : false;

  const { value: limitEnabled, errors: limitEnabledErrors } = validateBooleanField(
    source.limitEnabled,
    { field: 'limitEnabled' },
  );
  errors.push(...limitEnabledErrors);
  dto.limitEnabled =
    typeof limitEnabled === 'boolean' ? limitEnabled : false;

  const { value: limitType, errors: limitTypeErrors } = validateLimitType(
    source.limitType,
    {
      allowMissing: !dto.limitEnabled,
    },
  );
  errors.push(...limitTypeErrors);
  if (limitType !== undefined) {
    dto.limitType = limitType;
  }

  const { value: limitValue, errors: limitValueErrors } = validateLimitValue(
    source.limitValue,
    {
      allowMissing: !dto.limitEnabled,
    },
  );
  errors.push(...limitValueErrors);
  if (limitValue !== undefined) {
    dto.limitValue = limitValue;
  }

  validateMoneyRelationship(dto, errors);
  validateLimitConfiguration(dto, errors);

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

  validateForbiddenFields(payload, errors);

  if (Object.hasOwn(payload, 'name')) {
    hasUpdates = true;
    const name = normalizeName(payload.name);
    if (!name) {
      errors.push(buildError('name', 'name обязателен и не может быть пустым'));
    } else {
      dto.name = name;
    }
  }

  if (Object.hasOwn(payload, 'type')) {
    hasUpdates = true;
    const { value: type, errors: typeErrors } = validateGoalType(payload.type, {
      allowMissing: false,
    });
    errors.push(...typeErrors);
    if (type) {
      dto.type = type;
    }
  }

  if (Object.hasOwn(payload, 'revenue')) {
    hasUpdates = true;
    const { value: revenue, errors: revenueErrors } = validateMoney(payload.revenue, {
      allowMissing: false,
      field: 'revenue',
      min: 0,
    });
    errors.push(...revenueErrors);
    if (typeof revenue === 'number') {
      dto.revenue = revenue;
    }
  }

  if (Object.hasOwn(payload, 'payout')) {
    hasUpdates = true;
    const { value: payout, errors: payoutErrors } = validateMoney(payload.payout, {
      allowMissing: false,
      field: 'payout',
      min: 0,
    });
    errors.push(...payoutErrors);
    if (typeof payout === 'number') {
      dto.payout = payout;
    }
  }

  if (Object.hasOwn(payload, 'currency')) {
    hasUpdates = true;
    const { value: currency, errors: currencyErrors } = validateCurrency(
      payload.currency,
      { allowMissing: false },
    );
    errors.push(...currencyErrors);
    if (currency) {
      dto.currency = currency;
    }
  }

  if (Object.hasOwn(payload, 'isDefault')) {
    hasUpdates = true;
    const { value: isDefault, errors: isDefaultErrors } = validateBooleanField(
      payload.isDefault,
      { field: 'isDefault', allowMissing: false },
    );
    errors.push(...isDefaultErrors);
    if (typeof isDefault === 'boolean') {
      dto.isDefault = isDefault;
    }
  }

  if (Object.hasOwn(payload, 'limitEnabled')) {
    hasUpdates = true;
    const { value: limitEnabled, errors: limitEnabledErrors } = validateBooleanField(
      payload.limitEnabled,
      { field: 'limitEnabled', allowMissing: false },
    );
    errors.push(...limitEnabledErrors);
    if (typeof limitEnabled === 'boolean') {
      dto.limitEnabled = limitEnabled;
    }
  }

  if (Object.hasOwn(payload, 'limitType')) {
    hasUpdates = true;
    const { value: limitType, errors: limitTypeErrors } = validateLimitType(
      payload.limitType,
      { allowMissing: false },
    );
    errors.push(...limitTypeErrors);
    if (limitType !== undefined) {
      dto.limitType = limitType;
    }
  }

  if (Object.hasOwn(payload, 'limitValue')) {
    hasUpdates = true;
    const { value: limitValue, errors: limitValueErrors } = validateLimitValue(
      payload.limitValue,
      { allowMissing: false },
    );
    errors.push(...limitValueErrors);
    if (limitValue !== undefined) {
      dto.limitValue = limitValue;
    }
  }

  if (!hasUpdates) {
    errors.push(buildError(null, 'Нужно указать хотя бы одно поле для обновления'));
  }

  validateMoneyRelationship(dto, errors);

  if (dto.limitEnabled === true) {
    if (!Object.hasOwn(dto, 'limitType')) {
      errors.push(buildError('limitType', 'limitType обязателен при включённом лимите'));
    }

    if (!Object.hasOwn(dto, 'limitValue')) {
      errors.push(buildError('limitValue', 'limitValue обязателен при включённом лимите'));
    }
  }

  if (dto.limitEnabled === false) {
    dto.limitType = null;
    dto.limitValue = null;
  }

  return { dto, errors };
}

export function validateUpsertOfferGoalAffiliateRatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      dto: {},
      errors: [buildError(null, 'Payload должен быть объектом')],
    };
  }

  const source = payload;
  const errors = [];
  const dto = {};

  validateForbiddenFields(source, errors);

  const { value: revenue, errors: revenueErrors } = validateMoney(source.revenue, {
    allowMissing: false,
    field: 'revenue',
    min: 0,
  });
  errors.push(...revenueErrors);
  if (typeof revenue === 'number') {
    dto.revenue = revenue;
  }

  const { value: payout, errors: payoutErrors } = validateMoney(source.payout, {
    allowMissing: false,
    field: 'payout',
    min: 0,
  });
  errors.push(...payoutErrors);
  if (typeof payout === 'number') {
    dto.payout = payout;
  }

  validateMoneyRelationship(dto, errors);

  return { dto, errors };
}
