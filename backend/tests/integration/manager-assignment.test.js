import request from 'supertest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import {
  createTestAdminUser,
  createTestAdvertiser,
  createTestAdvertiserUser,
  createTestAffiliate,
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

async function createManagerActor() {
  return createTestAdminUser({
    role: 'manager',
    displayName: 'Manager User',
  });
}

describe('responsible manager assignment', () => {
  it('allows admin to assign a manager to an affiliate and returns manager info in list/detail', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser } = await createManagerActor();
    const affiliate = await createTestAffiliate();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const assignResponse = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: managerUser.id });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.data.affiliate).toMatchObject({
      id: affiliate.id,
      managerUserId: managerUser.id,
      manager: {
        id: managerUser.id,
        displayName: managerUser.displayName,
        email: managerUser.email,
      },
    });

    const listResponse = await request(app)
      .get('/api/v1/affiliates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: affiliate.id,
          managerUserId: managerUser.id,
          manager: expect.objectContaining({
            id: managerUser.id,
            displayName: managerUser.displayName,
            email: managerUser.email,
          }),
        }),
      ]),
    );

    const detailResponse = await request(app)
      .get(`/api/v1/affiliates/${affiliate.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.affiliate).toMatchObject({
      id: affiliate.id,
      managerUserId: managerUser.id,
      manager: {
        id: managerUser.id,
        displayName: managerUser.displayName,
        email: managerUser.email,
      },
    });
  });

  it('allows manager to assign a manager to an affiliate', async () => {
    const { user: actorUser, password: actorPassword } = await createManagerActor();
    const { user: managerUser } = await createManagerActor();
    const affiliate = await createTestAffiliate();
    const managerToken = await loginAndGetToken(actorUser.email, actorPassword);

    const response = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerUserId: managerUser.id });

    expect(response.status).toBe(200);
    expect(response.body.data.affiliate.managerUserId).toBe(managerUser.id);
  });

  it('allows admin to assign a manager to an advertiser and returns manager info in list/detail', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser } = await createManagerActor();
    const advertiser = await createTestAdvertiser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const assignResponse = await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: managerUser.id });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.data.advertiser).toMatchObject({
      id: advertiser.id,
      managerUserId: managerUser.id,
      manager: {
        id: managerUser.id,
        displayName: managerUser.displayName,
        email: managerUser.email,
      },
    });

    const listResponse = await request(app)
      .get('/api/v1/advertisers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: advertiser.id,
          managerUserId: managerUser.id,
          manager: expect.objectContaining({
            id: managerUser.id,
            displayName: managerUser.displayName,
            email: managerUser.email,
          }),
        }),
      ]),
    );

    const detailResponse = await request(app)
      .get(`/api/v1/advertisers/${advertiser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.advertiser).toMatchObject({
      id: advertiser.id,
      managerUserId: managerUser.id,
      manager: {
        id: managerUser.id,
        displayName: managerUser.displayName,
        email: managerUser.email,
      },
    });
  });

  it('allows manager to assign a manager to an advertiser', async () => {
    const { user: actorUser, password: actorPassword } = await createManagerActor();
    const { user: managerUser } = await createManagerActor();
    const advertiser = await createTestAdvertiser();
    const managerToken = await loginAndGetToken(actorUser.email, actorPassword);

    const response = await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/manager`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ managerUserId: managerUser.id });

    expect(response.status).toBe(200);
    expect(response.body.data.advertiser.managerUserId).toBe(managerUser.id);
  });

  it('prevents non-admin and non-manager users from assigning managers', async () => {
    const { user: affiliateUser, password: affiliatePassword } = await createTestAffiliateUser();
    const { user: managerUser } = await createManagerActor();
    const affiliate = await createTestAffiliate();
    const advertiser = await createTestAdvertiser();
    const token = await loginAndGetToken(affiliateUser.email, affiliatePassword);

    const affiliateResponse = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${token}`)
      .send({ managerUserId: managerUser.id });

    const advertiserResponse = await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/manager`)
      .set('Authorization', `Bearer ${token}`)
      .send({ managerUserId: managerUser.id });

    expect(affiliateResponse.status).toBe(403);
    expect(advertiserResponse.status).toBe(403);
  });

  it('rejects non-manager users and missing users as responsible managers', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: affiliateUser } = await createTestAffiliateUser();
    const affiliate = await createTestAffiliate();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const invalidRoleResponse = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: affiliateUser.id });

    expect(invalidRoleResponse.status).toBe(422);

    const missingResponse = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: '4b969af7-d736-4bde-9711-bd198bbb9a98' });

    expect(missingResponse.status).toBe(404);
  });

  it('allows unassigning manager with null', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser } = await createManagerActor();
    const affiliate = await createTestAffiliate();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: managerUser.id });

    const response = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: null });

    expect(response.status).toBe(200);
    expect(response.body.data.affiliate.managerUserId).toBeNull();
    expect(response.body.data.affiliate.manager).toBeNull();
  });

  it('returns assigned manager in partner-facing profile and auth context', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser } = await createManagerActor();
    const { user: affiliateUser, password: affiliatePassword, affiliate } =
      await createTestAffiliateUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const affiliateToken = await loginAndGetToken(affiliateUser.email, affiliatePassword);

    await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: managerUser.id });

    const partnerProfileResponse = await request(app)
      .get('/api/v1/partner/profile')
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(partnerProfileResponse.status).toBe(200);
    expect(partnerProfileResponse.body.data.affiliate.manager).toEqual({
      name: managerUser.displayName,
      email: managerUser.email,
    });

    const authMeResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(authMeResponse.status).toBe(200);
    expect(authMeResponse.body.data.profile.manager).toEqual({
      name: managerUser.displayName,
      email: managerUser.email,
    });
  });

  it('writes audit log entries for affiliate and advertiser assignment changes', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser } = await createManagerActor();
    const affiliate = await createTestAffiliate();
    const advertiser = await createTestAdvertiser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: managerUser.id });

    await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: managerUser.id });

    const auditResult = await pool.query(
      `
        SELECT entity_type AS "entityType", action, actor_user_id AS "actorUserId", actor_role AS "actorRole", context_json AS context
        FROM audit_events
        WHERE action IN ('affiliate.manager_changed', 'advertiser.manager_changed')
        ORDER BY entity_type ASC
      `,
    );

    expect(auditResult.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'advertiser',
          action: 'advertiser.manager_changed',
          actorUserId: adminUser.id,
          actorRole: 'admin',
          context: expect.objectContaining({
            oldValues: expect.objectContaining({ managerUserId: null }),
            newValues: expect.objectContaining({ managerUserId: managerUser.id }),
          }),
        }),
        expect.objectContaining({
          entityType: 'affiliate',
          action: 'affiliate.manager_changed',
          actorUserId: adminUser.id,
          actorRole: 'admin',
          context: expect.objectContaining({
            oldValues: expect.objectContaining({ managerUserId: null }),
            newValues: expect.objectContaining({ managerUserId: managerUser.id }),
          }),
        }),
      ]),
    );
  });

  it('keeps manager visibility unrestricted by assignment and supports manager filters', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: viewerUser, password: viewerPassword } = await createManagerActor();
    const { user: assignedManagerUser } = await createManagerActor();
    const affiliateOne = await createTestAffiliate({ name: 'Affiliate One' });
    const affiliateTwo = await createTestAffiliate({ name: 'Affiliate Two' });
    const advertiserOne = await createTestAdvertiser({ name: 'Advertiser One' });
    const advertiserTwo = await createTestAdvertiser({ name: 'Advertiser Two' });
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const viewerToken = await loginAndGetToken(viewerUser.email, viewerPassword);

    await request(app)
      .patch(`/api/v1/affiliates/${affiliateOne.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: assignedManagerUser.id });

    await request(app)
      .patch(`/api/v1/advertisers/${advertiserOne.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: assignedManagerUser.id });

    const visibleAffiliates = await request(app)
      .get('/api/v1/affiliates')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(visibleAffiliates.status).toBe(200);
    expect(visibleAffiliates.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: affiliateOne.id }),
        expect.objectContaining({ id: affiliateTwo.id }),
      ]),
    );

    const filteredAffiliates = await request(app)
      .get(`/api/v1/affiliates?managerUserId=${assignedManagerUser.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(filteredAffiliates.status).toBe(200);
    expect(filteredAffiliates.body.data).toHaveLength(1);
    expect(filteredAffiliates.body.data[0].id).toBe(affiliateOne.id);

    const visibleAdvertisers = await request(app)
      .get('/api/v1/advertisers')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(visibleAdvertisers.status).toBe(200);
    expect(visibleAdvertisers.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: advertiserOne.id }),
        expect.objectContaining({ id: advertiserTwo.id }),
      ]),
    );

    const filteredAdvertisers = await request(app)
      .get(`/api/v1/advertisers?managerUserId=${assignedManagerUser.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(filteredAdvertisers.status).toBe(200);
    expect(filteredAdvertisers.body.data).toHaveLength(1);
    expect(filteredAdvertisers.body.data[0].id).toBe(advertiserOne.id);
  });

  it('allows admin and manager to use manager lookup without exposing management actions', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } = await createManagerActor();
    const { user: secondManagerUser } = await createManagerActor();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);

    const adminLookup = await request(app)
      .get('/api/v1/admin/managers/lookup')
      .set('Authorization', `Bearer ${adminToken}`);

    const managerLookup = await request(app)
      .get('/api/v1/admin/managers/lookup')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(adminLookup.status).toBe(200);
    expect(managerLookup.status).toBe(200);
    expect(managerLookup.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: secondManagerUser.id,
          displayName: secondManagerUser.displayName,
          email: secondManagerUser.email,
        }),
      ]),
    );
  });

  it('returns assigned manager in advertiser-facing profile when present', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser } = await createManagerActor();
    const { user: advertiserUser, password: advertiserPassword, advertiser } =
      await createTestAdvertiserUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerUserId: managerUser.id });

    const profileResponse = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.manager).toEqual({
      name: managerUser.displayName,
      email: managerUser.email,
    });
  });

  it('validates manager assignment payload shape', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const affiliate = await createTestAffiliate();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const response = await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/manager`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(response.status).toBe(400);
  });
});
