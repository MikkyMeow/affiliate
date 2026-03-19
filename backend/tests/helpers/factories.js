import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import pool from '../../src/db.js';
import { createUser } from '../../src/models/userModel.js';
import { createAffiliate } from '../../src/models/affiliateModel.js';
import { createAdvertiser } from '../../src/models/advertiserModel.js';
import { insertOfferGoal } from '../../src/models/offerGoals.model.js';
import { upsertOfferAffiliateAccess } from '../../src/models/offerAffiliateAccess.model.js';
import { insertOfferGeoRule } from '../../src/models/offerGeoRules.model.js';

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

export async function createTestAdvertiser({
  name = `Advertiser ${randomString(4)}`,
  status = 'active',
} = {}) {
  return createAdvertiser({ name, status });
}

export async function createTestOffer({
  advertiserId,
  title = `Offer ${randomString(4)}`,
  targetUrl = `https://offers.example.com/${randomString(6)}`,
  payoutRub = 1000,
  status = 'active',
  visibilityMode = 'public',
  targetingStrict = false,
  fallbackUrl = null,
  previewUrl = null,
  postbackToken = crypto.randomBytes(16).toString('hex'),
} = {}) {
  const advertiser =
    advertiserId ?? (await createTestAdvertiser()).id;

  const result = await pool.query(
    `
      INSERT INTO offers (
        title,
        advertiser_id,
        target_url,
        payout_rub,
        status,
        visibility_mode,
        targeting_strict,
        fallback_url,
        preview_url,
        postback_token
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        id,
        title,
        advertiser_id AS "advertiserId",
        target_url AS "targetUrl",
        payout_rub AS "payoutRub",
        status,
        visibility_mode AS "visibilityMode",
        targeting_strict AS "targetingStrict",
        fallback_url AS "fallbackUrl",
        preview_url AS "previewUrl",
        postback_token AS "postbackToken"
    `,
    [
      title,
      advertiser,
      targetUrl,
      payoutRub,
      status,
      visibilityMode,
      targetingStrict,
      fallbackUrl,
      previewUrl,
      postbackToken,
    ],
  );

  return result.rows[0];
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
    isActive = true,
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
    isActive,
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
