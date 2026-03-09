import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  validateCreateAffiliateDto,
  validateUpdateAffiliateDto,
  validateAffiliateStatusFilter,
} from '../validators/affiliates.js';
import { ERROR_CODES, sendList, sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createAffiliate,
  getAffiliateById,
  listAffiliates,
  updateAffiliate,
} from '../services/affiliates.service.js';

const router = express.Router();

router.use(authenticate);

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

    const affiliate = await createAffiliate(dto);
    return sendSuccess(res, { affiliate }, { status: 201 });
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
    const affiliate = await getAffiliateById(req.params.id);
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

    const affiliate = await updateAffiliate(req.params.id, dto);
    return sendSuccess(res, { affiliate });
  }),
);

export default router;
