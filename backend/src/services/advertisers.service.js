import {
  createAdvertiser as createAdvertiserModel,
  listAdvertisers as listAdvertisersModel,
  findAdvertiserById as findAdvertiserByIdModel,
  updateAdvertiser as updateAdvertiserModel,
} from '../models/advertiserModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

export async function createAdvertiser(dto) {
  return createAdvertiserModel(dto);
}

export async function listAdvertisers(filter) {
  return listAdvertisersModel(filter);
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
