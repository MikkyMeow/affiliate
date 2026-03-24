"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AdvertiserDashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/auth/login?next=/advertiser");
      return;
    }

    if (user.role !== "advertiser") {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading && user?.role === "advertiser" && !profile) {
      void refreshProfile();
    }
  }, [loading, profile, refreshProfile, user]);

  if (loading || !user || user.role !== "advertiser") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-12 text-sm text-zinc-500 dark:text-zinc-400">
        Переадресуем вас в нужный раздел…
      </div>
    );
  }

  const advertiserProfile =
    profile && profile.type === "advertiser" ? profile : null;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col gap-8 px-6 py-12 font-sans">
      <div>
        <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Рекламодатель
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Кабинет рекламодателя (beta)
        </h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
          Мы готовим read-only кабинет. Пока здесь доступна только информация о
          профиле.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Профиль рекламодателя
        </h2>
        <dl className="mt-4 grid gap-4 text-sm text-zinc-700 dark:text-zinc-200 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Название
            </dt>
            <dd className="text-base text-zinc-900 dark:text-zinc-50">
              {advertiserProfile?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Статус
            </dt>
            <dd className="text-base text-zinc-900 dark:text-zinc-50">
              {advertiserProfile?.status ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              ID
            </dt>
            <dd className="text-base font-mono text-zinc-900 dark:text-zinc-50">
              {advertiserProfile?.id ?? user.advertiserId ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Дата создания
            </dt>
            <dd className="text-base text-zinc-900 dark:text-zinc-50">
              {advertiserProfile?.createdAt
                ? new Date(advertiserProfile.createdAt).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <div className="rounded-2xl border border-zinc-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm dark:border-amber-900/70 dark:bg-amber-900/20 dark:text-amber-100">
        <p className="font-medium">Что дальше?</p>
        <p className="mt-2">
          На следующих этапах добавим просмотр офферов и статистики. Пока что вы
          можете обратиться к менеджеру или в саппорт, если нужен доступ к
          данным.
        </p>
      </div>
    </div>
  );
}
