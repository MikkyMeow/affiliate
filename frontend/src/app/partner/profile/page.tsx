"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, type ApiError } from "@/lib/api";
import type { QuestionnaireAnswerItem } from "@/lib/questionnaires";
import { buildTelegramHref, normalizeTelegramHandle } from "@/lib/telegram";

type PartnerProfileResponse = {
  user: {
    id: string;
    email: string;
    role: "affiliate";
  };
  affiliate: {
    id: string;
    publicId: string | null;
    publicIdNumber: number | null;
    name: string;
    email: string;
    status: "active" | "inactive";
    telegram: string | null;
    questionnaireAnswers: QuestionnaireAnswerItem[];
    createdAt: string;
    updatedAt: string;
    manager: {
      name: string | null;
      email: string | null;
    } | null;
  };
};

export default function PartnerProfilePage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<PartnerProfileResponse | null>(null);
  const [telegram, setTelegram] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<PartnerProfileResponse>("/partner/profile", {
        token: accessToken,
      });
      setProfile(data);
      setTelegram(normalizeTelegramHandle(data.affiliate.telegram));
    } catch (err) {
      setError((err as ApiError).message ?? "Не удалось загрузить профиль");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading || !accessToken || user?.role !== "affiliate") {
      return;
    }

    void loadProfile();
  }, [accessToken, authLoading, loadProfile, user?.role]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!accessToken) {
        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        await apiFetch("/profile", {
          method: "PATCH",
          token: accessToken,
          body: JSON.stringify({ telegram: telegram.trim() || null }),
        });
        setMessage("Telegram обновлён");
        await loadProfile();
      } catch (err) {
        setMessage((err as ApiError).message ?? "Не удалось обновить Telegram");
      } finally {
        setSaving(false);
      }
    },
    [accessToken, loadProfile, telegram],
  );

  const telegramHref = buildTelegramHref(profile?.affiliate.telegram);

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Профиль
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Данные партнёра
          </h1>
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
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Название
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {profile.affiliate.name}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Public ID
              </p>
              <p className="mt-2 font-mono text-sm text-zinc-900 dark:text-zinc-100">
                {profile.affiliate.publicId ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Email
              </p>
              <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
                {profile.affiliate.email}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Статус
              </p>
              <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">
                {profile.affiliate.status === "active" ? "Активен" : "Неактивен"}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-2">
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Telegram
                  </p>
                  <div className="mt-2 flex overflow-hidden rounded-xl border border-zinc-300 bg-white focus-within:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-white">
                    <span className="flex items-center border-r border-zinc-200 px-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      t.me/
                    </span>
                    <input
                      type="text"
                      value={telegram}
                      onChange={(event) =>
                        setTelegram(normalizeTelegramHandle(event.target.value))
                      }
                      placeholder="username"
                      className="w-full bg-transparent px-4 py-3 text-sm text-zinc-900 outline-none dark:text-zinc-100"
                    />
                  </div>
                  {telegramHref ? (
                    <a
                      href={telegramHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      {telegramHref.replace(/^https?:\/\//, "")}
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
                  >
                    {saving ? "Сохраняем…" : "Сохранить Telegram"}
                  </button>
                  {message ? (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {message}
                    </span>
                  ) : null}
                </div>
              </form>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Ответственный менеджер
              </p>
              {profile.affiliate.manager ? (
                <div className="mt-2 space-y-1 text-sm text-zinc-900 dark:text-zinc-100">
                  <p className="font-semibold">
                    {profile.affiliate.manager.name ?? "—"}
                  </p>
                  <p>{profile.affiliate.manager.email ?? "—"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Менеджер пока не назначен
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Ответы анкеты
                </p>
                <Link
                  href="/partner/questionnaire"
                  className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Редактировать анкету
                </Link>
              </div>
              {profile.affiliate.questionnaireAnswers.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {profile.affiliate.questionnaireAnswers.map((item, index) => (
                    <div
                      key={`${item.question}-${index}`}
                      className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {item.question}
                      </p>
                      <p className="mt-2">{item.answer}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Анкета ещё не заполнена
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
