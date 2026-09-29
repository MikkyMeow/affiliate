'use client';

import type { AuditLogItem } from '@/lib/audit-logs';
import { getRoleLabel } from '@/lib/auth/roles';
import type { UserRole } from '@/context/AuthContext';

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function summarizeValue(value: unknown, maxLength = 140) {
  const text = stringifyValue(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}…`;
}

function JsonCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-zinc-400">—</span>;
  }

  const summary = summarizeValue(value);
  const full = stringifyValue(value);

  if (summary === full) {
    return (
      <pre className="max-w-xs whitespace-pre-wrap break-all text-xs text-zinc-700 dark:text-zinc-200">
        {full}
      </pre>
    );
  }

  return (
    <details className="max-w-xs">
      <summary className="cursor-pointer list-none text-xs text-zinc-700 dark:text-zinc-200">
        <span className="inline-block break-all rounded-lg bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
          {summary}
        </span>
      </summary>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-zinc-950 p-3 text-xs text-zinc-100">
        {full}
      </pre>
    </details>
  );
}

function formatActor(item: AuditLogItem) {
  if (!item.actor) {
    return item.actorRole ? getRoleLabel(item.actorRole as UserRole) : 'Система';
  }

  const primary = item.actor.name ?? item.actor.email ?? item.actor.id;
  const secondary = item.actor.email && item.actor.email !== primary
    ? item.actor.email
    : item.actor.role ? getRoleLabel(item.actor.role as UserRole) : null;

  return (
    <div className="space-y-1">
      <div className="font-medium text-zinc-900 dark:text-zinc-50">{primary}</div>
      {secondary ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">{secondary}</div>
      ) : null}
    </div>
  );
}

export function AuditLogTable({
  items,
  loading,
  error,
  emptyMessage = 'Записей пока нет.',
}: {
  items: AuditLogItem[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
}) {
  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Загружаем журнал действий…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="ui-table-wrap rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
          <tr>
            <th className="px-4 py-3 font-medium">Дата</th>
            <th className="px-4 py-3 font-medium">Пользователь</th>
            <th className="px-4 py-3 font-medium">Действие</th>
            <th className="px-4 py-3 font-medium">До изменения</th>
            <th className="px-4 py-3 font-medium">После изменения</th>
            <th className="px-4 py-3 font-medium">Ошибка</th>
            <th className="px-4 py-3 font-medium">Подробности</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => (
            <tr
              key={item.id}
              className={
                item.errorCode
                  ? 'bg-red-50/50 dark:bg-red-500/5'
                  : 'bg-white dark:bg-zinc-950'
              }
            >
              <td className="px-4 py-3 align-top text-xs text-zinc-600 dark:text-zinc-300">
                <div>{new Date(item.createdAt).toLocaleString('ru-RU')}</div>
                <div className="mt-1 text-[11px] text-zinc-400">{item.entityType}</div>
                <div className="mt-1 font-mono text-[11px] text-zinc-400">
                  {item.entityId}
                </div>
              </td>
              <td className="px-4 py-3 align-top">{formatActor(item)}</td>
              <td className="px-4 py-3 align-top">
                <div className="font-mono text-xs text-zinc-700 dark:text-zinc-200">
                  {item.action}
                </div>
              </td>
              <td className="px-4 py-3 align-top">
                <JsonCell value={item.oldValue} />
              </td>
              <td className="px-4 py-3 align-top">
                <JsonCell value={item.newValue} />
              </td>
              <td className="px-4 py-3 align-top">
                {item.errorCode || item.errorMessage ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
                    {item.errorCode ? <div className="font-semibold">{item.errorCode}</div> : null}
                    {item.errorMessage ? <div>{item.errorMessage}</div> : null}
                  </div>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 align-top">
                <JsonCell value={item.metadata} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
