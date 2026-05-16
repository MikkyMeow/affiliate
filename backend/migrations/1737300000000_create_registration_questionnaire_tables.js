/* eslint-disable camelcase */

const TARGET_ROLE_CHECK =
  "target_role IN ('affiliate', 'advertiser')";

export const up = (pgm) => {
  pgm.createTable(
    'registration_questionnaires',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      target_role: {
        type: 'text',
        notNull: true,
      },
      title: {
        type: 'text',
      },
      description: {
        type: 'text',
      },
      fields: {
        type: 'jsonb',
        notNull: true,
        default: pgm.func("'[]'::jsonb"),
      },
      is_active: {
        type: 'boolean',
        notNull: true,
        default: true,
      },
      created_by: {
        type: 'uuid',
        references: 'users',
        onDelete: 'set null',
      },
      updated_by: {
        type: 'uuid',
        references: 'users',
        onDelete: 'set null',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint(
    'registration_questionnaires',
    'registration_questionnaires_target_role_check',
    `CHECK (${TARGET_ROLE_CHECK})`,
  );

  pgm.createIndex('registration_questionnaires', 'target_role', {
    name: 'registration_questionnaires_target_role_key',
    unique: true,
    ifNotExists: true,
  });

  pgm.createTable(
    'registration_questionnaire_answers',
    {
      id: {
        type: 'uuid',
        primaryKey: true,
        default: pgm.func('gen_random_uuid()'),
      },
      user_id: {
        type: 'uuid',
        notNull: true,
        references: 'users',
        onDelete: 'cascade',
      },
      target_role: {
        type: 'text',
        notNull: true,
      },
      answers: {
        type: 'jsonb',
        notNull: true,
        default: pgm.func("'{}'::jsonb"),
      },
      submitted_at: {
        type: 'timestamptz',
      },
      created_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
      updated_at: {
        type: 'timestamptz',
        notNull: true,
        default: pgm.func('now()'),
      },
    },
    { ifNotExists: true },
  );

  pgm.addConstraint(
    'registration_questionnaire_answers',
    'registration_questionnaire_answers_target_role_check',
    `CHECK (${TARGET_ROLE_CHECK})`,
  );

  pgm.createIndex(
    'registration_questionnaire_answers',
    ['user_id', 'target_role'],
    {
      name: 'registration_questionnaire_answers_user_target_key',
      unique: true,
      ifNotExists: true,
    },
  );

  pgm.createIndex('registration_questionnaire_answers', 'user_id', {
    name: 'registration_questionnaire_answers_user_idx',
    ifNotExists: true,
  });
};

export const down = (pgm) => {
  pgm.dropIndex('registration_questionnaire_answers', 'user_id', {
    name: 'registration_questionnaire_answers_user_idx',
    ifExists: true,
  });
  pgm.dropIndex(
    'registration_questionnaire_answers',
    ['user_id', 'target_role'],
    {
      name: 'registration_questionnaire_answers_user_target_key',
      ifExists: true,
    },
  );
  pgm.dropConstraint(
    'registration_questionnaire_answers',
    'registration_questionnaire_answers_target_role_check',
    { ifExists: true },
  );
  pgm.dropTable('registration_questionnaire_answers', { ifExists: true });

  pgm.dropIndex('registration_questionnaires', 'target_role', {
    name: 'registration_questionnaires_target_role_key',
    ifExists: true,
  });
  pgm.dropConstraint(
    'registration_questionnaires',
    'registration_questionnaires_target_role_check',
    { ifExists: true },
  );
  pgm.dropTable('registration_questionnaires', { ifExists: true });
};
