/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('offers', {
    postback_token: {
      type: 'text',
      notNull: true,
      default: pgm.func("encode(gen_random_bytes(32), 'hex')"),
    },
  });

  pgm.addConstraint(
    'offers',
    'offers_postback_token_unique',
    'UNIQUE(postback_token)',
  );
};

export const down = (pgm) => {
  pgm.dropConstraint('offers', 'offers_postback_token_unique', {
    ifExists: true,
  });
  pgm.dropColumn('offers', 'postback_token', { ifExists: true });
};
