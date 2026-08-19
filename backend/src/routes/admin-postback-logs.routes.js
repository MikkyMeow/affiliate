import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { validateAdminPostbackLogListQuery } from '../validators/postback.js';
import { listAdminPostbackLogs } from '../services/postback-logs.service.js';
import { buildPaginationMeta } from '../utils/adminList.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validateAdminPostbackLogListQuery(
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

    const { items, total } = await listAdminPostbackLogs(filter, pagination);

    return sendSuccess(res, items, {
      meta: buildPaginationMeta(total, pagination, {
        sort: pagination.sort ?? 'createdAt',
        order: pagination.order ?? 'desc',
      }),
    });
  }),
);

export default router;
