"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ApiError } from "@/lib/api";
import {
  COUNTRY_NAME_BY_CODE,
  COUNTRY_OPTIONS,
  formatCountryLabel,
} from "@/lib/countries";
import {
  OfferGeoRule,
  OfferGeoRuleType,
  createOfferGeoRule,
  deleteOfferGeoRule,
  fetchOfferGeoRules,
  updateOfferTargetingStrict,
} from "@/lib/offers";

type OfferGeoTargetingSectionProps = {
  offerId: string;
  token: string;
  targetingStrict: boolean;
  fallbackUrl: string | null;
  onTargetingStrictChange?: (value: boolean) => void;
};

function sortByCountryName(a: OfferGeoRule, b: OfferGeoRule) {
  const nameA = COUNTRY_NAME_BY_CODE[a.countryCode] ?? a.countryCode;
  const nameB = COUNTRY_NAME_BY_CODE[b.countryCode] ?? b.countryCode;
  return nameA.localeCompare(nameB);
}

function RuleBadge({
  rule,
  onRemove,
  disabled,
}: {
  rule: OfferGeoRule;
  onRemove: (rule: OfferGeoRule) => void;
  disabled: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {formatCountryLabel(rule.countryCode)}
      <button
        type="button"
        aria-label="Удалить страну"
        onClick={() => onRemove(rule)}
        disabled={disabled}
        className="ui-button rounded-full p-1 text-xs text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-white"
      >
        ×
      </button>
    </span>
  );
}

export function OfferGeoTargetingSection({
  offerId,
  token,
  targetingStrict,
  fallbackUrl,
  onTargetingStrictChange,
}: OfferGeoTargetingSectionProps) {
  const [rules, setRules] = useState<OfferGeoRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedAllow, setSelectedAllow] = useState("");
  const [selectedDeny, setSelectedDeny] = useState("");
  const [addingRule, setAddingRule] = useState<OfferGeoRuleType | null>(null);
  const [removingRuleIds, setRemovingRuleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [strictValue, setStrictValue] = useState(targetingStrict);
  const [strictError, setStrictError] = useState<string | null>(null);
  const [savingStrict, setSavingStrict] = useState(false);

  const loadRules = useCallback(async () => {
    if (!offerId || !token) {
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const items = await fetchOfferGeoRules(token, offerId);
      setRules(items);
    } catch (error) {
      const apiError = error as ApiError;
      const message =
        apiError.message ??
        "Не удалось загрузить гео-правила. Попробуйте позже.";
      setLoadError(message);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [offerId, token]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  useEffect(() => {
    setStrictValue(targetingStrict);
  }, [targetingStrict]);

  useEffect(() => {
    if (
      selectedAllow &&
      rules.some((rule) => rule.countryCode === selectedAllow)
    ) {
      setSelectedAllow("");
    }
  }, [rules, selectedAllow]);

  useEffect(() => {
    if (
      selectedDeny &&
      rules.some((rule) => rule.countryCode === selectedDeny)
    ) {
      setSelectedDeny("");
    }
  }, [rules, selectedDeny]);

  const allowRules = useMemo(
    () =>
      rules.filter((rule) => rule.ruleType === "allow").sort(sortByCountryName),
    [rules],
  );
  const denyRules = useMemo(
    () =>
      rules.filter((rule) => rule.ruleType === "deny").sort(sortByCountryName),
    [rules],
  );
  const usedCountryCodes = useMemo(
    () => new Set(rules.map((rule) => rule.countryCode)),
    [rules],
  );
  const selectableCountries = useMemo(
    () =>
      COUNTRY_OPTIONS.filter((country) => !usedCountryCodes.has(country.code)),
    [usedCountryCodes],
  );

  const handleAddRule = useCallback(
    async (event: FormEvent<HTMLFormElement>, ruleType: OfferGeoRuleType) => {
      event.preventDefault();

      const selectedCountry =
        ruleType === "allow" ? selectedAllow : selectedDeny;

      if (!selectedCountry) {
        return;
      }

      setActionError(null);
      setAddingRule(ruleType);

      try {
        const rule = await createOfferGeoRule(token, offerId, {
          ruleType,
          countryCode: selectedCountry,
        });
        setRules((prev) => [...prev, rule]);
        if (ruleType === "allow") {
          setSelectedAllow("");
        } else {
          setSelectedDeny("");
        }
      } catch (error) {
        const apiError = error as ApiError;
        const message =
          apiError.message ?? "Не удалось добавить страну. Попробуйте позже.";
        setActionError(message);
      } finally {
        setAddingRule(null);
      }
    },
    [offerId, selectedAllow, selectedDeny, token],
  );

  const handleRemoveRule = useCallback(
    async (rule: OfferGeoRule) => {
      setActionError(null);
      setRemovingRuleIds((prev) => new Set(prev).add(rule.id));

      try {
        await deleteOfferGeoRule(token, offerId, rule.id);
        setRules((prev) => prev.filter((item) => item.id !== rule.id));
      } catch (error) {
        const apiError = error as ApiError;
        const message =
          apiError.message ?? "Не удалось удалить страну. Попробуйте позже.";
        setActionError(message);
      } finally {
        setRemovingRuleIds((prev) => {
          const next = new Set(prev);
          next.delete(rule.id);
          return next;
        });
      }
    },
    [offerId, token],
  );

  const handleStrictToggle = useCallback(async () => {
    const nextValue = !strictValue;
    setSavingStrict(true);
    setStrictError(null);

    try {
      const offer = await updateOfferTargetingStrict(token, offerId, nextValue);
      setStrictValue(offer.targetingStrict);
      onTargetingStrictChange?.(offer.targetingStrict);
    } catch (error) {
      const apiError = error as ApiError;
      const message =
        apiError.message ?? "Не удалось обновить строгий таргетинг.";
      setStrictError(message);
    } finally {
      setSavingStrict(false);
    }
  }, [offerId, onTargetingStrictChange, strictValue, token]);

  const renderRuleList = (
    label: string,
    rulesList: OfferGeoRule[],
    ruleType: OfferGeoRuleType,
    selectedValue: string,
    onChange: (value: string) => void,
  ) => {
    const isAdding = addingRule === ruleType;
    return (
      <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-dashed border-zinc-200 pb-4 dark:border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {label}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {ruleType === "allow"
              ? "В строгом режиме трафик из этих стран разрешён, если страна не запрещена."
              : "Трафик из этих стран будет заблокирован, даже если страна разрешена в другом месте."}
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-between">
          {rulesList.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Пока нет стран в этом списке.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {rulesList.map((rule) => (
                <RuleBadge
                  key={rule.id}
                  rule={rule}
                  onRemove={handleRemoveRule}
                  disabled={removingRuleIds.has(rule.id)}
                />
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => handleAddRule(event, ruleType)}
            className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <label className="sr-only" htmlFor={`${ruleType}-country`}>
              Выберите страну
            </label>
            <select
              id={`${ruleType}-country`}
              value={selectedValue}
              onChange={(event) => onChange(event.target.value)}
              className="ui-input min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white sm:min-w-0"
            >
              <option value="">Выберите страну</option>
              {selectableCountries.map((country) => (
                <option
                  key={`${ruleType}-${country.code}`}
                  value={country.code}
                >
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!selectedValue || isAdding}
              className="ui-button rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-black sm:shrink-0"
            >
              {isAdding ? 'Добавляем...' : 'Добавить'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Таргетинг
          </p>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            География трафика
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Выберите разрешённые и запрещённые страны для оффера.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Строгий режим
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={strictValue}
              aria-label="Строгий таргетинг"
              onClick={() => void handleStrictToggle()}
              disabled={savingStrict}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                strictValue
                  ? "bg-black dark:bg-white"
                  : "bg-zinc-300 dark:bg-zinc-700"
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                  strictValue ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {savingStrict
              ? "Сохраняем..."
              : strictValue
                ? "Разрешены только выбранные страны. Остальные переходы перенаправляются."
                : "Все переходы ведут на целевую страницу; ограничения не применяются."}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        В строгом режиме переходы из неподходящих стран направляются на резервную страницу. Без него ограничения не применяются.
      </p>

      {strictValue && !fallbackUrl && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
          Строгий режим включён, но резервный URL не указан. Переходы из неподходящих стран попадут на страницу блокировки.
        </div>
      )}

      {strictError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {strictError}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Загружаем таргетинг...
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
            <p className="mb-3">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadRules()}
              className="ui-button rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/10"
            >
              Повторить попытку
            </button>
          </div>
        ) : (
          <>
            {actionError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                {actionError}
              </div>
            )}

            {allowRules.length === 0 && denyRules.length === 0 && (
              <div className="mb-4 rounded-2xl border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Страны пока не выбраны. Добавьте разрешённые или запрещённые страны.
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
              {renderRuleList(
                "Разрешённые страны",
                allowRules,
                "allow",
                selectedAllow,
                setSelectedAllow,
              )}
              {renderRuleList(
                "Запрещённые страны",
                denyRules,
                "deny",
                selectedDeny,
                setSelectedDeny,
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
