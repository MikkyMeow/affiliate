const allowedStatuses = new Set(['active', 'inactive']);
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

function buildError(field, message) {
  return { field, message };
}

function normalizeTitle(value) {
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
    if (trimmed.length === 0) {
      return null;
    }

    const numberValue = Number(trimmed);
    if (!Number.isFinite(numberValue)) {
      return null;
    }

    return Number(numberValue.toFixed(2));
  }

  return null;
}

function parseInteger(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }

    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (!/^-?\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function validateStatus(status, { allowMissing = true } = {}) {
  if (status === undefined || status === null || status === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError('status', 'Статус обязателен')],
        };
  }

  if (typeof status !== 'string') {
    return {
      value: undefined,
      errors: [buildError('status', 'Статус должен быть строкой')],
    };
  }

  if (!allowedStatuses.has(status)) {
    return {
      value: undefined,
      errors: [buildError('status', 'Недопустимое значение статуса')],
    };
  }

  return { value: status, errors: [] };
}

export function validateUuid(value, { allowMissing = true, field = 'id' } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'Значение обязательно')],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Значение должно быть строкой')],
    };
  }

  const normalized = value.trim();

  if (!uuidRegex.test(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Некорректный UUID')],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateUrl(
  value,
  { allowMissing = true, field = 'targetUrl' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'URL обязателен')],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'URL должен быть строкой')],
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      value: undefined,
      errors: [buildError(field, 'URL не должен быть пустым')],
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        value: undefined,
        errors: [buildError(field, 'URL должен начинаться с http или https')],
      };
    }
  } catch {
    return {
      value: undefined,
      errors: [buildError(field, 'Некорректный URL')],
    };
  }

  return { value: trimmed, errors: [] };
}

export function validatePayoutRub(value, { allowMissing = true } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError('payoutRub', 'Выплата обязательна')],
        };
  }

  const normalized = normalizeMoney(value);
  if (normalized === null) {
    return {
      value: undefined,
      errors: [buildError('payoutRub', 'Некорректная сумма выплаты')],
    };
  }

  if (normalized <= 0) {
    return {
      value: undefined,
      errors: [buildError('payoutRub', 'Выплата должна быть больше 0')],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateCreateOfferDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};

  const normalizedTitle = normalizeTitle(source.title);
  if (!normalizedTitle) {
    errors.push(buildError('title', 'Название обязательно и должно быть строкой'));
  } else {
    dto.title = normalizedTitle;
  }

  const { value: advertiserId, errors: advertiserErrors } = validateUuid(
    source.advertiserId,
    { allowMissing: false, field: 'advertiserId' },
  );
  errors.push(...advertiserErrors);
  if (advertiserId) {
    dto.advertiserId = advertiserId;
  }

  const { value: targetUrl, errors: urlErrors } = validateUrl(source.targetUrl, {
    allowMissing: false,
  });
  errors.push(...urlErrors);
  if (targetUrl) {
    dto.targetUrl = targetUrl;
  }

  const { value: payoutRub, errors: payoutErrors } = validatePayoutRub(
    source.payoutRub,
    { allowMissing: false },
  );
  errors.push(...payoutErrors);
  if (typeof payoutRub === 'number') {
    dto.payoutRub = payoutRub;
  }

  const { value: status, errors: statusErrors } = validateStatus(source.status);
  errors.push(...statusErrors);
  if (status) {
    dto.status = status;
  }

  return { dto, errors };
}

export function validateUpdateOfferDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};
  let hasAtLeastOneField = false;

  if (Object.hasOwn(source, 'title')) {
    hasAtLeastOneField = true;
    const normalizedTitle = normalizeTitle(source.title);
    if (!normalizedTitle) {
      errors.push(
        buildError('title', 'Название обязательно и должно быть непустой строкой'),
      );
    } else {
      dto.title = normalizedTitle;
    }
  }

  if (Object.hasOwn(source, 'advertiserId')) {
    hasAtLeastOneField = true;
    const { value: advertiserId, errors: advertiserErrors } = validateUuid(
      source.advertiserId,
      { allowMissing: false, field: 'advertiserId' },
    );
    errors.push(...advertiserErrors);
    if (advertiserId) {
      dto.advertiserId = advertiserId;
    }
  }

  if (Object.hasOwn(source, 'targetUrl')) {
    hasAtLeastOneField = true;
    const { value: targetUrl, errors: urlErrors } = validateUrl(
      source.targetUrl,
      { allowMissing: false },
    );
    errors.push(...urlErrors);
    if (targetUrl) {
      dto.targetUrl = targetUrl;
    }
  }

  if (Object.hasOwn(source, 'payoutRub')) {
    hasAtLeastOneField = true;
    const { value: payoutRub, errors: payoutErrors } = validatePayoutRub(
      source.payoutRub,
      { allowMissing: false },
    );
    errors.push(...payoutErrors);
    if (typeof payoutRub === 'number') {
      dto.payoutRub = payoutRub;
    }
  }

  if (Object.hasOwn(source, 'status')) {
    hasAtLeastOneField = true;
    const { value: status, errors: statusErrors } = validateStatus(source.status, {
      allowMissing: false,
    });
    errors.push(...statusErrors);
    if (status) {
      dto.status = status;
    }
  }

  if (!hasAtLeastOneField) {
    errors.push(buildError(null, 'Нужно указать поля для обновления'));
  }

  return { dto, errors };
}

export function validateOfferFilters(payload = {}) {
  const errors = [];
  const filter = {};
  const pagination = {};

  if (Object.hasOwn(payload, 'status')) {
    const { value: status, errors: statusErrors } = validateStatus(payload.status);
    errors.push(...statusErrors);
    if (status) {
      filter.status = status;
    }
  }

  if (Object.hasOwn(payload, 'advertiserId')) {
    const { value: advertiserId, errors: advertiserErrors } = validateUuid(
      payload.advertiserId,
      { field: 'advertiserId' },
    );
    errors.push(...advertiserErrors);
    if (advertiserId) {
      filter.advertiserId = advertiserId;
    }
  }

  const { value: limit, errors: limitErrors } = validateLimit(payload.limit);
  errors.push(...limitErrors);
  if (typeof limit === 'number') {
    pagination.limit = limit;
  }

  const { value: offset, errors: offsetErrors } = validateOffset(payload.offset);
  errors.push(...offsetErrors);
  if (typeof offset === 'number') {
    pagination.offset = offset;
  }

  return { filter, pagination, errors };
}

export { allowedStatuses };

function validateLimit(value) {
  if (value === undefined || value === null || value === '') {
    return { value: DEFAULT_LIMIT, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('limit', 'Limit должен быть целым числом')],
    };
  }

  if (parsed <= 0) {
    return {
      value: undefined,
      errors: [buildError('limit', 'Limit должен быть больше 0')],
    };
  }

  if (parsed > MAX_LIMIT) {
    return {
      value: undefined,
      errors: [
        buildError('limit', `Limit не может быть больше ${MAX_LIMIT}`),
      ],
    };
  }

  return { value: parsed, errors: [] };
}

function validateOffset(value) {
  if (value === undefined || value === null || value === '') {
    return { value: DEFAULT_OFFSET, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('offset', 'Offset должен быть целым числом')],
    };
  }

  if (parsed < 0) {
    return {
      value: undefined,
      errors: [buildError('offset', 'Offset не может быть отрицательным')],
    };
  }

  return { value: parsed, errors: [] };
}
