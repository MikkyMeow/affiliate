import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import { ERROR_CODES } from '../utils/response.js';
import {
  getQueryValue,
  validateBoolean,
  validateDateRange,
  validateOrder,
  validatePagination,
  validateSearch,
  validateSort,
  validateText,
} from '../utils/adminList.js';

const MAX_CLICK_ID_LENGTH = 255;
const MAX_TOKEN_LENGTH = 255;
const MAX_EXTERNAL_TRANSACTION_ID_LENGTH = 255;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSTBACK_LOG_STATUSES = new Set([
  'received',
  'processed',
  'rejected',
  'duplicate',
  'failed',
]);
const POSTBACK_LOG_LIST_SORTS = {
  createdAt: 'createdAt',
  status: 'status',
  errorCode: 'errorCode',
  requestId: 'requestId',
  clickId: 'clickId',
};

function buildError(field, message, code = null) {
  return { field, message, code };
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parsePayout(value) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, error: null };
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return { value: undefined, error: 'Некорректная сумма выплаты' };
  }

  if (num < 0) {
    return { value: undefined, error: 'Выплата не может быть отрицательной' };
  }

  return { value: num, error: null };
}

export function validatePostbackParams(source = {}) {
  const errors = [];
  const dto = { status: 'pending' };

  const rawToken = source.token;

  if (rawToken === undefined || rawToken === null) {
    errors.push(buildError('token', 'token обязателен'));
  } else if (typeof rawToken !== 'string') {
    errors.push(buildError('token', 'token должен быть строкой'));
  } else {
    const token = rawToken.trim();

    if (!token) {
      errors.push(buildError('token', 'token обязателен'));
    } else if (token.length > MAX_TOKEN_LENGTH) {
      errors.push(
        buildError('token', `token не должен превышать ${MAX_TOKEN_LENGTH} символов`),
      );
    } else {
      dto.token = token;
    }
  }

  const rawClickId = source.clickId ?? source.click_id;

  if (rawClickId === undefined || rawClickId === null) {
    errors.push(buildError('clickId', 'clickId обязателен'));
  } else if (typeof rawClickId !== 'string') {
    errors.push(buildError('clickId', 'clickId должен быть строкой'));
  } else {
    const clickId = rawClickId.trim();

    if (!clickId) {
      errors.push(buildError('clickId', 'clickId обязателен'));
    } else if (clickId.length > MAX_CLICK_ID_LENGTH) {
      errors.push(
        buildError('clickId', `clickId не должен превышать ${MAX_CLICK_ID_LENGTH} символов`),
      );
    } else {
      dto.clickId = clickId;
    }
  }

  const rawGoalId = source.goalId ?? source.goal_id ?? undefined;

  if (rawGoalId === undefined || rawGoalId === null) {
    errors.push(
      buildError('goalId', 'goalId обязателен', ERROR_CODES.GOAL_REQUIRED),
    );
  } else if (typeof rawGoalId !== 'string') {
    errors.push(buildError('goalId', 'goalId должен быть строкой'));
  } else {
    const goalId = rawGoalId.trim();

    if (!goalId) {
      errors.push(
        buildError('goalId', 'goalId обязателен', ERROR_CODES.GOAL_REQUIRED),
      );
    } else if (!UUID_REGEX.test(goalId)) {
      errors.push(buildError('goalId', 'goalId должен быть UUID'));
    } else {
      dto.goalId = goalId.toLowerCase();
    }
  }

  if (Object.hasOwn(source, 'status')) {
    const status = normalizeString(source.status);

    if (!status) {
      errors.push(buildError('status', 'status не может быть пустым'));
    } else {
      const normalized = status.toLowerCase();

      if (!CONVERSION_STATUS_VALUES.includes(normalized)) {
        errors.push(
          buildError(
            'status',
            `status должен быть одним из: ${CONVERSION_STATUS_VALUES.join(', ')}`,
          ),
        );
      } else {
        dto.status = normalized;
      }
    }
  }

  const rawPayoutSource =
    source.payoutRub ?? source.payout_rub ?? source.payout ?? undefined;

  const { value: payoutRub, error: payoutError } = parsePayout(rawPayoutSource);

  if (payoutError) {
    errors.push(buildError('payoutRub', payoutError));
  } else if (typeof payoutRub === 'number') {
    dto.payoutRub = payoutRub;
  }

  const rawExternalTransactionId =
    source.externalTransactionId ??
    source.externalTransactionID ??
    source.externalId ??
    source.external_id ??
    source.transactionId ??
    source.transaction_id ??
    undefined;

  if (
    rawExternalTransactionId !== undefined &&
    rawExternalTransactionId !== null &&
    rawExternalTransactionId !== ''
  ) {
    if (typeof rawExternalTransactionId !== 'string') {
      errors.push(
        buildError(
          'externalTransactionId',
          'externalTransactionId должен быть строкой',
        ),
      );
    } else {
      const externalTransactionId = rawExternalTransactionId.trim();

      if (!externalTransactionId) {
        errors.push(
          buildError(
            'externalTransactionId',
            'externalTransactionId не может быть пустым',
          ),
        );
      } else if (
        externalTransactionId.length > MAX_EXTERNAL_TRANSACTION_ID_LENGTH
      ) {
        errors.push(
          buildError(
            'externalTransactionId',
            `externalTransactionId не должен превышать ${MAX_EXTERNAL_TRANSACTION_ID_LENGTH} символов`,
          ),
        );
      } else {
        dto.externalTransactionId = externalTransactionId;
      }
    }
  }

  const rawSignature = source.signature ?? source.sig;

  if (rawSignature === undefined || rawSignature === null) {
    errors.push(buildError('signature', 'Подпись обязательна'));
  } else if (typeof rawSignature !== 'string') {
    errors.push(buildError('signature', 'Подпись должна быть строкой'));
  } else {
    const normalizedSignature = rawSignature.trim();

    if (!normalizedSignature) {
      errors.push(buildError('signature', 'Подпись обязательна'));
    } else {
      dto.signature = normalizedSignature;
    }
  }

  return { dto, errors };
}

function validateOptionalUuid(value, field) {
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
      errors: [buildError(field, `${field} должен быть UUID`)],
    };
  }

  return { value: normalized, errors: [] };
}

function validatePostbackLogStatus(value) {
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
  if (!POSTBACK_LOG_STATUSES.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          'status',
          `status должен быть одним из: ${Array.from(POSTBACK_LOG_STATUSES).join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateAdminPostbackLogListQuery(payload = {}) {
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
    POSTBACK_LOG_LIST_SORTS,
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

  const { value: status, errors: statusErrors } = validatePostbackLogStatus(
    getQueryValue(payload, 'status', 'result'),
  );
  errors.push(...statusErrors);
  if (status) {
    filter.status = status;
  }

  const { value: offerId, errors: offerErrors } = validateOptionalUuid(
    getQueryValue(payload, 'offerId', 'offer_id'),
    'offerId',
  );
  errors.push(...offerErrors);
  if (offerId) {
    filter.offerId = offerId;
  }

  const { value: goalId, errors: goalErrors } = validateOptionalUuid(
    getQueryValue(payload, 'goalId', 'goal_id'),
    'goalId',
  );
  errors.push(...goalErrors);
  if (goalId) {
    filter.goalId = goalId;
  }

  const { value: conversionId, errors: conversionErrors } = validateOptionalUuid(
    getQueryValue(payload, 'conversionId', 'conversion_id'),
    'conversionId',
  );
  errors.push(...conversionErrors);
  if (conversionId) {
    filter.conversionId = conversionId;
  }

  const { value: errorCode, errors: errorCodeErrors } = validateText(
    getQueryValue(payload, 'errorCode', 'error_code'),
    'errorCode',
  );
  errors.push(...errorCodeErrors);
  if (errorCode) {
    filter.errorCode = `%${errorCode}%`;
  }

  const { value: externalId, errors: externalIdErrors } = validateText(
    getQueryValue(payload, 'externalId', 'external_id', 'transactionId', 'transaction_id'),
    'externalId',
  );
  errors.push(...externalIdErrors);
  if (externalId) {
    filter.externalId = `%${externalId}%`;
  }

  const { value: isTest, errors: isTestErrors } = validateBoolean(
    getQueryValue(payload, 'isTest', 'is_test', 'test'),
    'isTest',
  );
  errors.push(...isTestErrors);
  if (typeof isTest === 'boolean') {
    filter.isTest = isTest;
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
