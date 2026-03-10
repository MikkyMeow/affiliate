import { validateEmail } from './affiliates.js';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const MIN_PASSWORD_LENGTH = 8;

function buildError(field, message) {
  return { field, message };
}

function normalizeDisplayName(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateAffiliateId(value) {
  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('affiliateId', 'affiliateId должен быть строкой')],
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return {
      value: undefined,
      errors: [buildError('affiliateId', 'affiliateId обязателен')],
    };
  }

  if (!UUID_REGEX.test(trimmed)) {
    return {
      value: undefined,
      errors: [buildError('affiliateId', 'Некорректный affiliateId')],
    };
  }

  return { value: trimmed, errors: [] };
}

function validatePassword(password) {
  if (typeof password !== 'string') {
    return {
      value: undefined,
      errors: [buildError('password', 'Пароль должен быть строкой')],
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      value: undefined,
      errors: [
        buildError(
          'password',
          `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`,
        ),
      ],
    };
  }

  return { value: password, errors: [] };
}

export function validateCreateAffiliateUserDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};

  const { value: email, errors: emailErrors } = validateEmail(source.email, {
    allowMissing: false,
  });
  errors.push(...emailErrors);
  if (email) {
    dto.email = email;
  }

  const { value: password, errors: passwordErrors } = validatePassword(
    source.password,
  );
  errors.push(...passwordErrors);
  if (password) {
    dto.password = password;
  }

  const displayName = normalizeDisplayName(source.displayName);
  if (displayName === null) {
    errors.push(
      buildError('displayName', 'displayName должен быть непустой строкой или опущен'),
    );
  } else if (displayName !== undefined) {
    dto.displayName = displayName;
  }

  const {
    value: affiliateId,
    errors: affiliateIdErrors,
  } = validateAffiliateId(source.affiliateId);
  errors.push(...affiliateIdErrors);
  if (affiliateId) {
    dto.affiliateId = affiliateId;
  }

  return { dto, errors };
}
