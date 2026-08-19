/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumns(
    'affiliates',
    {
      telegram: {
        type: 'text',
      },
      internal_note: {
        type: 'text',
      },
    },
    { ifNotExists: true },
  );

  pgm.addColumns(
    'advertisers',
    {
      telegram: {
        type: 'text',
      },
      internal_note: {
        type: 'text',
      },
    },
    { ifNotExists: true },
  );
};

export const down = (pgm) => {
  pgm.dropColumns('advertisers', ['telegram', 'internal_note'], {
    ifExists: true,
  });
  pgm.dropColumns('affiliates', ['telegram', 'internal_note'], {
    ifExists: true,
  });
};
