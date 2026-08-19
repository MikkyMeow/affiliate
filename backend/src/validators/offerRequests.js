import { OFFER_REQUEST_STATUSES } from '../constants/offers.js';
import {
  getQueryValue,
  validateDateRange,
  validateOrder,
  validatePagination,
  validateSearch,
  validateSort,
} from '../utils/adminList.js';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_NOTE_LENGTH = 1000;
const ALLOWED_DECISIONS = new Set(['approved', 'rejected']);
const ALLOWED_REQUEST_STATUSES = new Set(Object.values(OFFER_REQUEST_STATUSES));
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const OFFER_REQUEST_LIST_SORTS = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  status: 'status',
};

function buildError(field, message) {
  return { field, message };
}

function validateRequestMessage(value) {
  if (value === undefined || value === null) {
    return { value: null, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('message', 'message должен быть строкой')],
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null, errors: [] };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      value: undefined,
      errors: [
        buildError(
          'message',
          `message не должен превышать ${MAX_MESSAGE_LENGTH} символов`,
        ),
      ],
    };
  }

  return { value: trimmed, errors: [] };
}

export function validateOfferRequestPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  const { value: message, errors: messageErrors } = validateRequestMessage(
    source.message,
  );
  errors.push(...messageErrors);
  if (message !== undefined) {
    dto.message = message;
  }

  return { dto, errors };
}

function validateDecision(value) {
  if (value === undefined || value === null) {
    return {
      value: undefined,
      errors: [buildError('decision', 'decision обязателен')],
    };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('decision', 'decision должен быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return {
      value: undefined,
      errors: [buildError('decision', 'decision не может быть пустым')],
    };
  }

  if (!ALLOWED_DECISIONS.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError('decision', 'decision должен быть approved или rejected'),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateNote(value) {
  if (value === undefined || value === null) {
    return { value: null, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('note', 'note должен быть строкой')],
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null, errors: [] };
  }

  if (trimmed.length > MAX_NOTE_LENGTH) {
    return {
      value: undefined,
      errors: [
        buildError(
          'note',
          `note не должен превышать ${MAX_NOTE_LENGTH} символов`,
        ),
      ],
    };
  }

  return { value: trimmed, errors: [] };
}

export function validateOfferRequestDecisionPayload(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};

  const { value: decision, errors: decisionErrors } = validateDecision(
    source.decision,
  );
  errors.push(...decisionErrors);
  if (decision !== undefined) {
    dto.decision = decision;
  }

  const { value: note, errors: noteErrors } = validateNote(source.note);
  errors.push(...noteErrors);
  if (note !== undefined) {
    dto.note = note;
  }

  return { dto, errors };
}

function validateUuidFilter(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim();
  if (!UUID_REGEX.test(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть корректным UUID`)],
    };
  }

  return { value: normalized, errors: [] };
}

function validateStatusFilter(value) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError('status', 'status должен быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_REQUEST_STATUSES.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          'status',
          `status должен быть одним из: ${Array.from(ALLOWED_REQUEST_STATUSES).join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateAdminOfferRequestListQuery(payload = {}) {
  const errors = [];
  const filter = {};
  const { pagination, errors: paginationErrors } = validatePagination(payload, {
    defaultLimit: 20,
    maxLimit: 100,
  });
  errors.push(...paginationErrors);

  const { value: search, errors: searchErrors } = validateSearch(
    getQueryValue(payload, 'search'),
  );
  errors.push(...searchErrors);
  if (search) {
    filter.search = search;
  }

  const { value: sort, errors: sortErrors } = validateSort(
    getQueryValue(payload, 'sort', 'sortBy', 'sort_by'),
    OFFER_REQUEST_LIST_SORTS,
    { defaultValue: 'createdAt' },
  );
  errors.push(...sortErrors);
  if (sort) {
    pagination.sort = sort;
  }

  const { value: order, errors: orderErrors } = validateOrder(
    getQueryValue(payload, 'order', 'sortOrder', 'sort_order'),
    { defaultValue: 'desc' },
  );
  errors.push(...orderErrors);
  if (order) {
    pagination.order = order;
  }

  const { value: status, errors: statusErrors } = validateStatusFilter(
    getQueryValue(payload, 'status'),
  );
  errors.push(...statusErrors);
  if (status) {
    filter.status = status;
  }

  const { value: offerId, errors: offerErrors } = validateUuidFilter(
    getQueryValue(payload, 'offerId', 'offer_id'),
    'offerId',
  );
  errors.push(...offerErrors);
  if (offerId) {
    filter.offerId = offerId;
  }

  const { value: affiliateId, errors: affiliateErrors } = validateUuidFilter(
    getQueryValue(payload, 'affiliateId', 'affiliate_id', 'partnerId', 'partner_id'),
    'affiliateId',
  );
  errors.push(...affiliateErrors);
  if (affiliateId) {
    filter.affiliateId = affiliateId;
  }

  const { dateFrom, dateTo } = validateDateRange(payload, errors);
  if (dateFrom) {
    filter.dateFrom = dateFrom;
  }
  if (dateTo) {
    filter.dateTo = dateTo;
  }

  return {
    filter,
    pagination,
    errors,
  };
}
