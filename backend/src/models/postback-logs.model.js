import pool from '../db.js';
import { formatPublicId, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const postbackLogFields = `
  id,
  request_id AS "requestId",
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  status,
  error_code AS "errorCode",
  payload_json AS "payloadJson",
  resolved_goal_id AS "resolvedGoalId",
  resolved_goal_name AS "resolvedGoalName",
  goal_error AS "goalError",
  created_at AS "createdAt"
`;

export async function createPostbackLog({
  requestId = null,
  clickId = null,
  offerId = null,
  affiliateId = null,
  status,
  errorCode = null,
  payloadJson = {},
}) {
  const result = await pool.query(
    `
      INSERT INTO postback_logs (
        request_id,
        click_id,
        offer_id,
        affiliate_id,
        status,
        error_code,
        payload_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${postbackLogFields};
    `,
    [requestId, clickId, offerId, affiliateId, status, errorCode, payloadJson],
  );

  return result.rows[0] ?? null;
}

export async function updatePostbackLogResult({
  id,
  requestId,
  clickId,
  offerId,
  affiliateId,
  status,
  errorCode,
  resolvedGoalId,
  resolvedGoalName,
  goalError,
}) {
  const fields = [];
  const values = [];
  let index = 1;

  if (requestId !== undefined) {
    fields.push(`request_id = $${index++}`);
    values.push(requestId);
  }

  if (clickId !== undefined) {
    fields.push(`click_id = $${index++}`);
    values.push(clickId);
  }

  if (offerId !== undefined) {
    fields.push(`offer_id = $${index++}`);
    values.push(offerId);
  }

  if (affiliateId !== undefined) {
    fields.push(`affiliate_id = $${index++}`);
    values.push(affiliateId);
  }

  if (status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(status);
  }

  if (errorCode !== undefined) {
    fields.push(`error_code = $${index++}`);
    values.push(errorCode);
  }

  if (resolvedGoalId !== undefined) {
    fields.push(`resolved_goal_id = $${index++}`);
    values.push(resolvedGoalId);
  }

  if (resolvedGoalName !== undefined) {
    fields.push(`resolved_goal_name = $${index++}`);
    values.push(resolvedGoalName);
  }

  if (goalError !== undefined) {
    fields.push(`goal_error = $${index++}`);
    values.push(goalError);
  }

  if (!fields.length) {
    return null;
  }

  values.push(id);

  const result = await pool.query(
    `
      UPDATE postback_logs
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING ${postbackLogFields};
    `,
    values,
  );

  return result.rows[0] ?? null;
}

export async function listAdminPostbackLogs(
  {
    dateFrom,
    dateTo,
    offerId,
    goalId,
    status,
    errorCode,
    conversionId,
    externalId,
    isTest,
    search,
  } = {},
  {
    limit = 20,
    offset = 0,
    sort = 'createdAt',
    order = 'desc',
  } = {},
) {
  const conditions = [];
  const params = [];
  const normalizedOrder =
    typeof order === 'string' && order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortMap = {
    createdAt: 'pl.created_at',
    status: 'pl.status',
    errorCode: 'pl.error_code',
    requestId: 'pl.request_id',
    clickId: 'pl.click_id',
  };
  const sortColumn = sortMap[sort] ?? sortMap.createdAt;

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`pl.created_at >= $${params.length}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`pl.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  if (offerId) {
    params.push(offerId);
    conditions.push(`pl.offer_id = $${params.length}`);
  }

  if (goalId) {
    params.push(goalId);
    conditions.push(`pl.resolved_goal_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`pl.status = $${params.length}`);
  }

  if (errorCode) {
    params.push(errorCode);
    conditions.push(`pl.error_code ILIKE $${params.length}`);
  }

  if (conversionId) {
    params.push(conversionId);
    conditions.push(`c.id = $${params.length}`);
  }

  if (externalId) {
    params.push(externalId);
    conditions.push(`
      COALESCE(
        pl.payload_json->>'externalTransactionId',
        pl.payload_json->>'externalTransactionID',
        pl.payload_json->>'externalId',
        pl.payload_json->>'external_id',
        pl.payload_json->>'transactionId',
        pl.payload_json->>'transaction_id',
        ''
      ) ILIKE $${params.length}
    `);
  }

  if (typeof isTest === 'boolean') {
    params.push(isTest);
    conditions.push(`COALESCE(c.is_test, false) = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const searchParam = `$${params.length}`;
    conditions.push(`
      (
        LOWER(COALESCE(pl.request_id, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(pl.click_id, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(pl.error_code, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(o.title, '')) LIKE ${searchParam}
        OR LOWER('#O' || o.public_id_number::text) LIKE ${searchParam}
        OR LOWER(COALESCE(pl.resolved_goal_name, '')) LIKE ${searchParam}
        OR LOWER(
          COALESCE(
            pl.payload_json->>'externalTransactionId',
            pl.payload_json->>'externalTransactionID',
            pl.payload_json->>'externalId',
            pl.payload_json->>'external_id',
            pl.payload_json->>'transactionId',
            pl.payload_json->>'transaction_id',
            ''
          )
        ) LIKE ${searchParam}
        OR LOWER(COALESCE(c.id::text, '')) LIKE ${searchParam}
      )
    `);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromClause = `
    FROM postback_logs AS pl
    LEFT JOIN offers AS o ON o.id = pl.offer_id
    LEFT JOIN LATERAL (
      SELECT c.id, c.is_test
      FROM conversions AS c
      WHERE c.click_id = pl.click_id
        AND c.offer_id = pl.offer_id
        AND (
          pl.resolved_goal_id IS NULL
          OR c.goal_id = pl.resolved_goal_id
        )
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT 1
    ) AS c ON TRUE
  `;

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      ${fromClause}
      ${whereClause}
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT
        pl.id,
        pl.request_id AS "requestId",
        pl.click_id AS "clickId",
        pl.offer_id AS "offerId",
        o.public_id_number AS "offerPublicIdNumber",
        o.title AS "offerName",
        pl.status,
        pl.error_code AS "errorCode",
        pl.resolved_goal_id AS "goalId",
        pl.resolved_goal_name AS "goalName",
        pl.goal_error AS "goalError",
        pl.created_at AS "createdAt",
        c.id AS "conversionId",
        COALESCE(c.is_test, false) AS "isTest",
        COALESCE(
          pl.payload_json->>'externalTransactionId',
          pl.payload_json->>'externalTransactionID',
          pl.payload_json->>'externalId',
          pl.payload_json->>'external_id',
          pl.payload_json->>'transactionId',
          pl.payload_json->>'transaction_id'
        ) AS "externalId"
      ${fromClause}
      ${whereClause}
      ORDER BY ${sortColumn} ${normalizedOrder}, pl.id ${normalizedOrder}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, limit, offset],
  );

  return {
    items: result.rows.map((row) => ({
      id: row.id,
      requestId: row.requestId ?? null,
      clickId: row.clickId ?? null,
      offerId: row.offerId ?? null,
      offer: row.offerId
        ? {
            id: row.offerId,
            publicId: formatPublicId(
              PUBLIC_ID_PREFIXES.offer,
              Number(row.offerPublicIdNumber ?? 0),
            ),
            name: row.offerName ?? null,
          }
        : null,
      status: row.status ?? null,
      errorCode: row.errorCode ?? null,
      goalId: row.goalId ?? null,
      goal: row.goalId
        ? {
            id: row.goalId,
            name: row.goalName ?? null,
          }
        : null,
      goalError: row.goalError ?? null,
      conversionId: row.conversionId ?? null,
      externalId: row.externalId ?? null,
      isTest: Boolean(row.isTest),
      createdAt: row.createdAt ?? null,
    })),
    total: totalResult.rows[0]?.count ?? 0,
  };
}
