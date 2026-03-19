import pool from '../db.js';

const goalFields = `
  id,
  offer_id AS "offerId",
  name,
  type,
  revenue,
  payout,
  currency,
  is_default AS "isDefault",
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getQueryable(client) {
  return client ?? pool;
}

function buildLockClause({ forUpdate } = {}) {
  if (forUpdate) {
    return 'FOR UPDATE';
  }

  return '';
}

export async function listOfferGoalsByOfferId(offerId, { client } = {}) {
  if (!offerId) {
    throw new Error('offerId is required to list goals');
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      SELECT ${goalFields}
      FROM offer_goals
      WHERE offer_id = $1
      ORDER BY is_default DESC, created_at ASC, id ASC
    `,
    [offerId],
  );

  return result.rows;
}

export async function insertOfferGoal(
  { offerId, name, type, revenue, payout, currency, isDefault, isActive },
  { client } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to create goal');
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      INSERT INTO offer_goals (
        offer_id,
        name,
        type,
        revenue,
        payout,
        currency,
        is_default,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${goalFields}
    `,
    [offerId, name, type, revenue, payout, currency, isDefault, isActive],
  );

  return result.rows[0] ?? null;
}

export async function updateOfferGoal(
  goalId,
  { name, type, revenue, payout, currency, isDefault, isActive },
  { client } = {},
) {
  if (!goalId) {
    throw new Error('goalId is required to update goal');
  }

  const assignments = [];
  const params = [];

  if (typeof name === 'string') {
    params.push(name);
    assignments.push(`name = $${params.length}`);
  }

  if (typeof type === 'string') {
    params.push(type);
    assignments.push(`type = $${params.length}`);
  }

  if (typeof revenue === 'number') {
    params.push(revenue);
    assignments.push(`revenue = $${params.length}`);
  }

  if (typeof payout === 'number') {
    params.push(payout);
    assignments.push(`payout = $${params.length}`);
  }

  if (typeof currency === 'string') {
    params.push(currency);
    assignments.push(`currency = $${params.length}`);
  }

  if (typeof isDefault === 'boolean') {
    params.push(isDefault);
    assignments.push(`is_default = $${params.length}`);
  }

  if (typeof isActive === 'boolean') {
    params.push(isActive);
    assignments.push(`is_active = $${params.length}`);
  }

  if (assignments.length === 0) {
    return findOfferGoalById(goalId, { client });
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      UPDATE offer_goals
      SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length + 1}
      RETURNING ${goalFields}
    `,
    [...params, goalId],
  );

  return result.rows[0] ?? null;
}

export async function findOfferGoalById(
  goalId,
  { client, forUpdate = false } = {},
) {
  if (!goalId) {
    throw new Error('goalId is required to fetch goal');
  }

  const queryable = getQueryable(client);
  const lockClause = buildLockClause({ forUpdate });

  const result = await queryable.query(
    `
      SELECT ${goalFields}
      FROM offer_goals
      WHERE id = $1
      ${lockClause}
    `,
    [goalId],
  );

  return result.rows[0] ?? null;
}

export async function findDefaultActiveGoalByOfferId(
  offerId,
  { client, forUpdate = false } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to fetch default goal');
  }

  const queryable = getQueryable(client);
  const lockClause = buildLockClause({ forUpdate });

  const result = await queryable.query(
    `
      SELECT ${goalFields}
      FROM offer_goals
      WHERE offer_id = $1
        AND is_default = true
        AND is_active = true
      ORDER BY updated_at DESC, created_at DESC, id DESC
      LIMIT 1
      ${lockClause}
    `,
    [offerId],
  );

  return result.rows[0] ?? null;
}

export async function unsetDefaultOfferGoals(
  offerId,
  { client, excludeGoalId = null } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to reset default goals');
  }

  const params = [offerId];

  let excludeClause = '';
  if (excludeGoalId) {
    params.push(excludeGoalId);
    excludeClause = `AND id <> $${params.length}`;
  }

  const queryable = getQueryable(client);

  await queryable.query(
    `
      UPDATE offer_goals
      SET is_default = false,
          updated_at = NOW()
      WHERE offer_id = $1
        AND is_default = true
        ${excludeClause}
    `,
    params,
  );
}
