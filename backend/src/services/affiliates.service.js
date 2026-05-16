import pool from '../db.js';
import {
  createAffiliate as createAffiliateModel,
  listAffiliates as listAffiliatesModel,
  findAffiliateById as findAffiliateByIdModel,
  findAffiliateByUserId as findAffiliateByUserIdModel,
  findAffiliateByEmail as findAffiliateByEmailModel,
  updateAffiliate as updateAffiliateModel,
  updateAffiliateManager as updateAffiliateManagerModel,
  linkAffiliateToUser as linkAffiliateToUserModel,
} from '../models/affiliateModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { invalidateAffiliateCache } from './tracking/cache-invalidation.service.js';
import { requireAssignableManagerUser } from './managers.service.js';
import { writeAuditEvent } from './audit.service.js';
import { getQuestionnaireAnswerItemsForUser } from './questionnaires.service.js';

function handleAffiliateDbConflict(error) {
  if (error?.code === '23505') {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Аффилиат с таким email уже существует',
      { field: 'email' },
    );
  }

  throw error;
}

async function withAffiliateInfo(affiliate) {
  const questionnaireAnswers = affiliate?.userId
    ? await getQuestionnaireAnswerItemsForUser(affiliate.userId, 'affiliate')
    : [];

  return {
    ...affiliate,
    questionnaireAnswers,
  };
}

export async function createAffiliate(dto) {
  try {
    return await withAffiliateInfo(await createAffiliateModel(dto));
  } catch (error) {
    handleAffiliateDbConflict(error);
  }
}

export async function listAffiliates(filter, pagination) {
  return listAffiliatesModel(filter, pagination);
}

export async function getAffiliateById(id) {
  const affiliate = await findAffiliateByIdModel(id);

  if (!affiliate) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Аффилиат не найден', {
      affiliateId: id,
    });
  }

  return withAffiliateInfo(affiliate);
}

export async function updateAffiliate(id, dto) {
  try {
    const affiliate = await updateAffiliateModel(id, dto);

    if (!affiliate) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Аффилиат не найден', {
        affiliateId: id,
      });
    }

    await invalidateAffiliateCache(id);

    return withAffiliateInfo(affiliate);
  } catch (error) {
    handleAffiliateDbConflict(error);
  }
}

export async function updateAffiliateInternalNote(
  affiliateId,
  internalNote,
  { actor = null, requestId = null } = {},
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingAffiliate = await findAffiliateByIdModel(affiliateId, { client });

    if (!existingAffiliate) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Аффилиат не найден', {
        affiliateId,
      });
    }

    const updatedAffiliate = await updateAffiliateModel(
      affiliateId,
      { internalNote },
      { client },
    );

    await writeAuditEvent({
      entityType: 'affiliate',
      entityId: affiliateId,
      action: 'internal_note_updated',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      client,
      context: {
        oldValues: {
          internalNote: existingAffiliate.internalNote ?? null,
        },
        newValues: {
          internalNote: updatedAffiliate?.internalNote ?? null,
        },
        metadata: {
          updatedFields: ['internalNote'],
        },
      },
    });

    await client.query('COMMIT');

    return updatedAffiliate;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

export async function assignAffiliateManager(
  affiliateId,
  managerUserId,
  { actor = null, requestId = null } = {},
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingAffiliate = await findAffiliateByIdModel(affiliateId, { client });

    if (!existingAffiliate) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Аффилиат не найден', {
        affiliateId,
      });
    }

    const nextManager =
      managerUserId === null
        ? null
        : await requireAssignableManagerUser(managerUserId, { client });

    const updatedAffiliate = await updateAffiliateManagerModel(
      affiliateId,
      managerUserId,
      { client },
    );

    await writeAuditEvent({
      entityType: 'affiliate',
      entityId: affiliateId,
      action: 'manager_assigned',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      client,
      context: {
        oldValues: {
          managerUserId: existingAffiliate.managerUserId ?? null,
        },
        newValues: {
          managerUserId: updatedAffiliate?.managerUserId ?? null,
        },
        metadata: buildManagerAuditMetadata(
          existingAffiliate.manager,
          nextManager,
        ),
      },
    });

    await client.query('COMMIT');

    await invalidateAffiliateCache(affiliateId);

    return updatedAffiliate;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getAffiliateByUserId(userId) {
  return findAffiliateByUserIdModel(userId);
}

export async function findAffiliateByEmail(email) {
  if (!email) {
    throw new Error('Email is required to fetch affiliate');
  }

  return findAffiliateByEmailModel(email);
}

export async function requireAffiliateForUser(userId) {
  if (!userId) {
    throw new Error('User id is required to fetch affiliate');
  }

  const affiliate = await findAffiliateByUserIdModel(userId);

  if (!affiliate) {
    throw new ApiError(
      ERROR_CODES.NOT_FOUND,
      404,
      'Аффилиат для пользователя не найден',
      { userId },
    );
  }

  return affiliate;
}

export async function linkAffiliateToUser(affiliateId, userId) {
  if (!affiliateId || !userId) {
    throw new Error('Affiliate id and user id are required to link a user');
  }

  const affiliate = await getAffiliateById(affiliateId);

  if (affiliate.userId && affiliate.userId !== userId) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'К аффилиату уже привязан другой пользователь',
      { affiliateId, userId: affiliate.userId },
    );
  }

  const updatedAffiliate = await linkAffiliateToUserModel(affiliateId, userId);

  if (!updatedAffiliate) {
    throw new ApiError(
      ERROR_CODES.NOT_FOUND,
      404,
      'Аффилиат не найден',
      { affiliateId },
    );
  }

  return updatedAffiliate;
}
