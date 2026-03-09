import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createUser,
  findUserByEmail,
  findUserById,
} from '../models/userModel.js';
import {
  createRefreshTokenForUser,
  deleteRefreshToken,
  deleteRefreshTokenById,
  findRefreshToken,
} from '../models/refreshTokenModel.js';
import { authenticate } from '../middleware/auth.js';
import {
  ERROR_CODES,
  sendSuccess,
} from '../utils/response.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

function buildTokenPayload(user) {
  return {
    sub: user.id,
    email: user.email,
  };
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function issueAuthPackage(user) {
  const token = signToken(buildTokenPayload(user));
  const refreshToken = await createRefreshTokenForUser(user.id);

  return {
    token,
    refreshToken: refreshToken.token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
  };
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body ?? {};

    if (!email || !password) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Email и пароль обязательны',
        { provided: { email: Boolean(email), password: Boolean(password) } },
      );
    }

    if (password.length < 8) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        400,
        'Пароль должен быть длиннее 8 символов',
        { field: 'password', minLength: 8 },
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      throw new ApiError(
        ERROR_CODES.CONFLICT,
        409,
        'Пользователь с таким email уже существует',
        { email },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash, displayName: name });
    const response = await issueAuthPackage(user);

    return sendSuccess(res, response, { status: 201 });
  }),
);

router.post(
  '/login',
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

    const response = await issueAuthPackage(user);

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
    const profile = await findUserById(req.user.sub);

    if (!profile) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 404, 'Пользователь не найден', {
        userId: req.user.sub,
      });
    }

    return sendSuccess(res, { user: profile });
  }),
);

export default router;
