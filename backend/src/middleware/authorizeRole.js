import { ApiError } from '../utils/apiError.js';
import { ERROR_CODES } from '../utils/response.js';

export function authorizeRole(...roles) {
  if (roles.length === 0) {
    throw new Error('authorizeRole requires at least one role');
  }

  const allowed = new Set(roles);

  return (req, res, next) => {
    const role = req.user?.role ?? 'admin';
    if (!allowed.has(role)) {
      return next(
        new ApiError(
          ERROR_CODES.FORBIDDEN,
          403,
          'Недостаточно прав для выполнения действия',
          {
            requiredRoles: [...allowed],
            actualRole: role,
          },
        ),
      );
    }

    return next();
  };
}
