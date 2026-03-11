import { Queue } from 'bullmq';
import { redisConfig } from './redis.config.js';
import { queueConfig } from '../queue/config.js';

const postbackEventsQueue = new Queue(queueConfig.name, {
  connection: queueConfig.connection,
  prefix: queueConfig.prefix,
  defaultJobOptions: queueConfig.defaultJobOptions,
});

async function enqueueAsyncJob(name, payload = {}, options = {}) {
  return postbackEventsQueue.add(name, payload, options);
}

function getAsyncJobsQueue() {
  return postbackEventsQueue;
}

async function shutdownQueue() {
  if (postbackEventsQueue) {
    await postbackEventsQueue.close();
  }
}

export {
  postbackEventsQueue,
  enqueueAsyncJob,
  getAsyncJobsQueue,
  redisConfig as queueRedisConfig,
  shutdownQueue,
};
