import express from 'express';
import {
  createAffiliate,
  listAffiliates,
  findAffiliateById,
  updateAffiliate,
} from '../models/affiliateModel.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateCreateAffiliateDto,
  validateUpdateAffiliateDto,
  validateAffiliateStatusFilter,
} from '../validators/affiliates.js';
import { ERROR_CODES, sendList, sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.use(authenticate);

function handleDbConflict(error) {
  if (error?.code === '23505') {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Аффилиат с таким email уже существует',
      { field: 'email' },
    );
  }

  throw error;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateCreateAffiliateDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    try {
      const affiliate = await createAffiliate(dto);
      return sendSuccess(res, { affiliate }, { status: 201 });
    } catch (error) {
      handleDbConflict(error);
    }
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status } = req.query ?? {};
    const { value: statusValue, errors } = validateAffiliateStatusFilter(status);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const affiliates = await listAffiliates({ status: statusValue });
    return sendList(res, affiliates);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const affiliate = await findAffiliateById(req.params.id);

    if (!affiliate) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Аффилиат не найден', {
        affiliateId: req.params.id,
      });
    }

    return sendSuccess(res, { affiliate });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateUpdateAffiliateDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    try {
      const affiliate = await updateAffiliate(req.params.id, dto);

      if (!affiliate) {
        throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Аффилиат не найден', {
          affiliateId: req.params.id,
        });
      }

      return sendSuccess(res, { affiliate });
    } catch (error) {
      handleDbConflict(error);
    }
  }),
);

export default router;
