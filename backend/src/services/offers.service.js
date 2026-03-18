import {
  createOffer as createOfferModel,
  listOffers as listOffersModel,
  findOfferById as findOfferByIdModel,
  updateOffer as updateOfferModel,
} from '../models/offers.model.js';
import { findAdvertiserById } from '../models/advertiserModel.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { generatePostbackToken } from '../lib/generatePostbackToken.js';
import { invalidateOfferCache } from './tracking/cache-invalidation.service.js';
import { listOfferGoals as listOfferGoalsService } from './offer-goals.service.js';

function throwValidationError(errors) {
  throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Ошибка валидации', {
    errors,
  });
}

function assertValidTargetUrl(targetUrl) {
  if (typeof targetUrl !== 'string' || targetUrl.trim().length === 0) {
    throwValidationError([
      {
        field: 'targetUrl',
        message: 'URL обязателен и не может быть пустым',
      },
    ]);
  }

  let parsed;
  try {
    parsed = new URL(targetUrl.trim());
  } catch {
    throwValidationError([
      {
        field: 'targetUrl',
        message: 'Некорректный URL',
      },
    ]);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throwValidationError([
      {
        field: 'targetUrl',
        message: 'URL должен начинаться с http или https',
      },
    ]);
  }
}

function assertValidPayout(payoutRub) {
  if (typeof payoutRub !== 'number' || !Number.isFinite(payoutRub)) {
    throwValidationError([
      {
        field: 'payoutRub',
        message: 'Выплата должна быть числом',
      },
    ]);
  }

  if (payoutRub <= 0) {
    throwValidationError([
      {
        field: 'payoutRub',
        message: 'Выплата должна быть больше 0',
      },
    ]);
  }
}

async function ensureAdvertiserExists(advertiserId) {
  if (!advertiserId) {
    return;
  }

  const advertiser = await findAdvertiserById(advertiserId);

  if (!advertiser) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Рекламодатель не найден', {
      advertiserId,
    });
  }
}

export async function createOffer(dto) {
  await ensureAdvertiserExists(dto.advertiserId);
  assertValidTargetUrl(dto.targetUrl);
  assertValidPayout(dto.payoutRub);

  return createOfferModel({
    ...dto,
    postbackToken: generatePostbackToken(),
  });
}

export async function listOffers(filter, pagination, options = {}) {
  return listOffersModel(filter, pagination, options);
}

export async function getOfferById(id, { includeGoals = false } = {}) {
  const offer = await findOfferByIdModel(id);

  if (!offer) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId: id,
    });
  }

  if (!includeGoals) {
    return offer;
  }

  const goals = await listOfferGoalsService(id, { skipOfferValidation: true });
  return { ...offer, goals };
}

export async function updateOffer(id, dto) {
  if (dto.advertiserId) {
    await ensureAdvertiserExists(dto.advertiserId);
  }

  if (Object.hasOwn(dto, 'targetUrl')) {
    assertValidTargetUrl(dto.targetUrl);
  }

  if (Object.hasOwn(dto, 'payoutRub')) {
    assertValidPayout(dto.payoutRub);
  }

  const offer = await updateOfferModel(id, dto);

  if (!offer) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId: id,
    });
  }

  await invalidateOfferCache(id);

  return offer;
}
