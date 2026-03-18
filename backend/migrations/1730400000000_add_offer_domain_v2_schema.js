/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('offers', {
    visibility_mode: {
      type: 'text',
      notNull: true,
      default: 'public',
    },
    targeting_strict: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    fallback_url: {
      type: 'text',
    },
    preview_url: {
      type: 'text',
    },
  });

  pgm.addConstraint(
    'offers',
    'offers_visibility_mode_check',
    "CHECK (visibility_mode IN ('public', 'on_request', 'private'))",
  );

  pgm.createTable('offer_goals', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    offer_id: {
      type: 'uuid',
      notNull: true,
      references: '"offers"',
      onDelete: 'cascade',
    },
    name: { type: 'text', notNull: true },
    type: {
      type: 'text',
      notNull: true,
      check: "type IN ('cpl', 'cpa', 'cpc')",
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
    currency: {
      type: 'char(3)',
      notNull: true,
      default: 'RUB',
    },
    is_default: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('offer_goals', 'offer_id', {
    name: 'offer_goals_offer_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex(
    'offer_goals',
    ['offer_id', 'is_active'],
    {
      name: 'offer_goals_offer_id_is_active_idx',
      ifNotExists: true,
    },
  );

  pgm.createIndex(
    'offer_goals',
    'offer_id',
    {
      name: 'offer_goals_offer_id_default_unique',
      unique: true,
      where: 'is_default = true',
      ifNotExists: true,
    },
  );

  pgm.createTable('offer_requests', {
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
    status: {
      type: 'text',
      notNull: true,
      default: 'pending',
      check: "status IN ('pending', 'approved', 'rejected')",
    },
    message: { type: 'text' },
    reviewed_by: {
      type: 'uuid',
      references: '"users"',
      onDelete: 'set null',
    },
    reviewed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('offer_requests', 'offer_id', {
    name: 'offer_requests_offer_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('offer_requests', 'affiliate_id', {
    name: 'offer_requests_affiliate_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex(
    'offer_requests',
    ['offer_id', 'affiliate_id'],
    {
      name: 'offer_requests_offer_affiliate_idx',
      ifNotExists: true,
    },
  );

  pgm.createIndex('offer_requests', 'status', {
    name: 'offer_requests_status_idx',
    ifNotExists: true,
  });

  pgm.createIndex(
    'offer_requests',
    ['offer_id', 'affiliate_id'],
    {
      name: 'offer_requests_pending_unique',
      unique: true,
      where: "status = 'pending'",
      ifNotExists: true,
    },
  );

  pgm.createTable('offer_affiliate_access', {
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
    access_type: {
      type: 'text',
      notNull: true,
      check: "access_type IN ('allowed', 'rejected', 'excluded')",
    },
    source: {
      type: 'text',
      notNull: true,
      default: 'manual',
      check: "source IN ('manual', 'request_approved', 'request_rejected')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('offer_affiliate_access', 'offer_id', {
    name: 'offer_affiliate_access_offer_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('offer_affiliate_access', 'affiliate_id', {
    name: 'offer_affiliate_access_affiliate_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex(
    'offer_affiliate_access',
    ['offer_id', 'affiliate_id'],
    {
      name: 'offer_affiliate_access_offer_affiliate_idx',
      ifNotExists: true,
    },
  );

  pgm.addConstraint(
    'offer_affiliate_access',
    'offer_affiliate_access_offer_affiliate_unique',
    'UNIQUE (offer_id, affiliate_id)',
  );

  pgm.createTable('offer_geo_rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    offer_id: {
      type: 'uuid',
      notNull: true,
      references: '"offers"',
      onDelete: 'cascade',
    },
    rule_type: {
      type: 'text',
      notNull: true,
      check: "rule_type IN ('allow', 'deny')",
    },
    country_code: {
      type: 'char(2)',
      notNull: true,
      check: "country_code = UPPER(country_code)",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('offer_geo_rules', 'offer_id', {
    name: 'offer_geo_rules_offer_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex(
    'offer_geo_rules',
    ['offer_id', 'rule_type'],
    {
      name: 'offer_geo_rules_offer_rule_idx',
      ifNotExists: true,
    },
  );

  pgm.createIndex(
    'offer_geo_rules',
    ['offer_id', 'country_code'],
    {
      name: 'offer_geo_rules_offer_country_idx',
      ifNotExists: true,
    },
  );

  pgm.addConstraint(
    'offer_geo_rules',
    'offer_geo_rules_offer_rule_country_unique',
    'UNIQUE (offer_id, rule_type, country_code)',
  );
};

export const down = (pgm) => {
  pgm.dropConstraint('offer_geo_rules', 'offer_geo_rules_offer_rule_country_unique', {
    ifExists: true,
  });
  pgm.dropIndex('offer_geo_rules', ['offer_id', 'country_code'], {
    ifExists: true,
    name: 'offer_geo_rules_offer_country_idx',
  });
  pgm.dropIndex('offer_geo_rules', ['offer_id', 'rule_type'], {
    ifExists: true,
    name: 'offer_geo_rules_offer_rule_idx',
  });
  pgm.dropIndex('offer_geo_rules', 'offer_id', {
    ifExists: true,
    name: 'offer_geo_rules_offer_id_idx',
  });
  pgm.dropTable('offer_geo_rules', { ifExists: true });

  pgm.dropConstraint(
    'offer_affiliate_access',
    'offer_affiliate_access_offer_affiliate_unique',
    { ifExists: true },
  );
  pgm.dropIndex('offer_affiliate_access', ['offer_id', 'affiliate_id'], {
    ifExists: true,
    name: 'offer_affiliate_access_offer_affiliate_idx',
  });
  pgm.dropIndex('offer_affiliate_access', 'affiliate_id', {
    ifExists: true,
    name: 'offer_affiliate_access_affiliate_id_idx',
  });
  pgm.dropIndex('offer_affiliate_access', 'offer_id', {
    ifExists: true,
    name: 'offer_affiliate_access_offer_id_idx',
  });
  pgm.dropTable('offer_affiliate_access', { ifExists: true });

  pgm.dropIndex('offer_requests', ['offer_id', 'affiliate_id'], {
    ifExists: true,
    name: 'offer_requests_pending_unique',
  });
  pgm.dropIndex('offer_requests', 'status', {
    ifExists: true,
    name: 'offer_requests_status_idx',
  });
  pgm.dropIndex('offer_requests', ['offer_id', 'affiliate_id'], {
    ifExists: true,
    name: 'offer_requests_offer_affiliate_idx',
  });
  pgm.dropIndex('offer_requests', 'affiliate_id', {
    ifExists: true,
    name: 'offer_requests_affiliate_id_idx',
  });
  pgm.dropIndex('offer_requests', 'offer_id', {
    ifExists: true,
    name: 'offer_requests_offer_id_idx',
  });
  pgm.dropTable('offer_requests', { ifExists: true });

  pgm.dropIndex('offer_goals', 'offer_id', {
    ifExists: true,
    name: 'offer_goals_offer_id_default_unique',
  });
  pgm.dropIndex('offer_goals', ['offer_id', 'is_active'], {
    ifExists: true,
    name: 'offer_goals_offer_id_is_active_idx',
  });
  pgm.dropIndex('offer_goals', 'offer_id', {
    ifExists: true,
    name: 'offer_goals_offer_id_idx',
  });
  pgm.dropTable('offer_goals', { ifExists: true });

  pgm.dropConstraint('offers', 'offers_visibility_mode_check', {
    ifExists: true,
  });
  pgm.dropColumn('offers', 'preview_url', { ifExists: true });
  pgm.dropColumn('offers', 'fallback_url', { ifExists: true });
  pgm.dropColumn('offers', 'targeting_strict', { ifExists: true });
  pgm.dropColumn('offers', 'visibility_mode', { ifExists: true });
};
