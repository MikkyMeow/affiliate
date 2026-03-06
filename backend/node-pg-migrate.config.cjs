const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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
