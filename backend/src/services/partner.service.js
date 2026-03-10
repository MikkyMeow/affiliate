import { findUserById } from '../models/userModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import {
  ensureAffiliateForUser,
  getAffiliateByUserId,
} from './affiliates.service.js';
import { getSummary } from './stats/stats.service.js';
import { listOffers } from './offers.service.js';

async function loadPartnerUser(userId) {
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

  let affiliate = await getAffiliateByUserId(user.id);
  if (!affiliate) {
    affiliate = await ensureAffiliateForUser(user);
  }

  const normalizedUser = {
    ...user,
    affiliateId: affiliate?.id ?? user.affiliateId ?? null,
  };

  return { user: normalizedUser, affiliate };
}

export async function getPartnerProfile(userId) {
  return loadPartnerUser(userId);
}

export async function getPartnerStatsSummary(userId) {
  const { affiliate } = await loadPartnerUser(userId);

  if (!affiliate) {
    return {
      clicksTotal: 0,
      conversionsTotal: 0,
      approvedConversionsTotal: 0,
      rejectedConversionsTotal: 0,
      payoutTotal: 0,
    };
  }

  return getSummary({ affiliateId: affiliate.id });
}

export async function listPartnerOffers() {
  const { items } = await listOffers(
    { status: 'active' },
    { limit: 200, offset: 0 },
  );

  return items;
}
