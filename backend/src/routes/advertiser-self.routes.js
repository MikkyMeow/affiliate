import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';
import { getAdvertiserProfileByUser } from '../services/advertisers/advertiser-profile.service.js';
import { validateUpdateProfileDto } from '../validators/users.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { updateOwnProfile } from '../services/profile.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('advertiser'));

router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const profile = await getAdvertiserProfileByUser(req.user);
    return sendSuccess(res, profile);
  }),
);

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateUpdateProfileDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await updateOwnProfile(req.user, dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result);
  }),
);

export default router;
