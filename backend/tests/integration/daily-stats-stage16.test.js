import request from 'supertest';
import { describe, expect, it } from 'vitest';
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

async function createStage16Fixtures() {
  const { affiliate: affiliateOne } = await createTestAffiliateUser({
    affiliateName: 'Stage 16 Partner One',
  });
  const { affiliate: affiliateTwo } = await createTestAffiliateUser({
    affiliateName: 'Stage 16 Partner Two',
  });

  const offerOne = await createTestOffer({
    title: 'Stage 16 Offer One',
  });
  const offerTwo = await createTestOffer({
    title: 'Stage 16 Offer Two',
  });

  const goalOne = await createTestOfferGoal(offerOne.id, {
    name: 'Stage 16 Goal One',
    revenue: 100,
    payout: 40,
  });
  const goalTwo = await createTestOfferGoal(offerTwo.id, {
    name: 'Stage 16 Goal Two',
    revenue: 400,
    payout: 160,
  });

  await createClick({
    clickId: 'stage16-click-regular',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    goalId: goalOne.id,
    canonicalClickId: 'stage16-click-regular',
    createdAt: '2026-05-10T10:00:00.000Z',
  });
  await createClick({
    clickId: 'stage16-click-manual',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    goalId: goalOne.id,
    canonicalClickId: 'stage16-click-manual',
    source: 'manual',
    createdAt: '2026-05-10T11:00:00.000Z',
  });
  await createClick({
    clickId: 'stage16-click-legacy-null',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    goalId: goalOne.id,
    canonicalClickId: 'stage16-click-legacy-null',
    createdAt: '2026-05-10T12:00:00.000Z',
  });
  await createClick({
    clickId: 'stage16-click-other-offer',
    offerId: offerTwo.id,
    affiliateId: affiliateTwo.id,
    goalId: goalTwo.id,
    canonicalClickId: 'stage16-click-other-offer',
    createdAt: '2026-05-10T13:00:00.000Z',
  });

  await createConversion({
    clickId: null,
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    source: 'tracking',
    status: 'approved',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage16-approved-regular',
    revenueAmount: 100,
    payoutAmount: 40,
    payoutRub: 40,
    createdAt: '2026-05-10T10:05:00.000Z',
  });
  await createConversion({
    clickId: null,
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    source: 'manual',
    status: 'pending',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage16-pending-manual',
    revenueAmount: 200,
    payoutAmount: 80,
    payoutRub: 80,
    createdAt: '2026-05-10T11:05:00.000Z',
  });
  await createConversion({
    clickId: 'stage16-click-legacy-null',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    source: 'tracking',
    status: 'approved',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage16-approved-legacy',
    revenueAmount: 70,
    payoutAmount: 20,
    payoutRub: 20,
    createdAt: '2026-05-10T12:05:00.000Z',
  });
  await createConversion({
    clickId: 'stage16-click-manual',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    source: 'tracking',
    status: 'rejected',
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage16-rejected',
    revenueAmount: 300,
    payoutAmount: 120,
    payoutRub: 120,
    createdAt: '2026-05-10T12:30:00.000Z',
  });
  await createConversion({
    clickId: 'stage16-click-other-offer',
    offerId: offerTwo.id,
    affiliateId: affiliateTwo.id,
    source: 'tracking',
    status: 'cancelled',
    goalId: goalTwo.id,
    goalName: goalTwo.name,
    goalType: goalTwo.type,
    externalTransactionId: 'stage16-cancelled',
    revenueAmount: 400,
    payoutAmount: 160,
    payoutRub: 160,
    createdAt: '2026-05-10T13:05:00.000Z',
  });
  await createConversion({
    clickId: 'stage16-click-regular',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    source: 'tracking',
    status: 'approved',
    isTest: true,
    goalId: goalOne.id,
    goalName: goalOne.name,
    goalType: goalOne.type,
    externalTransactionId: 'stage16-test-approved',
    revenueAmount: 500,
    payoutAmount: 200,
    payoutRub: 200,
    createdAt: '2026-05-10T14:05:00.000Z',
  });
  await createClick({
    clickId: 'stage16-click-only-day',
    offerId: offerOne.id,
    affiliateId: affiliateOne.id,
    goalId: goalOne.id,
    canonicalClickId: 'stage16-click-only-day',
    createdAt: '2026-05-11T09:00:00.000Z',
  });

  return {
    affiliateOne,
    affiliateTwo,
    offerOne,
    offerTwo,
    goalOne,
    goalTwo,
  };
}

describe('stage 16 daily stats and manual recalculation', () => {
  it('adds the extended daily_stats schema and indexes', async () => {
    const columns = await pool.query(
      `
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'daily_stats'
          AND column_name IN (
            'timezone',
            'advertiser_id',
            'goal_id',
            'manual_clicks_count',
            'manual_conversions_count',
            'test_conversions_count',
            'recalculated_at'
          )
      `,
    );

    expect(columns.rows.map((row) => row.columnName).sort()).toEqual([
      'advertiser_id',
      'goal_id',
      'manual_clicks_count',
      'manual_conversions_count',
      'recalculated_at',
      'test_conversions_count',
      'timezone',
    ]);

    const indexes = await pool.query(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'daily_stats_rollup_unique_idx',
            'daily_stats_timezone_date_idx',
            'daily_stats_offer_date_idx',
            'daily_stats_affiliate_date_idx',
            'daily_stats_advertiser_date_idx',
            'daily_stats_goal_date_idx'
          )
      `,
    );

    expect(indexes.rows.map((row) => row.indexname).sort()).toEqual([
      'daily_stats_advertiser_date_idx',
      'daily_stats_affiliate_date_idx',
      'daily_stats_goal_date_idx',
      'daily_stats_offer_date_idx',
      'daily_stats_rollup_unique_idx',
      'daily_stats_timezone_date_idx',
    ]);
  });

  it('allows admin and manager to recalculate stats and rejects partner, advertiser, and unauthenticated users', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } =
      await createTestAdminUser({ role: 'manager' });
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(
      managerUser.email,
      managerPassword,
    );
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );
    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    const adminResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      });

    const managerResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      });

    const unauthenticatedResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .send({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      });

    const affiliateResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      });

    const advertiserResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      });

    expect(adminResponse.status).toBe(200);
    expect(managerResponse.status).toBe(200);
    expect(unauthenticatedResponse.status).toBe(401);
    expect(affiliateResponse.status).toBe(403);
    expect(advertiserResponse.status).toBe(403);
  });

  it('rejects invalid date ranges and excessive periods', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);

    const invalidRangeResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dateFrom: '2026-05-12',
        dateTo: '2026-05-10',
      });

    expect(invalidRangeResponse.status).toBe(400);

    const excessiveRangeResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dateFrom: '2026-05-01',
        dateTo: '2026-06-15',
      });

    expect(excessiveRangeResponse.status).toBe(422);
  });

  it('recalculates persistent daily stats deterministically, stores manual/test/status totals, and serves dashboard plus summary from stored rows', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);
    const fixtures = await createStage16Fixtures();

    const firstRun = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      });

    expect(firstRun.status).toBe(200);
    expect(firstRun.body.data).toMatchObject({
      ok: true,
      dateFrom: '2026-05-10',
      dateTo: '2026-05-10',
      timezone: 'UTC',
      daysRecalculated: 1,
    });
    expect(firstRun.body.data.recalculatedAt).toEqual(expect.any(String));

    const firstRows = await pool.query(
      `
        SELECT
          date::text AS "date",
          timezone,
          offer_id AS "offerId",
          affiliate_id AS "affiliateId",
          advertiser_id AS "advertiserId",
          goal_id AS "goalId",
          clicks_count AS "clicksCount",
          manual_clicks_count AS "manualClicksCount",
          conversions_count AS "conversionsCount",
          approved_conversions_count AS "approvedConversionsCount",
          pending_conversions_count AS "pendingConversionsCount",
          rejected_conversions_count AS "rejectedConversionsCount",
          cancelled_conversions_count AS "cancelledConversionsCount",
          manual_conversions_count AS "manualConversionsCount",
          test_conversions_count AS "testConversionsCount",
          approved_revenue_total_rub AS "approvedRevenue",
          approved_payout_total_rub AS "approvedPayout",
          pending_revenue_total_rub AS "pendingRevenue",
          pending_payout_total_rub AS "pendingPayout",
          recalculated_at AS "recalculatedAt"
        FROM daily_stats
        WHERE date = '2026-05-10'
          AND timezone = 'UTC'
        ORDER BY offer_id ASC
      `,
    );

    expect(firstRows.rows).toHaveLength(2);
    expect(firstRows.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-05-10',
          timezone: 'UTC',
          offerId: fixtures.offerOne.id,
          affiliateId: fixtures.affiliateOne.id,
          advertiserId: fixtures.offerOne.advertiserId,
          goalId: fixtures.goalOne.id,
          clicksCount: 3,
          manualClicksCount: 1,
          conversionsCount: 4,
          approvedConversionsCount: 2,
          pendingConversionsCount: 1,
          rejectedConversionsCount: 1,
          cancelledConversionsCount: 0,
          manualConversionsCount: 1,
          testConversionsCount: 1,
          approvedRevenue: '170.00',
          approvedPayout: '60.00',
          pendingRevenue: '200.00',
          pendingPayout: '80.00',
          recalculatedAt: expect.any(Date),
        }),
        expect.objectContaining({
          date: '2026-05-10',
          timezone: 'UTC',
          offerId: fixtures.offerTwo.id,
          affiliateId: fixtures.affiliateTwo.id,
          advertiserId: fixtures.offerTwo.advertiserId,
          goalId: fixtures.goalTwo.id,
          clicksCount: 1,
          manualClicksCount: 0,
          conversionsCount: 1,
          approvedConversionsCount: 0,
          pendingConversionsCount: 0,
          rejectedConversionsCount: 0,
          cancelledConversionsCount: 1,
          manualConversionsCount: 0,
          testConversionsCount: 0,
          approvedRevenue: '0.00',
          approvedPayout: '0.00',
          pendingRevenue: '0.00',
          pendingPayout: '0.00',
          recalculatedAt: expect.any(Date),
        }),
      ]),
    );

    const secondRun = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      });

    expect(secondRun.status).toBe(200);

    const rowCountResult = await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM daily_stats
        WHERE date = '2026-05-10'
          AND timezone = 'UTC'
      `,
    );

    expect(rowCountResult.rows[0].count).toBe(2);

    const summaryResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
        groupBy: 'advertiser',
      })
      .set('Authorization', `Bearer ${token}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.totals).toMatchObject({
      clicks: 4,
      transactions: 4,
      conversions: 5,
      pendingConversions: 1,
      approvedConversions: 2,
      rejectedConversions: 1,
      cancelledConversions: 1,
      pendingRevenue: 200,
      pendingPayout: 80,
      pendingProfit: 120,
      revenue: 170,
      payout: 60,
      profit: 110,
      cr: 125,
      epc: 42.5,
      approveRate: 40,
    });
    expect(summaryResponse.body.data.statsUpdatedAt).toEqual(expect.any(String));
    expect(summaryResponse.body.data.groups).toHaveLength(2);

    const dashboardResponse = await request(app)
      .get('/api/v1/admin/stats/dashboard')
      .query({
        date: '2026-05-10',
        timezone: 'UTC',
        bucket: 'hour',
      })
      .set('Authorization', `Bearer ${token}`);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.data.totals).toMatchObject({
      clicks: 4,
      transactions: 4,
      conversions: 5,
      pendingConversions: 1,
      approvedConversions: 2,
      rejectedConversions: 1,
      cancelledConversions: 1,
      pendingRevenue: 200,
      pendingPayout: 80,
      pendingProfit: 120,
      revenue: 170,
      payout: 60,
      profit: 110,
      cr: 125,
      epc: 42.5,
      approveRate: 40,
    });
    expect(dashboardResponse.body.data.statsUpdatedAt).toEqual(expect.any(String));
    expect(dashboardResponse.body.data.series).toHaveLength(24);

    await pool.query('DELETE FROM conversions');
    await pool.query('DELETE FROM clicks');

    const storedSummaryResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({
        dateFrom: '2026-05-10',
        dateTo: '2026-05-10',
        timezone: 'UTC',
      })
      .set('Authorization', `Bearer ${token}`);

    expect(storedSummaryResponse.status).toBe(200);
    expect(storedSummaryResponse.body.data.totals).toMatchObject({
      clicks: 4,
      transactions: 4,
      conversions: 5,
      revenue: 170,
      payout: 60,
      profit: 110,
    });

    const storedDashboardResponse = await request(app)
      .get('/api/v1/admin/stats/dashboard')
      .query({
        date: '2026-05-10',
        timezone: 'UTC',
        bucket: 'hour',
      })
      .set('Authorization', `Bearer ${token}`);

    expect(storedDashboardResponse.status).toBe(200);
    expect(storedDashboardResponse.body.data.totals).toMatchObject({
      clicks: 4,
      transactions: 4,
      conversions: 5,
      revenue: 170,
      payout: 60,
      profit: 110,
    });
    expect(
      storedDashboardResponse.body.data.series.every(
        (entry) =>
          entry.clicks === 0 &&
          entry.conversions === 0 &&
          entry.revenue === 0 &&
          entry.payout === 0,
      ),
    ).toBe(true);

    const auditEvents = await pool.query(
      `
        SELECT action, entity_type AS "entityType", actor_user_id AS "actorUserId", context_json AS context
        FROM audit_events
        WHERE action = 'stats.recalculated'
        ORDER BY created_at ASC
      `,
    );

    expect(auditEvents.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'stats.recalculated',
          entityType: 'stats',
          actorUserId: user.id,
          context: expect.objectContaining({
            metadata: expect.objectContaining({
              dateFrom: '2026-05-10',
              dateTo: '2026-05-10',
              timezone: 'UTC',
              daysRecalculated: 1,
            }),
          }),
        }),
      ]),
    );
  });

  it('returns 0 for CR, EPC, and approveRate denominators when stored stats contain clicks without conversions', async () => {
    const { user, password } = await createTestAdminUser();
    const token = await loginAndGetToken(user.email, password);
    await createStage16Fixtures();

    const recalcResponse = await request(app)
      .post('/api/v1/admin/stats/recalculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dateFrom: '2026-05-11',
        dateTo: '2026-05-11',
        timezone: 'UTC',
      });

    expect(recalcResponse.status).toBe(200);

    const summaryResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({
        dateFrom: '2026-05-11',
        dateTo: '2026-05-11',
        timezone: 'UTC',
      })
      .set('Authorization', `Bearer ${token}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.totals).toMatchObject({
      clicks: 1,
      transactions: 1,
      conversions: 0,
      cr: 0,
      epc: 0,
      approveRate: 0,
    });
  });
});
