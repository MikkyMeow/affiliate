import { Pool } from 'pg';
import { applyMigrations } from './migrate.js';

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME ?? 'affiliate',
      user: process.env.DB_USER ?? 'affiliate',
      password: process.env.DB_PASSWORD ?? 'affiliate',
    });

export async function verifyDatabaseConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
  } finally {
    client.release();
  }
}

export async function ensureDatabaseSetup() {
  await applyMigrations();
}

export default pool;
