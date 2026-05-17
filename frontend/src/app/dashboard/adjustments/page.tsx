'use client';

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { InlineAlert } from '@/components/InlineAlert';
import { useAuth } from '@/context/AuthContext';
import {
  applyAdjustmentBatch,
  getAdjustmentBatchDetail,
  listAdjustmentBatches,
  previewAdjustments,
  type AdjustmentBatch,
  type AdjustmentDetailResponse,
  type AdjustmentPreviewResponse,
  type AdjustmentPreviewRow,
  type AdjustmentType,
} from '@/lib/adjustments';
import {
  CLICK_RESULT_OPTIONS,
  CONVERSION_STATUS_OPTIONS,
  type LookupOption,
} from '@/lib/admin-lists';
import { apiFetch, type ApiError } from '@/lib/api';
import { canAccessAdminArea } from '@/lib/auth/roles';
import { fetchOfferGoals, type OfferGoal } from '@/lib/offers';

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

type SettingsState = {
  type: AdjustmentType;
  partnerMode: 'single_partner' | 'per_row';
  affiliateId: string;
  offerId: string;
  goalId: string;
  defaultStatus: string;
};

const INITIAL_SETTINGS: SettingsState = {
  type: 'conversions',
  partnerMode: 'single_partner',
  affiliateId: '',
  offerId: '',
  goalId: '',
  defaultStatus: 'pending',
};

const CONVERSION_CSV_EXAMPLE = `partner_id,offer_id,goal_id,status,external_id,created_at,comment
#P1,#O2,Lead,approved,ORDER-1001,2026-05-17T10:00:00Z,manual import`;

const CLICK_CSV_EXAMPLE = `partner_id,offer_id,country,sub1,sub2,ip,created_at,comment
#P1,#O2,RU,campaign1,bannerA,127.0.0.1,2026-05-17T10:00:00Z,manual payable click`;

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

function formatGoalLabel(goal: OfferGoal) {
  return goal.name;
}

function formatBatchType(type: AdjustmentType) {
  return type === 'conversions' ? 'Конверсии' : 'Клики';
}

function formatBatchStatus(status: AdjustmentBatch['status']) {
  switch (status) {
    case 'previewed':
      return 'Previewed';
    case 'applied':
      return 'Applied';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function renderResolvedLookup(item?: {
  publicId?: string | null;
  name?: string | null;
} | null) {
  if (!item) {
    return '—';
  }

  if (item.publicId && item.name) {
    return `${item.publicId} · ${item.name}`;
  }

  return item.publicId ?? item.name ?? '—';
}

export default function AdjustmentsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [settings, setSettings] = useState<SettingsState>(INITIAL_SETTINGS);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [affiliates, setAffiliates] = useState<LookupOption[]>([]);
  const [offers, setOffers] = useState<LookupOption[]>([]);
  const [goals, setGoals] = useState<OfferGoal[]>([]);
  const [preview, setPreview] = useState<AdjustmentPreviewResponse | null>(null);
  const [applyDetail, setApplyDetail] = useState<AdjustmentDetailResponse | null>(
    null,
  );
  const [history, setHistory] = useState<AdjustmentBatch[]>([]);
  const [selectedHistoryDetail, setSelectedHistoryDetail] =
    useState<AdjustmentDetailResponse | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Корректировки';
  }, []);

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/adjustments');

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

  const statusOptions =
    settings.type === 'conversions'
      ? CONVERSION_STATUS_OPTIONS
      : CLICK_RESULT_OPTIONS;

  const loadHistory = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await listAdjustmentBatches(accessToken);
      setHistory(response.items);
    } catch (error) {
      const apiError = error as ApiError;
      setHistory([]);
      setHistoryError(apiError.message ?? 'Не удалось загрузить историю batch');
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken]);

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
    ])
      .then(([offersResult, affiliatesResult]) => {
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

        if (
          offersResult.status === 'rejected' ||
          affiliatesResult.status === 'rejected'
        ) {
          setLookupsError('Не удалось загрузить часть справочников.');
        }
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setLookupsLoading(false);
      });

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [accessToken, authLoading, loadHistory, user]);

  useEffect(() => {
    if (!accessToken || !settings.offerId) {
      setGoals([]);
      setGoalsError(null);
      setGoalsLoading(false);
      return;
    }

    let cancelled = false;
    setGoalsLoading(true);
    setGoalsError(null);

    fetchOfferGoals(accessToken, settings.offerId)
      .then((items) => {
        if (cancelled) {
          return;
        }
        setGoals(items);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const apiError = error as ApiError;
        setGoals([]);
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
  }, [accessToken, settings.offerId]);

  useEffect(() => {
    if (
      settings.type === 'clicks' &&
      settings.defaultStatus &&
      !CLICK_RESULT_OPTIONS.some(
        (option) => option.value === settings.defaultStatus,
      )
    ) {
      setSettings((current) => ({ ...current, defaultStatus: '' }));
      return;
    }

    if (
      settings.type === 'conversions' &&
      settings.defaultStatus &&
      !CONVERSION_STATUS_OPTIONS.some(
        (option) => option.value === settings.defaultStatus,
      )
    ) {
      setSettings((current) => ({ ...current, defaultStatus: 'pending' }));
    }
  }, [settings.defaultStatus, settings.type]);

  useEffect(() => {
    if (!settings.goalId) {
      return;
    }

    const hasGoal = goals.some((goal) => goal.id === settings.goalId);
    if (!hasGoal) {
      setSettings((current) => ({ ...current, goalId: '' }));
    }
  }, [goals, settings.goalId]);

  const openBatchDetail = useCallback(
    async (batchId: string) => {
      if (!accessToken) {
        return;
      }

      setDetailLoading(true);
      setDetailError(null);

      try {
        const detail = await getAdjustmentBatchDetail(accessToken, batchId);
        setSelectedHistoryDetail(detail);
      } catch (error) {
        const apiError = error as ApiError;
        setSelectedHistoryDetail(null);
        setDetailError(apiError.message ?? 'Не удалось загрузить batch detail');
      } finally {
        setDetailLoading(false);
      }
    },
    [accessToken],
  );

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setApplyDetail(null);
    setPreviewError(null);
    setApplyError(null);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!accessToken || !selectedFile) {
      setPreviewError('Выберите CSV файл');
      return;
    }

    if (settings.partnerMode === 'single_partner' && !settings.affiliateId) {
      setPreviewError('Выберите партнёра для single-partner режима');
      return;
    }

    setPreviewing(true);
    setPreviewError(null);
    setApplyError(null);
    setPreview(null);
    setApplyDetail(null);

    try {
      const csvText = await selectedFile.text();
      const result = await previewAdjustments(accessToken, {
        type: settings.type,
        partnerMode: settings.partnerMode,
        affiliateId: settings.affiliateId || null,
        offerId: settings.offerId || null,
        goalId: settings.goalId || null,
        defaultStatus: settings.defaultStatus || null,
        originalFilename: selectedFile.name,
        csvText,
      });

      setPreview(result);
      void loadHistory();
    } catch (error) {
      const apiError = error as ApiError;
      setPreviewError(apiError.message ?? 'Не удалось построить preview');
    } finally {
      setPreviewing(false);
    }
  }, [accessToken, loadHistory, selectedFile, settings]);

  const handleApply = useCallback(async () => {
    if (!accessToken || !preview) {
      return;
    }

    setApplying(true);
    setApplyError(null);

    try {
      await applyAdjustmentBatch(accessToken, preview.batch.id);
      const detail = await getAdjustmentBatchDetail(accessToken, preview.batch.id);
      setApplyDetail(detail);
      setPreview((current) =>
        current
          ? {
              ...current,
              batch: detail.batch,
            }
          : current,
      );
      setSelectedHistoryDetail(detail);
      await loadHistory();
    } catch (error) {
      const apiError = error as ApiError;
      setApplyError(apiError.message ?? 'Не удалось применить batch');
    } finally {
      setApplying(false);
    }
  }, [accessToken, loadHistory, preview]);

  const renderPreviewTable = useCallback(
    (rows: AdjustmentPreviewRow[], type: AdjustmentType) => (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
            <tr>
              <th className="px-4 py-3 font-medium">Row</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Партнёр</th>
              <th className="px-4 py-3 font-medium">Оффер</th>
              <th className="px-4 py-3 font-medium">Goal</th>
              <th className="px-4 py-3 font-medium">
                {type === 'conversions' ? 'Status' : 'Result'}
              </th>
              <th className="px-4 py-3 font-medium">Errors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((row) => (
              <tr
                key={`${row.rowNumber}-${row.valid ? 'valid' : 'invalid'}`}
                className="align-top text-zinc-900 dark:text-zinc-100"
              >
                <td className="px-4 py-3 font-mono text-xs">{row.rowNumber}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      row.valid
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                    }`}
                  >
                    {row.valid ? 'Valid' : 'Invalid'}
                  </span>
                </td>
                <td className="px-4 py-3">{renderResolvedLookup(row.resolved.affiliate)}</td>
                <td className="px-4 py-3">{renderResolvedLookup(row.resolved.offer)}</td>
                <td className="px-4 py-3">
                  {row.resolved.goal
                    ? `${row.resolved.goal.name ?? '—'}`
                    : '—'}
                </td>
                <td className="px-4 py-3">{row.resolved.status ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                  {row.errors.length === 0
                    ? '—'
                    : row.errors.map((error) => (
                        <div key={`${row.rowNumber}-${error.field}-${error.code}`}>
                          {error.field}: {error.message}
                        </div>
                      ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    [],
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
          Войдите, чтобы открыть раздел корректировок.
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
          Раздел корректировок доступен только администраторам и менеджерам.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Корректировки
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Preview и применение manual CSV для конверсий и payable clicks.
        </p>
      </div>

      <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Настройки загрузки
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              UUID поддерживаются, но public IDs удобнее для ручного CSV.
            </p>
          </div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing || applying}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-black"
          >
            {previewing ? 'Строим preview…' : 'Preview'}
          </button>
        </div>

        {lookupsError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{lookupsError}</InlineAlert>
          </div>
        ) : null}
        {previewError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{previewError}</InlineAlert>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Тип загрузки
            <select
              value={settings.type}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  type: event.target.value as AdjustmentType,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="conversions">Конверсии</option>
              <option value="clicks">Клики</option>
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Режим партнёра
            <select
              value={settings.partnerMode}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  partnerMode: event.target.value as SettingsState['partnerMode'],
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="single_partner">Один выбранный партнёр</option>
              <option value="per_row">Партнёр в каждой строке</option>
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Партнёр
            <select
              value={settings.affiliateId}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  affiliateId: event.target.value,
                }))
              }
              disabled={lookupsLoading || settings.partnerMode !== 'single_partner'}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">
                {settings.partnerMode === 'single_partner'
                  ? 'Выберите партнёра'
                  : 'Не используется'}
              </option>
              {affiliates.map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {formatLookupLabel(affiliate)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Default offer
            <select
              value={settings.offerId}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  offerId: event.target.value,
                  goalId: '',
                }))
              }
              disabled={lookupsLoading}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Из CSV</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {formatLookupLabel(offer)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Default goal
            <select
              value={settings.goalId}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  goalId: event.target.value,
                }))
              }
              disabled={!settings.offerId || goalsLoading}
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Из CSV</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {formatGoalLabel(goal)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Default {settings.type === 'conversions' ? 'status' : 'result'}
            <select
              value={settings.defaultStatus}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  defaultStatus: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white"
            >
              <option value="">Из CSV</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200 md:col-span-2 xl:col-span-3">
            CSV файл
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="mt-2 block w-full text-sm text-zinc-700 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:text-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
            />
            {selectedFile ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                {selectedFile.name}
              </p>
            ) : null}
          </label>
        </div>

        {goalsError ? (
          <div className="mt-4">
            <InlineAlert variant="error">{goalsError}</InlineAlert>
          </div>
        ) : null}
      </section>

      <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          CSV help
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
            <p>Поддерживаются UUID и public IDs. Для ручной работы public IDs предпочтительнее.</p>
            <p>Партнёр: <span className="font-mono">#P1</span></p>
            <p>Рекламодатель: <span className="font-mono">#A1</span></p>
            <p>Оффер: <span className="font-mono">#O1</span></p>
            <p>Goal: UUID, public ID если появится позже, либо уникальное имя цели внутри оффера.</p>
            <p>Revenue, payout и profit не должны быть trusted values в CSV. Платформа считает деньги сама по goal и rate.</p>
            <p>В single-partner режиме колонка <span className="font-mono">partner_id</span> не нужна. В per-row режиме она обязательна.</p>
          </div>
          <div className="grid gap-4">
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Conversion CSV
              </p>
              <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-4 text-xs text-zinc-100">
                {CONVERSION_CSV_EXAMPLE}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Click CSV
              </p>
              <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-4 text-xs text-zinc-100">
                {CLICK_CSV_EXAMPLE}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Preview
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Невалидные строки не блокируют применение валидных.
            </p>
          </div>
          {preview && preview.batch.validRows > 0 && preview.batch.status === 'previewed' ? (
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applying ? 'Применяем…' : 'Apply'}
            </button>
          ) : null}
        </div>

        {applyError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{applyError}</InlineAlert>
          </div>
        ) : null}

        {!preview ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Загрузите CSV и нажмите Preview.
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Rows</div>
                <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {preview.batch.totalRows}
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Valid</div>
                <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                  {preview.batch.validRows}
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Invalid</div>
                <div className="text-lg font-semibold text-rose-700 dark:text-rose-300">
                  {preview.batch.invalidRows}
                </div>
              </div>
              <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Batch</div>
                <div className="font-mono text-xs text-zinc-700 dark:text-zinc-200">
                  {preview.batch.id}
                </div>
              </div>
            </div>

            {preview.ignoredColumns.length > 0 ? (
              <div className="mb-4">
                <InlineAlert variant="warning" title="Игнорируемые колонки">
                  {preview.ignoredColumns.join(', ')}
                </InlineAlert>
              </div>
            ) : null}

            {preview.hiddenValidRows > 0 ? (
              <div className="mb-4">
                <InlineAlert variant="info">
                  Показаны все invalid rows и первые {preview.rows.length - preview.batch.invalidRows} valid rows. Скрыто valid rows: {preview.hiddenValidRows}.
                </InlineAlert>
              </div>
            ) : null}

            {preview.batch.invalidRows > 0 && preview.batch.validRows > 0 ? (
              <div className="mb-4">
                <InlineAlert variant="warning">
                  При apply будут созданы только valid rows. Invalid rows будут пропущены.
                </InlineAlert>
              </div>
            ) : null}

            {preview.rows.length > 0 ? (
              renderPreviewTable(preview.rows, preview.batch.type)
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                В preview нет строк для отображения.
              </p>
            )}
          </>
        )}
      </section>

      {applyDetail ? (
        <section className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Результат apply
          </h2>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Created</div>
              <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {applyDetail.result?.created ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Skipped</div>
              <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                {applyDetail.result?.skipped ?? 0}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Status</div>
              <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {formatBatchStatus(applyDetail.batch.status)}
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Applied at</div>
              <div className="text-sm text-zinc-700 dark:text-zinc-200">
                {applyDetail.batch.appliedAt
                  ? dateFormatter.format(new Date(applyDetail.batch.appliedAt))
                  : '—'}
              </div>
            </div>
          </div>

          {applyDetail.result && applyDetail.result.errors.length > 0 ? (
            <InlineAlert variant="warning" title="Ошибки apply">
              {applyDetail.result.errors.map((error) => (
                <div key={`${error.rowNumber}-${error.code}`}>
                  Row {error.rowNumber}: {error.message}
                </div>
              ))}
            </InlineAlert>
          ) : (
            <InlineAlert variant="success">
              Batch успешно применён.
            </InlineAlert>
          )}
        </section>
      ) : null}

      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              История batch
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Последние preview и apply.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {historyLoading ? 'Обновляем…' : 'Обновить'}
          </button>
        </div>

        {historyError ? (
          <div className="mb-4">
            <InlineAlert variant="error">{historyError}</InlineAlert>
          </div>
        ) : null}

        {history.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            История пока пустая.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Тип</th>
                  <th className="px-4 py-3 font-medium">Файл</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Counts</th>
                  <th className="px-4 py-3 font-medium">Создал</th>
                  <th className="px-4 py-3 font-medium">Applied</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {history.map((batch) => (
                  <tr key={batch.id} className="text-zinc-900 dark:text-zinc-100">
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {batch.createdAt
                        ? dateFormatter.format(new Date(batch.createdAt))
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{formatBatchType(batch.type)}</td>
                    <td className="px-4 py-3">{batch.originalFilename ?? '—'}</td>
                    <td className="px-4 py-3">{formatBatchStatus(batch.status)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300">
                      <div>Total: {batch.totalRows}</div>
                      <div>Valid: {batch.validRows}</div>
                      <div>Invalid: {batch.invalidRows}</div>
                      <div>Created: {batch.createdRows}</div>
                      <div>Skipped: {batch.skippedRows}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {batch.createdBy?.name ?? batch.createdBy?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {batch.appliedAt
                        ? dateFormatter.format(new Date(batch.appliedAt))
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openBatchDetail(batch.id)}
                        className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Подробнее
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detailError ? (
          <div className="mt-4">
            <InlineAlert variant="error">{detailError}</InlineAlert>
          </div>
        ) : null}

        {detailLoading ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Загружаем batch detail…
          </p>
        ) : null}

        {selectedHistoryDetail ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Batch detail
            </h3>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Batch ID</div>
                <div className="font-mono text-xs text-zinc-700 dark:text-zinc-200">
                  {selectedHistoryDetail.batch.id}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Тип</div>
                <div className="text-sm text-zinc-700 dark:text-zinc-200">
                  {formatBatchType(selectedHistoryDetail.batch.type)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Статус</div>
                <div className="text-sm text-zinc-700 dark:text-zinc-200">
                  {formatBatchStatus(selectedHistoryDetail.batch.status)}
                </div>
              </div>
            </div>

            {selectedHistoryDetail.preview ? (
              <>
                {selectedHistoryDetail.preview.ignoredColumns.length > 0 ? (
                  <div className="mb-4">
                    <InlineAlert variant="warning">
                      Игнорируемые колонки: {selectedHistoryDetail.preview.ignoredColumns.join(', ')}
                    </InlineAlert>
                  </div>
                ) : null}
                {selectedHistoryDetail.preview.hiddenValidRows > 0 ? (
                  <div className="mb-4">
                    <InlineAlert variant="info">
                      Скрыто valid rows: {selectedHistoryDetail.preview.hiddenValidRows}.
                    </InlineAlert>
                  </div>
                ) : null}
                {renderPreviewTable(
                  selectedHistoryDetail.preview.rows,
                  selectedHistoryDetail.batch.type,
                )}
              </>
            ) : null}

            {selectedHistoryDetail.result ? (
              <div className="mt-5">
                <div className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  Result: created {selectedHistoryDetail.result.created}, skipped {selectedHistoryDetail.result.skipped}
                </div>
                {selectedHistoryDetail.result.errors.length > 0 ? (
                  <InlineAlert variant="warning" title="Ошибки batch">
                    {selectedHistoryDetail.result.errors.map((error) => (
                      <div key={`${error.rowNumber}-${error.code}`}>
                        Row {error.rowNumber}: {error.message}
                      </div>
                    ))}
                  </InlineAlert>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  );
}
