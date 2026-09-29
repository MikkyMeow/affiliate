'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { canAccessAdminArea } from '@/lib/auth/roles';
import type { QuestionnaireAnswerItem } from '@/lib/questionnaires';
import { buildTelegramHref } from '@/lib/telegram';

type Advertiser = {
  id: string;
  publicId: string | null;
  publicIdNumber: number | null;
  name: string;
  email: string | null;
  status: 'active' | 'inactive';
  telegram: string | null;
  internalNote: string | null;
  questionnaireAnswers: QuestionnaireAnswerItem[];
  managerUserId: string | null;
  manager: {
    id: string;
    displayName: string | null;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type ManagerOption = {
  id: string;
  displayName: string | null;
  email: string | null;
};

type FieldErrors = Partial<Record<'name' | 'form', string>>;

type TemporaryPasswordState = {
  advertiserId: string;
  name: string;
  email: string | null;
  temporaryPassword: string;
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

export default function EditAdvertiserPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const advertiserIdParam = params?.id;
  const advertiserId = Array.isArray(advertiserIdParam)
    ? advertiserIdParam[0]
    : advertiserIdParam;

  const { user, accessToken, loading: authLoading } = useAuth();
  const [form, setForm] = useState<{ name: string; status: 'active' | 'inactive' }>({
    name: '',
    status: 'active',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [advertiserPublicId, setAdvertiserPublicId] = useState<string | null>(null);
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [managerSubmitting, setManagerSubmitting] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [managerSuccess, setManagerSuccess] = useState<string | null>(null);
  const [advertiserDetails, setAdvertiserDetails] = useState<Advertiser | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [internalNoteSubmitting, setInternalNoteSubmitting] = useState(false);
  const [internalNoteMessage, setInternalNoteMessage] = useState<string | null>(null);
  const telegramHref = buildTelegramHref(advertiserDetails?.telegram);
  const activeQuestionnaireAnswers =
    advertiserDetails?.questionnaireAnswers?.filter((item) => !item.isFallback) ?? [];
  const fallbackQuestionnaireAnswers =
    advertiserDetails?.questionnaireAnswers?.filter((item) => item.isFallback) ?? [];
  const [temporaryPasswordState, setTemporaryPasswordState] =
    useState<TemporaryPasswordState | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? `/dashboard/advertisers/${advertiserId ?? ''}/edit`);
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname, advertiserId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!accessToken) {
      setInitialLoading(false);
      return;
    }

    if (!advertiserId) {
      setLoadError('Не указан рекламодатель');
      setInitialLoading(false);
      return;
    }

    let active = true;
    setInitialLoading(true);
    setLoadError(null);

    Promise.all([
      apiFetch<{ advertiser: Advertiser }>(`/advertisers/${advertiserId}`, {
        token: accessToken,
      }),
      apiFetch<{ items: ManagerOption[] }>('/admin/managers/lookup', {
        token: accessToken,
      }),
    ])
      .then(([{ advertiser }, lookup]) => {
        if (!active) {
          return;
        }
        setAdvertiserPublicId(advertiser.publicId ?? null);
        setAdvertiserDetails(advertiser);
        setForm({ name: advertiser.name, status: advertiser.status });
        setSelectedManagerId(advertiser.managerUserId ?? '');
        setInternalNote(advertiser.internalNote ?? '');
        setManagerOptions(lookup.items);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        const message =
          (error as { message?: string } | null)?.message ??
          'Не удалось загрузить рекламодателя';
        setLoadError(message);
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setInitialLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, advertiserId, authLoading]);

  const isFormValid = useMemo(() => {
    return form.name.trim().length > 0 && ['active', 'inactive'].includes(form.status);
  }, [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    if (!accessToken || !advertiserId) {
      setErrors({ form: 'Нет доступа для редактирования' });
      return;
    }

    const normalizedName = form.name.trim();
    if (!normalizedName) {
      setErrors({ name: 'Введите название' });
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(`/advertisers/${advertiserId}`, {
        method: 'PATCH',
        token: accessToken,
        body: JSON.stringify({ name: normalizedName, status: form.status }),
      });
      router.push('/dashboard/advertisers');
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ??
        'Не удалось обновить рекламодателя';
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleManagerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManagerError(null);
    setManagerSuccess(null);

    if (!accessToken || !advertiserId) {
      setManagerError('Нет доступа для редактирования');
      return;
    }

    setManagerSubmitting(true);

    try {
      const response = await apiFetch<{ advertiser: Advertiser }>(
        `/advertisers/${advertiserId}/manager`,
        {
          method: 'PATCH',
          token: accessToken,
          body: JSON.stringify({
            managerUserId: selectedManagerId || null,
          }),
        },
      );
      setAdvertiserDetails(response.advertiser);
      setSelectedManagerId(response.advertiser.managerUserId ?? '');
      setManagerSuccess('Ответственный менеджер обновлён');
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ??
        'Не удалось обновить ответственного менеджера';
      setManagerError(message);
    } finally {
      setManagerSubmitting(false);
    }
  };

  const handleInternalNoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInternalNoteMessage(null);

    if (!accessToken || !advertiserId) {
      setInternalNoteMessage('Нет доступа для редактирования');
      return;
    }

    setInternalNoteSubmitting(true);

    try {
      const response = await apiFetch<{ advertiser: { id: string; internalNote: string | null } }>(
        `/advertisers/${advertiserId}/internal-note`,
        {
          method: 'PATCH',
          token: accessToken,
          body: JSON.stringify({ internalNote: internalNote.trim() || null }),
        },
      );
      setInternalNote(response.advertiser.internalNote ?? '');
      setAdvertiserDetails((current) =>
        current
          ? { ...current, internalNote: response.advertiser.internalNote ?? null }
          : current,
      );
      setInternalNoteMessage('Приватная информация сохранена');
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ??
        'Не удалось сохранить приватную информацию';
      setInternalNoteMessage(message);
    } finally {
      setInternalNoteSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!accessToken || !advertiserId || !advertiserDetails) {
      return;
    }

    setResettingPassword(true);
    setCopyMessage(null);

    try {
      const response = await apiFetch<{ temporaryPassword: string }>(
        `/advertisers/${advertiserId}/reset-password`,
        {
          method: 'POST',
          token: accessToken,
        },
      );

      setTemporaryPasswordState({
        advertiserId,
        name: advertiserDetails.name,
        email: advertiserDetails.email ?? null,
        temporaryPassword: response.temporaryPassword,
      });
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ??
        'Не удалось сбросить пароль рекламодателя';
      setInternalNoteMessage(message);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!temporaryPasswordState) {
      return;
    }

    try {
      await copyToClipboard(temporaryPasswordState.temporaryPassword);
      setCopyMessage('Пароль скопирован');
    } catch {
      setCopyMessage('Не удалось скопировать пароль');
    }
  };

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию...</p>
      </section>
    );
  }

  if (!user || !accessToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите, чтобы редактировать рекламодателя.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={authLinks.login}
            className="ui-button rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Войти
          </Link>
          <Link
            href={authLinks.register}
            className="ui-button rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Зарегистрироваться
          </Link>
        </div>
      </section>
    );
  }

  if (!canAccessAdminArea(user)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Редактировать рекламодателей могут только администраторы и менеджеры.
        </p>
        <Link
          href="/"
          className="ui-button rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          На главную
        </Link>
      </section>
    );
  }

  if (initialLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-zinc-500">Загружаем данные рекламодателя...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Ошибка
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link
          href="/dashboard/advertisers"
          className="ui-button rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          К списку
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Управление</p>
        <h1 className="text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
          Редактировать рекламодателя
        </h1>
        {advertiserPublicId && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {advertiserPublicId}
          </p>
        )}
      </div>

      <div className="mb-6">
        <Link
          href="/dashboard/advertisers"
          className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-300"
        >
          ← Назад к списку
        </Link>
      </div>

      <div className="mb-6 grid gap-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-2">
        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Информация о рекламодателе</p>
          <p>
            <span className="text-zinc-500">Email:</span> {advertiserDetails?.email ?? '—'}
          </p>
          <p>
            <span className="text-zinc-500">Telegram:</span>{' '}
            {telegramHref ? (
              <a
                href={telegramHref}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                {telegramHref.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              '—'
            )}
          </p>
          <p>
            <span className="text-zinc-500">Ответственный менеджер:</span>{' '}
            {advertiserDetails?.manager
              ? `${advertiserDetails.manager.displayName ?? 'Без имени'} · ${advertiserDetails.manager.email ?? '—'}`
              : 'Не назначен'}
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-wide text-zinc-500">Ответы анкеты</p>
          {activeQuestionnaireAnswers.length > 0 ? (
            <div className="space-y-3">
              {activeQuestionnaireAnswers.map((item, index) => (
                <div
                  key={`${item.question}-${index}`}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{item.question}</p>
                  <p className="mt-2">{item.answer}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Анкета ещё не заполнена</p>
          )}

          {fallbackQuestionnaireAnswers.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Сохранённые ответы
              </p>
              {fallbackQuestionnaireAnswers.map((item, index) => (
                <div
                  key={`${item.question}-fallback-${index}`}
                  className="rounded-xl border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <p className="text-xs uppercase tracking-wide text-zinc-500">{item.question}</p>
                  <p className="mt-2">{item.answer}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="name">
            Название
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value.slice(0, 200) }))
            }
            placeholder="Например, ACME Corp"
            className="ui-input min-w-0 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
          {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="status">
            Статус
          </label>
          <select
            id="status"
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                status: event.target.value === 'inactive' ? 'inactive' : 'active',
              }))
            }
            className="ui-input min-w-0 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
          >
            <option value="active">Активен</option>
            <option value="inactive">Неактивен</option>
          </select>
        </div>

        {errors.form && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
            {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !isFormValid}
          className="ui-button w-full rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          {submitting ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
      </form>

      <form
        onSubmit={handleManagerSubmit}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Ответственный менеджер
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Ответственный менеджер
          </h2>
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            htmlFor="advertiser-manager"
          >
            Менеджер
          </label>
          <select
            id="advertiser-manager"
            value={selectedManagerId}
            onChange={(event) => setSelectedManagerId(event.target.value)}
            className="ui-input min-w-0 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
          >
            <option value="">Не назначен</option>
            {managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.displayName ?? manager.email ?? manager.id}
              </option>
            ))}
          </select>
        </div>

        {managerSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-200">
            {managerSuccess}
          </div>
        )}

        {managerError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
            {managerError}
          </div>
        )}

        <button
          type="submit"
          disabled={managerSubmitting}
          className="ui-button w-full rounded-full border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {managerSubmitting ? 'Сохраняем…' : 'Сохранить менеджера'}
        </button>
      </form>

      <form
        onSubmit={handleInternalNoteSubmit}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">Внутренняя заметка</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Видна только администраторам и менеджерам
          </p>
        </div>
        <textarea
          value={internalNote}
          onChange={(event) => setInternalNote(event.target.value)}
          rows={6}
          placeholder="Внутренняя заметка для команды сети"
          className="ui-input min-w-0 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
        />
        {internalNoteMessage ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{internalNoteMessage}</p>
        ) : null}
        <button
          type="submit"
          disabled={internalNoteSubmitting}
          className="ui-button rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          {internalNoteSubmitting ? 'Сохраняем…' : 'Сохранить приватную информацию'}
        </button>
      </form>

      <div className="mt-6 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-8 dark:border-amber-700/40 dark:bg-amber-950/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Доступ рекламодателя
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              Администратор может сгенерировать новый временный пароль. Старый пароль перестанет работать.
            </p>
          </div>
          {user && user.role === 'admin' ? (
            <button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={resettingPassword}
              className="ui-button rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
            >
              {resettingPassword ? 'Сбрасываем…' : 'Сбросить пароль'}
            </button>
          ) : null}
        </div>

        {temporaryPasswordState ? (
          <div className="space-y-3 rounded-2xl border border-amber-300 bg-white p-5 dark:border-amber-600 dark:bg-zinc-950">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Рекламодатель: {temporaryPasswordState.name}
              {temporaryPasswordState.email ? ` · ${temporaryPasswordState.email}` : ''}
            </p>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              {temporaryPasswordState.temporaryPassword}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleCopyPassword()}
                className="ui-button rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
              >
                Скопировать пароль
              </button>
              {copyMessage ? (
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                  {copyMessage}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Пароль показывается только один раз и не хранится в открытом виде.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
