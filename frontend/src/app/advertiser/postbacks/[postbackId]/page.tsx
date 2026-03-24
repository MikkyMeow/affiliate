"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  advertiserApi,
  type AdvertiserPostback,
} from "@/lib/advertiser.api";
import { formatDateTime } from "@/lib/format";
import type { ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";

export default function AdvertiserPostbackDetailsPage() {
  const params = useParams<{ postbackId: string }>();
  const postbackId = Array.isArray(params?.postbackId)
    ? params?.postbackId[0]
    : params?.postbackId;
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/postbacks");
  const [postback, setPostback] = useState<AdvertiserPostback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadPostback = useCallback(async () => {
    if (!accessToken || !postbackId) {
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const data = await advertiserApi.getPostbackById(accessToken, postbackId);
      setPostback(data.postback);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 404) {
        setNotFound(true);
        return;
      }
      if (!handleApiError(apiError)) {
        setError(apiError.message ?? "Не удалось загрузить log");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, handleApiError, postbackId]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "advertiser") {
      return;
    }

    void loadPostback();
  }, [accessToken, authLoading, loadPostback, user?.role]);

  if (!postbackId) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-red-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-red-200">
        Не указан идентификатор события.
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-emerald-500">
          Postback
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Лог #{postbackId.slice(0, 8)}…
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Доступен только просмотр строки журнала.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Загружаем запись…
        </div>
      ) : notFound ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-100">
          Постбек не найден.
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : postback ? (
        <dl className="grid gap-4 md:grid-cols-2">
          <InfoCard label="Offer ID" value={postback.offerId ?? "—"} />
          <InfoCard label="Conversion ID" value={postback.conversionId ?? "—"} />
          <InfoCard label="Click ID" value={postback.clickId ?? "—"} />
          <InfoCard label="Статус" value={postback.status ?? "—"} />
          <InfoCard
            label="HTTP статус"
            value={
              postback.responseStatusCode != null
                ? String(postback.responseStatusCode)
                : "—"
            }
          />
          <InfoCard label="Ошибка" value={postback.errorCode ?? "—"} />
          <InfoCard
            label="Создан"
            value={formatDateTime(postback.createdAt)}
          />
          <InfoCard label="Обновлён" value={formatDateTime(postback.updatedAt)} />
        </dl>
      ) : (
        <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Нет данных для отображения.
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
