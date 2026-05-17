'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { InlineAlert } from '@/components/InlineAlert';
import { useAuth } from '@/context/AuthContext';
import { canAccessAdminArea } from '@/lib/auth/roles';
import {
  CONVERSION_STATUS_OPTIONS,
  type ConversionFilters,
  type ConversionItem,
  type LookupOption,
  type PaginationMeta,
  fetchConversions,
} from '@/lib/admin-lists';
import { apiFetch, type ApiError } from '@/lib/api';
import { fetchOfferGoals, type OfferGoal } from '@/lib/offers';
import { trackingFetch } from '@/lib/tracking';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

type OfferLookupResponse = {
  id: string;
  publicId: string | null;
  title: string;
  postbackToken?: string | null;
};

type NamedLookupResponse = {
  id: string;
  publicId: string | null;
  name: string;
};

type PostbackResponse = {
  clickId: string;
  status: string;
  goal?: {
    id: string;
    name: string;
  } | null;
};

type ConversionFilterForm = {
  dateFrom: string;
  dateTo: string;
  offerId: string;
  goalId: string;
  affiliateId: string;
  advertiserId: string;
  status: string;
  clickId: string;
  conversionId: string;
  externalTransactionId: string;
  revenueMin: string;
  revenueMax: string;
  payoutMin: string;
  payoutMax: string;
  limit: string;
};

function parsePositiveInteger(
  value: string | null | undefined,
  fallback: number,
) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildFormFromSearchParams(
  searchParams: ReadonlyURLSearchParams | null,
): ConversionFilterForm {
  return {
    dateFrom: searchParams?.get('dateFrom') ?? '',
    dateTo: searchParams?.get('dateTo') ?? '',
    offerId: searchParams?.get('offerId') ?? '',
    goalId: searchParams?.get('goalId') ?? '',
    affiliateId: searchParams?.get('affiliateId') ?? '',
    advertiserId: searchParams?.get('advertiserId') ?? '',
    status: searchParams?.get('status') ?? '',
    clickId: searchParams?.get('clickId') ?? '',
    conversionId: searchParams?.get('conversionId') ?? '',
    externalTransactionId: searchParams?.get('externalTransactionId') ?? '',
    revenueMin: searchParams?.get('revenueMin') ?? '',
    revenueMax: searchParams?.get('revenueMax') ?? '',
    payoutMin: searchParams?.get('payoutMin') ?? '',
    payoutMax: searchParams?.get('payoutMax') ?? '',
    limit: String(
      parsePositiveInteger(searchParams?.get('limit'), DEFAULT_LIMIT),
    ),
  };
}

function buildQueryParamsFromForm(
  form: ConversionFilterForm,
  { page }: { page?: number } = {},
) {
  const params = new URLSearchParams();
  const normalizedLimit = parsePositiveInteger(form.limit, DEFAULT_LIMIT);

  if (page && page > 1) {
    params.set('page', String(page));
  }

  if (normalizedLimit !== DEFAULT_LIMIT) {
    params.set('limit', String(normalizedLimit));
  }

  const entries = [
    ['dateFrom', form.dateFrom],
    ['dateTo', form.dateTo],
    ['offerId', form.offerId],
    ['goalId', form.goalId],
    ['affiliateId', form.affiliateId],
    ['advertiserId', form.advertiserId],
    ['status', form.status],
    ['clickId', form.clickId],
    ['conversionId', form.conversionId],
    ['externalTransactionId', form.externalTransactionId],
    ['revenueMin', form.revenueMin],
    ['revenueMax', form.revenueMax],
    ['payoutMin', form.payoutMin],
    ['payoutMax', form.payoutMax],
  ] as const;

  for (const [key, value] of entries) {
    const normalized = value.trim();
    if (normalized) {
      params.set(key, normalized);
    }
  }

  return params;
}

function mapOfferLookup(item: OfferLookupResponse): LookupOption {
  return {
    id: item.id,
    publicId: item.publicId ?? null,
    name: item.title,
  };
}

function mapNamedLookup(item: NamedLookupResponse): LookupOption {
  return {
    id: item.id,
    publicId: item.publicId ?? null,
    name: item.name,
  };
}

function formatLookupLabel(item: LookupOption) {
  return item.publicId ? `${item.publicId} · ${item.name}` : item.name;
}

const STATUS_STYLES: Record<string, string> = {
  approved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
};

function renderSourceBadge(source: string) {
  if (source !== 'manual') {
    return null;
  }

  return (
    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
      Manual
    </span>
  );
}

export default function ConversionsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ConversionFilterForm>(() =>
    buildFormFromSearchParams(searchParams),
  );
  const [conversions, setConversions] = useState<ConversionItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
    page: DEFAULT_PAGE,
    totalPages: 1,
  });
  const [offers, setOffers] = useState<LookupOption[]>([]);
  const [affiliates, setAffiliates] = useState<LookupOption[]>([]);
  const [advertisers, setAdvertisers] = useState<LookupOption[]>([]);
  const [offerTokens, setOfferTokens] = useState<OfferLookupResponse[]>([]);
  const [filterGoals, setFilterGoals] = useState<OfferGoal[]>([]);
  const [matchedOfferGoals, setMatchedOfferGoals] = useState<OfferGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [matchedOfferGoalsLoading, setMatchedOfferGoalsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [matchedOfferGoalsError, setMatchedOfferGoalsError] = useState<string | null>(null);
  const [postbackClickId, setPostbackClickId] = useState('');
  const [postbackStatus, setPostbackStatus] = useState<'approved' | 'rejected'>(
    'approved',
  );
  const [postbackToken, setPostbackToken] = useState('');
  const [postbackGoalId, setPostbackGoalId] = useState('');
  const [postbackPayout, setPostbackPayout] = useState('');
  const [postbackSending, setPostbackSending] = useState(false);
  const [postbackMessage, setPostbackMessage] = useState<string | null>(null);
  const [postbackError, setPostbackError] = useState<string | null>(null);
  const [postbackSignature, setPostbackSignature] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Конверсии';
  }, []);

  useEffect(() => {
    setFilters(buildFormFromSearchParams(searchParams));
  }, [searchParams]);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/conversions');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const page = useMemo(
    () => parsePositiveInteger(searchParams?.get('page'), DEFAULT_PAGE),
    [searchParams],
  );

  const limit = useMemo(
    () => parsePositiveInteger(searchParams?.get('limit'), DEFAULT_LIMIT),
    [searchParams],
  );

  const activeFilters = useMemo<ConversionFilters>(
    () => ({
      page,
      limit,
      dateFrom: searchParams?.get('dateFrom') ?? undefined,
      dateTo: searchParams?.get('dateTo') ?? undefined,
      offerId: searchParams?.get('offerId') ?? undefined,
      goalId: searchParams?.get('goalId') ?? undefined,
      affiliateId: searchParams?.get('affiliateId') ?? undefined,
      advertiserId: searchParams?.get('advertiserId') ?? undefined,
      status: searchParams?.get('status') ?? undefined,
      clickId: searchParams?.get('clickId') ?? undefined,
      conversionId: searchParams?.get('conversionId') ?? undefined,
      externalTransactionId:
        searchParams?.get('externalTransactionId') ?? undefined,
      revenueMin: searchParams?.get('revenueMin') ?? undefined,
      revenueMax: searchParams?.get('revenueMax') ?? undefined,
      payoutMin: searchParams?.get('payoutMin') ?? undefined,
      payoutMax: searchParams?.get('payoutMax') ?? undefined,
    }),
    [limit, page, searchParams],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [],
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 2,
      }),
    [],
  );

  const matchedOffer = useMemo(() => {
    const trimmedToken = postbackToken.trim();

    if (!trimmedToken) {
      return null;
    }

    return (
      offerTokens.find((offer) => offer.postbackToken?.trim() === trimmedToken) ??
      null
    );
  }, [offerTokens, postbackToken]);

  useEffect(() => {
    if (authLoading || !accessToken || !canAccessAdminArea(user)) {
      return;
    }

    let cancelled = false;
    setLookupsLoading(true);
    setLookupsError(null);

    Promise.allSettled([
      apiFetch<OfferLookupResponse[]>(
        '/offers?limit=100&offset=0&includePostbackToken=true',
        {
          token: accessToken,
        },
      ),
      apiFetch<NamedLookupResponse[]>('/affiliates?limit=100&offset=0', {
        token: accessToken,
      }),
      apiFetch<NamedLookupResponse[]>('/advertisers?limit=100&offset=0', {
        token: accessToken,
      }),
    ])
      .then(([offersResult, affiliatesResult, advertisersResult]) => {
        if (cancelled) {
          return;
        }

        if (offersResult.status === 'fulfilled') {
          setOfferTokens(offersResult.value);
          setOffers(offersResult.value.map(mapOfferLookup));
        } else {
          setOfferTokens([]);
          setOffers([]);
        }

        if (affiliatesResult.status === 'fulfilled') {
          setAffiliates(affiliatesResult.value.map(mapNamedLookup));
        } else {
          setAffiliates([]);
        }

        if (advertisersResult.status === 'fulfilled') {
          setAdvertisers(advertisersResult.value.map(mapNamedLookup));
        } else {
          setAdvertisers([]);
        }

        const failures = [offersResult, affiliatesResult, advertisersResult].filter(
          (result) => result.status === 'rejected',
        );

        if (failures.length > 0) {
          setLookupsError('Не удалось загрузить часть справочников фильтров.');
        }
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLookupsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, user]);

  useEffect(() => {
    if (authLoading || !accessToken || !canAccessAdminArea(user)) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchConversions(accessToken, activeFilters)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setConversions(response.items);
        setMeta(response.meta);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        const apiError = fetchError as ApiError;
        setError(apiError.message ?? 'Не удалось загрузить конверсии');
        setConversions([]);
        setMeta({
          total: 0,
          limit,
          offset: Math.max(page - 1, 0) * limit,
          page,
          totalPages: 1,
        });
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, activeFilters, authLoading, limit, page, user]);

  useEffect(() => {
    if (!accessToken || !filters.offerId) {
      setFilterGoals([]);
      setGoalsLoading(false);
      setGoalsError(null);
      return;
    }

    let cancelled = false;
    setGoalsLoading(true);
    setGoalsError(null);

    fetchOfferGoals(accessToken, filters.offerId)
      .then((goals) => {
        if (cancelled) {
          return;
        }

        setFilterGoals(goals);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        const apiError = fetchError as ApiError;
        setFilterGoals([]);
        setGoalsError(apiError.message ?? 'Не удалось загрузить цели оффера');
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setGoalsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, filters.offerId]);

  useEffect(() => {
    if (!accessToken || !matchedOffer) {
      setMatchedOfferGoals([]);
      setMatchedOfferGoalsLoading(false);
      setMatchedOfferGoalsError(null);
      return;
    }

    let cancelled = false;
    setMatchedOfferGoalsLoading(true);
    setMatchedOfferGoalsError(null);

    fetchOfferGoals(accessToken, matchedOffer.id)
      .then((goals) => {
        if (cancelled) {
          return;
        }

        setMatchedOfferGoals(goals);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        const apiError = fetchError as ApiError;
        setMatchedOfferGoals([]);
        setMatchedOfferGoalsError(
          apiError.message ?? 'Не удалось загрузить цели оффера',
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setMatchedOfferGoalsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, matchedOffer]);

  useEffect(() => {
    if (!matchedOffer) {
      return;
    }

    if (matchedOfferGoals.length === 0) {
      setPostbackGoalId('');
      return;
    }

    const hasCurrentGoal = matchedOfferGoals.some(
      (goal) => goal.id === postbackGoalId,
    );
    if (hasCurrentGoal) {
      return;
    }

    const defaultGoal =
      matchedOfferGoals.find((goal) => goal.isDefault) ?? matchedOfferGoals[0];
    setPostbackGoalId(defaultGoal?.id ?? '');
  }, [matchedOffer, matchedOfferGoals, postbackGoalId]);

  useEffect(() => {
    if (!filters.offerId) {
      return;
    }

    if (filterGoals.length === 0) {
      setFilters((current) => ({ ...current, goalId: '' }));
      return;
    }

    const goalStillExists = filterGoals.some((goal) => goal.id === filters.goalId);
    if (!filters.goalId || goalStillExists) {
      return;
    }

    setFilters((current) => ({ ...current, goalId: '' }));
  }, [filterGoals, filters.goalId, filters.offerId]);

  const navigateWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      const targetPath = pathname ?? '/dashboard/conversions';
      router.push(query ? `${targetPath}?${query}` : targetPath);
    },
    [pathname, router],
  );

  const handleApplyFilters = useCallback(() => {
    navigateWithParams(buildQueryParamsFromForm(filters));
  }, [filters, navigateWithParams]);

  const handleResetFilters = useCallback(() => {
    setFilters(buildFormFromSearchParams(null));
    navigateWithParams(new URLSearchParams());
  }, [navigateWithParams]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage === meta.page) {
        return;
      }

      navigateWithParams(buildQueryParamsFromForm(filters, { page: nextPage }));
    },
    [filters, meta.page, navigateWithParams],
  );

  const handleLimitChange = useCallback(
    (nextLimit: string) => {
      const nextFilters = { ...filters, limit: nextLimit };
      setFilters(nextFilters);
      navigateWithParams(buildQueryParamsFromForm(nextFilters));
    },
    [filters, navigateWithParams],
  );

  const computeSignature = useCallback(
    async ({
      token,
      clickId,
      status,
      payout,
    }: {
      token: string;
      clickId: string;
      status: string;
      payout?: number;
    }) => {
      const payload = `${clickId}|${status}|${
        typeof payout === 'number' && Number.isFinite(payout)
          ? payout.toString(10)
          : ''
      }`;

      if (typeof window !== 'undefined' && window.crypto?.subtle) {
        try {
          const encoder = new TextEncoder();
          const key = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(token),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
          );
          const signatureBuffer = await window.crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(payload),
          );
          const bytes = new Uint8Array(signatureBuffer);
          return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
        } catch (cryptoError) {
          console.warn(
            'Web Crypto API подпись не удалась, используем JS fallback',
            cryptoError,
          );
        }
      }

      const fallbackSignature = hmac(
        sha256,
        utf8ToBytes(token),
        utf8ToBytes(payload),
      );
      return bytesToHex(fallbackSignature);
    },
    [],
  );

  const handleManualPostback = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedClickId = postbackClickId.trim();
      const trimmedToken = postbackToken.trim();
      const trimmedGoalId = postbackGoalId.trim();
      const payoutInput = postbackPayout.trim();

      if (!trimmedClickId || !trimmedToken || !trimmedGoalId) {
        setPostbackError('clickId, token и goalId обязательны');
        setPostbackMessage(null);
        return;
      }

      let payoutValue: number | undefined;
      if (payoutInput) {
        const parsedValue = Number(payoutInput);
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
          setPostbackError('payout должен быть неотрицательным числом');
          setPostbackMessage(null);
          return;
        }
        payoutValue = parsedValue;
      }

      setPostbackSending(true);
      setPostbackError(null);
      setPostbackMessage(null);

      try {
        const signature = await computeSignature({
          token: trimmedToken,
          clickId: trimmedClickId,
          status: postbackStatus,
          payout: payoutValue,
        });
        setPostbackSignature(signature);

        const payload: Record<string, unknown> = {
          clickId: trimmedClickId,
          status: postbackStatus,
          token: trimmedToken,
          goalId: trimmedGoalId,
          signature,
        };

        if (typeof payoutValue === 'number') {
          payload.payoutRub = payoutValue;
        }

        const response = await trackingFetch<PostbackResponse>('/postback', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        setPostbackMessage(
          `Готово: ${response.clickId} → ${response.status.toUpperCase()}${
            response.goal?.name ? ` (${response.goal.name})` : ''
          }`,
        );
      } catch (submitError) {
        const apiError = submitError as ApiError;
        let message = apiError.message || 'Не удалось отправить постбек';
        if (
          apiError.code === 'VALIDATION_ERROR' &&
          apiError.details &&
          typeof apiError.details === 'object'
        ) {
          const details = apiError.details as {
            errors?: Array<{ field?: string; message?: string }>;
          };
          const detailMessage = details.errors
            ?.map((errorItem) =>
              errorItem.field
                ? `${errorItem.field}: ${errorItem.message ?? ''}`
                : errorItem.message,
            )
            .filter(Boolean)
            .join('; ');
          if (detailMessage) {
            message = `${message} (${detailMessage})`;
          }
        }
        setPostbackError(message);
      } finally {
        setPostbackSending(false);
      }
    },
    [
      computeSignature,
      postbackClickId,
      postbackGoalId,
      postbackPayout,
      postbackStatus,
      postbackToken,
    ],
  );

  const listStart = meta.total === 0 ? 0 : meta.offset + 1;
  const listEnd = Math.min(meta.total, meta.offset + conversions.length);
  const canGoPrev = meta.page > 1;
  const canGoNext = meta.page < meta.totalPages;

  const renderStatus = (status: string) => {
    const normalized = status?.toLowerCase?.() ?? status;
    const style =
      STATUS_STYLES[normalized] ??
      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
    return (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${style}`}>
        {status}
      </span>
    );
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
          Войдите, чтобы увидеть список конверсий.
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
          Просматривать конверсии могут только администраторы и менеджеры.
        </p>
        <Link
          href="/"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          На главную
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Конверсии
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Список использует серверные фильтры и пагинацию; URL сохраняет текущее состояние.
        </p>
      </div>

      <section className="mb-10 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Manual postback test
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Отправка тестового постбека
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Минимум для дебага: clickId, статус, token и цель. Подпись считает фронт аналогично бекенду.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPostbackClickId('');
              setPostbackToken('');
              setPostbackGoalId('');
              setPostbackPayout('');
              setPostbackStatus('approved');
              setPostbackMessage(null);
              setPostbackError(null);
              setPostbackSignature(null);
            }}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Сбросить форму
          </button>
        </div>

        {lookupsError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{lookupsError}</InlineAlert>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleManualPostback}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              clickId
              <input
                type="text"
                value={postbackClickId}
                onChange={(event) => setPostbackClickId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
                placeholder="clk_123"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Postback token
              <input
                type="text"
                value={postbackToken}
                onChange={(event) => setPostbackToken(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Статус
              <select
                value={postbackStatus}
                onChange={(event) =>
                  setPostbackStatus(event.target.value as 'approved' | 'rejected')
                }
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              >
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              payout
              <input
                type="number"
                min="0"
                step="0.01"
                value={postbackPayout}
                onChange={(event) => setPostbackPayout(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100 md:col-span-2">
              Goal
              <select
                value={postbackGoalId}
                onChange={(event) => setPostbackGoalId(event.target.value)}
                disabled={!matchedOffer || matchedOfferGoalsLoading}
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              >
                <option value="">
                  {matchedOffer
                    ? matchedOfferGoalsLoading
                      ? 'Загружаем цели…'
                      : 'Выберите цель'
                    : 'Введите корректный token оффера'}
                </option>
                {matchedOfferGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {lookupsLoading ? (
            <p className="text-sm text-zinc-500">Загружаем токены офферов…</p>
          ) : null}
          {matchedOffer ? (
            <p className="text-sm text-zinc-500">
              Найден оффер: {matchedOffer.publicId ?? matchedOffer.id} · {matchedOffer.title}
            </p>
          ) : null}
          {matchedOfferGoalsError ? (
            <InlineAlert variant="error">{matchedOfferGoalsError}</InlineAlert>
          ) : null}
          {postbackSignature ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Signature: <span className="font-mono">{postbackSignature}</span>
            </p>
          ) : null}
          {postbackError ? <InlineAlert variant="error">{postbackError}</InlineAlert> : null}
          {postbackMessage ? <InlineAlert variant="success">{postbackMessage}</InlineAlert> : null}

          <button
            type="submit"
            disabled={postbackSending}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black"
          >
            {postbackSending ? 'Отправляем…' : 'Отправить постбек'}
          </button>
        </form>
      </section>

      <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Фильтры
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              При изменении фильтров список начинается с первой страницы.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Сбросить
            </button>
          </div>
        </div>

        {goalsError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{goalsError}</InlineAlert>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Дата от
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Дата до
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Оффер
            <select
              value={filters.offerId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  offerId: event.target.value,
                  goalId: '',
                }))
              }
              disabled={lookupsLoading}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {formatLookupLabel(offer)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Goal
            <select
              value={filters.goalId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  goalId: event.target.value,
                }))
              }
              disabled={!filters.offerId || goalsLoading}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">
                {!filters.offerId
                  ? 'Сначала выберите оффер'
                  : goalsLoading
                    ? 'Загружаем цели…'
                    : 'Все'}
              </option>
              {filterGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Партнёр
            <select
              value={filters.affiliateId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  affiliateId: event.target.value,
                }))
              }
              disabled={lookupsLoading}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              {affiliates.map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {formatLookupLabel(affiliate)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Рекламодатель
            <select
              value={filters.advertiserId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  advertiserId: event.target.value,
                }))
              }
              disabled={lookupsLoading}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              {advertisers.map((advertiser) => (
                <option key={advertiser.id} value={advertiser.id}>
                  {formatLookupLabel(advertiser)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Статус
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              {CONVERSION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Click ID
            <input
              type="text"
              value={filters.clickId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  clickId: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Conversion ID
            <input
              type="text"
              value={filters.conversionId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  conversionId: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Transaction / External ID
            <input
              type="text"
              value={filters.externalTransactionId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  externalTransactionId: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Revenue min
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.revenueMin}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  revenueMin: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Revenue max
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.revenueMax}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  revenueMax: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Payout min
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.payoutMin}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  payoutMin: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Payout max
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.payoutMax}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  payoutMax: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 text-sm text-zinc-500 dark:border-zinc-800">
          <span>{loading ? 'Загружаем…' : `Всего: ${meta.total}`}</span>
          <div className="flex items-center gap-3">
            <span>
              {listStart}-{listEnd} / {meta.total}
            </span>
            <label className="flex items-center gap-2">
              <span>На странице</span>
              <select
                value={filters.limit}
                onChange={(event) => handleLimitChange(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <div className="px-6 py-6">
            <InlineAlert variant="error" title="Не удалось загрузить конверсии">
              {error}
            </InlineAlert>
          </div>
        ) : loading && conversions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Загружаем конверсии…
          </div>
        ) : conversions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            По текущим фильтрам конверсии не найдены.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Дата</th>
                  <th className="px-6 py-3 font-medium">Conversion</th>
                  <th className="px-6 py-3 font-medium">Transaction</th>
                  <th className="px-6 py-3 font-medium">Click ID</th>
                  <th className="px-6 py-3 font-medium">Оффер</th>
                  <th className="px-6 py-3 font-medium">Goal</th>
                  <th className="px-6 py-3 font-medium">Партнёр</th>
                  <th className="px-6 py-3 font-medium">Рекламодатель</th>
                  <th className="px-6 py-3 font-medium">Статус</th>
                  <th className="px-6 py-3 font-medium">Revenue</th>
                  <th className="px-6 py-3 font-medium">Payout</th>
                  <th className="px-6 py-3 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {conversions.map((conversion) => (
                  <tr
                    key={conversion.id}
                    className="text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {dateFormatter.format(new Date(conversion.createdAt))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs">{conversion.id}</div>
                      {renderSourceBadge(conversion.source)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs">
                        {conversion.externalTransactionId ?? '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs">
                        {conversion.clickId ?? '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">
                        {conversion.offer.publicId ?? '—'}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {conversion.offer.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {conversion.goal ? (
                        <>
                          <div className="font-mono text-xs">{conversion.goal.id}</div>
                          <div className="text-zinc-500 dark:text-zinc-400">
                            {conversion.goal.name ?? '—'}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">
                        {conversion.affiliate.publicId ?? '—'}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {conversion.affiliate.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {conversion.advertiser ? (
                        <>
                          <div className="font-medium">
                            {conversion.advertiser.publicId ?? '—'}
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400">
                            {conversion.advertiser.name}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4">{renderStatus(conversion.status)}</td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {conversion.revenue === null
                        ? '—'
                        : currencyFormatter.format(conversion.revenue)}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {conversion.payout === null
                        ? '—'
                        : currencyFormatter.format(conversion.payout)}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {conversion.profit === null
                        ? '—'
                        : currencyFormatter.format(conversion.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <span>
          Страница {meta.page} из {Math.max(meta.totalPages, 1)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(meta.page - 1)}
            disabled={!canGoPrev || loading}
            className="rounded-full border border-zinc-300 px-4 py-2 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(meta.page + 1)}
            disabled={!canGoNext || loading}
            className="rounded-full border border-zinc-300 px-4 py-2 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Вперёд
          </button>
        </div>
      </div>
    </section>
  );
}
