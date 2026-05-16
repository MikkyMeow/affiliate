'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { OfferGoalsSection } from './OfferGoalsSection';
import { OfferStatsSection } from './OfferStatsSection';
import { OfferGeoTargetingSection } from './OfferGeoTargetingSection';
import {
  DuplicateClickSettings,
  DuplicateWindowUnit,
  secondsToWindowParts,
  windowPartsToSeconds,
} from '../../components/DuplicateClickSettings';
import {
  OFFER_CATEGORY_OPTIONS,
  type OfferCategoryValue,
} from '@/lib/offerCategories';
import {
  fetchHiddenAffiliates,
  fetchOfferPendingRequests,
  fetchOfferAccessList,
  grantOfferAccess,
  hideOfferFromAffiliate,
  type HiddenAffiliateRecord,
  type OfferAccessRecord,
  type OfferAvailability,
  type OfferRequestRecord,
  reviewOfferRequestDecision,
  revokeOfferAccess,
  unhideOfferFromAffiliate,
} from '@/lib/offers';

type Offer = {
  id: string;
  publicId: string | null;
  publicIdNumber: number | null;
  title: string;
  category: OfferCategoryValue | null;
  advertiserId: string | null;
  advertiser: {
    id: string;
    publicId: string | null;
    name: string;
  } | null;
  targetUrl: string;
  payoutRub: number;
  status: 'active' | 'inactive';
  availability: OfferAvailability;
  visibilityMode: OfferAvailability;
  createdAt: string;
  updatedAt: string;
  targetingStrict: boolean;
  fallbackUrl: string | null;
  allowDuplicateClicks: boolean;
  duplicateClickWindowSeconds: number | null;
  description: string | null;
};

type FormState = {
  title: string;
  category: OfferCategoryValue | '';
  targetUrl: string;
  payoutRub: string;
  status: 'active' | 'inactive';
  availability: OfferAvailability;
  allowDuplicateClicks: boolean;
  duplicateClickWindowValue: string;
  duplicateClickWindowUnit: DuplicateWindowUnit;
  description: string;
};

type FieldErrors = Partial<Record<keyof FormState | 'form', string>>;

type AffiliateOption = {
  id: string;
  publicId: string | null;
  name: string;
  email: string;
};

export default function EditOfferPage() {
  const params = useParams();
  const pathname = usePathname();
  const offerIdParam = params?.id;
  const offerId = Array.isArray(offerIdParam) ? offerIdParam[0] : offerIdParam;

  const { user, accessToken, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>({
    title: '',
    category: '',
    targetUrl: '',
    payoutRub: '',
    status: 'inactive',
    availability: 'public',
    allowDuplicateClicks: true,
    duplicateClickWindowValue: '',
    duplicateClickWindowUnit: 'minutes',
    description: '',
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [offerPublicId, setOfferPublicId] = useState<string | null>(null);
  const [offerAdvertiser, setOfferAdvertiser] = useState<Offer['advertiser']>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [offerTargeting, setOfferTargeting] = useState<{
    targetingStrict: boolean;
    fallbackUrl: string | null;
  }>({
    targetingStrict: false,
    fallbackUrl: null,
  });
  const [affiliateOptions, setAffiliateOptions] = useState<AffiliateOption[]>([]);
  const [accessItems, setAccessItems] = useState<OfferAccessRecord[]>([]);
  const [hiddenItems, setHiddenItems] = useState<HiddenAffiliateRecord[]>([]);
  const [requestItems, setRequestItems] = useState<OfferRequestRecord[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [selectedAccessAffiliateId, setSelectedAccessAffiliateId] = useState('');
  const [selectedHiddenAffiliateId, setSelectedHiddenAffiliateId] = useState('');
  const [accessActionLoading, setAccessActionLoading] = useState(false);
  const [hideActionLoading, setHideActionLoading] = useState(false);
  const [requestActionLoadingId, setRequestActionLoadingId] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [hideNotice, setHideNotice] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? `/dashboard/offers/${offerId ?? ''}/edit`);
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname, offerId]);

  const loadManagementData = useCallback(async () => {
    if (!accessToken || !offerId) {
      return;
    }

    setAccessLoading(true);
    setHiddenLoading(true);
    setRequestLoading(true);

    try {
      const [accessList, hiddenList, requestList, affiliates] = await Promise.all([
        fetchOfferAccessList(accessToken, offerId),
        fetchHiddenAffiliates(accessToken, offerId),
        fetchOfferPendingRequests(accessToken, offerId),
        apiFetch<AffiliateOption[]>('/affiliates?limit=100&offset=0', {
          token: accessToken,
        }),
      ]);

      setAccessItems(accessList);
      setHiddenItems(hiddenList);
      setRequestItems(requestList);
      setAffiliateOptions(affiliates);
    } catch (error) {
      const apiError = error as ApiError;
      const message =
        apiError.message ?? 'Не удалось загрузить настройки доступа по офферу';
      setAccessNotice(message);
      setHideNotice(message);
      setRequestNotice(message);
    } finally {
      setAccessLoading(false);
      setHiddenLoading(false);
      setRequestLoading(false);
    }
  }, [accessToken, offerId]);

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

    Promise.all([
      apiFetch<{ offer: Offer }>(`/offers/${offerId}`, {
        token: accessToken,
      }),
      loadManagementData(),
    ])
      .then(([{ offer }]) => {
        if (!active) {
          return;
        }
        setOfferPublicId(offer.publicId ?? null);
        setOfferAdvertiser(offer.advertiser ?? null);
        const windowParts = secondsToWindowParts(
          offer.duplicateClickWindowSeconds,
        );
        setForm({
          title: offer.title,
          category: offer.category ?? '',
          targetUrl: offer.targetUrl,
          payoutRub: offer.payoutRub.toString(),
          status: offer.status,
          availability:
            offer.availability ?? offer.visibilityMode ?? 'public',
          allowDuplicateClicks:
            typeof offer.allowDuplicateClicks === 'boolean'
              ? offer.allowDuplicateClicks
              : true,
          duplicateClickWindowValue: windowParts.value,
          duplicateClickWindowUnit: windowParts.unit,
          description: offer.description ?? '',
        });
        setOfferTargeting({
          targetingStrict: Boolean(offer.targetingStrict),
          fallbackUrl: offer.fallbackUrl ?? null,
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
  }, [accessToken, offerId, authLoading, loadManagementData]);

  const isFormValid = useMemo(() => {
    const normalizedTitle = form.title.trim();
    const normalizedUrl = form.targetUrl.trim();
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
      form.category.length > 0 &&
      /^https?:\/\//i.test(normalizedUrl) &&
      Number.isFinite(payoutValue) &&
      payoutValue > 0 &&
      ['active', 'inactive'].includes(form.status) &&
      ['public', 'on_request', 'private'].includes(form.availability) &&
      duplicateSettingsValid
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
    const description =
      normalizedDescription.length > 0 ? normalizedDescription : null;

    setSubmitting(true);
    setSaveSuccess(null);

    try {
      await apiFetch(`/offers/${offerId}`, {
        method: 'PATCH',
        token: accessToken,
        body: JSON.stringify({
          title: normalizedTitle,
          targetUrl: normalizedUrl,
          category: form.category,
          payoutRub: Number(payoutValue.toFixed(2)),
          status: form.status,
          availability: form.availability,
          allowDuplicateClicks: form.allowDuplicateClicks,
          duplicateClickWindowSeconds: duplicateWindowSeconds,
          description,
        }),
      });
      setSaveSuccess('Изменения сохранены');
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
            case 'category':
            case 'targetUrl':
            case 'payoutRub':
            case 'status':
            case 'availability':
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

  const hiddenAffiliateIds = useMemo(
    () => new Set(hiddenItems.map((item) => item.affiliateId)),
    [hiddenItems],
  );

  const availableAccessAffiliates = useMemo(
    () =>
      affiliateOptions.filter(
        (item) => !accessItems.some((record) => record.affiliateId === item.id),
      ),
    [accessItems, affiliateOptions],
  );

  const availableHiddenAffiliates = useMemo(
    () =>
      affiliateOptions.filter(
        (item) => !hiddenItems.some((record) => record.affiliateId === item.id),
      ),
    [affiliateOptions, hiddenItems],
  );

  const handleGrantAccess = useCallback(async () => {
    if (!accessToken || !offerId || !selectedAccessAffiliateId) {
      return;
    }

    setAccessActionLoading(true);
    setAccessNotice(null);
    try {
      const response = await grantOfferAccess(
        accessToken,
        offerId,
        selectedAccessAffiliateId,
      );
      await loadManagementData();
      setSelectedAccessAffiliateId('');
      setAccessNotice(
        response.visibilityWarning
          ? `Доступ выдан. ${response.visibilityWarning}`
          : 'Доступ выдан',
      );
    } catch (error) {
      const apiError = error as ApiError;
      setAccessNotice(apiError.message ?? 'Не удалось выдать доступ');
    } finally {
      setAccessActionLoading(false);
    }
  }, [
    accessToken,
    loadManagementData,
    offerId,
    selectedAccessAffiliateId,
  ]);

  const handleRevokeAccess = useCallback(
    async (affiliateId: string) => {
      if (!accessToken || !offerId) {
        return;
      }

      setAccessActionLoading(true);
      setAccessNotice(null);
      try {
        await revokeOfferAccess(accessToken, offerId, affiliateId);
        await loadManagementData();
        setAccessNotice('Доступ отозван');
      } catch (error) {
        const apiError = error as ApiError;
        setAccessNotice(apiError.message ?? 'Не удалось отозвать доступ');
      } finally {
        setAccessActionLoading(false);
      }
    },
    [accessToken, loadManagementData, offerId],
  );

  const handleHideAffiliate = useCallback(async () => {
    if (!accessToken || !offerId || !selectedHiddenAffiliateId) {
      return;
    }

    setHideActionLoading(true);
    setHideNotice(null);
    try {
      await hideOfferFromAffiliate(accessToken, offerId, selectedHiddenAffiliateId);
      await loadManagementData();
      setSelectedHiddenAffiliateId('');
      setHideNotice('Партнёр скрыт для этого оффера');
    } catch (error) {
      const apiError = error as ApiError;
      setHideNotice(apiError.message ?? 'Не удалось скрыть оффер от партнёра');
    } finally {
      setHideActionLoading(false);
    }
  }, [
    accessToken,
    loadManagementData,
    offerId,
    selectedHiddenAffiliateId,
  ]);

  const handleReviewRequest = useCallback(
    async (requestId: string, decision: 'approved' | 'rejected') => {
      if (!accessToken || !offerId) {
        return;
      }

      setRequestActionLoadingId(requestId);
      setRequestNotice(null);
      try {
        await reviewOfferRequestDecision(accessToken, offerId, requestId, decision);
        await loadManagementData();
        setRequestNotice(
          decision === 'approved' ? 'Заявка подтверждена' : 'Заявка отклонена',
        );
      } catch (error) {
        const apiError = error as ApiError;
        setRequestNotice(apiError.message ?? 'Не удалось обработать заявку');
      } finally {
        setRequestActionLoadingId((current) => (current === requestId ? null : current));
      }
    },
    [accessToken, loadManagementData, offerId],
  );

  const handleUnhideAffiliate = useCallback(
    async (affiliateId: string) => {
      if (!accessToken || !offerId) {
        return;
      }

      setHideActionLoading(true);
      setHideNotice(null);
      try {
        await unhideOfferFromAffiliate(accessToken, offerId, affiliateId);
        await loadManagementData();
        setHideNotice('Партнёр снова видит оффер');
      } catch (error) {
        const apiError = error as ApiError;
        setHideNotice(apiError.message ?? 'Не удалось вернуть видимость');
      } finally {
        setHideActionLoading(false);
      }
    },
    [accessToken, loadManagementData, offerId],
  );

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
    <section className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Редактировать оффер</h1>
        {offerPublicId && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{offerPublicId}</p>
        )}
      </div>

      <div className="mb-6">
        <Link
          href="/dashboard/offers"
          className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:text-zinc-300"
        >
          ← Назад к списку
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Рекламодатель
            </p>
            {offerAdvertiser ? (
              <div className="space-y-1">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {offerAdvertiser.name}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {offerAdvertiser.publicId ?? 'Без public ID'}
                </p>
                <Link
                  href={`/dashboard/advertisers/${offerAdvertiser.id}/edit`}
                  className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-200"
                >
                  Открыть карточку рекламодателя
                </Link>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Рекламодатель не найден
              </p>
            )}
          </div>

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
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="category">
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
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="description">
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
              placeholder="Требования к трафику, таргетинги, ограничения"
              rows={6}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
            />
            {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="availability">
              Доступность оффера
            </label>
            <select
              id="availability"
              value={form.availability}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  availability: event.target.value as OfferAvailability,
                }))
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="public">Open / public</option>
              <option value="on_request">On request / on_request</option>
              <option value="private">Private / private</option>
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Hidden-партнёр не увидит оффер даже при public или выданном доступе.
            </p>
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

          {saveSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-200">
              {saveSuccess}
            </div>
          )}

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

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4">
              <p className="text-sm uppercase tracking-wide text-zinc-500">
                Запросы доступа
              </p>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Pending requests
              </h2>
            </div>
            {requestNotice && (
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
                {requestNotice}
              </p>
            )}
            <div className="space-y-3">
              {requestLoading ? (
                <p className="text-sm text-zinc-500">Загружаем заявки...</p>
              ) : requestItems.length === 0 ? (
                <p className="text-sm text-zinc-500">Ожидающих заявок нет.</p>
              ) : (
                requestItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {item.affiliate?.name ?? item.affiliateId}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          {item.affiliate?.publicId ?? 'Без public ID'} ·{' '}
                          {item.affiliate?.email ?? 'Без email'}
                        </p>
                        {item.message && (
                          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                            {item.message}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleReviewRequest(item.id, 'approved')}
                          disabled={requestActionLoadingId === item.id}
                          className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white transition disabled:opacity-50 dark:bg-white dark:text-black"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleReviewRequest(item.id, 'rejected')}
                          disabled={requestActionLoadingId === item.id}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4">
              <p className="text-sm uppercase tracking-wide text-zinc-500">
                Доступ партнёров
              </p>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Гранты доступа
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              <select
                value={selectedAccessAffiliateId}
                onChange={(event) => setSelectedAccessAffiliateId(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              >
                <option value="">Выберите партнёра</option>
                {availableAccessAffiliates.map((affiliate) => (
                  <option key={affiliate.id} value={affiliate.id}>
                    {affiliate.publicId ? `${affiliate.publicId} · ` : ''}
                    {affiliate.name} · {affiliate.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleGrantAccess()}
                disabled={!selectedAccessAffiliateId || accessActionLoading}
                className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {accessActionLoading ? 'Сохраняем...' : 'Выдать доступ'}
              </button>
            </div>
            {accessNotice && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                {accessNotice}
              </p>
            )}
            <div className="mt-5 space-y-3">
              {accessLoading ? (
                <p className="text-sm text-zinc-500">Загружаем доступы...</p>
              ) : accessItems.length === 0 ? (
                <p className="text-sm text-zinc-500">Выданных доступов пока нет.</p>
              ) : (
                accessItems.map((item) => (
                  <div
                    key={item.affiliateId}
                    className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {item.affiliate?.name ?? item.affiliateId}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          {item.affiliate?.publicId ?? 'Без public ID'} ·{' '}
                          {item.affiliate?.email ?? 'Без email'}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                          {item.status}
                          {hiddenAffiliateIds.has(item.affiliateId)
                            ? ' · hidden override active'
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRevokeAccess(item.affiliateId)}
                        disabled={accessActionLoading}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Отозвать
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4">
              <p className="text-sm uppercase tracking-wide text-zinc-500">
                Hidden partners
              </p>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Скрытые партнёры
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Hidden имеет максимальный приоритет и перекрывает public/on_request и выданный доступ.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <select
                value={selectedHiddenAffiliateId}
                onChange={(event) => setSelectedHiddenAffiliateId(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              >
                <option value="">Выберите партнёра</option>
                {availableHiddenAffiliates.map((affiliate) => (
                  <option key={affiliate.id} value={affiliate.id}>
                    {affiliate.publicId ? `${affiliate.publicId} · ` : ''}
                    {affiliate.name} · {affiliate.email}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleHideAffiliate()}
                disabled={!selectedHiddenAffiliateId || hideActionLoading}
                className="rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-800 transition disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100"
              >
                {hideActionLoading ? 'Сохраняем...' : 'Скрыть оффер от партнёра'}
              </button>
            </div>
            {hideNotice && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                {hideNotice}
              </p>
            )}
            <div className="mt-5 space-y-3">
              {hiddenLoading ? (
                <p className="text-sm text-zinc-500">Загружаем список...</p>
              ) : hiddenItems.length === 0 ? (
                <p className="text-sm text-zinc-500">Скрытых партнёров пока нет.</p>
              ) : (
                hiddenItems.map((item) => (
                  <div
                    key={item.affiliateId}
                    className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {item.affiliate?.name ?? item.affiliateId}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400">
                          {item.affiliate?.publicId ?? 'Без public ID'} ·{' '}
                          {item.affiliate?.email ?? 'Без email'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleUnhideAffiliate(item.affiliateId)}
                        disabled={hideActionLoading}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Вернуть видимость
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {offerId && (
        <div className="mt-10 space-y-8">
          <OfferStatsSection offerId={offerId} token={accessToken} />
          <OfferGeoTargetingSection
            offerId={offerId}
            token={accessToken}
            targetingStrict={offerTargeting.targetingStrict}
            fallbackUrl={offerTargeting.fallbackUrl}
            onTargetingStrictChange={(value) =>
              setOfferTargeting((prev) => ({ ...prev, targetingStrict: value }))
            }
          />
          <OfferGoalsSection offerId={offerId} token={accessToken} />
        </div>
      )}
    </section>
  );
}
