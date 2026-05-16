"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, type ApiError } from "@/lib/api";
import { getHomePathByRole } from "@/lib/auth/routes";
import {
  buildQuestionnairePayload,
  type MyQuestionnaireResponse,
  type QuestionnaireAnswers,
  type QuestionnaireField,
  type QuestionnaireTargetRole,
  validateQuestionnaireFieldValue,
} from "@/lib/questionnaires";

type FieldErrors = Record<string, string>;

function normalizeAnswers(
  fields: QuestionnaireField[],
  answers: QuestionnaireAnswers,
): QuestionnaireAnswers {
  const nextAnswers: QuestionnaireAnswers = {};

  fields.forEach((field) => {
    const value = answers[field.id];

    if (field.type === "checkbox") {
      nextAnswers[field.id] = typeof value === "boolean" ? value : false;
      return;
    }

    if (field.type === "multiselect") {
      nextAnswers[field.id] = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      return;
    }

    nextAnswers[field.id] = typeof value === "string" ? value : "";
  });

  return nextAnswers;
}

function buildFrontendValidation(
  fields: QuestionnaireField[],
  answers: QuestionnaireAnswers,
): FieldErrors {
  return fields.reduce<FieldErrors>((result, field) => {
    const message = validateQuestionnaireFieldValue(field, answers[field.id]);

    if (message) {
      result[field.id] = message;
    }

    return result;
  }, {});
}

export function UserQuestionnairePage({
  targetRole,
}: {
  targetRole: QuestionnaireTargetRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    accessToken,
    user,
    questionnaire: authQuestionnaire,
    loading: authLoading,
    refreshProfile,
  } = useAuth();
  const [data, setData] = useState<MyQuestionnaireResponse | null>(null);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(
      pathname ??
        (targetRole === "affiliate"
          ? "/partner/questionnaire"
          : "/advertiser/questionnaire"),
    );

    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname, targetRole]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      return;
    }

    if (user.role !== targetRole) {
      router.replace(getHomePathByRole(user));
      return;
    }

    if (!accessToken) {
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    apiFetch<MyQuestionnaireResponse>("/me/questionnaire", {
      token: accessToken,
    })
      .then((response) => {
        if (!active) {
          return;
        }

        setData(response);
        setAnswers(
          response.questionnaire
            ? normalizeAnswers(response.questionnaire.fields, response.answers)
            : {},
        );
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setError(
          (loadError as ApiError).message ?? "Не удалось загрузить анкету",
        );
        setData(null);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, router, targetRole, user]);

  const handleTextChange = (fieldId: string, value: string) => {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
    setFieldErrors((current) => {
      if (!current[fieldId]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  };

  const handleCheckboxChange = (fieldId: string, checked: boolean) => {
    setAnswers((current) => ({ ...current, [fieldId]: checked }));
    setFieldErrors((current) => {
      if (!current[fieldId]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  };

  const handleMultiselectToggle = (fieldId: string, optionValue: string) => {
    setAnswers((current) => {
      const existing = Array.isArray(current[fieldId])
        ? current[fieldId].filter((item): item is string => typeof item === "string")
        : [];
      const nextValues = existing.includes(optionValue)
        ? existing.filter((item) => item !== optionValue)
        : [...existing, optionValue];

      return {
        ...current,
        [fieldId]: nextValues,
      };
    });
    setFieldErrors((current) => {
      if (!current[fieldId]) {
        return current;
      }

      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken || !data?.questionnaire) {
      return;
    }

    const nextFieldErrors = buildFrontendValidation(
      data.questionnaire.fields,
      answers,
    );
    setFieldErrors(nextFieldErrors);
    setSuccess(null);

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await apiFetch<{
        answers: QuestionnaireAnswers;
        isCompleted: boolean;
        requiredMissingFields: string[];
      }>("/me/questionnaire/answers", {
        method: "PUT",
        token: accessToken,
        body: JSON.stringify({
          answers: buildQuestionnairePayload(data.questionnaire, answers),
        }),
      });

      await refreshProfile();
      setData((current) =>
        current
          ? {
              ...current,
              answers: result.answers,
              isCompleted: result.isCompleted,
              requiredMissingFields: result.requiredMissingFields,
            }
          : current,
      );
      setAnswers(normalizeAnswers(data.questionnaire.fields, result.answers));
      setSuccess("Ответы сохранены");

      if (authQuestionnaire?.completed === false && user) {
        router.replace(getHomePathByRole(user));
      }
    } catch (submitError) {
      const apiError = submitError as ApiError;
      const backendFieldErrors =
        (apiError.details as { fields?: FieldErrors } | null)?.fields ?? null;

      if (backendFieldErrors) {
        setFieldErrors(backendFieldErrors);
      }

      setError(apiError.message ?? "Не удалось сохранить ответы");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
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
          Войдите, чтобы заполнить анкету.
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

  if (user.role !== targetRole) {
    return null;
  }

  if (loading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Загружаем анкету...</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="mx-auto min-h-screen max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      </section>
    );
  }

  if (!data?.questionnaire) {
    return (
      <section className="mx-auto min-h-screen max-w-3xl px-6 py-10">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Анкета не требуется
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Для этого типа аккаунта сейчас нет активной анкеты.
          </p>
          <Link
            href={getHomePathByRole(user)}
            className="inline-flex rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-black"
          >
            Вернуться в кабинет
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-500">
            Questionnaire
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {data.questionnaire.title?.trim() || "Регистрационная анкета"}
          </h1>
          {data.questionnaire.description ? (
            <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              {data.questionnaire.description}
            </p>
          ) : null}
          {authQuestionnaire?.completed === false ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              Заполните обязательные поля, чтобы открыть остальные разделы
              платформы.
            </div>
          ) : null}
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {data.questionnaire.fields.map((field) => {
            const value = answers[field.id];
            const message = fieldErrors[field.id];
            const commonLabel = (
              <div className="mb-2 flex items-center gap-2">
                <label
                  htmlFor={field.id}
                  className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
                >
                  {field.question}
                </label>
                {field.required ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                    required
                  </span>
                ) : null}
              </div>
            );

            return (
              <div key={field.id} className="space-y-2">
                {field.type === "checkbox" ? (
                  <label
                    htmlFor={field.id}
                    className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <input
                      id={field.id}
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) =>
                        handleCheckboxChange(field.id, event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700"
                    />
                    <span>
                      {field.question}
                      {field.required ? (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-rose-500">
                          required
                        </span>
                      ) : null}
                    </span>
                  </label>
                ) : (
                  <>
                    {commonLabel}
                    {field.type === "text" ? (
                      <input
                        id={field.id}
                        type="text"
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) =>
                          handleTextChange(field.id, event.target.value)
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                      />
                    ) : null}
                    {field.type === "textarea" ? (
                      <textarea
                        id={field.id}
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) =>
                          handleTextChange(field.id, event.target.value)
                        }
                        rows={5}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                      />
                    ) : null}
                    {field.type === "select" ? (
                      <select
                        id={field.id}
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) =>
                          handleTextChange(field.id, event.target.value)
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                      >
                        <option value="">Выберите вариант</option>
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {field.type === "radio" ? (
                      <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        {field.options.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-3 text-sm text-zinc-800 dark:text-zinc-100"
                          >
                            <input
                              type="radio"
                              name={field.id}
                              checked={value === option.value}
                              onChange={() =>
                                handleTextChange(field.id, option.value)
                              }
                              className="h-4 w-4 border-zinc-300 text-black focus:ring-black dark:border-zinc-700"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                    {field.type === "multiselect" ? (
                      <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                        {field.options.map((option) => {
                          const selected = Array.isArray(value)
                            ? value.includes(option.value)
                            : false;

                          return (
                            <label
                              key={option.value}
                              className="flex items-center gap-3 text-sm text-zinc-800 dark:text-zinc-100"
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() =>
                                  handleMultiselectToggle(
                                    field.id,
                                    option.value,
                                  )
                                }
                                className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700"
                              />
                              <span>{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </>
                )}
                {message ? (
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {message}
                  </p>
                ) : null}
              </div>
            );
          })}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200"
            >
              {saving ? "Сохраняем..." : "Сохранить ответы"}
            </button>
            <Link
              href={
                targetRole === "affiliate"
                  ? "/partner/profile"
                  : "/advertiser/profile"
              }
              className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Вернуться в профиль
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
