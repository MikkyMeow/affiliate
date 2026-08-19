import geoip from 'geoip-lite';
import { getClientIp } from './getClientIp.js';

const TRUSTED_COUNTRY_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'x-geo-country',
  'x-country-code',
  'x-appengine-country',
];

const INVALID_CODES = new Set(['XX', 'T1', 'A1', 'A2']);

export function normalizeCountryCode(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(trimmed)) {
    return null;
  }

  if (INVALID_CODES.has(trimmed)) {
    return null;
  }

  return trimmed;
}

export function lookupCountryByIp(ip) {
  if (!ip) {
    return null;
  }

  try {
    const result = geoip.lookup(ip);

    if (!result?.country) {
      return null;
    }

    return normalizeCountryCode(result.country);
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: 'geoip_lookup_failed',
        ip,
        reason: error.message,
      }),
    );

    return null;
  }
}

export function detectRequestCountry(req) {
  if (!req) {
    return null;
  }

  for (const header of TRUSTED_COUNTRY_HEADERS) {
    const value = req.get?.(header);
    const country = normalizeCountryCode(value);

    if (country) {
      return country;
    }
  }

  const ip = getClientIp(req);

  return lookupCountryByIp(ip);
}
