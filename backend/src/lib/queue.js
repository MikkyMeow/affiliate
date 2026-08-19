import { Queue } from 'bullmq';
import { redisConfig } from './redis.config.js';
import { queueConfig } from '../queue/config.js';

const queueDisabled =
  (process.env.QUEUE_DISABLED ?? '').toLowerCase() === 'true' ||
  process.env.NODE_ENV === 'test';

const queueInstance = queueDisabled
  ? null
  : new Queue(queueConfig.name, {
      connection: queueConfig.connection,
      prefix: queueConfig.prefix,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });

async function enqueueAsyncJob(name, payload = {}, options = {}) {
  if (!queueInstance) {
    return null;
  }

  return queueInstance.add(name, payload, options);
}

function getAsyncJobsQueue() {
  return queueInstance;
}

async function shutdownQueue() {
  if (queueInstance) {
    await queueInstance.close();
  }
}

export {
  queueInstance as postbackEventsQueue,
  enqueueAsyncJob,
  getAsyncJobsQueue,
  redisConfig as queueRedisConfig,
  shutdownQueue,
};
