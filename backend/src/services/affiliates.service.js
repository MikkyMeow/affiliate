import {
  createAffiliate as createAffiliateModel,
  listAffiliates as listAffiliatesModel,
  findAffiliateById as findAffiliateByIdModel,
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
