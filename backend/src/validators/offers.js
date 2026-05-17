import {
  LEGACY_OFFER_STATUS_INACTIVE,
  OFFER_CATEGORY_VALUES,
  OFFER_GOAL_CURRENCY,
  OFFER_GOAL_LIMIT_TYPES,
  OFFER_GOAL_TYPES,
  OFFER_STATUSES,
  OFFER_VISIBILITY_MODES,
} from '../constants/offers.js';

const allowedStatuses = new Set([
  OFFER_STATUSES.ACTIVE,
  LEGACY_OFFER_STATUS_INACTIVE, // TODO: заменить на paused/archived после миграций.
]);
const allowedVisibilityModes = new Set(Object.values(OFFER_VISIBILITY_MODES));
const allowedGoalTypes = new Set(Object.values(OFFER_GOAL_TYPES));
const allowedGoalLimitTypes = new Set(Object.values(OFFER_GOAL_LIMIT_TYPES));
const allowedCategories = new Set(OFFER_CATEGORY_VALUES);
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const countryCodeRegex = /^[A-Z]{2}$/;
const currencyCodeRegex = /^[A-Z]{3}$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const DUPLICATE_CLICK_WINDOW_LIMITS = {
  min: 60,
  max: 2592000,
};

function buildError(field, message) {
  return { field, message };
}

function normalizeTitle(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMoney(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Number(value.toFixed(2));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const numberValue = Number(trimmed);
    if (!Number.isFinite(numberValue)) {
      return null;
    }

    return Number(numberValue.toFixed(2));
  }

  return null;
}

export function validateOfferCategory(
  value,
  { allowMissing = true, field = 'category' } = {},
) {
  if (value === undefined) {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'Категория обязательна')],
        };
  }

  if (value === null || value === '') {
    return {
      value: undefined,
      errors: [buildError(field, 'Категория обязательна')],
    };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Категория должна быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return {
      value: undefined,
      errors: [buildError(field, 'Категория обязательна')],
    };
  }

  if (!allowedCategories.has(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Недопустимое значение категории')],
    };
  }

  return { value: normalized, errors: [] };
}

function parseInteger(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }

    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (!/^-?\d+$/.test(trimmed)) {
      return null;
    }

    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function validateBoolean(value, { allowMissing = true, field } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'Значение обязательно')],
        };
  }

  if (typeof value === 'boolean') {
    return { value, errors: [] };
  }

  return {
    value: undefined,
    errors: [buildError(field, 'Значение должно быть булевым')],
  };
}

function validateDuplicateClickWindowSeconds(
  value,
  { allowMissing = true, field = 'duplicateClickWindowSeconds' } = {},
) {
  if (value === undefined) {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'Значение обязательно')],
        };
  }

  if (value === null || value === '') {
    return { value: null, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError(field, 'Окно должно быть целым числом')],
    };
  }

  if (
    parsed < DUPLICATE_CLICK_WINDOW_LIMITS.min ||
    parsed > DUPLICATE_CLICK_WINDOW_LIMITS.max
  ) {
    return {
      value: undefined,
      errors: [
        buildError(
          field,
          `Окно должно быть от ${DUPLICATE_CLICK_WINDOW_LIMITS.min} до ${DUPLICATE_CLICK_WINDOW_LIMITS.max} секунд`,
        ),
      ],
    };
  }

  return { value: parsed, errors: [] };
}

function validateVisibilityMode(
  value,
  { allowMissing = true, field = 'visibilityMode' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: OFFER_VISIBILITY_MODES.PUBLIC, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'Значение обязательно')],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Значение должно быть строкой')],
    };
  }

  const normalized = value.trim().toLowerCase();

  if (!allowedVisibilityModes.has(normalized)) {
    return {
      value: undefined,
      errors: [
        buildError(field, 'Недопустимый режим видимости'),
      ],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateOfferAvailability(
  value,
  { allowMissing = true, field = 'availability' } = {},
) {
  return validateVisibilityMode(value, { allowMissing, field });
}

function normalizeGeoInput(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    return trimmed.split(',').map((entry) => entry.trim());
  }

  return null;
}

function validateGeoList(
  value,
  { allowMissing = true, field = 'geo' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'Список стран обязателен')],
        };
  }

  const asArray = normalizeGeoInput(value);

  if (!asArray) {
    return {
      value: undefined,
      errors: [buildError(field, 'Список стран должен быть массивом строк')],
    };
  }

  const result = [];
  const seen = new Set();
  const errors = [];

  asArray.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      errors.push(
        buildError(
          `${field}[${index}]`,
          'Код страны должен быть строкой',
        ),
      );
      return;
    }

    const normalized = entry.trim().toUpperCase();
    if (!normalized) {
      return;
    }

    if (!countryCodeRegex.test(normalized)) {
      errors.push(
        buildError(
          `${field}[${index}]`,
          'Используйте двухбуквенный код ISO-3166',
        ),
      );
      return;
    }

    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return {
    value: result,
    errors,
  };
}

export function validateStatus(status, { allowMissing = true } = {}) {
  if (status === undefined || status === null || status === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError('status', 'Статус обязателен')],
        };
  }

  if (typeof status !== 'string') {
    return {
      value: undefined,
      errors: [buildError('status', 'Статус должен быть строкой')],
    };
  }

  if (!allowedStatuses.has(status)) {
    return {
      value: undefined,
      errors: [buildError('status', 'Недопустимое значение статуса')],
    };
  }

  return { value: status, errors: [] };
}

export function validateUuid(value, { allowMissing = true, field = 'id' } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'Значение обязательно')],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'Значение должно быть строкой')],
    };
  }

  const normalized = value.trim();

  if (!uuidRegex.test(normalized)) {
    return {
      value: undefined,
      errors: [buildError(field, 'Некорректный UUID')],
    };
  }

  return { value: normalized, errors: [] };
}

export function validateUrl(
  value,
  { allowMissing = true, field = 'targetUrl' } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError(field, 'URL обязателен')],
        };
  }

  if (typeof value !== 'string') {
    return {
      value: undefined,
      errors: [buildError(field, 'URL должен быть строкой')],
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      value: undefined,
      errors: [buildError(field, 'URL не должен быть пустым')],
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        value: undefined,
        errors: [buildError(field, 'URL должен начинаться с http или https')],
      };
    }
  } catch {
    return {
      value: undefined,
      errors: [buildError(field, 'Некорректный URL')],
    };
  }

  return { value: trimmed, errors: [] };
}

function validateGoalsPayload(value, { allowMissing = true } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowMissing
      ? { value: undefined, errors: [] }
      : {
          value: undefined,
          errors: [buildError('goals', 'Нужно передать хотя бы одну цель')],
        };
  }

  if (!Array.isArray(value)) {
    return {
      value: undefined,
      errors: [buildError('goals', 'Цели должны быть массивом объектов')],
    };
  }

  const goals = [];
  const errors = [];
  let defaultCount = 0;

  value.forEach((rawGoal, index) => {
    const path = `goals[${index}]`;

    if (!rawGoal || typeof rawGoal !== 'object' || Array.isArray(rawGoal)) {
      errors.push(buildError(path, 'Цель должна быть объектом'));
      return;
    }

    const goal = {};
    const errorsBefore = errors.length;

    if (Object.hasOwn(rawGoal, 'id')) {
      const { value: goalId, errors: idErrors } = validateUuid(rawGoal.id, {
        allowMissing: false,
        field: `${path}.id`,
      });
      errors.push(...idErrors);
      if (goalId) {
        goal.id = goalId;
      }
    }

    const normalizedName = normalizeTitle(rawGoal.name);
    if (!normalizedName) {
      errors.push(
        buildError(`${path}.name`, 'Название цели обязательно и не может быть пустым'),
      );
    } else {
      goal.name = normalizedName;
    }

    const type =
      typeof rawGoal.type === 'string' ? rawGoal.type.trim().toUpperCase() : null;
    if (!type || !allowedGoalTypes.has(type)) {
      errors.push(
        buildError(
          `${path}.type`,
          `type должен быть одним из: ${Array.from(allowedGoalTypes).join(', ')}`,
        ),
      );
    } else {
      goal.type = type;
    }

    const revenue = normalizeMoney(rawGoal.revenue);
    if (revenue === null || revenue < 0) {
      errors.push(
        buildError(
          `${path}.revenue`,
          'revenue должен быть неотрицательным числом',
        ),
      );
    } else {
      goal.revenue = revenue;
    }

    const payout = normalizeMoney(rawGoal.payout);
    if (payout === null || payout < 0) {
      errors.push(
        buildError(`${path}.payout`, 'payout должен быть неотрицательным числом'),
      );
    } else {
      goal.payout = payout;
    }

    const currency =
      typeof rawGoal.currency === 'string'
        ? rawGoal.currency.trim().toUpperCase()
        : null;
    if (!currency || !currencyCodeRegex.test(currency)) {
      errors.push(
        buildError(
          `${path}.currency`,
          'currency должен быть трёхбуквенным кодом ISO-4217',
        ),
      );
    } else if (currency !== OFFER_GOAL_CURRENCY) {
      errors.push(
        buildError(
          `${path}.currency`,
          `Поддерживается только ${OFFER_GOAL_CURRENCY}`,
        ),
      );
    } else {
      goal.currency = currency;
    }

    let isDefault = false;
    if (Object.hasOwn(rawGoal, 'isDefault')) {
      if (typeof rawGoal.isDefault !== 'boolean') {
        errors.push(
          buildError(`${path}.isDefault`, 'isDefault должен быть булевым значением'),
        );
      } else {
        isDefault = rawGoal.isDefault;
      }
    }
    goal.isDefault = isDefault;

    if (Object.hasOwn(rawGoal, 'isActive') || Object.hasOwn(rawGoal, 'status')) {
      errors.push(
        buildError(`${path}.isActive`, 'goal status удалён и больше не поддерживается'),
      );
    }

    if (goal.revenue !== undefined && goal.payout !== undefined && goal.payout > goal.revenue) {
      errors.push(
        buildError(`${path}.payout`, 'payout не может быть больше revenue'),
      );
    }

    let limitEnabled = false;
    if (Object.hasOwn(rawGoal, 'limitEnabled')) {
      if (typeof rawGoal.limitEnabled !== 'boolean') {
        errors.push(
          buildError(
            `${path}.limitEnabled`,
            'limitEnabled должен быть булевым значением',
          ),
        );
      } else {
        limitEnabled = rawGoal.limitEnabled;
      }
    }
    goal.limitEnabled = limitEnabled;

    if (limitEnabled) {
      const limitType =
        typeof rawGoal.limitType === 'string' ? rawGoal.limitType.trim() : null;
      if (!limitType || !allowedGoalLimitTypes.has(limitType)) {
        errors.push(
          buildError(
            `${path}.limitType`,
            `limitType должен быть одним из: ${Array.from(allowedGoalLimitTypes).join(', ')}`,
          ),
        );
      } else {
        goal.limitType = limitType;
      }

      const limitValue =
        typeof rawGoal.limitValue === 'number'
          ? rawGoal.limitValue
          : typeof rawGoal.limitValue === 'string' && /^\d+$/.test(rawGoal.limitValue.trim())
            ? Number.parseInt(rawGoal.limitValue.trim(), 10)
            : null;

      if (!Number.isInteger(limitValue) || limitValue <= 0) {
        errors.push(
          buildError(
            `${path}.limitValue`,
            'limitValue должен быть положительным целым числом',
          ),
        );
      } else {
        goal.limitValue = limitValue;
      }
    } else {
      goal.limitType = null;
      goal.limitValue = null;
    }

    if (errors.length === errorsBefore) {
      goals.push(goal);
      if (goal.isDefault) {
        defaultCount += 1;
      }
    }
  });

  if (defaultCount > 1) {
    errors.push(
      buildError('goals', 'Одновременно может быть только одна цель по умолчанию'),
    );
  }

  return {
    value: goals,
    errors,
  };
}

export function validateCreateOfferDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};

  const normalizedTitle = normalizeTitle(source.title);
  if (!normalizedTitle) {
    errors.push(buildError('title', 'Название обязательно и должно быть строкой'));
  } else {
    dto.title = normalizedTitle;
  }

  const { value: advertiserId, errors: advertiserErrors } = validateUuid(
    source.advertiserId,
    { allowMissing: false, field: 'advertiserId' },
  );
  errors.push(...advertiserErrors);
  if (advertiserId) {
    dto.advertiserId = advertiserId;
  }

  const { value: targetUrl, errors: urlErrors } = validateUrl(source.targetUrl, {
    allowMissing: false,
  });
  errors.push(...urlErrors);
  if (targetUrl) {
    dto.targetUrl = targetUrl;
  }

  if (Object.hasOwn(source, 'payoutRub')) {
    errors.push(
      buildError(
        'payoutRub',
        'offer-level payout удалён. Используйте payout на уровне goal',
      ),
    );
  }

  const { value: status, errors: statusErrors } = validateStatus(source.status);
  errors.push(...statusErrors);
  if (status) {
    dto.status = status;
  }

  const { value: category, errors: categoryErrors } = validateOfferCategory(
    source.category,
    { allowMissing: false },
  );
  errors.push(...categoryErrors);
  if (typeof category === 'string') {
    dto.category = category;
  }

  const {
    value: allowDuplicateClicksValue,
    errors: allowDuplicateErrors,
  } = validateBoolean(source.allowDuplicateClicks, {
    field: 'allowDuplicateClicks',
  });
  errors.push(...allowDuplicateErrors);

  const allowDuplicateClicks =
    allowDuplicateClicksValue === undefined ? true : allowDuplicateClicksValue;
  dto.allowDuplicateClicks = allowDuplicateClicks;

  const {
    value: duplicateWindowValue,
    errors: duplicateWindowErrors,
  } = validateDuplicateClickWindowSeconds(
    source.duplicateClickWindowSeconds,
    { allowMissing: allowDuplicateClicks },
  );
  errors.push(...duplicateWindowErrors);

  if (!allowDuplicateClicks) {
    if (typeof duplicateWindowValue === 'number') {
      dto.duplicateClickWindowSeconds = duplicateWindowValue;
    } else {
      errors.push(
        buildError(
          'duplicateClickWindowSeconds',
          'Укажите окно повторных кликов от 60 до 2592000 секунд',
        ),
      );
    }
  } else if (duplicateWindowValue !== undefined) {
    dto.duplicateClickWindowSeconds =
      duplicateWindowValue === null ? null : duplicateWindowValue;
  } else {
    dto.duplicateClickWindowSeconds = null;
  }

  if (Object.hasOwn(source, 'description')) {
    if (source.description === null) {
      dto.description = null;
    } else if (typeof source.description !== 'string') {
      errors.push(
        buildError('description', 'Описание должно быть строкой'),
      );
    } else {
      const trimmedDescription = source.description.trim();
      dto.description =
        trimmedDescription.length > 0 ? trimmedDescription : null;
    }
  }

  const rawAvailability = Object.hasOwn(source, 'availability')
    ? source.availability
    : source.visibilityMode;
  const { value: availability, errors: availabilityErrors } =
    validateOfferAvailability(rawAvailability, {
      allowMissing: true,
      field: Object.hasOwn(source, 'availability')
        ? 'availability'
        : 'visibilityMode',
    });
  errors.push(...availabilityErrors);
  if (availability) {
    dto.availability = availability;
    dto.visibilityMode = availability;
  }

  // TODO: (offer-domain-v2) Подключить доменную часть DTO к createOffer.
  const { draft: domainDraft, errors: domainDraftErrors } =
    validateOfferDomainDraft(source);

  return {
    dto,
    errors: [...errors, ...domainDraftErrors],
    domainDraft,
    domainDraftErrors,
  };
}

export function validateUpdateOfferDto(payload) {
  const errors = [];
  const source = payload ?? {};
  const dto = {};
  let hasAtLeastOneField = false;

  if (Object.hasOwn(source, 'title')) {
    hasAtLeastOneField = true;
    const normalizedTitle = normalizeTitle(source.title);
    if (!normalizedTitle) {
      errors.push(
        buildError('title', 'Название обязательно и должно быть непустой строкой'),
      );
    } else {
      dto.title = normalizedTitle;
    }
  }

  if (Object.hasOwn(source, 'advertiserId')) {
    hasAtLeastOneField = true;
    const { value: advertiserId, errors: advertiserErrors } = validateUuid(
      source.advertiserId,
      { allowMissing: false, field: 'advertiserId' },
    );
    errors.push(...advertiserErrors);
    if (advertiserId) {
      dto.advertiserId = advertiserId;
    }
  }

  if (Object.hasOwn(source, 'targetUrl')) {
    hasAtLeastOneField = true;
    const { value: targetUrl, errors: urlErrors } = validateUrl(
      source.targetUrl,
      { allowMissing: false },
    );
    errors.push(...urlErrors);
    if (targetUrl) {
      dto.targetUrl = targetUrl;
    }
  }

  if (Object.hasOwn(source, 'payoutRub')) {
    hasAtLeastOneField = true;
    errors.push(
      buildError(
        'payoutRub',
        'offer-level payout удалён. Используйте payout на уровне goal',
      ),
    );
  }

  if (Object.hasOwn(source, 'status')) {
    hasAtLeastOneField = true;
    const { value: status, errors: statusErrors } = validateStatus(source.status, {
      allowMissing: false,
    });
    errors.push(...statusErrors);
    if (status) {
      dto.status = status;
    }
  }

  if (Object.hasOwn(source, 'category')) {
    hasAtLeastOneField = true;
    const { value: category, errors: categoryErrors } = validateOfferCategory(
      source.category,
      { allowMissing: false },
    );
    errors.push(...categoryErrors);
    if (typeof category === 'string') {
      dto.category = category;
    }
  }

  if (Object.hasOwn(source, 'description')) {
    hasAtLeastOneField = true;
    if (source.description === null) {
      dto.description = null;
    } else if (typeof source.description !== 'string') {
      errors.push(
        buildError('description', 'Описание должно быть строкой'),
      );
    } else {
      const trimmedDescription = source.description.trim();
      dto.description =
        trimmedDescription.length > 0 ? trimmedDescription : null;
    }
  }

  if (
    Object.hasOwn(source, 'availability') ||
    Object.hasOwn(source, 'visibilityMode')
  ) {
    hasAtLeastOneField = true;
    const field = Object.hasOwn(source, 'availability')
      ? 'availability'
      : 'visibilityMode';
    const rawAvailability = Object.hasOwn(source, 'availability')
      ? source.availability
      : source.visibilityMode;
    const { value: availability, errors: availabilityErrors } =
      validateOfferAvailability(rawAvailability, {
        allowMissing: false,
        field,
      });
    errors.push(...availabilityErrors);
    if (availability) {
      dto.availability = availability;
      dto.visibilityMode = availability;
    }
  }

  let pendingAllowDuplicateClicks;
  if (Object.hasOwn(source, 'allowDuplicateClicks')) {
    hasAtLeastOneField = true;
    const {
      value: allowDuplicateClicksValue,
      errors: allowDuplicateErrors,
    } = validateBoolean(source.allowDuplicateClicks, {
      allowMissing: false,
      field: 'allowDuplicateClicks',
    });
    errors.push(...allowDuplicateErrors);

    if (typeof allowDuplicateClicksValue === 'boolean') {
      pendingAllowDuplicateClicks = allowDuplicateClicksValue;
      dto.allowDuplicateClicks = allowDuplicateClicksValue;
    }
  }

  let hasDuplicateWindowField = false;
  let pendingDuplicateWindowValue;
  if (Object.hasOwn(source, 'duplicateClickWindowSeconds')) {
    hasAtLeastOneField = true;
    hasDuplicateWindowField = true;
    const {
      value: duplicateWindowValue,
      errors: duplicateWindowErrors,
    } = validateDuplicateClickWindowSeconds(
      source.duplicateClickWindowSeconds,
      { allowMissing: false },
    );
    errors.push(...duplicateWindowErrors);

    if (duplicateWindowValue !== undefined) {
      pendingDuplicateWindowValue = duplicateWindowValue;
      dto.duplicateClickWindowSeconds = duplicateWindowValue;
    }
  }

  if (pendingAllowDuplicateClicks === false) {
    if (!hasDuplicateWindowField) {
      errors.push(
        buildError(
          'duplicateClickWindowSeconds',
          'Укажите окно повторных кликов при отключении дублей',
        ),
      );
    } else if (typeof pendingDuplicateWindowValue !== 'number') {
      errors.push(
        buildError(
          'duplicateClickWindowSeconds',
          'Окно должно быть задано в секундах',
        ),
      );
    }
  }

  if (!hasAtLeastOneField) {
    errors.push(buildError(null, 'Нужно указать поля для обновления'));
  }

  // TODO: (offer-domain-v2) Подключить доменную часть DTO к updateOffer.
  const { draft: domainDraft, errors: domainDraftErrors } =
    validateOfferDomainDraft(source);

  return {
    dto,
    errors: [...errors, ...domainDraftErrors],
    domainDraft,
    domainDraftErrors,
  };
}

export function validateOfferFilters(payload = {}) {
  const errors = [];
  const filter = {};
  const pagination = {};

  if (Object.hasOwn(payload, 'status')) {
    const { value: status, errors: statusErrors } = validateStatus(payload.status);
    errors.push(...statusErrors);
    if (status) {
      filter.status = status;
    }
  }

  if (Object.hasOwn(payload, 'advertiserId')) {
    const { value: advertiserId, errors: advertiserErrors } = validateUuid(
      payload.advertiserId,
      { field: 'advertiserId' },
    );
    errors.push(...advertiserErrors);
    if (advertiserId) {
      filter.advertiserId = advertiserId;
    }
  }

  if (Object.hasOwn(payload, 'category')) {
    const { value: category, errors: categoryErrors } =
      validateOfferCategory(payload.category, {
        allowMissing: false,
        field: 'category',
      });
    errors.push(...categoryErrors);
    if (typeof category === 'string') {
      filter.category = category;
    }
  }

  if (
    Object.hasOwn(payload, 'availability') ||
    Object.hasOwn(payload, 'visibilityMode')
  ) {
    const field = Object.hasOwn(payload, 'availability')
      ? 'availability'
      : 'visibilityMode';
    const rawAvailability = Object.hasOwn(payload, 'availability')
      ? payload.availability
      : payload.visibilityMode;
    const { value: availability, errors: availabilityErrors } =
      validateOfferAvailability(rawAvailability, {
        allowMissing: false,
        field,
      });
    errors.push(...availabilityErrors);
    if (availability) {
      filter.availability = availability;
    }
  }

  const { value: limit, errors: limitErrors } = validateLimit(payload.limit);
  errors.push(...limitErrors);
  if (typeof limit === 'number') {
    pagination.limit = limit;
  }

  const { value: offset, errors: offsetErrors } = validateOffset(payload.offset);
  errors.push(...offsetErrors);
  if (typeof offset === 'number') {
    pagination.offset = offset;
  }

  return { filter, pagination, errors };
}

export { allowedStatuses };

export function validateOfferDomainDraft(payload) {
  const source = payload ?? {};
  const domainDraft = {
    visibilityMode: OFFER_VISIBILITY_MODES.PUBLIC,
    targetingStrict: false,
  };
  const domainErrors = [];

  if (Object.hasOwn(source, 'description')) {
    if (typeof source.description !== 'string') {
      domainErrors.push(
        buildError('description', 'Описание должно быть строкой'),
      );
    } else {
      domainDraft.description = source.description.trim();
    }
  }

  if (Object.hasOwn(source, 'previewUrl')) {
    const { value: previewUrl, errors: previewErrors } = validateUrl(
      source.previewUrl,
      { field: 'previewUrl' },
    );
    domainErrors.push(...previewErrors);
    if (previewUrl) {
      domainDraft.previewUrl = previewUrl;
    }
  }

  if (Object.hasOwn(source, 'fallbackUrl')) {
    const { value: fallbackUrl, errors: fallbackErrors } = validateUrl(
      source.fallbackUrl,
      { field: 'fallbackUrl' },
    );
    domainErrors.push(...fallbackErrors);
    if (fallbackUrl) {
      domainDraft.fallbackUrl = fallbackUrl;
    }
  }

  const { value: visibilityMode, errors: visibilityErrors } =
    validateVisibilityMode(source.visibilityMode);
  domainErrors.push(...visibilityErrors);
  if (visibilityMode) {
    domainDraft.visibilityMode = visibilityMode;
  }

  const { value: targetingStrict, errors: targetingErrors } = validateBoolean(
    source.targetingStrict,
    { field: 'targetingStrict' },
  );
  domainErrors.push(...targetingErrors);
  if (typeof targetingStrict === 'boolean') {
    domainDraft.targetingStrict = targetingStrict;
  }

  const { value: allowedGeo, errors: allowedGeoErrors } = validateGeoList(
    source.allowedGeo,
    { field: 'allowedGeo' },
  );
  domainErrors.push(...allowedGeoErrors);
  if (allowedGeo !== undefined) {
    domainDraft.allowedGeo = allowedGeo;
  }

  const { value: deniedGeo, errors: deniedGeoErrors } = validateGeoList(
    source.deniedGeo,
    { field: 'deniedGeo' },
  );
  domainErrors.push(...deniedGeoErrors);
  if (deniedGeo !== undefined) {
    domainDraft.deniedGeo = deniedGeo;
  }

  const { value: goals, errors: goalErrors } = validateGoalsPayload(
    source.goals,
  );
  domainErrors.push(...goalErrors);
  if (goals !== undefined) {
    domainDraft.goals = goals;
  }

  if (domainDraft.targetingStrict && !domainDraft.fallbackUrl) {
    domainErrors.push(
      buildError(
        'fallbackUrl',
        'fallbackUrl обязателен, когда targetingStrict включён',
      ),
    );
  }

  return {
    draft: domainDraft,
    errors: domainErrors,
  };
}

function validateLimit(value) {
  if (value === undefined || value === null || value === '') {
    return { value: DEFAULT_LIMIT, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('limit', 'Limit должен быть целым числом')],
    };
  }

  if (parsed <= 0) {
    return {
      value: undefined,
      errors: [buildError('limit', 'Limit должен быть больше 0')],
    };
  }

  if (parsed > MAX_LIMIT) {
    return {
      value: undefined,
      errors: [
        buildError('limit', `Limit не может быть больше ${MAX_LIMIT}`),
      ],
    };
  }

  return { value: parsed, errors: [] };
}

function validateOffset(value) {
  if (value === undefined || value === null || value === '') {
    return { value: DEFAULT_OFFSET, errors: [] };
  }

  const parsed = parseInteger(value);
  if (parsed === null) {
    return {
      value: undefined,
      errors: [buildError('offset', 'Offset должен быть целым числом')],
    };
  }

  if (parsed < 0) {
    return {
      value: undefined,
      errors: [buildError('offset', 'Offset не может быть отрицательным')],
    };
  }

  return { value: parsed, errors: [] };
}
