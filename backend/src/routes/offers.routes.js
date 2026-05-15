import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeAdminArea } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  validateCreateOfferDto,
  validateOfferFilters,
  validateUpdateOfferDto,
  validateUuid,
} from '../validators/offers.js';
import {
  createOffer,
  getOfferById,
  listOffers,
  updateOffer,
} from '../services/offers.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

function parseBooleanQuery(value) {
  if (Array.isArray(value)) {
    return value.some((entry) => parseBooleanQuery(entry));
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return false;
}

router.use(authenticate);
router.use(authorizeAdminArea);

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

    const offer = await createOffer(dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });
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

    const includePostbackToken = parseBooleanQuery(
      req.query?.includePostbackToken,
    );

    const { items, total } = await listOffers(filter, pagination, {
      includePostbackToken,
    });
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
    const { value: offerId, errors } = validateUuid(req.params?.id, {
      allowMissing: false,
      field: 'id',
    });

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const offer = await getOfferById(offerId, { includeGoals: true });
    return sendSuccess(res, { offer });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { value: offerId, errors: idErrors } = validateUuid(req.params?.id, {
      allowMissing: false,
      field: 'id',
    });
    const { dto, errors } = validateUpdateOfferDto(req.body);
    const allErrors = [...idErrors, ...errors];

    if (allErrors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors: allErrors },
      );
    }

    const offer = await updateOffer(
      offerId,
      dto,
      { actor: getActorContext(req.user), requestId: req.id ?? null },
    );
    return sendSuccess(res, { offer });
  }),
);

export default router;
