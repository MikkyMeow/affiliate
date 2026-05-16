import './config/load-env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import advertisersRouter from './routes/advertisers.js';
import affiliatesRouter from './routes/affiliates.js';
import offersRouter from './routes/offers.routes.js';
import { sendSuccess } from './utils/response.js';
import authRouter from './routes/auth.js';
import { authenticate } from './middleware/auth.js';
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
import adminManagersRouter from './routes/admin-managers.routes.js';
import statsRouter from './routes/stats.routes.js';
import partnerRouter from './routes/partner.routes.js';
import usersRouter from './routes/users.routes.js';
import advertiserSelfRouter from './routes/advertiser-self.routes.js';
import advertiserOffersRouter from './routes/advertiser-offers.routes.js';
import advertiserStatsRouter from './routes/advertiser-stats.routes.js';
import advertiserPostbacksRouter from './routes/advertiser-postbacks.routes.js';
import advertiserFinanceRouter from './routes/advertiser-finance.routes.js';
import adminQuestionnairesRouter from './routes/admin-questionnaires.routes.js';
import meQuestionnaireRouter from './routes/me-questionnaire.routes.js';
import { requestMetrics } from './middleware/requestMetrics.js';
import { register as metricsRegister } from './lib/metrics.js';
import { verifyDatabaseConnection } from './db.js';
import { verifyRedisConnection, isRedisRequired } from './lib/redis.js';
import { getAuthContext } from './services/auth/auth-context.service.js';
import { validateUpdateProfileDto } from './validators/users.js';
import { updateOwnProfile } from './services/profile.service.js';
import { getActorContext } from './utils/actorContext.js';
import { ApiError } from './utils/apiError.js';
import { ERROR_CODES } from './utils/response.js';

const API_PREFIX = '/api/v1';

export function createApp() {
  const app = express();

  app.use(requestId);
  app.use(requestMetrics);
  app.use(requestLogger);
  const rawAllowedOrigins =
    process.env.CORS_ALLOWED_ORIGINS ??
    process.env.FRONTEND_URL ??
    process.env.APP_ORIGIN ??
    '';

  const allowedOrigins = rawAllowedOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!allowedOrigins.length) {
    console.warn(
      'CORS allowed origins are not configured; falling back to dynamically reflecting the request origin.',
    );
  }

  app.use(
    cors({
      exposedHeaders: ['X-Request-ID'],
      credentials: true,
      origin: allowedOrigins.length ? allowedOrigins : true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

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
  app.use(`${API_PREFIX}/admin/managers`, adminManagersRouter);
  app.use(`${API_PREFIX}/admin/questionnaires`, adminQuestionnairesRouter);
  app.use(`${API_PREFIX}/stats`, statsRouter);
  app.use(`${API_PREFIX}/me`, meQuestionnaireRouter);
  app.use(`${API_PREFIX}/partner`, partnerRouter);
  app.use(`${API_PREFIX}/users`, usersRouter);
  app.use(`${API_PREFIX}/advertiser/offers`, advertiserOffersRouter);
  app.use(`${API_PREFIX}/advertiser/stats`, advertiserStatsRouter);
  app.use(`${API_PREFIX}/advertiser/postbacks`, advertiserPostbacksRouter);
  app.use(`${API_PREFIX}/advertiser/finance`, advertiserFinanceRouter);
  app.use(`${API_PREFIX}/advertiser`, advertiserSelfRouter);
  app.use('/track', trackingRouter);

  app.get(
    `${API_PREFIX}/profile`,
    authenticate,
    asyncHandler(async (req, res) => {
      const context = await getAuthContext(req.user.userId);
      return sendSuccess(res, context);
    }),
  );

  app.patch(
    `${API_PREFIX}/profile`,
    authenticate,
    asyncHandler(async (req, res) => {
      const { dto, errors } = validateUpdateProfileDto(req.body);

      if (errors.length) {
        throw new ApiError(
          ERROR_CODES.VALIDATION_ERROR,
          400,
          'Ошибка валидации',
          { errors },
        );
      }

      const result = await updateOwnProfile(req.user, dto, {
        actor: getActorContext(req.user),
        requestId: req.id ?? null,
      });

      return sendSuccess(res, result);
    }),
  );

  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
