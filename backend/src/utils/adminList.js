const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function buildListError(field, message) {
  return { field, message };
}

export function getQueryValue(payload, ...keys) {
  for (const key of keys) {
    if (!Object.hasOwn(payload ?? {}, key)) {
      continue;
    }

    const rawValue = payload[key];
    if (Array.isArray(rawValue)) {
      return rawValue[0];
    }

    return rawValue;
  }

  return undefined;
}

export function parseInteger(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }

    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized, 10);
}

export function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function validateSearch(value, { field = 'search', maxLength = 200 } = {}) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildListError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { value: undefined, errors: [] };
  }

  if (normalized.length > maxLength) {
    return {
      value: undefined,
      errors: [
        buildListError(
          field,
          `${field} не должен превышать ${maxLength} символов`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateText(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildListError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim();
  return normalized
    ? { value: normalized, errors: [] }
    : { value: undefined, errors: [] };
}

export function validateBoolean(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value === 'boolean') {
    return { value, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildListError(field, `${field} должен быть булевым значением`)],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalized)) {
    return { value: true, errors: [] };
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return { value: false, errors: [] };
  }

  return {
    value: undefined,
    errors: [buildListError(field, `${field} должен быть булевым значением`)],
  };
}

export function validateDate(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildListError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim();
  if (!DATE_REGEX.test(normalized)) {
    return {
      value: undefined,
      errors: [buildListError(field, 'Дата должна быть в формате YYYY-MM-DD')],
    };
  }

  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    return {
      value: undefined,
      errors: [buildListError(field, 'Дата должна быть в формате YYYY-MM-DD')],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateDateRange(payload, errors, { fromField = 'dateFrom', toField = 'dateTo' } = {}) {
  const { value: dateFrom, errors: dateFromErrors } = validateDate(
    getQueryValue(payload, fromField, 'date_from'),
    fromField,
  );
  const { value: dateTo, errors: dateToErrors } = validateDate(
    getQueryValue(payload, toField, 'date_to'),
    toField,
  );

  errors.push(...dateFromErrors, ...dateToErrors);

  if (dateFrom && dateTo && dateFrom > dateTo) {
    errors.push(buildListError(fromField, `${fromField} не может быть позже ${toField}`));
  }

  return {
    dateFrom,
    dateTo,
  };
}

export function validateOrder(value, { field = 'order', defaultValue = 'desc' } = {}) {
  if (value === undefined || value === null || value === '') {
    return { value: defaultValue, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildListError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim().toLowerCase();
  if (normalized !== 'asc' && normalized !== 'desc') {
    return {
      value: undefined,
      errors: [buildListError(field, `${field} должен быть asc или desc`)],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateSort(value, allowedSorts, { field = 'sort', defaultValue } = {}) {
  if (value === undefined || value === null || value === '') {
    return { value: defaultValue, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildListError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { value: defaultValue, errors: [] };
  }

  if (!Object.hasOwn(allowedSorts, normalized)) {
    return {
      value: undefined,
      errors: [
        buildListError(
          field,
          `${field} должен быть одним из: ${Object.keys(allowedSorts).join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

export function validatePagination(
  payload = {},
  {
    defaultLimit = 20,
    maxLimit = 100,
    limitField = 'limit',
    offsetField = 'offset',
    pageField = 'page',
  } = {},
) {
  const errors = [];

  const limitValue = getQueryValue(payload, limitField);
  const pageValue = getQueryValue(payload, pageField);
  const offsetValue = getQueryValue(payload, offsetField);

  let limit = defaultLimit;
  if (!(limitValue === undefined || limitValue === null || limitValue === '')) {
    const parsed = parseInteger(limitValue);
    if (parsed === null) {
      errors.push(buildListError(limitField, `${limitField} должен быть целым числом`));
    } else if (parsed < 1 || parsed > maxLimit) {
      errors.push(
        buildListError(limitField, `${limitField} должен быть от 1 до ${maxLimit}`),
      );
    } else {
      limit = parsed;
    }
  }

  let page = 1;
  if (!(pageValue === undefined || pageValue === null || pageValue === '')) {
    const parsed = parseInteger(pageValue);
    if (parsed === null || parsed < 1) {
      errors.push(buildListError(pageField, `${pageField} должен быть целым числом больше 0`));
    } else {
      page = parsed;
    }
  }

  let offset = (page - 1) * limit;
  if (!(offsetValue === undefined || offsetValue === null || offsetValue === '')) {
    const parsed = parseInteger(offsetValue);
    if (parsed === null || parsed < 0) {
      errors.push(buildListError(offsetField, `${offsetField} должен быть целым числом не меньше 0`));
    } else {
      offset = parsed;
      if (pageValue === undefined || pageValue === null || pageValue === '') {
        page = Math.floor(offset / Math.max(limit, 1)) + 1;
      }
    }
  }

  return {
    pagination: {
      page,
      limit,
      offset,
    },
    errors,
  };
}

export function buildPaginationMeta(
  total,
  pagination,
  extra = {},
) {
  const limit = pagination?.limit ?? 20;
  const offset = pagination?.offset ?? 0;
  const page =
    pagination?.page ??
    Math.floor(offset / Math.max(limit, 1)) + 1;
  const totalPages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 0;

  return {
    total,
    limit,
    offset,
    page,
    totalPages,
    ...extra,
  };
}
