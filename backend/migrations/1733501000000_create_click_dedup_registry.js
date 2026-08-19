/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'click_dedup_registry',
    {
      fingerprint: { type: 'text', primaryKey: true },
      offer_id: {
        type: 'uuid',
        notNull: true,
        references: '"offers"',
        onDelete: 'cascade',
      },
      affiliate_id: {
        type: 'uuid',
        notNull: true,
        references: '"affiliates"',
        onDelete: 'cascade',
      },
      click_id: {
        type: 'text',
        notNull: true,
        references: '"clicks"(click_id)',
        onDelete: 'cascade',
      },
      expires_at: { type: 'timestamptz', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('click_dedup_registry', 'expires_at', {
    name: 'click_dedup_registry_expires_at_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('click_dedup_registry', 'expires_at', {
    ifExists: true,
    name: 'click_dedup_registry_expires_at_idx',
  });
  pgm.dropTable('click_dedup_registry', { ifExists: true });
};
