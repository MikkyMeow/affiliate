import { createClient } from 'redis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

const redisOptions = {
  url: redisUrl,
};

// if (process.env.REDIS_USERNAME) {
//   redisOptions.username = process.env.REDIS_USERNAME;
// }

// if (process.env.REDIS_PASSWORD) {
//   redisOptions.password = process.env.REDIS_PASSWORD;
// }

const redisClient = createClient(redisOptions);

let hasAttemptedConnection = false;

redisClient.on('error', (error) => {
  console.error('Redis client error:', error);
});

async function disconnectSilently() {
  try {
    if (redisClient.isOpen) {
      await redisClient.disconnect();
    }
  } catch {
    // ignore disconnect errors
  }
}

export async function initRedis() {
  if (hasAttemptedConnection) {
    return redisClient;
  }

  try {
    await redisClient.connect();
    await redisClient.ping();
    console.log('✅ Connected to Redis');
  } catch (error) {
    console.warn(
      '⚠️ Redis is not available. Continuing without cache layer.',
      error.message,
    );
    await disconnectSilently();
  } finally {
    hasAttemptedConnection = true;
  }

  return redisClient;
}

export { redisClient };
