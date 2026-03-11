const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
const envPath = path.resolve(__dirname, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function getDatabaseConfig() {
  if (process.env.DATABASE_URL) {
    const ssl =
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined;

    if (ssl) {
      return { connectionString: process.env.DATABASE_URL, ssl };
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

module.exports = {
  migrationsTable: 'pgmigrations',
  dir: 'migrations',
  direction: 'up',
  databaseUrl: getDatabaseConfig(),
  createSchema: true,
  createMigrationsSchema: true,
};
