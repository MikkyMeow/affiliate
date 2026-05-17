import request from 'supertest';
import { createApp } from '../../src/app.js';
import pool from '../../src/db.js';
import { createConversionWithResolvedGoal } from '../../src/services/offer-goals.service.js';
import {
  createTestAdminUser,
  createTestAdvertiser,
  createTestAffiliate,
  createTestAffiliateUser,
  createTestOffer,
  createTestOfferGoal,
} from '../helpers/factories.js';
import { buildPostbackSignature } from '../helpers/postback.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const response = await request(app).post('/api/v1/auth/login').send({
    email,
    password,
  });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

function extractClickIdFromRedirect(location) {
  const url = new URL(location);
  return url.searchParams.get('click_id');
}

async function fetchAuditEvents(entityType, entityId) {
  const result = await pool.query(
    `
      SELECT action, context_json AS context
      FROM audit_events
      WHERE entity_type = $1
        AND entity_id = $2
      ORDER BY created_at ASC
    `,
    [entityType, entityId],
  );

  return result.rows;
}

describe('Stage 8 offer goals', () => {
  it('removes offer-level payout from schema and creates goal-affiliate-rate storage', async () => {
    const columnsResult = await pool.query(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('offers', 'offer_goals', 'offer_goal_affiliate_rates')
      `,
    );

    const columns = new Set(
      columnsResult.rows.map((row) => `${row.table_name}.${row.column_name}`),
    );

    expect(columns.has('offers.payout_rub')).toBe(false);
    expect(columns.has('offer_goals.is_active')).toBe(false);
    expect(columns.has('offer_goals.limit_enabled')).toBe(true);
    expect(columns.has('offer_goals.limit_type')).toBe(true);
    expect(columns.has('offer_goals.limit_value')).toBe(true);
    expect(columns.has('offer_goal_affiliate_rates.offer_goal_id')).toBe(true);
    expect(columns.has('offer_goal_affiliate_rates.affiliate_id')).toBe(true);
    expect(columns.has('offer_goal_affiliate_rates.revenue')).toBe(true);
    expect(columns.has('offer_goal_affiliate_rates.payout')).toBe(true);
  });

  it('rejects offer-level payout in create and update and does not expose it in offer responses', async () => {
    const { user: adminUser, password } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, password);
    const advertiser = await createTestAdvertiser();

    const invalidCreateResponse = await request(app)
      .post('/api/v1/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Offer With Removed Payout',
        advertiserId: advertiser.id,
        category: 'other',
        targetUrl: 'https://example.com/offers/removed-payout',
        payoutRub: 500,
        status: 'active',
      });

    expect(invalidCreateResponse.status).toBe(400);
    expect(invalidCreateResponse.body.error.code).toBe('VALIDATION_ERROR');

    const createResponse = await request(app)
      .post('/api/v1/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Offer Without Payout',
        advertiserId: advertiser.id,
        category: 'other',
        targetUrl: 'https://example.com/offers/without-payout',
        status: 'active',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.offer).not.toHaveProperty('payoutRub');

    const offerId = createResponse.body.data.offer.id;

    const updateResponse = await request(app)
      .patch(`/api/v1/offers/${offerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payoutRub: 700 });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.code).toBe('VALIDATION_ERROR');

    const detailResponse = await request(app)
      .get(`/api/v1/offers/${offerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.offer).not.toHaveProperty('payoutRub');
  });

  it('creates goals with backend-calculated profit and rejects invalid goal fields', async () => {
    const { user: adminUser, password } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, password);
    const offer = await createTestOffer();

    const invalidCreateResponse = await request(app)
      .post(`/api/v1/admin/offers/${offer.id}/goals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid Goal',
        type: 'CPA',
        revenue: 300,
        payout: 400,
      });

    expect(invalidCreateResponse.status).toBe(400);

    const validCreateResponse = await request(app)
      .post(`/api/v1/admin/offers/${offer.id}/goals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Lead',
        type: 'CPA',
        revenue: 500,
        payout: 300,
        currency: 'RUB',
        limitEnabled: true,
        limitType: 'conversions_count',
        limitValue: 100,
        isDefault: true,
      });

    expect(validCreateResponse.status).toBe(201);
    expect(validCreateResponse.body.data.goal).toMatchObject({
      name: 'Lead',
      revenue: 500,
      payout: 300,
      profit: 200,
      currency: 'RUB',
      limitEnabled: true,
      limitType: 'conversions_count',
      limitValue: 100,
      limitUsed: 0,
      limitRemaining: 100,
      limitReached: false,
    });
    expect(validCreateResponse.body.data.goal).not.toHaveProperty('isActive');

    const goalId = validCreateResponse.body.data.goal.id;

    const invalidUpdateResponse = await request(app)
      .patch(`/api/v1/admin/offers/${offer.id}/goals/${goalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        payout: 900,
      });

    expect(invalidUpdateResponse.status).toBe(400);

    const forbiddenFieldsResponse = await request(app)
      .patch(`/api/v1/admin/offers/${offer.id}/goals/${goalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        profit: 123,
        isActive: false,
      });

    expect(forbiddenFieldsResponse.status).toBe(400);
    expect(forbiddenFieldsResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('applies affiliate-specific goal rates and keeps partner responses revenue-safe', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const {
      user: partnerOneUser,
      affiliate: partnerOneAffiliate,
      password: partnerOnePassword,
    } =
      await createTestAffiliateUser();
    const {
      user: partnerTwoUser,
      affiliate: partnerTwoAffiliate,
      password: partnerTwoPassword,
    } =
      await createTestAffiliateUser();

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const partnerOneToken = await loginAndGetToken(
      partnerOneUser.email,
      partnerOnePassword,
    );
    const partnerTwoToken = await loginAndGetToken(
      partnerTwoUser.email,
      partnerTwoPassword,
    );

    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id, {
      name: 'Lead',
      revenue: 500,
      payout: 300,
    });

    const invalidOverrideResponse = await request(app)
      .put(
        `/api/v1/admin/offers/${offer.id}/goals/${goal.id}/affiliate-rates/${partnerOneAffiliate.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        revenue: 200,
        payout: 300,
      });

    expect(invalidOverrideResponse.status).toBe(400);

    const overrideResponse = await request(app)
      .put(
        `/api/v1/admin/offers/${offer.id}/goals/${goal.id}/affiliate-rates/${partnerOneAffiliate.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        revenue: 650,
        payout: 350,
      });

    expect(overrideResponse.status).toBe(200);
    expect(overrideResponse.body.data.rate).toMatchObject({
      affiliateId: partnerOneAffiliate.id,
      revenue: 650,
      payout: 350,
      profit: 300,
      currency: 'RUB',
    });

    const ratesListResponse = await request(app)
      .get(`/api/v1/admin/offers/${offer.id}/goals/${goal.id}/affiliate-rates`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(ratesListResponse.status).toBe(200);
    expect(ratesListResponse.body.data.items).toEqual([
      expect.objectContaining({
        affiliateId: partnerOneAffiliate.id,
        revenue: 650,
        payout: 350,
        profit: 300,
        affiliate: expect.objectContaining({
          id: partnerOneAffiliate.id,
          email: partnerOneUser.email,
        }),
      }),
    ]);

    const partnerOneOfferResponse = await request(app)
      .get(`/api/v1/partner/offers/${offer.id}`)
      .set('Authorization', `Bearer ${partnerOneToken}`);

    expect(partnerOneOfferResponse.status).toBe(200);
    expect(partnerOneOfferResponse.body.data.offer.goals[0]).toMatchObject({
      id: goal.id,
      payout: 350,
      currency: 'RUB',
      limitReached: false,
    });
    expect(partnerOneOfferResponse.body.data.offer.goals[0]).not.toHaveProperty(
      'revenue',
    );
    expect(partnerOneOfferResponse.body.data.offer.goals[0]).not.toHaveProperty(
      'profit',
    );

    const partnerTwoOfferResponse = await request(app)
      .get(`/api/v1/partner/offers/${offer.id}`)
      .set('Authorization', `Bearer ${partnerTwoToken}`);

    expect(partnerTwoOfferResponse.status).toBe(200);
    expect(partnerTwoOfferResponse.body.data.offer.goals[0]).toMatchObject({
      id: goal.id,
      payout: 300,
      currency: 'RUB',
      limitReached: false,
    });
  });

  it('tracks goal limit usage on backend, ignores rejected conversions, and blocks further conversions when reached', async () => {
    const { user: adminUser, password } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, password);
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id, {
      name: 'Capped Goal',
      revenue: 400,
      payout: 200,
      limitEnabled: true,
      limitType: 'conversions_count',
      limitValue: 1,
    });

    const rejectedClickResponse = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    const rejectedClickId = extractClickIdFromRedirect(
      rejectedClickResponse.headers.location,
    );
    const rejectedSignature = buildPostbackSignature({
      token: offer.postbackToken,
      clickId: rejectedClickId,
      status: 'rejected',
    });

    const rejectedPostbackResponse = await request(app)
      .post('/track/postback')
      .send({
        token: offer.postbackToken,
        clickId: rejectedClickId,
        signature: rejectedSignature,
        status: 'rejected',
        goalId: goal.id,
      });

    expect(rejectedPostbackResponse.status).toBe(200);

    const afterRejectedGoalsResponse = await request(app)
      .get(`/api/v1/admin/offers/${offer.id}/goals`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(afterRejectedGoalsResponse.status).toBe(200);
    expect(afterRejectedGoalsResponse.body.data[0]).toMatchObject({
      limitUsed: 0,
      limitRemaining: 1,
      limitReached: false,
    });

    const firstCountedClickResponse = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    const firstCountedClickId = extractClickIdFromRedirect(
      firstCountedClickResponse.headers.location,
    );
    const firstCountedSignature = buildPostbackSignature({
      token: offer.postbackToken,
      clickId: firstCountedClickId,
      status: 'pending',
    });

    const firstCountedResponse = await request(app)
      .post('/track/postback')
      .send({
        token: offer.postbackToken,
        clickId: firstCountedClickId,
        signature: firstCountedSignature,
        status: 'pending',
        goalId: goal.id,
      });

    expect(firstCountedResponse.status).toBe(200);

    const afterCountedGoalsResponse = await request(app)
      .get(`/api/v1/admin/offers/${offer.id}/goals`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(afterCountedGoalsResponse.status).toBe(200);
    expect(afterCountedGoalsResponse.body.data[0]).toMatchObject({
      limitUsed: 1,
      limitRemaining: 0,
      limitReached: true,
    });

    const blockedClickResponse = await request(app)
      .get('/track/click')
      .query({ offerId: offer.id, affiliateId: affiliate.id })
      .set('CF-IPCountry', 'RU');

    const blockedClickId = extractClickIdFromRedirect(
      blockedClickResponse.headers.location,
    );
    const blockedSignature = buildPostbackSignature({
      token: offer.postbackToken,
      clickId: blockedClickId,
      status: 'approved',
    });

    const blockedPostbackResponse = await request(app)
      .post('/track/postback')
      .send({
        token: offer.postbackToken,
        clickId: blockedClickId,
        signature: blockedSignature,
        status: 'approved',
        goalId: goal.id,
      });

    expect(blockedPostbackResponse.status).toBe(409);
    expect(blockedPostbackResponse.body.error.code).toBe('GOAL_LIMIT_REACHED');
  });

  it('serializes concurrent goal-limit checks safely enough to avoid overrun', async () => {
    const affiliate = await createTestAffiliate();
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const goal = await createTestOfferGoal(offer.id, {
      name: 'Concurrent Limit',
      revenue: 500,
      payout: 250,
      limitEnabled: true,
      limitType: 'conversions_count',
      limitValue: 1,
    });

    const results = await Promise.allSettled([
      createConversionWithResolvedGoal({
        clickId: 'concurrent-click-1',
        offerId: offer.id,
        affiliateId: affiliate.id,
        status: 'approved',
        goalId: goal.id,
      }),
      createConversionWithResolvedGoal({
        clickId: 'concurrent-click-2',
        offerId: offer.id,
        affiliateId: affiliate.id,
        status: 'approved',
        goalId: goal.id,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('GOAL_LIMIT_REACHED');

    const conversionsCountResult = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM conversions
        WHERE goal_id = $1
      `,
      [goal.id],
    );

    expect(conversionsCountResult.rows[0].count).toBe(1);
  });

  it('writes audit events for goal financial changes, goal limit changes, and affiliate-rate changes', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { affiliate: auditedAffiliate } = await createTestAffiliateUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const offer = await createTestOffer();

    const goalCreateResponse = await request(app)
      .post(`/api/v1/admin/offers/${offer.id}/goals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Audited Goal',
        type: 'CPA',
        revenue: 500,
        payout: 300,
        isDefault: true,
        limitEnabled: false,
      });

    expect(goalCreateResponse.status).toBe(201);
    const goalId = goalCreateResponse.body.data.goal.id;

    const goalUpdateResponse = await request(app)
      .patch(`/api/v1/admin/offers/${offer.id}/goals/${goalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        revenue: 650,
        payout: 350,
        limitEnabled: true,
        limitType: 'conversions_count',
        limitValue: 10,
      });

    expect(goalUpdateResponse.status).toBe(200);

    const rateCreateResponse = await request(app)
      .put(
        `/api/v1/admin/offers/${offer.id}/goals/${goalId}/affiliate-rates/${auditedAffiliate.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        revenue: 700,
        payout: 400,
      });

    expect(rateCreateResponse.status).toBe(200);

    const rateId = rateCreateResponse.body.data.rate.id;

    const rateUpdateResponse = await request(app)
      .put(
        `/api/v1/admin/offers/${offer.id}/goals/${goalId}/affiliate-rates/${auditedAffiliate.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        revenue: 710,
        payout: 390,
      });

    expect(rateUpdateResponse.status).toBe(200);

    const rateDeleteResponse = await request(app)
      .delete(
        `/api/v1/admin/offers/${offer.id}/goals/${goalId}/affiliate-rates/${auditedAffiliate.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`);

    expect(rateDeleteResponse.status).toBe(200);

    const goalAuditEvents = await fetchAuditEvents('offer_goal', goalId);
    expect(goalAuditEvents.map((event) => event.action)).toEqual(
      expect.arrayContaining(['created', 'updated', 'financial_changed', 'limit_changed']),
    );

    const rateAuditEvents = await fetchAuditEvents('offer_goal_affiliate_rate', rateId);
    expect(rateAuditEvents.map((event) => event.action)).toEqual([
      'created',
      'updated',
      'deleted',
    ]);
  });
});
