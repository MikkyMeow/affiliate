import pool from '../db.js';

const accessFields = `
  id,
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  access_type AS "accessType",
  source,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function findAffiliateAccessForOffers(affiliateId, offerIds = []) {
  if (!affiliateId) {
    throw new Error('affiliateId is required to fetch access records');
  }

  if (!Array.isArray(offerIds) || offerIds.length === 0) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT ${accessFields}
      FROM offer_affiliate_access
      WHERE affiliate_id = $1
        AND offer_id = ANY($2::uuid[])
    `,
    [affiliateId, offerIds],
  );

  return result.rows;
}

export async function findAffiliateAccessForOffer(offerId, affiliateId) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to fetch access');
  }

  const result = await pool.query(
    `
      SELECT ${accessFields}
      FROM offer_affiliate_access
      WHERE offer_id = $1
        AND affiliate_id = $2
      LIMIT 1
    `,
    [offerId, affiliateId],
  );

  return result.rows[0] ?? null;
}
