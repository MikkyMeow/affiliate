'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { DateInput } from '@/components/DateInput';
import { InlineAlert } from '@/components/InlineAlert';
import { useAuth } from '@/context/AuthContext';
import { canAccessAdminArea } from '@/lib/auth/roles';
import {
  CLICK_RESULT_OPTIONS,
  type LookupOption,
  type PaginationMeta,
  type TransactionFilters,
  type TransactionItem,
  fetchTransactions,
} from '@/lib/admin-lists';
import { apiFetch, type ApiError } from '@/lib/api';
import { COUNTRY_OPTIONS, formatCountryLabel } from '@/lib/countries';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'clickId:asc', label: 'Click ID A-Z' },
  { value: 'clickId:desc', label: 'Click ID Z-A' },
  { value: 'offerTitle:asc', label: 'Offer A-Z' },
  { value: 'affiliateName:asc', label: 'Partner A-Z' },
];

type OfferLookupResponse = {
  id: string;
  publicId: string | null;
  title: string;
};

type NamedLookupResponse = {
  id: string;
  publicId: string | null;
  name: string;
};

type TransactionFilterForm = {
  search: string;
  sort: string;
  order: string;
  dateFrom: string;
  dateTo: string;
  offerId: string;
  affiliateId: string;
  advertiserId: string;
  countryCode: string;
  redirectOutcome: string;
  clickId: string;
  sub1: string;
  sub2: string;
  sub3: string;
  sub4: string;
  sub5: string;
  ip: string;
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
): TransactionFilterForm {
  return {
    search: searchParams?.get('search') ?? '',
    sort: searchParams?.get('sort') ?? 'createdAt',
    order: searchParams?.get('order') ?? 'desc',
    dateFrom: searchParams?.get('dateFrom') ?? '',
    dateTo: searchParams?.get('dateTo') ?? '',
    offerId: searchParams?.get('offerId') ?? '',
    affiliateId: searchParams?.get('affiliateId') ?? '',
    advertiserId: searchParams?.get('advertiserId') ?? '',
    countryCode: searchParams?.get('countryCode') ?? '',
    redirectOutcome: searchParams?.get('redirectOutcome') ?? '',
    clickId: searchParams?.get('clickId') ?? '',
    sub1: searchParams?.get('sub1') ?? '',
    sub2: searchParams?.get('sub2') ?? '',
    sub3: searchParams?.get('sub3') ?? '',
    sub4: searchParams?.get('sub4') ?? '',
    sub5: searchParams?.get('sub5') ?? '',
    ip: searchParams?.get('ip') ?? '',
    limit: String(
      parsePositiveInteger(searchParams?.get('limit'), DEFAULT_LIMIT),
    ),
  };
}

function buildQueryParamsFromForm(
  form: TransactionFilterForm,
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
    ['search', form.search],
    ['sort', form.sort],
    ['order', form.order],
    ['dateFrom', form.dateFrom],
    ['dateTo', form.dateTo],
    ['offerId', form.offerId],
    ['affiliateId', form.affiliateId],
    ['advertiserId', form.advertiserId],
    ['countryCode', form.countryCode.toUpperCase()],
    ['redirectOutcome', form.redirectOutcome],
    ['clickId', form.clickId],
    ['sub1', form.sub1],
    ['sub2', form.sub2],
    ['sub3', form.sub3],
    ['sub4', form.sub4],
    ['sub5', form.sub5],
    ['ip', form.ip],
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

export default function ClicksPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilterForm>(() =>
    buildFormFromSearchParams(searchParams),
  );
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
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
  const [loading, setLoading] = useState(false);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Транзакции';
  }, []);

  useEffect(() => {
    setFilters(buildFormFromSearchParams(searchParams));
  }, [searchParams]);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/clicks');
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

  const activeFilters = useMemo<TransactionFilters>(
    () => ({
      page,
      limit,
      search: searchParams?.get('search') ?? undefined,
      sort: searchParams?.get('sort') ?? undefined,
      order: (searchParams?.get('order') as 'asc' | 'desc' | null) ?? undefined,
      dateFrom: searchParams?.get('dateFrom') ?? undefined,
      dateTo: searchParams?.get('dateTo') ?? undefined,
      offerId: searchParams?.get('offerId') ?? undefined,
      affiliateId: searchParams?.get('affiliateId') ?? undefined,
      advertiserId: searchParams?.get('advertiserId') ?? undefined,
      countryCode: searchParams?.get('countryCode') ?? undefined,
      redirectOutcome: searchParams?.get('redirectOutcome') ?? undefined,
      clickId: searchParams?.get('clickId') ?? undefined,
      sub1: searchParams?.get('sub1') ?? undefined,
      sub2: searchParams?.get('sub2') ?? undefined,
      sub3: searchParams?.get('sub3') ?? undefined,
      sub4: searchParams?.get('sub4') ?? undefined,
      sub5: searchParams?.get('sub5') ?? undefined,
      ip: searchParams?.get('ip') ?? undefined,
    }),
    [limit, page, searchParams],
  );

  const formatter = useMemo(
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

  useEffect(() => {
    if (authLoading || !accessToken || !canAccessAdminArea(user)) {
      return;
    }

    let cancelled = false;
    setLookupsLoading(true);
    setLookupsError(null);

    Promise.allSettled([
      apiFetch<OfferLookupResponse[]>('/offers?limit=100&offset=0', {
        token: accessToken,
      }),
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
          setOffers(offersResult.value.map(mapOfferLookup));
        } else {
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

        const lookupFailures = [
          offersResult,
          affiliatesResult,
          advertisersResult,
        ].filter((result) => result.status === 'rejected');

        if (lookupFailures.length > 0) {
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

    fetchTransactions(accessToken, activeFilters)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setTransactions(response.items);
        setMeta(response.meta);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        const apiError = fetchError as ApiError;
        setError(apiError.message ?? 'Не удалось загрузить транзакции');
        setTransactions([]);
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

  const navigateWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      const targetPath = pathname ?? '/dashboard/clicks';
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

  const listStart = meta.total === 0 ? 0 : meta.offset + 1;
  const listEnd = Math.min(meta.total, meta.offset + transactions.length);
  const canGoPrev = meta.page > 1;
  const canGoNext = meta.page < meta.totalPages;

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
          Войдите, чтобы увидеть список транзакций.
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
          Просматривать транзакции могут только администраторы и менеджеры.
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
          Транзакции
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Фильтры и пагинация выполняются на бэкенде. URL сохраняет текущее состояние списка.
        </p>
      </div>

      <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Фильтры
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              При смене фильтров список начинается с первой страницы.
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

        {lookupsError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{lookupsError}</InlineAlert>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 md:col-span-2">
            Search
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Click ID, offer, partner, advertiser, sub1-sub5, IP"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Sorting
            <select
              value={`${filters.sort}:${filters.order}`}
              onChange={(event) => {
                const [sort, order] = event.target.value.split(':');
                setFilters((current) => ({
                  ...current,
                  sort,
                  order,
                }));
              }}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Дата от
            <DateInput
              value={filters.dateFrom}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  dateFrom: value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            />
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Дата до
            <DateInput
              value={filters.dateTo}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  dateTo: value,
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
            Country
            <select
              value={filters.countryCode}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  countryCode: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {formatCountryLabel(country.code)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Result
            <select
              value={filters.redirectOutcome}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  redirectOutcome: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Все</option>
              {CLICK_RESULT_OPTIONS.map((option) => (
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

          {['sub1', 'sub2', 'sub3', 'sub4', 'sub5', 'ip'].map((field) => (
            <label
              key={field}
              className="text-sm font-medium text-zinc-700 capitalize dark:text-zinc-200"
            >
              {field === 'ip' ? 'IP' : field.toUpperCase()}
              <input
                type="text"
                value={filters[field as keyof TransactionFilterForm]}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
              />
            </label>
          ))}
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
            <InlineAlert variant="error" title="Не удалось загрузить транзакции">
              {error}
            </InlineAlert>
          </div>
        ) : loading && transactions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Загружаем транзакции…
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            По текущим фильтрам транзакции не найдены.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Дата</th>
                  <th className="px-6 py-3 font-medium">Click ID</th>
                  <th className="px-6 py-3 font-medium">Оффер</th>
                  <th className="px-6 py-3 font-medium">Партнёр</th>
                  <th className="px-6 py-3 font-medium">Рекламодатель</th>
                  <th className="px-6 py-3 font-medium">Country</th>
                  <th className="px-6 py-3 font-medium">Result</th>
                  <th className="px-6 py-3 font-medium">Sub IDs</th>
                  <th className="px-6 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {formatter.format(new Date(transaction.createdAt))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-zinc-700 dark:text-zinc-200">
                        {transaction.clickId}
                      </div>
                      {renderSourceBadge(transaction.source)}
                      {transaction.isDuplicate && transaction.canonicalClickId ? (
                        <div className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                          Duplicate of {transaction.canonicalClickId}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">
                        {transaction.offer.publicId ?? '—'}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {transaction.offer.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">
                        {transaction.affiliate.publicId ?? '—'}
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {transaction.affiliate.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {transaction.advertiser ? (
                        <>
                          <div className="font-medium">
                            {transaction.advertiser.publicId ?? '—'}
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400">
                            {transaction.advertiser.name}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {transaction.countryCode
                        ? formatCountryLabel(transaction.countryCode)
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {transaction.redirectOutcome ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                      <div>sub1: {transaction.sub1 ?? '—'}</div>
                      <div>sub2: {transaction.sub2 ?? '—'}</div>
                      <div>sub3: {transaction.sub3 ?? '—'}</div>
                      <div>sub4: {transaction.sub4 ?? '—'}</div>
                      <div>sub5: {transaction.sub5 ?? '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {transaction.ip ?? '—'}
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
