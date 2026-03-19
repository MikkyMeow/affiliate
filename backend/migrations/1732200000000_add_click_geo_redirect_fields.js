/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumns('clicks', {
    country_code: { type: 'char(2)' },
    targeting_strict: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    redirect_outcome: { type: 'text' },
    redirect_reason: { type: 'text' },
    destination_type: { type: 'text' },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('clicks', [
    'country_code',
    'targeting_strict',
    'redirect_outcome',
    'redirect_reason',
    'destination_type',
  ]);
};
