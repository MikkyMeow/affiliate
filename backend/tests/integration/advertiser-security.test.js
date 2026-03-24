import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestAdvertiserUser } from '../helpers/factories.js';

const app = createApp();

async function authenticateAdvertiser() {
  const { user, password } = await createTestAdvertiserUser();
  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password });

  return loginResponse.body.data.token;
}

describe('Advertiser cross-role security', () => {
  it('blocks advertiser tokens from admin stats endpoints', async () => {
    const token = await authenticateAdvertiser();
    const response = await request(app)
      .get('/api/v1/admin/stats/totals')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('blocks advertiser tokens from admin offer decision routes', async () => {
    const token = await authenticateAdvertiser();
    const response = await request(app)
      .post('/api/v1/admin/offer-requests/00000000-0000-0000-0000-000000000000/decision')
      .set('Authorization', `Bearer ${token}`)
      .send({ decision: 'approved' });

    expect(response.status).toBe(403);
  });
});
