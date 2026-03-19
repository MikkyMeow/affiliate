import pool from '../db.js';

const postbackLogFields = `
  id,
  request_id AS "requestId",
  click_id AS "clickId",
  offer_id AS "offerId",
  affiliate_id AS "affiliateId",
  status,
  error_code AS "errorCode",
  payload_json AS "payloadJson",
  resolved_goal_id AS "resolvedGoalId",
  resolved_goal_name AS "resolvedGoalName",
  goal_error AS "goalError",
  created_at AS "createdAt"
`;

export async function createPostbackLog({
  requestId = null,
  clickId = null,
  offerId = null,
  affiliateId = null,
  status,
  errorCode = null,
  payloadJson = {},
}) {
  const result = await pool.query(
    `
      INSERT INTO postback_logs (
        request_id,
        click_id,
        offer_id,
        affiliate_id,
        status,
        error_code,
        payload_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${postbackLogFields};
    `,
    [requestId, clickId, offerId, affiliateId, status, errorCode, payloadJson],
  );

  return result.rows[0] ?? null;
}

export async function updatePostbackLogResult({
  id,
  requestId,
  clickId,
  offerId,
  affiliateId,
  status,
  errorCode,
  resolvedGoalId,
  resolvedGoalName,
  goalError,
}) {
  const fields = [];
  const values = [];
  let index = 1;

  if (requestId !== undefined) {
    fields.push(`request_id = $${index++}`);
    values.push(requestId);
  }

  if (clickId !== undefined) {
    fields.push(`click_id = $${index++}`);
    values.push(clickId);
  }

  if (offerId !== undefined) {
    fields.push(`offer_id = $${index++}`);
    values.push(offerId);
  }

  if (affiliateId !== undefined) {
    fields.push(`affiliate_id = $${index++}`);
    values.push(affiliateId);
  }

  if (status !== undefined) {
    fields.push(`status = $${index++}`);
    values.push(status);
  }

  if (errorCode !== undefined) {
    fields.push(`error_code = $${index++}`);
    values.push(errorCode);
  }

  if (resolvedGoalId !== undefined) {
    fields.push(`resolved_goal_id = $${index++}`);
    values.push(resolvedGoalId);
  }

  if (resolvedGoalName !== undefined) {
    fields.push(`resolved_goal_name = $${index++}`);
    values.push(resolvedGoalName);
  }

  if (goalError !== undefined) {
    fields.push(`goal_error = $${index++}`);
    values.push(goalError);
  }

  if (!fields.length) {
    return null;
  }

  values.push(id);

  const result = await pool.query(
    `
      UPDATE postback_logs
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING ${postbackLogFields};
    `,
    values,
  );

  return result.rows[0] ?? null;
}
