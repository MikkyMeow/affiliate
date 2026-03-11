const jobHandlers = new Map();

function registerJobHandler(name, handler) {
  if (!name || typeof name !== 'string') {
    throw new Error('Job name must be a non-empty string');
  }

  if (typeof handler !== 'function') {
    throw new Error(`Handler for job "${name}" must be a function`);
  }

  if (jobHandlers.has(name)) {
    throw new Error(`Job handler for "${name}" is already registered`);
  }

  jobHandlers.set(name, handler);
}

function getJobHandler(name) {
  return jobHandlers.get(name);
}

function getRegisteredJobNames() {
  return Array.from(jobHandlers.keys());
}

export { registerJobHandler, getJobHandler, getRegisteredJobNames };
