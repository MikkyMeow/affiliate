import request from 'supertest';
import { createApp } from '../../src/app.js';
import { findUserByEmail, findUserById } from '../../src/models/userModel.js';
import {
  createTestAdvertiserUser,
  createTestAffiliateUser,
  createTestAdminUser,
} from '../helpers/factories.js';

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

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.id).toBe(user.id);
    expect(meResponse.body.data.user.advertiserId).toBe(advertiser.id);
    expect(meResponse.body.data.profile).toEqual(
      expect.objectContaining({
        type: 'advertiser',
        id: advertiser.id,
        name: advertiser.name,
      }),
    );

    const advertiserProfileResponse = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(advertiserProfileResponse.status).toBe(200);
    expect(advertiserProfileResponse.body.data).toMatchObject({
      id: advertiser.id,
      name: advertiser.name,
      status: advertiser.status,
    });
  });

  it('exposes advertiser profile endpoint only to advertisers', async () => {
    const { user, advertiser, password } = await createTestAdvertiserUser();

    const advertiserTokenResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password });

    const advertiserToken = advertiserTokenResponse.body.data.token;

    const advertiserProfileResponse = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(advertiserProfileResponse.status).toBe(200);
    expect(advertiserProfileResponse.body.data.id).toBe(advertiser.id);

    const unauthenticatedResponse = await request(app).get(
      '/api/v1/advertiser/profile',
    );
    expect(unauthenticatedResponse.status).toBe(401);

    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();

    const affiliateTokenResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: affiliateUser.email, password: affiliatePassword });

    const affiliateToken = affiliateTokenResponse.body.data.token;

    const forbiddenResponse = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(forbiddenResponse.status).toBe(403);

    const { user: adminUser, password: adminPassword } =
      await createTestAdminUser();
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminUser.email, password: adminPassword });
    const adminToken = adminLogin.body.data.token;

    const adminResponse = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminResponse.status).toBe(403);
  });

  it('supports advertiser smoke flow from registration to profile', async () => {
    const flowEmail = `flow-${Date.now()}@example.com`;

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: flowEmail,
        password: 'P@ssw0rd-123',
        displayName: 'Flow Advertiser',
        accountType: 'advertiser',
      });

    expect(registerResponse.status).toBe(201);

    const token = registerResponse.body.data.token;
    const advertiserId = registerResponse.body.data.user.advertiserId;

    expect(token).toEqual(expect.any(String));
    expect(advertiserId).toEqual(expect.any(String));

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.advertiserId).toBe(advertiserId);
    expect(meResponse.body.data.profile).toMatchObject({
      type: 'advertiser',
      id: advertiserId,
    });

    const advertiserProfileResponse = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(advertiserProfileResponse.status).toBe(200);
    expect(advertiserProfileResponse.body.data.id).toBe(advertiserId);
  });
});
