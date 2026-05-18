import pool from '../db.js';
import {
  createManualAdjustmentBatch as createManualAdjustmentBatchModel,
  findManualAdjustmentBatchById,
  listManualAdjustmentBatches as listManualAdjustmentBatchesModel,
  updateManualAdjustmentBatch,
} from '../models/manualAdjustmentBatches.model.js';
import {
  findAffiliateById,
  findAffiliateByPublicIdNumber,
} from '../models/affiliateModel.js';
import {
  findAdvertiserById,
  findAdvertiserByPublicIdNumber,
} from '../models/advertiserModel.js';
import { createClick } from '../models/clicks.model.js';
import {
  findOfferById,
  findOfferByPublicIdNumber,
} from '../models/offers.model.js';
import {
  findOfferGoalById,
  listOfferGoalsByOfferId,
} from '../models/offerGoals.model.js';
import {
  CLICK_DESTINATION_TYPES,
  CLICK_REDIRECT_OUTCOMES,
  CLICK_REDIRECT_OUTCOME_VALUES,
} from '../constants/clicks.js';
import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import {
  MANUAL_ADJUSTMENT_BATCH_STATUSES,
  MANUAL_ADJUSTMENT_LIMITS,
  MANUAL_ADJUSTMENT_TYPES,
  RECORD_SOURCES,
} from '../constants/adjustments.js';
import { parseCsv } from '../lib/csv.js';
import {
  parsePublicIdNumber,
  PUBLIC_ID_PREFIXES,
} from '../lib/public-id.js';
import { generateClickId } from '../lib/generateClickId.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { createConversionWithResolvedGoal } from './offer-goals.service.js';
import { writeAuditEvent } from './audit.service.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINANCIAL_COLUMNS = new Set([
  'revenue',
  'revenue_amount',
  'payout',
  'payout_amount',
  'payout_rub',
  'profit',
]);

const CLICK_DESTINATION_BY_RESULT = Object.freeze({
  [CLICK_REDIRECT_OUTCOMES.ALLOWED_TARGET_REDIRECT]:
    CLICK_DESTINATION_TYPES.TARGET,
  [CLICK_REDIRECT_OUTCOMES.FALLBACK_REDIRECT]:
    CLICK_DESTINATION_TYPES.FALLBACK,
  [CLICK_REDIRECT_OUTCOMES.INTERNAL_UNAVAILABLE_REDIRECT]:
    CLICK_DESTINATION_TYPES.INTERNAL_UNAVAILABLE,
});

function buildRowError(field, code, message) {
  return { field, code, message };
}

function throwValidationError(errors, message = 'Ошибка валидации') {
  throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, message, {
    errors,
  });
}

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeHeader(value) {
  return (value ?? '')
    .toString()
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

function normalizeRowValue(value) {
  return normalizeString(value);
}

function normalizeStatus(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function normalizeCountryCode(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function readAliasedCell(row, keys) {
  const values = keys
    .map((key) => normalizeRowValue(row[key]))
    .filter((value) => value !== undefined);

  if (values.length === 0) {
    return {
      value: undefined,
      values: [],
      conflict: false,
    };
  }

  const distinctValues = uniqueValues(values);

  return {
    value: distinctValues[0],
    values: distinctValues,
    conflict: distinctValues.length > 1,
  };
}

function assertNoAliasConflict({
  rowErrors,
  row,
  keys,
  field,
  code,
  label,
}) {
  if (!row.conflict) {
    return row.value;
  }

  rowErrors.push(
    buildRowError(
      field,
      code,
      `${label}: указаны конфликтующие значения в колонках ${keys.join(', ')}`,
    ),
  );
  return undefined;
}

function buildEntitySummary(entity, kind) {
  if (!entity) {
    return null;
  }

  if (kind === 'goal') {
    return {
      id: entity.id,
      name: entity.name ?? null,
    };
  }

  return {
    id: entity.id,
    publicId: entity.publicId ?? null,
    name: entity.name ?? entity.title ?? null,
  };
}

function serializeBatch(batch) {
  if (!batch) {
    return null;
  }

  const { metadata, ...rest } = batch;
  return rest;
}

function summarizePreviewRows(rows = []) {
  const validRows = [];
  const invalidRows = [];

  rows.forEach((row) => {
    if (row.valid) {
      validRows.push(row);
      return;
    }

    invalidRows.push(row);
  });

  const shownValidRows = validRows.slice(
    0,
    MANUAL_ADJUSTMENT_LIMITS.MAX_PREVIEW_VALID_ROWS,
  );

  const serializeRow = (row) => ({
    rowNumber: row.rowNumber,
    valid: Boolean(row.valid),
    resolved: row.resolved ?? {},
    errors: Array.isArray(row.errors) ? row.errors : [],
  });

  return {
    rows: [...invalidRows, ...shownValidRows]
      .sort((left, right) => left.rowNumber - right.rowNumber)
      .map(serializeRow),
    hiddenValidRows:
      validRows.length - shownValidRows.length,
  };
}

function parseCreatedAt(value, rowErrors) {
  const normalized = normalizeRowValue(value);

  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    rowErrors.push(
      buildRowError(
        'created_at',
        'INVALID_CREATED_AT',
        'created_at должен быть корректной датой',
      ),
    );
    return null;
  }

  return parsed.toISOString();
}

function parseClickResult(value, rowErrors) {
  const normalized = normalizeStatus(value);

  if (!normalized) {
    return undefined;
  }

  if (!CLICK_REDIRECT_OUTCOME_VALUES.includes(normalized)) {
    rowErrors.push(
      buildRowError(
        'status',
        'INVALID_CLICK_RESULT',
        `status/result должен быть одним из: ${CLICK_REDIRECT_OUTCOME_VALUES.join(', ')}`,
      ),
    );
    return undefined;
  }

  return normalized;
}

function parseConversionStatus(value, rowErrors) {
  const normalized = normalizeStatus(value);

  if (!normalized) {
    return undefined;
  }

  if (!CONVERSION_STATUS_VALUES.includes(normalized)) {
    rowErrors.push(
      buildRowError(
        'status',
        'INVALID_CONVERSION_STATUS',
        `status должен быть одним из: ${CONVERSION_STATUS_VALUES.join(', ')}`,
      ),
    );
    return undefined;
  }

  return normalized;
}

function parseCountry(value, rowErrors) {
  const normalized = normalizeCountryCode(value);

  if (!normalized) {
    return undefined;
  }

  if (!/^[A-Z]{2}$/.test(normalized)) {
    rowErrors.push(
      buildRowError(
        'country',
        'INVALID_COUNTRY',
        'country должен быть двухбуквенным кодом страны',
      ),
    );
    return undefined;
  }

  return normalized;
}

function readCsvRows(csvText) {
  let parsedRows;

  try {
    parsedRows = parseCsv(csvText);
  } catch (error) {
    throwValidationError(
      [
        buildRowError(
          'csvText',
          'INVALID_CSV',
          error instanceof Error ? error.message : 'Не удалось разобрать CSV',
        ),
      ],
      'Не удалось разобрать CSV',
    );
  }

  if (parsedRows.length === 0) {
    throwValidationError(
      [buildRowError('csvText', 'EMPTY_FILE', 'CSV файл пуст')],
      'CSV файл пуст',
    );
  }

  const [headerRow, ...dataRows] = parsedRows;
  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header));
  const headerSet = new Set();

  normalizedHeaders.forEach((header, index) => {
    if (!header) {
      throwValidationError(
        [
          buildRowError(
            'headers',
            'EMPTY_HEADER',
            `Пустой заголовок в колонке ${index + 1}`,
          ),
        ],
        'Ошибка CSV заголовков',
      );
    }

    if (headerSet.has(header)) {
      throwValidationError(
        [
          buildRowError(
            'headers',
            'DUPLICATE_HEADER',
            `Колонка ${header} указана больше одного раза`,
          ),
        ],
        'Ошибка CSV заголовков',
      );
    }

    headerSet.add(header);
  });

  const rows = dataRows
    .map((cells, index) => {
      const row = {};

      normalizedHeaders.forEach((header, headerIndex) => {
        row[header] = cells[headerIndex] ?? '';
      });

      return {
        rowNumber: index + 2,
        row,
      };
    })
    .filter(({ row }) =>
      Object.values(row).some((value) => normalizeRowValue(value) !== undefined),
    );

  return {
    headers: normalizedHeaders,
    rows,
  };
}

function createResolverCache() {
  return {
    affiliatesById: new Map(),
    affiliatesByPublicId: new Map(),
    advertisersById: new Map(),
    advertisersByPublicId: new Map(),
    offersById: new Map(),
    offersByPublicId: new Map(),
    goalsById: new Map(),
    goalsByOfferId: new Map(),
  };
}

async function resolveAffiliateIdentifier(rawValue, cache) {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim();
  if (isUuid(normalized)) {
    if (!cache.affiliatesById.has(normalized)) {
      cache.affiliatesById.set(
        normalized,
        await findAffiliateById(normalized),
      );
    }
    return cache.affiliatesById.get(normalized);
  }

  const publicIdNumber = parsePublicIdNumber(
    normalized,
    PUBLIC_ID_PREFIXES.affiliate,
  );
  if (publicIdNumber === null) {
    return undefined;
  }

  if (!cache.affiliatesByPublicId.has(publicIdNumber)) {
    cache.affiliatesByPublicId.set(
      publicIdNumber,
      await findAffiliateByPublicIdNumber(publicIdNumber),
    );
  }

  return cache.affiliatesByPublicId.get(publicIdNumber);
}

async function resolveAdvertiserIdentifier(rawValue, cache) {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim();
  if (isUuid(normalized)) {
    if (!cache.advertisersById.has(normalized)) {
      cache.advertisersById.set(
        normalized,
        await findAdvertiserById(normalized),
      );
    }
    return cache.advertisersById.get(normalized);
  }

  const publicIdNumber = parsePublicIdNumber(
    normalized,
    PUBLIC_ID_PREFIXES.advertiser,
  );
  if (publicIdNumber === null) {
    return undefined;
  }

  if (!cache.advertisersByPublicId.has(publicIdNumber)) {
    cache.advertisersByPublicId.set(
      publicIdNumber,
      await findAdvertiserByPublicIdNumber(publicIdNumber),
    );
  }

  return cache.advertisersByPublicId.get(publicIdNumber);
}

async function resolveOfferIdentifier(rawValue, cache) {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim();
  if (isUuid(normalized)) {
    if (!cache.offersById.has(normalized)) {
      cache.offersById.set(normalized, await findOfferById(normalized));
    }
    return cache.offersById.get(normalized);
  }

  const publicIdNumber = parsePublicIdNumber(
    normalized,
    PUBLIC_ID_PREFIXES.offer,
  );
  if (publicIdNumber === null) {
    return undefined;
  }

  if (!cache.offersByPublicId.has(publicIdNumber)) {
    cache.offersByPublicId.set(
      publicIdNumber,
      await findOfferByPublicIdNumber(publicIdNumber),
    );
  }

  return cache.offersByPublicId.get(publicIdNumber);
}

async function getGoalsForOffer(offerId, cache) {
  if (!cache.goalsByOfferId.has(offerId)) {
    cache.goalsByOfferId.set(offerId, await listOfferGoalsByOfferId(offerId));
  }

  return cache.goalsByOfferId.get(offerId);
}

async function resolveGoalIdentifier(rawValue, offer, cache) {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim();

  if (isUuid(normalized)) {
    if (!cache.goalsById.has(normalized)) {
      cache.goalsById.set(normalized, await findOfferGoalById(normalized));
    }

    const goal = cache.goalsById.get(normalized);
    if (!goal || goal.offerId !== offer.id) {
      return false;
    }

    return goal;
  }

  const goals = await getGoalsForOffer(offer.id, cache);
  const matchingGoals = goals.filter(
    (goal) => goal.name?.trim().toLowerCase() === normalized.toLowerCase(),
  );

  if (matchingGoals.length === 1) {
    return matchingGoals[0];
  }

  if (matchingGoals.length > 1) {
    return matchingGoals;
  }

  return false;
}

async function resolveDefaultEntities(dto, cache) {
  const errors = [];

  const defaultAffiliate = dto.affiliateId
    ? await resolveAffiliateIdentifier(dto.affiliateId, cache)
    : null;
  if (dto.affiliateId && defaultAffiliate === undefined) {
    errors.push(
      buildRowError(
        'affiliateId',
        'INVALID_PARTNER_IDENTIFIER',
        'affiliateId должен быть UUID или public ID партнёра',
      ),
    );
  } else if (dto.affiliateId && !defaultAffiliate) {
    errors.push(
      buildRowError(
        'affiliateId',
        'PARTNER_NOT_FOUND',
        `Партнёр ${dto.affiliateId} не найден`,
      ),
    );
  }

  const defaultOffer = dto.offerId
    ? await resolveOfferIdentifier(dto.offerId, cache)
    : null;
  if (dto.offerId && defaultOffer === undefined) {
    errors.push(
      buildRowError(
        'offerId',
        'INVALID_OFFER_IDENTIFIER',
        'offerId должен быть UUID или public ID оффера',
      ),
    );
  } else if (dto.offerId && !defaultOffer) {
    errors.push(
      buildRowError(
        'offerId',
        'OFFER_NOT_FOUND',
        `Оффер ${dto.offerId} не найден`,
      ),
    );
  }

  let defaultGoal = null;
  if (dto.goalId) {
    if (!defaultOffer) {
      errors.push(
        buildRowError(
          'goalId',
          'DEFAULT_OFFER_REQUIRED',
          'Для default goal необходимо выбрать default offer',
        ),
      );
    } else {
      const resolvedGoal = await resolveGoalIdentifier(
        dto.goalId,
        defaultOffer,
        cache,
      );

      if (resolvedGoal === false) {
        errors.push(
          buildRowError(
            'goalId',
            'GOAL_NOT_FOUND',
            `Goal ${dto.goalId} не найден для выбранного оффера`,
          ),
        );
      } else if (Array.isArray(resolvedGoal)) {
        errors.push(
          buildRowError(
            'goalId',
            'GOAL_AMBIGUOUS',
            `Goal ${dto.goalId} неоднозначен для выбранного оффера`,
          ),
        );
      } else {
        defaultGoal = resolvedGoal;
      }
    }
  }

  return {
    errors,
    defaultAffiliate,
    defaultOffer,
    defaultGoal,
  };
}

async function resolvePartnerForRow({
  row,
  rowErrors,
  partnerMode,
  defaultAffiliate,
  cache,
}) {
  if (partnerMode === 'single_partner') {
    return defaultAffiliate;
  }

  const partnerCell = readAliasedCell(row, ['partner_id', 'affiliate_id']);
  const partnerValue = assertNoAliasConflict({
    rowErrors,
    row: partnerCell,
    keys: ['partner_id', 'affiliate_id'],
    field: 'partner_id',
    code: 'PARTNER_ALIAS_CONFLICT',
    label: 'partner_id',
  });

  if (!partnerValue) {
    rowErrors.push(
      buildRowError(
        'partner_id',
        'PARTNER_REQUIRED',
        'partner_id обязателен в per_row режиме',
      ),
    );
    return null;
  }

  const affiliate = await resolveAffiliateIdentifier(partnerValue, cache);

  if (affiliate === undefined) {
    rowErrors.push(
      buildRowError(
        'partner_id',
        'INVALID_PARTNER_IDENTIFIER',
        'partner_id должен быть UUID или public ID партнёра',
      ),
    );
    return null;
  }

  if (!affiliate) {
    rowErrors.push(
      buildRowError(
        'partner_id',
        'PARTNER_NOT_FOUND',
        `Партнёр ${partnerValue} не найден`,
      ),
    );
    return null;
  }

  return affiliate;
}

async function resolveOfferForRow({
  row,
  rowErrors,
  defaultOffer,
  cache,
}) {
  const offerValue = normalizeRowValue(row.offer_id);
  if (!offerValue) {
    if (!defaultOffer) {
      rowErrors.push(
        buildRowError(
          'offer_id',
          'OFFER_REQUIRED',
          'offer_id обязателен, если default offer не выбран',
        ),
      );
      return null;
    }

    return defaultOffer;
  }

  const offer = await resolveOfferIdentifier(offerValue, cache);

  if (offer === undefined) {
    rowErrors.push(
      buildRowError(
        'offer_id',
        'INVALID_OFFER_IDENTIFIER',
        'offer_id должен быть UUID или public ID оффера',
      ),
    );
    return null;
  }

  if (!offer) {
    rowErrors.push(
      buildRowError(
        'offer_id',
        'OFFER_NOT_FOUND',
        `Оффер ${offerValue} не найден`,
      ),
    );
    return null;
  }

  return offer;
}

async function resolveAdvertiserForRow({
  row,
  offer,
  rowErrors,
  cache,
}) {
  const advertiserValue = normalizeRowValue(row.advertiser_id);

  if (!advertiserValue) {
    return null;
  }

  const advertiser = await resolveAdvertiserIdentifier(advertiserValue, cache);

  if (advertiser === undefined) {
    rowErrors.push(
      buildRowError(
        'advertiser_id',
        'INVALID_ADVERTISER_IDENTIFIER',
        'advertiser_id должен быть UUID или public ID рекламодателя',
      ),
    );
    return null;
  }

  if (!advertiser) {
    rowErrors.push(
      buildRowError(
        'advertiser_id',
        'ADVERTISER_NOT_FOUND',
        `Рекламодатель ${advertiserValue} не найден`,
      ),
    );
    return null;
  }

  if (offer && advertiser.id !== offer.advertiserId) {
    rowErrors.push(
      buildRowError(
        'advertiser_id',
        'ADVERTISER_OFFER_MISMATCH',
        `Оффер ${offer.publicId ?? offer.id} не принадлежит рекламодателю ${advertiser.publicId ?? advertiser.id}`,
      ),
    );
  }

  return advertiser;
}

async function resolveGoalForRow({
  row,
  offer,
  defaultGoal,
  rowErrors,
  cache,
  type,
}) {
  const goalValue = normalizeRowValue(row.goal_id);

  if (!goalValue) {
    if (defaultGoal && defaultGoal.offerId === offer.id) {
      return defaultGoal;
    }

    if (type === MANUAL_ADJUSTMENT_TYPES.CONVERSIONS) {
      rowErrors.push(
        buildRowError(
          'goal_id',
          'GOAL_REQUIRED',
          'goal_id обязателен, если default goal не выбран для этого оффера',
        ),
      );
    }

    return null;
  }

  const goal = await resolveGoalIdentifier(goalValue, offer, cache);

  if (goal === false) {
    rowErrors.push(
      buildRowError(
        'goal_id',
        'GOAL_NOT_FOUND',
        `Goal ${goalValue} не найден для оффера ${offer.publicId ?? offer.id}`,
      ),
    );
    return null;
  }

  if (Array.isArray(goal)) {
    rowErrors.push(
      buildRowError(
        'goal_id',
        'GOAL_AMBIGUOUS',
        `Goal ${goalValue} неоднозначен для оффера ${offer.publicId ?? offer.id}`,
      ),
    );
    return null;
  }

  return goal;
}

function buildPreviewRow({
  rowNumber,
  valid,
  resolved,
  errors,
  data,
}) {
  return {
    rowNumber,
    valid,
    resolved,
    errors,
    data,
  };
}

function buildConversionResolvedPayload({
  affiliate,
  offer,
  advertiser,
  goal,
  status,
  externalTransactionId,
  createdAt,
}) {
  return {
    affiliate: buildEntitySummary(affiliate),
    offer: buildEntitySummary(offer),
    advertiser: buildEntitySummary(advertiser),
    goal: buildEntitySummary(goal, 'goal'),
    status,
    externalId: externalTransactionId ?? null,
    createdAt,
  };
}

function buildClickResolvedPayload({
  affiliate,
  offer,
  advertiser,
  goal,
  status,
  countryCode,
  ip,
  createdAt,
}) {
  return {
    affiliate: buildEntitySummary(affiliate),
    offer: buildEntitySummary(offer),
    advertiser: buildEntitySummary(advertiser),
    goal: buildEntitySummary(goal, 'goal'),
    status: status ?? null,
    country: countryCode ?? null,
    ip: ip ?? null,
    createdAt,
  };
}

async function buildConversionPreviewRows({
  parsedRows,
  dto,
  defaultAffiliate,
  defaultOffer,
  defaultGoal,
  cache,
}) {
  const nowIso = new Date().toISOString();

  return Promise.all(
    parsedRows.map(async ({ rowNumber, row }) => {
      const rowErrors = [];
      const affiliate = await resolvePartnerForRow({
        row,
        rowErrors,
        partnerMode: dto.partnerMode,
        defaultAffiliate,
        cache,
      });
      const offer = await resolveOfferForRow({
        row,
        rowErrors,
        defaultOffer,
        cache,
      });
      const advertiser = offer
        ? await resolveAdvertiserForRow({
            row,
            offer,
            rowErrors,
            cache,
          })
        : null;
      const goal = offer
        ? await resolveGoalForRow({
            row,
            offer,
            defaultGoal,
            rowErrors,
            cache,
            type: dto.type,
          })
        : null;

      const statusCell = readAliasedCell(row, ['status']);
      const statusValue = assertNoAliasConflict({
        rowErrors,
        row: statusCell,
        keys: ['status'],
        field: 'status',
        code: 'STATUS_ALIAS_CONFLICT',
        label: 'status',
      });
      const status =
        parseConversionStatus(statusValue, rowErrors) ??
        dto.defaultStatus ??
        undefined;

      if (!status) {
        rowErrors.push(
          buildRowError(
            'status',
            'STATUS_REQUIRED',
            'status обязателен, если default status не выбран',
          ),
        );
      }

      const externalIdCell = readAliasedCell(row, [
        'external_id',
        'transaction_id',
      ]);
      const externalTransactionId = assertNoAliasConflict({
        rowErrors,
        row: externalIdCell,
        keys: ['external_id', 'transaction_id'],
        field: 'external_id',
        code: 'EXTERNAL_ID_ALIAS_CONFLICT',
        label: 'external_id',
      });

      const createdAt =
        (() => {
          const parsedCreatedAt = parseCreatedAt(row.created_at, rowErrors);
          return parsedCreatedAt === undefined ? nowIso : parsedCreatedAt;
        })();

      const valid =
        rowErrors.length === 0 &&
        affiliate &&
        offer &&
        goal &&
        status;

      return buildPreviewRow({
        rowNumber,
        valid: Boolean(valid),
        resolved: buildConversionResolvedPayload({
          affiliate,
          offer,
          advertiser,
          goal,
          status: status ?? null,
          externalTransactionId: externalTransactionId ?? null,
          createdAt,
        }),
        errors: rowErrors,
        data: valid
          ? {
              affiliateId: affiliate.id,
              offerId: offer.id,
              advertiserId: advertiser?.id ?? null,
              goalId: goal.id,
              status,
              externalTransactionId: externalTransactionId ?? null,
              createdAt,
              comment: normalizeRowValue(row.comment) ?? null,
            }
          : null,
      });
    }),
  );
}

async function buildClickPreviewRows({
  parsedRows,
  dto,
  defaultAffiliate,
  defaultOffer,
  defaultGoal,
  cache,
}) {
  const nowIso = new Date().toISOString();

  return Promise.all(
    parsedRows.map(async ({ rowNumber, row }) => {
      const rowErrors = [];
      const affiliate = await resolvePartnerForRow({
        row,
        rowErrors,
        partnerMode: dto.partnerMode,
        defaultAffiliate,
        cache,
      });
      const offer = await resolveOfferForRow({
        row,
        rowErrors,
        defaultOffer,
        cache,
      });
      const advertiser = offer
        ? await resolveAdvertiserForRow({
            row,
            offer,
            rowErrors,
            cache,
          })
        : null;
      const goal = offer
        ? await resolveGoalForRow({
            row,
            offer,
            defaultGoal,
            rowErrors,
            cache,
            type: dto.type,
          })
        : null;

      const statusCell = readAliasedCell(row, ['status', 'result']);
      const statusValue = assertNoAliasConflict({
        rowErrors,
        row: statusCell,
        keys: ['status', 'result'],
        field: 'status',
        code: 'STATUS_ALIAS_CONFLICT',
        label: 'status/result',
      });
      const status =
        parseClickResult(statusValue, rowErrors) ??
        dto.defaultStatus ??
        null;

      const countryCell = readAliasedCell(row, ['country', 'country_code']);
      const countryValue = assertNoAliasConflict({
        rowErrors,
        row: countryCell,
        keys: ['country', 'country_code'],
        field: 'country',
        code: 'COUNTRY_ALIAS_CONFLICT',
        label: 'country',
      });
      const countryCode = parseCountry(countryValue, rowErrors);
      const createdAt =
        (() => {
          const parsedCreatedAt = parseCreatedAt(row.created_at, rowErrors);
          return parsedCreatedAt === undefined ? nowIso : parsedCreatedAt;
        })();

      const valid = rowErrors.length === 0 && affiliate && offer;

      return buildPreviewRow({
        rowNumber,
        valid: Boolean(valid),
        resolved: buildClickResolvedPayload({
          affiliate,
          offer,
          advertiser,
          goal,
          status,
          countryCode: countryCode ?? null,
          ip: normalizeRowValue(row.ip) ?? null,
          createdAt,
        }),
        errors: rowErrors,
        data: valid
          ? {
              affiliateId: affiliate.id,
              offerId: offer.id,
              advertiserId: advertiser?.id ?? null,
              goalId: goal?.id ?? null,
              status,
              countryCode: countryCode ?? null,
              ip: normalizeRowValue(row.ip) ?? null,
              sub1: normalizeRowValue(row.sub1) ?? null,
              sub2: normalizeRowValue(row.sub2) ?? null,
              sub3: normalizeRowValue(row.sub3) ?? null,
              sub4: normalizeRowValue(row.sub4) ?? null,
              sub5: normalizeRowValue(row.sub5) ?? null,
              createdAt,
              comment: normalizeRowValue(row.comment) ?? null,
            }
          : null,
      });
    }),
  );
}

function collectIgnoredColumns(headers) {
  return headers.filter((header) => FINANCIAL_COLUMNS.has(header));
}

function validateCsvPayloadSize(csvText) {
  const byteLength = Buffer.byteLength(csvText, 'utf8');

  if (byteLength > MANUAL_ADJUSTMENT_LIMITS.MAX_FILE_BYTES) {
    throwValidationError([
      buildRowError(
        'csvText',
        'CSV_TOO_LARGE',
        `CSV файл не может быть больше ${Math.round(
          MANUAL_ADJUSTMENT_LIMITS.MAX_FILE_BYTES / (1024 * 1024),
        )} MB`,
      ),
    ]);
  }
}

function validateCsvRowCount(rowCount) {
  if (rowCount > MANUAL_ADJUSTMENT_LIMITS.MAX_ROWS) {
    throwValidationError([
      buildRowError(
        'csvText',
        'CSV_TOO_MANY_ROWS',
        `CSV файл не может содержать больше ${MANUAL_ADJUSTMENT_LIMITS.MAX_ROWS} строк`,
      ),
    ]);
  }
}

function buildBatchMetadata({
  headers,
  ignoredColumns,
  previewRows,
  result = null,
}) {
  return {
    preview: {
      headers,
      ignoredColumns,
      rows: previewRows,
    },
    result,
  };
}

async function writeBatchAuditEvent({
  batch,
  action,
  actor,
  requestId,
  context,
  client = null,
}) {
  return writeAuditEvent({
    entityType: 'manual_adjustment_batch',
    entityId: batch.id,
    action,
    actorUserId: actor?.userId ?? null,
    actorRole: actor?.role ?? null,
    requestId,
    context,
    client,
  });
}

function normalizeBatchResult(metadata) {
  const result = metadata?.result ?? null;

  if (!result) {
    return null;
  }

  return {
    created: Number(result.created ?? 0),
    skipped: Number(result.skipped ?? 0),
    errors: Array.isArray(result.errors) ? result.errors : [],
    createdItems: Array.isArray(result.createdItems)
      ? result.createdItems
      : [],
  };
}

function normalizeBatchPreview(metadata) {
  const preview = metadata?.preview ?? null;

  if (!preview) {
    return null;
  }

  const previewRows = Array.isArray(preview.rows) ? preview.rows : [];
  const summary = summarizePreviewRows(previewRows);

  return {
    headers: Array.isArray(preview.headers) ? preview.headers : [],
    ignoredColumns: Array.isArray(preview.ignoredColumns)
      ? preview.ignoredColumns
      : [],
    hiddenValidRows: summary.hiddenValidRows,
    rows: summary.rows,
  };
}

function normalizeExternalDuplicateError(error, rowNumber) {
  const details = error?.details ?? {};
  return {
    rowNumber,
    field: 'external_id',
    code: 'DUPLICATE_CONVERSION',
    message: error?.message ?? 'Конверсия уже существует',
    details: {
      conversionId: details.conversionId ?? null,
      goalId: details.goalId ?? null,
      externalTransactionId: details.externalTransactionId ?? null,
    },
  };
}

async function applyConversionRow({
  row,
  batchId,
  actor,
  requestId,
  client,
}) {
  try {
    const { conversion } = await createConversionWithResolvedGoal(
      {
        clickId: null,
        offerId: row.data.offerId,
        affiliateId: row.data.affiliateId,
        source: RECORD_SOURCES.MANUAL,
        manualAdjustmentBatchId: batchId,
        createdBy: actor.userId,
        status: row.data.status,
        goalId: row.data.goalId,
        externalTransactionId: row.data.externalTransactionId,
        createdAt: row.data.createdAt,
      },
      {
        actor,
        requestId,
        client,
      },
    );

    await writeAuditEvent({
      entityType: 'conversion',
      entityId: conversion.id,
      action: 'conversion.manual_created',
      actorUserId: actor.userId,
      actorRole: actor.role,
      requestId,
      context: {
        metadata: {
          batchId,
          rowNumber: row.rowNumber,
          offerId: conversion.offerId,
          affiliateId: conversion.affiliateId,
          goalId: conversion.goalId ?? null,
          status: conversion.status,
          source: conversion.source ?? RECORD_SOURCES.MANUAL,
        },
      },
      client,
    });

    return {
      created: true,
      item: {
        rowNumber: row.rowNumber,
        id: conversion.id,
        externalTransactionId: conversion.externalTransactionId ?? null,
      },
    };
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code === ERROR_CODES.DUPLICATE_CONVERSION
    ) {
      return {
        created: false,
        error: normalizeExternalDuplicateError(error, row.rowNumber),
      };
    }

    throw error;
  }
}

async function applyClickRow({
  row,
  batchId,
  actor,
  requestId,
  client,
}) {
  const clickId = generateClickId();
  const redirectOutcome = row.data.status ?? null;
  const click = await createClick(
    {
      clickId,
      canonicalClickId: clickId,
      offerId: row.data.offerId,
      affiliateId: row.data.affiliateId,
      goalId: row.data.goalId ?? null,
      ip: row.data.ip ?? null,
      sub1: row.data.sub1 ?? null,
      sub2: row.data.sub2 ?? null,
      sub3: row.data.sub3 ?? null,
      sub4: row.data.sub4 ?? null,
      sub5: row.data.sub5 ?? null,
      countryCode: row.data.countryCode ?? null,
      redirectOutcome,
      destinationType: redirectOutcome
        ? CLICK_DESTINATION_BY_RESULT[redirectOutcome] ?? null
        : null,
      source: RECORD_SOURCES.MANUAL,
      manualAdjustmentBatchId: batchId,
      createdBy: actor.userId,
      createdAt: row.data.createdAt,
    },
    { client },
  );

  await writeAuditEvent({
    entityType: 'click',
    entityId: click.id,
    action: 'click.manual_created',
    actorUserId: actor.userId,
    actorRole: actor.role,
    requestId,
    context: {
      metadata: {
        batchId,
        rowNumber: row.rowNumber,
        offerId: click.offerId,
        affiliateId: click.affiliateId,
        goalId: click.goalId ?? null,
        source: click.source ?? RECORD_SOURCES.MANUAL,
      },
    },
    client,
  });

  return {
    created: true,
    item: {
      rowNumber: row.rowNumber,
      id: click.id,
      clickId: click.clickId,
    },
  };
}

export async function previewManualAdjustmentBatch(
  dto,
  { actor, requestId = null } = {},
) {
  if (!actor?.userId) {
    throw new Error('actor.userId is required to preview adjustments');
  }

  validateCsvPayloadSize(dto.csvText);

  const parsed = readCsvRows(dto.csvText);
  validateCsvRowCount(parsed.rows.length);

  const cache = createResolverCache();
  const {
    errors: defaultErrors,
    defaultAffiliate,
    defaultOffer,
    defaultGoal,
  } = await resolveDefaultEntities(dto, cache);

  if (defaultErrors.length > 0) {
    throwValidationError(defaultErrors);
  }

  const previewRows =
    dto.type === MANUAL_ADJUSTMENT_TYPES.CONVERSIONS
      ? await buildConversionPreviewRows({
          parsedRows: parsed.rows,
          dto,
          defaultAffiliate,
          defaultOffer,
          defaultGoal,
          cache,
        })
      : await buildClickPreviewRows({
          parsedRows: parsed.rows,
          dto,
          defaultAffiliate,
          defaultOffer,
          defaultGoal,
          cache,
        });

  const totalRows = previewRows.length;
  const validRows = previewRows.filter((row) => row.valid).length;
  const invalidRows = totalRows - validRows;
  const ignoredColumns = collectIgnoredColumns(parsed.headers);
  const metadata = buildBatchMetadata({
    headers: parsed.headers,
    ignoredColumns,
    previewRows,
  });

  const batch = await createManualAdjustmentBatchModel(
    {
      type: dto.type,
      partnerMode: dto.partnerMode,
      defaultAffiliateId: defaultAffiliate?.id ?? null,
      defaultOfferId: defaultOffer?.id ?? null,
      defaultGoalId: defaultGoal?.id ?? null,
      defaultStatus: dto.defaultStatus ?? null,
      originalFilename: dto.originalFilename ?? null,
      totalRows,
      validRows,
      invalidRows,
      createdRows: 0,
      skippedRows: 0,
      status: MANUAL_ADJUSTMENT_BATCH_STATUSES.PREVIEWED,
      createdById: actor.userId,
      metadata,
    },
  );

  await writeBatchAuditEvent({
    batch,
    action: 'adjustment.preview_created',
    actor,
    requestId,
    context: {
      metadata: {
        batchId: batch.id,
        type: batch.type,
        filename: batch.originalFilename ?? null,
        counts: {
          totalRows,
          validRows,
          invalidRows,
        },
      },
    },
  });

  const summary = summarizePreviewRows(previewRows);

  return {
    batch: serializeBatch(batch),
    rows: summary.rows,
    hiddenValidRows: summary.hiddenValidRows,
    ignoredColumns,
  };
}

export async function applyManualAdjustmentBatch(batchId, { actor, requestId = null } = {}) {
  if (!actor?.userId) {
    throw new Error('actor.userId is required to apply adjustments');
  }

  const batch = await findManualAdjustmentBatchById(batchId, {
    includeMetadata: true,
  });

  if (!batch) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Batch не найден', {
      batchId,
    });
  }

  if (batch.status !== MANUAL_ADJUSTMENT_BATCH_STATUSES.PREVIEWED) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Batch уже применён или завершён с ошибкой',
      {
        batchId,
        status: batch.status,
      },
    );
  }

  const previewRows = Array.isArray(batch.metadata?.preview?.rows)
    ? batch.metadata.preview.rows
    : [];

  const validPreviewRows = previewRows.filter((row) => row.valid && row.data);

  if (validPreviewRows.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'В batch нет валидных строк для применения',
      { batchId },
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const createdItems = [];
    const errors = [];

    for (const row of validPreviewRows) {
      await client.query('SAVEPOINT adjustment_row');

      try {
        const result =
          batch.type === MANUAL_ADJUSTMENT_TYPES.CONVERSIONS
            ? await applyConversionRow({
                row,
                batchId,
                actor,
                requestId,
                client,
              })
            : await applyClickRow({
                row,
                batchId,
                actor,
                requestId,
                client,
              });

        if (result.created) {
          if (
            createdItems.length < MANUAL_ADJUSTMENT_LIMITS.MAX_DETAIL_CREATED_ITEMS
          ) {
            createdItems.push(result.item);
          }
        } else if (result.error) {
          errors.push(result.error);
        }

        await client.query('RELEASE SAVEPOINT adjustment_row');
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT adjustment_row');
        await client.query('RELEASE SAVEPOINT adjustment_row');

        if (
          batch.type === MANUAL_ADJUSTMENT_TYPES.CONVERSIONS &&
          error?.code === '23505'
        ) {
          errors.push({
            rowNumber: row.rowNumber,
            field: 'external_id',
            code: 'DUPLICATE_CONVERSION',
            message: 'Конверсия уже существует',
          });
          continue;
        }

        throw error;
      }
    }

    const createdCount = validPreviewRows.length - errors.length;
    const skippedCount = errors.length;
    const appliedAt = new Date().toISOString();
    const metadata = buildBatchMetadata({
      headers: batch.metadata?.preview?.headers ?? [],
      ignoredColumns: batch.metadata?.preview?.ignoredColumns ?? [],
      previewRows,
      result: {
        created: createdCount,
        skipped: skippedCount,
        errors,
        createdItems,
        appliedAt,
      },
    });

    const updatedBatch = await updateManualAdjustmentBatch(
      batch.id,
      {
        status: MANUAL_ADJUSTMENT_BATCH_STATUSES.APPLIED,
        createdRows: createdCount,
        skippedRows: skippedCount,
        appliedAt,
        metadata,
      },
      { client },
    );

    await writeBatchAuditEvent({
      batch: updatedBatch,
      action: 'adjustment.applied',
      actor,
      requestId,
      context: {
        metadata: {
          batchId: updatedBatch.id,
          type: updatedBatch.type,
          filename: updatedBatch.originalFilename ?? null,
          counts: {
            totalRows: updatedBatch.totalRows,
            validRows: updatedBatch.validRows,
            invalidRows: updatedBatch.invalidRows,
            createdRows: createdCount,
            skippedRows: skippedCount,
          },
        },
      },
      client,
    });

    await client.query('COMMIT');

    return {
      batch: serializeBatch(updatedBatch),
      result: normalizeBatchResult(metadata),
    };
  } catch (error) {
    await client.query('ROLLBACK');

    const failedBatch = await updateManualAdjustmentBatch(batch.id, {
      status: MANUAL_ADJUSTMENT_BATCH_STATUSES.FAILED,
      metadata: {
        ...batch.metadata,
        result: {
          created: 0,
          skipped: 0,
          errors: [
            {
              code: 'APPLY_FAILED',
              message:
                error instanceof Error ? error.message : 'Не удалось применить batch',
            },
          ],
        },
      },
    });

    await writeBatchAuditEvent({
      batch: failedBatch ?? batch,
      action: 'adjustment.apply_failed',
      actor,
      requestId,
      context: {
        metadata: {
          batchId: batch.id,
          type: batch.type,
          filename: batch.originalFilename ?? null,
          error:
            error instanceof Error ? error.message : 'Не удалось применить batch',
        },
      },
    });

    throw error;
  } finally {
    client.release();
  }
}

export async function listManualAdjustmentBatches(filter = {}, pagination = {}) {
  const { items, total } = await listManualAdjustmentBatchesModel(
    filter,
    pagination,
  );
  const limit = pagination.limit ?? 20;
  const page = pagination.page ?? 1;

  return {
    items,
    page,
    limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 0,
  };
}

export async function getManualAdjustmentBatchDetail(batchId) {
  const batch = await findManualAdjustmentBatchById(batchId, {
    includeMetadata: true,
  });

  if (!batch) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Batch не найден', {
      batchId,
    });
  }

  return {
    batch: serializeBatch(batch),
    preview: normalizeBatchPreview(batch.metadata),
    result: normalizeBatchResult(batch.metadata),
  };
}
