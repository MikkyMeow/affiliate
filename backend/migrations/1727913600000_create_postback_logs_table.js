/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.createTable(
    'postback_logs',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      request_id: { type: 'text', notNull: false },
      click_id: { type: 'text', notNull: false },
      offer_id: {
        type: 'uuid',
        references: '"offers"',
        onDelete: 'set null',
      },
      affiliate_id: {
        type: 'uuid',
        references: '"affiliates"',
        onDelete: 'set null',
      },
      status: {
        type: 'text',
        notNull: true,
        check: "status IN ('received', 'processed', 'rejected', 'duplicate', 'failed')",
      },
      error_code: { type: 'text', notNull: false },
      payload_json: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true },
  );

  pgm.createIndex('postback_logs', 'request_id', {
    name: 'postback_logs_request_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('postback_logs', 'click_id', {
    name: 'postback_logs_click_id_idx',
    ifNotExists: true,
  });

  pgm.createIndex('postback_logs', 'status', {
    name: 'postback_logs_status_idx',
    ifNotExists: true,
  });

  pgm.createIndex('postback_logs', 'created_at', {
    name: 'postback_logs_created_at_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('postback_logs', 'status', {
    ifExists: true,
    name: 'postback_logs_status_idx',
  });

  pgm.dropIndex('postback_logs', 'created_at', {
    ifExists: true,
    name: 'postback_logs_created_at_idx',
  });

  pgm.dropIndex('postback_logs', 'click_id', {
    ifExists: true,
    name: 'postback_logs_click_id_idx',
  });

  pgm.dropIndex('postback_logs', 'request_id', {
    ifExists: true,
    name: 'postback_logs_request_id_idx',
  });

  pgm.dropTable('postback_logs', { ifExists: true });
};
