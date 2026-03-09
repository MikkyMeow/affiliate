const allowedStatuses = new Set(['active', 'inactive']);

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

  const { value: status, errors: statusErrors } = validateStatus(source.status);
  errors.push(...statusErrors);

  if (status) {
    dto.status = status;
  }

  return { dto, errors };
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

export function validateAdvertiserStatusFilter(value) {
  return validateStatus(value);
}

export { allowedStatuses };
