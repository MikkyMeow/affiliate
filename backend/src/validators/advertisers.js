import { validateEmail, validateTelegramValue } from './affiliates.js';

const allowedStatuses = new Set(['active', 'inactive']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

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

function normalizeOptionalText(value) {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateManagerUserId(value, { allowNull = false, field = 'managerUserId' } = {}) {
  if (value === null) {
    return allowNull
      ? { value: null, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, `${field} не может быть null`)],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть строкой`)],
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return {
      value: undefined,
      errors: [buildError(field, `${field} обязателен`)],
    };
  }

  if (!UUID_REGEX.test(trimmed)) {
    return {
      value: undefined,
      errors: [buildError(field, `Некорректный ${field}`)],
    };
  }

  return { value: trimmed, errors: [] };
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

export function validateUpdateAdvertiserDto(payload) {
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

export function validateCreateAdvertiserDto(payload) {
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

  if (Object.hasOwn(source, 'telegram')) {
    const { value: telegram, errors: telegramErrors } = validateTelegramValue(
      source.telegram,
    );
    errors.push(...telegramErrors);
    if (telegram !== undefined) {
      dto.telegram = telegram;
    }
  }

  if (Object.hasOwn(source, 'internalNote') || Object.hasOwn(source, 'internal_note')) {
    const rawValue = Object.hasOwn(source, 'internalNote')
      ? source.internalNote
      : source.internal_note;

    if (rawValue !== null && typeof rawValue !== 'string') {
      errors.push(
        buildError('internalNote', 'internalNote должен быть строкой или null'),
      );
    } else {
      dto.internalNote = normalizeOptionalText(rawValue);
    }
  }

  if (Object.hasOwn(source, 'managerUserId') || Object.hasOwn(source, 'manager_id')) {
    const {
      value: managerUserId,
      errors: managerErrors,
    } = validateManagerUserId(
      Object.hasOwn(source, 'managerUserId') ? source.managerUserId : source.manager_id,
      {
        allowNull: true,
        field: Object.hasOwn(source, 'manager_id') ? 'manager_id' : 'managerUserId',
      },
    );
    errors.push(...managerErrors);
    if (managerUserId !== undefined) {
      dto.managerUserId = managerUserId;
    }
  }

  return { dto, errors };
}

export function validateUpdateAdvertiserInternalNoteDto(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  if (!Object.hasOwn(source, 'internalNote') && !Object.hasOwn(source, 'internal_note')) {
    errors.push(buildError('internalNote', 'internalNote обязателен'));
    return { dto, errors };
  }

  const rawValue = Object.hasOwn(source, 'internalNote')
    ? source.internalNote
    : source.internal_note;

  if (rawValue !== null && typeof rawValue !== 'string') {
    errors.push(buildError('internalNote', 'internalNote должен быть строкой или null'));
    return { dto, errors };
  }

  dto.internalNote = normalizeOptionalText(rawValue);
  return { dto, errors };
}

export function validateAdvertiserStatusFilter(value) {
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

export function validateAdvertiserListFilters(payload = {}) {
  const errors = [];
  const filter = {};
  const pagination = {};

  if (Object.hasOwn(payload, 'status')) {
    const { value: status, errors: statusErrors } = validateAdvertiserStatusFilter(
      payload.status,
    );
    errors.push(...statusErrors);
    if (status) {
      filter.status = status;
    }
  }

  if (Object.hasOwn(payload, 'managerUserId')) {
    const {
      value: managerUserId,
      errors: managerErrors,
    } = validateManagerUserId(payload.managerUserId, {
      allowNull: false,
      field: 'managerUserId',
    });
    errors.push(...managerErrors);
    if (managerUserId) {
      filter.managerUserId = managerUserId;
    }
  }

  if (Object.hasOwn(payload, 'manager_id')) {
    const {
      value: managerUserId,
      errors: managerErrors,
    } = validateManagerUserId(payload.manager_id, {
      allowNull: false,
      field: 'manager_id',
    });
    errors.push(...managerErrors);
    if (managerUserId) {
      filter.managerUserId = managerUserId;
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

export function validateAssignAdvertiserManagerDto(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  if (!Object.hasOwn(source, 'managerUserId') && !Object.hasOwn(source, 'manager_id')) {
    errors.push(buildError('managerUserId', 'managerUserId обязателен'));
    return { dto, errors };
  }

  const {
    value: managerUserId,
    errors: managerErrors,
  } = validateManagerUserId(
    Object.hasOwn(source, 'managerUserId') ? source.managerUserId : source.manager_id,
    {
      allowNull: true,
      field: Object.hasOwn(source, 'manager_id') ? 'manager_id' : 'managerUserId',
    },
  );
  errors.push(...managerErrors);

  if (managerErrors.length === 0) {
    dto.managerUserId = managerUserId;
  }

  return { dto, errors };
}
