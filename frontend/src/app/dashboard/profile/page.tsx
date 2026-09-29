'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { HelpLink } from '@/features/docs/HelpLink';
import { docsHelpLinks } from '@/features/docs/docs-help-links';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/toast';
import { apiFetch } from '@/lib/api';
import { canAccessAdminArea, getRoleLabel } from '@/lib/auth/roles';
import { getAvailableTimeZones, getPreferredTimeZone } from '@/lib/dashboard';

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
  const { user, accessToken, loading: authLoading, refreshProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState<PasswordFormState>(EMPTY_FORM);
  const [timezone, setTimezone] = useState(user?.timezone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [savingTimezone, setSavingTimezone] = useState(false);

  const roleLabel = useMemo(
    () => (user ? getRoleLabel(user.role) : null),
    [user],
  );
  const systemTimeZone = useMemo(() => getPreferredTimeZone(), []);
  const timeZones = useMemo(() => getAvailableTimeZones(), []);

  useEffect(() => {
    setTimezone(user?.timezone ?? '');
  }, [user?.timezone]);

  const handleTimezoneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    setSavingTimezone(true);

    try {
      await apiFetch('/profile', {
        method: 'PATCH',
        token: accessToken,
        body: JSON.stringify({ timezone: timezone || null }),
      });
      await refreshProfile();
      toast.info({ title: 'Часовой пояс обновлён' });
    } catch (requestError) {
      toast.error({
        title: 'Не удалось обновить часовой пояс',
        description:
          (requestError as Error).message ?? 'Попробуйте повторить позже.',
        persistent: true,
      });
    } finally {
      setSavingTimezone(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast.warning({
        title: 'Пароли не совпадают',
        description: 'Подтверждение пароля должно совпадать с новым паролем.',
      });
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
      toast.success({ title: 'Пароль обновлён' });
    } catch (requestError) {
      toast.error({
        title: 'Не удалось обновить пароль',
        description:
          (requestError as Error).message ?? 'Попробуйте повторить позже.',
        persistent: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию...</p>
      </section>
    );
  }

  if (!user || !accessToken || !canAccessAdminArea(user)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Профиль в разделе управления доступен только администраторам и менеджерам.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 space-y-2">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Управление</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
            Мой профиль
          </h1>
          <HelpLink href={docsHelpLinks.adminProfile} />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Здесь можно проверить текущую учётную запись, выбрать часовой пояс и сменить пароль.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
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
                <dt className="text-zinc-500 dark:text-zinc-400">Эл. почта</dt>
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

          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Часовой пояс
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <form onSubmit={handleTimezoneSubmit} className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                По умолчанию используется часовой пояс системы. При необходимости его можно переопределить вручную.
              </p>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Часовой пояс
                <select
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="ui-input min-w-0 mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="">
                    Системный ({systemTimeZone})
                  </option>
                  {timeZones.map((timeZoneOption) => (
                    <option key={timeZoneOption.value} value={timeZoneOption.value}>
                      {timeZoneOption.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={savingTimezone}
                className="ui-button rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-black"
              >
                {savingTimezone ? 'Сохраняем…' : 'Сохранить часовой пояс'}
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
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
                className="ui-input min-w-0 mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
                className="ui-input min-w-0 mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
                className="ui-input min-w-0 mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="ui-button rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-black"
            >
              {submitting ? 'Обновляем…' : 'Изменить пароль'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
