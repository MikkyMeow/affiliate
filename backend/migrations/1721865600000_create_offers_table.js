/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'offers',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      title: { type: 'text', notNull: true },
      advertiser_id: {
        type: 'uuid',
        notNull: true,
        references: '"advertisers"',
        onDelete: 'restrict',
      },
      target_url: { type: 'text', notNull: true },
      payout_rub: { type: 'numeric(12, 2)', notNull: true },
      status: {
        type: 'text',
        notNull: true,
        default: 'inactive',
        check: "status IN ('active', 'inactive')",
      },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('offers', 'advertiser_id', {
    name: 'offers_advertiser_id_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('offers', 'advertiser_id', {
    ifExists: true,
    name: 'offers_advertiser_id_idx',
  });
  pgm.dropTable('offers', { ifExists: true });
};
