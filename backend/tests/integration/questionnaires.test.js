import request from 'supertest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
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

async function putQuestionnaire(token, targetRole, payload) {
  return request(app)
    .put(`/api/v1/admin/questionnaires/${targetRole}`)
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
}

function buildAffiliateQuestionnaire(overrides = {}) {
  return {
    title: 'Partner questionnaire',
    description: 'Tell us about your traffic',
    isActive: true,
    fields: [
      {
        id: 'traffic_source',
        name: 'traffic_source',
        question: 'What traffic sources do you use?',
        type: 'text',
        required: true,
        order: 1,
        options: [],
      },
      {
        id: 'has_own_traffic',
        name: 'has_own_traffic',
        question: 'Do you have your own traffic?',
        type: 'checkbox',
        required: false,
        order: 2,
        options: [],
      },
    ],
    ...overrides,
  };
}

function buildAdvertiserQuestionnaire(overrides = {}) {
  return {
    title: 'Advertiser questionnaire',
    description: 'Tell us about your brand',
    isActive: true,
    fields: [
      {
        id: 'brand_vertical',
        name: 'brand_vertical',
        question: 'What is your vertical?',
        type: 'select',
        required: true,
        order: 1,
        options: [
          { value: 'finance', label: 'Finance' },
          { value: 'gambling', label: 'Gambling' },
        ],
      },
      {
        id: 'allowed_geos',
        name: 'allowed_geos',
        question: 'Target geos',
        type: 'multiselect',
        required: true,
        order: 2,
        options: [
          { value: 'ru', label: 'RU' },
          { value: 'kz', label: 'KZ' },
        ],
      },
      {
        id: 'approval_flow',
        name: 'approval_flow',
        question: 'Do you need approval?',
        type: 'radio',
        required: true,
        order: 3,
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
    ...overrides,
  };
}

describe('Stage 6 registration questionnaires', () => {
  it('creates the questionnaire tables and enforces unique answer rows per user and target role', async () => {
    const tableResult = await pool.query(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
            'registration_questionnaires',
            'registration_questionnaire_answers'
          )
        ORDER BY tablename ASC
      `,
    );

    expect(tableResult.rows.map((row) => row.tablename)).toEqual([
      'registration_questionnaire_answers',
      'registration_questionnaires',
    ]);

    const { user } = await createTestAffiliateUser();

    await pool.query(
      `
        INSERT INTO registration_questionnaire_answers (
          user_id,
          target_role,
          answers,
          submitted_at
        )
        VALUES ($1, 'affiliate', '{}'::jsonb, NOW())
      `,
      [user.id],
    );

    await expect(
      pool.query(
        `
          INSERT INTO registration_questionnaire_answers (
            user_id,
            target_role,
            answers,
            submitted_at
          )
          VALUES ($1, 'affiliate', '{}'::jsonb, NOW())
        `,
        [user.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows admin to create and update an affiliate questionnaire and writes audit logs', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await putQuestionnaire(
      adminToken,
      'affiliate',
      buildAffiliateQuestionnaire(),
    );

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data.questionnaire).toMatchObject({
      targetRole: 'affiliate',
      title: 'Partner questionnaire',
      isActive: true,
    });

    const updateResponse = await putQuestionnaire(
      adminToken,
      'affiliate',
      buildAffiliateQuestionnaire({
        title: 'Partner questionnaire v2',
        fields: [
          {
            id: 'traffic_source',
            name: 'traffic_source',
            question: 'Main traffic source',
            type: 'textarea',
            required: true,
            order: 1,
            options: [],
          },
        ],
      }),
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.questionnaire).toMatchObject({
      targetRole: 'affiliate',
      title: 'Partner questionnaire v2',
    });
    expect(updateResponse.body.data.questionnaire.fields[0]).toMatchObject({
      id: 'traffic_source',
      type: 'textarea',
    });

    const auditRows = await pool.query(
      `
        SELECT action, context_json AS context
        FROM audit_events
        WHERE entity_type = 'registration_questionnaire'
          AND entity_id = $1
        ORDER BY created_at ASC
      `,
      [updateResponse.body.data.questionnaire.id],
    );

    expect(auditRows.rows.map((row) => row.action)).toEqual([
      'questionnaire.created',
      'questionnaire.updated',
    ]);
    expect(auditRows.rows[1].context.oldValues.title).toBe('Partner questionnaire');
    expect(auditRows.rows[1].context.newValues.title).toBe('Partner questionnaire v2');
  });

  it('allows admin to create and list an advertiser questionnaire', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await putQuestionnaire(
      adminToken,
      'advertiser',
      buildAdvertiserQuestionnaire(),
    );

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data.questionnaire.targetRole).toBe('advertiser');

    const listResponse = await request(app)
      .get('/api/v1/admin/questionnaires?targetRole=advertiser')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toHaveLength(1);
    expect(listResponse.body.data.items[0].targetRole).toBe('advertiser');
  });

  it('prevents managers from creating or updating questionnaires', async () => {
    const { user: managerUser, password: managerPassword } = await createTestAdminUser({
      role: 'manager',
      email: 'manager.questionnaire@example.com',
    });
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);

    const createResponse = await putQuestionnaire(
      managerToken,
      'affiliate',
      buildAffiliateQuestionnaire(),
    );

    expect(createResponse.status).toBe(403);

    const updateResponse = await putQuestionnaire(
      managerToken,
      'advertiser',
      buildAdvertiserQuestionnaire({
        title: 'Blocked questionnaire',
      }),
    );

    expect(updateResponse.status).toBe(403);
  });

  it('prevents non-admin users from creating or updating questionnaires', async () => {
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );

    const response = await putQuestionnaire(
      affiliateToken,
      'affiliate',
      buildAffiliateQuestionnaire(),
    );

    expect(response.status).toBe(403);
  });

  it('rejects unsupported field types, duplicate field ids or names, and invalid option definitions', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const invalidTypeResponse = await putQuestionnaire(adminToken, 'affiliate', {
      ...buildAffiliateQuestionnaire(),
      fields: [
        {
          id: 'upload',
          name: 'upload',
          question: 'Upload a file',
          type: 'file',
          required: true,
          order: 1,
          options: [],
        },
      ],
    });

    expect(invalidTypeResponse.status).toBe(400);

    const duplicateFieldsResponse = await putQuestionnaire(adminToken, 'affiliate', {
      ...buildAffiliateQuestionnaire(),
      fields: [
        {
          id: 'dup',
          name: 'dup',
          question: 'One',
          type: 'text',
          required: true,
          order: 1,
          options: [],
        },
        {
          id: 'dup',
          name: 'dup',
          question: 'Two',
          type: 'text',
          required: false,
          order: 2,
          options: [],
        },
      ],
    });

    expect(duplicateFieldsResponse.status).toBe(400);

    const invalidOptionsResponse = await putQuestionnaire(adminToken, 'advertiser', {
      ...buildAdvertiserQuestionnaire(),
      fields: [
        {
          id: 'vertical',
          name: 'vertical',
          question: 'Vertical',
          type: 'select',
          required: true,
          order: 1,
          options: [
            { value: 'finance', label: 'Finance' },
            { value: 'finance', label: 'Finance again' },
          ],
        },
      ],
    });

    expect(invalidOptionsResponse.status).toBe(400);
  });

  it('allows affiliate and advertiser users to fetch their own questionnaires', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();

    await putQuestionnaire(adminToken, 'affiliate', buildAffiliateQuestionnaire());
    await putQuestionnaire(adminToken, 'advertiser', buildAdvertiserQuestionnaire());

    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );
    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    const affiliateResponse = await request(app)
      .get('/api/v1/me/questionnaire')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const advertiserResponse = await request(app)
      .get('/api/v1/me/questionnaire')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(affiliateResponse.status).toBe(200);
    expect(affiliateResponse.body.data.questionnaire.targetRole).toBe('affiliate');
    expect(advertiserResponse.status).toBe(200);
    expect(advertiserResponse.body.data.questionnaire.targetRole).toBe('advertiser');
  });

  it('allows affiliate and advertiser users to submit valid answers and stores them as JSON', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();

    await putQuestionnaire(adminToken, 'affiliate', buildAffiliateQuestionnaire());
    await putQuestionnaire(adminToken, 'advertiser', buildAdvertiserQuestionnaire());

    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );
    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    const affiliateResponse = await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        answers: {
          traffic_source: 'Telegram ads',
          has_own_traffic: true,
        },
      });

    const advertiserResponse = await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({
        answers: {
          brand_vertical: 'finance',
          allowed_geos: ['ru', 'kz'],
          approval_flow: 'no',
        },
      });

    expect(affiliateResponse.status).toBe(200);
    expect(affiliateResponse.body.data.isCompleted).toBe(true);
    expect(advertiserResponse.status).toBe(200);
    expect(advertiserResponse.body.data.answers.allowed_geos).toEqual(['ru', 'kz']);

    const storedAnswers = await pool.query(
      `
        SELECT target_role AS "targetRole", answers
        FROM registration_questionnaire_answers
        WHERE user_id IN ($1, $2)
        ORDER BY target_role ASC
      `,
      [advertiserUser.id, affiliateUser.id],
    );

    expect(storedAnswers.rows).toEqual([
      {
        targetRole: 'advertiser',
        answers: {
          brand_vertical: 'finance',
          allowed_geos: ['ru', 'kz'],
          approval_flow: 'no',
        },
      },
      {
        targetRole: 'affiliate',
        answers: {
          traffic_source: 'Telegram ads',
          has_own_traffic: true,
        },
      },
    ]);
  });

  it('validates required fields and option values when users submit answers', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();

    await putQuestionnaire(adminToken, 'advertiser', buildAdvertiserQuestionnaire());

    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    const requiredResponse = await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({
        answers: {
          brand_vertical: '',
          allowed_geos: [],
          approval_flow: null,
        },
      });

    expect(requiredResponse.status).toBe(422);
    expect(requiredResponse.body.error.details.fields).toMatchObject({
      brand_vertical: 'Обязательное поле',
      allowed_geos: 'Обязательное поле',
      approval_flow: 'Обязательное поле',
    });

    const optionsResponse = await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({
        answers: {
          brand_vertical: 'invalid',
          allowed_geos: ['ru', 'invalid'],
          approval_flow: 'maybe',
        },
      });

    expect(optionsResponse.status).toBe(422);
    expect(optionsResponse.body.error.details.fields).toMatchObject({
      brand_vertical: 'Выбрано недопустимое значение',
      allowed_geos: 'Выбраны недопустимые значения',
      approval_flow: 'Выбрано недопустимое значение',
    });
  });

  it('allows users to update previously submitted answers and writes audit log entries', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();

    await putQuestionnaire(adminToken, 'affiliate', buildAffiliateQuestionnaire());
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );

    const createResponse = await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        answers: {
          traffic_source: 'SEO',
        },
      });

    expect(createResponse.status).toBe(200);

    const updateResponse = await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        answers: {
          traffic_source: 'Push traffic',
          has_own_traffic: false,
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.answers).toMatchObject({
      traffic_source: 'Push traffic',
      has_own_traffic: false,
    });

    const auditRows = await pool.query(
      `
        SELECT action, actor_role AS "actorRole", context_json AS context
        FROM audit_events
        WHERE entity_type = 'questionnaire_answers'
          AND actor_user_id = $1
        ORDER BY created_at ASC
      `,
      [affiliateUser.id],
    );

    expect(auditRows.rows.map((row) => row.action)).toEqual([
      'questionnaire.answers_submitted',
      'questionnaire.answers_updated',
    ]);
    expect(auditRows.rows[1].actorRole).toBe('affiliate');
    expect(auditRows.rows[1].context.oldValues.answers.traffic_source).toBe('SEO');
    expect(auditRows.rows[1].context.newValues.answers.traffic_source).toBe(
      'Push traffic',
    );
  });

  it('blocks incomplete new affiliate and advertiser users from main platform routes, but not completed users', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();

    await putQuestionnaire(adminToken, 'affiliate', buildAffiliateQuestionnaire());
    await putQuestionnaire(adminToken, 'advertiser', buildAdvertiserQuestionnaire());

    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );
    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    const blockedAffiliate = await request(app)
      .get('/api/v1/partner/offers')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const blockedAdvertiser = await request(app)
      .get('/api/v1/advertiser/offers')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(blockedAffiliate.status).toBe(403);
    expect(blockedAffiliate.body.error.code).toBe('QUESTIONNAIRE_REQUIRED');
    expect(blockedAdvertiser.status).toBe(403);
    expect(blockedAdvertiser.body.error.code).toBe('QUESTIONNAIRE_REQUIRED');

    await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        answers: {
          traffic_source: 'Native ads',
        },
      });
    await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({
        answers: {
          brand_vertical: 'finance',
          allowed_geos: ['ru'],
          approval_flow: 'yes',
        },
      });

    const allowedAffiliate = await request(app)
      .get('/api/v1/partner/offers')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const allowedAdvertiser = await request(app)
      .get('/api/v1/advertiser/offers')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(allowedAffiliate.status).toBe(200);
    expect(allowedAdvertiser.status).toBe(200);
  });

  it('does not force previously submitted users to refill newly added required fields automatically', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();

    await putQuestionnaire(adminToken, 'affiliate', buildAffiliateQuestionnaire());
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );

    await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        answers: {
          traffic_source: 'Telegram',
        },
      });

    await putQuestionnaire(
      adminToken,
      'affiliate',
      buildAffiliateQuestionnaire({
        fields: [
          ...buildAffiliateQuestionnaire().fields,
          {
            id: 'main_geo',
            name: 'main_geo',
            question: 'Main geo',
            type: 'text',
            required: true,
            order: 3,
            options: [],
          },
        ],
      }),
    );

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const offersResponse = await request(app)
      .get('/api/v1/partner/offers')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const questionnaireResponse = await request(app)
      .get('/api/v1/me/questionnaire')
      .set('Authorization', `Bearer ${affiliateToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.questionnaire).toEqual({
      required: true,
      completed: true,
    });
    expect(offersResponse.status).toBe(200);
    expect(questionnaireResponse.body.data.isCompleted).toBe(true);

    const editSubmitResponse = await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        answers: {
          traffic_source: 'Telegram',
        },
      });

    expect(editSubmitResponse.status).toBe(422);
    expect(editSubmitResponse.body.error.details.fields.main_geo).toBe(
      'Обязательное поле',
    );
  });

  it('includes questionnaire answers in admin detail responses and keeps self-service responses free from internal notes', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const {
      user: affiliateUser,
      password: affiliatePassword,
      affiliate,
    } = await createTestAffiliateUser();
    const {
      user: advertiserUser,
      password: advertiserPassword,
      advertiser,
    } = await createTestAdvertiserUser();

    await putQuestionnaire(adminToken, 'affiliate', buildAffiliateQuestionnaire());
    await putQuestionnaire(adminToken, 'advertiser', buildAdvertiserQuestionnaire());

    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );
    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    await request(app)
      .patch(`/api/v1/affiliates/${affiliate.id}/internal-note`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ internalNote: 'admin only partner note' });
    await request(app)
      .patch(`/api/v1/advertisers/${advertiser.id}/internal-note`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ internalNote: 'admin only advertiser note' });

    await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        answers: {
          traffic_source: 'SEO',
        },
      });
    await request(app)
      .put('/api/v1/me/questionnaire/answers')
      .set('Authorization', `Bearer ${advertiserToken}`)
      .send({
        answers: {
          brand_vertical: 'finance',
          allowed_geos: ['ru'],
          approval_flow: 'no',
        },
      });

    await putQuestionnaire(
      adminToken,
      'affiliate',
      buildAffiliateQuestionnaire({
        fields: [
          {
            id: 'new_field',
            name: 'new_field',
            question: 'Replacement',
            type: 'text',
            required: false,
            order: 1,
            options: [],
          },
        ],
      }),
    );

    const affiliateDetailResponse = await request(app)
      .get(`/api/v1/affiliates/${affiliate.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const advertiserDetailResponse = await request(app)
      .get(`/api/v1/advertisers/${advertiser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const affiliateProfileResponse = await request(app)
      .get('/api/v1/partner/profile')
      .set('Authorization', `Bearer ${affiliateToken}`);
    const advertiserProfileResponse = await request(app)
      .get('/api/v1/advertiser/profile')
      .set('Authorization', `Bearer ${advertiserToken}`);

    expect(affiliateDetailResponse.status).toBe(200);
    expect(affiliateDetailResponse.body.data.affiliate.questionnaireAnswers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: 'Saved answer: traffic_source',
          answer: 'SEO',
          isFallback: true,
        }),
      ]),
    );
    expect(advertiserDetailResponse.status).toBe(200);
    expect(advertiserDetailResponse.body.data.advertiser.questionnaireAnswers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          question: 'What is your vertical?',
          answer: 'Finance',
          isFallback: false,
        }),
      ]),
    );

    expect(affiliateProfileResponse.status).toBe(200);
    expect(affiliateProfileResponse.body.data.affiliate).not.toHaveProperty(
      'internalNote',
    );
    expect(advertiserProfileResponse.status).toBe(200);
    expect(advertiserProfileResponse.body.data).not.toHaveProperty('internalNote');
  });
});
