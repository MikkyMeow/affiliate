import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserById } from '../models/userModel.js';
import {
  createRefreshTokenForUser,
  deleteRefreshToken,
  deleteRefreshTokenById,
  findRefreshToken,
} from '../models/refreshTokenModel.js';
import { authenticate } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import {
  ERROR_CODES,
  sendSuccess,
} from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAffiliateForUser } from '../services/affiliates.service.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

function buildTokenPayload(user) {
  if (!user?.id) {
    throw new Error('User id is required to build token payload');
  }

  if (!user.role) {
    throw new Error('User role is required to build token payload');
  }

  return {
    userId: user.id,
    role: user.role,
    affiliateId: user.affiliateId ?? null,
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function issueAuthPackage(user) {
  let affiliateId = user.affiliateId ?? null;

  if (user.role === 'affiliate' && !affiliateId) {
    const affiliate = await requireAffiliateForUser(user.id);
    affiliateId = affiliate.id;
  }

  const token = signToken(buildTokenPayload({ ...user, affiliateId }));
  const refreshToken = await createRefreshTokenForUser(user.id);

  return {
    token,
    refreshToken: refreshToken.token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
      role: user.role,
      affiliateId,
    },
  };
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    throw new ApiError(
      ERROR_CODES.FORBIDDEN,
      403,
      'Самостоятельная регистрация отключена. Обратитесь к администратору.',
    );
  }),
);

router.post(
  '/login',
  loginRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Email и пароль обязательны',
        { provided: { email: Boolean(email), password: Boolean(password) } },
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        401,
        'Неверный email или пароль',
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new ApiError(
        ERROR_CODES.INVALID_CREDENTIALS,
        401,
        'Неверный email или пароль',
      );
    }

    const { passwordHash: _, ...sanitizedUser } = user;
    const response = await issueAuthPackage(sanitizedUser);

    return sendSuccess(res, response);
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Refresh token обязателен',
      );
    }

    const stored = await findRefreshToken(refreshToken);

    if (!stored) {
      throw new ApiError(
        ERROR_CODES.TOKEN_INVALID,
        401,
        'Недействительный refresh token',
      );
    }

    if (new Date(stored.expiresAt).getTime() < Date.now()) {
      await deleteRefreshTokenById(stored.id);
      throw new ApiError(
        ERROR_CODES.TOKEN_EXPIRED,
        401,
        'Refresh token просрочен',
      );
    }

    const user = await findUserById(stored.userId);
    await deleteRefreshTokenById(stored.id);

    if (!user) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
        userId: stored.userId,
      });
    }

    const response = await issueAuthPackage(user);
    return sendSuccess(res, response);
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) {
      await deleteRefreshToken(refreshToken);
    }

    return sendSuccess(res, { message: 'Выход выполнен' });
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const profile = await findUserById(req.user.userId);

    if (!profile) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
        userId: req.user.userId,
      });
    }

    return sendSuccess(res, { user: profile });
  }),
);

export default router;
