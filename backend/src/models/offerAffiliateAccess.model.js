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

function getQueryable(client) {
  return client ?? pool;
}

function buildLockClause(options) {
  if (options?.forUpdate) {
    return 'FOR UPDATE';
  }

  return '';
}

export async function findAffiliateAccessForOffers(
  affiliateId,
  offerIds = [],
  { client } = {},
) {
  if (!affiliateId) {
    throw new Error('affiliateId is required to fetch access records');
  }

  if (!Array.isArray(offerIds) || offerIds.length === 0) {
    return [];
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
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

export async function findAffiliateAccessForOffer(
  offerId,
  affiliateId,
  { client, forUpdate = false } = {},
) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to fetch access');
  }

  const queryable = getQueryable(client);
  const lockClause = buildLockClause({ forUpdate });

  const result = await queryable.query(
    `
      SELECT ${accessFields}
      FROM offer_affiliate_access
      WHERE offer_id = $1
        AND affiliate_id = $2
      LIMIT 1
      ${lockClause}
    `,
    [offerId, affiliateId],
  );

  return result.rows[0] ?? null;
}

export async function upsertOfferAffiliateAccess(
  { offerId, affiliateId, accessType, source },
  { client } = {},
) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to upsert access');
  }

  if (!accessType) {
    throw new Error('accessType is required to upsert access');
  }

  if (!source) {
    throw new Error('source is required to upsert access');
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      INSERT INTO offer_affiliate_access (
        offer_id,
        affiliate_id,
        access_type,
        source
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (offer_id, affiliate_id)
      DO UPDATE
      SET access_type = EXCLUDED.access_type,
          source = EXCLUDED.source,
          updated_at = NOW()
      RETURNING ${accessFields}
    `,
    [offerId, affiliateId, accessType, source],
  );

  return result.rows[0] ?? null;
}

export async function listOfferAffiliateAccess(offerId, { client } = {}) {
  if (!offerId) {
    throw new Error('offerId is required to list access records');
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      SELECT ${accessFields}
      FROM offer_affiliate_access
      WHERE offer_id = $1
      ORDER BY updated_at DESC, created_at DESC
    `,
    [offerId],
  );

  return result.rows;
}

export async function deleteOfferAffiliateAccess(
  offerId,
  affiliateId,
  { client } = {},
) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to delete access');
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      DELETE FROM offer_affiliate_access
      WHERE offer_id = $1
        AND affiliate_id = $2
      RETURNING ${accessFields}
    `,
    [offerId, affiliateId],
  );

  return result.rows[0] ?? null;
}
