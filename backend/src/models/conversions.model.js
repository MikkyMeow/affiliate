import pool from '../db.js';
import { COUNTED_CONVERSION_STATUSES } from '../constants/conversions.js';
import { formatPublicId, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const conversionFields = `
  id,
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  source,
  manual_adjustment_batch_id AS "manualAdjustmentBatchId",
  created_by AS "createdBy",
  status,
  is_test AS "isTest",
  external_transaction_id AS "externalTransactionId",
  goal_id AS "goalId",
  goal_name AS "goalName",
  goal_type AS "goalType",
  revenue_amount AS "revenueAmount",
  payout_amount AS "payoutAmount",
  payout_rub AS "payoutRub",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const conversionListFields = `
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  source,
  status,
  is_test AS "isTest",
  external_transaction_id AS "externalTransactionId",
  goal_id AS "goalId",
  goal_name AS "goalName",
  goal_type AS "goalType",
  revenue_amount AS "revenueAmount",
  payout_amount AS "payoutAmount",
  payout_rub AS "payoutRub",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const adminConversionListFields = `
  c.id,
  c.click_id AS "clickId",
  c.offer_id AS "offerId",
  o.public_id_number AS "offerPublicIdNumber",
  o.title AS "offerName",
  c.goal_id AS "goalId",
  COALESCE(c.goal_name, og.name) AS "goalName",
  c.affiliate_id AS "affiliateId",
  a.public_id_number AS "affiliatePublicIdNumber",
  a.name AS "affiliateName",
  adv.id AS "advertiserId",
  adv.public_id_number AS "advertiserPublicIdNumber",
  adv.name AS "advertiserName",
  c.source,
  c.manual_adjustment_batch_id AS "manualAdjustmentBatchId",
  c.status,
  c.is_test AS "isTest",
  c.external_transaction_id AS "externalTransactionId",
  c.revenue_amount AS "revenueAmount",
  c.payout_amount AS "payoutAmount",
  c.payout_rub AS "payoutRub",
  c.created_at AS "createdAt",
  c.updated_at AS "updatedAt"
`;

function addUuidOrPublicIdCondition({
  value,
  idColumn,
  publicIdColumn,
  conditions,
  params,
}) {
  if (!value) {
    return;
  }

  params.push(value.value);
  conditions.push(
    value.type === 'publicId'
      ? `${publicIdColumn} = $${params.length}`
      : `${idColumn} = $${params.length}`,
  );
}

function addPartialMatchCondition({ value, column, conditions, params }) {
  if (!value) {
    return;
  }

  params.push(`%${value}%`);
  conditions.push(`${column} ILIKE $${params.length}`);
}

function normalizeMoneyValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? Number(normalized.toFixed(2)) : null;
}

function normalizeAdminConversionRow(row) {
  const base = serializeConversionRecord(row);
  const revenue = normalizeMoneyValue(row.revenueAmount);
  const payout = normalizeMoneyValue(row.payoutAmount ?? row.payoutRub);
  const profit =
    revenue !== null && payout !== null
      ? Number((revenue - payout).toFixed(2))
      : null;

  return {
    ...base,
    offer: {
      id: base.offerId,
      publicId: formatPublicId(
        PUBLIC_ID_PREFIXES.offer,
        Number(row.offerPublicIdNumber ?? 0),
      ),
      name: row.offerName ?? null,
    },
    goalId: row.goalId ?? null,
    goal: row.goalId
      ? {
          id: row.goalId,
          name: row.goalName ?? null,
        }
      : null,
    affiliateId: row.affiliateId,
    affiliate: {
      id: row.affiliateId,
      publicId: formatPublicId(
        PUBLIC_ID_PREFIXES.affiliate,
        Number(row.affiliatePublicIdNumber ?? 0),
      ),
      name: row.affiliateName ?? null,
    },
    advertiserId: row.advertiserId ?? null,
    advertiser: row.advertiserId
      ? {
          id: row.advertiserId,
          publicId: formatPublicId(
            PUBLIC_ID_PREFIXES.advertiser,
            Number(row.advertiserPublicIdNumber ?? 0),
          ),
          name: row.advertiserName ?? null,
        }
      : null,
    revenue,
    payout,
    profit,
  };
}

export async function findAdminConversionById(
  id,
  { client = pool, forUpdate = false } = {},
) {
  const lockClause = forUpdate ? 'FOR UPDATE' : '';
  const result = await client.query(
    `
      SELECT ${adminConversionListFields}
      FROM conversions AS c
      INNER JOIN offers AS o ON o.id = c.offer_id
      INNER JOIN affiliates AS a ON a.id = c.affiliate_id
      LEFT JOIN advertisers AS adv ON adv.id = o.advertiser_id
      LEFT JOIN offer_goals AS og ON og.id = c.goal_id
      WHERE c.id = $1
      ${lockClause};
    `,
    [id],
  );

  return result.rows[0] ? normalizeAdminConversionRow(result.rows[0]) : null;
}

export function serializeConversionRecord(row) {
  const revenue = normalizeMoneyValue(row?.revenueAmount);
  const payout = normalizeMoneyValue(row?.payoutAmount ?? row?.payoutRub);
  const profit =
    revenue !== null && payout !== null
      ? Number((revenue - payout).toFixed(2))
      : null;

  return {
    id: row?.id ?? null,
    clickId: row?.clickId ?? null,
    offerId: row?.offerId ?? null,
    affiliateId: row?.affiliateId ?? null,
    source: row?.source ?? 'tracking',
    manualAdjustmentBatchId: row?.manualAdjustmentBatchId ?? null,
    createdBy: row?.createdBy ?? null,
    status: row?.status ?? null,
    isTest: Boolean(row?.isTest),
    externalTransactionId: row?.externalTransactionId ?? null,
    goalId: row?.goalId ?? null,
    goalName: row?.goalName ?? null,
    goalType: row?.goalType ?? null,
    revenue,
    payout,
    profit,
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? row?.createdAt ?? null,
  };
}

export async function createConversion({
  clickId = null,
  offerId,
  affiliateId,
  source = 'tracking',
  manualAdjustmentBatchId = null,
  createdBy = null,
  status,
  isTest = false,
  payoutRub,
  externalTransactionId = null,
  goalId = null,
  goalName = null,
  goalType = null,
  revenueAmount = null,
  payoutAmount = null,
  createdAt = null,
}, { client = pool } = {}) {
  const result = await client.query(
    `
      INSERT INTO conversions (
        click_id,
        offer_id,
        affiliate_id,
        source,
        manual_adjustment_batch_id,
        created_by,
        status,
        is_test,
        payout_rub,
        external_transaction_id,
        goal_id,
        goal_name,
        goal_type,
        revenue_amount,
        payout_amount,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        COALESCE($16, NOW())
      )
      RETURNING ${conversionFields};
    `,
    [
      clickId,
      offerId,
      affiliateId,
      source,
      manualAdjustmentBatchId,
      createdBy,
      status,
      isTest,
      payoutRub,
      externalTransactionId,
      goalId,
      goalName,
      goalType,
      revenueAmount,
      payoutAmount,
      createdAt,
    ],
  );

  return result.rows[0] ?? null;
}

export async function findByClickId(clickId) {
  const result = await pool.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE click_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    `,
    [clickId],
  );

  return result.rows[0] ?? null;
}

export async function listByClickId(clickId, { client = pool } = {}) {
  const result = await client.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE click_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [clickId],
  );

  return result.rows;
}

export async function findByClickIdAndGoalId(
  clickId,
  goalId,
  { client = pool } = {},
) {
  const result = await client.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE click_id = $1
        AND goal_id = $2
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [clickId, goalId],
  );

  return result.rows[0] ?? null;
}

export async function findByClickIdAndGoalIdForUpdate(
  clickId,
  goalId,
  { client = pool } = {},
) {
  const result = await client.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE click_id = $1
        AND goal_id = $2
      FOR UPDATE
    `,
    [clickId, goalId],
  );

  return result.rows[0] ?? null;
}

export async function findByOfferGoalAndExternalTransactionId(
  offerId,
  goalId,
  externalTransactionId,
  { client = pool, forUpdate = false } = {},
) {
  const lockClause = forUpdate ? 'FOR UPDATE' : '';
  const result = await client.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE offer_id = $1
        AND goal_id = $2
        AND external_transaction_id = $3
      ${lockClause}
    `,
    [offerId, goalId, externalTransactionId],
  );

  return result.rows[0] ?? null;
}

export async function findConversionById(
  id,
  { client = pool, forUpdate = false } = {},
) {
  const lockClause = forUpdate ? 'FOR UPDATE' : '';
  const result = await client.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE id = $1
      ${lockClause};
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function updateConversionStatus(
  { id, status },
  { client = pool } = {},
) {
  const result = await client.query(
    `
      UPDATE conversions
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${conversionFields};
    `,
    [id, status],
  );

  return result.rows[0] ?? null;
}

export async function listConversions(
  { offerId, affiliateId, status, isTest } = {},
  { limit = 20, offset = 0 } = {},
) {
  const conditions = [];
  const params = [];

  if (offerId) {
    params.push(offerId);
    conditions.push(`offer_id = $${params.length}`);
  }

  if (affiliateId) {
    params.push(affiliateId);
    conditions.push(`affiliate_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (typeof isTest === 'boolean') {
    params.push(isTest);
    conditions.push(`COALESCE(is_test, false) = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM conversions
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${conversionListFields}
      FROM conversions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  return {
    items: result.rows,
    total: totalResult.rows[0]?.count ?? 0,
  };
}

export async function listAdminConversions(
  {
    dateFrom,
    dateTo,
    offerId,
    goalId,
    affiliateId,
    advertiserId,
    status,
    clickId,
    conversionId,
    externalTransactionId,
    source,
    isTest,
    revenueMin,
    revenueMax,
    payoutMin,
    payoutMax,
  } = {},
  { limit = 20, offset = 0, order = 'desc' } = {},
) {
  const conditions = [];
  const params = [];
  const normalizedOrder = typeof order === 'string' && order.toLowerCase() === 'asc'
    ? 'ASC'
    : 'DESC';

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`c.created_at >= $${params.length}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`c.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  addUuidOrPublicIdCondition({
    value: offerId,
    idColumn: 'o.id',
    publicIdColumn: 'o.public_id_number',
    conditions,
    params,
  });

  if (goalId) {
    params.push(goalId);
    conditions.push(`c.goal_id = $${params.length}`);
  }

  addUuidOrPublicIdCondition({
    value: affiliateId,
    idColumn: 'a.id',
    publicIdColumn: 'a.public_id_number',
    conditions,
    params,
  });

  addUuidOrPublicIdCondition({
    value: advertiserId,
    idColumn: 'adv.id',
    publicIdColumn: 'adv.public_id_number',
    conditions,
    params,
  });

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  if (source) {
    params.push(source);
    conditions.push(`c.source = $${params.length}`);
  }

  if (typeof isTest === 'boolean') {
    params.push(isTest);
    conditions.push(`COALESCE(c.is_test, false) = $${params.length}`);
  }

  if (conversionId) {
    params.push(conversionId);
    conditions.push(`c.id = $${params.length}`);
  }

  addPartialMatchCondition({ value: clickId, column: 'c.click_id', conditions, params });
  addPartialMatchCondition({
    value: externalTransactionId,
    column: 'c.external_transaction_id',
    conditions,
    params,
  });

  if (revenueMin !== undefined) {
    params.push(revenueMin);
    conditions.push(`c.revenue_amount >= $${params.length}`);
  }

  if (revenueMax !== undefined) {
    params.push(revenueMax);
    conditions.push(`c.revenue_amount <= $${params.length}`);
  }

  if (payoutMin !== undefined) {
    params.push(payoutMin);
    conditions.push(`COALESCE(c.payout_amount, c.payout_rub) >= $${params.length}`);
  }

  if (payoutMax !== undefined) {
    params.push(payoutMax);
    conditions.push(`COALESCE(c.payout_amount, c.payout_rub) <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromClause = `
    FROM conversions AS c
    INNER JOIN offers AS o ON o.id = c.offer_id
    INNER JOIN affiliates AS a ON a.id = c.affiliate_id
    LEFT JOIN advertisers AS adv ON adv.id = o.advertiser_id
    LEFT JOIN offer_goals AS og ON og.id = c.goal_id
  `;

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      ${fromClause}
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${adminConversionListFields}
      ${fromClause}
      ${whereClause}
      ORDER BY c.created_at ${normalizedOrder}, c.id ${normalizedOrder}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  return {
    items: result.rows.map(normalizeAdminConversionRow),
    total: totalResult.rows[0]?.count ?? 0,
  };
}

export async function getConversionTotals({ offerId, affiliateId } = {}) {
  const conditions = [];
  const params = [];

  if (offerId) {
    params.push(offerId);
    conditions.push(`offer_id = $${params.length}`);
  }

  if (affiliateId) {
    params.push(affiliateId);
    conditions.push(`affiliate_id = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        COALESCE(SUM(payout_rub), 0)::numeric AS "totalPayoutRub"
      FROM conversions
      ${whereClause};
    `,
    params,
  );

  const row = result.rows[0] ?? {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    totalPayoutRub: 0,
  };

  return {
    total: row.total ?? 0,
    pending: row.pending ?? 0,
    approved: row.approved ?? 0,
    rejected: row.rejected ?? 0,
    cancelled: row.cancelled ?? 0,
    totalPayoutRub: Number(row.totalPayoutRub ?? 0),
  };
}

export async function getCountedConversionCountByGoalId(goalId, { client = pool } = {}) {
  if (!goalId) {
    throw new Error('goalId is required to count goal conversions');
  }

  const result = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM conversions
      WHERE goal_id = $1
        AND status = ANY($2::text[])
    `,
    [goalId, COUNTED_CONVERSION_STATUSES],
  );

  return result.rows[0]?.count ?? 0;
}

export async function getCountedConversionCountsByGoalIds(
  goalIds,
  { client = pool } = {},
) {
  if (!Array.isArray(goalIds) || goalIds.length === 0) {
    return new Map();
  }

  const result = await client.query(
    `
      SELECT goal_id AS "goalId", COUNT(*)::int AS count
      FROM conversions
      WHERE goal_id = ANY($1::uuid[])
        AND status = ANY($2::text[])
      GROUP BY goal_id
    `,
    [goalIds, COUNTED_CONVERSION_STATUSES],
  );

  return new Map(
    result.rows.map((row) => [
      row.goalId,
      Number.isFinite(row.count) ? row.count : Number(row.count ?? 0),
    ]),
  );
}
