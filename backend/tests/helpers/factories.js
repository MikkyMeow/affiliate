import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pool from '../../src/db.js';
import { createUser } from '../../src/models/userModel.js';
import { createAffiliate } from '../../src/models/affiliateModel.js';
import { createAdvertiser } from '../../src/models/advertiserModel.js';
import { upsertOfferGoalAffiliateRate } from '../../src/models/offerGoalAffiliateRates.model.js';
import { insertOfferGoal } from '../../src/models/offerGoals.model.js';
import { upsertOfferAffiliateAccess } from '../../src/models/offerAffiliateAccess.model.js';
import { upsertOfferAffiliateHidden } from '../../src/models/offerAffiliateHidden.model.js';
import { insertOfferGeoRule } from '../../src/models/offerGeoRules.model.js';
import { attachPublicId, PUBLIC_ID_PREFIXES } from '../../src/lib/public-id.js';

function randomString(length = 8) {
  return crypto.randomBytes(length).toString('hex');
}

function buildEmail(prefix = 'user') {
  return `${prefix}-${randomString(4)}@example.com`;
}

export async function createTestUser({
  role = 'affiliate',
  email = buildEmail(role),
  password = `P@ssw0rd-${randomString(4)}`,
  displayName = 'Test User',
} = {}) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    email,
    passwordHash,
    displayName,
    role,
  });

  return { user, password };
}

export async function createTestAffiliate({
  name = 'Test Affiliate',
  email = buildEmail('affiliate'),
  status = 'active',
  userId = null,
} = {}) {
  return createAffiliate({
    name,
    email,
    status,
    userId,
  });
}

export async function createTestAffiliateUser(options = {}) {
  const { user, password } = await createTestUser({
    role: 'affiliate',
    email: options.email,
    password: options.password,
    displayName: options.displayName ?? 'Affiliate User',
  });

  const affiliate = await createTestAffiliate({
    name: options.affiliateName ?? 'Test Affiliate',
    email: user.email,
    status: options.status ?? 'active',
    userId: user.id,
  });

  return { user, affiliate, password };
}

export async function createTestAdminUser(options = {}) {
  return createTestUser({
    role: options.role ?? 'admin',
    email: options.email,
    password: options.password,
    displayName: options.displayName ?? 'Admin User',
  });
}

export async function createTestAdvertiserUser(options = {}) {
  const { user, password } = await createTestUser({
    role: 'advertiser',
    email: options.email,
    password: options.password,
    displayName: options.displayName ?? 'Advertiser User',
  });

  const advertiser = await createTestAdvertiser({
    name: options.advertiserName ?? 'Test Advertiser',
    status: options.status ?? 'active',
    userId: user.id,
  });

  return { user, advertiser, password };
}

export async function createTestAdvertiser({
  name = `Advertiser ${randomString(4)}`,
  status = 'active',
  userId = null,
} = {}) {
  return createAdvertiser({ name, status, userId });
}

export async function createTestOffer({
  advertiserId,
  title = `Offer ${randomString(4)}`,
  category = 'other',
  targetUrl = `https://offers.example.com/${randomString(6)}`,
  status = 'active',
  visibilityMode = 'public',
  targetingStrict = false,
  fallbackUrl = null,
  previewUrl = null,
  postbackToken = crypto.randomBytes(16).toString('hex'),
  allowDuplicateClicks = true,
  duplicateClickWindowSeconds = null,
} = {}) {
  const advertiser =
    advertiserId ?? (await createTestAdvertiser()).id;

  const result = await pool.query(
    `
      INSERT INTO offers (
        title,
        category,
        advertiser_id,
        target_url,
        status,
        visibility_mode,
        targeting_strict,
        fallback_url,
        preview_url,
        postback_token,
        allow_duplicate_clicks,
        duplicate_click_window_seconds
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING
        id,
        public_id_number AS "publicIdNumber",
        title,
        category,
        advertiser_id AS "advertiserId",
        target_url AS "targetUrl",
        status,
        visibility_mode AS "visibilityMode",
        targeting_strict AS "targetingStrict",
        fallback_url AS "fallbackUrl",
        preview_url AS "previewUrl",
        postback_token AS "postbackToken",
        allow_duplicate_clicks AS "allowDuplicateClicks",
        duplicate_click_window_seconds AS "duplicateClickWindowSeconds"
    `,
    [
      title,
      category,
      advertiser,
      targetUrl,
      status,
      visibilityMode,
      targetingStrict,
      fallbackUrl,
      previewUrl,
      postbackToken,
      allowDuplicateClicks,
      duplicateClickWindowSeconds,
    ],
  );

  return attachPublicId(result.rows[0], PUBLIC_ID_PREFIXES.offer);
}

export async function createTestOfferGoal(
  offerId,
  {
    name = 'Default Goal',
    type = 'cpa',
    revenue = 300,
    payout = 150,
    currency = 'RUB',
    isDefault = true,
    limitEnabled = false,
    limitType = null,
    limitValue = null,
  } = {},
) {
  if (!offerId) {
    throw new Error('offerId is required to create goal');
  }

  return insertOfferGoal({
    offerId,
    name,
    type: typeof type === 'string' ? type.toLowerCase() : 'cpa',
    revenue,
    payout,
    currency,
    isDefault,
    limitEnabled,
    limitType,
    limitValue,
  });
}

export async function createTestOfferGoalAffiliateRate(
  goalId,
  affiliateId,
  {
    revenue = 300,
    payout = 150,
    createdBy,
    updatedBy = null,
  } = {},
) {
  if (!goalId || !affiliateId || !createdBy) {
    throw new Error('goalId, affiliateId, and createdBy are required to create affiliate rate');
  }

  return upsertOfferGoalAffiliateRate({
    goalId,
    affiliateId,
    revenue,
    payout,
    createdBy,
    updatedBy,
  });
}

export async function grantAffiliateAccess({
  offerId,
  affiliateId,
  accessType,
  source = 'manual',
}) {
  return upsertOfferAffiliateAccess({
    offerId,
    affiliateId,
    accessType,
    source,
  });
}

export async function addGeoRule({
  offerId,
  ruleType,
  countryCode,
}) {
  return insertOfferGeoRule({
    offerId,
    ruleType: ruleType.toLowerCase(),
    countryCode: countryCode.toUpperCase(),
  });
}

export async function hideAffiliateFromOffer({
  offerId,
  affiliateId,
  createdBy = null,
  reason = null,
}) {
  return upsertOfferAffiliateHidden({
    offerId,
    affiliateId,
    createdBy,
    reason,
  });
}
