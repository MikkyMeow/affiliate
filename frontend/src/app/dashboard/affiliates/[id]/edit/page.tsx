'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';

type Affiliate = {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

type FieldErrors = Partial<Record<'name' | 'email' | 'form', string>>;

export default function EditAffiliatePage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const affiliateIdParam = params?.id;
  const affiliateId = Array.isArray(affiliateIdParam) ? affiliateIdParam[0] : affiliateIdParam;

  const { user, accessToken, loading: authLoading } = useAuth();
  const [form, setForm] = useState<{ name: string; email: string; status: 'active' | 'inactive' }>(
    {
      name: '',
      email: '',
      status: 'active',
    },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? `/dashboard/affiliates/${affiliateId ?? ''}/edit`);
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname, affiliateId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!accessToken) {
      setInitialLoading(false);
      return;
    }

    if (!affiliateId) {
      setLoadError('Не указан аффилиат');
      setInitialLoading(false);
      return;
    }

    let active = true;
    setInitialLoading(true);
    setLoadError(null);

    apiFetch<{ affiliate: Affiliate }>(`/api/v1/affiliates/${affiliateId}`, {
      token: accessToken,
    })
      .then(({ affiliate }) => {
        if (!active) {
          return;
        }
        setForm({ name: affiliate.name, email: affiliate.email, status: affiliate.status });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        const message =
          (error as { message?: string } | null)?.message ?? 'Не удалось загрузить аффилиата';
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
  }, [accessToken, affiliateId, authLoading]);

  const isFormValid = useMemo(() => {
    const hasName = form.name.trim().length > 0;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    return hasName && hasEmail && ['active', 'inactive'].includes(form.status);
  }, [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    if (!accessToken || !affiliateId) {
      setErrors({ form: 'Нет доступа для редактирования' });
      return;
    }

    const normalizedName = form.name.trim();
    const normalizedEmail = form.email.trim().toLowerCase();

    if (!normalizedName) {
      setErrors({ name: 'Введите имя или название' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setErrors({ email: 'Введите корректный email' });
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(`/api/v1/affiliates/${affiliateId}`, {
        method: 'PATCH',
        token: accessToken,
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          status: form.status,
        }),
      });
      router.push('/dashboard/affiliates');
    } catch (error) {
      const message =
        (error as { message?: string } | null)?.message ?? 'Не удалось обновить аффилиата';
      setErrors({ form: message });
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

  if (!user || !accessToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите, чтобы редактировать аффилиата.
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

  if (initialLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Загружаем данные аффилиата...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Ошибка</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link
          href="/dashboard/affiliates"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          К списку
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Редактировать аффилиата
        </h1>
      </div>

      <div className="mb-6">
        <Link
          href="/dashboard/affiliates"
          className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-300"
        >
          ← Назад к списку
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="name">
            Имя / название
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value.slice(0, 200) }))
            }
            placeholder="Например, Affiliate Team #1"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
          {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value.slice(0, 200) }))
            }
            placeholder="contact@example.com"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
          {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
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
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
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
          className="w-full rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
        >
          {submitting ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
      </form>
    </section>
  );
}
