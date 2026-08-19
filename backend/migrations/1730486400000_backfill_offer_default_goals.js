/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO offer_goals (
      id,
      offer_id,
      name,
      type,
      revenue,
      payout,
      currency,
      is_default,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      gen_random_uuid(),
      o.id,
      'Default Goal',
      'cpa',
      o.payout_rub,
      o.payout_rub,
      'RUB',
      true,
      true,
      now(),
      now()
    FROM offers AS o
    WHERE NOT EXISTS (
      SELECT 1
      FROM offer_goals AS og
      WHERE og.offer_id = o.id
    )
  `);
};

export const down = (pgm) => {
  pgm.sql('DELETE FROM offer_goals');
};
