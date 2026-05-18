import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { listAuditEvents } from '../services/audit.service.js';
import { validateAuditLogListQuery } from '../validators/auditLogs.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

async function handleList(req, res, extraFilter = {}) {
  const { filter, pagination, errors } = validateAuditLogListQuery(req.query ?? {});

  if (errors.length) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'Ошибка валидации',
      { errors },
    );
  }

  const result = await listAuditEvents(
    {
      ...filter,
      ...extraFilter,
    },
    pagination,
  );

  return sendSuccess(res, {
    items: result.items,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? 20,
    total: result.total,
    totalPages:
      result.total > 0
        ? Math.ceil(result.total / Math.max(pagination.limit ?? 20, 1))
        : 0,
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => handleList(req, res)),
);

router.get(
  '/entity/:entityType/:entityId',
  asyncHandler(async (req, res) =>
    handleList(req, res, {
      entityType: req.params.entityType,
      entityId: req.params.entityId,
    })),
);

export default router;
