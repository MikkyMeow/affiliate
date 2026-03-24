import {
  buildError,
  readDateRange,
  readPage,
  readPageSize,
  readUuid,
} from './advertiserFilters.js';

const POSTBACK_LOG_STATUSES = new Set([
  'received',
  'processed',
  'rejected',
  'duplicate',
  'failed',
]);

function normalizeStatus(value, errors) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push(buildError('status', 'status должен быть строкой'));
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!POSTBACK_LOG_STATUSES.has(normalized)) {
    errors.push(
      buildError(
        'status',
        `Недопустимый статус. Допустимые: ${Array.from(POSTBACK_LOG_STATUSES).join(', ')}`,
      ),
    );
    return undefined;
  }

  return normalized;
}

export function validateAdvertiserPostbackListQuery(query = {}) {
  const errors = [];
  const page = readPage(query.page, errors);
  const pageSize = readPageSize(query.pageSize, errors, { defaultValue: 20, max: 100 });
  const { dateFrom, dateTo } = readDateRange(query, errors);
  const status = normalizeStatus(query.status, errors);
  const offerId = readUuid(query.offerId, 'offerId', errors);

  return {
    pagination: { page, pageSize },
    filters: {
      status,
      dateFrom,
      dateTo,
      offerId,
    },
    errors,
  };
}
