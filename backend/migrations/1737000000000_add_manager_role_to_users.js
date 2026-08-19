/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.dropConstraint('users', 'users_role_check', { ifExists: true });
  pgm.addConstraint(
    'users',
    'users_role_check',
    "CHECK (role IN ('admin', 'manager', 'affiliate', 'advertiser'))",
  );
};

export const down = (pgm) => {
  pgm.dropConstraint('users', 'users_role_check', { ifExists: true });
  pgm.addConstraint(
    'users',
    'users_role_check',
    "CHECK (role IN ('admin', 'affiliate', 'advertiser'))",
  );
};
