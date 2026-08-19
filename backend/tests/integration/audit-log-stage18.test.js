import request from 'supertest';
import { describe, expect, it } from 'vitest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import { writeAuditEvent } from '../../src/services/audit.service.js';
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

describe('stage 18 audit log expansion', () => {
  it('adds normalized audit columns and indexes without breaking old rows', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const columns = await pool.query(
      `
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_events'
          AND column_name IN (
            'old_value',
            'new_value',
            'metadata_json',
            'error_code',
            'error_message'
          )
        ORDER BY column_name ASC
      `,
    );

    expect(columns.rows.map((row) => row.columnName)).toEqual([
      'error_code',
      'error_message',
      'metadata_json',
      'new_value',
      'old_value',
    ]);

    const indexes = await pool.query(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (
            'audit_events_entity_idx',
            'audit_events_created_at_idx',
            'audit_events_actor_idx',
            'audit_events_action_idx',
            'audit_events_error_code_idx'
          )
        ORDER BY indexname ASC
      `,
    );

    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      'audit_events_action_idx',
      'audit_events_actor_idx',
      'audit_events_created_at_idx',
      'audit_events_entity_idx',
      'audit_events_error_code_idx',
    ]);

    await pool.query(
      `
        INSERT INTO audit_events (
          entity_type,
          entity_id,
          action,
          actor_user_id,
          actor_role,
          context_json,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz)
      `,
      [
        'legacy_entity',
        'legacy-1',
        'legacy.action',
        adminUser.id,
        'admin',
        JSON.stringify({
          oldValues: { status: 'before' },
          newValues: { status: 'after' },
          metadata: { source: 'legacy-context' },
        }),
        '2026-05-17T10:00:00.000Z',
      ],
    );

    const response = await request(app)
      .get('/api/v1/admin/audit-logs/entity/legacy_entity/legacy-1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0]).toMatchObject({
      action: 'legacy.action',
      entityType: 'legacy_entity',
      entityId: 'legacy-1',
      oldValue: {
        status: 'before',
      },
      newValue: {
        status: 'after',
      },
      metadata: {
        source: 'legacy-context',
      },
      actor: {
        id: adminUser.id,
        role: 'admin',
      },
    });
  });

  it('allows admin and manager to read audit logs, blocks affiliate and advertiser, and keeps the API read-only', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser({
      displayName: 'Audit Admin',
    });
    const { user: managerUser, password: managerPassword } =
      await createTestAdminUser({
        role: 'manager',
        displayName: 'Audit Manager',
      });
    const { user: affiliateUser, password: affiliatePassword } =
      await createTestAffiliateUser();
    const { user: advertiserUser, password: advertiserPassword } =
      await createTestAdvertiserUser();

    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);
    const managerToken = await loginAndGetToken(managerUser.email, managerPassword);
    const affiliateToken = await loginAndGetToken(
      affiliateUser.email,
      affiliatePassword,
    );
    const advertiserToken = await loginAndGetToken(
      advertiserUser.email,
      advertiserPassword,
    );

    await writeAuditEvent({
      entityType: 'offer',
      entityId: 'entity-access-test',
      action: 'offer.updated',
      actorUserId: adminUser.id,
      actorRole: 'admin',
      metadata: {
        source: 'access-test',
      },
    });

    const adminResponse = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.items.length).toBeGreaterThan(0);

    const managerResponse = await request(app)
      .get('/api/v1/admin/audit-logs/entity/offer/entity-access-test')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body.data.items[0].actor).toMatchObject({
      id: adminUser.id,
      name: 'Audit Admin',
      email: adminUser.email,
      role: 'admin',
    });

    const affiliateResponse = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${affiliateToken}`);
    expect(affiliateResponse.status).toBe(403);

    const advertiserResponse = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${advertiserToken}`);
    expect(advertiserResponse.status).toBe(403);

    const writeAttempt = await request(app)
      .post('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'forbidden',
      });
    expect(writeAttempt.status).toBe(404);
  });

  it('filters and paginates audit logs by entity, action, actor, date range, and errors', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const { user: managerUser } = await createTestAdminUser({
      role: 'manager',
      displayName: 'Filter Manager',
    });
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    await pool.query(
      `
        INSERT INTO audit_events (
          entity_type,
          entity_id,
          action,
          actor_user_id,
          actor_role,
          old_value,
          new_value,
          metadata_json,
          error_code,
          error_message,
          context_json,
          created_at
        )
        VALUES
          (
            'offer',
            'entity-filter-1',
            'offer.availability_changed',
            $1,
            'admin',
            '{"availability":"public"}'::jsonb,
            '{"availability":"private"}'::jsonb,
            '{"scope":"one"}'::jsonb,
            NULL,
            NULL,
            '{}'::jsonb,
            '2026-05-10T10:00:00.000Z'::timestamptz
          ),
          (
            'offer',
            'entity-filter-1',
            'offer.access_grant_failed',
            $2,
            'manager',
            NULL,
            NULL,
            '{"scope":"one"}'::jsonb,
            'ACCESS_FAILED',
            'Operation failed',
            '{}'::jsonb,
            '2026-05-11T10:00:00.000Z'::timestamptz
          ),
          (
            'conversion',
            'entity-filter-2',
            'conversion.status_changed',
            $1,
            'admin',
            '{"status":"pending"}'::jsonb,
            '{"status":"approved"}'::jsonb,
            '{"scope":"two"}'::jsonb,
            NULL,
            NULL,
            '{}'::jsonb,
            '2026-05-12T10:00:00.000Z'::timestamptz
          )
      `,
      [adminUser.id, managerUser.id],
    );

    const entityResponse = await request(app)
      .get('/api/v1/admin/audit-logs/entity/offer/entity-filter-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(entityResponse.status).toBe(200);
    expect(entityResponse.body.data.items).toHaveLength(2);

    const pagedResponse = await request(app)
      .get('/api/v1/admin/audit-logs?entityType=offer&entityId=entity-filter-1&limit=1&page=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pagedResponse.status).toBe(200);
    expect(pagedResponse.body.data).toMatchObject({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(pagedResponse.body.data.items).toHaveLength(1);

    const actionResponse = await request(app)
      .get('/api/v1/admin/audit-logs?action=offer.availability_changed')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(actionResponse.status).toBe(200);
    expect(
      actionResponse.body.data.items.every(
        (item) => item.action === 'offer.availability_changed',
      ),
    ).toBe(true);

    const actorResponse = await request(app)
      .get(`/api/v1/admin/audit-logs?actorId=${managerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(actorResponse.status).toBe(200);
    expect(actorResponse.body.data.items).toHaveLength(1);
    expect(actorResponse.body.data.items[0].actor.id).toBe(managerUser.id);

    const dateResponse = await request(app)
      .get('/api/v1/admin/audit-logs?dateFrom=2026-05-11&dateTo=2026-05-11')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(dateResponse.status).toBe(200);
    expect(dateResponse.body.data.items).toHaveLength(1);
    expect(dateResponse.body.data.items[0].action).toBe('offer.access_grant_failed');

    const errorOnlyResponse = await request(app)
      .get('/api/v1/admin/audit-logs?errorOnly=true')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(errorOnlyResponse.status).toBe(200);
    expect(errorOnlyResponse.body.data.items).toHaveLength(1);
    expect(errorOnlyResponse.body.data.items[0]).toMatchObject({
      action: 'offer.access_grant_failed',
      errorCode: 'ACCESS_FAILED',
    });
  });

  it('redacts secrets and raw CSV content in audit payloads', async () => {
    await writeAuditEvent({
      entityType: 'sanitizer',
      entityId: 'secret-test',
      action: 'sanitizer.checked',
      metadata: {
        password: 'plain-password',
        temporaryPassword: 'temp-password',
        token: 'super-secret-token',
        accessToken: 'jwt-access-token',
        csvText: 'email,password\nuser@example.com,secret',
      },
      oldValue: {
        authorization: 'Bearer secret',
      },
      newValue: {
        secret: 'hidden-secret',
        nested: {
          postbackToken: 'postback-secret',
        },
      },
    });

    const auditRow = await pool.query(
      `
        SELECT
          old_value AS "oldValue",
          new_value AS "newValue",
          metadata_json AS metadata,
          context_json AS context
        FROM audit_events
        WHERE entity_type = 'sanitizer'
          AND entity_id = 'secret-test'
        LIMIT 1
      `,
    );

    expect(auditRow.rowCount).toBe(1);
    expect(auditRow.rows[0].oldValue).toEqual({
      authorization: '[REDACTED]',
    });
    expect(auditRow.rows[0].newValue).toEqual({
      secret: '[REDACTED]',
      nested: {
        postbackToken: '[REDACTED]',
      },
    });
    expect(auditRow.rows[0].metadata).toEqual({
      password: '[REDACTED]',
      temporaryPassword: '[REDACTED]',
      token: '[REDACTED]',
      accessToken: '[REDACTED]',
      csvText: '[REDACTED]',
    });
    expect(JSON.stringify(auditRow.rows[0].context)).not.toContain('plain-password');
    expect(JSON.stringify(auditRow.rows[0].context)).not.toContain('super-secret-token');
    expect(JSON.stringify(auditRow.rows[0].context)).not.toContain(
      'email,password',
    );
  });
});
