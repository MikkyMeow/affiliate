import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { listAdminConversions } from '../services/stats/stats.service.js';
import { validateConversionsListFilters } from '../validators/stats.js';
import { validateUuid } from '../validators/offers.js';
import { CONVERSION_STATUS_VALUES } from '../constants/conversions.js';
import {
  getConversionStatusHistory as getConversionStatusHistoryService,
  updateConversionStatus as updateConversionStatusService,
} from '../services/conversions.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

function buildPaginationMeta(total, pagination) {
  const limit = pagination.limit ?? 20;
  const offset = pagination.offset ?? 0;
  const page =
    pagination.page ??
    Math.floor(offset / Math.max(limit, 1)) + 1;
  const totalPages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 1;

  return {
    total,
    limit,
    offset,
    page,
    totalPages,
  };
}

router.use(authenticate);
router.use(authorizeAdminArea);

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

    const { items, total } = await listAdminConversions(filter, pagination);

    return sendSuccess(res, items, {
      meta: buildPaginationMeta(total, pagination),
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

function normalizeReason(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function handleStatusUpdate(req, res) {
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

  const reason = normalizeReason(req.body?.reason);
  if (reason === undefined) {
    errors.push({
      field: 'reason',
      message: 'reason должен быть строкой',
    });
  }

  if (errors.length) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
      errors,
    });
  }

  const result = await updateConversionStatusService({
    conversionId,
    status: statusValue,
    reason,
    actor: getActorContext(req.user),
    requestId: req.id ?? null,
  });

  return sendSuccess(res, result);
}

router.get(
  '/:conversionId/status-history',
  asyncHandler(async (req, res) => {
    const { value: conversionId, errors: idErrors } = validateUuid(
      req.params?.conversionId,
      { allowMissing: false, field: 'conversionId' },
    );
    if (idErrors.length) {
      throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
        errors: idErrors,
      });
    }

    const items = await getConversionStatusHistoryService(conversionId);

    return sendSuccess(res, { items });
  }),
);

router.patch('/:conversionId/status', asyncHandler(handleStatusUpdate));
router.post('/:conversionId/status', asyncHandler(handleStatusUpdate));

export default router;
