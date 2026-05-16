import pool from '../db.js';
import bcrypt from 'bcryptjs';
import {
  createAdvertiser as createAdvertiserModel,
  listAdvertisers as listAdvertisersModel,
  findAdvertiserById as findAdvertiserByIdModel,
  findAdvertiserByUserId as findAdvertiserByUserIdModel,
  updateAdvertiser as updateAdvertiserModel,
  updateAdvertiserManager as updateAdvertiserManagerModel,
} from '../models/advertiserModel.js';
import { createUser, findUserByEmail } from '../models/userModel.js';
import { updateUserPasswordById } from '../models/userModel.js';
import { deleteTokensByUser } from '../models/refreshTokenModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { requireAssignableManagerUser } from './managers.service.js';
import { writeAuditEvent } from './audit.service.js';
import { generateTemporaryPassword } from './managers.service.js';
import { getQuestionnaireAnswerItemsForUser } from './questionnaires.service.js';

const PASSWORD_SALT_ROUNDS = 10;

async function withAdvertiserInfo(advertiser) {
  const questionnaireAnswers = advertiser?.userId
    ? await getQuestionnaireAnswerItemsForUser(advertiser.userId, 'advertiser')
    : [];

  return {
    ...advertiser,
    questionnaireAnswers,
  };
}

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

  return withAdvertiserInfo(advertiser);
}

export async function updateAdvertiser(id, dto) {
  const advertiser = await updateAdvertiserModel(id, dto);

  if (!advertiser) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
      advertiserId: id,
    });
  }

  return withAdvertiserInfo(advertiser);
}

export async function createAdvertiser(
  dto,
  { actor = null, requestId = null } = {},
) {
  const existingUser = await findUserByEmail(dto.email);

  if (existingUser) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Пользователь с таким email уже существует',
      { email: dto.email },
    );
  }

  const temporaryPassword = generateTemporaryPassword('Adv');
  const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);
  const managerUserId =
    dto.managerUserId === undefined || dto.managerUserId === null
      ? null
      : dto.managerUserId;

  if (managerUserId) {
    await requireAssignableManagerUser(managerUserId);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const createdUser = await createUser(
      {
        email: dto.email,
        passwordHash,
        displayName: dto.name,
        role: 'advertiser',
      },
      { client },
    );

    const advertiser = await createAdvertiserModel(
      {
        name: dto.name,
        status: dto.status ?? 'active',
        telegram: dto.telegram ?? null,
        internalNote: dto.internalNote ?? null,
        managerUserId,
        userId: createdUser.id,
      },
      { client },
    );

    await writeAuditEvent({
      entityType: 'advertiser',
      entityId: advertiser.id,
      action: 'created_by_admin',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      client,
      context: {
        oldValues: null,
        newValues: {
          name: advertiser.name ?? null,
          email: dto.email,
          status: advertiser.status ?? null,
          telegram: advertiser.telegram ?? null,
          managerUserId: advertiser.managerUserId ?? null,
          internalNote: advertiser.internalNote ?? null,
        },
        metadata: {
          generatedPasswordShown: true,
        },
      },
    });

    await writeAuditEvent({
      entityType: 'advertiser',
      entityId: advertiser.id,
      action: 'temporary_password_generated',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      client,
      context: {
        oldValues: null,
        newValues: null,
        metadata: {
          generatedByAdmin: true,
        },
      },
    });

    await client.query('COMMIT');

    return {
      advertiser: await withAdvertiserInfo(advertiser),
      temporaryPassword,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error?.code === '23505') {
      throw new ApiError(
        ERROR_CODES.CONFLICT,
        409,
        'Пользователь с таким email уже существует',
        { email: dto.email },
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function updateAdvertiserInternalNote(
  advertiserId,
  internalNote,
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

    const updatedAdvertiser = await updateAdvertiserModel(
      advertiserId,
      { internalNote },
      { client },
    );

    await writeAuditEvent({
      entityType: 'advertiser',
      entityId: advertiserId,
      action: 'internal_note_updated',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      client,
      context: {
        oldValues: {
          internalNote: existingAdvertiser.internalNote ?? null,
        },
        newValues: {
          internalNote: updatedAdvertiser?.internalNote ?? null,
        },
        metadata: {
          updatedFields: ['internalNote'],
        },
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

export async function resetAdvertiserPassword(
  advertiserId,
  { actor = null, requestId = null } = {},
) {
  const advertiser = await findAdvertiserByIdModel(advertiserId);

  if (!advertiser) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
      advertiserId,
    });
  }

  if (!advertiser.userId) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'У рекламодателя нет связанного аккаунта пользователя',
      { advertiserId },
    );
  }

  const temporaryPassword = generateTemporaryPassword('Adv');
  const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);

  await updateUserPasswordById(advertiser.userId, passwordHash);
  await deleteTokensByUser(advertiser.userId);

  await writeAuditEvent({
    entityType: 'advertiser',
    entityId: advertiser.id,
    action: 'password_reset',
    actorUserId: actor?.userId ?? null,
    actorRole: actor?.role ?? null,
    requestId,
    context: {
      oldValues: null,
      newValues: null,
      metadata: {
        resetByAdmin: true,
      },
    },
  });

  return { temporaryPassword };
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
