const DEFAULT_COOKIE_NAME =
  process.env.REFRESH_TOKEN_COOKIE_NAME ?? 'refresh_token';

function parseBoolean(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  if (value.toLowerCase() === 'true') {
    return true;
  }
  if (value.toLowerCase() === 'false') {
    return false;
  }
  return fallback;
}

const baseCookieOptions = {
  httpOnly: true,
  sameSite: process.env.REFRESH_TOKEN_COOKIE_SAMESITE ?? 'lax',
  secure: parseBoolean(
    process.env.REFRESH_TOKEN_COOKIE_SECURE,
    process.env.NODE_ENV === 'production',
  ),
  path: process.env.REFRESH_TOKEN_COOKIE_PATH ?? '/',
};

export const refreshTokenCookieName = DEFAULT_COOKIE_NAME;

export function setRefreshTokenCookie(res, token, expiresAt) {
  if (!token) {
    throw new Error('Refresh token is required to set cookie');
  }
  const expiryDate =
    expiresAt instanceof Date ? expiresAt : new Date(expiresAt ?? Date.now());
  const maxAge = Math.max(0, expiryDate.getTime() - Date.now());

  res.cookie(refreshTokenCookieName, token, {
    ...baseCookieOptions,
    expires: expiryDate,
    maxAge,
  });
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(refreshTokenCookieName, {
    ...baseCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });
}

export function getRefreshTokenFromRequest(req) {
  return req.cookies?.[refreshTokenCookieName] ?? null;
}
