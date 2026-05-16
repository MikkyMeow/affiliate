import pool from '../db.js';
import { attachPublicId, attachPublicIds, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const affiliateFields = `
  a.id,
  a.public_id_number AS "publicIdNumber",
  a.name,
  a.email,
  a.status,
  a.telegram,
  a.internal_note AS "internalNote",
  a.user_id AS "userId",
  a.manager_user_id AS "managerUserId",
  a.created_at AS "createdAt",
  a.updated_at AS "updatedAt",
  mu.id AS "manager.id",
  mu.display_name AS "manager.displayName",
  mu.email AS "manager.email"
`;

function getQueryable(client) {
  return client ?? pool;
}

function normalizeAffiliate(row) {
  if (!row) {
    return null;
  }

  const managerId = row['manager.id'] ?? null;

  return {
    id: row.id,
    publicIdNumber: row.publicIdNumber ?? null,
    name: row.name,
    email: row.email,
    status: row.status,
    telegram: row.telegram ?? null,
    internalNote: row.internalNote ?? null,
    userId: row.userId ?? null,
    managerUserId: row.managerUserId ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    manager: managerId
      ? {
          id: managerId,
          displayName: row['manager.displayName'] ?? null,
          email: row['manager.email'] ?? null,
        }
      : null,
  };
}

export async function createAffiliate({
  name,
  email,
  status = 'active',
  telegram = null,
  userId = null,
}, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO affiliates (name, email, status, telegram, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `,
    [name, email.toLowerCase(), status, telegram, userId],
  );

  return findAffiliateById(result.rows[0]?.id, { client });
}

export async function listAffiliates(
  { status, managerUserId } = {},
  { limit = 20, offset = 0 } = {},
) {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }

  if (managerUserId) {
    params.push(managerUserId);
    conditions.push(`a.manager_user_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM affiliates AS a
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates AS a
      LEFT JOIN users AS mu ON mu.id = a.manager_user_id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  return {
    items: attachPublicIds(result.rows.map(normalizeAffiliate), PUBLIC_ID_PREFIXES.affiliate),
    total: totalResult.rows[0]?.count ?? 0,
  };
}

export async function findAffiliateById(id, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates AS a
      LEFT JOIN users AS mu ON mu.id = a.manager_user_id
      WHERE a.id = $1;
    `,
    [id],
  );

  return attachPublicId(normalizeAffiliate(result.rows[0] ?? null), PUBLIC_ID_PREFIXES.affiliate);
}

export async function findAffiliateByEmail(email, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates AS a
      LEFT JOIN users AS mu ON mu.id = a.manager_user_id
      WHERE LOWER(a.email) = LOWER($1);
    `,
    [email],
  );

  return attachPublicId(normalizeAffiliate(result.rows[0] ?? null), PUBLIC_ID_PREFIXES.affiliate);
}

export async function findAffiliateByUserId(userId, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${affiliateFields}
      FROM affiliates AS a
      LEFT JOIN users AS mu ON mu.id = a.manager_user_id
      WHERE a.user_id = $1;
    `,
    [userId],
  );

  return attachPublicId(normalizeAffiliate(result.rows[0] ?? null), PUBLIC_ID_PREFIXES.affiliate);
}

export async function linkAffiliateToUser(id, userId, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      UPDATE affiliates
      SET user_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `,
    [userId, id],
  );

  return result.rowCount > 0 ? findAffiliateById(id, { client }) : null;
}

export async function updateAffiliate(
  id,
  { name, email, status, telegram, internalNote },
  { client } = {},
) {
  const queryable = getQueryable(client);
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

  if (telegram !== undefined) {
    params.push(telegram ?? null);
    assignments.push(`telegram = $${params.length}`);
  }

  if (internalNote !== undefined) {
    params.push(internalNote ?? null);
    assignments.push(`internal_note = $${params.length}`);
  }

  if (assignments.length === 0) {
    return findAffiliateById(id, { client });
  }

  const result = await queryable.query(
    `
      UPDATE affiliates
      SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length + 1}
      RETURNING id;
    `,
    [...params, id],
  );

  return result.rowCount > 0 ? findAffiliateById(id, { client }) : null;
}

export async function updateAffiliateManager(
  id,
  managerUserId,
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      UPDATE affiliates
      SET manager_user_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `,
    [managerUserId ?? null, id],
  );

  return result.rowCount > 0 ? findAffiliateById(id, { client }) : null;
}
