import pool from '../db.js';

const registryFields = `
  fingerprint,
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  click_id AS "clickId",
  expires_at AS "expiresAt"
`;

export async function findActiveDedupEntry(fingerprint, { client = pool } = {}) {
  if (!fingerprint) {
    return null;
  }

  const result = await client.query(
    `
      SELECT ${registryFields}
      FROM click_dedup_registry
      WHERE fingerprint = $1
        AND expires_at > NOW()
      LIMIT 1;
    `,
    [fingerprint],
  );

  return result.rows[0] ?? null;
}

export async function deleteExpiredDedupEntry(fingerprint, { client = pool } = {}) {
  if (!fingerprint) {
    return;
  }

  await client.query(
    `
      DELETE FROM click_dedup_registry
      WHERE fingerprint = $1
        AND expires_at <= NOW();
    `,
    [fingerprint],
  );
}

export async function insertDedupEntry(
  { fingerprint, offerId, affiliateId, clickId, expiresAt },
  { client = pool } = {},
) {
  if (!fingerprint || !offerId || !affiliateId || !clickId || !expiresAt) {
    throw new Error('All dedup registry fields are required');
  }

  await client.query(
    `
      INSERT INTO click_dedup_registry (
        fingerprint,
        offer_id,
        affiliate_id,
        click_id,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [fingerprint, offerId, affiliateId, clickId, expiresAt],
  );
}
