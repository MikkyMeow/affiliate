import { enqueueAsyncJob } from '../lib/queue.js';
import { logError } from '../lib/structuredLogger.js';

async function dispatchAsyncJob(jobName, payload = {}, options = {}) {
  if (!jobName) {
    throw new Error('dispatchAsyncJob requires a job name');
  }

  try {
    return await enqueueAsyncJob(jobName, payload, options);
  } catch (error) {
    logError('async_job_enqueue_failed', {
      jobName,
      reason: error.message,
    });
    throw error;
  }
}

export { dispatchAsyncJob };
