import pool from '../../db.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';

const advertiserOfferFields = `
  id,
  title,
  status,
  payout_rub AS "payoutRub",
  preview_url AS "previewUrl",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function ensureAdvertiserContext(advertiserId) {
  if (!advertiserId) {
    throw new Error('advertiserId is required to query offers');
  }
}

function normalizeMoney(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function mapOfferToAdvertiserView(offer) {
  if (!offer) {
    return null;
  }

  return {
    id: offer.id,
    name: offer.title ?? null,
    status: offer.status ?? null,
    payoutRub: normalizeMoney(offer.payoutRub),
    revenueRub: offer.revenueRub ?? null,
    trackingType: offer.trackingType ?? null,
    category: offer.category ?? null,
    previewUrl: offer.previewUrl ?? null,
    createdAt: offer.createdAt ?? null,
    updatedAt: offer.updatedAt ?? null,
  };
}

export async function listAdvertiserOffers({
  advertiserId,
  page = 1,
  pageSize = 20,
  status = null,
  search = null,
}) {
  ensureAdvertiserContext(advertiserId);

  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const whereClauses = ['advertiser_id = $1'];
  const params = [advertiserId];

  if (status) {
    params.push(status);
    whereClauses.push(`status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`title ILIKE $${params.length}`);
  }

  const where = whereClauses.length
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM offers
      ${where};
    `,
    params,
  );

  const total = totalResult.rows[0]?.count ?? 0;

  const itemsResult = await pool.query(
    `
      SELECT ${advertiserOfferFields}
      FROM offers
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  const items = itemsResult.rows.map(mapOfferToAdvertiserView);
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / (pageSize || 1));

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

export async function getAdvertiserOfferById({ advertiserId, offerId }) {
  ensureAdvertiserContext(advertiserId);

  if (!offerId) {
    throw new Error('offerId is required to fetch advertiser offer');
  }

  const result = await pool.query(
    `
      SELECT ${advertiserOfferFields}
      FROM offers
      WHERE advertiser_id = $1
        AND id = $2
      LIMIT 1;
    `,
    [advertiserId, offerId],
  );

  const offer = result.rows[0];

  if (!offer) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Оффер не найден', {
      offerId,
    });
  }

  return mapOfferToAdvertiserView(offer);
}
