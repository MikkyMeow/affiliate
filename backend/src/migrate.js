import path from 'path';
import { fileURLToPath } from 'url';
import { runner as runMigrations } from 'node-pg-migrate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '..', 'migrations');

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    if (process.env.DB_SSL === 'true') {
      return {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      };
    }

    return process.env.DATABASE_URL;
  }

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'affilate',
    user: process.env.DB_USER ?? 'affilate',
    password: process.env.DB_PASSWORD ?? 'affilate',
  };
}

export async function applyMigrations() {
  await runMigrations({
    databaseUrl: getDatabaseConfig(),
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    createSchema: true,
    createMigrationsSchema: true,
    log: () => {},
  });
}
