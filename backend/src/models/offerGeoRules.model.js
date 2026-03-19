import pool from '../db.js';

const ruleFields = `
  id,
  offer_id AS "offerId",
  rule_type AS "ruleType",
  country_code AS "countryCode",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function listOfferGeoRules(offerId) {
  if (!offerId) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT ${ruleFields}
      FROM offer_geo_rules
      WHERE offer_id = $1
      ORDER BY rule_type, country_code;
    `,
    [offerId],
  );

  return result.rows ?? [];
}

export async function insertOfferGeoRule({ offerId, ruleType, countryCode }) {
  const result = await pool.query(
    `
      INSERT INTO offer_geo_rules (offer_id, rule_type, country_code)
      VALUES ($1, $2, $3)
      RETURNING ${ruleFields};
    `,
    [offerId, ruleType, countryCode],
  );

  return result.rows[0] ?? null;
}

export async function deleteOfferGeoRule({ offerId, ruleId }) {
  if (!offerId || !ruleId) {
    return null;
  }

  const result = await pool.query(
    `
      DELETE FROM offer_geo_rules
      WHERE id = $1 AND offer_id = $2
      RETURNING ${ruleFields};
    `,
    [ruleId, offerId],
  );

  return result.rows[0] ?? null;
}

export async function getOfferGeoRuleSets(offerId) {
  const rules = await listOfferGeoRules(offerId);
  const allowCountries = [];
  const denyCountries = [];

  for (const rule of rules) {
    if (rule.ruleType === 'allow') {
      allowCountries.push(rule.countryCode);
    } else if (rule.ruleType === 'deny') {
      denyCountries.push(rule.countryCode);
    }
  }

  return {
    allowCountries,
    denyCountries,
  };
}
