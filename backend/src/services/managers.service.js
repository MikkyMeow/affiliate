import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserById,
  findUserCredentialsById,
  listUsersByRole,
  updateUserById,
  updateUserPasswordById,
} from '../models/userModel.js';
import { deleteTokensByUser } from '../models/refreshTokenModel.js';
import { writeAuditEvent } from './audit.service.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

const PASSWORD_SALT_ROUNDS = 10;

function buildManagerSnapshot(user) {
  if (!user) {
    return null;
  }

  return {
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    role: user.role ?? null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  };
}

function getActorMeta(actor) {
  return {
    actorUserId: actor?.userId ?? null,
    actorRole: actor?.role ?? null,
  };
}

function generateTemporaryPassword() {
  return `Mgr-${crypto.randomBytes(9).toString('base64url')}`;
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

async function ensureEmailIsUnique(email, currentUserId = null) {
  const existingUser = await findUserByEmail(email);

  if (existingUser && existingUser.id !== currentUserId) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Пользователь с таким email уже существует',
      { email },
    );
  }
}

async function requireManagerUser(id) {
  const user = await findUserById(id);

  if (!user || user.role !== 'manager') {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Менеджер не найден', {
      managerId: id,
    });
  }

  return user;
}

export async function listManagers(filter, pagination) {
  return listUsersByRole(
    {
      role: 'manager',
      search: filter.search ?? null,
      limit: pagination.limit,
      offset: pagination.offset,
    },
  );
}

export async function listManagerLookup(filter, pagination) {
  const { items } = await listManagers(filter, pagination);

  return items.map((user) => ({
    id: user.id,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
  }));
}

export async function requireAssignableManagerUser(id, { client } = {}) {
  const user = await findUserById(id, { client });

  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Менеджер не найден', {
      managerId: id,
    });
  }

  if (user.role !== 'manager') {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      422,
      'Выбранный пользователь не является менеджером',
      {
        managerId: id,
        role: user.role ?? null,
      },
    );
  }

  return user;
}

export async function createManager(dto, { actor = null, requestId = null } = {}) {
  await ensureEmailIsUnique(dto.email);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);

  let createdUser;
  try {
    createdUser = await createUser({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role: 'manager',
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        ERROR_CODES.CONFLICT,
        409,
        'Пользователь с таким email уже существует',
        { email: dto.email },
      );
    }
    throw error;
  }

  const manager = await findUserById(createdUser.id);
  const { actorUserId, actorRole } = getActorMeta(actor);

  await writeAuditEvent({
    entityType: 'manager',
    entityId: manager.id,
    action: 'created',
    actorUserId,
    actorRole,
    requestId,
    context: {
      oldValues: null,
      newValues: buildManagerSnapshot(manager),
      metadata: {
        generatedPasswordShown: true,
      },
    },
  });

  return {
    manager,
    temporaryPassword,
  };
}

export async function updateManager(
  managerId,
  dto,
  { actor = null, requestId = null } = {},
) {
  const existingManager = await requireManagerUser(managerId);

  if (dto.email) {
    await ensureEmailIsUnique(dto.email, existingManager.id);
  }

  let updatedManager;
  try {
    updatedManager = await updateUserById(managerId, dto);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        ERROR_CODES.CONFLICT,
        409,
        'Пользователь с таким email уже существует',
        { email: dto.email ?? null },
      );
    }
    throw error;
  }

  if (!updatedManager || updatedManager.role !== 'manager') {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Менеджер не найден', {
      managerId,
    });
  }

  const previousSnapshot = buildManagerSnapshot(existingManager);
  const nextSnapshot = buildManagerSnapshot(updatedManager);
  const { actorUserId, actorRole } = getActorMeta(actor);

  await writeAuditEvent({
    entityType: 'manager',
    entityId: updatedManager.id,
    action: 'updated',
    actorUserId,
    actorRole,
    requestId,
    context: {
      oldValues: previousSnapshot,
      newValues: nextSnapshot,
      metadata: {
        updatedFields: Object.keys(dto),
      },
    },
  });

  return updatedManager;
}

export async function resetManagerPassword(
  managerId,
  { actor = null, requestId = null } = {},
) {
  const manager = await requireManagerUser(managerId);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_SALT_ROUNDS);

  await updateUserPasswordById(manager.id, passwordHash);
  await deleteTokensByUser(manager.id);

  const { actorUserId, actorRole } = getActorMeta(actor);
  await writeAuditEvent({
    entityType: 'manager',
    entityId: manager.id,
    action: 'password_reset',
    actorUserId,
    actorRole,
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

export async function deleteManager(
  managerId,
  { actor = null, requestId = null } = {},
) {
  const manager = await requireManagerUser(managerId);
  const snapshot = buildManagerSnapshot(manager);
  const { actorUserId, actorRole } = getActorMeta(actor);

  await deleteUserById(manager.id);

  await writeAuditEvent({
    entityType: 'manager',
    entityId: manager.id,
    action: 'deleted',
    actorUserId,
    actorRole,
    requestId,
    context: {
      oldValues: snapshot,
      newValues: null,
      metadata: {
        deletedByAdmin: true,
      },
    },
  });

  return { ok: true };
}

export async function changeOwnPassword(
  { userId, currentPassword, newPassword },
  { actor = null, requestId = null } = {},
) {
  const user = await findUserCredentialsById(userId);

  if (!user) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
      userId,
    });
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!isCurrentPasswordValid) {
    throw new ApiError(
      ERROR_CODES.INVALID_CREDENTIALS,
      401,
      'Неверный текущий пароль',
    );
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_ERROR,
      400,
      'Новый пароль должен отличаться от текущего',
      {
        errors: [
          {
            field: 'newPassword',
            message: 'Новый пароль должен отличаться от текущего',
          },
        ],
      },
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
  await updateUserPasswordById(user.id, passwordHash);
  await deleteTokensByUser(user.id);

  const { actorUserId, actorRole } = getActorMeta(actor);
  await writeAuditEvent({
    entityType: 'user',
    entityId: user.id,
    action: 'password_changed',
    actorUserId,
    actorRole,
    requestId,
    context: {
      oldValues: null,
      newValues: null,
      metadata: {
        changedBySelf: true,
      },
    },
  });
}
