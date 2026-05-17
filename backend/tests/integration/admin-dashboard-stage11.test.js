import request from 'supertest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import { createClick } from '../../src/models/clicks.model.js';
import { createConversion } from '../../src/models/conversions.model.js';
import {
  createTestAdminUser,
  createTestAdvertiserUser,
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

describe('admin dashboard stage 11', () => {
  it('allows admin and manager, rejects unauthenticated and non-admin-area roles', async () => {
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
      .get('/api/v1/admin/stats/dashboard?date=2026-05-17&timezone=UTC&bucket=hour')
      .set('Authorization', `Bearer ${adminToken}`);

    const managerResponse = await request(app)
      .get('/api/v1/admin/stats/dashboard?date=2026-05-17&timezone=UTC&bucket=hour')
      .set('Authorization', `Bearer ${managerToken}`);

    const unauthenticatedResponse = await request(app)
      .get('/api/v1/admin/stats/dashboard?date=2026-05-17&timezone=UTC&bucket=hour');

    const affiliateResponse = await request(app)
      .get('/api/v1/admin/stats/dashboard?date=2026-05-17&timezone=UTC&bucket=hour')
      .set('Authorization', `Bearer ${affiliateToken}`);

    const advertiserResponse = await request(app)
      .get('/api/v1/admin/stats/dashboard?date=2026-05-17&timezone=UTC&bucket=hour')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(adminResponse.status).toBe(200);
    expect(managerResponse.status).toBe(200);
    expect(unauthenticatedResponse.status).toBe(401);
    expect(affiliateResponse.status).toBe(403);
    expect(advertiserResponse.status).toBe(403);
  });

  it('returns zero totals and 24 zero hourly buckets for an empty day', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);

    const response = await request(app)
      .get('/api/v1/admin/stats/dashboard?date=2026-05-17&timezone=UTC&bucket=hour')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      date: '2026-05-17',
      timezone: 'UTC',
      bucket: 'hour',
      totals: {
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
      },
    });
    expect(response.body.data.series).toHaveLength(24);
    expect(response.body.data.series[0]).toMatchObject({
      label: '00:00',
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
    expect(response.body.data.series[23]).toMatchObject({
      label: '23:00',
      clicks: 0,
      transactions: 0,
      conversions: 0,
      approvedConversions: 0,
    });
  });

  it('aggregates clicks, conversions, financials, and derived metrics by hour with start-inclusive end-exclusive boundaries', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);
    const { affiliate } = await createTestAffiliateUser();
    const offer = await createTestOffer();
    const goal = await createTestOfferGoal(offer.id, {
      name: 'Signup',
      revenue: 120,
      payout: 45,
    });

    const clickAtStart = await createClick({
      clickId: 'stage11-click-00',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage11-click-00',
    });
    await setClickCreatedAt(clickAtStart.clickId, '2026-05-17T00:00:00.000Z');

    const clickAtNoon = await createClick({
      clickId: 'stage11-click-12',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage11-click-12',
    });
    await setClickCreatedAt(clickAtNoon.clickId, '2026-05-17T12:15:00.000Z');

    const clickAtEvening = await createClick({
      clickId: 'stage11-click-23',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage11-click-23',
    });
    await setClickCreatedAt(clickAtEvening.clickId, '2026-05-17T23:59:59.000Z');

    const excludedClick = await createClick({
      clickId: 'stage11-click-next-day',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage11-click-next-day',
    });
    await setClickCreatedAt(excludedClick.clickId, '2026-05-18T00:00:00.000Z');

    const approvedConversion = await createConversion({
      clickId: clickAtStart.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: 'approved',
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage11-approved',
      revenueAmount: 120,
      payoutAmount: 45,
      payoutRub: 45,
    });
    await setConversionCreatedAt(approvedConversion.id, '2026-05-17T00:10:00.000Z');

    const pendingConversion = await createConversion({
      clickId: clickAtNoon.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: 'pending',
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage11-pending',
      revenueAmount: 500,
      payoutAmount: 200,
      payoutRub: 200,
    });
    await setConversionCreatedAt(pendingConversion.id, '2026-05-17T12:20:00.000Z');

    const rejectedConversion = await createConversion({
      clickId: clickAtEvening.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: 'rejected',
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage11-rejected',
      revenueAmount: 800,
      payoutAmount: 400,
      payoutRub: 400,
    });
    await setConversionCreatedAt(rejectedConversion.id, '2026-05-17T23:30:00.000Z');

    const excludedConversion = await createConversion({
      clickId: excludedClick.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: 'approved',
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage11-excluded',
      revenueAmount: 999,
      payoutAmount: 555,
      payoutRub: 555,
    });
    await setConversionCreatedAt(excludedConversion.id, '2026-05-18T00:00:00.000Z');

    const response = await request(app)
      .get('/api/v1/admin/stats/dashboard?date=2026-05-17&timezone=UTC&bucket=hour')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.series).toHaveLength(24);

    expect(response.body.data.totals).toEqual({
      clicks: 3,
      transactions: 3,
      conversions: 3,
      approvedConversions: 1,
      cr: 100,
      revenue: 120,
      payout: 45,
      profit: 75,
      epc: 40,
      approveRate: 33.33,
    });

    expect(response.body.data.series[0]).toMatchObject({
      label: '00:00',
      clicks: 1,
      transactions: 1,
      conversions: 1,
      approvedConversions: 1,
      cr: 100,
      revenue: 120,
      payout: 45,
      profit: 75,
      epc: 120,
      approveRate: 100,
    });

    expect(response.body.data.series[12]).toMatchObject({
      label: '12:00',
      clicks: 1,
      transactions: 1,
      conversions: 1,
      approvedConversions: 0,
      cr: 100,
      revenue: 0,
      payout: 0,
      profit: 0,
      epc: 0,
      approveRate: 0,
    });

    expect(response.body.data.series[23]).toMatchObject({
      label: '23:00',
      clicks: 1,
      transactions: 1,
      conversions: 1,
      approvedConversions: 0,
      cr: 100,
      revenue: 0,
      payout: 0,
      profit: 0,
      epc: 0,
      approveRate: 0,
    });

    const nonZeroBuckets = response.body.data.series.filter(
      (entry) => entry.clicks > 0 || entry.conversions > 0,
    );

    expect(nonZeroBuckets).toHaveLength(3);
  });
});
