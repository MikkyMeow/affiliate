import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import { CONVERSION_STATUSES } from '../../src/constants/conversions.js';
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

async function createManualAdjustmentBatch(createdBy) {
  const id = randomUUID();
  await pool.query(
    `
      INSERT INTO manual_adjustment_batches (
        id,
        type,
        partner_mode,
        total_rows,
        valid_rows,
        invalid_rows,
        created_rows,
        skipped_rows,
        status,
        created_by
      )
      VALUES (
        $1,
        'conversions',
        'single_partner',
        0,
        0,
        0,
        0,
        0,
        'applied',
        $2
      )
    `,
    [id, createdBy],
  );

  return id;
}

async function createTrackingFixture() {
  const { affiliate } = await createTestAffiliateUser();
  const offer = await createTestOffer();
  const goal = await createTestOfferGoal(offer.id, {
    name: 'Lead',
    revenue: 100,
    payout: 40,
  });

  return { affiliate, offer, goal };
}

describe('stage 15 conversion status model', () => {
  it('adds the status history table, indexes, and conversion status/test columns', async () => {
    const columns = await pool.query(
      `
        SELECT table_name AS "tableName", column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'conversions' AND column_name IN ('is_test', 'updated_at'))
            OR (
              table_name = 'conversion_status_history'
              AND column_name IN (
                'conversion_id',
                'from_status',
                'to_status',
                'reason',
                'changed_by',
                'changed_at',
                'metadata'
              )
            )
          )
      `,
    );

    expect(columns.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: 'conversions',
          columnName: 'is_test',
        }),
        expect.objectContaining({
          tableName: 'conversions',
          columnName: 'updated_at',
        }),
        expect.objectContaining({
          tableName: 'conversion_status_history',
          columnName: 'conversion_id',
        }),
        expect.objectContaining({
          tableName: 'conversion_status_history',
          columnName: 'to_status',
        }),
      ]),
    );

    const indexes = await pool.query(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'conversion_status_history_conversion_id_idx',
            'conversion_status_history_changed_at_idx',
            'conversion_status_history_changed_by_idx'
          )
      `,
    );

    expect(indexes.rows.map((row) => row.indexname).sort()).toEqual([
      'conversion_status_history_changed_at_idx',
      'conversion_status_history_changed_by_idx',
      'conversion_status_history_conversion_id_idx',
    ]);
  });

  it('allows admin and manager status transitions, rejects invalid actors/statuses, and records history plus audit entries', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } = await createTestAdminUser({
      role: 'manager',
    });
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();
    const { affiliate, offer, goal } = await createTrackingFixture();

    const click = await createClick({
      clickId: 'stage15-status-click',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage15-status-click',
      createdAt: '2026-05-17T10:00:00.000Z',
    });

    const conversion = await createConversion({
      clickId: click.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: CONVERSION_STATUSES.PENDING,
      payoutRub: 40,
      payoutAmount: 40,
      revenueAmount: 100,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-status-order',
      createdAt: '2026-05-17T10:05:00.000Z',
    });

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

    const approveResponse = await request(app)
      .patch(`/api/v1/conversions/${conversion.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'approved',
        reason: 'Advertiser confirmed lead',
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data).toMatchObject({
      conversion: {
        id: conversion.id,
        status: 'approved',
        source: 'tracking',
        isTest: false,
        revenue: 100,
        payout: 40,
        profit: 60,
      },
      historyEntry: {
        fromStatus: 'pending',
        toStatus: 'approved',
        reason: 'Advertiser confirmed lead',
      },
    });

    const managerCancelResponse = await request(app)
      .patch(`/api/v1/conversions/${conversion.id}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        status: 'cancelled',
        reason: 'Duplicate advertiser callback',
      });

    expect(managerCancelResponse.status).toBe(200);
    expect(managerCancelResponse.body.data).toMatchObject({
      conversion: {
        id: conversion.id,
        status: 'cancelled',
      },
      historyEntry: {
        fromStatus: 'approved',
        toStatus: 'cancelled',
        reason: 'Duplicate advertiser callback',
      },
    });

    const sameStatusResponse = await request(app)
      .patch(`/api/v1/conversions/${conversion.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'cancelled',
      });

    expect(sameStatusResponse.status).toBe(200);
    expect(sameStatusResponse.body.data.historyEntry).toBeNull();

    const invalidStatusResponse = await request(app)
      .patch(`/api/v1/conversions/${conversion.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'paid',
      });

    expect(invalidStatusResponse.status).toBe(400);
    expect(invalidStatusResponse.body.error.code).toBe('VALIDATION_ERROR');

    const affiliateForbidden = await request(app)
      .patch(`/api/v1/conversions/${conversion.id}/status`)
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        status: 'approved',
      });

    const advertiserForbidden = await request(app)
      .patch(`/api/v1/conversions/${conversion.id}/status`)
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({
        status: 'approved',
      });

    expect(affiliateForbidden.status).toBe(403);
    expect(advertiserForbidden.status).toBe(403);

    const historyResponse = await request(app)
      .get(`/api/v1/conversions/${conversion.id}/status-history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.items).toHaveLength(2);
    expect(historyResponse.body.data.items[0]).toMatchObject({
      fromStatus: 'approved',
      toStatus: 'cancelled',
      reason: 'Duplicate advertiser callback',
      changedBy: {
        id: managerUser.id,
        email: managerUser.email,
      },
    });
    expect(historyResponse.body.data.items[1]).toMatchObject({
      fromStatus: 'pending',
      toStatus: 'approved',
      reason: 'Advertiser confirmed lead',
      changedBy: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });

    const historyRows = await pool.query(
      `
        SELECT
          from_status AS "fromStatus",
          to_status AS "toStatus",
          reason
        FROM conversion_status_history
        WHERE conversion_id = $1
        ORDER BY changed_at ASC, id ASC
      `,
      [conversion.id],
    );

    expect(historyRows.rows).toEqual([
      {
        fromStatus: 'pending',
        toStatus: 'approved',
        reason: 'Advertiser confirmed lead',
      },
      {
        fromStatus: 'approved',
        toStatus: 'cancelled',
        reason: 'Duplicate advertiser callback',
      },
    ]);

    const auditRows = await pool.query(
      `
        SELECT
          action,
          actor_role AS "actorRole",
          context_json AS context
        FROM audit_events
        WHERE entity_type = 'conversion'
          AND entity_id = $1
          AND action = 'conversion.status_changed'
        ORDER BY created_at ASC
      `,
      [conversion.id],
    );

    expect(auditRows.rows).toHaveLength(2);
    expect(auditRows.rows[0]).toMatchObject({
      action: 'conversion.status_changed',
      actorRole: 'admin',
      context: expect.objectContaining({
        oldValue: {
          status: 'pending',
        },
        newValue: {
          status: 'approved',
        },
        metadata: expect.objectContaining({
          reason: 'Advertiser confirmed lead',
        }),
      }),
    });
    expect(auditRows.rows[1]).toMatchObject({
      action: 'conversion.status_changed',
      actorRole: 'manager',
      context: expect.objectContaining({
        oldValue: {
          status: 'approved',
        },
        newValue: {
          status: 'cancelled',
        },
        metadata: expect.objectContaining({
          reason: 'Duplicate advertiser callback',
        }),
      }),
    });
  });

  it('allows manual conversions to be approved and cancelled like regular conversions', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { affiliate, offer, goal } = await createTrackingFixture();
    const batchId = await createManualAdjustmentBatch(adminUser.id);

    const manualConversion = await createConversion({
      clickId: null,
      offerId: offer.id,
      affiliateId: affiliate.id,
      source: 'manual',
      manualAdjustmentBatchId: batchId,
      createdBy: adminUser.id,
      status: CONVERSION_STATUSES.PENDING,
      payoutRub: 40,
      payoutAmount: 40,
      revenueAmount: 100,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-manual-order',
      createdAt: '2026-05-17T12:00:00.000Z',
    });

    const approveResponse = await request(app)
      .patch(`/api/v1/conversions/${manualConversion.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'approved',
      });

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.data.conversion).toMatchObject({
      id: manualConversion.id,
      source: 'manual',
      manualAdjustmentBatchId: batchId,
      status: 'approved',
    });

    const cancelResponse = await request(app)
      .patch(`/api/v1/conversions/${manualConversion.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'cancelled',
        reason: 'Imported in the wrong batch',
      });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.data.conversion).toMatchObject({
      id: manualConversion.id,
      source: 'manual',
      manualAdjustmentBatchId: batchId,
      status: 'cancelled',
    });
  });

  it('excludes test, rejected, and cancelled conversions from confirmed or pending money and exposes admin list markers/filters', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { affiliate, offer, goal } = await createTrackingFixture();
    const batchId = await createManualAdjustmentBatch(adminUser.id);

    const clickApproved = await createClick({
      clickId: 'stage15-approved-click',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage15-approved-click',
      createdAt: '2026-05-17T09:00:00.000Z',
    });
    const clickPending = await createClick({
      clickId: 'stage15-pending-click',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage15-pending-click',
      createdAt: '2026-05-17T10:00:00.000Z',
    });
    const clickRejected = await createClick({
      clickId: 'stage15-rejected-click',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage15-rejected-click',
      createdAt: '2026-05-17T11:00:00.000Z',
    });
    const clickCancelled = await createClick({
      clickId: 'stage15-cancelled-click',
      offerId: offer.id,
      affiliateId: affiliate.id,
      canonicalClickId: 'stage15-cancelled-click',
      createdAt: '2026-05-17T12:00:00.000Z',
    });

    await createConversion({
      clickId: clickApproved.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: CONVERSION_STATUSES.APPROVED,
      payoutRub: 40,
      payoutAmount: 40,
      revenueAmount: 100,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-approved-live',
      createdAt: '2026-05-17T09:05:00.000Z',
    });
    await createConversion({
      clickId: clickPending.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: CONVERSION_STATUSES.PENDING,
      payoutRub: 80,
      payoutAmount: 80,
      revenueAmount: 200,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-pending-live',
      createdAt: '2026-05-17T10:05:00.000Z',
    });
    await createConversion({
      clickId: clickRejected.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: CONVERSION_STATUSES.REJECTED,
      payoutRub: 120,
      payoutAmount: 120,
      revenueAmount: 300,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-rejected-live',
      createdAt: '2026-05-17T11:05:00.000Z',
    });
    await createConversion({
      clickId: clickCancelled.clickId,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: CONVERSION_STATUSES.CANCELLED,
      payoutRub: 160,
      payoutAmount: 160,
      revenueAmount: 400,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-cancelled-live',
      createdAt: '2026-05-17T12:05:00.000Z',
    });
    await createConversion({
      clickId: null,
      offerId: offer.id,
      affiliateId: affiliate.id,
      source: 'manual',
      manualAdjustmentBatchId: batchId,
      createdBy: adminUser.id,
      status: CONVERSION_STATUSES.APPROVED,
      payoutRub: 240,
      payoutAmount: 240,
      revenueAmount: 600,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-manual-approved',
      createdAt: '2026-05-17T13:00:00.000Z',
    });
    await createConversion({
      clickId: null,
      offerId: offer.id,
      affiliateId: affiliate.id,
      source: 'manual',
      manualAdjustmentBatchId: batchId,
      createdBy: adminUser.id,
      status: CONVERSION_STATUSES.PENDING,
      payoutRub: 280,
      payoutAmount: 280,
      revenueAmount: 700,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-manual-pending',
      createdAt: '2026-05-17T14:00:00.000Z',
    });
    await createConversion({
      clickId: null,
      offerId: offer.id,
      affiliateId: affiliate.id,
      status: CONVERSION_STATUSES.APPROVED,
      isTest: true,
      payoutRub: 200,
      payoutAmount: 200,
      revenueAmount: 500,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      externalTransactionId: 'stage15-test-approved',
      createdAt: '2026-05-17T15:00:00.000Z',
    });

    const summaryResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({
        dateFrom: '2026-05-17',
        dateTo: '2026-05-17',
        offerId: offer.id,
        affiliateId: affiliate.id,
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.totals).toMatchObject({
      clicks: 4,
      transactions: 4,
      conversions: 6,
      pendingConversions: 2,
      approvedConversions: 2,
      rejectedConversions: 1,
      cancelledConversions: 1,
      revenue: 700,
      payout: 280,
      profit: 420,
      pendingRevenue: 900,
      pendingPayout: 360,
      pendingProfit: 540,
      approveRate: 33.33,
    });

    const dashboardResponse = await request(app)
      .get('/api/v1/admin/stats/dashboard')
      .query({
        date: '2026-05-17',
        timezone: 'UTC',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.data.totals).toMatchObject({
      clicks: 4,
      transactions: 4,
      conversions: 6,
      pendingConversions: 2,
      approvedConversions: 2,
      rejectedConversions: 1,
      cancelledConversions: 1,
      revenue: 700,
      payout: 280,
      profit: 420,
      pendingRevenue: 900,
      pendingPayout: 360,
      pendingProfit: 540,
      approveRate: 33.33,
    });

    const manualListResponse = await request(app)
      .get('/api/v1/conversions')
      .query({
        dateFrom: '2026-05-17',
        dateTo: '2026-05-17',
        source: 'manual',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(manualListResponse.status).toBe(200);
    expect(manualListResponse.body.data).toHaveLength(2);
    expect(manualListResponse.body.data[0]).toMatchObject({
      source: 'manual',
      clickId: null,
      manualAdjustmentBatchId: batchId,
      isTest: false,
    });

    const testListResponse = await request(app)
      .get('/api/v1/conversions')
      .query({
        dateFrom: '2026-05-17',
        dateTo: '2026-05-17',
        isTest: 'true',
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(testListResponse.status).toBe(200);
    expect(testListResponse.body.data).toHaveLength(1);
    expect(testListResponse.body.data[0]).toMatchObject({
      status: 'approved',
      isTest: true,
      revenue: 500,
      payout: 200,
      profit: 300,
    });
  });
});
