/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn(
    'users',
    {
      role: {
        type: 'text',
        notNull: true,
        default: 'admin',
      },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint(
    'users',
    'users_role_check',
    "CHECK (role IN ('admin', 'affiliate'))",
  );

  pgm.sql(`
    UPDATE users
    SET role = 'admin'
    WHERE role IS NULL
  `);

  pgm.alterColumn('users', 'role', { default: 'affiliate' });

  pgm.addColumn(
    'affiliates',
    {
      user_id: {
        type: 'uuid',
        references: '"users"',
        onDelete: 'set null',
      },
    },
    { ifNotExists: true },
  );

  pgm.sql(`
    UPDATE affiliates AS a
    SET user_id = u.id
    FROM users AS u
    WHERE a.user_id IS NULL AND LOWER(a.email) = LOWER(u.email)
  `);

  pgm.addConstraint(
    'affiliates',
    'affiliates_user_id_unique',
    'UNIQUE(user_id)',
  );

  pgm.createIndex('affiliates', 'user_id', {
    name: 'affiliates_user_id_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('affiliates', 'user_id', {
    ifExists: true,
    name: 'affiliates_user_id_idx',
  });
  pgm.dropConstraint('affiliates', 'affiliates_user_id_unique', {
    ifExists: true,
  });
  pgm.dropColumn('affiliates', 'user_id', { ifExists: true });

  pgm.alterColumn('users', 'role', { default: null });
  pgm.sql(`
    UPDATE users
    SET role = NULL
  `);
  pgm.dropConstraint('users', 'users_role_check', { ifExists: true });
  pgm.dropColumn('users', 'role', { ifExists: true });
};
