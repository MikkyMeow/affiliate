'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { TRACKING_BASE_URL } from '@/lib/tracking';

type PartnerProfile = {
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    affiliateId?: string | null;
    createdAt?: string;
    role: 'affiliate';
  };
  affiliate: {
    id: string;
    name: string;
    email: string;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
  };
};

type StatsSummary = {
  clicksTotal: number;
  conversionsTotal: number;
  approvedConversionsTotal: number;
  rejectedConversionsTotal: number;
  payoutTotal: number;
};

type PartnerOffer = {
  id: string;
  title: string;
  advertiserId: string;
  targetUrl: string;
  payoutRub: number;
  status: 'active' | 'inactive';
};

const STATS_CARDS: Array<{
  key: keyof StatsSummary;
  label: string;
  hint: string;
  accent: string;
  currency?: boolean;
}> = [
  {
    key: 'clicksTotal',
    label: 'Клики',
    hint: 'Все переходы по вашим ссылкам',
    accent: 'from-blue-500/10 to-blue-500/5 text-blue-900 dark:text-blue-100',
  },
  {
    key: 'conversionsTotal',
    label: 'Конверсии',
    hint: 'Все заявки и заказы',
    accent: 'from-indigo-500/10 to-indigo-500/5 text-indigo-900 dark:text-indigo-100',
  },
  {
    key: 'approvedConversionsTotal',
    label: 'Одобренные',
    hint: 'Статус Approved',
    accent:
      'from-emerald-500/10 to-emerald-500/5 text-emerald-900 dark:text-emerald-100',
  },
  {
    key: 'rejectedConversionsTotal',
    label: 'Отклонённые',
    hint: 'Статус Rejected',
    accent: 'from-rose-500/10 to-rose-500/5 text-rose-900 dark:text-rose-100',
  },
  {
    key: 'payoutTotal',
    label: 'Выплаты, ₽',
    hint: 'Сумма ожидаемой выплаты',
    accent: 'from-amber-500/10 to-amber-500/5 text-amber-900 dark:text-amber-100',
    currency: true,
  },
];

export default function PartnerDashboardPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [copiedOfferId, setCopiedOfferId] = useState<string | null>(null);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/partner');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
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

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoadingProfile(true);
    setProfileError(null);
    try {
      const fetched = await apiFetch<PartnerProfile>('/api/v1/partner/profile', {
        token: accessToken,
      });
      setProfile(fetched);
    } catch (error) {
      const apiError = error as ApiError;
      setProfileError(apiError.message ?? 'Не удалось загрузить профиль');
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [accessToken]);

  const loadStats = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoadingStats(true);
    setStatsError(null);
    try {
      const summary = await apiFetch<StatsSummary>('/api/v1/partner/stats', {
        token: accessToken,
      });
      setStats(summary);
    } catch (error) {
      const apiError = error as ApiError;
      setStatsError(apiError.message ?? 'Не удалось загрузить статистику');
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [accessToken]);

  const loadOffers = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoadingOffers(true);
    setOffersError(null);
    try {
      const list = await apiFetch<PartnerOffer[]>('/api/v1/partner/offers', {
        token: accessToken,
      });
      setOffers(list);
    } catch (error) {
      const apiError = error as ApiError;
      setOffersError(apiError.message ?? 'Не удалось загрузить офферы');
      setOffers([]);
    } finally {
      setLoadingOffers(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== 'affiliate') {
      return;
    }

    void loadProfile();
    void loadStats();
    void loadOffers();
  }, [accessToken, authLoading, loadOffers, loadProfile, loadStats, user?.role]);

  const handleCopyLink = useCallback(async (link: string, offerId: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const temp = document.createElement('textarea');
        temp.value = link;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopiedOfferId(offerId);
      setTimeout(() => setCopiedOfferId((current) => (current === offerId ? null : current)), 2000);
    } catch (error) {
      console.warn('Не удалось скопировать ссылку', error);
      setCopiedOfferId(null);
    }
  }, []);

  const affiliateId = profile?.affiliate.id ?? user?.affiliateId ?? null;
  const trackingHint = affiliateId
    ? `${TRACKING_BASE_URL}/track/click?offerId=OFFER_ID&affiliateId=${affiliateId}`
    : null;

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Проверяем авторизацию…</p>
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
          Войдите или зарегистрируйтесь, чтобы попасть в кабинет партнера.
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

  if (user.role !== 'affiliate') {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Кабинет только для партнёров
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Вы авторизованы как администратор. Перейдите в админ-панель.
        </p>
        <Link
          href="/dashboard/stats"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          В админку
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">Partner</p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Кабинет аффилиата
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Следите за статистикой и активными офферами в одном месте.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadStats()}
            disabled={loadingStats}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {loadingStats ? 'Обновляем…' : 'Обновить статистику'}
          </button>
          <button
            type="button"
            onClick={() => {
              void loadProfile();
              void loadOffers();
            }}
            disabled={loadingProfile || loadingOffers}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200"
          >
            {(loadingProfile || loadingOffers) ? 'Загружаем…' : 'Обновить данные'}
          </button>
        </div>
      </div>

      {profileError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
          Не удалось загрузить профиль: {profileError}
        </div>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Профиль аффилиата
          </p>
          {loadingProfile ? (
            <p className="mt-4 text-sm text-zinc-500">Загружаем профиль…</p>
          ) : profile ? (
            <div className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                <span className="text-zinc-500">Название:</span>{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {profile.affiliate.name}
                </span>
              </p>
              <p>
                <span className="text-zinc-500">Email:</span> {profile.affiliate.email}
              </p>
              <p>
                <span className="text-zinc-500">Affiliate ID:</span>{' '}
                {profile.affiliate.id}
              </p>
              <p>
                <span className="text-zinc-500">Статус:</span>{' '}
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    profile.affiliate.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {profile.affiliate.status === 'active' ? 'Активен' : 'Неактивен'}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Нет данных по профилю.</p>
          )}
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Трекер
          </p>
          <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              Используйте базовый URL:{' '}
              <code className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                {TRACKING_BASE_URL}/track/click
              </code>
            </p>
            {trackingHint ? (
              <p>
                Пример ссылки:{' '}
                <code className="break-all rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                  {trackingHint}
                </code>
              </p>
            ) : (
              <p>Идентификатор аффилиата ещё не готов. Попробуйте обновить профиль.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Статистика
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Лента показателей
            </h2>
          </div>
          {statsError && (
            <span className="text-sm text-red-600 dark:text-red-300">
              {statsError}
            </span>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STATS_CARDS.map((card) => {
            const value = stats ? stats[card.key] : 0;
            const displayValue = card.currency
              ? currencyFormatter.format(value)
              : numberFormatter.format(value);
            return (
              <div
                key={card.key}
                className={`rounded-2xl border border-zinc-100 bg-gradient-to-b ${card.accent} p-4 shadow-sm dark:border-zinc-800`}
              >
                <p className="text-sm uppercase tracking-wide text-zinc-500">
                  {card.label}
                </p>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {loadingStats && !stats ? '…' : displayValue}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{card.hint}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Открытые офферы
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Доступные кампании
            </h2>
          </div>
          {offersError && (
            <span className="text-sm text-red-600 dark:text-red-300">
              {offersError}
            </span>
          )}
        </div>
        {loadingOffers && offers.length === 0 ? (
          <p className="text-sm text-zinc-500">Загружаем офферы…</p>
        ) : offers.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Пока нет активных офферов. Попробуйте обновить позже.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map((offer) => {
              const trackingLink = affiliateId
                ? `${TRACKING_BASE_URL}/track/click?offerId=${offer.id}&affiliateId=${affiliateId}`
                : null;
              return (
                <div
                  key={offer.id}
                  className="rounded-xl border border-zinc-200 p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950/20"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {offer.title}
                    </h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        offer.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {offer.status === 'active' ? 'Активен' : 'Пауза'}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Целевая: <a href={offer.targetUrl} className="text-blue-600 underline-offset-4 hover:underline dark:text-blue-300" target="_blank" rel="noreferrer">
                      {offer.targetUrl}
                    </a>
                  </p>
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                    Выплата:{' '}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {currencyFormatter.format(offer.payoutRub)}
                    </span>
                  </p>
                  {trackingLink ? (
                    <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      <p className="mb-1 text-zinc-500">Ваша ссылка:</p>
                      <code className="break-all text-zinc-900 dark:text-zinc-100">
                        {trackingLink}
                      </code>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopyLink(trackingLink, offer.id)}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          {copiedOfferId === offer.id ? 'Скопировано' : 'Скопировать'}
                        </button>
                        <a
                          href={trackingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
                        >
                          Проверить
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-red-600 dark:text-red-300">
                      Нет affiliateId — обновите профиль.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
