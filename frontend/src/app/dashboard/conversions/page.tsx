'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { InlineAlert } from '@/components/InlineAlert';
import { trackingFetch } from '@/lib/tracking';
import { canAccessAdminArea } from '@/lib/auth/roles';

type Conversion = {
  clickId: string;
  offerId: string | null;
  affiliateId: string | null;
  status: string;
  payoutRub: number;
  createdAt: string;
};

type ConversionsMeta = {
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
} | null;

type OfferSecret = {
  id: string;
  title: string;
  postbackToken?: string | null;
};

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  approved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
};

export default function ConversionsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [postbackClickId, setPostbackClickId] = useState('');
  const [postbackStatus, setPostbackStatus] = useState<'approved' | 'rejected'>(
    'approved',
  );
  const [postbackToken, setPostbackToken] = useState('');
  const [postbackPayout, setPostbackPayout] = useState('');
  const [postbackSending, setPostbackSending] = useState(false);
  const [postbackMessage, setPostbackMessage] = useState<string | null>(null);
  const [postbackError, setPostbackError] = useState<string | null>(null);
  const [postbackSignature, setPostbackSignature] = useState<string | null>(null);
  const [offerTokens, setOfferTokens] = useState<OfferSecret[]>([]);
  const [offerTokensLoading, setOfferTokensLoading] = useState(false);
  const [offerTokensError, setOfferTokensError] = useState<string | null>(null);
  const [copiedTokenOfferId, setCopiedTokenOfferId] = useState<string | null>(null);

  const pageParam = searchParams?.get('page') ?? '1';
  const parsed = Number.parseInt(pageParam, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/conversions');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

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

  useEffect(() => {
    if (authLoading || !accessToken) {
      return;
    }

    let cancelled = false;

    const fetchConversions = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, meta } = await apiFetch<Conversion[], ConversionsMeta>(
          `/conversions?limit=${PAGE_SIZE}&offset=${offset}`,
          {
            token: accessToken,
            withMeta: true,
          },
        );

        if (cancelled) {
          return;
        }

        setConversions(data);
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
        if (cancelled) {
          return;
        }
        setError((fetchError as Error).message);
        setConversions([]);
        setTotal(0);
      } finally {
        if (cancelled) {
          return;
        }
        setLoading(false);
      }
    };

    void fetchConversions();

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, offset]);

  useEffect(() => {
    if (authLoading || !accessToken || !canAccessAdminArea(user)) {
      return;
    }

    let cancelled = false;
    setOfferTokensLoading(true);
    setOfferTokensError(null);

    const params = new URLSearchParams({
      limit: '100',
      offset: '0',
      includePostbackToken: 'true',
    });

    apiFetch<OfferSecret[]>(`/offers?${params.toString()}`, {
      token: accessToken,
    })
      .then((items) => {
        if (cancelled) {
          return;
        }
        setOfferTokens(items);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }
        const apiError = fetchError as ApiError;
        setOfferTokens([]);
        setOfferTokensError(
          apiError.message ?? 'Не удалось загрузить токены офферов',
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setOfferTokensLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, user]);

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
      const targetPath = pathname ?? '/dashboard/conversions';
      router.push(qs ? `${targetPath}?${qs}` : targetPath);
    },
    [page, pathname, router, searchParams],
  );

  const currentLimit = limit > 0 ? limit : PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil((total || 0) / currentLimit));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const listStart = total === 0 ? 0 : offset + 1;
  const listEnd = Math.min(total, offset + conversions.length);

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
        typeof payout === 'number' && Number.isFinite(payout) ? payout.toString(10) : ''
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
        } catch (error) {
          console.warn('Web Crypto API подпись не удалась, используем JS fallback', error);
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
      const payoutInput = postbackPayout.trim();

      if (!trimmedClickId || !trimmedToken) {
        setPostbackError('clickId и token обязательны');
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
          signature,
        };

        if (typeof payoutValue === 'number') {
          payload.payoutRub = payoutValue;
        }

        const response = await trackingFetch<{ clickId: string; status: string }>(
          '/postback',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          },
        );

        setPostbackMessage(
          `Готово: ${response.clickId} → ${response.status.toUpperCase()}`,
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
              errorItem.field ? `${errorItem.field}: ${errorItem.message ?? ''}` : errorItem.message,
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
      postbackPayout,
      postbackStatus,
      postbackToken,
    ],
  );

  const handleUseOfferToken = useCallback((token?: string | null) => {
    if (!token) {
      return;
    }
    setPostbackToken(token);
  }, []);

  const handleCopyOfferToken = useCallback(async (token: string | null | undefined, offerId: string) => {
    if (!token) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else if (typeof document !== 'undefined') {
        const temp = document.createElement('textarea');
        temp.value = token;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }

      setCopiedTokenOfferId(offerId);
      setTimeout(() => {
        setCopiedTokenOfferId((current) => (current === offerId ? null : current));
      }, 2000);
    } catch (copyError) {
      console.warn('Не удалось скопировать токен оффера', copyError);
      setCopiedTokenOfferId(null);
    }
  }, []);

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

  const renderStatus = (status: string) => {
    const normalized = status?.toLowerCase?.() ?? status;
    const style = STATUS_STYLES[normalized] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
    return (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${style}`}>
        {status}
      </span>
    );
  };

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Конверсии
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Отслеживайте статусы, выплаты и связь с clickId без SQL и curl.
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
              Минимум для дебага: clickId, статус, token. Подпись считает фронт аналогично
              бекенду (HMAC SHA-256 от <code>clickId|status|payout</code>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPostbackClickId('');
              setPostbackToken('');
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

        <form className="space-y-4" onSubmit={handleManualPostback}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              clickId
              <input
                type="text"
                value={postbackClickId}
                onChange={(event) => setPostbackClickId(event.target.value)}
                placeholder="CL-123..."
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                required
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Статус
              <select
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                value={postbackStatus}
                onChange={(event) =>
                  setPostbackStatus(
                    event.target.value === 'rejected' ? 'rejected' : 'approved',
                  )
                }
              >
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Token
              <input
                type="text"
                value={postbackToken}
                onChange={(event) => setPostbackToken(event.target.value)}
                placeholder="секрет оффера"
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                required
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
              payout (необяз.)
              <input
                type="text"
                value={postbackPayout}
                onChange={(event) => setPostbackPayout(event.target.value)}
                placeholder="Например 1200"
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 shadow-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>

          {postbackSignature && (
            <InlineAlert variant="info" title="Последняя подпись">
              <p className="break-all font-mono text-xs text-zinc-800 dark:text-zinc-100">
                {postbackSignature}
              </p>
            </InlineAlert>
          )}

          {postbackError && (
            <InlineAlert variant="error">
              {postbackError.split(';').map((chunk) => (
                <p key={chunk} className="leading-relaxed">
                  {chunk}
                </p>
              ))}
            </InlineAlert>
          )}

          {postbackMessage && (
            <InlineAlert variant="success">
              {postbackMessage}
            </InlineAlert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={postbackSending}
              className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {postbackSending ? 'Отправляем…' : 'Send test postback'}
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Запрос уходит на <code>/track/postback</code> с рассчитанной подписью.
            </p>
          </div>
        </form>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Секреты офферов
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-300">
            Эти токены нужны, чтобы эмулировать постбэки. Используйте кнопки ниже, чтобы
            подставить или скопировать нужный секрет.
          </p>
          {offerTokensLoading ? (
            <p className="mt-4 text-xs text-zinc-500">Загружаем токены…</p>
          ) : offerTokensError ? (
            <div className="mt-4">
              <InlineAlert variant="error" title="Ошибка загрузки">
                <p>{offerTokensError}</p>
              </InlineAlert>
            </div>
          ) : offerTokens.length === 0 ? (
            <p className="mt-4 text-xs text-zinc-500">Нет доступных офферов для отображения токенов.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {offerTokens.map((offer) => {
                const hasToken = Boolean(offer.postbackToken);
                return (
                  <div
                    key={offer.id}
                    className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {offer.title}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">
                      Token
                    </p>
                    <code className="mt-1 block break-all rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                      {offer.postbackToken ?? '—'}
                    </code>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleUseOfferToken(offer.postbackToken)}
                        disabled={!hasToken}
                        className="rounded-full border border-zinc-300 px-3 py-1 font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Подставить
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyOfferToken(offer.postbackToken, offer.id)
                        }
                        disabled={!hasToken}
                        className="rounded-full border border-zinc-300 px-3 py-1 font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {copiedTokenOfferId === offer.id ? 'Скопировано' : 'Копировать'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 px-6 py-4 text-sm text-zinc-500 dark:border-zinc-800">
          <span>{loading ? 'Загружаем…' : `Всего: ${total}`}</span>
          <span>
            {listStart}-{listEnd} / {total}
          </span>
        </div>

        {error ? (
          <div className="px-6 py-6">
            <InlineAlert variant="error" title="Не удалось загрузить данные">
              {error}
            </InlineAlert>
          </div>
        ) : conversions.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Пока нет конверсий.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-6 py-3 font-medium">clickId</th>
                  <th className="px-6 py-3 font-medium">offerId</th>
                  <th className="px-6 py-3 font-medium">affiliateId</th>
                  <th className="px-6 py-3 font-medium">status</th>
                  <th className="px-6 py-3 font-medium">payoutRub</th>
                  <th className="px-6 py-3 font-medium">createdAt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {conversions.map((conversion) => (
                  <tr
                    key={`${conversion.clickId}-${conversion.createdAt}`}
                    className="text-zinc-900 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-900/40"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                      {conversion.clickId}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {conversion.offerId ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {conversion.affiliateId ?? '—'}
                    </td>
                    <td className="px-6 py-4">{renderStatus(conversion.status)}</td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-200">
                      {currencyFormatter.format(conversion.payoutRub ?? 0)}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {dateFormatter.format(new Date(conversion.createdAt))}
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
          Страница {page} из {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={!canGoPrev || loading}
            className="rounded-full border border-zinc-300 px-4 py-2 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
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
