import { CLICK_REDIRECT_OUTCOME_VALUES } from '../constants/clicks.js';
import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import { parsePublicIdNumber, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const DASHBOARD_BUCKET_VALUES = new Set(['hour']);
const ADMIN_SUMMARY_GROUP_VALUES = new Set(['partner', 'offer', 'advertiser']);
const conversionStatuses = new Set(CONVERSION_STATUS_VALUES);
const clickRedirectOutcomes = new Set(CLICK_REDIRECT_OUTCOME_VALUES);

function buildError(field, message) {
  return { field, message };
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

function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isValidDateString(value) {
  if (!dateRegex.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
}

function getQueryValue(payload, ...keys) {
  for (const key of keys) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }

    const rawValue = payload[key];
    if (Array.isArray(rawValue)) {
      return rawValue[0];
    }

    return rawValue;
  }

  return undefined;
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function validateDate(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Дата должна быть строкой')],
    };
  }

  const normalized = value.trim();
  if (!dateRegex.test(normalized) || !isValidDateString(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Дата должна быть в формате YYYY-MM-DD')],
    };
  }

  return { value: normalized, errors: [] };
}

function validateTimezone(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'timezone должен быть строкой')],
    };
  }

  const normalized = value.trim();

  try {
    Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
  } catch {
    return {
      value: undefined,
      errors: [buildError(field, 'timezone должен быть корректным IANA timezone')],
    };
  }

  return { value: normalized, errors: [] };
}

function validateBucket(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: 'hour', errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'bucket должен быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (!DASHBOARD_BUCKET_VALUES.has(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Поддерживается только bucket=hour')],
    };
  }

  return { value: normalized, errors: [] };
}

function validateAdminSummaryGroupBy(value, field = 'groupBy') {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'groupBy должен быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (!ADMIN_SUMMARY_GROUP_VALUES.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          field,
          `Поддерживаются только groupBy=${Array.from(
            ADMIN_SUMMARY_GROUP_VALUES,
          ).join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateLimit(value) {
  if (value === undefined || value === null || value === '') {
    return { value: DEFAULT_LIMIT, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('limit', 'limit должен быть целым числом')],
    };
  }

  if (parsed <= 0) {
    return {
      value: undefined,
      errors: [buildError('limit', 'limit должен быть больше 0')],
    };
  }

  if (parsed > MAX_LIMIT) {
    return {
      value: undefined,
      errors: [buildError('limit', `limit не может быть больше ${MAX_LIMIT}`)],
    };
  }

  return { value: parsed, errors: [] };
}

function validateOffset(value) {
  if (value === undefined || value === null || value === '') {
    return { value: DEFAULT_OFFSET, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('offset', 'offset должен быть целым числом')],
    };
  }

  if (parsed < 0) {
    return {
      value: undefined,
      errors: [buildError('offset', 'offset не может быть отрицательным')],
    };
  }

  return { value: parsed, errors: [] };
}

function validatePage(value) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('page', 'page должен быть целым числом')],
    };
  }

  if (parsed < 1) {
    return {
      value: undefined,
      errors: [buildError('page', 'page должен быть не меньше 1')],
    };
  }

  return { value: parsed, errors: [] };
}

function validateTextFilter(value, field) {
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
  return normalized
    ? { value: normalized, errors: [] }
    : { value: undefined, errors: [] };
}

function validateBooleanFilter(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value === 'boolean') {
    return { value, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть булевым значением`)],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalized)) {
    return { value: true, errors: [] };
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return { value: false, errors: [] };
  }

  return {
    value: undefined,
    errors: [buildError(field, `${field} должен быть булевым значением`)],
  };
}

function validateNonNegativeNumber(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  const parsed = parseNumber(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть числом`)],
    };
  }

  if (parsed < 0) {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть неотрицательным`)],
    };
  }

  return { value: Number(parsed.toFixed(2)), errors: [] };
}

function validateEntityIdentifier(value, { field, prefix }) {
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
  if (!normalized) {
    return { value: undefined, errors: [] };
  }

  if (uuidRegex.test(normalized)) {
    return {
      value: { type: 'uuid', value: normalized },
      errors: [],
    };
  }

  const publicIdNumber = parsePublicIdNumber(normalized, prefix);
  if (publicIdNumber !== null) {
    return {
      value: { type: 'publicId', value: publicIdNumber },
      errors: [],
    };
  }

  return {
    value: undefined,
    errors: [buildError(field, `Некорректный идентификатор ${field}`)],
  };
}

function validateUuid(value, field) {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Значение должно быть строкой')],
    };
  }

  const normalized = value.trim();
  if (!uuidRegex.test(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Некорректный UUID')],
    };
  }

  return { value: normalized, errors: [] };
}

function validateConversionStatus(value, field = 'status') {
  if (value === undefined || value === null || value === '') {
    return { value: undefined, errors: [] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, `${field} должен быть строкой`)],
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!conversionStatuses.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          field,
          `Недопустимое значение статуса: ${CONVERSION_STATUS_VALUES.join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateClickResult(value, field = 'redirectOutcome') {
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
  if (!clickRedirectOutcomes.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(
          field,
          `Недопустимое значение результата: ${CLICK_REDIRECT_OUTCOME_VALUES.join(', ')}`,
        ),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

function validateAdminPagination(payload = {}) {
  const errors = [];
  const pagination = {};

  const { value: limit, errors: limitErrors } = validateLimit(payload.limit);
  errors.push(...limitErrors);

  const { value: offset, errors: offsetErrors } = validateOffset(payload.offset);
  errors.push(...offsetErrors);

  const { value: page, errors: pageErrors } = validatePage(payload.page);
  errors.push(...pageErrors);

  const resolvedLimit = typeof limit === 'number' ? limit : DEFAULT_LIMIT;
  let resolvedOffset = typeof offset === 'number' ? offset : DEFAULT_OFFSET;

  if (typeof page === 'number' && !Object.hasOwn(payload, 'offset')) {
    resolvedOffset = (page - 1) * resolvedLimit;
  }

  pagination.limit = resolvedLimit;
  pagination.offset = resolvedOffset;
  pagination.page =
    typeof page === 'number'
      ? page
      : Math.floor(resolvedOffset / resolvedLimit) + 1;

  return { pagination, errors };
}

function validatePaginationOnly(payload = {}) {
  const errors = [];
  const pagination = {};

  const { value: limit, errors: limitErrors } = validateLimit(payload.limit);
  errors.push(...limitErrors);
  if (typeof limit === 'number') {
    pagination.limit = limit;
  }

  const { value: offset, errors: offsetErrors } = validateOffset(payload.offset);
  errors.push(...offsetErrors);
  if (typeof offset === 'number') {
    pagination.offset = offset;
  }

  return { pagination, errors };
}

function applyOptionalDateFilters(payload, filter, errors) {
  const { value: dateFrom, errors: dateFromErrors } = validateDate(
    getQueryValue(payload, 'dateFrom', 'date_from'),
    'dateFrom',
  );
  errors.push(...dateFromErrors);
  if (dateFrom) {
    filter.dateFrom = dateFrom;
  }

  const { value: dateTo, errors: dateToErrors } = validateDate(
    getQueryValue(payload, 'dateTo', 'date_to'),
    'dateTo',
  );
  errors.push(...dateToErrors);
  if (dateTo) {
    filter.dateTo = dateTo;
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    errors.push(buildError('dateFrom', 'dateFrom не может быть позже dateTo'));
  }
}

function applyCommonEntityFilters(payload, filter, errors) {
  const { value: offerId, errors: offerErrors } = validateEntityIdentifier(
    getQueryValue(payload, 'offerId', 'offer_id'),
    { field: 'offerId', prefix: PUBLIC_ID_PREFIXES.offer },
  );
  errors.push(...offerErrors);
  if (offerId) {
    filter.offerId = offerId;
  }

  const affiliateRaw = getQueryValue(
    payload,
    'affiliateId',
    'affiliate_id',
    'partnerId',
    'partner_id',
  );
  const { value: affiliateId, errors: affiliateErrors } = validateEntityIdentifier(
    affiliateRaw,
    { field: 'affiliateId', prefix: PUBLIC_ID_PREFIXES.affiliate },
  );
  errors.push(...affiliateErrors);
  if (affiliateId) {
    filter.affiliateId = affiliateId;
  }

  const { value: advertiserId, errors: advertiserErrors } = validateEntityIdentifier(
    getQueryValue(payload, 'advertiserId', 'advertiser_id'),
    { field: 'advertiserId', prefix: PUBLIC_ID_PREFIXES.advertiser },
  );
  errors.push(...advertiserErrors);
  if (advertiserId) {
    filter.advertiserId = advertiserId;
  }
}

export function validateClicksListFilters(payload = {}) {
  const errors = [];
  const filter = {};
  const { pagination, errors: paginationErrors } = validateAdminPagination(payload);
  errors.push(...paginationErrors);

  applyOptionalDateFilters(payload, filter, errors);
  applyCommonEntityFilters(payload, filter, errors);

  const { value: countryCode, errors: countryErrors } = validateTextFilter(
    getQueryValue(payload, 'countryCode', 'country_code', 'country'),
    'countryCode',
  );
  errors.push(...countryErrors);
  if (countryCode) {
    filter.countryCode = countryCode.toUpperCase();
  }

  const rawResult = getQueryValue(
    payload,
    'redirectOutcome',
    'redirect_outcome',
    'result',
    'status',
  );
  const { value: redirectOutcome, errors: resultErrors } = validateClickResult(
    rawResult,
    'redirectOutcome',
  );
  errors.push(...resultErrors);
  if (redirectOutcome) {
    filter.redirectOutcome = redirectOutcome;
  }

  const textFilters = [
    ['clickId', ['clickId', 'click_id']],
    ['sub1', ['sub1']],
    ['sub2', ['sub2']],
    ['sub3', ['sub3']],
    ['sub4', ['sub4']],
    ['sub5', ['sub5']],
    ['ip', ['ip']],
  ];

  for (const [field, aliases] of textFilters) {
    const { value, errors: fieldErrors } = validateTextFilter(
      getQueryValue(payload, ...aliases),
      field,
    );
    errors.push(...fieldErrors);
    if (value) {
      filter[field] = value;
    }
  }

  return { filter, pagination, errors };
}

export function validateConversionsListFilters(payload = {}) {
  const errors = [];
  const filter = {};
  const { pagination, errors: paginationErrors } = validateAdminPagination(payload);
  errors.push(...paginationErrors);

  applyOptionalDateFilters(payload, filter, errors);
  applyCommonEntityFilters(payload, filter, errors);

  const { value: goalId, errors: goalErrors } = validateUuid(
    getQueryValue(payload, 'goalId', 'goal_id'),
    'goalId',
  );
  errors.push(...goalErrors);
  if (goalId) {
    filter.goalId = goalId;
  }

  const { value: status, errors: statusErrors } = validateConversionStatus(
    getQueryValue(payload, 'status'),
  );
  errors.push(...statusErrors);
  if (status) {
    filter.status = status;
  }

  const { value: clickId, errors: clickErrors } = validateTextFilter(
    getQueryValue(payload, 'clickId', 'click_id'),
    'clickId',
  );
  errors.push(...clickErrors);
  if (clickId) {
    filter.clickId = clickId;
  }

  const { value: conversionId, errors: conversionErrors } = validateUuid(
    getQueryValue(payload, 'conversionId', 'conversion_id'),
    'conversionId',
  );
  errors.push(...conversionErrors);
  if (conversionId) {
    filter.conversionId = conversionId;
  }

  const { value: externalTransactionId, errors: externalErrors } = validateTextFilter(
    getQueryValue(
      payload,
      'externalTransactionId',
      'external_transaction_id',
      'transactionId',
      'transaction_id',
      'externalId',
      'external_id',
    ),
    'externalTransactionId',
  );
  errors.push(...externalErrors);
  if (externalTransactionId) {
    filter.externalTransactionId = externalTransactionId;
  }

  const { value: revenueMin, errors: revenueMinErrors } = validateNonNegativeNumber(
    getQueryValue(payload, 'revenueMin', 'revenue_min', 'revenueFrom'),
    'revenueMin',
  );
  errors.push(...revenueMinErrors);
  if (revenueMin !== undefined) {
    filter.revenueMin = revenueMin;
  }

  const { value: revenueMax, errors: revenueMaxErrors } = validateNonNegativeNumber(
    getQueryValue(payload, 'revenueMax', 'revenue_max', 'revenueTo'),
    'revenueMax',
  );
  errors.push(...revenueMaxErrors);
  if (revenueMax !== undefined) {
    filter.revenueMax = revenueMax;
  }

  const { value: payoutMin, errors: payoutMinErrors } = validateNonNegativeNumber(
    getQueryValue(payload, 'payoutMin', 'payout_min', 'payoutFrom'),
    'payoutMin',
  );
  errors.push(...payoutMinErrors);
  if (payoutMin !== undefined) {
    filter.payoutMin = payoutMin;
  }

  const { value: payoutMax, errors: payoutMaxErrors } = validateNonNegativeNumber(
    getQueryValue(payload, 'payoutMax', 'payout_max', 'payoutTo'),
    'payoutMax',
  );
  errors.push(...payoutMaxErrors);
  if (payoutMax !== undefined) {
    filter.payoutMax = payoutMax;
  }

  if (getQueryValue(payload, 'source') !== undefined) {
    errors.push(
      buildError(
        'source',
        'source фильтр не поддерживается: в текущей модели конверсий нет поля source',
      ),
    );
  }

  if (getQueryValue(payload, 'isTest', 'is_test', 'test') !== undefined) {
    errors.push(
      buildError(
        'isTest',
        'isTest фильтр не поддерживается: в текущей модели конверсий нет test-флага',
      ),
    );
  }

  if (
    filter.revenueMin !== undefined &&
    filter.revenueMax !== undefined &&
    filter.revenueMin > filter.revenueMax
  ) {
    errors.push(buildError('revenueMin', 'revenueMin не может быть больше revenueMax'));
  }

  if (
    filter.payoutMin !== undefined &&
    filter.payoutMax !== undefined &&
    filter.payoutMin > filter.payoutMax
  ) {
    errors.push(buildError('payoutMin', 'payoutMin не может быть больше payoutMax'));
  }

  return { filter, pagination, errors };
}

export function validatePartnerClicksQuery(payload = {}) {
  return validatePaginationOnly(payload);
}

export function validatePartnerConversionsQuery(payload = {}) {
  const errors = [];
  const filter = {};

  const { pagination, errors: paginationErrors } = validatePaginationOnly(payload);
  errors.push(...paginationErrors);

  if (Object.hasOwn(payload, 'status')) {
    const { value: status, errors: statusErrors } = validateConversionStatus(payload.status);
    errors.push(...statusErrors);
    if (status) {
      filter.status = status;
    }
  }

  return { filter, pagination, errors };
}

function buildStatsSummaryFilter(payload = {}) {
  const errors = [];
  const filter = {};

  applyOptionalDateFilters(payload, filter, errors);

  const { value: offerId, errors: offerErrors } = validateUuid(
    payload.offerId,
    'offerId',
  );
  errors.push(...offerErrors);
  if (offerId) {
    filter.offerId = offerId;
  }

  const { value: affiliateId, errors: affiliateErrors } = validateUuid(
    payload.affiliateId,
    'affiliateId',
  );
  errors.push(...affiliateErrors);
  if (affiliateId) {
    filter.affiliateId = affiliateId;
  }

  if (Object.hasOwn(payload, 'goalId')) {
    const { value: goalId, errors: goalErrors } = validateUuid(
      payload.goalId,
      'goalId',
    );
    errors.push(...goalErrors);
    if (goalId) {
      filter.goalId = goalId;
    }
  }

  if (Object.hasOwn(payload, 'status')) {
    const { value: status, errors: statusErrors } = validateConversionStatus(payload.status);
    errors.push(...statusErrors);
    if (status) {
      filter.status = status;
    }
  }

  return { filter, errors };
}

export function validateStatsSummaryFilters(payload = {}) {
  return buildStatsSummaryFilter(payload);
}

function resolveDateRange(dateFrom, dateTo) {
  const todayUtc = new Date().toISOString().slice(0, 10);

  if (!dateFrom && !dateTo) {
    return { dateFrom: todayUtc, dateTo: todayUtc };
  }

  if (dateFrom && !dateTo) {
    return { dateFrom, dateTo: dateFrom };
  }

  if (!dateFrom && dateTo) {
    return { dateFrom: dateTo, dateTo };
  }

  return { dateFrom, dateTo };
}

export function validateDailySummaryFilters(payload = {}) {
  const errors = [];
  const filter = {};

  const { value: offerId, errors: offerErrors } = validateUuid(
    payload.offerId,
    'offerId',
  );
  errors.push(...offerErrors);
  if (offerId) {
    filter.offerId = offerId;
  }

  const { value: affiliateId, errors: affiliateErrors } = validateUuid(
    payload.affiliateId,
    'affiliateId',
  );
  errors.push(...affiliateErrors);
  if (affiliateId) {
    filter.affiliateId = affiliateId;
  }

  const { value: dateFromValue, errors: dateFromErrors } = validateDate(
    payload.dateFrom,
    'dateFrom',
  );
  errors.push(...dateFromErrors);

  const { value: dateToValue, errors: dateToErrors } = validateDate(
    payload.dateTo,
    'dateTo',
  );
  errors.push(...dateToErrors);

  const { dateFrom, dateTo } = resolveDateRange(dateFromValue, dateToValue);

  if (dateFrom > dateTo) {
    errors.push(buildError('dateFrom', 'dateFrom не может быть позже dateTo'));
  }

  filter.dateFrom = dateFrom;
  filter.dateTo = dateTo;

  return { filter, errors };
}

export function validateDashboardStatsQuery(payload = {}) {
  const errors = [];
  const query = {};

  const { value: date, errors: dateErrors } = validateDate(payload.date, 'date');
  errors.push(...dateErrors);
  if (date) {
    query.date = date;
  }

  const { value: timezone, errors: timezoneErrors } = validateTimezone(
    payload.timezone,
    'timezone',
  );
  errors.push(...timezoneErrors);
  if (timezone) {
    query.timezone = timezone;
  }

  const { value: bucket, errors: bucketErrors } = validateBucket(
    payload.bucket,
    'bucket',
  );
  errors.push(...bucketErrors);
  if (bucket) {
    query.bucket = bucket;
  }

  return { query, errors };
}

export function validateAdminStatsSummaryQuery(payload = {}) {
  const errors = [];
  const query = {};
  const responseFilters = {
    dateFrom: null,
    dateTo: null,
    offerId: null,
    affiliateId: null,
    advertiserId: null,
    groupBy: null,
  };

  const { value: dateFrom, errors: dateFromErrors } = validateDate(
    getQueryValue(payload, 'dateFrom', 'date_from'),
    'dateFrom',
  );
  errors.push(...dateFromErrors);
  if (dateFrom) {
    query.dateFrom = dateFrom;
    responseFilters.dateFrom = dateFrom;
  }

  const { value: dateTo, errors: dateToErrors } = validateDate(
    getQueryValue(payload, 'dateTo', 'date_to'),
    'dateTo',
  );
  errors.push(...dateToErrors);
  if (dateTo) {
    query.dateTo = dateTo;
    responseFilters.dateTo = dateTo;
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    errors.push(buildError('dateFrom', 'dateFrom не может быть позже dateTo'));
  }

  const rawOfferId = normalizeOptionalString(
    getQueryValue(payload, 'offerId', 'offer_id'),
  );
  const { value: offerId, errors: offerErrors } = validateEntityIdentifier(
    rawOfferId,
    { field: 'offerId', prefix: PUBLIC_ID_PREFIXES.offer },
  );
  errors.push(...offerErrors);
  if (offerId) {
    query.offerId = offerId;
    responseFilters.offerId = rawOfferId ?? null;
  }

  const rawAffiliateId = normalizeOptionalString(
    getQueryValue(payload, 'affiliateId', 'affiliate_id', 'partnerId', 'partner_id'),
  );
  const { value: affiliateId, errors: affiliateErrors } = validateEntityIdentifier(
    rawAffiliateId,
    { field: 'affiliateId', prefix: PUBLIC_ID_PREFIXES.affiliate },
  );
  errors.push(...affiliateErrors);
  if (affiliateId) {
    query.affiliateId = affiliateId;
    responseFilters.affiliateId = rawAffiliateId ?? null;
  }

  const rawAdvertiserId = normalizeOptionalString(
    getQueryValue(payload, 'advertiserId', 'advertiser_id'),
  );
  const { value: advertiserId, errors: advertiserErrors } = validateEntityIdentifier(
    rawAdvertiserId,
    { field: 'advertiserId', prefix: PUBLIC_ID_PREFIXES.advertiser },
  );
  errors.push(...advertiserErrors);
  if (advertiserId) {
    query.advertiserId = advertiserId;
    responseFilters.advertiserId = rawAdvertiserId ?? null;
  }

  const rawGroupBy = normalizeOptionalString(
    getQueryValue(payload, 'groupBy', 'group_by'),
  );
  const { value: groupBy, errors: groupByErrors } = validateAdminSummaryGroupBy(
    rawGroupBy,
  );
  errors.push(...groupByErrors);
  if (groupBy) {
    query.groupBy = groupBy;
    responseFilters.groupBy = groupBy;
  }

  query.responseFilters = responseFilters;

  return { query, errors };
}

function sanitizeAdvertiserFilter(filter = {}, errors = []) {
  const sanitized = {};

  if (filter.dateFrom) {
    sanitized.dateFrom = filter.dateFrom;
  }

  if (filter.dateTo) {
    sanitized.dateTo = filter.dateTo;
  }

  if (filter.offerId) {
    errors.push(buildError('offerId', 'offerId не поддерживается для этого запроса'));
  }

  if (filter.affiliateId) {
    errors.push(buildError('affiliateId', 'affiliateId не поддерживается для этого запроса'));
  }

  return sanitized;
}

export function validateAdvertiserStatsFilters(payload = {}) {
  const { filter, errors } = validateStatsSummaryFilters(payload);
  const sanitizedFilter = sanitizeAdvertiserFilter(filter, errors);
  return { filter: sanitizedFilter, errors };
}

export function validateAdvertiserOfferStatsFilters(payload = {}) {
  const { filter, errors } = validateStatsSummaryFilters(payload);
  const sanitizedFilter = sanitizeAdvertiserFilter(filter, errors);
  return { filter: sanitizedFilter, errors };
}
