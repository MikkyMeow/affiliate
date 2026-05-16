import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeQuestionnaireManagement } from '../middleware/accessControl.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES, sendSuccess } from '../utils/response.js';
import {
  validateQuestionnaireListQuery,
  validateQuestionnaireTargetRole,
  validateQuestionnaireUpsertDto,
} from '../validators/questionnaires.js';
import {
  getAdminQuestionnaireById,
  listAdminQuestionnaires,
  upsertAdminQuestionnaire,
} from '../services/questionnaires.service.js';
import { getActorContext } from '../utils/actorContext.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeQuestionnaireManagement);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { filter, errors } = validateQuestionnaireListQuery(req.query ?? {});

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const items = await listAdminQuestionnaires(filter);
    return sendSuccess(res, { items });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const questionnaire = await getAdminQuestionnaireById(req.params.id);
    return sendSuccess(res, { questionnaire });
  }),
);

router.put(
  '/:targetRole',
  asyncHandler(async (req, res) => {
    const { value: targetRole, errors: roleErrors } = validateQuestionnaireTargetRole(
      req.params?.targetRole,
      {
        field: 'targetRole',
        allowMissing: false,
      },
    );
    const { dto, errors: bodyErrors } = validateQuestionnaireUpsertDto(req.body);
    const errors = [...roleErrors, ...bodyErrors];

    if (errors.length) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Ошибка валидации',
        { errors },
      );
    }

    const questionnaire = await upsertAdminQuestionnaire(targetRole, dto, {
      actor: getActorContext(req.user),
      requestId: req.id ?? null,
    });

    return sendSuccess(res, { questionnaire });
  }),
);

export default router;
