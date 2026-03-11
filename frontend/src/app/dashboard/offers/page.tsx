'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { InlineAlert } from '@/components/InlineAlert';
import { TRACKING_BASE_URL } from '@/lib/tracking';

type Offer = {
  id: string;
  title: string;
  advertiserId: string | null;
  targetUrl: string;
  payoutRub: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

type OffersMeta = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
} | null;

type AffiliateOption = {
  id: string;
  name: string;
  email: string;
};

type CopyState = 'idle' | 'copied' | 'error';

const PAGE_SIZE = 10;

export default function OffersPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [linkOffer, setLinkOffer] = useState<Offer | null>(null);
  const [affiliateOptions, setAffiliateOptions] = useState<AffiliateOption[]>([]);
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState('');
  const [sub1, setSub1] = useState('');
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const pageParam = searchParams?.get('page') ?? '1';
  const pageFromQuery = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/offers');
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

    const fetchOffers = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, meta } = await apiFetch<Offer[], OffersMeta>(
          `/offers?limit=${PAGE_SIZE}&offset=${offset}`,
          {
            token: accessToken,
            withMeta: true,
          },
        );

        if (!active) {
          return;
        }

        setOffers(data);
        const resolvedTotal =
          meta && typeof meta === 'object' && typeof meta.total === 'number'
            ? meta.total
            : data.length;
        const resolvedLimit =
          meta && typeof meta === 'object' && typeof meta.limit === 'number'
            ? meta.limit
            : PAGE_SIZE;

        setTotal(resolvedTotal);
        setLimit(resolvedLimit);
      } catch (fetchError) {
        if (!active) {
          return;
        }
        const apiError = fetchError as ApiError;
        setError(apiError.message ?? 'Не удалось загрузить офферы');
        setOffers([]);
        setTotal(0);
      } finally {
        if (!active) {
          return;
        }
        setLoading(false);
      }
    };

    fetchOffers();

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, offset]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage === page) {
        return;
      }

      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (nextPage === 1) {
        params.delete('page');
      } else {
        params.set('page', String(nextPage));
      }

      const qs = params.toString();
      const targetPath = pathname ?? '/dashboard/offers';
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [page, pathname, router, searchParams],
  );

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  const payoutFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 2,
      }),
    [],
  );

  const generatedLink = useMemo(() => {
    if (!linkOffer || !selectedAffiliateId) {
      return '';
    }

    const url = new URL('/track/click', TRACKING_BASE_URL);
    url.searchParams.set('offerId', linkOffer.id);
    url.searchParams.set('affiliateId', selectedAffiliateId);
    const trimmedSub = sub1.trim();
    if (trimmedSub) {
      url.searchParams.set('sub1', trimmedSub);
    }
    return url.toString();
  }, [linkOffer, selectedAffiliateId, sub1]);

  const loadAffiliates = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setAffiliateLoading(true);
    setAffiliateError(null);
    try {
      const data = await apiFetch<AffiliateOption[]>('/affiliates', {
        token: accessToken,
      });
      setAffiliateOptions(data);
    } catch (affError) {
        const apiError = affError as ApiError;
        setAffiliateError(apiError.message ?? 'Не удалось загрузить аффилиатов');
      setAffiliateOptions([]);
    } finally {
      setAffiliateLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!linkOffer) {
      return;
    }
    if (affiliateOptions.length > 0 && !affiliateError) {
      return;
    }
    void loadAffiliates();
  }, [affiliateError, affiliateOptions.length, linkOffer, loadAffiliates]);

  const openLinkModal = useCallback(
    (offer: Offer) => {
      setLinkOffer(offer);
      setSelectedAffiliateId('');
      setSub1('');
      setCopyState('idle');
      if (affiliateOptions.length === 0 && !affiliateLoading) {
        setAffiliateError(null);
      }
    },
    [affiliateLoading, affiliateOptions.length],
  );

  const closeLinkModal = useCallback(() => {
    setLinkOffer(null);
    setSelectedAffiliateId('');
    setSub1('');
    setCopyState('idle');
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!generatedLink) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedLink);
      } else if (typeof document !== 'undefined') {
        const temp = document.createElement('textarea');
        temp.value = generatedLink;
        temp.setAttribute('readonly', 'true');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      } else {
        throw new Error('Clipboard API недоступен');
      }
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch (copyError) {
      console.warn('Не удалось скопировать ссылку', copyError);
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 3000);
    }
  }, [generatedLink]);

  const currentLimit = limit > 0 ? limit : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((total || 0) / currentLimit));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const listStart = total === 0 ? 0 : offset + 1;
  const listEnd = Math.min(total, offset + offers.length);

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
          Войдите, чтобы увидеть список офферов.
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

  if (user.role !== 'admin') {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Управление офферами доступно только администраторам.
        </p>
        <Link
          href="/partner"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          В кабинет партнера
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Офферы
          </h1>
        </div>
        <Link
          href="/dashboard/offers/create"
          className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black"
        >
          Создать оффер
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Список
            </h2>
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Всего: {loading ? '...' : total}
            </p>
          </div>
          {total > 0 && (
            <p className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Показаны {listStart}-{listEnd}
            </p>
          )}
        </div>

        {error ? (
          <div className="px-6 py-6">
            <InlineAlert variant="error" title="Не удалось загрузить офферы">
              {error}
            </InlineAlert>
          </div>
        ) : loading && offers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Загружаем офферы...
          </div>
        ) : offers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Пока нет офферов.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                  <tr>
                    <th className="px-6 py-3 font-medium">Название</th>
                    <th className="px-6 py-3 font-medium">Рекламодатель</th>
                    <th className="px-6 py-3 font-medium">Выплата</th>
                    <th className="px-6 py-3 font-medium">Статус</th>
                    <th className="px-6 py-3 font-medium">Создан</th>
                    <th className="px-6 py-3 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {offers.map((offer) => (
                    <tr
                      key={offer.id}
                      className="text-zinc-900 transition dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium">{offer.title}</div>
                        <p className="text-xs text-zinc-500">#{offer.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                        {offer.advertiserId ? (
                          <span className="font-mono text-xs text-zinc-500">
                            {offer.advertiserId}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                        {payoutFormatter.format(offer.payoutRub)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            offer.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {offer.status === 'active' ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                        {formatter.format(new Date(offer.createdAt))}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openLinkModal(offer)}
                            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Generate link
                          </button>
                          <Link
                            href={`/dashboard/offers/${offer.id}/edit`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                            title="Редактировать"
                            aria-label="Редактировать"
                          >
                            ✎
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-zinc-200 px-6 py-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Страница {page} из {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!canGoPrev}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition enabled:hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:enabled:hover:bg-zinc-800"
                >
                  ← Назад
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!canGoNext}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition enabled:hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:enabled:hover:bg-zinc-800"
                >
                  Вперёд →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {linkOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeLinkModal}
            role="button"
            tabIndex={-1}
            aria-label="Закрыть окно"
          />
          <div className="relative w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Генерация ссылки
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {linkOffer.title}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Укажите аффилиата и (опционально) sub1. Ссылка собирается на фронте из{' '}
                  {TRACKING_BASE_URL}/track/click.
                </p>
              </div>
              <button
                type="button"
                onClick={closeLinkModal}
                className="rounded-full border border-zinc-200 p-2 text-sm text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {affiliateLoading ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Загружаем список аффилиатов...
              </div>
            ) : affiliateError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/60 dark:bg-red-500/10 dark:text-red-200">
                <p className="mb-2">Не удалось загрузить список аффилиатов: {affiliateError}</p>
                <button
                  type="button"
                  onClick={() => void loadAffiliates()}
                  className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 dark:border-red-400/60 dark:text-red-200 dark:hover:bg-red-400/10"
                >
                  Повторить
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Аффилиат
                  <select
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    value={selectedAffiliateId}
                    onChange={(event) => setSelectedAffiliateId(event.target.value)}
                  >
                    <option value="">Выберите аффилиата</option>
                    {affiliateOptions.map((affiliate) => (
                      <option key={affiliate.id} value={affiliate.id}>
                        {affiliate.name || affiliate.email || affiliate.id} · #{affiliate.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  sub1 (необязательно)
                  <input
                    type="text"
                    value={sub1}
                    onChange={(event) => setSub1(event.target.value)}
                    placeholder="utm_source или любой маркер"
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
              </div>
            )}

            <div className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Готовая ссылка
              </p>
              {generatedLink ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="flex-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {copyState === 'copied'
                      ? 'Скопировано!'
                      : copyState === 'error'
                        ? 'Ошибка копирования'
                        : 'Скопировать'}
                  </button>
                </div>
              ) : (
                <p className="text-zinc-600 dark:text-zinc-400">
                  Выберите аффилиата, чтобы получить ссылку вида{' '}
                  {TRACKING_BASE_URL}/track/click?offerId=...&affiliateId=...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
