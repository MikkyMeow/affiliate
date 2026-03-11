const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisDb =
  process.env.REDIS_DB !== undefined ? Number(process.env.REDIS_DB) : undefined;
const redisUsername = process.env.REDIS_USERNAME;
const redisPassword = process.env.REDIS_PASSWORD;
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;
const redisRequired =
  (process.env.REDIS_REQUIRED ?? 'true').toLowerCase() !== 'false';

function buildBullmqConnectionConfig() {
  const connection = {
    host: redisHost,
    port: redisPort,
  };

  if (typeof redisDb === 'number' && Number.isFinite(redisDb)) {
    connection.db = redisDb;
  }

  if (redisUsername) {
    connection.username = redisUsername;
  }

  if (redisPassword) {
    connection.password = redisPassword;
  }

  return connection;
}

const redisConfig = {
  host: redisHost,
  port: redisPort,
  url: redisUrl,
  db: redisDb,
  username: redisUsername,
  password: redisPassword,
  required: redisRequired,
  connection: buildBullmqConnectionConfig(),
};

export { redisConfig };
