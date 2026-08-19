import request from 'supertest';
import { describe, expect, it } from 'vitest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import {
  createTestAdminUser,
  createTestAdvertiser,
  createTestAdvertiserUser,
  createTestAffiliate,
  createTestAffiliateUser,
  createTestOffer,
  createTestOfferGoal,
  createTestOfferGoalAffiliateRate,
} from '../helpers/factories.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

async function createAdjustmentFixtures() {
  const { user: adminUser, password: adminPassword } = await createTestAdminUser({
    displayName: 'Admin Adjustments',
  });
  const { user: managerUser, password: managerPassword } =
    await createTestAdminUser({
      role: 'manager',
      displayName: 'Manager Adjustments',
    });
  const { user: affiliateUser, password: affiliatePassword } =
    await createTestAffiliateUser();
  const { user: advertiserUser, password: advertiserPassword } =
    await createTestAdvertiserUser();

  const advertiser = await createTestAdvertiser({ name: 'Advertiser Manual' });
  const affiliate = await createTestAffiliate({ name: 'Affiliate Manual' });
  const secondAffiliate = await createTestAffiliate({ name: 'Affiliate Second' });
  const offer = await createTestOffer({
    advertiserId: advertiser.id,
    title: 'Offer Manual',
  });
  const goal = await createTestOfferGoal(offer.id, {
    name: 'Lead',
    revenue: 700,
    payout: 300,
  });

  await createTestOfferGoalAffiliateRate(goal.id, affiliate.id, {
    revenue: 950,
    payout: 420,
    createdBy: adminUser.id,
  });

  return {
    adminUser,
    adminPassword,
    managerUser,
    managerPassword,
    affiliateUser,
    affiliatePassword,
    advertiserUser,
    advertiserPassword,
    advertiser,
    affiliate,
    secondAffiliate,
    offer,
    goal,
  };
}

describe('stage 14 adjustments', () => {
  it('installs the manual adjustment batch schema and makes conversion click_id nullable', async () => {
    const batchTableColumns = await pool.query(
      `
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'manual_adjustment_batches'
        ORDER BY ordinal_position ASC
      `,
    );

    expect(batchTableColumns.rows.map((row) => row.columnName)).toEqual(
      expect.arrayContaining([
        'id',
        'type',
        'partner_mode',
        'default_affiliate_id',
        'default_offer_id',
        'default_goal_id',
        'default_status',
        'original_filename',
        'total_rows',
        'valid_rows',
        'invalid_rows',
        'created_rows',
        'skipped_rows',
        'status',
        'created_by',
        'created_at',
        'applied_at',
        'metadata',
      ]),
    );

    const conversionClickColumn = await pool.query(
      `
        SELECT is_nullable AS "isNullable"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'conversions'
          AND column_name = 'click_id'
      `,
    );

    expect(conversionClickColumn.rows[0]?.isNullable).toBe('YES');

    const conversionSourceColumn = await pool.query(
      `
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'conversions'
          AND column_name IN ('source', 'manual_adjustment_batch_id', 'created_by')
      `,
    );
    expect(conversionSourceColumn.rows).toHaveLength(3);

    const clickSourceColumn = await pool.query(
      `
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'clicks'
          AND column_name IN ('goal_id', 'source', 'manual_adjustment_batch_id', 'created_by')
      `,
    );
    expect(clickSourceColumn.rows).toHaveLength(4);

    const indexResult = await pool.query(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'manual_adjustment_batches_created_at_idx',
            'manual_adjustment_batches_created_by_idx',
            'conversions_manual_adjustment_batch_idx',
            'conversions_source_idx',
            'clicks_goal_id_idx',
            'clicks_manual_adjustment_batch_idx',
            'clicks_source_idx'
          )
      `,
    );

    expect(indexResult.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'manual_adjustment_batches_created_at_idx',
        'manual_adjustment_batches_created_by_idx',
        'conversions_manual_adjustment_batch_idx',
        'conversions_source_idx',
        'clicks_goal_id_idx',
        'clicks_manual_adjustment_batch_idx',
        'clicks_source_idx',
      ]),
    );
  });

  it('allows admin and manager to preview adjustments and rejects partner/advertiser', async () => {
    const fixtures = await createAdjustmentFixtures();
    const adminToken = await loginAndGetToken(
      fixtures.adminUser.email,
      fixtures.adminPassword,
    );
    const managerToken = await loginAndGetToken(
      fixtures.managerUser.email,
      fixtures.managerPassword,
    );
    const affiliateToken = await loginAndGetToken(
      fixtures.affiliateUser.email,
      fixtures.affiliatePassword,
    );
    const advertiserToken = await loginAndGetToken(
      fixtures.advertiserUser.email,
      fixtures.advertiserPassword,
    );

    const payload = {
      type: 'conversions',
      partnerMode: 'single_partner',
      affiliateId: fixtures.affiliate.id,
      offerId: fixtures.offer.id,
      goalId: fixtures.goal.id,
      defaultStatus: 'approved',
      originalFilename: 'preview.csv',
      csvText: 'external_id,created_at\nORDER-ROLE-1,2026-05-17T10:00:00Z',
    };

    const adminResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.batch.type).toBe('conversions');

    const managerResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(payload);
    expect(managerResponse.status).toBe(200);

    const affiliateResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send(payload);
    expect(affiliateResponse.status).toBe(403);

    const advertiserResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send(payload);
    expect(advertiserResponse.status).toBe(403);
  });

  it('resolves partner, advertiser, and offer public IDs in preview and returns row-level errors', async () => {
    const fixtures = await createAdjustmentFixtures();
    const adminToken = await loginAndGetToken(
      fixtures.adminUser.email,
      fixtures.adminPassword,
    );

    const previewResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'conversions',
        partnerMode: 'per_row',
        defaultStatus: 'approved',
        originalFilename: 'public-ids.csv',
        csvText: `partner_id,offer_id,advertiser_id,goal_id,external_id,created_at
${fixtures.affiliate.publicId},${fixtures.offer.publicId},${fixtures.advertiser.publicId},Lead,ORDER-PUBLIC-1,2026-05-17T10:00:00Z
#P999,${fixtures.offer.publicId},${fixtures.advertiser.publicId},Lead,ORDER-PUBLIC-2,2026-05-17T11:00:00Z`,
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.data.batch).toMatchObject({
      totalRows: 2,
      validRows: 1,
      invalidRows: 1,
      partnerMode: 'per_row',
    });

    expect(previewResponse.body.data.rows[0]).toMatchObject({
      rowNumber: 2,
      valid: true,
      resolved: {
        affiliate: {
          id: fixtures.affiliate.id,
          publicId: fixtures.affiliate.publicId,
        },
        offer: {
          id: fixtures.offer.id,
          publicId: fixtures.offer.publicId,
        },
        advertiser: {
          id: fixtures.advertiser.id,
          publicId: fixtures.advertiser.publicId,
        },
        goal: {
          id: fixtures.goal.id,
          name: 'Lead',
        },
        status: 'approved',
        externalId: 'ORDER-PUBLIC-1',
      },
    });

    expect(previewResponse.body.data.rows[1]).toMatchObject({
      rowNumber: 3,
      valid: false,
      errors: [
        expect.objectContaining({
          field: 'partner_id',
          code: 'PARTNER_NOT_FOUND',
        }),
      ],
    });
  });

  it('applies manual conversions without synthetic clicks, ignores CSV money, writes audit events, and exposes them in lists and stats', async () => {
    const fixtures = await createAdjustmentFixtures();
    const adminToken = await loginAndGetToken(
      fixtures.adminUser.email,
      fixtures.adminPassword,
    );

    const previewResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'conversions',
        partnerMode: 'single_partner',
        affiliateId: fixtures.affiliate.id,
        offerId: fixtures.offer.id,
        goalId: fixtures.goal.id,
        defaultStatus: 'approved',
        originalFilename: 'manual-conversions.csv',
        csvText: `external_id,created_at,revenue,payout,profit,comment
ORDER-MANUAL-1,2026-05-17T10:00:00Z,9999,8888,7777,manual import
ORDER-MANUAL-1,2026-05-17T10:10:00Z,9999,8888,7777,duplicate row`,
      });

    expect(previewResponse.status).toBe(200);
    const batchId = previewResponse.body.data.batch.id;

    const applyResponse = await request(app)
      .post(`/api/v1/admin/adjustments/${batchId}/apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(applyResponse.status).toBe(200);
    expect(applyResponse.body.data.batch).toMatchObject({
      id: batchId,
      status: 'applied',
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      createdRows: 1,
      skippedRows: 1,
    });
    expect(applyResponse.body.data.result).toMatchObject({
      created: 1,
      skipped: 1,
      errors: [
        expect.objectContaining({
          rowNumber: 3,
          code: 'DUPLICATE_CONVERSION',
        }),
      ],
    });

    const conversionResult = await pool.query(
      `
        SELECT
          id,
          click_id AS "clickId",
          affiliate_id AS "affiliateId",
          offer_id AS "offerId",
          goal_id AS "goalId",
          source,
          manual_adjustment_batch_id AS "batchId",
          created_by AS "createdBy",
          revenue_amount AS "revenueAmount",
          payout_amount AS "payoutAmount"
        FROM conversions
        WHERE external_transaction_id = 'ORDER-MANUAL-1'
      `,
    );

    expect(conversionResult.rows).toHaveLength(1);
    expect(conversionResult.rows[0]).toMatchObject({
      clickId: null,
      affiliateId: fixtures.affiliate.id,
      offerId: fixtures.offer.id,
      goalId: fixtures.goal.id,
      source: 'manual',
      batchId,
      createdBy: fixtures.adminUser.id,
      revenueAmount: '950.00',
      payoutAmount: '420.00',
    });

    const conversionsListResponse = await request(app)
      .get('/api/v1/conversions')
      .query({ externalTransactionId: 'ORDER-MANUAL-1' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(conversionsListResponse.status).toBe(200);
    expect(conversionsListResponse.body.data[0]).toMatchObject({
      source: 'manual',
      clickId: null,
      affiliate: {
        publicId: fixtures.affiliate.publicId,
      },
      offer: {
        publicId: fixtures.offer.publicId,
      },
    });

    const summaryResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({
        dateFrom: '2026-05-17',
        dateTo: '2026-05-17',
        offerId: fixtures.offer.publicId,
        affiliateId: fixtures.affiliate.publicId,
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.totals).toMatchObject({
      conversions: 1,
      approvedConversions: 1,
      revenue: 950,
      payout: 420,
      profit: 530,
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
      conversions: 1,
      approvedConversions: 1,
      revenue: 950,
      payout: 420,
      profit: 530,
    });

    const historyResponse = await request(app)
      .get('/api/v1/admin/adjustments/batches')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.items[0]).toMatchObject({
      id: batchId,
      type: 'conversions',
      status: 'applied',
      createdBy: {
        id: fixtures.adminUser.id,
        email: fixtures.adminUser.email,
      },
    });

    const detailResponse = await request(app)
      .get(`/api/v1/admin/adjustments/batches/${batchId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data).toMatchObject({
      batch: {
        id: batchId,
        status: 'applied',
      },
      result: {
        created: 1,
        skipped: 1,
      },
    });

    const auditEvents = await pool.query(
      `
        SELECT action, entity_type AS "entityType"
        FROM audit_events
        WHERE context_json @> $1::jsonb
        ORDER BY created_at ASC
      `,
      [JSON.stringify({ metadata: { batchId } })],
    );

    expect(auditEvents.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'adjustment.preview_created',
          entityType: 'manual_adjustment_batch',
        }),
        expect.objectContaining({
          action: 'adjustment.applied',
          entityType: 'manual_adjustment_batch',
        }),
        expect.objectContaining({
          action: 'conversion.manual_created',
          entityType: 'conversion',
        }),
      ]),
    );
  });

  it('applies manual clicks, exposes source markers in transactions, and includes them in click stats', async () => {
    const fixtures = await createAdjustmentFixtures();
    const adminToken = await loginAndGetToken(
      fixtures.adminUser.email,
      fixtures.adminPassword,
    );

    const previewResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'clicks',
        partnerMode: 'single_partner',
        affiliateId: fixtures.affiliate.id,
        offerId: fixtures.offer.id,
        goalId: fixtures.goal.id,
        defaultStatus: 'allowed_target_redirect',
        originalFilename: 'manual-clicks.csv',
        csvText: 'country,ip,sub1,created_at\nRU,127.0.0.1,campaign-a,2026-05-18T09:00:00Z',
      });

    expect(previewResponse.status).toBe(200);
    const batchId = previewResponse.body.data.batch.id;

    const applyResponse = await request(app)
      .post(`/api/v1/admin/adjustments/${batchId}/apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(applyResponse.status).toBe(200);
    expect(applyResponse.body.data.batch).toMatchObject({
      status: 'applied',
      createdRows: 1,
    });

    const clicksResult = await pool.query(
      `
        SELECT
          click_id AS "clickId",
          affiliate_id AS "affiliateId",
          offer_id AS "offerId",
          goal_id AS "goalId",
          source,
          manual_adjustment_batch_id AS "batchId",
          created_by AS "createdBy"
        FROM clicks
        WHERE manual_adjustment_batch_id = $1
      `,
      [batchId],
    );

    expect(clicksResult.rows).toHaveLength(1);
    expect(clicksResult.rows[0]).toMatchObject({
      affiliateId: fixtures.affiliate.id,
      offerId: fixtures.offer.id,
      goalId: fixtures.goal.id,
      source: 'manual',
      batchId,
      createdBy: fixtures.adminUser.id,
      clickId: expect.any(String),
    });

    const clicksListResponse = await request(app)
      .get('/api/v1/clicks')
      .query({ offerId: fixtures.offer.publicId, affiliateId: fixtures.affiliate.publicId })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(clicksListResponse.status).toBe(200);
    expect(clicksListResponse.body.data[0]).toMatchObject({
      source: 'manual',
      offer: {
        publicId: fixtures.offer.publicId,
      },
      affiliate: {
        publicId: fixtures.affiliate.publicId,
      },
    });

    const summaryResponse = await request(app)
      .get('/api/v1/admin/stats/summary')
      .query({
        dateFrom: '2026-05-18',
        dateTo: '2026-05-18',
        offerId: fixtures.offer.publicId,
        affiliateId: fixtures.affiliate.publicId,
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.totals).toMatchObject({
      clicks: 1,
      transactions: 1,
    });
  });

  it('does not implement a batch cancellation endpoint', async () => {
    const fixtures = await createAdjustmentFixtures();
    const adminToken = await loginAndGetToken(
      fixtures.adminUser.email,
      fixtures.adminPassword,
    );

    const previewResponse = await request(app)
      .post('/api/v1/admin/adjustments/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'clicks',
        partnerMode: 'single_partner',
        affiliateId: fixtures.affiliate.id,
        offerId: fixtures.offer.id,
        originalFilename: 'cancel.csv',
        csvText: 'created_at\n2026-05-19T10:00:00Z',
      });

    expect(previewResponse.status).toBe(200);

    const cancelResponse = await request(app)
      .post(
        `/api/v1/admin/adjustments/${previewResponse.body.data.batch.id}/cancel`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(cancelResponse.status).toBe(404);
  });
});
