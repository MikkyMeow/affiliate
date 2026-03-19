import pool from '../db.js';

const conversionFields = `
  id,
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  status,
  goal_id AS "goalId",
  goal_name AS "goalName",
  goal_type AS "goalType",
  revenue_amount AS "revenueAmount",
  payout_amount AS "payoutAmount",
  payout_rub AS "payoutRub",
  created_at AS "createdAt"
`;

const conversionListFields = `
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  status,
  goal_id AS "goalId",
  goal_name AS "goalName",
  goal_type AS "goalType",
  revenue_amount AS "revenueAmount",
  payout_amount AS "payoutAmount",
  payout_rub AS "payoutRub",
  created_at AS "createdAt"
`;

export async function createConversion({
  clickId,
  offerId,
  affiliateId,
  status,
  payoutRub,
  goalId = null,
  goalName = null,
  goalType = null,
  revenueAmount = null,
  payoutAmount = null,
}) {
  const result = await pool.query(
    `
      INSERT INTO conversions (
        click_id,
        offer_id,
        affiliate_id,
        status,
        payout_rub,
        goal_id,
        goal_name,
        goal_type,
        revenue_amount,
        payout_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ${conversionFields};
    `,
    [
      clickId,
      offerId,
      affiliateId,
      status,
      payoutRub,
      goalId,
      goalName,
      goalType,
      revenueAmount,
      payoutAmount,
    ],
  );

  return result.rows[0] ?? null;
}

export async function findByClickId(clickId) {
  const result = await pool.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE click_id = $1;
    `,
    [clickId],
  );

  return result.rows[0] ?? null;
}

export async function findConversionById(id) {
  const result = await pool.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function updateConversionStatus({ id, status }) {
  const result = await pool.query(
    `
      UPDATE conversions
      SET status = $2
      WHERE id = $1
      RETURNING ${conversionFields};
    `,
    [id, status],
  );

  return result.rows[0] ?? null;
}

export async function listConversions(
  { offerId, affiliateId, status } = {},
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
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COALESCE(SUM(payout_rub), 0)::numeric AS "totalPayoutRub"
      FROM conversions
      ${whereClause};
    `,
    params,
  );

  const row = result.rows[0] ?? {
    total: 0,
    approved: 0,
    rejected: 0,
    totalPayoutRub: 0,
  };

  return {
    total: row.total ?? 0,
    approved: row.approved ?? 0,
    rejected: row.rejected ?? 0,
    totalPayoutRub: Number(row.totalPayoutRub ?? 0),
  };
}
