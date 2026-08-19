/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('offers', {
    description: {
      type: 'text',
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('offers', 'description', { ifExists: true });
};
