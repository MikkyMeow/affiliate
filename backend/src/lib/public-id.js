export const PUBLIC_ID_PREFIXES = Object.freeze({
  affiliate: '#P',
  advertiser: '#A',
  offer: '#O',
});

const publicIdDigitsRegex = /^\d+$/;

export function normalizePublicIdNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function formatPublicId(prefix, publicIdNumber) {
  if (typeof prefix !== 'string' || !prefix) {
    throw new Error('A public ID prefix is required');
  }

  if (!Number.isSafeInteger(publicIdNumber) || publicIdNumber <= 0) {
    return null;
  }

  return `${prefix}${publicIdNumber}`;
}

export function parsePublicIdNumber(value, prefix) {
  if (typeof value !== 'string' || typeof prefix !== 'string' || !prefix.trim()) {
    return null;
  }

  const normalizedPrefix = prefix.trim().replace(/^#/, '').toUpperCase();
  const normalizedValue = value.trim().toUpperCase();

  if (!normalizedValue) {
    return null;
  }

  const candidate = normalizedValue.startsWith('#')
    ? normalizedValue.slice(1)
    : normalizedValue;

  if (!candidate.startsWith(normalizedPrefix)) {
    return null;
  }

  const suffix = candidate.slice(normalizedPrefix.length);

  if (!publicIdDigitsRegex.test(suffix)) {
    return null;
  }

  const parsed = Number.parseInt(suffix, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function attachPublicId(row, prefix) {
  if (!row) {
    return null;
  }

  const publicIdNumber = normalizePublicIdNumber(row.publicIdNumber);

  return {
    ...row,
    publicIdNumber,
    publicId: formatPublicId(prefix, publicIdNumber),
  };
}

export function attachPublicIds(rows, prefix) {
  return rows.map((row) => attachPublicId(row, prefix));
}
