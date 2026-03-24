import pool from '../db.js';

function getQueryable(client) {
  return client ?? pool;
}

export async function createUser({
  email,
  passwordHash,
  displayName,
  role = 'affiliate',
}, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO users (email, password_hash, display_name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        email,
        display_name AS "displayName",
        role,
        created_at AS "createdAt";
    `,
    [email.toLowerCase(), passwordHash, displayName ?? null, role],
  );

  return result.rows[0];
}

export async function findUserByEmail(email, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT
        u.id,
        u.email,
        u.password_hash AS "passwordHash",
        u.display_name AS "displayName",
        u.role,
        u.created_at AS "createdAt",
        a.id AS "affiliateId",
        adv.id AS "advertiserId"
      FROM users AS u
      LEFT JOIN affiliates AS a ON a.user_id = u.id
      LEFT JOIN advertisers AS adv ON adv.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(id, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT
        u.id,
        u.email,
        u.display_name AS "displayName",
        u.role,
        u.created_at AS "createdAt",
        a.id AS "affiliateId",
        adv.id AS "advertiserId"
      FROM users AS u
      LEFT JOIN affiliates AS a ON a.user_id = u.id
      LEFT JOIN advertisers AS adv ON adv.user_id = u.id
      WHERE u.id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function deleteUserById(id, { client } = {}) {
  const queryable = getQueryable(client);
  await queryable.query(
    `
      DELETE FROM users
      WHERE id = $1;
    `,
    [id],
  );
}
