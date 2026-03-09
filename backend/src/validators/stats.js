const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const conversionStatuses = new Set(['approved', 'rejected']);

function buildError(field, message) {
  return { field, message };
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

function validateUuid(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
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

function validateStatus(value) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('status', 'Статус должен быть строкой')],
    };
  }

  const normalized = value.trim();
  if (!conversionStatuses.has(normalized)) {
    return {
      value: undefined,
      errors: [buildError('status', 'Недопустимое значение статуса')],
    };
  }

  return { value: normalized, errors: [] };
}

function buildListValidation(
  payload = {},
  { allowStatus = false, includePagination = true } = {},
) {
  const errors = [];
  const filter = {};
  const pagination = {};

  if (Object.hasOwn(payload, 'offerId')) {
    const { value, errors: offerErrors } = validateUuid(payload.offerId, 'offerId');
    errors.push(...offerErrors);
    if (value) {
      filter.offerId = value;
    }
  }

  if (Object.hasOwn(payload, 'affiliateId')) {
    const { value, errors: affiliateErrors } = validateUuid(
      payload.affiliateId,
      'affiliateId',
    );
    errors.push(...affiliateErrors);
    if (value) {
      filter.affiliateId = value;
    }
  }

  if (allowStatus && Object.hasOwn(payload, 'status')) {
    const { value: status, errors: statusErrors } = validateStatus(payload.status);
    errors.push(...statusErrors);
    if (status) {
      filter.status = status;
    }
  }

  if (includePagination) {
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
  }

  return { filter, pagination: includePagination ? pagination : undefined, errors };
}

export function validateClicksListFilters(payload = {}) {
  return buildListValidation(payload);
}

export function validateConversionsListFilters(payload = {}) {
  return buildListValidation(payload, { allowStatus: true });
}

export function validateStatsSummaryFilters(payload = {}) {
  const { filter, errors } = buildListValidation(payload, {
    includePagination: false,
  });

  return { filter, errors };
}
