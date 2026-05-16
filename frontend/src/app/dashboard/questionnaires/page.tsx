'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, type ApiError } from '@/lib/api';
import { canAccessAdminArea, isAdminRole } from '@/lib/auth/roles';
import {
  QUESTIONNAIRE_TARGETS,
  OPTION_FIELD_TYPES,
  createQuestionnaireField,
  getQuestionnaireTargetLabel,
  normalizeQuestionnaire,
  type QuestionnaireTargetRole,
  type RegistrationQuestionnaire,
} from '@/lib/questionnaires';

type ValidationMessage = {
  field: string | null;
  message: string;
};

function normalizeOrders(questionnaire: RegistrationQuestionnaire): RegistrationQuestionnaire {
  return {
    ...questionnaire,
    fields: questionnaire.fields.map((field, index) => ({
      ...field,
      order: index + 1,
    })),
  };
}

export default function AdminQuestionnairesPage() {
  const pathname = usePathname();
  const { user, accessToken, loading: authLoading } = useAuth();
  const [activeTarget, setActiveTarget] =
    useState<QuestionnaireTargetRole>('affiliate');
  const [questionnaires, setQuestionnaires] = useState<
    Record<QuestionnaireTargetRole, RegistrationQuestionnaire>
  >({
    affiliate: normalizeQuestionnaire(null, 'affiliate'),
    advertiser: normalizeQuestionnaire(null, 'advertiser'),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [validationMessages, setValidationMessages] = useState<ValidationMessage[]>(
    [],
  );

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(pathname ?? '/dashboard/questionnaires');
    return {
      login: `/auth/login?next=${next}`,
      register: `/auth/register?next=${next}`,
    };
  }, [pathname]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!accessToken || !user || !isAdminRole(user.role)) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    apiFetch<{ items: RegistrationQuestionnaire[] }>('/admin/questionnaires', {
      token: accessToken,
    })
      .then((response) => {
        if (!active) {
          return;
        }

        const nextState = {
          affiliate: normalizeQuestionnaire(
            response.items.find((item) => item.targetRole === 'affiliate'),
            'affiliate',
          ),
          advertiser: normalizeQuestionnaire(
            response.items.find((item) => item.targetRole === 'advertiser'),
            'advertiser',
          ),
        };

        setQuestionnaires(nextState);
      })
      .catch((loadError) => {
        if (!active) {
          return;
        }

        setError(
          (loadError as ApiError).message ?? 'Не удалось загрузить анкеты',
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, user]);

  const current = questionnaires[activeTarget];

  const updateCurrent = (
    updater: (questionnaire: RegistrationQuestionnaire) => RegistrationQuestionnaire,
  ) => {
    setQuestionnaires((state) => ({
      ...state,
      [activeTarget]: normalizeOrders(updater(state[activeTarget])),
    }));
    setValidationMessages([]);
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!accessToken) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMessage(null);
    setValidationMessages([]);

    try {
      const response = await apiFetch<{ questionnaire: RegistrationQuestionnaire }>(
        `/admin/questionnaires/${activeTarget}`,
        {
          method: 'PUT',
          token: accessToken,
          body: JSON.stringify({
            title: current.title ?? null,
            description: current.description ?? null,
            isActive: current.isActive,
            fields: current.fields.map((field, index) => ({
              ...field,
              order: index + 1,
            })),
          }),
        },
      );

      setQuestionnaires((state) => ({
        ...state,
        [activeTarget]: normalizeQuestionnaire(response.questionnaire, activeTarget),
      }));
      setSaveMessage('Анкета сохранена');
    } catch (saveError) {
      const apiError = saveError as ApiError;
      const details =
        (apiError.details as { errors?: ValidationMessage[] } | null)?.errors ?? [];

      setValidationMessages(details);
      setError(apiError.message ?? 'Не удалось сохранить анкету');
    } finally {
      setSaving(false);
    }
  };

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
          Войдите, чтобы управлять анкетами.
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

  if (!canAccessAdminArea(user) || !isAdminRole(user.role)) {
    return (
      <section className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Нет доступа
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Управлять схемой анкет может только администратор.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
        <p className="text-sm text-zinc-500">Загружаем анкеты...</p>
      </section>
    );
  }

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-wide text-zinc-500">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Анкеты регистрации
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Отдельные схемы для партнёров и рекламодателей. Менеджеры могут
          просматривать ответы на карточках пользователей, но не редактируют
          саму схему.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {QUESTIONNAIRE_TARGETS.map((targetRole) => {
          const isActive = activeTarget === targetRole;
          return (
            <button
              key={targetRole}
              type="button"
              onClick={() => {
                setActiveTarget(targetRole);
                setError(null);
                setSaveMessage(null);
                setValidationMessages([]);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-black text-white dark:bg-zinc-100 dark:text-black'
                  : 'bg-white text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900'
              }`}
            >
              {getQuestionnaireTargetLabel(targetRole)}
            </button>
          );
        })}
      </div>

      <div className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
                htmlFor="questionnaire-title"
              >
                Заголовок
              </label>
              <input
                id="questionnaire-title"
                type="text"
                value={current.title ?? ''}
                onChange={(event) =>
                  updateCurrent((questionnaire) => ({
                    ...questionnaire,
                    title: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
                htmlFor="questionnaire-description"
              >
                Описание
              </label>
              <textarea
                id="questionnaire-description"
                rows={4}
                value={current.description ?? ''}
                onChange={(event) =>
                  updateCurrent((questionnaire) => ({
                    ...questionnaire,
                    description: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-200">
              <input
                type="checkbox"
                checked={current.isActive}
                onChange={(event) =>
                  updateCurrent((questionnaire) => ({
                    ...questionnaire,
                    isActive: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700"
              />
              <span>
                <span className="block font-medium">Активная анкета</span>
                <span className="mt-1 block text-zinc-500 dark:text-zinc-400">
                  Если выключить анкету, новые пользователи этого типа не будут
                  блокироваться до заполнения.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-zinc-500">
              Конструктор полей
            </p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Поля анкеты
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              updateCurrent((questionnaire) => ({
                ...questionnaire,
                fields: [
                  ...questionnaire.fields,
                  createQuestionnaireField(
                    activeTarget,
                    questionnaire.fields.length,
                  ),
                ],
              }))
            }
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Добавить поле
          </button>
        </div>

        {current.fields.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-6 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Пока нет ни одного поля. Добавьте вопросы, которые должны видеть
            пользователи после регистрации.
          </div>
        ) : (
          <div className="space-y-4">
            {current.fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Field #{index + 1}
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      ID: <span className="font-mono">{field.id}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() =>
                        updateCurrent((questionnaire) => {
                          const fields = [...questionnaire.fields];
                          [fields[index - 1], fields[index]] = [
                            fields[index],
                            fields[index - 1],
                          ];
                          return { ...questionnaire, fields };
                        })
                      }
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Вверх
                    </button>
                    <button
                      type="button"
                      disabled={index === current.fields.length - 1}
                      onClick={() =>
                        updateCurrent((questionnaire) => {
                          const fields = [...questionnaire.fields];
                          [fields[index], fields[index + 1]] = [
                            fields[index + 1],
                            fields[index],
                          ];
                          return { ...questionnaire, fields };
                        })
                      }
                      className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Вниз
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrent((questionnaire) => ({
                          ...questionnaire,
                          fields: questionnaire.fields.filter(
                            (item) => item.id !== field.id,
                          ),
                        }))
                      }
                      className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      Удалить
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      Name
                    </label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(event) =>
                        updateCurrent((questionnaire) => ({
                          ...questionnaire,
                          fields: questionnaire.fields.map((item) =>
                            item.id === field.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      Тип поля
                    </label>
                    <select
                      value={field.type}
                      onChange={(event) =>
                        updateCurrent((questionnaire) => ({
                          ...questionnaire,
                          fields: questionnaire.fields.map((item) =>
                            item.id === field.id
                              ? {
                                  ...item,
                                  type: event.target.value as typeof item.type,
                                  options: OPTION_FIELD_TYPES.has(
                                    event.target.value as typeof item.type,
                                  )
                                    ? item.options
                                    : [],
                                }
                              : item,
                          ),
                        }))
                      }
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                    >
                      <option value="text">text</option>
                      <option value="textarea">textarea</option>
                      <option value="select">select</option>
                      <option value="multiselect">multiselect</option>
                      <option value="checkbox">checkbox</option>
                      <option value="radio">radio</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    Вопрос
                  </label>
                  <input
                    type="text"
                    value={field.question}
                    onChange={(event) =>
                      updateCurrent((questionnaire) => ({
                        ...questionnaire,
                        fields: questionnaire.fields.map((item) =>
                          item.id === field.id
                            ? { ...item, question: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                  />
                </div>

                <label className="mt-4 flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      updateCurrent((questionnaire) => ({
                        ...questionnaire,
                        fields: questionnaire.fields.map((item) =>
                          item.id === field.id
                            ? { ...item, required: event.target.checked }
                            : item,
                        ),
                      }))
                    }
                    className="h-4 w-4 rounded border-zinc-300 text-black focus:ring-black dark:border-zinc-700"
                  />
                  Обязательное поле
                </label>

                {OPTION_FIELD_TYPES.has(field.type) ? (
                  <div className="mt-4 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        Варианты ответа
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          updateCurrent((questionnaire) => ({
                            ...questionnaire,
                            fields: questionnaire.fields.map((item) =>
                              item.id === field.id
                                ? {
                                    ...item,
                                    options: [
                                      ...item.options,
                                      {
                                        value: '',
                                        label: '',
                                      },
                                    ],
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Добавить опцию
                      </button>
                    </div>

                    {field.options.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Пока нет опций для этого поля.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {field.options.map((option, optionIndex) => (
                          <div
                            key={`${field.id}-option-${optionIndex}`}
                            className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                          >
                            <input
                              type="text"
                              value={option.value}
                              onChange={(event) =>
                                updateCurrent((questionnaire) => ({
                                  ...questionnaire,
                                  fields: questionnaire.fields.map((item) =>
                                    item.id === field.id
                                      ? {
                                          ...item,
                                          options: item.options.map(
                                            (currentOption, currentIndex) =>
                                              currentIndex === optionIndex
                                                ? {
                                                    ...currentOption,
                                                    value: event.target.value,
                                                  }
                                                : currentOption,
                                          ),
                                        }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="value"
                              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                            />
                            <input
                              type="text"
                              value={option.label}
                              onChange={(event) =>
                                updateCurrent((questionnaire) => ({
                                  ...questionnaire,
                                  fields: questionnaire.fields.map((item) =>
                                    item.id === field.id
                                      ? {
                                          ...item,
                                          options: item.options.map(
                                            (currentOption, currentIndex) =>
                                              currentIndex === optionIndex
                                                ? {
                                                    ...currentOption,
                                                    label: event.target.value,
                                                  }
                                                : currentOption,
                                          ),
                                        }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="label"
                              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-white"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateCurrent((questionnaire) => ({
                                  ...questionnaire,
                                  fields: questionnaire.fields.map((item) =>
                                    item.id === field.id
                                      ? {
                                          ...item,
                                          options: item.options.filter(
                                            (_, currentIndex) =>
                                              currentIndex !== optionIndex,
                                          ),
                                        }
                                      : item,
                                  ),
                                }))
                              }
                              className="rounded-full border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {validationMessages.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Проверьте структуру анкеты:</p>
            <ul className="mt-2 list-disc pl-5">
              {validationMessages.map((item, index) => (
                <li key={`${item.field ?? 'form'}-${index}`}>
                  {item.field ? `${item.field}: ` : ''}
                  {item.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {saveMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            {saveMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-200"
          >
            {saving ? 'Сохраняем...' : 'Сохранить анкету'}
          </button>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Вернуться в dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
