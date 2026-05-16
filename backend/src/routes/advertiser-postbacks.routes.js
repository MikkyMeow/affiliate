import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { resolveAdvertiserIdFromUser } from '../services/advertisers/advertiser-context.service.js';
import {
  listAdvertiserPostbacks,
  getAdvertiserPostbackById,
} from '../services/advertisers/advertiser-postbacks.service.js';
import { validateAdvertiserPostbackListQuery } from '../validators/advertiserPostbacks.js';
import { validateUuid } from '../validators/offers.js';
import { requireQuestionnaireCompletion } from '../middleware/requireQuestionnaireCompletion.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('advertiser'));
router.use(requireQuestionnaireCompletion());

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { pagination, filters, errors } = validateAdvertiserPostbackListQuery(
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

    const advertiserId = await resolveAdvertiserIdFromUser(req.user);
    const logs = await listAdvertiserPostbacks({
      advertiserId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      offerId: filters.offerId,
    });

    return sendSuccess(res, logs);
  }),
);

router.get(
  '/:postbackId',
  asyncHandler(async (req, res) => {
    const { value: postbackId, errors: idErrors } = validateUuid(
      req.params?.postbackId,
      { allowMissing: false, field: 'postbackId' },
    );

    if (idErrors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors: idErrors },
      );
    }

    const advertiserId = await resolveAdvertiserIdFromUser(req.user);
    const postback = await getAdvertiserPostbackById({
      advertiserId,
      postbackLogId: postbackId,
    });

    return sendSuccess(res, { postback });
  }),
);

export default router;
