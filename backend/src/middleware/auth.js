import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return next(
      new ApiError(ERROR_CODES.AUTH_REQUIRED, 401, 'Требуется авторизация', {
        headerPresent: Boolean(header),
      }),
    );
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    const isExpired = error?.name === 'TokenExpiredError';
    return next(
      new ApiError(
        isExpired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID,
        401,
        isExpired ? 'Срок действия токена истек' : 'Токен недействителен',
        { reason: error?.message },
      ),
    );
  }
}
