/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.dropIndex('offer_goals', ['offer_id', 'is_active'], {
    ifExists: true,
    name: 'offer_goals_offer_id_is_active_idx',
  });

  pgm.dropColumn('offers', 'payout_rub', {
    ifExists: true,
  });

  pgm.dropColumn('offer_goals', 'is_active', {
    ifExists: true,
  });

  pgm.addColumn('offer_goals', {
    limit_enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    limit_type: {
      type: 'text',
    },
    limit_value: {
      type: 'integer',
    },
  });

  pgm.addConstraint('offer_goals', 'offer_goals_currency_rub_check', {
    check: "currency = 'RUB'",
  });

  pgm.addConstraint('offer_goals', 'offer_goals_payout_lte_revenue_check', {
    check: 'payout <= revenue',
  });

  pgm.addConstraint('offer_goals', 'offer_goals_limit_config_check', {
    check: `
      (limit_enabled = false AND limit_type IS NULL AND limit_value IS NULL)
      OR
      (
        limit_enabled = true
        AND limit_type = 'conversions_count'
        AND limit_value IS NOT NULL
        AND limit_value > 0
      )
    `,
  });

  pgm.createTable('offer_goal_affiliate_rates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    offer_goal_id: {
      type: 'uuid',
      notNull: true,
      references: '"offer_goals"',
      onDelete: 'cascade',
    },
    affiliate_id: {
      type: 'uuid',
      notNull: true,
      references: '"affiliates"',
      onDelete: 'restrict',
    },
    revenue: {
      type: 'numeric(12, 2)',
      notNull: true,
      check: 'revenue >= 0',
    },
    payout: {
      type: 'numeric(12, 2)',
      notNull: true,
      check: 'payout >= 0',
    },
    created_by: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'restrict',
    },
    updated_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'set null',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint(
    'offer_goal_affiliate_rates',
    'offer_goal_affiliate_rates_offer_goal_affiliate_unique',
    'UNIQUE (offer_goal_id, affiliate_id)',
  );

  pgm.addConstraint(
    'offer_goal_affiliate_rates',
    'offer_goal_affiliate_rates_payout_lte_revenue_check',
    {
      check: 'payout <= revenue',
    },
  );

  pgm.createIndex('offer_goal_affiliate_rates', 'offer_goal_id', {
    ifNotExists: true,
    name: 'offer_goal_affiliate_rates_goal_idx',
  });

  pgm.createIndex('offer_goal_affiliate_rates', 'affiliate_id', {
    ifNotExists: true,
    name: 'offer_goal_affiliate_rates_affiliate_idx',
  });
};

export const down = (pgm) => {
  pgm.dropIndex('offer_goal_affiliate_rates', 'affiliate_id', {
    ifExists: true,
    name: 'offer_goal_affiliate_rates_affiliate_idx',
  });

  pgm.dropIndex('offer_goal_affiliate_rates', 'offer_goal_id', {
    ifExists: true,
    name: 'offer_goal_affiliate_rates_goal_idx',
  });

  pgm.dropConstraint(
    'offer_goal_affiliate_rates',
    'offer_goal_affiliate_rates_payout_lte_revenue_check',
    {
      ifExists: true,
    },
  );

  pgm.dropConstraint(
    'offer_goal_affiliate_rates',
    'offer_goal_affiliate_rates_offer_goal_affiliate_unique',
    {
      ifExists: true,
    },
  );

  pgm.dropTable('offer_goal_affiliate_rates', {
    ifExists: true,
  });

  pgm.dropConstraint('offer_goals', 'offer_goals_limit_config_check', {
    ifExists: true,
  });

  pgm.dropConstraint('offer_goals', 'offer_goals_payout_lte_revenue_check', {
    ifExists: true,
  });

  pgm.dropConstraint('offer_goals', 'offer_goals_currency_rub_check', {
    ifExists: true,
  });

  pgm.dropColumn('offer_goals', 'limit_value', {
    ifExists: true,
  });

  pgm.dropColumn('offer_goals', 'limit_type', {
    ifExists: true,
  });

  pgm.dropColumn('offer_goals', 'limit_enabled', {
    ifExists: true,
  });

  pgm.addColumn('offer_goals', {
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });

  pgm.createIndex('offer_goals', ['offer_id', 'is_active'], {
    ifNotExists: true,
    name: 'offer_goals_offer_id_is_active_idx',
  });

  pgm.addColumn('offers', {
    payout_rub: {
      type: 'numeric(12, 2)',
      notNull: true,
      default: 0,
    },
  });
};
