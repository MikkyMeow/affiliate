export const PUBLIC_ID_PREFIXES = Object.freeze({
  affiliate: '#P',
  advertiser: '#A',
  offer: '#O',
});

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
