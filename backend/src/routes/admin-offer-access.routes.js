import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { validateUuid } from '../validators/offers.js';
import {
  validateManualAccessPayload,
  validateOfferAccessGrantPayload,
  validateOfferHidePayload,
} from '../validators/offerAffiliateAccess.js';
import {
  grantOfferAffiliateAccess,
  listOfferAffiliateAccessRecords,
  removeManualOfferAffiliateAccess,
  revokeOfferAffiliateAccess,
  setManualOfferAffiliateAccess,
} from '../services/offer-affiliate-access.service.js';
import {
  listPendingOfferRequestsForOffer,
  reviewOfferRequest,
} from '../services/offer-requests.service.js';
import { validateOfferRequestDecisionPayload } from '../validators/offerRequests.js';
import {
  hideOfferFromAffiliate,
  listHiddenAffiliatesForOffer,
  unhideOfferFromAffiliate,
} from '../services/offer-affiliate-hidden.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin', 'manager'));

router.get(
  '/:offerId/requests',
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

    const items = await listPendingOfferRequestsForOffer(offerId);
    return sendSuccess(res, { items });
  }),
);

router.post(
  '/:offerId/requests/:requestId/decision',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );
    const { value: requestId, errors: requestErrors } = validateUuid(
      req.params?.requestId,
      { allowMissing: false, field: 'requestId' },
    );
    const { dto, errors: bodyErrors } = validateOfferRequestDecisionPayload(
      req.body,
    );

    const errors = [...offerErrors, ...requestErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await reviewOfferRequest({
      requestId,
      reviewerId: req.user.userId,
      reviewerRole: req.user.role ?? null,
      decision: dto.decision,
      requestContext: {
        requestId: req.id ?? null,
        offerId,
      },
    });

    return sendSuccess(res, result);
  }),
);

router.post(
  '/:offerId/access',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );
    const { dto, errors: bodyErrors } = validateOfferAccessGrantPayload(req.body);
    const { value: affiliateId, errors: affiliateErrors } = validateUuid(
      dto.affiliateId,
      { allowMissing: false, field: 'affiliateId' },
    );
    const errors = [...offerErrors, ...bodyErrors, ...affiliateErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await grantOfferAffiliateAccess({
      offerId,
      affiliateId,
      actorId: req.user.userId,
      actorRole: req.user.role ?? null,
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result);
  }),
);

router.delete(
  '/:offerId/access/:affiliateId',
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

    await revokeOfferAffiliateAccess({
      offerId,
      affiliateId,
      actorId: req.user.userId,
      actorRole: req.user.role ?? null,
      requestId: req.id ?? null,
    });

    return sendSuccess(res, { ok: true });
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

    const items = await listOfferAffiliateAccessRecords(offerId);
    return sendSuccess(res, { items });
  }),
);

router.post(
  '/:offerId/hidden-affiliates',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(
      req.params?.offerId,
      { allowMissing: false, field: 'offerId' },
    );
    const { dto, errors: bodyErrors } = validateOfferHidePayload(req.body);
    const { value: affiliateId, errors: affiliateErrors } = validateUuid(
      dto.affiliateId,
      { allowMissing: false, field: 'affiliateId' },
    );
    const errors = [...offerErrors, ...bodyErrors, ...affiliateErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const hiddenAffiliate = await hideOfferFromAffiliate({
      offerId,
      affiliateId,
      actorId: req.user.userId,
      actorRole: req.user.role ?? null,
      requestId: req.id ?? null,
      reason: dto.reason ?? null,
    });

    return sendSuccess(res, { hiddenAffiliate });
  }),
);

router.get(
  '/:offerId/hidden-affiliates',
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

    const items = await listHiddenAffiliatesForOffer(offerId);
    return sendSuccess(res, { items });
  }),
);

router.delete(
  '/:offerId/hidden-affiliates/:affiliateId',
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

    await unhideOfferFromAffiliate({
      offerId,
      affiliateId,
      actorId: req.user.userId,
      actorRole: req.user.role ?? null,
      requestId: req.id ?? null,
    });

    return sendSuccess(res, { ok: true });
  }),
);

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

export default router;
