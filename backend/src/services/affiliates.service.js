import {
  createAffiliate as createAffiliateModel,
  listAffiliates as listAffiliatesModel,
  findAffiliateById as findAffiliateByIdModel,
  updateAffiliate as updateAffiliateModel,
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
