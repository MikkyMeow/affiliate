import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { findUserByEmail } from '../../src/models/userModel.js';
import { findAffiliateByEmail } from '../../src/models/affiliateModel.js';
import { findAdvertiserByUserId } from '../../src/models/advertiserModel.js';

const app = createApp();

function buildPayload(overrides = {}) {
  return {
    email: `user-${crypto.randomUUID()}@example.com`,
    password: 'StrongPass123',
    name: 'Test User',
    accountType: 'affiliate',
    ...overrides,
  };
}

describe('POST /auth/register', () => {
  it('creates affiliate accounts with linked entities', async () => {
    const payload = buildPayload({ accountType: 'affiliate' });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.data.token).toBe('string');
    expect(response.body.data.user.role).toBe('affiliate');
    expect(response.body.data.user.affiliateId).toEqual(expect.any(String));
    expect(response.body.data.user.advertiserId).toBeNull();

    const savedUser = await findUserByEmail(payload.email);
    expect(savedUser).not.toBeNull();
    expect(savedUser?.affiliateId).toBe(response.body.data.user.affiliateId);

    const affiliate = await findAffiliateByEmail(payload.email);
    expect(affiliate).not.toBeNull();
    expect(affiliate?.userId).toBe(savedUser?.id);
    expect(affiliate?.email.toLowerCase()).toBe(payload.email.toLowerCase());
  });

  it('creates advertiser accounts and links the advertiser entity', async () => {
    const payload = buildPayload({
      accountType: 'advertiser',
      name: 'Acme Ads',
    });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe('advertiser');
    expect(response.body.data.user.advertiserId).toEqual(expect.any(String));
    expect(response.body.data.user.affiliateId).toBeNull();

    const savedUser = await findUserByEmail(payload.email);
    expect(savedUser).not.toBeNull();
    expect(savedUser?.advertiserId).toBe(response.body.data.user.advertiserId);

    const advertiser = await findAdvertiserByUserId(savedUser?.id ?? '');
    expect(advertiser).not.toBeNull();
    expect(advertiser?.id).toBe(response.body.data.user.advertiserId);
    expect(advertiser?.userId).toBe(savedUser?.id);
  });

  it('rejects attempts to register with unsupported accountType', async () => {
    const payload = buildPayload({ accountType: 'admin' });

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate email regardless of accountType', async () => {
    const payload = buildPayload({ accountType: 'affiliate' });

    const firstResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(payload);

    expect(firstResponse.status).toBe(201);

    const duplicateResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...payload, accountType: 'advertiser' });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.success).toBe(false);
    expect(duplicateResponse.body.error.code).toBe('CONFLICT');
  });
});
