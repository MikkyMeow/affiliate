/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'audit_events',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      entity_type: { type: 'text', notNull: true },
      entity_id: { type: 'text', notNull: true },
      action: { type: 'text', notNull: true },
      actor_user_id: {
        type: 'uuid',
        references: 'users',
        onDelete: 'set null',
      },
      actor_role: { type: 'text' },
      request_id: { type: 'text' },
      context_json: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('audit_events', ['entity_type', 'entity_id'], {
    ifNotExists: true,
    name: 'audit_events_entity_idx',
  });

  pgm.createIndex('audit_events', 'created_at', {
    ifNotExists: true,
    name: 'audit_events_created_at_idx',
  });

  pgm.createIndex('audit_events', 'actor_user_id', {
    ifNotExists: true,
    name: 'audit_events_actor_idx',
  });
};

export const down = (pgm) => {
  pgm.dropIndex('audit_events', 'actor_user_id', {
    ifExists: true,
    name: 'audit_events_actor_idx',
  });
  pgm.dropIndex('audit_events', 'created_at', {
    ifExists: true,
    name: 'audit_events_created_at_idx',
  });
  pgm.dropIndex('audit_events', ['entity_type', 'entity_id'], {
    ifExists: true,
    name: 'audit_events_entity_idx',
  });
  pgm.dropTable('audit_events', { ifExists: true });
};
