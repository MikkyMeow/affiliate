/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('conversions', {
    external_transaction_id: {
      type: 'text',
    },
  });

  pgm.dropIndex('conversions', 'click_id', {
    ifExists: true,
    name: 'conversions_click_id_unique_idx',
  });

  pgm.createIndex('conversions', 'click_id', {
    ifNotExists: true,
    name: 'conversions_click_id_idx',
  });

  pgm.createIndex('conversions', 'click_id', {
    name: 'conversions_click_id_without_goal_unique_idx',
    unique: true,
    where: 'goal_id IS NULL',
  });

  pgm.createIndex('conversions', ['click_id', 'goal_id'], {
    name: 'conversions_click_goal_unique_idx',
    unique: true,
    where: 'goal_id IS NOT NULL',
  });

  pgm.createIndex(
    'conversions',
    ['offer_id', 'goal_id', 'external_transaction_id'],
    {
      name: 'conversions_offer_goal_external_transaction_unique_idx',
      unique: true,
      where: 'external_transaction_id IS NOT NULL',
    },
  );
};

export const down = (pgm) => {
  pgm.dropIndex('conversions', ['offer_id', 'goal_id', 'external_transaction_id'], {
    ifExists: true,
    name: 'conversions_offer_goal_external_transaction_unique_idx',
  });

  pgm.dropIndex('conversions', ['click_id', 'goal_id'], {
    ifExists: true,
    name: 'conversions_click_goal_unique_idx',
  });

  pgm.dropIndex('conversions', 'click_id', {
    ifExists: true,
    name: 'conversions_click_id_without_goal_unique_idx',
  });

  pgm.dropIndex('conversions', 'click_id', {
    ifExists: true,
    name: 'conversions_click_id_idx',
  });

  pgm.createIndex('conversions', 'click_id', {
    name: 'conversions_click_id_unique_idx',
    unique: true,
    ifNotExists: true,
  });

  pgm.dropColumn('conversions', 'external_transaction_id', {
    ifExists: true,
  });
};
