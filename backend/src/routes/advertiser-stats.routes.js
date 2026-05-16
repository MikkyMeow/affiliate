import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  getAdvertiserStatsSummary,
  getAdvertiserStatsBreakdowns,
  getAdvertiserOfferStats,
} from '../services/advertisers/advertiser-stats.service.js';
import {
  validateAdvertiserOfferStatsFilters,
  validateAdvertiserStatsFilters,
} from '../validators/stats.js';
import { validateUuid } from '../validators/offers.js';
import { resolveAdvertiserIdFromUser } from '../services/advertisers/advertiser-context.service.js';
import { requireQuestionnaireCompletion } from '../middleware/requireQuestionnaireCompletion.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('advertiser'));
router.use(requireQuestionnaireCompletion());

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateAdvertiserStatsFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiserId = await resolveAdvertiserIdFromUser(req.user);
    const summary = await getAdvertiserStatsSummary({ advertiserId, filter });

    return sendSuccess(res, summary);
  }),
);

router.get(
  '/breakdowns',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateAdvertiserStatsFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiserId = await resolveAdvertiserIdFromUser(req.user);
    const breakdowns = await getAdvertiserStatsBreakdowns({ advertiserId, filter });

    return sendSuccess(res, breakdowns);
  }),
);

router.get(
  '/offers/:offerId',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(req.params?.offerId, {
      allowMissing: false,
      field: 'offerId',
    });
    const { filter, errors: filterErrors } = validateAdvertiserOfferStatsFilters(
      req.query ?? {},
    );
    const errors = [...offerErrors, ...filterErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiserId = await resolveAdvertiserIdFromUser(req.user);
    const stats = await getAdvertiserOfferStats({ advertiserId, offerId, filter });

    return sendSuccess(res, stats);
  }),
);

export default router;
