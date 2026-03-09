import express from 'express';
import {
  createAdvertiser,
  listAdvertisers,
  findAdvertiserById,
  updateAdvertiser,
} from '../models/advertiserModel.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateCreateAdvertiserDto,
  validateUpdateAdvertiserDto,
  validateAdvertiserStatusFilter,
} from '../validators/advertisers.js';
import { ERROR_CODES, sendList, sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.use(authenticate);

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
    const { status } = req.query ?? {};

    const { value: statusValue, errors } = validateAdvertiserStatusFilter(status);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const advertisers = await listAdvertisers({ status: statusValue });
    return sendList(res, advertisers);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const advertiser = await findAdvertiserById(req.params.id);

    if (!advertiser) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
        advertiserId: req.params.id,
      });
    }

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

    if (!advertiser) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
        advertiserId: req.params.id,
      });
    }

    return sendSuccess(res, { advertiser });
  }),
);

export default router;
