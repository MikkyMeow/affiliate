import {
  QUESTIONNAIRE_FIELD_TYPES,
  QUESTIONNAIRE_FIELD_TYPE_VALUES,
  QUESTIONNAIRE_OPTION_FIELD_TYPES,
} from '../constants/questionnaires.js';

function buildError(field, message) {
  return { field, message };
}

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOrder(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function generateFieldId(seed, usedIds) {
  const base = slugify(seed) || 'field';
  let candidate = base;
  let suffix = 1;

  while (usedIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

function normalizeFieldType(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return QUESTIONNAIRE_FIELD_TYPE_VALUES.includes(normalized) ? normalized : null;
}

function normalizeOption(option, fieldPath, optionValues, errors) {
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    errors.push(buildError(fieldPath, 'Опция должна быть объектом'));
    return null;
  }

  const value = normalizeRequiredText(option.value);
  const label = normalizeRequiredText(option.label);

  if (!value) {
    errors.push(buildError(`${fieldPath}.value`, 'Значение опции обязательно'));
  }

  if (!label) {
    errors.push(buildError(`${fieldPath}.label`, 'Подпись опции обязательна'));
  }

  if (!value || !label) {
    return null;
  }

  if (optionValues.has(value)) {
    errors.push(buildError(`${fieldPath}.value`, 'Значения опций должны быть уникальны'));
    return null;
  }

  optionValues.add(value);

  return {
    value,
    label,
  };
}

export function validateQuestionnaireTargetRole(
  value,
  { field = 'targetRole', allowMissing = false } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : { value: undefined, errors: [buildError(field, 'Целевая роль обязательна')] };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Целевая роль должна быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (!['affiliate', 'advertiser'].includes(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Недопустимая целевая роль')],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateQuestionnaireListQuery(payload) {
  const source = payload ?? {};
  const { value: targetRole, errors } = validateQuestionnaireTargetRole(
    source.targetRole ?? source.target_role,
    {
      field: 'targetRole',
      allowMissing: true,
    },
  );

  return {
    filter: {
      targetRole,
    },
    errors,
  };
}

export function validateQuestionnaireUpsertDto(payload) {
  const source = payload ?? {};
  const errors = [];
  const dto = {};
  const fieldsSource = source.fields;

  const title = normalizeOptionalText(source.title);
  if (
    source.title !== undefined &&
    source.title !== null &&
    typeof source.title !== 'string'
  ) {
    errors.push(buildError('title', 'title должен быть строкой'));
  } else if (source.title !== undefined) {
    dto.title = title;
  }

  const description = normalizeOptionalText(source.description);
  if (source.description !== undefined && source.description !== null && typeof source.description !== 'string') {
    errors.push(buildError('description', 'description должен быть строкой'));
  } else if (source.description !== undefined) {
    dto.description = description;
  }

  if (source.isActive !== undefined) {
    if (typeof source.isActive !== 'boolean') {
      errors.push(buildError('isActive', 'isActive должен быть boolean'));
    } else {
      dto.isActive = source.isActive;
    }
  }

  if (!Array.isArray(fieldsSource)) {
    errors.push(buildError('fields', 'fields должен быть массивом'));
    return { dto, errors };
  }

  const usedIds = new Set();
  const usedNames = new Set();

  dto.fields = fieldsSource.map((field, index) => {
    const fieldPath = `fields.${index}`;

    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      errors.push(buildError(fieldPath, 'Поле анкеты должно быть объектом'));
      return null;
    }

    const name = normalizeRequiredText(field.name);
    const question = normalizeRequiredText(field.question);
    const type = normalizeFieldType(field.type);
    const required =
      field.required === undefined ? false : Boolean(field.required);
    const order = parseOrder(field.order);
    const rawId = normalizeRequiredText(field.id);
    const fieldId =
      rawId && !usedIds.has(rawId)
        ? rawId
        : generateFieldId(name ?? question ?? `field_${index + 1}`, usedIds);

    if (rawId && usedIds.has(rawId) && rawId !== fieldId) {
      errors.push(buildError(`${fieldPath}.id`, 'Идентификаторы полей должны быть уникальны'));
    } else if (rawId) {
      usedIds.add(rawId);
    }

    if (!name) {
      errors.push(buildError(`${fieldPath}.name`, 'name обязателен'));
    } else if (usedNames.has(name)) {
      errors.push(buildError(`${fieldPath}.name`, 'name должен быть уникальным'));
    } else {
      usedNames.add(name);
    }

    if (!question) {
      errors.push(buildError(`${fieldPath}.question`, 'question обязателен'));
    }

    if (!type) {
      errors.push(
        buildError(
          `${fieldPath}.type`,
          `type должен быть одним из: ${QUESTIONNAIRE_FIELD_TYPE_VALUES.join(', ')}`,
        ),
      );
    }

    if (field.required !== undefined && typeof field.required !== 'boolean') {
      errors.push(buildError(`${fieldPath}.required`, 'required должен быть boolean'));
    }

    if (order === null) {
      errors.push(buildError(`${fieldPath}.order`, 'order должен быть числом'));
    }

    const optionValues = new Set();
    const rawOptions = field.options;
    const options = Array.isArray(rawOptions)
      ? rawOptions
          .map((option, optionIndex) =>
            normalizeOption(
              option,
              `${fieldPath}.options.${optionIndex}`,
              optionValues,
              errors,
            ),
          )
          .filter(Boolean)
      : [];

    if (QUESTIONNAIRE_OPTION_FIELD_TYPES.has(type)) {
      if (!Array.isArray(rawOptions)) {
        errors.push(
          buildError(`${fieldPath}.options`, 'Для этого типа поля options обязателен'),
        );
      }

      if (required && options.length === 0) {
        errors.push(
          buildError(
            `${fieldPath}.options`,
            'Обязательное поле с вариантами должно содержать хотя бы одну опцию',
          ),
        );
      }
    }

    return {
      id: fieldId,
      name: name ?? '',
      question: question ?? '',
      type: type ?? QUESTIONNAIRE_FIELD_TYPES.TEXT,
      required,
      order: order ?? index,
      options,
    };
  });

  dto.fields = dto.fields
    .filter(Boolean)
    .sort((left, right) => left.order - right.order);

  return { dto, errors };
}

export function validateQuestionnaireAnswersDto(payload) {
  const source = payload ?? {};
  const errors = [];

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {
      dto: { answers: {} },
      errors: [buildError('answers', 'Тело запроса должно быть объектом')],
    };
  }

  if (!source.answers || typeof source.answers !== 'object' || Array.isArray(source.answers)) {
    errors.push(buildError('answers', 'answers должен быть объектом'));
    return { dto: { answers: {} }, errors };
  }

  return {
    dto: {
      answers: source.answers,
    },
    errors,
  };
}
