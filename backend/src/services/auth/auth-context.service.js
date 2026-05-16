import { findUserById } from '../../models/userModel.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { requireAffiliateForUser } from '../affiliates.service.js';
import { getAdvertiserProfileByUser } from '../advertisers/advertiser-profile.service.js';
import { getQuestionnaireCompletionStateForUser } from '../questionnaires.service.js';

function serializeAuthUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    createdAt: user.createdAt ?? null,
    role: user.role,
    affiliateId: user.affiliateId ?? null,
    advertiserId: user.advertiserId ?? null,
  };
}

async function resolveProfile(user) {
  if (!user?.role) {
    return null;
  }

  if (user.role === 'affiliate') {
    const affiliate = await requireAffiliateForUser(user.id);
    return {
      type: 'affiliate',
      id: affiliate.id,
      publicIdNumber: affiliate.publicIdNumber ?? null,
      publicId: affiliate.publicId ?? null,
      name: affiliate.name ?? null,
      email: affiliate.email ?? null,
      status: affiliate.status ?? null,
      telegram: affiliate.telegram ?? null,
      questionnaireAnswers: [],
      createdAt: affiliate.createdAt ?? null,
      updatedAt: affiliate.updatedAt ?? null,
      manager: affiliate.manager
        ? {
            name: affiliate.manager.displayName ?? null,
            email: affiliate.manager.email ?? null,
          }
        : null,
    };
  }

  if (user.role === 'advertiser') {
    const advertiserProfile = await getAdvertiserProfileByUser(user);
    return {
      type: 'advertiser',
      ...advertiserProfile,
    };
  }

  return null;
}

export async function getAuthContext(userId) {
  if (!userId) {
    throw new Error('userId is required to resolve auth context');
  }

  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
      userId,
    });
  }

  const profile = await resolveProfile(user);
  const questionnaire = await getQuestionnaireCompletionStateForUser({
    userId,
    role: user.role,
  });

  return {
    user: serializeAuthUser(user),
    profile,
    questionnaire: {
      required: questionnaire.required,
      completed: questionnaire.completed,
    },
  };
}
