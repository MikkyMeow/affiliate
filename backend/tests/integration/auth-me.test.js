import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  createTestAdminUser,
  createTestAffiliateUser,
} from '../helpers/factories.js';

const app = createApp();

describe('GET /api/v1/auth/me for legacy roles', () => {
  it('returns affiliate payload with linkage', async () => {
    const { user, password, affiliate } = await createTestAffiliateUser();
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    const token = loginResponse.body.data.token;

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.role).toBe('affiliate');
    expect(meResponse.body.data.user.affiliateId).toBe(affiliate.id);
    expect(meResponse.body.data.profile).toMatchObject({
      type: 'affiliate',
      id: affiliate.id,
    });
  });

  it('returns admin payload without advertiser fields', async () => {
    const { user, password } = await createTestAdminUser();
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });
    const token = loginResponse.body.data.token;

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.role).toBe('admin');
    expect(meResponse.body.data.user.advertiserId).toBeNull();
    expect(meResponse.body.data.user.affiliateId).toBeNull();
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });
});
