import { createClient } from 'redis';
import { redisConfig } from './redis.config.js';

const redisOptions = {
  url: redisConfig.url,
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

export async function verifyRedisConnection() {
  if (!redisClient.isOpen) {
    throw new Error('Redis connection is not open');
  }

  try {
    await redisClient.ping();
  } catch (error) {
    throw new Error(`Redis ping failed: ${error.message}`);
  }
}

export function isRedisRequired() {
  return redisConfig.required;
}

export { redisClient };
