import crypto from 'crypto';
import { createConversion, findByClickId } from '../../models/conversions.model.js';
import { findOfferForPostback } from '../../models/offers.model.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import { getClickByClickId } from '../tracking/clicks.service.js';

export const CONVERSION_STATUSES = ['approved', 'rejected'];

function assertClickId(clickId) {
  if (!clickId || typeof clickId !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'clickId обязателен');
  }
}

function assertToken(token) {
  if (!token || typeof token !== 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'token обязателен');
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

function assertTokenMatches({ provided, actual, offerId, clickId }) {
  if (typeof actual !== 'string' || !actual.length) {
    throw new ApiError(ERROR_CODES.INTERNAL_ERROR, 500, 'У оффера отсутствует token', {
      offerId,
    });
  }

  const providedBuffer = Buffer.from(provided);
  const actualBuffer = Buffer.from(actual);

  if (
    providedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, actualBuffer)
  ) {
    throw new ApiError(
      ERROR_CODES.INVALID_POSTBACK_TOKEN,
      403,
      'Некорректный postback token',
      {
        offerId,
        clickId,
      },
    );
  }
}

function buildSignaturePayload({ clickId, status, payoutRub }) {
  const payout = typeof payoutRub === 'number' ? payoutRub.toString(10) : '';
  return `${clickId}|${status}|${payout}`;
}

function calculateSignature({ payload, secret }) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifySignature({ signature, secret, clickId, status, payoutRub }) {
  if (!signature || typeof signature !== 'string') {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, 401, 'Подпись обязательна');
  }

  const normalizedSignature = signature.trim().toLowerCase();

  if (!/^[0-9a-f]+$/.test(normalizedSignature) || normalizedSignature.length % 2 !== 0) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, 401, 'Некорректная подпись');
  }

  const payload = buildSignaturePayload({ clickId, status, payoutRub });
  const expected = calculateSignature({ payload, secret }).toLowerCase();
  const providedBuffer = Buffer.from(normalizedSignature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, 401, 'Подпись не прошла проверку');
  }
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

export async function registerConversion({
  token,
  clickId,
  signature,
  status = 'approved',
  payoutRub,
}) {
  assertToken(token);
  assertClickId(clickId);

  const click = await getClickByClickId(clickId);
  const offer = ensureOfferExists(await findOfferForPostback(click.offerId), {
    offerId: click.offerId,
    clickId,
  });

  assertTokenMatches({
    provided: token,
    actual: offer.postbackToken,
    offerId: offer.id,
    clickId,
  });

  verifySignature({
    signature,
    secret: offer.postbackToken,
    clickId,
    status,
    payoutRub,
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
