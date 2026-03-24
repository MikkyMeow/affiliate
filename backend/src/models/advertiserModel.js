import pool from '../db.js';

const advertiserFields = `
  id,
  name,
  status,
  user_id AS "userId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function createAdvertiser({
  name,
  status = 'active',
  userId = null,
}) {
  const result = await pool.query(
    `
      INSERT INTO advertisers (name, status, user_id)
      VALUES ($1, $2, $3)
      RETURNING ${advertiserFields};
    `,
    [name, status, userId],
  );

  return result.rows[0];
}

export async function listAdvertisers(
  { status } = {},
  { limit = 20, offset = 0 } = {},
) {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM advertisers
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${advertiserFields}
      FROM advertisers
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

export async function findAdvertiserById(id) {
  const result = await pool.query(
    `
      SELECT ${advertiserFields}
      FROM advertisers
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAdvertiserByUserId(userId) {
  const result = await pool.query(
    `
      SELECT ${advertiserFields}
      FROM advertisers
      WHERE user_id = $1;
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function updateAdvertiser(id, { name, status }) {
  const assignments = [];
  const params = [];

  if (typeof name === 'string') {
    params.push(name);
    assignments.push(`name = $${params.length}`);
  }

  if (typeof status === 'string') {
    params.push(status);
    assignments.push(`status = $${params.length}`);
  }

  if (assignments.length === 0) {
    return findAdvertiserById(id);
  }

  const result = await pool.query(
    `
      UPDATE advertisers
      SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length + 1}
      RETURNING ${advertiserFields};
    `,
    [...params, id],
  );

  return result.rows[0] ?? null;
}
