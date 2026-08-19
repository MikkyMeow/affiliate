import { apiFetch } from './api';

export type AuditLogActor = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

export type AuditLogItem = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actor: AuditLogActor | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  metadata: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export type AuditLogsResponse = {
  items: AuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AuditLogsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  errorOnly?: boolean;
};

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | undefined,
) {
  if (value === undefined) {
    return;
  }

  if (typeof value === 'boolean') {
    params.set(key, value ? 'true' : 'false');
    return;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return;
  }

  params.set(key, normalized);
}

export function buildAuditLogsQuery(query: AuditLogsQuery = {}) {
  const params = new URLSearchParams();

  appendParam(params, 'page', query.page);
  appendParam(params, 'limit', query.limit);
  appendParam(params, 'search', query.search);
  appendParam(params, 'action', query.action);
  appendParam(params, 'entityType', query.entityType);
  appendParam(params, 'entityId', query.entityId);
  appendParam(params, 'actorId', query.actorId);
  appendParam(params, 'dateFrom', query.dateFrom);
  appendParam(params, 'dateTo', query.dateTo);

  if (query.errorOnly) {
    appendParam(params, 'errorOnly', true);
  }

  return params.toString();
}

export async function fetchAuditLogs(
  token: string,
  query: AuditLogsQuery = {},
) {
  const search = buildAuditLogsQuery(query);
  const path = search ? `/admin/audit-logs?${search}` : '/admin/audit-logs';
  return apiFetch<AuditLogsResponse>(path, { token });
}

export async function fetchEntityAuditLogs(
  token: string,
  entityType: string,
  entityId: string,
  query: AuditLogsQuery = {},
) {
  const search = buildAuditLogsQuery(query);
  const basePath = `/admin/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`;
  const path = search ? `${basePath}?${search}` : basePath;
  return apiFetch<AuditLogsResponse>(path, { token });
}
