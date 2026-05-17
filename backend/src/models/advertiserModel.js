import pool from '../db.js';
import { attachPublicId, attachPublicIds, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const advertiserFields = `
  adv.id,
  adv.public_id_number AS "publicIdNumber",
  adv.name,
  adv.status,
  adv.telegram,
  adv.internal_note AS "internalNote",
  adv.user_id AS "userId",
  adv.manager_user_id AS "managerUserId",
  adv.created_at AS "createdAt",
  adv.updated_at AS "updatedAt",
  u.email,
  mu.id AS "manager.id",
  mu.display_name AS "manager.displayName",
  mu.email AS "manager.email"
`;

function getQueryable(client) {
  return client ?? pool;
}

function normalizeAdvertiser(row) {
  if (!row) {
    return null;
  }

  const managerId = row['manager.id'] ?? null;

  return {
    id: row.id,
    publicIdNumber: row.publicIdNumber ?? null,
    name: row.name,
    email: row.email ?? null,
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

export async function createAdvertiser({
  name,
  status = 'active',
  telegram = null,
  internalNote = null,
  managerUserId = null,
  userId = null,
}, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO advertisers (name, status, telegram, internal_note, manager_user_id, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `,
    [name, status, telegram, internalNote, managerUserId, userId],
  );

  return findAdvertiserById(result.rows[0]?.id, { client });
}

export async function listAdvertisers(
  { status, managerUserId } = {},
  { limit = 20, offset = 0 } = {},
) {
  const params = [];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`adv.status = $${params.length}`);
  }

  if (managerUserId) {
    params.push(managerUserId);
    conditions.push(`adv.manager_user_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM advertisers AS adv
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${advertiserFields}
      FROM advertisers AS adv
      LEFT JOIN users AS u ON u.id = adv.user_id
      LEFT JOIN users AS mu ON mu.id = adv.manager_user_id
      ${whereClause}
      ORDER BY adv.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  return {
    items: attachPublicIds(result.rows.map(normalizeAdvertiser), PUBLIC_ID_PREFIXES.advertiser),
    total: totalResult.rows[0]?.count ?? 0,
  };
}

export async function findAdvertiserById(id, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${advertiserFields}
      FROM advertisers AS adv
      LEFT JOIN users AS u ON u.id = adv.user_id
      LEFT JOIN users AS mu ON mu.id = adv.manager_user_id
      WHERE adv.id = $1;
    `,
    [id],
  );

  return attachPublicId(normalizeAdvertiser(result.rows[0] ?? null), PUBLIC_ID_PREFIXES.advertiser);
}

export async function findAdvertiserByPublicIdNumber(
  publicIdNumber,
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${advertiserFields}
      FROM advertisers AS adv
      LEFT JOIN users AS u ON u.id = adv.user_id
      LEFT JOIN users AS mu ON mu.id = adv.manager_user_id
      WHERE adv.public_id_number = $1;
    `,
    [publicIdNumber],
  );

  return attachPublicId(
    normalizeAdvertiser(result.rows[0] ?? null),
    PUBLIC_ID_PREFIXES.advertiser,
  );
}

export async function findAdvertiserByUserId(userId, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${advertiserFields}
      FROM advertisers AS adv
      LEFT JOIN users AS u ON u.id = adv.user_id
      LEFT JOIN users AS mu ON mu.id = adv.manager_user_id
      WHERE adv.user_id = $1;
    `,
    [userId],
  );

  return attachPublicId(normalizeAdvertiser(result.rows[0] ?? null), PUBLIC_ID_PREFIXES.advertiser);
}

export async function updateAdvertiser(
  id,
  { name, status, telegram, internalNote },
  { client } = {},
) {
  const queryable = getQueryable(client);
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

  if (telegram !== undefined) {
    params.push(telegram ?? null);
    assignments.push(`telegram = $${params.length}`);
  }

  if (internalNote !== undefined) {
    params.push(internalNote ?? null);
    assignments.push(`internal_note = $${params.length}`);
  }

  if (assignments.length === 0) {
    return findAdvertiserById(id, { client });
  }

  const result = await queryable.query(
    `
      UPDATE advertisers
      SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length + 1}
      RETURNING id;
    `,
    [...params, id],
  );

  return result.rowCount > 0 ? findAdvertiserById(id, { client }) : null;
}

export async function updateAdvertiserManager(
  id,
  managerUserId,
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      UPDATE advertisers
      SET manager_user_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `,
    [managerUserId ?? null, id],
  );

  return result.rowCount > 0 ? findAdvertiserById(id, { client }) : null;
}
