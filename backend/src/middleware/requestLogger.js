export function requestLogger(req, res, next) {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const diff = Number(process.hrtime.bigint() - startTime) / 1e6;
    const durationMs = Math.round(diff);
    const requestId = req.id || 'no-request-id';
    const method = req.method;
    const path = req.originalUrl;
    const status = res.statusCode;

    console.log(`[${requestId}] ${method} ${path} ${status} ${durationMs}ms`);
  });

  next();
}
