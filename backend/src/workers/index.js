import { createAsyncJobsWorker } from './asyncJobsWorker.js';
import { registerWorkerJobs } from './registerJobs.js';

function startAsyncWorker() {
  registerWorkerJobs();
  return createAsyncJobsWorker();
}

export { startAsyncWorker };
