import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import {
  getAdvertiserById,
  requireAdvertiserForUser,
} from '../advertisers.service.js';

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

  return {
    id: advertiser.id,
    name: advertiser.name ?? null,
    status: advertiser.status ?? null,
    createdAt: advertiser.createdAt ?? null,
    updatedAt: advertiser.updatedAt ?? null,
  };
}
