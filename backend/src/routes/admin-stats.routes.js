import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  getAdminDashboardStats,
  getSummary,
} from '../services/stats/stats.service.js';
import { validateDashboardStatsQuery } from '../validators/stats.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const { query, errors } = validateDashboardStatsQuery(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const stats = await getAdminDashboardStats(query);
    return sendSuccess(res, stats);
  }),
);

router.get(
  '/totals',
  asyncHandler(async (req, res) => {
    const totals = await getSummary();
    return sendSuccess(res, totals);
  }),
);

export default router;
