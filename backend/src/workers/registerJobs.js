import {
  registerJobHandler,
  ASYNC_JOB_NAMES,
  queueConfig,
} from '../queue/index.js';

function logStructured(event, payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log(JSON.stringify(entry));
}

function registerWorkerJobs() {
  registerJobHandler(ASYNC_JOB_NAMES.POSTBACK_EVENT, async (job) => {
    const queueName = job.queueName ?? queueConfig.name;
    const jobType = job.data?.type ?? 'unknown';

    logStructured('postback_event_job_processed', {
      queue: queueName,
      jobId: job.id,
      jobName: job.name,
      attempts: job.attemptsMade,
      data: job.data,
    });

    return {
      handled: true,
      type: jobType,
    };
  });
}

export { registerWorkerJobs };
