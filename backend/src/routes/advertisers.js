import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea, authorizeAdminOnly } from '../middleware/accessControl.js';
import {
  validateCreateAdvertiserDto,
  validateUpdateAdvertiserDto,
  validateAssignAdvertiserManagerDto,
  validateAdvertiserListFilters,
  validateUpdateAdvertiserInternalNoteDto,
} from '../validators/advertisers.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  assignAdvertiserManager,
  createAdvertiser,
  getAdvertiserById,
  listAdvertisers,
  resetAdvertiserPassword,
  updateAdvertiser,
  updateAdvertiserInternalNote,
} from '../services/advertisers.service.js';
import { getActorContext } from '../utils/actorContext.js';
import { buildPaginationMeta } from '../utils/adminList.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

router.post(
  '/',
  authorizeAdminOnly,
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateCreateAdvertiserDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await createAdvertiser(dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result, { status: 201 });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validateAdvertiserListFilters(
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

    const { items, total } = await listAdvertisers(filter, pagination);
    return sendSuccess(res, items, {
      meta: buildPaginationMeta(total, pagination, {
        sort: pagination.sort ?? 'createdAt',
        order: pagination.order ?? 'desc',
      }),
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const advertiser = await getAdvertiserById(req.params.id);
    return sendSuccess(res, { advertiser });
  }),
);

router.patch(
  '/:id/manager',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateAssignAdvertiserManagerDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiser = await assignAdvertiserManager(
      req.params.id,
      dto.managerUserId,
      {
        actor: getActorContext(req.user),
        requestId: req.id ?? null,
      },
    );

    return sendSuccess(res, { advertiser });
  }),
);

router.patch(
  '/:id/internal-note',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateUpdateAdvertiserInternalNoteDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiser = await updateAdvertiserInternalNote(
      req.params.id,
      dto.internalNote,
      {
        actor: getActorContext(req.user),
        requestId: req.id ?? null,
      },
    );

    return sendSuccess(res, {
      advertiser: {
        id: advertiser.id,
        internalNote: advertiser.internalNote ?? null,
      },
    });
  }),
);

router.post(
  '/:id/reset-password',
  authorizeAdminOnly,
  asyncHandler(async (req, res) => {
    const result = await resetAdvertiserPassword(req.params.id, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result);
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateUpdateAdvertiserDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertiser = await updateAdvertiser(req.params.id, dto);
    return sendSuccess(res, { advertiser });
  }),
);

export default router;
