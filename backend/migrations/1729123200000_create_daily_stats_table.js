/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'daily_stats',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      date: { type: 'date', notNull: true },
      offer_id: {
        type: 'uuid',
        references: '"offers"',
        onDelete: 'set null',
      },
      affiliate_id: {
        type: 'uuid',
        references: '"affiliates"',
        onDelete: 'set null',
      },
      clicks_count: { type: 'integer', notNull: true, default: 0 },
      conversions_count: { type: 'integer', notNull: true, default: 0 },
      approved_conversions_count: { type: 'integer', notNull: true, default: 0 },
      rejected_conversions_count: { type: 'integer', notNull: true, default: 0 },
      payout_total_rub: { type: 'numeric(14, 2)', notNull: true, default: 0 },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint('daily_stats', 'daily_stats_date_offer_affiliate_unique', {
    unique: ['date', 'offer_id', 'affiliate_id'],
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('daily_stats', 'daily_stats_date_offer_affiliate_unique', {
    ifExists: true,
  });
  pgm.dropTable('daily_stats', { ifExists: true });
};

