import pool from '../db.js';
import { attachPublicIds, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const hiddenFields = `
  id,
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  created_by AS "createdBy",
  reason,
  created_at AS "createdAt"
`;

const hiddenFieldsWithAffiliate = `
  oah.id,
  oah.offer_id AS "offerId",
  oah.affiliate_id AS "affiliateId",
  oah.created_by AS "createdBy",
  oah.reason,
  oah.created_at AS "createdAt",
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

function normalizeHiddenWithAffiliate(row) {
  if (!row) {
    return null;
  }

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
    createdBy: row.createdBy ?? null,
    reason: row.reason ?? null,
    createdAt: row.createdAt,
    affiliate: affiliates[0],
  };
}

export async function findHiddenAffiliateForOffers(
  affiliateId,
  offerIds = [],
  { client } = {},
) {
  if (!affiliateId) {
    throw new Error('affiliateId is required to fetch hidden offers');
  }

  if (!Array.isArray(offerIds) || offerIds.length === 0) {
    return [];
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${hiddenFields}
      FROM offer_affiliate_hidden
      WHERE affiliate_id = $1
        AND offer_id = ANY($2::uuid[])
    `,
    [affiliateId, offerIds],
  );

  return result.rows;
}

export async function findHiddenAffiliateForOffer(
  offerId,
  affiliateId,
  { client, forUpdate = false } = {},
) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to fetch hidden offer');
  }

  const queryable = getQueryable(client);
  const lockClause = buildLockClause({ forUpdate });
  const result = await queryable.query(
    `
      SELECT ${hiddenFields}
      FROM offer_affiliate_hidden
      WHERE offer_id = $1
        AND affiliate_id = $2
      LIMIT 1
      ${lockClause}
    `,
    [offerId, affiliateId],
  );

  return result.rows[0] ?? null;
}

export async function upsertOfferAffiliateHidden(
  { offerId, affiliateId, createdBy = null, reason = null },
  { client } = {},
) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to hide offer');
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO offer_affiliate_hidden (
        offer_id,
        affiliate_id,
        created_by,
        reason
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (offer_id, affiliate_id)
      DO UPDATE
      SET created_by = COALESCE(EXCLUDED.created_by, offer_affiliate_hidden.created_by),
          reason = COALESCE(EXCLUDED.reason, offer_affiliate_hidden.reason)
      RETURNING ${hiddenFields}
    `,
    [offerId, affiliateId, createdBy ?? null, reason ?? null],
  );

  return result.rows[0] ?? null;
}

export async function deleteOfferAffiliateHidden(
  offerId,
  affiliateId,
  { client } = {},
) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to unhide offer');
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      DELETE FROM offer_affiliate_hidden
      WHERE offer_id = $1
        AND affiliate_id = $2
      RETURNING ${hiddenFields}
    `,
    [offerId, affiliateId],
  );

  return result.rows[0] ?? null;
}

export async function listOfferAffiliateHidden(offerId, { client } = {}) {
  if (!offerId) {
    throw new Error('offerId is required to list hidden affiliates');
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${hiddenFieldsWithAffiliate}
      FROM offer_affiliate_hidden AS oah
      INNER JOIN affiliates AS a ON a.id = oah.affiliate_id
      WHERE oah.offer_id = $1
      ORDER BY oah.created_at DESC
    `,
    [offerId],
  );

  return result.rows.map(normalizeHiddenWithAffiliate);
}
