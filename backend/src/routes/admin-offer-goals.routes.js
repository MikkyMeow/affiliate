import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendList, sendSuccess } from '../utils/response.js';
import { validateUuid } from '../validators/offers.js';
import {
  validateCreateOfferGoalPayload,
  validateUpdateOfferGoalPayload,
} from '../validators/offerGoals.js';
import {
  createOfferGoal,
  listOfferGoals,
  updateOfferGoal,
} from '../services/offer-goals.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin', 'manager'));

router.get(
  '/:offerId/goals',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors } = validateUuid(req.params?.offerId, {
      allowMissing: false,
      field: 'offerId',
    });

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const goals = await listOfferGoals(offerId);
    return sendList(res, goals);
  }),
);

router.post(
  '/:offerId/goals',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: idErrors } = validateUuid(
      req.params?.offerId,
      {
        allowMissing: false,
        field: 'offerId',
      },
    );

    const { dto, errors: bodyErrors } = validateCreateOfferGoalPayload(req.body);
    const errors = [...idErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const goal = await createOfferGoal(offerId, dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });
    return sendSuccess(res, { goal }, { status: 201 });
  }),
);

router.patch(
  '/:offerId/goals/:goalId',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(
      req.params?.offerId,
      {
        allowMissing: false,
        field: 'offerId',
      },
    );
    const { value: goalId, errors: goalErrors } = validateUuid(
      req.params?.goalId,
      {
        allowMissing: false,
        field: 'goalId',
      },
    );

    const { dto, errors: bodyErrors } = validateUpdateOfferGoalPayload(
      req.body,
    );

    const errors = [...offerErrors, ...goalErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const goal = await updateOfferGoal(offerId, goalId, dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });
    return sendSuccess(res, { goal });
  }),
);

export default router;
