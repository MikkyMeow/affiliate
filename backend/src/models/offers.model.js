import pool from '../db.js';

const offerFields = `
  id,
  title,
  advertiser_id AS "advertiserId",
  target_url AS "targetUrl",
  payout_rub AS "payoutRub",
  status,
  visibility_mode AS "visibilityMode",
  targeting_strict AS "targetingStrict",
  fallback_url AS "fallbackUrl",
  preview_url AS "previewUrl",
  allow_duplicate_clicks AS "allowDuplicateClicks",
  duplicate_click_window_seconds AS "duplicateClickWindowSeconds",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const offerFieldsWithPostbackToken = `
  id,
  title,
  advertiser_id AS "advertiserId",
  target_url AS "targetUrl",
  payout_rub AS "payoutRub",
  status,
  visibility_mode AS "visibilityMode",
  targeting_strict AS "targetingStrict",
  fallback_url AS "fallbackUrl",
  preview_url AS "previewUrl",
  allow_duplicate_clicks AS "allowDuplicateClicks",
  duplicate_click_window_seconds AS "duplicateClickWindowSeconds",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  postback_token AS "postbackToken"
`;

const offerPostbackFields = `
  id,
  payout_rub AS "payoutRub",
  status,
  postback_token AS "postbackToken"
`;

export async function createOffer({
  title,
  advertiserId,
  targetUrl,
  payoutRub,
  status = 'inactive',
  postbackToken,
  allowDuplicateClicks = true,
  duplicateClickWindowSeconds = null,
}) {
  const result = await pool.query(
    `
      INSERT INTO offers (
        title,
        advertiser_id,
        target_url,
        payout_rub,
        status,
        postback_token,
        allow_duplicate_clicks,
        duplicate_click_window_seconds
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING ${offerFields},
        postback_token AS "postbackToken";
    `,
    [
      title,
      advertiserId,
      targetUrl,
      payoutRub,
      status,
      postbackToken,
      allowDuplicateClicks,
      duplicateClickWindowSeconds,
    ],
  );

  return result.rows[0];
}

export async function listOffers(
  { status, advertiserId } = {},
  { limit = 20, offset = 0 } = {},
  { includePostbackToken = false } = {},
) {
  const params = [];
  const conditions = [];
  const fields = includePostbackToken ? offerFieldsWithPostbackToken : offerFields;

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (advertiserId) {
    params.push(advertiserId);
    conditions.push(`advertiser_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM offers
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${fields}
      FROM offers
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  return {
    items: result.rows,
    total: totalResult.rows[0]?.count ?? 0,
  };
}

export async function findOfferById(id) {
  const result = await pool.query(
    `
      SELECT ${offerFields}
      FROM offers
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findOfferForPostback(id) {
  const result = await pool.query(
    `
      SELECT ${offerPostbackFields}
      FROM offers
      WHERE id = $1;
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function updateOffer(id, attrs = {}) {
  const {
    title,
    advertiserId,
    targetUrl,
    payoutRub,
    status,
    targetingStrict,
    fallbackUrl,
    allowDuplicateClicks,
    duplicateClickWindowSeconds,
  } = attrs;

  const assignments = [];
  const params = [];

  if (typeof title === 'string') {
    params.push(title);
    assignments.push(`title = $${params.length}`);
  }

  if (typeof advertiserId === 'string') {
    params.push(advertiserId);
    assignments.push(`advertiser_id = $${params.length}`);
  }

  if (typeof targetUrl === 'string') {
    params.push(targetUrl);
    assignments.push(`target_url = $${params.length}`);
  }

  if (typeof payoutRub === 'number') {
    params.push(payoutRub);
    assignments.push(`payout_rub = $${params.length}`);
  }

  if (typeof status === 'string') {
    params.push(status);
    assignments.push(`status = $${params.length}`);
  }

  if (typeof targetingStrict === 'boolean') {
    params.push(targetingStrict);
    assignments.push(`targeting_strict = $${params.length}`);
  }

  if (Object.hasOwn(attrs, 'fallbackUrl')) {
    if (typeof fallbackUrl === 'string') {
      params.push(fallbackUrl);
    } else if (fallbackUrl === null) {
      params.push(null);
    } else {
      // Skip invalid fallback values silently, validation happens upstream.
    }

    if (params.length > assignments.length) {
      assignments.push(`fallback_url = $${params.length}`);
    }
  }

  if (typeof allowDuplicateClicks === 'boolean') {
    params.push(allowDuplicateClicks);
    assignments.push(`allow_duplicate_clicks = $${params.length}`);
  }

  if (Object.hasOwn(attrs, 'duplicateClickWindowSeconds')) {
    if (typeof duplicateClickWindowSeconds === 'number') {
      params.push(duplicateClickWindowSeconds);
    } else {
      params.push(null);
    }
    assignments.push(`duplicate_click_window_seconds = $${params.length}`);
  }

  if (assignments.length === 0) {
    return findOfferById(id);
  }

  const result = await pool.query(
    `
      UPDATE offers
      SET ${assignments.join(', ')}, updated_at = NOW()
      WHERE id = $${params.length + 1}
      RETURNING ${offerFields};
    `,
    [...params, id],
  );

  return result.rows[0] ?? null;
}
