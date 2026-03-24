import pool from '../db.js';

const affiliateFields = `
  id,
  name,
  email,
  status,
  user_id AS "userId",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getQueryable(client) {
  return client ?? pool;
}

export async function createAffiliate({
  name,
  email,
  status = 'active',
  userId = null,
}, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO affiliates (name, email, status, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING ${affiliateFields};
    `,
    [name, email.toLowerCase(), status, userId],
  );

  return result.rows[0];
}

export async function listAffiliates(
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
      FROM affiliates
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates
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

export async function findAffiliateById(id, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAffiliateByEmail(email, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates
      WHERE LOWER(email) = LOWER($1);
    `,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findAffiliateByUserId(userId, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates
      WHERE user_id = $1;
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function linkAffiliateToUser(id, userId) {
  const result = await pool.query(
    `
      UPDATE affiliates
      SET user_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING ${affiliateFields};
    `,
    [userId, id],
  );

  return result.rows[0] ?? null;
}

export async function updateAffiliate(id, { name, email, status }) {
  const assignments = [];
  const params = [];

  if (typeof name === 'string') {
    params.push(name);
    assignments.push(`name = $${params.length}`);
  }

  if (typeof email === 'string') {
    params.push(email.toLowerCase());
    assignments.push(`email = $${params.length}`);
  }

  if (typeof status === 'string') {
    params.push(status);
    assignments.push(`status = $${params.length}`);
  }

  if (assignments.length === 0) {
    return findAffiliateById(id);
  }

  const result = await pool.query(
    `
      UPDATE affiliates
      SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length + 1}
      RETURNING ${affiliateFields};
    `,
    [...params, id],
  );

  return result.rows[0] ?? null;
}
