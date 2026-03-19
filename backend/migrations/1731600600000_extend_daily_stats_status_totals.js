/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.renameColumn('daily_stats', 'payout_total_rub', 'approved_payout_total_rub');

  pgm.addColumns('daily_stats', {
    pending_conversions_count: { type: 'integer', notNull: true, default: 0 },
    pending_payout_total_rub: { type: 'numeric(14, 2)', notNull: true, default: 0 },
    approved_revenue_total_rub: { type: 'numeric(14, 2)', notNull: true, default: 0 },
    pending_revenue_total_rub: { type: 'numeric(14, 2)', notNull: true, default: 0 },
    rejected_payout_total_rub: { type: 'numeric(14, 2)', notNull: true, default: 0 },
    rejected_revenue_total_rub: { type: 'numeric(14, 2)', notNull: true, default: 0 },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('daily_stats', [
    'pending_conversions_count',
    'pending_payout_total_rub',
    'approved_revenue_total_rub',
    'pending_revenue_total_rub',
    'rejected_payout_total_rub',
    'rejected_revenue_total_rub',
  ]);

  pgm.renameColumn('daily_stats', 'approved_payout_total_rub', 'payout_total_rub');
};
