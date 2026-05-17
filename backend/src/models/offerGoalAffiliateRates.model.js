import pool from '../db.js';

const rateFields = `
  id,
  offer_goal_id AS "offerGoalId",
  affiliate_id AS "affiliateId",
  revenue,
  payout,
  created_by AS "createdBy",
  updated_by AS "updatedBy",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getQueryable(client) {
  return client ?? pool;
}

export async function listOfferGoalAffiliateRatesByGoalId(goalId, { client } = {}) {
  if (!goalId) {
    throw new Error('goalId is required to list affiliate rates');
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${rateFields}
      FROM offer_goal_affiliate_rates
      WHERE offer_goal_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [goalId],
  );

  return result.rows;
}

export async function listOfferGoalAffiliateRatesByGoalIds(
  goalIds,
  { affiliateId = null, client } = {},
) {
  if (!Array.isArray(goalIds) || goalIds.length === 0) {
    return [];
  }

  const queryable = getQueryable(client);
  const params = [goalIds];
  let affiliateClause = '';

  if (affiliateId) {
    params.push(affiliateId);
    affiliateClause = `AND affiliate_id = $${params.length}`;
  }

  const result = await queryable.query(
    `
      SELECT ${rateFields}
      FROM offer_goal_affiliate_rates
      WHERE offer_goal_id = ANY($1::uuid[])
      ${affiliateClause}
      ORDER BY created_at ASC, id ASC
    `,
    params,
  );

  return result.rows;
}

export async function findOfferGoalAffiliateRate(
  goalId,
  affiliateId,
  { client, forUpdate = false } = {},
) {
  if (!goalId || !affiliateId) {
    throw new Error('goalId and affiliateId are required to fetch affiliate rate');
  }

  const queryable = getQueryable(client);
  const lockClause = forUpdate ? 'FOR UPDATE' : '';
  const result = await queryable.query(
    `
      SELECT ${rateFields}
      FROM offer_goal_affiliate_rates
      WHERE offer_goal_id = $1
        AND affiliate_id = $2
      ${lockClause}
    `,
    [goalId, affiliateId],
  );

  return result.rows[0] ?? null;
}

export async function upsertOfferGoalAffiliateRate(
  {
    goalId,
    affiliateId,
    revenue,
    payout,
    createdBy,
    updatedBy = null,
  },
  { client } = {},
) {
  if (!goalId || !affiliateId) {
    throw new Error('goalId and affiliateId are required to upsert affiliate rate');
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO offer_goal_affiliate_rates (
        offer_goal_id,
        affiliate_id,
        revenue,
        payout,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (offer_goal_id, affiliate_id)
      DO UPDATE
      SET revenue = EXCLUDED.revenue,
          payout = EXCLUDED.payout,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
      RETURNING ${rateFields}
    `,
    [goalId, affiliateId, revenue, payout, createdBy, updatedBy],
  );

  return result.rows[0] ?? null;
}

export async function deleteOfferGoalAffiliateRate(goalId, affiliateId, { client } = {}) {
  if (!goalId || !affiliateId) {
    throw new Error('goalId and affiliateId are required to delete affiliate rate');
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      DELETE FROM offer_goal_affiliate_rates
      WHERE offer_goal_id = $1
        AND affiliate_id = $2
      RETURNING ${rateFields}
    `,
    [goalId, affiliateId],
  );

  return result.rows[0] ?? null;
}
