"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ContextHelpCard } from "@/features/docs/ContextHelpCard";
import { HelpLink } from "@/features/docs/HelpLink";
import { docsHelpLinks } from "@/features/docs/docs-help-links";
import { useAuth } from "@/context/AuthContext";
import { type ApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { getOfferCategoryLabel } from "@/lib/offerCategories";
import {
  fetchPartnerOffer,
  type PartnerOfferDetail,
  requestPartnerOfferAccess,
} from "@/lib/partnerOffers";
import { buildTrackingUrl } from "@/lib/tracking";

const ACCESS_LABELS: Record<string, string> = {
  full: "Полный доступ",
  restricted: "Ограниченный доступ",
  none: "Нет доступа",
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Публичный",
  private: "Приватный",
  on_request: "По запросу",
};

const GOAL_TYPE_LABELS: Record<string, string> = {
  cpl: "CPL",
  cpa: "CPA",
  cpc: "CPC",
};

function resolveAccessLabel(accessLevel?: string | null) {
  if (!accessLevel) {
    return "Нет доступа";
  }
  return ACCESS_LABELS[accessLevel] ?? accessLevel;
}

function resolveVisibilityLabel(value?: string | null) {
  if (!value) {
    return "—";
  }
  return VISIBILITY_LABELS[value] ?? value;
}

function formatGoalMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value == null) {
    return "—";
  }
  return formatMoney(value, currency ?? "RUB");
}

const sectionCardStyles =
  "rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

export default function PartnerOfferDetailsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const params = useParams<{ offerId?: string | string[] }>();
  const [offer, setOffer] = useState<PartnerOfferDetail | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  const offerIdParam = params?.offerId;
  const offerId = useMemo(() => {
    if (Array.isArray(offerIdParam)) {
      return offerIdParam[0] ?? null;
    }
    return offerIdParam ?? null;
  }, [offerIdParam]);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? `/partner/offers/${offerId ?? ""}`);
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [offerId, pathname]);

  const loadOffer = useCallback(async () => {
    if (!accessToken || !offerId) {
      return;
    }
    setLoadingOffer(true);
    setOfferError(null);
    try {
      const fetched = await fetchPartnerOffer(accessToken, offerId);
      setOffer(fetched);
    } catch (error) {
      const apiError = error as ApiError;
      setOffer(null);
      setOfferError(apiError.message ?? "Не удалось загрузить оффер");
    } finally {
      setLoadingOffer(false);
    }
  }, [accessToken, offerId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!accessToken || !offerId || user?.role !== "affiliate") {
      return;
    }
    void loadOffer();
  }, [accessToken, authLoading, loadOffer, offerId, user?.role]);

  const affiliateId = user?.affiliateId ?? null;
  const trackingLink =
    affiliateId && offerId && offer?.view.type === "full"
      ? `${buildTrackingUrl("/click")}?offerId=${offerId}&affiliateId=${affiliateId}`
      : null;
  const hasFullAccess = offer?.view.type === "full";
  const fullView = offer?.view.type === "full" ? offer.view : null;

  const handleCopyLink = useCallback(async () => {
    if (!trackingLink) {
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingLink);
      } else {
        const temp = document.createElement("textarea");
        temp.value = trackingLink;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Не удалось скопировать ссылку", error);
      setCopied(false);
    }
  }, [trackingLink]);

  const handleRequestAccess = useCallback(async () => {
    if (!accessToken || !offerId) {
      return;
    }

    setRequestingAccess(true);
    setRequestNotice(null);
    try {
      await requestPartnerOfferAccess(accessToken, offerId);
      await loadOffer();
      setRequestNotice("Заявка отправлена");
    } catch (error) {
      const apiError = error as ApiError;
      setRequestNotice(apiError.message ?? "Не удалось отправить заявку");
    } finally {
      setRequestingAccess(false);
    }
  }, [accessToken, loadOffer, offerId]);

  if (!offerId) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Оффер не найден
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Попробуйте вернуться к списку офферов.
        </p>
        <Link
          href="/partner"
          className="mt-4 rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          К списку офферов
        </Link>
      </section>
    );
  }

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <p className="text-sm text-zinc-500">Проверяем авторизацию…</p>
      </section>
    );
  }

  if (!user || !accessToken) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нужна авторизация
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Войдите или зарегистрируйтесь, чтобы увидеть детали оффера.
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

  if (user.role !== "affiliate") {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Кабинет только для партнёров
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Вы авторизованы как администратор. Перейдите в админ-панель.
        </p>
        <Link
          href="/dashboard"
          className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
        >
          В админку
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Partner Offer
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              {offer?.title ?? "Детали оффера"}
            </h1>
            <HelpLink href={docsHelpLinks.partnerOfferDetail} />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {offer ? "Вся актуальная информация по кампании" : "Загружаем данные оффера…"}
          </p>
        </div>
        <Link
          href="/partner"
          className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← Назад к офферам
        </Link>
      </div>

      {offerError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
          <p className="font-medium">{offerError}</p>
          <button
            type="button"
            onClick={() => void loadOffer()}
            className="mt-3 inline-flex rounded-full border border-red-200 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 dark:border-red-400/50 dark:text-red-200 dark:hover:bg-red-400/10"
          >
            Повторить попытку
          </button>
        </div>
      )}

      {loadingOffer && !offer ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Загружаем оффер…
        </div>
      ) : offer ? (
        <div className="space-y-6">
          <div className={sectionCardStyles}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Общая информация
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {offer.title}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Категория:{" "}
                  {getOfferCategoryLabel(offer.category)}
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Доступность: {resolveVisibilityLabel(offer.availability)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-4 py-1 text-xs font-semibold ${
                    offer.status === "active"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {offer.status === "active" ? "Активен" : "Пауза"}
                </span>
                <span className="rounded-full bg-zinc-100 px-4 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                  {resolveAccessLabel(offer.accessLevel)}
                </span>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  visibility
                </dt>
                <dd className="text-sm text-zinc-800 dark:text-zinc-200">
                  {resolveVisibilityLabel(offer.visibilityMode)}
                </dd>
              </div>
              {hasFullAccess && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">
                    targeting
                  </dt>
                  <dd className="text-sm text-zinc-800 dark:text-zinc-200">
                    {offer.targetingStrict
                      ? "Только согласованные GEO"
                      : "Свободный трафик"}
                  </dd>
                </div>
              )}
            </dl>
            {offer.denyReason && (
              <p className="mt-4 text-xs text-red-600 dark:text-red-300">
                Ограничение: {offer.denyReason}
              </p>
            )}
            {!hasFullAccess && (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 px-4 py-4 text-sm dark:border-zinc-700">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  Полный доступ ещё не открыт
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Пока доступно только общее описание. После одобрения откроются цели, выплаты и трекинг.
                </p>
                {offer.requestStatus === "pending" && (
                  <p className="mt-3 text-xs uppercase tracking-wide text-amber-600 dark:text-amber-300">
                    Заявка ожидает рассмотрения
                  </p>
                )}
                {offer.canRequestAccess && offer.availability === "on_request" && (
                  <button
                    type="button"
                    onClick={() => void handleRequestAccess()}
                    disabled={requestingAccess}
                    className="mt-4 rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
                  >
                    {requestingAccess ? "Отправляем..." : "Запросить доступ"}
                  </button>
                )}
                {requestNotice && (
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
                    {requestNotice}
                  </p>
                )}
              </div>
            )}
          </div>

          {offer.description && offer.description.trim() && (
            <div className={sectionCardStyles}>
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Описание оффера
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                  {offer.description}
                </p>
              </div>
            </div>
          )}

          {hasFullAccess && (
            <>
              <div className={sectionCardStyles}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Ссылки
                    </p>
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                      Доступные URL
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Target, fallback и превью ссылки для проверки посадочной.
                    </p>
                  </div>
                </div>
                <div className="mt-6 space-y-3 text-sm">
                  <InfoRow
                    label="Target URL"
                    value={fullView?.targetUrl ?? null}
                  />
                  <InfoRow
                    label="Fallback URL"
                    value={fullView?.fallbackUrl ?? null}
                  />
                  <InfoRow
                    label="Preview URL"
                    value={fullView?.previewUrl ?? null}
                  />
                </div>
              </div>

              <div className={sectionCardStyles}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Трекер
                    </p>
                    <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                      Личная ссылка
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Используйте готовый шаблон для редиректа трафика.
                    </p>
                  </div>
                  {trackingLink && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyLink()}
                        className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {copied ? "Скопировано" : "Скопировать"}
                      </button>
                      <a
                        href={trackingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
                      >
                        Открыть
                      </a>
                    </div>
                  )}
                </div>
                {trackingLink ? (
                  <>
                    <code className="mt-4 block break-all rounded-2xl bg-zinc-50 px-4 py-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                      {trackingLink}
                    </code>
                    <div className="mt-4">
                      <ContextHelpCard
                        title="Не меняйте служебные параметры tracking-ссылки"
                        description="Если изменить click id, offer id или affiliate id, конверсии могут не связаться с кликом."
                        href={docsHelpLinks.partnerTrackingLinks}
                        ctaLabel="Подробнее о tracking-ссылках"
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-xs text-red-600 dark:text-red-300">
                    Нет affiliateId — обновите профиль, чтобы получить трекинг ссылку.
                  </p>
                )}
              </div>
            </>
          )}

              <div className={sectionCardStyles}>
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                Goals
              </p>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Цели и выплаты
              </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Ваша эффективная выплата по каждой цели.
              </p>
            </div>
            {offer.accessLevel !== "full" && (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                Получите полный доступ к офферу, чтобы увидеть цели и тарифы.
              </div>
            )}
            {offer.accessLevel === "full" &&
              (offer.goals && offer.goals.length > 0 ? (
                <div className="mt-6 space-y-4">
                  {offer.goals.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-2xl border border-zinc-200 p-5 text-sm shadow-sm dark:border-zinc-800"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                            {goal.name}
                          </p>
                          <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            {GOAL_TYPE_LABELS[goal.type] ?? goal.type.toUpperCase()}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {goal.isDefault && (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                              Default
                            </span>
                          )}
                          {goal.limitReached && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                              Лимит достигнут
                            </span>
                          )}
                        </div>
                      </div>
                      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-zinc-500">
                            Payout
                          </dt>
                          <dd className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                            {formatGoalMoney(goal.payout, goal.currency)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-zinc-500">
                            Статус
                          </dt>
                          <dd
                            className={`text-base font-semibold ${
                              goal.limitReached
                                ? "text-red-700 dark:text-red-200"
                                : "text-zinc-900 dark:text-zinc-50"
                            }`}
                          >
                            {goal.limitReached ? "Недоступна: лимит достигнут" : "Доступна"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                  Для этого оффера пока нет целей.
                </p>
              ))}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-zinc-300 px-6 py-16 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Нет данных по офферу.
        </div>
      )}
    </section>
  );
}

type InfoRowProps = {
  label: string;
  value: string | null;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="truncate text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-300"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Недоступно
        </span>
      )}
    </div>
  );
}
