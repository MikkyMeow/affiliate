'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';

type Offer = {
  id: string;
  title: string;
  targetUrl: string;
  payoutRub: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  title: string;
  targetUrl: string;
  payoutRub: string;
  status: 'active' | 'inactive';
};

type FieldErrors = Partial<Record<keyof FormState | 'form', string>>;

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const offerIdParam = params?.id;
  const offerId = Array.isArray(offerIdParam) ? offerIdParam[0] : offerIdParam;

  const { user, accessToken, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>({
    title: '',
    targetUrl: '',
    payoutRub: '',
    status: 'inactive',
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? `/dashboard/offers/${offerId ?? ''}/edit`);
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname, offerId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!accessToken) {
      setInitialLoading(false);
      return;
    }

    if (!offerId) {
      setLoadError('Не указан оффер');
      setInitialLoading(false);
      return;
    }

    let active = true;
    setInitialLoading(true);
    setLoadError(null);

    apiFetch<{ offer: Offer }>(`/offers/${offerId}`, {
      token: accessToken,
    })
      .then(({ offer }) => {
        if (!active) {
          return;
        }
        setForm({
          title: offer.title,
          targetUrl: offer.targetUrl,
          payoutRub: offer.payoutRub.toString(),
          status: offer.status,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        const message =
          (error as { message?: string } | null)?.message ?? 'Не удалось загрузить оффер';
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
  }, [accessToken, offerId, authLoading]);

  const isFormValid = useMemo(() => {
    const normalizedTitle = form.title.trim();
    const normalizedUrl = form.targetUrl.trim();
    const payoutValue = Number.parseFloat(form.payoutRub.replace(',', '.'));

    return (
      normalizedTitle.length > 0 &&
      /^https?:\/\//i.test(normalizedUrl) &&
      Number.isFinite(payoutValue) &&
      payoutValue > 0 &&
      ['active', 'inactive'].includes(form.status)
    );
  }, [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    if (!accessToken || !offerId) {
      setErrors({ form: 'Нет доступа для редактирования' });
      return;
    }

    const normalizedTitle = form.title.trim();
    if (!normalizedTitle) {
      setErrors({ title: 'Введите название' });
      return;
    }

    const normalizedUrl = form.targetUrl.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      setErrors({ targetUrl: 'Введите корректный URL (http/https)' });
      return;
    }

    const payoutValue = Number.parseFloat(form.payoutRub.replace(',', '.'));
    if (!Number.isFinite(payoutValue) || payoutValue <= 0) {
      setErrors({ payoutRub: 'Введите корректную сумму больше 0' });
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(`/offers/${offerId}`, {
        method: 'PATCH',
        token: accessToken,
        body: JSON.stringify({
          title: normalizedTitle,
          targetUrl: normalizedUrl,
          payoutRub: Number(payoutValue.toFixed(2)),
          status: form.status,
        }),
      });
      router.push('/dashboard/offers');
    } catch (error) {
      const apiError = error as ApiError;

      if (apiError.code === 'VALIDATION_ERROR') {
        const validationErrors =
          (apiError.details as { errors?: Array<{ field?: string; message?: string }> } | null)
            ?.errors ?? [];
        const fieldErrors: FieldErrors = {};

        validationErrors.forEach(({ field, message }) => {
          if (!message) {
            return;
          }

          switch (field) {
            case 'title':
            case 'targetUrl':
            case 'payoutRub':
            case 'status':
              if (!fieldErrors[field]) {
                fieldErrors[field] = message;
              }
              break;
            default:
              fieldErrors.form = message;
          }
        });

        if (Object.keys(fieldErrors).length === 0) {
          fieldErrors.form = apiError.message ?? 'Исправьте ошибки и попробуйте снова';
        }

        setErrors(fieldErrors);
      } else if (apiError.code === 'NOT_FOUND') {
        setErrors({
          form: apiError.message ?? 'Оффер не найден или уже удалён.',
        });
      } else if (apiError.code === 'CONFLICT') {
        setErrors({
          form: apiError.message ?? 'Возник конфликт данных. Попробуйте обновить страницу.',
        });
      } else {
        const message = apiError.message ?? 'Не удалось обновить оффер';
        setErrors({ form: message });
      }
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
          Войдите, чтобы редактировать оффер.
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
        <p className="text-sm text-zinc-500">Загружаем данные оффера...</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Ошибка
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link
          href="/dashboard/offers"
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
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Редактировать оффер</h1>
      </div>

      <div className="mb-6">
        <Link
          href="/dashboard/offers"
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
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="title">
            Название
          </label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, title: event.target.value.slice(0, 200) }))
            }
            placeholder="Например, Подписка на сервис"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
          {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="targetUrl">
            Целевой URL
          </label>
          <input
            id="targetUrl"
            type="url"
            value={form.targetUrl}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, targetUrl: event.target.value.slice(0, 500) }))
            }
            placeholder="https://example.com/landing"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
          {errors.targetUrl && <p className="text-sm text-red-600">{errors.targetUrl}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="payoutRub">
            Выплата, ₽
          </label>
          <input
            id="payoutRub"
            type="number"
            min="0"
            step="0.01"
            value={form.payoutRub}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, payoutRub: event.target.value.slice(0, 20) }))
            }
            placeholder="500"
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
          {errors.payoutRub && <p className="text-sm text-red-600">{errors.payoutRub}</p>}
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
                status: event.target.value === 'active' ? 'active' : 'inactive',
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
          disabled={!isFormValid || submitting}
          className="w-full rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? 'Сохраняем...' : 'Сохранить изменения'}
        </button>
      </form>
    </section>
  );
}
