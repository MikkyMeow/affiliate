import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensureDatabaseSetup, verifyDatabaseConnection } from './db.js';
import authRouter from './routes/auth.js';
import { authenticate } from './middleware/auth.js';
import { findUserById } from './models/userModel.js';
import advertisersRouter from './routes/advertisers.js';
import affiliatesRouter from './routes/affiliates.js';

const app = express();
const PORT = process.env.PORT || 4000;
const API_PREFIX = '/api/v1';

app.use(cors());
app.use(express.json());

app.get(`${API_PREFIX}/message`, (req, res) => {
  res.json({ message: 'Привет из backend!' });
});

app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/advertisers`, advertisersRouter);
app.use(`${API_PREFIX}/affiliates`, affiliatesRouter);

app.get(`${API_PREFIX}/health`, async (req, res) => {
  try {
    await verifyDatabaseConnection();
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'DB unavailable' });
  }
});

app.get(`${API_PREFIX}/profile`, authenticate, async (req, res) => {
  const user = await findUserById(req.user.sub);

  if (!user) {
    return res.status(404).json({ message: 'Пользователь не найден' });
  }

  return res.json({ user });
});

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
