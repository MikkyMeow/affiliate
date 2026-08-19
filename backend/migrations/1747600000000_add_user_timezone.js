/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('users', {
    timezone: { type: 'text' },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('users', 'timezone');
};
