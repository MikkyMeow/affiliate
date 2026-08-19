import pool from '../../db.js';
import { ApiError } from '../../utils/apiError.js';
import { ERROR_CODES } from '../../utils/response.js';
import {
  assertOfferBelongsToAdvertiser,
  ensureAdvertiserContext,
} from './advertiser-context.service.js';

function buildFilter({ advertiserId, dateFrom, dateTo, status, offerId }) {
  const params = [advertiserId];
  const whereClauses = ['o.advertiser_id = $1'];

  if (offerId) {
    params.push(offerId);
    whereClauses.push(`pl.offer_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    whereClauses.push(`pl.status = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    whereClauses.push(`pl.created_at >= $${params.length}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    whereClauses.push(`pl.created_at < $${params.length}::date + INTERVAL '1 day'`);
  }

  const where = `WHERE ${whereClauses.join(' AND ')}`;
  return { whereClause: where, params };
}

function mapPostbackLogToAdvertiserView(log = {}) {
  return {
    id: log.id,
    offerId: log.offerId ?? null,
    conversionId: log.conversionId ?? null,
    clickId: log.clickId ?? null,
    status: log.status ?? null,
    errorCode: log.errorCode ?? null,
    responseStatusCode: log.responseStatusCode ?? null,
    sentAt: log.sentAt ?? log.createdAt ?? null,
    createdAt: log.createdAt ?? null,
    updatedAt: log.updatedAt ?? log.createdAt ?? null,
  };
}

export async function listAdvertiserPostbacks({
  advertiserId,
  page = 1,
  pageSize = 20,
  dateFrom,
  dateTo,
  status,
  offerId,
}) {
  ensureAdvertiserContext(advertiserId);

  if (offerId) {
    await assertOfferBelongsToAdvertiser({ advertiserId, offerId });
  }

  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const { whereClause, params } = buildFilter({
    advertiserId,
    dateFrom,
    dateTo,
    status,
    offerId,
  });

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM postback_logs pl
      JOIN offers o ON o.id = pl.offer_id
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT
        pl.id,
        pl.offer_id AS "offerId",
        pl.click_id AS "clickId",
        pl.status,
        pl.error_code AS "errorCode",
        pl.created_at AS "createdAt",
        c.id AS "conversionId"
      FROM postback_logs pl
      JOIN offers o ON o.id = pl.offer_id
      LEFT JOIN conversions c
        ON c.click_id = pl.click_id
       AND c.offer_id = pl.offer_id
      ${whereClause}
      ORDER BY pl.created_at DESC, pl.id DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  const total = totalResult.rows[0]?.count ?? 0;
  const items = result.rows.map(mapPostbackLogToAdvertiserView);
  const totalPages = total === 0 ? 0 : Math.ceil(total / (pageSize || 1));

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

export async function getAdvertiserPostbackById({ advertiserId, postbackLogId }) {
  ensureAdvertiserContext(advertiserId);

  if (!postbackLogId) {
    throw new ApiError(ERROR_CODES.VALIDATION_ERROR, 400, 'postbackLogId обязателен');
  }

  const result = await pool.query(
    `
      SELECT
        pl.id,
        pl.offer_id AS "offerId",
        pl.click_id AS "clickId",
        pl.status,
        pl.error_code AS "errorCode",
        pl.created_at AS "createdAt",
        c.id AS "conversionId"
      FROM postback_logs pl
      JOIN offers o ON o.id = pl.offer_id
      LEFT JOIN conversions c
        ON c.click_id = pl.click_id
       AND c.offer_id = pl.offer_id
      WHERE o.advertiser_id = $1
        AND pl.id = $2
      LIMIT 1;
    `,
    [advertiserId, postbackLogId],
  );

  const log = result.rows[0];

  if (!log) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Postback log не найден', {
      postbackLogId,
    });
  }

  return mapPostbackLogToAdvertiserView(log);
}
