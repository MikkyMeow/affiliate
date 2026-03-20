function basePayload(level, event, payload = {}) {
  return {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };
}

export function logInfo(event, payload = {}) {
  console.log(JSON.stringify(basePayload('info', event, payload)));
}

export function logWarn(event, payload = {}) {
  console.warn(JSON.stringify(basePayload('warn', event, payload)));
}

export function logError(event, payload = {}) {
  console.error(JSON.stringify(basePayload('error', event, payload)));
}
