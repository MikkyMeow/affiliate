import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  getAdminDashboardStats,
  getAdminFilteredSummary,
  getSummary,
} from '../services/stats/stats.service.js';
import { recalculateDailyStats } from '../services/stats/rollup.service.js';
import {
  validateAdminStatsSummaryQuery,
  validateDashboardStatsQuery,
  validateStatsRecalculationPayload,
} from '../validators/stats.js';
import { getActorContext } from '../utils/actorContext.js';

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
  '/summary',
  asyncHandler(async (req, res) => {
    const { query, errors } = validateAdminStatsSummaryQuery(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const summary = await getAdminFilteredSummary(query);
    return sendSuccess(res, summary);
  }),
);

router.post(
  '/recalculate',
  asyncHandler(async (req, res) => {
    const {
      payload,
      errors,
      statusCode,
    } = validateStatsRecalculationPayload(req.body ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        statusCode,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await recalculateDailyStats(
      {
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        timezone: payload.timezone,
        actor: getActorContext(req.user),
        requestId: req.id ?? null,
      },
    );

    return sendSuccess(res, {
      ok: true,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      timezone: result.timezone,
      daysRecalculated: result.daysRecalculated,
      recalculatedAt: result.recalculatedAt,
    });
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
