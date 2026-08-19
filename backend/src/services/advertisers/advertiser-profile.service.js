import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import {
  getAdvertiserById,
  requireAdvertiserForUser,
} from '../advertisers.service.js';
import { getQuestionnaireAnswerItemsForUser } from '../questionnaires.service.js';

export async function getAdvertiserProfileByUser(user) {
  if (!user) {
    throw new Error('User is required to resolve advertiser profile');
  }

  if (user.role !== 'advertiser') {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Доступ разрешен только рекламодателям',
      { userRole: user.role ?? null },
    );
  }

  const userId = user.userId ?? user.id ?? null;

  if (!userId) {
    throw new Error('User id is required to resolve advertiser profile');
  }

  const advertiser =
    user.advertiserId != null
      ? await getAdvertiserById(user.advertiserId)
      : await requireAdvertiserForUser(userId);
  const questionnaireAnswers = await getQuestionnaireAnswerItemsForUser(
    userId,
    'advertiser',
  );

  return {
    id: advertiser.id,
    publicIdNumber: advertiser.publicIdNumber ?? null,
    publicId: advertiser.publicId ?? null,
    name: advertiser.name ?? null,
    email: advertiser.email ?? null,
    status: advertiser.status ?? null,
    telegram: advertiser.telegram ?? null,
    questionnaireAnswers,
    createdAt: advertiser.createdAt ?? null,
    updatedAt: advertiser.updatedAt ?? null,
    manager: advertiser.manager
      ? {
          name: advertiser.manager.displayName ?? null,
          email: advertiser.manager.email ?? null,
        }
      : null,
  };
}
