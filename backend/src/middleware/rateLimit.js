import rateLimit, { ipKeyGenerator, MemoryStore } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { ERROR_CODES } from '../utils/response.js';
import { getClientIp } from '../lib/getClientIp.js';
import { redisClient } from '../lib/redis.js';

let hasLoggedRedisFallback = false;

function logRedisFallback(reason) {
  if (hasLoggedRedisFallback) {
    return;
  }

  const suffix = reason ? ` Reason: ${reason.message}` : '';
  console.warn(
    '⚠️ Rate limiter is falling back to in-memory store because Redis is unavailable.' +
      suffix,
  );
  hasLoggedRedisFallback = true;
}

function createRedisBackedStore(name) {
  const memoryStore = new MemoryStore();
  let redisStore = null;

  function shouldUseRedis() {
    return Boolean(redisClient?.isOpen && redisClient?.isReady);
  }

  function getRedisStore() {
    if (!shouldUseRedis()) {
      return null;
    }

    if (!redisStore) {
      try {
        redisStore = new RedisStore({
          prefix: `rl:${name}`,
          sendCommand: (...args) => redisClient.sendCommand(args),
        });
      } catch (error) {
        logRedisFallback(error);
        redisStore = null;
        return null;
      }
    }

    return redisStore;
  }

  return {
    async increment(key) {
      const store = getRedisStore();
      if (store) {
        try {
          return await store.increment(key);
        } catch (error) {
          logRedisFallback(error);
          redisStore = null;
        }
      } else if (shouldUseRedis()) {
        logRedisFallback();
      }

      return memoryStore.increment(key);
    },
    async decrement(key) {
      const store = getRedisStore();
      if (store) {
        try {
          return await store.decrement(key);
        } catch (error) {
          logRedisFallback(error);
          redisStore = null;
        }
      }

      return memoryStore.decrement(key);
    },
    async resetKey(key) {
      const store = getRedisStore();
      if (store) {
        try {
          await store.resetKey(key);
          return;
        } catch (error) {
          logRedisFallback(error);
          redisStore = null;
        }
      }

      memoryStore.resetKey(key);
    },
    async resetAll() {
      const store = getRedisStore();
      if (store && typeof store.resetAll === 'function') {
        try {
          await store.resetAll();
          return;
        } catch (error) {
          logRedisFallback(error);
          redisStore = null;
        }
      }

      if (typeof memoryStore.resetAll === 'function') {
        memoryStore.resetAll();
      }
    },
  };
}

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

function createLimiter({ windowMs, limit, message, name }) {
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
    store: createRedisBackedStore(name),
  });
}

export const loginRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  message:
    'Слишком много попыток входа. Попробуйте ещё раз через минуту.',
  name: 'auth_login',
});

export const postbackRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: 'Слишком много запросов postback. Попробуйте позже.',
  name: 'track_postback',
});

export const clickRateLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 1000,
  message: 'Слишком много кликов с одного IP. Попробуйте позже.',
  name: 'track_click',
});
