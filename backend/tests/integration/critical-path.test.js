import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  createTestAffiliateUser,
  createTestAdminUser,
  createTestOffer,
  createTestOfferGoal,
  grantAffiliateAccess,
  addGeoRule,
  createTestAffiliate,
  hideAffiliateFromOffer,
} from '../helpers/factories.js';
import {
  findPendingOfferRequest,
  findOfferRequestById,
} from '../../src/models/offerRequests.model.js';
import { findByClickId } from '../../src/models/conversions.model.js';
import pool from '../../src/db.js';
import { buildPostbackSignature } from '../helpers/postback.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const res = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
  });

  expect(res.status).toBe(200);
  return res.body.data.token;
}

function extractClickIdFromRedirect(location) {
  const url = new URL(location);
  return url.searchParams.get('click_id');
}

describe('Critical path integration tests', () => {
  it('authenticates affiliate users and protects profile endpoint', async () => {
    const { user, affiliate, password } = await createTestAffiliateUser();

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.id).toBe(user.id);
    expect(loginResponse.body.data.user.affiliateId).toBe(affiliate.id);

    const token = loginResponse.body.data.token;

    const profileResponse = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user.id).toBe(user.id);

    const unauthorizedResponse = await request(app).get('/api/v1/profile');
    expect(unauthorizedResponse.status).toBe(401);
    expect(unauthorizedResponse.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('enforces affiliate offer visibility rules', async () => {
    const { user, affiliate, password } = await createTestAffiliateUser();
    const token = await loginAndGetToken(user.email, password);

    const publicOffer = await createTestOffer({ visibilityMode: 'public' });
    const gamesOffer = await createTestOffer({
      visibilityMode: 'public',
      category: 'games',
    });
    const financeOffer = await createTestOffer({
      visibilityMode: 'public',
      category: 'finance',
    });
    const onRequestOffer = await createTestOffer({
      visibilityMode: 'on_request',
    });
    const privateOffer = await createTestOffer({
      visibilityMode: 'private',
    });

    const excludedPublicOffer = await createTestOffer({
      visibilityMode: 'public',
    });
    await hideAffiliateFromOffer({
      offerId: excludedPublicOffer.id,
      affiliateId: affiliate.id,
    });

    const allowedOnRequest = await createTestOffer({
      visibilityMode: 'on_request',
    });
    await grantAffiliateAccess({
      offerId: allowedOnRequest.id,
      affiliateId: affiliate.id,
      accessType: 'allowed',
      source: 'request_approved',
    });

    const rejectedOnRequest = await createTestOffer({
      visibilityMode: 'on_request',
    });
    await grantAffiliateAccess({
      offerId: rejectedOnRequest.id,
      affiliateId: affiliate.id,
      accessType: 'rejected',
      source: 'request_rejected',
    });

    const offersResponse = await request(app)
      .get('/api/v1/partner/offers')
      .set('Authorization', `Bearer ${token}`);

    expect(offersResponse.status).toBe(200);
    const offers = offersResponse.body.data;
    const map = new Map(offers.map((offer) => [offer.id, offer]));

    expect(map.has(publicOffer.id)).toBe(true);
    expect(map.get(publicOffer.id).accessLevel).toBe('full');

    expect(map.has(onRequestOffer.id)).toBe(true);
    expect(map.get(onRequestOffer.id).view.type).toBe('restricted');
    expect(map.get(onRequestOffer.id).canRequestAccess).toBe(true);

    expect(map.has(allowedOnRequest.id)).toBe(true);
    expect(map.get(allowedOnRequest.id).accessLevel).toBe('full');
    expect(map.get(allowedOnRequest.id).view.type).toBe('full');

    expect(map.has(rejectedOnRequest.id)).toBe(true);
    expect(map.get(rejectedOnRequest.id).view.type).toBe('restricted');
    expect(map.get(rejectedOnRequest.id).canRequestAccess).toBe(false);
    expect(map.get(rejectedOnRequest.id).denyReason).toBe('rejected');

    expect(map.has(excludedPublicOffer.id)).toBe(false);
    expect(map.has(privateOffer.id)).toBe(false);

    const filteredResponse = await request(app)
      .get('/api/v1/partner/offers?category=games')
      .set('Authorization', `Bearer ${token}`);
    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.data).toHaveLength(1);
    expect(filteredResponse.body.data[0].id).toBe(gamesOffer.id);
    expect(filteredResponse.body.data[0].category).toBe('games');
    const invalidCategoryResponse = await request(app)
      .get('/api/v1/partner/offers?category=unknown')
      .set('Authorization', `Bearer ${token}`);
    expect(invalidCategoryResponse.status).toBe(400);
  });

  it('allows affiliates to request on-request offers and prevents duplicates', async () => {
    const { user, affiliate, password } = await createTestAffiliateUser();
    const token = await loginAndGetToken(user.email, password);
    const offer = await createTestOffer({ visibilityMode: 'on_request' });

    const requestResponse = await request(app)
      .post(`/api/v1/partner/offers/${offer.id}/request`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'please approve' });

    expect(requestResponse.status).toBe(201);
    expect(requestResponse.body.data.request.status).toBe('pending');

    const pending = await findPendingOfferRequest(offer.id, affiliate.id);
    expect(pending).not.toBeNull();

    const duplicateResponse = await request(app)
      .post(`/api/v1/partner/offers/${offer.id}/request`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'another try' });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error.code).toBe('CONFLICT');
  });

  it('approves offer requests via admin flow and unlocks full access', async () => {
    const { user, affiliate, password } = await createTestAffiliateUser();
    const { user: adminUser, password: adminPassword } =
      await createTestAdminUser();

    const affiliateToken = await loginAndGetToken(user.email, password);
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const offer = await createTestOffer({ visibilityMode: 'on_request' });

    const requestRes = await request(app)
      .post(`/api/v1/partner/offers/${offer.id}/request`)
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({ message: 'need access' });

    const requestId = requestRes.body.data.request.id;

    const decisionRes = await request(app)
      .post(`/api/v1/admin/offer-requests/${requestId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approved' });

    expect(decisionRes.status).toBe(200);
    expect(decisionRes.body.data.request.status).toBe('approved');
    expect(decisionRes.body.data.access.accessType).toBe('allowed');

    const detailRes = await request(app)
      .get(`/api/v1/partner/offers/${offer.id}`)
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.offer.accessLevel).toBe('full');
    expect(detailRes.body.data.offer.view.type).toBe('full');

    const stored = await findOfferRequestById(requestId);
    expect(stored.status).toBe('approved');
    expect(stored.reviewedBy).toBe(adminUser.id);
  });

  it('rejects offer requests and prevents re-requesting access', async () => {
    const { user, affiliate, password } = await createTestAffiliateUser();
    const { user: adminUser, password: adminPassword } =
      await createTestAdminUser();

    const affiliateToken = await loginAndGetToken(user.email, password);
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const offer = await createTestOffer({ visibilityMode: 'on_request' });

    const requestRes = await request(app)
      .post(`/api/v1/partner/offers/${offer.id}/request`)
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({ message: 'need access' });

    const requestId = requestRes.body.data.request.id;

    const decisionRes = await request(app)
      .post(`/api/v1/admin/offer-requests/${requestId}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'rejected' });

    expect(decisionRes.status).toBe(200);
    expect(decisionRes.body.data.request.status).toBe('rejected');
    expect(decisionRes.body.data.access.accessType).toBe('rejected');

    const offersResponse = await request(app)
      .get('/api/v1/partner/offers')
      .set('Authorization', `Bearer ${affiliateToken}`);

    const targetOffer = offersResponse.body.data.find(
      (item) => item.id === offer.id,
    );
    expect(targetOffer).toBeTruthy();
    expect(targetOffer.accessLevel).toBe('restricted');
    expect(targetOffer.canRequestAccess).toBe(false);
    expect(targetOffer.denyReason).toBe('rejected');
  });

  it('processes postbacks with default goal snapshots', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id, {
      payout: 250,
      revenue: 400,
      type: 'cpl',
    });

    const clickRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    expect(clickRes.status).toBe(302);
    const clickId = extractClickIdFromRedirect(clickRes.headers.location);
    expect(clickId).toBeTruthy();

    const signature = buildPostbackSignature({
      token: offer.postbackToken,
      clickId,
      status: 'pending',
    });

    const postbackRes = await request(app).post('/track/postback').send({
      token: offer.postbackToken,
      clickId,
      signature,
    });

    expect(postbackRes.status).toBe(200);
    expect(postbackRes.body.data.status).toBe('pending');

    const conversion = await findByClickId(clickId);
    expect(conversion).not.toBeNull();
    expect(conversion.goalId).toBe(goal.id);
    expect(conversion.goalName).toBe(goal.name);
    expect(conversion.goalType.toUpperCase()).toBe('CPL');
    expect(Number(conversion.payoutRub)).toBeCloseTo(Number(goal.payout));
    expect(Number(conversion.revenueAmount)).toBeCloseTo(
      Number(goal.revenue),
    );
  });

  it('protects against duplicate postbacks for the same click', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id);

    const clickRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'PL');

    const clickId = extractClickIdFromRedirect(clickRes.headers.location);
    const signature = buildPostbackSignature({
      token: offer.postbackToken,
      clickId,
      status: 'pending',
    });

    const firstRes = await request(app).post('/track/postback').send({
      token: offer.postbackToken,
      clickId,
      signature,
    });

    expect(firstRes.status).toBe(200);

    const duplicateRes = await request(app).post('/track/postback').send({
      token: offer.postbackToken,
      clickId,
      signature,
    });

    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.error.code).toBe('DUPLICATE_CONVERSION');

    const conversion = await findByClickId(clickId);
    expect(conversion.goalId).toBe(goal.id);

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS count FROM conversions WHERE click_id = $1',
      [clickId],
    );
    expect(countResult.rows[0].count).toBe(1);
  });

  it('applies strict geo redirects with fallback destinations', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({
      visibilityMode: 'public',
      targetingStrict: true,
      fallbackUrl: 'https://fallback.example.com/out',
      targetUrl: 'https://merchant.example.com/landing',
    });

    await addGeoRule({
      offerId: offer.id,
      ruleType: 'allow',
      countryCode: 'DE',
    });

    const deniedRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'US');

    expect(deniedRes.status).toBe(302);
    expect(deniedRes.headers.location).toBe(offer.fallbackUrl);

    const allowedRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'DE');

    expect(allowedRes.status).toBe(302);
    const redirectUrl = new URL(allowedRes.headers.location);
    expect(
      `${redirectUrl.origin}${redirectUrl.pathname}`,
    ).toBe('https://merchant.example.com/landing');
    expect(redirectUrl.searchParams.get('click_id')).toBeTruthy();
  });

  it('creates separate clicks when duplicates are allowed', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({
      visibilityMode: 'public',
      allowDuplicateClicks: true,
      duplicateClickWindowSeconds: null,
    });

    const firstRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    const secondRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    expect(firstRes.status).toBe(302);
    expect(secondRes.status).toBe(302);

    const firstClickId = extractClickIdFromRedirect(firstRes.headers.location);
    const secondClickId = extractClickIdFromRedirect(secondRes.headers.location);

    expect(firstClickId).toBeTruthy();
    expect(secondClickId).toBeTruthy();
    expect(firstClickId).not.toBe(secondClickId);

    const clickRows = await pool.query(
      `
        SELECT click_id, canonical_click_id, is_duplicate
        FROM clicks
        WHERE offer_id = $1 AND affiliate_id = $2
        ORDER BY created_at ASC
      `,
      [offer.id, affiliate.id],
    );

    expect(clickRows.rows).toHaveLength(2);
    clickRows.rows.forEach((row) => {
      expect(row.is_duplicate).toBe(false);
      expect(row.canonical_click_id).toBe(row.click_id);
    });
  });

  it('reuses click id when duplicates are disabled within the dedup window', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({
      visibilityMode: 'public',
      allowDuplicateClicks: false,
      duplicateClickWindowSeconds: 300,
    });

    const firstRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    const secondRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    expect(firstRes.status).toBe(302);
    expect(secondRes.status).toBe(302);

    const firstClickId = extractClickIdFromRedirect(firstRes.headers.location);
    const secondClickId = extractClickIdFromRedirect(secondRes.headers.location);

    expect(firstClickId).toBeTruthy();
    expect(firstClickId).toBe(secondClickId);

    const storedClicks = await pool.query(
      `
        SELECT click_id, canonical_click_id, is_duplicate, duplicate_of_click_id
        FROM clicks
        WHERE offer_id = $1 AND affiliate_id = $2
        ORDER BY created_at ASC
      `,
      [offer.id, affiliate.id],
    );

    expect(storedClicks.rows).toHaveLength(2);

    const canonicalRow = storedClicks.rows.find((row) => row.is_duplicate === false);
    const duplicateRow = storedClicks.rows.find((row) => row.is_duplicate === true);

    expect(canonicalRow).toBeTruthy();
    expect(duplicateRow).toBeTruthy();
    expect(canonicalRow?.click_id).toBe(firstClickId);
    expect(duplicateRow?.canonical_click_id).toBe(canonicalRow?.click_id);
    expect(duplicateRow?.duplicate_of_click_id).toBe(canonicalRow?.click_id);
    expect(duplicateRow?.click_id).not.toBe(canonicalRow?.click_id);

    const registryCount = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM click_dedup_registry
        WHERE offer_id = $1 AND affiliate_id = $2
      `,
      [offer.id, affiliate.id],
    );
    expect(registryCount.rows[0].count).toBe(1);
  });

  it('creates a new click when dedup window has expired', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({
      visibilityMode: 'public',
      allowDuplicateClicks: false,
      duplicateClickWindowSeconds: 120,
    });

    const firstRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    const firstClickId = extractClickIdFromRedirect(firstRes.headers.location);
    expect(firstClickId).toBeTruthy();

    const fingerprintRes = await pool.query(
      `
        SELECT dedupe_fingerprint
        FROM clicks
        WHERE click_id = $1
        LIMIT 1
      `,
      [firstClickId],
    );

    const fingerprint = fingerprintRes.rows[0]?.dedupe_fingerprint;
    expect(fingerprint).toBeTruthy();

    await pool.query(
      `
        UPDATE click_dedup_registry
        SET expires_at = NOW() - interval '1 second'
        WHERE fingerprint = $1
      `,
      [fingerprint],
    );

    const secondRes = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    const secondClickId = extractClickIdFromRedirect(secondRes.headers.location);
    expect(secondClickId).toBeTruthy();
    expect(secondClickId).not.toBe(firstClickId);

    const totalClicks = await pool.query(
      `
        SELECT click_id, is_duplicate, canonical_click_id
        FROM clicks
        WHERE offer_id = $1 AND affiliate_id = $2
        ORDER BY created_at ASC
      `,
      [offer.id, affiliate.id],
    );

    expect(totalClicks.rows).toHaveLength(2);
    totalClicks.rows.forEach((row) => {
      expect(row.is_duplicate).toBe(false);
      expect(row.canonical_click_id).toBe(row.click_id);
    });
  });
});
