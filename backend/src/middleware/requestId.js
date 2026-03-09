import { randomUUID } from 'crypto';

export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}
