/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable('offer_affiliate_hidden', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
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
      onDelete: 'restrict',
    },
    created_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'set null',
    },
    reason: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('offer_affiliate_hidden', 'offer_id', {
    name: 'offer_affiliate_hidden_offer_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('offer_affiliate_hidden', 'affiliate_id', {
    name: 'offer_affiliate_hidden_affiliate_id_idx',
    ifNotExists: true,
  });

  pgm.addConstraint(
    'offer_affiliate_hidden',
    'offer_affiliate_hidden_offer_affiliate_unique',
    'UNIQUE (offer_id, affiliate_id)',
  );
};

export const down = (pgm) => {
  pgm.dropConstraint(
    'offer_affiliate_hidden',
    'offer_affiliate_hidden_offer_affiliate_unique',
    { ifExists: true },
  );
  pgm.dropIndex('offer_affiliate_hidden', 'affiliate_id', {
    ifExists: true,
    name: 'offer_affiliate_hidden_affiliate_id_idx',
  });
  pgm.dropIndex('offer_affiliate_hidden', 'offer_id', {
    ifExists: true,
    name: 'offer_affiliate_hidden_offer_id_idx',
  });
  pgm.dropTable('offer_affiliate_hidden', { ifExists: true });
};
