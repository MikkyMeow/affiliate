import request from 'supertest';
import { createApp } from '../../src/app.js';
import pool from '../../src/db.js';
import {
  createTestAdminUser,
  createTestAffiliate,
  createTestAffiliateUser,
  createTestAdvertiser,
  createTestOffer,
  grantAffiliateAccess,
  hideAffiliateFromOffer,
} from '../helpers/factories.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

describe('Stage 7 offer visibility and access', () => {
  it('returns advertiser in admin and manager offer detail, but never for partner', async () => {
    const advertiser = await createTestAdvertiser({ name: 'Stage7 Advertiser' });
    const offer = await createTestOffer({
      advertiserId: advertiser.id,
      visibilityMode: 'public',
    });
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } =
      await createTestAdminUser({ role: 'manager' });
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );

    const createGoalResponse = await request(app)
      .post(`/api/v1/admin/offers/${offer.id}/goals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Lead',
        type: 'CPL',
        revenue: 1200,
        payout: 800,
        isDefault: true,
        limitEnabled: false,
        limitType: null,
        limitValue: null,
      });

    expect(createGoalResponse.status).toBe(201);

    const adminResponse = await request(app)
      .get(`/api/v1/offers/${offer.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const managerResponse = await request(app)
      .get(`/api/v1/offers/${offer.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    const partnerResponse = await request(app)
      .get(`/api/v1/partner/offers/${offer.id}`)
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(adminResponse.status).toBe(200);
    expect(managerResponse.status).toBe(200);
    expect(partnerResponse.status).toBe(200);

    expect(adminResponse.body.data.offer.advertiser).toMatchObject({
      id: advertiser.id,
      name: advertiser.name,
    });
    expect(adminResponse.body.data.offer.postbackToken).toBe(offer.postbackToken);
    expect(adminResponse.body.data.offer.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createGoalResponse.body.data.goal.id,
          name: 'Lead',
        }),
      ]),
    );
    expect(managerResponse.body.data.offer.advertiser).toMatchObject({
      id: advertiser.id,
      name: advertiser.name,
    });
    expect(managerResponse.body.data.offer.postbackToken).toBe(offer.postbackToken);
    expect(managerResponse.body.data.offer.goals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createGoalResponse.body.data.goal.id,
          name: 'Lead',
        }),
      ]),
    );
    expect(partnerResponse.body.data.offer).not.toHaveProperty('advertiser');
    expect(partnerResponse.body.data.offer).not.toHaveProperty('advertiserId');
    expect(partnerResponse.body.data.offer).not.toHaveProperty('postbackToken');
    expect(partnerResponse.body.data.offer.view).not.toHaveProperty('advertiserId');
  });

  it('allows admin and manager to update availability, blocks affiliate, and writes audit', async () => {
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } =
      await createTestAdminUser({ role: 'manager' });
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );

    const adminResponse = await request(app)
      .patch(`/api/v1/offers/${offer.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ availability: 'on_request' });
    const managerResponse = await request(app)
      .patch(`/api/v1/offers/${offer.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ availability: 'private' });
    const affiliateResponse = await request(app)
      .patch(`/api/v1/offers/${offer.id}`)
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({ availability: 'public' });

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.offer.availability).toBe('on_request');
    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body.data.offer.availability).toBe('private');
    expect(affiliateResponse.status).toBe(403);

    const auditRows = await pool.query(
      `
        SELECT action, actor_role AS "actorRole", context_json AS context
        FROM audit_events
        WHERE entity_type = 'offer'
          AND entity_id = $1
          AND action = 'availability_changed'
        ORDER BY created_at ASC
      `,
      [offer.id],
    );

    expect(auditRows.rows).toHaveLength(2);
    expect(auditRows.rows[0]).toMatchObject({
      action: 'availability_changed',
      actorRole: 'admin',
    });
    expect(auditRows.rows[0].context.oldValue).toBe('public');
    expect(auditRows.rows[0].context.newValue).toBe('on_request');
    expect(auditRows.rows[1]).toMatchObject({
      action: 'availability_changed',
      actorRole: 'manager',
    });
    expect(auditRows.rows[1].context.oldValue).toBe('on_request');
    expect(auditRows.rows[1].context.newValue).toBe('private');
  });

  it('shows public and on-request offers, limits on-request details, and keeps private offers hidden without access', async () => {
    const { user, affiliate, password } = await createTestAffiliateUser();
    const token = await loginAndGetToken(user.email, password);
    const publicOffer = await createTestOffer({ visibilityMode: 'public' });
    const onRequestOffer = await createTestOffer({
      visibilityMode: 'on_request',
    });
    const privateOffer = await createTestOffer({ visibilityMode: 'private' });

    const listResponse = await request(app)
      .get('/api/v1/partner/offers')
      .set('Authorization', `Bearer ${token}`);
    const onRequestDetailResponse = await request(app)
      .get(`/api/v1/partner/offers/${onRequestOffer.id}`)
      .set('Authorization', `Bearer ${token}`);
    const privateDetailResponse = await request(app)
      .get(`/api/v1/partner/offers/${privateOffer.id}`)
      .set('Authorization', `Bearer ${token}`);
    const trackingResponse = await request(app)
      .get('/track/click')
      .query({ offerId: onRequestOffer.id, affiliateId: affiliate.id });

    expect(listResponse.status).toBe(200);
    const listMap = new Map(listResponse.body.data.map((item) => [item.id, item]));
    expect(listMap.get(publicOffer.id).accessLevel).toBe('full');
    expect(listMap.get(onRequestOffer.id).accessLevel).toBe('restricted');
    expect(listMap.get(onRequestOffer.id).availability).toBe('on_request');
    expect(listMap.get(onRequestOffer.id)).not.toHaveProperty('advertiser');
    expect(listMap.get(onRequestOffer.id).view).toEqual({ type: 'restricted' });
    expect(listMap.has(privateOffer.id)).toBe(false);

    expect(onRequestDetailResponse.status).toBe(200);
    expect(onRequestDetailResponse.body.data.offer.accessLevel).toBe('restricted');
    expect(onRequestDetailResponse.body.data.offer).not.toHaveProperty('goals');
    expect(onRequestDetailResponse.body.data.offer).not.toHaveProperty('advertiser');
    expect(onRequestDetailResponse.body.data.offer.view).toEqual({ type: 'restricted' });

    expect(privateDetailResponse.status).toBe(404);
    expect(trackingResponse.status).toBe(403);
  });

  it('allows offer requests only for on-request offers', async () => {
    const { user, affiliate, password } = await createTestAffiliateUser();
    const token = await loginAndGetToken(user.email, password);
    const onRequestOffer = await createTestOffer({ visibilityMode: 'on_request' });
    const publicOffer = await createTestOffer({ visibilityMode: 'public' });
    const privateOffer = await createTestOffer({ visibilityMode: 'private' });

    const allowedResponse = await request(app)
      .post(`/api/v1/partner/offers/${onRequestOffer.id}/request`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'need access' });
    const duplicateResponse = await request(app)
      .post(`/api/v1/partner/offers/${onRequestOffer.id}/request`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'again' });
    const publicResponse = await request(app)
      .post(`/api/v1/partner/offers/${publicOffer.id}/request`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'should fail' });
    const privateResponse = await request(app)
      .post(`/api/v1/partner/offers/${privateOffer.id}/request`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'should fail' });

    expect(allowedResponse.status).toBe(201);
    expect(allowedResponse.body.data.request.status).toBe('pending');
    expect(duplicateResponse.status).toBe(409);
    expect(publicResponse.status).toBe(422);
    expect(privateResponse.status).toBe(403);
  });

  it('lets admin and manager grant private access and revoke it again', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser, password: managerPassword } =
      await createTestAdminUser({ role: 'manager' });
    const { user: affiliateUser, affiliate, password: affiliatePassword } =
      await createTestAffiliateUser();
    const privateOffer = await createTestOffer({ visibilityMode: 'private' });

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );

    const beforeGrantResponse = await request(app)
      .get(`/api/v1/partner/offers/${privateOffer.id}`)
      .set('Authorization', `Bearer ${affiliateToken}`);
    const adminGrantResponse = await request(app)
      .post(`/api/v1/admin/offers/${privateOffer.id}/access`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ affiliateId: affiliate.id });
    const detailAfterAdminGrant = await request(app)
      .get(`/api/v1/partner/offers/${privateOffer.id}`)
      .set('Authorization', `Bearer ${affiliateToken}`);
    const revokeResponse = await request(app)
      .delete(`/api/v1/admin/offers/${privateOffer.id}/access/${affiliate.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const managerGrantResponse = await request(app)
      .post(`/api/v1/admin/offers/${privateOffer.id}/access`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ affiliateId: affiliate.id });

    expect(beforeGrantResponse.status).toBe(404);
    expect(adminGrantResponse.status).toBe(200);
    expect(adminGrantResponse.body.data.access.status).toBe('allowed');
    expect(detailAfterAdminGrant.status).toBe(200);
    expect(detailAfterAdminGrant.body.data.offer.accessLevel).toBe('full');
    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.body.data.ok).toBe(true);
    expect(managerGrantResponse.status).toBe(200);
    expect(managerGrantResponse.body.data.access.status).toBe('allowed');

    const accessAuditRows = await pool.query(
      `
        SELECT action, actor_role AS "actorRole"
        FROM audit_events
        WHERE entity_type = 'offer_access'
          AND entity_id = $1
        ORDER BY created_at ASC
      `,
      [`${privateOffer.id}:${affiliate.id}`],
    );

    expect(accessAuditRows.rows.map((row) => row.action)).toEqual([
      'offer.access_granted',
      'offer.access_revoked',
      'offer.access_granted',
    ]);
    expect(accessAuditRows.rows[1].actorRole).toBe('admin');
    expect(accessAuditRows.rows[2].actorRole).toBe('manager');
  });

  it('applies hidden override over public and granted access, and audits hide/unhide', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: affiliateUser, affiliate, password: affiliatePassword } =
      await createTestAffiliateUser();
    const publicOffer = await createTestOffer({ visibilityMode: 'public' });
    const privateOffer = await createTestOffer({ visibilityMode: 'private' });
    await grantAffiliateAccess({
      offerId: privateOffer.id,
      affiliateId: affiliate.id,
      accessType: 'allowed',
    });

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );

    const hidePublicResponse = await request(app)
      .post(`/api/v1/admin/offers/${publicOffer.id}/hidden-affiliates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ affiliateId: affiliate.id });
    const hidePrivateResponse = await request(app)
      .post(`/api/v1/admin/offers/${privateOffer.id}/hidden-affiliates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ affiliateId: affiliate.id });
    const publicListResponse = await request(app)
      .get('/api/v1/partner/offers')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const privateDetailResponse = await request(app)
      .get(`/api/v1/partner/offers/${privateOffer.id}`)
      .set('Authorization', `Bearer ${affiliateToken}`);
    const hiddenTrackingResponse = await request(app)
      .get('/track/click')
      .query({ offerId: privateOffer.id, affiliateId: affiliate.id });
    const unhideResponse = await request(app)
      .delete(`/api/v1/admin/offers/${privateOffer.id}/hidden-affiliates/${affiliate.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const detailAfterUnhideResponse = await request(app)
      .get(`/api/v1/partner/offers/${privateOffer.id}`)
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(hidePublicResponse.status).toBe(200);
    expect(hidePrivateResponse.status).toBe(200);
    expect(
      publicListResponse.body.data.some((item) => item.id === publicOffer.id),
    ).toBe(false);
    expect(privateDetailResponse.status).toBe(404);
    expect(hiddenTrackingResponse.status).toBe(403);
    expect(unhideResponse.status).toBe(200);
    expect(detailAfterUnhideResponse.status).toBe(200);

    const hiddenAuditRows = await pool.query(
      `
        SELECT action
        FROM audit_events
        WHERE entity_type = 'offer'
          AND entity_id = $1
          AND action IN ('offer.partner_hidden', 'offer.partner_unhidden')
        ORDER BY created_at ASC
      `,
      [privateOffer.id],
    );

    expect(hiddenAuditRows.rows.map((row) => row.action)).toEqual([
      'offer.partner_hidden',
      'offer.partner_unhidden',
    ]);
  });

  it('exposes access and hidden partner lists for admins', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { affiliate } = await createTestAffiliateUser();
    const offer = await createTestOffer({ visibilityMode: 'private' });
    await grantAffiliateAccess({
      offerId: offer.id,
      affiliateId: affiliate.id,
      accessType: 'allowed',
    });
    await hideAffiliateFromOffer({
      offerId: offer.id,
      affiliateId: affiliate.id,
    });

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const accessResponse = await request(app)
      .get(`/api/v1/admin/offers/${offer.id}/access`)
      .set('Authorization', `Bearer ${adminToken}`);
    const hiddenResponse = await request(app)
      .get(`/api/v1/admin/offers/${offer.id}/hidden-affiliates`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(accessResponse.status).toBe(200);
    expect(accessResponse.body.data.items[0]).toMatchObject({
      affiliateId: affiliate.id,
      status: 'allowed',
      affiliate: {
        id: affiliate.id,
        publicId: affiliate.publicId,
        name: affiliate.name,
        email: affiliate.email,
      },
    });

    expect(hiddenResponse.status).toBe(200);
    expect(hiddenResponse.body.data.items[0]).toMatchObject({
      affiliateId: affiliate.id,
      affiliate: {
        id: affiliate.id,
        publicId: affiliate.publicId,
        name: affiliate.name,
        email: affiliate.email,
      },
    });
  });

  it('has the expected migration defaults and uniqueness constraints', async () => {
    const offer = await createTestOffer({ visibilityMode: 'public' });
    const affiliate = await createTestAffiliate();

    const columnResult = await pool.query(
      `
        SELECT column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'offers'
          AND column_name = 'visibility_mode'
      `,
    );
    expect(columnResult.rows[0].column_default).toContain("'public'");

    await pool.query(
      `
        INSERT INTO offer_affiliate_hidden (offer_id, affiliate_id)
        VALUES ($1, $2)
      `,
      [offer.id, affiliate.id],
    );

    await expect(
      pool.query(
        `
          INSERT INTO offer_affiliate_hidden (offer_id, affiliate_id)
          VALUES ($1, $2)
        `,
        [offer.id, affiliate.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    await pool.query(
      `
        INSERT INTO offer_affiliate_access (offer_id, affiliate_id, access_type, source)
        VALUES ($1, $2, 'allowed', 'manual')
      `,
      [offer.id, affiliate.id],
    );

    await expect(
      pool.query(
        `
          INSERT INTO offer_affiliate_access (offer_id, affiliate_id, access_type, source)
          VALUES ($1, $2, 'allowed', 'manual')
        `,
        [offer.id, affiliate.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
