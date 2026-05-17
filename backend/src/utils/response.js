export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_CONVERSION: 'DUPLICATE_CONVERSION',
  GOAL_LIMIT_REACHED: 'GOAL_LIMIT_REACHED',
  INVALID_POSTBACK_TOKEN: 'INVALID_POSTBACK_TOKEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  FORBIDDEN: 'FORBIDDEN',
  AFFILIATE_NOT_LINKED: 'AFFILIATE_NOT_LINKED',
  CACHE_UNAVAILABLE: 'CACHE_UNAVAILABLE',
  QUESTIONNAIRE_REQUIRED: 'QUESTIONNAIRE_REQUIRED',
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
