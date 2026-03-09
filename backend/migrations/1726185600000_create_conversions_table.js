/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'conversions',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      click_id: { type: 'text', notNull: true },
      offer_id: {
        type: 'uuid',
        notNull: true,
        references: '"offers"',
        onDelete: 'restrict',
      },
      affiliate_id: {
        type: 'uuid',
        notNull: true,
        references: '"affiliates"',
        onDelete: 'restrict',
      },
      status: {
        type: 'text',
        notNull: true,
        default: 'approved',
        check: "status IN ('approved', 'rejected')",
      },
      payout_rub: { type: 'numeric(12, 2)', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('conversions', 'click_id', {
    name: 'conversions_click_id_unique_idx',
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex('conversions', 'offer_id', {
    name: 'conversions_offer_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('conversions', 'affiliate_id', {
    name: 'conversions_affiliate_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('conversions', 'created_at', {
    name: 'conversions_created_at_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('conversions', 'created_at', {
    ifExists: true,
    name: 'conversions_created_at_idx',
  });

  pgm.dropIndex('conversions', 'affiliate_id', {
    ifExists: true,
    name: 'conversions_affiliate_id_idx',
  });

  pgm.dropIndex('conversions', 'offer_id', {
    ifExists: true,
    name: 'conversions_offer_id_idx',
  });

  pgm.dropIndex('conversions', 'click_id', {
    ifExists: true,
    name: 'conversions_click_id_unique_idx',
  });

  pgm.dropTable('conversions', { ifExists: true });
};
