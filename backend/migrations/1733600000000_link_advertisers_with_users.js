/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn(
    'advertisers',
    {
      user_id: {
        type: 'uuid',
        references: '"users"',
        onDelete: 'set null',
      },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint('advertisers', 'advertisers_user_id_unique', 'UNIQUE(user_id)');

  pgm.createIndex('advertisers', 'user_id', {
    name: 'advertisers_user_id_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('advertisers', 'user_id', {
    ifExists: true,
    name: 'advertisers_user_id_idx',
  });
  pgm.dropConstraint('advertisers', 'advertisers_user_id_unique', {
    ifExists: true,
  });
  pgm.dropColumn('advertisers', 'user_id', { ifExists: true });
};
