import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { listClicks } from '../services/stats/stats.service.js';
import { validateClicksListFilters } from '../validators/stats.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validateClicksListFilters(
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

    const { items, total } = await listClicks(filter, pagination);

    return sendSuccess(res, items, {
      meta: {
        total,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    });
  }),
);

export default router;
