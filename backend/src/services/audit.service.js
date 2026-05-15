import { insertAuditEvent } from '../models/auditEvents.model.js';

function coerceContext(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

export async function writeAuditEvent({
  entityType,
  entityId,
  action,
  actorUserId = null,
  actorRole = null,
  requestId = null,
  context = null,
  client = null,
}) {
  if (!entityType || !entityId || !action) {
    console.warn(
      JSON.stringify({
        event: 'audit_event_skipped',
        reason: 'missing_required_fields',
        entityType,
        entityId,
        action,
      }),
    );
    return null;
  }

  try {
    return await insertAuditEvent({
      entityType,
      entityId,
      action,
      actorUserId,
      actorRole,
      requestId,
      context: coerceContext(context),
      client,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'audit_event_failed',
        entityType,
        entityId,
        action,
        reason: error.message,
      }),
    );
    return null;
  }
}
