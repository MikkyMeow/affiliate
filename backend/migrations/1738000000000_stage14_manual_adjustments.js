/* eslint-disable camelcase */

const MANUAL_BATCH_STATUS_CHECK = `
  status IN ('previewed', 'applied', 'failed')
`;

const MANUAL_BATCH_TYPE_CHECK = `
  type IN ('conversions', 'clicks')
`;

const MANUAL_BATCH_PARTNER_MODE_CHECK = `
  partner_mode IN ('single_partner', 'per_row')
`;

const RECORD_SOURCE_CHECK = `
  source IN ('tracking', 'manual')
`;

export const up = (pgm) => {
  pgm.createTable(
    'manual_adjustment_batches',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      type: {
        type: 'text',
        notNull: true,
        check: MANUAL_BATCH_TYPE_CHECK,
      },
      partner_mode: {
        type: 'text',
        notNull: true,
        check: MANUAL_BATCH_PARTNER_MODE_CHECK,
      },
      default_affiliate_id: {
        type: 'uuid',
        references: 'affiliates',
        onDelete: 'set null',
      },
      default_offer_id: {
        type: 'uuid',
        references: 'offers',
        onDelete: 'set null',
      },
      default_goal_id: {
        type: 'uuid',
        references: 'offer_goals',
        onDelete: 'set null',
      },
      default_status: { type: 'text' },
      original_filename: { type: 'text' },
      total_rows: { type: 'integer', notNull: true, default: 0 },
      valid_rows: { type: 'integer', notNull: true, default: 0 },
      invalid_rows: { type: 'integer', notNull: true, default: 0 },
      created_rows: { type: 'integer', notNull: true, default: 0 },
      skipped_rows: { type: 'integer', notNull: true, default: 0 },
      status: {
        type: 'text',
        notNull: true,
        check: MANUAL_BATCH_STATUS_CHECK,
      },
      created_by: {
        type: 'uuid',
        notNull: true,
        references: 'users',
        onDelete: 'restrict',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
      applied_at: { type: 'timestamptz' },
      metadata: { type: 'jsonb' },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('manual_adjustment_batches', 'created_at', {
    ifNotExists: true,
    name: 'manual_adjustment_batches_created_at_idx',
  });
  pgm.createIndex('manual_adjustment_batches', 'created_by', {
    ifNotExists: true,
    name: 'manual_adjustment_batches_created_by_idx',
  });
  pgm.createIndex('manual_adjustment_batches', 'status', {
    ifNotExists: true,
    name: 'manual_adjustment_batches_status_idx',
  });
  pgm.createIndex('manual_adjustment_batches', 'type', {
    ifNotExists: true,
    name: 'manual_adjustment_batches_type_idx',
  });

  pgm.addColumns('conversions', {
    source: { type: 'text' },
    manual_adjustment_batch_id: {
      type: 'uuid',
      references: 'manual_adjustment_batches',
      onDelete: 'set null',
    },
    created_by: {
      type: 'uuid',
      references: 'users',
      onDelete: 'set null',
    },
  });

  pgm.sql(`
    UPDATE conversions
    SET source = 'tracking'
    WHERE source IS NULL;
  `);

  pgm.alterColumn('conversions', 'source', {
    notNull: true,
    default: 'tracking',
  });

  pgm.addConstraint('conversions', 'conversions_source_check', {
    check: RECORD_SOURCE_CHECK,
  });

  pgm.alterColumn('conversions', 'click_id', {
    notNull: false,
  });

  pgm.createIndex('conversions', 'manual_adjustment_batch_id', {
    ifNotExists: true,
    name: 'conversions_manual_adjustment_batch_idx',
  });
  pgm.createIndex('conversions', 'source', {
    ifNotExists: true,
    name: 'conversions_source_idx',
  });

  pgm.addColumns('clicks', {
    goal_id: {
      type: 'uuid',
      references: 'offer_goals',
      onDelete: 'set null',
    },
    source: { type: 'text' },
    manual_adjustment_batch_id: {
      type: 'uuid',
      references: 'manual_adjustment_batches',
      onDelete: 'set null',
    },
    created_by: {
      type: 'uuid',
      references: 'users',
      onDelete: 'set null',
    },
  });

  pgm.sql(`
    UPDATE clicks
    SET source = 'tracking'
    WHERE source IS NULL;
  `);

  pgm.alterColumn('clicks', 'source', {
    notNull: true,
    default: 'tracking',
  });

  pgm.addConstraint('clicks', 'clicks_source_check', {
    check: RECORD_SOURCE_CHECK,
  });

  pgm.createIndex('clicks', 'goal_id', {
    ifNotExists: true,
    name: 'clicks_goal_id_idx',
  });
  pgm.createIndex('clicks', 'manual_adjustment_batch_id', {
    ifNotExists: true,
    name: 'clicks_manual_adjustment_batch_idx',
  });
  pgm.createIndex('clicks', 'source', {
    ifNotExists: true,
    name: 'clicks_source_idx',
  });
};

export const down = (pgm) => {
  pgm.dropIndex('clicks', 'source', {
    ifExists: true,
    name: 'clicks_source_idx',
  });
  pgm.dropIndex('clicks', 'manual_adjustment_batch_id', {
    ifExists: true,
    name: 'clicks_manual_adjustment_batch_idx',
  });
  pgm.dropIndex('clicks', 'goal_id', {
    ifExists: true,
    name: 'clicks_goal_id_idx',
  });
  pgm.dropConstraint('clicks', 'clicks_source_check', {
    ifExists: true,
  });
  pgm.dropColumns('clicks', [
    'created_by',
    'manual_adjustment_batch_id',
    'source',
    'goal_id',
  ]);

  pgm.dropIndex('conversions', 'source', {
    ifExists: true,
    name: 'conversions_source_idx',
  });
  pgm.dropIndex('conversions', 'manual_adjustment_batch_id', {
    ifExists: true,
    name: 'conversions_manual_adjustment_batch_idx',
  });
  pgm.dropConstraint('conversions', 'conversions_source_check', {
    ifExists: true,
  });
  pgm.alterColumn('conversions', 'click_id', {
    notNull: true,
  });
  pgm.dropColumns('conversions', [
    'created_by',
    'manual_adjustment_batch_id',
    'source',
  ]);

  pgm.dropIndex('manual_adjustment_batches', 'type', {
    ifExists: true,
    name: 'manual_adjustment_batches_type_idx',
  });
  pgm.dropIndex('manual_adjustment_batches', 'status', {
    ifExists: true,
    name: 'manual_adjustment_batches_status_idx',
  });
  pgm.dropIndex('manual_adjustment_batches', 'created_by', {
    ifExists: true,
    name: 'manual_adjustment_batches_created_by_idx',
  });
  pgm.dropIndex('manual_adjustment_batches', 'created_at', {
    ifExists: true,
    name: 'manual_adjustment_batches_created_at_idx',
  });
  pgm.dropTable('manual_adjustment_batches', { ifExists: true });
};
