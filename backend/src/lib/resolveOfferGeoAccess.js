import { normalizeCountryCode } from './detectRequestCountry.js';

export const GEO_DENY_REASONS = {
  COUNTRY_DENIED: 'country_denied',
  NOT_IN_ALLOW_LIST: 'not_in_allow_list',
  UNKNOWN_COUNTRY: 'unknown_country',
};

function normalizeCountryList(input) {
  if (!Array.isArray(input)) {
    return new Set();
  }

  const normalized = new Set();

  for (const value of input) {
    const country = normalizeCountryCode(value);

    if (country) {
      normalized.add(country);
    }
  }

  return normalized;
}

export function resolveOfferGeoAccess({
  targetingStrict = false,
  countryCode = null,
  allowCountries = [],
  denyCountries = [],
} = {}) {
  if (!targetingStrict) {
    return {
      isAllowed: true,
      denyReason: null,
    };
  }

  const normalizedCountry = normalizeCountryCode(countryCode);

  if (!normalizedCountry) {
    return {
      isAllowed: false,
      denyReason: GEO_DENY_REASONS.UNKNOWN_COUNTRY,
    };
  }

  const denySet = normalizeCountryList(denyCountries);

  if (denySet.has(normalizedCountry)) {
    return {
      isAllowed: false,
      denyReason: GEO_DENY_REASONS.COUNTRY_DENIED,
    };
  }

  const allowSet = normalizeCountryList(allowCountries);

  if (allowSet.size === 0) {
    return {
      isAllowed: true,
      denyReason: null,
    };
  }

  if (!allowSet.has(normalizedCountry)) {
    return {
      isAllowed: false,
      denyReason: GEO_DENY_REASONS.NOT_IN_ALLOW_LIST,
    };
  }

  return {
    isAllowed: true,
    denyReason: null,
  };
}
