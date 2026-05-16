import { getAuthContext } from './auth/auth-context.service.js';
import {
  findAffiliateByUserId,
  updateAffiliate,
} from '../models/affiliateModel.js';
import {
  findAdvertiserByUserId,
  updateAdvertiser,
} from '../models/advertiserModel.js';
import { writeAuditEvent } from './audit.service.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

function buildTelegramAuditContext(previousTelegram, nextTelegram) {
  return {
    oldValues: {
      telegram: previousTelegram ?? null,
    },
    newValues: {
      telegram: nextTelegram ?? null,
    },
    metadata: {
      updatedFields: ['telegram'],
      changedBySelf: true,
    },
  };
}

export async function updateOwnProfile(
  user,
  dto,
  { actor = null, requestId = null } = {},
) {
  if (!user?.userId || !user?.role) {
    throw new Error('Authenticated user context is required');
  }

  if (user.role === 'affiliate') {
    const affiliate = await findAffiliateByUserId(user.userId);

    if (!affiliate) {
      throw new ApiError(
        ERROR_CODES.NOT_FOUND,
        404,
        'Аффилиат для пользователя не найден',
        { userId: user.userId },
      );
    }

    const updatedAffiliate = await updateAffiliate(
      affiliate.id,
      { telegram: dto.telegram },
    );

    await writeAuditEvent({
      entityType: 'affiliate',
      entityId: affiliate.id,
      action: 'telegram_updated',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      context: buildTelegramAuditContext(
        affiliate.telegram,
        updatedAffiliate?.telegram ?? null,
      ),
    });

    const context = await getAuthContext(user.userId);
    return {
      profile: {
        id: updatedAffiliate?.id ?? affiliate.id,
        email: updatedAffiliate?.email ?? affiliate.email,
        telegram: updatedAffiliate?.telegram ?? null,
      },
      context,
    };
  }

  if (user.role === 'advertiser') {
    const advertiser = await findAdvertiserByUserId(user.userId);

    if (!advertiser) {
      throw new ApiError(
        ERROR_CODES.NOT_FOUND,
        404,
        'Рекламодатель для пользователя не найден',
        { userId: user.userId },
      );
    }

    const updatedAdvertiser = await updateAdvertiser(
      advertiser.id,
      { telegram: dto.telegram },
    );

    await writeAuditEvent({
      entityType: 'advertiser',
      entityId: advertiser.id,
      action: 'telegram_updated',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      context: buildTelegramAuditContext(
        advertiser.telegram,
        updatedAdvertiser?.telegram ?? null,
      ),
    });

    const context = await getAuthContext(user.userId);
    return {
      profile: {
        id: updatedAdvertiser?.id ?? advertiser.id,
        email: updatedAdvertiser?.email ?? advertiser.email ?? null,
        telegram: updatedAdvertiser?.telegram ?? null,
      },
      context,
    };
  }

  throw new ApiError(
    ERROR_CODES.FORBIDDEN,
    403,
    'Обновление профиля недоступно для этой роли',
    { role: user.role },
  );
}
