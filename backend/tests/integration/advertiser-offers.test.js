import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  createTestAdvertiser,
  createTestAdvertiserUser,
  createTestAffiliateUser,
  createTestOffer,
} from '../helpers/factories.js';

const app = createApp();

async function authenticateAdvertiser() {
  const { user, advertiser, password } = await createTestAdvertiserUser();
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password });

  const token = response.body.data.token;
  return { token, advertiser };
}

describe('Advertiser offers read-only API', () => {
  it('lists only own offers with pagination metadata', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const otherAdvertiser = await createTestAdvertiser();

    await Promise.all([
      createTestOffer({
        advertiserId: advertiser.id,
        title: 'Alpha Detox',
        status: 'active',
      }),
      createTestOffer({
        advertiserId: advertiser.id,
        title: 'Beta Health',
        status: 'inactive',
      }),
      createTestOffer({
        advertiserId: advertiser.id,
        title: 'Gamma Energy',
        status: 'active',
      }),
      createTestOffer({
        advertiserId: otherAdvertiser.id,
        title: 'Foreign Offer',
      }),
    ]);

    const response = await request(app)
      .get('/api/v1/advertiser/offers?page=1&pageSize=2')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    for (const offer of response.body.data.items) {
      expect(offer).not.toHaveProperty('targetUrl');
      expect(offer).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        status: expect.any(String),
      });
    }
  });

  it('supports status and search filters', async () => {
    const { token, advertiser } = await authenticateAdvertiser();

    await Promise.all([
      createTestOffer({
        advertiserId: advertiser.id,
        title: 'Nutra Max',
        status: 'active',
      }),
      createTestOffer({
        advertiserId: advertiser.id,
        title: 'Nutra Sleep',
        status: 'inactive',
      }),
    ]);

    const response = await request(app)
      .get('/api/v1/advertiser/offers?status=inactive&search=Sleep')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].name).toContain('Sleep');
    expect(response.body.data.items[0].status).toBe('inactive');
    expect(response.body.data.pagination.total).toBe(1);
  });

  it('returns offer details for own offer and hides foreign ones', async () => {
    const { token, advertiser } = await authenticateAdvertiser();
    const otherAdvertiser = await createTestAdvertiser();

    const ownOffer = await createTestOffer({
      advertiserId: advertiser.id,
      title: 'Alpha Prime',
    });

    const foreignOffer = await createTestOffer({
      advertiserId: otherAdvertiser.id,
      title: 'Foreign Prime',
    });

    const ownResponse = await request(app)
      .get(`/api/v1/advertiser/offers/${ownOffer.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(ownResponse.status).toBe(200);
    expect(ownResponse.body.data.offer).toMatchObject({
      id: ownOffer.id,
      name: 'Alpha Prime',
    });
    expect(ownResponse.body.data.offer).not.toHaveProperty('targetUrl');

    const foreignResponse = await request(app)
      .get(`/api/v1/advertiser/offers/${foreignOffer.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(foreignResponse.status).toBe(404);
  });

  it('enforces advertiser role', async () => {
    const { user, password } = await createTestAffiliateUser();
    const affiliateLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });

    const affiliateToken = affiliateLogin.body.data.token;

    const response = await request(app)
      .get('/api/v1/advertiser/offers')
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(response.status).toBe(403);
  });

  it('requires authentication to list offers', async () => {
    const response = await request(app).get('/api/v1/advertiser/offers');
    expect(response.status).toBe(401);
  });

  it('prevents advertiser tokens from calling admin offer CRUD routes', async () => {
    const { user, password } = await createTestAdvertiserUser();
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    const token = loginResponse.body.data.token;

    const createAttempt = await request(app)
      .post('/api/v1/offers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Blocked',
        advertiserId: '00000000-0000-0000-0000-000000000000',
      });
    expect(createAttempt.status).toBe(403);

    const offer = await createTestOffer();
    const updateAttempt = await request(app)
      .patch(`/api/v1/offers/${offer.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'inactive' });
    expect(updateAttempt.status).toBe(403);
  });

  it('validates pagination input', async () => {
    const { token } = await authenticateAdvertiser();
    const response = await request(app)
      .get('/api/v1/advertiser/offers?page=0&pageSize=1000')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
  });
});
