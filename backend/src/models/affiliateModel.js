import pool from '../db.js';

const affiliateFields = `
  id,
  name,
  email,
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function createAffiliate({ name, email, status = 'active' }) {
  const result = await pool.query(
    `
      INSERT INTO affiliates (name, email, status)
      VALUES ($1, $2, $3)
      RETURNING ${affiliateFields};
    `,
    [name, email.toLowerCase(), status],
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

export async function findAffiliateById(id) {
  const result = await pool.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAffiliateByEmail(email) {
  const result = await pool.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates
      WHERE LOWER(email) = LOWER($1);
    `,
    [email],
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
