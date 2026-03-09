import pool from '../db.js';

const clickFields = `
  id,
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  created_at AS "createdAt",
  ip,
  user_agent AS "userAgent",
  referer,
  sub1,
  sub2,
  sub3,
  sub4,
  sub5
`;

const clickListFields = `
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  created_at AS "createdAt",
  ip,
  referer,
  sub1
`;

export async function createClick({
  clickId,
  offerId,
  affiliateId,
  ip = null,
  userAgent = null,
  referer = null,
  sub1 = null,
  sub2 = null,
  sub3 = null,
  sub4 = null,
  sub5 = null,
}) {
  const result = await pool.query(
    `
      INSERT INTO clicks (
        click_id,
        offer_id,
        affiliate_id,
        ip,
        user_agent,
        referer,
        sub1,
        sub2,
        sub3,
        sub4,
        sub5
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING ${clickFields};
    `,
    [
      clickId,
      offerId,
      affiliateId,
      ip,
      userAgent,
      referer,
      sub1,
      sub2,
      sub3,
      sub4,
      sub5,
    ],
  );

  return result.rows[0] ?? null;
}

export async function findByClickId(clickId) {
  const result = await pool.query(
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
