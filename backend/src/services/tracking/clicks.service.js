import { createClick, findByClickId } from '../../models/clicks.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { generateClickId } from '../../lib/generateClickId.js';
import { buildRedirectUrl } from '../../lib/buildRedirectUrl.js';
import {
  getAffiliateForTracking,
  getOfferForTracking,
} from './hot-lookup.service.js';

function assertTrackingInput({ offerId, affiliateId }) {
  if (!offerId || typeof offerId !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'offerId обязателен');
  }

  if (!affiliateId || typeof affiliateId !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'affiliateId обязателен');
  }
}

export async function getClickByClickId(clickId) {
  if (!clickId) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'clickId обязателен');
  }

  const click = await findByClickId(clickId);

  if (!click) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Клик не найден', { clickId });
  }

  return click;
}

async function findActiveOffer(offerId) {
  const offer = await getOfferForTracking(offerId);

  if (!offer) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', { offerId });
  }

  if (offer.status !== 'active') {
    throw new ApiError(ERROR_CODES.CONFLICT, 409, 'Оффер не активен', {
      offerId,
      status: offer.status,
    });
  }

  return offer;
}

async function findActiveAffiliate(affiliateId) {
  const affiliate = await getAffiliateForTracking(affiliateId);

  if (!affiliate) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Партнёр не найден', {
      affiliateId,
    });
  }

  if (affiliate.status !== 'active') {
    throw new ApiError(ERROR_CODES.CONFLICT, 409, 'Партнёр не активен', {
      affiliateId,
      status: affiliate.status,
    });
  }

  return affiliate;
}

export async function prepareClick(input) {
  assertTrackingInput(input);

  const [offer, affiliate] = await Promise.all([
    findActiveOffer(input.offerId),
    findActiveAffiliate(input.affiliateId),
  ]);

  const clickId = input.clickId ?? generateClickId();
  let redirectUrl;

  try {
    redirectUrl = buildRedirectUrl(offer.targetUrl, clickId);
  } catch (error) {
    throw new ApiError(ERROR_CODES.INTERNAL_ERROR, 500, 'Не удалось собрать redirectUrl', {
      offerId: offer.id,
      reason: error.message,
    });
  }

  return {
    clickId,
    offerId: offer.id,
    affiliateId: affiliate.id,
    redirectUrl,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    referer: input.referer ?? null,
    sub1: input.sub1 ?? null,
    sub2: input.sub2 ?? null,
    sub3: input.sub3 ?? null,
    sub4: input.sub4 ?? null,
    sub5: input.sub5 ?? null,
  };
}

export async function registerClick(input) {
  const prepared = await prepareClick(input);
  const { redirectUrl, ...clickPayload } = prepared;

  try {
    await createClick(clickPayload);
  } catch (error) {
    if (error?.code === '23505') {
      throw new ApiError(ERROR_CODES.CONFLICT, 409, 'click_id уже используется', {
        clickId: clickPayload.clickId,
      });
    }

    throw error;
  }

  return {
    redirectUrl,
    clickId: clickPayload.clickId,
  };
}
