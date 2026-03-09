const allowedStatuses = new Set(['active', 'inactive']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

/**
 * @typedef {Object} CreateAffiliateDto
 * @property {string} name
 * @property {string} email
 * @property {'active' | 'inactive'} [status]
 */

/**
 * @typedef {Object} UpdateAffiliateDto
 * @property {string} [name]
 * @property {string} [email]
 * @property {'active' | 'inactive'} [status]
 */

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

function normalizeName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateStatus(status, { allowMissing = true } = {}) {
  if (status === undefined || status === null || status === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : { value: undefined, errors: [buildError('status', 'Статус обязателен')] };
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

export function validateEmail(email, { allowMissing = true } = {}) {
  if (email === undefined || email === null || email === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : { value: undefined, errors: [buildError('email', 'Email обязателен')] };
  }

  const normalized = normalizeEmail(email);

  if (!normalized) {
    return {
      value: undefined,
      errors: [buildError('email', 'Email должен быть непустой строкой')],
    };
  }

  if (!isValidEmail(normalized)) {
    return {
      value: undefined,
      errors: [buildError('email', 'Некорректный email')],
    };
  }

  return { value: normalized, errors: [] };
}

/**
 * @param {unknown} payload
 * @returns {{dto: Partial<CreateAffiliateDto>, errors: Array<{field: string | null, message: string}>}}
 */
export function validateCreateAffiliateDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};

  const normalizedName = normalizeName(source.name);
  if (!normalizedName) {
    errors.push(buildError('name', 'Название обязательно и должно быть строкой'));
  } else {
    dto.name = normalizedName;
  }

  const { value: email, errors: emailErrors } = validateEmail(source.email, {
    allowMissing: false,
  });
  errors.push(...emailErrors);
  if (email) {
    dto.email = email;
  }

  const { value: status, errors: statusErrors } = validateStatus(source.status);
  errors.push(...statusErrors);
  if (status) {
    dto.status = status;
  }

  return { dto, errors };
}

/**
 * @param {unknown} payload
 * @returns {{dto: UpdateAffiliateDto, errors: Array<{field: string | null, message: string}>}}
 */
export function validateUpdateAffiliateDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};
  let hasAtLeastOneField = false;

  if (Object.hasOwn(source, 'name')) {
    hasAtLeastOneField = true;
    const normalizedName = normalizeName(source.name);
    if (!normalizedName) {
      errors.push(
        buildError('name', 'Название обязательно и должно быть непустой строкой'),
      );
    } else {
      dto.name = normalizedName;
    }
  }

  if (Object.hasOwn(source, 'email')) {
    hasAtLeastOneField = true;
    const { value: email, errors: emailErrors } = validateEmail(source.email, {
      allowMissing: false,
    });
    errors.push(...emailErrors);
    if (email) {
      dto.email = email;
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

export function validateAffiliateStatusFilter(value) {
  return validateStatus(value);
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

export function validateAffiliateListFilters(payload = {}) {
  const errors = [];
  const filter = {};
  const pagination = {};

  if (Object.hasOwn(payload, 'status')) {
    const { value: status, errors: statusErrors } = validateAffiliateStatusFilter(
      payload.status,
    );
    errors.push(...statusErrors);
    if (status) {
      filter.status = status;
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
