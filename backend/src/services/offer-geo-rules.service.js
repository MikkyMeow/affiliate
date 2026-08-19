import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';
import { findOfferById } from '../models/offers.model.js';
import {
  deleteOfferGeoRule,
  insertOfferGeoRule,
  listOfferGeoRules as listOfferGeoRulesModel,
} from '../models/offerGeoRules.model.js';
import { invalidateOfferCache } from './tracking/cache-invalidation.service.js';

function throwOfferNotFound(offerId) {
  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
    offerId,
  });
}

async function ensureOfferExists(offerId) {
  const offer = await findOfferById(offerId);

  if (!offer) {
    throwOfferNotFound(offerId);
  }

  return offer;
}

function serializeRule(rule) {
  if (!rule) {
    return null;
  }

  const normalizedType = rule.ruleType === 'deny' ? 'deny' : 'allow';

  return {
    id: rule.id,
    offerId: rule.offerId,
    ruleType: normalizedType,
    countryCode: rule.countryCode,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

export async function listOfferGeoRules(offerId) {
  if (!offerId) {
    throw new Error('offerId is required to list geo rules');
  }

  await ensureOfferExists(offerId);

  const rules = await listOfferGeoRulesModel(offerId);
  return rules.map(serializeRule);
}

export async function createOfferGeoRule(offerId, dto) {
  if (!offerId) {
    throw new Error('offerId is required to create geo rule');
  }

  if (!dto) {
    throw new Error('dto is required to create geo rule');
  }

  await ensureOfferExists(offerId);

  try {
    const rule = await insertOfferGeoRule({
      offerId,
      ruleType: dto.ruleType,
      countryCode: dto.countryCode,
    });

    await invalidateOfferCache(offerId);
    return serializeRule(rule);
  } catch (error) {
    if (error?.code === '23505') {
      throw new ApiError(
        ERROR_CODES.CONFLICT,
        409,
        'Такая страна уже есть в этом списке',
        {
          ruleType: dto.ruleType,
          countryCode: dto.countryCode,
        },
      );
    }

    throw error;
  }
}

export async function removeOfferGeoRule(offerId, ruleId) {
  if (!offerId || !ruleId) {
    throw new Error('offerId and ruleId are required to delete geo rule');
  }

  const rule = await deleteOfferGeoRule({ offerId, ruleId });

  if (!rule) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Правило не найдено', {
      offerId,
      ruleId,
    });
  }

  await invalidateOfferCache(offerId);
  return serializeRule(rule);
}
