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
  createTestOfferGoal,
} from '../helpers/factories.js';
import { createClick } from '../../src/models/clicks.model.js';
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

async function seedClick({ offerId, affiliateId, createdAt }) {
  const clickId = randomUUID();
  await createClick({
    clickId,
    offerId,
    affiliateId,
    canonicalClickId: clickId,
    isDuplicate: false,
  });

  if (createdAt) {
    await pool.query(
      `
        UPDATE clicks
        SET created_at = $2
        WHERE click_id = $1
      `,
      [clickId, createdAt],
    );
  }

  return clickId;
}

async function seedConversion({
  clickId,
  offerId,
  affiliateId,
  status = 'pending',
  payoutRub = 0,
  revenueAmount = 0,
  goalId = null,
  goalName = null,
  goalType = null,
  createdAt,
}) {
  await createConversion({
    clickId,
    offerId,
    affiliateId,
    status,
    payoutRub,
    revenueAmount,
    goalId,
    goalName,
    goalType,
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

describe('Advertiser stats API', () => {
  it('returns summary scoped to advertiser and supports date filters', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const otherAdvertiser = await createTestAdvertiser();
    const affiliate = await createTestAffiliate();

    const offerA = await createTestOffer({ advertiserId: advertiser.id, title: 'Alpha' });
    const offerB = await createTestOffer({ advertiserId: advertiser.id, title: 'Beta' });
    const foreignOffer = await createTestOffer({ advertiserId: otherAdvertiser.id, title: 'Foreign' });

    const clickA = await seedClick({
      offerId: offerA.id,
      affiliateId: affiliate.id,
      createdAt: '2026-03-10T10:00:00Z',
    });
    const clickB = await seedClick({
      offerId: offerB.id,
      affiliateId: affiliate.id,
      createdAt: '2026-03-12T10:00:00Z',
    });
    const foreignClick = await seedClick({
      offerId: foreignOffer.id,
      affiliateId: affiliate.id,
      createdAt: '2026-03-10T10:00:00Z',
    });

    await seedConversion({
      clickId: clickA,
      offerId: offerA.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 5000,
      revenueAmount: 8000,
      createdAt: '2026-03-11T09:00:00Z',
    });
    await seedConversion({
      clickId: clickB,
      offerId: offerB.id,
      affiliateId: affiliate.id,
      status: 'pending',
      payoutRub: 3000,
      revenueAmount: 5000,
      createdAt: '2026-03-12T11:00:00Z',
    });

    await seedConversion({
      clickId: foreignClick,
      offerId: foreignOffer.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 9999,
      revenueAmount: 15000,
      createdAt: '2026-03-12T11:00:00Z',
    });

    const response = await request(app)
      .get('/api/v1/advertiser/stats/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.clicks).toBe(2);
    expect(response.body.data.conversionsTotal).toBe(2);
    expect(response.body.data.conversionsApproved).toBe(1);
    expect(response.body.data.conversionsPending).toBe(1);
    expect(response.body.data.approvedRevenue).toBe(8000);
    expect(response.body.data.pendingRevenue).toBe(5000);

    const filtered = await request(app)
      .get('/api/v1/advertiser/stats/summary')
      .query({ dateFrom: '2026-03-12', dateTo: '2026-03-12' })
      .set('Authorization', `Bearer ${token}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.data.clicks).toBe(1);
    expect(filtered.body.data.conversionsTotal).toBe(1);
    expect(filtered.body.data.conversionsPending).toBe(1);
  });

  it('returns offer and status breakdowns with titles', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const affiliate = await createTestAffiliate();
    const offerA = await createTestOffer({ advertiserId: advertiser.id, title: 'Solar' });
    const offerB = await createTestOffer({ advertiserId: advertiser.id, title: 'Lunar' });

    const clickA = await seedClick({ offerId: offerA.id, affiliateId: affiliate.id });
    const clickB = await seedClick({ offerId: offerB.id, affiliateId: affiliate.id });

    await seedConversion({
      clickId: clickA,
      offerId: offerA.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 1000,
      revenueAmount: 2000,
    });
    await seedConversion({
      clickId: clickB,
      offerId: offerB.id,
      affiliateId: affiliate.id,
      status: 'rejected',
      payoutRub: 2000,
      revenueAmount: 3000,
    });

    const response = await request(app)
      .get('/api/v1/advertiser/stats/breakdowns')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const offers = response.body.data.offers;
    const statuses = response.body.data.statuses;

    expect(Array.isArray(offers)).toBe(true);
    expect(Array.isArray(statuses)).toBe(true);
    const solarEntry = offers.find((entry) => entry.offerId === offerA.id);
    const lunarEntry = offers.find((entry) => entry.offerId === offerB.id);

    expect(solarEntry).toMatchObject({
      offerId: offerA.id,
      title: 'Solar',
      conversionsApproved: 1,
    });
    expect(lunarEntry).toMatchObject({
      offerId: offerB.id,
      title: 'Lunar',
      conversionsRejected: 1,
    });

    expect(statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'approved', conversionsTotal: 1 }),
        expect.objectContaining({ status: 'rejected', conversionsTotal: 1 }),
      ]),
    );
  });

  it('returns offer scoped stats only for owned offers', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const otherAdvertiser = await createTestAdvertiser();
    const affiliate = await createTestAffiliate();

    const ownOffer = await createTestOffer({ advertiserId: advertiser.id, title: 'Owned' });
    const foreignOffer = await createTestOffer({ advertiserId: otherAdvertiser.id, title: 'Foreign' });

    const clickId = await seedClick({ offerId: ownOffer.id, affiliateId: affiliate.id });
    const goal = await createTestOfferGoal(ownOffer.id, {
      name: 'Purchase',
      type: 'cpa',
      revenue: 6000,
      payout: 4000,
    });
    await seedConversion({
      clickId,
      offerId: ownOffer.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 4000,
      revenueAmount: 6000,
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
    });

    const response = await request(app)
      .get(`/api/v1/advertiser/stats/offers/${ownOffer.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.offer).toMatchObject({
      id: ownOffer.id,
      title: 'Owned',
    });
    expect(response.body.data.summary.conversionsApproved).toBe(1);
    expect(response.body.data.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: goal.id,
          conversionsApproved: 1,
        }),
      ]),
    );

    const foreignResponse = await request(app)
      .get(`/api/v1/advertiser/stats/offers/${foreignOffer.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(foreignResponse.status).toBe(404);
  });

  it('rejects affiliate tokens', async () => {
    const { user, password } = await createTestAffiliateUser();
    const authResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });

    const affiliateToken = authResponse.body.data.token;
    const response = await request(app)
      .get('/api/v1/advertiser/stats/summary')
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(response.status).toBe(403);
  });

  it('validates authentication and query params', async () => {
    const unauthResponse = await request(app).get('/api/v1/advertiser/stats/summary');
    expect(unauthResponse.status).toBe(401);

    const { token } = await authenticateAdvertiser();
    const invalidResponse = await request(app)
      .get('/api/v1/advertiser/stats/summary?dateFrom=2026-13-01')
      .set('Authorization', `Bearer ${token}`);

    expect(invalidResponse.status).toBe(400);
  });
});
