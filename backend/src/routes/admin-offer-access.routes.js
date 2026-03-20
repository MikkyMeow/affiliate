import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendList, sendSuccess } from '../utils/response.js';
import { validateUuid } from '../validators/offers.js';
import { validateManualAccessPayload } from '../validators/offerAffiliateAccess.js';
import {
  listOfferAffiliateAccessRecords,
  removeManualOfferAffiliateAccess,
  setManualOfferAffiliateAccess,
} from '../services/offer-affiliate-access.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin', 'manager'));

router.put(
  '/:offerId/affiliates/:affiliateId/access',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );
    const { value: affiliateId, errors: affiliateErrors } = validateUuid(
      req.params?.affiliateId,
      { allowMissing: false, field: 'affiliateId' },
    );
    const { dto, errors: bodyErrors } = validateManualAccessPayload(req.body);

    const errors = [...offerErrors, ...affiliateErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const access = await setManualOfferAffiliateAccess({
      offerId,
      affiliateId,
      accessType: dto.accessType,
      actorId: req.user.userId,
      actorRole: req.user.role ?? null,
      requestId: req.id ?? null,
    });

    return sendSuccess(res, { access });
  }),
);

router.delete(
  '/:offerId/affiliates/:affiliateId/access',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );
    const { value: affiliateId, errors: affiliateErrors } = validateUuid(
      req.params?.affiliateId,
      { allowMissing: false, field: 'affiliateId' },
    );

    const errors = [...offerErrors, ...affiliateErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    await removeManualOfferAffiliateAccess({
      offerId,
      affiliateId,
      actorId: req.user.userId,
      actorRole: req.user.role ?? null,
      requestId: req.id ?? null,
    });

    return res.status(204).send();
  }),
);

router.get(
  '/:offerId/access',
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

    const access = await listOfferAffiliateAccessRecords(offerId);
    return sendList(res, access);
  }),
);

export default router;
