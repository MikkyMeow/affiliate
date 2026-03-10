import { findUserById } from '../models/userModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { requireAffiliateForUser } from './affiliates.service.js';
import { getSummary } from './stats/stats.service.js';
import { listOffers } from './offers.service.js';

export async function getPartnerProfile(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
      userId,
    });
  }

  if (user.role !== 'affiliate') {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Доступ разрешен только аффилиатам',
      {
        userRole: user.role,
      },
    );
  }

  const affiliate = await requireAffiliateForUser(user.id);

  return {
    user: {
      ...user,
      affiliateId: affiliate.id,
    },
    affiliate,
  };
}

export async function getPartnerStatsSummary(userId) {
  const { affiliate } = await getPartnerProfile(userId);
  return getSummary({ affiliateId: affiliate.id });
}

export async function listPartnerOffers() {
  const { items } = await listOffers(
    { status: 'active' },
    { limit: 200, offset: 0 },
  );

  return items;
}
