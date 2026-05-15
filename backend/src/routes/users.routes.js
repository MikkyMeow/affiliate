import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminOnly } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { validateCreateAffiliateUserDto } from '../validators/users.js';
import { createAffiliateUser } from '../services/users.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminOnly);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateCreateAffiliateUserDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const user = await createAffiliateUser(dto);
    return sendSuccess(res, { user }, { status: 201 });
  }),
);

export default router;
