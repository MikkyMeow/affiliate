/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'clicks',
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
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      ip: { type: 'text' },
      user_agent: { type: 'text' },
      referer: { type: 'text' },
      sub1: { type: 'text' },
      sub2: { type: 'text' },
      sub3: { type: 'text' },
      sub4: { type: 'text' },
      sub5: { type: 'text' },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('clicks', 'click_id', {
    name: 'clicks_click_id_unique_idx',
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex('clicks', 'offer_id', {
    name: 'clicks_offer_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('clicks', 'affiliate_id', {
    name: 'clicks_affiliate_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('clicks', 'created_at', {
    name: 'clicks_created_at_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('clicks', 'created_at', {
    ifExists: true,
    name: 'clicks_created_at_idx',
  });

  pgm.dropIndex('clicks', 'affiliate_id', {
    ifExists: true,
    name: 'clicks_affiliate_id_idx',
  });

  pgm.dropIndex('clicks', 'offer_id', {
    ifExists: true,
    name: 'clicks_offer_id_idx',
  });

  pgm.dropIndex('clicks', 'click_id', {
    ifExists: true,
    name: 'clicks_click_id_unique_idx',
  });

  pgm.dropTable('clicks', { ifExists: true });
};
