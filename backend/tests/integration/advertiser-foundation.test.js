import request from 'supertest';
import { createApp } from '../../src/app.js';
import { findUserByEmail, findUserById } from '../../src/models/userModel.js';
import { createTestAdvertiserUser } from '../helpers/factories.js';

const app = createApp();

describe('Advertiser role foundation', () => {
  it('returns advertiser linkage for findUser helpers', async () => {
    const { user, advertiser } = await createTestAdvertiserUser();

    const byEmail = await findUserByEmail(user.email);
    expect(byEmail).not.toBeNull();
    expect(byEmail?.advertiserId).toBe(advertiser.id);

    const byId = await findUserById(user.id);
    expect(byId).not.toBeNull();
    expect(byId?.advertiserId).toBe(advertiser.id);
  });

  it('authenticates advertiser users and returns advertiserId in payload', async () => {
    const { user, advertiser, password } = await createTestAdvertiserUser();

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.role).toBe('advertiser');
    expect(loginResponse.body.data.user.advertiserId).toBe(advertiser.id);
    expect(loginResponse.body.data.user.affiliateId).toBeNull();

    const token = loginResponse.body.data.token;
    expect(typeof token).toBe('string');

    const profileResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user.id).toBe(user.id);
    expect(profileResponse.body.data.user.advertiserId).toBe(advertiser.id);
  });
});
