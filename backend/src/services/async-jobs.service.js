import { enqueueAsyncJob } from '../lib/queue.js';

async function dispatchAsyncJob(jobName, payload = {}, options = {}) {
  if (!jobName) {
    throw new Error('dispatchAsyncJob requires a job name');
  }

  try {
    return await enqueueAsyncJob(jobName, payload, options);
  } catch (error) {
    console.error(
      `❌ Failed to enqueue async job "${jobName}": ${error.message}`,
    );
    throw error;
  }
}

export { dispatchAsyncJob };
