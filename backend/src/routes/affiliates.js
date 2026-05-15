import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import {
  validateCreateAffiliateDto,
  validateUpdateAffiliateDto,
  validateAssignAffiliateManagerDto,
  validateAffiliateListFilters,
} from '../validators/affiliates.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createAffiliate,
  getAffiliateById,
  listAffiliates,
  assignAffiliateManager,
  updateAffiliate,
} from '../services/affiliates.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdminArea);

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
    const { filter, pagination, errors } = validateAffiliateListFilters(
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

    const { items, total } = await listAffiliates(filter, pagination);
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
    const affiliate = await getAffiliateById(req.params.id);
    return sendSuccess(res, { affiliate });
  }),
);

router.patch(
  '/:id/manager',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateAssignAffiliateManagerDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const affiliate = await assignAffiliateManager(req.params.id, dto.managerUserId, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

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
