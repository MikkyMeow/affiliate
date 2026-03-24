/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('clicks', {
    device: { type: 'text' },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('clicks', 'device', { ifExists: true });
};
