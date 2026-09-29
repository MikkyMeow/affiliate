'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { canAccessAdminArea, isAdminRole } from '@/lib/auth/roles';

type FormState = {
  name: string;
  email: string;
  status: 'active' | 'inactive';
};

type CreateResponse = {
  advertiser: {
    id: string;
    publicId: string | null;
    name: string;
    email: string | null;
  };
  temporaryPassword: string;
};

export default function CreateAdvertiserPage() {
  const pathname = usePathname();
  const { user, accessToken, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    status: 'active',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/advertisers/create');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCopyMessage(null);

    if (!accessToken) {
      setError('Нет токена авторизации');
      return;
    }

    setSubmitting(true);

    try {
      const created = await apiFetch<CreateResponse>('/advertisers', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          status: form.status,
        }),
      });
      setResult(created);
      setForm({ name: '', email: '', status: 'active' });
    } catch (submitError) {
      setError(
        (submitError as { message?: string } | null)?.message ??
          'Не удалось создать рекламодателя',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.temporaryPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
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
          Войдите, чтобы создавать рекламодателей.
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

  if (!canAccessAdminArea(user) || !isAdminRole(user.role)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Создавать рекламодателей может только администратор.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Управление</p>
        <h1 className="text-2xl font-semibold sm:text-3xl text-zinc-900 dark:text-zinc-50">
          Создать рекламодателя
        </h1>
      </div>

      <div className="mb-6">
        <Link
          href="/dashboard/advertisers"
          className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-300"
        >
          ← Назад к списку
        </Link>
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
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            className="ui-input min-w-0 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="email">
            Эл. почта
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            className="ui-input min-w-0 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
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
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="ui-button w-full rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          {submitting ? 'Создаём…' : 'Создать рекламодателя'}
        </button>
      </form>

      {result ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-8 dark:border-amber-700/40 dark:bg-amber-950/20">
          <div>
            <p className="text-sm uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Временный пароль
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {result.advertiser.publicId
                ? `${result.advertiser.publicId} · ${result.advertiser.name}`
                : result.advertiser.name}
            </h2>
          </div>
          <div className="rounded-xl border border-amber-300 bg-white px-4 py-3 font-mono text-sm text-zinc-900 dark:border-amber-600 dark:bg-zinc-950 dark:text-zinc-100">
            {result.temporaryPassword}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleCopy()}
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
            Пароль показывается только один раз. В базе хранится только его хэш.
          </p>
        </div>
      ) : null}
    </section>
  );
}
