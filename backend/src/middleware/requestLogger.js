function maskSensitiveQueryParams(url) {
  if (typeof url !== 'string' || !url.includes('?')) {
    return url;
  }

  const [path, queryString] = url.split('?', 2);
  const params = new URLSearchParams(queryString);

  if (params.has('token')) {
    params.set('token', '***');
  }

  const maskedQuery = params.toString();
  return maskedQuery ? `${path}?${maskedQuery}` : path;
}

export function requestLogger(req, res, next) {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const diff = Number(process.hrtime.bigint() - startTime) / 1e6;
    const durationMs = Math.round(diff);
    const requestId = req.id || 'no-request-id';
    const method = req.method;
    const path = maskSensitiveQueryParams(req.originalUrl);
    const status = res.statusCode;

    console.log(`[${requestId}] ${method} ${path} ${status} ${durationMs}ms`);
  });

  next();
}
