import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  getPartnerProfile,
  getPartnerStatsSummary,
  listPartnerOffers,
  listPartnerClicks,
  listPartnerConversions,
  getPartnerOfferDetails,
} from '../services/partner.service.js';
import { requestOfferAccess } from '../services/offer-requests.service.js';
import {
  validatePartnerClicksQuery,
  validatePartnerConversionsQuery,
} from '../validators/stats.js';
import { validateUuid } from '../validators/offers.js';
import { validateOfferRequestPayload } from '../validators/offerRequests.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('affiliate'));
router.use((req, res, next) => {
  if (req.user?.affiliateId) {
    return next();
  }

  return next(
    new ApiError(
      ERROR_CODES.AFFILIATE_NOT_LINKED,
      403,
      'К аккаунту не привязан аффилиат',
    ),
  );
});

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const profile = await getPartnerProfile(req.user.userId);
    return sendSuccess(res, profile);
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await getPartnerStatsSummary(req.user.userId);
    return sendSuccess(res, stats);
  }),
);

router.get(
  '/clicks',
  asyncHandler(async (req, res) => {
    const { pagination, errors } = validatePartnerClicksQuery(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const limit = pagination.limit ?? 20;
    const offset = pagination.offset ?? 0;
    const { items, total } = await listPartnerClicks(req.user.userId, {
      limit,
      offset,
    });

    return sendSuccess(res, items, {
      meta: {
        total,
        limit,
        offset,
      },
    });
  }),
);

router.get(
  '/conversions',
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validatePartnerConversionsQuery(
      req.query ?? {},
    );

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const limit = pagination.limit ?? 20;
    const offset = pagination.offset ?? 0;
    const { items, total } = await listPartnerConversions(
      req.user.userId,
      filter,
      { limit, offset },
    );

    return sendSuccess(res, items, {
      meta: {
        total,
        limit,
        offset,
      },
    });
  }),
);

router.get(
  '/offers',
  asyncHandler(async (req, res) => {
    const offers = await listPartnerOffers(req.user.userId);
    return sendSuccess(res, offers);
  }),
);

router.get(
  '/offers/:id',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors } = validateUuid(req.params?.id, {
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

    const offer = await getPartnerOfferDetails(req.user.userId, offerId);
    return sendSuccess(res, { offer });
  }),
);

router.post(
  '/offers/:id/request',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors } = validateUuid(req.params?.id, {
      allowMissing: false,
      field: 'offerId',
    });
    const { dto, errors: bodyErrors } = validateOfferRequestPayload(req.body);
    const allErrors = [...errors, ...bodyErrors];

    if (allErrors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors: allErrors },
      );
    }

    const request = await requestOfferAccess({
      affiliateId: req.user.affiliateId,
      offerId,
      message: dto.message ?? null,
    });

    return sendSuccess(
      res,
      {
        request,
      },
      { status: 201 },
    );
  }),
);

export default router;
