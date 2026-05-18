'use client';

import { useEffect, useState } from 'react';
import { fetchEntityAuditLogs, type AuditLogItem } from '@/lib/audit-logs';
import { type ApiError } from '@/lib/api';
import { AuditLogTable } from './AuditLogTable';

const DEFAULT_LIMIT = 10;

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
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [errorOnly, setErrorOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPage(1);
    setErrorOnly(false);
    setError(null);
  }, [entityId, entityType, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

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
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }

        setItems([]);
        setTotalPages(0);
        setTotal(0);
        setError(
          (requestError as ApiError).message ?? 'Не удалось загрузить audit log',
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [entityId, entityType, errorOnly, open, page, token]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-4 py-8">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-500">Logs</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {title ?? 'Audit log'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {entityType} · {entityId}
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
                }}
              />
              Только ошибки
            </label>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-auto px-6 py-5">
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
            emptyMessage="Для этого объекта логов пока нет."
          />

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={loading || page <= 1}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Назад
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  totalPages > 0 ? Math.min(current + 1, totalPages) : current + 1,
                )
              }
              disabled={loading || (totalPages > 0 && page >= totalPages)}
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
