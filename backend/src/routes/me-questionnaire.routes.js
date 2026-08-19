import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import { getActorContext } from '../utils/actorContext.js';
import { validateQuestionnaireAnswersDto } from '../validators/questionnaires.js';
import {
  getMyQuestionnaire,
  submitMyQuestionnaireAnswers,
} from '../services/questionnaires.service.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('affiliate', 'advertiser'));

router.get(
  '/questionnaire',
  asyncHandler(async (req, res) => {
    const result = await getMyQuestionnaire(req.user);
    return sendSuccess(res, result);
  }),
);

router.put(
  '/questionnaire/answers',
  asyncHandler(async (req, res) => {
    const { dto, errors } = validateQuestionnaireAnswersDto(req.body);

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const result = await submitMyQuestionnaireAnswers(req.user, dto.answers, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, result);
  }),
);

export default router;
