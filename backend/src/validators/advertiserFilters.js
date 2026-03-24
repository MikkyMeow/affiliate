const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function buildError(field, message) {
  return { field, message };
}

export function parseInteger(value) {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
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

export function readPage(value, errors, { defaultValue = 1 } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1) {
    errors.push(buildError('page', 'page должно быть целым числом от 1'));
    return defaultValue;
  }

  return parsed;
}

export function readPageSize(
  value,
  errors,
  { defaultValue = 20, max = 100, field = 'pageSize' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = parseInteger(value);
  if (parsed === null || parsed < 1 || parsed > max) {
    errors.push(
      buildError(field, `${field} должно быть целым числом от 1 до ${max}`),
    );
    return defaultValue;
  }

  return parsed;
}

function readDate(value, field, errors) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push(buildError(field, 'Дата должна быть строкой'));
    return undefined;
  }

  const normalized = value.trim();
  if (!dateRegex.test(normalized)) {
    errors.push(buildError(field, 'Дата должна быть в формате YYYY-MM-DD'));
    return undefined;
  }

  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    errors.push(buildError(field, 'Некорректная дата'));
    return undefined;
  }

  return normalized;
}

export function readDateRange(query = {}, errors, { allowEmpty = true } = {}) {
  const dateFrom = readDate(query.dateFrom, 'dateFrom', errors);
  const dateTo = readDate(query.dateTo, 'dateTo', errors);

  if (!allowEmpty && !dateFrom && !dateTo) {
    errors.push(buildError('dateFrom', 'dateFrom или dateTo обязательны'));
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    errors.push(buildError('dateFrom', 'dateFrom не может быть позже dateTo'));
  }

  return { dateFrom, dateTo };
}

export function readUuid(value, field, errors) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push(buildError(field, 'Значение должно быть строкой'));
    return undefined;
  }

  const normalized = value.trim();
  if (!uuidRegex.test(normalized)) {
    errors.push(buildError(field, 'Некорректный UUID'));
    return undefined;
  }

  return normalized;
}
