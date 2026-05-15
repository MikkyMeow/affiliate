import pool from '../db.js';

const auditFields = `
  id,
  entity_type AS "entityType",
  entity_id AS "entityId",
  action,
  actor_user_id AS "actorUserId",
  actor_role AS "actorRole",
  request_id AS "requestId",
  context_json AS "context",
  created_at AS "createdAt"
`;

export async function insertAuditEvent({
  entityType,
  entityId,
  action,
  actorUserId = null,
  actorRole = null,
  requestId = null,
  context = null,
  client = null,
}) {
  const normalizedContext =
    context && typeof context === 'object' ? context : {};
  const queryable = client ?? pool;

  const result = await queryable.query(
    `
      INSERT INTO audit_events (
        entity_type,
        entity_id,
        action,
        actor_user_id,
        actor_role,
        request_id,
        context_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING ${auditFields}
    `,
    [
      entityType,
      String(entityId),
      action,
      actorUserId ?? null,
      actorRole ?? null,
      requestId ?? null,
      normalizedContext,
    ],
  );

  return result.rows[0] ?? null;
}
