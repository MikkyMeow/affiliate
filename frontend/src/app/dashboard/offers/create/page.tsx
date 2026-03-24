'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import {
  DuplicateClickSettings,
  DuplicateWindowUnit,
  windowPartsToSeconds,
} from '../components/DuplicateClickSettings';
import {
  OFFER_CATEGORY_OPTIONS,
  type OfferCategoryValue,
} from '@/lib/offerCategories';

type Advertiser = {
  id: string;
  name: string;
};

type FormState = {
  title: string;
  advertiserId: string;
  category: OfferCategoryValue | '';
  targetUrl: string;
  payoutRub: string;
  status: 'active' | 'inactive';
  allowDuplicateClicks: boolean;
  duplicateClickWindowValue: string;
  duplicateClickWindowUnit: DuplicateWindowUnit;
  description: string;
};

type FieldErrors = Partial<Record<keyof FormState | 'form', string>>;

export default function CreateOfferPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>({
    title: '',
    advertiserId: '',
    category: '',
    targetUrl: '',
    payoutRub: '',
    status: 'inactive',
    allowDuplicateClicks: true,
    duplicateClickWindowValue: '',
    duplicateClickWindowUnit: 'minutes',
    description: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [advertisersError, setAdvertisersError] = useState<string | null>(null);
  const [loadingAdvertisers, setLoadingAdvertisers] = useState(false);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/offers/create');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !accessToken) {
      return;
    }

    let active = true;
    setLoadingAdvertisers(true);
    setAdvertisersError(null);

    apiFetch<Advertiser[]>('/advertisers', { token: accessToken })
      .then((items) => {
        if (!active) {
          return;
        }
        setAdvertisers(items);
      })
      .catch((fetchError: Error) => {
        if (!active) {
          return;
        }
        setAdvertisers([]);
        setAdvertisersError(fetchError.message);
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setLoadingAdvertisers(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, authLoading]);

  const isFormValid = useMemo(() => {
    const normalizedTitle = form.title.trim();
    const normalizedTargetUrl = form.targetUrl.trim();
    const payoutValue = Number.parseFloat(form.payoutRub.replace(',', '.'));
    const duplicateWindowSeconds = form.allowDuplicateClicks
      ? null
      : windowPartsToSeconds(
          form.duplicateClickWindowValue,
          form.duplicateClickWindowUnit,
        );
    const duplicateSettingsValid =
      form.allowDuplicateClicks || duplicateWindowSeconds !== null;

    return (
      normalizedTitle.length > 0 &&
      form.advertiserId.length > 0 &&
      form.category.length > 0 &&
      /^https?:\/\//i.test(normalizedTargetUrl) &&
      Number.isFinite(payoutValue) &&
      payoutValue > 0 &&
      ['active', 'inactive'].includes(form.status) &&
      duplicateSettingsValid
    );
  }, [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    if (!accessToken) {
      setErrors({ form: 'Нет токена авторизации' });
      return;
    }

    const normalizedTitle = form.title.trim();
    if (!normalizedTitle) {
      setErrors({ title: 'Введите название оффера' });
      return;
    }

    if (!form.advertiserId) {
      setErrors({ advertiserId: 'Выберите рекламодателя' });
      return;
    }

    if (!form.category) {
      setErrors({ category: 'Выберите категорию' });
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

    const duplicateWindowSeconds = form.allowDuplicateClicks
      ? null
      : windowPartsToSeconds(
          form.duplicateClickWindowValue,
          form.duplicateClickWindowUnit,
        );
    if (!form.allowDuplicateClicks && duplicateWindowSeconds === null) {
      setErrors({
        duplicateClickWindowValue: 'Укажите окно от 1 минуты до 30 дней',
      });
      return;
    }

    const normalizedDescription = form.description.trim();
    const description = normalizedDescription.length > 0 ? normalizedDescription : null;

    setSubmitting(true);

    try {
      await apiFetch<{ offer: { id: string } }>('/offers', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({
          title: normalizedTitle,
          advertiserId: form.advertiserId,
          category: form.category,
          targetUrl: normalizedUrl,
          payoutRub: Number(payoutValue.toFixed(2)),
          status: form.status,
          allowDuplicateClicks: form.allowDuplicateClicks,
          duplicateClickWindowSeconds: duplicateWindowSeconds,
          description,
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
            case 'advertiserId':
            case 'category':
            case 'targetUrl':
            case 'payoutRub':
            case 'status':
            case 'allowDuplicateClicks':
            case 'description':
              if (!fieldErrors[field]) {
                fieldErrors[field] = message;
              }
              break;
            case 'duplicateClickWindowSeconds':
              if (!fieldErrors.duplicateClickWindowValue) {
                fieldErrors.duplicateClickWindowValue = message;
              }
              break;
            default:
              fieldErrors.form = message;
          }
        });

        if (Object.keys(fieldErrors).length === 0) {
          fieldErrors.form = apiError.message ?? 'Исправьте ошибки в форме и попробуйте снова';
        }

        setErrors(fieldErrors);
      } else if (apiError.code === 'NOT_FOUND') {
        setErrors({
          form: apiError.message ?? 'Связанный объект не найден. Проверьте выбранного рекламодателя.',
        });
      } else if (apiError.code === 'CONFLICT') {
        setErrors({
          form: apiError.message ?? 'Возник конфликт данных. Попробуйте изменить ввод.',
        });
      } else {
        const message = apiError.message ?? 'Не удалось создать оффер';
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
          Войдите, чтобы создавать офферы.
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

  return (
    <section className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Создать оффер</h1>
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
          <label
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            htmlFor="advertiserId"
          >
            Рекламодатель
          </label>
          <select
            id="advertiserId"
            value={form.advertiserId}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                advertiserId: event.target.value,
              }))
            }
            disabled={loadingAdvertisers}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
          >
            <option value="">Выберите рекламодателя</option>
            {advertisers.map((advertiser) => (
              <option key={advertiser.id} value={advertiser.id}>
                {advertiser.name}
              </option>
            ))}
          </select>
          {advertisersError && (
            <p className="text-sm text-red-600">
              Не удалось загрузить рекламодателей: {advertisersError}
            </p>
          )}
          {errors.advertiserId && <p className="text-sm text-red-600">{errors.advertiserId}</p>}
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            htmlFor="category"
          >
            Категория
          </label>
          <select
            id="category"
            value={form.category}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                category: event.target.value as OfferCategoryValue | '',
              }))
            }
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
          >
            <option value="">Выберите категорию</option>
            {OFFER_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.category && <p className="text-sm text-red-600">{errors.category}</p>}
        </div>

        <div className="space-y-2">
          <label
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            htmlFor="targetUrl"
          >
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
          <label
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            htmlFor="payoutRub"
          >
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
          <label
            className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
            htmlFor="description"
          >
            Описание
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            placeholder="Опишите требования к трафику, ограничения и ценность оффера"
            rows={6}
            className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
          />
          {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
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

        <DuplicateClickSettings
          allowDuplicateClicks={form.allowDuplicateClicks}
          duplicateClickWindowValue={form.duplicateClickWindowValue}
          duplicateClickWindowUnit={form.duplicateClickWindowUnit}
          onAllowDuplicateClicksChange={(value) =>
            setForm((prev) => ({
              ...prev,
              allowDuplicateClicks: value,
            }))
          }
          onDuplicateClickWindowValueChange={(value) =>
            setForm((prev) => ({
              ...prev,
              duplicateClickWindowValue: value,
            }))
          }
          onDuplicateClickWindowUnitChange={(unit) =>
            setForm((prev) => ({
              ...prev,
              duplicateClickWindowUnit: unit,
            }))
          }
          errors={{
            allowDuplicateClicks: errors.allowDuplicateClicks,
            duplicateClickWindow: errors.duplicateClickWindowValue,
          }}
        />

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
          {submitting ? 'Создаём...' : 'Создать оффер'}
        </button>
      </form>
    </section>
  );
}
