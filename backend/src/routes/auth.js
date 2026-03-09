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
  sendError,
  sendSuccess,
} from '../utils/response.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';

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

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};

  if (!email || !password) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Email и пароль обязательны',
      details: { provided: { email: Boolean(email), password: Boolean(password) } },
    });
  }

  if (password.length < 8) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Пароль должен быть длиннее 8 символов',
      details: { field: 'password', minLength: 8 },
    });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return sendError(res, {
      status: 409,
      code: ERROR_CODES.CONFLICT,
      message: 'Пользователь с таким email уже существует',
      details: { email },
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({ email, passwordHash, displayName: name });
  const response = await issueAuthPackage(user);

  return sendSuccess(res, response, { status: 201 });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Email и пароль обязательны',
      details: { provided: { email: Boolean(email), password: Boolean(password) } },
    });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return sendError(res, {
      status: 401,
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Неверный email или пароль',
    });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return sendError(res, {
      status: 401,
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: 'Неверный email или пароль',
    });
  }

  const response = await issueAuthPackage(user);

  return sendSuccess(res, response);
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken) {
    return sendError(res, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Refresh token обязателен',
    });
  }

  const stored = await findRefreshToken(refreshToken);

  if (!stored) {
    return sendError(res, {
      status: 401,
      code: ERROR_CODES.TOKEN_INVALID,
      message: 'Недействительный refresh token',
    });
  }

  if (new Date(stored.expiresAt).getTime() < Date.now()) {
    await deleteRefreshTokenById(stored.id);
    return sendError(res, {
      status: 401,
      code: ERROR_CODES.TOKEN_EXPIRED,
      message: 'Refresh token просрочен',
    });
  }

  const user = await findUserById(stored.userId);
  await deleteRefreshTokenById(stored.id);

  if (!user) {
    return sendError(res, {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Пользователь не найден',
      details: { userId: stored.userId },
    });
  }

  const response = await issueAuthPackage(user);
  return sendSuccess(res, response);
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    await deleteRefreshToken(refreshToken);
  }

  return sendSuccess(res, { message: 'Выход выполнен' });
});

router.get('/me', authenticate, async (req, res) => {
  const profile = await findUserById(req.user.sub);

  if (!profile) {
    return sendError(res, {
      status: 404,
      code: ERROR_CODES.NOT_FOUND,
      message: 'Пользователь не найден',
      details: { userId: req.user.sub },
    });
  }

  return sendSuccess(res, { user: profile });
});

export default router;
