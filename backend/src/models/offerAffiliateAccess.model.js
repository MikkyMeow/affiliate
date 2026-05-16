import pool from '../db.js';
import { attachPublicIds, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const accessFields = `
  id,
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  access_type AS "accessType",
  source,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const accessFieldsWithAffiliate = `
  oaa.id,
  oaa.offer_id AS "offerId",
  oaa.affiliate_id AS "affiliateId",
  oaa.access_type AS "accessType",
  oaa.source,
  oaa.created_at AS "createdAt",
  oaa.updated_at AS "updatedAt",
  a.public_id_number AS "affiliate.publicIdNumber",
  a.name AS "affiliate.name",
  a.email AS "affiliate.email"
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

export async function listOfferAffiliateAccessWithAffiliate(
  offerId,
  { client } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to list access records');
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${accessFieldsWithAffiliate}
      FROM offer_affiliate_access AS oaa
      INNER JOIN affiliates AS a ON a.id = oaa.affiliate_id
      WHERE oaa.offer_id = $1
      ORDER BY oaa.updated_at DESC, oaa.created_at DESC
    `,
    [offerId],
  );

  return result.rows.map((row) => {
    const affiliates = attachPublicIds(
      [
        {
          id: row.affiliateId,
          publicIdNumber: row['affiliate.publicIdNumber'] ?? null,
          name: row['affiliate.name'] ?? null,
          email: row['affiliate.email'] ?? null,
        },
      ],
      PUBLIC_ID_PREFIXES.affiliate,
    );

    return {
      id: row.id,
      offerId: row.offerId,
      affiliateId: row.affiliateId,
      accessType: row.accessType,
      source: row.source,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      affiliate: affiliates[0],
    };
  });
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
