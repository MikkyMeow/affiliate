import { OFFER_ACCESS_TYPES } from '../constants/offers.js';

const allowedAccessTypes = new Set(Object.values(OFFER_ACCESS_TYPES));

function buildError(field, message) {
  return { field, message };
}

function normalizeAccessType(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function validateManualAccessPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  const normalizedAccess = normalizeAccessType(source.accessType);

  if (!normalizedAccess) {
    errors.push(buildError('accessType', 'accessType обязателен'));
  } else if (!allowedAccessTypes.has(normalizedAccess)) {
    errors.push(buildError('accessType', 'Недопустимое значение accessType'));
  } else {
    dto.accessType = normalizedAccess;
  }

  return { dto, errors };
}
