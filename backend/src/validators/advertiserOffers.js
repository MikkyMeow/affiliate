import {
  OFFER_STATUSES,
  LEGACY_OFFER_STATUS_INACTIVE,
} from '../constants/offers.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const allowedStatuses = new Set([
  ...Object.values(OFFER_STATUSES),
  LEGACY_OFFER_STATUS_INACTIVE,
]);

function buildError(field, message) {
  return { field, message };
}

function parseInteger(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (!/^-?\d+$/.test(trimmed)) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeSearch(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function validateAdvertiserOfferListQuery(query = {}) {
  const errors = [];

  let page = DEFAULT_PAGE;
  const hasPage = query.page !== undefined && query.page !== null && query.page !== '';

  if (hasPage) {
    const parsed = parseInteger(query.page);
    if (parsed === null || parsed < 1) {
      errors.push(buildError('page', 'page должно быть целым числом от 1'));
    } else {
      page = parsed;
    }
  }

  let pageSize = DEFAULT_PAGE_SIZE;
  const hasPageSize =
    query.pageSize !== undefined && query.pageSize !== null && query.pageSize !== '';

  if (hasPageSize) {
    const parsed = parseInteger(query.pageSize);
    if (parsed === null || parsed < 1 || parsed > MAX_PAGE_SIZE) {
      errors.push(
        buildError(
          'pageSize',
          `pageSize должно быть целым числом от 1 до ${MAX_PAGE_SIZE}`,
        ),
      );
    } else {
      pageSize = parsed;
    }
  }

  let status = null;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (typeof query.status !== 'string') {
      errors.push(buildError('status', 'status должен быть строкой'));
    } else {
      const normalized = query.status.trim().toLowerCase();
      if (!allowedStatuses.has(normalized)) {
        errors.push(buildError('status', 'Недопустимый статус'));
      } else {
        status = normalized;
      }
    }
  }

  const search = normalizeSearch(query.search);

  return {
    pagination: { page, pageSize },
    filters: { status, search },
    errors,
  };
}
