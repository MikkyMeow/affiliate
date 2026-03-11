import 'dotenv/config';
import { startAsyncWorker } from './workers/index.js';

console.log('🚀 Launching async worker process...');
const worker = startAsyncWorker();

worker
  .waitUntilReady()
  .then(() => {
    console.log('🟢 Async worker ready and listening for jobs');
  })
  .catch((error) => {
    console.error('❌ Failed to initialize async worker', error);
    process.exit(1);
  });

async function shutdown(signal) {
  console.log(`⚙️ Received ${signal}. Closing async worker...`);
  try {
    await worker.close();
    console.log('👋 Async worker stopped');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error while shutting down worker', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
