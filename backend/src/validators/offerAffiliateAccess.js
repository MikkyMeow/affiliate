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

export function validateOfferAccessGrantPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  if (typeof source.affiliateId !== 'string' || source.affiliateId.trim().length === 0) {
    errors.push(buildError('affiliateId', 'affiliateId обязателен'));
  } else {
    dto.affiliateId = source.affiliateId.trim();
  }

  return { dto, errors };
}

export function validateOfferHidePayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  if (typeof source.affiliateId !== 'string' || source.affiliateId.trim().length === 0) {
    errors.push(buildError('affiliateId', 'affiliateId обязателен'));
  } else {
    dto.affiliateId = source.affiliateId.trim();
  }

  if (Object.hasOwn(source, 'reason')) {
    if (source.reason === null) {
      dto.reason = null;
    } else if (typeof source.reason !== 'string') {
      errors.push(buildError('reason', 'reason должен быть строкой'));
    } else {
      const normalized = source.reason.trim();
      dto.reason = normalized.length > 0 ? normalized : null;
    }
  }

  return { dto, errors };
}
