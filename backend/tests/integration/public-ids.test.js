import crypto from 'node:crypto';
import request from 'supertest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import { findAdvertiserByUserId } from '../../src/models/advertiserModel.js';
import {
  createTestAdminUser,
  createTestAdvertiser,
} from '../helpers/factories.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

async function registerAdvertiser(overrides = {}) {
  const email = overrides.email ?? `advertiser-${crypto.randomUUID()}@example.com`;
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: 'StrongPass123',
      name: overrides.name ?? 'Advertiser User',
      accountType: 'advertiser',
    });

  expect(response.status).toBe(201);

  const advertiser = await findAdvertiserByUserId(response.body.data.user.id);
  expect(advertiser).not.toBeNull();

  return {
    response,
    advertiser,
  };
}

describe('Public ordered IDs', () => {
  it('installs public ID columns, defaults, owned sequences, and unique indexes', async () => {
    const columnResult = await pool.query(
      `
        SELECT
          table_name AS "tableName",
          is_nullable AS "isNullable",
          column_default AS "columnDefault"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('affiliates', 'advertisers', 'offers')
          AND column_name = 'public_id_number'
        ORDER BY table_name ASC;
      `,
    );

    expect(columnResult.rows).toEqual([
      expect.objectContaining({
        tableName: 'advertisers',
        isNullable: 'NO',
      }),
      expect.objectContaining({
        tableName: 'affiliates',
        isNullable: 'NO',
      }),
      expect.objectContaining({
        tableName: 'offers',
        isNullable: 'NO',
      }),
    ]);

    columnResult.rows.forEach((row) => {
      expect(row.columnDefault).toContain('nextval');
    });

    const sequenceResult = await pool.query(
      `
        SELECT
          pg_get_serial_sequence('affiliates', 'public_id_number') AS affiliate_sequence,
          pg_get_serial_sequence('advertisers', 'public_id_number') AS advertiser_sequence,
          pg_get_serial_sequence('offers', 'public_id_number') AS offer_sequence;
      `,
    );

    expect(sequenceResult.rows[0]).toEqual({
      affiliate_sequence: 'public.affiliates_public_id_seq',
      advertiser_sequence: 'public.advertisers_public_id_seq',
      offer_sequence: 'public.offers_public_id_seq',
    });

    const indexResult = await pool.query(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'affiliates_public_id_number_idx',
            'advertisers_public_id_number_idx',
            'offers_public_id_number_idx'
          )
        ORDER BY indexname ASC;
      `,
    );

    expect(indexResult.rows.map((row) => row.indexname)).toEqual([
      'advertisers_public_id_number_idx',
      'affiliates_public_id_number_idx',
      'offers_public_id_number_idx',
    ]);
  });

  it('generates per-entity public IDs and exposes them in admin list/detail APIs', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const affiliateOneResponse = await request(app)
      .post('/api/v1/affiliates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Affiliate One',
        email: 'affiliate-one@example.com',
        status: 'active',
      });

    expect(affiliateOneResponse.status).toBe(201);
    expect(affiliateOneResponse.body.data.affiliate).toMatchObject({
      publicIdNumber: 1,
      publicId: '#P1',
      id: expect.any(String),
      email: 'affiliate-one@example.com',
    });

    const affiliateTwoResponse = await request(app)
      .post('/api/v1/affiliates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Affiliate Two',
        email: 'affiliate-two@example.com',
        status: 'inactive',
      });

    expect(affiliateTwoResponse.status).toBe(201);
    expect(affiliateTwoResponse.body.data.affiliate).toMatchObject({
      publicIdNumber: 2,
      publicId: '#P2',
      id: expect.any(String),
    });
    expect(affiliateTwoResponse.body.data.affiliate.id).not.toBe('#P2');

    const { advertiser: advertiserOne } = await registerAdvertiser({
      name: 'Advertiser One',
    });
    const { advertiser: advertiserTwo } = await registerAdvertiser({
      name: 'Advertiser Two',
    });

    expect(advertiserOne).toMatchObject({
      publicIdNumber: 1,
      publicId: '#A1',
      id: expect.any(String),
    });
    expect(advertiserTwo).toMatchObject({
      publicIdNumber: 2,
      publicId: '#A2',
      id: expect.any(String),
    });

    const offerOneResponse = await request(app)
      .post('/api/v1/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Offer One',
        advertiserId: advertiserOne.id,
        category: 'other',
        targetUrl: 'https://example.com/offer-one',
        payoutRub: 1000,
        status: 'active',
      });

    expect(offerOneResponse.status).toBe(201);
    expect(offerOneResponse.body.data.offer).toMatchObject({
      publicIdNumber: 1,
      publicId: '#O1',
      id: expect.any(String),
      advertiserId: advertiserOne.id,
    });

    const offerTwoResponse = await request(app)
      .post('/api/v1/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Offer Two',
        advertiserId: advertiserOne.id,
        category: 'other',
        targetUrl: 'https://example.com/offer-two',
        payoutRub: 1250,
        status: 'inactive',
      });

    expect(offerTwoResponse.status).toBe(201);
    expect(offerTwoResponse.body.data.offer).toMatchObject({
      publicIdNumber: 2,
      publicId: '#O2',
      id: expect.any(String),
    });

    const affiliatesListResponse = await request(app)
      .get('/api/v1/affiliates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(affiliatesListResponse.status).toBe(200);
    const affiliateFromList = affiliatesListResponse.body.data.find(
      (item) => item.id === affiliateOneResponse.body.data.affiliate.id,
    );
    expect(affiliateFromList).toMatchObject({
      id: affiliateOneResponse.body.data.affiliate.id,
      publicIdNumber: 1,
      publicId: '#P1',
    });

    const affiliateDetailResponse = await request(app)
      .get(`/api/v1/affiliates/${affiliateOneResponse.body.data.affiliate.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(affiliateDetailResponse.status).toBe(200);
    expect(affiliateDetailResponse.body.data.affiliate).toMatchObject({
      id: affiliateOneResponse.body.data.affiliate.id,
      publicIdNumber: 1,
      publicId: '#P1',
    });

    const advertisersListResponse = await request(app)
      .get('/api/v1/advertisers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(advertisersListResponse.status).toBe(200);
    const advertiserFromList = advertisersListResponse.body.data.find(
      (item) => item.id === advertiserOne.id,
    );
    expect(advertiserFromList).toMatchObject({
      id: advertiserOne.id,
      publicIdNumber: 1,
      publicId: '#A1',
    });

    const advertiserDetailResponse = await request(app)
      .get(`/api/v1/advertisers/${advertiserOne.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(advertiserDetailResponse.status).toBe(200);
    expect(advertiserDetailResponse.body.data.advertiser).toMatchObject({
      id: advertiserOne.id,
      publicIdNumber: 1,
      publicId: '#A1',
    });

    const offersListResponse = await request(app)
      .get('/api/v1/offers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(offersListResponse.status).toBe(200);
    const offerFromList = offersListResponse.body.data.find(
      (item) => item.id === offerOneResponse.body.data.offer.id,
    );
    expect(offerFromList).toMatchObject({
      id: offerOneResponse.body.data.offer.id,
      publicIdNumber: 1,
      publicId: '#O1',
    });

    const offerDetailResponse = await request(app)
      .get(`/api/v1/offers/${offerOneResponse.body.data.offer.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(offerDetailResponse.status).toBe(200);
    expect(offerDetailResponse.body.data.offer).toMatchObject({
      id: offerOneResponse.body.data.offer.id,
      publicIdNumber: 1,
      publicId: '#O1',
    });
  });

  it('keeps UUID-only offer detail and update routes unchanged', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const advertiser = await createTestAdvertiser();

    const offerCreateResponse = await request(app)
      .post('/api/v1/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Offer Route Guard',
        advertiserId: advertiser.id,
        category: 'other',
        targetUrl: 'https://example.com/offer-route-guard',
        payoutRub: 900,
        status: 'active',
      });

    expect(offerCreateResponse.status).toBe(201);
    const publicId = offerCreateResponse.body.data.offer.publicId;
    expect(publicId).toBe('#O1');

    const encodedPublicId = encodeURIComponent(publicId);

    const detailResponse = await request(app)
      .get(`/api/v1/offers/${encodedPublicId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(400);
    expect(detailResponse.body.error.code).toBe('VALIDATION_ERROR');

    const updateResponse = await request(app)
      .patch(`/api/v1/offers/${encodedPublicId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Should Not Work' });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.code).toBe('VALIDATION_ERROR');
  });
});
