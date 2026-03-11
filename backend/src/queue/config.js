import { redisConfig } from '../lib/redis.config.js';

function parseOptionalNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const asyncQueueName =
  process.env.ASYNC_JOBS_QUEUE ||
  process.env.QUEUE_NAME ||
  'postback-events';
const queuePrefix = process.env.BULLMQ_PREFIX || 'affilate';
const defaultJobAttempts = parseOptionalNumber(
  process.env.ASYNC_JOB_ATTEMPTS,
  3,
);
const defaultJobBackoffDelay = parseOptionalNumber(
  process.env.ASYNC_JOB_BACKOFF_DELAY_MS,
  1000,
);
const removeOnCompleteCount = parseOptionalNumber(
  process.env.ASYNC_JOB_HISTORY || process.env.ASYNC_JOB_REMOVE_ON_COMPLETE,
  1000,
);
const removeOnFailCount = parseOptionalNumber(
  process.env.ASYNC_JOB_REMOVE_ON_FAIL,
  200,
);
const workerConcurrency = parseOptionalNumber(
  process.env.ASYNC_WORKER_CONCURRENCY,
  5,
);

const defaultJobOptions = {
  attempts: defaultJobAttempts,
  removeOnComplete: { count: removeOnCompleteCount },
  removeOnFail: { count: removeOnFailCount },
  backoff: {
    type: 'exponential',
    delay: defaultJobBackoffDelay,
  },
};

const queueConfig = {
  name: asyncQueueName,
  prefix: queuePrefix,
  connection: redisConfig.connection,
  defaultJobOptions,
  workerConcurrency,
};

export { queueConfig };
