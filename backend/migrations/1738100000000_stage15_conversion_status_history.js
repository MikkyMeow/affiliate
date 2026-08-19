/* eslint-disable camelcase */

const CONVERSION_STATUS_CHECK = `
  status IN ('pending', 'approved', 'rejected', 'cancelled')
`;

const HISTORY_STATUS_CHECK = `
  to_status IN ('pending', 'approved', 'rejected', 'cancelled')
  AND (
    from_status IS NULL
    OR from_status IN ('pending', 'approved', 'rejected', 'cancelled')
  )
`;

export const up = (pgm) => {
  pgm.dropConstraint('conversions', 'conversions_status_check', {
    ifExists: true,
  });

  pgm.addConstraint('conversions', 'conversions_status_check', {
    check: CONVERSION_STATUS_CHECK,
  });

  pgm.addColumns('conversions', {
    is_test: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.sql(`
    UPDATE conversions
    SET updated_at = created_at;
  `);

  pgm.createIndex('conversions', 'is_test', {
    ifNotExists: true,
    name: 'conversions_is_test_idx',
  });

  pgm.addColumns('daily_stats', {
    cancelled_conversions_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    cancelled_payout_total_rub: {
      type: 'numeric(14, 2)',
      notNull: true,
      default: 0,
    },
    cancelled_revenue_total_rub: {
      type: 'numeric(14, 2)',
      notNull: true,
      default: 0,
    },
  });

  pgm.createTable(
    'conversion_status_history',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      conversion_id: {
        type: 'uuid',
        notNull: true,
        references: 'conversions',
        onDelete: 'cascade',
      },
      from_status: {
        type: 'text',
      },
      to_status: {
        type: 'text',
        notNull: true,
      },
      reason: {
        type: 'text',
      },
      changed_by: {
        type: 'uuid',
        references: 'users',
        onDelete: 'set null',
      },
      changed_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
      metadata: {
        type: 'jsonb',
      },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint(
    'conversion_status_history',
    'conversion_status_history_status_check',
    { check: HISTORY_STATUS_CHECK },
  );

  pgm.createIndex('conversion_status_history', 'conversion_id', {
    ifNotExists: true,
    name: 'conversion_status_history_conversion_id_idx',
  });
  pgm.createIndex('conversion_status_history', 'changed_at', {
    ifNotExists: true,
    name: 'conversion_status_history_changed_at_idx',
  });
  pgm.createIndex('conversion_status_history', 'changed_by', {
    ifNotExists: true,
    name: 'conversion_status_history_changed_by_idx',
  });
};

export const down = (pgm) => {
  pgm.dropIndex('conversion_status_history', 'changed_by', {
    ifExists: true,
    name: 'conversion_status_history_changed_by_idx',
  });
  pgm.dropIndex('conversion_status_history', 'changed_at', {
    ifExists: true,
    name: 'conversion_status_history_changed_at_idx',
  });
  pgm.dropIndex('conversion_status_history', 'conversion_id', {
    ifExists: true,
    name: 'conversion_status_history_conversion_id_idx',
  });
  pgm.dropConstraint(
    'conversion_status_history',
    'conversion_status_history_status_check',
    { ifExists: true },
  );
  pgm.dropTable('conversion_status_history', { ifExists: true });

  pgm.dropIndex('conversions', 'is_test', {
    ifExists: true,
    name: 'conversions_is_test_idx',
  });
  pgm.dropColumns('conversions', ['updated_at', 'is_test']);

  pgm.dropColumns('daily_stats', [
    'cancelled_revenue_total_rub',
    'cancelled_payout_total_rub',
    'cancelled_conversions_count',
  ]);

  pgm.dropConstraint('conversions', 'conversions_status_check', {
    ifExists: true,
  });

  pgm.addConstraint('conversions', 'conversions_status_check', {
    check: "status IN ('pending', 'approved', 'rejected')",
  });
};
