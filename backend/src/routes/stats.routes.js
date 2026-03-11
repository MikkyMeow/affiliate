import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  getSummary,
  getDailyRollupSummary,
} from '../services/stats/stats.service.js';
import {
  validateStatsSummaryFilters,
  validateDailySummaryFilters,
} from '../validators/stats.js';

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
