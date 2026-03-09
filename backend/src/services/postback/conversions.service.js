import { createConversion, findByClickId } from '../../models/conversions.model.js';
import { findOfferById } from '../../models/offers.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { getClickByClickId } from '../tracking/clicks.service.js';

export const CONVERSION_STATUSES = ['approved', 'rejected'];

function assertClickId(clickId) {
  if (!clickId || typeof clickId !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'clickId обязателен');
  }
}

function parsePayout(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function ensureOfferExists(offer, { offerId, clickId }) {
  if (offer) {
    return offer;
  }

  throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер для клика не найден', {
    offerId,
    clickId,
  });
}

function resolvePayout({ offer, override, status }) {
  if (typeof override === 'number') {
    return override;
  }

  if (status === 'rejected') {
    return 0;
  }

  const offerPayout = parsePayout(offer.payoutRub);

  if (offerPayout === null) {
    throw new ApiError(ERROR_CODES.INTERNAL_ERROR, 500, 'Некорректный payout оффера', {
      offerId: offer.id,
    });
  }

  return offerPayout;
}

export async function registerConversion({ clickId, status = 'approved', payoutRub }) {
  assertClickId(clickId);

  const click = await getClickByClickId(clickId);
  const offer = ensureOfferExists(await findOfferById(click.offerId), {
    offerId: click.offerId,
    clickId,
  });

  const existing = await findByClickId(clickId);

  if (existing) {
    throw new ApiError(
      ERROR_CODES.DUPLICATE_CONVERSION,
      409,
      'Конверсия уже существует',
      {
        clickId,
      },
    );
  }

  const resolvedPayout = resolvePayout({ offer, override: payoutRub, status });

  if (!Number.isFinite(resolvedPayout) || resolvedPayout < 0) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'Некорректный payout', {
      payoutRub: payoutRub ?? offer.payoutRub,
    });
  }

  try {
    return await createConversion({
      clickId,
      offerId: click.offerId,
      affiliateId: click.affiliateId,
      status,
      payoutRub: resolvedPayout,
    });
  } catch (error) {
    if (error?.code === '23505') {
      throw new ApiError(
        ERROR_CODES.DUPLICATE_CONVERSION,
        409,
        'Конверсия уже существует',
        {
          clickId,
        },
      );
    }

    throw error;
  }
}
