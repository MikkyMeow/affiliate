import pool from '../db.js';

export async function createUser({
  email,
  passwordHash,
  displayName,
  role = 'affiliate',
}) {
  const result = await pool.query(
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

export async function findUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.password_hash AS "passwordHash",
        u.display_name AS "displayName",
        u.role,
        u.created_at AS "createdAt",
        a.id AS "affiliateId"
      FROM users AS u
      LEFT JOIN affiliates AS a ON a.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.display_name AS "displayName",
        u.role,
        u.created_at AS "createdAt",
        a.id AS "affiliateId"
      FROM users AS u
      LEFT JOIN affiliates AS a ON a.user_id = u.id
      WHERE u.id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function deleteUserById(id) {
  await pool.query(
    `
      DELETE FROM users
      WHERE id = $1;
    `,
    [id],
  );
}
