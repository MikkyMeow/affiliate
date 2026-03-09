import jwt from 'jsonwebtoken';
import { ERROR_CODES, sendError } from '../utils/response.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return sendError(res, {
      status: 401,
      code: ERROR_CODES.AUTH_REQUIRED,
      message: 'Требуется авторизация',
      details: { headerPresent: Boolean(header) },
    });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    const isExpired = error?.name === 'TokenExpiredError';
    return sendError(res, {
      status: 401,
      code: isExpired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID,
      message: isExpired
        ? 'Срок действия токена истек'
        : 'Токен недействителен',
      details: { reason: error?.message },
    });
  }
}
