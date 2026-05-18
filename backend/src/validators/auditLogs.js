import {
  getQueryValue,
  validateBoolean,
  validateDateRange,
  validatePagination,
  validateSearch,
  validateText,
} from '../utils/adminList.js';
import { validateUuid } from './offers.js';

const MAX_ENTITY_VALUE_LENGTH = 200;
const MAX_ACTION_LENGTH = 200;
const MAX_ENTITY_TYPE_LENGTH = 100;

function buildLengthError(field, maxLength) {
  return {
    field,
    message: `${field} не должен превышать ${maxLength} символов`,
  };
}

function validateBoundedText(value, field, maxLength) {
  const { value: normalizedValue, errors } = validateText(value, field);

  if (normalizedValue && normalizedValue.length > maxLength) {
    return {
      value: undefined,
      errors: [buildLengthError(field, maxLength)],
    };
  }

  return {
    value: normalizedValue,
    errors,
  };
}

export function validateAuditLogListQuery(payload = {}) {
  const errors = [];
  const { value: search, errors: searchErrors } = validateSearch(
    getQueryValue(payload, 'search'),
  );
  const { value: action, errors: actionErrors } = validateBoundedText(
    getQueryValue(payload, 'action'),
    'action',
    MAX_ACTION_LENGTH,
  );
  const { value: entityType, errors: entityTypeErrors } = validateBoundedText(
    getQueryValue(payload, 'entityType', 'entity_type'),
    'entityType',
    MAX_ENTITY_TYPE_LENGTH,
  );
  const { value: entityId, errors: entityIdErrors } = validateBoundedText(
    getQueryValue(payload, 'entityId', 'entity_id'),
    'entityId',
    MAX_ENTITY_VALUE_LENGTH,
  );
  const { value: actorId, errors: actorIdErrors } = validateUuid(
    getQueryValue(payload, 'actorId', 'actor_id'),
    {
      allowMissing: true,
      field: 'actorId',
    },
  );
  const { value: errorOnly, errors: errorOnlyErrors } = validateBoolean(
    getQueryValue(payload, 'errorOnly', 'error_only'),
    'errorOnly',
  );
  const { dateFrom, dateTo } = validateDateRange(payload, errors);
  const pagination = validatePagination(payload, {
    defaultLimit: 20,
    maxLimit: 100,
  });

  errors.push(
    ...searchErrors,
    ...actionErrors,
    ...entityTypeErrors,
    ...entityIdErrors,
    ...actorIdErrors,
    ...errorOnlyErrors,
    ...pagination.errors,
  );

  return {
    filter: {
      search,
      action,
      entityType,
      entityId,
      actorId,
      dateFrom,
      dateTo,
      errorOnly,
    },
    pagination: {
      limit: pagination.limit,
      offset: pagination.offset,
      page: pagination.page,
    },
    errors,
  };
}
