'use client';

import { useEffect, useId, useState } from 'react';
import { fetchEntityAuditLogs, type AuditLogItem } from '@/lib/audit-logs';
import { type ApiError } from '@/lib/api';
import { AuditLogTable } from './AuditLogTable';
import { useDialog } from '@/hooks/useDialog';

const DEFAULT_LIMIT = 10;

function AuditLogsModalContent({
  onClose,
  token,
  entityType,
  entityId,
  title,
}: {
  onClose: () => void;
  token: string;
  entityType: string;
  entityId: string;
  title?: string;
}) {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorOnly, setErrorOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const dialogRef = useDialog(true, onClose);

  useEffect(() => {
    let active = true;

    fetchEntityAuditLogs(token, entityType, entityId, {
      page,
      limit: DEFAULT_LIMIT,
      errorOnly,
    })
      .then((response) => {
        if (!active) {
          return;
        }

        setItems(response.items);
        setTotalPages(response.totalPages);
        setTotal(response.total);
        setError(null);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }

        setItems([]);
        setTotalPages(0);
        setTotal(0);
        setError(
          (requestError as ApiError).message ?? 'Не удалось загрузить журнал действий',
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [entityId, entityType, errorOnly, page, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 sm:p-6" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:px-6 sm:py-5 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {title ?? 'Журнал действий'}
            </h2>
            <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
              ID: {entityId}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={errorOnly}
                onChange={(event) => {
                  setErrorOnly(event.target.checked);
                  setPage(1);
                  setLoading(true);
                }}
              />
              Только ошибки
            </label>
            <button
              type="button"
              onClick={onClose}
              className="ui-button rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="min-h-0 space-y-4 overflow-auto overscroll-contain p-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{loading ? 'Загружаем…' : `Всего записей: ${total}`}</span>
            <span>
              Страница {page} из {Math.max(totalPages, 1)}
            </span>
          </div>

          <AuditLogTable
            items={items}
            loading={loading}
            error={error}
            emptyMessage="Действий с этим объектом пока нет."
          />

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPage((current) => Math.max(current - 1, 1));
                setLoading(true);
              }}
              disabled={loading || page <= 1}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() => {
                setPage((current) =>
                  totalPages > 0 ? Math.min(current + 1, totalPages) : current + 1,
                );
                setLoading(true);
              }}
              disabled={loading || page >= Math.max(totalPages, 1)}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Вперёд
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuditLogsModal({
  open,
  onClose,
  token,
  entityType,
  entityId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  entityType: string;
  entityId: string;
  title?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <AuditLogsModalContent
      key={`${entityType}:${entityId}`}
      onClose={onClose}
      token={token}
      entityType={entityType}
      entityId={entityId}
      title={title}
    />
  );
}
