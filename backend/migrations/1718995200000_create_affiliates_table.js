/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'affiliates',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      name: { type: 'text', notNull: true },
      email: { type: 'text', notNull: true, unique: true },
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
  pgm.dropTable('affiliates', { ifExists: true });
};
