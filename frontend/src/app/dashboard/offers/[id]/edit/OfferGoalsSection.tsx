'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import {
  OFFER_GOAL_LIMIT_TYPES,
  OFFER_GOAL_TYPES,
  type OfferGoal,
  type OfferGoalAffiliateRate,
  type OfferGoalLimitType,
  type OfferGoalPayload,
  type OfferGoalType,
  createOfferGoal,
  deleteOfferGoalAffiliateRate,
  fetchOfferGoalAffiliateRates,
  fetchOfferGoals,
  updateOfferGoal,
  upsertOfferGoalAffiliateRate,
} from '@/lib/offers';

type GoalFormValues = {
  name: string;
  type: OfferGoalType;
  revenue: string;
  payout: string;
  isDefault: boolean;
  limitEnabled: boolean;
  limitType: OfferGoalLimitType;
  limitValue: string;
};

type GoalFormErrors = Partial<Record<keyof GoalFormValues | 'form', string>>;

type ModalState =
  | { mode: 'create' }
  | { mode: 'edit'; goal: OfferGoal }
  | null;

type OfferGoalsSectionProps = {
  offerId: string;
  token: string;
};

type AffiliateOption = {
  id: string;
  publicId: string | null;
  name: string;
  email: string;
};

type AffiliateRateFormValues = {
  affiliateId: string;
  revenue: string;
  payout: string;
};

type AffiliateRateFormErrors = Partial<
  Record<keyof AffiliateRateFormValues | 'form', string>
>;

const typeLabels: Record<OfferGoalType, string> = {
  cpl: 'CPL',
  cpa: 'CPA',
  cpc: 'CPC',
};

const limitTypeLabels: Record<OfferGoalLimitType, string> = {
  conversions_count: 'Количество конверсий',
};

function formatMoney(value: number, currency?: string | null) {
  const formatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatter.format(value)} ${currency ?? 'RUB'}`;
}

function parseMoneyInput(value: string) {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function formatPreviewProfit(revenue: string, payout: string) {
  const revenueValue = parseMoneyInput(revenue);
  const payoutValue = parseMoneyInput(payout);

  if (revenueValue === null || payoutValue === null) {
    return '—';
  }

  return formatMoney(Number((revenueValue - payoutValue).toFixed(2)));
}

function formatAffiliateLabel(affiliate: {
  publicId: string | null;
  name: string | null;
  email: string | null;
}) {
  const parts = [
    affiliate.publicId ?? null,
    affiliate.name || null,
    affiliate.email || null,
  ].filter(Boolean);

  return parts.join(' • ');
}

export function OfferGoalsSection({ offerId, token }: OfferGoalsSectionProps) {
  const [goals, setGoals] = useState<OfferGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [affiliateOptions, setAffiliateOptions] = useState<AffiliateOption[]>([]);

  const loadGoals = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!offerId || !token) {
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setGoalsLoading(true);
      }

      setGoalsError(null);

      try {
        const items = await fetchOfferGoals(token, offerId);
        setGoals(items);
      } catch (error) {
        const apiError = error as ApiError;
        setGoalsError(apiError.message ?? 'Не удалось загрузить цели');
        setGoals([]);
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setGoalsLoading(false);
        }
      }
    },
    [offerId, token],
  );

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  useEffect(() => {
    if (!offerId || !token) {
      return;
    }

    let active = true;

    apiFetch<AffiliateOption[]>('/affiliates?limit=100&offset=0', {
      token,
    })
      .then((items) => {
        if (!active) {
          return;
        }
        setAffiliateOptions(items);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setAffiliateOptions([]);
      });

    return () => {
      active = false;
    };
  }, [offerId, token]);

  const modalInitialValues = useMemo<GoalFormValues>(() => {
    if (modalState?.mode === 'edit') {
      return {
        name: modalState.goal.name,
        type: modalState.goal.type,
        revenue: modalState.goal.revenue.toString(),
        payout: modalState.goal.payout.toString(),
        isDefault: modalState.goal.isDefault,
        limitEnabled: modalState.goal.limitEnabled,
        limitType: modalState.goal.limitType ?? 'conversions_count',
        limitValue:
          modalState.goal.limitValue !== null
            ? String(modalState.goal.limitValue)
            : '',
      };
    }

    return {
      name: '',
      type: 'cpl',
      revenue: '',
      payout: '',
      isDefault: goals.length === 0,
      limitEnabled: false,
      limitType: 'conversions_count',
      limitValue: '',
    };
  }, [goals.length, modalState]);

  const handleCreateGoal = useCallback(
    async (payload: OfferGoalPayload) => {
      await createOfferGoal(token, offerId, payload);
      await loadGoals({ silent: true });
    },
    [loadGoals, offerId, token],
  );

  const handleUpdateGoal = useCallback(
    async (goalId: string, payload: OfferGoalPayload) => {
      await updateOfferGoal(token, offerId, goalId, payload);
      await loadGoals({ silent: true });
    },
    [loadGoals, offerId, token],
  );

  return (
    <>
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Goals</p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Цели оффера
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Базовые ставки, лимиты и персональные условия по партнёрам.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {refreshing && (
              <span className="text-xs uppercase tracking-wide text-zinc-500">
                Обновляем список...
              </span>
            )}
            <button
              type="button"
              onClick={() => setModalState({ mode: 'create' })}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black"
            >
              Добавить goal
            </button>
          </div>
        </div>

        <div className="mt-6">
          {goalsLoading ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Загружаем цели оффера...
            </div>
          ) : goalsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200">
              <p className="mb-2">{goalsError}</p>
              <button
                type="button"
                onClick={() => void loadGoals()}
                className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 dark:border-red-400/50 dark:text-red-200 dark:hover:bg-red-400/10"
              >
                Повторить попытку
              </button>
            </div>
          ) : goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              <p className="mb-3">У оффера пока нет целей.</p>
              <button
                type="button"
                onClick={() => setModalState({ mode: 'create' })}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Добавить первую goal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  offerId={offerId}
                  token={token}
                  affiliateOptions={affiliateOptions}
                  onEdit={() => setModalState({ mode: 'edit', goal })}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {modalState && (
        <GoalFormModal
          mode={modalState.mode}
          initialValues={modalInitialValues}
          onClose={() => setModalState(null)}
          title={
            modalState.mode === 'edit'
              ? `Редактировать ${modalState.goal.name}`
              : 'Новая goal'
          }
          onSubmit={async (values) => {
            if (modalState.mode === 'edit') {
              await handleUpdateGoal(modalState.goal.id, values);
            } else {
              await handleCreateGoal(values);
            }
          }}
        />
      )}
    </>
  );
}

type GoalCardProps = {
  goal: OfferGoal;
  offerId: string;
  token: string;
  affiliateOptions: AffiliateOption[];
  onEdit: () => void;
};

function GoalCard({
  goal,
  offerId,
  token,
  affiliateOptions,
  onEdit,
}: GoalCardProps) {
  const badgeClass =
    'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {goal.name}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`${badgeClass} border-zinc-300 text-zinc-600 dark:border-zinc-600`}>
              {typeLabels[goal.type]}
            </span>
            {goal.isDefault && (
              <span className={`${badgeClass} border-amber-200 text-amber-700 dark:border-amber-400 dark:text-amber-300`}>
                Default
              </span>
            )}
            {goal.limitReached && (
              <span className={`${badgeClass} border-red-200 text-red-700 dark:border-red-400 dark:text-red-300`}>
                Лимит достигнут
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="self-start rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Редактировать
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <MetricCard
          label="Revenue"
          value={formatMoney(goal.revenue, goal.currency)}
        />
        <MetricCard
          label="Payout"
          value={formatMoney(goal.payout, goal.currency)}
        />
        <MetricCard
          label="Profit"
          value={formatMoney(goal.profit, goal.currency)}
        />
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
        <MetricCard
          label="Лимит"
          value={
            goal.limitEnabled
              ? limitTypeLabels[goal.limitType ?? 'conversions_count']
              : 'Выключен'
          }
        />
        <MetricCard
          label="Значение"
          value={goal.limitValue !== null ? String(goal.limitValue) : '—'}
        />
        <MetricCard
          label="Использовано"
          value={String(goal.limitUsed)}
        />
        <MetricCard
          label="Осталось"
          value={
            goal.limitRemaining !== null ? String(goal.limitRemaining) : '—'
          }
        />
      </div>

      <GoalAffiliateRatesSection
        offerId={offerId}
        goal={goal}
        token={token}
        affiliateOptions={affiliateOptions}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

type GoalAffiliateRatesSectionProps = {
  offerId: string;
  goal: OfferGoal;
  token: string;
  affiliateOptions: AffiliateOption[];
};

function GoalAffiliateRatesSection({
  offerId,
  goal,
  token,
  affiliateOptions,
}: GoalAffiliateRatesSectionProps) {
  const [rates, setRates] = useState<OfferGoalAffiliateRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<OfferGoalAffiliateRate | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AffiliateRateFormValues>({
    affiliateId: '',
    revenue: '',
    payout: '',
  });
  const [formErrors, setFormErrors] = useState<AffiliateRateFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState<string | null>(null);

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchOfferGoalAffiliateRates(token, offerId, goal.id);
      setRates(items);
    } catch (loadError) {
      const apiError = loadError as ApiError;
      setError(apiError.message ?? 'Не удалось загрузить персональные ставки');
      setRates([]);
    } finally {
      setLoading(false);
    }
  }, [goal.id, offerId, token]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const profitPreview = useMemo(
    () => formatPreviewProfit(form.revenue, form.payout),
    [form.payout, form.revenue],
  );

  const resetForm = useCallback(() => {
    setEditingRate(null);
    setFormOpen(false);
    setForm({
      affiliateId: '',
      revenue: '',
      payout: '',
    });
    setFormErrors({});
  }, []);

  const openCreateForm = () => {
    setEditingRate(null);
    setFormOpen(true);
    setForm({
      affiliateId: '',
      revenue: goal.revenue.toString(),
      payout: goal.payout.toString(),
    });
    setFormErrors({});
  };

  const openEditForm = (rate: OfferGoalAffiliateRate) => {
    setEditingRate(rate);
    setFormOpen(true);
    setForm({
      affiliateId: rate.affiliateId,
      revenue: rate.revenue.toString(),
      payout: rate.payout.toString(),
    });
    setFormErrors({});
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormErrors({});

    const nextErrors: AffiliateRateFormErrors = {};
    const revenue = parseMoneyInput(form.revenue);
    const payout = parseMoneyInput(form.payout);

    if (!form.affiliateId) {
      nextErrors.affiliateId = 'Выберите партнёра';
    }

    if (revenue === null || revenue < 0) {
      nextErrors.revenue = 'Введите корректную сумму от 0';
    }

    if (payout === null || payout < 0) {
      nextErrors.payout = 'Введите корректную сумму от 0';
    }

    if (revenue !== null && payout !== null && payout > revenue) {
      nextErrors.payout = 'Payout не может быть больше revenue';
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    setSubmitting(true);

    try {
      await upsertOfferGoalAffiliateRate(token, offerId, goal.id, form.affiliateId, {
        revenue: revenue ?? 0,
        payout: payout ?? 0,
      });
      await loadRates();
      resetForm();
    } catch (submitError) {
      const apiError = submitError as ApiError;
      if (apiError.code === 'VALIDATION_ERROR') {
        const validationErrors =
          (
            apiError.details as
              | { errors?: Array<{ field?: string | null; message?: string }> }
              | null
          )?.errors ?? [];
        const nextFieldErrors: AffiliateRateFormErrors = {};
        validationErrors.forEach(({ field, message }) => {
          if (!field || !message) {
            return;
          }
          if (field === 'affiliateId' || field === 'revenue' || field === 'payout') {
            nextFieldErrors[field] = message;
          }
        });
        nextFieldErrors.form =
          nextFieldErrors.form ??
          apiError.message ??
          'Не удалось сохранить персональную ставку';
        setFormErrors(nextFieldErrors);
      } else {
        setFormErrors({
          form: apiError.message ?? 'Не удалось сохранить персональную ставку',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rate: OfferGoalAffiliateRate) => {
    setDeletingRateId(rate.id);
    try {
      await deleteOfferGoalAffiliateRate(token, offerId, goal.id, rate.affiliateId);
      await loadRates();
      if (editingRate?.id === rate.id) {
        resetForm();
      }
    } catch (deleteError) {
      const apiError = deleteError as ApiError;
      setError(apiError.message ?? 'Не удалось удалить персональную ставку');
    } finally {
      setDeletingRateId(null);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Partner Rates
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            База: {formatMoney(goal.revenue, goal.currency)} / {formatMoney(goal.payout, goal.currency)}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="self-start rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Добавить override
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Загружаем персональные ставки...
        </p>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : rates.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Переопределений пока нет.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rates.map((rate) => (
            <div
              key={rate.id}
              className="rounded-2xl border border-zinc-200 px-4 py-4 dark:border-zinc-700"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {rate.affiliate
                      ? formatAffiliateLabel(rate.affiliate)
                      : rate.affiliateId}
                    </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Revenue: {formatMoney(rate.revenue, rate.currency)} · Payout:{' '}
                    {formatMoney(rate.payout, rate.currency)} · Profit:{' '}
                    {formatMoney(rate.profit, rate.currency)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(rate)}
                    className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(rate)}
                    disabled={deletingRateId === rate.id}
                    className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-60 dark:border-red-400/50 dark:text-red-200 dark:hover:bg-red-400/10"
                  >
                    {deletingRateId === rate.id ? 'Удаляем...' : 'Удалить'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor={`affiliate-${goal.id}`}>
                Партнёр
              </label>
              <select
                id={`affiliate-${goal.id}`}
                value={form.affiliateId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, affiliateId: event.target.value }))
                }
                disabled={Boolean(editingRate)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="">Выберите партнёра</option>
                {affiliateOptions.map((affiliate) => (
                  <option key={affiliate.id} value={affiliate.id}>
                    {formatAffiliateLabel(affiliate)}
                  </option>
                ))}
              </select>
              {formErrors.affiliateId && (
                <p className="text-sm text-red-600">{formErrors.affiliateId}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor={`affiliate-revenue-${goal.id}`}>
                Revenue, RUB
              </label>
              <input
                id={`affiliate-revenue-${goal.id}`}
                inputMode="decimal"
                value={form.revenue}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, revenue: event.target.value.slice(0, 20) }))
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              {formErrors.revenue && (
                <p className="text-sm text-red-600">{formErrors.revenue}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor={`affiliate-payout-${goal.id}`}>
                Payout, RUB
              </label>
              <input
                id={`affiliate-payout-${goal.id}`}
                inputMode="decimal"
                value={form.payout}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, payout: event.target.value.slice(0, 20) }))
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              {formErrors.payout && (
                <p className="text-sm text-red-600">{formErrors.payout}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Profit
              </p>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
                {profitPreview}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Предпросмотр. Источник истины для profit остаётся на backend.
              </p>
            </div>
          </div>

          {formErrors.form && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200">
              {formErrors.form}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {submitting
                ? 'Сохраняем...'
                : editingRate
                  ? 'Сохранить override'
                  : 'Добавить override'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

type GoalFormModalProps = {
  mode: 'create' | 'edit';
  initialValues: GoalFormValues;
  onSubmit: (payload: OfferGoalPayload) => Promise<void>;
  onClose: () => void;
  title: string;
};

function GoalFormModal({
  mode,
  initialValues,
  onSubmit,
  onClose,
  title,
}: GoalFormModalProps) {
  const [form, setForm] = useState<GoalFormValues>(initialValues);
  const [errors, setErrors] = useState<GoalFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(initialValues);
    setErrors({});
  }, [initialValues, mode]);

  const profitPreview = useMemo(
    () => formatPreviewProfit(form.revenue, form.payout),
    [form.payout, form.revenue],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const nextErrors: GoalFormErrors = {};
    const trimmedName = form.name.trim();
    const revenue = parseMoneyInput(form.revenue);
    const payout = parseMoneyInput(form.payout);

    if (!trimmedName) {
      nextErrors.name = 'Укажите название goal';
    }

    if (revenue === null || revenue < 0) {
      nextErrors.revenue = 'Введите корректную сумму от 0';
    }

    if (payout === null || payout < 0) {
      nextErrors.payout = 'Введите корректную сумму от 0';
    }

    if (revenue !== null && payout !== null && payout > revenue) {
      nextErrors.payout = 'Payout не может быть больше revenue';
    }

    let normalizedLimitValue: number | null = null;
    if (form.limitEnabled) {
      if (!OFFER_GOAL_LIMIT_TYPES.includes(form.limitType)) {
        nextErrors.limitType = 'Выберите тип лимита';
      }

      const parsedLimitValue = Number.parseInt(form.limitValue, 10);
      if (!Number.isInteger(parsedLimitValue) || parsedLimitValue <= 0) {
        nextErrors.limitValue = 'Введите положительное целое число';
      } else {
        normalizedLimitValue = parsedLimitValue;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        name: trimmedName,
        type: form.type,
        revenue: revenue ?? 0,
        payout: payout ?? 0,
        isDefault: form.isDefault,
        limitEnabled: form.limitEnabled,
        limitType: form.limitEnabled ? form.limitType : null,
        limitValue: form.limitEnabled ? normalizedLimitValue : null,
      });
      onClose();
    } catch (submitError) {
      const apiError = submitError as ApiError;
      if (apiError.code === 'VALIDATION_ERROR') {
        const validationErrors =
          (
            apiError.details as
              | { errors?: Array<{ field?: string | null; message?: string }> }
              | null
          )?.errors ?? [];
        const nextFieldErrors: GoalFormErrors = {};

        validationErrors.forEach(({ field, message }) => {
          if (!field || !message) {
            return;
          }

          if (
            field === 'name' ||
            field === 'type' ||
            field === 'revenue' ||
            field === 'payout' ||
            field === 'isDefault' ||
            field === 'limitEnabled' ||
            field === 'limitType' ||
            field === 'limitValue'
          ) {
            nextFieldErrors[field] = message;
            return;
          }

          nextFieldErrors.form = message;
        });

        if (Object.keys(nextFieldErrors).length === 0) {
          nextFieldErrors.form =
            apiError.message ?? 'Не удалось сохранить goal';
        }

        setErrors(nextFieldErrors);
      } else {
        setErrors({
          form: apiError.message ?? 'Не удалось сохранить goal',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Goal Settings
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Закрыть
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalName">
              Название
            </label>
            <input
              id="goalName"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalType">
                Тип
              </label>
              <select
                id="goalType"
                value={form.type}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    type: event.target.value as OfferGoalType,
                  }))
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                {OFFER_GOAL_TYPES.map((goalType) => (
                  <option key={goalType} value={goalType}>
                    {typeLabels[goalType]}
                  </option>
                ))}
              </select>
              {errors.type && <p className="text-sm text-red-600">{errors.type}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalRevenue">
                Revenue, RUB
              </label>
              <input
                id="goalRevenue"
                inputMode="decimal"
                value={form.revenue}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, revenue: event.target.value.slice(0, 20) }))
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              {errors.revenue && <p className="text-sm text-red-600">{errors.revenue}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalPayout">
                Payout, RUB
              </label>
              <input
                id="goalPayout"
                inputMode="decimal"
                value={form.payout}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, payout: event.target.value.slice(0, 20) }))
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
              {errors.payout && <p className="text-sm text-red-600">{errors.payout}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Profit
              </p>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
                {profitPreview}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Предпросмотр. Источник истины для profit остаётся на backend.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <input
                id="goalDefault"
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, isDefault: event.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600"
              />
              <div>
                <label
                  htmlFor="goalDefault"
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
                >
                  Сделать goal по умолчанию
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  У оффера может быть только одна goal по умолчанию.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <input
                id="goalLimitEnabled"
                type="checkbox"
                checked={form.limitEnabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, limitEnabled: event.target.checked }))
                }
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600"
              />
              <div>
                <label
                  htmlFor="goalLimitEnabled"
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
                >
                  Включить лимит цели
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  После достижения лимита backend начнёт отклонять новые конверсии по этой цели.
                </p>
              </div>
            </div>

            {form.limitEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalLimitType">
                    Тип лимита
                  </label>
                  <select
                    id="goalLimitType"
                    value={form.limitType}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        limitType: event.target.value as OfferGoalLimitType,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  >
                    {OFFER_GOAL_LIMIT_TYPES.map((limitType) => (
                      <option key={limitType} value={limitType}>
                        {limitTypeLabels[limitType]}
                      </option>
                    ))}
                  </select>
                  {errors.limitType && (
                    <p className="text-sm text-red-600">{errors.limitType}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalLimitValue">
                    Значение лимита
                  </label>
                  <input
                    id="goalLimitValue"
                    inputMode="numeric"
                    value={form.limitValue}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        limitValue: event.target.value.replace(/[^\d]/g, '').slice(0, 9),
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                  {errors.limitValue && (
                    <p className="text-sm text-red-600">{errors.limitValue}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {errors.form && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200">
              {errors.form}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black"
            >
              {submitting
                ? 'Сохраняем...'
                : mode === 'create'
                  ? 'Создать goal'
                  : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
