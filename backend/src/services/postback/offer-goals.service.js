import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import {
  findOfferGoalById,
  findDefaultActiveGoalByOfferId,
} from '../../models/offerGoals.model.js';

export const GOAL_ERROR_REASONS = {
  NOT_FOUND: 'goal_not_found',
  INACTIVE: 'goal_inactive',
  MISMATCH: 'goal_offer_mismatch',
  NO_DEFAULT: 'default_goal_missing',
  INVALID_PAYOUT: 'invalid_goal_payout',
  INVALID_REVENUE: 'invalid_goal_revenue',
};

function normalizeNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function formatGoalType(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function throwGoalError(reason, message, details = {}) {
  throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 422, message, {
    ...details,
    goalError: reason,
  });
}

async function loadGoal({ offerId, goalId }) {
  if (goalId) {
    const goal = await findOfferGoalById(goalId);

    if (!goal || goal.offerId !== offerId) {
      throwGoalError(GOAL_ERROR_REASONS.NOT_FOUND, 'Цель не найдена', {
        offerId,
        goalId,
      });
    }

    if (!goal.isActive) {
      throwGoalError(GOAL_ERROR_REASONS.INACTIVE, 'Цель неактивна', {
        offerId,
        goalId,
      });
    }

    return goal;
  }

  const defaultGoal = await findDefaultActiveGoalByOfferId(offerId);

  if (!defaultGoal) {
    throwGoalError(
      GOAL_ERROR_REASONS.NO_DEFAULT,
      'Активная цель по умолчанию не найдена',
      { offerId },
    );
  }

  return defaultGoal;
}

export async function resolveOfferGoalForPostback({ offerId, goalId }) {
  if (!offerId) {
    throw new Error('offerId is required to resolve goal');
  }

  const goal = await loadGoal({ offerId, goalId });
  const payout = normalizeNumber(goal.payout);
  const revenue = normalizeNumber(goal.revenue);

  if (payout === null || payout < 0) {
    throwGoalError(GOAL_ERROR_REASONS.INVALID_PAYOUT, 'Некорректный payout цели', {
      offerId,
      goalId: goal.id,
    });
  }

  if (revenue === null || revenue < 0) {
    throwGoalError(
      GOAL_ERROR_REASONS.INVALID_REVENUE,
      'Некорректный revenue цели',
      {
        offerId,
        goalId: goal.id,
      },
    );
  }

  return {
    id: goal.id,
    name: goal.name ?? null,
    type: formatGoalType(goal.type),
    revenue,
    payout,
  };
}
