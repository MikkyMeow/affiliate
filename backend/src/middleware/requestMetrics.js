import {
  httpRequestCounter,
  httpRequestDurationHistogram,
  httpRequestErrorsCounter,
} from '../lib/metrics.js';

function resolveRouteLabel(req) {
  const routePath = req.route?.path;
  const baseUrl = req.baseUrl ?? '';

  if (routePath) {
    return `${baseUrl}${routePath}`;
  }

  const originalPath = req.originalUrl ?? req.url ?? '';
  const [pathWithoutQuery] = originalPath.split('?');
  return pathWithoutQuery || 'unknown';
}

export function requestMetrics(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const labels = {
      method: req.method,
      route: resolveRouteLabel(req),
      status_code: String(res.statusCode),
    };

    httpRequestCounter.inc(labels);
    httpRequestDurationHistogram.observe(labels, durationMs);

    if (res.statusCode >= 500) {
      httpRequestErrorsCounter.inc(labels);
    }
  });

  next();
}
