import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import {
  validateCreateAdvertiserDto,
  validateUpdateAdvertiserDto,
  validateAdvertiserListFilters,
} from '../validators/advertisers.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createAdvertiser,
  getAdvertiserById,
  listAdvertisers,
  updateAdvertiser,
} from '../services/advertisers.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

router.post(
  '/',
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

    const advertiser = await createAdvertiser(dto);
    return sendSuccess(res, { advertiser }, { status: 201 });
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
