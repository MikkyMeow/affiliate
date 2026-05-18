import pool from '../db.js';
import { formatPublicId, PUBLIC_ID_PREFIXES } from '../lib/public-id.js';

const clickFields = `
  id,
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  goal_id AS "goalId",
  source,
  manual_adjustment_batch_id AS "manualAdjustmentBatchId",
  created_by AS "createdBy",
  created_at AS "createdAt",
  ip,
  user_agent AS "userAgent",
  device,
  referer,
  sub1,
  sub2,
  sub3,
  sub4,
  sub5,
  canonical_click_id AS "canonicalClickId",
  is_duplicate AS "isDuplicate",
  duplicate_of_click_id AS "duplicateOfClickId",
  dedupe_fingerprint AS "dedupeFingerprint",
  country_code AS "countryCode",
  targeting_strict AS "targetingStrict",
  redirect_outcome AS "redirectOutcome",
  redirect_reason AS "redirectReason",
  destination_type AS "destinationType"
`;

const clickListFields = `
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  goal_id AS "goalId",
  source,
  created_at AS "createdAt",
  ip,
  device,
  referer,
  sub1,
  canonical_click_id AS "canonicalClickId",
  is_duplicate AS "isDuplicate",
  dedupe_fingerprint AS "dedupeFingerprint",
  country_code AS "countryCode",
  redirect_outcome AS "redirectOutcome",
  destination_type AS "destinationType"
`;

const adminClickListFields = `
  c.id,
  c.click_id AS "clickId",
  c.offer_id AS "offerId",
  o.public_id_number AS "offerPublicIdNumber",
  o.title AS "offerName",
  c.affiliate_id AS "affiliateId",
  a.public_id_number AS "affiliatePublicIdNumber",
  a.name AS "affiliateName",
  a.email AS "affiliateEmail",
  adv.id AS "advertiserId",
  adv.public_id_number AS "advertiserPublicIdNumber",
  adv.name AS "advertiserName",
  c.source,
  c.country_code AS "countryCode",
  c.redirect_outcome AS "redirectOutcome",
  c.sub1,
  c.sub2,
  c.sub3,
  c.sub4,
  c.sub5,
  c.ip,
  c.device,
  c.canonical_click_id AS "canonicalClickId",
  c.is_duplicate AS "isDuplicate",
  c.created_at AS "createdAt"
`;

function addUuidOrPublicIdCondition({
  value,
  idColumn,
  publicIdColumn,
  conditions,
  params,
}) {
  if (!value) {
    return;
  }

  params.push(value.value);
  conditions.push(
    value.type === 'publicId'
      ? `${publicIdColumn} = $${params.length}`
      : `${idColumn} = $${params.length}`,
  );
}

function addPartialMatchCondition({ value, column, conditions, params }) {
  if (!value) {
    return;
  }

  params.push(`%${value}%`);
  conditions.push(`${column} ILIKE $${params.length}`);
}

function normalizeAdminClickRow(row) {
  return {
    id: row.id,
    clickId: row.clickId,
    offerId: row.offerId,
    offer: {
      id: row.offerId,
      publicId: formatPublicId(
        PUBLIC_ID_PREFIXES.offer,
        Number(row.offerPublicIdNumber ?? 0),
      ),
      name: row.offerName ?? null,
    },
    affiliateId: row.affiliateId,
    affiliate: {
      id: row.affiliateId,
      publicId: formatPublicId(
        PUBLIC_ID_PREFIXES.affiliate,
        Number(row.affiliatePublicIdNumber ?? 0),
      ),
      name: row.affiliateName ?? null,
    },
    advertiserId: row.advertiserId ?? null,
    advertiser: row.advertiserId
      ? {
          id: row.advertiserId,
          publicId: formatPublicId(
            PUBLIC_ID_PREFIXES.advertiser,
            Number(row.advertiserPublicIdNumber ?? 0),
          ),
          name: row.advertiserName ?? null,
        }
      : null,
    source: row.source ?? 'tracking',
    countryCode: row.countryCode ?? null,
    redirectOutcome: row.redirectOutcome ?? null,
    sub1: row.sub1 ?? null,
    sub2: row.sub2 ?? null,
    sub3: row.sub3 ?? null,
    sub4: row.sub4 ?? null,
    sub5: row.sub5 ?? null,
    ip: row.ip ?? null,
    device: row.device ?? null,
    canonicalClickId: row.canonicalClickId ?? null,
    isDuplicate: Boolean(row.isDuplicate),
    createdAt: row.createdAt,
  };
}

export async function createClick(
  {
    clickId,
    offerId,
    affiliateId,
    goalId = null,
    ip = null,
    userAgent = null,
    device = null,
    referer = null,
    sub1 = null,
    sub2 = null,
    sub3 = null,
    sub4 = null,
    sub5 = null,
    canonicalClickId,
    isDuplicate = false,
    duplicateOfClickId = null,
    dedupeFingerprint = null,
    countryCode = null,
    targetingStrict = false,
    redirectOutcome = null,
    redirectReason = null,
    destinationType = null,
    source = 'tracking',
    manualAdjustmentBatchId = null,
    createdBy = null,
    createdAt = null,
  },
  { client = pool } = {},
) {
  const result = await client.query(
    `
      INSERT INTO clicks (
        click_id,
        offer_id,
        affiliate_id,
        goal_id,
        ip,
        user_agent,
        device,
        referer,
        sub1,
        sub2,
        sub3,
        sub4,
        sub5,
        canonical_click_id,
        is_duplicate,
        duplicate_of_click_id,
        dedupe_fingerprint,
        country_code,
        targeting_strict,
        redirect_outcome,
        redirect_reason,
        destination_type,
        source,
        manual_adjustment_batch_id,
        created_by,
        created_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21,
        $22,
        $23,
        $24,
        $25,
        COALESCE($26, NOW())
      )
      RETURNING ${clickFields};
    `,
    [
      clickId,
      offerId,
      affiliateId,
      goalId,
      ip,
      userAgent,
      device,
      referer,
      sub1,
      sub2,
      sub3,
      sub4,
      sub5,
      canonicalClickId,
      isDuplicate,
      duplicateOfClickId,
      dedupeFingerprint,
      countryCode,
      targetingStrict,
      redirectOutcome,
      redirectReason,
      destinationType,
      source,
      manualAdjustmentBatchId,
      createdBy,
      createdAt,
    ],
  );

  return result.rows[0] ?? null;
}

export async function findByClickId(clickId, { client = pool } = {}) {
  const result = await client.query(
    `
      SELECT ${clickFields}
      FROM clicks
      WHERE click_id = $1;
    `,
    [clickId],
  );

  return result.rows[0] ?? null;
}

export async function listClicks(
  { offerId, affiliateId } = {},
  { limit = 20, offset = 0 } = {},
) {
  const conditions = [];
  const params = [];

  if (offerId) {
    params.push(offerId);
    conditions.push(`offer_id = $${params.length}`);
  }

  if (affiliateId) {
    params.push(affiliateId);
    conditions.push(`affiliate_id = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM clicks
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${clickListFields}
      FROM clicks
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

export async function listAdminClicks(
  {
    dateFrom,
    dateTo,
    offerId,
    affiliateId,
    advertiserId,
    countryCode,
    redirectOutcome,
    clickId,
    sub1,
    sub2,
    sub3,
    sub4,
    sub5,
    ip,
    search,
  } = {},
  {
    limit = 20,
    offset = 0,
    order = 'desc',
    sort = 'createdAt',
  } = {},
) {
  const conditions = [];
  const params = [];
  const normalizedOrder = typeof order === 'string' && order.toLowerCase() === 'asc'
    ? 'ASC'
    : 'DESC';
  const sortMap = {
    createdAt: 'c.created_at',
    clickId: 'c.click_id',
    countryCode: 'c.country_code',
    redirectOutcome: 'c.redirect_outcome',
    offerTitle: 'o.title',
    affiliateName: 'a.name',
    advertiserName: 'adv.name',
  };
  const sortColumn = sortMap[sort] ?? sortMap.createdAt;

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`c.created_at >= $${params.length}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`c.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  addUuidOrPublicIdCondition({
    value: offerId,
    idColumn: 'o.id',
    publicIdColumn: 'o.public_id_number',
    conditions,
    params,
  });

  addUuidOrPublicIdCondition({
    value: affiliateId,
    idColumn: 'a.id',
    publicIdColumn: 'a.public_id_number',
    conditions,
    params,
  });

  addUuidOrPublicIdCondition({
    value: advertiserId,
    idColumn: 'adv.id',
    publicIdColumn: 'adv.public_id_number',
    conditions,
    params,
  });

  if (countryCode) {
    params.push(countryCode);
    conditions.push(`UPPER(c.country_code) = UPPER($${params.length})`);
  }

  if (redirectOutcome) {
    params.push(redirectOutcome);
    conditions.push(`c.redirect_outcome = $${params.length}`);
  }

  addPartialMatchCondition({ value: clickId, column: 'c.click_id', conditions, params });
  addPartialMatchCondition({ value: sub1, column: 'c.sub1', conditions, params });
  addPartialMatchCondition({ value: sub2, column: 'c.sub2', conditions, params });
  addPartialMatchCondition({ value: sub3, column: 'c.sub3', conditions, params });
  addPartialMatchCondition({ value: sub4, column: 'c.sub4', conditions, params });
  addPartialMatchCondition({ value: sub5, column: 'c.sub5', conditions, params });
  addPartialMatchCondition({ value: ip, column: 'c.ip', conditions, params });

  if (search) {
    params.push(`%${search.trim()}%`);
    const searchParam = `$${params.length}`;
    conditions.push(`
      (
        c.click_id ILIKE ${searchParam}
        OR o.title ILIKE ${searchParam}
        OR ('#O' || o.public_id_number::text) ILIKE ${searchParam}
        OR a.name ILIKE ${searchParam}
        OR a.email ILIKE ${searchParam}
        OR ('#P' || a.public_id_number::text) ILIKE ${searchParam}
        OR COALESCE(adv.name, '') ILIKE ${searchParam}
        OR ('#A' || adv.public_id_number::text) ILIKE ${searchParam}
        OR COALESCE(c.sub1, '') ILIKE ${searchParam}
        OR COALESCE(c.sub2, '') ILIKE ${searchParam}
        OR COALESCE(c.sub3, '') ILIKE ${searchParam}
        OR COALESCE(c.sub4, '') ILIKE ${searchParam}
        OR COALESCE(c.sub5, '') ILIKE ${searchParam}
        OR COALESCE(c.ip, '') ILIKE ${searchParam}
      )
    `);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromClause = `
    FROM clicks AS c
    INNER JOIN offers AS o ON o.id = c.offer_id
    INNER JOIN affiliates AS a ON a.id = c.affiliate_id
    LEFT JOIN advertisers AS adv ON adv.id = o.advertiser_id
  `;

  const totalResult = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      ${fromClause}
      ${whereClause};
    `,
    params,
  );

  const result = await pool.query(
    `
      SELECT ${adminClickListFields}
      ${fromClause}
      ${whereClause}
      ORDER BY ${sortColumn} ${normalizedOrder}, c.id ${normalizedOrder}
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2};
    `,
    [...params, limit, offset],
  );

  return {
    items: result.rows.map(normalizeAdminClickRow),
    total: totalResult.rows[0]?.count ?? 0,
  };
}

export async function getClickTotals({ offerId, affiliateId } = {}) {
  const conditions = [];
  const params = [];

  if (offerId) {
    params.push(offerId);
    conditions.push(`offer_id = $${params.length}`);
  }

  if (affiliateId) {
    params.push(affiliateId);
    conditions.push(`affiliate_id = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM clicks
      ${whereClause};
    `,
    params,
  );

  return {
    total: result.rows[0]?.total ?? 0,
  };
}
