import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { verifyDatabaseConnection } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.get('/api/message', (req, res) => {
  res.json({ message: 'Привет из backend!' });
});

app.get('/api/health', async (req, res) => {
  try {
    await verifyDatabaseConnection();
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'DB unavailable' });
  }
});

async function bootstrap() {
  try {
    await verifyDatabaseConnection();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

bootstrap();
