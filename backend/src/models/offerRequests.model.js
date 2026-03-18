import pool from '../db.js';

const offerRequestFields = `
  id,
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  status,
  message,
  reviewed_by AS "reviewedBy",
  reviewed_at AS "reviewedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function findPendingOfferRequest(offerId, affiliateId) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to fetch request');
  }

  const result = await pool.query(
    `
      SELECT ${offerRequestFields}
      FROM offer_requests
      WHERE offer_id = $1
        AND affiliate_id = $2
        AND status = 'pending'
      LIMIT 1
    `,
    [offerId, affiliateId],
  );

  return result.rows[0] ?? null;
}

export async function createOfferRequest({ offerId, affiliateId, message }) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to create request');
  }

  const result = await pool.query(
    `
      INSERT INTO offer_requests (
        offer_id,
        affiliate_id,
        message
      )
      VALUES ($1, $2, $3)
      RETURNING ${offerRequestFields}
    `,
    [offerId, affiliateId, message ?? null],
  );

  return result.rows[0] ?? null;
}
