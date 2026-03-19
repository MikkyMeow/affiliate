import '../../src/config/load-env.js';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import pool, { ensureDatabaseSetup } from '../../src/db.js';
import { ensureTestDatabase, resetDatabase } from './test-db.js';

process.env.NODE_ENV = 'test';

if (!process.env.REDIS_REQUIRED) {
  process.env.REDIS_REQUIRED = 'false';
}

if (!process.env.QUEUE_DISABLED) {
  process.env.QUEUE_DISABLED = 'true';
}

if (!process.env.RATE_LIMIT_DISABLED) {
  process.env.RATE_LIMIT_DISABLED = 'true';
}

beforeAll(async () => {
  await ensureTestDatabase();
  await ensureDatabaseSetup();
  await resetDatabase();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await pool.end();
});
