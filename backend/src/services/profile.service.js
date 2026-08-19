import { getAuthContext } from './auth/auth-context.service.js';
import {
  findAffiliateByUserId,
  updateAffiliate,
} from '../models/affiliateModel.js';
import {
  findAdvertiserByUserId,
  updateAdvertiser,
} from '../models/advertiserModel.js';
import { updateUserById } from '../models/userModel.js';
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

function buildTimeZoneAuditContext(previousTimeZone, nextTimeZone) {
  return {
    oldValues: {
      timezone: previousTimeZone ?? null,
    },
    newValues: {
      timezone: nextTimeZone ?? null,
    },
    metadata: {
      updatedFields: ['timezone'],
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

  const nextTimezone = Object.hasOwn(dto, 'timezone') ? dto.timezone : undefined;

  if (nextTimezone !== undefined) {
    const updatedUser = await updateUserById(user.userId, { timezone: nextTimezone });

    if (!updatedUser) {
      throw new ApiError(
        ERROR_CODES.NOT_FOUND,
        404,
        'Пользователь не найден',
        { userId: user.userId },
      );
    }

    await writeAuditEvent({
      entityType: 'user',
      entityId: user.userId,
      action: 'timezone_updated',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      context: buildTimeZoneAuditContext(user.timezone, updatedUser.timezone),
    });
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

    let updatedAffiliate = affiliate;

    if (Object.hasOwn(dto, 'telegram')) {
      updatedAffiliate = await updateAffiliate(
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
    }

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

    let updatedAdvertiser = advertiser;

    if (Object.hasOwn(dto, 'telegram')) {
      updatedAdvertiser = await updateAdvertiser(
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
    }

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

  if (user.role === 'admin' || user.role === 'manager') {
    const context = await getAuthContext(user.userId);
    return {
      profile: null,
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
