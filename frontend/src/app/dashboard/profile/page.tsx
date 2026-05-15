'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { InlineAlert } from '@/components/InlineAlert';
import { canAccessAdminArea, getRoleLabel } from '@/lib/auth/roles';

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY_FORM: PasswordFormState = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function DashboardProfilePage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const [form, setForm] = useState<PasswordFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const roleLabel = useMemo(
    () => (user ? getRoleLabel(user.role) : null),
    [user],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    if (form.newPassword !== form.confirmPassword) {
      setError('Подтверждение пароля не совпадает с новым паролем.');
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch<{ ok: true }>('/auth/change-password', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      setForm(EMPTY_FORM);
      setSuccessMessage('Пароль обновлён.');
    } catch (requestError) {
      setError((requestError as Error).message ?? 'Не удалось обновить пароль');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию...</p>
      </section>
    );
  }

  if (!user || !accessToken || !canAccessAdminArea(user)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Профиль в разделе dashboard доступен только администраторам и менеджерам.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-8 space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Мой профиль
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Здесь можно проверить текущую учётную запись и сменить пароль.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Данные пользователя
          </h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Имя</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                {user.displayName ?? 'Без имени'}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Роль</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
                {roleLabel}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Смена пароля
          </h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Текущий пароль
              <input
                type="password"
                required
                value={form.currentPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Новый пароль
              <input
                type="password"
                required
                value={form.newPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Подтверждение нового пароля
              <input
                type="password"
                required
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>

            {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
            {successMessage ? (
              <InlineAlert variant="success">{successMessage}</InlineAlert>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-black"
            >
              {submitting ? 'Обновляем…' : 'Изменить пароль'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
