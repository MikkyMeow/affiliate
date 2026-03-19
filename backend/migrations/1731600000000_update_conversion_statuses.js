/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.dropConstraint('conversions', 'conversions_status_check', {
    ifExists: true,
  });

  pgm.addConstraint('conversions', 'conversions_status_check', {
    check: "status IN ('pending', 'approved', 'rejected')",
  });

  pgm.alterColumn('conversions', 'status', { default: 'pending' });
};

export const down = (pgm) => {
  pgm.alterColumn('conversions', 'status', { default: 'approved' });

  pgm.dropConstraint('conversions', 'conversions_status_check', {
    ifExists: true,
  });

  pgm.addConstraint('conversions', 'conversions_status_check', {
    check: "status IN ('approved', 'rejected')",
  });
};
