import pool from '../db.js';
import { findAffiliatesByIds, findAffiliateById } from '../models/affiliateModel.js';
import {
  createConversion,
  findByClickIdAndGoalIdForUpdate,
  findByOfferGoalAndExternalTransactionId,
  getCountedConversionCountByGoalId,
  getCountedConversionCountsByGoalIds,
} from '../models/conversions.model.js';
import {
  deleteOfferGoalAffiliateRate as deleteOfferGoalAffiliateRateModel,
  findOfferGoalAffiliateRate,
  listOfferGoalAffiliateRatesByGoalId,
  listOfferGoalAffiliateRatesByGoalIds,
  upsertOfferGoalAffiliateRate as upsertOfferGoalAffiliateRateModel,
} from '../models/offerGoalAffiliateRates.model.js';
import {
  findOfferGoalById,
  insertOfferGoal,
  listOfferGoalsByOfferId,
  unsetDefaultOfferGoals,
  updateOfferGoal as updateOfferGoalModel,
} from '../models/offerGoals.model.js';
import { findOfferById } from '../models/offers.model.js';
import { COUNTED_CONVERSION_STATUSES } from '../constants/conversions.js';
import {
  OFFER_GOAL_CURRENCY,
  OFFER_GOAL_LIMIT_TYPES,
} from '../constants/offers.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { writeAuditEvent } from './audit.service.js';

function throwOfferNotFound(offerId) {
  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
    offerId,
  });
}

function throwGoalNotFound(offerId, goalId) {
  throw new ApiError(
    ERROR_CODES.GOAL_NOT_FOUND_FOR_OFFER,
    404,
    'Goal does not belong to this offer',
    {
      offerId,
      goalId,
    },
  );
}

function throwGoalRequired(offerId) {
  throw new ApiError(ERROR_CODES.GOAL_REQUIRED, 400, 'goalId обязателен', {
    offerId,
  });
}

function throwAffiliateNotFound(affiliateId) {
  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Партнёр не найден', {
    affiliateId,
  });
}

function throwGoalAffiliateRateNotFound(offerId, goalId, affiliateId) {
  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Переопределение ставки не найдено', {
    offerId,
    goalId,
    affiliateId,
  });
}

function throwGoalLimitReached(offerId, goalId) {
  throw new ApiError(
    ERROR_CODES.GOAL_LIMIT_REACHED,
    409,
    'Goal limit has been reached',
    {
      offerId,
      goalId,
    },
  );
}

function throwValidationError(errors) {
  throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
    errors,
  });
}

async function ensureOfferExists(offerId) {
  const offer = await findOfferById(offerId);

  if (!offer) {
    throwOfferNotFound(offerId);
  }

  return offer;
}

async function ensureAffiliateExists(affiliateId) {
  const affiliate = await findAffiliateById(affiliateId);

  if (!affiliate) {
    throwAffiliateNotFound(affiliateId);
  }

  return affiliate;
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatGoalType(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized.toUpperCase() : null;
}

function calculateProfit(revenue, payout) {
  if (typeof revenue !== 'number' || typeof payout !== 'number') {
    return null;
  }

  return Number((revenue - payout).toFixed(2));
}

function normalizeLimitValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function buildLimitPayload(goal, limitUsed = 0) {
  const limitEnabled = Boolean(goal.limitEnabled);
  const limitValue = normalizeLimitValue(goal.limitValue);
  const normalizedLimitUsed = Number(limitUsed ?? 0);

  if (!limitEnabled || limitValue === null) {
    return {
      limitEnabled,
      limitType: limitEnabled ? goal.limitType ?? null : null,
      limitValue: limitEnabled ? limitValue : null,
      limitUsed: normalizedLimitUsed,
      limitRemaining: null,
      limitReached: false,
    };
  }

  return {
    limitEnabled,
    limitType: goal.limitType ?? OFFER_GOAL_LIMIT_TYPES.CONVERSIONS_COUNT,
    limitValue,
    limitUsed: normalizedLimitUsed,
    limitRemaining: Math.max(limitValue - normalizedLimitUsed, 0),
    limitReached: normalizedLimitUsed >= limitValue,
  };
}

function serializeAdminGoal(goal, { limitUsed = 0 } = {}) {
  if (!goal) {
    return null;
  }

  const revenue = toNumber(goal.revenue);
  const payout = toNumber(goal.payout);
  const limit = buildLimitPayload(goal, limitUsed);

  return {
    id: goal.id,
    offerId: goal.offerId,
    name: goal.name,
    type: formatGoalType(goal.type),
    revenue,
    payout,
    profit: calculateProfit(revenue, payout),
    currency: goal.currency ?? OFFER_GOAL_CURRENCY,
    isDefault: Boolean(goal.isDefault),
    ...limit,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function serializePartnerGoal(goal, effectiveRate, { limitUsed = 0 } = {}) {
  if (!goal || !effectiveRate) {
    return null;
  }

  const limit = buildLimitPayload(goal, limitUsed);

  return {
    id: goal.id,
    offerId: goal.offerId,
    name: goal.name,
    type: formatGoalType(goal.type),
    payout: effectiveRate.payout,
    currency: OFFER_GOAL_CURRENCY,
    isDefault: Boolean(goal.isDefault),
    limitReached: limit.limitReached,
  };
}

function getActorMetadata(actor) {
  if (!actor) {
    return { actorUserId: null, actorRole: null };
  }

  return {
    actorUserId: actor.userId ?? null,
    actorRole: actor.role ?? null,
  };
}

function serializeGoalAuditValue(goal) {
  if (!goal) {
    return null;
  }

  const revenue = toNumber(goal.revenue);
  const payout = toNumber(goal.payout);
  const limit = buildLimitPayload(goal, 0);

  return {
    name: goal.name ?? null,
    type: formatGoalType(goal.type),
    revenue,
    payout,
    profit: calculateProfit(revenue, payout),
    currency: goal.currency ?? OFFER_GOAL_CURRENCY,
    isDefault: Boolean(goal.isDefault),
    limitEnabled: limit.limitEnabled,
    limitType: limit.limitType,
    limitValue: limit.limitValue,
  };
}

function serializeRateAuditValue(rate) {
  if (!rate) {
    return null;
  }

  const revenue = toNumber(rate.revenue);
  const payout = toNumber(rate.payout);

  return {
    revenue,
    payout,
    profit: calculateProfit(revenue, payout),
    currency: OFFER_GOAL_CURRENCY,
  };
}

function diffObjects(previous, next, fields) {
  const changes = {};

  for (const field of fields) {
    const before = previous?.[field] ?? null;
    const after = next?.[field] ?? null;

    if (before !== after) {
      changes[field] = { old: before, new: after };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

function assertMoneyRules({ revenue, payout }) {
  const errors = [];

  if (typeof revenue !== 'number' || !Number.isFinite(revenue) || revenue < 0) {
    errors.push({ field: 'revenue', message: 'revenue должен быть числом >= 0' });
  }

  if (typeof payout !== 'number' || !Number.isFinite(payout) || payout < 0) {
    errors.push({ field: 'payout', message: 'payout должен быть числом >= 0' });
  }

  if (
    typeof revenue === 'number' &&
    Number.isFinite(revenue) &&
    typeof payout === 'number' &&
    Number.isFinite(payout) &&
    payout > revenue
  ) {
    errors.push({ field: 'payout', message: 'payout не может быть больше revenue' });
  }

  if (errors.length > 0) {
    throwValidationError(errors);
  }
}

function assertGoalCurrency(currency) {
  if (currency !== OFFER_GOAL_CURRENCY) {
    throwValidationError([
      {
        field: 'currency',
        message: `Поддерживается только ${OFFER_GOAL_CURRENCY}`,
      },
    ]);
  }
}

function normalizeGoalState(goal) {
  return {
    name: goal.name,
    type: typeof goal.type === 'string' ? goal.type.toLowerCase() : goal.type,
    revenue: toNumber(goal.revenue),
    payout: toNumber(goal.payout),
    currency: goal.currency ?? OFFER_GOAL_CURRENCY,
    isDefault: Boolean(goal.isDefault),
    limitEnabled: Boolean(goal.limitEnabled),
    limitType: goal.limitEnabled ? goal.limitType ?? null : null,
    limitValue: goal.limitEnabled ? normalizeLimitValue(goal.limitValue) : null,
  };
}

function assertGoalLimitState(goal) {
  if (!goal.limitEnabled) {
    return;
  }

  if (goal.limitType !== OFFER_GOAL_LIMIT_TYPES.CONVERSIONS_COUNT) {
    throwValidationError([
      {
        field: 'limitType',
        message: `Поддерживается только ${OFFER_GOAL_LIMIT_TYPES.CONVERSIONS_COUNT}`,
      },
    ]);
  }

  if (!Number.isInteger(goal.limitValue) || goal.limitValue <= 0) {
    throwValidationError([
      {
        field: 'limitValue',
        message: 'limitValue должен быть положительным целым числом',
      },
    ]);
  }
}

async function ensureGoalBelongsToOffer(
  offerId,
  goalId,
  { client, forUpdate = false } = {},
) {
  const goal = await findOfferGoalById(goalId, { client, forUpdate });

  if (!goal || goal.offerId !== offerId) {
    throwGoalNotFound(offerId, goalId);
  }

  return goal;
}

async function getGoalLimitUsageMap(goals, { client } = {}) {
  const goalIds = goals.map((goal) => goal.id);
  return getCountedConversionCountsByGoalIds(goalIds, { client });
}

function buildEffectiveRate(goal, overrideRate = null) {
  const source = overrideRate ? 'affiliate_override' : 'base';
  const revenue = toNumber(overrideRate?.revenue ?? goal.revenue);
  const payout = toNumber(overrideRate?.payout ?? goal.payout);

  assertMoneyRules({ revenue, payout });

  return {
    revenue,
    payout,
    profit: calculateProfit(revenue, payout),
    currency: OFFER_GOAL_CURRENCY,
    source,
  };
}

export async function resolveGoalRate(
  goalId,
  affiliateId,
  { client, forUpdate = false } = {},
) {
  const goal = await findOfferGoalById(goalId, { client, forUpdate });

  if (!goal) {
    throw new Error('Goal not found');
  }

  const overrideRate = affiliateId
    ? await findOfferGoalAffiliateRate(goal.id, affiliateId, { client, forUpdate })
    : null;

  return buildEffectiveRate(goal, overrideRate);
}

export async function resolveGoalForConversion(
  {
    offerId,
    goalId = null,
    affiliateId,
  },
  {
    client,
    forUpdate = false,
    enforceLimit = false,
  } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to resolve goal');
  }

  if (!goalId) {
    throwGoalRequired(offerId);
  }

  const goal = await ensureGoalBelongsToOffer(offerId, goalId, { client, forUpdate });

  const rate = await resolveGoalRate(goal.id, affiliateId, { client, forUpdate });
  const limitUsed = await getCountedConversionCountByGoalId(goal.id, { client });
  const limit = buildLimitPayload(goal, limitUsed);

  if (enforceLimit && limit.limitReached) {
    throwGoalLimitReached(offerId, goal.id);
  }

  return {
    id: goal.id,
    offerId: goal.offerId,
    name: goal.name ?? null,
    type: formatGoalType(goal.type),
    revenue: rate.revenue,
    payout: rate.payout,
    profit: rate.profit,
    currency: OFFER_GOAL_CURRENCY,
    source: rate.source,
    isDefault: Boolean(goal.isDefault),
    ...limit,
  };
}

async function writeGoalAuditEvents({
  previous,
  next,
  actor,
  requestId,
}) {
  const { actorUserId, actorRole } = getActorMetadata(actor);
  const previousAudit = serializeGoalAuditValue(previous);
  const nextAudit = serializeGoalAuditValue(next);
  const trackedFields = [
    'name',
    'type',
    'revenue',
    'payout',
    'profit',
    'currency',
    'isDefault',
    'limitEnabled',
    'limitType',
    'limitValue',
  ];

  const changes = diffObjects(previousAudit, nextAudit, trackedFields);
  if (!changes) {
    return;
  }

  const metadata = {
    offerId: next.offerId,
    goalId: next.id,
  };

  await writeAuditEvent({
    entityType: 'offer_goal',
    entityId: next.id,
    action: 'updated',
    actorUserId,
    actorRole,
    requestId,
    context: {
      oldValue: previousAudit,
      newValue: nextAudit,
      changes,
      metadata,
    },
  });

  if (changes.revenue || changes.payout || changes.profit) {
    await writeAuditEvent({
      entityType: 'offer_goal',
      entityId: next.id,
      action: 'financial_changed',
      actorUserId,
      actorRole,
      requestId,
      context: {
        oldValue: previousAudit,
        newValue: nextAudit,
        metadata,
      },
    });
  }

  if (changes.limitEnabled || changes.limitType || changes.limitValue) {
    await writeAuditEvent({
      entityType: 'offer_goal',
      entityId: next.id,
      action: 'limit_changed',
      actorUserId,
      actorRole,
      requestId,
      context: {
        oldValue: previousAudit,
        newValue: nextAudit,
        metadata,
      },
    });
  }
}

function serializeAffiliateRate(rate, affiliate = null) {
  if (!rate) {
    return null;
  }

  const revenue = toNumber(rate.revenue);
  const payout = toNumber(rate.payout);

  return {
    id: rate.id,
    offerGoalId: rate.offerGoalId,
    affiliateId: rate.affiliateId,
    revenue,
    payout,
    profit: calculateProfit(revenue, payout),
    currency: OFFER_GOAL_CURRENCY,
    createdAt: rate.createdAt,
    updatedAt: rate.updatedAt,
    affiliate: affiliate
      ? {
          id: affiliate.id,
          publicId: affiliate.publicId ?? null,
          name: affiliate.name ?? null,
          email: affiliate.email ?? null,
        }
      : null,
  };
}

export async function listOfferGoals(
  offerId,
  { skipOfferValidation = false } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to list goals');
  }

  if (!skipOfferValidation) {
    await ensureOfferExists(offerId);
  }

  const goals = await listOfferGoalsByOfferId(offerId);
  const usageMap = await getGoalLimitUsageMap(goals);

  return goals.map((goal) =>
    serializeAdminGoal(goal, {
      limitUsed: usageMap.get(goal.id) ?? 0,
    }),
  );
}

export async function listPartnerOfferGoals(offerId, affiliateId) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to list partner goals');
  }

  const goals = await listOfferGoalsByOfferId(offerId);
  if (goals.length === 0) {
    return [];
  }

  const [usageMap, overrideRates] = await Promise.all([
    getGoalLimitUsageMap(goals),
    listOfferGoalAffiliateRatesByGoalIds(
      goals.map((goal) => goal.id),
      { affiliateId },
    ),
  ]);

  const overrideMap = new Map(
    overrideRates.map((rate) => [rate.offerGoalId, rate]),
  );

  return goals.map((goal) =>
    serializePartnerGoal(goal, buildEffectiveRate(goal, overrideMap.get(goal.id) ?? null), {
      limitUsed: usageMap.get(goal.id) ?? 0,
    }),
  );
}

export async function createOfferGoal(offerId, dto, { actor = null, requestId = null } = {}) {
  if (!offerId) {
    throw new Error('offerId is required to create goal');
  }

  if (!dto) {
    throw new Error('dto is required to create goal');
  }

  await ensureOfferExists(offerId);

  const goalState = normalizeGoalState({
    ...dto,
    type: typeof dto.type === 'string' ? dto.type.toLowerCase() : dto.type,
    currency: dto.currency ?? OFFER_GOAL_CURRENCY,
  });

  assertGoalCurrency(goalState.currency);
  assertMoneyRules(goalState);
  assertGoalLimitState(goalState);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (goalState.isDefault) {
      await unsetDefaultOfferGoals(offerId, { client });
    }

    const goal = await insertOfferGoal(
      {
        offerId,
        name: goalState.name,
        type: goalState.type,
        revenue: goalState.revenue,
        payout: goalState.payout,
        currency: goalState.currency,
        isDefault: goalState.isDefault,
        limitEnabled: goalState.limitEnabled,
        limitType: goalState.limitEnabled ? goalState.limitType : null,
        limitValue: goalState.limitEnabled ? goalState.limitValue : null,
      },
      { client },
    );

    await client.query('COMMIT');

    const serialized = serializeAdminGoal(goal, { limitUsed: 0 });
    const { actorUserId, actorRole } = getActorMetadata(actor);

    await writeAuditEvent({
      entityType: 'offer_goal',
      entityId: serialized.id,
      action: 'created',
      actorUserId,
      actorRole,
      requestId,
      context: {
        newValue: serializeGoalAuditValue(goal),
        metadata: {
          offerId: serialized.offerId,
          goalId: serialized.id,
        },
      },
    });

    return serialized;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOfferGoal(
  offerId,
  goalId,
  dto,
  { actor = null, requestId = null } = {},
) {
  if (!offerId || !goalId) {
    throw new Error('offerId and goalId are required to update goal');
  }

  if (!dto) {
    throw new Error('dto is required to update goal');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingGoal = await ensureGoalBelongsToOffer(offerId, goalId, {
      client,
      forUpdate: true,
    });

    const existingState = normalizeGoalState(existingGoal);
    const nextState = normalizeGoalState({
      ...existingState,
      ...dto,
      type: typeof dto.type === 'string' ? dto.type.toLowerCase() : existingState.type,
      currency: dto.currency ?? existingState.currency,
      limitEnabled: Object.hasOwn(dto, 'limitEnabled')
        ? Boolean(dto.limitEnabled)
        : existingState.limitEnabled,
      limitType: Object.hasOwn(dto, 'limitType')
        ? dto.limitType
        : existingState.limitType,
      limitValue: Object.hasOwn(dto, 'limitValue')
        ? dto.limitValue
        : existingState.limitValue,
    });

    if (!nextState.limitEnabled) {
      nextState.limitType = null;
      nextState.limitValue = null;
    }

    assertGoalCurrency(nextState.currency);
    assertMoneyRules(nextState);
    assertGoalLimitState(nextState);

    if (dto.isDefault === true) {
      await unsetDefaultOfferGoals(offerId, {
        client,
        excludeGoalId: goalId,
      });
    }

    const goal = await updateOfferGoalModel(
      goalId,
      {
        name: dto.name,
        type: Object.hasOwn(dto, 'type') ? nextState.type : undefined,
        revenue: Object.hasOwn(dto, 'revenue') ? nextState.revenue : undefined,
        payout: Object.hasOwn(dto, 'payout') ? nextState.payout : undefined,
        currency: Object.hasOwn(dto, 'currency') ? nextState.currency : undefined,
        isDefault: Object.hasOwn(dto, 'isDefault') ? nextState.isDefault : undefined,
        limitEnabled: Object.hasOwn(dto, 'limitEnabled')
          ? nextState.limitEnabled
          : undefined,
        limitType:
          Object.hasOwn(dto, 'limitType') || Object.hasOwn(dto, 'limitEnabled')
            ? nextState.limitType
            : undefined,
        limitValue:
          Object.hasOwn(dto, 'limitValue') || Object.hasOwn(dto, 'limitEnabled')
            ? nextState.limitValue
            : undefined,
      },
      { client },
    );

    await client.query('COMMIT');

    const limitUsed = await getCountedConversionCountByGoalId(goal.id);
    const serialized = serializeAdminGoal(goal, { limitUsed });

    await writeGoalAuditEvents({
      previous: existingGoal,
      next: goal,
      actor,
      requestId,
    });

    return serialized;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listOfferGoalAffiliateRates(offerId, goalId) {
  if (!offerId || !goalId) {
    throw new Error('offerId and goalId are required to list affiliate rates');
  }

  await ensureOfferExists(offerId);
  await ensureGoalBelongsToOffer(offerId, goalId);

  const rates = await listOfferGoalAffiliateRatesByGoalId(goalId);
  const affiliates = await findAffiliatesByIds(rates.map((rate) => rate.affiliateId));
  const affiliateMap = new Map(affiliates.map((affiliate) => [affiliate.id, affiliate]));

  return rates.map((rate) =>
    serializeAffiliateRate(rate, affiliateMap.get(rate.affiliateId) ?? null),
  );
}

export async function upsertOfferGoalAffiliateRate(
  offerId,
  goalId,
  affiliateId,
  dto,
  { actor = null, requestId = null } = {},
) {
  if (!offerId || !goalId || !affiliateId) {
    throw new Error('offerId, goalId, and affiliateId are required to upsert affiliate rate');
  }

  if (!actor?.userId) {
    throw new Error('actor.userId is required to upsert affiliate rate');
  }

  assertMoneyRules(dto);
  await ensureOfferExists(offerId);
  await ensureAffiliateExists(affiliateId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await ensureGoalBelongsToOffer(offerId, goalId, {
      client,
      forUpdate: true,
    });

    const existingRate = await findOfferGoalAffiliateRate(goalId, affiliateId, {
      client,
      forUpdate: true,
    });

    const rate = await upsertOfferGoalAffiliateRateModel(
      {
        goalId,
        affiliateId,
        revenue: dto.revenue,
        payout: dto.payout,
        createdBy: existingRate?.createdBy ?? actor.userId,
        updatedBy: actor.userId,
      },
      { client },
    );

    await client.query('COMMIT');

    const { actorUserId, actorRole } = getActorMetadata(actor);
    const action = existingRate ? 'updated' : 'created';
    await writeAuditEvent({
      entityType: 'offer_goal_affiliate_rate',
      entityId: rate.id,
      action,
      actorUserId,
      actorRole,
      requestId,
      context: {
        oldValue: serializeRateAuditValue(existingRate),
        newValue: serializeRateAuditValue(rate),
        metadata: {
          offerId,
          goalId,
          affiliateId,
        },
      },
    });

    return serializeAffiliateRate(rate);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOfferGoalAffiliateRate(
  offerId,
  goalId,
  affiliateId,
  { actor = null, requestId = null } = {},
) {
  if (!offerId || !goalId || !affiliateId) {
    throw new Error('offerId, goalId, and affiliateId are required to delete affiliate rate');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await ensureGoalBelongsToOffer(offerId, goalId, {
      client,
      forUpdate: true,
    });

    const deleted = await deleteOfferGoalAffiliateRateModel(goalId, affiliateId, {
      client,
    });

    if (!deleted) {
      throwGoalAffiliateRateNotFound(offerId, goalId, affiliateId);
    }

    await client.query('COMMIT');

    const { actorUserId, actorRole } = getActorMetadata(actor);
    await writeAuditEvent({
      entityType: 'offer_goal_affiliate_rate',
      entityId: deleted.id,
      action: 'deleted',
      actorUserId,
      actorRole,
      requestId,
      context: {
        oldValue: serializeRateAuditValue(deleted),
        newValue: null,
        metadata: {
          offerId,
          goalId,
          affiliateId,
        },
      },
    });

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createConversionWithResolvedGoal(
  {
    clickId = null,
    offerId,
    affiliateId,
    source = 'tracking',
    manualAdjustmentBatchId = null,
    createdBy = null,
    status,
    goalId = null,
    externalTransactionId = null,
    createdAt = null,
  },
  {
    requestId = null,
    actor = null,
    client: providedClient = null,
  } = {},
) {
  const shouldManageTransaction = !providedClient;
  const client = providedClient ?? (await pool.connect());

  try {
    if (shouldManageTransaction) {
      await client.query('BEGIN');
    }

    const goalSnapshot = await resolveGoalForConversion(
      { offerId, goalId, affiliateId },
      { client, forUpdate: true, enforceLimit: false },
    );

    if (externalTransactionId) {
      const existingByExternalTransaction =
        await findByOfferGoalAndExternalTransactionId(
          offerId,
          goalSnapshot.id,
          externalTransactionId,
          { client, forUpdate: true },
        );

      if (existingByExternalTransaction) {
        throw new ApiError(
          ERROR_CODES.DUPLICATE_CONVERSION,
          409,
          'Конверсия уже существует',
          {
            clickId: existingByExternalTransaction.clickId,
            offerId: existingByExternalTransaction.offerId,
            affiliateId: existingByExternalTransaction.affiliateId,
            conversionId: existingByExternalTransaction.id,
            goalId: existingByExternalTransaction.goalId ?? goalSnapshot.id,
            externalTransactionId,
          },
        );
      }
    }

    if (clickId) {
      const existingConversion = await findByClickIdAndGoalIdForUpdate(
        clickId,
        goalSnapshot.id,
        { client },
      );
      if (existingConversion) {
        throw new ApiError(
          ERROR_CODES.DUPLICATE_CONVERSION,
          409,
          'Конверсия уже существует',
          {
            clickId,
            offerId: existingConversion.offerId,
            affiliateId: existingConversion.affiliateId,
            conversionId: existingConversion.id,
            goalId: existingConversion.goalId ?? goalSnapshot.id,
            externalTransactionId:
              existingConversion.externalTransactionId ?? externalTransactionId,
          },
        );
      }
    }

    if (goalSnapshot.limitReached) {
      throwGoalLimitReached(offerId, goalSnapshot.id);
    }

    const conversion = await createConversion(
      {
        clickId,
        offerId,
        affiliateId,
        source,
        manualAdjustmentBatchId,
        createdBy,
        status,
        payoutRub: goalSnapshot.payout,
        externalTransactionId,
        goalId: goalSnapshot.id,
        goalName: goalSnapshot.name,
        goalType: goalSnapshot.type,
        revenueAmount: goalSnapshot.revenue,
        payoutAmount: goalSnapshot.payout,
        createdAt,
      },
      { client },
    );

    if (shouldManageTransaction) {
      await client.query('COMMIT');
    }
    return { conversion, goalSnapshot };
  } catch (error) {
    if (shouldManageTransaction) {
      await client.query('ROLLBACK');
    }

    if (error instanceof ApiError && error.code === ERROR_CODES.GOAL_LIMIT_REACHED) {
      const { actorUserId, actorRole } = getActorMetadata(actor);
      const resolvedGoalId = error.details?.goalId ?? goalId ?? 'goal_resolution';
      await writeAuditEvent({
        entityType: 'offer_goal',
        entityId: resolvedGoalId,
        action: 'limit_rejected_conversion',
        actorUserId,
        actorRole,
        requestId,
        context: {
          metadata: {
            offerId,
            goalId: error.details?.goalId ?? goalId ?? null,
            affiliateId,
            clickId,
            countedStatuses: COUNTED_CONVERSION_STATUSES,
          },
        },
      });
    }

    throw error;
  } finally {
    if (shouldManageTransaction) {
      client.release();
    }
  }
}
