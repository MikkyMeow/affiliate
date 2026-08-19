/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('conversions', {
    goal_id: {
      type: 'uuid',
      references: '"offer_goals"',
      onDelete: 'set null',
    },
    goal_name: {
      type: 'text',
    },
    goal_type: {
      type: 'text',
    },
    revenue_amount: {
      type: 'numeric(12, 2)',
    },
    payout_amount: {
      type: 'numeric(12, 2)',
    },
  });

  pgm.createIndex('conversions', 'goal_id', {
    name: 'conversions_goal_id_idx',
    ifNotExists: true,
  });

  pgm.addColumn('postback_logs', {
    resolved_goal_id: {
      type: 'uuid',
      references: '"offer_goals"',
      onDelete: 'set null',
    },
    resolved_goal_name: {
      type: 'text',
    },
    goal_error: {
      type: 'text',
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('postback_logs', 'goal_error', { ifExists: true });
  pgm.dropColumn('postback_logs', 'resolved_goal_name', { ifExists: true });
  pgm.dropColumn('postback_logs', 'resolved_goal_id', { ifExists: true });

  pgm.dropIndex('conversions', 'goal_id', {
    ifExists: true,
    name: 'conversions_goal_id_idx',
  });

  pgm.dropColumn('conversions', 'payout_amount', { ifExists: true });
  pgm.dropColumn('conversions', 'revenue_amount', { ifExists: true });
  pgm.dropColumn('conversions', 'goal_type', { ifExists: true });
  pgm.dropColumn('conversions', 'goal_name', { ifExists: true });
  pgm.dropColumn('conversions', 'goal_id', { ifExists: true });
};
