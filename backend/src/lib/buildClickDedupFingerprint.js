import crypto from 'node:crypto';

function normalizeFingerprintPart(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return String(value);
}

export function buildClickDedupFingerprint({
  offerId,
  affiliateId,
  ip,
  userAgent,
  device,
  referer,
  sub1,
  sub2,
  sub3,
  sub4,
  sub5,
}) {
  const parts = [
    normalizeFingerprintPart(offerId),
    normalizeFingerprintPart(affiliateId),
    normalizeFingerprintPart(ip),
    normalizeFingerprintPart(userAgent),
    normalizeFingerprintPart(device),
    normalizeFingerprintPart(referer),
    normalizeFingerprintPart(sub1),
    normalizeFingerprintPart(sub2),
    normalizeFingerprintPart(sub3),
    normalizeFingerprintPart(sub4),
    normalizeFingerprintPart(sub5),
  ];

  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}
