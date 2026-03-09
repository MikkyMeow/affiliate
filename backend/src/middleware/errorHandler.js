import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (req.id && !res.getHeader('X-Request-ID')) {
    res.setHeader('X-Request-ID', req.id);
  }

  const isApiError = err instanceof ApiError;
  const status = isApiError ? err.status : 500;
  const code = isApiError ? err.code : ERROR_CODES.INTERNAL_ERROR;
  const message = isApiError ? err.message : 'Internal server error';
  const details = isApiError ? err.details ?? null : null;

  console.error(`[${req.method} ${req.originalUrl}] [requestId=${req.id}]`, err);

  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}
