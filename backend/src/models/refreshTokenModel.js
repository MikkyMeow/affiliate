import crypto from 'crypto';
import pool from '../db.js';

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function computeExpiryDate() {
  const ttlDays = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '7', 10);
  const ttlMs = Math.max(ttlDays, 1) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ttlMs);
}

export async function createRefreshTokenForUser(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = computeExpiryDate();
  const tokenHash = hashToken(token);

  await pool.query(
    `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt],
  );

  return { token, expiresAt };
}

export async function findRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const result = await pool.query(
    `
      SELECT id, user_id AS "userId", expires_at AS "expiresAt"
      FROM refresh_tokens
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function deleteRefreshTokenById(id) {
  await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [id]);
}

export async function deleteRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [
    tokenHash,
  ]);
}

export async function deleteTokensByUser(userId) {
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
}
