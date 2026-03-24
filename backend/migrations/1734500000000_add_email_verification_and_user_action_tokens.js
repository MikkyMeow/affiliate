/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumn('users', {
    email_verified_at: {
      type: 'timestamptz',
    },
  });

  pgm.createTable(
    'user_action_tokens',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      user_id: {
        type: 'uuid',
        notNull: true,
        references: '"users"',
        onDelete: 'cascade',
      },
      type: {
        type: 'text',
        notNull: true,
      },
      token_hash: {
        type: 'text',
        notNull: true,
        unique: true,
      },
      expires_at: {
        type: 'timestamptz',
        notNull: true,
      },
      used_at: {
        type: 'timestamptz',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint(
    'user_action_tokens',
    'user_action_tokens_type_check',
    {
      check: "type IN ('email_verification', 'password_reset')",
    },
  );

  pgm.createIndex(
    'user_action_tokens',
    'user_id',
    {
      name: 'user_action_tokens_user_id_idx',
      ifNotExists: true,
    },
  );

  pgm.createIndex(
    'user_action_tokens',
    'type',
    {
      name: 'user_action_tokens_type_idx',
      ifNotExists: true,
    },
  );

  pgm.createIndex(
    'user_action_tokens',
    'expires_at',
    {
      name: 'user_action_tokens_expires_at_idx',
      ifNotExists: true,
    },
  );
};

export const down = (pgm) => {
  pgm.dropTable('user_action_tokens', { ifExists: true });
  pgm.dropColumn('users', 'email_verified_at', { ifExists: true });
};
