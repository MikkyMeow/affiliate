import request from 'supertest';
import { describe, expect, it } from 'vitest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import { createClick } from '../../src/models/clicks.model.js';
import { createConversion } from '../../src/models/conversions.model.js';
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

async function seedSummaryFixtures() {
  const advertiserOne = await createTestAdvertiser({ name: 'Advertiser One' });
  const advertiserTwo = await createTestAdvertiser({ name: 'Advertiser Two' });
  const affiliateOne = await createTestAffiliate({ name: 'Affiliate One' });
  const affiliateTwo = await createTestAffiliate({ name: 'Affiliate Two' });
  const offerOne = await createTestOffer({
    advertiserId: advertiserOne.id,
    title: 'Offer One',
  });
  const offerTwo = await createTestOffer({
    advertiserId: advertiserOne.id,
    title: 'Offer Two',
  });
  const offerThree = await createTestOffer({
    advertiserId: advertiserTwo.id,
    title: 'Offer Three',
  });
  const offerWithoutData = await createTestOffer({
    advertiserId: advertiserTwo.id,
    title: 'Offer Without Data',
  });

  const goalOne = await createTestOfferGoal(offerOne.id, {
    name: 'Goal One',
    revenue: 100,
    payout: 40,
  });
  const goalTwo = await createTestOfferGoal(offerTwo.id, {
    name: 'Goal Two',
    revenue: 300,
    payout: 120,
  });
  const goalThree = await createTestOfferGoal(offerThree.id, {
    name: 'Goal Three',
    revenue: 400,
    payout: 160,
  });

  const clickOne = await createClick({
    clickId: 'stage13-click-1',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    canonicalClickId: 'stage13-click-1',
  });
  await setClickCreatedAt(clickOne.clickId, '2026-05-01T10:00:00.000Z');

  const clickTwo = await createClick({
    clickId: 'stage13-click-2',
    offerId: offerOne.id,
    affiliateId: affiliateTwo.id,
    canonicalClickId: 'stage13-click-2',
  });
  await setClickCreatedAt(clickTwo.clickId, '2026-05-02T10:00:00.000Z');

  const clickThree = await createClick({
    clickId: 'stage13-click-3',
    offerId: offerTwo.id,
    affiliateId: affiliateOne.id,
    canonicalClickId: 'stage13-click-3',
  });
  await setClickCreatedAt(clickThree.clickId, '2026-05-03T10:00:00.000Z');

  const clickFour = await createClick({
    clickId: 'stage13-click-4',
    offerId: offerThree.id,
    affiliateId: affiliateTwo.id,
    canonicalClickId: 'stage13-click-4',
  });
  await setClickCreatedAt(clickFour.clickId, '2026-05-04T10:00:00.000Z');

  const clickFive = await createClick({
    clickId: 'stage13-click-5',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    canonicalClickId: 'stage13-click-5',
  });
  await setClickCreatedAt(clickFive.clickId, '2026-04-30T10:00:00.000Z');

  const conversionOne = await createConversion({
    clickId: clickOne.clickId,
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    status: 'approved',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage13-order-1',
    revenueAmount: 100,
    payoutAmount: 40,
    payoutRub: 40,
  });
  await setConversionCreatedAt(conversionOne.id, '2026-05-01T12:00:00.000Z');

  const conversionTwo = await createConversion({
    clickId: clickTwo.clickId,
    offerId: offerOne.id,
    affiliateId: affiliateTwo.id,
    status: 'pending',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage13-order-2',
    revenueAmount: 200,
    payoutAmount: 80,
    payoutRub: 80,
  });
  await setConversionCreatedAt(conversionTwo.id, '2026-05-02T12:00:00.000Z');

  const conversionThree = await createConversion({
    clickId: clickThree.clickId,
    offerId: offerTwo.id,
    affiliateId: affiliateOne.id,
    status: 'rejected',
    goalId: goalTwo.id,
    goalName: goalTwo.name,
    goalType: goalTwo.type,
    externalTransactionId: 'stage13-order-3',
    revenueAmount: 300,
    payoutAmount: 120,
    payoutRub: 120,
  });
  await setConversionCreatedAt(conversionThree.id, '2026-05-03T12:00:00.000Z');

  const conversionFour = await createConversion({
    clickId: clickFour.clickId,
    offerId: offerThree.id,
    affiliateId: affiliateTwo.id,
    status: 'approved',
    goalId: goalThree.id,
    goalName: goalThree.name,
    goalType: goalThree.type,
    externalTransactionId: 'stage13-order-4',
    revenueAmount: 400,
    payoutAmount: 160,
    payoutRub: 160,
  });
  await setConversionCreatedAt(conversionFour.id, '2026-05-04T12:00:00.000Z');

  const conversionFive = await createConversion({
    clickId: clickFive.clickId,
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    status: 'approved',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage13-order-5',
    revenueAmount: 50,
    payoutAmount: 20,
    payoutRub: 20,
  });
  await setConversionCreatedAt(conversionFive.id, '2026-05-05T12:00:00.000Z');

  return {
    advertiserOne,
    advertiserTwo,
    affiliateOne,
    affiliateTwo,
    offerOne,
    offerTwo,
    offerThree,
    offerWithoutData,
  };
}

describe('stage 13 admin summary', () => {
  it('allows admin and manager to fetch summary and rejects partner/advertiser', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } = await createTestAdminUser({
      role: 'manager',
    });
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();

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
      .get('/api/v1/admin/stats/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    const managerResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .set('Authorization', `Bearer ${managerToken}`);
    const unauthenticatedResponse = await request(app).get(
      '/api/v1/admin/stats/summary',
    );
    const affiliateResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const advertiserResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(adminResponse.status).toBe(200);
    expect(managerResponse.status).toBe(200);
    expect(unauthenticatedResponse.status).toBe(401);
    expect(affiliateResponse.status).toBe(403);
    expect(advertiserResponse.status).toBe(403);
  });

  it('returns aggregate totals and supports partner, offer, advertiser, date, and partner alias filters', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);
    const fixtures = await seedSummaryFixtures();

    const allTotals = await request(app)
      .get('/api/v1/admin/stats/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(allTotals.status).toBe(200);
    expect(allTotals.body.data.filters).toEqual({
      dateFrom: null,
      dateTo: null,
      offerId: null,
      affiliateId: null,
      advertiserId: null,
      groupBy: null,
    });
    expect(allTotals.body.data.totals).toEqual({
      clicks: 5,
      transactions: 5,
      conversions: 5,
      approvedConversions: 3,
      cr: 100,
      revenue: 550,
      payout: 220,
      profit: 330,
      epc: 110,
      approveRate: 60,
    });

    const partnerFiltered = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ affiliateId: fixtures.affiliateOne.id })
      .set('Authorization', `Bearer ${token}`);

    expect(partnerFiltered.status).toBe(200);
    expect(partnerFiltered.body.data.totals).toEqual({
      clicks: 3,
      transactions: 3,
      conversions: 3,
      approvedConversions: 2,
      cr: 100,
      revenue: 150,
      payout: 60,
      profit: 90,
      epc: 50,
      approveRate: 66.67,
    });

    const partnerAliasFiltered = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ partnerId: fixtures.affiliateOne.publicId })
      .set('Authorization', `Bearer ${token}`);

    expect(partnerAliasFiltered.status).toBe(200);
    expect(partnerAliasFiltered.body.data.filters.affiliateId).toBe(
      fixtures.affiliateOne.publicId,
    );
    expect(partnerAliasFiltered.body.data.totals).toEqual(
      partnerFiltered.body.data.totals,
    );

    const offerFiltered = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ offerId: fixtures.offerOne.id })
      .set('Authorization', `Bearer ${token}`);

    expect(offerFiltered.status).toBe(200);
    expect(offerFiltered.body.data.totals).toEqual({
      clicks: 3,
      transactions: 3,
      conversions: 3,
      approvedConversions: 2,
      cr: 100,
      revenue: 150,
      payout: 60,
      profit: 90,
      epc: 50,
      approveRate: 66.67,
    });

    const partnerOfferFiltered = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({
        affiliateId: fixtures.affiliateOne.id,
        offerId: fixtures.offerOne.id,
      })
      .set('Authorization', `Bearer ${token}`);

    expect(partnerOfferFiltered.status).toBe(200);
    expect(partnerOfferFiltered.body.data.totals).toEqual({
      clicks: 2,
      transactions: 2,
      conversions: 2,
      approvedConversions: 2,
      cr: 100,
      revenue: 150,
      payout: 60,
      profit: 90,
      epc: 75,
      approveRate: 100,
    });

    const advertiserFiltered = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ advertiserId: fixtures.advertiserOne.id })
      .set('Authorization', `Bearer ${token}`);

    expect(advertiserFiltered.status).toBe(200);
    expect(advertiserFiltered.body.data.totals).toEqual({
      clicks: 4,
      transactions: 4,
      conversions: 4,
      approvedConversions: 2,
      cr: 100,
      revenue: 150,
      payout: 60,
      profit: 90,
      epc: 37.5,
      approveRate: 50,
    });

    const dateFiltered = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ dateFrom: '2026-05-02', dateTo: '2026-05-03' })
      .set('Authorization', `Bearer ${token}`);

    expect(dateFiltered.status).toBe(200);
    expect(dateFiltered.body.data.totals).toEqual({
      clicks: 2,
      transactions: 2,
      conversions: 2,
      approvedConversions: 0,
      cr: 100,
      revenue: 0,
      payout: 0,
      profit: 0,
      epc: 0,
      approveRate: 0,
    });
  });

  it('returns zero-derived metrics when denominators are zero', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);
    const fixtures = await seedSummaryFixtures();

    const response = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ offerId: fixtures.offerWithoutData.id })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totals).toEqual({
      clicks: 0,
      transactions: 0,
      conversions: 0,
      approvedConversions: 0,
      cr: 0,
      revenue: 0,
      payout: 0,
      profit: 0,
      epc: 0,
      approveRate: 0,
    });
  });

  it('supports grouped partner, offer, and advertiser summaries', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);
    const fixtures = await seedSummaryFixtures();

    const partnerGroups = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ groupBy: 'partner' })
      .set('Authorization', `Bearer ${token}`);

    expect(partnerGroups.status).toBe(200);
    expect(partnerGroups.body.data.groups).toHaveLength(2);
    expect(
      partnerGroups.body.data.groups.find(
        (entry) => entry.partner?.id === fixtures.affiliateOne.id,
      ),
    ).toMatchObject({
      type: 'partner',
      partner: {
        id: fixtures.affiliateOne.id,
        publicId: fixtures.affiliateOne.publicId,
        name: fixtures.affiliateOne.name,
      },
      metrics: {
        clicks: 3,
        transactions: 3,
        conversions: 3,
        approvedConversions: 2,
        revenue: 150,
        payout: 60,
        profit: 90,
        epc: 50,
        approveRate: 66.67,
      },
    });

    const offerGroups = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ groupBy: 'offer' })
      .set('Authorization', `Bearer ${token}`);

    expect(offerGroups.status).toBe(200);
    expect(offerGroups.body.data.groups).toHaveLength(3);
    expect(
      offerGroups.body.data.groups.find(
        (entry) => entry.offer?.id === fixtures.offerOne.id,
      ),
    ).toMatchObject({
      type: 'offer',
      offer: {
        id: fixtures.offerOne.id,
        publicId: fixtures.offerOne.publicId,
        name: fixtures.offerOne.title,
      },
      metrics: {
        clicks: 3,
        transactions: 3,
        conversions: 3,
        approvedConversions: 2,
        revenue: 150,
        payout: 60,
        profit: 90,
        epc: 50,
        approveRate: 66.67,
      },
    });

    const advertiserGroups = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ groupBy: 'advertiser' })
      .set('Authorization', `Bearer ${token}`);

    expect(advertiserGroups.status).toBe(200);
    expect(advertiserGroups.body.data.groups).toHaveLength(2);
    expect(
      advertiserGroups.body.data.groups.find(
        (entry) => entry.advertiser?.id === fixtures.advertiserOne.id,
      ),
    ).toMatchObject({
      type: 'advertiser',
      advertiser: {
        id: fixtures.advertiserOne.id,
        publicId: fixtures.advertiserOne.publicId,
        name: fixtures.advertiserOne.name,
      },
      metrics: {
        clicks: 4,
        transactions: 4,
        conversions: 4,
        approvedConversions: 2,
        revenue: 150,
        payout: 60,
        profit: 90,
        epc: 37.5,
        approveRate: 50,
      },
    });
  });

  it('returns validation errors for invalid filters and unsupported groupings', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);

    const invalidUuid = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ affiliateId: 'not-a-uuid' })
      .set('Authorization', `Bearer ${token}`);

    expect(invalidUuid.status).toBe(400);
    expect(invalidUuid.body.error.code).toBe('VALIDATION_ERROR');

    const invalidDateRange = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ dateFrom: '2026-05-10', dateTo: '2026-05-01' })
      .set('Authorization', `Bearer ${token}`);

    expect(invalidDateRange.status).toBe(400);
    expect(invalidDateRange.body.error.code).toBe('VALIDATION_ERROR');

    const unsupportedGroup = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({ groupBy: 'partner_offer' })
      .set('Authorization', `Bearer ${token}`);

    expect(unsupportedGroup.status).toBe(400);
    expect(unsupportedGroup.body.error.code).toBe('VALIDATION_ERROR');
  });
});
