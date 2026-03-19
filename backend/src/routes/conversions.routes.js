import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { listConversions } from '../services/stats/stats.service.js';
import { validateConversionsListFilters } from '../validators/stats.js';
import { validateUuid } from '../validators/offers.js';
import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import { updateConversionStatus as updateConversionStatusService } from '../services/conversions.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validateConversionsListFilters(
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

    const { items, total } = await listConversions(filter, pagination);

    return sendSuccess(res, items, {
      meta: {
        total,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    });
  }),
);

function normalizeStatus(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

router.post(
  '/:conversionId/status',
  asyncHandler(async (req, res) => {
    const errors = [];
    const { value: conversionId, errors: idErrors } = validateUuid(
      req.params?.conversionId,
      { allowMissing: false, field: 'conversionId' },
    );
    errors.push(...idErrors);

    const statusValue = normalizeStatus(req.body?.status);

    if (!statusValue) {
      errors.push({
        field: 'status',
        message: 'status обязателен',
      });
    } else if (!CONVERSION_STATUS_VALUES.includes(statusValue)) {
      errors.push({
        field: 'status',
        message: `Статус должен быть одним из: ${CONVERSION_STATUS_VALUES.join(', ')}`,
      });
    }

    if (errors.length) {
      throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
        errors,
      });
    }

    const conversion = await updateConversionStatusService({
      conversionId,
      status: statusValue,
    });

    return sendSuccess(res, conversion);
  }),
);

export default router;
