const DEFAULT_TIMEZONE =
  process.env.TZ?.trim() ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  'UTC';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidTimeZone(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getDefaultTimeZone() {
  return DEFAULT_TIMEZONE;
}

export function resolveTimeZone(value, fallback = DEFAULT_TIMEZONE) {
  if (isValidTimeZone(value)) {
    return value.trim();
  }

  return fallback;
}

export function formatDateInTimeZone(value, timeZone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}
