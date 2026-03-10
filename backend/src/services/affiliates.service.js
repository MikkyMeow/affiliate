import {
  createAffiliate as createAffiliateModel,
  listAffiliates as listAffiliatesModel,
  findAffiliateById as findAffiliateByIdModel,
  findAffiliateByEmail as findAffiliateByEmailModel,
  findAffiliateByUserId as findAffiliateByUserIdModel,
  updateAffiliate as updateAffiliateModel,
  linkAffiliateToUser as linkAffiliateToUserModel,
} from '../models/affiliateModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

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

export async function createAffiliate(dto) {
  try {
    return await createAffiliateModel(dto);
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

  return affiliate;
}

export async function updateAffiliate(id, dto) {
  try {
    const affiliate = await updateAffiliateModel(id, dto);

    if (!affiliate) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Аффилиат не найден', {
        affiliateId: id,
      });
    }

    return affiliate;
  } catch (error) {
    handleAffiliateDbConflict(error);
  }
}

export async function getAffiliateByUserId(userId) {
  return findAffiliateByUserIdModel(userId);
}

export async function ensureAffiliateForUser(user) {
  if (!user) {
    throw new Error('User payload is required to ensure affiliate');
  }

  const { id, email, displayName } = user;

  if (!id || !email) {
    throw new Error('User id and email are required to ensure affiliate');
  }

  const existingByUser = await findAffiliateByUserIdModel(id);
  if (existingByUser) {
    return existingByUser;
  }

  const existingByEmail = await findAffiliateByEmailModel(email);
  if (existingByEmail) {
    if (existingByEmail.userId === id) {
      return existingByEmail;
    }

    if (!existingByEmail.userId) {
      return linkAffiliateToUserModel(existingByEmail.id, id);
    }
  }

  try {
    return await createAffiliateModel({
      name: displayName?.trim?.() ? displayName : email,
      email,
      status: 'active',
      userId: id,
    });
  } catch (error) {
    handleAffiliateDbConflict(error);
  }

  return null;
}
