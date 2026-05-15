import bcrypt from 'bcryptjs';
import request from 'supertest';
import pool from '../../src/db.js';
import { createApp } from '../../src/app.js';
import {
  createTestAdminUser,
  createTestAffiliateUser,
} from '../helpers/factories.js';
import { findUserByEmail } from '../../src/models/userModel.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

describe('manager role and manager administration', () => {
  it('allows admin to create a manager, returns a temporary password once, and stores only a hash', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.one@example.com',
        displayName: 'Manager One',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.manager).toMatchObject({
      email: 'manager.one@example.com',
      displayName: 'Manager One',
      role: 'manager',
    });
    expect(createResponse.body.data.temporaryPassword).toEqual(expect.any(String));

    const storedUser = await findUserByEmail('manager.one@example.com');

    expect(storedUser?.passwordHash).not.toBe(createResponse.body.data.temporaryPassword);
    expect(await bcrypt.compare(
      createResponse.body.data.temporaryPassword,
      storedUser.passwordHash,
    )).toBe(true);

    const auditResponse = await pool.query(
      `
        SELECT action, entity_type AS "entityType", actor_user_id AS "actorUserId", actor_role AS "actorRole", context_json AS context
        FROM audit_events
        WHERE entity_id = $1
          AND entity_type = 'manager'
          AND action = 'created'
      `,
      [createResponse.body.data.manager.id],
    );

    expect(auditResponse.rowCount).toBe(1);
    expect(auditResponse.rows[0]).toMatchObject({
      action: 'created',
      entityType: 'manager',
      actorUserId: adminUser.id,
      actorRole: 'admin',
    });
    expect(auditResponse.rows[0].context).toMatchObject({
      newValues: {
        email: 'manager.one@example.com',
        displayName: 'Manager One',
        role: 'manager',
      },
      metadata: {
        generatedPasswordShown: true,
      },
    });
  });

  it('allows a manager to log in with the temporary password and use operational admin routes', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.login@example.com',
        displayName: 'Manager Login',
      });

    const temporaryPassword = createResponse.body.data.temporaryPassword;

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager.login@example.com',
        password: temporaryPassword,
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user.role).toBe('manager');

    const managerToken = loginResponse.body.data.token;

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.role).toBe('manager');

    const statsResponse = await request(app)
      .get('/api/v1/stats/summary')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.success).toBe(true);
  });

  it('prevents managers from creating or listing managers', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.restricted@example.com',
        displayName: 'Restricted Manager',
      });

    const managerToken = await loginAndGetToken(
      'manager.restricted@example.com',
      createResponse.body.data.temporaryPassword,
    );

    const listResponse = await request(app)
      .get('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(listResponse.status).toBe(403);

    const nestedCreateResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        email: 'manager.two@example.com',
        displayName: 'Manager Two',
      });

    expect(nestedCreateResponse.status).toBe(403);
  });

  it('prevents non-admin users from listing, creating, and updating managers', async () => {
    const { user: affiliateUser, password: affiliatePassword } = await createTestAffiliateUser();
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const affiliateToken = await loginAndGetToken(affiliateUser.email, affiliatePassword);
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createManagerResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.forbidden@example.com',
        displayName: 'Forbidden Manager',
      });

    const managerId = createManagerResponse.body.data.manager.id;

    const listResponse = await request(app)
      .get('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${affiliateToken}`);
    expect(listResponse.status).toBe(403);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        email: 'manager.nope@example.com',
        displayName: 'Nope',
      });
    expect(createResponse.status).toBe(403);

    const updateResponse = await request(app)
      .patch(`/api/v1/admin/managers/${managerId}`)
      .set('Authorization', `Bearer ${affiliateToken}`)
      .send({
        displayName: 'Should Not Work',
      });
    expect(updateResponse.status).toBe(403);

    const deleteResponse = await request(app)
      .delete(`/api/v1/admin/managers/${managerId}`)
      .set('Authorization', `Bearer ${affiliateToken}`);
    expect(deleteResponse.status).toBe(403);
  });

  it('allows admin to update a manager and writes an audit event', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.update@example.com',
        displayName: 'Manager Update',
      });

    const managerId = createResponse.body.data.manager.id;

    const updateResponse = await request(app)
      .patch(`/api/v1/admin/managers/${managerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.updated@example.com',
        displayName: 'Manager Updated',
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.manager).toMatchObject({
      id: managerId,
      email: 'manager.updated@example.com',
      displayName: 'Manager Updated',
      role: 'manager',
    });

    const auditResponse = await pool.query(
      `
        SELECT action, context_json AS context
        FROM audit_events
        WHERE entity_id = $1
          AND entity_type = 'manager'
          AND action = 'updated'
      `,
      [managerId],
    );

    expect(auditResponse.rowCount).toBe(1);
    expect(auditResponse.rows[0].context).toMatchObject({
      oldValues: {
        email: 'manager.update@example.com',
        displayName: 'Manager Update',
      },
      newValues: {
        email: 'manager.updated@example.com',
        displayName: 'Manager Updated',
      },
    });
  });

  it('allows the current user to change their own password and rejects a wrong current password', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.password@example.com',
        displayName: 'Password Manager',
      });

    const managerToken = await loginAndGetToken(
      'manager.password@example.com',
      createResponse.body.data.temporaryPassword,
    );

    const wrongPasswordResponse = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        currentPassword: 'wrong-password',
        newPassword: 'N3wP@ssw0rd!',
      });

    expect(wrongPasswordResponse.status).toBe(401);

    const changeResponse = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        currentPassword: createResponse.body.data.temporaryPassword,
        newPassword: 'N3wP@ssw0rd!',
      });

    expect(changeResponse.status).toBe(200);
    expect(changeResponse.body.data).toEqual({ ok: true });

    const oldLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager.password@example.com',
        password: createResponse.body.data.temporaryPassword,
      });
    expect(oldLoginResponse.status).toBe(401);

    const newLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager.password@example.com',
        password: 'N3wP@ssw0rd!',
      });
    expect(newLoginResponse.status).toBe(200);

    const changedUser = await findUserByEmail('manager.password@example.com');
    expect(await bcrypt.compare('N3wP@ssw0rd!', changedUser.passwordHash)).toBe(true);

    const auditResponse = await pool.query(
      `
        SELECT action, entity_type AS "entityType", actor_role AS "actorRole"
        FROM audit_events
        WHERE entity_id = $1
          AND action = 'password_changed'
      `,
      [changedUser.id],
    );

    expect(auditResponse.rowCount).toBe(1);
    expect(auditResponse.rows[0]).toMatchObject({
      action: 'password_changed',
      entityType: 'user',
      actorRole: 'manager',
    });
  });

  it('allows admin to reset a manager password once and writes an audit event', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.reset@example.com',
        displayName: 'Reset Manager',
      });

    const managerId = createResponse.body.data.manager.id;
    const firstPassword = createResponse.body.data.temporaryPassword;

    const resetResponse = await request(app)
      .post(`/api/v1/admin/managers/${managerId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.data.temporaryPassword).toEqual(expect.any(String));
    expect(resetResponse.body.data.temporaryPassword).not.toBe(firstPassword);

    const oldLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager.reset@example.com',
        password: firstPassword,
      });
    expect(oldLoginResponse.status).toBe(401);

    const newLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'manager.reset@example.com',
        password: resetResponse.body.data.temporaryPassword,
      });
    expect(newLoginResponse.status).toBe(200);

    const auditResponse = await pool.query(
      `
        SELECT action, entity_type AS "entityType", actor_user_id AS "actorUserId"
        FROM audit_events
        WHERE entity_id = $1
          AND entity_type = 'manager'
          AND action = 'password_reset'
      `,
      [managerId],
    );

    expect(auditResponse.rowCount).toBe(1);
    expect(auditResponse.rows[0]).toMatchObject({
      action: 'password_reset',
      entityType: 'manager',
      actorUserId: adminUser.id,
    });
  });

  it('allows admin to delete a manager and writes an audit event', async () => {
    const { user: adminUser, password: adminPassword } = await createTestAdminUser();
    const adminToken = await loginAndGetToken(adminUser.email, adminPassword);

    const createResponse = await request(app)
      .post('/api/v1/admin/managers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'manager.delete@example.com',
        displayName: 'Delete Manager',
      });

    const managerId = createResponse.body.data.manager.id;

    const deleteResponse = await request(app)
      .delete(`/api/v1/admin/managers/${managerId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data).toEqual({ ok: true });

    const deletedUser = await findUserByEmail('manager.delete@example.com');
    expect(deletedUser).toBeNull();

    const auditResponse = await pool.query(
      `
        SELECT action, entity_type AS "entityType", actor_user_id AS "actorUserId", context_json AS context
        FROM audit_events
        WHERE entity_id = $1
          AND entity_type = 'manager'
          AND action = 'deleted'
      `,
      [managerId],
    );

    expect(auditResponse.rowCount).toBe(1);
    expect(auditResponse.rows[0]).toMatchObject({
      action: 'deleted',
      entityType: 'manager',
      actorUserId: adminUser.id,
    });
    expect(auditResponse.rows[0].context).toMatchObject({
      oldValues: {
        email: 'manager.delete@example.com',
        displayName: 'Delete Manager',
      },
      newValues: null,
      metadata: {
        deletedByAdmin: true,
      },
    });
  });
});
