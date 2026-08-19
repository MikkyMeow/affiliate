import { Worker } from 'bullmq';
import { queueConfig } from '../queue/config.js';
import { getJobHandler } from '../queue/jobs/index.js';
import {
  queueJobsProcessedCounter,
  queueJobsFailedCounter,
} from '../lib/metrics.js';
import { logError, logInfo } from '../lib/structuredLogger.js';

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
    logInfo('worker_job_active', {
      jobId: job?.id ?? null,
      jobName: job?.name ?? 'unknown',
      attempt: (job?.attemptsMade ?? 0) + 1,
      queueName: job?.queueName ?? queueConfig.name,
      requestId: job?.data?.requestId ?? null,
    });
  });

  worker.on('completed', (job) => {
    const { queueName, jobType } = extractJobLabels(job);
    queueJobsProcessedCounter.inc({
      queue_name: queueName,
      job_type: jobType,
    });
    const durationMs =
      typeof job?.finishedOn === 'number' && typeof job?.processedOn === 'number'
        ? job.finishedOn - job.processedOn
        : null;

    logInfo('worker_job_completed', {
      jobId: job?.id ?? null,
      jobName: job?.name ?? 'unknown',
      queueName,
      jobType,
      durationMs,
      requestId: job?.data?.requestId ?? null,
    });
  });

  worker.on('failed', (job, error) => {
    const { queueName, jobType } = extractJobLabels(job);
    queueJobsFailedCounter.inc({
      queue_name: queueName,
      job_type: jobType,
    });
    logError('worker_job_failed', {
      jobId: job?.id ?? null,
      jobName: job?.name ?? 'unknown',
      queueName,
      jobType,
      attemptsMade: job?.attemptsMade ?? null,
      reason: error.message,
      requestId: job?.data?.requestId ?? null,
    });
  });

  worker.on('error', (error) => {
    logError('worker_runtime_error', {
      queueName: queueConfig.name,
      reason: error.message,
    });
  });

  return worker;
}

export { createAsyncJobsWorker };
