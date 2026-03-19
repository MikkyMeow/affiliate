import pool from '../db.js';

export async function listOfferGeoRules(offerId) {
  if (!offerId) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        offer_id AS "offerId",
        rule_type AS "ruleType",
        country_code AS "countryCode"
      FROM offer_geo_rules
      WHERE offer_id = $1
      ORDER BY rule_type, country_code;
    `,
    [offerId],
  );

  return result.rows ?? [];
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
