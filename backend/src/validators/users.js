import { ACCOUNT_TYPE_VALUES } from '../constants/accountTypes.js';
import { validateEmail } from './affiliates.js';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

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

function parseInteger(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }

    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || !/^-?\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

function validateAccountType(value) {
  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('accountType', 'accountType обязателен')],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return {
      value: undefined,
      errors: [buildError('accountType', 'accountType обязателен')],
    };
  }

  if (!ACCOUNT_TYPE_VALUES.includes(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          'accountType',
          `accountType должен быть одним из: ${ACCOUNT_TYPE_VALUES.join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

export function validatePassword(password, { field = 'password' } = {}) {
  if (typeof password !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Пароль должен быть строкой')],
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      value: undefined,
      errors: [
        buildError(
          field,
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

export function validateRegisterDto(payload) {
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

  const normalizedName = normalizeDisplayName(source.name ?? source.displayName);
  if (!normalizedName) {
    errors.push(
      buildError('name', 'Имя обязательно и должно быть непустой строкой'),
    );
  } else {
    dto.displayName = normalizedName;
  }

  const {
    value: accountType,
    errors: accountTypeErrors,
  } = validateAccountType(source.accountType);
  errors.push(...accountTypeErrors);
  if (accountType) {
    dto.accountType = accountType;
  }

  return { dto, errors };
}

export function validateCreateManagerDto(payload) {
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

  const normalizedName = normalizeDisplayName(source.displayName ?? source.name);
  if (!normalizedName) {
    errors.push(
      buildError('displayName', 'displayName обязателен и должен быть непустой строкой'),
    );
  } else {
    dto.displayName = normalizedName;
  }

  return { dto, errors };
}

export function validateUpdateManagerDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};
  let hasAtLeastOneField = false;

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

  if (Object.hasOwn(source, 'displayName') || Object.hasOwn(source, 'name')) {
    hasAtLeastOneField = true;
    const normalizedName = normalizeDisplayName(source.displayName ?? source.name);
    if (!normalizedName) {
      errors.push(
        buildError(
          'displayName',
          'displayName должен быть непустой строкой',
        ),
      );
    } else {
      dto.displayName = normalizedName;
    }
  }

  if (!hasAtLeastOneField) {
    errors.push(buildError(null, 'Нужно указать поля для обновления'));
  }

  return { dto, errors };
}

export function validateManagerListQuery(payload) {
  const source = payload ?? {};
  const errors = [];
  const filter = {};
  let limit = DEFAULT_LIMIT;
  let offset = DEFAULT_OFFSET;

  if (Object.hasOwn(source, 'search')) {
    if (source.search === null || source.search === undefined || source.search === '') {
      filter.search = undefined;
    } else if (typeof source.search !== 'string') {
      errors.push(buildError('search', 'search должен быть строкой'));
    } else if (source.search.trim().length > 0) {
      filter.search = source.search.trim();
    }
  }

  if (Object.hasOwn(source, 'limit')) {
    const parsedLimit = parseInteger(source.limit);
    if (parsedLimit === null || parsedLimit < 1 || parsedLimit > MAX_LIMIT) {
      errors.push(
        buildError('limit', `limit должен быть целым числом от 1 до ${MAX_LIMIT}`),
      );
    } else {
      limit = parsedLimit;
    }
  }

  if (Object.hasOwn(source, 'offset')) {
    const parsedOffset = parseInteger(source.offset);
    if (parsedOffset === null || parsedOffset < 0) {
      errors.push(buildError('offset', 'offset должен быть целым числом не меньше 0'));
    } else {
      offset = parsedOffset;
    }
  } else if (Object.hasOwn(source, 'page')) {
    const parsedPage = parseInteger(source.page);
    if (parsedPage === null || parsedPage < 1) {
      errors.push(buildError('page', 'page должен быть целым числом не меньше 1'));
    } else {
      offset = (parsedPage - 1) * limit;
    }
  }

  return {
    filter,
    pagination: { limit, offset },
    errors,
  };
}

export function validateChangePasswordDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};

  if (typeof source.currentPassword !== 'string' || source.currentPassword.length === 0) {
    errors.push(buildError('currentPassword', 'currentPassword обязателен'));
  } else {
    dto.currentPassword = source.currentPassword;
  }

  const { value: newPassword, errors: passwordErrors } = validatePassword(
    source.newPassword,
    { field: 'newPassword' },
  );
  errors.push(...passwordErrors);
  if (newPassword) {
    dto.newPassword = newPassword;
  }

  return { dto, errors };
}
