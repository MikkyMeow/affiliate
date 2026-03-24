export const SUB_PARAM_KEYS = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'];
export const MAX_SUB_PARAM_LENGTH = 255;
export const MAX_DEVICE_PARAM_LENGTH = 64;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function validateSubParam(key, value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return `${key} должен быть строкой`;
  }

  if (value.length > MAX_SUB_PARAM_LENGTH) {
    return `${key} не должен превышать ${MAX_SUB_PARAM_LENGTH} символов`;
  }

  return null;
}

export function validateDeviceParam(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return 'device должен быть строкой';
  }

  if (value.length > MAX_DEVICE_PARAM_LENGTH) {
    return `device не должен превышать ${MAX_DEVICE_PARAM_LENGTH} символов`;
  }

  return null;
}

export function validateTrackingQuery(params) {
  if (!params.offerId) {
    return { ok: false, message: 'offerId обязателен' };
  }

  if (!isValidUuid(params.offerId)) {
    return { ok: false, message: 'offerId должен быть валидным UUID' };
  }

  if (!params.affiliateId) {
    return { ok: false, message: 'affiliateId обязателен' };
  }

  if (!isValidUuid(params.affiliateId)) {
    return { ok: false, message: 'affiliateId должен быть валидным UUID' };
  }

  for (const key of SUB_PARAM_KEYS) {
    const error = validateSubParam(key, params[key]);

    if (error) {
      return { ok: false, message: error };
    }
  }

  const deviceError = validateDeviceParam(params.device);
  if (deviceError) {
    return { ok: false, message: deviceError };
  }

  return { ok: true };
}
