import pool from '../db.js';
import {
  listAdvertisers as listAdvertisersModel,
  findAdvertiserById as findAdvertiserByIdModel,
  findAdvertiserByUserId as findAdvertiserByUserIdModel,
  updateAdvertiser as updateAdvertiserModel,
  updateAdvertiserManager as updateAdvertiserManagerModel,
} from '../models/advertiserModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { requireAssignableManagerUser } from './managers.service.js';
import { writeAuditEvent } from './audit.service.js';

export async function listAdvertisers(filter, pagination) {
  return listAdvertisersModel(filter, pagination);
}

export async function getAdvertiserById(id) {
  const advertiser = await findAdvertiserByIdModel(id);

  if (!advertiser) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
      advertiserId: id,
    });
  }

  return advertiser;
}

export async function updateAdvertiser(id, dto) {
  const advertiser = await updateAdvertiserModel(id, dto);

  if (!advertiser) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
      advertiserId: id,
    });
  }

  return advertiser;
}

function buildManagerAuditMetadata(previousManager, nextManager) {
  return {
    previousManager: previousManager
      ? {
          id: previousManager.id,
          displayName: previousManager.displayName ?? null,
          email: previousManager.email ?? null,
        }
      : null,
    nextManager: nextManager
      ? {
          id: nextManager.id,
          displayName: nextManager.displayName ?? null,
          email: nextManager.email ?? null,
        }
      : null,
  };
}

export async function assignAdvertiserManager(
  advertiserId,
  managerUserId,
  { actor = null, requestId = null } = {},
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingAdvertiser = await findAdvertiserByIdModel(advertiserId, { client });

    if (!existingAdvertiser) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
        advertiserId,
      });
    }

    const nextManager =
      managerUserId === null
        ? null
        : await requireAssignableManagerUser(managerUserId, { client });

    const updatedAdvertiser = await updateAdvertiserManagerModel(
      advertiserId,
      managerUserId,
      { client },
    );

    await writeAuditEvent({
      entityType: 'advertiser',
      entityId: advertiserId,
      action: 'manager_assigned',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      client,
      context: {
        oldValues: {
          managerUserId: existingAdvertiser.managerUserId ?? null,
        },
        newValues: {
          managerUserId: updatedAdvertiser?.managerUserId ?? null,
        },
        metadata: buildManagerAuditMetadata(
          existingAdvertiser.manager,
          nextManager,
        ),
      },
    });

    await client.query('COMMIT');

    return updatedAdvertiser;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAdvertiserByUserId(userId) {
  if (!userId) {
    throw new Error('User id is required to fetch advertiser');
  }

  return findAdvertiserByUserIdModel(userId);
}

export async function requireAdvertiserForUser(userId) {
  if (!userId) {
    throw new Error('User id is required to fetch advertiser');
  }

  const advertiser = await findAdvertiserByUserIdModel(userId);

  if (!advertiser) {
    throw new ApiError(
      ERROR_CODES.NOT_FOUND,
      404,
      'Рекламодатель для пользователя не найден',
      { userId },
    );
  }

  return advertiser;
}
