import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  listAdvertiserOffers,
  getAdvertiserOfferById,
} from '../services/advertisers/advertiser-offers.service.js';
import { requireAdvertiserForUser } from '../services/advertisers.service.js';
import { validateUuid } from '../validators/offers.js';
import { validateAdvertiserOfferListQuery } from '../validators/advertiserOffers.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('advertiser'));

async function resolveAdvertiserId(user) {
  if (user?.advertiserId) {
    return user.advertiserId;
  }

  const userId = user?.userId ?? user?.id ?? null;
  if (!userId) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Не удалось определить рекламодателя',
    );
  }

  const advertiser = await requireAdvertiserForUser(userId);
  return advertiser.id;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { pagination, filters, errors } = validateAdvertiserOfferListQuery(
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

    const advertiserId = await resolveAdvertiserId(req.user);
    const result = await listAdvertiserOffers({
      advertiserId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: filters.status,
      search: filters.search,
    });

    return sendSuccess(res, result);
  }),
);

router.get(
  '/:offerId',
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

    const advertiserId = await resolveAdvertiserId(req.user);
    const offer = await getAdvertiserOfferById({ advertiserId, offerId });

    return sendSuccess(res, { offer });
  }),
);

export default router;
