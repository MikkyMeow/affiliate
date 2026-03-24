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
import { createPostbackLog } from '../../src/models/postback-logs.model.js';
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

async function seedPostbackLog({
  offerId,
  affiliateId,
  status = 'processed',
  createdAt,
  clickId = randomUUID(),
}) {
  const log = await createPostbackLog({
    requestId: randomUUID(),
    clickId,
    offerId,
    affiliateId,
    status,
    payloadJson: { body: { status } },
  });

  if (createdAt) {
    await pool.query(
      `
        UPDATE postback_logs
        SET created_at = $2
        WHERE id = $1
      `,
      [log.id, createdAt],
    );
  }

  return { ...log, createdAt: createdAt ?? log.createdAt };
}

describe('Advertiser postback logs API', () => {
  it('lists advertiser postbacks with filters and hides foreign data', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const otherAdvertiser = await createTestAdvertiser();
    const affiliate = await createTestAffiliate();

    const offerA = await createTestOffer({ advertiserId: advertiser.id, title: 'Alpha' });
    const offerB = await createTestOffer({ advertiserId: advertiser.id, title: 'Beta' });
    const foreignOffer = await createTestOffer({
      advertiserId: otherAdvertiser.id,
      title: 'Foreign',
    });

    const processedLog = await seedPostbackLog({
      offerId: offerA.id,
      affiliateId: affiliate.id,
      status: 'processed',
      createdAt: '2026-03-10T10:00:00Z',
      clickId: 'click-alpha',
    });
    await createConversion({
      clickId: processedLog.clickId,
      offerId: offerA.id,
      affiliateId: affiliate.id,
      status: 'approved',
      payoutRub: 5000,
      revenueAmount: 8000,
    });

    await seedPostbackLog({
      offerId: offerB.id,
      affiliateId: affiliate.id,
      status: 'rejected',
      createdAt: '2026-03-15T15:00:00Z',
      clickId: 'click-beta',
    });

    await seedPostbackLog({
      offerId: foreignOffer.id,
      affiliateId: affiliate.id,
      status: 'processed',
      createdAt: '2026-03-16T10:00:00Z',
      clickId: 'click-foreign',
    });

    const response = await request(app)
      .get('/api/v1/advertiser/postbacks')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination.total).toBe(2);
    const ids = response.body.data.items.map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([processedLog.id]));
    const processedView = response.body.data.items.find((item) => item.id === processedLog.id);
    expect(processedView).toMatchObject({
      id: processedLog.id,
      offerId: offerA.id,
      clickId: 'click-alpha',
      status: 'processed',
      conversionId: expect.any(String),
    });
    expect(processedView).not.toHaveProperty('payloadJson');
    expect(processedView.responseStatusCode).toBeNull();
    expect(processedView.sentAt).toBe(processedView.createdAt);

    const filtered = await request(app)
      .get('/api/v1/advertiser/postbacks')
      .query({
        status: 'processed',
        offerId: offerA.id,
        dateFrom: '2026-03-10',
        dateTo: '2026-03-10',
      })
      .set('Authorization', `Bearer ${token}`);

    expect(filtered.status).toBe(200);
    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0].offerId).toBe(offerA.id);
  });

  it('returns 404 when requesting foreign postback log and validates offer filters', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const otherAdvertiser = await createTestAdvertiser();
    const affiliate = await createTestAffiliate();

    const ownOffer = await createTestOffer({ advertiserId: advertiser.id, title: 'Own' });
    const foreignOffer = await createTestOffer({
      advertiserId: otherAdvertiser.id,
      title: 'Foreign',
    });

    const ownLog = await seedPostbackLog({
      offerId: ownOffer.id,
      affiliateId: affiliate.id,
      status: 'processed',
    });

    const foreignLog = await seedPostbackLog({
      offerId: foreignOffer.id,
      affiliateId: affiliate.id,
      status: 'processed',
    });

    const ownResponse = await request(app)
      .get(`/api/v1/advertiser/postbacks/${ownLog.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(ownResponse.status).toBe(200);
    expect(ownResponse.body.data.postback.id).toBe(ownLog.id);

    const forbiddenResponse = await request(app)
      .get(`/api/v1/advertiser/postbacks/${foreignLog.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(forbiddenResponse.status).toBe(404);

    const filterResponse = await request(app)
      .get(`/api/v1/advertiser/postbacks?offerId=${foreignOffer.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(filterResponse.status).toBe(404);
  });

  it('enforces advertiser role and validates query params', async () => {
    const { user, password } = await createTestAffiliateUser();
    const affiliateLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    const affiliateToken = affiliateLogin.body.data.token;

    const forbidden = await request(app)
      .get('/api/v1/advertiser/postbacks')
      .set('Authorization', `Bearer ${affiliateToken}`);
    expect(forbidden.status).toBe(403);

    const { token } = await authenticateAdvertiser();
    const invalid = await request(app)
      .get('/api/v1/advertiser/postbacks?page=0&pageSize=999')
      .set('Authorization', `Bearer ${token}`);
    expect(invalid.status).toBe(400);
  });
});
