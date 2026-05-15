"use client";

import { ChangeEvent } from "react";

export type DuplicateWindowUnit = "minutes" | "hours" | "days";

export const DUPLICATE_WINDOW_SECONDS_RANGE = {
  min: 60,
  max: 2592000,
};

const UNIT_CONFIG: Record<
  DuplicateWindowUnit,
  { label: string; factor: number; min: number; max: number }
> = {
  minutes: {
    label: "минуты",
    factor: 60,
    min: 1,
    max: DUPLICATE_WINDOW_SECONDS_RANGE.max / 60,
  },
  hours: {
    label: "часы",
    factor: 3600,
    min: 1,
    max: DUPLICATE_WINDOW_SECONDS_RANGE.max / 3600,
  },
  days: {
    label: "дни",
    factor: 86400,
    min: 1,
    max: DUPLICATE_WINDOW_SECONDS_RANGE.max / 86400,
  },
};

export function secondsToWindowParts(seconds: number | null | undefined): {
  value: string;
  unit: DuplicateWindowUnit;
} {
  if (!seconds || !Number.isFinite(seconds)) {
    return { value: "", unit: "minutes" };
  }

  const orderedUnits: DuplicateWindowUnit[] = ["days", "hours", "minutes"];
  for (const unit of orderedUnits) {
    const { factor } = UNIT_CONFIG[unit];
    if (seconds % factor === 0) {
      return { value: String(seconds / factor), unit };
    }
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return { value: String(minutes), unit: "minutes" };
}

export function windowPartsToSeconds(
  value: string,
  unit: DuplicateWindowUnit,
): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const factor = UNIT_CONFIG[unit]?.factor ?? UNIT_CONFIG.minutes.factor;
  const seconds = parsed * factor;

  if (
    seconds < DUPLICATE_WINDOW_SECONDS_RANGE.min ||
    seconds > DUPLICATE_WINDOW_SECONDS_RANGE.max
  ) {
    return null;
  }

  return seconds;
}

type DuplicateClickSettingsProps = {
  allowDuplicateClicks: boolean;
  duplicateClickWindowValue: string;
  duplicateClickWindowUnit: DuplicateWindowUnit;
  onAllowDuplicateClicksChange: (value: boolean) => void;
  onDuplicateClickWindowValueChange: (value: string) => void;
  onDuplicateClickWindowUnitChange: (unit: DuplicateWindowUnit) => void;
  errors?: {
    allowDuplicateClicks?: string;
    duplicateClickWindow?: string;
  };
};

export function DuplicateClickSettings({
  allowDuplicateClicks,
  duplicateClickWindowValue,
  duplicateClickWindowUnit,
  onAllowDuplicateClicksChange,
  onDuplicateClickWindowValueChange,
  onDuplicateClickWindowUnitChange,
  errors,
}: DuplicateClickSettingsProps) {
  const unitMeta = UNIT_CONFIG[duplicateClickWindowUnit];
  const protectionEnabled = !allowDuplicateClicks;

  const handleToggleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAllowDuplicateClicksChange(!event.target.checked);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={protectionEnabled}
            onChange={handleToggleChange}
            className="h-5 w-5 rounded border border-zinc-300 text-black focus:ring-black dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:focus:ring-white"
          />
          <span>Запретить повторные транзакции</span>
        </label>
      </div>

      {errors?.allowDuplicateClicks && (
        <p className="mt-2 text-sm text-red-600">
          {errors.allowDuplicateClicks}
        </p>
      )}

      {protectionEnabled && (
        <div className="mt-5 space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Таймаут
          </label>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="number"
              min={unitMeta.min}
              max={unitMeta.max}
              step="1"
              value={duplicateClickWindowValue}
              onChange={(event) =>
                onDuplicateClickWindowValueChange(
                  event.target.value.replace(/[^0-9]/g, ""),
                )
              }
              placeholder={`от ${unitMeta.min} до ${unitMeta.max}`}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-transparent dark:text-zinc-100 dark:focus:border-white md:w-1/2"
            />
            <select
              value={duplicateClickWindowUnit}
              onChange={(event) =>
                onDuplicateClickWindowUnitChange(
                  event.target.value as DuplicateWindowUnit,
                )
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-white md:w-1/2"
            >
              <option value="minutes">Минуты</option>
              <option value="hours">Часы</option>
              <option value="days">Дни</option>
            </select>
          </div>
        </div>
      )}

      {protectionEnabled && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Допустимый диапазон: от 1 минуты до 30 дней.
        </p>
      )}

      {protectionEnabled && errors?.duplicateClickWindow && (
        <p className="mt-2 text-sm text-red-600">
          {errors.duplicateClickWindow}
        </p>
      )}
    </div>
  );
}
