import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ERROR_CODES } from '../utils/response.js';
import { getClientIp } from '../lib/getClientIp.js';

function buildHandler(message) {
  return (req, res, _next, optionsUsed) => {
    const rateLimitInfo = req.rateLimit;
    const limit =
      typeof rateLimitInfo?.limit === 'number'
        ? rateLimitInfo.limit
        : typeof optionsUsed.limit === 'number'
          ? optionsUsed.limit
          : null;

    res.status(optionsUsed.statusCode).json({
      error: message,
      code: ERROR_CODES.RATE_LIMITED,
      details: {
        windowMs: optionsUsed.windowMs,
        limit,
      },
    });
  };
}

function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: buildHandler(message),
    keyGenerator: (req) => {
      const rawIp = getClientIp(req);
      if (!rawIp) {
        return 'unknown';
      }

      return ipKeyGenerator(rawIp);
    },
  });
}

export const loginRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  message:
    'Слишком много попыток входа. Попробуйте ещё раз через минуту.',
});

export const postbackRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: 'Слишком много запросов postback. Попробуйте позже.',
});

export const clickRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 1000,
  message: 'Слишком много кликов с одного IP. Попробуйте позже.',
});
