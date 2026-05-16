import pool from '../db.js';
import { attachPublicIds, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

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

const offerRequestFieldsWithAffiliate = `
  orq.id,
  orq.offer_id AS "offerId",
  orq.affiliate_id AS "affiliateId",
  orq.status,
  orq.message,
  orq.reviewed_by AS "reviewedBy",
  orq.reviewed_at AS "reviewedAt",
  orq.created_at AS "createdAt",
  orq.updated_at AS "updatedAt",
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

export async function findPendingOfferRequest(
  offerId,
  affiliateId,
  { client, forUpdate = false } = {},
) {
  if (!offerId || !affiliateId) {
    throw new Error('offerId and affiliateId are required to fetch request');
  }

  const queryable = getQueryable(client);
  const lockClause = buildLockClause({ forUpdate });

  const result = await queryable.query(
    `
      SELECT ${offerRequestFields}
      FROM offer_requests
      WHERE offer_id = $1
        AND affiliate_id = $2
        AND status = 'pending'
      LIMIT 1
      ${lockClause}
    `,
    [offerId, affiliateId],
  );

  return result.rows[0] ?? null;
}

export async function findPendingOfferRequestsForOffers(
  affiliateId,
  offerIds = [],
  { client } = {},
) {
  if (!affiliateId) {
    throw new Error('affiliateId is required to fetch pending requests');
  }

  if (!Array.isArray(offerIds) || offerIds.length === 0) {
    return [];
  }

  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${offerRequestFields}
      FROM offer_requests
      WHERE affiliate_id = $1
        AND offer_id = ANY($2::uuid[])
        AND status = 'pending'
    `,
    [affiliateId, offerIds],
  );

  return result.rows;
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

export async function findOfferRequestById(
  requestId,
  { client, forUpdate = false } = {},
) {
  if (!requestId) {
    throw new Error('requestId is required to fetch offer request');
  }

  const queryable = getQueryable(client);
  const lockClause = buildLockClause({ forUpdate });

  const result = await queryable.query(
    `
      SELECT ${offerRequestFields}
      FROM offer_requests
      WHERE id = $1
      ${lockClause}
    `,
    [requestId],
  );

  return result.rows[0] ?? null;
}

export async function updateOfferRequestReview(
  requestId,
  { status, reviewedBy, reviewedAt },
  { client } = {},
) {
  if (!requestId) {
    throw new Error('requestId is required to update offer request');
  }

  if (!status) {
    throw new Error('status is required to update offer request');
  }

  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      UPDATE offer_requests
      SET status = $2,
          reviewed_by = $3,
          reviewed_at = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING ${offerRequestFields}
    `,
    [requestId, status, reviewedBy ?? null, reviewedAt ?? null],
  );

  return result.rows[0] ?? null;
}

export async function listOfferRequestsForOffer(
  offerId,
  { status = 'pending', client } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to list offer requests');
  }

  const queryable = getQueryable(client);
  const params = [offerId];
  let statusClause = '';

  if (status) {
    params.push(status);
    statusClause = `AND orq.status = $${params.length}`;
  }

  const result = await queryable.query(
    `
      SELECT ${offerRequestFieldsWithAffiliate}
      FROM offer_requests AS orq
      INNER JOIN affiliates AS a ON a.id = orq.affiliate_id
      WHERE orq.offer_id = $1
      ${statusClause}
      ORDER BY orq.created_at DESC
    `,
    params,
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
      status: row.status,
      message: row.message ?? null,
      reviewedBy: row.reviewedBy ?? null,
      reviewedAt: row.reviewedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      affiliate: affiliates[0],
    };
  });
}
