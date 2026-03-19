import { Client } from 'pg';
import pool from '../../src/db.js';

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 5432,
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

function resolveDbConfig() {
  if (process.env.DATABASE_URL) {
    return parseDatabaseUrl(process.env.DATABASE_URL);
  }

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'affiliate',
    user: process.env.DB_USER ?? 'affiliate',
    password: process.env.DB_PASSWORD ?? 'affiliate',
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

async function connectToAdminDatabase(config) {
  const preferred = process.env.TEST_DB_ADMIN_DB;
  const candidates = [preferred, 'postgres', 'template1'].filter(Boolean);
  let lastError = null;

  for (const database of candidates) {
    const client = new Client({ ...config, database });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Unable to connect to admin database');
}

export async function ensureTestDatabase() {
  const config = resolveDbConfig();

  if (!config.database) {
    return;
  }

  const client = await connectToAdminDatabase(config);
  const dbName = config.database;

  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );

    if (result.rowCount === 0) {
      const escapedName = dbName.replace(/"/g, '""');
      await client.query(`CREATE DATABASE "${escapedName}"`);
    }
  } finally {
    await client.end();
  }
}

export async function resetDatabase() {
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('pgmigrations')
      `,
    );

    if (rows.length === 0) {
      return;
    }

    const tableList = rows
      .map(({ tablename }) => `"${tablename}"`)
      .join(', ');

    await client.query(
      `TRUNCATE ${tableList} RESTART IDENTITY CASCADE`,
    );
  } finally {
    client.release();
  }
}
