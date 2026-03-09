import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensureDatabaseSetup, verifyDatabaseConnection } from './db.js';
import advertisersRouter from './routes/advertisers.js';
import affiliatesRouter from './routes/affiliates.js';
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
