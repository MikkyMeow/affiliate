import type { UserRole } from "@/context/AuthContext";

export type QuestionnaireTargetRole = "affiliate" | "advertiser";
export type QuestionnaireFieldType =
  | "text"
  | "textarea"
  | "select"
  | "multiselect"
  | "checkbox"
  | "radio";

export type QuestionnaireOption = {
  value: string;
  label: string;
};

export type QuestionnaireField = {
  id: string;
  name: string;
  question: string;
  type: QuestionnaireFieldType;
  required: boolean;
  order: number;
  options: QuestionnaireOption[];
};

export type RegistrationQuestionnaire = {
  id: string;
  targetRole: QuestionnaireTargetRole;
  title: string | null;
  description: string | null;
  fields: QuestionnaireField[];
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type QuestionnaireAnswerValue =
  | string
  | boolean
  | string[]
  | null
  | undefined;

export type QuestionnaireAnswers = Record<string, QuestionnaireAnswerValue>;

export type QuestionnaireAnswerItem = {
  fieldId: string | null;
  name: string | null;
  question: string;
  type: string | null;
  answer: string;
  rawAnswer?: unknown;
  isFallback?: boolean;
};

export type MyQuestionnaireResponse = {
  questionnaire: RegistrationQuestionnaire | null;
  answers: QuestionnaireAnswers;
  isCompleted: boolean;
  requiredMissingFields: string[];
};

export const QUESTIONNAIRE_TARGETS: QuestionnaireTargetRole[] = [
  "affiliate",
  "advertiser",
];

export const OPTION_FIELD_TYPES = new Set<QuestionnaireFieldType>([
  "select",
  "multiselect",
  "radio",
]);

export function getQuestionnaireRouteByRole(
  role: UserRole | QuestionnaireTargetRole | null | undefined,
): string | null {
  if (role === "affiliate") {
    return "/partner/questionnaire";
  }

  if (role === "advertiser") {
    return "/advertiser/questionnaire";
  }

  return null;
}

export function getQuestionnaireTargetLabel(
  targetRole: QuestionnaireTargetRole,
): string {
  return targetRole === "affiliate"
    ? "Партнёрская анкета"
    : "Анкета рекламодателя";
}

export function createQuestionnaireField(
  targetRole: QuestionnaireTargetRole,
  index: number,
): QuestionnaireField {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "_")
      : `${targetRole}_field_${Date.now()}_${index}`;

  return {
    id,
    name: `${targetRole}_field_${index + 1}`,
    question: "",
    type: "text",
    required: false,
    order: index + 1,
    options: [],
  };
}

export function createEmptyQuestionnaire(
  targetRole: QuestionnaireTargetRole,
): RegistrationQuestionnaire {
  return {
    id: `${targetRole}-draft`,
    targetRole,
    title: targetRole === "affiliate" ? "Анкета партнёра" : "Анкета рекламодателя",
    description: "",
    fields: [],
    isActive: true,
  };
}

export function normalizeQuestionnaire(
  questionnaire: RegistrationQuestionnaire | null | undefined,
  targetRole: QuestionnaireTargetRole,
): RegistrationQuestionnaire {
  const fallback = createEmptyQuestionnaire(targetRole);

  if (!questionnaire) {
    return fallback;
  }

  return {
    ...questionnaire,
    targetRole,
    title: questionnaire.title ?? fallback.title,
    description: questionnaire.description ?? "",
    fields: [...(questionnaire.fields ?? [])].sort(
      (left, right) => left.order - right.order,
    ),
    isActive: questionnaire.isActive ?? true,
  };
}

export function validateQuestionnaireFieldValue(
  field: QuestionnaireField,
  value: QuestionnaireAnswerValue,
): string | null {
  const isBlankString =
    typeof value === "string" && value.trim().length === 0;

  if (field.type === "text" || field.type === "textarea") {
    if (value === undefined || value === null || isBlankString) {
      return field.required ? "Обязательное поле" : null;
    }
    return typeof value === "string" ? null : "Введите текст";
  }

  if (field.type === "select" || field.type === "radio") {
    if (value === undefined || value === null || isBlankString) {
      return field.required ? "Обязательное поле" : null;
    }
    if (typeof value !== "string") {
      return "Выберите значение";
    }
    return field.options.some((option) => option.value === value)
      ? null
      : "Недопустимое значение";
  }

  if (field.type === "multiselect") {
    if (value === undefined || value === null) {
      return field.required ? "Обязательное поле" : null;
    }
    if (!Array.isArray(value)) {
      return "Выберите один или несколько вариантов";
    }
    if (field.required && value.length === 0) {
      return "Обязательное поле";
    }
    return value.every(
      (item) =>
        typeof item === "string" &&
        field.options.some((option) => option.value === item),
    )
      ? null
      : "Недопустимое значение";
  }

  if (field.type === "checkbox") {
    if (value === undefined || value === null) {
      return field.required ? "Обязательное поле" : null;
    }
    return typeof value === "boolean"
      ? null
      : "Значение должно быть true или false";
  }

  return null;
}

export function buildQuestionnairePayload(
  questionnaire: RegistrationQuestionnaire,
  answers: QuestionnaireAnswers,
): QuestionnaireAnswers {
  const payload: QuestionnaireAnswers = {};

  questionnaire.fields.forEach((field) => {
    const value = answers[field.id];

    if (field.type === "checkbox") {
      if (typeof value === "boolean") {
        payload[field.id] = value;
      }
      return;
    }

    if (field.type === "multiselect") {
      payload[field.id] = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      return;
    }

    if (typeof value === "string") {
      payload[field.id] = value;
      return;
    }

    payload[field.id] = null;
  });

  return payload;
}
