import pool from '../db.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { findOfferById } from '../models/offers.model.js';
import {
  findOfferGoalById,
  insertOfferGoal,
  listOfferGoalsByOfferId,
  unsetDefaultOfferGoals,
  updateOfferGoal as updateOfferGoalModel,
} from '../models/offerGoals.model.js';

function throwOfferNotFound(offerId) {
  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
    offerId,
  });
}

function throwGoalNotFound(offerId, goalId) {
  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Цель не найдена', {
    offerId,
    goalId,
  });
}

async function ensureOfferExists(offerId) {
  const offer = await findOfferById(offerId);

  if (!offer) {
    throwOfferNotFound(offerId);
  }

  return offer;
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeGoal(goal) {
  if (!goal) {
    return null;
  }

  const type =
    typeof goal.type === 'string'
      ? goal.type.toUpperCase()
      : goal.type ?? null;

  return {
    id: goal.id,
    offerId: goal.offerId,
    name: goal.name,
    type,
    revenue: toNumber(goal.revenue),
    payout: toNumber(goal.payout),
    currency: goal.currency,
    isDefault: goal.isDefault,
    isActive: goal.isActive,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
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
  return goals.map(serializeGoal);
}

export async function createOfferGoal(offerId, dto) {
  if (!offerId) {
    throw new Error('offerId is required to create goal');
  }

  if (!dto) {
    throw new Error('dto is required to create goal');
  }

  await ensureOfferExists(offerId);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (dto.isDefault) {
      await unsetDefaultOfferGoals(offerId, { client });
    }

    const goal = await insertOfferGoal(
      {
        offerId,
        name: dto.name,
        type: dto.type.toLowerCase(),
        revenue: dto.revenue,
        payout: dto.payout,
        currency: dto.currency ?? 'RUB',
        isDefault: Boolean(dto.isDefault),
        isActive: Object.hasOwn(dto, 'isActive') ? dto.isActive : true,
      },
      { client },
    );

    await client.query('COMMIT');
    return serializeGoal(goal);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOfferGoal(offerId, goalId, dto) {
  if (!offerId || !goalId) {
    throw new Error('offerId and goalId are required to update goal');
  }

  if (!dto) {
    throw new Error('dto is required to update goal');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingGoal = await findOfferGoalById(goalId, {
      client,
      forUpdate: true,
    });

    if (!existingGoal || existingGoal.offerId !== offerId) {
      throwGoalNotFound(offerId, goalId);
    }

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
        type: dto.type ? dto.type.toLowerCase() : undefined,
        revenue: Object.hasOwn(dto, 'revenue') ? dto.revenue : undefined,
        payout: Object.hasOwn(dto, 'payout') ? dto.payout : undefined,
        currency: dto.currency,
        isDefault: Object.hasOwn(dto, 'isDefault')
          ? Boolean(dto.isDefault)
          : undefined,
        isActive: Object.hasOwn(dto, 'isActive') ? dto.isActive : undefined,
      },
      { client },
    );

    await client.query('COMMIT');
    return serializeGoal(goal);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
