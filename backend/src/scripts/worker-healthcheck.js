import '../config/load-env.js';
import { QueueEvents } from 'bullmq';
import { queueConfig } from '../queue/config.js';
import { verifyDatabaseConnection } from '../db.js';
import {
  initRedis,
  verifyRedisConnection,
  redisClient,
} from '../lib/redis.js';

async function checkWorkerDependencies() {
  await verifyDatabaseConnection();
  await initRedis();
  await verifyRedisConnection();
}

async function checkQueueConnectivity() {
  const queueEvents = new QueueEvents(queueConfig.name, {
    prefix: queueConfig.prefix,
    connection: queueConfig.connection,
  });

  try {
    await queueEvents.waitUntilReady();
  } finally {
    await queueEvents.close();
  }
}

async function main() {
  await checkWorkerDependencies();
  await checkQueueConnectivity();

  if (!redisClient.isOpen) {
    throw new Error('Redis client is not open after initialization');
  }
}

main().catch((error) => {
  console.error('Worker healthcheck failed:', error);
  process.exit(1);
});
