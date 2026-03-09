import pool from '../db.js';

const conversionFields = `
  id,
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  status,
  payout_rub AS "payoutRub",
  created_at AS "createdAt"
`;

export async function createConversion({
  clickId,
  offerId,
  affiliateId,
  status,
  payoutRub,
}) {
  const result = await pool.query(
    `
      INSERT INTO conversions (
        click_id,
        offer_id,
        affiliate_id,
        status,
        payout_rub
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING ${conversionFields};
    `,
    [clickId, offerId, affiliateId, status, payoutRub],
  );

  return result.rows[0] ?? null;
}

export async function findByClickId(clickId) {
  const result = await pool.query(
    `
      SELECT ${conversionFields}
      FROM conversions
      WHERE click_id = $1;
    `,
    [clickId],
  );

  return result.rows[0] ?? null;
}
