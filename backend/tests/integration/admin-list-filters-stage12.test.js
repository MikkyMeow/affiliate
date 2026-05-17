import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { CLICK_REDIRECT_OUTCOMES } from '../../src/constants/clicks.js';
import { CONVERSION_STATUSES } from '../../src/constants/conversions.js';
import { createClick } from '../../src/models/clicks.model.js';
import { createConversion } from '../../src/models/conversions.model.js';
import pool from '../../src/db.js';
import {
  createTestAdminUser,
  createTestAdvertiser,
  createTestAdvertiserUser,
  createTestAffiliate,
  createTestAffiliateUser,
  createTestOffer,
  createTestOfferGoal,
} from '../helpers/factories.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

async function setClickCreatedAt(clickId, createdAt) {
  await pool.query(
    `
      UPDATE clicks
      SET created_at = $2
      WHERE click_id = $1
    `,
    [clickId, createdAt],
  );
}

async function setConversionCreatedAt(conversionId, createdAt) {
  await pool.query(
    `
      UPDATE conversions
      SET created_at = $2
      WHERE id = $1
    `,
    [conversionId, createdAt],
  );
}

async function seedAdminListFixtures() {
  const advertiserOne = await createTestAdvertiser({ name: 'Advertiser One' });
  const advertiserTwo = await createTestAdvertiser({ name: 'Advertiser Two' });
  const affiliateOne = await createTestAffiliate({ name: 'Affiliate One' });
  const affiliateTwo = await createTestAffiliate({ name: 'Affiliate Two' });
  const offerOne = await createTestOffer({
    advertiserId: advertiserOne.id,
    title: 'Offer One',
  });
  const offerTwo = await createTestOffer({
    advertiserId: advertiserTwo.id,
    title: 'Offer Two',
  });
  const goalOne = await createTestOfferGoal(offerOne.id, {
    name: 'Signup Goal',
    revenue: 500,
    payout: 300,
  });
  const goalTwo = await createTestOfferGoal(offerTwo.id, {
    name: 'Deposit Goal',
    revenue: 900,
    payout: 450,
  });

  const clickOne = await createClick({
    clickId: 'clk-stage12-a',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    ip: '203.0.113.10',
    device: 'desktop',
    sub1: 'alpha',
    sub2: 'beta',
    sub3: 'gamma',
    sub4: 'delta',
    sub5: 'epsilon',
    canonicalClickId: 'clk-stage12-a',
    countryCode: 'RU',
    redirectOutcome: CLICK_REDIRECT_OUTCOMES.ALLOWED_TARGET_REDIRECT,
    destinationType: 'target',
  });
  await setClickCreatedAt(clickOne.clickId, '2026-05-01T10:00:00.000Z');

  const clickTwo = await createClick({
    clickId: 'clk-stage12-b',
    offerId: offerTwo.id,
    affiliateId: affiliateTwo.id,
    ip: '198.51.100.20',
    device: 'mobile',
    sub1: 'omega',
    sub2: 'psi',
    sub3: 'chi',
    sub4: 'phi',
    sub5: 'upsilon',
    canonicalClickId: 'clk-stage12-b',
    countryCode: 'US',
    redirectOutcome: CLICK_REDIRECT_OUTCOMES.FALLBACK_REDIRECT,
    destinationType: 'fallback',
  });
  await setClickCreatedAt(clickTwo.clickId, '2026-05-02T10:00:00.000Z');

  const clickThree = await createClick({
    clickId: 'clk-stage12-c',
    offerId: offerOne.id,
    affiliateId: affiliateTwo.id,
    ip: '192.0.2.30',
    device: 'tablet',
    sub1: 'alpha-two',
    sub2: 'beta-two',
    sub3: 'gamma-two',
    sub4: 'delta-two',
    sub5: 'epsilon-two',
    canonicalClickId: 'clk-stage12-a',
    isDuplicate: true,
    duplicateOfClickId: 'clk-stage12-a',
    countryCode: 'RU',
    redirectOutcome: CLICK_REDIRECT_OUTCOMES.INTERNAL_UNAVAILABLE_REDIRECT,
    destinationType: 'internal_unavailable',
  });
  await setClickCreatedAt(clickThree.clickId, '2026-05-03T10:00:00.000Z');

  const conversionOne = await createConversion({
    clickId: clickOne.clickId,
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    status: CONVERSION_STATUSES.APPROVED,
    payoutRub: 300,
    externalTransactionId: 'order-1',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    revenueAmount: 500,
    payoutAmount: 300,
  });
  await setConversionCreatedAt(conversionOne.id, '2026-05-01T12:00:00.000Z');

  const conversionTwo = await createConversion({
    clickId: clickTwo.clickId,
    offerId: offerTwo.id,
    affiliateId: affiliateTwo.id,
    status: CONVERSION_STATUSES.PENDING,
    payoutRub: 450,
    externalTransactionId: 'order-2',
    goalId: goalTwo.id,
    goalName: goalTwo.name,
    goalType: goalTwo.type,
    revenueAmount: 900,
    payoutAmount: 450,
  });
  await setConversionCreatedAt(conversionTwo.id, '2026-05-02T12:00:00.000Z');

  const conversionThree = await createConversion({
    clickId: clickThree.clickId,
    offerId: offerOne.id,
    affiliateId: affiliateTwo.id,
    status: CONVERSION_STATUSES.REJECTED,
    payoutRub: 120,
    externalTransactionId: 'order-3',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    revenueAmount: 200,
    payoutAmount: 120,
  });
  await setConversionCreatedAt(conversionThree.id, '2026-05-03T12:00:00.000Z');

  return {
    advertiserOne,
    advertiserTwo,
    affiliateOne,
    affiliateTwo,
    offerOne,
    offerTwo,
    goalOne,
    goalTwo,
    clickOne,
    clickTwo,
    clickThree,
    conversionOne,
    conversionTwo,
    conversionThree,
  };
}

describe('stage 12 admin list filters', () => {
  describe('GET /api/v1/clicks', () => {
    it('allows admin and manager to list transactions and denies partner/advertiser', async () => {
      const { user: adminUser, password: adminPassword } = await createTestAdminUser();
      const { user: managerUser, password: managerPassword } = await createTestAdminUser({
        role: 'manager',
      });
      const { user: affiliateUser, password: affiliatePassword } = await createTestAffiliateUser();
      const { user: advertiserUser, password: advertiserPassword } =
        await createTestAdvertiserUser();

      await seedAdminListFixtures();

      const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
      const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
      const affiliateToken = await loginAndGetToken(
        affiliateUser.email,
        affiliatePassword,
      );
      const advertiserToken = await loginAndGetToken(
        advertiserUser.email,
        advertiserPassword,
      );

      const adminResponse = await request(app)
        .get('/api/v1/clicks')
        .set('Authorization', `Bearer ${adminToken}`);
      const managerResponse = await request(app)
        .get('/api/v1/clicks')
        .set('Authorization', `Bearer ${managerToken}`);
      const affiliateResponse = await request(app)
        .get('/api/v1/clicks')
        .set('Authorization', `Bearer ${affiliateToken}`);
      const advertiserResponse = await request(app)
        .get('/api/v1/clicks')
        .set('Authorization', `Bearer ${advertiserToken}`);

      expect(adminResponse.status).toBe(200);
      expect(managerResponse.status).toBe(200);
      expect(adminResponse.body.data).toHaveLength(3);
      expect(managerResponse.body.data).toHaveLength(3);
      expect(affiliateResponse.status).toBe(403);
      expect(advertiserResponse.status).toBe(403);
    });

    it('supports pagination and backend filters for transactions', async () => {
      const { user: adminUser, password: adminPassword } = await createTestAdminUser();
      const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
      const fixtures = await seedAdminListFixtures();

      const paginated = await request(app)
        .get('/api/v1/clicks')
        .query({ page: 2, limit: 1 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(paginated.status).toBe(200);
      expect(paginated.body.data).toHaveLength(1);
      expect(paginated.body.meta).toMatchObject({
        total: 3,
        limit: 1,
        page: 2,
        totalPages: 3,
      });

      const dateFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ dateFrom: '2026-05-02', dateTo: '2026-05-02' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dateFiltered.status).toBe(200);
      expect(dateFiltered.body.data).toHaveLength(1);
      expect(dateFiltered.body.data[0].clickId).toBe(fixtures.clickTwo.clickId);

      const offerFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ offerId: fixtures.offerOne.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(offerFiltered.body.data).toHaveLength(2);

      const affiliateFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ affiliateId: fixtures.affiliateOne.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(affiliateFiltered.body.data).toHaveLength(1);
      expect(affiliateFiltered.body.data[0].clickId).toBe(fixtures.clickOne.clickId);

      const advertiserFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ advertiserId: fixtures.advertiserTwo.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(advertiserFiltered.body.data).toHaveLength(1);
      expect(advertiserFiltered.body.data[0].clickId).toBe(fixtures.clickTwo.clickId);

      const countryFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ countryCode: 'RU' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(countryFiltered.body.data).toHaveLength(2);

      const resultFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ redirectOutcome: CLICK_REDIRECT_OUTCOMES.FALLBACK_REDIRECT })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resultFiltered.body.data).toHaveLength(1);
      expect(resultFiltered.body.data[0].clickId).toBe(fixtures.clickTwo.clickId);

      const clickIdFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ clickId: 'stage12-c' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(clickIdFiltered.body.data).toHaveLength(1);
      expect(clickIdFiltered.body.data[0].clickId).toBe(fixtures.clickThree.clickId);

      const subFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ sub1: 'alpha', sub5: 'epsilon' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(subFiltered.body.data).toHaveLength(2);

      const ipFiltered = await request(app)
        .get('/api/v1/clicks')
        .query({ ip: '198.51.100' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ipFiltered.body.data).toHaveLength(1);
      expect(ipFiltered.body.data[0].clickId).toBe(fixtures.clickTwo.clickId);
    });

    it('returns validation errors for invalid transaction filters', async () => {
      const { user: adminUser, password: adminPassword } = await createTestAdminUser();
      const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

      const response = await request(app)
        .get('/api/v1/clicks')
        .query({
          offerId: 'not-a-uuid',
          dateFrom: '2026-13-01',
          redirectOutcome: 'unknown',
          limit: 999,
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'offerId' }),
          expect.objectContaining({ field: 'dateFrom' }),
          expect.objectContaining({ field: 'redirectOutcome' }),
          expect.objectContaining({ field: 'limit' }),
        ]),
      );
    });
  });

  describe('GET /api/v1/conversions', () => {
    it('allows admin and manager to list conversions and denies partner/advertiser', async () => {
      const { user: adminUser, password: adminPassword } = await createTestAdminUser();
      const { user: managerUser, password: managerPassword } = await createTestAdminUser({
        role: 'manager',
      });
      const { user: affiliateUser, password: affiliatePassword } = await createTestAffiliateUser();
      const { user: advertiserUser, password: advertiserPassword } =
        await createTestAdvertiserUser();

      await seedAdminListFixtures();

      const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
      const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
      const affiliateToken = await loginAndGetToken(
        affiliateUser.email,
        affiliatePassword,
      );
      const advertiserToken = await loginAndGetToken(
        advertiserUser.email,
        advertiserPassword,
      );

      const adminResponse = await request(app)
        .get('/api/v1/conversions')
        .set('Authorization', `Bearer ${adminToken}`);
      const managerResponse = await request(app)
        .get('/api/v1/conversions')
        .set('Authorization', `Bearer ${managerToken}`);
      const affiliateResponse = await request(app)
        .get('/api/v1/conversions')
        .set('Authorization', `Bearer ${affiliateToken}`);
      const advertiserResponse = await request(app)
        .get('/api/v1/conversions')
        .set('Authorization', `Bearer ${advertiserToken}`);

      expect(adminResponse.status).toBe(200);
      expect(managerResponse.status).toBe(200);
      expect(adminResponse.body.data).toHaveLength(3);
      expect(managerResponse.body.data).toHaveLength(3);
      expect(affiliateResponse.status).toBe(403);
      expect(advertiserResponse.status).toBe(403);
    });

    it('supports pagination and backend filters for conversions and returns backend profit', async () => {
      const { user: adminUser, password: adminPassword } = await createTestAdminUser();
      const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
      const fixtures = await seedAdminListFixtures();

      const paginated = await request(app)
        .get('/api/v1/conversions')
        .query({ page: 1, limit: 1 })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(paginated.status).toBe(200);
      expect(paginated.body.data).toHaveLength(1);
      expect(paginated.body.meta).toMatchObject({
        total: 3,
        limit: 1,
        page: 1,
        totalPages: 3,
      });

      const dateFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ dateFrom: '2026-05-02', dateTo: '2026-05-02' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dateFiltered.body.data).toHaveLength(1);
      expect(dateFiltered.body.data[0].id).toBe(fixtures.conversionTwo.id);

      const offerFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ offerId: fixtures.offerOne.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(offerFiltered.body.data).toHaveLength(2);

      const goalFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ goalId: fixtures.goalTwo.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(goalFiltered.body.data).toHaveLength(1);
      expect(goalFiltered.body.data[0].id).toBe(fixtures.conversionTwo.id);

      const affiliateFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ affiliateId: fixtures.affiliateOne.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(affiliateFiltered.body.data).toHaveLength(1);
      expect(affiliateFiltered.body.data[0].id).toBe(fixtures.conversionOne.id);

      const advertiserFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ advertiserId: fixtures.advertiserTwo.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(advertiserFiltered.body.data).toHaveLength(1);
      expect(advertiserFiltered.body.data[0].id).toBe(fixtures.conversionTwo.id);

      const statusFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ status: CONVERSION_STATUSES.APPROVED })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(statusFiltered.body.data).toHaveLength(1);
      expect(statusFiltered.body.data[0].id).toBe(fixtures.conversionOne.id);
      expect(statusFiltered.body.data[0].profit).toBe(200);

      const clickIdFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ clickId: 'stage12-b' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(clickIdFiltered.body.data).toHaveLength(1);
      expect(clickIdFiltered.body.data[0].id).toBe(fixtures.conversionTwo.id);

      const conversionIdFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ conversionId: fixtures.conversionThree.id })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(conversionIdFiltered.body.data).toHaveLength(1);
      expect(conversionIdFiltered.body.data[0].id).toBe(fixtures.conversionThree.id);

      const transactionFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ externalTransactionId: 'order-2' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(transactionFiltered.body.data).toHaveLength(1);
      expect(transactionFiltered.body.data[0].id).toBe(fixtures.conversionTwo.id);

      const revenueFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ revenueMin: 400, revenueMax: 600 })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(revenueFiltered.body.data).toHaveLength(1);
      expect(revenueFiltered.body.data[0].id).toBe(fixtures.conversionOne.id);

      const payoutFiltered = await request(app)
        .get('/api/v1/conversions')
        .query({ payoutMin: 400, payoutMax: 500 })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(payoutFiltered.body.data).toHaveLength(1);
      expect(payoutFiltered.body.data[0].id).toBe(fixtures.conversionTwo.id);
    });

    it('returns validation errors for invalid conversion filters', async () => {
      const { user: adminUser, password: adminPassword } = await createTestAdminUser();
      const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

      const response = await request(app)
        .get('/api/v1/conversions')
        .query({
          goalId: 'not-a-uuid',
          status: 'cancelled',
          revenueMin: 100,
          revenueMax: 10,
          payoutMin: 200,
          payoutMax: 100,
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'goalId' }),
          expect.objectContaining({ field: 'status' }),
          expect.objectContaining({ field: 'revenueMin' }),
          expect.objectContaining({ field: 'payoutMin' }),
        ]),
      );
    });
  });
});
