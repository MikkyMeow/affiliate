import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  getSummary,
  getDailyRollupSummary,
  getStatsBreakdowns,
  getOfferStats,
} from '../services/stats/stats.service.js';
import {
  validateStatsSummaryFilters,
  validateDailySummaryFilters,
} from '../validators/stats.js';
import { validateUuid } from '../validators/offers.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateStatsSummaryFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const totals = await getSummary(filter);

    return sendSuccess(res, totals);
  }),
);

router.get(
  '/breakdowns',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateStatsSummaryFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const breakdowns = await getStatsBreakdowns(filter);
    return sendSuccess(res, breakdowns);
  }),
);

router.get(
  '/offers/:id',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: offerErrors } = validateUuid(req.params?.id, {
      field: 'offerId',
      allowMissing: false,
    });

    const { filter, errors: filterErrors } = validateStatsSummaryFilters(req.query ?? {});
    const errors = [...offerErrors, ...filterErrors];

    if (filter.offerId && offerId && filter.offerId !== offerId) {
      errors.push({
        field: 'offerId',
        message: 'offerId в параметрах не совпадает с URL',
      });
    }

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const normalizedFilter = { ...filter };
    delete normalizedFilter.offerId;

    const stats = await getOfferStats(offerId, normalizedFilter);
    return sendSuccess(res, stats);
  }),
);

router.get(
  '/daily-summary',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateDailySummaryFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const totals = await getDailyRollupSummary(filter);

    return sendSuccess(res, {
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      offerId: filter.offerId,
      affiliateId: filter.affiliateId,
      ...totals,
    });
  }),
);

export default router;
