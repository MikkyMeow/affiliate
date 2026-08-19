import {
  insertAuditEvent,
  listAuditEvents as listAuditEventsModel,
} from '../models/auditEvents.model.js';

const REDACTED_VALUE = '[REDACTED]';
const MAX_STRING_LENGTH = 1000;
const MAX_ARRAY_LENGTH = 100;
const MAX_OBJECT_KEYS = 100;
const RESERVED_CONTEXT_KEYS = new Set([
  'oldvalue',
  'oldvalues',
  'newvalue',
  'newvalues',
  'metadata',
  'errorcode',
  'errormessage',
]);
const SENSITIVE_KEYS = new Set([
  'password',
  'temporarypassword',
  'token',
  'postbacktoken',
  'conversiontoken',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'setcookie',
  'refreshtoken',
  'accesstoken',
]);
const LARGE_CONTENT_KEYS = new Set([
  'csvtext',
  'csvcontent',
  'csvrawcontent',
  'rawcsv',
  'filecontent',
  'filedata',
  'rawfile',
]);

function normalizeKey(key) {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function truncateString(value) {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED ${value.length}]`;
}

function sanitizeValue(value, currentKey = null) {
  const normalizedKey = normalizeKey(currentKey);

  if (SENSITIVE_KEYS.has(normalizedKey)) {
    return REDACTED_VALUE;
  }

  if (LARGE_CONTENT_KEYS.has(normalizedKey)) {
    return REDACTED_VALUE;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeValue(item, currentKey));
  }

  if (!isPlainObject(value)) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }

  const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
  return Object.fromEntries(
    entries.map(([key, nestedValue]) => [key, sanitizeValue(nestedValue, key)]),
  );
}

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

function buildCompatibilityContext({
  context,
  oldValue,
  newValue,
  metadata,
  errorCode,
  errorMessage,
}) {
  const result = { ...context };

  if (oldValue !== undefined) {
    result.oldValue = oldValue;
    result.oldValues = oldValue;
  }

  if (newValue !== undefined) {
    result.newValue = newValue;
    result.newValues = newValue;
  }

  if (metadata !== undefined) {
    result.metadata = metadata;
  }

  if (errorCode !== undefined) {
    result.errorCode = errorCode;
  }

  if (errorMessage !== undefined) {
    result.errorMessage = errorMessage;
  }

  return result;
}

function mergeMetadata(...values) {
  const merged = {};

  values.forEach((value) => {
    if (isPlainObject(value)) {
      Object.assign(merged, value);
    }
  });

  return Object.keys(merged).length > 0 ? merged : null;
}

function extractExtraContext(context) {
  if (!isPlainObject(context)) {
    return null;
  }

  const entries = Object.entries(context).filter(
    ([key]) => !RESERVED_CONTEXT_KEYS.has(normalizeKey(key)),
  );

  if (!entries.length) {
    return null;
  }

  return Object.fromEntries(entries);
}

function normalizeAuditPayload({
  oldValue,
  newValue,
  metadata,
  errorCode,
  errorMessage,
  context,
}) {
  const sanitizedContext = sanitizeAuditPayload(coerceContext(context));
  const contextOldValue =
    sanitizedContext.oldValue ?? sanitizedContext.oldValues ?? undefined;
  const contextNewValue =
    sanitizedContext.newValue ?? sanitizedContext.newValues ?? undefined;
  const contextMetadata = sanitizedContext.metadata ?? null;
  const extraContext = extractExtraContext(sanitizedContext);

  const normalizedOldValue = sanitizeAuditPayload(
    oldValue !== undefined ? oldValue : contextOldValue,
  );
  const normalizedNewValue = sanitizeAuditPayload(
    newValue !== undefined ? newValue : contextNewValue,
  );
  const normalizedMetadata = mergeMetadata(
    contextMetadata,
    extraContext,
    sanitizeAuditPayload(metadata),
  );
  const normalizedErrorCode =
    typeof errorCode === 'string'
      ? errorCode
      : typeof sanitizedContext.errorCode === 'string'
        ? sanitizedContext.errorCode
        : null;
  const normalizedErrorMessage = truncateString(
    typeof errorMessage === 'string'
      ? errorMessage
      : typeof sanitizedContext.errorMessage === 'string'
        ? sanitizedContext.errorMessage
        : '',
  );

  return {
    oldValue:
      normalizedOldValue === undefined ? null : normalizedOldValue,
    newValue:
      normalizedNewValue === undefined ? null : normalizedNewValue,
    metadata: normalizedMetadata,
    errorCode: normalizedErrorCode,
    errorMessage: normalizedErrorMessage || null,
    context: buildCompatibilityContext({
      context: sanitizedContext,
      oldValue:
        normalizedOldValue === undefined ? undefined : normalizedOldValue,
      newValue:
        normalizedNewValue === undefined ? undefined : normalizedNewValue,
      metadata: normalizedMetadata ?? undefined,
      errorCode: normalizedErrorCode ?? undefined,
      errorMessage: normalizedErrorMessage || undefined,
    }),
  };
}

function logAuditWriteFailure({
  entityType,
  entityId,
  action,
  error,
}) {
  console.error(
    JSON.stringify({
      event: 'audit_event_failed',
      entityType,
      entityId,
      action,
      reason: error?.message ?? 'unknown_error',
    }),
  );
}

export function sanitizeAuditPayload(value) {
  return sanitizeValue(value);
}

export async function logAuditEvent({
  entityType,
  entityId,
  action,
  actorUserId = null,
  actorRole = null,
  requestId = null,
  oldValue,
  newValue,
  metadata,
  errorCode = null,
  errorMessage = null,
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

  const normalized = normalizeAuditPayload({
    oldValue,
    newValue,
    metadata,
    errorCode,
    errorMessage,
    context,
  });

  try {
    return await insertAuditEvent({
      entityType,
      entityId,
      action,
      actorUserId,
      actorRole,
      requestId,
      oldValue: normalized.oldValue,
      newValue: normalized.newValue,
      metadata: normalized.metadata,
      errorCode: normalized.errorCode,
      errorMessage: normalized.errorMessage,
      context: normalized.context,
      client,
    });
  } catch (error) {
    logAuditWriteFailure({
      entityType,
      entityId,
      action,
      error,
    });
    return null;
  }
}

export async function logAuditError({
  entityType,
  entityId,
  action,
  actorUserId = null,
  actorRole = null,
  requestId = null,
  metadata = null,
  error = null,
  errorCode = null,
  errorMessage = null,
  context = null,
  client = null,
}) {
  const resolvedErrorCode =
    errorCode ??
    (error?.name === 'ApiError' && typeof error?.code === 'string'
      ? error.code
      : null) ??
    null;
  const resolvedErrorMessage =
    errorMessage ??
    (error?.name === 'ApiError' && typeof error?.message === 'string'
      ? error.message
      : null) ??
    'Operation failed';

  return logAuditEvent({
    entityType,
    entityId,
    action,
    actorUserId,
    actorRole,
    requestId,
    metadata,
    errorCode: resolvedErrorCode,
    errorMessage: resolvedErrorMessage,
    context,
    client,
  });
}

export async function writeAuditEvent(input) {
  return logAuditEvent(input);
}

export async function listAuditEvents(filter = {}, pagination = {}) {
  return listAuditEventsModel(filter, pagination);
}
