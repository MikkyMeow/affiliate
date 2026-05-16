import pool from '../db.js';

const questionnaireFields = `
  id,
  target_role AS "targetRole",
  title,
  description,
  fields,
  is_active AS "isActive",
  created_by AS "createdBy",
  updated_by AS "updatedBy",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getQueryable(client) {
  return client ?? pool;
}

function normalizeQuestionnaire(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    targetRole: row.targetRole,
    title: row.title ?? null,
    description: row.description ?? null,
    fields: Array.isArray(row.fields) ? row.fields : [],
    isActive: Boolean(row.isActive),
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function listRegistrationQuestionnaires(
  { targetRole } = {},
  { client } = {},
) {
  const queryable = getQueryable(client);
  const params = [];
  const conditions = [];

  if (targetRole) {
    params.push(targetRole);
    conditions.push(`target_role = $${params.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await queryable.query(
    `
      SELECT ${questionnaireFields}
      FROM registration_questionnaires
      ${whereClause}
      ORDER BY target_role ASC;
    `,
    params,
  );

  return result.rows.map(normalizeQuestionnaire);
}

export async function findRegistrationQuestionnaireById(id, { client } = {}) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${questionnaireFields}
      FROM registration_questionnaires
      WHERE id = $1
      LIMIT 1;
    `,
    [id],
  );

  return normalizeQuestionnaire(result.rows[0] ?? null);
}

export async function findRegistrationQuestionnaireByTargetRole(
  targetRole,
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${questionnaireFields}
      FROM registration_questionnaires
      WHERE target_role = $1
      LIMIT 1;
    `,
    [targetRole],
  );

  return normalizeQuestionnaire(result.rows[0] ?? null);
}

export async function findActiveRegistrationQuestionnaireByTargetRole(
  targetRole,
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${questionnaireFields}
      FROM registration_questionnaires
      WHERE target_role = $1
        AND is_active = true
      LIMIT 1;
    `,
    [targetRole],
  );

  return normalizeQuestionnaire(result.rows[0] ?? null);
}

export async function upsertRegistrationQuestionnaire(
  {
    targetRole,
    title,
    description,
    fields,
    isActive = true,
    createdBy = null,
    updatedBy = null,
  },
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO registration_questionnaires (
        target_role,
        title,
        description,
        fields,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (target_role)
      DO UPDATE
      SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        fields = EXCLUDED.fields,
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING ${questionnaireFields};
    `,
    [
      targetRole,
      title ?? null,
      description ?? null,
      JSON.stringify(Array.isArray(fields) ? fields : []),
      Boolean(isActive),
      createdBy ?? updatedBy ?? null,
      updatedBy ?? null,
    ],
  );

  return normalizeQuestionnaire(result.rows[0] ?? null);
}
