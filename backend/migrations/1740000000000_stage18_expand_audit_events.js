/* eslint-disable camelcase */

export const up = (pgm) => {
  pgm.addColumns(
    'audit_events',
    {
      old_value: { type: 'jsonb' },
      new_value: { type: 'jsonb' },
      metadata_json: { type: 'jsonb' },
      error_code: { type: 'text' },
      error_message: { type: 'text' },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createIndex('audit_events', 'action', {
    ifNotExists: true,
    name: 'audit_events_action_idx',
  });

  pgm.createIndex('audit_events', 'error_code', {
    ifNotExists: true,
    name: 'audit_events_error_code_idx',
  });
};

export const down = (pgm) => {
  pgm.dropIndex('audit_events', 'error_code', {
    ifExists: true,
    name: 'audit_events_error_code_idx',
  });

  pgm.dropIndex('audit_events', 'action', {
    ifExists: true,
    name: 'audit_events_action_idx',
  });

  pgm.dropColumns(
    'audit_events',
    ['old_value', 'new_value', 'metadata_json', 'error_code', 'error_message'],
    {
      ifExists: true,
    },
  );
};
