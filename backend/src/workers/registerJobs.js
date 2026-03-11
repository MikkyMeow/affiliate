import {
  registerJobHandler,
  ASYNC_JOB_NAMES,
  queueConfig,
} from '../queue/index.js';
import {
  runDailyStatsRollup,
  updateConversionRollup,
} from '../services/stats/rollup.service.js';
import {
  reserveAsyncEvent,
  releaseAsyncEvent,
} from '../models/processed-async-events.model.js';
import {
  rollupUpdatesCounter,
  rollupUpdateFailuresCounter,
  rollupSkippedDuplicatesCounter,
} from '../lib/metrics.js';

function logStructured(event, payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  console.log(JSON.stringify(entry));
}

async function handleConversionCreatedJob(job, queueName) {
  const conversionId = job.data?.conversionId;

  if (!conversionId) {
    throw new Error('conversionId is required in conversion_created job payload');
  }

  const jobType = 'conversion_created';
  const eventKey = `${jobType}:${conversionId}`;
  const { reserved, id } = await reserveAsyncEvent(eventKey, jobType);

  if (!reserved) {
    logStructured('conversion_rollup_job_deduplicated', {
      queue: queueName,
      jobId: job.id,
      conversionId,
      eventKey,
    });
    rollupSkippedDuplicatesCounter.inc({ job_type: jobType });

    return {
      conversionId,
      deduplicated: true,
    };
  }

  logStructured('conversion_rollup_job_started', {
    queue: queueName,
    jobId: job.id,
    conversionId,
    eventKey,
  });

  try {
    const result = await updateConversionRollup(conversionId);

    logStructured('conversion_rollup_job_completed', {
      queue: queueName,
      jobId: job.id,
      conversionId,
      date: result.date,
      offerId: result.offerId,
      affiliateId: result.affiliateId,
    });
    rollupUpdatesCounter.inc({ job_type: jobType });

    return result;
  } catch (error) {
    await releaseAsyncEvent(id);
    rollupUpdateFailuresCounter.inc({ job_type: jobType });
    throw error;
  }
}

function registerWorkerJobs() {
  registerJobHandler(ASYNC_JOB_NAMES.POSTBACK_EVENT, async (job) => {
    const queueName = job.queueName ?? queueConfig.name;
    const jobType = job.data?.type ?? 'unknown';

    if (jobType === 'conversion_created') {
      const result = await handleConversionCreatedJob(job, queueName);

      return {
        handled: true,
        type: jobType,
        ...result,
      };
    }

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

  registerJobHandler(ASYNC_JOB_NAMES.ROLLUP, async (job) => {
    const payload = job.data ?? {};
    const { startDate, endDate, date } = payload;

    logStructured('stats_rollup_job_started', {
      queue: job.queueName ?? queueConfig.name,
      jobId: job.id,
      jobName: job.name,
      range: { startDate, endDate, date },
    });

    const result = await runDailyStatsRollup({ startDate, endDate, date });

    logStructured('stats_rollup_job_completed', {
      queue: job.queueName ?? queueConfig.name,
      jobId: job.id,
      startDate: result.startDate,
      endDate: result.endDate,
      rowsProcessed: result.rowsProcessed,
    });

    return {
      handled: true,
      type: 'stats.rollup',
      startDate: result.startDate,
      endDate: result.endDate,
      rowsProcessed: result.rowsProcessed,
    };
  });
}

export { registerWorkerJobs };
