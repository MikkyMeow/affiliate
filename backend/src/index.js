import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensureDatabaseSetup, verifyDatabaseConnection } from './db.js';
import advertisersRouter from './routes/advertisers.js';
import affiliatesRouter from './routes/affiliates.js';
import offersRouter from './routes/offers.routes.js';
import {
  sendSuccess,
  ERROR_CODES,
} from './utils/response.js';
import authRouter from './routes/auth.js';
import { authenticate } from './middleware/auth.js';
import { findUserById } from './models/userModel.js';
import { ApiError } from './utils/apiError.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { registerClick } from './services/tracking/clicks.service.js';
import postbackRouter from './routes/postback.routes.js';

const app = express();
const PORT = process.env.PORT || 4000;
const API_PREFIX = '/api/v1';

app.use(requestId);
app.use(requestLogger);
app.use(
  cors({
    exposedHeaders: ['X-Request-ID'],
  }),
);
app.use(express.json());

app.get(`${API_PREFIX}/message`, (req, res) =>
  sendSuccess(res, { message: 'Привет из backend!' }),
);

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/advertisers`, advertisersRouter);
app.use(`${API_PREFIX}/affiliates`, affiliatesRouter);
app.use(`${API_PREFIX}/offers`, offersRouter);
app.use('/track', postbackRouter);

app.get(
  `${API_PREFIX}/health`,
  asyncHandler(async (req, res) => {
    try {
      await verifyDatabaseConnection();
      sendSuccess(res, { status: 'ok' });
    } catch (error) {
      throw new ApiError(ERROR_CODES.DB_UNAVAILABLE, 500, 'DB unavailable', {
        reason: error.message,
      });
    }
  }),
);

app.get(
  `${API_PREFIX}/profile`,
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.user.sub);

    if (!user) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
        userId: req.user.sub,
      });
    }

    return sendSuccess(res, { user });
  }),
);

function extractQueryParam(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const singleValue = Array.isArray(value) ? value[0] : value;
  const stringValue = String(singleValue).trim();

  return stringValue === '' ? undefined : stringValue;
}

function extractRequestIp(req) {
  const forwardedFor = req.get('x-forwarded-for');

  if (forwardedFor) {
    const [first] = forwardedFor.split(',');

    if (first && first.trim()) {
      return first.trim();
    }
  }

  return req.ip ?? null;
}

const SUB_PARAM_KEYS = ['sub1', 'sub2', 'sub3', 'sub4', 'sub5'];
const MAX_SUB_PARAM_LENGTH = 255;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function validateSubParam(key, value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return `${key} должен быть строкой`;
  }

  if (value.length > MAX_SUB_PARAM_LENGTH) {
    return `${key} не должен превышать ${MAX_SUB_PARAM_LENGTH} символов`;
  }

  return null;
}

function validateTrackingQuery(params) {
  if (!params.offerId) {
    return { ok: false, message: 'offerId обязателен' };
  }

  if (!isValidUuid(params.offerId)) {
    return { ok: false, message: 'offerId должен быть валидным UUID' };
  }

  if (!params.affiliateId) {
    return { ok: false, message: 'affiliateId обязателен' };
  }

  if (!isValidUuid(params.affiliateId)) {
    return { ok: false, message: 'affiliateId должен быть валидным UUID' };
  }

  for (const key of SUB_PARAM_KEYS) {
    const error = validateSubParam(key, params[key]);

    if (error) {
      return { ok: false, message: error };
    }
  }

  return { ok: true };
}

app.get('/track/click', async (req, res, next) => {
  const startedAt = Date.now();
  const clickPayload = {
    offerId: extractQueryParam(req.query.offerId),
    affiliateId: extractQueryParam(req.query.affiliateId),
    ip: extractRequestIp(req),
    userAgent: req.get('user-agent') ?? null,
    referer: req.get('referer') ?? null,
  };

  for (const key of SUB_PARAM_KEYS) {
    clickPayload[key] = extractQueryParam(req.query[key]);
  }

  const logClickEvent = (status, extra = {}) => {
    const logEntry = {
      event: 'track_click',
      request_id: req.id ?? null,
      offerId: clickPayload.offerId ?? null,
      affiliateId: clickPayload.affiliateId ?? null,
      clickId: extra.clickId ?? null,
      status,
      duration_ms: Date.now() - startedAt,
    };

    console.log(JSON.stringify(logEntry));
  };

  const validationResult = validateTrackingQuery(clickPayload);

  if (!validationResult.ok) {
    logClickEvent('validation_error');
    return res.status(400).json({
      error: validationResult.message,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const { redirectUrl, clickId } = await registerClick(clickPayload);
    logClickEvent('redirect', { clickId });

    return res.redirect(302, redirectUrl);
  } catch (error) {
    if (error instanceof ApiError) {
      logClickEvent('api_error');
      return res.status(error.status ?? 500).json({
        error: error.message,
        code: error.code ?? ERROR_CODES.INTERNAL_ERROR,
        details: error.details ?? null,
      });
    }

    logClickEvent('error');
    return next(error);
  }
});

app.use(errorHandler);

async function bootstrap() {
  try {
    await verifyDatabaseConnection();
    await ensureDatabaseSetup();
    console.log('✅ Database ready');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

bootstrap();
