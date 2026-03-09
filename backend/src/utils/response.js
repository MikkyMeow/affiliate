const safeDetails = (details) =>
  details === undefined ? null : details;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export function sendSuccess(res, data, { status = 200, meta = null } = {}) {
  return res.status(status).json({
    success: true,
    data,
    meta,
  });
}

export function sendList(res, data, { status = 200, total } = {}) {
  const resolvedTotal =
    typeof total === 'number' ? total : Array.isArray(data) ? data.length : null;

  return sendSuccess(res, data, {
    status,
    meta: resolvedTotal === null ? null : { total: resolvedTotal },
  });
}

export function sendError(
  res,
  { status = 400, code = ERROR_CODES.INTERNAL_ERROR, message, details = null },
) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: safeDetails(details),
    },
  });
}
