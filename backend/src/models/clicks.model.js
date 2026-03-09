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
