import pool from '../db.js';

export async function createUser({ email, passwordHash, displayName }) {
  const result = await pool.query(
    `
      INSERT INTO users (email, password_hash, display_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, display_name AS "displayName", created_at AS "createdAt";
    `,
    [email.toLowerCase(), passwordHash, displayName ?? null],
  );

  return result.rows[0];
}

export async function findUserByEmail(email) {
  const result = await pool.query(
    `
      SELECT id, email, password_hash AS "passwordHash", display_name AS "displayName", created_at AS "createdAt"
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT id, email, display_name AS "displayName", created_at AS "createdAt"
      FROM users
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}
