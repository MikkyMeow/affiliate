/* eslint-disable camelcase */

const NULL_UUID = '00000000-0000-0000-0000-000000000000';

export const up = (pgm) => {
  pgm.addColumns('daily_stats', {
    timezone: {
      type: 'text',
      notNull: true,
      default: 'UTC',
    },
    advertiser_id: {
      type: 'uuid',
      references: '"advertisers"',
      onDelete: 'set null',
    },
    goal_id: {
      type: 'uuid',
      references: '"offer_goals"',
      onDelete: 'set null',
    },
    manual_clicks_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    manual_conversions_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    test_conversions_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    recalculated_at: {
      type: 'timestamptz',
    },
  });

  pgm.sql(`
    UPDATE daily_stats AS ds
    SET
      advertiser_id = o.advertiser_id,
      recalculated_at = COALESCE(ds.updated_at, ds.created_at)
    FROM offers AS o
    WHERE o.id = ds.offer_id;
  `);

  pgm.dropConstraint('daily_stats', 'daily_stats_date_offer_affiliate_unique', {
    ifExists: true,
  });

  pgm.sql(`
    CREATE UNIQUE INDEX daily_stats_rollup_unique_idx
    ON daily_stats (
      date,
      timezone,
      COALESCE(offer_id, '${NULL_UUID}'::uuid),
      COALESCE(affiliate_id, '${NULL_UUID}'::uuid),
      COALESCE(advertiser_id, '${NULL_UUID}'::uuid),
      COALESCE(goal_id, '${NULL_UUID}'::uuid)
    );
  `);

  pgm.createIndex('daily_stats', ['timezone', 'date'], {
    ifNotExists: true,
    name: 'daily_stats_timezone_date_idx',
  });
  pgm.createIndex('daily_stats', ['offer_id', 'date'], {
    ifNotExists: true,
    name: 'daily_stats_offer_date_idx',
  });
  pgm.createIndex('daily_stats', ['affiliate_id', 'date'], {
    ifNotExists: true,
    name: 'daily_stats_affiliate_date_idx',
  });
  pgm.createIndex('daily_stats', ['advertiser_id', 'date'], {
    ifNotExists: true,
    name: 'daily_stats_advertiser_date_idx',
  });
  pgm.createIndex('daily_stats', ['goal_id', 'date'], {
    ifNotExists: true,
    name: 'daily_stats_goal_date_idx',
  });
};

export const down = (pgm) => {
  pgm.dropIndex('daily_stats', ['goal_id', 'date'], {
    ifExists: true,
    name: 'daily_stats_goal_date_idx',
  });
  pgm.dropIndex('daily_stats', ['advertiser_id', 'date'], {
    ifExists: true,
    name: 'daily_stats_advertiser_date_idx',
  });
  pgm.dropIndex('daily_stats', ['affiliate_id', 'date'], {
    ifExists: true,
    name: 'daily_stats_affiliate_date_idx',
  });
  pgm.dropIndex('daily_stats', ['offer_id', 'date'], {
    ifExists: true,
    name: 'daily_stats_offer_date_idx',
  });
  pgm.dropIndex('daily_stats', ['timezone', 'date'], {
    ifExists: true,
    name: 'daily_stats_timezone_date_idx',
  });

  pgm.sql('DROP INDEX IF EXISTS daily_stats_rollup_unique_idx;');

  pgm.dropColumns('daily_stats', [
    'recalculated_at',
    'test_conversions_count',
    'manual_conversions_count',
    'manual_clicks_count',
    'goal_id',
    'advertiser_id',
    'timezone',
  ]);

  pgm.addConstraint('daily_stats', 'daily_stats_date_offer_affiliate_unique', {
    unique: ['date', 'offer_id', 'affiliate_id'],
  });
};
