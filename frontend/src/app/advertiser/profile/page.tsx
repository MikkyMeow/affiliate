"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { advertiserApi, type AdvertiserProfile } from "@/lib/advertiser.api";
import { formatDateTime } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

export default function AdvertiserProfilePage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/profile");
  const [profile, setProfile] = useState<AdvertiserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await advertiserApi.getProfile(accessToken);
      setProfile(data);
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setError((err as Error).message ?? "Не удалось загрузить профиль");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, handleApiError]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadProfile();
  }, [accessToken, authLoading, loadProfile, user?.role]);

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header>
        <p className="text-xs uppercase tracking-widest text-emerald-500">
          Профиль
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Данные рекламодателя
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Карточка только для просмотра. Если нужны изменения, обратитесь к
          менеджеру.
        </p>
      </header>
      {loading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Загружаем профиль…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : profile ? (
        <dl className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Название
            </dt>
            <dd className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {profile.name ?? "—"}
            </dd>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Статус
            </dt>
            <dd className="mt-2 text-lg font-semibold capitalize text-zinc-900 dark:text-zinc-50">
              {profile.status ?? "—"}
            </dd>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              ID рекламодателя
            </dt>
            <dd className="mt-2 font-mono text-sm text-zinc-900 dark:text-zinc-100">
              {profile.id}
            </dd>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Email аккаунта
            </dt>
            <dd className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
              {user?.email ?? "—"}
            </dd>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Создан
            </dt>
            <dd className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
              {formatDateTime(profile.createdAt)}
            </dd>
          </div>
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Обновлён
            </dt>
            <dd className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
              {formatDateTime(profile.updatedAt)}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Профиль пока пуст. Обратитесь в поддержку, если считаете это
          ошибкой.
        </div>
      )}
    </div>
  );
}
