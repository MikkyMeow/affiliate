import './config/load-env.js';
import express from 'express';
import cors from 'cors';
import { ensureDatabaseSetup, verifyDatabaseConnection } from './db.js';
import advertisersRouter from './routes/advertisers.js';
import affiliatesRouter from './routes/affiliates.js';
import offersRouter from './routes/offers.routes.js';
import { sendSuccess, ERROR_CODES } from './utils/response.js';
import authRouter from './routes/auth.js';
import { authenticate } from './middleware/auth.js';
import { findUserById } from './models/userModel.js';
import { ApiError } from './utils/apiError.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import trackingRouter from './routes/tracking.routes.js';
import clicksRouter from './routes/clicks.routes.js';
import conversionsRouter from './routes/conversions.routes.js';
import adminStatsRouter from './routes/admin-stats.routes.js';
import adminOfferRequestsRouter from './routes/admin-offer-requests.routes.js';
import adminOfferAccessRouter from './routes/admin-offer-access.routes.js';
import adminOfferGoalsRouter from './routes/admin-offer-goals.routes.js';
import adminOfferGeoTargetingRouter from './routes/admin-offer-geo-targeting.routes.js';
import statsRouter from './routes/stats.routes.js';
import partnerRouter from './routes/partner.routes.js';
import usersRouter from './routes/users.routes.js';
import { initRedis, verifyRedisConnection, isRedisRequired } from './lib/redis.js';
import { register as metricsRegister } from './lib/metrics.js';
import { requestMetrics } from './middleware/requestMetrics.js';

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';
const API_PREFIX = '/api/v1';

app.use(requestId);
app.use(requestMetrics);
app.use(requestLogger);
app.use(
  cors({
    exposedHeaders: ['X-Request-ID'],
  }),
);
app.use(express.json());

app.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    res.set('Content-Type', metricsRegister.contentType);
    res.send(await metricsRegister.metrics());
  }),
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (req, res) => {
  try {
    await verifyDatabaseConnection();
  } catch (error) {
    return res.status(503).json({
      status: 'unavailable',
      dependency: 'postgres',
      reason: error.message,
    });
  }

  if (isRedisRequired()) {
    try {
      await verifyRedisConnection();
    } catch (error) {
      return res.status(503).json({
        status: 'unavailable',
        dependency: 'redis',
        reason: error.message,
      });
    }
  }

  return res.json({ status: 'ready' });
});

app.get(`${API_PREFIX}/message`, (req, res) =>
  sendSuccess(res, { message: 'Привет из backend!' }),
);

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/advertisers`, advertisersRouter);
app.use(`${API_PREFIX}/affiliates`, affiliatesRouter);
app.use(`${API_PREFIX}/offers`, offersRouter);
app.use(`${API_PREFIX}/clicks`, clicksRouter);
app.use(`${API_PREFIX}/conversions`, conversionsRouter);
app.use(`${API_PREFIX}/admin/stats`, adminStatsRouter);
app.use(`${API_PREFIX}/admin/offer-requests`, adminOfferRequestsRouter);
app.use(`${API_PREFIX}/admin/offers`, adminOfferGoalsRouter);
app.use(`${API_PREFIX}/admin/offers`, adminOfferGeoTargetingRouter);
app.use(`${API_PREFIX}/admin/offers`, adminOfferAccessRouter);
app.use(`${API_PREFIX}/stats`, statsRouter);
app.use(`${API_PREFIX}/partner`, partnerRouter);
app.use(`${API_PREFIX}/users`, usersRouter);
app.use('/track', trackingRouter);

app.get(
  `${API_PREFIX}/profile`,
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.user.userId);

    if (!user) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
        userId: req.user.userId,
      });
    }

    return sendSuccess(res, { user });
  }),
);

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

  await initRedis();

  app.listen(PORT, HOST, () => {
    console.log(`Backend listening on ${HOST}:${PORT}`);
  });
}

bootstrap();
