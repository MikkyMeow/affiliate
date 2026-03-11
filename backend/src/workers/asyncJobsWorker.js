import { Worker } from 'bullmq';
import { queueConfig } from '../queue/config.js';
import { getJobHandler } from '../queue/jobs/index.js';
import {
  queueJobsProcessedCounter,
  queueJobsFailedCounter,
} from '../lib/metrics.js';

function extractJobLabels(job) {
  const queueName = job?.queueName ?? queueConfig.name;
  const jobType = job?.data?.type ?? job?.name ?? 'unknown';

  return { queueName, jobType };
}

function createAsyncJobsWorker() {
  const worker = new Worker(
    queueConfig.name,
    async (job) => {
      const handler = getJobHandler(job.name);

      if (!handler) {
        throw new Error(`No handler registered for async job "${job.name}"`);
      }

      return handler(job);
    },
    {
      connection: queueConfig.connection,
      prefix: queueConfig.prefix,
      concurrency: queueConfig.workerConcurrency,
    },
  );

  worker.on('active', (job) => {
    console.log(
      `🧵 [async-worker] Processing job ${job.id} (${job.name}) attempt ${job.attemptsMade + 1}`,
    );
  });

  worker.on('completed', (job) => {
    const { queueName, jobType } = extractJobLabels(job);
    queueJobsProcessedCounter.inc({
      queue_name: queueName,
      job_type: jobType,
    });
    console.log(`✅ [async-worker] Job ${job.id} (${job.name}) completed`);
  });

  worker.on('failed', (job, error) => {
    const { queueName, jobType } = extractJobLabels(job);
    queueJobsFailedCounter.inc({
      queue_name: queueName,
      job_type: jobType,
    });
    console.error(
      `❌ [async-worker] Job ${job?.id} (${job?.name}) failed: ${error.message}`,
    );
  });

  worker.on('error', (error) => {
    console.error('❌ [async-worker] Worker error:', error);
  });

  return worker;
}

export { createAsyncJobsWorker };
