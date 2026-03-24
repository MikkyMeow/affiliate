import {
  createAdvertiser as createAdvertiserModel,
  listAdvertisers as listAdvertisersModel,
  findAdvertiserById as findAdvertiserByIdModel,
  findAdvertiserByUserId as findAdvertiserByUserIdModel,
  updateAdvertiser as updateAdvertiserModel,
} from '../models/advertiserModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

export async function createAdvertiser(dto) {
  return createAdvertiserModel(dto);
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
