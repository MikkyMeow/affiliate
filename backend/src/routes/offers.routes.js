import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  validateCreateOfferDto,
  validateOfferFilters,
  validateUpdateOfferDto,
} from '../validators/offers.js';
import {
  createOffer,
  getOfferById,
  listOffers,
  updateOffer,
} from '../services/offers.service.js';

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateCreateOfferDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const offer = await createOffer(dto);
    return sendSuccess(res, { offer }, { status: 201 });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, pagination, errors } = validateOfferFilters(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const { items, total } = await listOffers(filter, pagination);
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
    const offer = await getOfferById(req.params.id);
    return sendSuccess(res, { offer });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateUpdateOfferDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const offer = await updateOffer(req.params.id, dto);
    return sendSuccess(res, { offer });
  }),
);

export default router;
