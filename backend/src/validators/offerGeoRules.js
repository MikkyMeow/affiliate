const allowedRuleTypes = new Set(['allow', 'deny']);
const countryCodeRegex = /^[A-Z]{2}$/;

function buildError(field, message) {
  return { field, message };
}

function normalizeRuleType(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return allowedRuleTypes.has(normalized) ? normalized : null;
}

function normalizeCountryCode(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return normalized;
}

export function validateCreateOfferGeoRulePayload(payload) {
  const source = payload ?? {};
  const dto = {};
  const errors = [];

  const ruleType = normalizeRuleType(source.ruleType);
  if (!ruleType) {
    errors.push(
      buildError(
        'ruleType',
        "ruleType должен быть 'allow' или 'deny'",
      ),
    );
  } else {
    dto.ruleType = ruleType;
  }

  const countryCode = normalizeCountryCode(source.countryCode);
  if (!countryCode || !countryCodeRegex.test(countryCode)) {
    errors.push(
      buildError(
        'countryCode',
        'Нужно указать двухбуквенный код страны (ISO-3166-1 alpha-2)',
      ),
    );
  } else {
    dto.countryCode = countryCode;
  }

  return { dto, errors };
}

export function validateOfferTargetingStrictPayload(payload) {
  const source = payload ?? {};
  const dto = {};
  const errors = [];

  if (!Object.hasOwn(source, 'targetingStrict')) {
    errors.push(
      buildError(
        'targetingStrict',
        'Нужно указать targetingStrict',
      ),
    );
  } else if (typeof source.targetingStrict !== 'boolean') {
    errors.push(
      buildError(
        'targetingStrict',
        'targetingStrict должен быть булевым значением',
      ),
    );
  } else {
    dto.targetingStrict = source.targetingStrict;
  }

  return { dto, errors };
}
