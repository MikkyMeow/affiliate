'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiError } from '@/lib/api';
import {
  OFFER_GOAL_TYPES,
  type OfferGoal,
  type OfferGoalPayload,
  type OfferGoalType,
  createOfferGoal,
  fetchOfferGoals,
  updateOfferGoal,
} from '@/lib/offers';

type GoalFormValues = {
  name: string;
  type: OfferGoalType;
  revenue: string;
  payout: string;
  isDefault: boolean;
  isActive: boolean;
};

type GoalFormErrors = Partial<Record<keyof GoalFormValues | 'form', string>>;

type ModalState =
  | { mode: 'create' }
  | {
      mode: 'edit';
      goal: OfferGoal;
    }
  | null;

type OfferGoalsSectionProps = {
  offerId: string;
  token: string;
};

const typeLabels: Record<OfferGoalType, string> = {
  cpl: 'CPL',
  cpa: 'CPA',
  cpc: 'CPC',
};

function formatMoney(value: number, currency?: string | null) {
  const formatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatter.format(value)} ${currency ?? 'RUB'}`;
}

export function OfferGoalsSection({ offerId, token }: OfferGoalsSectionProps) {
  const [goals, setGoals] = useState<OfferGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);

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
        const message = apiError.message ?? 'Не удалось загрузить цели';
        setGoalsError(message);
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

  const openCreateModal = () => setModalState({ mode: 'create' });

  const openEditModal = (goal: OfferGoal) => setModalState({ mode: 'edit', goal });

  const closeModal = () => setModalState(null);

  const handleCreateGoal = useCallback(
    async (payload: OfferGoalPayload) => {
      await createOfferGoal(token, offerId, payload);
      await loadGoals({ silent: true });
    },
    [offerId, token, loadGoals],
  );

  const handleUpdateGoal = useCallback(
    async (goalId: string, payload: OfferGoalPayload) => {
      await updateOfferGoal(token, offerId, goalId, payload);
      await loadGoals({ silent: true });
    },
    [offerId, token, loadGoals],
  );

  const modalInitialValues = useMemo<GoalFormValues>(() => {
    if (modalState?.mode === 'edit' && modalState.goal) {
      return {
        name: modalState.goal.name,
        type: modalState.goal.type,
        revenue: modalState.goal.revenue.toString(),
        payout: modalState.goal.payout.toString(),
        isDefault: modalState.goal.isDefault,
        isActive: modalState.goal.isActive,
      };
    }

    return {
      name: '',
      type: 'cpl',
      revenue: '',
      payout: '',
      isDefault: goals.length === 0,
      isActive: true,
    };
  }, [modalState, goals.length]);

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
              Управляйте выплатами и статусами, чтобы партнёры знали актуальные условия.
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
              onClick={openCreateModal}
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
                onClick={openCreateModal}
                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Добавить первую goal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onEdit={() => openEditModal(goal)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {modalState && (
        <GoalFormModal
          mode={modalState.mode}
          initialValues={modalInitialValues}
          onClose={closeModal}
          goalName={
            modalState.mode === 'edit' ? `Редактировать ${modalState.goal.name}` : 'Новая goal'
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
  onEdit: () => void;
};

function GoalCard({ goal, onEdit }: GoalCardProps) {
  const isInactive = !goal.isActive;
  const badgeClass =
    'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide';

  return (
    <div
      className={`rounded-2xl border px-4 py-4 transition ${
        isInactive
          ? 'border-zinc-300/80 bg-zinc-50/60 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400'
          : 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{goal.name}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`${badgeClass} border-zinc-300 text-zinc-600 dark:border-zinc-600`}>
              {typeLabels[goal.type]}
            </span>
            {goal.isDefault && (
              <span className={`${badgeClass} border-amber-200 text-amber-700 dark:border-amber-400 dark:text-amber-300`}>
                Default
              </span>
            )}
            {!goal.isActive && (
              <span className={`${badgeClass} border-zinc-400 text-zinc-500 dark:border-zinc-600 dark:text-zinc-300`}>
                Inactive
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
        <div className="rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Выплата рекламодателя</p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMoney(goal.revenue, goal.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Выплата партнёру</p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMoney(goal.payout, goal.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Статус</p>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {goal.isActive ? 'Активна' : 'Неактивна'}
          </p>
        </div>
      </div>
    </div>
  );
}

type GoalFormModalProps = {
  mode: 'create' | 'edit';
  initialValues: GoalFormValues;
  onSubmit: (payload: OfferGoalPayload) => Promise<void>;
  onClose: () => void;
  goalName: string;
};

function GoalFormModal({ mode, initialValues, onSubmit, onClose, goalName }: GoalFormModalProps) {
  const [form, setForm] = useState<GoalFormValues>(initialValues);
  const [errors, setErrors] = useState<GoalFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(initialValues);
    setErrors({});
  }, [initialValues, mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const fieldErrors: GoalFormErrors = {};
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      fieldErrors.name = 'Укажите название goal';
    }

    const type = OFFER_GOAL_TYPES.includes(form.type) ? form.type : 'cpl';

    const revenue = Number.parseFloat(form.revenue.replace(',', '.'));
    if (!Number.isFinite(revenue) || revenue < 0) {
      fieldErrors.revenue = 'Введите корректную сумму от 0';
    }

    const payout = Number.parseFloat(form.payout.replace(',', '.'));
    if (!Number.isFinite(payout) || payout < 0) {
      fieldErrors.payout = 'Введите корректную сумму от 0';
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: trimmedName,
        type,
        revenue: Number(revenue.toFixed(2)),
        payout: Number(payout.toFixed(2)),
        isDefault: form.isDefault,
        isActive: form.isActive,
      });
      onClose();
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.code === 'VALIDATION_ERROR') {
        const validationErrors =
          (apiError.details as { errors?: Array<{ field?: string | null; message?: string }> } | null)
            ?.errors ?? [];
        const fieldErrors: GoalFormErrors = {};
        validationErrors.forEach(({ field, message }) => {
          if (!message) {
            return;
          }
          switch (field) {
            case 'name':
            case 'type':
            case 'revenue':
            case 'payout':
            case 'isDefault':
            case 'isActive':
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
      } else {
        const message = apiError.message ?? 'Не удалось сохранить goal';
        setErrors({ form: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        role="button"
        tabIndex={-1}
        aria-label="Закрыть окно"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {mode === 'create' ? 'Новая цель' : 'Редактирование цели'}
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {goalName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 p-2 text-sm text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalName">
              Название
            </label>
            <input
              id="goalName"
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.slice(0, 200) }))}
              placeholder="Например, Регистрация"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalType">
                Тип
              </label>
              <select
                id="goalType"
                value={form.type}
                onChange={(event) => {
                  const next = event.target.value.toLowerCase() as OfferGoalType;
                  setForm((prev) => ({ ...prev, type: OFFER_GOAL_TYPES.includes(next) ? next : prev.type }));
                }}
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
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
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalPayout">
                Выплата партнёру
              </label>
              <input
                id="goalPayout"
                type="number"
                min="0"
                step="0.01"
                value={form.payout}
                onChange={(event) => setForm((prev) => ({ ...prev, payout: event.target.value.slice(0, 20) }))}
                placeholder="500"
                className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
              />
              {errors.payout && <p className="text-sm text-red-600">{errors.payout}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="goalRevenue">
              Выплата рекламодателя
            </label>
            <input
              id="goalRevenue"
              type="number"
              min="0"
              step="0.01"
              value={form.revenue}
              onChange={(event) => setForm((prev) => ({ ...prev, revenue: event.target.value.slice(0, 20) }))}
              placeholder="650"
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white"
            />
            {errors.revenue && <p className="text-sm text-red-600">{errors.revenue}</p>}
          </div>

          <div className="space-y-2 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) => setForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-transparent dark:text-white dark:focus:ring-white"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-200">
                Сделать goal по умолчанию
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                  Можно выбрать только одну goal по умолчанию. После сохранения сервер снимет флаг
                  с остальных целей автоматически.
                </span>
              </span>
            </label>
            {errors.isDefault && <p className="text-sm text-red-600">{errors.isDefault}</p>}
          </div>

          <div className="space-y-2 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700 dark:bg-transparent dark:text-white dark:focus:ring-white"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-200">
                Goal активна
                <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                  Неактивные цели остаются в списке, но помечаются и не используются при генерации
                  новых постбеков.
                </span>
              </span>
            </label>
            {errors.isActive && <p className="text-sm text-red-600">{errors.isActive}</p>}
          </div>

          {errors.form && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
              {errors.form}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? 'Сохраняем...' : mode === 'create' ? 'Создать goal' : 'Сохранить изменения'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full rounded-2xl border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:w-auto"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
