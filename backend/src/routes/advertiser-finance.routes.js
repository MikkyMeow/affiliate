import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { resolveAdvertiserIdFromUser } from '../services/advertisers/advertiser-context.service.js';
import {
  getAdvertiserFinanceSummary,
  getAdvertiserFinanceBreakdown,
} from '../services/advertisers/advertiser-finance.service.js';
import { validateAdvertiserFinanceFilters } from '../validators/advertiserFinance.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('advertiser'));

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateAdvertiserFinanceFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiserId = await resolveAdvertiserIdFromUser(req.user);
    const summary = await getAdvertiserFinanceSummary({ advertiserId, filter });
    return sendSuccess(res, summary);
  }),
);

router.get(
  '/breakdowns',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateAdvertiserFinanceFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiserId = await resolveAdvertiserIdFromUser(req.user);
    const breakdowns = await getAdvertiserFinanceBreakdown({ advertiserId, filter });
    return sendSuccess(res, breakdowns);
  }),
);

export default router;
