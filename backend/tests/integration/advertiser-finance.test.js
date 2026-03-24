import { randomUUID } from 'node:crypto';
import request from 'supertest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import {
  createTestAdvertiser,
  createTestAdvertiserUser,
  createTestAffiliate,
  createTestAffiliateUser,
  createTestOffer,
} from '../helpers/factories.js';
import { createConversion } from '../../src/models/conversions.model.js';

const app = createApp();

async function authenticateAdvertiser() {
  const { user, advertiser, password } = await createTestAdvertiserUser();
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password });

  const token = response.body.data.token;
  return { token, advertiser };
}

async function seedConversion({
  offerId,
  affiliateId,
  status,
  payoutRub,
  revenueAmount,
  createdAt,
}) {
  const clickId = randomUUID();
  await createConversion({
    clickId,
    offerId,
    affiliateId,
    status,
    payoutRub,
    revenueAmount,
  });

  if (createdAt) {
    await pool.query(
      `
        UPDATE conversions
        SET created_at = $2
        WHERE click_id = $1
      `,
      [clickId, createdAt],
    );
  }
}

describe('Advertiser finance API', () => {
  it('returns summary scoped to advertiser and supports offer/date filters', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const otherAdvertiser = await createTestAdvertiser();
    const affiliate = await createTestAffiliate();

    const offerA = await createTestOffer({ advertiserId: advertiser.id, title: 'Alpha' });
    const offerB = await createTestOffer({ advertiserId: advertiser.id, title: 'Beta' });
    const foreignOffer = await createTestOffer({
      advertiserId: otherAdvertiser.id,
      title: 'Foreign',
    });

    await seedConversion({
      offerId: offerA.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 3000,
      revenueAmount: 5000,
      createdAt: '2026-04-01T09:00:00Z',
    });
    await seedConversion({
      offerId: offerA.id,
      affiliateId: affiliate.id,
      status: 'pending',
      payoutRub: 2000,
      revenueAmount: 4000,
      createdAt: '2026-04-02T09:00:00Z',
    });
    await seedConversion({
      offerId: offerB.id,
      affiliateId: affiliate.id,
      status: 'rejected',
      payoutRub: 1500,
      revenueAmount: 3500,
      createdAt: '2026-04-03T09:00:00Z',
    });
    await seedConversion({
      offerId: foreignOffer.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 9999,
      revenueAmount: 19999,
      createdAt: '2026-04-03T09:00:00Z',
    });

    const summaryResponse = await request(app)
      .get('/api/v1/advertiser/finance/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data).toMatchObject({
      approvedRevenue: 5000,
      approvedPayout: 3000,
      pendingRevenue: 4000,
      pendingPayout: 2000,
      rejectedRevenue: 3500,
      rejectedPayout: 1500,
      conversionsApproved: 1,
      conversionsPending: 1,
      conversionsRejected: 1,
    });

    const offerFiltered = await request(app)
      .get(`/api/v1/advertiser/finance/summary?offerId=${offerA.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(offerFiltered.status).toBe(200);
    expect(offerFiltered.body.data.conversionsApproved).toBe(1);
    expect(offerFiltered.body.data.conversionsRejected).toBe(0);

    const dated = await request(app)
      .get(
        '/api/v1/advertiser/finance/summary?dateFrom=2026-04-01&dateTo=2026-04-02',
      )
      .set('Authorization', `Bearer ${token}`);
    expect(dated.status).toBe(200);
    expect(dated.body.data.conversionsRejected).toBe(0);

    const invalidOffer = await request(app)
      .get(`/api/v1/advertiser/finance/summary?offerId=${foreignOffer.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(invalidOffer.status).toBe(404);
  });

  it('returns offer and status breakdowns with titles and enforces role', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const affiliate = await createTestAffiliate();
    const offerA = await createTestOffer({ advertiserId: advertiser.id, title: 'Alpha' });
    const offerB = await createTestOffer({ advertiserId: advertiser.id, title: 'Beta' });

    await seedConversion({
      offerId: offerA.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 7000,
      revenueAmount: 9000,
    });
    await seedConversion({
      offerId: offerB.id,
      affiliateId: affiliate.id,
      status: 'rejected',
      payoutRub: 1000,
      revenueAmount: 1500,
    });

    const breakdownResponse = await request(app)
      .get('/api/v1/advertiser/finance/breakdowns')
      .set('Authorization', `Bearer ${token}`);

    expect(breakdownResponse.status).toBe(200);
    const { offers, statuses } = breakdownResponse.body.data;
    expect(Array.isArray(offers)).toBe(true);
    expect(Array.isArray(statuses)).toBe(true);
    expect(offers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          offerId: offerA.id,
          title: offerA.title,
          approvedRevenue: 9000,
          approvedPayout: 7000,
          conversionsApproved: 1,
        }),
        expect.objectContaining({
          offerId: offerB.id,
          title: offerB.title,
        }),
      ]),
    );
    const approvedStatus = statuses.find((entry) => entry.status === 'approved');
    expect(approvedStatus).toMatchObject({
      status: 'approved',
      revenue: 9000,
      payout: 7000,
      count: 1,
    });

    const { user, password } = await createTestAffiliateUser();
    const affiliateLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    const affiliateToken = affiliateLogin.body.data.token;

    const forbidden = await request(app)
      .get('/api/v1/advertiser/finance/summary')
      .set('Authorization', `Bearer ${affiliateToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('returns zeros when advertiser has no conversions', async () => {
    const { token } = await authenticateAdvertiser();
    const response = await request(app)
      .get('/api/v1/advertiser/finance/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      approvedRevenue: 0,
      approvedPayout: 0,
      pendingRevenue: 0,
      pendingPayout: 0,
      rejectedRevenue: 0,
      rejectedPayout: 0,
      conversionsApproved: 0,
      conversionsPending: 0,
      conversionsRejected: 0,
    });
  });
});
