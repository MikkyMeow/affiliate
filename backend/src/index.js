import './config/load-env.js';
import app from './app.js';
import { ensureDatabaseSetup, verifyDatabaseConnection } from './db.js';
import { initRedis } from './lib/redis.js';

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

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
