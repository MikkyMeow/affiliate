/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'processed_async_events',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      event_key: { type: 'text', notNull: true },
      job_type: { type: 'text', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint('processed_async_events', 'processed_async_events_event_key_unique', {
    unique: ['event_key'],
  });

  pgm.createIndex('processed_async_events', 'job_type', {
    name: 'processed_async_events_job_type_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('processed_async_events', 'job_type', {
    ifExists: true,
    name: 'processed_async_events_job_type_idx',
  });

  pgm.dropConstraint(
    'processed_async_events',
    'processed_async_events_event_key_unique',
    {
      ifExists: true,
    },
  );

  pgm.dropTable('processed_async_events', { ifExists: true });
};
