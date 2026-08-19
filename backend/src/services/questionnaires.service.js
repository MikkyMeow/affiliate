import pool from '../db.js';
import {
  QUESTIONNAIRE_FIELD_TYPES,
  QUESTIONNAIRE_OPTION_FIELD_TYPES,
  REGISTRATION_QUESTIONNAIRE_TARGET_VALUES,
} from '../constants/questionnaires.js';
import {
  findActiveRegistrationQuestionnaireByTargetRole,
  findRegistrationQuestionnaireById,
  findRegistrationQuestionnaireByTargetRole,
  listRegistrationQuestionnaires,
  upsertRegistrationQuestionnaire,
} from '../models/registrationQuestionnaires.model.js';
import {
  findRegistrationQuestionnaireAnswerByUserIdAndTargetRole,
  insertRegistrationQuestionnaireAnswer,
  updateRegistrationQuestionnaireAnswer,
} from '../models/registrationQuestionnaireAnswers.model.js';
import { writeAuditEvent } from './audit.service.js';
import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

function assertTargetRole(targetRole) {
  if (!REGISTRATION_QUESTIONNAIRE_TARGET_VALUES.includes(targetRole)) {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Анкета недоступна для этой роли',
      { targetRole: targetRole ?? null },
    );
  }
}

function sortQuestionnaireFields(fields = []) {
  return [...fields].sort((left, right) => {
    if (left.order === right.order) {
      return left.id.localeCompare(right.id);
    }

    return left.order - right.order;
  });
}

function serializeQuestionnaire(questionnaire) {
  if (!questionnaire) {
    return null;
  }

  return {
    ...questionnaire,
    fields: sortQuestionnaireFields(questionnaire.fields ?? []),
  };
}

function resolveTargetRoleForUser(user) {
  return user?.role ?? null;
}

function isQuestionnaireRequired(questionnaire) {
  if (!questionnaire || questionnaire.isActive === false) {
    return false;
  }

  return sortQuestionnaireFields(questionnaire.fields).some(
    (field) => field.required,
  );
}

function cloneJson(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return JSON.parse(JSON.stringify(value));
}

function buildOptionLookup(field) {
  const options = Array.isArray(field?.options) ? field.options : [];
  return new Map(options.map((option) => [option.value, option.label]));
}

function formatScalarAnswer(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value === null || value === undefined) {
    return '—';
  }

  return String(value);
}

function formatAnswerForField(field, value) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (!field) {
    return formatScalarAnswer(
      Array.isArray(value) || typeof value === 'object'
        ? JSON.stringify(value)
        : value,
    );
  }

  if (field.type === QUESTIONNAIRE_FIELD_TYPES.CHECKBOX) {
    return value === true ? 'Да' : 'Нет';
  }

  if (field.type === QUESTIONNAIRE_FIELD_TYPES.MULTISELECT) {
    const labels = buildOptionLookup(field);
    return Array.isArray(value)
      ? value.map((item) => labels.get(item) ?? item).join(', ')
      : formatScalarAnswer(value);
  }

  if (QUESTIONNAIRE_OPTION_FIELD_TYPES.has(field.type)) {
    const labels = buildOptionLookup(field);
    return typeof value === 'string' ? labels.get(value) ?? value : formatScalarAnswer(value);
  }

  return formatScalarAnswer(value);
}

function sanitizeTextAnswer(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateAnswerValue(field, rawValue) {
  const fieldKey = field.id;
  const isMissing =
    rawValue === undefined ||
    rawValue === null ||
    (typeof rawValue === 'string' && rawValue.trim().length === 0);
  const options = new Set((field.options ?? []).map((option) => option.value));

  if (field.type === QUESTIONNAIRE_FIELD_TYPES.TEXT || field.type === QUESTIONNAIRE_FIELD_TYPES.TEXTAREA) {
    const normalized = sanitizeTextAnswer(rawValue);
    if (normalized === null) {
      return field.required
        ? { error: 'Обязательное поле' }
        : { value: undefined };
    }

    return { value: normalized };
  }

  if (field.type === QUESTIONNAIRE_FIELD_TYPES.SELECT || field.type === QUESTIONNAIRE_FIELD_TYPES.RADIO) {
    if (isMissing) {
      return field.required ? { error: 'Обязательное поле' } : { value: undefined };
    }

    if (typeof rawValue !== 'string') {
      return { error: 'Значение должно быть строкой' };
    }

    const normalized = rawValue.trim();

    if (!normalized) {
      return field.required ? { error: 'Обязательное поле' } : { value: undefined };
    }

    if (!options.has(normalized)) {
      return { error: 'Выбрано недопустимое значение' };
    }

    return { value: normalized };
  }

  if (field.type === QUESTIONNAIRE_FIELD_TYPES.MULTISELECT) {
    if (rawValue === undefined || rawValue === null) {
      return field.required ? { error: 'Обязательное поле' } : { value: undefined };
    }

    if (!Array.isArray(rawValue)) {
      return { error: 'Значение должно быть массивом' };
    }

    if (rawValue.some((item) => typeof item !== 'string')) {
      return { error: 'Все значения должны быть строками' };
    }

    const normalized = rawValue
      .map((item) => item.trim())
      .filter(Boolean);

    if (field.required && normalized.length === 0) {
      return { error: 'Обязательное поле' };
    }

    if (normalized.some((item) => !options.has(item))) {
      return { error: 'Выбраны недопустимые значения' };
    }

    return normalized.length > 0 ? { value: [...new Set(normalized)] } : { value: undefined };
  }

  if (field.type === QUESTIONNAIRE_FIELD_TYPES.CHECKBOX) {
    if (rawValue === undefined || rawValue === null) {
      return field.required ? { error: 'Обязательное поле' } : { value: undefined };
    }

    if (typeof rawValue !== 'boolean') {
      return { error: 'Значение должно быть boolean' };
    }

    return { value: rawValue };
  }

  return { error: 'Неподдерживаемый тип поля' };
}

function validateAnswersAgainstQuestionnaire(questionnaire, rawAnswers) {
  const errors = {};
  const sanitizedAnswers = {};
  const fields = sortQuestionnaireFields(questionnaire?.fields ?? []);
  const knownFieldIds = new Set(fields.map((field) => field.id));

  Object.keys(rawAnswers ?? {}).forEach((key) => {
    if (!knownFieldIds.has(key)) {
      errors[key] = 'Неизвестное поле анкеты';
    }
  });

  fields.forEach((field) => {
    const validation = validateAnswerValue(field, rawAnswers?.[field.id]);
    if (validation.error) {
      errors[field.id] = validation.error;
      return;
    }

    if (validation.value !== undefined) {
      sanitizedAnswers[field.id] = validation.value;
    }
  });

  return {
    sanitizedAnswers,
    fieldErrors: errors,
  };
}

function buildRequiredMissingFields(questionnaire, answers = {}) {
  if (!questionnaire) {
    return [];
  }

  return sortQuestionnaireFields(questionnaire.fields)
    .filter((field) => field.required)
    .filter((field) => validateAnswerValue(field, answers[field.id]).error)
    .map((field) => field.id);
}

function mergeAnswers(existingAnswers, questionnaire, sanitizedAnswers) {
  const currentFieldIds = new Set(
    sortQuestionnaireFields(questionnaire.fields).map((field) => field.id),
  );
  const preservedEntries = Object.entries(existingAnswers ?? {}).filter(
    ([key]) => !currentFieldIds.has(key),
  );

  return {
    ...Object.fromEntries(preservedEntries),
    ...sanitizedAnswers,
  };
}

export function buildQuestionnaireAnswerItems(questionnaire, answerRecord) {
  const answers = answerRecord?.answers ?? {};
  const fields = sortQuestionnaireFields(questionnaire?.fields ?? []);
  const consumedKeys = new Set();
  const items = [];

  fields.forEach((field) => {
    if (!Object.hasOwn(answers, field.id)) {
      return;
    }

    consumedKeys.add(field.id);
    items.push({
      fieldId: field.id,
      name: field.name ?? null,
      question: field.question ?? field.name ?? field.id,
      type: field.type ?? null,
      answer: formatAnswerForField(field, answers[field.id]),
      rawAnswer: answers[field.id],
      isFallback: false,
    });
  });

  Object.entries(answers).forEach(([key, value]) => {
    if (consumedKeys.has(key)) {
      return;
    }

    items.push({
      fieldId: key,
      name: null,
      question: `Saved answer: ${key}`,
      type: null,
      answer: formatAnswerForField(null, value),
      rawAnswer: value,
      isFallback: true,
    });
  });

  return items;
}

export async function listAdminQuestionnaires(filter, { client } = {}) {
  const questionnaires = await listRegistrationQuestionnaires(filter, { client });
  return questionnaires.map(serializeQuestionnaire);
}

export async function getAdminQuestionnaireById(id, { client } = {}) {
  const questionnaire = await findRegistrationQuestionnaireById(id, { client });

  if (!questionnaire) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Анкета не найдена', {
      questionnaireId: id,
    });
  }

  return serializeQuestionnaire(questionnaire);
}

export async function getQuestionnaireByTargetRole(targetRole, { client } = {}) {
  assertTargetRole(targetRole);
  const questionnaire = await findRegistrationQuestionnaireByTargetRole(targetRole, {
    client,
  });

  return serializeQuestionnaire(questionnaire);
}

export async function upsertAdminQuestionnaire(
  targetRole,
  dto,
  { actor = null, requestId = null } = {},
) {
  assertTargetRole(targetRole);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const previousQuestionnaire =
      await findRegistrationQuestionnaireByTargetRole(targetRole, { client });

    const questionnaire = await upsertRegistrationQuestionnaire(
      {
        targetRole,
        title: dto.title ?? null,
        description: dto.description ?? null,
        fields: sortQuestionnaireFields(dto.fields ?? []),
        isActive: dto.isActive ?? true,
        createdBy: previousQuestionnaire?.createdBy ?? actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      },
      { client },
    );

    await writeAuditEvent({
      entityType: 'registration_questionnaire',
      entityId: questionnaire.id,
      action: previousQuestionnaire
        ? 'questionnaire.updated'
        : 'questionnaire.created',
      actorUserId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      requestId,
      client,
      oldValue: previousQuestionnaire
        ? {
            title: previousQuestionnaire.title ?? null,
            description: previousQuestionnaire.description ?? null,
            fields: previousQuestionnaire.fields ?? [],
            isActive: previousQuestionnaire.isActive ?? false,
          }
        : null,
      newValue: {
        title: questionnaire.title ?? null,
        description: questionnaire.description ?? null,
        fields: questionnaire.fields ?? [],
        isActive: questionnaire.isActive ?? false,
      },
      metadata: {
        targetRole,
      },
    });

    await client.query('COMMIT');

    return serializeQuestionnaire(questionnaire);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getQuestionnaireAnswerRecordForUser(userId, targetRole, { client } = {}) {
  assertTargetRole(targetRole);
  return findRegistrationQuestionnaireAnswerByUserIdAndTargetRole(userId, targetRole, {
    client,
  });
}

export async function getQuestionnaireAnswerItemsForUser(
  userId,
  targetRole,
  { client } = {},
) {
  assertTargetRole(targetRole);

  const [questionnaire, answerRecord] = await Promise.all([
    findRegistrationQuestionnaireByTargetRole(targetRole, { client }),
    findRegistrationQuestionnaireAnswerByUserIdAndTargetRole(userId, targetRole, {
      client,
    }),
  ]);

  return buildQuestionnaireAnswerItems(questionnaire, answerRecord);
}

export async function getQuestionnaireCompletionStateForUser(
  { userId, role },
  { client } = {},
) {
  const targetRole = resolveTargetRoleForUser({ role });

  if (!REGISTRATION_QUESTIONNAIRE_TARGET_VALUES.includes(targetRole)) {
    return {
      targetRole: null,
      required: false,
      completed: true,
      questionnaire: null,
      answerRecord: null,
      requiredMissingFields: [],
    };
  }

  const questionnaire = await findActiveRegistrationQuestionnaireByTargetRole(targetRole, {
    client,
  });
  const answerRecord =
    await findRegistrationQuestionnaireAnswerByUserIdAndTargetRole(userId, targetRole, {
      client,
    });

  const required = isQuestionnaireRequired(questionnaire);

  if (!questionnaire) {
    return {
      targetRole,
      required: false,
      completed: true,
      questionnaire: null,
      answerRecord,
      requiredMissingFields: [],
    };
  }

  if (!required) {
    return {
      targetRole,
      required: false,
      completed: true,
      questionnaire: serializeQuestionnaire(questionnaire),
      answerRecord,
      requiredMissingFields: [],
    };
  }

  if (answerRecord?.submittedAt) {
    return {
      targetRole,
      required: true,
      completed: true,
      questionnaire: serializeQuestionnaire(questionnaire),
      answerRecord,
      requiredMissingFields: [],
    };
  }

  return {
    targetRole,
    required: true,
    completed: false,
    questionnaire: serializeQuestionnaire(questionnaire),
    answerRecord,
    requiredMissingFields: buildRequiredMissingFields(
      questionnaire,
      answerRecord?.answers ?? {},
    ),
  };
}

export async function getMyQuestionnaire(user) {
  const targetRole = resolveTargetRoleForUser(user);
  assertTargetRole(targetRole);

  const completion = await getQuestionnaireCompletionStateForUser({
    userId: user.userId ?? user.id,
    role: targetRole,
  });

  return {
    questionnaire: completion.questionnaire,
    answers: completion.questionnaire
      ? cloneJson(completion.answerRecord?.answers ?? {})
      : {},
    isCompleted: completion.completed,
    requiredMissingFields: completion.requiredMissingFields,
  };
}

export async function submitMyQuestionnaireAnswers(
  user,
  rawAnswers,
  { actor = null, requestId = null } = {},
) {
  const targetRole = resolveTargetRoleForUser(user);
  assertTargetRole(targetRole);
  const userId = user.userId ?? user.id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const questionnaire = await findActiveRegistrationQuestionnaireByTargetRole(targetRole, {
      client,
    });

    if (!questionnaire) {
      await client.query('COMMIT');
      return {
        answers: {},
        isCompleted: true,
        requiredMissingFields: [],
      };
    }

    const existingAnswer =
      await findRegistrationQuestionnaireAnswerByUserIdAndTargetRole(userId, targetRole, {
        client,
      });
    const { sanitizedAnswers, fieldErrors } = validateAnswersAgainstQuestionnaire(
      questionnaire,
      rawAnswers,
    );

    if (Object.keys(fieldErrors).length > 0) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        422,
        'Ошибка валидации анкеты',
        { fields: fieldErrors },
      );
    }

    const mergedAnswers = mergeAnswers(
      existingAnswer?.answers ?? {},
      questionnaire,
      sanitizedAnswers,
    );
    const submittedAt = existingAnswer?.submittedAt ?? new Date().toISOString();

    const savedAnswer = existingAnswer
      ? await updateRegistrationQuestionnaireAnswer(
          existingAnswer.id,
          {
            answers: mergedAnswers,
            submittedAt,
          },
          { client },
        )
      : await insertRegistrationQuestionnaireAnswer(
          {
            userId,
            targetRole,
            answers: mergedAnswers,
            submittedAt,
          },
          { client },
        );

    await writeAuditEvent({
      entityType: 'questionnaire_answers',
      entityId: savedAnswer.id,
      action: existingAnswer
        ? 'questionnaire.answers_updated'
        : 'questionnaire.answers_submitted',
      actorUserId: actor?.userId ?? userId,
      actorRole: actor?.role ?? targetRole,
      requestId,
      client,
      oldValue: {
        answers: existingAnswer?.answers ?? {},
      },
      newValue: {
        answers: savedAnswer.answers ?? {},
      },
      metadata: {
        targetRole,
        questionnaireId: questionnaire.id,
      },
    });

    await client.query('COMMIT');

    return {
      answers: cloneJson(savedAnswer.answers ?? {}),
      isCompleted: true,
      requiredMissingFields: [],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
