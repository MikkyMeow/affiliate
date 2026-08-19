import pool from '../db.js';

const answerFields = `
  id,
  user_id AS "userId",
  target_role AS "targetRole",
  answers,
  submitted_at AS "submittedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function getQueryable(client) {
  return client ?? pool;
}

function normalizeAnswer(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.userId,
    targetRole: row.targetRole,
    answers: row.answers && typeof row.answers === 'object' ? row.answers : {},
    submittedAt: row.submittedAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function findRegistrationQuestionnaireAnswerByUserIdAndTargetRole(
  userId,
  targetRole,
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      SELECT ${answerFields}
      FROM registration_questionnaire_answers
      WHERE user_id = $1
        AND target_role = $2
      LIMIT 1;
    `,
    [userId, targetRole],
  );

  return normalizeAnswer(result.rows[0] ?? null);
}

export async function insertRegistrationQuestionnaireAnswer(
  { userId, targetRole, answers, submittedAt = null },
  { client } = {},
) {
  const queryable = getQueryable(client);
  const result = await queryable.query(
    `
      INSERT INTO registration_questionnaire_answers (
        user_id,
        target_role,
        answers,
        submitted_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING ${answerFields};
    `,
    [userId, targetRole, answers, submittedAt],
  );

  return normalizeAnswer(result.rows[0] ?? null);
}

export async function updateRegistrationQuestionnaireAnswer(
  id,
  { answers, submittedAt },
  { client } = {},
) {
  const queryable = getQueryable(client);
  const assignments = [];
  const params = [];

  if (answers !== undefined) {
    params.push(answers);
    assignments.push(`answers = $${params.length}`);
  }

  if (submittedAt !== undefined) {
    params.push(submittedAt);
    assignments.push(`submitted_at = $${params.length}`);
  }

  if (assignments.length === 0) {
    return null;
  }

  params.push(id);
  const result = await queryable.query(
    `
      UPDATE registration_questionnaire_answers
      SET
        ${assignments.join(', ')},
        updated_at = NOW()
      WHERE id = $${params.length}
      RETURNING ${answerFields};
    `,
    params,
  );

  return normalizeAnswer(result.rows[0] ?? null);
}
