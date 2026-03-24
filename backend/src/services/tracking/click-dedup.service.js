import pool from '../../db.js';
import { buildClickDedupFingerprint } from '../../lib/buildClickDedupFingerprint.js';
import {
  deleteExpiredDedupEntry,
  findActiveDedupEntry,
} from '../../models/clickDedupRegistry.model.js';

const MIN_WINDOW_SECONDS = 60;
const MAX_WINDOW_SECONDS = 2592000; // 30 days

function resolveWindowSeconds(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function isDuplicateClickProtectionEnabled(offer) {
  if (!offer || offer.allowDuplicateClicks !== false) {
    return false;
  }

  const seconds = resolveWindowSeconds(offer.duplicateClickWindowSeconds);
  if (seconds === null) {
    return false;
  }

  return seconds >= MIN_WINDOW_SECONDS && seconds <= MAX_WINDOW_SECONDS;
}

export function getDuplicateClickWindowMs(offer) {
  const seconds = resolveWindowSeconds(offer?.duplicateClickWindowSeconds);
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return seconds * 1000;
}

export async function resolveDuplicateClick(
  {
    offer,
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
    fingerprint,
  },
  { client = pool } = {},
) {
  if (!offer) {
    throw new Error('Offer context is required for dedup resolution');
  }

  const dedupeFingerprint =
    fingerprint ??
    buildClickDedupFingerprint({
      offerId: offerId ?? offer.id,
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
    });

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1));', [
    dedupeFingerprint,
  ]);

  await deleteExpiredDedupEntry(dedupeFingerprint, { client });

  const existing = await findActiveDedupEntry(dedupeFingerprint, { client });
  if (existing) {
    return {
      reused: true,
      clickId: existing.clickId,
      dedupeFingerprint,
      expiresAt: existing.expiresAt,
    };
  }

  const windowMs = getDuplicateClickWindowMs(offer);
  if (windowMs <= 0) {
    throw new Error('Deduplication window must be greater than zero');
  }

  return {
    reused: false,
    dedupeFingerprint,
    expiresAt: new Date(Date.now() + windowMs),
  };
}
