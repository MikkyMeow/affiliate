import { ACCOUNT_TYPE_VALUES } from '../constants/accountTypes.js';
import { validateEmail, validateTelegramValue } from './affiliates.js';
import { isValidTimeZone } from '../lib/timezone.js';
import {
  getQueryValue,
  validateOrder,
  validatePagination,
  validateSearch,
  validateSort,
} from '../utils/adminList.js';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const MANAGER_LIST_SORTS = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  displayName: 'displayName',
  email: 'email',
};

function buildError(field, message) {
  return { field, message };
}

function validateTimeZoneValue(value, { field = 'timezone' } = {}) {
  if (value === undefined) {
    return { value: undefined, errors: [] };
  }

  if (value === null) {
    return { value: null, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть строкой, null или опущен`)],
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null, errors: [] };
  }

  if (!isValidTimeZone(trimmed)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Некорректная timezone')],
    };
  }

  return { value: trimmed, errors: [] };
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
  const errors = [];
  const filter = {};
  const source = payload ?? {};
  const { pagination, errors: paginationErrors } = validatePagination(source, {
    defaultLimit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
  });
  errors.push(...paginationErrors);

  const { value: search, errors: searchErrors } = validateSearch(
    getQueryValue(source, 'search'),
  );
  errors.push(...searchErrors);
  if (search) {
    filter.search = search;
  }

  const { value: sort, errors: sortErrors } = validateSort(
    getQueryValue(source, 'sort', 'sortBy', 'sort_by'),
    MANAGER_LIST_SORTS,
    { defaultValue: 'createdAt' },
  );
  errors.push(...sortErrors);
  if (sort) {
    pagination.sort = sort;
  }

  const { value: order, errors: orderErrors } = validateOrder(
    getQueryValue(source, 'order', 'sortOrder', 'sort_order'),
    { defaultValue: 'desc' },
  );
  errors.push(...orderErrors);
  if (order) {
    pagination.order = order;
  }

  return {
    filter,
    pagination,
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

export function validateUpdateProfileDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};

  if (!Object.hasOwn(source, 'telegram') && !Object.hasOwn(source, 'timezone')) {
    errors.push(
      buildError(
        'profile',
        'Нужно передать хотя бы одно поле: telegram или timezone',
      ),
    );
    return { dto, errors };
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

  if (Object.hasOwn(source, 'timezone')) {
    const { value: timezone, errors: timezoneErrors } = validateTimeZoneValue(
      source.timezone,
    );
    errors.push(...timezoneErrors);

    if (timezone !== undefined) {
      dto.timezone = timezone;
    }
  }

  return { dto, errors };
}
