import client from 'prom-client';

const register = new client.Registry();

register.setDefaultLabels({
  app: 'affilate_backend',
  node_env: process.env.NODE_ENV ?? 'development',
});

client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests received by the backend',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationHistogram = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration recorded in milliseconds',
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000],
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestErrorsCounter = new client.Counter({
  name: 'affilate_http_request_errors_total',
  help: 'Number of HTTP requests that resulted in a server error',
  labelNames: ['method', 'route', 'status_code'],
});

const trackingClickRequestsCounter = new client.Counter({
  name: 'tracking_click_requests_total',
  help: 'Number of click tracking requests processed',
});

const trackingClickErrorsCounter = new client.Counter({
  name: 'tracking_click_errors_total',
  help: 'Number of click tracking requests that failed',
  labelNames: ['type'],
});

const trackingPostbackRequestsCounter = new client.Counter({
  name: 'tracking_postback_requests_total',
  help: 'Number of postback requests processed',
});

const trackingPostbackErrorsCounter = new client.Counter({
  name: 'tracking_postback_errors_total',
  help: 'Number of postback requests that failed',
  labelNames: ['type'],
});

const trackingPostbackDuplicatesCounter = new client.Counter({
  name: 'tracking_postback_duplicates_total',
  help: 'Number of postback requests detected as duplicates',
});

const trackingCacheHitsCounter = new client.Counter({
  name: 'tracking_cache_hits_total',
  help: 'Number of Redis cache hits for tracking lookups',
  labelNames: ['entity'],
});

const trackingCacheMissesCounter = new client.Counter({
  name: 'tracking_cache_misses_total',
  help: 'Number of Redis cache misses for tracking lookups',
  labelNames: ['entity'],
});

const trackingCacheInvalidationsCounter = new client.Counter({
  name: 'tracking_cache_invalidations_total',
  help: 'Number of cache invalidations performed',
  labelNames: ['entity'],
});

const trackingCacheInvalidationFailuresCounter = new client.Counter({
  name: 'tracking_cache_invalidation_failures_total',
  help: 'Number of cache invalidation attempts that failed',
  labelNames: ['entity'],
});

const queueJobsProcessedCounter = new client.Counter({
  name: 'queue_jobs_processed_total',
  help: 'Number of async queue jobs processed successfully',
  labelNames: ['queue_name', 'job_type'],
});

const queueJobsFailedCounter = new client.Counter({
  name: 'queue_jobs_failed_total',
  help: 'Number of async queue jobs that failed',
  labelNames: ['queue_name', 'job_type'],
});

const queueJobEnqueueFailedCounter = new client.Counter({
  name: 'queue_job_enqueue_failed_total',
  help: 'Number of async queue jobs that failed to enqueue',
  labelNames: ['queue_name', 'job_type'],
});

const rollupUpdatesCounter = new client.Counter({
  name: 'rollup_updates_total',
  help: 'Number of rollup updates applied to aggregated stats',
  labelNames: ['job_type', 'event_type'],
});

const rollupUpdateFailuresCounter = new client.Counter({
  name: 'rollup_update_failures_total',
  help: 'Number of rollup update attempts that failed',
  labelNames: ['job_type', 'event_type'],
});

const rollupSkippedDuplicatesCounter = new client.Counter({
  name: 'rollup_skipped_duplicates_total',
  help: 'Number of rollup update attempts skipped due to duplicate detection',
  labelNames: ['job_type', 'event_type'],
});

register.registerMetric(httpRequestCounter);
register.registerMetric(httpRequestDurationHistogram);
register.registerMetric(httpRequestErrorsCounter);
register.registerMetric(trackingClickRequestsCounter);
register.registerMetric(trackingClickErrorsCounter);
register.registerMetric(trackingPostbackRequestsCounter);
register.registerMetric(trackingPostbackErrorsCounter);
register.registerMetric(trackingPostbackDuplicatesCounter);
register.registerMetric(trackingCacheHitsCounter);
register.registerMetric(trackingCacheMissesCounter);
register.registerMetric(trackingCacheInvalidationsCounter);
register.registerMetric(trackingCacheInvalidationFailuresCounter);
register.registerMetric(queueJobsProcessedCounter);
register.registerMetric(queueJobsFailedCounter);
register.registerMetric(queueJobEnqueueFailedCounter);
register.registerMetric(rollupUpdatesCounter);
register.registerMetric(rollupUpdateFailuresCounter);
register.registerMetric(rollupSkippedDuplicatesCounter);

export {
  register,
  httpRequestCounter,
  httpRequestDurationHistogram,
  httpRequestErrorsCounter,
  trackingClickRequestsCounter,
  trackingClickErrorsCounter,
  trackingPostbackRequestsCounter,
  trackingPostbackErrorsCounter,
  trackingPostbackDuplicatesCounter,
  trackingCacheHitsCounter,
  trackingCacheMissesCounter,
  trackingCacheInvalidationsCounter,
  trackingCacheInvalidationFailuresCounter,
  queueJobsProcessedCounter,
  queueJobsFailedCounter,
  queueJobEnqueueFailedCounter,
  rollupUpdatesCounter,
  rollupUpdateFailuresCounter,
  rollupSkippedDuplicatesCounter,
};
