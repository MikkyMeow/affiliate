import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  validateAdjustmentBatchesQuery,
  validateAdjustmentPreviewPayload,
} from '../validators/adjustments.js';
import { validateUuid } from '../validators/offers.js';
import {
  applyManualAdjustmentBatch,
  getManualAdjustmentBatchDetail,
  listManualAdjustmentBatches,
  previewManualAdjustmentBatch,
} from '../services/adjustments.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

router.post(
  '/preview',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateAdjustmentPreviewPayload(req.body ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const preview = await previewManualAdjustmentBatch(dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, preview);
  }),
);

router.post(
  '/:batchId/apply',
  asyncHandler(async (req, res) => {
    const { value: batchId, errors } = validateUuid(req.params?.batchId, {
      allowMissing: false,
      field: 'batchId',
    });

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await applyManualAdjustmentBatch(batchId, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result);
  }),
);

router.get(
  '/batches',
  asyncHandler(async (req, res) => {
    const { query, pagination, errors } = validateAdjustmentBatchesQuery(
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

    const result = await listManualAdjustmentBatches(query, pagination);
    return sendSuccess(res, result);
  }),
);

router.get(
  '/batches/:id',
  asyncHandler(async (req, res) => {
    const { value: batchId, errors } = validateUuid(req.params?.id, {
      allowMissing: false,
      field: 'id',
    });

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const batch = await getManualAdjustmentBatchDetail(batchId);
    return sendSuccess(res, batch);
  }),
);

export default router;
