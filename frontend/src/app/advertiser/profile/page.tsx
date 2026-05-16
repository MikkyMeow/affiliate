"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { advertiserApi, type AdvertiserProfile } from "@/lib/advertiser.api";
import { formatDateTime } from "@/lib/format";
import { apiFetch, type ApiError } from "@/lib/api";
import { useAdvertiserApiErrorHandler } from "@/hooks/useAdvertiserApiErrorHandler";
import { buildTelegramHref, normalizeTelegramHandle } from "@/lib/telegram";

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function AdvertiserProfilePage() {
  const { accessToken, user, loading: authLoading } = useAuth();
  const handleApiError = useAdvertiserApiErrorHandler("/advertiser/profile");
  const [profile, setProfile] = useState<AdvertiserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegram, setTelegram] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] =
    useState<PasswordFormState>(EMPTY_PASSWORD_FORM);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await advertiserApi.getProfile(accessToken);
      setProfile(data);
      setTelegram(normalizeTelegramHandle(data.telegram));
    } catch (err) {
      if (!handleApiError(err as ApiError)) {
        setError((err as Error).message ?? "Не удалось загрузить профиль");
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, handleApiError]);

  const handleTelegramSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!accessToken) {
        return;
      }

      setSavingTelegram(true);
      setSaveMessage(null);

      try {
        await advertiserApi.updateProfile(accessToken, telegram.trim() || null);
        setSaveMessage("Telegram обновлён");
        await loadProfile();
      } catch (err) {
        if (!handleApiError(err as ApiError)) {
          setSaveMessage((err as Error).message ?? "Не удалось обновить Telegram");
        }
      } finally {
        setSavingTelegram(false);
      }
    },
    [accessToken, handleApiError, loadProfile, telegram],
  );

  const telegramHref = buildTelegramHref(profile?.telegram);

  const handlePasswordSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!accessToken) {
        return;
      }

      setPasswordError(null);
      setPasswordSuccess(null);

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordError("Подтверждение пароля не совпадает с новым паролем.");
        return;
      }

      setSavingPassword(true);

      try {
        await apiFetch<{ ok: true }>("/auth/change-password", {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        });

        setPasswordForm(EMPTY_PASSWORD_FORM);
        setPasswordSuccess("Пароль обновлён.");
      } catch (err) {
        if (!handleApiError(err as ApiError)) {
          setPasswordError(
            (err as Error).message ?? "Не удалось обновить пароль",
          );
        }
      } finally {
        setSavingPassword(false);
      }
    },
    [accessToken, handleApiError, passwordForm],
  );

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
          Email и контакт в Telegram можно держать в актуальном состоянии без
          обращения в поддержку.
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
        <div className="space-y-6">
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
              Public ID
            </dt>
            <dd className="mt-2 font-mono text-sm text-zinc-900 dark:text-zinc-100">
              {profile.publicId ?? "—"}
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
              {profile.email ?? user?.email ?? "—"}
            </dd>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-2">
            <form className="space-y-3" onSubmit={handleTelegramSubmit}>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Telegram
                </dt>
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
                  disabled={savingTelegram}
                  className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
                >
                  {savingTelegram ? "Сохраняем…" : "Сохранить Telegram"}
                </button>
                {saveMessage ? (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {saveMessage}
                  </span>
                ) : null}
              </div>
            </form>
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
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Ответственный менеджер
            </dt>
            {profile.manager ? (
              <dd className="mt-2 space-y-1 text-sm text-zinc-900 dark:text-zinc-100">
                <p className="text-lg font-semibold">
                  {profile.manager.name ?? "—"}
                </p>
                <p>{profile.manager.email ?? "—"}</p>
              </dd>
            ) : (
              <dd className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Менеджер пока не назначен
              </dd>
            )}
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <dt className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Ответы анкеты
              </dt>
              <Link
                href="/advertiser/questionnaire"
                className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Редактировать анкету
              </Link>
            </div>
            {profile.questionnaireAnswers.length > 0 ? (
              <dd className="mt-3 space-y-3 text-sm text-zinc-900 dark:text-zinc-100">
                {profile.questionnaireAnswers.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {item.question}
                    </p>
                    <p className="mt-2">{item.answer}</p>
                  </div>
                ))}
              </dd>
            ) : (
              <dd className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Анкета ещё не заполнена
              </dd>
            )}
            </div>
          </dl>

          <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Смена пароля
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              После входа с временным паролем задайте постоянный пароль для аккаунта.
            </p>
            <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Текущий пароль
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Новый пароль
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Подтверждение нового пароля
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </label>

              {passwordError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                  {passwordError}
                </div>
              ) : null}
              {passwordSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {passwordSuccess}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-black"
              >
                {savingPassword ? "Обновляем…" : "Изменить пароль"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Профиль пока пуст. Обратитесь в поддержку, если считаете это
          ошибкой.
        </div>
      )}
    </div>
  );
}
