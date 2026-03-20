import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { validateUuid } from '../validators/offers.js';
import { validateOfferRequestDecisionPayload } from '../validators/offerRequests.js';
import { reviewOfferRequest } from '../services/offer-requests.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin', 'manager'));

router.post(
  '/:requestId/decision',
  asyncHandler(async (req, res) => {
    const { value: requestId, errors: idErrors } = validateUuid(
      req.params?.requestId,
      {
        allowMissing: false,
        field: 'requestId',
      },
    );
    const { dto, errors: bodyErrors } = validateOfferRequestDecisionPayload(
      req.body,
    );

    const errors = [...idErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await reviewOfferRequest({
      requestId,
      reviewerId: req.user.userId,
      reviewerRole: req.user.role ?? null,
      decision: dto.decision,
      requestContext: { requestId: req.id ?? null },
    });

    return sendSuccess(res, result);
  }),
);

export default router;
