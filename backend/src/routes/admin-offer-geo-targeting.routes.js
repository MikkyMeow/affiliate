import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendList, sendSuccess } from '../utils/response.js';
import { validateUuid } from '../validators/offers.js';
import {
  validateCreateOfferGeoRulePayload,
  validateOfferTargetingStrictPayload,
} from '../validators/offerGeoRules.js';
import {
  createOfferGeoRule,
  listOfferGeoRules,
  removeOfferGeoRule,
} from '../services/offer-geo-rules.service.js';
import { updateOffer } from '../services/offers.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin', 'manager'));

router.get(
  '/:offerId/geo-rules',
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

    const rules = await listOfferGeoRules(offerId);
    return sendList(res, rules);
  }),
);

router.post(
  '/:offerId/geo-rules',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: idErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );

    const { dto, errors: bodyErrors } = validateCreateOfferGeoRulePayload(
      req.body,
    );
    const errors = [...idErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const rule = await createOfferGeoRule(offerId, dto);
    return sendSuccess(res, { rule }, { status: 201 });
  }),
);

router.delete(
  '/:offerId/geo-rules/:ruleId',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );
    const { value: ruleId, errors: ruleErrors } = validateUuid(
      req.params?.ruleId,
      { allowMissing: false, field: 'ruleId' },
    );

    const errors = [...offerErrors, ...ruleErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const rule = await removeOfferGeoRule(offerId, ruleId);
    return sendSuccess(res, { rule });
  }),
);

router.patch(
  '/:offerId/targeting',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: idErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );

    const { dto, errors: bodyErrors } = validateOfferTargetingStrictPayload(
      req.body,
    );

    const errors = [...idErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const offer = await updateOffer(
      offerId,
      {
        targetingStrict: dto.targetingStrict,
      },
      { actor: req.user, requestId: req.id ?? null },
    );

    return sendSuccess(res, { offer });
  }),
);

export default router;
