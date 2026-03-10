import bcrypt from 'bcryptjs';
import {
  createUser,
  findUserByEmail,
  findUserById,
} from '../models/userModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { getAffiliateById, linkAffiliateToUser } from './affiliates.service.js';

export async function createAffiliateUser({
  email,
  password,
  displayName,
  affiliateId,
}) {
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'Пользователь с таким email уже существует',
      { email },
    );
  }

  const affiliate = await getAffiliateById(affiliateId);

  if (affiliate.userId) {
    throw new ApiError(
      ERROR_CODES.CONFLICT,
      409,
      'К аффилиату уже привязан пользователь',
      { affiliateId, userId: affiliate.userId },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    email,
    passwordHash,
    displayName,
    role: 'affiliate',
  });

  await linkAffiliateToUser(affiliate.id, user.id);

  return findUserById(user.id);
}
