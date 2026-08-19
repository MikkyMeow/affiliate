import { getQuestionnaireCompletionStateForUser } from '../services/questionnaires.service.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

export function requireQuestionnaireCompletion() {
  return async (req, res, next) => {
    try {
      if (!req.user?.userId || !req.user?.role) {
        return next();
      }

      const completion = await getQuestionnaireCompletionStateForUser({
        userId: req.user.userId,
        role: req.user.role,
      });

      if (completion.completed) {
        return next();
      }

      return next(
        new ApiError(
          ERROR_CODES.QUESTIONNAIRE_REQUIRED,
          403,
          'Необходимо заполнить анкету перед продолжением работы',
          {
            questionnaire: {
              required: completion.required,
              completed: completion.completed,
              targetRole: completion.targetRole,
              requiredMissingFields: completion.requiredMissingFields,
            },
          },
        ),
      );
    } catch (error) {
      return next(error);
    }
  };
}
