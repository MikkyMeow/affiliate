'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { InlineAlert } from '@/components/InlineAlert';
import { canAccessAdminArea, isAdminRole } from '@/lib/auth/roles';

type Manager = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'manager';
  createdAt: string;
  updatedAt: string;
};

type ManagersMeta = {
  total: number;
  limit: number;
  offset: number;
};

type ManagerFormState = {
  displayName: string;
  email: string;
};

type TemporaryPasswordState = {
  managerId: string;
  displayName: string | null;
  email: string;
  temporaryPassword: string;
  source: 'create' | 'reset';
};

const EMPTY_FORM: ManagerFormState = {
  displayName: '',
  email: '',
};

async function copyToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is unavailable');
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function ManagersPage() {
  const pathname = usePathname();
  const { user, accessToken, loading: authLoading } = useAuth();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [meta, setMeta] = useState<ManagersMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createForm, setCreateForm] = useState<ManagerFormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ManagerFormState>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [temporaryPasswordState, setTemporaryPasswordState] =
    useState<TemporaryPasswordState | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [resettingManagerId, setResettingManagerId] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/managers');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const selectedManager = useMemo(
    () => managers.find((manager) => manager.id === selectedManagerId) ?? null,
    [managers, selectedManagerId],
  );

  useEffect(() => {
    if (!selectedManager) {
      setEditForm(EMPTY_FORM);
      return;
    }

    setEditForm({
      displayName: selectedManager.displayName ?? '',
      email: selectedManager.email,
    });
    setEditError(null);
    setDeleteError(null);
  }, [selectedManager]);

  const loadManagers = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<Manager[], ManagersMeta>(
        `/admin/managers?limit=20${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`,
        {
          token: accessToken,
          withMeta: true,
        },
      );

      setManagers(response.data);
      setMeta(response.meta);

      setSelectedManagerId((currentId) => {
        if (!currentId) {
          return response.data[0]?.id ?? null;
        }

        return response.data.some((manager) => manager.id === currentId)
          ? currentId
          : response.data[0]?.id ?? null;
      });
    } catch (requestError) {
      const apiError = requestError as ApiError;
      setError(apiError.message ?? 'Не удалось загрузить менеджеров');
      setManagers([]);
      setMeta(null);
      setSelectedManagerId(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, searchQuery]);

  useEffect(() => {
    if (authLoading || !accessToken || !user || !isAdminRole(user.role)) {
      return;
    }

    void loadManagers();
  }, [accessToken, authLoading, loadManagers, user]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    setCreateSubmitting(true);
    setCreateError(null);
    setCopyState('idle');

    try {
      const response = await apiFetch<{
        manager: Manager;
        temporaryPassword: string;
      }>('/admin/managers', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({
          displayName: createForm.displayName,
          email: createForm.email,
        }),
      });

      setCreateForm(EMPTY_FORM);
      setTemporaryPasswordState({
        managerId: response.manager.id,
        displayName: response.manager.displayName,
        email: response.manager.email,
        temporaryPassword: response.temporaryPassword,
        source: 'create',
      });

      await loadManagers();
      setSelectedManagerId(response.manager.id);
    } catch (requestError) {
      setCreateError((requestError as Error).message ?? 'Не удалось создать менеджера');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !selectedManager) {
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    try {
      await apiFetch<{ manager: Manager }>(`/admin/managers/${selectedManager.id}`, {
        method: 'PATCH',
        token: accessToken,
        body: JSON.stringify(editForm),
      });

      await loadManagers();
    } catch (requestError) {
      setEditError((requestError as Error).message ?? 'Не удалось обновить менеджера');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleResetPassword = async (manager: Manager) => {
    if (!accessToken) {
      return;
    }

    setResettingManagerId(manager.id);
    setCopyState('idle');

    try {
      const response = await apiFetch<{ temporaryPassword: string }>(
        `/admin/managers/${manager.id}/reset-password`,
        {
          method: 'POST',
          token: accessToken,
        },
      );

      setTemporaryPasswordState({
        managerId: manager.id,
        displayName: manager.displayName,
        email: manager.email,
        temporaryPassword: response.temporaryPassword,
        source: 'reset',
      });
    } catch (requestError) {
      setError((requestError as Error).message ?? 'Не удалось сбросить пароль');
    } finally {
      setResettingManagerId(null);
    }
  };

  const handleCopyPassword = async () => {
    if (!temporaryPasswordState) {
      return;
    }

    try {
      await copyToClipboard(temporaryPasswordState.temporaryPassword);
      setCopyState('copied');
    } catch (copyError) {
      console.warn('Не удалось скопировать временный пароль', copyError);
      setCopyState('error');
    }
  };

  const handleDeleteManager = async () => {
    if (!accessToken || !selectedManager) {
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      await apiFetch<{ ok: true }>(`/admin/managers/${selectedManager.id}`, {
        method: 'DELETE',
        token: accessToken,
      });

      if (temporaryPasswordState?.managerId === selectedManager.id) {
        setTemporaryPasswordState(null);
        setCopyState('idle');
      }

      setDeleteModalOpen(false);
      await loadManagers();
    } catch (requestError) {
      setDeleteError((requestError as Error).message ?? 'Не удалось удалить менеджера');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию...</p>
      </section>
    );
  }

  if (!user || !accessToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите, чтобы управлять менеджерами.
        </p>
        <div className="flex gap-3">
          <Link
            href={authLinks.login}
            className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Войти
          </Link>
          <Link
            href={authLinks.register}
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    );
  }

  if (!canAccessAdminArea(user)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Раздел менеджеров доступен только администраторам.
        </p>
      </section>
    );
  }

  if (!isAdminRole(user.role)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Менеджеры не могут создавать, изменять или сбрасывать пароли менеджеров.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Менеджеры
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Создавайте внутренних пользователей с ролью manager и передавайте пароль
            только один раз.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearchQuery(searchInput.trim());
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск по имени или email"
            className="w-72 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Найти
          </button>
        </form>
      </div>

      {temporaryPasswordState ? (
        <div className="mb-6">
          <InlineAlert
            variant="warning"
            title={
              temporaryPasswordState.source === 'create'
                ? 'Временный пароль создан'
                : 'Временный пароль сброшен'
            }
          >
            <div className="space-y-3">
              <p>
                Пользователь: {temporaryPasswordState.displayName ?? 'Без имени'} ·{' '}
                {temporaryPasswordState.email}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-lg bg-black px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-black">
                  {temporaryPasswordState.temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyPassword()}
                  className="rounded-full border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-400/50 dark:text-amber-100 dark:hover:bg-amber-500/10"
                >
                  {copyState === 'copied'
                    ? 'Скопировано'
                    : copyState === 'error'
                      ? 'Ошибка копирования'
                      : 'Скопировать'}
                </button>
              </div>
              <p>
                Этот пароль показывается только сейчас. После обновления страницы он
                больше не будет доступен.
              </p>
            </div>
          </InlineAlert>
        </div>
      ) : null}

      {error ? (
        <div className="mb-6">
          <InlineAlert variant="error" title="Ошибка">
            {error}
          </InlineAlert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Список менеджеров
            </h2>
            <span className="text-sm text-zinc-500">
              {loading
                ? 'Загружаем...'
                : `${meta?.total ?? managers.length} шт.`}
            </span>
          </div>

          {managers.length === 0 && !loading ? (
            <div className="px-6 py-10 text-center text-sm text-zinc-500">
              Менеджеры пока не созданы.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                  <tr>
                    <th className="px-6 py-3 font-medium">Имя</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Создан</th>
                    <th className="px-6 py-3 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {managers.map((manager) => {
                    const isSelected = manager.id === selectedManagerId;
                    return (
                      <tr
                        key={manager.id}
                        className={`transition ${
                          isSelected
                            ? 'bg-amber-50/70 dark:bg-amber-500/10'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                        }`}
                      >
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-50">
                          {manager.displayName ?? 'Без имени'}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                          {manager.email}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                          {new Date(manager.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedManagerId(manager.id)}
                              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleResetPassword(manager)}
                              disabled={resettingManagerId === manager.id}
                              className="rounded-full border border-amber-300 px-4 py-2 text-xs font-medium text-amber-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-400/50 dark:text-amber-100 dark:hover:bg-amber-500/10"
                            >
                              {resettingManagerId === manager.id
                                ? 'Сбрасываем…'
                                : 'Сбросить пароль'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Создать менеджера
            </h2>
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Имя
                <input
                  type="text"
                  required
                  value={createForm.displayName}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Email
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              {createError ? (
                <InlineAlert variant="error">{createError}</InlineAlert>
              ) : null}
              <button
                type="submit"
                disabled={createSubmitting}
                className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-black"
              >
                {createSubmitting ? 'Создаём…' : 'Создать менеджера'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Редактирование
            </h2>
            {!selectedManager ? (
              <p className="mt-4 text-sm text-zinc-500">
                Выберите менеджера из списка, чтобы обновить имя или email.
              </p>
            ) : (
              <form onSubmit={handleUpdate} className="mt-5 space-y-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Имя
                  <input
                    type="text"
                    required
                    value={editForm.displayName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Email
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                {editError ? <InlineAlert variant="error">{editError}</InlineAlert> : null}
                {deleteError ? <InlineAlert variant="error">{deleteError}</InlineAlert> : null}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    {editSubmitting ? 'Сохраняем…' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteModalOpen(true);
                    }}
                    className="rounded-full border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/10"
                  >
                    Удалить менеджера
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {deleteModalOpen && selectedManager ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Подтверждение
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Удалить менеджера?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Будет удалён пользователь{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {selectedManager.displayName ?? 'Без имени'}
              </span>{' '}
              с email{' '}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {selectedManager.email}
              </span>
              . Действие нельзя отменить.
            </p>
            {deleteError ? (
              <div className="mt-4">
                <InlineAlert variant="error">{deleteError}</InlineAlert>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (deleteSubmitting) {
                    return;
                  }
                  setDeleteModalOpen(false);
                  setDeleteError(null);
                }}
                className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteManager()}
                disabled={deleteSubmitting}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deleteSubmitting ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
