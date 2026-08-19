/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE conversions
      DROP CONSTRAINT IF EXISTS conversions_click_goal_unique,
      DROP CONSTRAINT IF EXISTS conversions_click_id_without_goal_unique,
      DROP CONSTRAINT IF EXISTS conversions_offer_goal_external_transaction_unique;

    DROP INDEX IF EXISTS conversions_click_goal_unique_idx;
    DROP INDEX IF EXISTS conversions_click_id_without_goal_unique_idx;
    DROP INDEX IF EXISTS conversions_offer_goal_external_transaction_unique_idx;

    CREATE UNIQUE INDEX conversions_click_id_without_goal_unique_idx
      ON conversions (click_id)
      WHERE goal_id IS NULL;

    CREATE UNIQUE INDEX conversions_click_goal_unique_idx
      ON conversions (click_id, goal_id)
      WHERE goal_id IS NOT NULL;

    CREATE UNIQUE INDEX conversions_offer_goal_external_transaction_unique_idx
      ON conversions (offer_id, goal_id, external_transaction_id)
      WHERE external_transaction_id IS NOT NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS conversions_offer_goal_external_transaction_unique_idx;
    DROP INDEX IF EXISTS conversions_click_goal_unique_idx;
    DROP INDEX IF EXISTS conversions_click_id_without_goal_unique_idx;

    ALTER TABLE conversions
      ADD CONSTRAINT conversions_click_id_without_goal_unique
        UNIQUE (click_id),
      ADD CONSTRAINT conversions_click_goal_unique
        UNIQUE (click_id, goal_id),
      ADD CONSTRAINT conversions_offer_goal_external_transaction_unique
        UNIQUE (offer_id, goal_id, external_transaction_id);
  `);
};
