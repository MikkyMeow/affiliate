import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import {
  validateUpdateAdvertiserDto,
  validateAssignAdvertiserManagerDto,
  validateAdvertiserListFilters,
} from '../validators/advertisers.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  assignAdvertiserManager,
  getAdvertiserById,
  listAdvertisers,
  updateAdvertiser,
} from '../services/advertisers.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

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
      meta: {
        total,
        limit: pagination.limit,
        offset: pagination.offset,
      },
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
