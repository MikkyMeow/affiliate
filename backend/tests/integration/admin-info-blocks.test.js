import bcrypt from 'bcryptjs';
import request from 'supertest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import { updateAffiliate } from '../../src/models/affiliateModel.js';
import { updateAdvertiser } from '../../src/models/advertiserModel.js';
import { findUserByEmail } from '../../src/models/userModel.js';
import {
  createTestAdminUser,
  createTestAdvertiserUser,
  createTestAffiliateUser,
} from '../helpers/factories.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

describe('Stage 5 admin information blocks', () => {
  it('returns affiliate admin detail with email, telegram, internal note, and public info', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { affiliate } = await createTestAffiliateUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    await updateAffiliate(affiliate.id, {
      telegram: '@partner-one',
      internalNote: 'Private network note',
    });

    const response = await request(app)
      .get(`/api/v1/affiliates/${affiliate.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.affiliate).toMatchObject({
      id: affiliate.id,
      email: affiliate.email,
      telegram: '@partner-one',
      internalNote: 'Private network note',
      questionnaireAnswers: [],
    });
    expect(response.body.data.affiliate.publicId).toEqual(expect.any(String));
  });

  it('does not expose affiliate internal note in partner self-service profile', async () => {
    const { user, password, affiliate } = await createTestAffiliateUser();

    await updateAffiliate(affiliate.id, {
      telegram: '@self-telegram',
      internalNote: 'Only for admins',
    });

    const token = await loginAndGetToken(user.email, password);
    const response = await request(app)
      .get('/api/v1/partner/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.affiliate.telegram).toBe('@self-telegram');
    expect(response.body.data.affiliate).not.toHaveProperty('internalNote');
  });

  it('allows admin and manager to update affiliate internal note, but blocks affiliates, and writes audit log', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } = await createTestAdminUser({
      role: 'manager',
      email: 'manager.stage5@example.com',
    });
    const { user: affiliateUser, password: affiliatePassword, affiliate } =
      await createTestAffiliateUser();

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
    const affiliateToken = await loginAndGetToken(affiliateUser.email, affiliatePassword);

    const adminResponse = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/internal-note`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ internalNote: 'Admin note' });

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.affiliate.internalNote).toBe('Admin note');

    const managerResponse = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/internal-note`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ internalNote: 'Manager note' });

    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body.data.affiliate.internalNote).toBe('Manager note');

    const forbiddenResponse = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/internal-note`)
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({ internalNote: 'Partner note' });

    expect(forbiddenResponse.status).toBe(403);

    const auditRows = await pool.query(
      `
        SELECT actor_role AS "actorRole", context_json AS context
        FROM audit_events
        WHERE entity_type = 'affiliate'
          AND entity_id = $1
          AND action = 'internal_note_updated'
        ORDER BY created_at ASC
      `,
      [affiliate.id],
    );

    expect(auditRows.rowCount).toBe(2);
    expect(auditRows.rows[0].actorRole).toBe('admin');
    expect(auditRows.rows[0].context.newValues.internalNote).toBe('Admin note');
    expect(auditRows.rows[1].actorRole).toBe('manager');
    expect(auditRows.rows[1].context.oldValues.internalNote).toBe('Admin note');
    expect(auditRows.rows[1].context.newValues.internalNote).toBe('Manager note');
  });

  it('allows partner to update own telegram through the shared profile endpoint', async () => {
    const { user, password } = await createTestAffiliateUser();
    const token = await loginAndGetToken(user.email, password);

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ telegram: '@updated_partner' });

    expect(response.status).toBe(200);
    expect(response.body.data.profile).toMatchObject({
      email: user.email,
      telegram: '@updated_partner',
    });
    expect(response.body.data.context.profile.telegram).toBe('@updated_partner');
    expect(response.body.data.context.profile).not.toHaveProperty('internalNote');
  });

  it('returns advertiser admin detail with email, telegram, internal note, and questionnaire placeholder', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { advertiser } = await createTestAdvertiserUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    await updateAdvertiser(advertiser.id, {
      telegram: '@advertiser-one',
      internalNote: 'Advertiser private note',
    });

    const response = await request(app)
      .get(`/api/v1/advertisers/${advertiser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.advertiser).toMatchObject({
      id: advertiser.id,
      email: expect.stringContaining('@'),
      telegram: '@advertiser-one',
      internalNote: 'Advertiser private note',
      questionnaireAnswers: [],
    });
    expect(response.body.data.advertiser.publicId).toEqual(expect.any(String));
  });

  it('does not expose advertiser internal note in advertiser self-service profile', async () => {
    const { user, password, advertiser } = await createTestAdvertiserUser();

    await updateAdvertiser(advertiser.id, {
      telegram: '@adv-self',
      internalNote: 'Admin only note',
    });

    const token = await loginAndGetToken(user.email, password);
    const response = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.telegram).toBe('@adv-self');
    expect(response.body.data).not.toHaveProperty('internalNote');
  });

  it('allows admin and manager to update advertiser internal note, blocks advertiser, and writes audit log', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } = await createTestAdminUser({
      role: 'manager',
      email: 'manager.advertiser.stage5@example.com',
    });
    const { user: advertiserUser, password: advertiserPassword, advertiser } =
      await createTestAdvertiserUser();

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
    const advertiserToken = await loginAndGetToken(advertiserUser.email, advertiserPassword);

    const adminResponse = await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/internal-note`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ internalNote: 'Admin advertiser note' });

    expect(adminResponse.status).toBe(200);

    const managerResponse = await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/internal-note`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ internalNote: 'Manager advertiser note' });

    expect(managerResponse.status).toBe(200);

    const forbiddenResponse = await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/internal-note`)
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({ internalNote: 'Advertiser note' });

    expect(forbiddenResponse.status).toBe(403);

    const auditRows = await pool.query(
      `
        SELECT actor_role AS "actorRole", context_json AS context
        FROM audit_events
        WHERE entity_type = 'advertiser'
          AND entity_id = $1
          AND action = 'internal_note_updated'
        ORDER BY created_at ASC
      `,
      [advertiser.id],
    );

    expect(auditRows.rowCount).toBe(2);
    expect(auditRows.rows[1].context.newValues.internalNote).toBe(
      'Manager advertiser note',
    );
  });

  it('allows advertiser to update own telegram through the shared profile endpoint', async () => {
    const { user, password } = await createTestAdvertiserUser();
    const token = await loginAndGetToken(user.email, password);

    const response = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ telegram: 'adv_telegram' });

    expect(response.status).toBe(200);
    expect(response.body.data.profile).toMatchObject({
      email: user.email,
      telegram: 'adv_telegram',
    });
    expect(response.body.data.context.profile.telegram).toBe('adv_telegram');
  });

  it('allows admin to create advertiser with a generated temporary password, stores only a hash, allows login, and avoids plaintext audit leakage', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const response = await request(app)
      .post('/api/v1/advertisers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Created Advertiser',
        email: 'admin.created.advertiser@example.com',
        status: 'active',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.advertiser).toMatchObject({
      name: 'Admin Created Advertiser',
      email: 'admin.created.advertiser@example.com',
    });
    expect(response.body.data.temporaryPassword).toEqual(expect.any(String));

    const temporaryPassword = response.body.data.temporaryPassword;
    const storedUser = await findUserByEmail('admin.created.advertiser@example.com');

    expect(storedUser?.passwordHash).not.toBe(temporaryPassword);
    expect(await bcrypt.compare(temporaryPassword, storedUser.passwordHash)).toBe(true);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin.created.advertiser@example.com',
        password: temporaryPassword,
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.role).toBe('advertiser');

    const auditRows = await pool.query(
      `
        SELECT action, context_json::text AS context
        FROM audit_events
        WHERE entity_type = 'advertiser'
          AND entity_id = $1
        ORDER BY created_at ASC
      `,
      [response.body.data.advertiser.id],
    );

    expect(auditRows.rows.map((row) => row.action)).toEqual([
      'created_by_admin',
      'temporary_password_generated',
    ]);
    auditRows.rows.forEach((row) => {
      expect(row.context).not.toContain(temporaryPassword);
    });
  });

  it('allows admin to reset advertiser password once and writes an audit event without plaintext leakage', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/advertisers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Resettable Advertiser',
        email: 'resettable.advertiser@example.com',
        status: 'active',
      });

    const advertiserId = createResponse.body.data.advertiser.id;
    const firstPassword = createResponse.body.data.temporaryPassword;

    const resetResponse = await request(app)
      .post(`/api/v1/advertisers/${advertiserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.data.temporaryPassword).toEqual(expect.any(String));
    expect(resetResponse.body.data.temporaryPassword).not.toBe(firstPassword);

    const oldLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'resettable.advertiser@example.com',
        password: firstPassword,
      });
    expect(oldLoginResponse.status).toBe(401);

    const newLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'resettable.advertiser@example.com',
        password: resetResponse.body.data.temporaryPassword,
      });
    expect(newLoginResponse.status).toBe(200);

    const auditRows = await pool.query(
      `
        SELECT action, actor_user_id AS "actorUserId", context_json::text AS context
        FROM audit_events
        WHERE entity_id = $1
          AND entity_type = 'advertiser'
          AND action = 'password_reset'
      `,
      [advertiserId],
    );

    expect(auditRows.rowCount).toBe(1);
    expect(auditRows.rows[0].action).toBe('password_reset');
    expect(auditRows.rows[0].actorUserId).toBe(adminUser.id);
    expect(auditRows.rows[0].context).not.toContain(
      resetResponse.body.data.temporaryPassword,
    );
  });
});
