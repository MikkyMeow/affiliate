import pool from '../db.js';

const auditFields = `
  id,
  entity_type AS "entityType",
  entity_id AS "entityId",
  action,
  actor_user_id AS "actorUserId",
  actor_role AS "actorRole",
  request_id AS "requestId",
  old_value AS "oldValue",
  new_value AS "newValue",
  metadata_json AS "metadata",
  error_code AS "errorCode",
  error_message AS "errorMessage",
  context_json AS "context",
  created_at AS "createdAt"
`;

function getQueryable(client) {
  return client ?? pool;
}

export async function insertAuditEvent({
  entityType,
  entityId,
  action,
  actorUserId = null,
  actorRole = null,
  requestId = null,
  oldValue = null,
  newValue = null,
  metadata = null,
  errorCode = null,
  errorMessage = null,
  context = null,
  client = null,
}) {
  const normalizedContext =
    context && typeof context === 'object' ? context : {};
  const queryable = getQueryable(client);

  const result = await queryable.query(
    `
      INSERT INTO audit_events (
        entity_type,
        entity_id,
        action,
        actor_user_id,
        actor_role,
        request_id,
        old_value,
        new_value,
        metadata_json,
        error_code,
        error_message,
        context_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${auditFields}
    `,
    [
      entityType,
      String(entityId),
      action,
      actorUserId ?? null,
      actorRole ?? null,
      requestId ?? null,
      oldValue ?? null,
      newValue ?? null,
      metadata ?? null,
      errorCode ?? null,
      errorMessage ?? null,
      normalizedContext,
    ],
  );

  return result.rows[0] ?? null;
}

function buildActor(row) {
  const actorId = row['actor.id'] ?? row.actorUserId ?? null;

  if (!actorId) {
    return null;
  }

  return {
    id: actorId,
    name: row['actor.name'] ?? null,
    email: row['actor.email'] ?? null,
    role: row['actor.role'] ?? row.actorRole ?? null,
  };
}

function normalizeAuditEvent(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    actorId: row.actorUserId ?? null,
    actorRole: row.actorRole ?? null,
    actor: buildActor(row),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    oldValue: row.oldValue ?? null,
    newValue: row.newValue ?? null,
    metadata: row.metadata ?? null,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    context: row.context ?? null,
    createdAt: row.createdAt,
  };
}

export async function listAuditEvents(
  {
    search,
    action,
    entityType,
    entityId,
    actorId,
    dateFrom,
    dateTo,
    errorOnly,
  } = {},
  {
    limit = 20,
    offset = 0,
  } = {},
  { client } = {},
) {
  const queryable = getQueryable(client);
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const searchParam = `$${params.length}`;
    conditions.push(`
      (
        LOWER(ae.action) LIKE ${searchParam}
        OR LOWER(ae.entity_type) LIKE ${searchParam}
        OR LOWER(ae.entity_id) LIKE ${searchParam}
        OR LOWER(COALESCE(u.display_name, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(u.email, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(ae.actor_role, u.role, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(ae.error_code, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(ae.error_message, '')) LIKE ${searchParam}
      )
    `);
  }

  if (action) {
    params.push(action);
    conditions.push(`ae.action = $${params.length}`);
  }

  if (entityType) {
    params.push(entityType);
    conditions.push(`ae.entity_type = $${params.length}`);
  }

  if (entityId) {
    params.push(String(entityId));
    conditions.push(`ae.entity_id = $${params.length}`);
  }

  if (actorId) {
    params.push(actorId);
    conditions.push(`ae.actor_user_id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`ae.created_at >= $${params.length}::date`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`ae.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  if (errorOnly === true) {
    conditions.push(`ae.error_code IS NOT NULL`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const selectFields = `
    ae.id,
    ae.entity_type AS "entityType",
    ae.entity_id AS "entityId",
    ae.action,
    ae.actor_user_id AS "actorUserId",
    ae.actor_role AS "actorRole",
    ae.request_id AS "requestId",
    COALESCE(
      ae.old_value,
      ae.context_json -> 'oldValue',
      ae.context_json -> 'oldValues'
    ) AS "oldValue",
    COALESCE(
      ae.new_value,
      ae.context_json -> 'newValue',
      ae.context_json -> 'newValues'
    ) AS "newValue",
    COALESCE(
      ae.metadata_json,
      ae.context_json -> 'metadata'
    ) AS "metadata",
    COALESCE(
      ae.error_code,
      ae.context_json ->> 'errorCode'
    ) AS "errorCode",
    COALESCE(
      ae.error_message,
      ae.context_json ->> 'errorMessage'
    ) AS "errorMessage",
    ae.context_json AS "context",
    ae.created_at AS "createdAt",
    u.id AS "actor.id",
    u.display_name AS "actor.name",
    u.email AS "actor.email",
    COALESCE(ae.actor_role, u.role) AS "actor.role"
  `;
  const fromClause = `
    FROM audit_events AS ae
    LEFT JOIN users AS u ON u.id = ae.actor_user_id
  `;

  const itemsParams = [...params, limit, offset];
  const itemsResult = await queryable.query(
    `
      SELECT
        ${selectFields}
      ${fromClause}
      ${whereClause}
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT $${itemsParams.length - 1}
      OFFSET $${itemsParams.length}
    `,
    itemsParams,
  );

  const countResult = await queryable.query(
    `
      SELECT COUNT(*)::int AS total
      ${fromClause}
      ${whereClause}
    `,
    params,
  );

  return {
    items: itemsResult.rows.map(normalizeAuditEvent),
    total: countResult.rows[0]?.total ?? 0,
  };
}
