import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  authorizeAdminArea,
  authorizeManagerManagement,
} from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  validateCreateManagerDto,
  validateManagerListQuery,
  validateUpdateManagerDto,
} from '../validators/users.js';
import { validateUuid } from '../validators/offers.js';
import {
  createManager,
  deleteManager,
  listManagerLookup,
  listManagers,
  resetManagerPassword,
  updateManager,
} from '../services/managers.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

function requireManagerId(value) {
  const { value: managerId, errors } = validateUuid(value, {
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

  return managerId;
}

router.use(authenticate);

router.get(
  '/lookup',
  authorizeAdminArea,
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validateManagerListQuery(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const items = await listManagerLookup(filter, pagination);
    return sendSuccess(res, { items });
  }),
);

router.use(authorizeManagerManagement);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validateManagerListQuery(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const { items, total } = await listManagers(filter, pagination);

    return sendSuccess(res, items, {
      meta: {
        total,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateCreateManagerDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await createManager(dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result, { status: 201 });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const managerId = requireManagerId(req.params.id);
    const { dto, errors } = validateUpdateManagerDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const manager = await updateManager(managerId, dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, { manager });
  }),
);

router.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const managerId = requireManagerId(req.params.id);
    const result = await resetManagerPassword(managerId, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const managerId = requireManagerId(req.params.id);
    const result = await deleteManager(managerId, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result);
  }),
);

export default router;
