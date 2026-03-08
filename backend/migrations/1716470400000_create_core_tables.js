/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  pgm.createTable(
    'users',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      email: { type: 'text', notNull: true, unique: true },
      password_hash: { type: 'text', notNull: true },
      display_name: { type: 'text' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.createTable(
    'refresh_tokens',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      user_id: {
        type: 'uuid',
        notNull: true,
        references: '"users"',
        onDelete: 'cascade',
      },
      token_hash: { type: 'text', notNull: true },
      expires_at: { type: 'timestamptz', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('refresh_tokens', 'user_id', {
    name: 'refresh_tokens_user_id_idx',
    ifNotExists: true,
  });

  pgm.createTable(
    'advertisers',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      name: { type: 'text', notNull: true },
      status: {
        type: 'text',
        notNull: true,
        default: 'active',
        check: "status IN ('active', 'inactive')",
      },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );
};

export const down = (pgm) => {
  pgm.dropTable('advertisers', { ifExists: true });
  pgm.dropIndex('refresh_tokens', 'user_id', {
    ifExists: true,
    name: 'refresh_tokens_user_id_idx',
  });
  pgm.dropTable('refresh_tokens', { ifExists: true });
  pgm.dropTable('users', { ifExists: true });
  pgm.dropExtension('pgcrypto', { ifExists: true });
};
